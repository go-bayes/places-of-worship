import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

declare const process: { env: Record<string, string | undefined> };

// the internal agent lanes (bundle intake, first-pass receipts) write as one
// service identity behind one deployment gate. neither the identity nor the
// gate grants acceptance; they only attribute provisional records.
export const INTERNAL_AGENT_SERVICE_EMAIL = "internal-agent-intake@service.local";

export function assertInternalAgentIngestEnabled(): void {
  if (process.env.POW_INTERNAL_AGENT_INGEST_ENABLED !== "true") {
    throw new Error("Internal agent intake is disabled on this deployment.");
  }
}

export function assertCitedNameRuleAllowed(dossier: unknown): void {
  const items = (dossier as any)?.personal_details_quarantine?.items;
  if (Array.isArray(items) && items.some(item => item !== null && typeof item === "object" && Object.hasOwn(item, "admitted_by_rule"))
      && process.env.POW_CITED_NAME_RULE_ENABLED !== "1") {
    throw new Error("Cited-name admissions are disabled on this deployment.");
  }
}

export async function internalAgentServiceUser(ctx: MutationCtx, now: number): Promise<Doc<"users">> {
  let service = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", INTERNAL_AGENT_SERVICE_EMAIL)).unique();
  if (service === null) {
    const id = await ctx.db.insert("users", { email: INTERNAL_AGENT_SERVICE_EMAIL, display_name: "Internal agent intake", initials: "AI", roles: ["service"], status: "active", created_at: now, updated_at: now });
    service = await ctx.db.get(id);
  }
  if (service === null || service.status !== "active" || !service.roles.includes("service")) throw new Error("Intake identity must be an active service user");
  return service;
}
