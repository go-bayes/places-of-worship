# Frozen exports: byte-level freezing and bundle verification: implementation brief (2026-09-12)

Status: BRIEF, prepared by Claude (Fable 5.1) under D20 (`DECISIONS.md` in the private repository, PI ruling 2026-09-11), step two of its sequence: byte-level export freezing with bundle verification in `pow`. Step one (the intake gate and snapshot-linked acceptance) merged as PR #111 and is live. Proposal pinning (step three) and portal restoration controls (step four) follow. This brief fixes the contract both halves implement: the Convex side (freeze, storage, retrieval, withdrawal, supersession) and the `pow` side (`pow export verify`) plus the materialisation script.

## 1. The problem

`exports:freezeExportBatch` today sets `status: "frozen"` and marks every included task `exported` without capturing any bytes. `exports:getExportBundle` rebuilds the bundle from the current rows on every call, so a "frozen" batch is a label over mutable content: a reopen, a reviewer edit, or an occupancy retirement after the freeze changes what the next retrieval returns, and nothing records that it did. D20 rules that freezing must recheck eligibility and pinned versions at freeze time, capture the complete bundle including the confirmed locations actually approved, durably store and verify its bytes, and only then mark the batch frozen; later withdrawal or supersession preserves those bytes while stopping further authorised processing.

## 2. The bundle contract `pow-export-bundle.v1`

A bundle is a set of files plus one manifest, `export_manifest.json`. Every file is UTF-8 text. The manifest is the JSON object below, written as `JSON.stringify(manifest, null, 2) + "\n"` (the current pretty form), and includes its own `manifest_hash`:

```json
{
  "bundle_contract": "pow-export-bundle.v1",
  "hash_contract": "pow-object.v1",
  "export_batch_id": "vu-convex-export-1789000000000",
  "country_code": "VU",
  "schema_version": "convex-task-layer.v0.1",
  "export_format": "bundle",
  "created_at": 1789000000000,
  "frozen_at": 1789000060000,
  "supersedes_export_batch_id": "vu-convex-export-1788000000000",
  "included_task_ids": ["..."],
  "included_review_decision_ids": ["..."],
  "included_acceptance_ids": ["..."],
  "included_task_count": 1,
  "included_evidence_count": 1,
  "included_historical_claim_count": 0,
  "included_review_decision_count": 1,
  "evidence_version_hashes": ["sha256:..."],
  "review_snapshot_hashes": ["sha256:..."],
  "files": [
    { "filename": "derived_state_events.jsonl", "content_type": "application/x-ndjson", "record_count": 3, "sha256": "<64 hex>", "byte_length": 812 },
    { "filename": "site_evidence_wide.csv", "content_type": "text/csv", "record_count": 1, "field_count": 90, "field_list_mismatch_count": 0, "sha256": "<64 hex>", "byte_length": 2048 }
  ],
  "manifest_hash": "sha256:<64 hex>"
}
```

Rules:

- `manifest_hash` is `objectHash` (`pow-object.v1`: sha256 over the `pow-canonical-json.v1` bytes, RFC 8785) of the manifest object with the `manifest_hash` member omitted. Every other member is covered.
- `files` is sorted by `filename` (byte order) and lists every file in the bundle except `export_manifest.json` itself. `sha256` is the lower-case hex digest (no prefix) of the file's exact UTF-8 bytes; `byte_length` is the UTF-8 byte count. `record_count` is the number of JSONL lines, or CSV data rows (header excluded); `field_count` and `field_list_mismatch_count` appear only on `site_evidence_wide.csv` as today. A file with zero records is still written (empty JSONL, or an empty CSV as today) and still listed.
- The three `included_*_ids` arrays are sorted (byte order) and de-duplicated in the manifest, whatever order the batch row stores. `evidence_version_hashes` is the sorted, de-duplicated set of `object_hash` values in `evidence_versions.jsonl`; `review_snapshot_hashes` is the sorted set of `snapshot_hash` values in `review_snapshots.jsonl`.
- `frozen_at` and `manifest_hash` are present only on a frozen bundle. A draft preview (section 4) carries neither and is not a verifiable bundle; `pow export verify` refuses it.
- `supersedes_export_batch_id` is present only when the batch was created to replace an earlier frozen batch.

