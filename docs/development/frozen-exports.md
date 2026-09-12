# Frozen Exports: Byte-Level Freezing And Bundle Verification

**Status:** Implemented 2026-09-12 as step two of D20 (`DECISIONS.md`, PI ruling 2026-09-11). Step one, the intake gate and snapshot-linked acceptance, is documented in [evidence-versions.md](evidence-versions.md) and merged as PR #111. Proposal pinning (step three) and portal restoration controls (step four) remain later steps.

## The problem this closes

Before this change, `exports:freezeExportBatch` set `status: "frozen"` and marked every included task `exported` without capturing any bytes; `exports:getExportBundle` rebuilt the bundle from the current rows on every call. A "frozen" batch was a label over mutable content: a reopen, a reviewer edit, or an occupancy retirement after the freeze silently changed what the next retrieval returned. Freezing now rechecks eligibility and pinned versions at freeze time, captures the complete bundle including the confirmed locations actually approved, durably stores and verifies its bytes, and only then marks the batch frozen; withdrawal or supersession afterwards preserves those bytes while stopping further authorised processing.

## The bundle contract `pow-export-bundle.v1`

A bundle is a set of files plus one manifest, `export_manifest.json`. Every file is UTF-8 text. The manifest is written as `JSON.stringify(manifest, null, 2) + "\n"` and includes its own `manifest_hash`:

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

- `manifest_hash` is `objectHash` (`pow-object.v1`: SHA-256 over the `pow-canonical-json.v1` bytes, RFC 8785) of the manifest object with the `manifest_hash` member omitted. Every other member is covered.
- `files` is sorted by `filename` (byte order) and lists every file in the bundle except `export_manifest.json` itself. `sha256` is the lower-case hex digest (no prefix) of the file's exact UTF-8 bytes; `byte_length` is the UTF-8 byte count (`new TextEncoder().encode(text).length`, never the ECMAScript string length). `record_count` is the number of JSONL lines, or CSV data rows (header excluded); `field_count` and `field_list_mismatch_count` appear only on `site_evidence_wide.csv`, as before this change. A file with zero records is still written (an empty JSONL file, or an empty CSV as before) and still listed.
- `included_task_ids`, `included_review_decision_ids`, and `included_acceptance_ids` are sorted (byte order) and de-duplicated in the manifest, whatever order the batch row stores. `evidence_version_hashes` is the sorted, de-duplicated set of `object_hash` values in `evidence_versions.jsonl`; `review_snapshot_hashes` is the sorted set of `snapshot_hash` values in `review_snapshots.jsonl`.
- `frozen_at` and `manifest_hash` are present only on a frozen bundle. A draft preview, or the live preview of a batch frozen before this change, carries neither and is not a verifiable bundle.
- `supersedes_export_batch_id` is present only when the batch was created to replace an earlier frozen batch.

