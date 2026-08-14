# Repo stocktake — 2026-08-14

Inline architecture audit of the public repo (`main` at `315f3d2`), run before spending any `/code-review ultra` use. Four parallel read-only audits covered `apps/`, `convex/` + portal, the pipeline tier, and the legacy trees. Output: subsystem inventory, live-vs-dead map, duplication findings, a keep/kill/converge decision list, and the three recommended ultra-review targets.

## Headline findings

1. **The global map is a hand-maintained fork.** About 2,700 of the 2,856 inline JS lines in `apps/global/index.html` (~95%) are a line-for-line copy of `apps/regions/_shared/region-map.js`, down to a shared dead variable (`isPlacesmapHost`). Parity is kept by hand, and every runtime fix must land twice.
2. **The typed surface is inverted.** The strictly-typed React workbench (`apps/workbench/`, never deployed) talks only to localStorage; the code that actually talks to Convex is ~6,700 lines of untyped vanilla JS in `apps/regions/nz/js/` (`verification-map.js` alone is 5,169 lines). The only code with a live backend has no type contract with `convex/_generated/api`.
3. **The domain migration never reached the app tier.** Zero references to `religionmap.org` anywhere in `apps/`; 13 files (including README and RA-facing docs) still cite `placesmap.org`/`powmap.org`, and the live Guide buttons in `review.html`, `verification.html`, and `verification-map.js` link to `www.placesmap.org`.
4. **André's "server call on every pan" is MapLibre tile traffic.** The `moveend` handlers run only client-side work; the observed requests are MapLibre fetching vector tiles from `tiles.placemap.org`, and there is no app-level fetch to buffer. The fix lives at the tile layer (R2 worker cache headers, zoom tuning), and the fork means it currently has to be done twice.
5. **`api/` is dead**, kept alive by Dependabot alone since 2025-09. Convex replaced it. The repo also has **no CI at all** (`.github/` holds only CODEOWNERS): nothing runs `tsc`, the 19 `pow` tests, the one portal test, or the area-summary validator.

## Subsystem inventory

| Tree | What it is | Tracked | Last commit | Verdict |
| --- | --- | --- | --- | --- |
| `apps/regions/` | 100 country pages + committed data products (274 MB) | 686 files | 2026-07-18 | Live — centre of gravity |
| `apps/regions/_shared/` | Shared region runtime (`region-map.js`, 5,467 lines) | 7 | 2026-07-17 | Live |
| `apps/global/` | Global map, single 2,951-line `index.html` | 4 | 2026-07-17 | Live, but a fork (see below) |
| `apps/shared/` | Switcher, region resolve, shell CSS, catalogue | 5 | 2026-07-17 | Live |
| `apps/regions/nz/` (portal) | RA + review portal for all 23 portal countries | — | active | Live — single point of failure |
| `apps/workbench/` | React 19 + Vite + strict TS, demo-only, localStorage provider | 24 | 2026-08-14 (dep bump) | Parked, not deployed |
| `convex/` | Task/review backend: 9 tables, 48 functions, strict TS, clean `tsc` | 25 | 2026-08-14 | Live, healthy |
| `scripts/` | 26 files post-split: seeds, catalogue, validator, R OSM pipeline | 26 | 2026-07-17 | Live core + orphans |
| `crates/pow-cli` | `pow` validate/stage/propose/diff; 4,300-line single file; 19 inline tests | 2 | 2026-07-07 | Live, thin |
| `schemas/` | 14 JSON schemas; 4 have zero consumers anywhere | 15 | 2026-07-17 | Live + aspirational tail |
| `tools/` | tiles-r2 worker (new), domain-redirect worker, guide-captures (~36 MB PNGs) | 13 | 2026-08-14 | Live |
| `api/` | FastAPI prototype, 806 lines | 3 | 2026-06-18 (Dependabot) | Dead |
| `frontend/`, `src/` | Meta-refresh redirect shims from 2026-01-15 ("short grace period") | 12 | 2026-01-15 | Expiring |
| `archive/` | Dead 2026-01 HTML mixed with cited provenance extracts | 45 | 2026-07-18 | Split needed |
| `data/` | 12 GB untracked cache serving the private pipeline (108 refs there, 1 here) | 3 | 2025-08-25 | Relocate or document |
| `research/`, `ideas/` | Empty husk after the July split; 11-line notes file | 0 / 1 | — | Delete |

Root manifests are load-bearing (`package.json` = Convex project, `tsconfig.json` scoped to `convex/`, `Cargo.toml` workspace pointer, `pyproject.toml`), except the dormant Git LFS filters in `.gitattributes` (configured, zero LFS files — a silent trap for the first `.parquet` commit).

## Duplication

- `apps/global/index.html` ≈ `region-map.js`: nineteen matching blocks of 6+ lines, the largest 529 lines. CSS is clean (the three stylesheets layer without overlap). The 100 country pages are genuinely thin and identical in shape — that part is exemplary.
- 123 `area_summary_*.csv` files (46.3 MB, 17% of the working tree) duplicate the JSON summaries the runtime loads. No runtime code reads any CSV.
- `scripts/clean_global_places.py`, `deduplicate_global_places.py`, `build_global_review_queue.py` are self-declared "transitional reference implementations" of their R twins.
- `frontend/config.public.js` duplicates `apps/global/config.public.js` (browser API keys, published by design — confirm referrer restrictions stand).
- 44 stub `review.html`/`verification.html` redirect pages (23 lines each) — cheap, low priority.

