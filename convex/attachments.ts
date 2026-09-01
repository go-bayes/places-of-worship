import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertOwnsOrCanReview, canReview, chooseActorRole, requireUser } from "./lib/auth";
import { presignR2Url, r2ConfigFromEnv } from "./lib/r2Presign";

// photo and document citations on a task's evidence (ruling 2026-08-31):
// review-tier only, bytes in a private r2 bucket, metadata here, access
// minted per request. deliberately outside the evidence-draft contracts so
// the locked rapid_current_v1 surface is untouched.

const CONTRIBUTOR_ROLES = ["ra", "reviewer", "curator", "admin"] as const;

// provisional caps pending JB's types-and-size ruling
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CAPTION_CHARS = 500;
const MAX_ACTIVE_PER_TASK_PER_AUTHOR = 12;
const UPLOAD_URL_SECONDS = 600;
const VIEW_URL_SECONDS = 600;

// convex exposes deployment env vars on process.env; the project tsconfig
// has no node types, so reach it through globalThis
function envRecord(): Record<string, string | undefined> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env ?? {};
}

function requireR2Config() {
  const config = r2ConfigFromEnv(envRecord());
  if (config === null) {
    throw new Error("Attachment storage is not configured on this deployment.");
  }
  return config;
}

// lets the portal hide the whole attachments block on deployments that
// have no bucket wired, instead of failing at upload time
export const attachmentsEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async () => r2ConfigFromEnv(envRecord()) !== null,
});

export const registerPendingAttachment = internalMutation({
  args: {
    taskId: v.string(),
    contentType: v.string(),
    byteSize: v.number(),
    caption: v.optional(v.string()),
  },
  returns: v.object({ attachment_id: v.string(), r2_key: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, CONTRIBUTOR_ROLES);
    const ext = ALLOWED_TYPES[args.contentType];
    if (ext === undefined) {
      throw new Error("Only JPEG, PNG, WebP, and PDF files are accepted.");
    }
    if (!Number.isFinite(args.byteSize) || args.byteSize <= 0 || args.byteSize > MAX_BYTES) {
      throw new Error("Files must be under 10 MB.");
    }
    if ((args.caption ?? "").length > MAX_CAPTION_CHARS) {
      throw new Error(`Captions must be ${MAX_CAPTION_CHARS} characters or fewer.`);
    }
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_task_id", (q) => q.eq("task_id", args.taskId))
      .unique();
    if (task === null) {
      throw new Error("Unknown task.");
    }
    const existing = await ctx.db
      .query("evidence_attachments")
      .withIndex("by_task_status", (q) => q.eq("task_id", args.taskId).eq("status", "uploaded"))
      .collect();
    const mine = existing.filter((row) => row.author_user_id === user._id);
    if (mine.length >= MAX_ACTIVE_PER_TASK_PER_AUTHOR) {
      throw new Error(`At most ${MAX_ACTIVE_PER_TASK_PER_AUTHOR} files per task.`);
    }

    const now = Date.now();
    const attachmentId = `${args.taskId}:att:${crypto.randomUUID()}`;
    const r2Key = `evidence/${args.taskId}/${crypto.randomUUID()}.${ext}`;
    await ctx.db.insert("evidence_attachments", {
      attachment_id: attachmentId,
      task_id: args.taskId,
      author_user_id: user._id,
      author_role: chooseActorRole(user, CONTRIBUTOR_ROLES),
      r2_key: r2Key,
      content_type: args.contentType,
      byte_size: args.byteSize,
      caption: args.caption?.trim() || undefined,
      status: "pending",
      created_at: now,
      updated_at: now,
    });
    return { attachment_id: attachmentId, r2_key: r2Key };
  },
});

// the browser PUTs the bytes straight to r2 with this url, so no file
// content ever transits convex
export const requestAttachmentUpload = action({
  args: {
    taskId: v.string(),
    contentType: v.string(),
    byteSize: v.number(),
    caption: v.optional(v.string()),
  },
  returns: v.object({ attachment_id: v.string(), upload_url: v.string() }),
  handler: async (ctx, args) => {
    const config = requireR2Config();
    const registered: { attachment_id: string; r2_key: string } = await ctx.runMutation(
      internal.attachments.registerPendingAttachment,
      args,
    );
    const uploadUrl = await presignR2Url(config, {
      method: "PUT",
      key: registered.r2_key,
      expiresSeconds: UPLOAD_URL_SECONDS,
    });
    return { attachment_id: registered.attachment_id, upload_url: uploadUrl };
  },
});

