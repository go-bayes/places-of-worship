# PR-D build brief — Bob Woodberry's Vanuatu stations as a bulk occupancy import (2026-09-02)

Implements section 4 of `docs/portal-location-and-occupancy-plan.md` (ruled 2026-09-02) on the occupancy lane of `occupancy-build-brief-2026-09-02.md` (PR-B′) and the batch-import contract of `docs/portal-batch-import-and-corrections.md` (ratified 2026-07-07). The intake profile `~/GIT/pow-research/research/countries/vu/woodberry-data-profile.md` (2026-08-29) is the evidential basis for every reading rule below; the ten questions it puts to the compiler are still unanswered (he is back after Saturday 6 September), so each reading is recorded here as an assumption he can overturn per place in review.

## 1. What ships

1. **Import columns.** The bulk-import row gains one period per row (`convex/lib/occupancyImport.ts`; column table in the import contract doc): rows of one place share `source_locator` and are numbered by `segment_index`; the temporal, location, and provenance columns are the `occupancy_v1` contract in CSV form. `segmentFromImportRow` is the one reading of the columns; vocabulary and number problems are reported there, and the set is then validated by `assertOccupancySet` exactly as an RA submission is, so the import cannot accept what the RA pane refuses.
2. **Ingest mutation.** `batchImport:adminImportOccupancyBatch`, admin-key only, acting as a named active service or admin user (`actor_email`), the route used for the Port Vila survey seed. Each accepted place lands **submitted**: a `needs_review` task carrying the first period's location assertion (so the reviewer sees the grade), a submitted `guided_observation_v1` draft with every target year `not_assessed`, the `site_occupancies` rows, and the derived census-year presence and location rows as `derived_unconfirmed`, all written through `recordOccupancySet`, the write route now shared with `submitOccupancies`. Per-place reports (imported / rejected / parked_sensitive / skipped_existing); idempotent per source on the (source, locator) key and the content hash; caps of 100 places or 400 rows per run. Builder notes travel as `import_note_n` info checks on the task.
3. **Builder.** `scripts/build_vu_woodberry_import.py` reads the two station workbooks from their quarantine in pow-research (SHA-256 checked against the profile), writes per workbook the import CSV (the reviewable artefact), chunked run files, and `report.md`; nothing derived from the workbooks is committed here. Every repair, exclusion, and reading rule is a named constant in the script.
4. **Not in scope.** The two missionary workbooks (tenures) wait on the living-persons ruling; the collection display layer (`collection.v1`, layer families pilot 1) is separate; the workbench curator screen keeps importing drafts without periods until it adopts the columns.

## 2. Why submitted, when the import contract says drafts

The ratified 2026-07-07 contract lands curator imports as drafts because submission must be a deliberate human act. Plan section 4 rules that this ingest creates the task, the draft, the occupancy rows, and the unconfirmed derived rows in one transaction so that the reviewer confirms on the drawn interval. The occupancy engine attaches only to a submitted parent, so the two texts can only both hold if the deliberate act moves one step earlier: the admin running the mutation under a named service or admin user, whose id every row and event carries. Nothing downstream changes: the drafts are not accepted, the review gates and the author-cannot-confirm-own rule stand (the author is the service actor, so JB, Bob, and any other reviewer may confirm), and no target-year status is written until a reviewer acts.

## 3. Reading rules (assumptions for the compiler)

| # | Rule | Basis in the profile | Overturn by |
|---|---|---|---|
| A1 | Catholic `open`/`close` years are stated foundings and closures (`founding_stated`, `closure_stated`, reason `closed`). | Open years precede the Directory ranges in 25 of 27 stations; 53 notes carry month-level dates. | Bob's answer to question 1; a reviewer override per year. |
| A2 | A close followed by an open in the same year at the same point is a status change (station ↔ outstation), not a closure; the period continues. | Definition v0.1.4 continuant rule; no station changes coordinates. | Per place, in review. |
| A3 | `censored` (and, for the atlas, the last edition seen) is "in use at the last observation, nothing asserted after": `end_mode: after`, `end_not_earlier_than` = that year, `end_basis: last_seen_only`, `end_reason: unknown`. Every VU census year after it derives `uncertain` (rule 7). | Profile section 3: censoring is the end of observation, never a closure. | Reviewer confirms or overrides per year. |
| A4 | Atlas presence starts at the parenthesised year where one is printed (`founding_stated`), else at the first edition (`first_seen_only`); a gap between editions is not a closure. | All 43 parenthesised years precede the edition printing them. | Bob's answer to question 1 (who supplied the years). |
| A5 | Every point is an approximate area with basis `map_placement`. Radius: Catholic 500 m, 2 000 m where the compiler's note reads as a guess; Protestant 1 000 m, 2 000 m for two-decimal coordinates, 5 000 m where the note reads as a guess. | Profile section 2: no precision field; guesses named in the notes. | Bob's answer to question 2; reviewer override of the location. |
| A6 | `culturally_sensitive: no` on every row: mission stations are church sites, not kastom sites. | The kastom prompt concerns tabu sites. | Per row, in review. |
| A7 | Catholic year values are calendar years; month-level dates in the notes are not encoded. | The `Year` column is integer; notes are prose. | Follow-on builder pass if wanted. |
| A8 | Both source records are registered under `source_type: other` with no licence, so every draft carries `licence_flag: needs_review`. | Credit and licence wording not yet agreed (question 9). | Bob's reply; re-run updates nothing (idempotent), so the register row is edited by hand. |

