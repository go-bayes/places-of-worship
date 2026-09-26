import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

declare const process: { env: Record<string, string | undefined> };

export type ProjectRole = "ra" | "reviewer" | "curator" | "admin" | "service" | "pi";

export function normaliseEmail(email: string | undefined): string | undefined {
  const value = email?.trim().toLowerCase();
  return value || undefined;
}

export function chooseActorRole(
  user: Doc<"users">,
  allowedRoles: readonly ProjectRole[],
): ProjectRole {
  return allowedRoles.find((role) => user.roles.includes(role)) ?? user.roles[0] ?? "ra";
}

// checks whether a user may inspect review queues and other users' evidence.
export function canReview(
  userRoles: readonly ProjectRole[],
): boolean {
  return userRoles.includes("reviewer")
    || userRoles.includes("curator")
    || userRoles.includes("admin")
    || userRoles.includes("service")
    || userRoles.includes("pi");
}

// issuers compare without a trailing slash, since a deployment variable and
// a token's iss claim may differ only there
export function normaliseIssuer(issuer: string | undefined): string | undefined {
  const value = issuer?.trim().replace(/\/+$/, "");
  return value || undefined;
}

// the destination issuer of a re-keying: the clerk instance this deployment
// trusts (CLERK_JWT_ISSUER_DOMAIN, the same value auth.config.ts reads)
export function migrationDestinationIssuer(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return normaliseIssuer(env.CLERK_JWT_ISSUER_DOMAIN);
}

// the explicit allowlist of issuers whose identifiers may be re-keyed
// (brief 4.3.2, r-c16). comma or whitespace separated; empty or unset
// disables re-keying
export function migrationSourceIssuers(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return String(env.AUTH_MIGRATION_SOURCE_ISSUERS ?? "")
    .split(/[\s,]+/)
    .map((entry) => normaliseIssuer(entry))
    .filter((entry): entry is string => entry !== undefined);
}

// the issuer an existing auth_subject was minted by, when it is on the
// allowlist: convex token identifiers are "<issuer>|<subject>"
export function allowlistedSourceIssuer(
  authSubject: string | undefined,
  sources: readonly string[],
): string | undefined {
  if (!authSubject) return undefined;
  return sources.find((issuer) => authSubject.startsWith(`${issuer}|`));
}

// finds the caller's row: the current identifier first (one lookup, as
// before), then an unretired link from user_identities. requireUser, me and
// claimInvite all resolve through here, so a re-keyed member's previous
// provider still reaches the same row during the rollback week (brief 4.2)
export async function resolveUser(
  ctx: QueryCtx | MutationCtx,
  identity: Pick<UserIdentity, "tokenIdentifier">,
): Promise<Doc<"users"> | null> {
  const direct = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("auth_subject", identity.tokenIdentifier))
    .unique();
  if (direct !== null) {
    return direct;
  }
  const links = await ctx.db
    .query("user_identities")
    .withIndex("by_token_identifier", (q) => q.eq("token_identifier", identity.tokenIdentifier))
    .collect();
  const live = links.filter((link) => link.retired_at === undefined);
  if (live.length === 0) {
    return null;
  }
  if (new Set(live.map((link) => link.user_id)).size > 1) {
    throw new Error("This sign-in is linked to more than one project user; ask an admin to repair it.");
  }
  return await ctx.db.get(live[0].user_id);
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: readonly ProjectRole[],
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Authentication required.");
  }

  const user = await resolveUser(ctx, identity);

  if (user === null || user.status !== "active") {
    throw new Error("Authenticated user is not active in this project.");
  }

  if (!allowedRoles.some((role) => user.roles.includes(role))) {
    throw new Error("Project role does not permit this action.");
  }

  return user;
}

export function assertOwnsOrCanReview(
  userId: Id<"users">,
  userRoles: readonly ProjectRole[],
  ownerId: Id<"users"> | undefined,
): void {
  if (ownerId === undefined || ownerId === userId) {
    return;
  }
  if (canReview(userRoles)) {
    return;
  }
  throw new Error("Task is assigned to another user.");
}
