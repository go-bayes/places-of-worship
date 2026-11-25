import { assertRapidDerivedConsistency } from "./rapidEntry.ts";
import {
  assertConfirmedDates,
  assertHistoricalDate,
  assertSourceDate,
  isCaptureSource,
  isValidObservationDate,
  type ConfirmedDate,
} from "./partialDates.ts";
export const SHORT_TEXT_MAX = 256;
export const MEDIUM_TEXT_MAX = 2_048;
export const LONG_TEXT_MAX = 8_000;
export const URL_OR_FILE_MAX = 4_096;
export const GENERATED_ROW_MAX = 128_000;
export const VALIDATION_SUMMARY_MAX = 16_000;
export const CLIENT_CONTEXT_MAX = 16_000;
export const TASK_REASON_MAX = 2_048;
export const TASK_BRIEF_MAX = 4_000;
export const TASK_NAME_MAX = 512;
export const GUIDED_DIRECT_OBSERVATION_MAX = 2_000;
export const GUIDED_INTERPRETATION_MAX = 1_000;
export const GUIDED_UNCERTAINTY_MAX = 2_000;
export const PENDING_OCCUPANCY_CARD_MAX = 20;

type EvidenceDraftLimitInput = {
  observation_contract_version?: string;
  source_type?: string;
  provider?: string;
  source_title?: string;
  source_url_or_file?: string;
  source_date_or_capture_date?: string;
  address_raw?: string;
  locality_raw?: string;
  address_change_note?: string;
  source_notes?: string;
  action?: string;
  change_class?: string;
  target_year_statuses?: unknown;
  target_year_confidence?: unknown;
  target_year_evidence?: unknown;
  existence_status?: string;
  worship_use_status?: string;
  assessment_confidence?: string;
  match_confidence?: string;
  geocoding_confidence?: string;
  lifecycle_event?: string;
  lifecycle_date?: string;
  lifecycle_date_precision?: string;
  lifecycle_note?: string;
  related_ids_or_note?: string;
  denomination_or_tradition_raw?: string;
  denomination_label_basis?: string;
  denomination_relation?: string;
  evidence_note?: string;
  interpretation_note?: string;
  uncertainty_note?: string;
  current_observation_status?: string;
  current_observation_basis?: string;
  generated_wide_row?: unknown;
  validation_summary?: unknown;
  target_year_entry_reason?: string;
  pending_occupancy_cards?: unknown;
  confirmed_dates?: ConfirmedDate[];
};

export function assertMaxString(label: string, value: string | undefined, maxLength: number): void {
  if (value !== undefined && value.length > maxLength) {
    throw new Error(`${label} is too long; limit is ${maxLength} characters.`);
  }
}

export function assertMaxJson(label: string, value: unknown, maxLength: number): void {
  if (value === undefined) {
    return;
  }
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new Error(`${label} must be JSON-serialisable.`);
  }
  if (encoded.length > maxLength) {
    throw new Error(`${label} is too large; limit is ${maxLength} characters when encoded.`);
  }
}

export function assertClientContextLimit(value: unknown): void {
  assertMaxJson("client context", value, CLIENT_CONTEXT_MAX);
}

export function assertTaskReasonLimit(label: string, value: string | undefined): void {
  assertMaxString(label, value, TASK_REASON_MAX);
}

