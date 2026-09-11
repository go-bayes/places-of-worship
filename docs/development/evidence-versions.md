# Evidence Versions And The Canonical Hash Contract

**Status:** Implemented 2026-09-11 as the first two steps of the [content-addressed review contract](content-addressed-review.md): the canonicalisation contract with shared fixtures, and server-created immutable evidence versions. Proposal pinning, the export queue, frozen exports, PI batch release, and `pow` verification of releases remain later steps. Live Convex behaviour changes only where this document says it does.

## Canonicalisation Contract `pow-canonical-json.v1`

The hash envelope of every content-addressed object is serialised with [RFC 8785, the JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785), over the I-JSON domain. RFC 8785 is an informational RFC, not a standards-track document; the project adopts it because its rules are exact, it defers to ECMAScript for number and string serialisation, and maintained implementations exist in both project languages. The contract is named so that a later change in scheme requires a new contract name.

The rules the project relies on are these:

- Object members are sorted by the UTF-16 code units of their names. This differs from UTF-8 byte order for characters outside the Basic Multilingual Plane; the fixture `key_order_utf16_not_utf8` separates the two.
- Numbers are IEEE 754 doubles and print as ECMAScript `Number::toString` prints them: `1e21` becomes `1e+21`, `1.0` becomes `1`, `-0` becomes `0`, `9007199254740993` becomes `9007199254740992`. NaN and Infinity are refused.
- Strings escape only `"`, `\`, and U+0000 to U+001F, with `\b \t \n \f \r` for their five characters and lowercase `\u00xx` otherwise. The solidus, U+007F, and U+2028 and U+2029 are not escaped. Lone surrogates are refused.
- No whitespace is emitted. Duplicate member names and trailing data are refused at parse time.
- `undefined` is not a JSON value. The TypeScript builder removes unset optional members with `withoutUndefined` before hashing, so an omitted optional field and an absent field hash identically; `undefined` inside an array is refused because position carries meaning.

The object hash is `sha256:` followed by the lowercase hexadecimal SHA-256 digest of the UTF-8 canonical bytes. The hash contract name `pow-object.v1` covers the envelope shape and this digest rule.

Implementations and pinned versions:

| Language | Implementation | Pinned dependencies |
| --- | --- | --- |
| TypeScript | `convex/lib/canonicalJson.ts` (`canonicalJsonStrict`, `objectHash`, `withoutUndefined`) | none: relies on `JSON.stringify` for number and string serialisation, which is what RFC 8785 specifies |
| Rust | `crates/pow-cli/src/canonical.rs` (`canonical_json`, `object_hash`, `parse_canonical_input`, `verify_envelope`) | `serde_jcs = "=0.2.0"` with its `ryu-js 0.2.2` number formatter, recorded in `Cargo.lock` |

Both implementations are checked against the same golden files:

- `schemas/fixtures/pow-canonical-json.v1.json`: 41 accepted cases (empty containers, literals, integer and exponent boundaries, subnormal and maximum doubles, integers beyond the safe range, coordinates, timestamps, macrons, astral and combining characters, escapes, member ordering, nested objects, nulls, ordered and pre-sorted arrays, the RFC's own number examples, and an evidence-like record) and 5 rejected texts (NaN, Infinity, duplicate member names, a lone surrogate, trailing data). Regenerate with `node scripts/canonical_json_fixtures.mjs --write` after adding cases; `--check` confirms the file is current.
- `schemas/fixtures/evidence-version.v1.json`: 7 valid envelopes and 9 tampered envelopes for the evidence-version object below. Regenerate with `node scripts/evidence_version_fixtures.mjs --write`.

The suites that read them are `convex/lib/canonicalJson.node-test.mjs`, `convex/lib/evidenceVersions.node-test.mjs`, and the `tests` module of `crates/pow-cli/src/canonical.rs`. The Rust command line exposes the same code:

```sh
cargo run -p pow-cli -- object hash path/to/document.json
cargo run -p pow-cli -- object verify path/to/evidence-version.json --report json
```

`object hash` prints the object hash of any document inside the domain. `object verify` recomputes an envelope's hash with its `object_hash` member removed, checks the envelope fields, and applies the set-like ordering rules for the object type; it lists every failure and exits non-zero on any.

### Ordered and set-like arrays

Canonicalisation preserves array order as data. Where a contract field is a set, the builder sorts it by a stated stable field before hashing and the verifier refuses an unsorted array. In `evidence-version.v1`, `parent_object_hashes` is sorted by hash text and `payload.occupancies` by `segment_index` then `occupancy_id`. Every other array, including `target_year_affects`, `segment_rules`, and function-chain events, is ordered data.

## Evidence Version `evidence-version.v1`

An evidence version is the immutable record of what one actor submitted, or wrote onto submitted evidence, for one evidence record. Draft rows in `evidence_drafts` remain the mutable locator; the version table `evidence_versions` holds the scientific record, written once by the server inside the submitting transaction and never patched.

Envelope:

```json
{
  "hash_contract": "pow-object.v1",
  "object_type": "evidence_version",
  "schema_version": "evidence-version.v1",
  "logical_id": "evidence:<task_id>:<evidence_family_id>",
  "parent_object_hashes": ["sha256:..."],
  "created_by": "actor:<project user id>",
  "recorded_at": "2026-09-11T04:30:00.000Z",
  "payload": {
    "task_id": "...",
    "evidence_draft_id": "...",
    "version_kind": "guided_submission",
    "version_index": 1,
    "evidence": { "...content fields of the draft row..." },
    "occupancies": [ { "...content fields of each active period row..." } ]
  },
  "object_hash": "sha256:..."
}
```

The server sets `created_by` from the authenticated user and `recorded_at` from its clock. The actor identifier is the project user identifier that review decisions and PI acceptances already hash; a storage-independent user identifier would need a new schema version. The stored `envelope_json` includes `object_hash`; verification removes that member and recompares.

`payload.evidence` carries every field of the draft row except locators, storage metadata, mutable coordination state, and bookkeeping: `_id`, `_creationTime`, `evidence_draft_id`, `task_id`, `draft_status`, `created_by`, `created_at`, `updated_at`, `guided_submission_key`, `intake_submission_key`, `import_batch_id`, `source_claim_key`, `claim_hash`, `agent_intake_hash`, the version fields themselves, `pending_occupancy_cards` (cards become period rows at submission), and `validation_summary` (server checks, not evidence). `payload.occupancies` carries the parent's active `site_occupancies` rows without `_id`, `_creationTime`, `task_id`, `parent_evidence_draft_id`, `claim_status`, `submission_key`, `created_by`, `created_at`, and `updated_at`. The function chain is on the draft row and so inside `evidence`. Free-standing historical claims recorded with `historicalClaims:submitHistoricalClaim` are separate submitted objects and are not inside the evidence version; see the interfaces below.

Two hashes are stored for each version. `object_hash` identifies the version, including its position, kind, actor, time, and lineage. `content_hash` is the object hash of `{ evidence, occupancies }` alone; it is the server-computed content identity that the design names as a later replacement for the client-supplied `claim_hash`, and it is what makes an unchanged resubmission the same version.

### Lineage: correction versus new dated observation

A version's `parent_object_hashes` names the version it supersedes. The builder resolves lineage from the draft row:

| Situation | Family | Parent | Payload note |
| --- | --- | --- | --- |
| First submission of a draft | the draft's own id | none | |
| Any later write onto a row that already has a version (reviewer edit, reviewer derivation decision, recorded occupancy set, spreadsheet re-import) | the row's family | the row's current version | |
| A revision clone with `revision_intent: "correction"` (the default) whose source has a version | the source's family | the source's current version | |
| A revision clone whose source was submitted before the contract | the clone's own id | none | `revises_evidence_draft_id`, `parent_version_unavailable: "pre_contract"` |
| A revision clone with `revision_intent: "new_observation"` | the clone's own id | none | `follows_evidence_draft_id`, `follows_object_hash` when the source has one |
| A rapid correction (`rapidEntry:submitCurrentObservation` on a task in a correction status) | the corrected observation's family | its current version | |

`reviseEvidenceDraft` stamps `revision_of_evidence_draft_id` and `revision_intent` on the clone; a reused open clone keeps the intent it was opened with, and a call asking for a different intent is refused rather than ignored. The portal sends no intent today, so every portal revision is a correction; the `new_observation` intent is available to clients now and needs a portal control and RA-guide sentence before contributors can choose it.

`version_index` is a family-wide sequence starting at 1, not an ancestry depth. A family may branch: two revisions opened from the same submission by different actors, or a reviewer edit beside a contributor's correction, both take the same parent and consecutive indices. `parent_object_hashes` carries the graph; `listEvidenceVersions` presents the family in index order. Whether a family should be constrained to a chain is a record-keeping choice not taken here.

### Idempotency

`recordEvidenceVersion` returns the existing version, and writes nothing, in two cases: the caller's idempotency key already names a version for the same actor and draft, or the row's current version has the same `content_hash` as the content being recorded, whoever the actor is. The guided, rapid, occupancy, import, and intake paths pass their existing submission keys, which are scoped by user id so two contributors cannot collide; `evidence:submitEvidenceDraft` accepts an optional `clientSubmissionId`, and without one an unchanged resubmission still returns the existing version with `deduped: true` and records no second event. A key reused by the same user against another draft is refused. A review action that writes nothing onto the row (a rejected derived year, a re-save of identical text) records no version. The content rule also means a reviewer whose confirmation writes exactly the values the contributor already recorded leaves no version of their own; the reviewer's act is still recorded in `derived_state_events` and the task events. Idempotency keys are namespaced by route (`submit:`, `guided:`, `periods:`, `rapid:`, `import:`, `agent-intake:`, `migration:`) so a client token reused across routes cannot return the wrong version.

## Mutation Inventory

Every server path that creates submitted evidence, or changes the content of submitted evidence, records a version at the end of its transaction. The version therefore captures the committed row and its active period rows.

| Path | Version kind | Idempotency key | Event carrying the hash |
| --- | --- | --- | --- |
| `evidence:submitEvidenceDraft` | `submitted` | `submit:<user>:<clientSubmissionId>` when given, else content identity | `submitted_for_review` |
| `evidence:submitEvidenceDraftWithOccupancies` | `guided_submission` (taken after periods and chain are recorded; a retry returns the version this key recorded, not a later one) | `guided:` + the guided submission key | `submitted_for_review` |
| `evidence:submitUnresolvedNote` | `unresolved_note` | content identity | `submitted_unresolved_note` |
| `evidence:saveEvidenceDraft` on a `submitted` or `unresolved_note` row, which keeps its status (review roles only; an author is refused; an `accepted_for_export`, `rejected`, `superseded`, or `withdrawn` row is refused for everyone and stays on record) | `reviewer_edit` | content identity | `note_added` |
| `evidence:importSubmittedEvidenceDrafts` (spreadsheet import; a re-import with changed content becomes a child version) | `spreadsheet_import` | content identity | `submitted_for_review` |
| `rapidEntry:submitCurrentObservation` | `rapid_current_observation` | `rapid:` + the rapid submission key | `submitted_for_review` or `submitted_unresolved_note` |
| `occupancies:submitOccupancies` (periods recorded against a submitted parent) | `occupancy_set_recorded` | `periods:` + the occupancy submission key | `note_added` |
| `recordOccupancySet` retiring an earlier parent's active set or function chain (`supersedeEarlierOccupancySets`, `supersedeEarlierFunctionChains`, reached from the guided submission, `submitOccupancies`, and the occupancy import): each affected earlier parent that already has a version takes a child version whose occupancy set is now empty and whose chain is gone | `superseded_by_later_set` | content identity | none; the later set's own event names the new version |
| `occupancies:decideDerivedYear`, `occupancies:confirmAllDerived` (confirm or override writes census-year statuses, use levels, or denominations onto the parent; reject writes nothing and records no version) | `reviewer_derivation_decision` | content identity | `note_added` |
| `batchImport` occupancy import (submitted rows with periods) | `occupancy_import` | `import:<batch>:<locator>` | none beyond the existing import events |
| `internalAgentIntake:ingestBundle` | `agent_intake` | `agent-intake:<submission key>` | `imported` |
| `evidenceVersions:recordMigrationVersion` | `migration_copy` | `migration:<run>:<draft>` | `note_added` |

Paths that change status only, and record no version because content is untouched: `withdrawEvidenceDraft`, `supersedeOtherActiveDrafts` and the rapid supersession, `reviews:recordReviewDecision` and the batch decision (they set `accepted_for_export` or `rejected`), the task-level claim, release, opinion, comment, skip, close, and reopen mutations. The batch import path that lands drafts as editable `draft` rows records no version; those rows are versioned when a person submits them.

`historicalClaims:submitHistoricalClaim` attaches a new claim row to a submitted parent. That adds a submitted object beside the evidence version rather than changing it. The claim's own version object belongs to the proposal step.

The audit for this inventory is `evidenceVersions:verifyDraftAgainstVersion`. It rebuilds the payload from the current draft row and its active periods and reports `consistent: false` when the row no longer says what its current version says. A divergence means a write reached submitted content without a version, which the inventory above is meant to make impossible.

## Retrieval

- `evidenceVersions:getEvidenceVersion({ objectHash })` returns the version summary, the parsed envelope, the stored canonical `envelope_json`, and a fresh verification of that envelope. Authors read their own versions; review roles read all.
- `evidenceVersions:listEvidenceVersions({ evidenceDraftId })` or `({ evidenceFamilyId })` lists a row's or a family's versions in `version_index` order.
- Task events, `evidence:submitEvidenceDraft`, `submitEvidenceDraftWithOccupancies`, `submitUnresolvedNote`, and `rapidEntry:submitCurrentObservation` return or carry `evidence_version_hash`.
- `reviews:getReviewSnapshot` includes the draft row, which now carries `evidence_version_hash`; a snapshot-linked batch decision therefore covers the version hash the reviewer saw. Decisions do not yet pin the version hash explicitly; that is proposal pinning.

## Existing Records

Rows submitted before this contract have no version. Nothing here rewrites them, and no historical hash is inferred. When a legacy row is revised, its correction starts a family with `parent_version_unavailable: "pre_contract"` and the locator of the row it corrects. An administrator or service actor can run `evidenceVersions:recordMigrationVersion({ evidenceDraftId, migrationRunId })` on a submitted, superseded, accepted, or rejected legacy row; the resulting `migration_copy` version names the migration run and copy time, keeps the row's own actor and times inside `payload.migration`, and is attributed in its envelope to the migrating actor. Retrying with the same run identifier returns the existing version. No migration run is scheduled by this change; running one is a separate operational decision.

Existing `decision_hash` (version 0 and the snapshot-linked version 1), `acceptance_hash`, `claim_hash`, `agent_intake_hash`, and `snapshot_hash` values keep their current contracts. They use the older `canonicalJson` helper, which the strict contract does not replace, so no stored hash changes meaning.

## Interfaces For Later Steps

- Proposal pinning reads `evidence_versions.object_hash` for each evidence record in a proposal, records them as `evidence_version_hashes`, and rejects a decision whose pinned hashes are no longer the current versions of their draft rows (`evidence_drafts.evidence_version_hash`).
- Review decisions can add `evidence_version_hash` beside `review_snapshot_hash`; the version-0 and version-1 decision hash contracts stay as they are and a version-2 envelope would name the change.
- Frozen exports can include an `evidence_versions.jsonl` file of stored envelopes; `pow object verify` already checks each envelope, and a manifest can list their hashes.
- Historical claim versions follow the same envelope with `object_type: "historical_claim_version"` and the claim row's content, once the proposal step needs them.
- The batch-review screen can show `version_index`, the short hash prefix, and the parent-to-current difference from two stored envelopes.
- `content_hash` is the content identity that batch import can adopt in place of the client-supplied `claim_hash`.

## Open Governance Question

Review roles can still edit a submitted draft in place through `saveEvidenceDraft`. The change here records that edit as an attributed child version rather than removing the ability. Whether reviewer in-place edits should be retired in favour of return-for-correction is a workflow choice for the project lead; the version graph supports either answer.
