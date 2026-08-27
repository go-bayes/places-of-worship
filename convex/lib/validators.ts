import { v } from "convex/values";
import schema from "../schema";

// document validators for `returns:` declarations: each spreads the table's
// own schema field validators, so returned-doc shapes cannot drift from
// schema.ts, and adds the _id and _creationTime system fields convex puts on
// every returned doc

export const taskDoc = v.object({
  _id: v.id("tasks"),
  _creationTime: v.number(),
  ...schema.tables.tasks.validator.fields,
});

export const taskEventDoc = v.object({
  _id: v.id("task_events"),
  _creationTime: v.number(),
  ...schema.tables.task_events.validator.fields,
});

export const evidenceDraftDoc = v.object({
  _id: v.id("evidence_drafts"),
  _creationTime: v.number(),
  ...schema.tables.evidence_drafts.validator.fields,
});

export const historicalClaimDoc = v.object({
  _id: v.id("historical_claims"),
  _creationTime: v.number(),
  ...schema.tables.historical_claims.validator.fields,
});

export const reviewDecisionDoc = v.object({
  _id: v.id("review_decisions"),
  _creationTime: v.number(),
  ...schema.tables.review_decisions.validator.fields,
});

export const exportBatchDoc = v.object({
  _id: v.id("export_batches"),
  _creationTime: v.number(),
  ...schema.tables.export_batches.validator.fields,
});
