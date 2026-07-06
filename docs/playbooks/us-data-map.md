# Playbook: United States county data map

Status: PHASE 1 DONE (2010+2020 county map live); PHASE 2 (historical
backfill, below) authorised by JB 2026-07-06 — deepest available waves.
Commits: see CHANGELOG 2026-07-06.
Task: first country extension beyond NZ/VU. Effort: one verification
sitting + one build sitting. Chosen 2026-07-04 (JB) over Denmark/Norway
(state-church membership only) and Germany (two waves, heavier
harmonisation) for its wave depth and low extraction cost.

## The data

The United States has no census religion question. The usable series is
the U.S. Religion Census (RCMS 2010/2020) and its predecessors, the
Churches and Church Membership studies (1952, 1971, 1980, 1990, 2000),
all archived as county-level files at ARDA (thearda.com) and
usreligioncensus.org. Construct: **congregations and adherents reported
by religious bodies** — institutional presence, NOT census
self-identified affiliation. Files include adherence rates per
population. Deep past: the Census of Religious Bodies (1906–1936,
federal) has county tables at ARDA too — note on the card, do not build
yet.

**Everything above is from model memory and MUST be verified in step 1
before any build: exact file URLs, waves actually offered at county
level, licence/terms of redistribution for derived aggregates, and
whether registration is required.** ARDA terms generally permit research
use with citation; the build must record the exact statement.

## Construct honesty (binding)

- Metric labels must not say "Religious affiliation %". This requires
  the anticipated config extension: `REGION_CONFIG.metricLabels`
  (per-metric label + description overrides) in
  `apps/regions/_shared/region-map.js`, defaulting to current labels so
  NZ/VU are unchanged. US labels: "Adherents per 100 population" (or
  "% adherents"), "No reported adherence %" only if defensible — likely
  better to omit the no-religion metric for the US (absence of reported
  adherents is not "no religion"). The module already tolerates a
  metric with no data (pending message); an explicit
  `metricsAvailable` config allow-list is cleaner — implement whichever
  is smaller, document in adding-a-region.md.
- `population_total_basis` for US rows: "resident population
  (denominator of published adherence rates)", not the NZ stated-response
  wording.

## Build steps

1. **Verify sources** (web): ARDA county files per wave; download the
   2020 and 2010 RCMS county files first; record URLs, retrieval dates,
   licence text, SHA-256. Park files at `data/raw/us_rcms/`
   (git-ignored) with a `sources.csv` like the VU pattern.
2. **Boundaries**: Census Bureau cartographic boundary counties
   (1:5m, public domain), vintage matching 2020; join key = 5-digit
   county FIPS. Simplify to keep the GeoJSON under ~10 MB
   (the NZ SA2 file is precedent for acceptable size; check it).
   County changes across waves (e.g. CT planning regions 2022, Dakota
   renames): map on 2020 counties; earlier waves join by FIPS with a
   small documented crosswalk for the handful of changes.
3. **Scaffold**: follow `docs/development/adding-a-region.md` — start
   provinces-equivalent at ONE level (county) and add a state level
   only if county performance demands a coarser default. 3,100+
   polygons × 7 years is the stress case: build
   `area_summary_county.json` with 2010+2020 first; add earlier waves
   in a second pass once rendering is verified.
4. **Products**: extraction script (R, `scripts/build_us_area_summary.R`)
   from the raw files to the `area_summary` contract; total
   cross-checks (county sums vs published state/national totals);
   manifest in `docs/manifests/`.
5. **Page**: `apps/regions/us/index.html` REGION_CONFIG (center
   [-98.6, 39.8], zoom ~4; city presets: NYC, LA, Chicago, Houston,
   Atlanta, Seattle, Denver, Miami, DC, Boston; geocode country "us";
   attribution: "Religion data © U.S. Religion Census / ARDA" +
   census.gov boundaries note). `defaultYear` 2020. Link from the Data
   maps hub and README.
6. **Verify in browser** at 1280/375px: choropleth renders at
   acceptable frame rate with 3,100 counties (if not, simplify geometry
   further or add the state level as default), popups show the wave
   table, slider walks the waves, pending behaviour correct for any
   metric omitted. Changelog, commit, push.
7. **Card**: write `research/countries/us/README.md` from
   TEMPLATE.md documenting all of the above including the 1906–1936
   deep-past route and the PRRI/Pew survey alternatives (different
   constructs, noted not built).

## Acceptance checks

- Every US row's construct labels say adherents/congregations, never
  affiliation; NZ and VU pages byte-identical in behaviour (re-run the
  style/interaction spot-check after the shared-module change).
