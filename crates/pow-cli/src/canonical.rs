// the rust half of the cross-language hash contract for content-addressed
// review objects (docs/development/content-addressed-review.md, hash envelope).
// canonical bytes follow rfc 8785 (json canonicalization scheme) over the
// i-json domain, so a hash computed here and one computed by the typescript
// reference in convex/lib/canonicalJson.ts agree byte for byte. both
// implementations are checked against schemas/fixtures/pow-canonical-json.v1.json.

use std::cmp::Ordering;
use std::fmt;
use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use serde::Serialize;
use serde::de::{self, Deserialize, Deserializer, MapAccess, SeqAccess, Visitor};
use serde_json::{Map, Number, Value};

use crate::{ObjectAction, ObjectArgs, ReportFormat, sha256_hex, terminal_safe};

pub const HASH_CONTRACT: &str = "pow-object.v1";
// named here so the rust side declares the same serialisation contract as the
// typescript reference, even though only the fixture check reads it
#[allow(dead_code)]
pub const CANONICAL_JSON_CONTRACT: &str = "pow-canonical-json.v1";
const EVIDENCE_VERSION_TYPE: &str = "evidence_version";
const EVIDENCE_VERSION_SCHEMA: &str = "evidence-version.v1";

// guards the recursive walk against a value assembled in memory; parsed input
// is already bounded by serde_json's own recursion limit
const MAX_DEPTH: usize = 64;

/// The envelope fields a verified content-addressed object carries forward.
#[derive(Clone, Debug, Serialize)]
pub struct VerifiedObject {
    pub object_type: String,
    pub schema_version: String,
    pub logical_id: String,
    pub object_hash: String,
    pub parent_object_hashes: Vec<String>,
}

/// Canonical rfc 8785 text for a value, with every number narrowed to the
/// ieee 754 double the contract hashes over.
pub fn canonical_json(value: &Value) -> std::result::Result<String, String> {
    let normalised = normalise(value, 0, "$")?;
    serde_jcs::to_string(&normalised).map_err(|error| format!("canonicalisation failed: {error}"))
}

/// The contract's object hash: sha-256 over the utf-8 canonical bytes.
pub fn object_hash(value: &Value) -> std::result::Result<String, String> {
    let canonical = canonical_json(value)?;
    Ok(format!("sha256:{}", sha256_hex(canonical.as_bytes())))
}

/// Strict parse for input that is about to be hashed. Duplicate member names,
/// non-finite literals, lone surrogates and trailing data are refused rather
/// than coerced, so a hash never covers a value the other language cannot read.
pub fn parse_canonical_input(bytes: &[u8]) -> std::result::Result<Value, String> {
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let value =
        CanonicalValue::deserialize(&mut deserializer).map_err(|error| error.to_string())?;
    deserializer
        .end()
        .map_err(|error| format!("trailing JSON data: {error}"))?;
    Ok(value.0)
}

