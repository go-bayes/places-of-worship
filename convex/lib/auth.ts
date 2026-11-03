import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

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

// workos authkit sessions (2026-11-03). a workos access token names the
// person by a workos user id, which matches no row before its first workos
// sign-in: rows claimed through google hold google's tokenIdentifier in
// auth_subject, and invites hold only an email. a workos identity therefore
// reaches its row by workos_subject (the workos user id) once claimInvite
// has bound it, and before that, in users:me and users:claimInvite only, by
// the verified email claim that the dashboard's jwt template adds. the google
// path matches auth_subject against tokenIdentifier, as before. refusal
// messages avoid the words the portal reads as an expired sign-in (token,
// jwt, authentication required), so the reason reaches the person
export const WORKOS_ISSUER_PREFIX = "https://api.workos.com/";
// the claims the workos jwt template sets; convex also maps the standard
// oidc pair onto identity.email and identity.emailVerified
export const WORKOS_EMAIL_CLAIM = "email";
export const WORKOS_EMAIL_VERIFIED_CLAIM = "email_verified";

type IdentityLike = Pick<UserIdentity, "tokenIdentifier"> & Partial<UserIdentity>;

export function isWorkosIdentity(identity: IdentityLike): boolean {
  return String(identity.issuer ?? "").startsWith(WORKOS_ISSUER_PREFIX)
    || String(identity.tokenIdentifier ?? "").startsWith(WORKOS_ISSUER_PREFIX);
}

// the verified, normalised email of a workos identity, or a refusal that
// says what is missing. without an email no row can be found, so the
// session is refused rather than read as a stranger's; an unverified email
// could be anyone's, so it is refused as well
export function workosVerifiedEmail(identity: IdentityLike): string {
  const claimed = identity[WORKOS_EMAIL_CLAIM] ?? identity.email;
  const email = typeof claimed === "string" ? normaliseEmail(claimed) : undefined;
  if (email === undefined) {
    throw new Error(
      "This WorkOS sign-in carries no email address, so the project cannot match it to an invitation. "
        + "The project lead must add the email claim to the WorkOS session template.",
    );
  }
  // a template that renders the flag as text gives "true"
  const verified = identity[WORKOS_EMAIL_VERIFIED_CLAIM] ?? identity.emailVerified;
  if (verified !== true && verified !== "true") {
    throw new Error(
      `WorkOS does not report ${email} as verified, so this sign-in cannot be matched to a project invitation. `
        + "The project lead must add the email_verified claim to the WorkOS session template.",
    );
  }
  return email;
}

// a row carrying the service role is an internal actor; an email match must
// not open it to a browser session, whatever other roles it holds
export function holdsServiceRole(user: Doc<"users">): boolean {
  return user.roles.includes("service");
}

// whether an email match may open this row to a sign-in that has no subject
// bound to it yet: an invitation, or a row someone has already signed in to
// through a provider. an active row no one has signed in to (a service or
// seeding actor made by adminUpsertUser) never opens by email
export function opensByEmail(user: Doc<"users">): boolean {
  if (holdsServiceRole(user)) return false;
  return user.status === "pending" || user.auth_subject !== undefined || user.workos_subject !== undefined;
}

// the workos user id (the token's sub). the key leaves out the issuer, since
// both accepted issuer forms name the same workos user
export function workosSubject(identity: IdentityLike): string {
  const subject = identity.subject || String(identity.tokenIdentifier ?? "").split("|").pop() || "";
  if (!subject) throw new Error("This WorkOS sign-in names no user.");
  return subject;
}

// the row a workos user is bound to, by workos_subject alone: no email
// claim, so a bound row does not depend on the jwt template
async function findBoundWorkosUser(
  ctx: QueryCtx | MutationCtx,
  identity: IdentityLike,
): Promise<Doc<"users"> | null> {
  const subject = workosSubject(identity);
  const bound = await ctx.db
    .query("users")
    .withIndex("by_workos_subject", (q) => q.eq("workos_subject", subject))
    .unique();
  if (bound !== null && holdsServiceRole(bound)) throw new Error("Service accounts cannot sign in.");
  return bound;
}

// a verified email is a standing credential: a recycled mailbox would carry
// it to a new owner. so a workos user reaches a row by workos_subject once
// claimInvite has bound it, and by its verified email only before that:
// invitations, and rows claimed through google before the switch.
// emailFallback is for users:me and users:claimInvite only; requireUser
// takes bound rows alone, so every other function waits for the claim
export async function findUserForIdentity(
  ctx: QueryCtx | MutationCtx,
  identity: IdentityLike,
  { emailFallback = false }: { emailFallback?: boolean } = {},
): Promise<Doc<"users"> | null> {
  if (!isWorkosIdentity(identity)) {
    return await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("auth_subject", identity.tokenIdentifier))
      .unique();
  }
  const bound = await findBoundWorkosUser(ctx, identity);
  if (bound !== null || !emailFallback) return bound;
  const email = workosVerifiedEmail(identity);
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (user === null) return null;
  if (holdsServiceRole(user)) throw new Error("Service accounts cannot sign in.");
  if (user.workos_subject !== undefined) {
    throw new Error(
      `${email} is already linked to another WorkOS account, so this sign-in cannot use it. Ask the project lead.`,
    );
  }
  if (!opensByEmail(user)) {
    throw new Error("This project account is not set up for sign-in. Ask the project lead.");
  }
  return user;
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: readonly ProjectRole[],
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Authentication required.");
  }

  const user = await findUserForIdentity(ctx, identity);

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