The bundle carries sixteen files. Twelve existed before this change (`tasks.jsonl`, `task_events.jsonl`, `evidence_drafts.jsonl`, `historical_claims.jsonl`, `review_decisions.jsonl`, `site_occupancies.jsonl`, `derived_target_year_states.jsonl`, `derived_year_locations.jsonl`, `derived_target_year_functions.jsonl`, `derived_state_events.jsonl`, `site_evidence_wide.csv`, and `export_manifest.json` itself). Four are new: `evidence_versions.jsonl` (every `evidence_versions` row of each included task, each an `evidence-version.v1` envelope), `evidence_head_changes.jsonl` (every `evidence_head_changes` row of each included task), `task_acceptances.jsonl` (every `task_acceptances` row of each included task, all outcomes, not only the accepted ones the manifest's `included_acceptance_ids` names), and `review_snapshots.jsonl` (the `review_snapshots` rows named by `review_snapshot_hash` on the included decisions, de-duplicated, sorted by `snapshot_hash`). Row content follows the Convex documents as stored, including `_id` and `_creationTime`, one JSON object per line.

`convex/exports.ts`'s builder is deterministic for a fixed database state: every read is an indexed lookup over a sorted task/decision id list, and nothing but `frozen_at` (passed in, not read fresh) touches the clock.

## Freezing

`exports:freezeExportBatch({ exportBatchId })` (role `curator` or `admin`) is now an **action** orchestrating three internal mutations, so each step is transactional and the action itself holds no state beyond the storage ids it created:

1. **`internal.exports.prepareFreeze({ exportBatchId, userId, attemptId })`.** Requires the batch `draft`. Re-runs, for every included task, the shared authority check `assertTaskExportAuthority(ctx, taskId)` (also called by `createExportBatch`): the task exists and is `pi_accepted`, is not training-excluded, the decision named by the task's latest accepted acceptance (or the newest accepted decision, absent an acceptance row) is still `accepted_for_export`, its pinned `evidence_version_hash` still matches the draft's current hash, and, when it is snapshot-linked, `reviews:assertDecisionSnapshotConsistent` passes. The batch's stored `included_review_decision_ids` and `included_acceptance_ids` must still equal what that recheck returns now, as sorted sets; a difference refuses ("membership changed since it was created ... create a new batch"). On success it builds the complete bundle at `frozen_at = Date.now()`, computes every file hash and the manifest hash, and records `pending_freeze: { attempt_id, started_at, started_by, manifest }` on the batch. That is its only write, so any refusal above it leaves the batch completely untouched.
2. **The action stores every file.** For each of the sixteen files it calls `ctx.storage.store(new Blob([text], { type: content_type }))`, then `ctx.storage.get(storageId)` and `crypto.subtle.digest("SHA-256", await blob.arrayBuffer())`, and compares the digest and byte length to a reference computed before the store call. Any mismatch, for any file including the manifest itself: delete every blob stored during this attempt (including the one that just failed its own check) and call step 4.
3. **`internal.exports.completeFreeze({ exportBatchId, attemptId, userId, storedFiles })`.** Requires the batch still `draft` and `pending_freeze.attempt_id === attemptId` (a second, overlapping attempt replaced it: refuse with "this freeze attempt is no longer current"). Rebuilds the bundle from the current rows with the same `frozen_at` and compares every file's SHA-256 to `pending_freeze.manifest`; any difference means a row changed between capture and completion, and it refuses, naming the file. On success it patches the batch (`status: "frozen"`, `frozen_at`, `freeze_completed_at`, `bundle_contract`, `manifest_hash`, `frozen_files: [{ filename, storage_id, sha256, byte_length, content_type }]`), clears `pending_freeze`, moves every included task to `exported` with the `exported` event exactly as before this change, and, when the batch carries `supersedes_export_batch_id`, marks the earlier batch `superseded` with `superseded_by_export_batch_id` and `superseded_at` (its own bytes and `frozen_files` untouched).
4. **`internal.exports.recordFreezeFailure({ exportBatchId, attemptId, reason })`.** If the batch is still `draft` and either carries no `pending_freeze` or one matching this attempt, clears `pending_freeze` and sets `last_freeze_failure: { attempt_id, at, reason }`; an older attempt's belated failure does not clobber a newer, still-current attempt's `pending_freeze`. The action deletes any blobs it stored before calling this and rethrows, so the caller sees the original reason. A failed freeze leaves the batch `draft` and every task where it was.

The action's return is `{ export_batch_id, status: "frozen", manifest_hash, frozen_at, file_count }`.

## Retrieval

`exports:getExportBundle({ exportBatchId })` (role `curator` or `admin`) is now an **action** returning `{ export_manifest, files, disposition }`. `files` carries the same keyed object of texts as before this change, plus the four new keys (`evidence_versions_jsonl`, `evidence_head_changes_jsonl`, `task_acceptances_jsonl`, `review_snapshots_jsonl`). The typed row arrays the query used to return (`tasks`, `task_events`, ...) are gone: nothing outside `convex/` read them, and they doubled the payload.

- **A batch with `frozen_files`** (frozen, withdrawn, or superseded): every blob is read from storage and verified against `frozen_files` (SHA-256 and byte length), and the manifest file is parsed and its `manifest_hash` reproduced; a mismatch refuses, naming the file and both hashes, and the bundle is never rebuilt from rows. `disposition` carries `stored_bytes: true`, `verified: true`, and `processing_allowed` true only when `status === "frozen"` (a withdrawn or superseded batch still serves its bytes but is not processed further).
- **A `draft` batch:** built as a live preview through `internal.exports.buildDraftBundle`, with no `frozen_at` and no `manifest_hash`. `disposition` carries `stored_bytes: false`, `verified: false`, `processing_allowed: false`.
- **A legacy frozen batch** (any status with no `frozen_files`, i.e. frozen before this change): served the same live rebuild as a draft, but carrying the row's own `frozen_at`; `disposition` adds `legacy_unfrozen_bytes: true`. Such a batch cannot be re-frozen; a curator creates a new batch.

## Withdrawal and supersession

- **`exports:withdrawExportBatch({ exportBatchId, reason })`** (mutation, `curator` or `admin`): requires a `frozen` batch carrying `frozen_files`; `reason` trims to at least 8 characters (the same floor as PI acceptance notes) and obeys the task reason limit. Sets `status: "withdrawn"`, `withdrawn_at`, `withdrawn_by`, `withdrawal_reason`. Bytes, `frozen_files`, and `manifest_hash` stay. Task statuses are not changed; an exported task returns to review only through `tasks:reopenTask`, as before. Each included task receives a `note_added` event naming the batch and the reason. A draft, already-withdrawn, or superseded batch is refused.
- **`createExportBatch` gains an optional `supersedesExportBatchId`.** The named batch must exist, be `frozen` (not draft, withdrawn, or already superseded), and carry `frozen_files`; the id is stored on the new batch as `supersedes_export_batch_id` and appears in its manifest. The earlier batch's status changes only when the new batch's freeze completes (`completeFreeze`, above). Creating the new batch alone does nothing to the earlier one.
- **`exportBatchStatus` gains the literals `withdrawn` and `superseded`.** No existing code path writes `exported`, `validated`, `failed`, or `archived`; this change leaves them as they were.

## Schema additions (`export_batches`)

All optional and additive; existing rows are untouched: `pending_freeze: { attempt_id, started_at, started_by, manifest: v.any() }`, `last_freeze_failure: { attempt_id, at, reason }`, `freeze_completed_at`, `bundle_contract`, `manifest_hash`, `frozen_files: [{ filename, storage_id: v.id("_storage"), sha256, byte_length, content_type }]`, `withdrawn_at`, `withdrawn_by: v.id("users")`, `withdrawal_reason`, `supersedes_export_batch_id`, `superseded_by_export_batch_id`, `superseded_at`.

## Limits and lean-storage levers

The hashes are small; the copies are not. A frozen batch stores every row of every included task once, a snapshot-linked decision stores a full copy of its task's review state, and every evidence version stores a full copy of the evidence content. In the committed fixture (`schemas/fixtures/pow-export-bundle.v1`, one task, one guided draft, one snapshot-linked acceptance) the bundle is 45 KB, the snapshot 16 KB, and the three versions 7.2 KB together; live drafts carry the generated wide row and run larger. Two limits follow. First, `prepareFreeze` returns every file's text to the action in one mutation result and `getExportBundle` returns them in one action result, so a batch is bounded by the Convex per-call payload limit (16 MiB): a few hundred ordinary tasks per batch today, so a country is frozen in several batches rather than one. Second, every superseding batch keeps the earlier batch's bytes, so storage grows with the number of freezes, not only with the number of places. Levers not yet taken, in the order they would be applied: compress bundle files before storing them (JSONL compresses five to ten times); freeze in pages so batch size is bounded by storage rather than by the per-call limit; make snapshots reference the pinned version hashes rather than copy the task history; export incrementally with the manifest naming the batch it extends; move frozen bytes to the project's R2 bucket if Convex file storage becomes the constraint.

## Out of scope

The export queue, PI batch release, the decision hash version 2 envelope, proposal pinning, reading the accepted version's stored envelope in place of the draft row for `site_evidence_wide.csv`, a portal surface for batches, and any migration of existing frozen batches. `pow export verify` and the materialisation script's handling of the new bundle shape are documented in `docs/api/workflow-scripts.md` and the `pow` command-line help.
