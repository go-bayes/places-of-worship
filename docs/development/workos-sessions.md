# WorkOS sessions for the portals

Status: built 2026-11-03, switched off until the project lead sets the client ID. This page is for maintainers: what the code does, the one-time WorkOS and Convex setup, and the switch.

## Why

The contributor portal (`apps/regions/nz/verification.html`) and the review portal (`apps/regions/nz/review.html`) sign in with a Google ID token. The token lasts one hour, and only Google One Tap can renew it, which iOS Safari declines, so contributors in the field are signed out mid-entry. WorkOS AuthKit issues a short access token together with a refresh token, and renews the access token silently. People still sign in with Google, now through WorkOS's Google connection, and the project's own roster and roles (`users`, `ra`, `pi` and the rest) are unchanged.

## How it works

- **One switch.** `workosClientId` in `apps/regions/nz/js/convex-config.js` is read by both portals and by the callback page. Empty, the portals keep the Google ID token exactly as before. Set to the WorkOS client ID (`client_01…`, not a secret), both portals sign in through WorkOS.
- **The library.** `apps/vendor/authkit-js@0.20.5/dist/authkit.iife.min.js`, a browser build of `@workos-inc/authkit-js` 0.20.5; its README records the provenance and build. `apps/regions/nz/js/convex-task-client.js` creates the AuthKit client with `devMode: true`. The refresh token is therefore kept in the page's local storage. The library's production mode renews through a cookie on `api.workos.com`, which iOS Safari blocks as a third-party cookie, so it would sign people out in the very case this change is for. The strict content security policy on every page is the mitigation for keeping a refresh token in local storage. A custom authentication domain (WorkOS, $99 a month) would let the cookie be first-party, and is the planned upgrade when open sign-up arrives.
- **Sign-in.** The sign-in card shows a **Sign in with Google** button. It records the page and the contributor's initials in the tab's session storage and calls `authkit.signIn()`, which goes to the WorkOS hosted page; Google sits behind it. WorkOS returns to `apps/regions/nz/auth-callback.html`, one page for both portals, which exchanges the code and goes back to the page that started the sign-in, query string included. The return address is checked to be on the same site.
- **Each request.** Before each Convex request the client asks `authkit.getAccessToken()`, which renews the access token when it is close to expiry. A session AuthKit cannot renew signs the client out, and the request reports "Your sign-in expired. Sign in again, then retry.", the message the portals already handle. A network failure keeps the session for a retry.
- **Reloads.** A kept refresh token restores the session on the next page load, as a kept Google token did, so the device-restore paths (saved drafts, pin resume) are unchanged.
- **Sign-out.** The sign-out button calls `authkit.signOut({ navigate: false, returnTo })`, with `returnTo` the contributor portal on the page's own origin: the session ends at WorkOS, the refresh token leaves the device, and the portal clears its own state as before.

## Backend

`convex/auth.config.ts` accepts three providers: Google, as before, and the two WorkOS issuers that Convex's AuthKit guide lists (`https://api.workos.com/` with the client ID as audience, and `https://api.workos.com/user_management/<client ID>`), both checked against the WorkOS keys for the client ID. Google stays during the switch, so a contributor signed in with Google is not locked out; removing it is a later step.

A WorkOS token names the person by a WorkOS user ID, which no stored row holds: a row claimed through Google keeps Google's identifier in `auth_subject`, and an invitation holds only an email. `convex/lib/auth.ts` therefore matches a WorkOS identity to its row by the verified email claim (`findUserForIdentity`), and matches a Google identity by `auth_subject` as before. `requireUser`, `users:me` and `users:claimInvite` all go through it, so a person who signed in with Google before the switch reaches the same row, roles and work through WorkOS. The WorkOS path:

- refuses a token without an `email` claim, with a message that names the missing claim;
- refuses an email that WorkOS does not report as verified (`email_verified`);
- refuses a row that holds only the `service` role, since service accounts never sign in;
- leaves `auth_subject` untouched when a WorkOS sign-in claims an invitation.

`adminUpsertUser`, the email-keyed roster and the `pow-cli-seed-service` impersonation path are unchanged. `convex/workos-identity.node-test.mjs` covers the mapping.

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
4. Check a real sign-in on `http://127.0.0.1:8765` with `workosClientId` set in a local, uncommitted copy of `convex-config.js`.
5. Commit the client ID in `convex-config.js` (one line, with a `convex-config.js` stamp bump on the three pages that load it and in `tiles-v2-client.test.cjs`). Pages publishes it, and contributors sign in once more, through WorkOS.

Rolling back is the same line set back to empty.
