// workos authkit sessions (2026-11-03): a workos user reaches the same users
// row as the google identity before it. users:claimInvite is the one place
// a workos user is bound to a row (workos_subject, the workos user id);
// before that claim, users:me and users:claimInvite find the row by the
// verified email claim, and every other function (requireUser) waits for
// it. once bound, only that workos user reaches the row, whichever issuer
// form its token carries and whatever its claims, so a recycled mailbox
// cannot. a workos identity with no email, or an unverified one, is refused
// on the email path with a reason; rows carrying the service role never
// open to a browser session; the google path matches auth_subject, claims
// only with a verified email, and takes back a row claimed through workos
// only while POW_AUTH_GOOGLE_ROLLBACK=1, never one bound to another google
// account
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { requireUser, isWorkosIdentity, workosVerifiedEmail } = await import("./lib/auth.ts");
const { me, claimInvite, adminUpsertUser } = await import("./users.ts");

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
      for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) delete row[key];
        else row[key] = value;
      }
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
const verified = (email, user, options = {}) => workos({ email, emailVerified: true }, { user, ...options });
const google = (sub, claims = {}) => ({ tokenIdentifier: `https://accounts.google.com|${sub}`, subject: sub, issuer: "https://accounts.google.com", ...claims });
const ctxAs = (rows, identity, options) => ({ auth: { async getUserIdentity() { return identity; } }, db: makeDb(rows, options) });
const row = (rows, id) => rows.users.find((user) => user._id === id);
const claim = (rows, identity, args = {}) => claimInvite._handler(ctxAs(rows, identity), args);
const NOT_EXPIRY = /Authentication required|Unauthenticated|JWT|token/i;

function withRollback(value, run) {
  const before = process.env.POW_AUTH_GOOGLE_ROLLBACK;
  if (value === undefined) delete process.env.POW_AUTH_GOOGLE_ROLLBACK;
  else process.env.POW_AUTH_GOOGLE_ROLLBACK = value;
  return Promise.resolve(run()).finally(() => {
    if (before === undefined) delete process.env.POW_AUTH_GOOGLE_ROLLBACK;
    else process.env.POW_AUTH_GOOGLE_ROLLBACK = before;
  });
}

test("a workos identity is recognised by either documented issuer", () => {
  assert.equal(isWorkosIdentity(workos()), true);
  assert.equal(isWorkosIdentity(workos({}, { issuer: "https://api.workos.com/" })), true);
  assert.equal(isWorkosIdentity({ tokenIdentifier: GOOGLE_RA, issuer: "https://accounts.google.com" }), false);
  // the identities the existing tests and pow-cli impersonation send
  assert.equal(isWorkosIdentity({ tokenIdentifier: "pow-cli-seed-service" }), false);
});

test("before the claim, users:me sees the row by email and requireUser waits", async () => {
  const rows = fixture();
  const identity = workos({ email: "RA@Example.org ", emailVerified: true }, { user: "user_ra" });
  assert.equal((await me._handler(ctxAs(rows, identity, { writable: false }), {}))._id, "ra_1");
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not active in this project/, "requireUser takes bound rows only");
  assert.equal(row(rows, "ra_1").workos_subject, undefined, "requireUser never binds");
});

test("claimInvite binds the workos user id; then the row's roles follow it", async () => {
  const rows = fixture();
  const identity = verified("ra@example.org", "user_ra");
  assert.equal(await claim(rows, identity), "ra_1");
  assert.equal(row(rows, "ra_1").workos_subject, "user_ra", "the key is the workos user id, without the issuer");
  assert.equal(row(rows, "ra_1").auth_subject, GOOGLE_RA, "the google identity stays");
  assert.equal(row(rows, "ra_1").status, "active");
  assert.equal((await requireUser(ctxAs(rows, identity), ["ra"]))._id, "ra_1");
  await assert.rejects(requireUser(ctxAs(rows, identity), ["pi"]), /Project role does not permit/);
  // the google identity still reaches the row while both providers run
  assert.equal((await requireUser(ctxAs(rows, { tokenIdentifier: GOOGLE_RA, issuer: "https://accounts.google.com" }), ["ra"]))._id, "ra_1");
  // a second claim on a bound, active row writes nothing
  const before = { ...row(rows, "ra_1") };
  assert.equal(await claim(rows, identity), "ra_1");
  assert.deepEqual(row(rows, "ra_1"), before);
});

