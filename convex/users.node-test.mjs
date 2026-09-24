// clerk sessions (contributor-access brief c1): identity resolution through
// user_identities, the claimInvite rules of section 4.3.2, the lock-out
// repair, the admin reset, and the rollback cases of section 4.2 (a re-keyed
// member's google identifier still resolves to the same row; a retired link
// resolves nothing)
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { claimInvite, me, inviteUser, adminUpsertUser, adminResetAuthSubject, beginIdentityMigration } = await import("./users.ts");
const { requireUser, migrationSourceIssuers, allowlistedSourceIssuer } = await import("./lib/auth.ts");

const GOOGLE = "https://accounts.google.com";
const CLERK = "https://sure-lizard-50.clerk.accounts.dev";
const OTHER_CLERK = "https://other-instance.clerk.accounts.dev";

function identity(issuer, subject, email, { verified = true, name } = {}) {
  return { tokenIdentifier: `${issuer}|${subject}`, issuer, subject, email, emailVerified: verified, name };
}

function world({ allowlist = "", destination = CLERK } = {}) {
  process.env.CLERK_JWT_ISSUER_DOMAIN = destination ?? "";
  process.env.AUTH_MIGRATION_SOURCE_ISSUERS = allowlist;
  const rows = { users: [], user_identities: [], role_events: [], identity_migration_grants: [] };
  let caller = null;
  let counter = 0;
  const db = {
    query(table) {
      const filters = [];
      const q = { eq(key, value) { filters.push([key, value]); return q; } };
      const selected = () => rows[table].filter((row) => filters.every(([k, v]) => row[k] === v));
      const chain = {
        withIndex(_name, select) { if (select) select(q); return chain; },
        async unique() { const found = selected(); if (found.length > 1) throw new Error("unique() found several rows"); return found[0] ?? null; },
        async collect() { return selected(); },
        async first() { return selected()[0] ?? null; },
      };
      return chain;
    },
    async insert(table, value) {
      counter += 1;
      const id = `${table}_${counter}`;
      const row = { _id: id };
      for (const [key, entry] of Object.entries(value)) if (entry !== undefined) row[key] = entry;
      rows[table].push(row);
      return id;
    },
    async get(id) { return Object.values(rows).flat().find((row) => row._id === id) ?? null; },
    async patch(id, value) {
      const row = await db.get(id);
      for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined) delete row[key];
        else row[key] = entry;
      }
    },
  };
  const ctx = { db, auth: { async getUserIdentity() { return caller; } } };
  const as = (who) => { caller = who; return ctx; };
  const addUser = (fields) => {
    counter += 1;
    const row = { _id: `users_${counter}`, initials: "XX", created_at: 1, updated_at: 1, ...fields };
    rows.users.push(row);
    return row;
  };
  return { rows, ctx, as, addUser };
}

const claim = (ctx, migrationGrant) => claimInvite._handler(ctx, migrationGrant ? { migrationGrant } : {});
// r-c18: the member's google sign-in asks for a grant for its own row
const grantFor = async (w, google) => (await beginIdentityMigration._handler(w.as(google), {})).grant;
const lastEvent = (rows) => rows.role_events.at(-1);

test("a pending invitation activates on a verified clerk sign-in and records the claim", async () => {
  const w = world();
  const invite = w.addUser({ email: "ra@example.org", roles: ["ra"], status: "pending" });
  const who = identity(CLERK, "user_1", "RA@example.org");
  assert.equal(await claim(w.as(who)), invite._id);
  assert.equal(invite.status, "active");
  assert.equal(invite.auth_subject, who.tokenIdentifier);
  assert.equal(lastEvent(w.rows).reason, "claim");
  assert.equal(lastEvent(w.rows).from_status, "pending");
  assert.equal(lastEvent(w.rows).to_status, "active");
  assert.equal((await me._handler(w.as(who), {}))._id, invite._id);
  assert.equal((await requireUser(w.as(who), ["ra"]))._id, invite._id);
});

test("an unverified email activates nothing", async () => {
  const w = world();
  const invite = w.addUser({ email: "ra@example.org", roles: ["ra"], status: "pending" });
  await assert.rejects(claim(w.as(identity(CLERK, "user_1", "ra@example.org", { verified: false }))), /Verify this email address/);
  await assert.rejects(claim(w.as({ ...identity(CLERK, "user_1", "ra@example.org"), emailVerified: undefined })), /Verify this email address/);
  assert.equal(invite.status, "pending");
  assert.equal(invite.auth_subject, undefined);
  assert.equal(w.rows.role_events.length, 0);
});

