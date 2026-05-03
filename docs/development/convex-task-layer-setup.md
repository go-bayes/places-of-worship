# Convex Task Layer Setup

This is the maintainer setup note for the first Convex task-map backend spike.
It is not RA-facing guidance.

## Scope

The Convex layer is for live task coordination: assignments, provisional task
closure, evidence drafts, review decisions, and export batches. It must not
write to the master map, accepted change-event store, or public map data.

The first spike should prove four behaviours:

1. an invited user can sign in and claim an NZ task,
2. task status updates are visible to other signed-in sessions,
3. an RA can create a draft for an existing task or a candidate not on OSM,
4. a reviewer can record a decision and a curator can freeze an export bundle.

## Install

From the repository root:

```sh
npm install
```

This installs the Convex CLI and TypeScript. Commit the generated lockfile once
dependencies are installed for the first time.

## Start A Development Deployment

```sh
npm run convex:dev
```

The first run opens the Convex login and project setup flow. It writes local
deployment configuration to ignored environment files. Do not commit deployment
credentials.

The repository sets `aiFiles.enabled` to `false` in `convex.json` so Convex does
not create assistant-specific instruction files during setup.

## Bootstrap Project Users

There are two bootstrap paths.

For a fresh hosted deployment, prefer pending invites. This avoids creating a
fake active admin user from a mocked command-line identity. Run this once,
before any project users exist:

```json
users:bootstrapPendingInvites({
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
Connect-compatible provider. `docs/development/convex-auth-google.config.example.ts`
is the direct Google OpenID Connect configuration:

- issuer/domain: `https://accounts.google.com`,
- application id: Convex environment variable `GOOGLE_CLIENT_ID`.

When the hosted deployment has a real Google client id, copy the example to
`convex/auth.config.ts`, set `GOOGLE_CLIENT_ID` in the Convex deployment
environment, and run `npm run convex:dev` or `npx convex deploy`.

The Google client id is public configuration, but the deploy key and any OAuth
client secret are not. Configure secrets in the Convex dashboard, GitHub
secrets, or a local shell environment. Do not paste them into chat or commit
them.

If using a Convex deploy key, set it locally only for the command that needs it:

```sh
CONVEX_DEPLOY_KEY='...' npx convex deploy
```

or export it in the shell and then run the Convex command. The key should never
be written to source files.

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

Curators can create and freeze export batches from reviewed decisions:

```json
exports:createExportBatch({
  "countryCode": "NZ",
  "exportFormat": "bundle"
})
```

```json
exports:freezeExportBatch({
  "exportBatchId": "nz-convex-export-..."
})
```

The export query returns JSON documents for tasks, task events, evidence drafts,
and review decisions. The next implementation step is a file-export action that
turns this bundle into `site_evidence_wide.csv` plus JSONL artefacts for `pow`.

## Recovery

If Convex is unavailable during the pilot, fall back to the current map plus
shared Sheet workflow. The Sheet remains a compatible evidence export path until
Convex exports have been validated by `pow`.