Files (JSONL rows are the Convex documents as stored, including `_id` and `_creationTime`, one per line, `JSON.stringify` per row, exactly as `exportFiles` writes them today; ordering is the index order the builder reads, which is deterministic for a fixed database state):

| filename | content | new? |
| --- | --- | --- |
| `tasks.jsonl` | included tasks, in `included_task_ids` order | |
| `task_events.jsonl` | every event of each included task | |
| `evidence_drafts.jsonl` | every draft of each included task, all statuses | |
| `historical_claims.jsonl` | as today (500 per task cap) | |
| `review_decisions.jsonl` | the batch's `included_review_decision_ids` rows | |
| `site_occupancies.jsonl`, `derived_target_year_states.jsonl`, `derived_year_locations.jsonl`, `derived_target_year_functions.jsonl`, `derived_state_events.jsonl` | as today | |
| `site_evidence_wide.csv` | as today | |
| `evidence_versions.jsonl` | every `evidence_versions` row of each included task (`by_task`), each an `evidence-version.v1` envelope | new |
| `evidence_head_changes.jsonl` | every `evidence_head_changes` row of each included task (`by_task`) | new |
| `task_acceptances.jsonl` | every `task_acceptances` row of each included task (`by_task`), all outcomes | new |
| `review_snapshots.jsonl` | the `review_snapshots` rows named by `review_snapshot_hash` on the included decisions, de-duplicated, sorted by `snapshot_hash` | new |

## 3. Freezing

`exports:freezeExportBatch({ exportBatchId })` becomes an **action** (role `curator` or `admin`; keep the name) that orchestrates three internal functions. Every step that reads or writes rows is a mutation, so each is transactional; the action holds no state other than the storage ids it created.

1. `internal.exports.prepareFreeze({ exportBatchId, userId })` (internalMutation). Requires the batch `draft`. Records `pending_freeze: { attempt_id, started_at, started_by }` on the batch, where `attempt_id` is a fresh random id (use `crypto.randomUUID()`) and `started_at` becomes the bundle's `frozen_at`. Re-runs, for every included task, the same eligibility and authority checks `createExportBatch` runs (factor them into one shared helper, `assertTaskExportAuthority(ctx, taskId)` or similar, returning the accepted decisions and accepted acceptances; `createExportBatch` calls the same helper): the task exists and is `pi_accepted` (`exportRefusalForTask`), is not training-excluded, the authority decision named by the latest `accepted` acceptance exists and is `accepted_for_export`, its pinned `evidence_version_hash` still matches the draft's current hash, and, when it is snapshot-linked, `assertDecisionSnapshotConsistent` passes. The batch's stored `included_review_decision_ids` and `included_acceptance_ids` must still equal what the helper returns now (as sorted sets); a difference is a refusal ("membership changed since the batch was created; create a new batch"). Builds the complete bundle (section 2) with `frozen_at = started_at`, computes every file hash and the manifest hash, stores `pending_freeze.manifest` (the full manifest object), and returns the manifest and the file texts. Any refusal throws before any write except that a refusal must still be recordable: on a throw nothing is written (Convex rolls the mutation back), and the action then calls step 4.
2. The action stores each file, including `export_manifest.json`, with `ctx.storage.store(new Blob([text], { type: content_type }))`, then reads every blob back with `ctx.storage.get(id)`, hashes the bytes with `crypto.subtle.digest("SHA-256", ...)`, and compares each to the manifest (`sha256`, `byte_length`; the manifest file is compared to the sha256 of the bytes it wrote). Any mismatch: delete every blob it stored and call step 4.
3. `internal.exports.completeFreeze({ exportBatchId, attemptId, storedFiles })` (internalMutation). Requires the batch still `draft` and `pending_freeze.attempt_id === attemptId` (a second overlapping attempt replaced it: refuse). Rebuilds the bundle from the current rows with the same `frozen_at` and compares every file's sha256 to `pending_freeze.manifest`; any difference means a row changed between capture and completion, and it refuses. On success it patches the batch: `status: "frozen"`, `frozen_at: started_at`, `freeze_completed_at: now`, `bundle_contract: "pow-export-bundle.v1"`, `manifest_hash`, `frozen_files: [{ filename, storage_id, sha256, byte_length, content_type }]` (including the manifest file), clears `pending_freeze`, moves every included task to `exported` with the `exported` event exactly as today, and, when the batch carries `supersedes_export_batch_id`, marks that earlier batch `superseded` with `superseded_by_export_batch_id` and `superseded_at` (its bytes and `frozen_files` untouched).
4. `internal.exports.recordFreezeFailure({ exportBatchId, attemptId, reason })` (internalMutation). If the batch is still `draft` and the attempt matches, clears `pending_freeze` and sets `last_freeze_failure: { attempt_id, at, reason }`. The action deletes any blobs it stored before calling this, then rethrows the reason so the caller sees it. A failed freeze leaves the batch `draft` and every task where it was.