test("an uninvited applicant is refused and sees no project user", async () => {
  const w = world({ allowlist: GOOGLE });
  const who = identity(CLERK, "stranger", "stranger@example.org");
  await assert.rejects(claim(w.as(who)), /No pending project invitation found for this email/);
  assert.equal(await me._handler(w.as(who), {}), null);
  await assert.rejects(requireUser(w.as(who), ["ra"]), /not active/);
});

test("disabled and service rows never activate or re-key by sign-in", async () => {
  const w = world({ allowlist: GOOGLE });
  w.addUser({ email: "gone@example.org", roles: ["ra"], status: "disabled", auth_subject: `${GOOGLE}|g-gone` });
  w.addUser({ email: "agent@service.local", roles: ["service"], status: "active" });
  w.addUser({ email: "pending-service@service.local", roles: ["service", "ra"], status: "pending" });
  await assert.rejects(claim(w.as(identity(CLERK, "a", "gone@example.org"))), /No pending project invitation/);
  await assert.rejects(claim(w.as(identity(CLERK, "b", "agent@service.local"))), /No pending project invitation/);
  await assert.rejects(claim(w.as(identity(CLERK, "c", "pending-service@service.local"))), /No pending project invitation/);
  assert.equal(w.rows.user_identities.length, 0);
  assert.equal(w.rows.role_events.length, 0);
});

test("re-keying is refused while the migration allowlist is empty", async () => {
  const w = world({ allowlist: "" });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra", "reviewer"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(claim(w.as(identity(CLERK, "user_guy", "guy@example.org"))), /No pending project invitation/);
  assert.equal(member.auth_subject, `${GOOGLE}|g-guy`);
  assert.equal(w.rows.user_identities.length, 0);
  // the member's google sign-in is untouched
  assert.equal((await requireUser(w.as(identity(GOOGLE, "g-guy", "guy@example.org")), ["ra"]))._id, member._id);
});

test("an allowlisted google member re-keys to clerk, and the google identifier still resolves (rollback)", async () => {
  const w = world({ allowlist: GOOGLE });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra", "reviewer"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const clerk = identity(CLERK, "user_guy", "guy@example.org");
  const grant = await grantFor(w, identity(GOOGLE, "g-guy", "guy@example.org"));
  assert.equal(await claim(w.as(clerk), grant), member._id);
  assert.equal(member.auth_subject, clerk.tokenIdentifier);
  assert.deepEqual(member.roles, ["ra", "reviewer"]);
  assert.equal(member.status, "active");
  assert.equal(w.rows.user_identities.length, 1);
  const link = w.rows.user_identities[0];
  assert.equal(link.token_identifier, `${GOOGLE}|g-guy`);
  assert.equal(link.issuer, GOOGLE);
  assert.equal(link.linked_reason, "auth_provider_migration");
  assert.equal(link.user_id, member._id);
  const event = lastEvent(w.rows);
  assert.deepEqual(w.rows.role_events.map((row) => row.reason), ["migration_grant_issued", "migration_grant_consumed", "auth_provider_migration"]);
  assert.ok(w.rows.role_events.every((row) => !String(row.note || "").includes(grant)), "no secret in any event");
  assert.ok(w.rows.identity_migration_grants[0].consumed_at, "the grant is spent");
  assert.equal(event.reason, "auth_provider_migration");
  assert.equal(event.from_status, "active");
  assert.equal(event.to_status, "active");
  assert.match(event.note, /accounts\.google\.com.*clerk\.accounts\.dev/);
  // both providers now reach the same row, whichever signed the token
  const google = identity(GOOGLE, "g-guy", "guy@example.org");
  assert.equal((await requireUser(w.as(google), ["reviewer"]))._id, member._id);
  assert.equal((await me._handler(w.as(google), {}))._id, member._id);
  assert.equal(await claim(w.as(google)), member._id);
  assert.equal((await requireUser(w.as(clerk), ["reviewer"]))._id, member._id);
  // a second claim changes nothing
  assert.equal(await claim(w.as(clerk)), member._id);
  assert.equal(w.rows.user_identities.length, 1);
  assert.equal(w.rows.role_events.length, 3);
});