/// Check a content-addressed envelope against the hash contract, collecting
/// every failure so a reviewer sees the whole picture in one pass.
pub fn verify_envelope(value: &Value) -> std::result::Result<VerifiedObject, Vec<String>> {
    let Some(envelope) = value.as_object() else {
        return Err(vec!["envelope must be a JSON object".to_owned()]);
    };
    let mut errors = Vec::new();

    match envelope.get("hash_contract") {
        None => errors.push("envelope is missing required member `hash_contract`".to_owned()),
        Some(Value::String(contract)) if contract == HASH_CONTRACT => {}
        Some(other) => errors.push(format!(
            "envelope member `hash_contract` must be {HASH_CONTRACT:?}, found {other}"
        )),
    }

    let object_type = require_string(envelope, "object_type", &mut errors);
    let schema_version = require_string(envelope, "schema_version", &mut errors);
    let logical_id = require_string(envelope, "logical_id", &mut errors);
    let _created_by = require_string(envelope, "created_by", &mut errors);
    let parent_object_hashes = check_parent_object_hashes(envelope, &mut errors);

    if let Some(recorded_at) = require_string(envelope, "recorded_at", &mut errors) {
        check_recorded_at(&recorded_at, &mut errors);
    }

    match envelope.get("payload") {
        None => errors.push("envelope is missing required member `payload`".to_owned()),
        Some(Value::Object(_)) => {}
        Some(_) => errors.push("envelope member `payload` must be an object".to_owned()),
    }

    let declared_hash = require_string(envelope, "object_hash", &mut errors);
    if let Some(declared) = declared_hash.as_deref() {
        check_object_hash(envelope, declared, &mut errors);
    }

    if object_type.as_deref() == Some(EVIDENCE_VERSION_TYPE) {
        check_evidence_version(envelope, schema_version.as_deref(), &mut errors);
    }

    match (object_type, schema_version, logical_id, declared_hash) {
        (Some(object_type), Some(schema_version), Some(logical_id), Some(object_hash))
            if errors.is_empty() =>
        {
            Ok(VerifiedObject {
                object_type,
                schema_version,
                logical_id,
                object_hash,
                parent_object_hashes: parent_object_hashes.unwrap_or_default(),
            })
        }
        _ => {
            if errors.is_empty() {
                errors.push("envelope is missing required members".to_owned());
            }
            Err(errors)
        }
    }
}

// rfc 8785 section 3.2.3 orders object members by utf-16 code units, which
// differs from utf-8 byte order above the basic multilingual plane
fn compare_utf16(left: &str, right: &str) -> Ordering {
    left.encode_utf16().cmp(right.encode_utf16())
}

// every json number the contract hashes is an ieee 754 double, so an integer
// beyond the safe range is rounded here rather than at some later boundary,
// and negative zero collapses to zero
fn normalise(value: &Value, depth: usize, path: &str) -> std::result::Result<Value, String> {
    if depth > MAX_DEPTH {
        return Err(format!("JSON nesting exceeds depth {MAX_DEPTH} at {path}"));
    }
    match value {
        Value::Null | Value::Bool(_) | Value::String(_) => Ok(value.clone()),
        Value::Number(number) => {
            let double = number
                .as_f64()
                .ok_or_else(|| format!("number at {path} is outside the double domain"))?;
            if !double.is_finite() {
                return Err(format!("non-finite number at {path}"));
            }
            let double = if double == 0.0 { 0.0 } else { double };
            let normalised = Number::from_f64(double)
                .ok_or_else(|| format!("number at {path} is outside the double domain"))?;
            Ok(Value::Number(normalised))
        }
        Value::Array(items) => {
            let mut normalised = Vec::with_capacity(items.len());
            for (index, item) in items.iter().enumerate() {
                normalised.push(normalise(item, depth + 1, &format!("{path}[{index}]"))?);
            }
            Ok(Value::Array(normalised))
        }
        Value::Object(members) => {
            let mut normalised = Map::new();
            for (key, item) in members {
                normalised.insert(
                    key.clone(),
                    normalise(item, depth + 1, &format!("{path}.{key}"))?,
                );
            }
            Ok(Value::Object(normalised))
        }
    }
}

fn require_string(
    envelope: &Map<String, Value>,
    key: &str,
    errors: &mut Vec<String>,
) -> Option<String> {
    match envelope.get(key) {
        None => {
            errors.push(format!("envelope is missing required member `{key}`"));
            None
        }
        Some(Value::String(text)) => Some(text.clone()),
        Some(_) => {
            errors.push(format!("envelope member `{key}` must be a string"));
            None
        }
    }
}

