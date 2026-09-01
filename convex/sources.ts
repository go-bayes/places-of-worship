import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import { sourceType } from "./model";
import {
  assertRealSourceTitle,
  assertSourceRecordLimits,
  makeSourceId,
  normalizeTitleKey,
} from "./lib/sources";

// jb rulings 2026-09-01: any collaborator may create a source, creation is
// identified, and register rows are visible to all collaborators
const COLLABORATOR_ROLES = ["ra", "reviewer", "curator", "admin", "service"] as const;

const sourceSummary = v.object({
  source_id: v.string(),
  title: v.string(),
  source_type: v.string(),
  country_code: v.optional(v.string()),
  provider: v.optional(v.string()),
  url: v.optional(v.string()),
  archive_ref: v.optional(v.string()),
  licence: v.optional(v.string()),
  publication_date: v.optional(v.string()),
  consulted_date: v.optional(v.string()),
  created_by_initials: v.optional(v.string()),
  created_at: v.number(),
});

async function summariseSource(ctx: QueryCtx, row: Doc<"sources">) {
  const creator = await ctx.db.get(row.created_by);
  return {
    source_id: row.source_id,
    title: row.title,
    source_type: row.source_type,
    country_code: row.country_code,
    provider: row.provider,
    url: row.url,
    archive_ref: row.archive_ref,
    licence: row.licence,
    publication_date: row.publication_date,
    consulted_date: row.consulted_date,
    created_by_initials: creator?.initials,
    created_at: row.created_at,
  };
}

// find-or-create by normalised title within the country scope: a repeat
// creation returns the existing row rather than erroring, and differing
// metadata on a hit is ignored (the picker shows the stored row)
export const createSource = mutation({
  args: {
    countryCode: v.optional(v.string()),
    sourceType,
    title: v.string(),
    provider: v.optional(v.string()),
    url: v.optional(v.string()),
    archiveRef: v.optional(v.string()),
    licence: v.optional(v.string()),
    publicationDate: v.optional(v.string()),
    consultedDate: v.optional(v.string()),
    accessLimits: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    source_id: v.string(),
    title: v.string(),
    existing: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, COLLABORATOR_ROLES);
    const title = args.title.trim();
    assertRealSourceTitle(title);
    if (!args.url?.trim() && !args.archiveRef?.trim()) {
      throw new Error("Every source needs either a URL or an archive reference.");
    }
    assertSourceRecordLimits({
      title,
      provider: args.provider,
      url: args.url,
      archive_ref: args.archiveRef,
      licence: args.licence,
      publication_date: args.publicationDate,
      consulted_date: args.consultedDate,
      access_limits: args.accessLimits,
      notes: args.notes,
    });
    const countryCode = args.countryCode?.trim().toUpperCase() || undefined;
    const titleKey = normalizeTitleKey(title);
    const existing = (
      await ctx.db
        .query("sources")
        .withIndex("by_title_key", (q) => q.eq("title_key", titleKey))
        .collect()
    ).find((row) => row.status === "active" && row.country_code === countryCode);
    if (existing !== undefined) {
      return { source_id: existing.source_id, title: existing.title, existing: true };
    }
    const now = Date.now();
    const sourceId = makeSourceId(titleKey, countryCode);
    await ctx.db.insert("sources", {
      source_id: sourceId,
      country_code: countryCode,
      source_type: args.sourceType,
      title,
      title_key: titleKey,
      provider: args.provider?.trim() || undefined,
      url: args.url?.trim() || undefined,
      archive_ref: args.archiveRef?.trim() || undefined,
      licence: args.licence?.trim() || undefined,
      publication_date: args.publicationDate?.trim() || undefined,
      consulted_date: args.consultedDate?.trim() || undefined,
      access_limits: args.accessLimits?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: "active",
      created_by: user._id,
      created_at: now,
      updated_at: now,
    });
    return { source_id: sourceId, title, existing: false };
  },
});

// typeahead lookup: active rows matching the search, scoped to the given
// country plus global rows
export const searchSources = query({
  args: {
    search: v.string(),
    countryCode: v.optional(v.string()),
  },
  returns: v.array(sourceSummary),
  handler: async (ctx, args) => {
    await requireUser(ctx, COLLABORATOR_ROLES);
    const search = args.search.trim();
    if (search.length < 2) {
      return [];
    }
    const country = args.countryCode?.trim().toUpperCase() || undefined;
    const rows = await ctx.db
      .query("sources")
      .withSearchIndex("search_title", (q) => q.search("title", search).eq("status", "active"))
      .take(20);
    const scoped = rows
      .filter((row) => row.country_code === undefined || country === undefined || row.country_code === country)
      .slice(0, 10);
    return Promise.all(scoped.map((row) => summariseSource(ctx, row)));
  },
});

export const getSource = query({
  args: { sourceId: v.string() },
  returns: v.union(sourceSummary, v.null()),
  handler: async (ctx, args) => {
    await requireUser(ctx, COLLABORATOR_ROLES);
    const row = await ctx.db
      .query("sources")
      .withIndex("by_source_id", (q) => q.eq("source_id", args.sourceId))
      .unique();
    return row === null ? null : summariseSource(ctx, row);
  },
});

// cross-reference view: which entries cite this source. returns identifying
// fields only, not evidence content, so it is safe for every collaborator
export const listDraftsCitingSource = query({
  args: { sourceId: v.string() },
  returns: v.array(
    v.object({
      task_id: v.string(),
      evidence_draft_id: v.string(),
      draft_status: v.string(),
      source_locator: v.optional(v.string()),
      created_at: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx, COLLABORATOR_ROLES);
    const drafts = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_source_id", (q) => q.eq("source_id", args.sourceId))
      .take(100);
    return drafts.map((draft) => ({
      task_id: draft.task_id,
      evidence_draft_id: draft.evidence_draft_id,
      draft_status: draft.draft_status,
      source_locator: draft.source_locator,
      created_at: draft.created_at,
    }));
  },
});
