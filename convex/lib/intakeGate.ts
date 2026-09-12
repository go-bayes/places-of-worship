// shared intake gate (pi ruling 2026-09-11): once a task has been reviewed,
// pi-accepted, or exported, no route may add or replace evidence content on
// it without an explicit reopen. this stops a save or submission from
// silently flipping a decided task's status by writing onto it.

export const DECIDED_TASK_STATUSES = new Set(["reviewed", "pi_accepted", "exported"]);

// null when evidence intake may proceed against this task status, else the
// refusal message every gated route throws verbatim
export function evidenceIntakeRefusal(taskStatus: string): string | null {
  if (DECIDED_TASK_STATUSES.has(taskStatus)) {
    return "This task has been reviewed, accepted, or exported. Reopen it before adding or replacing evidence.";
  }
  return null;
}