The action's return is `{ export_batch_id, status: "frozen", manifest_hash, frozen_at, file_count }`.

Determinism: the builder must produce byte-identical output for an unchanged database state, so it must not read `Date.now()` for anything but `started_at` (passed in), and must not depend on iteration order of anything unsorted. The existing `exportFiles` and `getExportBundle` row reads satisfy this; keep them and extend them.

## 4. Retrieval

`exports:getExportBundle({ exportBatchId })` becomes an **action** (role `curator` or `admin`; keep the name) returning `{ export_manifest, files, disposition }` where `files` is the same keyed object of texts as today plus the four new keys (`evidence_versions_jsonl`, `evidence_head_changes_jsonl`, `task_acceptances_jsonl`, `review_snapshots_jsonl`) and `disposition` is `{ status, stored_bytes: boolean, verified: boolean, processing_allowed: boolean, withdrawn_at?, withdrawn_by?, withdrawal_reason?, superseded_by_export_batch_id?, superseded_at? }`. The typed row arrays the query returned (`tasks`, `task_events`, ...) are dropped: nothing outside `convex/` reads them (the materialisation script reads `files` and `export_manifest`), and they doubled the payload.

- A batch with `frozen_files` (frozen, withdrawn, or superseded): read every blob from storage, verify each against `frozen_files` (sha256 and byte length) and verify the manifest file parses to an object whose `manifest_hash` reproduces; refuse with a message naming the file and both hashes on any mismatch, and never rebuild from rows. `stored_bytes: true`, `verified: true`. `processing_allowed` is `true` only for `status: "frozen"`.
- A `draft` batch: build the live preview through `internal.exports.buildDraftBundle` (internalQuery) with no `frozen_at` and no `manifest_hash`; `stored_bytes: false`, `verified: false`, `processing_allowed: false`.
- A legacy frozen batch (status `frozen` or later, no `frozen_files`, frozen before this change): serve the live rebuild exactly as the draft case but with the row's `frozen_at`, no `manifest_hash`, `stored_bytes: false`, and `processing_allowed: false`; the reason field `legacy_unfrozen_bytes: true`. Such a batch cannot be re-frozen; a curator creates a new batch.

## 5. Withdrawal and supersession

- `exports:withdrawExportBatch({ exportBatchId, reason })` (mutation, `curator` or `admin`): requires a batch with `frozen_files` and status `frozen`; `reason` trimmed to at least 8 characters, bounded by the existing task reason limit. Sets `status: "withdrawn"`, `withdrawn_at`, `withdrawn_by`, `withdrawal_reason`. Bytes, `frozen_files`, and `manifest_hash` stay. Task statuses are not changed (an exported task returns to review only through `tasks:reopenTask`, as now); each included task receives a `note_added` event whose note names the batch and the reason. A draft, withdrawn, or superseded batch is refused.
- `createExportBatch` gains an optional `supersedesExportBatchId`: the named batch must exist, be `frozen` (not draft, withdrawn, or already superseded), and have `frozen_files`; the id is stored on the new batch as `supersedes_export_batch_id` and appears in the manifest. The earlier batch changes status only when the new one completes its freeze (section 3, step 3).
- `exportBatchStatus` gains the literals `withdrawn` and `superseded`. No existing code path writes `exported`, `validated`, `failed`, or `archived`; leave them.

