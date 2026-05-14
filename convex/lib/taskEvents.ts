import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ProjectRole } from "./auth";
import { assertClientContextLimit, assertTaskReasonLimit } from "./limits";

export type TaskStatus =
  | "open"
  | "in_progress"
  | "draft_saved"
  | "skipped"
  | "provisionally_closed"
  | "needs_review"
  | "unresolved_note"
  | "changes_requested"
  | "reviewed"
  | "exported"
  | "reopened";

export type TaskEventType =
  | "imported"
  | "opened"
  | "claimed"
  | "unclaimed"
  | "draft_saved"
  | "row_copied"
  | "skipped"
  | "submitted_for_review"
  | "submitted_unresolved_note"
  | "provisionally_closed"
  | "review_started"
  | "review_decided"
  | "changes_requested"
  | "reopened"
  | "exported"
  | "note_added";

export async function appendTaskEvent(
  ctx: MutationCtx,
  args: {
    taskId: string;
    eventType: TaskEventType;
    actorUserId: Id<"users">;
    actorRole: ProjectRole;
    previousStatus?: TaskStatus;
    newStatus?: TaskStatus;
    reason?: string;
    evidenceDraftId?: string;
    reviewDecisionId?: string;
    exportBatchId?: string;
    clientContext?: unknown;
  },
): Promise<void> {
  assertTaskReasonLimit("task event reason", args.reason);
  assertClientContextLimit(args.clientContext);

  const now = Date.now();
  await ctx.db.insert("task_events", {
    event_id: `${args.taskId}:${args.eventType}:${now}:${args.actorUserId}`,
    task_id: args.taskId,
    event_type: args.eventType,
    actor_user_id: args.actorUserId,
    actor_role: args.actorRole,
    occurred_at: now,
    previous_status: args.previousStatus,
    new_status: args.newStatus,
    reason: args.reason,
    evidence_draft_id: args.evidenceDraftId,
    review_decision_id: args.reviewDecisionId,
    export_batch_id: args.exportBatchId,
    client_context: args.clientContext,
  });
}
