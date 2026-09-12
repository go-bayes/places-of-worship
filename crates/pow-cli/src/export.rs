// verification for materialised `pow-export-bundle.v1` directories
// (docs/development/frozen-exports-brief-2026-09-12.md, section 7). the
// manifest hash and the evidence-version envelopes reuse the canonical
// module's existing helpers rather than forking them. review-snapshot
// content hashing uses an older, pre-rfc-8785 canonical form
// (`canonicalJson` in convex/lib/canonicalJson.ts) that this crate has never
// implemented, so a snapshot's content is not recomputed here: only its
// presence and cross-references are checked, and that limit is reported as
// an informational note rather than an error.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use serde::Serialize;
use serde_json::{Map, Value};

use crate::canonical;
use crate::{ExportAction, ExportArgs, ReportFormat, sha256_hex, terminal_safe};

const BUNDLE_CONTRACT: &str = "pow-export-bundle.v1";

/// One failed check, named by which check group it belongs to and, when the
/// failure is about a particular file, which file.
#[derive(Debug, Serialize)]
struct CheckError {
    check: &'static str,
    file: Option<String>,
    message: String,
}

#[derive(Debug, Serialize)]
struct ExportVerifyReport {
    valid: bool,
    directory: String,
    export_batch_id: Option<String>,
    manifest_hash: Option<String>,
    errors: Vec<CheckError>,
    notes: Vec<String>,
}

/// `pow export` dispatch. Returns true when the bundle failed verification,
/// matching the exit convention `pow object verify` already uses.
pub fn run_export(args: ExportArgs) -> Result<bool> {
    match args.action {
        ExportAction::Verify(args) => {
            let report = verify_bundle(&args.dir)?;
            match args.report {
                ReportFormat::Text => print_verify_text(&report),
                ReportFormat::Json => println!("{}", serde_json::to_string(&report)?),
            }
            Ok(!report.valid)
        }
    }
}

fn push_error(
    errors: &mut Vec<CheckError>,
    check: &'static str,
    file: Option<&str>,
    message: impl Into<String>,
) {
    errors.push(CheckError {
        check,
        file: file.map(str::to_owned),
        message: message.into(),
    });
}

/// One `files[]` entry from the manifest, with the fields verification needs.
struct FileEntry {
    filename: String,
    sha256: Option<String>,
    byte_length: Option<i64>,
    record_count: Option<i64>,
}

