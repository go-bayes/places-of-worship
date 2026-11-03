# WorkOS sessions for the portals

Status: built 2026-11-03, switched off until the project lead sets the client ID. This page is for maintainers: what the code does, the one-time WorkOS and Convex setup, and the switch.

## Why

The contributor portal (`apps/regions/nz/verification.html`) and the review portal (`apps/regions/nz/review.html`) sign in with a Google ID token. The token lasts one hour, and only Google One Tap can renew it, which iOS Safari declines, so contributors in the field are signed out mid-entry. WorkOS AuthKit issues a short access token together with a refresh token, and renews the access token silently. People still sign in with Google, now through WorkOS's Google connection, and the project's own roster and roles (`users`, `ra`, `pi` and the rest) are unchanged.

## How it works

- **One switch.** `workosClientId` in `apps/regions/nz/js/convex-config.js` is read by both portals and by the callback page. Empty, the portals keep the Google ID token exactly as before. Set to the WorkOS client ID (`client_01…`, not a secret), both portals sign in through WorkOS.
- **The library.** `apps/vendor/authkit-js@0.20.5/dist/authkit.iife.min.js`, a browser build of `@workos-inc/authkit-js` 0.20.5; its README records the provenance and build. `apps/regions/nz/js/convex-task-client.js` creates the AuthKit client with `devMode: true`. The refresh token is therefore kept in the page's local storage. The library's production mode renews through a cookie on `api.workos.com`, which iOS Safari blocks as a third-party cookie, so it would sign people out in the very case this change is for. The strict content security policy on every page is the mitigation for keeping a refresh token in local storage. A custom authentication domain (WorkOS, $99 a month) would let the cookie be first-party, and is the planned upgrade when open sign-up arrives.
- **Sign-in.** The sign-in card shows a **Sign in with Google** button. It records the page and the contributor's initials in the tab's session storage and calls `authkit.signIn()`, which goes to the WorkOS hosted page; Google sits behind it. WorkOS returns to `apps/regions/nz/auth-callback.html`, one page for both portals, which exchanges the code and goes back to the page that started the sign-in, query string included. The return address is checked to be on the same site.
- **Each request.** Before each Convex request the client asks `authkit.getAccessToken()`, which renews the access token when it is close to expiry. A session AuthKit cannot renew signs the client out, and the request reports "Your sign-in expired. Sign in again, then retry.", the message the portals already handle. A network failure keeps the session for a retry.
- **Reloads.** A kept refresh token restores the session on the next page load, as a kept Google token did, so the device-restore paths (saved drafts, pin resume) are unchanged. The first load after a sign-in claims the row before any other request (see "Backend").
- **Sign-out.** The sign-out button calls `authkit.signOut({ navigate: false, returnTo })`, with `returnTo` the contributor portal on the page's own origin: the session ends at WorkOS, the refresh token leaves the device, and the portal clears its own state as before.

## Backend

`convex/auth.config.ts` accepts three providers: Google, as before, and the two WorkOS issuers that Convex's AuthKit guide lists (`https://api.workos.com/` with the client ID as audience, and `https://api.workos.com/user_management/<client ID>`), both checked against the WorkOS keys for the client ID. Google stays during the switch, so a contributor signed in with Google is not locked out; removing it is a later step.

