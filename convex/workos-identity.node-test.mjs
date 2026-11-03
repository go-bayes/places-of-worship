// workos authkit sessions (2026-11-03): a workos identity reaches the same
// users row as the google identity before it, by the verified email claim;
// a workos identity with no email, or an unverified one, is refused with a
// reason; the google path still matches auth_subject; service rows never
// open to a browser session
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { requireUser, isWorkosIdentity, workosVerifiedEmail } = await import("./lib/auth.ts");
const { me, claimInvite } = await import("./users.ts");

const CLIENT_ID = "client_01TEST";
const GOOGLE_RA = "https://accounts.google.com|google-sub-ra";

function makeDb(rows) {
  return {
    query(table) {
      return {
        withIndex(_index, select) {
          const constraints = [];
          const q = { eq(field, value) { constraints.push([field, value]); return q; } };
          if (select) select(q);
          const matching = () => (rows[table] ?? []).filter((row) => constraints.every(([field, value]) => row[field] === value));
          return {
            async unique() { const found = matching(); if (found.length > 1) throw new Error("not unique"); return found[0] ?? null; },
            async first() { return matching()[0] ?? null; },
          };
        },
      };
    },
    async patch(id, fields) {
      const row = Object.values(rows).flat().find((entry) => entry._id === id);
      Object.assign(row, fields);
    },
  };
}

function fixture() {
  return {
    users: [
      // claimed through google before the switch
      { _id: "ra_1", auth_subject: GOOGLE_RA, email: "ra@example.org", initials: "RA", roles: ["ra"], status: "active" },
      { _id: "pi_1", auth_subject: "https://accounts.google.com|google-sub-pi", email: "pi@example.org", initials: "PI", roles: ["pi", "reviewer"], status: "active" },
      // invited, never signed in
      { _id: "inv_1", email: "new@example.org", initials: "NW", roles: ["ra"], status: "pending" },
      { _id: "off_1", email: "gone@example.org", initials: "GN", roles: ["ra"], status: "disabled" },
      // the seeding actor, and the impersonation row pow-cli uses
      { _id: "svc_1", email: "service+claude@example.org", initials: "AI", roles: ["service"], status: "active" },
      { _id: "seed_1", auth_subject: "pow-cli-seed-service", email: "seed@service.local", initials: "SD", roles: ["service"], status: "active" },
    ],
  };
}

const workos = (claims = {}, issuer = `https://api.workos.com/user_management/${CLIENT_ID}`) => ({
  tokenIdentifier: `${issuer}|user_01WORKOS`,
  subject: "user_01WORKOS",
  issuer,
  ...claims,
});
const ctxAs = (rows, identity) => ({ auth: { async getUserIdentity() { return identity; } }, db: makeDb(rows) });

test("a workos identity is recognised by either documented issuer", () => {
  assert.equal(isWorkosIdentity(workos()), true);
  assert.equal(isWorkosIdentity(workos({}, "https://api.workos.com/")), true);
  assert.equal(isWorkosIdentity({ tokenIdentifier: GOOGLE_RA, issuer: "https://accounts.google.com" }), false);
  // the identities the existing tests and pow-cli impersonation send
  assert.equal(isWorkosIdentity({ tokenIdentifier: "pow-cli-seed-service" }), false);
});

test("a workos identity reaches the row the google identity claimed, by email", async () => {
  const rows = fixture();
  const identity = workos({ email: "RA@Example.org ", emailVerified: true });
  const viaWorkos = await requireUser(ctxAs(rows, identity), ["ra"]);
  const viaGoogle = await requireUser(ctxAs(rows, { tokenIdentifier: GOOGLE_RA, issuer: "https://accounts.google.com" }), ["ra"]);
  assert.equal(viaWorkos._id, "ra_1");
  assert.equal(viaGoogle._id, "ra_1");
  assert.equal((await me._handler(ctxAs(rows, identity), {}))._id, "ra_1");
  // roles carry over unchanged
  await assert.rejects(requireUser(ctxAs(rows, identity), ["pi"]), /Project role does not permit/);
  const pi = await requireUser(ctxAs(rows, workos({ email: "pi@example.org", emailVerified: true })), ["pi"]);
  assert.equal(pi._id, "pi_1");
});