test("a bound row is reached by either issuer form and without any email claim", async () => {
  const rows = fixture();
  await claim(rows, verified("ra@example.org", "user_ra"));
  for (const identity of [
    workos({}, { user: "user_ra" }),
    workos({}, { user: "user_ra", issuer: "https://api.workos.com/" }),
    workos({ email: "changed@example.org", emailVerified: false }, { user: "user_ra" }),
  ]) {
    assert.equal((await requireUser(ctxAs(rows, identity), ["ra"]))._id, "ra_1");
    assert.equal((await me._handler(ctxAs(rows, identity, { writable: false }), {}))._id, "ra_1");
    assert.equal(await claim(rows, identity), "ra_1");
  }
});

test("the claim names may arrive as raw custom claims", async () => {
  const rows = fixture();
  assert.equal(await claim(rows, workos({ email: "ra@example.org", email_verified: "true" }, { user: "user_ra" })), "ra_1");
});

test("a recycled mailbox: a second workos account with the same verified email is refused", async () => {
  const rows = fixture();
  await claim(rows, verified("ra@example.org", "user_original"));
  const newcomer = verified("ra@example.org", "user_newcomer");
  const linked = /ra@example\.org is already linked to another WorkOS account/;
  await assert.rejects(me._handler(ctxAs(rows, newcomer, { writable: false }), {}), linked);
  await assert.rejects(claim(rows, newcomer), linked);
  await assert.rejects(requireUser(ctxAs(rows, newcomer), ["ra"]), /not active in this project/);
  assert.equal(row(rows, "ra_1").workos_subject, "user_original", "the binding is not moved");
  try { await claim(rows, newcomer); } catch (error) { assert.doesNotMatch(error.message, NOT_EXPIRY); }
});

test("adminUpsertUser can unbind a row's workos account for a replacement account", async () => {
  const rows = fixture();
  await claim(rows, verified("ra@example.org", "user_original"));
  const result = await adminUpsertUser._handler(ctxAs(rows, null), { email: "ra@example.org", roles: ["ra"], clearWorkosSubject: true });
  assert.equal(result.user_id, "ra_1");
  assert.equal("workos_subject" in row(rows, "ra_1"), false);
  assert.equal(row(rows, "ra_1").status, "active", "status preserved");
  assert.equal(row(rows, "ra_1").auth_subject, GOOGLE_RA);
  assert.equal(await claim(rows, verified("ra@example.org", "user_replacement")), "ra_1");
  assert.equal(row(rows, "ra_1").workos_subject, "user_replacement");
  await assert.rejects(requireUser(ctxAs(rows, workos({}, { user: "user_original" })), ["ra"]), /not active in this project/);
  // without the flag the binding stays
  await adminUpsertUser._handler(ctxAs(rows, null), { email: "ra@example.org", roles: ["ra", "reviewer"] });
  assert.equal(row(rows, "ra_1").workos_subject, "user_replacement");
});

test("a workos identity with no email is refused on the email path with the reason", async () => {
  const rows = fixture();
  const identity = workos({ emailVerified: true }, { user: "user_unbound" });
  const reason = /carries no email address.*email claim to the WorkOS session template/;
  assert.throws(() => workosVerifiedEmail(identity), reason);
  await assert.rejects(me._handler(ctxAs(rows, identity), {}), reason);
  await assert.rejects(claim(rows, identity), reason);
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not active in this project/);
  // the portal treats messages naming a token or jwt as an expired sign-in
  // and hides them; the refusal must reach the person
  try { workosVerifiedEmail(identity); } catch (error) { assert.doesNotMatch(error.message, NOT_EXPIRY); }
});