## 4. Repairs and exclusions (disclosed on the task and in the build report)

- **Port Vila longitude** 68.3152 → 168.3152 (leading digit missing in the source); an `import_note` check on the task, the wording on the period, and the report all say so.
- **Excluded, Catholic:** Santa Cruz on Tikopia (Solomon Islands; out of country).
- **Excluded, Protestant:** rows 9 (Banks Islands, no point), 20 (Maewo, no point), 26 and 38 (marked not stations), 39 (South Santo, no point; Tangoa has its own row), 46 (Wala: the point duplicates Santo / Luganville and is known wrong; withheld until the compiler resolves it).
- **Irregular sequences read leniently** and recorded on the task: Atchin (duplicate closes 1967, 1969; the first close kept), Dixon (close without a year → end unknown), White Sands (no dated event → period read from the Directory attestation 1951–1973 as first seen / last seen).
- **Shared points:** Big Bay and Santo (Protestant) share a coarsened point; both import with a mutual `import_note` so the reviewer decides whether they are one place.

## 5. Counts (build of 2026-09-02)

| Source | In source | Places imported | Periods |
|---|---|---|---|
| Catholic Mission Stations (13 Jan 2026) | 41 stations | 40 | 48 |
| Protestant station locations from Atlases 2 | 46 rows | 40 | 40 |

Period shapes: 21 known–known, 64 known–after, 1 between–after, 1 unknown–after, 1 known–unknown. A dry run of all 80 places through `segmentFromImportRow`, `assertOccupancySet`, and `assertLocationAssertion` (VU floor 1600) passed with no rejection.

## 6. Running it

Convex before static: deploy the branch's `convex/` to the target deployment before merging. Then, from the repo root with that deployment selected:

```
uv run --with openpyxl python scripts/build_vu_woodberry_import.py
npx convex run batchImport:adminImportOccupancyBatch "$(cat ~/GIT/pow-research/data/derived/vu_woodberry_import/run-catholic-01.json)"
npx convex run batchImport:adminImportOccupancyBatch "$(cat ~/GIT/pow-research/data/derived/vu_woodberry_import/run-protestant-01.json)"
```

The service actor `service+claude@religionmap.org` must exist and be active on the deployment (it does on dev from the Port Vila seed). Re-running a file skips every place already imported and reports it. `pastel-goshawk-398` is the deployment religionmap.org serves, so the run is a live action: JB runs it.

## 7. Acceptance

- `npx tsc --noEmit -p tsconfig.json`; `node --test convex/lib/*.node-test.mjs` (133, including 11 new for the column reading); `python3 -m unittest scripts/test_build_vu_woodberry_import.py` (22, synthetic rows only; CI).
- After the run: the VU review queue lists 80 `needs_review` tasks in the two batches; each task's occupancy panel draws the interval and lists the four census years as derived proposals; `Confirm all eligible` confirms nothing on the Protestant rows (every year is rule 7 uncertain) and only stated-closure years on the Catholic rows (rule 4 absent); the export bundle carries the rows in `site_occupancies.jsonl` and nothing in the wide CSV until a reviewer confirms a year.

## 8. Follow-ons

- Deep-time date format (plan R6) is unaffected: nothing here predates 1842.
- Missionary tenures on stations wait on the living-persons ruling (layer-families design, interim rule: a name ships only where a death is recorded).
- When Bob answers questions 1–3, re-read A1, A4, and A5; a changed reading is a new batch id, not a rewrite (rows supersede, never overwrite).
- Owed to Bob in the thread: the 1 September email stated the site-based relocation rule; v0.1.4's continuant rule supersedes it (A2 applies it).
