use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result, bail};
use chrono::{DateTime, NaiveDate, Utc};
use clap::{Parser, Subcommand, ValueEnum};
use jsonschema::{Registry, Validator};
use rusqlite::{Connection, params};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

const PROPOSE_VERSION: &str = "pow-propose.v1";

#[derive(Parser, Debug)]
#[command(name = "pow")]
#[command(about = "Places of Worship data revision tooling")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Validate RA evidence CSVs or revision JSON/JSONL files.
    Validate(ValidateArgs),
    /// Validate and write a batch into the local staging database.
    Stage(StageArgs),
    /// Emit draft change-event JSONL from a staged RA evidence batch.
    Propose(ProposeArgs),
    /// Render a reviewer report for a batch of staged or proposed change events.
    Diff(DiffArgs),
}

#[derive(Parser, Debug)]
struct ValidateArgs {
    /// Input file to validate.
    input: PathBuf,

    /// Directory containing JSON Schemas.
    #[arg(long, default_value = "schemas")]
    schema_dir: PathBuf,

    /// Directory containing RA CSV templates and controlled vocabularies.
    #[arg(long, default_value = "docs/templates/ra-historical-site-evidence")]
    template_dir: PathBuf,

    /// Input format. Auto uses the file extension.
    #[arg(long, value_enum, default_value_t = InputFormat::Auto)]
    format: InputFormat,

    /// Report format.
    #[arg(long, value_enum, default_value_t = ReportFormat::Text)]
    report: ReportFormat,
}

#[derive(Parser, Debug)]
struct StageArgs {
    /// Input file to validate and stage.
    input: PathBuf,

    /// Local SQLite staging database.
    #[arg(long, default_value = ".pow/staging.sqlite")]
    db: PathBuf,

    /// Directory containing JSON Schemas.
    #[arg(long, default_value = "schemas")]
    schema_dir: PathBuf,

    /// Directory containing RA CSV templates and controlled vocabularies.
    #[arg(long, default_value = "docs/templates/ra-historical-site-evidence")]
    template_dir: PathBuf,

    /// Input format. Auto uses the file extension.
    #[arg(long, value_enum, default_value_t = InputFormat::Auto)]
    format: InputFormat,

    /// Report format.
    #[arg(long, value_enum, default_value_t = ReportFormat::Text)]
    report: ReportFormat,
}

#[derive(Parser, Debug)]
struct ProposeArgs {
    /// Staged batch id to translate into draft change events.
    batch_id: String,

    /// Local SQLite staging database.
    #[arg(long, default_value = ".pow/staging.sqlite")]
    db: PathBuf,

    /// Directory containing JSON Schemas.
    #[arg(long, default_value = "schemas")]
    schema_dir: PathBuf,

    /// Persist the emitted events as a derived stage batch so `pow diff`
    /// can read them. Without this flag, events go to stdout only.
    #[arg(long)]
    persist: bool,
}

#[derive(Parser, Debug)]
struct DiffArgs {
    /// Batch id whose change events should be diffed.
    /// Use the derived batch id printed by `pow propose --persist`,
    /// or the id of any batch staged as JSONL change events.
    batch_id: String,

    /// Local SQLite staging database.
    #[arg(long, default_value = ".pow/staging.sqlite")]
    db: PathBuf,

    /// Directory containing JSON Schemas.
    #[arg(long, default_value = "schemas")]
    schema_dir: PathBuf,

