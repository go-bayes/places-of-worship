// shared intake gate (pi ruling 2026-09-11): once a task has been reviewed,
// pi-accepted, or exported, no route may add or replace evidence content on
// it without an explicit reopen. this stops a save or submission from
// silently flipping a decided task's status by writing onto it.

export const DECIDED_TASK_STATUSES: ReadonlySet<string> = new Set(["reviewed", "pi_accepted", "exported"]);

export function isDecidedTaskStatus(taskStatus: string): taskStatus is "reviewed" | "pi_accepted" | "exported" {
  return DECIDED_TASK_STATUSES.has(taskStatus);
}

// the shortest reason a reopen from a decided status may carry, after
// trimming (jb ruling 2026-10-15)
export const DECIDED_REOPEN_REASON_MIN = 8;

// null when a claim, release, skip or provisional close may proceed against
// this task status, else the refusal those routes throw verbatim: a decided
// task moves only through reopenTask, which records a reason (pi ruling
// 2026-09-11; jb ruling 2026-10-15)
export function sideRouteRefusal(taskStatus: string): string | null {
  if (isDecidedTaskStatus(taskStatus)) {
    return "This task has been reviewed, accepted, or exported. Reopen it with a reason before changing its status.";
  }
  return null;
}

// null when evidence intake may proceed against this task status, else the
// refusal message every gated route throws verbatim
export function evidenceIntakeRefusal(taskStatus: string): string | null {
  if (DECIDED_TASK_STATUSES.has(taskStatus)) {
    return "This task has been reviewed, accepted, or exported. Reopen it before adding or replacing evidence.";
  }
  return null;
}
