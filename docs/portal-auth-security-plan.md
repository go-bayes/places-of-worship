# Portal Auth And Security Plan

Public direction: `ROADMAP.md`. Detailed active planning and governance records are maintained in the private research tier.

Portal hub: `docs/portal-data-entry-plan.md`.

## Baseline

Use a managed authentication service. Do not build password storage, password
reset, multi-factor authentication, login sessions, or account recovery in this
project.

For the Convex task-map spike, use an OpenID Connect-compatible managed auth
provider, with Google sign-in likely for the RA pilot. Backend functions should
verify provider-issued identity claims and then enforce project permission
scopes. If the project later adds a Rust API on Cloud Run, it should use the
same identity and role model rather than a separate account system.

## Pilot Access Model

The first authenticated pilot should be invite-only.

Minimum roles:

- `submitter`: can create staged submissions
- `reviewer`: can inspect queue items and record review decisions
- `adjudicator`: can resolve conflicting or high-impact decisions
- `admin`: can manage roles, provider settings, and launch gates
- `service`: can run trusted ingestion or export jobs with scoped credentials

Authentication answers who the user is. Authorisation answers what the user can
do in the project. Keep these separate in the implementation and audit logs.

Current Convex pilot rule: RA accounts may save and inspect their own assigned
evidence and task history. Reviewer, curator, admin, and service roles may
inspect project-wide evidence needed for review, export, or maintenance.

Current Convex size rule: evidence notes, source fields, generated rows,
review notes, task notes, and client context are rejected before writing when
they exceed the pilot's field-size limits. These limits reduce the damage from
accidental paste errors and basic oversized-submission attacks; they do not
replace rate limits, upload controls, or source review.

## Assets And Threats

Assets:

- master site records and accepted change history
- raw submissions and source snapshots
- contributor identities and role grants
- private or restricted source files
- quarantined images and exact capture metadata
- public map exports and downloads
- API credentials and service accounts

Primary threats:

- spam or automated bulk submissions
- malicious uploads
- private information in source notes or media
- licence-incompatible evidence
- forged geometry or duplicate nominations
- attempts to bypass review and affect public outputs
- compromised contributor or service accounts
- AI-generated claims without source support

## Required Controls

Before exposing a real intake endpoint beyond the core team, implement:

- provider token verification
- invite allowlist or equivalent access policy
- project-level permission scopes
- rate limits and request size limits
- structured schema validation
- geometry bounds and plausibility checks
- upload file-type and size limits
- media quarantine with no public endpoint or public derivative
- least-privilege, role-checked, short-lived access to originals and exact capture metadata
- audit logs for original-media and restricted-metadata access
- malware scanning where feasible
- privacy, cultural-sensitivity, and licence review before routine internal media access
- exclusion of media, exact location, contributor identity, private media references, and guided denomination claims (raw labels, label basis, relation) from external AI or other outbound services until separately approved
- append-only audit logs
- dry-run diffs before master ingestion
- no direct master writes from public, RA, script, or AI submission paths

## Launch Gates

The task and review pilot should not leave demo status until unauthorised users cannot submit, invited submitters cannot review, reviewers cannot mutate the master directly, and every accepted decision has a traceable raw submission, validation result, reviewer identity, and proposed master diff.

Media upload has a separate launch gate. Before uploads are enabled, the project must ratify retention periods, contributor withdrawal and authorised deletion procedures, backup deletion limits, access-review intervals, breach and cultural-harm response, and the authority to suspend or destroy restricted media. Uploads must remain disabled while any of these rules is unresolved.
