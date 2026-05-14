import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type ProjectRole = "ra" | "reviewer" | "curator" | "admin" | "service";

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
    || userRoles.includes("service");
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: readonly ProjectRole[],
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Authentication required.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("auth_subject", identity.tokenIdentifier))
    .unique();

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