    /// Report format.
    #[arg(long, value_enum, default_value_t = ReportFormat::Text)]
    report: ReportFormat,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum InputFormat {
    Auto,
    Csv,
    Json,
    Jsonl,
}

impl InputFormat {
    fn label(self) -> &'static str {
        match self {
            InputFormat::Auto => "auto",
            InputFormat::Csv => "csv",
            InputFormat::Json => "json",
            InputFormat::Jsonl => "jsonl",
        }
    }
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum ReportFormat {
    Text,
    Json,
}

#[derive(Clone, Debug, Serialize)]
struct ValidationSummary {
    input: String,
    format: String,
    records_checked: usize,
    errors: Vec<Diagnostic>,
    warnings: Vec<Diagnostic>,
}

#[derive(Clone, Debug, Serialize)]
struct Diagnostic {
    record: Option<usize>,
    field: Option<String>,
    path: Option<String>,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
struct StageSummary {
    batch_id: String,
    db_path: String,
    input: String,
    format: String,
    input_sha256: String,
    input_bytes: usize,
    staged_at: String,
    records_checked: usize,
    records_stored: usize,
    warnings: Vec<Diagnostic>,
}

#[derive(Debug)]
enum StageOutcome {
    Staged(StageSummary),
    Rejected(ValidationSummary),
}

#[derive(Debug)]
struct StageRecord {
    record_index: usize,
    record_kind: &'static str,
    raw_record: String,
    parsed_json: Option<Value>,
}

impl ValidationSummary {
    fn new(input: &Path, format: &str) -> Self {
        Self {
            input: input.display().to_string(),
            format: format.to_string(),
            records_checked: 0,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    fn error(
        &mut self,
        record: Option<usize>,
        field: Option<&str>,
        path: Option<&str>,
        message: impl Into<String>,
    ) {
        self.errors.push(Diagnostic {
            record,
            field: field.map(str::to_owned),
            path: path.map(str::to_owned),
            message: message.into(),
        });
    }

    fn warning(
        &mut self,
        record: Option<usize>,
        field: Option<&str>,
        path: Option<&str>,
        message: impl Into<String>,
    ) {
        self.warnings.push(Diagnostic {
            record,
            field: field.map(str::to_owned),
            path: path.map(str::to_owned),
            message: message.into(),
        });
    }
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli) {
        Ok(has_errors) => {
            if has_errors {
                ExitCode::from(1)
            } else {
                ExitCode::SUCCESS
            }
        }
        Err(error) => {
            eprintln!("error: {error:#}");
            ExitCode::from(2)
        }
    }
}

fn run(cli: Cli) -> Result<bool> {
    match cli.command {
        Commands::Validate(args) => {
            let report = args.report;
            let summary = validate(args)?;
            match report {
                ReportFormat::Text => print_text_summary(&summary)?,
                ReportFormat::Json => print_json_summary(&summary)?,
            }
            Ok(!summary.errors.is_empty())
        }
        Commands::Stage(args) => {
            let report = args.report;
            let outcome = stage(args)?;
            match &outcome {
                StageOutcome::Staged(summary) => match report {
                    ReportFormat::Text => print_stage_text_summary(summary)?,
                    ReportFormat::Json => print_stage_json_summary(summary)?,
                },
                StageOutcome::Rejected(summary) => match report {
                    ReportFormat::Text => {
                        println!("pow stage: validation failed; no staging write performed");
                        print_text_summary(summary)?;
                    }
                    ReportFormat::Json => print_json_summary(summary)?,
                },
            }
            Ok(matches!(outcome, StageOutcome::Rejected(_)))
        }
        Commands::Propose(args) => {
            let persist = args.persist;
            let db_path = args.db.clone();
            let source_batch_id = args.batch_id.clone();
            let events = propose(args)?;
            for event in &events {
                println!("{}", serde_json::to_string(event)?);
            }
            if persist {
                let derived_batch_id = persist_proposed_batch(&db_path, &source_batch_id, &events)?;
                eprintln!(
                    "pow propose: persisted {} event(s) as derived batch {} (source {})",
                    events.len(),
                    derived_batch_id,
                    source_batch_id
                );
            }
            Ok(false)
        }
        Commands::Diff(args) => {
            let report = args.report;
            let outcome = diff(args)?;
            match report {
                ReportFormat::Text => print_diff_text_report(&outcome)?,
                ReportFormat::Json => print_diff_json_report(&outcome)?,
            }
            Ok(false)
        }
    }
}

fn validate(args: ValidateArgs) -> Result<ValidationSummary> {
    let format = detect_format(&args.input, args.format)?;
    validate_input(&args.input, format, &args.schema_dir, &args.template_dir)
}

fn validate_input(
    input: &Path,
    format: InputFormat,
    schema_dir: &Path,
    template_dir: &Path,
) -> Result<ValidationSummary> {
    let summary = match format {
        InputFormat::Csv => validate_csv(input, template_dir)?,
        InputFormat::Json => validate_json_file(input, schema_dir)?,
        InputFormat::Jsonl => validate_jsonl_file(input, schema_dir)?,
        InputFormat::Auto => unreachable!("auto should have been resolved"),
    };
    Ok(summary)
}

fn stage(args: StageArgs) -> Result<StageOutcome> {
    let format = detect_format(&args.input, args.format)?;
    let validation = validate_input(&args.input, format, &args.schema_dir, &args.template_dir)?;
    if !validation.errors.is_empty() {
        return Ok(StageOutcome::Rejected(validation));
    }

    let raw_input = fs::read(&args.input)
        .with_context(|| format!("failed to read {}", args.input.display()))?;
    let input_sha256 = sha256_hex(&raw_input);
    let staged_at = Utc::now().to_rfc3339();
    let batch_id = make_batch_id(&input_sha256)?;
    let records = extract_stage_records(&args.input, format)?;
    let records_stored = records.len();
    let summary = StageSummary {
        batch_id,
        db_path: args.db.display().to_string(),
        input: args.input.display().to_string(),
        format: format.label().to_owned(),
        input_sha256,
        input_bytes: raw_input.len(),
        staged_at,
        records_checked: validation.records_checked,
        records_stored,
        warnings: validation.warnings.clone(),
    };

    write_stage_batch(&args.db, &summary, &validation, raw_input, &records)?;
    Ok(StageOutcome::Staged(summary))
}

#[derive(Debug)]
struct StagedBatch {
    batch_id: String,
    input_sha256: String,
    staged_at: String,
}

#[derive(Debug)]
struct StagedJsonRecord {
    record_index: usize,
    parsed_json: Value,
}

struct WorshipObservationDraft<'a> {
    batch: &'a StagedBatch,
    record_index: usize,
    row: &'a serde_json::Map<String, Value>,
    recorded_at: &'a str,
    target_year_affects: Vec<Value>,
    original_row_id: Option<&'a str>,
    evidence_note: Option<&'a str>,
}

fn propose(args: ProposeArgs) -> Result<Vec<Value>> {
    let conn = Connection::open(&args.db)
        .with_context(|| format!("failed to open staging database {}", args.db.display()))?;
    initialise_staging_schema(&conn)?;
    let batch = load_staged_batch(&conn, &args.batch_id)?;
    let records = load_staged_records(&conn, &args.batch_id)?;
    if records.is_empty() {
        bail!("staged batch {} has no records", args.batch_id);
    }

    let recorded_at = batch.staged_at.clone();
    let mut events = Vec::new();
    let mut warnings = Vec::new();
    for record in records {
        let mut record_events = propose_record_events(&batch, &record, &recorded_at, &mut warnings)
            .with_context(|| {
                format!(
                    "failed to propose events for record {}",
                    record.record_index
                )
            })?;
        events.append(&mut record_events);
    }
    if events.is_empty() {
        bail!(
            "staged batch {} produced no draft change events",
            args.batch_id
        );
    }

    validate_proposed_events(&events, &args.schema_dir)?;
    for warning in warnings {
        print_diagnostic_to_stderr("WARN", &warning);
    }
    Ok(events)
}

fn load_staged_batch(conn: &Connection, batch_id: &str) -> Result<StagedBatch> {
    let mut stmt = conn.prepare(
        "SELECT batch_id, input_sha256, staged_at
         FROM stage_batches
         WHERE batch_id = ?1",
    )?;
    let mut rows = stmt.query(params![batch_id])?;
    let Some(row) = rows.next()? else {
        bail!("no staged batch found for {batch_id}");
    };
    Ok(StagedBatch {
        batch_id: row.get(0)?,
        input_sha256: row.get(1)?,
        staged_at: row.get(2)?,
    })
}

fn load_staged_records(conn: &Connection, batch_id: &str) -> Result<Vec<StagedJsonRecord>> {
    let mut stmt = conn.prepare(
        "SELECT record_index, parsed_json
         FROM stage_records
         WHERE batch_id = ?1
         ORDER BY record_index",
    )?;
    let rows = stmt.query_map(params![batch_id], |row| {
        let record_index: i64 = row.get(0)?;
        let parsed_json: String = row.get(1)?;
        Ok((record_index, parsed_json))
    })?;

    let mut records = Vec::new();
    for row in rows {
        let (record_index, parsed_json) = row?;
        let parsed_json = serde_json::from_str::<Value>(&parsed_json)
            .with_context(|| format!("stage record {record_index} is not valid JSON"))?;
        records.push(StagedJsonRecord {
            record_index: record_index as usize,
            parsed_json,
        });
    }
    Ok(records)
}

fn propose_record_events(
    batch: &StagedBatch,
    record: &StagedJsonRecord,
    recorded_at: &str,
    warnings: &mut Vec<Diagnostic>,
) -> Result<Vec<Value>> {
    let row = record
        .parsed_json
        .as_object()
        .context("staged record is not a JSON object")?;
    if row.contains_key("site_observation_id") {
        Ok(vec![propose_site_observation_event(
            batch,
            record.record_index,
            row,
            recorded_at,
            warnings,
        )?])
    } else if row.contains_key("evidence_row_id") {
        Ok(vec![propose_wide_evidence_event(
            batch,
            record.record_index,
            row,
            recorded_at,
            warnings,
        )?])
    } else {
        bail!(
            "unsupported staged CSV template; pow propose v1 supports site_observations.csv and site_evidence_wide.csv"
        );
    }
}

fn propose_site_observation_event(
    batch: &StagedBatch,
    record_index: usize,
    row: &serde_json::Map<String, Value>,
    recorded_at: &str,
    warnings: &mut Vec<Diagnostic>,
) -> Result<Value> {
    let target_year = required_field(row, "target_year")?;
    let target_date = target_year_to_snapshot_date(target_year)?;
    let existence_status = optional_field(row, "existence_status");
    let worship_use_status = optional_field(row, "worship_use_status");
    let target_year_status = derive_target_year_status(existence_status, worship_use_status)?;
    let confidence = optional_probability(row, "target_year_probability")?;
    let target_year_affects = vec![target_year_affect(
        &target_date,
        &target_year_status,
        worship_use_status,
        confidence,
        optional_field(row, "evidence_summary"),
    )];

    build_worship_observation_event(
        WorshipObservationDraft {
            batch,
            record_index,
            row,
            recorded_at,
            target_year_affects,
            original_row_id: optional_field(row, "site_observation_id"),
            evidence_note: optional_field(row, "evidence_summary"),
        },
        warnings,
    )
}

fn propose_wide_evidence_event(
    batch: &StagedBatch,
    record_index: usize,
    row: &serde_json::Map<String, Value>,
    recorded_at: &str,
    warnings: &mut Vec<Diagnostic>,
) -> Result<Value> {
    let mut target_year_affects = Vec::new();
    for year in ["2013", "2018", "2023"] {
        let status_field = format!("target_year_{year}_status");
        let status = optional_field(row, &status_field).unwrap_or_default();
        if status.is_empty() || status == "not_assessed" {
            continue;
        }
        let probability_field = format!("target_year_{year}_probability");
        let evidence_field = format!("target_year_{year}_evidence");
        let target_date = format!("{year}-09-01");
        target_year_affects.push(target_year_affect(
            &target_date,
            status,
            optional_field(row, "worship_use_status"),
            optional_probability(row, &probability_field)?,
            optional_field(row, &evidence_field),
        ));
    }
    if target_year_affects.is_empty() {
        bail!("target_year_affects would be empty; enter at least one assessed target-year status");
    }

    build_worship_observation_event(
        WorshipObservationDraft {
            batch,
            record_index,
            row,
            recorded_at,
            target_year_affects,
            original_row_id: optional_field(row, "evidence_row_id"),
            evidence_note: optional_field(row, "date_evidence_summary")
                .or_else(|| optional_field(row, "source_notes")),
        },
        warnings,
    )
}

fn build_worship_observation_event(
    draft: WorshipObservationDraft<'_>,
    warnings: &mut Vec<Diagnostic>,
) -> Result<Value> {
    let WorshipObservationDraft {
        batch,
        record_index,
        row,
        recorded_at,
        target_year_affects,
        original_row_id,
        evidence_note,
    } = draft;
    if target_year_affects.is_empty() {
        bail!("target_year_affects would be empty");
    }
    let matched_current_site_id = required_field(row, "matched_current_site_id")?;
    if let Some(raw_denomination) = optional_field(row, "denomination_or_tradition_raw") {
        warnings.push(Diagnostic {
            record: Some(record_index),
            field: Some("denomination_or_tradition_raw".to_owned()),
            path: None,
            message: format!(
                "raw denomination/tradition {raw_denomination:?} was not mapped; denomination_set is deferred until the taxonomy exists"
            ),
        });
    }

    let seed = format!(
        "{}:{record_index}:{PROPOSE_VERSION}:worship_function_observed",
        batch.batch_id
    );
    let event_id = deterministic_uuid(&seed);
    let client_event_id = format!(
        "{PROPOSE_VERSION}:{}:{record_index}:worship_function_observed",
        batch.batch_id
    );
    let effective_date = target_year_affects
        .first()
        .and_then(|value| value.get("target_year"))
        .and_then(Value::as_str)
        .context("target_year_affects missing target_year")?
        .to_owned();

    let mut source_ref = serde_json::Map::new();
    source_ref.insert(
        "source_ref_type".to_owned(),
        Value::String("evidence_row".to_owned()),
    );
    source_ref.insert(
        "evidence_row_id".to_owned(),
        Value::String(format!("stage_record:{}:{record_index}", batch.batch_id)),
    );
    source_ref.insert(
        "stage_batch_id".to_owned(),
        Value::String(batch.batch_id.clone()),
    );
    source_ref.insert(
        "stage_record_index".to_owned(),
        Value::Number(serde_json::Number::from(record_index as u64)),
    );
    source_ref.insert(
        "stage_input_sha256".to_owned(),
        Value::String(batch.input_sha256.clone()),
    );
    if let Some(value) = optional_field(row, "source_dataset_id") {
        source_ref.insert(
            "source_dataset_id".to_owned(),
            Value::String(value.to_owned()),
        );
    }
    if let Some(value) = optional_field(row, "source_record_id") {
        source_ref.insert(
            "source_record_id".to_owned(),
            Value::String(value.to_owned()),
        );
    }
    if let Some(value) = optional_field(row, "source_url_or_file") {
        source_ref.insert("url_or_file".to_owned(), Value::String(value.to_owned()));
    }
    if let Some(value) = optional_field(row, "site_observation_id") {
        source_ref.insert(
            "site_observation_id".to_owned(),
            Value::String(value.to_owned()),
        );
    }
    source_ref.insert(
        "licence_status".to_owned(),
        Value::String(source_licence_status(optional_field(row, "licence_flag"))),
    );
    if let Some(note) = evidence_note.or(original_row_id) {
        source_ref.insert(
            "evidence_summary".to_owned(),
            Value::String(note.to_owned()),
        );
    }

    let mut target = serde_json::Map::new();
    target.insert("target_type".to_owned(), Value::String("site".to_owned()));
    target.insert(
        "matched_current_site_id".to_owned(),
        Value::String(matched_current_site_id.to_owned()),
    );
    if let Some(value) = optional_field(row, "candidate_site_id") {
        target.insert(
            "candidate_site_id".to_owned(),
            Value::String(value.to_owned()),
        );
    }

    let mut payload = serde_json::Map::new();
    payload.insert(
        "payload_type".to_owned(),
        Value::String("worship_function_update".to_owned()),
    );
    if let Some(value) = optional_field(row, "worship_use_status") {
        payload.insert(
            "worship_use_status".to_owned(),
            Value::String(value.to_owned()),
        );
    }
    if let Some(value) = optional_field(row, "site_type") {
        payload.insert("site_type".to_owned(), Value::String(value.to_owned()));
    }
    payload.insert(
        "target_year_affects".to_owned(),
        Value::Array(target_year_affects),
    );
    if let Some(note) = evidence_note {
        payload.insert("function_note".to_owned(), Value::String(note.to_owned()));
    }

    Ok(serde_json::json!({
        "schema_version": "change-event.v1",
        "event_id": event_id,
        "client_event_id": client_event_id,
        "event_type": "worship_function_observed",
        "event_intent": "evidence_observation",
        "target": Value::Object(target),
        "effective": {
            "effective_date": effective_date,
            "date_precision": "day",
            "basis": "source_observation",
            "note": "Draft event generated from staged RA evidence by pow propose."
        },
        "recorded_at": recorded_at,
        "source_refs": [Value::Object(source_ref)],
        "review": {
            "review_status": "staged",
            "rationale": "Draft event generated from staged RA evidence."
        },
        "payload_hash": null,
        "payload": Value::Object(payload)
    }))
}

fn target_year_affect(
    target_year: &str,
    target_year_status: &str,
    worship_use_status: Option<&str>,
    confidence: Option<f64>,
    note: Option<&str>,
) -> Value {
    let mut object = serde_json::Map::new();
    object.insert(
        "target_year".to_owned(),
        Value::String(target_year.to_owned()),
    );
    object.insert(
        "target_year_status".to_owned(),
        Value::String(target_year_status.to_owned()),
    );
    if let Some(value) = worship_use_status {
        object.insert(
            "worship_use_status".to_owned(),
            Value::String(value.to_owned()),
        );
    }
    if let Some(value) = confidence.and_then(serde_json::Number::from_f64) {
        object.insert("confidence".to_owned(), Value::Number(value));
    }
    object.insert(
        "basis".to_owned(),
        Value::String("source_observation".to_owned()),
    );
    if let Some(value) = note {
        object.insert("note".to_owned(), Value::String(value.to_owned()));
    }
    Value::Object(object)
}

fn validate_proposed_events(events: &[Value], schema_dir: &Path) -> Result<()> {
    let validators = SchemaValidators::load(schema_dir)?;
    let mut summary = ValidationSummary::new(Path::new("pow propose"), "jsonl");
    for (index, event) in events.iter().enumerate() {
        validate_json_record(event, index + 1, &validators, &mut summary);
    }
    if !summary.errors.is_empty() {
        for diagnostic in &summary.errors {
            print_diagnostic_to_stderr("ERROR", diagnostic);
        }
        bail!("pow propose generated invalid change events");
    }
    Ok(())
}

fn required_field<'a>(row: &'a serde_json::Map<String, Value>, field: &str) -> Result<&'a str> {
    optional_field(row, field).with_context(|| format!("{field} is required for pow propose v1"))
}

fn optional_field<'a>(row: &'a serde_json::Map<String, Value>, field: &str) -> Option<&'a str> {
    row.get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn optional_probability(row: &serde_json::Map<String, Value>, field: &str) -> Result<Option<f64>> {
    let Some(value) = optional_field(row, field) else {
        return Ok(None);
    };
    let probability = value
        .parse::<f64>()
        .with_context(|| format!("{field}={value:?} is not numeric"))?;
    if !(0.0..=1.0).contains(&probability) {
        bail!("{field}={probability} is outside 0..1");
    }
    Ok(Some(probability))
}

fn target_year_to_snapshot_date(value: &str) -> Result<String> {
    let value = value.trim();
    if value.len() == 4 && value.chars().all(|ch| ch.is_ascii_digit()) {
        return Ok(format!("{value}-09-01"));
    }
    if parse_full_date(value).is_some() {
        return Ok(value.to_owned());
    }
    bail!("{value:?} is not a valid target_year; use YYYY or YYYY-MM-DD")
}

fn derive_target_year_status(
    existence_status: Option<&str>,
    worship_use_status: Option<&str>,
) -> Result<String> {
    if matches!(existence_status, Some("absent"))
        && matches!(
            worship_use_status,
            Some("confirmed_worship" | "probable_worship")
        )
    {
        bail!("existence_status=absent conflicts with worship_use_status indicating worship");
    }
    if matches!(
        worship_use_status,
        Some("confirmed_worship" | "probable_worship")
    ) {
        return Ok("present".to_owned());
    }
    if matches!(existence_status, Some("absent"))
        || matches!(worship_use_status, Some("not_worship"))
    {
        return Ok("absent".to_owned());
    }
    Ok("uncertain".to_owned())
}

fn source_licence_status(value: Option<&str>) -> String {
    match value {
        Some("clear") => "accepted",
        Some("needs_review") => "needs_review",
        Some("restricted") => "restricted",
        _ => "unknown",
    }
    .to_owned()
}