A WorkOS token names the person by a WorkOS user ID (the token's `sub`), which no row holds before that person's first WorkOS sign-in: a row claimed through Google keeps Google's identifier in `auth_subject`, and an invitation holds only an email. `findUserForIdentity` in `convex/lib/auth.ts` therefore works in two stages:

- **Bound rows.** A WorkOS identity first looks for the row whose `workos_subject` (a new optional field, with the index `by_workos_subject`) holds its WorkOS user ID. The key leaves out the issuer, because both accepted issuer forms name the same user. This lookup reads no email claim, so a bound row does not depend on the JWT template.
- **Rows not yet bound.** Otherwise, in `users:me` and `users:claimInvite` only, it looks for the row its verified email names. `users:claimInvite` is the one place a WorkOS user is bound: it records the user ID in `workos_subject`. From then on only that WorkOS account reaches the row, so a verified email ceases to be a standing credential: a recycled mailbox, or a second WorkOS account with the same address, is refused.
- **Everything else** goes through `requireUser`, which takes bound rows only. An unclaimed WorkOS session can therefore name its row (`users:me`) and claim it, and nothing more. The portal claims before any other request, after every sign-in and on the first load of a device that has not claimed for that WorkOS user (`powWorkosClaimed:v1` in local storage, cleared at sign-out). A claim the backend refuses is not asked again for the rest of the page's life.

A Google identity is matched by `auth_subject`, as before, so a person who signed in with Google before the switch reaches the same row, roles and work through WorkOS once claimed. The WorkOS email path:

- refuses a token without an `email` claim, with a message that names the missing claim;
- refuses an email that WorkOS does not report as verified (`email_verified`);
- refuses an email that names a row already bound to another WorkOS account;
- refuses any row carrying the `service` role, mixed roles included, since service accounts never sign in;
- refuses an active row that no one has signed in to (no `auth_subject` and no `workos_subject`), such as an actor made by `adminUpsertUser`. To let a person sign in to such a row, make it an invitation before their first sign-in: run `users:adminUpsertUser` with `status: "pending"`, or `users:inviteUser`;
- leaves `auth_subject` untouched.

Google's `claimInvite` now claims only with an email Google reports as verified, and binds `auth_subject` on a pending invitation, as before. A row bound to another Google account is never taken over.

The residual exposure is the same in both directions: a row the other provider has not bound yet can be reached once by its verified email. A pending invitation can be claimed by either provider; a row claimed through Google can be claimed by WorkOS until its `workos_subject` is set; and, during a rollback only (below), a row claimed through WorkOS can be claimed by Google until its `auth_subject` is set.

`adminUpsertUser`, the email-keyed roster and the `pow-cli-seed-service` impersonation path are otherwise unchanged. `convex/workos-identity.node-test.mjs` covers the mapping, the binding, the recycled mailbox, duplicate emails, the unbinding and the rollback flag.

### Unbinding a WorkOS account

A person who replaces their WorkOS account (a new Google account, say) is refused, because their row is bound to the old one. To release the row, run `users:adminUpsertUser` with the row's email, its current roles and `clearWorkosSubject: true`, for example `npx convex run users:adminUpsertUser '{"email":"ra@example.org","roles":["ra"],"clearWorkosSubject":true}'` against the deployment. Alternatively, delete the `workos_subject` field on the row in the Convex dashboard's data view. Status and roles are kept, and the person's next WorkOS sign-in binds the new account by its verified email. Both are deployment data changes and need the project lead's instruction.

### Rolling back to Google

Setting `workosClientId` back to empty returns the portals to Google sign-in. A person whose invitation was first claimed through WorkOS has no Google identity on their row, and Google's `claimInvite` refuses them by default, because a claim by email on such a row is a takeover path for every WorkOS-claimed row while Google is accepted. During an actual rollback only, the project lead sets `POW_AUTH_GOOGLE_ROLLBACK=1` on the deployment. Google's `claimInvite` then binds an active row that is bound only to WorkOS (`workos_subject` set, no `auth_subject`) to the Google account with its verified email. The lead removes the variable once those people have signed in. The code only reads the variable, and nothing in the repository sets it.

### Later steps

- **Remove the Google provider** from `convex/auth.config.ts`, with the Google path in `convex/lib/auth.ts` and `users:claimInvite`, once every active contributor has signed in through WorkOS and the switch has held for a month. Earliest review: 2026-12-15.
- A custom authentication domain for AuthKit, at step 2 (open sign-up).

## One-time setup

### WorkOS dashboard

WorkOS keeps a staging and a production environment, each with its own client ID. The client ID in `convex-config.js` and `WORKOS_CLIENT_ID` on the Convex deployment must name the same environment. Staging accepts `http` addresses on the local machine; production expects `https`.

1. **Redirects.** Add the callback addresses as redirect URIs, and make the live one the default:
   - `https://religionmap.org/apps/regions/nz/auth-callback.html` (live)
   - `http://localhost:8765/apps/regions/nz/auth-callback.html` and `http://127.0.0.1:8765/apps/regions/nz/auth-callback.html` (local checks, in the environment that allows them)
2. **Sign-out redirects.** Add `https://religionmap.org/apps/regions/nz/verification.html` and `http://localhost:8765/apps/regions/nz/verification.html`. The client asks WorkOS to return to `verification.html` on the page's own origin (`workosSignOutUri` in `convex-task-client.js`). The portal stays on its page; the redirect only answers the sign-out request.
3. **CORS.** Add the allowed web origins `https://religionmap.org`, `http://localhost:8765` and `http://127.0.0.1:8765`. AuthKit's code exchange and renewal are browser fetches to `api.workos.com`, which answers only listed origins.
4. **Google.** Enable Google as an authentication method (Authentication, OAuth providers, Google). The staging environment works with WorkOS's default Google credentials; production needs the project's own Google OAuth client ID and secret, with WorkOS's callback address added to that Google client. Turn off the other methods for now, so Google is the only way in.
5. **JWT template.** WorkOS access tokens carry no email by default. Under Authentication, the sessions JWT template, paste:

   ```json
   {
     "email": {{ user.email }},
     "email_verified": {{ user.email_verified }},
     "name": "{{ user.first_name }} {{ user.last_name }}"
   }
   ```

   If the dashboard refuses the bare boolean, use `"email_verified": "{{ user.email_verified }}"`; the backend accepts `true` or `"true"`. Keep the key names: the backend reads `email` and `email_verified` (`WORKOS_EMAIL_CLAIM` and `WORKOS_EMAIL_VERIFIED_CLAIM` in `convex/lib/auth.ts`).

### Convex

Set `WORKOS_CLIENT_ID` on the deployment before deploying this backend. Convex refuses an auth configuration that reads an unset variable, so the deploy fails without it. The live portals use `dev:pastel-goshawk-398`.

## Order of the switch

1. Set `WORKOS_CLIENT_ID` on the deployment.
2. Deploy the backend (both providers). Google sign-in keeps working.
3. Complete the WorkOS dashboard steps above.
4. Check a real sign-in on `http://localhost:8765` with `workosClientId` set in a local, uncommitted copy of `convex-config.js`:
   - an invited Google account signs in, lands signed in, and its row gains `workos_subject` (the WorkOS user ID, `user_…`);
   - a reload keeps the session, and sign-out returns the card;
   - **the negative check:** a Google account with no invitation signs in at WorkOS and is refused on the sign-in card with "No project invitation found for <address>.", and no `users` row is created or changed.
5. Commit the client ID in `convex-config.js` (one line, with a `convex-config.js` stamp bump on the three pages that load it and in `tiles-v2-client.test.cjs`). Pages publishes it, and contributors sign in once more, through WorkOS.

Rolling back is the same line set back to empty, with `POW_AUTH_GOOGLE_ROLLBACK=1` set for the duration, as described under "Rolling back to Google".
