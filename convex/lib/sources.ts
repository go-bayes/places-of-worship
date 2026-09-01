import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  MEDIUM_TEXT_MAX,
  SHORT_TEXT_MAX,
  URL_OR_FILE_MAX,
  assertMaxString,
} from "./limits.ts";
import { sha256 } from "./sha256.ts";

// collapses case and runs of whitespace so a retyped title finds the same
// register row
export function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// single home for the source#locator idempotency convention used by batch
// import; portal citations deliberately do not join this keyspace (jb 2026-09-01)
export function sourceClaimKey(title: string, locator: string): string {
  return `${title}#${locator}`;
}

// a register id is derived, not random: the same title key in the same
// country scope always yields the same id, so re-creation is idempotent
export function makeSourceId(titleKey: string, countryCode?: string): string {
  const scope = (countryCode ?? "global").toLowerCase();
  return `src:${scope}:${sha256(`${scope}:${titleKey}`).slice(0, 16)}`;
}

export function assertRealSourceTitle(title: string): void {
  if (!title.trim() || /^n\/?a$/i.test(title.trim())) {
    throw new Error("Every source needs a real title.");
  }
}

export interface SourceRecordInput {
  title: string;
  provider?: string;
  url?: string;
  archive_ref?: string;
  licence?: string;
  publication_date?: string;
  consulted_date?: string;
  access_limits?: string;
  notes?: string;
}

export function assertSourceRecordLimits(record: SourceRecordInput): void {
  assertMaxString("source title", record.title, MEDIUM_TEXT_MAX);
  assertMaxString("provider", record.provider, SHORT_TEXT_MAX);
  assertMaxString("source URL", record.url, URL_OR_FILE_MAX);
  assertMaxString("archive reference", record.archive_ref, MEDIUM_TEXT_MAX);
  assertMaxString("licence", record.licence, SHORT_TEXT_MAX);
  assertMaxString("publication date", record.publication_date, SHORT_TEXT_MAX);
  assertMaxString("consulted date", record.consulted_date, SHORT_TEXT_MAX);
  assertMaxString("access limits", record.access_limits, MEDIUM_TEXT_MAX);
  assertMaxString("notes", record.notes, MEDIUM_TEXT_MAX);
}

// resolves a cited register source; a citation may name only an active row,
// and a locator means nothing without a picked source
export async function resolveCitedSource(
  ctx: QueryCtx | MutationCtx,
  sourceId: string | undefined,
  sourceLocator: string | undefined,
): Promise<Doc<"sources"> | null> {
  if (sourceId === undefined || sourceId.trim() === "") {
    if (sourceLocator !== undefined && sourceLocator.trim() !== "") {
      throw new Error("A source locator needs a picked register source.");
    }
    return null;
  }
  assertMaxString("source id", sourceId, SHORT_TEXT_MAX);
  assertMaxString("source locator", sourceLocator, SHORT_TEXT_MAX);
  const row = await ctx.db
    .query("sources")
    .withIndex("by_source_id", (q) => q.eq("source_id", sourceId))
    .unique();
  if (row === null || row.status !== "active") {
    throw new Error("The cited source is not in the register. Clear the picked source and cite it by title instead.");
  }
  return row;
}
