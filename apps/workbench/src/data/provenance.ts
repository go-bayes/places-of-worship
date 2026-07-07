import type { EvidenceDraft } from "./types";

// field-provenance upkeep for agent-assisted drafts, shared by every
// editing path (extraction workspace, My work, source-first) so a human
// edit is marked wherever it happens — the PR #17 review found the
// generic editor path skipping this. one source of truth: the editor
// calls this on each change; confirm paths then pass the maintained map.
export function markHumanEdits(previous: EvidenceDraft, next: EvidenceDraft): EvidenceDraft {
  if (previous.lane !== "agent_assisted_ra") return next;
  const fieldProvenance = { ...next.claimProvenance?.fieldProvenance };
  for (const [field, before, after] of [
    ["attributes.name", previous.attributes?.name, next.attributes?.name],
    ["attributes.religion", previous.attributes?.religion, next.attributes?.religion],
    ["location.locality", previous.location?.locality, next.location?.locality],
    ["location.containingArea", previous.location?.containingArea?.areaName, next.location?.containingArea?.areaName],
    ["evidenceNotes", previous.evidenceNotes, next.evidenceNotes],
  ] as const) {
    if (before === after) continue;
    // a field the human already touched keeps its first human state:
    // human_added must not decay to human_edited on later keystrokes
    const current = fieldProvenance[field];
    if (current === "human_added" || current === "human_edited") continue;
    fieldProvenance[field] = before ? "human_edited" : "human_added";
  }
  return {
    ...next,
    claimProvenance: {
      lane: next.claimProvenance?.lane ?? "agent_assisted_ra",
      origin: next.claimProvenance?.origin ?? "agent_assisted",
      ...next.claimProvenance,
      fieldProvenance,
    },
  };
}