export function assertEvidenceDraftLimits(draft: EvidenceDraftLimitInput): void {
  assertMaxString("observation contract version", draft.observation_contract_version, SHORT_TEXT_MAX);
  assertMaxString("source type", draft.source_type, SHORT_TEXT_MAX);
  assertMaxString("provider", draft.provider, SHORT_TEXT_MAX);
  assertMaxString("source title", draft.source_title, MEDIUM_TEXT_MAX);
  assertMaxString("source URL or file", draft.source_url_or_file, URL_OR_FILE_MAX);
  assertMaxString("source date or capture date", draft.source_date_or_capture_date, SHORT_TEXT_MAX);
  assertMaxString("address", draft.address_raw, MEDIUM_TEXT_MAX);
  assertMaxString("locality", draft.locality_raw, MEDIUM_TEXT_MAX);
  assertMaxString("address change note", draft.address_change_note, LONG_TEXT_MAX);
  assertMaxString("source notes", draft.source_notes, LONG_TEXT_MAX);
  assertMaxString("action", draft.action, SHORT_TEXT_MAX);
  assertMaxString("existence status", draft.existence_status, SHORT_TEXT_MAX);
  assertMaxString("worship-use status", draft.worship_use_status, SHORT_TEXT_MAX);
  assertMaxString("assessment confidence", draft.assessment_confidence, SHORT_TEXT_MAX);
  assertMaxString("match confidence", draft.match_confidence, SHORT_TEXT_MAX);
  assertMaxString("geocoding confidence", draft.geocoding_confidence, SHORT_TEXT_MAX);
  assertMaxString("lifecycle event", draft.lifecycle_event, SHORT_TEXT_MAX);
  assertMaxString("lifecycle date", draft.lifecycle_date, SHORT_TEXT_MAX);
  assertMaxString("lifecycle date precision", draft.lifecycle_date_precision, SHORT_TEXT_MAX);
  assertMaxString("lifecycle note", draft.lifecycle_note, LONG_TEXT_MAX);
  assertMaxString("related ids or note", draft.related_ids_or_note, LONG_TEXT_MAX);
  assertMaxString("denomination or tradition raw label", draft.denomination_or_tradition_raw, MEDIUM_TEXT_MAX);
  assertMaxString("denomination label basis", draft.denomination_label_basis, SHORT_TEXT_MAX);
  assertMaxString("denomination relation", draft.denomination_relation, SHORT_TEXT_MAX);
  assertMaxString("evidence note", draft.evidence_note, LONG_TEXT_MAX);
  assertMaxString("interpretation note", draft.interpretation_note, LONG_TEXT_MAX);
  assertMaxString("uncertainty note", draft.uncertainty_note, LONG_TEXT_MAX);
  assertMaxString("current observation status", draft.current_observation_status, SHORT_TEXT_MAX);
  assertMaxString("current observation basis", draft.current_observation_basis, SHORT_TEXT_MAX);
  assertMaxJson("target-year statuses", draft.target_year_statuses, VALIDATION_SUMMARY_MAX);
  assertMaxJson("target-year confidence", draft.target_year_confidence, VALIDATION_SUMMARY_MAX);
  assertMaxJson("target-year evidence", draft.target_year_evidence, VALIDATION_SUMMARY_MAX);
  assertMaxJson("generated wide row", draft.generated_wide_row, GENERATED_ROW_MAX);
  assertMaxJson("validation summary", draft.validation_summary, VALIDATION_SUMMARY_MAX);
  assertMaxString("target-year entry reason", draft.target_year_entry_reason, MEDIUM_TEXT_MAX);
  assertMaxJson("pending occupancy cards", draft.pending_occupancy_cards, VALIDATION_SUMMARY_MAX);
  assertMaxJson("confirmed dates", draft.confirmed_dates, VALIDATION_SUMMARY_MAX);
  if (Array.isArray(draft.pending_occupancy_cards) && draft.pending_occupancy_cards.length > PENDING_OCCUPANCY_CARD_MAX) {
    throw new Error(`A draft may hold at most ${PENDING_OCCUPANCY_CARD_MAX} pending occupancy cards.`);
  }
}

export function assertRapidCurrentObservation(draft: EvidenceDraftLimitInput): void {
  assertRapidDerivedConsistency(draft);
  const status = draft.current_observation_status;
  const basis = draft.current_observation_basis;
  const observedOn = draft.source_date_or_capture_date?.trim() ?? "";
  const directObservation = draft.evidence_note?.trim() ?? "";
  const uncertainty = draft.uncertainty_note?.trim() ?? "";

  if (!status || !basis) {
    throw new Error("Choose what you can confirm and how you know it.");
  }
  // ruling 3: an observation date keeps 1000 to 2100, with no confirmation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn) || !isValidObservationDate(observedOn)) {
    throw new Error("A rapid current observation requires a valid YYYY-MM-DD observation date.");
  }
  if (Date.parse(`${observedOn}T00:00:00Z`) > Date.now() + 36 * 60 * 60 * 1_000) {
    throw new Error("A rapid current observation cannot use a future observation date.");
  }
  if (basis === "named_public_source" && !draft.source_title?.trim()) {
    throw new Error("A named public source requires its title.");
  }
  if (basis === "named_public_source" && !draft.source_url_or_file?.trim()) {
    throw new Error("A named public source requires its URL or agreed file reference.");
  }
  if (basis === "local_investigator_account" && directObservation.length < 5) {
    throw new Error("A local investigator account requires a short direct observation.");
  }
  // denomination wording with unknown provenance is recorded as unknown
  // rather than rejected (jb 2026-09-01: the label is genuinely optional)
  if (status === "could_not_determine" && uncertainty.length < 12) {
    throw new Error("Explain what remains uncertain before submitting this observation.");
  }
  const assessedHistoricalYears = Object.entries(
    (draft.target_year_statuses as Record<string, unknown> | undefined) ?? {},
  )
    .filter(([, value]) => value !== "not_assessed")
    .map(([year]) => year);
  if (assessedHistoricalYears.length > 0) {
    throw new Error("Rapid current observations cannot assess historical target years.");
  }
}