fn is_object_hash(value: &str) -> bool {
    let Some(digest) = value.strip_prefix("sha256:") else {
        return false;
    };
    digest.len() == 64
        && digest
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

// parent hashes are a set, not a sequence: the builder sorts them so the same
// parentage always produces the same canonical bytes
fn check_parent_object_hashes(
    envelope: &Map<String, Value>,
    errors: &mut Vec<String>,
) -> Option<Vec<String>> {
    let items = match envelope.get("parent_object_hashes") {
        None => {
            errors.push("envelope is missing required member `parent_object_hashes`".to_owned());
            return None;
        }
        Some(Value::Array(items)) => items,
        Some(_) => {
            errors.push("envelope member `parent_object_hashes` must be an array".to_owned());
            return None;
        }
    };

    let mut hashes = Vec::with_capacity(items.len());
    let mut well_formed = true;
    for (index, item) in items.iter().enumerate() {
        match item {
            Value::String(text) if is_object_hash(text) => hashes.push(text.clone()),
            Value::String(text) => {
                errors.push(format!(
                    "parent_object_hashes[{index}] {text:?} is not a sha256:<64 hex> object hash"
                ));
                well_formed = false;
            }
            _ => {
                errors.push(format!("parent_object_hashes[{index}] must be a string"));
                well_formed = false;
            }
        }
    }
    if !well_formed {
        return None;
    }

    for window in hashes.windows(2) {
        match compare_utf16(&window[0], &window[1]) {
            Ordering::Less => {}
            Ordering::Equal => errors.push(format!(
                "parent_object_hashes contains the duplicate entry {:?}",
                window[0]
            )),
            Ordering::Greater => errors.push(format!(
                "parent_object_hashes is not sorted ascending: {:?} precedes {:?}",
                window[0], window[1]
            )),
        }
    }
    Some(hashes)
}

// rfc 3339 in utc with millisecond precision, so the recorded instant sorts
// lexically and round-trips through both languages unchanged
fn check_recorded_at(value: &str, errors: &mut Vec<String>) {
    let shaped = value.len() == 24
        && value.ends_with('Z')
        && value.as_bytes()[4] == b'-'
        && value.as_bytes()[7] == b'-'
        && value.as_bytes()[10] == b'T'
        && value.as_bytes()[13] == b':'
        && value.as_bytes()[16] == b':'
        && value.as_bytes()[19] == b'.'
        && [0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 20, 21, 22]
            .iter()
            .all(|index| value.as_bytes()[*index].is_ascii_digit());
    if !shaped || chrono::DateTime::parse_from_rfc3339(value).is_err() {
        errors.push(format!(
            "envelope member `recorded_at` must be RFC 3339 UTC with milliseconds \
             (2026-09-11T04:30:00.000Z), found {value:?}"
        ));
    }
}

// the hash covers the envelope with its own hash removed, so the value is
// self-describing without being self-referential
fn check_object_hash(envelope: &Map<String, Value>, declared: &str, errors: &mut Vec<String>) {
    if !is_object_hash(declared) {
        errors.push(format!(
            "envelope member `object_hash` {declared:?} is not a sha256:<64 hex> object hash"
        ));
        return;
    }
    let mut hashed = envelope.clone();
    hashed.remove("object_hash");
    match object_hash(&Value::Object(hashed)) {
        Ok(recomputed) if recomputed == declared => {}
        Ok(recomputed) => errors.push(format!(
            "object_hash {declared:?} does not match the recomputed hash {recomputed:?}"
        )),
        Err(error) => errors.push(format!("object_hash could not be recomputed: {error}")),
    }
}

fn check_evidence_version(
    envelope: &Map<String, Value>,
    schema_version: Option<&str>,
    errors: &mut Vec<String>,
) {
    if let Some(schema_version) = schema_version
        && schema_version != EVIDENCE_VERSION_SCHEMA
    {
        errors.push(format!(
            "object_type {EVIDENCE_VERSION_TYPE:?} requires schema_version \
             {EVIDENCE_VERSION_SCHEMA:?}, found {schema_version:?}"
        ));
    }
    let Some(payload) = envelope.get("payload").and_then(Value::as_object) else {
        return;
    };
    let Some(occupancies) = payload.get("occupancies") else {
        return;
    };
    let Some(items) = occupancies.as_array() else {
        errors.push("payload.occupancies must be an array".to_owned());
        return;
    };

    let mut keys: Vec<(f64, &str)> = Vec::with_capacity(items.len());
    for (index, item) in items.iter().enumerate() {
        let Some(occupancy) = item.as_object() else {
            errors.push(format!("payload.occupancies[{index}] must be an object"));
            return;
        };
        let segment_index = occupancy.get("segment_index").and_then(Value::as_f64);
        let occupancy_id = occupancy.get("occupancy_id").and_then(Value::as_str);
        match (segment_index, occupancy_id) {
            (Some(segment_index), Some(occupancy_id)) => keys.push((segment_index, occupancy_id)),
            (None, _) => {
                errors.push(format!(
                    "payload.occupancies[{index}] requires a numeric `segment_index`"
                ));
                return;
            }
            (_, None) => {
                errors.push(format!(
                    "payload.occupancies[{index}] requires a string `occupancy_id`"
                ));
                return;
            }
        }
    }

    for window in keys.windows(2) {
        let (left_segment, left_id) = window[0];
        let (right_segment, right_id) = window[1];
        if left_id == right_id {
            errors.push(format!(
                "payload.occupancies contains the duplicate occupancy_id {left_id:?}"
            ));
        }
        let ordered = left_segment < right_segment
            || (left_segment == right_segment
                && compare_utf16(left_id, right_id) == Ordering::Less);
        if !ordered && left_id != right_id {
            errors.push(format!(
                "payload.occupancies is not sorted by (segment_index, occupancy_id): \
                 ({left_segment}, {left_id:?}) precedes ({right_segment}, {right_id:?})"
            ));
        }
    }
}

// a json value parsed under the contract's domain rules. duplicate member
// names are refused because a hash must not depend on which copy a parser kept
struct CanonicalValue(Value);

impl<'de> Deserialize<'de> for CanonicalValue {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(CanonicalVisitor)
    }
}

