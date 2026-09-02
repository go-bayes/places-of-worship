type AssignedTask = {
  country_code: string;
  assigned_to?: unknown;
};

type GuidedDraft = {
  observation_contract_version?: string;
  action?: string;
  source_date_or_capture_date?: string;
  target_year_statuses?: unknown;
  target_year_entry_reason?: string;
  pending_occupancy_cards?: unknown[];
};

function hasAssessedTargetYear(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some(
    (status) => typeof status === "string" && status !== "" && status !== "not_assessed",
  );
}

// Assigned NZ guided submissions use periods as their ordinary temporal
// record. The atomic submission mutation calls this pure guard, while the
// legacy evidence-only mutation fails closed for the governed task class, so
// an old or modified client cannot bypass the rule enforced in the browser.
export function assignedTaskPeriodProblem(
  task: AssignedTask,
  draft: GuidedDraft,
  segmentCount: number,
): string {
  const governed = task.country_code === "NZ"
    && task.assigned_to !== undefined
    && draft.observation_contract_version === "guided_observation_v1";
  if (!governed) return "";
  if ((draft.pending_occupancy_cards?.length ?? 0) > 0 && segmentCount === 0) {
    return "This draft has saved period cards that have not been recorded. Reload the portal and submit the evidence and periods together.";
  }
  const gridAssessed = hasAssessedTargetYear(draft.target_year_statuses);
  if (gridAssessed && !draft.target_year_entry_reason?.trim()) {
    return "Hand-set census-year statuses require a reason, whether or not periods are also submitted.";
  }
  if (segmentCount > 0) {
    return draft.source_date_or_capture_date?.trim()
      ? ""
      : "Add the source or capture date before submitting periods; that evidence date anchors their validation.";
  }
  if (draft.action === "possible_duplicate") return "";
  if (gridAssessed) return "";
  return "Record at least one period before submitting this assigned task. If the periods cannot express the case, set the census-year statuses by hand with a reason, or submit an unresolved note.";
}
