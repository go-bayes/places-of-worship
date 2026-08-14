import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { projectRole } from "./model";
import { normaliseEmail, requireUser } from "./lib/auth";

declare const process: {
  env: Record<string, string | undefined>;
};

function requireSetupToken(token: string) {
  const expected = process.env.POW_CONVEX_SETUP_TOKEN;
  if (expected === undefined || expected.length < 24) {
    throw new Error("POW_CONVEX_SETUP_TOKEN must be set before bootstrap.");
  }
  if (token !== expected) {
    throw new Error("Invalid Convex setup token.");
  }
}

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
    setupToken: v.string(),
    initials: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSetupToken(args.setupToken);
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

export const bootstrapPendingInvites = mutation({
  args: {
    setupToken: v.string(),
    adminEmail: v.string(),
    adminInitials: v.optional(v.string()),
    adminDisplayName: v.optional(v.string()),
    raInvites: v.optional(
      v.array(
        v.object({
          email: v.string(),
          initials: v.optional(v.string()),
          displayName: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    requireSetupToken(args.setupToken);
    const existing = await ctx.db.query("users").first();
    if (existing !== null) {
      throw new Error("Project users already exist; use inviteUser instead.");
    }

    const adminEmail = normaliseEmail(args.adminEmail);
    if (adminEmail === undefined) {
      throw new Error("Admin email is required.");
    }

    const now = Date.now();
    const inserted = [];
    inserted.push(
      await ctx.db.insert("users", {
        email: adminEmail,
        display_name: args.adminDisplayName,
        initials: args.adminInitials?.trim().slice(0, 12) || "JB",
        roles: ["admin", "curator", "reviewer", "ra"],
        status: "pending",
        created_at: now,
        updated_at: now,
      }),
    );

    for (const invite of args.raInvites ?? []) {
      const email = normaliseEmail(invite.email);
      if (email === undefined || email === adminEmail) {
        continue;
      }
      inserted.push(
        await ctx.db.insert("users", {
          email,
          display_name: invite.displayName,
          initials: invite.initials?.trim().slice(0, 12) || email.slice(0, 2).toUpperCase(),
          roles: ["ra"],
          status: "pending",
          created_at: now,
          updated_at: now,
        }),
      );
    }

    return { inserted_user_count: inserted.length };
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

// admin-key-only user repair: patch roles on an existing user (preserving
// status, unlike inviteUser which resets active users to pending), or insert
// a pending invite when no row matches the email. run via CLI/dashboard.
export const adminUpsertUser = internalMutation({
  args: {
    email: v.string(),
    roles: v.array(projectRole),
    displayName: v.optional(v.string()),
    initials: v.optional(v.string()),
  },
  returns: v.object({ user_id: v.id("users"), created: v.boolean(), status: v.string() }),
  handler: async (ctx, args) => {
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
        roles: args.roles,
        display_name: args.displayName ?? existing.display_name,
        initials: args.initials?.trim().slice(0, 12) || existing.initials,
        updated_at: now,
      });
      return { user_id: existing._id, created: false, status: existing.status };
    }

    const userId = await ctx.db.insert("users", {
      email,
      display_name: args.displayName,
      initials: args.initials?.trim().slice(0, 12) || email.slice(0, 2).toUpperCase(),
      roles: args.roles,
      status: "pending",
      created_at: now,
      updated_at: now,
    });
    return { user_id: userId, created: true, status: "pending" };
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
      const status = args.status;
      return await ctx.db
        .query("users")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    }
    return await ctx.db.query("users").collect();
  },
});