fn verify_bundle(dir: &Path) -> Result<ExportVerifyReport> {
    let mut errors = Vec::new();
    let mut notes = Vec::new();
    let directory = dir.display().to_string();

    let manifest_path = dir.join("export_manifest.json");
    let manifest_bytes =
        fs::read(&manifest_path).with_context(|| format!("reading {}", manifest_path.display()))?;
    let manifest_value: Value = serde_json::from_slice(&manifest_bytes)
        .with_context(|| format!("parsing {}", manifest_path.display()))?;
    let Some(manifest_object) = manifest_value.as_object() else {
        push_error(
            &mut errors,
            "manifest",
            Some("export_manifest.json"),
            "export_manifest.json must contain a JSON object",
        );
        return Ok(ExportVerifyReport {
            valid: false,
            directory,
            export_batch_id: None,
            manifest_hash: None,
            errors,
            notes,
        });
    };

    let export_batch_id = manifest_object
        .get("export_batch_id")
        .and_then(Value::as_str)
        .map(str::to_owned);

    // check 1: contract labels, frozen/hash presence, manifest_hash.
    match manifest_object
        .get("bundle_contract")
        .and_then(Value::as_str)
    {
        Some(BUNDLE_CONTRACT) => {}
        other => push_error(
            &mut errors,
            "manifest",
            Some("export_manifest.json"),
            format!("bundle_contract must be {BUNDLE_CONTRACT:?}, found {other:?}"),
        ),
    }
    match manifest_object.get("hash_contract").and_then(Value::as_str) {
        Some(contract) if contract == canonical::HASH_CONTRACT => {}
        other => push_error(
            &mut errors,
            "manifest",
            Some("export_manifest.json"),
            format!(
                "hash_contract must be {:?}, found {other:?}",
                canonical::HASH_CONTRACT
            ),
        ),
    }

    let frozen_at_present = manifest_object
        .get("frozen_at")
        .is_some_and(|v| !v.is_null());
    let manifest_hash_declared = manifest_object.get("manifest_hash").and_then(Value::as_str);
    if !frozen_at_present || manifest_hash_declared.is_none() {
        push_error(
            &mut errors,
            "manifest",
            Some("export_manifest.json"),
            "manifest carries no frozen_at or manifest_hash; this is a draft preview, \
             not a frozen bundle, and is refused",
        );
        return Ok(ExportVerifyReport {
            valid: false,
            directory,
            export_batch_id,
            manifest_hash: None,
            errors,
            notes,
        });
    }
    let declared_manifest_hash = manifest_hash_declared.expect("checked above").to_owned();

    let mut without_hash = manifest_object.clone();
    without_hash.remove("manifest_hash");
    match canonical::object_hash(&Value::Object(without_hash)) {
        Ok(recomputed) if recomputed == declared_manifest_hash => {}
        Ok(recomputed) => push_error(
            &mut errors,
            "manifest",
            Some("export_manifest.json"),
            format!(
                "manifest_hash {declared_manifest_hash:?} does not match the recomputed hash {recomputed:?}"
            ),
        ),
        Err(error) => push_error(
            &mut errors,
            "manifest",
            Some("export_manifest.json"),
            format!("manifest_hash could not be recomputed: {error}"),
        ),
    }

    // check 2 (part one): the files[] array is well formed, sorted, and
    // never lists export_manifest.json itself.
    let mut file_entries = Vec::new();
    match manifest_object.get("files") {
        Some(Value::Array(items)) => {
            for (index, item) in items.iter().enumerate() {
                let Some(object) = item.as_object() else {
                    push_error(
                        &mut errors,
                        "files",
                        None,
                        format!("files[{index}] must be an object"),
                    );
                    continue;
                };
                let Some(filename) = object.get("filename").and_then(Value::as_str) else {
                    push_error(
                        &mut errors,
                        "files",
                        None,
                        format!("files[{index}] is missing filename"),
                    );
                    continue;
                };
                file_entries.push(FileEntry {
                    filename: filename.to_owned(),
                    sha256: object
                        .get("sha256")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                    byte_length: object.get("byte_length").and_then(Value::as_i64),
                    record_count: object.get("record_count").and_then(Value::as_i64),
                });
            }
        }
        _ => push_error(
            &mut errors,
            "files",
            None,
            "manifest `files` must be an array",
        ),
    }

    for entry in &file_entries {
        if entry.filename == "export_manifest.json" {
            push_error(
                &mut errors,
                "files",
                Some(entry.filename.as_str()),
                "files must not list export_manifest.json",
            );
        }
    }
    for window in file_entries.windows(2) {
        match window[0].filename.cmp(&window[1].filename) {
            std::cmp::Ordering::Less => {}
            std::cmp::Ordering::Equal => push_error(
                &mut errors,
                "files",
                Some(window[0].filename.as_str()),
                format!(
                    "files contains the duplicate filename {:?}",
                    window[0].filename
                ),
            ),
            std::cmp::Ordering::Greater => push_error(
                &mut errors,
                "files",
                None,
                format!(
                    "files is not sorted by filename: {:?} precedes {:?}",
                    window[0].filename, window[1].filename
                ),
            ),
        }
    }

    // check 2 (part two): every regular file in the directory is either
    // export_manifest.json, SHA256SUMS, or a listed file; every listed file
    // exists on disk with the declared byte length and sha256.
    let listed: BTreeSet<String> = file_entries
        .iter()
        .map(|entry| entry.filename.clone())
        .collect();
    let mut on_disk_entries =
        fs::read_dir(dir).with_context(|| format!("reading directory {}", dir.display()))?;
    while let Some(entry) = on_disk_entries.next().transpose()? {
        if !entry.file_type()?.is_file() {
            continue;
        }
        let filename = entry.file_name().to_string_lossy().into_owned();
        if filename == "export_manifest.json"
            || filename == "SHA256SUMS"
            || listed.contains(&filename)
        {
            continue;
        }
        push_error(
            &mut errors,
            "files",
            Some(&filename),
            "file is present in the directory but is not listed in the manifest's files[]",
        );
    }

    let mut file_bytes: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    for entry in &file_entries {
        let path = dir.join(&entry.filename);
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(_) => {
                push_error(
                    &mut errors,
                    "files",
                    Some(entry.filename.as_str()),
                    "listed file is missing from the directory",
                );
                continue;
            }
        };

        let actual_sha256 = sha256_hex(&bytes);
        if entry.sha256.as_deref() != Some(actual_sha256.as_str()) {
            push_error(
                &mut errors,
                "files",
                Some(entry.filename.as_str()),
                format!(
                    "sha256 mismatch: manifest says {:?}, the file's bytes hash to {actual_sha256:?}",
                    entry.sha256
                ),
            );
        }
        let actual_len = bytes.len() as i64;
        if entry.byte_length != Some(actual_len) {
            push_error(
                &mut errors,
                "files",
                Some(entry.filename.as_str()),
                format!(
                    "byte_length mismatch: manifest says {:?}, the file is {actual_len} bytes",
                    entry.byte_length
                ),
            );
        }

        // check 3: record_count matches the JSONL line count or the CSV
        // data-row count (quoted newlines respected).
        match count_records(&entry.filename, &bytes) {
            Ok(Some(actual_records)) => {
                let actual_records = actual_records as i64;
                if entry.record_count != Some(actual_records) {
                    push_error(
                        &mut errors,
                        "record_count",
                        Some(entry.filename.as_str()),
                        format!(
                            "record_count mismatch: manifest says {:?}, the file holds {actual_records}",
                            entry.record_count
                        ),
                    );
                }
            }
            Ok(None) => {}
            Err(error) => push_error(
                &mut errors,
                "record_count",
                Some(entry.filename.as_str()),
                format!("could not count records: {error}"),
            ),
        }

        file_bytes.insert(entry.filename.clone(), bytes);
    }

    // checks 4 to 6 read the row content of the bundle's JSONL files.
    let tasks_rows = read_jsonl_objects("tasks.jsonl", file_bytes.get("tasks.jsonl"), &mut errors);
    let decision_rows = read_jsonl_objects(
        "review_decisions.jsonl",
        file_bytes.get("review_decisions.jsonl"),
        &mut errors,
    );
    let acceptance_rows = read_jsonl_objects(
        "task_acceptances.jsonl",
        file_bytes.get("task_acceptances.jsonl"),
        &mut errors,
    );
    let draft_rows = read_jsonl_objects(
        "evidence_drafts.jsonl",
        file_bytes.get("evidence_drafts.jsonl"),
        &mut errors,
    );
    let snapshot_rows = read_jsonl_objects(
        "review_snapshots.jsonl",
        file_bytes.get("review_snapshots.jsonl"),
        &mut errors,
    );

    // check 4: membership.
    let task_ids: BTreeSet<String> = string_field_set(&tasks_rows, "task_id");
    let included_task_ids = manifest_string_array(manifest_object, "included_task_ids");
    if task_ids != included_task_ids {
        push_error(
            &mut errors,
            "membership",
            Some("tasks.jsonl"),
            "the set of task_id in tasks.jsonl does not equal included_task_ids",
        );
    }

    let decision_ids: BTreeSet<String> = string_field_set(&decision_rows, "review_decision_id");
    let included_decision_ids =
        manifest_string_array(manifest_object, "included_review_decision_ids");
    if decision_ids != included_decision_ids {
        push_error(
            &mut errors,
            "membership",
            Some("review_decisions.jsonl"),
            "the set of review_decision_id in review_decisions.jsonl does not equal \
             included_review_decision_ids",
        );
    }

    let acceptance_ids: BTreeSet<String> = string_field_set(&acceptance_rows, "acceptance_id");
    let included_acceptance_ids = manifest_string_array(manifest_object, "included_acceptance_ids");
    if !included_acceptance_ids.is_subset(&acceptance_ids) {
        push_error(
            &mut errors,
            "membership",
            Some("task_acceptances.jsonl"),
            "included_acceptance_ids is not a subset of the acceptance_id set in \
             task_acceptances.jsonl",
        );
    }

    for row in &draft_rows {
        if let Some(task_id) = row.get("task_id").and_then(Value::as_str)
            && !task_ids.contains(task_id)
        {
            push_error(
                &mut errors,
                "membership",
                Some("evidence_drafts.jsonl"),
                format!("a draft names task_id {task_id:?}, which is not an included task"),
            );
        }
    }

    let draft_ids: BTreeSet<String> = string_field_set(&draft_rows, "evidence_draft_id");
    for row in &decision_rows {
        if let Some(draft_id) = row.get("evidence_draft_id").and_then(Value::as_str)
            && !draft_ids.contains(draft_id)
        {
            push_error(
                &mut errors,
                "membership",
                Some("review_decisions.jsonl"),
                format!(
                    "a decision names evidence_draft_id {draft_id:?}, which is not a draft \
                     in the bundle"
                ),
            );
        }
    }

    // check 5: pins. each evidence_versions.jsonl row is the stored Convex
    // document, not a bare envelope: it wraps the evidence-version.v1
    // envelope as a JSON string in `envelope_json`. verify the inner
    // envelope, then require the row's own `object_hash` to agree with it, so
    // a row cannot claim a pin its wrapped envelope does not actually carry.
    // collect the object_hash and snapshot_hash sets before walking decisions.
    let mut version_object_hashes: BTreeSet<String> = BTreeSet::new();
    if let Some(bytes) = file_bytes.get("evidence_versions.jsonl") {
        for (index, line) in split_nonempty_lines(bytes) {
            let row = match serde_json::from_str::<Value>(line) {
                Ok(Value::Object(row)) => row,
                Ok(_) => {
                    push_error(
                        &mut errors,
                        "pins",
                        Some("evidence_versions.jsonl"),
                        format!("line {index} is not a JSON object"),
                    );
                    continue;
                }
                Err(error) => {
                    push_error(
                        &mut errors,
                        "pins",
                        Some("evidence_versions.jsonl"),
                        format!("line {index} is not valid JSON: {error}"),
                    );
                    continue;
                }
            };
            let row_object_hash = row.get("object_hash").and_then(Value::as_str);
            let Some(envelope_json) = row.get("envelope_json").and_then(Value::as_str) else {
                push_error(
                    &mut errors,
                    "pins",
                    Some("evidence_versions.jsonl"),
                    format!("line {index} is missing a string envelope_json"),
                );
                continue;
            };
            let envelope: Value = match serde_json::from_str(envelope_json) {
                Ok(value) => value,
                Err(error) => {
                    push_error(
                        &mut errors,
                        "pins",
                        Some("evidence_versions.jsonl"),
                        format!("line {index} envelope_json is not valid JSON: {error}"),
                    );
                    continue;
                }
            };
            match canonical::verify_envelope(&envelope) {
                Ok(verified) => {
                    if row_object_hash != Some(verified.object_hash.as_str()) {
                        push_error(
                            &mut errors,
                            "pins",
                            Some("evidence_versions.jsonl"),
                            format!(
                                "line {index} object_hash {row_object_hash:?} does not match its \
                                 envelope_json's object_hash {:?}",
                                verified.object_hash
                            ),
                        );
                    }
                    version_object_hashes.insert(verified.object_hash);
                }
                Err(envelope_errors) => push_error(
                    &mut errors,
                    "pins",
                    Some("evidence_versions.jsonl"),
                    format!(
                        "line {index} envelope_json failed verification: {}",
                        envelope_errors.join("; ")
                    ),
                ),
            }
        }
    }
    let manifest_version_hashes = manifest_string_array(manifest_object, "evidence_version_hashes");
    if version_object_hashes != manifest_version_hashes {
        push_error(
            &mut errors,
            "pins",
            Some("evidence_versions.jsonl"),
            "the set of envelope object_hash values does not equal evidence_version_hashes",
        );
    }

    let snapshot_hashes: BTreeSet<String> = string_field_set(&snapshot_rows, "snapshot_hash");
    let manifest_snapshot_hashes = manifest_string_array(manifest_object, "review_snapshot_hashes");
    if snapshot_hashes != manifest_snapshot_hashes {
        push_error(
            &mut errors,
            "pins",
            Some("review_snapshots.jsonl"),
            "the set of snapshot_hash values does not equal review_snapshot_hashes",
        );
    }
    notes.push(
        "review_snapshots.jsonl: the snapshot content hash is sha256 over the older, \
         pre-RFC-8785 canonicalJson form; this crate has no implementation of that form, \
         so snapshot content is not recomputed here (presence and cross-references only)"
            .to_owned(),
    );

    let draft_by_id: BTreeMap<&str, &Map<String, Value>> = draft_rows
        .iter()
        .filter_map(|row| {
            row.get("evidence_draft_id")
                .and_then(Value::as_str)
                .map(|id| (id, row))
        })
        .collect();
    let decision_by_id: BTreeMap<&str, &Map<String, Value>> = decision_rows
        .iter()
        .filter_map(|row| {
            row.get("review_decision_id")
                .and_then(Value::as_str)
                .map(|id| (id, row))
        })
        .collect();
    let task_by_id: BTreeMap<&str, &Map<String, Value>> = tasks_rows
        .iter()
        .filter_map(|row| {
            row.get("task_id")
                .and_then(Value::as_str)
                .map(|id| (id, row))
        })
        .collect();

    for row in &decision_rows {
        let review_decision_id = row
            .get("review_decision_id")
            .and_then(Value::as_str)
            .unwrap_or("<unknown review_decision_id>");
        if let Some(decision_hash) = row.get("evidence_version_hash").and_then(Value::as_str) {
            if let Some(draft_id) = row.get("evidence_draft_id").and_then(Value::as_str)
                && let Some(draft) = draft_by_id.get(draft_id)
            {
                let draft_hash = draft.get("evidence_version_hash").and_then(Value::as_str);
                if draft_hash != Some(decision_hash) {
                    push_error(
                        &mut errors,
                        "pins",
                        Some("review_decisions.jsonl"),
                        format!(
                            "decision {review_decision_id:?} pins evidence_version_hash \
                             {decision_hash:?}, which does not match draft {draft_id:?}'s \
                             evidence_version_hash {draft_hash:?}"
                        ),
                    );
                }
            }
            if !version_object_hashes.contains(decision_hash) {
                push_error(
                    &mut errors,
                    "pins",
                    Some("evidence_versions.jsonl"),
                    format!(
                        "decision {review_decision_id:?} pins evidence_version_hash \
                         {decision_hash:?}, which no envelope's object_hash matches"
                    ),
                );
            }
        }
        if let Some(snapshot_hash) = row.get("review_snapshot_hash").and_then(Value::as_str)
            && !snapshot_hashes.contains(snapshot_hash)
        {
            push_error(
                &mut errors,
                "pins",
                Some("review_snapshots.jsonl"),
                format!(
                    "decision {review_decision_id:?} names review_snapshot_hash \
                     {snapshot_hash:?}, which is not present in review_snapshots.jsonl"
                ),
            );
        }
    }

    // check 6: only the latest `accepted` acceptance per task carries export
    // authority (convex/exports.ts, createExportBatch): an earlier accepted
    // acceptance that a later PI return and a fresh review superseded is
    // retained history, not a live claim, and its draft may since have moved
    // on (superseded, withdrawn). group task_acceptances.jsonl by task_id,
    // keep only the greatest (created_at, _creationTime) accepted row per
    // task, and apply the decision/draft/task chain to that row alone.
    let mut acceptances_by_task: BTreeMap<&str, Vec<&Map<String, Value>>> = BTreeMap::new();
    for row in &acceptance_rows {
        if let Some(task_id) = row.get("task_id").and_then(Value::as_str) {
            acceptances_by_task.entry(task_id).or_default().push(row);
        }
    }

    for task_id in &included_task_ids {
        let latest = acceptances_by_task
            .get(task_id.as_str())
            .into_iter()
            .flatten()
            .copied()
            .filter(|row| row.get("outcome").and_then(Value::as_str) == Some("accepted"))
            .max_by(|a, b| {
                let key = |row: &&Map<String, Value>| {
                    (
                        row.get("created_at")
                            .and_then(Value::as_f64)
                            .unwrap_or(f64::MIN),
                        row.get("_creationTime")
                            .and_then(Value::as_f64)
                            .unwrap_or(f64::MIN),
                    )
                };
                key(a)
                    .partial_cmp(&key(b))
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        let Some(row) = latest else {
            push_error(
                &mut errors,
                "acceptance",
                Some("task_acceptances.jsonl"),
                format!("task {task_id:?} has no accepted acceptance"),
            );
            continue;
        };
        let acceptance_id = row
            .get("acceptance_id")
            .and_then(Value::as_str)
            .unwrap_or("<unknown acceptance_id>");
        let Some(review_decision_id) = row.get("review_decision_id").and_then(Value::as_str) else {
            push_error(
                &mut errors,
                "acceptance",
                Some("task_acceptances.jsonl"),
                format!("accepted acceptance {acceptance_id:?} carries no review_decision_id"),
            );
            continue;
        };
        let Some(decision) = decision_by_id.get(review_decision_id) else {
            push_error(
                &mut errors,
                "acceptance",
                Some("task_acceptances.jsonl"),
                format!(
                    "accepted acceptance {acceptance_id:?} names missing review_decision_id \
                     {review_decision_id:?}"
                ),
            );
            continue;
        };
        if decision.get("decision_status").and_then(Value::as_str) != Some("accepted_for_export") {
            push_error(
                &mut errors,
                "acceptance",
                Some("review_decisions.jsonl"),
                format!(
                    "decision {review_decision_id:?}, named by accepted acceptance \
                     {acceptance_id:?}, is not accepted_for_export"
                ),
            );
            continue;
        }
        let Some(draft_id) = decision.get("evidence_draft_id").and_then(Value::as_str) else {
            push_error(
                &mut errors,
                "acceptance",
                Some("review_decisions.jsonl"),
                format!("decision {review_decision_id:?} carries no evidence_draft_id"),
            );
            continue;
        };
        let Some(draft) = draft_by_id.get(draft_id) else {
            push_error(
                &mut errors,
                "acceptance",
                Some("evidence_drafts.jsonl"),
                format!(
                    "decision {review_decision_id:?} names missing evidence_draft_id {draft_id:?}"
                ),
            );
            continue;
        };
        if draft.get("draft_status").and_then(Value::as_str) != Some("accepted_for_export") {
            push_error(
                &mut errors,
                "acceptance",
                Some("evidence_drafts.jsonl"),
                format!("draft {draft_id:?}'s draft_status is not accepted_for_export"),
            );
            continue;
        }
        let Some(task_id) = draft.get("task_id").and_then(Value::as_str) else {
            push_error(
                &mut errors,
                "acceptance",
                Some("evidence_drafts.jsonl"),
                format!("draft {draft_id:?} carries no task_id"),
            );
            continue;
        };
        let Some(task) = task_by_id.get(task_id) else {
            push_error(
                &mut errors,
                "acceptance",
                Some("tasks.jsonl"),
                format!("draft {draft_id:?} names missing task_id {task_id:?}"),
            );
            continue;
        };
        let status = task.get("status").and_then(Value::as_str);
        if !matches!(status, Some("exported") | Some("pi_accepted")) {
            push_error(
                &mut errors,
                "acceptance",
                Some("tasks.jsonl"),
                format!("task {task_id:?}'s status {status:?} is neither exported nor pi_accepted"),
            );
        }
    }

    let valid = errors.is_empty();
    Ok(ExportVerifyReport {
        valid,
        directory,
        export_batch_id,
        manifest_hash: Some(declared_manifest_hash),
        errors,
        notes,
    })
}

/// Read every non-empty line of a `.jsonl` file already loaded into memory
/// as a JSON object, reporting a parse failure against `filename` rather
/// than panicking. Absent bytes (the file was already reported missing)
/// yield no rows.
fn read_jsonl_objects(
    filename: &'static str,
    bytes: Option<&Vec<u8>>,
    errors: &mut Vec<CheckError>,
) -> Vec<Map<String, Value>> {
    let Some(bytes) = bytes else {
        return Vec::new();
    };
    let mut rows = Vec::new();
    for (index, line) in split_nonempty_lines(bytes) {
        match serde_json::from_str::<Value>(line) {
            Ok(Value::Object(object)) => rows.push(object),
            Ok(_) => push_error(
                errors,
                "membership",
                Some(filename),
                format!("line {index} is not a JSON object"),
            ),
            Err(error) => push_error(
                errors,
                "membership",
                Some(filename),
                format!("line {index} is not valid JSON: {error}"),
            ),
        }
    }
    rows
}

/// Non-empty, 1-indexed lines of a byte buffer, tolerant of a trailing
/// newline (which yields no extra empty line) and of invalid UTF-8 (lossily
/// decoded, since a decoding error will already have been reported by the
/// sha256/byte_length check).
fn split_nonempty_lines(bytes: &[u8]) -> Vec<(usize, &str)> {
    let text = match std::str::from_utf8(bytes) {
        Ok(text) => text,
        Err(_) => return Vec::new(),
    };
    text.split('\n')
        .enumerate()
        .filter(|(_, line)| !line.is_empty())
        .map(|(index, line)| (index + 1, line))
        .collect()
}

/// The number of JSONL lines, or the number of CSV data rows (header
/// excluded, quoted newlines respected), for a file the manifest names.
/// `None` when the filename is neither, so the caller skips the check.
fn count_records(filename: &str, bytes: &[u8]) -> Result<Option<usize>> {
    if filename.ends_with(".jsonl") {
        Ok(Some(split_nonempty_lines(bytes).len()))
    } else if filename.ends_with(".csv") {
        let mut reader = csv::ReaderBuilder::new().flexible(true).from_reader(bytes);
        let mut count = 0usize;
        for record in reader.records() {
            record.with_context(|| format!("reading CSV records from {filename}"))?;
            count += 1;
        }
        Ok(Some(count))
    } else {
        Ok(None)
    }
}

fn string_field_set(rows: &[Map<String, Value>], field: &str) -> BTreeSet<String> {
    rows.iter()
        .filter_map(|row| row.get(field).and_then(Value::as_str))
        .map(str::to_owned)
        .collect()
}

fn manifest_string_array(manifest: &Map<String, Value>, field: &str) -> BTreeSet<String> {
    manifest
        .get(field)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn print_verify_text(report: &ExportVerifyReport) {
    if report.valid {
        println!(
            "ok {} {}",
            report.export_batch_id.as_deref().unwrap_or("-"),
            report.manifest_hash.as_deref().unwrap_or("-")
        );
    } else {
        println!("pow export verify: invalid bundle");
        for error in &report.errors {
            match &error.file {
                Some(file) => println!(
                    "- [{}] {}: {}",
                    error.check,
                    file,
                    terminal_safe(&error.message)
                ),
                None => println!("- [{}] {}", error.check, terminal_safe(&error.message)),
            }
        }
    }
    for note in &report.notes {
        println!("note: {}", terminal_safe(note));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// A unique, cleaned-up temp directory per test, so parallel `cargo
    /// test` runs never collide.
    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("pow-export-verify-test-{label}-{nanos}"));
        fs::create_dir_all(&dir).expect("create temp bundle directory");
        dir
    }

    /// The in-memory rows a minimal bundle is built from.
    struct BundleRows {
        tasks: Vec<Value>,
        review_decisions: Vec<Value>,
        task_acceptances: Vec<Value>,
        evidence_drafts: Vec<Value>,
        evidence_versions: Vec<Value>,
        review_snapshots: Vec<Value>,
    }

    fn signed_envelope(mut envelope: Map<String, Value>) -> Value {
        envelope.remove("object_hash");
        let hash = canonical::object_hash(&Value::Object(envelope.clone())).expect("hash envelope");
        envelope.insert("object_hash".to_owned(), Value::String(hash));
        Value::Object(envelope)
    }

    fn evidence_version_envelope(logical_id: &str) -> Value {
        signed_envelope(
            json!({
                "hash_contract": canonical::HASH_CONTRACT,
                "object_type": "evidence_version",
                "schema_version": "evidence-version.v1",
                "logical_id": logical_id,
                "parent_object_hashes": [],
                "created_by": "actor:test-user",
                "recorded_at": "2026-09-11T04:30:00.000Z",
                "payload": { "occupancies": [] }
            })
            .as_object()
            .expect("object")
            .clone(),
        )
    }

    /// Wrap an envelope the way the stored Convex `evidence_versions`
    /// document does: `object_hash` copied to the row, and the envelope
    /// itself serialised into the `envelope_json` string member.
    fn evidence_version_row(envelope: &Value) -> Value {
        let object_hash = envelope
            .get("object_hash")
            .and_then(Value::as_str)
            .expect("object_hash")
            .to_owned();
        let envelope_json = serde_json::to_string(envelope).expect("serialise envelope");
        json!({
            "_id": "evidence_versions_test",
            "_creationTime": 1,
            "object_hash": object_hash,
            "hash_contract": canonical::HASH_CONTRACT,
            "object_type": "evidence_version",
            "schema_version": "evidence-version.v1",
            "created_by": "users_1",
            "recorded_at": 1,
            "envelope_json": envelope_json,
        })
    }

    /// A self-consistent set of rows: one task, one accepted decision, one
    /// accepted acceptance, one accepted draft pinned to one evidence
    /// version, and the snapshot the decision names.
    fn valid_rows() -> BundleRows {
        let envelope = evidence_version_envelope("evidence:test-task-1:1");
        let object_hash = envelope
            .get("object_hash")
            .and_then(Value::as_str)
            .expect("object_hash")
            .to_owned();
        BundleRows {
            tasks: vec![json!({"task_id": "task-1", "status": "pi_accepted"})],
            review_decisions: vec![json!({
                "review_decision_id": "decision-1",
                "task_id": "task-1",
                "evidence_draft_id": "draft-1",
                "decision_status": "accepted_for_export",
                "evidence_version_hash": object_hash,
                "review_snapshot_hash": "snapshot-hash-1",
            })],
            task_acceptances: vec![json!({
                "acceptance_id": "acceptance-1",
                "task_id": "task-1",
                "review_decision_id": "decision-1",
                "outcome": "accepted",
                "created_at": 1,
            })],
            evidence_drafts: vec![json!({
                "evidence_draft_id": "draft-1",
                "task_id": "task-1",
                "draft_status": "accepted_for_export",
                "evidence_version_hash": object_hash,
            })],
            evidence_versions: vec![evidence_version_row(&envelope)],
            review_snapshots: vec![json!({
                "snapshot_hash": "snapshot-hash-1",
                "snapshot_json": "{}",
            })],
        }
    }

    fn jsonl_bytes(rows: &[Value]) -> Vec<u8> {
        let mut text = String::new();
        for row in rows {
            text.push_str(&serde_json::to_string(row).expect("serialise row"));
            text.push('\n');
        }
        text.into_bytes()
    }

    const DEFAULT_ORDER: [&str; 6] = [
        "evidence_drafts.jsonl",
        "evidence_versions.jsonl",
        "review_decisions.jsonl",
        "review_snapshots.jsonl",
        "task_acceptances.jsonl",
        "tasks.jsonl",
    ];

    fn file_bytes_for(rows: &BundleRows, filename: &str) -> Vec<u8> {
        match filename {
            "tasks.jsonl" => jsonl_bytes(&rows.tasks),
            "review_decisions.jsonl" => jsonl_bytes(&rows.review_decisions),
            "task_acceptances.jsonl" => jsonl_bytes(&rows.task_acceptances),
            "evidence_drafts.jsonl" => jsonl_bytes(&rows.evidence_drafts),
            "evidence_versions.jsonl" => jsonl_bytes(&rows.evidence_versions),
            "review_snapshots.jsonl" => jsonl_bytes(&rows.review_snapshots),
            other => panic!("unknown test bundle file {other}"),
        }
    }

    /// `files[]` entries and matching on-disk bytes, in `order`, computed
    /// with the crate's own sha256 and line-count helpers.
    fn default_files_field_and_disk(
        rows: &BundleRows,
        order: &[&str],
    ) -> (Vec<Value>, BTreeMap<String, Vec<u8>>) {
        let mut files_field = Vec::new();
        let mut disk = BTreeMap::new();
        for filename in order {
            let bytes = file_bytes_for(rows, filename);
            let sha256 = sha256_hex(&bytes);
            files_field.push(json!({
                "filename": filename,
                "content_type": "application/x-ndjson",
                "record_count": split_nonempty_lines(&bytes).len(),
                "sha256": sha256,
                "byte_length": bytes.len(),
            }));
            disk.insert((*filename).to_owned(), bytes);
        }
        (files_field, disk)
    }

    /// Every manifest field except `manifest_hash`, built from `rows`
    /// (the `included_*` arrays and hash sets) and the given `files_field`.
    fn manifest_fields(rows: &BundleRows, files_field: Vec<Value>) -> Map<String, Value> {
        let mut included_task_ids: Vec<String> = string_field_set(
            &rows
                .tasks
                .iter()
                .map(|v| v.as_object().expect("object").clone())
                .collect::<Vec<_>>(),
            "task_id",
        )
        .into_iter()
        .collect();
        included_task_ids.sort();
        let mut included_review_decision_ids: Vec<String> = string_field_set(
            &rows
                .review_decisions
                .iter()
                .map(|v| v.as_object().expect("object").clone())
                .collect::<Vec<_>>(),
            "review_decision_id",
        )
        .into_iter()
        .collect();
        included_review_decision_ids.sort();
        let mut included_acceptance_ids: Vec<String> = string_field_set(
            &rows
                .task_acceptances
                .iter()
                .map(|v| v.as_object().expect("object").clone())
                .collect::<Vec<_>>(),
            "acceptance_id",
        )
        .into_iter()
        .collect();
        included_acceptance_ids.sort();
        let mut evidence_version_hashes: Vec<String> = rows
            .evidence_versions
            .iter()
            .filter_map(|v| v.get("object_hash").and_then(Value::as_str))
            .map(str::to_owned)
            .collect();
        evidence_version_hashes.sort();
        evidence_version_hashes.dedup();
        let mut review_snapshot_hashes: Vec<String> = rows
            .review_snapshots
            .iter()
            .filter_map(|v| v.get("snapshot_hash").and_then(Value::as_str))
            .map(str::to_owned)
            .collect();
        review_snapshot_hashes.sort();
        review_snapshot_hashes.dedup();

        let mut fields = Map::new();
        fields.insert("bundle_contract".to_owned(), json!(BUNDLE_CONTRACT));
        fields.insert("hash_contract".to_owned(), json!(canonical::HASH_CONTRACT));
        fields.insert("export_batch_id".to_owned(), json!("test-export-batch-1"));
        fields.insert("country_code".to_owned(), json!("NZ"));
        fields.insert("schema_version".to_owned(), json!("convex-task-layer.v0.1"));
        fields.insert("export_format".to_owned(), json!("bundle"));
        fields.insert("created_at".to_owned(), json!(1_789_000_000_000i64));
        fields.insert("frozen_at".to_owned(), json!(1_789_000_060_000i64));
        fields.insert("included_task_ids".to_owned(), json!(included_task_ids));
        fields.insert(
            "included_review_decision_ids".to_owned(),
            json!(included_review_decision_ids),
        );
        fields.insert(
            "included_acceptance_ids".to_owned(),
            json!(included_acceptance_ids),
        );
        fields.insert("included_task_count".to_owned(), json!(rows.tasks.len()));
        fields.insert(
            "included_evidence_count".to_owned(),
            json!(rows.evidence_drafts.len()),
        );
        fields.insert("included_historical_claim_count".to_owned(), json!(0));
        fields.insert(
            "included_review_decision_count".to_owned(),
            json!(rows.review_decisions.len()),
        );
        fields.insert(
            "evidence_version_hashes".to_owned(),
            json!(evidence_version_hashes),
        );
        fields.insert(
            "review_snapshot_hashes".to_owned(),
            json!(review_snapshot_hashes),
        );
        fields.insert("files".to_owned(), Value::Array(files_field));
        fields
    }

    fn seal_manifest(mut fields: Map<String, Value>) -> Value {
        fields.remove("manifest_hash");
        let hash = canonical::object_hash(&Value::Object(fields.clone())).expect("hash manifest");
        fields.insert("manifest_hash".to_owned(), json!(hash));
        Value::Object(fields)
    }

    fn build_bundle(rows: &BundleRows) -> (Value, BTreeMap<String, Vec<u8>>) {
        let (files_field, disk) = default_files_field_and_disk(rows, &DEFAULT_ORDER);
        let fields = manifest_fields(rows, files_field);
        (seal_manifest(fields), disk)
    }

    fn write_bundle(dir: &Path, manifest: &Value, disk: &BTreeMap<String, Vec<u8>>) {
        for (filename, bytes) in disk {
            fs::write(dir.join(filename), bytes).expect("write bundle file");
        }
        let manifest_text =
            serde_json::to_string_pretty(manifest).expect("serialise manifest") + "\n";
        fs::write(dir.join("export_manifest.json"), manifest_text).expect("write manifest");
    }

    #[test]
    fn a_well_formed_bundle_verifies() {
        let dir = unique_temp_dir("valid");
        let rows = valid_rows();
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);
        let report = verify_bundle(&dir).expect("verify");
        assert!(
            report.valid,
            "expected valid, got errors: {:?}",
            report.errors
        );
        assert!(
            report
                .notes
                .iter()
                .any(|note| note.contains("not recomputed")),
            "expected the snapshot-not-recomputed note"
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_tampered_byte_is_detected() {
        let dir = unique_temp_dir("tampered-byte");
        let rows = valid_rows();
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);
        let path = dir.join("tasks.jsonl");
        let mut bytes = fs::read(&path).expect("read");
        bytes[0] ^= 0xFF;
        fs::write(&path, &bytes).expect("write");

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(
            report
                .errors
                .iter()
                .any(|error| error.file.as_deref() == Some("tasks.jsonl")
                    && error.message.contains("sha256"))
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_wrong_byte_length_is_detected() {
        let dir = unique_temp_dir("wrong-length");
        let rows = valid_rows();
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);
        let path = dir.join("review_decisions.jsonl");
        let mut bytes = fs::read(&path).expect("read");
        bytes.push(b'\n');
        fs::write(&path, &bytes).expect("write");

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(report.errors.iter().any(|error| error.file.as_deref()
            == Some("review_decisions.jsonl")
            && error.message.contains("byte_length")));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_missing_listed_file_is_detected() {
        let dir = unique_temp_dir("missing-file");
        let rows = valid_rows();
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);
        fs::remove_file(dir.join("evidence_drafts.jsonl")).expect("remove");

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(report.errors.iter().any(|error| error.file.as_deref()
            == Some("evidence_drafts.jsonl")
            && error.message.contains("missing from the directory")));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_extra_unlisted_file_is_detected() {
        let dir = unique_temp_dir("extra-file");
        let rows = valid_rows();
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);
        fs::write(dir.join("stray.txt"), b"not part of the bundle").expect("write");

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(
            report
                .errors
                .iter()
                .any(|error| error.file.as_deref() == Some("stray.txt")
                    && error.message.contains("not listed"))
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_unsorted_files_array_is_detected() {
        let dir = unique_temp_dir("unsorted");
        let rows = valid_rows();
        let order = [
            "tasks.jsonl",
            "evidence_drafts.jsonl",
            "evidence_versions.jsonl",
            "review_decisions.jsonl",
            "review_snapshots.jsonl",
            "task_acceptances.jsonl",
        ];
        let (files_field, disk) = default_files_field_and_disk(&rows, &order);
        let fields = manifest_fields(&rows, files_field);
        let manifest = seal_manifest(fields);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(
            report
                .errors
                .iter()
                .any(|error| error.check == "files" && error.message.contains("not sorted"))
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_wrong_record_count_is_detected() {
        let dir = unique_temp_dir("wrong-record-count");
        let rows = valid_rows();
        let (mut files_field, disk) = default_files_field_and_disk(&rows, &DEFAULT_ORDER);
        for entry in files_field.iter_mut() {
            if entry["filename"] == "tasks.jsonl" {
                let current = entry["record_count"].as_i64().expect("record_count");
                entry["record_count"] = json!(current + 1);
            }
        }
        let fields = manifest_fields(&rows, files_field);
        let manifest = seal_manifest(fields);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(
            report
                .errors
                .iter()
                .any(|error| error.check == "record_count"
                    && error.file.as_deref() == Some("tasks.jsonl"))
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_membership_gap_is_detected() {
        let dir = unique_temp_dir("membership-gap");
        let mut rows = valid_rows();
        rows.evidence_drafts[0]["task_id"] = json!("task-does-not-exist");
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(report.errors.iter().any(|error| error.check == "membership"
            && error.file.as_deref() == Some("evidence_drafts.jsonl")));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_moved_pin_is_detected() {
        let dir = unique_temp_dir("moved-pin");
        let mut rows = valid_rows();
        // the draft was resubmitted after acceptance pinned an earlier version
        rows.evidence_drafts[0]["evidence_version_hash"] =
            json!(format!("sha256:{}", "b".repeat(64)));
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(
            report.errors.iter().any(
                |error| error.check == "pins" && error.message.contains("does not match draft")
            )
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_missing_envelope_is_detected() {
        let dir = unique_temp_dir("missing-envelope");
        let mut rows = valid_rows();
        let fake_hash = format!("sha256:{}", "c".repeat(64));
        rows.review_decisions[0]["evidence_version_hash"] = json!(fake_hash);
        rows.evidence_drafts[0]["evidence_version_hash"] = json!(fake_hash);
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(
            report.errors.iter().any(|error| error.check == "pins"
                && error.message.contains("no envelope's object_hash"))
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_row_object_hash_disagreeing_with_its_envelope_json_is_detected() {
        let dir = unique_temp_dir("envelope-row-mismatch");
        let mut rows = valid_rows();
        // the row claims a different object_hash than its wrapped envelope
        // actually verifies to; the draft and decision still pin the real
        // (envelope_json) hash, so only the row/envelope disagreement (and
        // the consequent evidence_version_hashes set mismatch) should fire.
        rows.evidence_versions[0]["object_hash"] = json!(format!("sha256:{}", "d".repeat(64)));
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(report.errors.iter().any(|error| {
            error.check == "pins"
                && error.file.as_deref() == Some("evidence_versions.jsonl")
                && error
                    .message
                    .contains("does not match its envelope_json's object_hash")
        }));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_missing_snapshot_is_detected() {
        let dir = unique_temp_dir("missing-snapshot");
        let mut rows = valid_rows();
        rows.review_decisions[0]["review_snapshot_hash"] = json!("snapshot-hash-does-not-exist");
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(report.errors.iter().any(|error| error.check == "pins"
            && error.file.as_deref() == Some("review_snapshots.jsonl")
            && error.message.contains("not present")));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_hash_set_mismatch_is_detected() {
        let dir = unique_temp_dir("hash-set-mismatch");
        let rows = valid_rows();
        let (files_field, disk) = default_files_field_and_disk(&rows, &DEFAULT_ORDER);
        let mut fields = manifest_fields(&rows, files_field);
        fields.insert("evidence_version_hashes".to_owned(), json!([]));
        let manifest = seal_manifest(fields);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(report.errors.iter().any(
            |error| error.check == "pins" && error.message.contains("evidence_version_hashes")
        ));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_draft_preview_is_refused() {
        let dir = unique_temp_dir("draft-preview");
        let rows = valid_rows();
        let (files_field, disk) = default_files_field_and_disk(&rows, &DEFAULT_ORDER);
        let mut fields = manifest_fields(&rows, files_field);
        fields.remove("frozen_at");
        fields.remove("manifest_hash");
        let manifest = Value::Object(fields);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(
            report
                .errors
                .iter()
                .any(|error| error.message.contains("draft preview"))
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_accepted_decision_with_a_wrong_task_status_is_detected() {
        let dir = unique_temp_dir("wrong-task-status");
        let mut rows = valid_rows();
        rows.tasks[0]["status"] = json!("needs_review");
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(report.errors.iter().any(
            |error| error.check == "acceptance" && error.file.as_deref() == Some("tasks.jsonl")
        ));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_superseded_earlier_acceptance_does_not_block_verification() {
        // one task acquired three acceptance rows over time: an earlier
        // `accepted` one against a draft that has since been superseded, a
        // later `returned` one that sent the task back to review, and a
        // newer `accepted` one against the current, still accepted_for_export
        // draft. only the newest accepted row carries export authority, so
        // the earlier accepted row's now-superseded draft must not fail
        // verification.
        let dir = unique_temp_dir("superseded-acceptance");
        let envelope = evidence_version_envelope("evidence:test-task-1:2");
        let object_hash = envelope
            .get("object_hash")
            .and_then(Value::as_str)
            .expect("object_hash")
            .to_owned();
        let rows = BundleRows {
            tasks: vec![json!({"task_id": "task-1", "status": "pi_accepted"})],
            review_decisions: vec![
                json!({
                    "review_decision_id": "decision-old",
                    "task_id": "task-1",
                    "evidence_draft_id": "draft-old",
                    "decision_status": "accepted_for_export",
                }),
                json!({
                    "review_decision_id": "decision-new",
                    "task_id": "task-1",
                    "evidence_draft_id": "draft-new",
                    "decision_status": "accepted_for_export",
                    "evidence_version_hash": object_hash,
                    "review_snapshot_hash": "snapshot-hash-1",
                }),
            ],
            task_acceptances: vec![
                json!({
                    "acceptance_id": "acceptance-1",
                    "task_id": "task-1",
                    "review_decision_id": "decision-old",
                    "outcome": "accepted",
                    "created_at": 100,
                }),
                json!({
                    "acceptance_id": "acceptance-2",
                    "task_id": "task-1",
                    "review_decision_id": "decision-old",
                    "outcome": "returned",
                    "created_at": 200,
                }),
                json!({
                    "acceptance_id": "acceptance-3",
                    "task_id": "task-1",
                    "review_decision_id": "decision-new",
                    "outcome": "accepted",
                    "created_at": 300,
                }),
            ],
            evidence_drafts: vec![
                json!({
                    "evidence_draft_id": "draft-old",
                    "task_id": "task-1",
                    "draft_status": "superseded",
                }),
                json!({
                    "evidence_draft_id": "draft-new",
                    "task_id": "task-1",
                    "draft_status": "accepted_for_export",
                    "evidence_version_hash": object_hash,
                }),
            ],
            evidence_versions: vec![evidence_version_row(&envelope)],
            review_snapshots: vec![json!({
                "snapshot_hash": "snapshot-hash-1",
                "snapshot_json": "{}",
            })],
        };
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(
            report.valid,
            "expected valid, got errors: {:?}",
            report.errors
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_task_with_no_accepted_acceptance_is_detected() {
        let dir = unique_temp_dir("no-accepted-acceptance");
        let mut rows = valid_rows();
        rows.task_acceptances[0]["outcome"] = json!("returned");
        let (manifest, disk) = build_bundle(&rows);
        write_bundle(&dir, &manifest, &disk);

        let report = verify_bundle(&dir).expect("verify");
        assert!(!report.valid);
        assert!(report.errors.iter().any(|error| error.check == "acceptance"
            && error.file.as_deref() == Some("task_acceptances.jsonl")
            && error.message.contains("has no accepted acceptance")));
        fs::remove_dir_all(&dir).ok();
    }

    /// The committed fixture bundle produced by the TypeScript builder
    /// (schemas/fixtures/pow-export-bundle.v1) must verify cleanly: the two
    /// sides of the contract are checked against the same fixture.
    #[test]
    fn the_committed_typescript_fixture_bundle_verifies() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../schemas/fixtures/pow-export-bundle.v1");
        let report = verify_bundle(&dir).expect("verify");
        assert!(
            report.valid,
            "expected the committed fixture bundle to verify, got errors: {:#?}",
            report.errors
        );
    }

    /// The supported curator path end to end: the fixture folded back into
    /// the shape `exports:getExportBundle` returns, written out by
    /// scripts/materialise_convex_export.py, then verified here. Review of
    /// PR #112 (2026-09-12) found the materialiser dropping a declared file,
    /// which only this path catches.
    #[test]
    fn a_bundle_materialised_by_the_python_script_verifies() {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let fixture = repo.join("schemas/fixtures/pow-export-bundle.v1");
        let manifest_text =
            fs::read_to_string(fixture.join("export_manifest.json")).expect("read manifest");
        let manifest: Value = serde_json::from_str(&manifest_text).expect("parse manifest");

        // one `files.<key>` string per declared file, key = filename with
        // dots as underscores (convex/exports.ts FILE_KEYS), manifest verbatim
        let mut files = Map::new();
        files.insert("export_manifest_json".to_owned(), Value::String(manifest_text));
        for entry in manifest["files"].as_array().expect("files[]") {
            let filename = entry["filename"].as_str().expect("filename");
            let text = fs::read_to_string(fixture.join(filename)).expect("read fixture file");
            files.insert(filename.replace('.', "_"), Value::String(text));
        }
        let bundle = json!({ "export_manifest": manifest, "files": files });

        let dir = unique_temp_dir("materialised");
        let bundle_path = dir.join("bundle.json");
        fs::write(&bundle_path, serde_json::to_vec(&bundle).expect("encode bundle"))
            .expect("write bundle");
        let out = dir.join("out");
        let status = std::process::Command::new("python3")
            .arg(repo.join("scripts/materialise_convex_export.py"))
            .arg(&bundle_path)
            .arg("--output-dir")
            .arg(&out)
            .stdout(std::process::Stdio::null())
            .status()
            .expect("python3 must be on PATH to run the materialiser");
        assert!(status.success(), "materialiser exited with {status}");

        let report = verify_bundle(&out).expect("verify");
        assert!(
            report.valid,
            "expected the materialised bundle to verify, got errors: {:#?}",
            report.errors
        );
        fs::remove_dir_all(&dir).ok();
    }
}
