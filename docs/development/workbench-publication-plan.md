# Workbench Publication And Authentication Plan

Status: PREPARED 2026-07-07; every activation step below is a JB
decision. Nothing in this plan has been performed. The workbench remains
demo-mode and unpublished.

This note prepares the two deliberate steps recorded in
`apps/workbench/README.md`: publishing the built workbench on
religionmap.org, and binding it to the shared Convex backend with Google
sign-in. It exists so each step is a small, reviewable action rather
than a discovery exercise.

## Current State

- The workbench (`apps/workbench/`) is a Vite app with relative base
  `./`, so the built `dist/` can be served from any static subpath
  without a rebuild.
- Demo mode is verified: all playbook acceptance checks passed in the
  browser on 2026-07-07 (see
  `docs/playbooks/free-contribution-portal.md`, verification notes).
  The only persistence is localStorage; the app makes no network calls.
- The site deploys as static files from `main` via GitHub Pages
  (`CNAME` → `religionmap.org`). There is no CI build.
- The root `.gitignore` ignores `dist/` globally, which is why the
  workbench cannot drift onto religionmap.org by accident.
- Google auth already works on the NZ/VU verification pages against the
  hosted Convex deployment (`https://pastel-goshawk-398.convex.cloud`)
  with the public Google client id committed in
  `convex/auth.config.ts`. The OAuth client therefore already
  authorises the `religionmap.org` origin; a published workbench on
  the same origin needs no new OAuth configuration.

## Step 1 — Publish The Built Workbench (JB decision)

Recommended path: commit the built output, keeping the
deploys-static-from-main model intact.

1. Add a gitignore exception: `!apps/workbench/dist/` after the global
   `dist/` rule.
2. `npm --prefix apps/workbench run build`, commit `dist/`.
3. The workbench serves at
   `https://religionmap.org/apps/workbench/dist/` once the branch
   merges to `main`.

Each workbench change then requires a rebuild-and-commit, which is
acceptable at pilot scale and keeps the publish auditable in git
history. A CI build (GitHub Actions) avoids committed artefacts but
changes the deployment model for the whole site; defer that decision
until workbench churn makes rebuild-and-commit tiresome.

Publication in demo mode is safe in itself — the published app saves to
the visitor's browser only and shows the demo banner. Whether public
maps may LINK to it before authentication lands is a separate JB call
(the guardrail in `docs/playbooks/fix-map-two-options.md`).

## Step 2 — Convex Binding (build next, flip JB-gated)

The binding is a `ConvexProvider` implementing the existing
`WorkbenchProvider` interface (`apps/workbench/src/data/provider.ts`),
plus Google sign-in, behind runtime configuration that defaults OFF.

- Reuse the `convex-config.js` pattern from the verification pages: a
  small committed config file loaded before the bundle, carrying
  `enabled`, the Convex URL, and the public Google client id. Committed
  state is `enabled: false`; JB flips it deliberately after review.
- With the config disabled or absent, the app runs `DemoProvider`
  exactly as today, so publication (step 1) and the binding build are
  independent.
- Backend work needed before the flip: the free-contribution mutations
  and queries from the "Convex Spec For Later" section of
  `docs/portal-free-contribution-design.md` (free nominations as task
  type `missing_from_project_map`, source-first claims, agent-run
  records, dedup query), with the existing role gates and
  `convex/lib/limits.ts` field limits. Code changes in `convex/` are
  inert until `npx convex deploy` is run, which stays a JB action.
- The bulk agent-autonomous lane controls (source allowlist, run caps,
  daily caps, confidence gates, pause switch) are ratified
  preconditions for Convex ingestion; the flip must not precede them
  for that lane. The FIXED and agent-assisted lanes can bind first.

## Step 3 — Invites (JB action)

Invites use the existing flow in
`docs/development/convex-task-layer-setup.md`: `users:inviteUser` from
an admin account, then the invitee signs in with Google and runs
`users:claimInvite`. Guy's portal invite is pending JB (address held
privately, per the no-real-emails rule). Suggested roles for Guy:
`ra` plus `reviewer` if he will also review Vanuatu source-first work.

## Step 4 — Unlock The Map Route (coordination)

Once the workbench is published and (if JB requires it) authenticated,
tell the country-map session. The maps side is already built and
dormant: the US/IE/UK fix-map menus gain an `RA portal` option through
a config key (`RC.raPortalHref`; see
`docs/playbooks/fix-map-two-options.md`). The href should be the
published workbench URL from step 1.

## Decision Checklist For JB

| # | Decision | Effect |
| --- | --- | --- |
| 1 | Approve committing `apps/workbench/dist/` (gitignore exception + build commit) | Workbench publishes at the next merge to `main`. |
| 2 | Allow public maps to link the demo-mode workbench, or hold links until auth | Controls when `RC.raPortalHref` and `workbenchHref` are set. |
| 3 | Review and deploy the free-contribution Convex functions (`npx convex deploy`) | Backend accepts portal submissions behind role gates. |
| 4 | Flip the workbench Convex config to `enabled: true` | Published workbench switches from demo to shared backend. |
| 5 | Run the invites (Guy first) | Invited RAs can sign in and own their submissions. |

Steps 1 and 2 can precede the binding; steps 3–5 order among
themselves. None is performed by agents.
