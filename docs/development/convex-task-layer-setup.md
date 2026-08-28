# Convex Task-Map Backend Setup

This is the maintainer setup note for the first Convex task-map backend spike.
It is not RA-facing guidance.

## Scope

The Convex backend is for shared task coordination: assignments, provisional
task closure, evidence drafts, review decisions, and export batches. It must
not write to the master map, accepted change-event store, or public map data.

The first spike should prove four behaviours:

1. an invited user can sign in and claim an NZ task,
2. task status updates are visible to other signed-in sessions,
3. an RA can create a draft for an existing task or a candidate not on OSM,
4. a reviewer can record a decision and a person with export permission can
   freeze an export file set.

## Install

From the repository root:

```sh
npm install
```

This installs the Convex CLI, TypeScript, and the Convex rate-limiter component used by authenticated rapid entry. Commit the generated lockfile once dependencies are installed for the first time.

## Start A Development Deployment

```sh
npm run convex:dev
```

The first run opens the Convex login and project setup flow. It writes local
deployment configuration to ignored environment files. Do not commit deployment
credentials.

The repository sets `aiFiles.enabled` to `false` in `convex.json` so Convex does
not create assistant-specific instruction files during setup.

## Set The Bootstrap Token

Before running either bootstrap mutation, set a deployment-only setup token.
This prevents unauthorised users from creating the first project account on a
hosted deployment.

In the Convex dashboard, add an environment variable named
`POW_CONVEX_SETUP_TOKEN` with a long random value. Do not commit the token or
paste it into chat. The examples below use the placeholder
`<setup-token-from-dashboard>`.

## Bootstrap Project Users

There are two bootstrap paths.

For a fresh hosted deployment, prefer pending invites. This avoids creating a
fake active admin user from a mocked command-line identity. Run this once,
before any project users exist:

```json
users:bootstrapPendingInvites({
  "setupToken": "<setup-token-from-dashboard>",
  "adminEmail": "jb@example.org",
  "adminInitials": "JB",
  "adminDisplayName": "JB",
  "raInvites": [
    {
      "email": "ra@example.com",
      "initials": "RA",
      "displayName": "RA"
    }
  ]
})
```

After Google/OIDC authentication is configured, each invited user signs in and
runs:

```json
users:claimInvite({
  "initials": "RA"
})
```

Replace the example emails before running this against a live deployment. Do not
commit real email addresses to repository docs.

For local smoke tests only, the Convex CLI can act as a mock authenticated user.
In the Convex dashboard function runner, act as the first authenticated user and
run:

```json
users:bootstrapFirstAdmin({
  "setupToken": "<setup-token-from-dashboard>",
  "initials": "JB",
  "displayName": "JB"
})
```

Then invite the RA:

```json
users:inviteUser({
  "email": "ra@example.com",
  "initials": "RA",
  "roles": ["ra"]
})
```

The invited user signs in and runs:

```json
users:claimInvite({
  "initials": "RA"
})
```

Do not use this mocked-identity path for the hosted pilot unless you plan to
replace the admin user with a real claimed invite before RA work begins.

## Google/OIDC Auth

The first hosted pilot should use Google sign-in through an OpenID
Connect-compatible provider. `convex/auth.config.ts` is configured for direct
Google OpenID Connect:

- issuer/domain: `https://accounts.google.com`,
- application id: the public Google client id already committed in
  `convex/auth.config.ts` and the frontend Convex config.

The Google client id is intentionally public configuration. It is also useful
to keep `GOOGLE_CLIENT_ID` in the hosted Convex deployment environment for
operator visibility and older branches, but the current `auth.config.ts` does
not read it at codegen time because local anonymous Convex deployments reject a
missing deployment environment variable before hosted settings are available.

Run `npx convex dev --once` after changing the provider configuration. That
pushes to the deployment named in `.env.local` (`dev:pastel-goshawk-398`),
which is the deployment the live portals use. `npx convex deploy` targets the
separate prod deployment (`valiant-octopus-914`), which is empty by design
pending the dev-to-prod cutover ruling; pushing there changes nothing the
portals see.

`docs/development/convex-auth-google.config.example.ts` is kept only as a small
reference copy of the same configuration.

