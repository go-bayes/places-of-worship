// workos authkit sessions (2026-11-03): a workos identity reaches the same
// users row as the google identity before it. before its first workos
// sign-in a row is found by the verified email claim; that sign-in binds the
// workos identity (workos_subject), and from then on only that identity
// reaches the row, so a recycled mailbox cannot. a workos identity with no
// email, or an unverified one, is refused with a reason; rows carrying the
// service role never open to a browser session; the google path matches
// auth_subject, claims only with a verified email, and can take back a row
// claimed through workos (the rollback) but never one bound to another
// google account
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { requireUser, isWorkosIdentity, workosVerifiedEmail } = await import("./lib/auth.ts");
const { me, claimInvite } = await import("./users.ts");

const CLIENT_ID = "client_01TEST";
const ISSUER = `https://api.workos.com/user_management/${CLIENT_ID}`;
const GOOGLE_RA = "https://accounts.google.com|google-sub-ra";

// a query's db reads only; a mutation's also patches
function makeDb(rows, { writable = true } = {}) {
  const db = {
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
  };
  if (writable) {
    db.patch = async (id, fields) => {
      const row = Object.values(rows).flat().find((entry) => entry._id === id);
      Object.assign(row, fields);
    };
  }
  return db;
}

function fixture() {
  return {
    users: [
      // claimed through google before the switch
      { _id: "ra_1", auth_subject: GOOGLE_RA, email: "ra@example.org", initials: "RA", roles: ["ra"], status: "active" },
      { _id: "pi_1", auth_subject: "https://accounts.google.com|google-sub-pi", email: "pi@example.org", initials: "PI", roles: ["pi", "reviewer"], status: "active" },
      // invited, never signed in
      { _id: "inv_1", email: "new@example.org", initials: "NW", roles: ["ra"], status: "pending" },
      // claimed through google, then disabled
      { _id: "off_1", auth_subject: "https://accounts.google.com|google-sub-off", email: "gone@example.org", initials: "GN", roles: ["ra"], status: "disabled" },
      // made active by adminUpsertUser and never signed in to
      { _id: "bare_1", email: "bare@example.org", initials: "BA", roles: ["ra"], status: "active" },
      // a human row that also carries the service role
      { _id: "mixed_1", auth_subject: "https://accounts.google.com|google-sub-mixed", email: "mixed@example.org", initials: "MX", roles: ["admin", "service"], status: "active" },
      // the seeding actor, and the impersonation row pow-cli uses
      { _id: "svc_1", email: "service+claude@example.org", initials: "AI", roles: ["service"], status: "active" },
      { _id: "seed_1", auth_subject: "pow-cli-seed-service", email: "seed@service.local", initials: "SD", roles: ["service"], status: "active" },
    ],
  };
}

const workos = (claims = {}, { issuer = ISSUER, user = "user_01WORKOS" } = {}) => ({
  tokenIdentifier: `${issuer}|${user}`,
  subject: user,
  issuer,
  ...claims,
});
const verified = (email, user) => workos({ email, emailVerified: true }, { user });
const google = (sub, claims = {}) => ({ tokenIdentifier: `https://accounts.google.com|${sub}`, subject: sub, issuer: "https://accounts.google.com", ...claims });
const ctxAs = (rows, identity, options) => ({ auth: { async getUserIdentity() { return identity; } }, db: makeDb(rows, options) });
const row = (rows, id) => rows.users.find((user) => user._id === id);
const NOT_EXPIRY = /Authentication required|Unauthenticated|JWT|token/i;

test("a workos identity is recognised by either documented issuer", () => {
  assert.equal(isWorkosIdentity(workos()), true);
  assert.equal(isWorkosIdentity(workos({}, { issuer: "https://api.workos.com/" })), true);
  assert.equal(isWorkosIdentity({ tokenIdentifier: GOOGLE_RA, issuer: "https://accounts.google.com" }), false);
  // the identities the existing tests and pow-cli impersonation send
  assert.equal(isWorkosIdentity({ tokenIdentifier: "pow-cli-seed-service" }), false);
});