async function requireOwnAttachment(
  ctx: Parameters<typeof requireUser>[0],
  attachmentId: string,
  allowReviewer: boolean,
) {
  const user = await requireUser(ctx, CONTRIBUTOR_ROLES);
  const row = await (ctx as { db: any }).db
    .query("evidence_attachments")
    .withIndex("by_attachment_id", (q: any) => q.eq("attachment_id", attachmentId))
    .unique();
  if (row === null || row.status === "removed") {
    throw new Error("Unknown attachment.");
  }
  if (row.author_user_id !== user._id && !(allowReviewer && canReview(user.roles))) {
    throw new Error("Only the uploader can change this attachment.");
  }
  return { user, row };
}

export const confirmAttachmentUpload = mutation({
  args: { attachmentId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { row } = await requireOwnAttachment(ctx, args.attachmentId, false);
    await ctx.db.patch(row._id, { status: "uploaded", updated_at: Date.now() });
    return null;
  },
});

export const setAttachmentCaption = mutation({
  args: { attachmentId: v.string(), caption: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.caption.length > MAX_CAPTION_CHARS) {
      throw new Error(`Captions must be ${MAX_CAPTION_CHARS} characters or fewer.`);
    }
    const { row } = await requireOwnAttachment(ctx, args.attachmentId, false);
    await ctx.db.patch(row._id, { caption: args.caption.trim() || undefined, updated_at: Date.now() });
    return null;
  },
});

// soft removal only: the row and the object stay for audit (deletion
// policy reserved for a later ruling); reviewers may also remove
export const removeAttachment = mutation({
  args: { attachmentId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { row } = await requireOwnAttachment(ctx, args.attachmentId, true);
    await ctx.db.patch(row._id, { status: "removed", updated_at: Date.now() });
    return null;
  },
});

export const listTaskAttachments = query({
  args: { taskId: v.string() },
  returns: v.array(
    v.object({
      attachment_id: v.string(),
      content_type: v.string(),
      byte_size: v.number(),
      caption: v.optional(v.string()),
      created_at: v.number(),
      author_is_me: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, CONTRIBUTOR_ROLES);
    const rows = await ctx.db
      .query("evidence_attachments")
      .withIndex("by_task_status", (q) => q.eq("task_id", args.taskId).eq("status", "uploaded"))
      .collect();
    // ra sees their own citations; review roles see every author's
    const visible = canReview(user.roles) ? rows : rows.filter((row) => row.author_user_id === user._id);
    return visible
      .sort((a, b) => a.created_at - b.created_at)
      .map((row) => ({
        attachment_id: row.attachment_id,
        content_type: row.content_type,
        byte_size: row.byte_size,
        caption: row.caption,
        created_at: row.created_at,
        author_is_me: row.author_user_id === user._id,
      }));
  },
});

export const getAttachmentForView = internalQuery({
  args: { attachmentId: v.string() },
  returns: v.object({ r2_key: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, CONTRIBUTOR_ROLES);
    const row = await ctx.db
      .query("evidence_attachments")
      .withIndex("by_attachment_id", (q) => q.eq("attachment_id", args.attachmentId))
      .unique();
    if (row === null || row.status !== "uploaded") {
      throw new Error("Unknown attachment.");
    }
    assertOwnsOrCanReview(user._id, user.roles, row.author_user_id);
    return { r2_key: row.r2_key };
  },
});

export const requestAttachmentView = action({
  args: { attachmentId: v.string() },
  returns: v.object({ view_url: v.string(), expires_seconds: v.number() }),
  handler: async (ctx, args) => {
    const config = requireR2Config();
    const row: { r2_key: string } = await ctx.runQuery(
      internal.attachments.getAttachmentForView,
      args,
    );
    const viewUrl = await presignR2Url(config, {
      method: "GET",
      key: row.r2_key,
      expiresSeconds: VIEW_URL_SECONDS,
    });
    return { view_url: viewUrl, expires_seconds: VIEW_URL_SECONDS };
  },
});