The deploy key and any OAuth client secret are not public. Configure secrets in
the Convex dashboard, GitHub secrets, or a local shell environment. Do not paste
them into chat or commit them.

If using a Convex deploy key (only needed for the prod deployment or CI), set
it locally only for the command that needs it:

```sh
CONVEX_DEPLOY_KEY='...' npx convex deploy
```

or export it in the shell and then run the Convex command. The key should never
be written to source files.

## Enable The Static Map Client

The public map reads only public frontend configuration from
`apps/regions/nz/js/convex-config.js`. During local development this file can
be disabled:

```js
window.POW_CONVEX_CONFIG = {
    enabled: false,
    url: "",
    googleClientId: "",
    countryCode: "NZ",
};
```

For the hosted NZ pilot, the committed file is enabled with the live Convex URL
and the public Google client id:

```js
window.POW_CONVEX_CONFIG = {
    enabled: true,
    url: "https://pastel-goshawk-398.convex.cloud",
    googleClientId: "365609603908-modldahk3205acfdf1pshhckufho13v0.apps.googleusercontent.com",
    countryCode: "NZ",
};
```

The Convex URL and Google client id are public configuration. Setup tokens,
deploy keys, and OAuth secrets are private and must stay in the Convex
dashboard, GitHub secrets, or a local ignored environment file.

## Seed NZ Tasks

Build a seed payload from the current static verification GeoJSON:

```sh
uv run scripts/build_convex_task_seed.py --limit 100 --output exports/convex-task-seed/nz-sample.json
```

Omit `--limit` only after the sample import works.

Use the Convex dashboard function runner to call:

```json
tasks:upsertTasksFromStaticMap({
  "batch": { "...": "paste payload.batch here" },
  "tasks": [{ "...": "paste payload.tasks here" }]
})
```

The generated JSON shape already matches the mutation arguments. For the full
3,618-task seed, use a scripted import rather than pasting through the dashboard
if the dashboard payload becomes unwieldy.

## Seed The 50-Case NZ Assignment

For André's first real web assignment, seed the curated temporal workpack rather
than the whole static map:

```sh
uv run scripts/build_convex_workpack_seed.py
```

This writes:

```text
exports/convex-task-seed/nz-temporal-ra-workpack-001.json
```

The output is ignored local data. It contains exactly the `batch` and `tasks`
arguments for:

```json
tasks:upsertTasksFromStaticMap({
  "batch": { "...": "paste payload.batch here" },
  "tasks": [{ "...": "paste payload.tasks here" }]
})
```

The first hosted assignment has been seeded as `nz-temporal-ra-workpack-001`.
Send the RA the assignment link:

```text
https://religionmap.org/apps/regions/nz/verification.html?batch=nz-temporal-ra-workpack-001
```

The assignment page loads only that batch from Convex. It should not ask the RA
to paste rows into a spreadsheet unless the backend is unavailable and JB has
explicitly chosen the fallback path.

## Vanuatu Source-First Test

The temporary Vanuatu entry points are:

```text
https://religionmap.org/apps/regions/vu/verification.html
https://religionmap.org/apps/regions/vu/review.html
```

They route into the shared static task and reviewer pages with `country=vu`.
This is a test surface only. It uses the Vanuatu target years 1989, 1999,
2009, and 2020, keeps lifecycle evidence open back to 1600, and should be used
for source-first leads rather than a final Vanuatu map validation pass.

Until Guy's Google account is known, invite the primary investigators as
reviewer/admin users and run test imports under their accounts. Do not commit
real email addresses to repository docs.

To build the initial 50-case Vanuatu OSM-derived starter batch:

```sh
uv run scripts/build_vu_osm_starter_seed.py
```

This writes:

```text
exports/convex-task-seed/vu-source-first-test-001.json
```

Use the Convex dashboard function runner or an authenticated hosted-deployment
CLI to call:

```json
tasks:upsertTasksFromStaticMap({
  "batch": { "...": "paste payload.batch here" },
  "tasks": [{ "...": "paste payload.tasks here" }]
})
```

The starter batch is balanced across named leads, missing-denomination leads,
unnamed denomination leads, and sparse unnamed leads. Treat all rows as prompts
for source-first checking rather than accepted evidence.

## Import Spreadsheet Submissions