// the date fields of an evidence record, each keyed by its field and the
// purpose of its date (deep-time stage 1, rulings 3 to 7). the source date is
// an observation date for a capture (a field observation, street or aerial
// imagery, a rapid observation) and for a record with no source type, and a
// documentary date for every other source type. an unversioned spreadsheet
// record may carry a full capture timestamp, read by its day; anything else
// after the day is kept whole, so it fails the date check. confirmation
// matching and the date rules read the same values
const LEGACY_CAPTURE_TIMESTAMP = /^([0-9]{4}-[0-9]{2}-[0-9]{2})T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{1,3})?Z$/;
export type EvidenceDateField = { key: "source_date:observation" | "source_date:documentary" | "lifecycle_date"; value: string };

export function evidenceDateFields(draft: EvidenceDraftLimitInput): EvidenceDateField[] {
  const fields: EvidenceDateField[] = [];
  const written = draft.source_date_or_capture_date?.trim() ?? "";
  if (written) {
    const timestamp = draft.observation_contract_version === undefined ? LEGACY_CAPTURE_TIMESTAMP.exec(written) : null;
    const documentary = draft.observation_contract_version !== "rapid_current_v1"
      && typeof draft.source_type === "string" && draft.source_type.trim() !== ""
      && !isCaptureSource(draft.source_type);
    fields.push({ key: documentary ? "source_date:documentary" : "source_date:observation", value: timestamp !== null ? timestamp[1] : written });
  }
  const lifecycle = draft.lifecycle_date?.trim() ?? "";
  if (lifecycle) fields.push({ key: "lifecycle_date", value: lifecycle });
  return fields;
}

// the date fields of an evidence record by name
export type EvidenceDateFieldName = "source_date_or_capture_date" | "lifecycle_date";
export const EVIDENCE_DATE_FIELD_NAMES: readonly EvidenceDateFieldName[] = ["source_date_or_capture_date", "lifecycle_date"];
const FIELD_KEYS: Record<EvidenceDateFieldName, readonly EvidenceDateField["key"][]> = {
  source_date_or_capture_date: ["source_date:observation", "source_date:documentary"],
  lifecycle_date: ["lifecycle_date"],
};

// the checks stage 1 adds, by the purpose of each date and for every contract
// version: an observation date keeps 1000 to 2100 outright; a documentary
// source's own date may fall before 1000 when the record confirms it; the
// lifecycle date is a historical date that meets the country's floor unless
// confirmed. the confirmed-dates list always matches the record's dates;
// the checks themselves run on the fields named
export function assertEvidenceDraftDates(
  draft: EvidenceDraftLimitInput,
  floorYear: number,
  fields: readonly EvidenceDateFieldName[] = EVIDENCE_DATE_FIELD_NAMES,
): void {
  assertConfirmedDates(draft.confirmed_dates, evidenceDateFields(draft).map((field) => field.value));
  assertAddedDateChecks(draft, floorYear, fields);
}

function assertAddedDateChecks(
  draft: EvidenceDraftLimitInput,
  floorYear: number,
  fields: readonly EvidenceDateFieldName[],
): void {
  const keys = new Set(fields.flatMap((name) => FIELD_KEYS[name]));
  for (const field of evidenceDateFields(draft).filter((date) => keys.has(date.key))) {
    if (field.key === "source_date:observation" && !isValidObservationDate(field.value)) {
      throw new Error("Use YYYY, YYYY-MM, or YYYY-MM-DD from 1000 to 2100 for an observation or capture date.");
    }
    if (field.key === "source_date:documentary") {
      assertSourceDate("The source or capture date", field.value, draft.confirmed_dates);
    }
    if (field.key === "lifecycle_date") {
      assertHistoricalDate("The lifecycle date", field.value, floorYear, draft.confirmed_dates);
    }
  }
}

