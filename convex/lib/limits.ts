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

type EvidenceDraftLimitInput = {
  source_type?: string;
  provider?: string;
  source_title?: string;
  source_url_or_file?: string;
  source_date_or_capture_date?: string;
  source_notes?: string;
  action?: string;
  target_year_statuses?: unknown;
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
  evidence_note?: string;
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
  assertMaxString("source type", draft.source_type, SHORT_TEXT_MAX);
  assertMaxString("provider", draft.provider, SHORT_TEXT_MAX);
  assertMaxString("source title", draft.source_title, MEDIUM_TEXT_MAX);
  assertMaxString("source URL or file", draft.source_url_or_file, URL_OR_FILE_MAX);
  assertMaxString("source date or capture date", draft.source_date_or_capture_date, SHORT_TEXT_MAX);
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
  assertMaxString("evidence note", draft.evidence_note, LONG_TEXT_MAX);
  assertMaxJson("target-year statuses", draft.target_year_statuses, VALIDATION_SUMMARY_MAX);
  assertMaxJson("target-year evidence", draft.target_year_evidence, VALIDATION_SUMMARY_MAX);
  assertMaxJson("generated wide row", draft.generated_wide_row, GENERATED_ROW_MAX);
  assertMaxJson("validation summary", draft.validation_summary, VALIDATION_SUMMARY_MAX);
}