## Decision list

### Kill now (zero risk)

- `research/` (no tracked files; also drop its stale `.gitignore` line), `frontend/.Rhistory` (tracked, zero bytes), `apps/regions/za/js/` (empty dir).
- The three transitional Python duplicates in `scripts/`.
- The dormant LFS filters in `.gitattributes` (or adopt LFS deliberately).

### Kill after one decision each

- `api/` + the `api`/`fast-parquet` extras in `pyproject.toml` + AGENTS.md line 213. Decision: nothing calls it — confirm no planned revival.
- `frontend/` + `src/` shims (12 files). Decision: do seven-month-old external links to the pre-split URLs still matter?
- The 46.3 MB of area-summary CSVs. Decision: where analysts should get downloads (R2, releases, or keep in-tree).
- Four consumer-less schemas (`indicator`, `indicator-observation`, `visual-layer`, `source-dataset`). Decision: mark aspirational or remove.
- `scripts/` orphans: `build_osm_dated_places_products.R` (touched 2026-07-10, referenced nowhere — likely belongs in pow-research), `optimize_places_data.py` (2025-08), `update_counts.R`, `clean_nz_places.py`, `build_nz_review_queue.py`.

### Converge

- **Global map onto the shared runtime**: give `apps/global/` a `REGION_CONFIG`-shaped config and load `region-map.js` like the 100 country pages do. The DRIFT-REPORT methodology from the 2026-07 NZ/VU merge is the playbook. This is the largest maintainer-efficiency win and halves the cost of the whole performance lane.
- **The TS question (workbench vs portal)**: Convex mandates TS, so the real choice is between (a) wiring the workbench's `WorkbenchProvider` to Convex and making it the portal surface, and (b) parking the workbench formally and typing the NZ portal client against `convex/_generated/api`. Carrying both (a typed app with no backend and an untyped app with the backend) is the worst option.
- **Split `archive/`** into cited provenance extracts (the Stats NZ / geoBoundaries / OSM-VU source packages that `docs/data-storage-pipeline.md` depends on) and genuinely dead 2026-01 HTML; add an `archive/README.md` so nobody deletes live provenance.
- **De-NZ the shared runtime**: `nz-polygons` tileset and `nz-census*` layer ids are hardcoded for all 100 countries (documented hand-port residue); promote to config when convenient.

### Fix (docs and hygiene)

- **Domain sweep** — highest user-facing value, lowest effort: 13 files plus the three live Guide-button links point at `placesmap.org`.
- Doc drift: `docs/api/workflow-scripts.md` documents four scripts the split deleted; `docs/api/convex-functions.md` is missing 11 functions (including three public task functions); `schemas/README.md` instructs a private-repo path; `validate_area_summaries.sh` cites a deleted twin.
- CHANGELOG is four weeks behind the code; catch it up, then cut Jan–Jun into a dated archive file (note: AGENTS.md never actually wrote down the lean-changelog rule).
- Add minimal CI: `tsc --noEmit`, `cargo test`, the portal test, and `validate_area_summaries.sh` on changed products.
- Stale docs cluster: `architecture.md` and `runbook.md` (wrong domains, retired GCP tile stack), `deployment-strategy.md`, `api-specification.md` + `schema-integration.md` (2025-08), completed one-shot audits. `docs/documentation-health-check.md` exists to catch exactly this and has not been run since the domain move.
- `data/raw/` (12 GB) is private-pipeline input living in the public working tree; document or relocate.
- One-off Convex seed files (`trainingSeed.ts` 599 lines, `devSeed.ts`, `revisionSeed.ts`) — annotate as fixtures or retire once their batches are promoted.

## Runtime-efficiency lane (André's backlog, reframed)

All 13 backlog items in `docs/ui-review-feedback-backlog.md` remain open. Three of the seven map items are one popup redesign. The two performance items share one root cause: the `places` tileset is global and MapLibre fetches it continuously; there is no app-level bbox fetch to buffer. The fix is tile-layer work — cache headers on the `pow-tiles` R2 worker, zoom-range tuning — and lands once if the global fork is retired first, twice if not. This also connects to the MapTiler free-tier check (satellite imagery is the open question there, not vector tiles).

## Recommended `/code-review ultra` targets

The prior guess was convex/, the boundary/tile pipeline, and the review portal. The audit revises this: the boundary/tile pipeline moved to the private repo, so ultra cannot reach it from here.

1. **`convex/` + `apps/regions/nz/js/`** — the authenticated portal stack. Security-heaviest surface (Google OIDC, five roles, invite repair, export integrity hashes), ~5,900 backend lines plus ~6,700 untyped client lines, all six review-page backlog items land here, and 23 countries depend on the NZ host.
2. **The global-map convergence branch** — do the convergence first, then point ultra at that branch. Ultra then reviews a bounded diff of the riskiest UI change rather than sweeping 8,300 lines of parallel runtimes.
3. **`crates/pow-cli`** — the governance gate for all accepted data. One 4,300-line file, 19 inline tests, no CI running them; exactly the shape a deep review is for.