test("a workos identity reaches the row the google identity claimed, by email, with its roles", async () => {
  const rows = fixture();
  const identity = workos({ email: "RA@Example.org ", emailVerified: true }, { user: "user_ra" });
  assert.equal((await me._handler(ctxAs(rows, identity, { writable: false }), {}))._id, "ra_1");
  const viaWorkos = await requireUser(ctxAs(rows, identity), ["ra"]);
  const viaGoogle = await requireUser(ctxAs(rows, { tokenIdentifier: GOOGLE_RA, issuer: "https://accounts.google.com" }), ["ra"]);
  assert.equal(viaWorkos._id, "ra_1");
  assert.equal(viaGoogle._id, "ra_1");
  await assert.rejects(requireUser(ctxAs(rows, identity), ["pi"]), /Project role does not permit/);
  const pi = await requireUser(ctxAs(rows, verified("pi@example.org", "user_pi")), ["pi"]);
  assert.equal(pi._id, "pi_1");
});

test("the claim names may arrive as raw custom claims", async () => {
  const rows = fixture();
  const user = await requireUser(ctxAs(rows, workos({ email: "ra@example.org", email_verified: "true" })), ["ra"]);
  assert.equal(user._id, "ra_1");
});

test("the first workos sign-in binds the row; a query never writes", async () => {
  const rows = fixture();
  const identity = verified("ra@example.org", "user_ra");
  await me._handler(ctxAs(rows, identity, { writable: false }), {});
  assert.equal(row(rows, "ra_1").workos_subject, undefined, "users:me is a query");
  // claimInvite, which the portal calls after the return from workos
  assert.equal(await claimInvite._handler(ctxAs(rows, identity), {}), "ra_1");
  assert.equal(row(rows, "ra_1").workos_subject, `${ISSUER}|user_ra`);
  assert.equal(row(rows, "ra_1").auth_subject, GOOGLE_RA, "the google identity stays");
  assert.equal(row(rows, "ra_1").status, "active");
  // or, should that call not have run, the first mutation through requireUser
  const other = fixture();
  await requireUser(ctxAs(other, verified("pi@example.org", "user_pi")), ["pi"]);
  assert.equal(row(other, "pi_1").workos_subject, `${ISSUER}|user_pi`);
});

test("a recycled mailbox: a second workos account with the same verified email is refused", async () => {
  const rows = fixture();
  await claimInvite._handler(ctxAs(rows, verified("ra@example.org", "user_original")), {});
  assert.equal(row(rows, "ra_1").workos_subject, `${ISSUER}|user_original`);
  const newcomer = verified("ra@example.org", "user_newcomer");
  const linked = /ra@example\.org is already linked to another WorkOS account/;
  await assert.rejects(me._handler(ctxAs(rows, newcomer, { writable: false }), {}), linked);
  await assert.rejects(requireUser(ctxAs(rows, newcomer), ["ra"]), linked);
  await assert.rejects(claimInvite._handler(ctxAs(rows, newcomer), {}), linked);
  assert.equal(row(rows, "ra_1").workos_subject, `${ISSUER}|user_original`, "the binding is not moved");
  try { await me._handler(ctxAs(rows, newcomer, { writable: false }), {}); } catch (error) { assert.doesNotMatch(error.message, NOT_EXPIRY); }
  // the bound identity still reaches its row, even after its email changes
  const moved = verified("ra-new-address@example.org", "user_original");
  assert.equal((await requireUser(ctxAs(rows, moved), ["ra"]))._id, "ra_1");
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
  try { workosVerifiedEmail(identity); } catch (error) { assert.doesNotMatch(error.message, NOT_EXPIRY); }
});

test("a workos email that is not reported verified is refused", async () => {
  const rows = fixture();
  for (const flag of [undefined, false, "false"]) {
    const identity = workos({ email: "ra@example.org", ...(flag === undefined ? {} : { emailVerified: flag }) });
    await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not report ra@example\.org as verified/);
    try { workosVerifiedEmail(identity); } catch (error) { assert.doesNotMatch(error.message, NOT_EXPIRY); }
  }
});

