export type EvidenceSensitivity = { flagged: boolean; basis?: string };

// keep guided denomination claims outside the existing external AI review lane;
// ordinary guided evidence (existence, dates, location) still receives source checks
export function isExternalAiReviewEligible(draft: {
  observation_contract_version?: string;
  action?: string;
  denomination_or_tradition_raw?: string;
}): boolean {
  if (draft.observation_contract_version !== "guided_observation_v1") return true;
  if (draft.action === "denomination_or_shared_use") return false;
  return !draft.denomination_or_tradition_raw?.trim();
}

// classify whether a draft may enter external source-check or model services
export function evidenceSensitivityFor(
  task: { country_code: string },
  draft: { observation_contract_version?: string; privacy_flag: string; generated_wide_row?: unknown },
): EvidenceSensitivity {
  if (draft.privacy_flag !== "clear") {
    return { flagged: true, basis: `Evidence privacy flag is ${draft.privacy_flag}.` };
  }
  const wideRow = draft.generated_wide_row as Record<string, unknown> | undefined;
  const nestedRow = wideRow?.["row"] as Record<string, unknown> | undefined;
  if (wideRow && (
    wideRow["culturally_sensitive"] === true
    || wideRow["culturallySensitive"] === true
    || nestedRow?.["culturally_sensitive"] === true
    || nestedRow?.["culturallySensitive"] === true
  )) {
    return { flagged: true, basis: "Evidence carries an explicit cultural-sensitivity flag." };
  }
  if (task.country_code === "VU") {
    return {
      flagged: true,
      basis: "Vanuatu country default: evidence defers to human cultural judgement until an approved country protocol permits record-level clearance.",
    };
  }
  return { flagged: false };
}