- Manifest + sources.csv complete enough that a stranger can rebuild
  from URLs alone.

## Budget guidance

Suited to a single capable session (Sonnet): the sources are flat
files; the only design work (metric labels) is specified above. Est.
comparable to the VU build, minus the PDF extraction.

## Phase 2 — historical backfill (deepest available)

Goal: extend `area_summary_county.json` beyond 2010/2020 with every
earlier wave that offers county-level data and a defensible county
population denominator: the Churches and Church Membership studies
(2000, 1990, 1980, 1971, 1952) and the federal Census of Religious
Bodies (1936, 1926, 1916, 1906) at ARDA. Verify each wave's actual
existence, granularity, and file format before building — the wave
list above is from model memory.

Decisions already made (do not reopen):

1. **Inclusion rule**: a wave enters the map only if the source file
   itself carries (a) county identifiers joinable to 2020 FIPS for the
   bulk of counties and (b) total adherents/members AND a county
   population figure from the same study. No external population
   splicing in this phase; a wave failing (b) is documented on the
   country card as present-but-not-mapped.
2. **Construct drift is labelled, not hidden.** Participating bodies
   and definitions differ per wave (1906–1936 count "members" as each
   body defined them; 1952/1971 exclude most Black denominations —
   a known, documented gap; RCMS waves broadened coverage). Every
   pre-2010 row carries a `wave_coverage_differs` quality-flag
   substring plus a per-wave note in the indicator quality_notes and
   the country card. The metric label stays "Adherents per 100
   population"; the legend note must say coverage varies by wave.
   Do NOT add `wave_coverage_differs` to the module's `rowFlagged()`
   wash-out list — flags here inform, they do not suppress a century of
   data; the crosswalk flag behaviour stays as is.
3. **Boundaries**: everything joins onto the 2020 county layer by
   FIPS, extending the existing crosswalk file for historical county
   changes (created/abolished/renamed counties, Virginia independent
   cities). Counties in a historical wave with no defensible 2020
   match are left unmapped and counted in the manifest (the Torres
   rule). No period-boundary reconstruction in this phase — record it
   on the card as future work.
4. **Rates can exceed 100 and vary wildly in old waves** — keep the
   percentile-clamped domain; do not special-case.
5. **Slider ticks**: up to ~11 years must remain legible at 375px; if
   ticks crowd, thin the labels (CSS in region-map.css, version bump
   `?v=`) rather than dropping waves.
6. **Per-wave validation**: county sums vs any published state or
   national totals for that wave (record which check was possible);
   join coverage counted per wave in the manifest.

## Notes from the 2026-07-06 build

- The model-memory source claims in "The data" section above were
  accurate in outline and verified by direct web lookup and `curl`
  before downloading anything: ARDA's county-file Downloads tab links
  to OSF-hosted files (no account/registration), and Census Bureau
  boundaries are public domain. See `research/countries/us/README.md`
  for the full verification record with exact URLs.
- The 2010 and 2020 RCMS Excel files have different column layouts (2010
  has FIPS/name/state at the end of the sheet with different column
  names than 2020's start-of-sheet layout) — not documented anywhere in
  ARDA's metadata; discovered by inspecting both files directly.
- Ten 2010 county FIPS codes needed a documented crosswalk to the 2020
  boundary set (Alaska census-area history, one Montana dissolution, two
  Virginia city mergers, one South Dakota rename); several of these
  changes predate 2010, meaning the RCMS 2010 file itself carries a few
  legacy FIPS codes rather than true 2010-vintage ones.
- Browser tooling gotcha for future sessions: the `Claude_Preview`
  in-browser eval/console tools in this environment exhibited a
  reproducible stale-script problem — repeated navigations to the same
  path (even with cache-busting query strings, even across stopped and
  restarted preview servers) sometimes kept executing an old, cached
  copy of a shared JS module, while `curl` against the same URL always
  returned the current file. `Function.prototype.toString()` on a
  module-level function was the most reliable signal of staleness;
  behavioural output (calling the function and reading its return
  value) was not sufficient by itself, since it sometimes reflected the
  stale closure too. When shared-module JS changes do not appear to take
  effect in the preview browser despite correct source and a confirmed
  fresh `curl` response, do not trust the browser tool's evaluation —
  verify the logic in an isolated Node `vm` sandbox instead (extract the
  relevant function block, run it in `vm.createContext` with a mocked
  `RC`/`document`, and check the wrapped return value). That method gave
  an unambiguous, reproducible confirmation here after the browser tool
  did not.