test("a workos email naming no row reads as no user; claimInvite says no invitation", async () => {
  const rows = fixture();
  const identity = verified("stranger@example.org", "user_stranger");
  assert.equal(await me._handler(ctxAs(rows, identity), {}), null);
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not active in this project/);
  await assert.rejects(claimInvite._handler(ctxAs(rows, identity), {}), /No project invitation found for stranger@example\.org/);
});

test("claimInvite through workos activates a pending invite, binds it and leaves auth_subject alone", async () => {
  const rows = fixture();
  const identity = workos({ email: "new@example.org", emailVerified: true, name: "New Person" }, { user: "user_new" });
  assert.equal(await claimInvite._handler(ctxAs(rows, identity), { initials: "NP" }), "inv_1");
  const invite = row(rows, "inv_1");
  assert.equal(invite.status, "active");
  assert.equal(invite.initials, "NP");
  assert.equal(invite.display_name, "New Person");
  assert.equal(invite.workos_subject, `${ISSUER}|user_new`);
  assert.equal(invite.auth_subject, undefined);
  assert.equal((await requireUser(ctxAs(rows, identity), ["ra"]))._id, "inv_1");
});

test("a disabled row stays shut through workos", async () => {
  const rows = fixture();
  const identity = verified("gone@example.org", "user_gone");
  await assert.rejects(claimInvite._handler(ctxAs(rows, identity), {}), /not active in this project/);
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not active in this project/);
  assert.equal(row(rows, "off_1").status, "disabled");
  assert.equal(row(rows, "off_1").workos_subject, undefined);
});

test("an active row no one has signed in to does not open by email", async () => {
  const rows = fixture();
  const reason = /not set up for sign-in/;
  await assert.rejects(requireUser(ctxAs(rows, verified("bare@example.org", "user_bare")), ["ra"]), reason);
  await assert.rejects(claimInvite._handler(ctxAs(rows, verified("bare@example.org", "user_bare")), {}), reason);
  await assert.rejects(claimInvite._handler(ctxAs(rows, google("google-sub-bare", { email: "bare@example.org", emailVerified: true })), {}), /No pending project invitation/);
  assert.equal(row(rows, "bare_1").workos_subject, undefined);
  assert.equal(row(rows, "bare_1").auth_subject, undefined);
});

test("no row carrying the service role can be reached by a workos email, mixed roles included", async () => {
  const rows = fixture();
  for (const [email, user] of [["service+claude@example.org", "user_svc"], ["mixed@example.org", "user_mixed"]]) {
    const identity = verified(email, user);
    await assert.rejects(requireUser(ctxAs(rows, identity), ["admin", "service"]), /Service accounts cannot sign in/);
    await assert.rejects(me._handler(ctxAs(rows, identity), {}), /Service accounts cannot sign in/);
    await assert.rejects(claimInvite._handler(ctxAs(rows, identity), {}), /Service accounts cannot sign in/);
  }
  assert.equal(row(rows, "mixed_1").workos_subject, undefined);
  // nor through google's email fallback
  await assert.rejects(claimInvite._handler(ctxAs(rows, google("google-sub-svc", { email: "service+claude@example.org", emailVerified: true })), {}), /No pending project invitation/);
  assert.equal(row(rows, "svc_1").auth_subject, undefined);
});

test("two rows with one email: the lookup throws rather than pick one", async () => {
  const rows = fixture();
  rows.users.push({ _id: "dup_1", email: "ra@example.org", initials: "R2", roles: ["ra"], status: "pending" });
  await assert.rejects(requireUser(ctxAs(rows, verified("ra@example.org", "user_ra")), ["ra"]), /not unique/);
  await assert.rejects(claimInvite._handler(ctxAs(rows, verified("ra@example.org", "user_ra")), {}), /not unique/);
  await assert.rejects(claimInvite._handler(ctxAs(rows, google("google-sub-new", { email: "ra@example.org", emailVerified: true })), {}), /not unique/);
  assert.equal(row(rows, "ra_1").workos_subject, undefined);
});