## 6. Schema additions (`export_batches`)

All optional: `pending_freeze: { attempt_id, started_at, started_by, manifest: v.any() }`, `last_freeze_failure: { attempt_id, at, reason }`, `freeze_completed_at`, `bundle_contract`, `manifest_hash`, `frozen_files: array of { filename, storage_id: v.id("_storage"), sha256, byte_length, content_type }`, `withdrawn_at`, `withdrawn_by: v.id("users")`, `withdrawal_reason`, `supersedes_export_batch_id`, `superseded_by_export_batch_id`, `superseded_at`. Existing rows are untouched.

## 7. `pow export verify <dir>`

A new `pow export` command group with `verify`, taking a materialised bundle directory (the output of `scripts/materialise_convex_export.py`), with `--report text|json` as `pow object verify` has. Exit non-zero on any error. Checks, each reported with the file and the offending value:

1. `export_manifest.json` parses to an object; `bundle_contract` is `pow-export-bundle.v1`; `hash_contract` is `pow-object.v1`; `frozen_at` and `manifest_hash` are present (a draft preview is refused as "not a frozen bundle"); `manifest_hash` reproduces from the manifest with that member omitted, using the existing `canonical::object_hash`.
2. Every `files[]` entry names a file present in the directory whose byte length and sha256 match; `files` is sorted by filename with no duplicates; every regular file in the directory other than `export_manifest.json`, the listed files, and `SHA256SUMS` is reported as an error (an unlisted file is not part of the frozen bundle).
3. `record_count` equals the JSONL line count, or the CSV data-row count, of the file (CSV rows counted with quoted newlines respected).
4. Membership: the set of `task_id` in `tasks.jsonl` equals `included_task_ids`; `review_decision_id` set in `review_decisions.jsonl` equals `included_review_decision_ids`; `acceptance_id` set in `task_acceptances.jsonl` ⊇ `included_acceptance_ids` (the file carries every acceptance of each task, including returns, so it may hold more); every `evidence_drafts.jsonl` row's `task_id` is an included task; every decision's `evidence_draft_id`, when present, names a draft in the bundle.
5. Pins: every decision with `evidence_version_hash` matches the named draft row's `evidence_version_hash`, and `evidence_versions.jsonl` contains an envelope with that `object_hash`; every envelope in `evidence_versions.jsonl` verifies under the existing envelope verifier (the code behind `pow object verify`), and the sorted set of their `object_hash` values equals `evidence_version_hashes`; every decision with `review_snapshot_hash` names a row in `review_snapshots.jsonl`, and the sorted set of `snapshot_hash` values equals `review_snapshot_hashes`. The snapshot hash is `sha256` over the older `canonicalJson` form (not RFC 8785); if the Rust crate has no implementation of that older form, do not add one in this change: report the snapshot content hash as "not recomputed" in the report (informational, not an error) and verify presence and cross-references only.
6. Every accepted (`accepted_for_export`) decision named by an `accepted` acceptance row refers to a draft whose `draft_status` is `accepted_for_export` and whose task is `exported` or `pi_accepted` in `tasks.jsonl`.

