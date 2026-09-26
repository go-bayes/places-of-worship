import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { projectRole, roleEventReason, userStatus } from "./model";
import { sha256 } from "./lib/sha256";
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
// r-c18 (jb 2026-09-24, option 1): moving an existing google-bound member to
// clerk needs the row's current google sign-in to approve a pairing that the
// clerk sign-in requested; the binding lives on the server, and a verified
// email alone never re-keys a row
const GOOGLE_ISSUER = "https://accounts.google.com";
const PAIRING_TTL_MS = 10 * 60 * 1000;
// a server-side window on pairing requests, per clerk sign-in (#153 rounds
// 1 and 6): at most PAIRING_REQUEST_LIMIT in any hour. it is not counted
// per member row, so another sign-in holding the mailbox cannot use up the
// member's own requests. every pairing read is bounded: the sign-in's last
// hour (PAIRING_READ_BOUND rows) or the row's ten-minute lifetime
// (PAIRING_OPEN_READ_BOUND rows)
const PAIRING_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const PAIRING_REQUEST_LIMIT = 6;
const PAIRING_READ_BOUND = PAIRING_REQUEST_LIMIT + 1;
const PAIRING_OPEN_READ_BOUND = 25;
const PAIRING_RATE_LIMITED = "Too many requests to move this account from this sign-in in the last hour. Wait an hour, then try again, or ask a project admin.";
const MIGRATION_CONFIRM = "This address belongs to an existing member who signed in with Google. Confirm that Google account first, then sign in again.";
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

// the row a clerk sign-in may be moved onto: matched by its verified email,
// google-bound (an allowlisted source identifier) and open to re-keying to
// this clerk issuer, and not a service or disabled row
async function migrationTarget(
  ctx: MutationCtx,
  identity: UserIdentity,
): Promise<Doc<"users">> {
  const destination = migrationDestinationIssuer();
  if (destination === undefined || normaliseIssuer(identity.issuer) !== destination) {
    throw new Error("Only the new sign-in can ask to move an existing account.");
  }
  if (identity.emailVerified !== true) {
    throw new Error(VERIFY_EMAIL);
  }
  const email = normaliseEmail(identity.email);
  if (email === undefined) {
    throw new Error(VERIFY_EMAIL);
  }
  if ((await resolveUser(ctx, identity)) !== null) {
    throw new Error("This sign-in already belongs to a project member.");
  }
  const row = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  const source = allowlistedSourceIssuer(row?.auth_subject, migrationSourceIssuers());
  if (
    row === null
    || source !== GOOGLE_ISSUER
    || source === destination
    || (row.status !== "active" && row.status !== "pending")
    || row.roles.includes("service")
  ) {
    throw new Error(NO_INVITATION);
  }
  return row;
}

// the approved pairing this clerk identifier may spend on this row
async function approvedPairing(
  ctx: MutationCtx,
  clerkTokenIdentifier: string,
  row: Doc<"users">,
  now: number,
): Promise<Doc<"identity_migration_pairings"> | null> {
  // only a request inside the pairing lifetime can still be live; the
  // request window keeps these few, and the read is bounded regardless
  const pairings = await ctx.db
    .query("identity_migration_pairings")
    .withIndex("by_clerk_identifier", (q) => q
      .eq("clerk_token_identifier", clerkTokenIdentifier)
      .gt("requested_at", now - PAIRING_TTL_MS))
    .order("desc")
    .take(PAIRING_READ_BOUND);
  return pairings.find((pairing) => pairing.user_id === row._id
    && pairing.source_token_identifier === row.auth_subject
    && pairing.approved_at !== undefined
    && pairing.consumed_at === undefined
    && pairing.revoked_at === undefined
    && pairing.expires_at > now) ?? null;
}

// spent in the same transaction as the re-keying it authorises
async function consumePairing(
  ctx: MutationCtx,
  pairing: Doc<"identity_migration_pairings">,
  row: Doc<"users">,
  now: number,
) {
  await ctx.db.patch(pairing._id, { consumed_at: now });
  await appendRoleEvent(ctx, {
    user_id: row._id,
    from_roles: row.roles,
    to_roles: row.roles,
    from_status: row.status,
    to_status: row.status,
    reason: "pairing_consumed",
    note: `pairing ${pairing._id}`,
  }, now);
}