fn deterministic_uuid(seed: &str) -> String {
    let digest = Sha256::digest(seed.as_bytes());
    let hex = bytes_to_hex(&digest);
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

fn detect_format(input: &Path, format: InputFormat) -> Result<InputFormat> {
    if !matches!(format, InputFormat::Auto) {
        return Ok(format);
    }
    let ext = input
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match ext.as_str() {
        "csv" => Ok(InputFormat::Csv),
        "json" => Ok(InputFormat::Json),
        "jsonl" | "ndjson" => Ok(InputFormat::Jsonl),
        _ => bail!("cannot infer input format from extension; pass --format csv, json, or jsonl"),
    }
}

fn extract_stage_records(input: &Path, format: InputFormat) -> Result<Vec<StageRecord>> {
    match format {
        InputFormat::Csv => extract_csv_stage_records(input),
        InputFormat::Json => extract_json_stage_records(input),
        InputFormat::Jsonl => extract_jsonl_stage_records(input),
        InputFormat::Auto => unreachable!("auto should have been resolved"),
    }
}

fn extract_csv_stage_records(input: &Path) -> Result<Vec<StageRecord>> {
    let mut reader = csv::Reader::from_path(input)
        .with_context(|| format!("failed to reopen {}", input.display()))?;
    let headers = reader
        .headers()
        .with_context(|| format!("failed to read CSV headers from {}", input.display()))?
        .clone();
    let mut records = Vec::new();

    for (index, row) in reader.records().enumerate() {
        let record_index = index + 2;
        let row = row.with_context(|| format!("failed to read CSV record {record_index}"))?;
        let mut object = serde_json::Map::new();
        for (header, value) in headers.iter().zip(row.iter()) {
            object.insert(header.to_owned(), Value::String(value.to_owned()));
        }
        let parsed_json = Value::Object(object);
        let raw_record = serde_json::to_string(&parsed_json)?;
        records.push(StageRecord {
            record_index,
            record_kind: "csv_row",
            raw_record,
            parsed_json: Some(parsed_json),
        });
    }

    Ok(records)
}

fn extract_json_stage_records(input: &Path) -> Result<Vec<StageRecord>> {
    let file =
        File::open(input).with_context(|| format!("failed to reopen {}", input.display()))?;
    let value: Value = serde_json::from_reader(file)
        .with_context(|| format!("failed to parse JSON in {}", input.display()))?;

    match value {
        Value::Array(values) => values
            .into_iter()
            .enumerate()
            .map(|(index, value)| {
                let raw_record = serde_json::to_string(&value)?;
                Ok(StageRecord {
                    record_index: index + 1,
                    record_kind: "json_record",
                    raw_record,
                    parsed_json: Some(value),
                })
            })
            .collect(),
        value => {
            let raw_record = serde_json::to_string(&value)?;
            Ok(vec![StageRecord {
                record_index: 1,
                record_kind: "json_record",
                raw_record,
                parsed_json: Some(value),
            }])
        }
    }
}

fn extract_jsonl_stage_records(input: &Path) -> Result<Vec<StageRecord>> {
    let file =
        File::open(input).with_context(|| format!("failed to reopen {}", input.display()))?;
    let mut records = Vec::new();

    for (index, line) in BufReader::new(file).lines().enumerate() {
        let record_index = index + 1;
        let line = line.with_context(|| format!("failed to read line {record_index}"))?;
        if line.trim().is_empty() {
            continue;
        }
        let parsed_json = serde_json::from_str::<Value>(&line)
            .with_context(|| format!("failed to parse JSONL record {record_index}"))?;
        records.push(StageRecord {
            record_index,
            record_kind: "jsonl_line",
            raw_record: line,
            parsed_json: Some(parsed_json),
        });
    }

    Ok(records)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    bytes_to_hex(&digest)
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push_str(&format!("{byte:02x}"));
    }
    output
}

fn make_batch_id(input_sha256: &str) -> Result<String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("system clock is before Unix epoch")?
        .as_nanos();
    Ok(format!("batch_{nanos}_{}", &input_sha256[..12]))
}

fn write_stage_batch(
    db_path: &Path,
    summary: &StageSummary,
    validation: &ValidationSummary,
    raw_input: Vec<u8>,
    records: &[StageRecord],
) -> Result<()> {
    if let Some(parent) = db_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    let mut conn = Connection::open(db_path)
        .with_context(|| format!("failed to open staging database {}", db_path.display()))?;
    initialise_staging_schema(&conn)?;
    let tx = conn.transaction()?;

    let validation_summary_json = serde_json::to_string(validation)?;
    tx.execute(
        "INSERT INTO stage_batches (
            batch_id, input_path, input_format, input_sha256, input_bytes,
            staged_at, records_checked, records_stored, error_count,
            warning_count, validation_summary_json, raw_input
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            &summary.batch_id,
            &summary.input,
            &summary.format,
            &summary.input_sha256,
            summary.input_bytes as i64,
            &summary.staged_at,
            summary.records_checked as i64,
            summary.records_stored as i64,
            validation.errors.len() as i64,
            validation.warnings.len() as i64,
            validation_summary_json,
            raw_input,
        ],
    )?;

    for record in records {
        let parsed_json = record
            .parsed_json
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        tx.execute(
            "INSERT INTO stage_records (
                batch_id, record_index, record_kind, raw_record, parsed_json
            ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &summary.batch_id,
                record.record_index as i64,
                record.record_kind,
                &record.raw_record,
                parsed_json,
            ],
        )?;
    }

    write_diagnostics(&tx, &summary.batch_id, "warning", &validation.warnings)?;
    write_diagnostics(&tx, &summary.batch_id, "error", &validation.errors)?;

    tx.commit()?;
    Ok(())
}

fn persist_proposed_batch(
    db_path: &Path,
    source_batch_id: &str,
    events: &[Value],
) -> Result<String> {
    if events.is_empty() {
        bail!("no proposed events to persist");
    }

    let mut jsonl = String::new();
    for event in events {
        jsonl.push_str(&serde_json::to_string(event)?);
        jsonl.push('\n');
    }
    let raw_input = jsonl.into_bytes();
    let input_sha256 = sha256_hex(&raw_input);
    let derived_batch_id = make_derived_batch_id(source_batch_id)?;
    let staged_at = Utc::now().to_rfc3339();

    if let Some(parent) = db_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }
    let mut conn = Connection::open(db_path)
        .with_context(|| format!("failed to open staging database {}", db_path.display()))?;
    initialise_staging_schema(&conn)?;
    let tx = conn.transaction()?;

    let validation_summary_json = serde_json::json!({
        "input": format!("<derived from {source_batch_id}>"),
        "format": "jsonl",
        "records_checked": events.len(),
        "errors": [],
        "warnings": []
    })
    .to_string();
    let synthetic_path = format!("<derived from {source_batch_id}>");

    tx.execute(
        "INSERT INTO stage_batches (
            batch_id, input_path, input_format, input_sha256, input_bytes,
            staged_at, records_checked, records_stored, error_count,
            warning_count, validation_summary_json, raw_input, parent_batch_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            &derived_batch_id,
            &synthetic_path,
            "jsonl",
            &input_sha256,
            raw_input.len() as i64,
            &staged_at,
            events.len() as i64,
            events.len() as i64,
            0i64,
            0i64,
            validation_summary_json,
            raw_input,
            source_batch_id,
        ],
    )?;

    for (index, event) in events.iter().enumerate() {
        let serialised = serde_json::to_string(event)?;
        // One-based numbering: aligns derived stage records with how
        // `pow validate`/`pow stage` report record positions, so a reviewer
        // running `pow diff` sees the first event as record 1, not record 0.
        let record_index = (index + 1) as i64;
        tx.execute(
            "INSERT INTO stage_records (
                batch_id, record_index, record_kind, raw_record, parsed_json
            ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &derived_batch_id,
                record_index,
                "proposed_event",
                &serialised,
                Some(&serialised),
            ],
        )?;
    }

    tx.commit()?;
    Ok(derived_batch_id)
}

fn make_derived_batch_id(source_batch_id: &str) -> Result<String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("system clock is before Unix epoch")?
        .as_nanos();
    let digest = Sha256::digest(source_batch_id.as_bytes());
    let hex = bytes_to_hex(&digest);
    Ok(format!("proposed_{nanos}_{}", &hex[..12]))
}

#[derive(Clone, Debug, Serialize)]
struct DiffOutcome {
    summary: DiffSummary,
    sites: Vec<SiteChangeset>,
    target_years: BTreeMap<String, TargetYearAggregate>,
    warnings: Vec<DiffWarning>,
    source_coverage: SourceCoverage,
}

#[derive(Clone, Debug, Serialize)]
struct DiffSummary {
    batch_id: String,
    parent_batch_id: Option<String>,
    event_count: usize,
    site_count: usize,
}

#[derive(Clone, Debug, Serialize)]
struct SiteChangeset {
    site_key: String,
    site_id: Option<String>,
    matched_current_site_id: Option<String>,
    candidate_site_id: Option<String>,
    event_count: usize,
    events: Vec<EventSummary>,
    worship_use_status: Option<Transition<String>>,
    denomination_set: Option<Transition<Vec<String>>>,
    purpose_set: Option<Transition<Vec<String>>>,
    site_type: Option<Transition<String>>,
    organisation_links_added: Vec<Value>,
    organisation_links_removed: Vec<Value>,
    geometry_changes: Vec<GeometryChange>,
    target_year_affects: Vec<TargetYearAffect>,
}

#[derive(Clone, Debug, Serialize)]
struct EventSummary {
    record_index: usize,
    event_id: String,
    event_type: String,
    recorded_at: String,
}

#[derive(Clone, Debug, Serialize)]
struct Transition<T> {
    previous: Option<T>,
    next: T,
}

