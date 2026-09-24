import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { projectRole, roleEventReason, userStatus } from "./model";
import {
  allowlistedSourceIssuer,
  migrationDestinationIssuer,
  migrationSourceIssuers,
  normaliseEmail,
  normaliseIssuer,
  requireUser,
  resolveUser,
} from "./lib/auth";

declare const process: {
  env: Record<string, string | undefined>;
};

const NO_INVITATION = "No pending project invitation found for this email.";
const VERIFY_EMAIL = "Verify this email address with the sign-in provider, then sign in again.";

type RoleEventInput = {
  user_id: Id<"users">;
  actor_user_id?: Id<"users">;
  from_roles: Doc<"users">["roles"];
  to_roles: Doc<"users">["roles"];
  from_status?: Doc<"users">["status"];
  to_status: Doc<"users">["status"];
  reason: Infer<typeof roleEventReason>;
  note?: string;
};

// role_events is append-only (brief 8.4): every grant, claim, re-keying and
// reset leaves one row, so the provenance of each account is queryable
async function appendRoleEvent(ctx: MutationCtx, event: RoleEventInput, now: number) {
  await ctx.db.insert("role_events", { ...event, created_at: now });
}

function sameRoles(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((role, index) => role === b[index]);
}

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
    return await resolveUser(ctx, identity);
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
    const inviter = await requireUser(ctx, ["admin"]);
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
      const { roles: fromRoles, status: fromStatus } = existing;
      const status = fromStatus === "disabled" ? "disabled" : "pending";
      await ctx.db.patch(existing._id, {
        display_name: args.displayName ?? existing.display_name,
        initials: args.initials?.trim().slice(0, 12) || existing.initials,
        roles: args.roles,
        status,
        updated_at: now,
      });
      await appendRoleEvent(ctx, {
        user_id: existing._id,
        actor_user_id: inviter._id,
        from_roles: fromRoles,
        to_roles: args.roles,
        from_status: fromStatus,
        to_status: status,
        reason: "invite",
      }, now);
      return existing._id;
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
    await appendRoleEvent(ctx, {
      user_id: userId,
      actor_user_id: inviter._id,
      from_roles: [],
      to_roles: args.roles,
      to_status: "pending",
      reason: "invite",
    }, now);
    return userId;
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
    // optional status override, e.g. to create an active service account
    // that never signs in; omitted = preserve existing, pending on insert
    status: v.optional(userStatus),
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
      const { roles: fromRoles, status: fromStatus } = existing;
      const status = args.status ?? fromStatus;
      await ctx.db.patch(existing._id, {
        roles: args.roles,
        display_name: args.displayName ?? existing.display_name,
        initials: args.initials?.trim().slice(0, 12) || existing.initials,
        status,
        updated_at: now,
      });
      if (!sameRoles(fromRoles, args.roles) || fromStatus !== status) {
        await appendRoleEvent(ctx, {
          user_id: existing._id,
          from_roles: fromRoles,
          to_roles: args.roles,
          from_status: fromStatus,
          to_status: status,
          reason: "role_change",
          note: "adminUpsertUser (admin key)",
        }, now);
      }
      return { user_id: existing._id, created: false, status };
    }

    const status = args.status ?? "pending";
    const userId = await ctx.db.insert("users", {
      email,
      display_name: args.displayName,
      initials: args.initials?.trim().slice(0, 12) || email.slice(0, 2).toUpperCase(),
      roles: args.roles,
      status,
      created_at: now,
      updated_at: now,
    });
    await appendRoleEvent(ctx, {
      user_id: userId,
      from_roles: [],
      to_roles: args.roles,
      to_status: status,
      reason: "invite",
      note: "adminUpsertUser (admin key)",
    }, now);
    return { user_id: userId, created: true, status };
  },
});

