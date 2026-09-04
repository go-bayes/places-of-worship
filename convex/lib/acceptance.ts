// the pi acceptance layer, pure rules (jb rulings r-p1..r-p5, 2026-09-04):
// a reviewer's accepted-for-export decision is a recommendation; only a
// principal investigator (role `pi`) accepts a case into the backend. the
// mutation in ../acceptances.ts applies these rules; the export reads the
// acceptance, not the decision.

export type AcceptanceOutcome = "accepted" | "returned";

export const ACCEPTANCE_NOTE_MIN = 8;

// the task status a pi acceptance produces (r-p5: a return goes back to
// the reviewers, not to the ra)
export function taskStatusForAcceptance(outcome: AcceptanceOutcome): "pi_accepted" | "needs_review" {
  return outcome === "accepted" ? "pi_accepted" : "needs_review";
}

export function eventTypeForAcceptance(outcome: AcceptanceOutcome): "pi_accepted" | "pi_returned" {
  return outcome === "accepted" ? "pi_accepted" : "pi_returned";
}

type Ruleable = {
  userRoles: readonly string[];
  userId: string;
  taskStatus: string;
  // the current accepted-for-export decision on the task, if any
  decision: { decision_status: string; reviewer_user_id: string } | null;
  // the draft the decision ratified, if any
  draftAuthorId?: string;
  note: string | undefined;
};

// null when the acceptance may proceed, else the reason it may not
export function acceptanceRefusal(input: Ruleable): string | null {
  if (!input.userRoles.includes("pi")) {
    return "Only a principal investigator may accept a case into the backend.";
  }
  if (input.taskStatus !== "reviewed") {
    return "Only a task a reviewer has accepted (status reviewed, awaiting PI acceptance) can be accepted or returned.";
  }
  if (input.decision === null || input.decision.decision_status !== "accepted_for_export") {
    return "The task has no current accepted-for-export decision to ratify.";
  }
  if (input.draftAuthorId !== undefined && input.draftAuthorId === input.userId) {
    return "You submitted this evidence; another principal investigator must accept it.";
  }
  if ((input.note ?? "").trim().length < ACCEPTANCE_NOTE_MIN) {
    return `PI acceptance needs a short note (at least ${ACCEPTANCE_NOTE_MIN} characters).`;
  }
  return null;
}

// r-p1: a pi may ratify a decision they recorded themselves; the row says so
export function isSelfDecided(input: { decision: { reviewer_user_id: string } | null; userId: string }): boolean {
  return input.decision !== null && input.decision.reviewer_user_id === input.userId;
}

// the export takes only pi-accepted tasks (and, for continuity, tasks the
// batch already exported); anything else named explicitly is refused
export function exportRefusalForTask(taskId: string, taskStatus: string | undefined): string | null {
  if (taskStatus === undefined) return `Task not found: ${taskId}`;
  if (taskStatus !== "pi_accepted") {
    return `Task ${taskId} is ${taskStatus.replaceAll("_", " ")}; only tasks a principal investigator has accepted enter an export batch.`;
  }
  return null;
}
