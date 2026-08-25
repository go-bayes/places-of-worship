type WideExportDraft = {
  action?: string;
  source_type?: string;
  target_year_statuses?: unknown;
};

// decide whether an accepted evidence draft can form a pow event-candidate row
export function isWideEvidenceExportEligible(draft: WideExportDraft): boolean {
  const statuses = draft.target_year_statuses as Record<string, unknown> | undefined;
  return Object.values(statuses ?? {}).some((status) => status !== "not_assessed");
}