// activation at sign-in (brief 4.3.2). the caller's row is found through
// resolveUser; otherwise the verified email picks a row and these rules apply
// in order: a verified email; never a disabled row; never a service row; a
// pending row activates; an active row re-keys only from an allowlisted
// source issuer to the configured clerk issuer; anything else refuses
export const claimInvite = mutation({
  args: {
    initials: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required.");
    }
    const now = Date.now();
    const email = normaliseEmail(identity.email);
    const verified = identity.emailVerified === true;

    const resolved = await resolveUser(ctx, identity);
    if (resolved !== null) {
      // lock-out repair: inviteUser on an active member sets the row back to
      // pending and keeps its auth_subject, so the member's own sign-in finds
      // a pending row. it activates when the verified email still matches
      if (resolved.status === "pending") {
        if (!verified) {
          throw new Error(VERIFY_EMAIL);
        }
        if (email === undefined || resolved.email !== email || resolved.roles.includes("service")) {
          throw new Error(NO_INVITATION);
        }
        await ctx.db.patch(resolved._id, {
          display_name: resolved.display_name ?? identity.name,
          initials: args.initials?.trim().slice(0, 12) || resolved.initials,
          status: "active",
          updated_at: now,
        });
        await appendRoleEvent(ctx, {
          user_id: resolved._id,
          from_roles: resolved.roles,
          to_roles: resolved.roles,
          from_status: "pending",
          to_status: "active",
          reason: "claim",
          note: "pending row found by its sign-in identifier",
        }, now);
      }
      return resolved._id;
    }

    // rule 1: a verified email, for invitations and re-keying alike
    if (email === undefined) {
      throw new Error("This invitation requires a verified email address.");
    }
    if (!verified) {
      throw new Error(VERIFY_EMAIL);
    }

    const row = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    // rules 2 and 3: disabled and service rows never activate or re-key by
    // sign-in; service identities are repaired only from the cli
    if (row === null || row.status === "disabled" || row.roles.includes("service")) {
      throw new Error(NO_INVITATION);
    }

    const destination = migrationDestinationIssuer();
    const tokenIssuer = normaliseIssuer(identity.issuer);
    const source = allowlistedSourceIssuer(row.auth_subject, migrationSourceIssuers());
    const takenLinks = await ctx.db
      .query("user_identities")
      .withIndex("by_token_identifier", (q) => q.eq("token_identifier", identity.tokenIdentifier))
      .collect();
    // a re-keying moves the row from an allowlisted source issuer to the
    // configured destination; the old identifier stays linked for rollback
    const mayRekey = row.auth_subject !== undefined
      && source !== undefined
      && destination !== undefined
      && tokenIssuer === destination
      && source !== destination
      && takenLinks.length === 0;

    const previousSubject = row.auth_subject;
    const { roles, status } = row;

    // rule 4: a pending invitation activates
    if (status === "pending") {
      // a pending row still bound to another identifier (an active member
      // set back to pending by inviteUser) moves to this one only on the
      // re-keying conditions, so a sign-in never silently drops the
      // identifier the rollback client needs
      if (previousSubject !== undefined && !mayRekey) {
        throw new Error("This invitation is bound to another sign-in method. Sign in that way, or ask a project admin to reset it.");
      }
      if (previousSubject !== undefined && source !== undefined) {
        await ctx.db.insert("user_identities", {
          user_id: row._id,
          token_identifier: previousSubject,
          issuer: source,
          linked_at: now,
          linked_reason: "auth_provider_migration",
        });
      }
      await ctx.db.patch(row._id, {
        auth_subject: identity.tokenIdentifier,
        display_name: row.display_name ?? identity.name,
        initials: args.initials?.trim().slice(0, 12) || row.initials,
        status: "active",
        updated_at: now,
      });
      await appendRoleEvent(ctx, {
        user_id: row._id,
        from_roles: roles,
        to_roles: roles,
        from_status: "pending",
        to_status: "active",
        reason: "claim",
        note: previousSubject !== undefined ? `re-keyed from ${source} to ${destination}` : undefined,
      }, now);
      return row._id;
    }

    // rule 5: an active row re-keys only on every condition above
    if (status === "active" && mayRekey && previousSubject !== undefined && source !== undefined) {
      await ctx.db.insert("user_identities", {
        user_id: row._id,
        token_identifier: previousSubject,
        issuer: source,
        linked_at: now,
        linked_reason: "auth_provider_migration",
      });
      await ctx.db.patch(row._id, {
        auth_subject: identity.tokenIdentifier,
        display_name: row.display_name ?? identity.name,
        updated_at: now,
      });
      await appendRoleEvent(ctx, {
        user_id: row._id,
        from_roles: roles,
        to_roles: roles,
        from_status: status,
        to_status: status,
        reason: "auth_provider_migration",
        note: `from ${source} to ${destination}`,
      }, now);
      return row._id;
    }

    // rule 6
    throw new Error(NO_INVITATION);
  },
});

// cli-only repair of a stuck account (brief 4.3.2): retires the row's links,
// clears auth_subject and sets it pending with its roles unchanged, so the
// person claims again with a verified email. the row keeps its _id, so every
// task, decision and event stays attached. never for service or disabled rows
export const adminResetAuthSubject = internalMutation({
  args: {
    email: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.object({ user_id: v.id("users"), retired_links: v.number() }),
  handler: async (ctx, args) => {
    const email = normaliseEmail(args.email);
    if (email === undefined) {
      throw new Error("Email is required.");
    }
    const row = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (row === null) {
      throw new Error("No project user has this email.");
    }
    if (row.roles.includes("service")) {
      throw new Error("Service identities are repaired with adminUpsertUser, never reset to a sign-in claim.");
    }
    if (row.status === "disabled") {
      throw new Error("A disabled user is not reset; reinstate it first.");
    }
    const now = Date.now();
    const links = await ctx.db
      .query("user_identities")
      .withIndex("by_user", (q) => q.eq("user_id", row._id))
      .collect();
    let retired = 0;
    for (const link of links) {
      if (link.retired_at === undefined) {
        await ctx.db.patch(link._id, { retired_at: now, retired_reason: "auth_subject_reset" });
        retired += 1;
      }
    }
    const { roles, status } = row;
    await ctx.db.patch(row._id, {
      auth_subject: undefined,
      status: "pending",
      updated_at: now,
    });
    await appendRoleEvent(ctx, {
      user_id: row._id,
      from_roles: roles,
      to_roles: roles,
      from_status: status,
      to_status: "pending",
      reason: "auth_subject_reset",
      note: args.note,
    }, now);
    return { user_id: row._id, retired_links: retired };
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