#[derive(Clone, Debug, Serialize)]
struct TargetYearAffect {
    target_year: String,
    previous_target_year_status: Option<String>,
    target_year_status: String,
    worship_use_status: Option<String>,
    basis: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
struct TargetYearAggregate {
    affected_sites: usize,
    transitions: BTreeMap<String, usize>,
    final_status_counts: BTreeMap<String, usize>,
}

#[derive(Clone, Debug, Serialize)]
struct DiffWarning {
    record_index: usize,
    event_id: Option<String>,
    kind: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
struct SourceCoverage {
    by_basis: BTreeMap<String, usize>,
    by_event_type: BTreeMap<String, BTreeMap<String, usize>>,
}

#[derive(Clone, Debug, Serialize)]
struct GeometryChange {
    record_index: usize,
    geometry_role: Option<String>,
    geometry_basis: Option<String>,
    distance_from_previous_m: Option<f64>,
}

#[derive(Clone, Debug)]
struct ProposedEvent {
    record_index: usize,
    event: Value,
}

fn diff(args: DiffArgs) -> Result<DiffOutcome> {
    let conn = Connection::open(&args.db)
        .with_context(|| format!("failed to open staging database {}", args.db.display()))?;
    initialise_staging_schema(&conn)?;
    let parent_batch_id = load_parent_batch_id(&conn, &args.batch_id)?;
    let events = load_proposed_events(&conn, &args.batch_id)?;
    if events.is_empty() {
        bail!(
            "batch {} contains no change-event records; stage JSONL change events or run `pow propose --persist` first",
            args.batch_id
        );
    }
    revalidate_events(&events, &args.schema_dir)?;
    enforce_target_year_affects(&events)?;

    let warnings = build_warnings(&events);
    let source_coverage = build_source_coverage(&events);
    let target_years = aggregate_target_years(&events);
    let sites = build_site_changesets(&events);

    Ok(DiffOutcome {
        summary: DiffSummary {
            batch_id: args.batch_id,
            parent_batch_id,
            event_count: events.len(),
            site_count: sites.len(),
        },
        sites,
        target_years,
        warnings,
        source_coverage,
    })
}

fn load_parent_batch_id(conn: &Connection, batch_id: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT parent_batch_id FROM stage_batches WHERE batch_id = ?1")?;
    let mut rows = stmt.query(params![batch_id])?;
    let Some(row) = rows.next()? else {
        bail!("no staged batch found for {batch_id}");
    };
    let value: Option<String> = row.get(0)?;
    Ok(value)
}

fn load_proposed_events(conn: &Connection, batch_id: &str) -> Result<Vec<ProposedEvent>> {
    let mut stmt = conn.prepare(
        "SELECT record_index, parsed_json
         FROM stage_records
         WHERE batch_id = ?1
           AND record_kind IN ('proposed_event', 'jsonl_line', 'json_record')
         ORDER BY record_index",
    )?;
    let rows = stmt.query_map(params![batch_id], |row| {
        let record_index: i64 = row.get(0)?;
        let parsed_json: Option<String> = row.get(1)?;
        Ok((record_index, parsed_json))
    })?;
    let mut events = Vec::new();
    for row in rows {
        let (record_index, parsed_json) = row?;
        let parsed_json = parsed_json
            .with_context(|| format!("stage record {record_index} has no parsed_json"))?;
        let event = serde_json::from_str::<Value>(&parsed_json)
            .with_context(|| format!("stage record {record_index} is not valid JSON"))?;
        events.push(ProposedEvent {
            record_index: record_index as usize,
            event,
        });
    }
    Ok(events)
}

fn revalidate_events(events: &[ProposedEvent], schema_dir: &Path) -> Result<()> {
    let validators = SchemaValidators::load(schema_dir)?;
    let mut summary = ValidationSummary::new(Path::new("pow diff"), "jsonl");
    for event in events {
        validate_json_record(&event.event, event.record_index, &validators, &mut summary);
    }
    if !summary.errors.is_empty() {
        for diagnostic in &summary.errors {
            print_diagnostic_to_stderr("ERROR", diagnostic);
        }
        bail!("staged events failed re-validation against change-event schema");
    }
    Ok(())
}

fn enforce_target_year_affects(events: &[ProposedEvent]) -> Result<()> {
    for event in events {
        if event_payload_type(&event.event) != Some("worship_function_update") {
            continue;
        }
        let affects = event
            .event
            .pointer("/payload/target_year_affects")
            .and_then(Value::as_array);
        if affects.is_none_or(|values| values.is_empty()) {
            bail!(
                "record {} carries a worship_function_update payload with empty target_year_affects; pow diff v1 refuses to infer target-year state from prose",
                event.record_index
            );
        }
    }
    Ok(())
}

fn event_payload_type(event: &Value) -> Option<&str> {
    event
        .pointer("/payload/payload_type")
        .and_then(Value::as_str)
}

fn event_event_type(event: &Value) -> &str {
    event
        .get("event_type")
        .and_then(Value::as_str)
        .unwrap_or("<unknown>")
}

fn event_event_id(event: &Value) -> Option<&str> {
    event.get("event_id").and_then(Value::as_str)
}

fn event_recorded_at(event: &Value) -> &str {
    event
        .get("recorded_at")
        .and_then(Value::as_str)
        .unwrap_or("")
}

fn site_key_for_event(event: &Value) -> (String, Option<String>, Option<String>, Option<String>) {
    let target = event.get("target");
    let site_id = target
        .and_then(|t| t.get("site_id"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    if let Some(value) = site_id.as_ref() {
        return (
            format!("site:{value}"),
            Some(value.clone()),
            target
                .and_then(|t| t.get("matched_current_site_id"))
                .and_then(Value::as_str)
                .map(str::to_owned),
            target
                .and_then(|t| t.get("candidate_site_id"))
                .and_then(Value::as_str)
                .map(str::to_owned),
        );
    }
    let matched = target
        .and_then(|t| t.get("matched_current_site_id"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    if let Some(value) = matched.as_ref() {
        return (
            format!("matched:{value}"),
            None,
            Some(value.clone()),
            target
                .and_then(|t| t.get("candidate_site_id"))
                .and_then(Value::as_str)
                .map(str::to_owned),
        );
    }
    let candidate = target
        .and_then(|t| t.get("candidate_site_id"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    if let Some(value) = candidate.as_ref() {
        return (
            format!("candidate:{value}"),
            None,
            None,
            Some(value.clone()),
        );
    }
    ("<unknown>".to_owned(), None, None, None)
}

type SiteIdTuple = (Option<String>, Option<String>, Option<String>);

fn build_site_changesets(events: &[ProposedEvent]) -> Vec<SiteChangeset> {
    let mut grouped: BTreeMap<String, Vec<&ProposedEvent>> = BTreeMap::new();
    let mut keys_to_ids: BTreeMap<String, SiteIdTuple> = BTreeMap::new();
    for event in events {
        let (key, site_id, matched, candidate) = site_key_for_event(&event.event);
        keys_to_ids
            .entry(key.clone())
            .or_insert((site_id, matched, candidate));
        grouped.entry(key).or_default().push(event);
    }

    grouped
        .into_iter()
        .map(|(key, list)| {
            let mut events_sorted = list;
            events_sorted.sort_by(|a, b| {
                event_recorded_at(&a.event)
                    .cmp(event_recorded_at(&b.event))
                    .then(a.record_index.cmp(&b.record_index))
            });
            let (site_id, matched_current_site_id, candidate_site_id) =
                keys_to_ids.remove(&key).unwrap_or((None, None, None));
            let mut summaries = Vec::with_capacity(events_sorted.len());
            for event in &events_sorted {
                summaries.push(EventSummary {
                    record_index: event.record_index,
                    event_id: event_event_id(&event.event)
                        .unwrap_or("<missing>")
                        .to_owned(),
                    event_type: event_event_type(&event.event).to_owned(),
                    recorded_at: event_recorded_at(&event.event).to_owned(),
                });
            }
            let worship_use_status = reduce_string_transition(
                &events_sorted,
                "/payload/previous_worship_use_status",
                "/payload/worship_use_status",
            );
            let denomination_set = reduce_string_array_transition(
                &events_sorted,
                "/payload/previous_denomination_set",
                "/payload/denomination_set",
            );
            let purpose_set = reduce_string_array_transition(
                &events_sorted,
                "/payload/previous_purpose_set",
                "/payload/purpose_set",
            );
            let site_type = reduce_string_transition(
                &events_sorted,
                "/payload/previous_site_type",
                "/payload/site_type",
            );
            let (organisation_links_added, organisation_links_removed) =
                reduce_organisation_links(&events_sorted);
            let geometry_changes = reduce_geometry_changes(&events_sorted);
            let target_year_affects = reduce_target_year_affects(&events_sorted);

            SiteChangeset {
                site_key: key,
                site_id,
                matched_current_site_id,
                candidate_site_id,
                event_count: events_sorted.len(),
                events: summaries,
                worship_use_status,
                denomination_set,
                purpose_set,
                site_type,
                organisation_links_added,
                organisation_links_removed,
                geometry_changes,
                target_year_affects,
            }
        })
        .collect()
}

fn reduce_string_transition(
    events: &[&ProposedEvent],
    previous_pointer: &str,
    next_pointer: &str,
) -> Option<Transition<String>> {
    let previous = events
        .iter()
        .find_map(|event| {
            event
                .event
                .pointer(previous_pointer)
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .or(None);
    let next = events.iter().rev().find_map(|event| {
        event
            .event
            .pointer(next_pointer)
            .and_then(Value::as_str)
            .map(str::to_owned)
    })?;
    if previous.as_deref() == Some(next.as_str()) {
        return None;
    }
    Some(Transition { previous, next })
}

fn reduce_string_array_transition(
    events: &[&ProposedEvent],
    previous_pointer: &str,
    next_pointer: &str,
) -> Option<Transition<Vec<String>>> {
    let previous: Option<Vec<String>> = events.iter().find_map(|event| {
        event
            .event
            .pointer(previous_pointer)
            .and_then(Value::as_array)
            .map(|values| string_array(values))
    });
    let next: Vec<String> = events.iter().rev().find_map(|event| {
        event
            .event
            .pointer(next_pointer)
            .and_then(Value::as_array)
            .map(|values| string_array(values))
    })?;
    if previous.as_deref() == Some(next.as_slice()) {
        return None;
    }
    Some(Transition { previous, next })
}

fn string_array(values: &[Value]) -> Vec<String> {
    let mut out: Vec<String> = values
        .iter()
        .filter_map(|value| value.as_str().map(str::to_owned))
        .collect();
    out.sort();
    out.dedup();
    out
}

fn reduce_organisation_links(events: &[&ProposedEvent]) -> (Vec<Value>, Vec<Value>) {
    let mut added = Vec::new();
    let mut removed = Vec::new();
    for event in events {
        if event_payload_type(&event.event) == Some("organisation_link_update")
            && let Some(value) = event
                .event
                .pointer("/payload/organisation_link")
                .or_else(|| event.event.pointer("/payload"))
        {
            let event_type = event_event_type(&event.event);
            if event_type == "organisation_use_started" {
                added.push(value.clone());
            } else if event_type == "organisation_use_ended" {
                removed.push(value.clone());
            }
        }
        if let Some(links) = event
            .event
            .pointer("/payload/organisation_links")
            .and_then(Value::as_array)
        {
            for link in links {
                added.push(link.clone());
            }
        }
        if let Some(links) = event
            .event
            .pointer("/payload/previous_organisation_links")
            .and_then(Value::as_array)
        {
            for link in links {
                removed.push(link.clone());
            }
        }
    }
    (added, removed)
}

fn reduce_geometry_changes(events: &[&ProposedEvent]) -> Vec<GeometryChange> {
    events
        .iter()
        .filter_map(|event| {
            let payload_type = event_payload_type(&event.event)?;
            if payload_type != "geometry_update" && payload_type != "site_relocation" {
                return None;
            }
            Some(GeometryChange {
                record_index: event.record_index,
                geometry_role: event
                    .event
                    .pointer("/payload/geometry_role")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                geometry_basis: event
                    .event
                    .pointer("/payload/geometry_basis")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                distance_from_previous_m: event
                    .event
                    .pointer("/payload/distance_from_previous_m")
                    .and_then(Value::as_f64)
                    .or_else(|| {
                        event
                            .event
                            .pointer("/payload/distance_m")
                            .and_then(Value::as_f64)
                    }),
            })
        })
        .collect()
}

fn reduce_target_year_affects(events: &[&ProposedEvent]) -> Vec<TargetYearAffect> {
    let mut affects = Vec::new();
    for event in events {
        let Some(list) = event
            .event
            .pointer("/payload/target_year_affects")
            .and_then(Value::as_array)
        else {
            continue;
        };
        for entry in list {
            let target_year = entry
                .get("target_year")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned();
            let target_year_status = entry
                .get("target_year_status")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned();
            let previous = entry
                .get("previous_target_year_status")
                .and_then(Value::as_str)
                .map(str::to_owned);
            let worship_use_status = entry
                .get("worship_use_status")
                .and_then(Value::as_str)
                .map(str::to_owned);
            let basis = entry
                .get("basis")
                .and_then(Value::as_str)
                .map(str::to_owned);
            affects.push(TargetYearAffect {
                target_year,
                previous_target_year_status: previous,
                target_year_status,
                worship_use_status,
                basis,
            });
        }
    }
    affects.sort_by(|a, b| a.target_year.cmp(&b.target_year));
    affects
}

fn aggregate_target_years(events: &[ProposedEvent]) -> BTreeMap<String, TargetYearAggregate> {
    // Collapse to one net transition per (target_year, site_key) so a site with
    // multiple events at the same target year is counted once. The "before"
    // state is the earliest event's previous_target_year_status; the "after"
    // state is the latest event's target_year_status (chronological by
    // recorded_at, falling back to record_index for ties).
    struct PerPair {
        first_at: String,
        first_index: usize,
        previous: Option<String>,
        last_at: String,
        last_index: usize,
        next: String,
    }

    let mut per_pair: BTreeMap<(String, String), PerPair> = BTreeMap::new();
    for event in events {
        let (site_key, _, _, _) = site_key_for_event(&event.event);
        let recorded_at = event_recorded_at(&event.event).to_owned();
        let record_index = event.record_index;
        let Some(list) = event
            .event
            .pointer("/payload/target_year_affects")
            .and_then(Value::as_array)
        else {
            continue;
        };
        for entry in list {
            let Some(target_year) = entry.get("target_year").and_then(Value::as_str) else {
                continue;
            };
            let Some(next_status) = entry.get("target_year_status").and_then(Value::as_str) else {
                continue;
            };
            let previous_status = entry
                .get("previous_target_year_status")
                .and_then(Value::as_str)
                .map(str::to_owned);
            let key = (target_year.to_owned(), site_key.clone());
            per_pair
                .entry(key)
                .and_modify(|state| {
                    let earlier = recorded_at < state.first_at
                        || (recorded_at == state.first_at && record_index < state.first_index);
                    let later = recorded_at > state.last_at
                        || (recorded_at == state.last_at && record_index > state.last_index);
                    if earlier {
                        state.first_at = recorded_at.clone();
                        state.first_index = record_index;
                        state.previous = previous_status.clone();
                    }
                    if later {
                        state.last_at = recorded_at.clone();
                        state.last_index = record_index;
                        state.next = next_status.to_owned();
                    }
                })
                .or_insert_with(|| PerPair {
                    first_at: recorded_at.clone(),
                    first_index: record_index,
                    previous: previous_status.clone(),
                    last_at: recorded_at.clone(),
                    last_index: record_index,
                    next: next_status.to_owned(),
                });
        }
    }

    let mut by_year: BTreeMap<String, TargetYearAggregate> = BTreeMap::new();
    for ((year, _site_key), state) in per_pair {
        let aggregate = by_year.entry(year).or_insert_with(|| TargetYearAggregate {
            affected_sites: 0,
            transitions: BTreeMap::new(),
            final_status_counts: BTreeMap::new(),
        });
        let prev = state.previous.as_deref().unwrap_or("<none>");
        let transition_key = format!("{prev} -> {}", state.next);
        aggregate.affected_sites += 1;
        *aggregate.transitions.entry(transition_key).or_insert(0) += 1;
        *aggregate.final_status_counts.entry(state.next).or_insert(0) += 1;
    }
    by_year
}

fn build_warnings(events: &[ProposedEvent]) -> Vec<DiffWarning> {
    let mut warnings = Vec::new();
    for event in events {
        let event_id = event_event_id(&event.event).map(str::to_owned);
        let event_type = event_event_type(&event.event);

        if event_type.starts_with("denomination_") {
            let taxonomy_version = event.event.get("taxonomy_version").and_then(Value::as_str);
            if taxonomy_version.is_none_or(str::is_empty) {
                warnings.push(DiffWarning {
                    record_index: event.record_index,
                    event_id: event_id.clone(),
                    kind: "missing_taxonomy_version".to_owned(),
                    message: format!(
                        "denomination event lacks taxonomy_version (record {})",
                        event.record_index
                    ),
                });
            }
        }

        if event
            .event
            .pointer("/effective/basis")
            .and_then(Value::as_str)
            == Some("reviewer_inference")
        {
            warnings.push(DiffWarning {
                record_index: event.record_index,
                event_id: event_id.clone(),
                kind: "weak_basis".to_owned(),
                message: format!(
                    "event basis is reviewer_inference; reviewer should confirm the underlying source (record {})",
                    event.record_index
                ),
            });
        }

        if let Some(refs) = event.event.get("source_refs").and_then(Value::as_array) {
            for source_ref in refs {
                let licence = source_ref
                    .get("licence_status")
                    .and_then(Value::as_str)
                    .unwrap_or("");
                if matches!(licence, "needs_review" | "restricted") {
                    warnings.push(DiffWarning {
                        record_index: event.record_index,
                        event_id: event_id.clone(),
                        kind: "licence_attention".to_owned(),
                        message: format!(
                            "source ref licence_status={licence:?} requires reviewer attention (record {})",
                            event.record_index
                        ),
                    });
                }
            }
        }

        if event
            .event
            .pointer("/review/review_status")
            .and_then(Value::as_str)
            == Some("accepted")
            && event
                .event
                .get("payload_hash")
                .map(Value::is_null)
                .unwrap_or(true)
        {
            warnings.push(DiffWarning {
                record_index: event.record_index,
                event_id,
                kind: "missing_payload_hash".to_owned(),
                message: format!(
                    "accepted event is missing payload_hash (record {})",
                    event.record_index
                ),
            });
        }
    }
    warnings
}

fn build_source_coverage(events: &[ProposedEvent]) -> SourceCoverage {
    let mut by_basis: BTreeMap<String, usize> = BTreeMap::new();
    let mut by_event_type: BTreeMap<String, BTreeMap<String, usize>> = BTreeMap::new();
    for event in events {
        let basis = event
            .event
            .pointer("/effective/basis")
            .and_then(Value::as_str)
            .unwrap_or("<missing>")
            .to_owned();
        let event_type = event_event_type(&event.event).to_owned();
        *by_basis.entry(basis.clone()).or_insert(0) += 1;
        *by_event_type
            .entry(event_type)
            .or_default()
            .entry(basis)
            .or_insert(0) += 1;
    }
    SourceCoverage {
        by_basis,
        by_event_type,
    }
}

fn print_diff_text_report(outcome: &DiffOutcome) -> Result<()> {
    println!("pow diff: {}", outcome.summary.batch_id);
    if let Some(parent) = &outcome.summary.parent_batch_id {
        println!("source batch: {parent}");
    }
    println!("events: {}", outcome.summary.event_count);
    println!("sites: {}", outcome.summary.site_count);
    println!();

    println!("Per-site changesets:");
    if outcome.sites.is_empty() {
        println!("  (no sites)");
    }
    for site in &outcome.sites {
        println!();
        println!("  Site {}", site.site_key);
        if let Some(value) = &site.matched_current_site_id
            && site.site_id.is_none()
        {
            println!("    matched current site id: {value}");
        }
        if let Some(value) = &site.candidate_site_id {
            println!("    candidate site id: {value}");
        }
        println!("    events: {}", site.event_count);
        for summary in &site.events {
            println!(
                "      - record {} {} ({}) at {}",
                summary.record_index, summary.event_id, summary.event_type, summary.recorded_at
            );
        }
        if let Some(transition) = &site.worship_use_status {
            println!(
                "    worship_use_status: {} -> {}",
                option_or_none(&transition.previous),
                transition.next
            );
        }
        if let Some(transition) = &site.denomination_set {
            println!(
                "    denomination_set: {} -> {}",
                option_array_or_none(&transition.previous),
                array_inline(&transition.next)
            );
        }
        if let Some(transition) = &site.purpose_set {
            println!(
                "    purpose_set: {} -> {}",
                option_array_or_none(&transition.previous),
                array_inline(&transition.next)
            );
        }
        if let Some(transition) = &site.site_type {
            println!(
                "    site_type: {} -> {}",
                option_or_none(&transition.previous),
                transition.next
            );
        }
        if !site.organisation_links_added.is_empty() {
            println!(
                "    organisation links added: {}",
                site.organisation_links_added.len()
            );
        }
        if !site.organisation_links_removed.is_empty() {
            println!(
                "    organisation links removed: {}",
                site.organisation_links_removed.len()
            );
        }
        for change in &site.geometry_changes {
            println!(
                "    geometry change (record {}): role={}, basis={}, distance_m={}",
                change.record_index,
                change.geometry_role.as_deref().unwrap_or("<none>"),
                change.geometry_basis.as_deref().unwrap_or("<none>"),
                change
                    .distance_from_previous_m
                    .map(|value| format!("{value:.1}"))
                    .unwrap_or_else(|| "<none>".to_owned())
            );
        }
        if !site.target_year_affects.is_empty() {
            println!("    target year affects:");
            for affect in &site.target_year_affects {
                let prev = affect
                    .previous_target_year_status
                    .as_deref()
                    .unwrap_or("<none>");
                let worship = affect.worship_use_status.as_deref().unwrap_or("<unset>");
                let basis = affect.basis.as_deref().unwrap_or("<unset>");
                println!(
                    "      {}: {} -> {} (worship_use_status={}, basis={})",
                    affect.target_year, prev, affect.target_year_status, worship, basis
                );
            }
        }
    }

    println!();
    println!("Per-target-year summary:");
    if outcome.target_years.is_empty() {
        println!("  (no target-year affects)");
    }
    for (year, aggregate) in &outcome.target_years {
        println!("  {year}: {} affected site(s)", aggregate.affected_sites);
        for (transition, count) in &aggregate.transitions {
            println!("    {transition}: {count}");
        }
    }

    println!();
    println!("Warnings:");
    if outcome.warnings.is_empty() {
        println!("  (no warnings)");
    }
    for warning in &outcome.warnings {
        println!(
            "  [{}] record {}: {}",
            warning.kind, warning.record_index, warning.message
        );
    }

    println!();
    println!("Source coverage (event basis):");
    if outcome.source_coverage.by_basis.is_empty() {
        println!("  (no events)");
    }
    let total: usize = outcome.source_coverage.by_basis.values().sum();
    for (basis, count) in &outcome.source_coverage.by_basis {
        let pct = if total > 0 {
            (*count as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        println!("  {basis}: {count} ({pct:.0}%)");
    }
    Ok(())
}

fn print_diff_json_report(outcome: &DiffOutcome) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(outcome)?);
    Ok(())
}

fn option_or_none(value: &Option<String>) -> &str {
    value.as_deref().unwrap_or("<none>")
}

fn option_array_or_none(value: &Option<Vec<String>>) -> String {
    match value {
        Some(values) => array_inline(values),
        None => "<none>".to_owned(),
    }
}

fn array_inline(values: &[String]) -> String {
    if values.is_empty() {
        "[]".to_owned()
    } else {
        format!("[{}]", values.join(", "))
    }
}

fn initialise_staging_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS stage_batches (
            batch_id TEXT PRIMARY KEY,
            input_path TEXT NOT NULL,
            input_format TEXT NOT NULL,
            input_sha256 TEXT NOT NULL,
            input_bytes INTEGER NOT NULL,
            staged_at TEXT NOT NULL,
            records_checked INTEGER NOT NULL,
            records_stored INTEGER NOT NULL,
            error_count INTEGER NOT NULL,
            warning_count INTEGER NOT NULL,
            validation_summary_json TEXT NOT NULL,
            raw_input BLOB NOT NULL,
            parent_batch_id TEXT REFERENCES stage_batches(batch_id)
        );

        CREATE TABLE IF NOT EXISTS stage_records (
            batch_id TEXT NOT NULL,
            record_index INTEGER NOT NULL,
            record_kind TEXT NOT NULL,
            raw_record TEXT NOT NULL,
            parsed_json TEXT,
            PRIMARY KEY (batch_id, record_index),
            FOREIGN KEY (batch_id) REFERENCES stage_batches(batch_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS validation_diagnostics (
            diagnostic_id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            severity TEXT NOT NULL CHECK (severity IN ('error', 'warning')),
            record INTEGER,
            field TEXT,
            path TEXT,
            message TEXT NOT NULL,
            FOREIGN KEY (batch_id) REFERENCES stage_batches(batch_id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_stage_batches_sha256
            ON stage_batches(input_sha256);

        CREATE INDEX IF NOT EXISTS idx_stage_records_batch
            ON stage_records(batch_id);

        CREATE INDEX IF NOT EXISTS idx_validation_diagnostics_batch
            ON validation_diagnostics(batch_id, severity);

        CREATE INDEX IF NOT EXISTS idx_stage_batches_parent
            ON stage_batches(parent_batch_id);
        ",
    )?;
    ensure_stage_batches_columns(conn)?;
    Ok(())
}

fn ensure_stage_batches_columns(conn: &Connection) -> Result<()> {
    let mut has_parent = false;
    let mut stmt = conn.prepare("PRAGMA table_info(stage_batches)")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for row in rows {
        if row? == "parent_batch_id" {
            has_parent = true;
            break;
        }
    }
    drop(stmt);
    if !has_parent {
        conn.execute(
            "ALTER TABLE stage_batches ADD COLUMN parent_batch_id TEXT REFERENCES stage_batches(batch_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_stage_batches_parent ON stage_batches(parent_batch_id)",
            [],
        )?;
    }
    Ok(())
}

fn write_diagnostics(
    tx: &rusqlite::Transaction<'_>,
    batch_id: &str,
    severity: &str,
    diagnostics: &[Diagnostic],
) -> Result<()> {
    for diagnostic in diagnostics {
        tx.execute(
            "INSERT INTO validation_diagnostics (
                batch_id, severity, record, field, path, message
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                batch_id,
                severity,
                diagnostic.record.map(|record| record as i64),
                diagnostic.field.as_deref(),
                diagnostic.path.as_deref(),
                &diagnostic.message,
            ],
        )?;
    }
    Ok(())
}

fn validate_json_file(input: &Path, schema_dir: &Path) -> Result<ValidationSummary> {
    let mut summary = ValidationSummary::new(input, "json");
    let validators = SchemaValidators::load(schema_dir)?;
    let file = File::open(input).with_context(|| format!("failed to open {}", input.display()))?;
    let value: Value = serde_json::from_reader(file)
        .with_context(|| format!("failed to parse JSON in {}", input.display()))?;

    match value {
        Value::Array(values) => {
            for (index, value) in values.iter().enumerate() {
                validate_json_record(value, index + 1, &validators, &mut summary);
            }
        }
        value => validate_json_record(&value, 1, &validators, &mut summary),
    }

    Ok(summary)
}

fn validate_jsonl_file(input: &Path, schema_dir: &Path) -> Result<ValidationSummary> {
    let mut summary = ValidationSummary::new(input, "jsonl");
    let validators = SchemaValidators::load(schema_dir)?;
    let file = File::open(input).with_context(|| format!("failed to open {}", input.display()))?;

    for (index, line) in BufReader::new(file).lines().enumerate() {
        let line_number = index + 1;
        let line = line.with_context(|| format!("failed to read line {line_number}"))?;
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<Value>(&line) {
            Ok(value) => validate_json_record(&value, line_number, &validators, &mut summary),
            Err(error) => summary.error(
                Some(line_number),
                None,
                None,
                format!("invalid JSON line: {error}"),
            ),
        }
    }

    Ok(summary)
}

fn validate_json_record(
    value: &Value,
    record: usize,
    validators: &SchemaValidators,
    summary: &mut ValidationSummary,
) {
    summary.records_checked += 1;

    let Some(schema_version) = value.get("schema_version").and_then(Value::as_str) else {
        summary.error(
            Some(record),
            Some("schema_version"),
            None,
            "missing schema_version",
        );
        return;
    };

    let validator = if schema_version.starts_with("change-event.") {
        &validators.change_event
    } else if schema_version.starts_with("geometry-history.") {
        &validators.geometry_history
    } else {
        summary.error(
            Some(record),
            Some("schema_version"),
            None,
            format!("unsupported schema_version {schema_version:?}"),
        );
        return;
    };

    for error in validator.iter_errors(value) {
        summary.error(
            Some(record),
            None,
            Some(&error.instance_path().to_string()),
            error.to_string(),
        );
    }

    validate_json_temporal_rules(value, record, summary);
    validate_json_geometry_rules(value, record, summary);
    validate_change_event_replay_rules(value, record, summary);
}

struct SchemaValidators {
    change_event: Validator,
    geometry_history: Validator,
}

impl SchemaValidators {
    fn load(schema_dir: &Path) -> Result<Self> {
        let change_event = read_json(schema_dir.join("change-event.schema.json"))?;
        let geometry_history = read_json(schema_dir.join("geometry-history.schema.json"))?;
        let site = read_json(schema_dir.join("site.schema.json"))?;
        let structure = read_json(schema_dir.join("structure.schema.json"))?;

        let registry = Registry::new()
            .add(
                "https://go-bayes.github.io/places-of-worship/schemas/change-event.schema.json",
                change_event.clone(),
            )?
            .add(
                "https://go-bayes.github.io/places-of-worship/schemas/geometry-history.schema.json",
                geometry_history.clone(),
            )?
            .add(
                "https://go-bayes.github.io/places-of-worship/schemas/site.schema.json",
                site,
            )?
            .add(
                "https://go-bayes.github.io/places-of-worship/schemas/structure.schema.json",
                structure,
            )?
            .prepare()?;

        let change_event = jsonschema::options()
            .with_registry(&registry)
            .should_validate_formats(true)
            .build(&change_event)?;
        let geometry_history = jsonschema::options()
            .with_registry(&registry)
            .should_validate_formats(true)
            .build(&geometry_history)?;

        Ok(Self {
            change_event,
            geometry_history,
        })
    }
}

fn read_json(path: PathBuf) -> Result<Value> {
    let file = File::open(&path).with_context(|| format!("failed to open {}", path.display()))?;
    serde_json::from_reader(file)
        .with_context(|| format!("failed to parse JSON in {}", path.display()))
}

fn validate_change_event_replay_rules(
    value: &Value,
    record: usize,
    summary: &mut ValidationSummary,
) {
    if !value
        .get("schema_version")
        .and_then(Value::as_str)
        .is_some_and(|schema_version| schema_version.starts_with("change-event."))
    {
        return;
    }

    let accepted = value
        .pointer("/review/review_status")
        .and_then(Value::as_str)
        .is_some_and(|status| status == "accepted");
    if accepted && value.get("payload_hash").is_none_or(Value::is_null) {
        summary.error(
            Some(record),
            Some("payload_hash"),
            Some("/payload_hash"),
            "accepted change events must include payload_hash for deterministic replay",
        );
    }
}

fn validate_json_temporal_rules(value: &Value, record: usize, summary: &mut ValidationSummary) {
    if let Some(effective) = value.get("effective") {
        validate_date_order(
            effective,
            record,
            "/effective/not_earlier_than",
            "not_earlier_than",
            "/effective/not_later_than",
            "not_later_than",
            summary,
        );
        validate_date_inside_bounds(
            effective,
            record,
            "/effective/effective_date",
            "/effective/not_earlier_than",
            "/effective/not_later_than",
            summary,
        );
    }

    if let Some(interval) = value.get("valid_interval") {
        validate_date_order(
            interval,
            record,
            "/valid_interval/valid_from",
            "valid_from",
            "/valid_interval/valid_to",
            "valid_to",
            summary,
        );
        validate_date_order(
            interval,
            record,
            "/valid_interval/not_earlier_than",
            "not_earlier_than",
            "/valid_interval/not_later_than",
            "not_later_than",
            summary,
        );
    }
}

fn validate_date_order(
    parent: &Value,
    record: usize,
    left_pointer: &str,
    left_field: &str,
    right_pointer: &str,
    right_field: &str,
    summary: &mut ValidationSummary,
) {
    let left = pointer_leaf(parent, left_pointer);
    let right = pointer_leaf(parent, right_pointer);
    let (Some(left), Some(right)) = (left, right) else {
        return;
    };
    let (Some(left_date), Some(right_date)) = (parse_full_date(left), parse_full_date(right))
    else {
        return;
    };
    if left_date > right_date {
        summary.error(
            Some(record),
            Some(left_field),
            Some(left_pointer),
            format!("{left_field} must be on or before {right_field}"),
        );
    }
}

fn validate_date_inside_bounds(
    parent: &Value,
    record: usize,
    date_pointer: &str,
    lower_pointer: &str,
    upper_pointer: &str,
    summary: &mut ValidationSummary,
) {
    let Some(date) = pointer_leaf(parent, date_pointer).and_then(parse_full_date) else {
        return;
    };
    if let Some(lower) = pointer_leaf(parent, lower_pointer).and_then(parse_full_date)
        && date < lower
    {
        summary.error(
            Some(record),
            Some("effective_date"),
            Some(date_pointer),
            "effective_date must not fall before not_earlier_than",
        );
    }
    if let Some(upper) = pointer_leaf(parent, upper_pointer).and_then(parse_full_date)
        && date > upper
    {
        summary.error(
            Some(record),
            Some("effective_date"),
            Some(date_pointer),
            "effective_date must not fall after not_later_than",
        );
    }
}

fn pointer_leaf<'a>(parent: &'a Value, pointer: &str) -> Option<&'a str> {
    let leaf = pointer.rsplit('/').next()?;
    parent.get(leaf).and_then(Value::as_str)
}

fn validate_json_geometry_rules(value: &Value, record: usize, summary: &mut ValidationSummary) {
    for pointer in ["/geometry", "/payload/geometry", "/centroid"] {
        if let Some(geometry) = value.pointer(pointer) {
            validate_geojson_geometry(geometry, record, pointer, summary);
        }
    }
}

fn validate_geojson_geometry(
    value: &Value,
    record: usize,
    pointer: &str,
    summary: &mut ValidationSummary,
) {
    let Some(geometry_type) = value.get("type").and_then(Value::as_str) else {
        return;
    };
    let Some(coordinates) = value.get("coordinates") else {
        return;
    };

    match geometry_type {
        "Point" => validate_coordinate_position(coordinates, record, pointer, summary),
        "Polygon" | "MultiPolygon" => {
            validate_nested_coordinates(coordinates, record, pointer, summary)
        }
        _ => {}
    }
}

fn validate_nested_coordinates(
    value: &Value,
    record: usize,
    pointer: &str,
    summary: &mut ValidationSummary,
) {
    if is_position(value) {
        validate_coordinate_position(value, record, pointer, summary);
        return;
    }
    if let Some(values) = value.as_array() {
        for (index, child) in values.iter().enumerate() {
            validate_nested_coordinates(
                child,
                record,
                &format!("{pointer}/coordinates/{index}"),
                summary,
            );
        }
    }
}

fn is_position(value: &Value) -> bool {
    let Some(values) = value.as_array() else {
        return false;
    };
    values.len() >= 2 && values[0].is_number() && values[1].is_number()
}

fn validate_coordinate_position(
    value: &Value,
    record: usize,
    pointer: &str,
    summary: &mut ValidationSummary,
) {
    let Some(values) = value.as_array() else {
        return;
    };
    if values.len() < 2 {
        return;
    }
    let lon = values[0].as_f64();
    let lat = values[1].as_f64();
    match (lon, lat) {
        (Some(lon), Some(lat)) => {
            if !(-180.0..=180.0).contains(&lon) {
                summary.error(
                    Some(record),
                    None,
                    Some(pointer),
                    format!("longitude {lon} is outside -180..180"),
                );
            }
            if !(-90.0..=90.0).contains(&lat) {
                summary.error(
                    Some(record),
                    None,
                    Some(pointer),
                    format!("latitude {lat} is outside -90..90"),
                );
            }
        }
        _ => summary.error(
            Some(record),
            None,
            Some(pointer),
            "coordinates must start with numeric longitude and latitude",
        ),
    }
}

fn validate_csv(input: &Path, template_dir: &Path) -> Result<ValidationSummary> {
    let mut summary = ValidationSummary::new(input, "csv");
    let templates = CsvTemplates::load(template_dir)?;
    let vocabularies =
        ControlledVocabularies::load(&template_dir.join("controlled_vocabularies.csv"))?;

    let mut reader = csv::Reader::from_path(input)
        .with_context(|| format!("failed to open {}", input.display()))?;
    let headers = reader
        .headers()
        .with_context(|| format!("failed to read CSV headers from {}", input.display()))?
        .clone();
    let template = templates.detect(headers.iter());

    match template {
        Some(template) => {
            if let Some(expected) = templates.headers.get(template.filename) {
                if expected.len() != headers.len() {
                    summary.error(
                        None,
                        None,
                        None,
                        format!("{} header count differs from template", template.name),
                    );
                }
                for expected_header in expected {
                    if !headers.iter().any(|header| header == expected_header) {
                        summary.error(
                            None,
                            Some(expected_header),
                            None,
                            format!("missing template column {expected_header}"),
                        );
                    }
                }
            }
        }
        None => summary.warning(
            None,
            None,
            None,
            "CSV header does not exactly match a known RA template; applying generic checks only",
        ),
    }

    for (index, row) in reader.records().enumerate() {
        let record_number = index + 2;
        let row = row.with_context(|| format!("failed to read CSV record {record_number}"))?;
        summary.records_checked += 1;
        validate_csv_row(
            &headers,
            &row,
            template,
            &vocabularies,
            record_number,
            &mut summary,
        );
    }

    Ok(summary)
}

#[derive(Clone, Copy)]
struct CsvTemplate {
    name: &'static str,
    filename: &'static str,
    required_fields: &'static [&'static str],
}

const CSV_TEMPLATES: &[CsvTemplate] = &[
    CsvTemplate {
        name: "wide RA evidence",
        filename: "site_evidence_wide.csv",
        required_fields: &[
            "evidence_row_id",
            "country_code",
            "source_dataset_id",
            "source_type",
            "review_status",
            "privacy_flag",
            "licence_flag",
        ],
    },
    CsvTemplate {
        name: "site observations",
        filename: "site_observations.csv",
        required_fields: &["site_observation_id", "source_dataset_id", "review_status"],
    },
    CsvTemplate {
        name: "site lifecycle events",
        filename: "site_lifecycle_events.csv",
        required_fields: &[
            "lifecycle_event_id",
            "source_dataset_id",
            "lifecycle_event_type",
            "review_status",
        ],
    },
    CsvTemplate {
        name: "sources",
        filename: "sources.csv",
        required_fields: &["source_dataset_id", "source_type", "source_title"],
    },
];

struct CsvTemplates {
    headers: BTreeMap<&'static str, Vec<String>>,
}

impl CsvTemplates {
    fn load(template_dir: &Path) -> Result<Self> {
        let mut headers = BTreeMap::new();
        for template in CSV_TEMPLATES {
            let path = template_dir.join(template.filename);
            let mut reader = csv::Reader::from_path(&path)
                .with_context(|| format!("failed to open template {}", path.display()))?;
            let template_headers = reader
                .headers()
                .with_context(|| {
                    format!("failed to read template headers from {}", path.display())
                })?
                .iter()
                .map(str::to_owned)
                .collect();
            headers.insert(template.filename, template_headers);
        }
        Ok(Self { headers })
    }

    fn detect<'a>(
        &'a self,
        headers: impl Iterator<Item = &'a str>,
    ) -> Option<&'static CsvTemplate> {
        let input_headers: Vec<&str> = headers.collect();
        CSV_TEMPLATES.iter().find(|template| {
            self.headers.get(template.filename).is_some_and(|expected| {
                expected.len() == input_headers.len()
                    && expected
                        .iter()
                        .map(String::as_str)
                        .zip(input_headers.iter().copied())
                        .all(|(left, right)| left == right)
            })
        })
    }
}

struct ControlledVocabularies {
    values: BTreeMap<String, BTreeSet<String>>,
}

impl ControlledVocabularies {
    fn load(path: &Path) -> Result<Self> {
        let mut reader = csv::Reader::from_path(path)
            .with_context(|| format!("failed to open {}", path.display()))?;
        let mut values: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for row in reader.records() {
            let row = row?;
            let Some(field) = row.get(0).filter(|value| !value.trim().is_empty()) else {
                continue;
            };
            let Some(value) = row.get(1).filter(|value| !value.trim().is_empty()) else {
                continue;
            };
            values
                .entry(field.to_owned())
                .or_default()
                .insert(value.to_owned());
        }
        Ok(Self { values })
    }

    fn vocab_key_for_field<'a>(&self, field: &'a str) -> Option<&'a str> {
        if self.values.contains_key(field) {
            return Some(field);
        }
        if field.starts_with("target_year_") && field.ends_with("_status") {
            return Some("target_year_status");
        }
        if field.ends_with("_date_precision") || field == "date_precision" {
            return Some("date_precision");
        }
        None
    }

    fn is_allowed(&self, field: &str, value: &str) -> bool {
        self.vocab_key_for_field(field)
            .and_then(|key| self.values.get(key))
            .is_some_and(|allowed| allowed.contains(value))
    }
}

fn validate_csv_row(
    headers: &csv::StringRecord,
    row: &csv::StringRecord,
    template: Option<&CsvTemplate>,
    vocabularies: &ControlledVocabularies,
    record_number: usize,
    summary: &mut ValidationSummary,
) {
    let values: BTreeMap<&str, &str> = headers.iter().zip(row.iter()).collect();

    if let Some(template) = template {
        for field in template.required_fields {
            if values
                .get(field)
                .is_none_or(|value| value.trim().is_empty())
            {
                summary.error(
                    Some(record_number),
                    Some(field),
                    None,
                    format!("{field} is required for {}", template.name),
                );
            }
        }
    }

    for (field, raw_value) in &values {
        let value = raw_value.trim();
        if value.is_empty() {
            continue;
        }

        if vocabularies.vocab_key_for_field(field).is_some()
            && !vocabularies.is_allowed(field, value)
        {
            summary.error(
                Some(record_number),
                Some(field),
                None,
                format!("{value:?} is not in the controlled vocabulary for {field}"),
            );
        }

        if should_parse_partial_date(field) && !is_valid_partial_date(value) {
            summary.error(
                Some(record_number),
                Some(field),
                None,
                format!("{value:?} is not a valid YYYY, YYYY-MM, or YYYY-MM-DD date"),
            );
        }

        if should_parse_timestamp(field) && !is_valid_timestamp_or_date(value) {
            summary.error(
                Some(record_number),
                Some(field),
                None,
                format!("{value:?} is not a valid RFC3339 timestamp or date"),
            );
        }

        if field.ends_with("_probability") {
            match value.parse::<f64>() {
                Ok(probability) if (0.0..=1.0).contains(&probability) => {}
                Ok(probability) => summary.error(
                    Some(record_number),
                    Some(field),
                    None,
                    format!("probability {probability} is outside 0..1"),
                ),
                Err(_) => summary.error(
                    Some(record_number),
                    Some(field),
                    None,
                    format!("{value:?} is not numeric"),
                ),
            }
        }

        if *field == "country_code" && !is_iso2_country_code(value) {
            summary.error(
                Some(record_number),
                Some(field),
                None,
                format!("{value:?} is not an uppercase ISO 3166-1 alpha-2 code"),
            );
        }
    }

    validate_csv_coordinate_pair(&values, record_number, summary);
    validate_review_flags(&values, record_number, summary);
}

fn validate_csv_coordinate_pair(
    values: &BTreeMap<&str, &str>,
    record_number: usize,
    summary: &mut ValidationSummary,
) {
    let latitude = values
        .get("latitude")
        .map(|value| value.trim())
        .unwrap_or_default();
    let longitude = values
        .get("longitude")
        .map(|value| value.trim())
        .unwrap_or_default();
    if latitude.is_empty() && longitude.is_empty() {
        return;
    }
    if latitude.is_empty() || longitude.is_empty() {
        summary.error(
            Some(record_number),
            Some("latitude"),
            None,
            "latitude and longitude must be supplied together",
        );
        return;
    }

    match latitude.parse::<f64>() {
        Ok(value) if (-90.0..=90.0).contains(&value) => {}
        Ok(value) => summary.error(
            Some(record_number),
            Some("latitude"),
            None,
            format!("latitude {value} is outside -90..90"),
        ),
        Err(_) => summary.error(
            Some(record_number),
            Some("latitude"),
            None,
            format!("{latitude:?} is not numeric"),
        ),
    }
    match longitude.parse::<f64>() {
        Ok(value) if (-180.0..=180.0).contains(&value) => {}
        Ok(value) => summary.error(
            Some(record_number),
            Some("longitude"),
            None,
            format!("longitude {value} is outside -180..180"),
        ),
        Err(_) => summary.error(
            Some(record_number),
            Some("longitude"),
            None,
            format!("{longitude:?} is not numeric"),
        ),
    }
}

fn validate_review_flags(
    values: &BTreeMap<&str, &str>,
    record_number: usize,
    summary: &mut ValidationSummary,
) {
    let review_status = values
        .get("review_status")
        .map(|value| value.trim())
        .unwrap_or_default();
    if review_status != "accepted" {
        return;
    }
    for field in ["privacy_flag", "licence_flag"] {
        match values.get(field).map(|value| value.trim()) {
            Some("clear") => {}
            Some("") | None => summary.warning(
                Some(record_number),
                Some(field),
                None,
                format!("accepted rows should explicitly set {field}=clear"),
            ),
            Some(value) => summary.error(
                Some(record_number),
                Some(field),
                None,
                format!("accepted rows cannot have {field}={value:?}"),
            ),
        }
    }
}

fn should_parse_partial_date(field: &str) -> bool {
    field.ends_with("_date") || field == "retrieval_date"
}

fn should_parse_timestamp(field: &str) -> bool {
    matches!(
        field,
        "extracted_at" | "reviewed_at" | "osm_version_timestamp"
    )
}

fn is_valid_partial_date(value: &str) -> bool {
    if value.len() == 4 && value.chars().all(|ch| ch.is_ascii_digit()) {
        return true;
    }
    if value.len() == 7 {
        let Some((year, month)) = value.split_once('-') else {
            return false;
        };
        return year.len() == 4
            && year.chars().all(|ch| ch.is_ascii_digit())
            && month
                .parse::<u32>()
                .is_ok_and(|month| (1..=12).contains(&month));
    }
    parse_full_date(value).is_some()
}

fn is_valid_timestamp_or_date(value: &str) -> bool {
    DateTime::parse_from_rfc3339(value).is_ok() || is_valid_partial_date(value)
}

fn parse_full_date(value: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()
}

fn is_iso2_country_code(value: &str) -> bool {
    value.len() == 2 && value.chars().all(|ch| ch.is_ascii_uppercase())
}

fn print_text_summary(summary: &ValidationSummary) -> Result<()> {
    println!("pow validate: {}", summary.input);
    println!("format: {}", summary.format);
    println!("records checked: {}", summary.records_checked);
    println!("errors: {}", summary.errors.len());
    println!("warnings: {}", summary.warnings.len());

    for diagnostic in &summary.errors {
        print_diagnostic("ERROR", diagnostic);
    }
    for diagnostic in &summary.warnings {
        print_diagnostic("WARN", diagnostic);
    }

    Ok(())
}

fn print_diagnostic(kind: &str, diagnostic: &Diagnostic) {
    println!("{}", format_diagnostic(kind, diagnostic));
}

fn print_diagnostic_to_stderr(kind: &str, diagnostic: &Diagnostic) {
    eprintln!("{}", format_diagnostic(kind, diagnostic));
}

fn format_diagnostic(kind: &str, diagnostic: &Diagnostic) -> String {
    let mut parts = Vec::new();
    if let Some(record) = diagnostic.record {
        parts.push(format!("record {record}"));
    }
    if let Some(field) = &diagnostic.field {
        parts.push(format!("field {field}"));
    }
    if let Some(path) = &diagnostic.path {
        parts.push(format!("path {path}"));
    }
    if parts.is_empty() {
        format!("{kind}: {}", diagnostic.message)
    } else {
        format!("{kind} [{}]: {}", parts.join(", "), diagnostic.message)
    }
}

fn print_json_summary(summary: &ValidationSummary) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(summary)?);
    Ok(())
}

fn print_stage_text_summary(summary: &StageSummary) -> Result<()> {
    println!("pow stage: {}", summary.input);
    println!("database: {}", summary.db_path);
    println!("batch id: {}", summary.batch_id);
    println!("format: {}", summary.format);
    println!("sha256: {}", summary.input_sha256);
    println!("bytes: {}", summary.input_bytes);
    println!("records checked: {}", summary.records_checked);
    println!("records stored: {}", summary.records_stored);
    println!("warnings: {}", summary.warnings.len());

    for diagnostic in &summary.warnings {
        print_diagnostic("WARN", diagnostic);
    }

    Ok(())
}

fn print_stage_json_summary(summary: &StageSummary) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(summary)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn validators() -> SchemaValidators {
        let schema_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../schemas");
        SchemaValidators::load(&schema_dir).expect("schemas load")
    }