// the guided record's date check before stage 1, kept on every write: a year
// or year-month from 1000 to 2100, or a real full date. a value the stage 1
// checks accept passes too, since stage 1 widens historical dates (ruling 3).
// partialDates.node-test.mjs lets this one function keep its old pattern
function isValidPartialDateBeforeStage1(value: string): boolean {
  if (/^(?:1\d{3}|20\d{2}|2100)$/.test(value)) return true;
  if (/^(?:1\d{3}|20\d{2}|2100)-(?:0[1-9]|1[0-2])$/.test(value)) return true;
  const parts = value.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (!parts) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return parsed.getUTCFullYear() === Number(parts[1])
    && parsed.getUTCMonth() + 1 === Number(parts[2])
    && parsed.getUTCDate() === Number(parts[3]);
}

function assertDateBeforeStage1(
  draft: EvidenceDraftLimitInput,
  field: EvidenceDateFieldName,
  floorYear: number,
  confirmed: ConfirmedDate[] | undefined,
): void {
  const value = draft[field]?.trim() ?? "";
  if (!value || isValidPartialDateBeforeStage1(value)) return;
  // the stage 1 check decides, and its refusal names the reason
  assertAddedDateChecks({ ...draft, confirmed_dates: confirmed }, floorYear, [field]);
}

// a date a save writes may not name the year 0000, which stage 2 reserves;
// an incomplete draft otherwise saves as it stands
export function assertNoYearZero(label: string, value: string | undefined): void {
  if (/^0000(?:-|T|$)/.test(value?.trim() ?? "")) {
    throw new Error(`${label} cannot be in the year 0000; write a year from 0001, with four digits.`);
  }
}

// validate a persisted draft against the versioned scientific submission
// contract. floorYear is the task country's date floor (countryYears.ts),
// which the lifecycle date meets unless the draft confirms it (ruling 5)
// the date rules of a write (deep-time stage 1): every date check made before
// stage 1 applies to the incoming draft on every write, a value stage 1
// accepts also passing it (the ruled widenings); the checks stage 1 adds apply
// to the record the write leaves, for the date fields in written.changed. a
// first submission passes every field; a write to an already-submitted record
// passes only the fields it sets or changes. by default the draft is the
// record and every field is checked
export type WrittenDates = { record?: EvidenceDraftLimitInput; changed?: readonly EvidenceDateFieldName[] };