test("a workos email that is not reported verified is refused", async () => {
  const rows = fixture();
  for (const flag of [undefined, false, "false"]) {
    const identity = workos({ email: "ra@example.org", ...(flag === undefined ? {} : { emailVerified: flag }) }, { user: "user_unverified" });
    await assert.rejects(claim(rows, identity), /not report ra@example\.org as verified/);
    await assert.rejects(me._handler(ctxAs(rows, identity), {}), /not report ra@example\.org as verified/);
    try { workosVerifiedEmail(identity); } catch (error) { assert.doesNotMatch(error.message, NOT_EXPIRY); }
  }
  assert.equal(row(rows, "ra_1").workos_subject, undefined);
});

test("a workos email naming no row reads as no user; claimInvite says no invitation", async () => {
  const rows = fixture();
  const identity = verified("stranger@example.org", "user_stranger");
  assert.equal(await me._handler(ctxAs(rows, identity), {}), null);
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not active in this project/);
  await assert.rejects(claim(rows, identity), /No project invitation found for stranger@example\.org/);
});

test("claimInvite through workos activates a pending invite, binds it and leaves auth_subject alone", async () => {
  const rows = fixture();
  const identity = workos({ email: "new@example.org", emailVerified: true, name: "New Person" }, { user: "user_new" });
  assert.equal(await claim(rows, identity, { initials: "NP" }), "inv_1");
  const invite = row(rows, "inv_1");
  assert.equal(invite.status, "active");
  assert.equal(invite.initials, "NP");
  assert.equal(invite.display_name, "New Person");
  assert.equal(invite.workos_subject, "user_new");
  assert.equal(invite.auth_subject, undefined);
  assert.equal((await requireUser(ctxAs(rows, identity), ["ra"]))._id, "inv_1");
});

test("a disabled row stays shut through workos", async () => {
  const rows = fixture();
  const identity = verified("gone@example.org", "user_gone");
  await assert.rejects(claim(rows, identity), /not active in this project/);
  await assert.rejects(requireUser(ctxAs(rows, identity), ["ra"]), /not active in this project/);
  assert.equal(row(rows, "off_1").status, "disabled");
  assert.equal(row(rows, "off_1").workos_subject, undefined);
});

test("an active row no one has signed in to does not open by email", async () => {
  const rows = fixture();
  const reason = /not set up for sign-in/;
  await assert.rejects(claim(rows, verified("bare@example.org", "user_bare")), reason);
  await assert.rejects(me._handler(ctxAs(rows, verified("bare@example.org", "user_bare")), {}), reason);
  await assert.rejects(claim(rows, google("google-sub-bare", { email: "bare@example.org", emailVerified: true })), /No pending project invitation/);
  assert.equal(row(rows, "bare_1").workos_subject, undefined);
  assert.equal(row(rows, "bare_1").auth_subject, undefined);
  // the documented remedy: make the row an invitation before the first sign-in
  await adminUpsertUser._handler(ctxAs(rows, null), { email: "bare@example.org", roles: ["ra"], status: "pending" });
  assert.equal(await claim(rows, verified("bare@example.org", "user_bare")), "bare_1");
  assert.equal(row(rows, "bare_1").status, "active");
});