    #[test]
    fn valid_change_event_passes_schema_and_extra_checks() {
        let validators = validators();
        let mut summary = ValidationSummary::new(Path::new("event.json"), "json");
        let event = json!({
            "schema_version": "change-event.v1",
            "event_id": "11111111-1111-1111-1111-111111111111",
            "client_event_id": "ra-batch-1-row-1",
            "event_type": "site_location_corrected",
            "event_intent": "correction",
            "target": {
                "target_type": "site",
                "site_id": "22222222-2222-2222-2222-222222222222"
            },
            "effective": {
                "effective_date": "2018-03-06",
                "date_precision": "day",
                "basis": "source_observation"
            },
            "recorded_at": "2026-05-02T09:00:00Z",
            "source_refs": [{
                "source_ref_type": "evidence_row",
                "evidence_row_id": "row-1",
                "licence_status": "accepted"
            }],
            "review": {
                "review_status": "staged",
                "confidence": 0.9
            },
            "payload_hash": null,
            "payload": {
                "payload_type": "geometry_update",
                "geometry": {
                    "type": "Point",
                    "coordinates": [174.7762, -41.2865]
                },
                "geometry_role": "site_location",
                "geometry_basis": "corrected_coordinate"
            }
        });

        validate_json_record(&event, 1, &validators, &mut summary);
        assert!(summary.errors.is_empty(), "{:#?}", summary.errors);
    }

