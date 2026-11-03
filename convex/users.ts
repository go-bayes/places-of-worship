import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { projectRole, userStatus } from "./model";
import { findUserForIdentity, holdsServiceRole, isWorkosIdentity, normaliseEmail, requireUser, workosSubject, workosVerifiedEmail } from "./lib/auth";

declare const process: {
  env: Record<string, string | undefined>;
};

// the google rollback from workos sessions: google's claimInvite may bind
// an active row claimed only through workos to the google account with its
// verified email. it is a takeover path for every such row while google is
// an accepted provider, so it is off unless the deployment sets
// POW_AUTH_GOOGLE_ROLLBACK=1, which the project lead does only during an
// actual rollback (docs/development/workos-sessions.md). read, never set,
// by this code
function googleRollbackEnabled(): boolean {
  return process.env.POW_AUTH_GOOGLE_ROLLBACK === "1";
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
    // google: by auth_subject. workos: by workos_subject, or before the
    // claim by the verified email claim, so the portal can see an
    // unclaimed row; a workos session without that claim is refused with
    // the reason
    return await findUserForIdentity(ctx, identity, { emailFallback: true });
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
    // optional status override, e.g. to create an active service account
    // that never signs in; omitted = preserve existing, pending on insert
    status: v.optional(userStatus),
    // true unbinds the row's workos account (workos_subject), so the next
    // workos claimInvite binds whichever account its verified email reaches
    // it with: for a person who replaced their workos account. an active
    // row with no google identity becomes pending again, unless status is
    // given
    clearWorkosSubject: v.optional(v.boolean()),
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
      // unbinding a row claimed only through workos leaves it with no
      // subject at all, which no sign-in may claim by email while active;
      // it returns to an invitation, so the replacement account can claim it
      const reinvite = args.clearWorkosSubject === true
        && existing.auth_subject === undefined
        && existing.status === "active";
      const status = args.status ?? (reinvite ? "pending" : existing.status);
      await ctx.db.patch(existing._id, {
        roles: args.roles,
        display_name: args.displayName ?? existing.display_name,
        initials: args.initials?.trim().slice(0, 12) || existing.initials,
        status,
        ...(args.clearWorkosSubject === true ? { workos_subject: undefined } : {}),
        updated_at: now,
      });
      return { user_id: existing._id, created: false, status };
    }

    const userId = await ctx.db.insert("users", {
      email,
      display_name: args.displayName,
      initials: args.initials?.trim().slice(0, 12) || email.slice(0, 2).toUpperCase(),
      roles: args.roles,
      status: args.status ?? "pending",
      created_at: now,
      updated_at: now,
    });
    return { user_id: userId, created: true, status: args.status ?? "pending" };
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

    // a workos session claims the row its workos user is bound to, or,
    // before its first claim, the row its verified email names, and binds
    // workos_subject then: the one place a workos user is bound.
    // auth_subject is left as it is: it holds the google identity of a row
    // claimed before the switch
    if (isWorkosIdentity(identity)) {
      const row = await findUserForIdentity(ctx, identity, { emailFallback: true });
      if (row === null) {
        throw new Error(`No project invitation found for ${workosVerifiedEmail(identity)}.`);
      }
      if (row.status !== "active" && row.status !== "pending") {
        throw new Error("Authenticated user is not active in this project.");
      }
      // a bound, active row: nothing to write
      if (row.workos_subject !== undefined && row.status === "active") {
        return row._id;
      }
      await ctx.db.patch(row._id, {
        workos_subject: row.workos_subject ?? workosSubject(identity),
        ...(row.status === "pending"
          ? {
              display_name: row.display_name ?? (identity.name?.trim() || undefined),
              initials: args.initials?.trim().slice(0, 12) || row.initials,
              status: "active" as const,
            }
          : {}),
        updated_at: Date.now(),
      });
      return row._id;
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
    // the email is the only link from this google account to the row, so
    // google must vouch for it
    if (identity.emailVerified !== true) {
      throw new Error(`Google does not report ${email} as verified, so it cannot claim a project invitation.`);
    }

    const invite = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (invite === null || holdsServiceRole(invite)) {
      throw new Error("No pending project invitation found for this email.");
    }
    // a row bound to another google account is never taken over by email
    if (invite.auth_subject !== undefined) {
      throw new Error("This email's project account is linked to another Google account. Ask the project lead.");
    }
    // a pending invitation, or, during a rollback from workos only
    // (POW_AUTH_GOOGLE_ROLLBACK=1), an active row claimed only through
    // workos, which has no google identity yet
    const rollback = googleRollbackEnabled()
      && invite.status === "active"
      && invite.workos_subject !== undefined;
    if (invite.status !== "pending" && !rollback) {
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