test("the claim names may arrive as raw custom claims", async () => {
  const rows = fixture();
  const user = await requireUser(ctxAs(rows, workos({ email: "ra@example.org", email_verified: "true" })), ["ra"]);
  assert.equal(user._id, "ra_1");
});

test("a workos identity with no email is refused with the reason, never read as a stranger", async () => {
  const rows = fixture();
  const identity = workos({ emailVerified: true });
  const reason = /carries no email address.*email claim to the WorkOS session template/;
  assert.throws(() => workosVerifiedEmail(identity), reason);
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), reason);
  await assert.rejects(me._handler(ctxAs(rows, identity), {}), reason);
  await assert.rejects(claimInvite._handler(ctxAs(rows, identity), {}), reason);
  // the portal treats messages naming a token or jwt as an expired sign-in
  // and hides them; the refusal must reach the person
  try { workosVerifiedEmail(identity); } catch (error) { assert.doesNotMatch(error.message, /Authentication required|Unauthenticated|JWT|token/i); }
});

test("a workos email that is not reported verified is refused", async () => {
  const rows = fixture();
  for (const flag of [undefined, false, "false"]) {
    const identity = workos({ email: "ra@example.org", ...(flag === undefined ? {} : { emailVerified: flag }) });
    await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not report ra@example\.org as verified/);
    try { workosVerifiedEmail(identity); } catch (error) { assert.doesNotMatch(error.message, /Authentication required|Unauthenticated|JWT|token/i); }
  }
});

test("a workos email naming no row reads as no user; claimInvite says no invitation", async () => {
  const rows = fixture();
  const identity = workos({ email: "stranger@example.org", emailVerified: true });
  assert.equal(await me._handler(ctxAs(rows, identity), {}), null);
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not active in this project/);
  await assert.rejects(claimInvite._handler(ctxAs(rows, identity), {}), /No project invitation found for stranger@example\.org/);
});

test("claimInvite through workos activates a pending invite and leaves auth_subject alone", async () => {
  const rows = fixture();
  const identity = workos({ email: "new@example.org", emailVerified: true, name: "New Person" });
  assert.equal(await claimInvite._handler(ctxAs(rows, identity), { initials: "NP" }), "inv_1");
  const row = rows.users.find((user) => user._id === "inv_1");
  assert.equal(row.status, "active");
  assert.equal(row.initials, "NP");
  assert.equal(row.display_name, "New Person");
  assert.equal(row.auth_subject, undefined);
  assert.equal((await requireUser(ctxAs(rows, identity), ["ra"]))._id, "inv_1");
  // an active row: claimInvite returns it untouched, auth_subject included
  assert.equal(await claimInvite._handler(ctxAs(rows, workos({ email: "ra@example.org", emailVerified: true })), {}), "ra_1");
  assert.equal(rows.users.find((user) => user._id === "ra_1").auth_subject, GOOGLE_RA);
});

test("a disabled row stays shut through workos", async () => {
  const rows = fixture();
  const identity = workos({ email: "gone@example.org", emailVerified: true });
  await assert.rejects(claimInvite._handler(ctxAs(rows, identity), {}), /not active in this project/);
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not active in this project/);
  assert.equal(rows.users.find((user) => user._id === "off_1").status, "disabled");
});

test("a service-only row cannot be reached by a workos email", async () => {
  const rows = fixture();
  const identity = workos({ email: "service+claude@example.org", emailVerified: true });
  await assert.rejects(requireUser(ctxAs(rows, identity), ["service"]), /Service accounts cannot sign in/);
  await assert.rejects(me._handler(ctxAs(rows, identity), {}), /Service accounts cannot sign in/);
  await assert.rejects(claimInvite._handler(ctxAs(rows, identity), {}), /Service accounts cannot sign in/);
});

test("the google path and the pow-cli seed-service impersonation are unchanged", async () => {
  const rows = fixture();
  assert.equal((await requireUser(ctxAs(rows, { tokenIdentifier: "pow-cli-seed-service" }), ["service"]))._id, "seed_1");
  // a google identity is matched by auth_subject only: its email is not read
  const stranger = { tokenIdentifier: "https://accounts.google.com|other", issuer: "https://accounts.google.com", email: "ra@example.org", emailVerified: true };
  assert.equal(await me._handler(ctxAs(rows, stranger), {}), null);
  await assert.rejects(requireUser(ctxAs(rows, stranger), ["ra"]), /not active in this project/);
});