test("re-keying needs the exact destination issuer and an allowlisted source", async () => {
  const other = world({ allowlist: GOOGLE });
  other.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(claim(other.as(identity(OTHER_CLERK, "u", "guy@example.org"))), /No pending project invitation/);

  const unset = world({ allowlist: GOOGLE, destination: "" });
  unset.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(claim(unset.as(identity(CLERK, "u", "guy@example.org"))), /No pending project invitation/);

  const notListed = world({ allowlist: OTHER_CLERK });
  notListed.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(claim(notListed.as(identity(CLERK, "u", "guy@example.org"))), /No pending project invitation/);

  // a trailing slash on either value does not matter
  const slashed = world({ allowlist: `${GOOGLE}/`, destination: `${CLERK}/` });
  const member = slashed.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const slashedGrant = await grantFor(slashed, identity(GOOGLE, "g-guy", "guy@example.org"));
  assert.equal(await claim(slashed.as(identity(CLERK, "u", "guy@example.org")), slashedGrant), member._id);

  // an unverified clerk email never re-keys
  const unverified = world({ allowlist: GOOGLE });
  const kept = unverified.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(claim(unverified.as(identity(CLERK, "u", "guy@example.org", { verified: false }))), /Verify this email address/);
  assert.equal(kept.auth_subject, `${GOOGLE}|g-guy`);
});

