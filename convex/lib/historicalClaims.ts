import {
  LONG_TEXT_MAX,
  MEDIUM_TEXT_MAX,
  URL_OR_FILE_MAX,
  assertMaxString,
} from "./limits.ts";
import { DEFAULT_DATE_FLOOR_YEAR } from "./countryYears.ts";
import { assertConfirmedDates, assertHistoricalDate, isValidHistoricalDate, type ConfirmedDate } from "./partialDates.ts";

export type HistoricalClaimShape = {
  claim_kind: "structure" | "worship_function" | "denomination_or_affiliation" | "leadership" | "shared_use" | "other";
  claim_timing: "event" | "state";
  claim_text: string;
  earliest_supported_date?: string;
  latest_supported_date?: string;
  continues_through_observation: boolean;
  confidence: "high" | "moderate" | "low" | "uncertain";
  confidence_basis: string;
  source_basis: "inscription_or_document_observed" | "local_investigator_account" | "named_public_source" | "other";
  source_title: string;
  source_reference?: string;
  source_account: string;
  uncertainty_note?: string;
  privacy_flag: "clear" | "needs_review" | "restricted";
  confirmed_dates?: ConfirmedDate[];
};

export type HistoricalClaimReference = {
  referenceDate: string;
  referenceDateBasis: "parent_evidence_date" | "claim_recorded_date";
};

// accepts the two versioned evidence contracts that can anchor known history.
export function isHistoricalClaimParentContract(value: string | undefined): boolean {
  return value === "rapid_current_v1" || value === "guided_observation_v1";
}

// uses the parent evidence date when available and otherwise records the claim date.
// a stored parent date has already met its own check, so any real date counts,
// including a documentary source's confirmed date before 1000
export function historicalClaimReferenceDate(
  parentEvidenceDate: string | undefined,
  claimRecordedDate: string,
): HistoricalClaimReference {
  const parentDate = parentEvidenceDate?.trim() ?? "";
  if (parentDate && isValidHistoricalDate(parentDate)) {
    return {
      referenceDate: parentDate,
      referenceDateBasis: "parent_evidence_date",
    };
  }
  return {
    referenceDate: claimRecordedDate,
    referenceDateBasis: "claim_recorded_date",
  };
}

// converts a supported partial date to its earliest possible calendar date.
export function partialDateLower(value: string): string {
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return value;
}

// converts a supported partial date to its latest possible calendar date.
export function partialDateUpper(value: string): string {
  if (/^\d{4}$/.test(value)) return `${value}-12-31`;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${value}-${String(lastDay).padStart(2, "0")}`;
  }
  return value;
}

// validates one provisional claim without deriving dates or scientific states.
export function assertHistoricalClaim(
  claim: HistoricalClaimShape,
  referenceDate: string,
  floorYear: number = DEFAULT_DATE_FLOOR_YEAR,
): void {
  const claimText = claim.claim_text.trim();
  const confidenceBasis = claim.confidence_basis.trim();
  const sourceTitle = claim.source_title.trim();
  const sourceAccount = claim.source_account.trim();
  const sourceReference = claim.source_reference?.trim() ?? "";
  const uncertainty = claim.uncertainty_note?.trim() ?? "";
  const earliest = claim.earliest_supported_date?.trim() ?? "";
  const latest = claim.latest_supported_date?.trim() ?? "";

  assertMaxString("historical claim", claim.claim_text, MEDIUM_TEXT_MAX);
  assertMaxString("confidence basis", claim.confidence_basis, MEDIUM_TEXT_MAX);
  assertMaxString("source title or description", claim.source_title, MEDIUM_TEXT_MAX);
  assertMaxString("source reference", claim.source_reference, URL_OR_FILE_MAX);
  assertMaxString("source wording or account", claim.source_account, LONG_TEXT_MAX);
  assertMaxString("historical uncertainty", claim.uncertainty_note, LONG_TEXT_MAX);

  if (claimText.length < 3) {
    throw new Error("Describe the historical event or state.");
  }
  if (confidenceBasis.length < 5) {
    throw new Error("Briefly explain the confidence category.");
  }
  if (sourceTitle.length < 3) {
    throw new Error("Name or briefly describe the source or informant basis.");
  }
  if (sourceAccount.length < 5) {
    throw new Error("Retain the source wording or a short dictated account.");
  }
  if (claim.source_basis === "named_public_source" && !sourceReference) {
    throw new Error("A named public source requires a URL, archive reference, or agreed file reference.");
  }
  if (claim.continues_through_observation && claim.claim_timing !== "state") {
    throw new Error("Only a historical state can remain open through the evidence reference date.");
  }
  if (claim.continues_through_observation && latest) {
    throw new Error("Leave the latest supported date blank when the state remains open through the evidence reference date.");
  }
  if (!earliest && !latest && uncertainty.length < 12) {
    throw new Error("Add supported date bounds or explain why the dates remain unresolved.");
  }

  assertConfirmedDates(claim.confirmed_dates, [earliest, latest]);
  for (const [label, value] of [["earliest", earliest], ["latest", latest]] as const) {
    if (!value) continue;
    assertHistoricalDate(`The ${label} supported date`, value, floorYear, claim.confirmed_dates);
    if (partialDateLower(value) > partialDateUpper(referenceDate)) {
      throw new Error(`The ${label} supported date cannot be after the evidence reference date.`);
    }
  }
  if (earliest && latest && partialDateLower(earliest) > partialDateUpper(latest)) {
    throw new Error("The earliest supported date cannot be after the latest supported date.");
  }
}