    #[test]
    fn wrong_payload_type_is_rejected() {
        let validators = validators();
        let mut summary = ValidationSummary::new(Path::new("event.json"), "json");
        let event = json!({
            "schema_version": "change-event.v1",
            "event_id": "11111111-1111-1111-1111-111111111111",
            "client_event_id": "ra-batch-1-row-1",
            "event_type": "site_location_corrected",
            "event_intent": "correction",
            "target": {
                "target_type": "site",
                "site_id": "22222222-2222-2222-2222-222222222222"
            },
            "effective": {
                "effective_date": "2018-03-06",
                "date_precision": "day",
                "basis": "source_observation"
            },
            "recorded_at": "2026-05-02T09:00:00Z",
            "source_refs": [{
                "source_ref_type": "evidence_row",
                "evidence_row_id": "row-1"
            }],
            "review": {
                "review_status": "staged"
            },
            "payload": {
                "payload_type": "denomination_update",
                "denomination_code": "anglican"
            }
        });

        validate_json_record(&event, 1, &validators, &mut summary);
        assert!(!summary.errors.is_empty());
    }

    #[test]
    fn accepted_event_without_payload_hash_is_rejected() {
        let validators = validators();
        let mut summary = ValidationSummary::new(Path::new("event.json"), "json");
        let event = json!({
            "schema_version": "change-event.v1",
            "event_id": "11111111-1111-1111-1111-111111111111",
            "client_event_id": "ra-batch-1-row-1",
            "event_type": "site_status_changed",
            "event_intent": "observed_change",
            "target": {
                "target_type": "site",
                "site_id": "22222222-2222-2222-2222-222222222222"
            },
            "effective": {
                "effective_date": "2018-03-06",
                "date_precision": "day",
                "basis": "source_observation"
            },
            "recorded_at": "2026-05-02T09:00:00Z",
            "source_refs": [{
                "source_ref_type": "evidence_row",
                "evidence_row_id": "row-1"
            }],
            "review": {
                "review_status": "accepted"
            },
            "payload": {
                "payload_type": "status_update",
                "new_status": "closed"
            }
        });

        validate_json_record(&event, 1, &validators, &mut summary);
        assert!(
            summary
                .errors
                .iter()
                .any(|error| error.field.as_deref() == Some("payload_hash"))
        );
    }