// r-c18 step 1: a clerk sign-in whose verified email matches a google-bound
// member asks to take the row over. the pairing is bound here to this clerk
// identifier and that row; the nonce returned links it to the approval only
// and is useless to any other clerk identifier. a newer request revokes the
// row's earlier open pairings
export const requestIdentityMigration = mutation({
  args: {},
  returns: v.object({ nonce: v.string(), expires_at: v.number() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required.");
    }
    const row = await migrationTarget(ctx, identity);
    const now = Date.now();
    // the request window, per clerk sign-in: a bounded read of its last
    // hour only, never the whole history
    const windowStart = now - PAIRING_REQUEST_WINDOW_MS;
    const recentForSignIn = await ctx.db
      .query("identity_migration_pairings")
      .withIndex("by_clerk_identifier", (q) => q
        .eq("clerk_token_identifier", identity.tokenIdentifier)
        .gt("requested_at", windowStart))
      .take(PAIRING_READ_BOUND);
    if (recentForSignIn.length >= PAIRING_REQUEST_LIMIT) {
      throw new Error(PAIRING_RATE_LIMITED);
    }
    // a newer request revokes the row's open, unapproved pairings. an
    // approved pairing is kept until it is spent or expires: only the
    // member's google sign-in could approve it, and a later request from
    // anyone does not undo that (#153 round 6). only requests inside the
    // pairing lifetime can be open
    const openForRow = await ctx.db
      .query("identity_migration_pairings")
      .withIndex("by_user", (q) => q.eq("user_id", row._id).gt("requested_at", now - PAIRING_TTL_MS))
      .order("desc")
      .take(PAIRING_OPEN_READ_BOUND);
    for (const pairing of openForRow) {
      if (
        pairing.approved_at === undefined
        && pairing.consumed_at === undefined
        && pairing.revoked_at === undefined
      ) {
        await ctx.db.patch(pairing._id, { revoked_at: now });
      }
    }
    // 244 random bits from two v4 uuids (crypto.randomUUID runs in convex
    // mutations, as in exports.ts)
    const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
    const expiresAt = now + PAIRING_TTL_MS;
    const pairingId = await ctx.db.insert("identity_migration_pairings", {
      user_id: row._id,
      clerk_token_identifier: identity.tokenIdentifier,
      source_token_identifier: row.auth_subject!,
      nonce_hash: sha256(nonce),
      requested_at: now,
      expires_at: expiresAt,
    });
    await appendRoleEvent(ctx, {
      user_id: row._id,
      from_roles: row.roles,
      to_roles: row.roles,
      from_status: row.status,
      to_status: row.status,
      reason: "pairing_requested",
      note: `pairing ${pairingId}, expires ${new Date(expiresAt).toISOString()}`,
    }, now);
    return { nonce, expires_at: expiresAt };
  },
});

// r-c18 step 2: the row's current google sign-in approves the pairing it was
// shown. it never learns or chooses the clerk identifier; it can approve
// only an open pairing for its own row. resolved through the shared
// resolveUser, then held to more: a google issuer, the move open, the row's
// current identifier (never a linked earlier one), active or pending, not a
// service identity
export const approveIdentityMigration = mutation({
  args: { nonce: v.string() },
  returns: v.object({ approved: v.boolean(), expires_at: v.number() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required.");
    }
    const issuer = normaliseIssuer(identity.issuer);
    if (issuer !== GOOGLE_ISSUER || !migrationSourceIssuers().includes(GOOGLE_ISSUER)) {
      throw new Error("Only a Google sign-in can approve the move, and only while the move is open.");
    }
    const destination = migrationDestinationIssuer();
    if (destination === undefined || destination === GOOGLE_ISSUER) {
      throw new Error("The new sign-in is not configured on this deployment.");
    }
    const row = await resolveUser(ctx, identity);
    if (
      row === null
      || row.auth_subject !== identity.tokenIdentifier
      || (row.status !== "active" && row.status !== "pending")
      || row.roles.includes("service")
    ) {
      throw new Error("This Google account is not a project member's current sign-in.");
    }
    const now = Date.now();
    const pairing = await ctx.db
      .query("identity_migration_pairings")
      .withIndex("by_nonce_hash", (q) => q.eq("nonce_hash", sha256(args.nonce)))
      .unique();
    if (
      pairing === null
      || pairing.user_id !== row._id
      || pairing.source_token_identifier !== identity.tokenIdentifier
      || pairing.consumed_at !== undefined
      || pairing.revoked_at !== undefined
      || pairing.expires_at <= now
    ) {
      throw new Error("This request to move the account has expired or does not belong to this Google account. Start again from the new sign-in.");
    }
    if (pairing.approved_at === undefined) {
      await ctx.db.patch(pairing._id, { approved_at: now, approved_by_token_identifier: identity.tokenIdentifier });
      await appendRoleEvent(ctx, {
        user_id: row._id,
        from_roles: row.roles,
        to_roles: row.roles,
        from_status: row.status,
        to_status: row.status,
        reason: "pairing_approved",
        note: `pairing ${pairing._id}`,
      }, now);
    }
    return { approved: true, expires_at: pairing.expires_at };
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
      // an identifier already bound to a row is resolved as requireUser
      // resolves it: the verified-email rule (below) gates every write that
      // binds an identifier or changes a status, and a bound identifier was
      // bound under it (claim, re-keying) or before c1 by google sign-in. an
      // active, disabled or other non-pending row is returned unchanged; no
      // write happens on this path, so it grants nothing requireUser would not
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
    // configured destination; the old identifier stays linked for rollback.
    // the window being open is not enough: the row's current google sign-in
    // must have approved a pairing this clerk identifier requested (r-c18)
    const windowOpen = row.auth_subject !== undefined
      && source !== undefined
      && destination !== undefined
      && tokenIssuer === destination
      && source !== destination
      && takenLinks.length === 0;
    // the pairing must be approved by the row's current google sign-in and
    // requested by this very clerk identifier; nothing the client holds or
    // sends can stand in for it
    let pairing: Doc<"identity_migration_pairings"> | null = null;
    if (windowOpen) {
      pairing = await approvedPairing(ctx, identity.tokenIdentifier, row, now);
      if (pairing === null) {
        throw new Error(MIGRATION_CONFIRM);
      }
    }
    const mayRekey = windowOpen && pairing !== null;

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
      if (previousSubject !== undefined && source !== undefined && pairing !== null) {
        await consumePairing(ctx, pairing, row, now);
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
    if (status === "active" && mayRekey && previousSubject !== undefined && source !== undefined && pairing !== null) {
      await consumePairing(ctx, pairing, row, now);
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
