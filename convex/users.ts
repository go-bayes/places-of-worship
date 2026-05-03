import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { projectRole } from "./model";
import { normaliseEmail, requireUser } from "./lib/auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    return await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("auth_subject", identity.tokenIdentifier))
      .unique();
  },
});

export const bootstrapFirstAdmin = mutation({
  args: {
    initials: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").first();
    if (existing !== null) {
      throw new Error("A project user already exists.");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required.");
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      auth_subject: identity.tokenIdentifier,
      email: normaliseEmail(identity.email),
      display_name: args.displayName ?? identity.name,
      initials: args.initials.trim().slice(0, 12) || "admin",
      roles: ["admin", "curator", "reviewer", "ra"],
      status: "active",
      created_at: now,
      updated_at: now,
    });
    return userId;
  },
});

export const inviteUser = mutation({
  args: {
    email: v.string(),
    initials: v.optional(v.string()),
    displayName: v.optional(v.string()),
    roles: v.array(projectRole),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, ["admin"]);
    const email = normaliseEmail(args.email);
    if (email === undefined) {
      throw new Error("Email is required.");
    }
    if (args.roles.length === 0) {
      throw new Error("At least one role is required.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        display_name: args.displayName ?? existing.display_name,
        initials: args.initials?.trim().slice(0, 12) || existing.initials,
        roles: args.roles,
        status: existing.status === "disabled" ? "disabled" : "pending",
        updated_at: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      email,
      display_name: args.displayName,
      initials: args.initials?.trim().slice(0, 12) || email.slice(0, 2).toUpperCase(),
      roles: args.roles,
      status: "pending",
      created_at: now,
      updated_at: now,
    });
  },
});

export const claimInvite = mutation({
  args: {
    initials: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required.");
    }

    const active = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("auth_subject", identity.tokenIdentifier))
      .unique();
    if (active !== null) {
      return active._id;
    }

    const email = normaliseEmail(identity.email);
    if (email === undefined) {
      throw new Error("This invitation requires a verified email address.");
    }

    const invite = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (invite === null || invite.status !== "pending") {
      throw new Error("No pending project invitation found for this email.");
    }

    await ctx.db.patch(invite._id, {
      auth_subject: identity.tokenIdentifier,
      display_name: invite.display_name ?? identity.name,
      initials: args.initials?.trim().slice(0, 12) || invite.initials,
      status: "active",
      updated_at: Date.now(),
    });
    return invite._id;
  },
});

export const listUsers = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("pending"), v.literal("disabled"))),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, ["admin"]);
    if (args.status !== undefined) {
      return await ctx.db
        .query("users")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .collect();
    }
    return await ctx.db.query("users").collect();
  },
});