test("an identifier already held by a link does not re-key another row", async () => {
  const w = world({ allowlist: GOOGLE });
  const first = w.addUser({ email: "a@example.org", roles: ["ra"], status: "active", auth_subject: `${CLERK}|user_x` });
  const second = w.addUser({ email: "b@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-b` });
  w.rows.user_identities.push({ _id: "user_identities_retired", user_id: first._id, token_identifier: `${CLERK}|user_y`, issuer: CLERK, linked_at: 1, linked_reason: "admin_relink", retired_at: 2 });
  await assert.rejects(claim(w.as(identity(CLERK, "user_y", "b@example.org"))), /No pending project invitation/);
  assert.equal(second.auth_subject, `${GOOGLE}|g-b`);
});

test("the admin reset retires links, so the old google identifier resolves nothing; the member claims again", async () => {
  const w = world({ allowlist: GOOGLE });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra", "reviewer"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const grant = await grantFor(w, identity(GOOGLE, "g-guy", "guy@example.org"));
  assert.equal(await claim(w.as(identity(CLERK, "user_guy", "guy@example.org")), grant), member._id);
  assert.equal(member.auth_subject, `${CLERK}|user_guy`);
  const reset = await adminResetAuthSubject._handler(w.ctx, { email: "guy@example.org", note: "stuck after device change" });
  assert.deepEqual(reset, { user_id: member._id, retired_links: 1 });
  assert.equal(member.status, "pending");
  assert.equal(member.auth_subject, undefined);
  assert.deepEqual(member.roles, ["ra", "reviewer"]);
  assert.equal(w.rows.user_identities[0].retired_reason, "auth_subject_reset");
  assert.equal(lastEvent(w.rows).reason, "auth_subject_reset");
  // the retired google link refuses
  const google = identity(GOOGLE, "g-guy", "guy@example.org");
  assert.equal(await me._handler(w.as(google), {}), null);
  await assert.rejects(requireUser(w.as(google), ["ra"]), /not active/);
  // rule 4: the pending row activates on a fresh verified claim, same _id
  assert.equal(await claim(w.as(identity(CLERK, "user_guy_new", "guy@example.org"))), member._id);
  assert.equal(member.status, "active");
  assert.equal(member.auth_subject, `${CLERK}|user_guy_new`);
});

test("the admin reset never touches service or disabled rows", async () => {
  const w = world();
  w.addUser({ email: "agent@service.local", roles: ["service"], status: "active" });
  w.addUser({ email: "gone@example.org", roles: ["ra"], status: "disabled", auth_subject: `${GOOGLE}|g` });
  await assert.rejects(adminResetAuthSubject._handler(w.ctx, { email: "agent@service.local" }), /Service identities/);
  await assert.rejects(adminResetAuthSubject._handler(w.ctx, { email: "gone@example.org" }), /disabled/);
  await assert.rejects(adminResetAuthSubject._handler(w.ctx, { email: "nobody@example.org" }), /No project user/);
});

test("inviteUser on an active member no longer locks them out, and records the inviter", async () => {
  const w = world();
  const admin = w.addUser({ email: "jb@example.org", roles: ["admin"], status: "active", auth_subject: `${CLERK}|jb` });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${CLERK}|guy` });
  await inviteUser._handler(w.as(identity(CLERK, "jb", "jb@example.org")), { email: "guy@example.org", roles: ["ra", "reviewer"] });
  assert.equal(member.status, "pending");
  const invite = lastEvent(w.rows);
  assert.equal(invite.reason, "invite");
  assert.equal(invite.actor_user_id, admin._id);
  assert.deepEqual(invite.from_roles, ["ra"]);
  assert.deepEqual(invite.to_roles, ["ra", "reviewer"]);
  // the member's own sign-in finds the pending row by subject
  const guy = identity(CLERK, "guy", "guy@example.org");
  await assert.rejects(claim(w.as({ ...guy, emailVerified: false })), /Verify this email address/);
  await assert.rejects(claim(w.as({ ...guy, email: "other@example.org" })), /No pending project invitation/);
  assert.equal(await claim(w.as(guy)), member._id);
  assert.equal(member.status, "active");
  assert.equal(lastEvent(w.rows).reason, "claim");
  assert.equal((await requireUser(w.as(guy), ["reviewer"]))._id, member._id);
  // a brand-new invitation writes a creating event
  const created = await inviteUser._handler(w.as(identity(CLERK, "jb", "jb@example.org")), { email: "new@example.org", roles: ["ra"] });
  const createdEvent = lastEvent(w.rows);
  assert.equal(createdEvent.user_id, created);
  assert.equal(createdEvent.from_status, undefined);
  assert.equal(createdEvent.to_status, "pending");
});

test("a pending row still bound to another identifier moves only on the re-keying conditions", async () => {
  const closed = world({ allowlist: "" });
  const member = closed.addUser({ email: "guy@example.org", roles: ["ra"], status: "pending", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(claim(closed.as(identity(CLERK, "user_guy", "guy@example.org"))), /bound to another sign-in method/);
  assert.equal(member.auth_subject, `${GOOGLE}|g-guy`);
  // the google sign-in still activates it (the lock-out repair)
  assert.equal(await claim(closed.as(identity(GOOGLE, "g-guy", "guy@example.org"))), member._id);
  assert.equal(member.status, "active");

  const open = world({ allowlist: GOOGLE });
  const moved = open.addUser({ email: "guy@example.org", roles: ["ra"], status: "pending", auth_subject: `${GOOGLE}|g-guy` });
  // with the move open, the clerk sign-in is asked for the google confirmation
  await assert.rejects(claim(open.as(identity(CLERK, "user_guy", "guy@example.org"))), /Confirm that Google account first/);
  const pendingGrant = await grantFor(open, identity(GOOGLE, "g-guy", "guy@example.org"));
  assert.equal(await claim(open.as(identity(CLERK, "user_guy", "guy@example.org")), pendingGrant), moved._id);
  assert.equal(moved.status, "active");
  assert.equal(moved.auth_subject, `${CLERK}|user_guy`);
  assert.equal(open.rows.user_identities[0].token_identifier, `${GOOGLE}|g-guy`);
  assert.equal((await requireUser(open.as(identity(GOOGLE, "g-guy", "guy@example.org")), ["ra"]))._id, moved._id);
});

test("adminUpsertUser records creations and role or status changes, not no-op repairs", async () => {
  const w = world();
  const created = await adminUpsertUser._handler(w.ctx, { email: "agent@service.local", roles: ["service"], status: "active" });
  assert.equal(created.created, true);
  assert.equal(lastEvent(w.rows).reason, "invite");
  assert.equal(lastEvent(w.rows).to_status, "active");
  await adminUpsertUser._handler(w.ctx, { email: "agent@service.local", roles: ["service"], displayName: "Agent" });
  assert.equal(w.rows.role_events.length, 1);
  await adminUpsertUser._handler(w.ctx, { email: "agent@service.local", roles: ["service", "ra"] });
  assert.equal(lastEvent(w.rows).reason, "role_change");
  assert.deepEqual(lastEvent(w.rows).to_roles, ["service", "ra"]);
});

test("the allowlist parses separators and an empty value disables re-keying", () => {
  assert.deepEqual(migrationSourceIssuers({ AUTH_MIGRATION_SOURCE_ISSUERS: "" }), []);
  assert.deepEqual(migrationSourceIssuers({}), []);
  assert.deepEqual(migrationSourceIssuers({ AUTH_MIGRATION_SOURCE_ISSUERS: ` ${GOOGLE}/ , ${CLERK}` }), [GOOGLE, CLERK]);
  assert.equal(allowlistedSourceIssuer(`${GOOGLE}|123`, [GOOGLE]), GOOGLE);
  assert.equal(allowlistedSourceIssuer(`${GOOGLE}.evil|123`, [GOOGLE]), undefined);
  assert.equal(allowlistedSourceIssuer(undefined, [GOOGLE]), undefined);
});

test("a caller already bound to a row is resolved without writes, verified or not (greptile 4091515504)", async () => {
  const w = world({ allowlist: GOOGLE });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const grant = await grantFor(w, identity(GOOGLE, "g-guy", "guy@example.org"));
  assert.equal(await claim(w.as(identity(CLERK, "user_guy", "guy@example.org")), grant), member._id);
  assert.equal(member.auth_subject, `${CLERK}|user_guy`);
  const before = JSON.stringify(w.rows);
  // the linked google identifier, now presenting an unverified email
  const unverified = identity(GOOGLE, "g-guy", "guy@example.org", { verified: false });
  assert.equal(await claim(w.as(unverified)), member._id);
  assert.equal(JSON.stringify(w.rows), before, "no row changes on the resolved path");
  // requireUser admits the same identifier on the same basis
  assert.equal((await requireUser(w.as(unverified), ["ra"]))._id, member._id);
  // a disabled row is returned unchanged and still refused by requireUser
  const gone = w.addUser({ email: "gone@example.org", roles: ["ra"], status: "disabled", auth_subject: `${CLERK}|gone` });
  const goneWho = identity(CLERK, "gone", "gone@example.org", { verified: false });
  assert.equal(await claim(w.as(goneWho)), gone._id);
  assert.equal(gone.status, "disabled");
  await assert.rejects(requireUser(w.as(goneWho), ["ra"]), /not active/);
});

// r-c18 (jb 2026-09-24, option 1): a grant issued to the member's google
// sign-in is the only way a google-bound row re-keys to clerk
test("r-c18: a verified email alone never re-keys a google-bound row, even with the allowlist set", async () => {
  const w = world({ allowlist: GOOGLE });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra", "pi"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(claim(w.as(identity(CLERK, "mailbox_holder", "guy@example.org"))), /Confirm that Google account first/);
  await assert.rejects(claim(w.as(identity(CLERK, "mailbox_holder", "guy@example.org")), "not-a-grant"), /expired or was already used/);
  assert.equal(member.auth_subject, `${GOOGLE}|g-guy`);
  assert.equal(w.rows.user_identities.length, 0);
  assert.equal(w.rows.role_events.length, 0);
});

test("r-c18: only a google sign-in that is the row's current identifier can ask for a grant", async () => {
  const w = world({ allowlist: GOOGLE });
  w.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  w.addUser({ email: "gone@example.org", roles: ["ra"], status: "disabled", auth_subject: `${GOOGLE}|g-gone` });
  w.addUser({ email: "agent@service.local", roles: ["service"], status: "active", auth_subject: `${GOOGLE}|g-agent` });
  const ask = (who) => beginIdentityMigration._handler(w.as(who), {});
  await assert.rejects(ask(identity(CLERK, "user_guy", "guy@example.org")), /Only a Google sign-in/, "a clerk caller is refused");
  await assert.rejects(ask(identity(OTHER_CLERK, "x", "guy@example.org")), /Only a Google sign-in/);
  await assert.rejects(ask(identity(GOOGLE, "g-stranger", "guy@example.org")), /not a project member's current sign-in/, "another google account with the same email is refused");
  await assert.rejects(ask(identity(GOOGLE, "g-gone", "gone@example.org")), /not a project member's current sign-in/);
  await assert.rejects(ask(identity(GOOGLE, "g-agent", "agent@service.local")), /not a project member's current sign-in/);
  const unauthenticated = { ...w.ctx, auth: { async getUserIdentity() { return null; } } };
  await assert.rejects(beginIdentityMigration._handler(unauthenticated, {}), /Authentication required/);
  // closed window: no grants at all
  const closed = world({ allowlist: "" });
  closed.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(beginIdentityMigration._handler(closed.as(identity(GOOGLE, "g-guy", "guy@example.org")), {}), /only while the move is open/);
  const unconfigured = world({ allowlist: GOOGLE, destination: "" });
  unconfigured.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  await assert.rejects(beginIdentityMigration._handler(unconfigured.as(identity(GOOGLE, "g-guy", "guy@example.org")), {}), /not configured/);
});

test("r-c18: the grant stores only a hash, expires in ten minutes, and records its issue", async () => {
  const w = world({ allowlist: GOOGLE });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const before = Date.now();
  const issued = await beginIdentityMigration._handler(w.as(identity(GOOGLE, "g-guy", "guy@example.org")), {});
  assert.match(issued.grant, /^[0-9a-f]{60,}$/);
  const row = w.rows.identity_migration_grants[0];
  assert.equal(row.user_id, member._id);
  assert.equal(row.source_token_identifier, `${GOOGLE}|g-guy`);
  assert.notEqual(row.secret_hash, issued.grant);
  assert.ok(!JSON.stringify(w.rows).includes(issued.grant), "the secret is stored nowhere");
  assert.ok(row.expires_at - before >= 10 * 60 * 1000 - 50 && row.expires_at - before <= 10 * 60 * 1000 + 1000);
  assert.equal(issued.expires_at, row.expires_at);
  assert.equal(lastEvent(w.rows).reason, "migration_grant_issued");
});

test("r-c18: an expired grant is refused", async () => {
  const w = world({ allowlist: GOOGLE });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const grant = await grantFor(w, identity(GOOGLE, "g-guy", "guy@example.org"));
  w.rows.identity_migration_grants[0].expires_at = Date.now() - 1;
  await assert.rejects(claim(w.as(identity(CLERK, "user_guy", "guy@example.org")), grant), /expired or was already used/);
  assert.equal(member.auth_subject, `${GOOGLE}|g-guy`);
});

test("r-c18: a grant is single use, and a newer grant revokes the older", async () => {
  const w = world({ allowlist: GOOGLE });
  const member = w.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const google = identity(GOOGLE, "g-guy", "guy@example.org");
  const first = await grantFor(w, google);
  const second = await grantFor(w, google);
  assert.ok(w.rows.identity_migration_grants[0].revoked_at, "the older grant is revoked");
  await assert.rejects(claim(w.as(identity(CLERK, "user_guy", "guy@example.org")), first), /expired or was already used/);
  assert.equal(await claim(w.as(identity(CLERK, "user_guy", "guy@example.org")), second), member._id);
  // the same grant cannot move the row again, e.g. to a second clerk account
  const again = world({ allowlist: GOOGLE });
  const other = again.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const once = await grantFor(again, identity(GOOGLE, "g-guy", "guy@example.org"));
  assert.equal(await claim(again.as(identity(CLERK, "user_guy", "guy@example.org")), once), other._id);
  other.auth_subject = `${GOOGLE}|g-guy`; // as if restored by hand; the grant is still spent
  await assert.rejects(claim(again.as(identity(CLERK, "user_guy_2", "guy@example.org")), once), /expired or was already used/);
});

test("r-c18: a grant for one row never re-keys another", async () => {
  const w = world({ allowlist: GOOGLE });
  w.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const victim = w.addUser({ email: "jw@example.org", roles: ["pi"], status: "active", auth_subject: `${GOOGLE}|g-jw` });
  const guysGrant = await grantFor(w, identity(GOOGLE, "g-guy", "guy@example.org"));
  await assert.rejects(claim(w.as(identity(CLERK, "attacker", "jw@example.org")), guysGrant), /expired or was already used/);
  assert.equal(victim.auth_subject, `${GOOGLE}|g-jw`);
  // nor a row whose identifier changed after the grant was issued
  const moved = world({ allowlist: GOOGLE });
  const row = moved.addUser({ email: "guy@example.org", roles: ["ra"], status: "active", auth_subject: `${GOOGLE}|g-guy` });
  const grant = await grantFor(moved, identity(GOOGLE, "g-guy", "guy@example.org"));
  row.auth_subject = `${GOOGLE}|g-guy-new`;
  await assert.rejects(claim(moved.as(identity(CLERK, "user_guy", "guy@example.org")), grant), /expired or was already used/);
});
