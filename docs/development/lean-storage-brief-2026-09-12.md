# Lean storage for versions, snapshots, and frozen exports: design brief (2026-09-12)

Status: BRIEF, prepared by Claude (Fable 5.1) for the project lead's ruling after PR #112 (open, not merged), stacking on `frozen-exports.md`, changing nothing live. Three independent judges scored five designs on five criteria (integrity, size at scale, indefinite lifetime, operability, simplicity), 0 to 10 each, 50 per judge; raw outputs, including the critique of this draft, are archived in the private repository at `handover/lean-storage-workflow-2026-09-12/` (`size-model.json`, `designs.json`, `judgements.json`, `critique.json`).

Units: KB and MB are 10^3 and 10^6 bytes; KiB and MiB are 1,024 and 1,048,576 bytes, for Convex limits. A review cycle is one submission, review, and acceptance pass; PI is the principal investigator.

## 1. The problem

The site "should be thought of as existing potentially indefinitely" (the project lead). Three stores grow, each copying the same content again.

An evidence version (`convex/lib/evidenceVersions.ts` `buildEvidenceVersion`, one row per write onto submitted content) copies the draft content; `EVIDENCE_ROW_EXCLUDED_FIELDS` does not exclude `generated_wide_row`, so the portal's 130 to 141 field wide row (11.2 KB) sits in every version. A realistic version row is 17 KB: 11.2 KB wide row, 4.65 KB evidence fields and occupancy set, 0.6 KB hash, lineage, and actor members; whether the wide row is evidence is ruling 9's question. A review snapshot (`convex/reviews.ts` `reviewSnapshot`) copies the task, draft, and every decision, event, agent review, claim, occupancy, and derived row: 35 KB at a first cycle, 9 KB more per earlier cycle, until `verifySnapshot`'s 128 KiB cap refuses acceptance around the twelfth cycle; `batchRecordReviewDecisions` binds sooner, capping 1 to 20 decisions at 512 KiB of snapshots (14 tasks at cycle 1, 11 at cycle 2). A frozen bundle (`convex/exports.ts` `buildBundle`) copies every row of every included task: 141 KB per task plus 110 KB per further cycle.

Two limits bind first. `createExportBatch` (`convex/exports.ts`) selects `pi_accepted` tasks with `.take(1000)` and returns `included_task_count: 1000`, reporting the count and not the truncation, so the first New Zealand batch omits 2,370 of 3,370 places. Its freeze fails inside `prepareFreeze`, which runs `assertTaskExportAuthority` and `buildBundle` for every task in one mutation: 1,000 realistic tasks read about 141 MB against the 16 MiB transaction read cap and about 40,000 rows against the 32,000 documents-scanned cap, refusing before any result exists; the 16 MiB result cap would then hold a batch to about 118 tasks. Projections in MB, uncompressed:

| Scenario | Versions | Snapshots | Frozen exports | Total (model) | Total (corrected) |
| --- | ---: | ---: | ---: | ---: | ---: |
| (a) 3,670 places, year 1, one cycle | 187 | 193 | 517 | 897 | 897 |
| (b) 250,000 places, 10 years, two cycles | 25,500 | 29,625 | 235,125 | 290,250 | 153,125 |
| (c) 2,000,000 places, 50 years, five cycles | 510,000 | 795,000 | 3,610,000 | 4,915,000 | 4,915,000 |

The corrected column removes yearly re-freezes of unchanged tasks, which the code cannot produce: `convex/lib/acceptance.ts` `exportRefusalForTask` admits only `pi_accepted` tasks and `completeFreeze` moves every included task to `exported`, so export bytes grow with review cycles, not calendar freezes; only scenario (b) assumed them.

## 2. Constraints

The D20 gates (`DECISIONS.md`, private repository, line 538) stand: acceptance binds to the exact reviewed content; a freeze rechecks eligibility and pinned versions, captures the complete bundle, and stores and verifies its bytes before marking the batch frozen; withdrawal or supersession preserves those bytes. `pow` verifies a bundle with no call to Convex (`crates/pow-cli/src/export.rs` `verify_bundle` takes a directory). Stored formats stay plain (JSON, JSON Lines, CSV, gzip) so `sha256sum`, `gzip`, and a JSON parser suffice after the software is gone.

## 3. The recommended design

