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
            raw_input BLOB NOT NULL
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
        ",
    )?;
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
        println!("{kind}: {}", diagnostic.message);
    } else {
        println!("{kind} [{}]: {}", parts.join(", "), diagnostic.message);
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
}
