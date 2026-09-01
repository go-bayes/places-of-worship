import { assertRapidDerivedConsistency } from "./rapidEntry.ts";
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
}

export function isValidPartialDate(value: string): boolean {
  if (/^(?:1\d{3}|20\d{2}|2100)$/.test(value)) return true;
  if (/^(?:1\d{3}|20\d{2}|2100)-(?:0[1-9]|1[0-2])$/.test(value)) return true;
  const parts = value.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (!parts) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return parsed.getUTCFullYear() === Number(parts[1])
    && parsed.getUTCMonth() + 1 === Number(parts[2])
    && parsed.getUTCDate() === Number(parts[3]);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn) || !isValidPartialDate(observedOn)) {
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
  if (
    draft.denomination_or_tradition_raw?.trim()
    && (!draft.denomination_label_basis || draft.denomination_label_basis === "unknown")
  ) {
    throw new Error("Choose where the denomination or tradition wording came from.");
  }
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

// validate a persisted draft against the versioned scientific submission contract
export function assertEvidenceDraftSubmission(draft: EvidenceDraftLimitInput, unresolved: boolean): void {
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
  if (isGuidedObservation && sourceDate && !isValidPartialDate(sourceDate)) {
    throw new Error("Use YYYY, YYYY-MM, or YYYY-MM-DD for source and capture dates.");
  }
  const hasLifecycleDetail = Boolean(draft.lifecycle_event || lifecycleDate || draft.lifecycle_note?.trim() || lifecyclePrecision);
  if (isGuidedObservation && hasLifecycleDetail && !draft.lifecycle_event) {
    throw new Error("Choose a lifecycle event or remove its date, precision, and note.");
  }
  if (isGuidedObservation && draft.lifecycle_event && !lifecycleDate) {
    throw new Error("A lifecycle event requires a date or bounded date.");
  }
  if (isGuidedObservation && lifecycleDate && !isValidPartialDate(lifecycleDate)) {
    throw new Error("Use YYYY, YYYY-MM, or YYYY-MM-DD for lifecycle dates.");
  }
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