When an RA or partner spreadsheet should enter the review portal, export the
`site_evidence_wide` tab as CSV and build a Convex import payload:

```sh
uv run scripts/build_convex_spreadsheet_submission_seed.py \
  --input path/to/site_evidence_wide.csv \
  --batch-id vu-source-first-test-001 \
  --country-code VU \
  --target-years 1989,1999,2009,2020 \
  --submitter-email "<invited-account@example.org>" \
  --submitter-name "Guy or PI test import"
```

The script writes an ignored JSON payload under `exports/convex-task-seed/`.
Use the Convex dashboard function runner to call:

```json
evidence:importSubmittedEvidenceDrafts({
  "batch": { "...": "paste payload.batch here" },
  "tasks": [{ "...": "paste payload.tasks here" }],
  "drafts": [{ "...": "paste payload.drafts here" }]
})
```

Imported rows become provisional tasks with submitted evidence drafts. They
appear in the authenticated review portal, but they still do not update the
master database or public map until reviewer acceptance, export, and `pow`
validation.

## Manual Candidate Tasks

For a place of worship that is not on the project map, or not on OSM, call:

```json
tasks:createManualCandidateTask({
  "countryCode": "NZ",
  "name": "Example Worship Centre",
  "address": "1 Example Street",
  "locality": "Exampletown",
  "latitude": -41.0,
  "longitude": 174.0,
  "sourceNote": "Nominated from source-backed RA review."
})
```

This creates a provisional `candidate_site_id` and an ordinary review task. The
candidate id is not a master `site_id`.

## Export Boundary

A person with export permission can create and freeze export batches from
reviewed decisions:

```json
exports:createExportBatch({
  "countryCode": "NZ",
  "exportFormat": "bundle"
})
```

Here `bundle` is the provisional code value for "all export files together".

```json
exports:freezeExportBatch({
  "exportBatchId": "nz-convex-export-..."
})
```

The export query returns JSON documents for tasks, task events, evidence drafts,
review decisions, and a `files` block. The `files` block contains
`site_evidence_wide.csv` plus JSONL artefacts for `pow` handoff.

Save the query output to a local JSON file outside Git-tracked paths, then
materialise the file set:

```sh
python3 scripts/materialise_convex_export.py path/to/convex-export-bundle.json
```

The materialiser writes an export directory under `exports/convex-roundtrip/`,
adds local SHA-256 hashes, and writes `SHA256SUMS`. The first kick-the-tyres
round trip is:

```sh
cargo run -p pow-cli -- validate exports/convex-roundtrip/<export_batch_id>/site_evidence_wide.csv
cargo run -p pow-cli -- stage exports/convex-roundtrip/<export_batch_id>/site_evidence_wide.csv
cargo run -p pow-cli -- propose <staged_batch_id> --persist
cargo run -p pow-cli -- diff <derived_batch_id>
```

## Recovery

If Convex is unavailable during the pilot, fall back to the current map plus
shared Sheet workflow. The Sheet remains a compatible evidence export path until
Convex exports have been validated by `pow`, but the RA default should be
backend save/submit once the hosted deployment is configured.

## Admin-Key Seeding As A Service Actor

Since 2026-08-22 a task batch can be seeded without the dashboard. The internal
mutation `tasks:adminUpsertTasksFromStaticMap` takes `actor_email` plus the same
`batch` and `tasks` payload as `tasks:upsertTasksFromStaticMap`, resolves the
actor by email, requires that user to be active with the `service` or `admin`
role, and runs the shared seeding core. Internal functions cannot be called by
any client, so the deployment admin key is the only gate; task events record
the named actor. The seeding service account is
`service+claude@religionmap.org` (role `service`, never signs in; created with
`users:adminUpsertUser`, which now accepts an optional `status`).

```sh
python3 scripts/build_vu_survey_tasks.py   # writes <batch>.json and <batch>.run.json
npx convex run tasks:adminUpsertTasksFromStaticMap "$(cat exports/convex-task-seed/<batch>.run.json)"
```

The `.run.json` file is the payload with `actor_email` prepended. The mutation
is idempotent on `batch_id` and `task_id`, so a corrected payload can be re-run.
First use: `vu-port-vila-survey-2010-001` (93 tasks from Eriksen & Andrew 2010).