test("google claimInvite needs an email google reports verified", async () => {
  const rows = fixture();
  for (const flag of [undefined, false]) {
    const identity = google("google-sub-new", { email: "new@example.org", ...(flag === undefined ? {} : { emailVerified: flag }) });
    await assert.rejects(claimInvite._handler(ctxAs(rows, identity), {}), /Google does not report new@example\.org as verified/);
    try { await claimInvite._handler(ctxAs(rows, identity), {}); } catch (error) { assert.doesNotMatch(error.message, NOT_EXPIRY); }
  }
  assert.equal(row(rows, "inv_1").status, "pending");
  assert.equal(await claimInvite._handler(ctxAs(rows, google("google-sub-new", { email: "new@example.org", emailVerified: true })), {}), "inv_1");
  assert.equal(row(rows, "inv_1").auth_subject, "https://accounts.google.com|google-sub-new");
});

test("rollback: a row claimed through workos can be taken back through google, once, by its verified email", async () => {
  const rows = fixture();
  await claimInvite._handler(ctxAs(rows, verified("new@example.org", "user_new")), {});
  assert.equal(row(rows, "inv_1").auth_subject, undefined);
  // google: the row has a workos identity and no google identity yet
  const owner = google("google-sub-new", { email: "new@example.org", emailVerified: true });
  assert.equal(await claimInvite._handler(ctxAs(rows, owner), {}), "inv_1");
  assert.equal(row(rows, "inv_1").auth_subject, owner.tokenIdentifier);
  assert.equal((await requireUser(ctxAs(rows, owner), ["ra"]))._id, "inv_1");
  // a second google account with the same verified email never takes it over
  const other = google("google-sub-other", { email: "new@example.org", emailVerified: true });
  await assert.rejects(claimInvite._handler(ctxAs(rows, other), {}), /linked to another Google account/);
  assert.equal(row(rows, "inv_1").auth_subject, owner.tokenIdentifier);
  await assert.rejects(requireUser(ctxAs(rows, other), ["ra"]), /not active in this project/);
  // and a google-claimed row is never taken over by another google account
  await assert.rejects(claimInvite._handler(ctxAs(rows, google("google-sub-x", { email: "ra@example.org", emailVerified: true })), {}), /linked to another Google account/);
  assert.equal(row(rows, "ra_1").auth_subject, GOOGLE_RA);
});

test("the switch: a google-claimed row is bound once by workos, then held against a second workos account", async () => {
  const rows = fixture();
  assert.equal(await claimInvite._handler(ctxAs(rows, verified("pi@example.org", "user_pi")), {}), "pi_1");
  assert.equal(row(rows, "pi_1").workos_subject, `${ISSUER}|user_pi`);
  await assert.rejects(claimInvite._handler(ctxAs(rows, verified("pi@example.org", "user_pi_2")), {}), /already linked to another WorkOS account/);
  // the google identity still reaches the row while both providers run
  assert.equal((await requireUser(ctxAs(rows, google("google-sub-pi")), ["pi"]))._id, "pi_1");
});

test("the google path and the pow-cli seed-service impersonation are unchanged", async () => {
  const rows = fixture();
  assert.equal((await requireUser(ctxAs(rows, { tokenIdentifier: "pow-cli-seed-service" }), ["service"]))._id, "seed_1");
  // a google identity is matched by auth_subject only: its email is not read
  const stranger = { tokenIdentifier: "https://accounts.google.com|other", issuer: "https://accounts.google.com", email: "ra@example.org", emailVerified: true };
  assert.equal(await me._handler(ctxAs(rows, stranger), {}), null);
  await assert.rejects(requireUser(ctxAs(rows, stranger), ["ra"]), /not active in this project/);
  assert.equal(row(rows, "ra_1").workos_subject, undefined);
});