struct CanonicalVisitor;

impl<'de> Visitor<'de> for CanonicalVisitor {
    type Value = CanonicalValue;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON value inside the pow-canonical-json.v1 domain")
    }

    fn visit_bool<E: de::Error>(self, value: bool) -> std::result::Result<Self::Value, E> {
        Ok(CanonicalValue(Value::Bool(value)))
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> std::result::Result<Self::Value, E> {
        Ok(CanonicalValue(Value::Number(value.into())))
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> std::result::Result<Self::Value, E> {
        Ok(CanonicalValue(Value::Number(value.into())))
    }

    fn visit_f64<E: de::Error>(self, value: f64) -> std::result::Result<Self::Value, E> {
        if !value.is_finite() {
            return Err(de::Error::custom("non-finite JSON number is not allowed"));
        }
        let number = Number::from_f64(value)
            .ok_or_else(|| de::Error::custom("JSON number is outside the double domain"))?;
        Ok(CanonicalValue(Value::Number(number)))
    }

    fn visit_str<E: de::Error>(self, value: &str) -> std::result::Result<Self::Value, E> {
        Ok(CanonicalValue(Value::String(value.to_owned())))
    }

    fn visit_string<E: de::Error>(self, value: String) -> std::result::Result<Self::Value, E> {
        Ok(CanonicalValue(Value::String(value)))
    }

    fn visit_none<E: de::Error>(self) -> std::result::Result<Self::Value, E> {
        Ok(CanonicalValue(Value::Null))
    }

    fn visit_unit<E: de::Error>(self) -> std::result::Result<Self::Value, E> {
        Ok(CanonicalValue(Value::Null))
    }

    fn visit_seq<A>(self, mut sequence: A) -> std::result::Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut items = Vec::new();
        while let Some(item) = sequence.next_element::<CanonicalValue>()? {
            items.push(item.0);
        }
        Ok(CanonicalValue(Value::Array(items)))
    }

    fn visit_map<A>(self, mut map: A) -> std::result::Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut members = Map::new();
        while let Some(key) = map.next_key::<String>()? {
            if members.contains_key(&key) {
                return Err(de::Error::custom(format!(
                    "duplicate JSON object key {key:?}"
                )));
            }
            let value = map.next_value::<CanonicalValue>()?;
            members.insert(key, value.0);
        }
        Ok(CanonicalValue(Value::Object(members)))
    }
}