Budgeted batches, compressed bytes in a locked bucket on R2 (Cloudflare's object storage, already used for attachments via `convex/lib/r2Presign.ts`), then slimmer rows: three bounded PRs, each leaving `pow-export-bundle.v1` and the fixture byte-identical.

### 3.1 Mechanism

Batch composition. `exports:composeExportBatches({ countryCode })` replaces the `.take(1000)`: it pages `pi_accepted` tasks through `tasks.by_country_status`, estimates bundle bytes with `collectBundleRows`'s reads, cuts a batch at `EXPORT_BATCH_BYTE_BUDGET` (6 MiB, about 44 cycle-1 tasks), and creates each through an internal mutation that runs `assertTaskExportAuthority`. A replaced draft takes the unused status `archived`; an explicit list over budget is refused. The budget holds `prepareFreeze` at 37.5% of the 16 MiB caps and the batch document (id lists held twice, on the batch and in `pending_freeze.manifest`, about 150 B per task) near 15 KB against the 1 MiB document cap.

Freezing a country. `exports:freezeCountryBatches({ countryCode })` freezes one draft batch per invocation and schedules the next through `ctx.scheduler.runAfter(0, ...)` under a per-country run lock; a curator re-run resumes a stopped chain. One invocation per batch is the normal path: an action is capped at 30 minutes (10 on Node) and a batch (read, gzip, 48 R2 round trips, rebuild) takes about a minute, so NZ's 77 cycle-1 batches cannot freeze in one action. Recommendation: the chain; nobody need watch it. A batch fits one transaction, so `completeFreeze` keeps its exact rebuild-and-compare guard: no witness, no paging.

Compression. The action gzip-compresses each file at level 6 with a pinned pure-JS codec (`fflate`): the default runtime lists no `CompressionStream`, and Node has `zlib` but a 10-minute cap (its 5 MiB argument cap does not bind: the files arrive as a mutation result). Four values per file: plain SHA-256 and byte length (as `sha256(file.text)` and `utf8Length` compute today in `freezeExportBatch`) and stored SHA-256 and byte length over the gzip bytes, with codec name, version, and level recorded beside them so stored bytes can be reproduced, not only checked.

Durable home. A new `convex/lib/bundleStore.ts` wraps either today's `ctx.storage` or an R2 store on `presignR2Url` (gaining `HEAD`; a presigned URL signs one method, key, and expiry so its holder makes that request without the credential). `EXPORT_BUNDLE_STORE=r2` selects R2; unset means today's path, so deploying changes nothing. `pow-exports` sits under an indefinite bucket lock on `objects/` and `batches/`. A lock stops deletion and overwriting by any object-level credential, but Cloudflare's documentation says a token permitted to edit bucket configuration can remove the rule, so the guarantee rests on ruling 6's token scoping.

Keys: `objects/sha256/<plain sha256>.gz` per file (stable whatever gzip emitted); `batches/<CC>/<export_batch_id>/frozen.json` (batch id, contract, `manifest_hash`, `frozen_at`, codec, each file's key and four hashes), `README.txt`, `SHA256SUMS` in the form `sha256sum -c` reads (hash, two spaces, filename), and `disposition/<ms>-withdrawn.json` or `-superseded.json` on those transitions. Across batches only empty files share a plain hash (`historical_claims.jsonl`, `derived_target_year_functions.jsonl`), so the key rule buys idempotent retries, not cross-batch saving. Per file:

1. `HEAD` the key.
2. If present: `GET`, verify both hashes and lengths, reuse.
3. If absent: `PUT` with `Content-MD5` and `If-None-Match: *` (put-if-absent: no overwrite of an existing key), then the same `GET` and verifications.
4. Record the key in `pending_freeze.stored_objects`, so a dead attempt leaves a trail.

After all sixteen files verify, the action calls `completeFreeze`, which changes in two places: its `storedFiles` validator, today requiring `storageId: v.id("_storage")` on every entry (`convex/exports.ts`), makes `storageId` optional and adds `r2_key`, `encoding`, `stored_sha256`, and `stored_byte_length`; and its patch writes those fields into `frozen_files` and stamps `last_export_batch_id` and `last_exported_at` on each task beside the `exported` patch. After commit the action writes the batch records put-if-absent (`exports:repairStoreRecord` repairs). The R2 failure branch deletes nothing (today's `freezeExportBatch` deletes every blob it stored); an orphan is reused on retry. A failed attempt leaves at most sixteen objects, about 0.6 MB, permanently; a leaked object-write token could fill the locked prefix with undeletable bytes, hence rotation in ruling 6.

Retrieval. `getExportBundle` keeps its shape; an entry without `encoding` is verified as today, so a batch frozen under #112 stays served, and the one legacy batch without `frozen_files` or any pre-L2 batch may be copied to R2, deleting nothing (ruling 8). New `exports:getExportBundleLinks` returns the verified manifest, `disposition`, and a presigned GET per file (600 s, as `convex/attachments.ts` `VIEW_URL_SECONDS`), so no bundle text transits a Convex call. New `pow export fetch` downloads with a read-only token, verifies stored bytes against `frozen.json`, gunzipped bytes against `files[]` and the key, and `manifest_hash`, reports disposition records (refusing under `--require-processable`), and runs the unchanged `verify_bundle`; nothing consults Convex.

Slimmer rows (third lever, rulings 9 and 10). `evidence-version.v2` moves `generated_wide_row` out of the envelope payload into an insert-only `objects` table, referenced by object hash, dropping `fields` and `tsv` (5.0 KB duplicating the field list and `row`): a version row falls from 17 KB to 5.3 KB, the wide row is stored once per draft, v1 rows are untouched. `review-snapshot.v2` records a manifest of member hashes with every member copied into `objects` (copied so the hash commits to existing bytes), removing the 128 KiB and 512 KiB cliffs, inside proposal pinning (the D20 step binding PI acceptance to the pinned version).

### 3.2 Contract changes

Manifest `pow-export-bundle.v1`: no member added, removed, or redefined; `files[].sha256` and `byte_length` keep describing plain bytes; `schemas/fixtures/pow-export-bundle.v1` stays byte-identical under `scripts/export_bundle_fixture.mjs --check`. Store contract `pow-export-store.v1` (in `frozen-exports.md`): key layout, `frozen.json` members including the codec record, `README.txt`, `SHA256SUMS`, disposition records, lock rules. `export_batches` (all optional): `estimated_bytes`, `storage_backend`, `store_record_pending`, the `frozen_files[]` fields above, `pending_freeze.stored_objects[]`; `tasks` gains `last_export_batch_id` and `last_exported_at`.

### 3.3 Size reduction

Per-cycle units. Versions after v2: three at 5.3 KB plus one 11.2 KB wide row per draft, 3 x 5.3 + 11.2 = 27.1 KB per task per cycle. Snapshots after v2: a cycle-1 snapshot's members without the wide row (already in `objects`) are 23.3 KB, copied once by hash, plus 1.5 manifests of about 4 KB, 23.3 + 1.5 x 4 = 29.3, taken as 29 KB per task per cycle; later snapshots copy only new rows, so the unit does not grow. Exports after the wide-row move: the size model's 95 KB per task-freeze at cycle 1 (the bundle's snapshot keeps its wide row) and 110 minus 54 plus 16 = 72 KB per further cycle, cumulative. Gzip measured 10.7x on the realistic bundle as one stream and 7.4x as sixteen files, so 8x is the floor and 10x the point; compounding is not counted. Below, exports are compressed and database columns are not. In MB:

| Scenario | Versions | Snapshots | Frozen exports (gzip) | Total |
| --- | ---: | ---: | ---: | ---: |
| (a) year 1 | 99 | 106 | 35 to 44 | 240 to 249 |
| (b) 10 years | 13,550 | 14,500 | 6,550 to 8,188 | 34,600 to 36,238 |
| (c) 50 years | 271,000 | 290,000 | 239,000 to 298,750 | 800,000 to 859,750 |

Cost at (c), like with like (both compressed, Professional inclusions subtracted): exports in R2 Standard (USD 0.015 per GB-month, free egress), 239 to 299 GB, USD 3.6 to 4.5 a month; the same bytes in Convex file storage at USD 0.03 above 100 GB, USD 4.2 to 6.0; today's uncompressed bytes there, USD 105. Database at USD 0.20 per GB-month above 50 GB: USD 251 before (1,305 GB), USD 102 after (561 GB); the database term dominates, so the third lever is sequenced, not dropped. Plan allowances bind first (ruling 13): on the Convex path each freeze reads back every blob (`ctx.storage.get` in `freezeExportBatch`), charging file egress before any download, and a full NZ retrieval adds about 0.5 GB against 1 GB a month on Free and Starter; three row reads per task (composer, `prepareFreeze`, `completeFreeze`) make 3 x 141 KB x 3,370, about 1.4 GB of database bandwidth per NZ freeze, against 1 GB a month on Free and Starter and 50 GB on Professional.

In-database compression is a fourth lever, not taken: `envelope_json` and `snapshot_json` as gzip bytes in a `v.bytes()` field with the same codec, measured 4.4x on an envelope and 6x on a snapshot, at the cost that every reader must gunzip first. Recommendation: not now; the wide-row move removes 71% of a version with no reader change, and it remains if the database term still dominates after L4.

## 4. Alternatives considered

Totals out of 150: operations 97, minimal 95, external-durable 94, content-addressed 90, archival 89 (per-judge scores follow). Minimal (33, 31, 31): gzip parts, paged capture, and a per-task change witness in place of the exact rebuild, put first by judges one and two; this brief follows judge three: budgeted batches need no paging and the witness holds only while every write route touches the task row. Content-addressed (31, 30, 29): every object once by hash, bundles as delta packs (files holding only objects new since the batch they extend) and per-task trees (hash lists naming a task's objects) under a Merkle commitment (a hash over hashes, one root binding every member); three new contracts and a `pow export expand` for every reader; only its row slimming is taken, third on judge two's cost analysis. External-durable (32, 30, 32): the locked bucket, keys, records, and `pow export fetch`, taken here; removes no bytes. Archival (30, 29, 30): plain-file editions with a git ledger, frozen by a scheduler chain that flips tasks to `exported` before the edition completes; layout taken, freeze not. Operations (33, 31, 33): composer taken first, scheduler as the one-batch chain; hash-linked chains, crons, panel, and item-level returns deferred. Regenerating the wide row at export time, storing none, is the leanest option and appears in no design; ruling 9 offers it.

## 5. Sequence of PRs

1. Merge PR #112 unchanged; deploy Convex before static.
2. PR L1, lean freeze (no contract change): composer, budget, `archived`, `last_export_batch_id`, the scheduler chain, gzip with four-value verification and codec record, `frozen_files` encoding fields, `pending_freeze.stored_objects`. Verification: `npx tsc --noEmit`, the `convex/testing/exportWorld.node-test.mjs` harness with a 200-task country, corruption tests, fixture `--check`.
3. PR L2, durable home: `bundleStore.ts`, `HEAD` in `r2Presign.ts`, the env-gated R2 path, batch records, `getExportBundleLinks`, then `pow export fetch` with SigV4 (AWS Signature Version 4, which R2 accepts; `hmac` and an HTTP client join `Cargo.toml`). Verification: fake-store tests and one freeze on the local backend against a real bucket; ops runbook under D20.
4. PR L3, `evidence-version.v2` (own brief after ruling 9); PR L4, `review-snapshot.v2` inside proposal pinning.
5. Deferred: section 7.

## 6. Rulings for the project lead

1. Adopt section 3 as D20 step two-b, before proposal pinning. Recommendation: yes.
2. Batch byte budget 6 MiB raw, composer as the normal path, explicit lists refused over budget. Consequence for the deferred batch-release step: with exact membership at release, NZ is 77 PI releases per cycle, so the release brief should let one PI act cover a country's run. Recommendation: yes.
3. Pinned pure-JS gzip (`fflate`) with codec name, version, and level in `frozen.json`, or identity encoding now. Recommendation: gzip.
4. A dedicated `pow-exports` bucket under an indefinite lock on `objects/` and `batches/`, accepting permanent orphans (about 0.6 MB per failed attempt); removing the lock is an account-owner act recorded in `DECISIONS.md`. Recommendation: yes.
5. Storage class Standard, default region (R2 has no New Zealand region). Recommendation: yes.
6. Credentials: one Convex token with object read and write on `pow-exports` and no bucket-configuration permission, so it cannot remove the lock; one object-read-only token for `pow`; both rotated on schedule and on any suspected leak; holders named. Recommendation: yes.
7. Retention: bytes of a frozen, withdrawn, or superseded batch are never deleted by any code path. Recommendation: never purge.
8. Batches frozen into Convex file storage before L2: copy to R2 recording both locations, or leave. Recommendation: copy.
9. Move `generated_wide_row` out of new version envelopes into `objects`, referenced by hash, dropping `fields` and `tsv`; or regenerate it at export time and store none. Recommendation: move and reference, in its own brief, since `site_evidence_wide.csv` is built from it.
10. Confirm `review-snapshot.v2` (manifest of member hashes, members copied) lands inside proposal pinning.
11. A reopened `exported` task: `reopenTask` (`convex/tasks.ts`, touching no batch today) records the return on its batch, and `processing_allowed` is false batch-wide until the curator withdraws or supersedes it; its co-batched tasks then have their only frozen record in an unprocessable batch, and `exportRefusalForTask` refuses them for a superseding batch. Recommendation: let a superseding batch re-include the superseded batch's unchanged `exported` tasks (scoped in `exportRefusalForTask`).
12. The `exported` transition stays at freeze completion (surfaced 2026-09-12); confirm.
13. The Convex plan tier, which decides whether file egress and database bandwidth (section 3.3) bind.
14. A second independent copy: a bucket lock protects against deletion by credential, not account closure, non-payment, or vendor retirement. Options: a second-provider mirror, or a periodic `pow export fetch` into a university-held store with `SHA256SUMS` committed to `pow-research`. Recommendation: the university copy, monthly from the runbook.

## 7. What this brief does not decide

The v2 manifest (`generator_commit`, chain members), delta bundles, packs and trees, hash-linked chains, a curator panel, an editions ledger, a second-provider mirror, in-database compression, wide-row regeneration, redaction of frozen bytes, PI batch release beyond ruling 2, and the `exported` transition beyond its placement.