test("no row carrying the service role can be reached by a workos email, mixed roles included", async () => {
  const rows = fixture();
  for (const [email, user] of [["service+claude@example.org", "user_svc"], ["mixed@example.org", "user_mixed"]]) {
    const identity = verified(email, user);
    await assert.rejects(me._handler(ctxAs(rows, identity), {}), /Service accounts cannot sign in/);
    await assert.rejects(claim(rows, identity), /Service accounts cannot sign in/);
    await assert.rejects(requireUser(ctxAs(rows, identity), ["admin", "service"]), /not active in this project/);
  }
  assert.equal(row(rows, "mixed_1").workos_subject, undefined);
  // a service row bound by hand stays shut too
  row(rows, "mixed_1").workos_subject = "user_mixed";
  await assert.rejects(requireUser(ctxAs(rows, workos({}, { user: "user_mixed" })), ["admin"]), /Service accounts cannot sign in/);
  // nor through google's email path
  await assert.rejects(claim(rows, google("google-sub-svc", { email: "service+claude@example.org", emailVerified: true })), /No pending project invitation/);
  assert.equal(row(rows, "svc_1").auth_subject, undefined);
});

test("two rows with one email: the lookup throws rather than pick one", async () => {
  const rows = fixture();
  rows.users.push({ _id: "dup_1", email: "ra@example.org", initials: "R2", roles: ["ra"], status: "pending" });
  await assert.rejects(me._handler(ctxAs(rows, verified("ra@example.org", "user_ra")), {}), /not unique/);
  await assert.rejects(claim(rows, verified("ra@example.org", "user_ra")), /not unique/);
  await assert.rejects(claim(rows, google("google-sub-new", { email: "ra@example.org", emailVerified: true })), /not unique/);
  assert.equal(row(rows, "ra_1").workos_subject, undefined);
});

test("google claimInvite needs an email google reports verified", async () => {
  const rows = fixture();
  for (const flag of [undefined, false]) {
    const identity = google("google-sub-new", { email: "new@example.org", ...(flag === undefined ? {} : { emailVerified: flag }) });
    await assert.rejects(claim(rows, identity), /Google does not report new@example\.org as verified/);
    try { await claim(rows, identity); } catch (error) { assert.doesNotMatch(error.message, NOT_EXPIRY); }
  }
  assert.equal(row(rows, "inv_1").status, "pending");
  assert.equal(await claim(rows, google("google-sub-new", { email: "new@example.org", emailVerified: true })), "inv_1");
  assert.equal(row(rows, "inv_1").auth_subject, "https://accounts.google.com|google-sub-new");
});

test("rollback: google takes back a workos-claimed row only while POW_AUTH_GOOGLE_ROLLBACK=1", async () => {
  const rows = fixture();
  await claim(rows, verified("new@example.org", "user_new"));
  const owner = google("google-sub-new", { email: "new@example.org", emailVerified: true });
  // off by default, and for any value but "1"
  for (const value of [undefined, "", "0", "true"]) {
    await withRollback(value, async () => {
      await assert.rejects(claim(rows, owner), /No pending project invitation/);
    });
  }
  assert.equal(row(rows, "inv_1").auth_subject, undefined);
  await withRollback("1", async () => {
    assert.equal(await claim(rows, owner), "inv_1");
    assert.equal(row(rows, "inv_1").auth_subject, owner.tokenIdentifier);
    assert.equal((await requireUser(ctxAs(rows, owner), ["ra"]))._id, "inv_1");
    // a second google account with the same verified email never takes it over
    const other = google("google-sub-other", { email: "new@example.org", emailVerified: true });
    await assert.rejects(claim(rows, other), /linked to another Google account/);
    assert.equal(row(rows, "inv_1").auth_subject, owner.tokenIdentifier);
    // nor a google-claimed row
    await assert.rejects(claim(rows, google("google-sub-x", { email: "ra@example.org", emailVerified: true })), /linked to another Google account/);
    assert.equal(row(rows, "ra_1").auth_subject, GOOGLE_RA);
  });
});

test("the switch: a google-claimed row is bound once by workos, then held against a second workos account", async () => {
  const rows = fixture();
  assert.equal(await claim(rows, verified("pi@example.org", "user_pi")), "pi_1");
  assert.equal(row(rows, "pi_1").workos_subject, "user_pi");
  await assert.rejects(claim(rows, verified("pi@example.org", "user_pi_2")), /already linked to another WorkOS account/);
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