    #[test]
    fn worship_function_event_passes_schema_and_extra_checks() {
        let validators = validators();
        let mut summary = ValidationSummary::new(Path::new("event.json"), "json");
        let event = json!({
            "schema_version": "change-event.v1",
            "event_id": "33333333-3333-3333-3333-333333333333",
            "client_event_id": "ra-batch-1-row-2",
            "event_type": "denomination_added",
            "event_intent": "observed_change",
            "target": {
                "target_type": "site",
                "site_id": "22222222-2222-2222-2222-222222222222"
            },
            "effective": {
                "effective_date": "2018-09-01",
                "date_precision": "day",
                "basis": "source_observation"
            },
            "recorded_at": "2026-05-03T09:00:00Z",
            "source_refs": [{
                "source_ref_type": "evidence_row",
                "evidence_row_id": "row-2",
                "licence_status": "accepted"
            }],
            "review": {
                "review_status": "staged",
                "confidence": 0.8
            },
            "taxonomy_version": "denomination-taxonomy.draft",
            "payload_hash": null,
            "payload": {
                "payload_type": "worship_function_update",
                "worship_use_status": "confirmed_worship",
                "denomination_set": ["anglican", "methodist"],
                "purpose_set": ["worship"],
                "target_year_affects": [{
                    "target_year": "2018-09-01",
                    "target_year_status": "present",
                    "worship_use_status": "confirmed_worship",
                    "confidence": 0.8,
                    "basis": "source_observation"
                }]
            }
        });

        validate_json_record(&event, 1, &validators, &mut summary);
        assert!(summary.errors.is_empty(), "{:#?}", summary.errors);
        assert!(summary.warnings.is_empty(), "{:#?}", summary.warnings);
    }