#[derive(Serialize)]
struct ObjectHashReport {
    object_hash: String,
    canonical_bytes: usize,
}

#[derive(Serialize)]
struct ObjectVerifyReport {
    valid: bool,
    object_type: Option<String>,
    object_hash: Option<String>,
    errors: Vec<String>,
}

/// `pow object` dispatch. Returns true when the document failed the contract,
/// matching the exit convention of the other subcommands.
pub fn run_object(args: ObjectArgs) -> Result<bool> {
    match args.action {
        ObjectAction::Hash(args) => {
            let value = read_canonical_input(&args.input)?;
            let canonical = canonical_json(&value)
                .map_err(anyhow::Error::msg)
                .with_context(|| format!("canonicalising {}", args.input.display()))?;
            let report = ObjectHashReport {
                object_hash: format!("sha256:{}", sha256_hex(canonical.as_bytes())),
                canonical_bytes: canonical.len(),
            };
            match args.report {
                ReportFormat::Text => println!("{}", report.object_hash),
                ReportFormat::Json => println!("{}", serde_json::to_string(&report)?),
            }
            Ok(false)
        }
        ObjectAction::Verify(args) => {
            let value = read_canonical_input(&args.input)?;
            let report = match verify_envelope(&value) {
                Ok(verified) => ObjectVerifyReport {
                    valid: true,
                    object_type: Some(verified.object_type),
                    object_hash: Some(verified.object_hash),
                    errors: Vec::new(),
                },
                Err(errors) => ObjectVerifyReport {
                    valid: false,
                    object_type: value
                        .get("object_type")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                    object_hash: value
                        .get("object_hash")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                    errors,
                },
            };
            match args.report {
                ReportFormat::Text => print_verify_text(&report),
                ReportFormat::Json => println!("{}", serde_json::to_string(&report)?),
            }
            Ok(!report.valid)
        }
    }
}

fn read_canonical_input(input: &Path) -> Result<Value> {
    let bytes = fs::read(input).with_context(|| format!("reading {}", input.display()))?;
    parse_canonical_input(&bytes)
        .map_err(anyhow::Error::msg)
        .with_context(|| format!("parsing {}", input.display()))
}