Rust tests: build minimal bundles in a temp directory in code (a helper that writes a manifest and files from in-memory rows, computing hashes with the crate's own helpers), then one passing case and one failing case per check above (tampered byte, wrong length, missing file, extra file, unsorted files, wrong record count, membership gap, moved pin, missing envelope, missing snapshot, hash set mismatch, draft preview refused).

## 8. `scripts/materialise_convex_export.py`

- Accept the new action output: `files` may carry the four new keys (write them when present), and `export_manifest.json` is written from `files.export_manifest_json` **verbatim** when that key is present (the bytes must reproduce the frozen hash), falling back to the current behaviour for old bundle JSON.
- When the manifest carries `manifest_hash`, verify each written file's sha256 and byte length against `files[]` before writing `SHA256SUMS`, and exit non-zero naming the file on a mismatch. Report `disposition` (status, `processing_allowed`, withdrawal or supersession fields) when present.
- Keep `scripts/build_occupancy_dated_places.py` and its tests working (check what it reads from a bundle before changing any key).
- Update the row in `docs/api/workflow-scripts.md` and add `pow export verify` to the `pow` documentation where `pow object verify` is documented.

## 9. Tests (Convex side)

Extend the in-memory harness in `convex/evidenceVersions.node-test.mjs` (or a new `convex/exports.node-test.mjs` that imports the same `world()` helper, if the helper can be shared without duplicating it) with a fake `storage` (`store(blob)` returns an id and keeps the bytes; `get(id)` returns a `Blob` or `null`; `delete(id)`), and a fake action context whose `runMutation` and `runQuery` dispatch by `getFunctionName(ref)` (from `convex/server`) to the module's `_handler` functions, so the real `freezeExportBatch` and `getExportBundle` actions are exercised end to end. Add tables `evidence_head_changes` (already present), `task_acceptances`, `review_snapshots` to `rows` if missing. Scenarios, each a failing test on the old code:

1. Successful freeze: blobs stored and verified; the batch carries `frozen_files`, `manifest_hash`, `frozen_at`, `freeze_completed_at`; every task is `exported` with an event; `getExportBundle` returns the stored bytes with `verified: true`; a direct patch to a draft row afterwards changes nothing in what `getExportBundle` returns; the manifest's `manifest_hash` reproduces with `objectHash`; every envelope in `evidence_versions_jsonl` passes `verifyEvidenceVersionEnvelope`; `files` is sorted and complete.
2. Freeze-time recheck: after `createExportBatch`, reopen the task (or patch it out of `pi_accepted`); `freezeExportBatch` refuses, the batch stays `draft` with `last_freeze_failure`, no blob remains in the fake store, no task changed.
3. Change between capture and completion: a fake `storage.store` hook appends a task event during step 2; `completeFreeze` refuses; blobs deleted; batch `draft`.
4. Overlapping attempts: two `prepareFreeze` calls; completing the first is refused on the attempt id.
5. Stored-byte corruption: the fake store returns altered bytes on read-back; the freeze aborts, blobs deleted, batch `draft`.
6. Post-freeze corruption: mutate the fake store after a successful freeze; `getExportBundle` refuses naming the file and never rebuilds.
7. Legacy frozen batch (status `frozen`, no `frozen_files`): served live with `stored_bytes: false`, `legacy_unfrozen_bytes: true`, `processing_allowed: false`.
8. Withdrawal: frozen → `withdrawn`; bytes still served, `processing_allowed: false`; `note_added` on each task; withdrawing a draft or an already withdrawn batch is refused; a short reason is refused.
9. Supersession: a second batch created with `supersedesExportBatchId` naming the first (after the task is reopened, re-reviewed with a snapshot-linked decision, re-accepted, so it is `pi_accepted` again); freezing the second marks the first `superseded` with the back-reference and leaves its bytes served; naming a draft or withdrawn batch is refused at creation.
10. Membership drift: a batch whose stored decision ids no longer match the helper's result (patch a new accepted decision in) is refused at freeze.

## 10. Documentation

- New `docs/development/frozen-exports.md` describing the contract (sections 2 to 5 of this brief, in the register of `evidence-versions.md`), linked from the status lines of `evidence-versions.md` and `content-addressed-review.md` ("Frozen Exports" is now implemented; the export queue and PI batch release remain later steps).
- `docs/api/convex-functions.md`: `freezeExportBatch` and `getExportBundle` become actions; new `withdrawExportBatch`; `createExportBatch` gains `supersedesExportBatchId`; the four internal functions listed as internal.
- `convex/README.md` if it lists export functions. `CHANGELOG.md` is written by the reviewer, not the implementer.

## 11. Out of scope

The export queue, PI batch release, the decision hash version 2 envelope, proposal pinning, reading the accepted version's stored envelope in place of the draft row for `site_evidence_wide.csv`, a portal surface for batches, moving the `exported` task transition from freeze to a later release step (flagged for JB: the content-addressed design places it at release, D20 does not sequence release, so this change keeps the transition at freeze completion), and any migration of existing frozen batches.