    #[test]
    fn denomination_event_without_taxonomy_version_is_rejected() {
        let validators = validators();
        let mut summary = ValidationSummary::new(Path::new("event.json"), "json");
        let event = json!({
            "schema_version": "change-event.v1",
            "event_id": "33333333-3333-3333-3333-333333333333",
            "client_event_id": "ra-batch-1-row-2",
            "event_type": "denomination_added",
            "event_intent": "observed_change",
            "target": {
                "target_type": "site",
                "site_id": "22222222-2222-2222-2222-222222222222"
            },
            "effective": {
                "effective_date": "2018-09-01",
                "date_precision": "day",
                "basis": "source_observation"
            },
            "recorded_at": "2026-05-03T09:00:00Z",
            "source_refs": [{
                "source_ref_type": "evidence_row",
                "evidence_row_id": "row-2",
                "licence_status": "accepted"
            }],
            "review": {
                "review_status": "staged",
                "confidence": 0.8
            },
            "payload": {
                "payload_type": "worship_function_update",
                "worship_use_status": "confirmed_worship",
                "denomination_set": ["anglican"],
                "target_year_affects": [{
                    "target_year": "2018-09-01",
                    "target_year_status": "present"
                }]
            }
        });

        validate_json_record(&event, 1, &validators, &mut summary);
        assert!(!summary.errors.is_empty());
    }

    #[test]
    fn partial_dates_accept_year_and_month_precision() {
        assert!(is_valid_partial_date("2013"));
        assert!(is_valid_partial_date("2013-09"));
        assert!(is_valid_partial_date("2013-09-01"));
        assert!(!is_valid_partial_date("2013-99"));
        assert!(!is_valid_partial_date("2013-02-31"));
    }

    #[test]
    fn stage_valid_jsonl_batch_writes_sqlite_rows() {
        let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let input = repo_root.join("docs/examples/revisions/nz-sample-change-events.jsonl");
        let db = std::env::temp_dir().join(format!(
            "pow-stage-test-{}.sqlite",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));

        let outcome = stage(StageArgs {
            input,
            db: db.clone(),
            schema_dir: repo_root.join("schemas"),
            template_dir: repo_root.join("docs/templates/ra-historical-site-evidence"),
            format: InputFormat::Auto,
            report: ReportFormat::Json,
        })
        .expect("stage succeeds");

        let StageOutcome::Staged(summary) = outcome else {
            panic!("valid batch should stage");
        };
        assert_eq!(summary.records_checked, 1);
        assert_eq!(summary.records_stored, 1);

        let conn = Connection::open(&db).expect("open staged db");
        let batch_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM stage_batches", [], |row| row.get(0))
            .expect("batch count");
        let record_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM stage_records", [], |row| row.get(0))
            .expect("record count");
        assert_eq!(batch_count, 1);
        assert_eq!(record_count, 1);

        let _ = fs::remove_file(db);
    }

    #[test]
    fn propose_site_observation_matches_golden_fixture() {
        let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let input = repo_root.join("docs/examples/revisions/ra-propose-site-observation.csv");
        let expected =
            repo_root.join("docs/examples/revisions/ra-propose-site-observation.expected.jsonl");
        let db = std::env::temp_dir().join(format!(
            "pow-propose-test-{}.sqlite",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));

        let records = extract_csv_stage_records(&input).expect("extract fixture records");
        let conn = Connection::open(&db).expect("open temp db");
        initialise_staging_schema(&conn).expect("initialise staging schema");
        conn.execute(
            "INSERT INTO stage_batches (
                batch_id, input_path, input_format, input_sha256, input_bytes,
                staged_at, records_checked, records_stored, error_count,
                warning_count, validation_summary_json, raw_input
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                "batch-test-001",
                input.display().to_string(),
                "csv",
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                0_i64,
                "2026-05-03T00:00:00Z",
                records.len() as i64,
                records.len() as i64,
                0_i64,
                0_i64,
                "{}",
                Vec::<u8>::new(),
            ],
        )
        .expect("insert stage batch");
        for record in records {
            let parsed_json = record
                .parsed_json
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .expect("serialize parsed json");
            conn.execute(
                "INSERT INTO stage_records (
                    batch_id, record_index, record_kind, raw_record, parsed_json
                ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    "batch-test-001",
                    record.record_index as i64,
                    record.record_kind,
                    record.raw_record,
                    parsed_json,
                ],
            )
            .expect("insert stage record");
        }

        let events = propose(ProposeArgs {
            batch_id: "batch-test-001".to_owned(),
            db: db.clone(),
            schema_dir: repo_root.join("schemas"),
            persist: false,
        })
        .expect("propose succeeds");
        let expected_events = fs::read_to_string(expected)
            .expect("read expected jsonl")
            .lines()
            .map(|line| serde_json::from_str::<Value>(line).expect("parse expected jsonl"))
            .collect::<Vec<_>>();

        assert_eq!(events, expected_events);

        let _ = fs::remove_file(db);
    }

    fn temp_db_path(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("pow-{label}-{nanos}.sqlite"))
    }

    fn insert_proposed_events(
        conn: &Connection,
        batch_id: &str,
        parent_batch_id: Option<&str>,
        events: &[Value],
    ) {
        conn.execute(
            "INSERT INTO stage_batches (
                batch_id, input_path, input_format, input_sha256, input_bytes,
                staged_at, records_checked, records_stored, error_count,
                warning_count, validation_summary_json, raw_input, parent_batch_id
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                batch_id,
                "<test fixture>",
                "jsonl",
                "0".repeat(64),
                0_i64,
                "2026-05-03T00:00:00Z",
                events.len() as i64,
                events.len() as i64,
                0_i64,
                0_i64,
                "{}",
                Vec::<u8>::new(),
                parent_batch_id,
            ],
        )
        .expect("insert stage batch");
        for (index, event) in events.iter().enumerate() {
            let serialised = serde_json::to_string(event).expect("serialize event");
            conn.execute(
                "INSERT INTO stage_records (
                    batch_id, record_index, record_kind, raw_record, parsed_json
                ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    batch_id,
                    index as i64,
                    "proposed_event",
                    &serialised,
                    Some(&serialised),
                ],
            )
            .expect("insert stage record");
        }
    }

    #[test]
    fn diff_rejects_worship_function_update_without_target_year_affects() {
        let event = json!({
            "schema_version": "change-event.v1",
            "event_id": "55555555-5555-4555-8555-555555555555",
            "client_event_id": "no-affects-1",
            "event_type": "worship_function_observed",
            "event_intent": "evidence_observation",
            "target": {
                "target_type": "site",
                "site_id": "66666666-6666-4666-8666-666666666666"
            },
            "effective": {
                "effective_date": "2018-09-01",
                "date_precision": "day",
                "basis": "source_observation"
            },
            "recorded_at": "2026-05-03T09:00:00Z",
            "source_refs": [{
                "source_ref_type": "evidence_row",
                "evidence_row_id": "row-1",
                "licence_status": "accepted"
            }],
            "review": {"review_status": "staged"},
            "payload_hash": null,
            "payload": {
                "payload_type": "worship_function_update",
                "worship_use_status": "confirmed_worship"
            }
        });
        let proposed = vec![ProposedEvent {
            record_index: 1,
            event,
        }];
        let err = enforce_target_year_affects(&proposed)
            .expect_err("should reject empty target_year_affects");
        assert!(err.to_string().contains("target_year_affects"));
    }

    #[test]
    fn diff_pipeline_runs_against_multi_denomination_fixture() {
        let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let fixture = repo_root.join("docs/examples/revisions/nz-multi-denomination.jsonl");
        let raw = fs::read_to_string(&fixture).expect("read fixture");
        let events: Vec<Value> = raw
            .lines()
            .map(|line| serde_json::from_str(line).expect("parse jsonl"))
            .collect();

        let db = temp_db_path("diff-multi-denom");
        let conn = Connection::open(&db).expect("open temp db");
        initialise_staging_schema(&conn).expect("schema init");
        insert_proposed_events(&conn, "diff-test-multi", None, &events);
        drop(conn);

        let outcome = diff(DiffArgs {
            batch_id: "diff-test-multi".to_owned(),
            db: db.clone(),
            schema_dir: repo_root.join("schemas"),
            report: ReportFormat::Text,
        })
        .expect("diff succeeds");

        assert_eq!(outcome.summary.event_count, 2);
        assert_eq!(outcome.summary.site_count, 1);
        let site = &outcome.sites[0];
        assert_eq!(site.site_key, "site:44444444-4444-4444-8444-444444444444");
        let denomination = site
            .denomination_set
            .as_ref()
            .expect("denomination_set transition");
        assert_eq!(
            denomination.previous.as_deref().unwrap_or(&[]),
            ["anglican".to_owned()].as_slice()
        );
        assert_eq!(
            denomination.next,
            vec!["anglican".to_owned(), "methodist".to_owned()]
        );
        let aggregate = outcome
            .target_years
            .get("2018-09-01")
            .expect("2018 aggregate present");
        // One site, two same-year events: site-level aggregate must collapse
        // to a single transition and final-status entry, not double-count.
        assert_eq!(aggregate.affected_sites, 1);
        assert_eq!(
            aggregate.transitions.get("<none> -> present").copied(),
            Some(1)
        );
        assert_eq!(
            aggregate.final_status_counts.get("present").copied(),
            Some(1)
        );

        let _ = fs::remove_file(db);
    }

    #[test]
    fn diff_pipeline_runs_against_use_changed_fixture() {
        let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let fixture =
            repo_root.join("docs/examples/revisions/nz-use-changed-building-remains.jsonl");
        let raw = fs::read_to_string(&fixture).expect("read fixture");
        let events: Vec<Value> = raw
            .lines()
            .map(|line| serde_json::from_str(line).expect("parse jsonl"))
            .collect();

        let db = temp_db_path("diff-use-changed");
        let conn = Connection::open(&db).expect("open temp db");
        initialise_staging_schema(&conn).expect("schema init");
        insert_proposed_events(&conn, "diff-test-use-changed", None, &events);
        drop(conn);

        let outcome = diff(DiffArgs {
            batch_id: "diff-test-use-changed".to_owned(),
            db: db.clone(),
            schema_dir: repo_root.join("schemas"),
            report: ReportFormat::Text,
        })
        .expect("diff succeeds");

        let site = &outcome.sites[0];
        let worship = site
            .worship_use_status
            .as_ref()
            .expect("worship_use_status transition");
        assert_eq!(worship.previous.as_deref(), Some("confirmed_worship"));
        assert_eq!(worship.next, "not_worship");
        let aggregate_2023 = outcome
            .target_years
            .get("2023-09-01")
            .expect("2023 aggregate");
        assert_eq!(
            aggregate_2023.transitions.get("present -> absent").copied(),
            Some(1)
        );

        let _ = fs::remove_file(db);
    }

    #[test]
    fn propose_persist_creates_derived_batch_readable_by_diff() {
        let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let csv = repo_root.join("docs/examples/revisions/ra-propose-site-observation.csv");
        let db = temp_db_path("persist-then-diff");
        let records = extract_csv_stage_records(&csv).expect("extract csv records");

        let conn = Connection::open(&db).expect("open temp db");
        initialise_staging_schema(&conn).expect("init schema");
        conn.execute(
            "INSERT INTO stage_batches (
                batch_id, input_path, input_format, input_sha256, input_bytes,
                staged_at, records_checked, records_stored, error_count,
                warning_count, validation_summary_json, raw_input
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                "persist-source-1",
                csv.display().to_string(),
                "csv",
                "1".repeat(64),
                0_i64,
                "2026-05-03T00:00:00Z",
                records.len() as i64,
                records.len() as i64,
                0_i64,
                0_i64,
                "{}",
                Vec::<u8>::new(),
            ],
        )
        .expect("insert source batch");
        for record in records {
            let parsed_json = record
                .parsed_json
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .expect("serialise parsed json");
            conn.execute(
                "INSERT INTO stage_records (
                    batch_id, record_index, record_kind, raw_record, parsed_json
                ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    "persist-source-1",
                    record.record_index as i64,
                    record.record_kind,
                    record.raw_record,
                    parsed_json,
                ],
            )
            .expect("insert source record");
        }
        drop(conn);

        let events = propose(ProposeArgs {
            batch_id: "persist-source-1".to_owned(),
            db: db.clone(),
            schema_dir: repo_root.join("schemas"),
            persist: false,
        })
        .expect("propose succeeds");
        assert!(!events.is_empty());

        let derived =
            persist_proposed_batch(&db, "persist-source-1", &events).expect("persist succeeds");
        assert!(derived.starts_with("proposed_"));

        let outcome = diff(DiffArgs {
            batch_id: derived.clone(),
            db: db.clone(),
            schema_dir: repo_root.join("schemas"),
            report: ReportFormat::Text,
        })
        .expect("diff over derived batch succeeds");
        assert_eq!(outcome.summary.event_count, events.len());
        assert_eq!(
            outcome.summary.parent_batch_id.as_deref(),
            Some("persist-source-1")
        );
        assert!(!outcome.sites.is_empty());
        // Persisted proposed events use one-based record numbering so
        // reviewer-facing record references read 1..N, not 0..N-1.
        let first_record_index = outcome
            .sites
            .iter()
            .flat_map(|site| site.events.iter())
            .map(|summary| summary.record_index)
            .min()
            .expect("at least one event summary");
        assert_eq!(first_record_index, 1);

        let _ = fs::remove_file(db);
    }
}