fn print_verify_text(report: &ObjectVerifyReport) {
    if report.valid {
        println!(
            "ok {} {}",
            report.object_type.as_deref().unwrap_or("-"),
            report.object_hash.as_deref().unwrap_or("-")
        );
    } else {
        println!("pow object verify: invalid envelope");
        for error in &report.errors {
            println!("- {}", terminal_safe(error));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;

    fn repo_root_path() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
    }

    fn read_fixture(relative_path: &str) -> Value {
        let path = repo_root_path().join(relative_path);
        let bytes = fs::read(&path)
            .unwrap_or_else(|error| panic!("fixture {} is missing: {error}", path.display()));
        serde_json::from_slice(&bytes)
            .unwrap_or_else(|error| panic!("fixture {} is not JSON: {error}", path.display()))
    }

    fn signed(mut envelope: Map<String, Value>) -> Value {
        envelope.remove("object_hash");
        let hash = object_hash(&Value::Object(envelope.clone())).expect("hash");
        envelope.insert("object_hash".to_owned(), Value::String(hash));
        Value::Object(envelope)
    }

    fn evidence_envelope() -> Value {
        signed(
            json!({
                "hash_contract": HASH_CONTRACT,
                "object_type": EVIDENCE_VERSION_TYPE,
                "schema_version": EVIDENCE_VERSION_SCHEMA,
                "logical_id": "evidence:nz-temporal-001:3",
                "parent_object_hashes": [format!("sha256:{}", "0".repeat(64))],
                "created_by": "actor:project-user-id",
                "recorded_at": "2026-09-11T04:30:00.000Z",
                "payload": {
                    "occupancies": [
                        {"segment_index": 0, "occupancy_id": "occ-a"},
                        {"segment_index": 0, "occupancy_id": "occ-b"},
                        {"segment_index": 1, "occupancy_id": "occ-a2"}
                    ]
                }
            })
            .as_object()
            .expect("object")
            .clone(),
        )
    }

    #[test]
    fn shared_canonical_fixtures_hash_identically_in_both_languages() {
        let fixture = read_fixture("schemas/fixtures/pow-canonical-json.v1.json");
        assert_eq!(fixture["contract"], json!(CANONICAL_JSON_CONTRACT));
        assert_eq!(fixture["hash_contract"], json!(HASH_CONTRACT));

        let cases = fixture["cases"].as_array().expect("cases array");
        assert!(!cases.is_empty(), "fixture carries no accepted cases");
        for case in cases {
            let name = case["name"].as_str().expect("case name");
            let json_text = case["json_text"].as_str().expect("case json_text");
            let value = parse_canonical_input(json_text.as_bytes())
                .unwrap_or_else(|error| panic!("case {name}: strict parse failed: {error}"));
            let canonical = canonical_json(&value)
                .unwrap_or_else(|error| panic!("case {name}: canonicalisation failed: {error}"));
            assert_eq!(
                canonical,
                case["canonical"].as_str().expect("case canonical"),
                "case {name}: canonical text"
            );
            assert_eq!(
                object_hash(&value).expect("hash"),
                case["object_hash"].as_str().expect("case object_hash"),
                "case {name}: object hash"
            );
        }

        let rejected = fixture["rejected"].as_array().expect("rejected array");
        assert!(!rejected.is_empty(), "fixture carries no rejected cases");
        for case in rejected {
            let name = case["name"].as_str().expect("case name");
            let json_text = case["json_text"].as_str().expect("case json_text");
            let outcome = parse_canonical_input(json_text.as_bytes())
                .and_then(|value| canonical_json(&value));
            assert!(
                outcome.is_err(),
                "case {name}: expected rejection ({}), got {outcome:?}",
                case["reason"].as_str().unwrap_or("no reason given")
            );
        }

        println!(
            "pow-canonical-json.v1: {} accepted cases and {} rejected cases checked",
            cases.len(),
            rejected.len()
        );
    }

    #[test]
    fn member_order_does_not_change_the_object_hash() {
        let first = parse_canonical_input(br#"{"b":1,"a":{"d":2,"c":3}}"#).expect("parse");
        let second = parse_canonical_input(br#"{"a":{"c":3,"d":2},"b":1}"#).expect("parse");
        assert_eq!(
            object_hash(&first).expect("hash"),
            object_hash(&second).expect("hash")
        );
    }

    #[test]
    fn changing_one_field_changes_the_object_hash() {
        let first = parse_canonical_input(br#"{"latitude":-41.28664}"#).expect("parse");
        let second = parse_canonical_input(br#"{"latitude":-41.28665}"#).expect("parse");
        assert_ne!(
            object_hash(&first).expect("hash"),
            object_hash(&second).expect("hash")
        );
    }

    #[test]
    fn array_order_does_change_the_object_hash() {
        let first = parse_canonical_input(br#"[1,2]"#).expect("parse");
        let second = parse_canonical_input(br#"[2,1]"#).expect("parse");
        assert_ne!(
            object_hash(&first).expect("hash"),
            object_hash(&second).expect("hash")
        );
    }

    #[test]
    fn a_well_formed_evidence_version_envelope_verifies() {
        let envelope = evidence_envelope();
        let verified = verify_envelope(&envelope).expect("verified");
        assert_eq!(verified.object_type, EVIDENCE_VERSION_TYPE);
        assert_eq!(verified.schema_version, EVIDENCE_VERSION_SCHEMA);
        assert_eq!(verified.parent_object_hashes.len(), 1);
        assert_eq!(
            verified.object_hash,
            envelope["object_hash"].as_str().expect("hash")
        );
    }

    #[test]
    fn envelope_failures_are_reported_together() {
        let mut envelope = evidence_envelope().as_object().expect("object").clone();
        envelope.insert("hash_contract".to_owned(), json!("pow-object.v0"));
        envelope.insert("recorded_at".to_owned(), json!("2026-09-11T04:30:00Z"));
        envelope.insert("created_by".to_owned(), json!(7));
        let errors = verify_envelope(&Value::Object(envelope)).expect_err("invalid");
        assert!(errors.len() >= 4, "expected every failure, got {errors:?}");
        assert!(errors.iter().any(|error| error.contains("hash_contract")));
        assert!(errors.iter().any(|error| error.contains("recorded_at")));
        assert!(errors.iter().any(|error| error.contains("created_by")));
        assert!(errors.iter().any(|error| error.contains("object_hash")));
    }

    #[test]
    fn unsorted_parent_hashes_and_occupancies_are_refused() {
        let mut envelope = evidence_envelope().as_object().expect("object").clone();
        envelope.insert(
            "parent_object_hashes".to_owned(),
            json!([
                format!("sha256:{}", "b".repeat(64)),
                format!("sha256:{}", "a".repeat(64))
            ]),
        );
        envelope.insert(
            "payload".to_owned(),
            json!({
                "occupancies": [
                    {"segment_index": 1, "occupancy_id": "occ-b"},
                    {"segment_index": 0, "occupancy_id": "occ-a"}
                ]
            }),
        );
        let errors = verify_envelope(&signed(envelope)).expect_err("invalid");
        assert!(
            errors
                .iter()
                .any(|error| error.contains("not sorted ascending"))
        );
        assert!(errors.iter().any(|error| error.contains("not sorted by")));
    }

    #[test]
    fn duplicate_occupancy_identifiers_are_refused() {
        let mut envelope = evidence_envelope().as_object().expect("object").clone();
        envelope.insert(
            "payload".to_owned(),
            json!({
                "occupancies": [
                    {"segment_index": 0, "occupancy_id": "occ-a"},
                    {"segment_index": 0, "occupancy_id": "occ-a"}
                ]
            }),
        );
        let errors = verify_envelope(&signed(envelope)).expect_err("invalid");
        assert!(
            errors
                .iter()
                .any(|error| error.contains("duplicate occupancy_id"))
        );
    }

    #[test]
    fn shared_evidence_version_fixtures_agree_with_the_verifier() {
        let path = repo_root_path().join("schemas/fixtures/evidence-version.v1.json");
        assert!(
            path.exists(),
            "shared fixture {} has not been published yet; the cross-language \
             evidence-version contract cannot be checked until the coordinator adds it",
            path.display()
        );
        let fixture = read_fixture("schemas/fixtures/evidence-version.v1.json");
        assert_eq!(fixture["contract"], json!(EVIDENCE_VERSION_SCHEMA));
        assert_eq!(fixture["hash_contract"], json!(HASH_CONTRACT));

        let cases = fixture["cases"].as_array().expect("cases array");
        assert!(!cases.is_empty(), "fixture carries no accepted envelopes");
        for case in cases {
            let name = case["name"].as_str().expect("case name");
            let verified = verify_envelope(&case["envelope"])
                .unwrap_or_else(|errors| panic!("case {name}: expected valid, got {errors:?}"));
            assert_eq!(verified.object_type, "evidence_version", "case {name}");
        }

        let tampered = fixture["tampered"].as_array().expect("tampered array");
        assert!(
            !tampered.is_empty(),
            "fixture carries no tampered envelopes"
        );
        for case in tampered {
            let name = case["name"].as_str().expect("case name");
            assert!(
                verify_envelope(&case["envelope"]).is_err(),
                "case {name}: expected rejection ({})",
                case["reason"].as_str().unwrap_or("no reason given")
            );
        }

        println!(
            "evidence-version.v1: {} valid envelopes and {} tampered envelopes checked",
            cases.len(),
            tampered.len()
        );
    }
}
