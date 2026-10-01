import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { taskPlaceRefs } from "./placeRefs";

// the panel and its optional snapshot binding must read exactly the same
// bounded set, including the disposition contents shown to the reviewer.
const LIST_MAX = 200;
const EMBEDDED_DISPOSITIONS_MAX = 10;
export async function judgmentsForTaskPlace(ctx: MutationCtx | QueryCtx, task: Doc<"tasks">) {
  const collected: Doc<"agent_judgments">[] = [];
  for (const ref of taskPlaceRefs(task)) {
    const rows = await ctx.db
      .query("agent_judgments")
      .withIndex("by_subject", (q) => q.eq("subject_ref", ref))
      .order("desc")
      .take(LIST_MAX);
    collected.push(...rows);
  }
  collected.sort((a, b) => b.created_at - a.created_at);
  const capped = collected.slice(0, LIST_MAX);
  const out = [];
  for (const row of capped) {
    const dispositions = await ctx.db
      .query("judgment_dispositions")
      .withIndex("by_judgment", (q) => q.eq("judgment_id", row.judgment_id))
      .order("desc")
      .take(EMBEDDED_DISPOSITIONS_MAX);
    out.push({ ...row, dispositions });
  }
  return out;
}

// judgment_id addresses the immutable canonical envelope. bind only that
// address and the displayed disposition fields, independent of row size.
export function judgmentSnapshotBindings(rows: Awaited<ReturnType<typeof judgmentsForTaskPlace>>) {
  return rows.map((row) => ({
    judgment_id: row.judgment_id,
    created_at: row.created_at,
    dispositions: row.dispositions.map((entry) => ({
      disposition_id: entry.disposition_id,
      reviewer_user_id: entry.reviewer_user_id,
      disposition: entry.disposition,
      ...(entry.note === undefined ? {} : { note: entry.note }),
      created_at: entry.created_at,
    })),
  }));
}