export function assertEvidenceDraftSubmission(
  draft: EvidenceDraftLimitInput,
  unresolved: boolean,
  floorYear: number,
  written: WrittenDates = {},
): void {
  if (
    draft.observation_contract_version !== undefined
    && !["guided_observation_v1", "rapid_current_v1"].includes(draft.observation_contract_version)
  ) {
    throw new Error("The observation contract version is not supported.");
  }
  const hasGuidedFields = Boolean(draft.denomination_or_tradition_raw?.trim())
    || (draft.denomination_label_basis !== undefined && draft.denomination_label_basis !== "unknown")
    || (draft.denomination_relation !== undefined && draft.denomination_relation !== "uncertain")
    || Boolean(draft.interpretation_note?.trim())
    || Boolean(draft.uncertainty_note?.trim());
  const isRapidCurrent = draft.observation_contract_version === "rapid_current_v1";
  const hasRapidCurrentFields = Boolean(draft.current_observation_status || draft.current_observation_basis);
  if (hasRapidCurrentFields && !isRapidCurrent) {
    throw new Error("Rapid current fields require the rapid current observation contract.");
  }
  if (hasGuidedFields && draft.observation_contract_version !== "guided_observation_v1" && !isRapidCurrent) {
    throw new Error("Guided evidence fields require the guided observation contract.");
  }
  const isGuidedObservation = draft.observation_contract_version === "guided_observation_v1";
  const sourceTitle = draft.source_title?.trim() ?? "";
  const sourceReference = draft.source_url_or_file?.trim() ?? "";
  const directObservation = draft.evidence_note?.trim() ?? "";
  const uncertainty = draft.uncertainty_note?.trim() ?? "";
  const denominationRaw = draft.denomination_or_tradition_raw?.trim() ?? "";
  const sourceDate = draft.source_date_or_capture_date?.trim() ?? "";
  const lifecycleDate = draft.lifecycle_date?.trim() ?? "";
  const lifecyclePrecision = draft.lifecycle_date_precision?.trim() ?? "";

  // confidence annotates an assessed year; it cannot stand alone
  const confidenceYearStatuses = (draft.target_year_statuses as Record<string, unknown> | undefined) ?? {};
  const yearConfidence = (draft.target_year_confidence as Record<string, unknown> | undefined) ?? {};
  for (const year of Object.keys(yearConfidence)) {
    if ((confidenceYearStatuses[year] ?? "not_assessed") === "not_assessed") {
      throw new Error(`Confidence for ${year} requires an assessed status for that year.`);
    }
  }

  if (isRapidCurrent) {
    assertRapidCurrentObservation(draft);
  }

  if (isGuidedObservation && !unresolved && !sourceTitle) {
    throw new Error("Add a source title before submitting for review.");
  }
  if (isGuidedObservation && sourceTitle && /^(?:na|n\/a|not applicable)$/i.test(sourceTitle)) {
    throw new Error("Use the actual source title rather than a placeholder.");
  }
  if (isGuidedObservation && !unresolved && directObservation.length < 5) {
    throw new Error("Add a direct observation before submitting for review.");
  }
  if (isGuidedObservation || isRapidCurrent) {
    assertMaxString("direct observation", draft.evidence_note, GUIDED_DIRECT_OBSERVATION_MAX);
    assertMaxString("interpretation", draft.interpretation_note, GUIDED_INTERPRETATION_MAX);
    assertMaxString("uncertainty or follow-up", draft.uncertainty_note, GUIDED_UNCERTAINTY_MAX);
  }
  if (isGuidedObservation && unresolved && `${directObservation} ${uncertainty}`.trim().length < 12) {
    throw new Error("Explain what was checked or what remains unresolved.");
  }
  if (isGuidedObservation && !unresolved && draft.source_type !== "field_observation" && !sourceReference) {
    throw new Error("Add a source URL or agreed file reference before submitting for review.");
  }
  const record = written.record ?? draft;
  if (isGuidedObservation) assertDateBeforeStage1(draft, "source_date_or_capture_date", floorYear, record.confirmed_dates);
  const hasLifecycleDetail = Boolean(draft.lifecycle_event || lifecycleDate || draft.lifecycle_note?.trim() || lifecyclePrecision);
  if (isGuidedObservation && hasLifecycleDetail && !draft.lifecycle_event) {
    throw new Error("Choose a lifecycle event or remove its date, precision, and note.");
  }
  if (isGuidedObservation && draft.lifecycle_event && !lifecycleDate) {
    throw new Error("A lifecycle event requires a date or bounded date.");
  }
  if (isGuidedObservation) assertDateBeforeStage1(draft, "lifecycle_date", floorYear, record.confirmed_dates);
  assertEvidenceDraftDates(record, floorYear, written.changed ?? EVIDENCE_DATE_FIELD_NAMES);
  if (isGuidedObservation && draft.lifecycle_event && !["day", "month", "year", "bounded", "unknown"].includes(lifecyclePrecision)) {
    throw new Error("A lifecycle event requires a recognised date precision.");
  }
  if (draft.denomination_label_basis && draft.denomination_label_basis !== "unknown" && !denominationRaw) {
    throw new Error("A denomination label basis requires the exact observed or reported label.");
  }
  if (draft.denomination_relation && draft.denomination_relation !== "uncertain" && !denominationRaw) {
    throw new Error("A denomination relation requires the exact observed or reported label.");
  }
  if (isGuidedObservation && draft.action === "denomination_or_shared_use" && !denominationRaw && !uncertainty) {
    throw new Error("Denomination evidence requires an exact label or an uncertainty explanation.");
  }
  if (draft.denomination_relation === "record_correction" && draft.change_class === "genuine_change") {
    throw new Error("A denomination record correction cannot also be classed as a genuine change.");
  }
  if (draft.denomination_relation === "historical_change" && draft.change_class === "map_correction") {
    throw new Error("A possible historical denomination change cannot also be classed as a map correction.");
  }
  if (
    hasGuidedFields
    && ["label_only", "shared_or_concurrent_use", "uncertain"].includes(draft.denomination_relation ?? "uncertain")
    && draft.change_class !== undefined
    && draft.change_class !== "uncertain"
  ) {
    throw new Error("This provisional denomination relation requires an uncertain change class.");
  }
  if (draft.source_type === "field_observation") {
    if (!sourceDate) {
      throw new Error("A field observation requires its observation date.");
    }
    const captureYear = sourceDate.slice(0, 4);
    const statuses = draft.target_year_statuses as Record<string, unknown> | undefined;
    const unsupportedYears = Object.entries(statuses ?? {})
      .filter(([, status]) => status !== "not_assessed")
      .map(([year]) => year)
      .filter((year) => year !== captureYear);
    if (unsupportedYears.length > 0) {
      throw new Error(`A field observation supports its observation year only; mark ${unsupportedYears.join(", ")} not assessed or add a separate historical source.`);
    }
  }
}
