# Layer families: area domains, collections, and submaps — design

Status: DESIGN RULED IN PART (JB, 2026-08-29). Recorded from the planning
sitting of 2026-08-29; the four rulings below are in force, the remaining
decisions are reserved. No build authorised by this note; each step in the
build sequence needs its own brief.

## Context

JB wants the global map to carry several layer kinds: PoW points (default);
country and subnational religion data (exists); economic/political/
demographic/social variables on the same area units (vocabulary deliberately
loose); and specialist within-country "submaps" of PoW and religious history
(NZ Anglican parish series, consent-gated; Bob Woodberry's Vanuatu mission
data). Data is built in `pow-research` and shipped as static products; Convex
is the task/evidence layer; Cloudflare = R2 tiles + workers. Question: what is
general, what is specialist, and what to fix now so later layers are config,
not runtime rewrites.

Bob's email (28 Aug, "Catholic & Protestant data for Vanuatu"): four xlsx —
Protestant station locations from atlases; Catholic mission stations (Jan
2026); Catholic missionaries; Protestant missionaries. Georeferenced stations
(dated) + person-level missionary records (dated postings). Not polygons.

## The substrate (what exists)

- **One runtime, config per page.** `apps/regions/_shared/region-map.js`
  (~5.5k lines) serves the global map and ~102 country pages; each page is a
  `REGION_CONFIG`. That config *is* the per-country layer manifest;
  `apps/shared/data/region-catalog.json` is the generated cross-country one.
- **Area-domain registry, dormant.** `normaliseOverlayDomains` (~L2992),
  `setOverlayDomain` (~L5050); domain select renders when ≥2 domains. Design
  ratified in `docs/development/multi-domain-overlay-design.md`; phase 1
  shipped 2026-07-17 (`overlay-registry-phase1-2026-07-17.md`); no page
  declares `overlays:`; `metricsFromProduct` was deferred and never built.
- **Products carry vocabulary the runtime ignores.** `area-summary.v2`
  requires `indicators[]`/`visual_layers[]`; runtime uses hardcoded
  `CENSUS_METRICS_BASE` (~L3090). And v2 rows are closed
  (`additionalProperties: false`, religion columns required, L221-252) —
  only `*_percent` columns can be added. A non-religion product cannot
  validate against v2.
- **Global vocabularies that do exist and must stay:**
  `schemas/denomination-taxonomy.json` (`taxonomy_code` hook in composition
  and in Pulotu) and `religionColors`. So: no global *indicator* vocabulary;
  the denomination taxonomy is the one optional cross-layer join key.
- **Non-census layer precedents.** Pulotu cultures
  (`pulotu-cultures-layer.md`): a separate *data source* (`#censusSource`)
  that swaps the whole temporal frame to three ordinal stages, hides the
  census fill and level select, own credit, never merged — but hardcoded
  (`pulotuState`, `RC.pulotuCultures`, L4172-4545). Dated places
  (`temporal-place-layer.md`): keyed to the *census* year, destined to be
  replaced by the `pow` per-year site-state export — it is tier 2 of the
  PoW family, not a collection.
- **Anglican prototype** (pow-research `research/countries/nz/anglican-poc/
  map-proto/`): standalone Access-gated page, contract
  `pow.unit-time-series.v1`; both 2026-07-19 design consultants agreed:
  stay standalone, design the contract so an engine mode can adopt it once
  consent clears and *a second dataset proves the abstraction*. Its grammar
  (diocese colour, sqrt size, unplaced tray, sparklines) is not in the
  engine.
- **Portal temporal redesign** (branch `design/portal-temporal-redesign`,
  unmerged): `site_lifespan_v1` segments with start/end mode + basis;
  derived census-year states; bulk lane `vu-woodbury-historical-sites-001`;
  PR-B0 (`WIDE_EVIDENCE_FIELDS` shared constant) blocking; decisions
  D1–D12 pending JB. `convex/batchImport.ts` today: `first_date`/`last_date`
  only, `IMPORT_MAX_ROWS = 200`, rows require name/country/locator.
- **Shareable state lives in the hash** (`#map=`, `#f=`, `#d=metric:year`,
  L2603-2620, L3222-3235); query params are tile overrides only. Under
  Pulotu `d=` is dropped and nothing carries source/stage — a Pulotu view is
  not shareable today.
- **Governance:** product = pow-research build script + `manifests/*.json`
  + licence line; measurement-diversity principle (kinds displayed side by
  side, never blended); build-then-ask licence posture.

## Architecture: three families, each with one contract

### Family 0 — PoW (the default, always)

Tiles (`pow-places`, `pow-overview`) + dated places + the whole Convex →
`pow` → master lane. Unchanged. Dated places stays here (census-year keyed).

### Family 1 — Area domains (choropleths on area units)

Religion, language, population, economy, politics … share: a
`boundary_set_id` + one product per domain × level + an indicator registry
*inside the product*.

- **Vocabulary is per product.** Each product declares `indicators[]` (id,
  label, unit, denominator, method, quality notes, `kind` seq|div|cat,
  `decimals`, `codes` for categorical). The runtime reads them. This is the
  answer to "no global vocabulary": the only global fields are `domain`,
  `unit`, `kind`, and the area key `boundary_set_id:area_code`.
  Cross-country aggregation is refused by default (the minority-share trap
  already shows why).
- **Schema:** `area-summary.v3` (or sibling `area-indicators.v1`): rows
  require identity + `year` + `source_dataset_ids` + `quality_flag`; every
  value column must be declared in `indicators[]`; `domain` required. v2
  stays for religion untouched. **JB decision.**
- **Same units by construction:** a domain product must reference an
  existing `boundary_set_id`; builder fails on frame mismatch (vintage rule
  already enforced).
- **Runtime:** `metricsFromProduct` in `buildCensusMetrics` (L3183) reading
  `summary.indicators` in `loadCensusData` (L3544-3580), `format` from
  `unit`, hardcoded table as fallback; per-domain popup table (design §7).
- **Pilot:** VU language domain from Guy's tables (already the ratified
  phase-2 pilot). Geography (adm1 / area council / island) and the VBoS
  island-table permission are open.

### Family 2 — Collections (dated units with their own time model)

Pulotu cultures, Anglican parishes, Woodberry stations/missionaries, future
archaeology. Share: units with nullable location, dated presence, optional
metric series, optional tenures (people attached to units), per-unit
provenance, collection passport (credit, licence, construct, time model).

- **Contract `schemas/collection.v1.schema.json`:** GeoJSON
  FeatureCollection + required `meta` {`collection_id`, `label`,
  `country_codes`, `unit_kind`, `construct` (one-line regime statement),
  `credit`, `source_datasets[]` (reuse v2 `SourceDataset`),
  `temporal_model: {kind: interval|series|stages, axis:
  calendar_year|ordinal, stops[], per_metric_stops?}`, `metrics[]` (id,
  label, unit, kind seq|div|cat, `codes`, colours outside census
  palettes)}. Feature properties: `unit_id`, `unit_kind`, `name`,
  `start_year`/`end_year` + `start_basis`/`end_basis` (lifespan
  vocabulary), `series{}`, `tenures[]` (`person_ref`, years; names only if
  ruled), `location_basis`/`location_confidence`/`representative_area`,
  `sources[]`, optional `taxonomy_code`, optional `pow_site_ref`.
  `pow.unit-time-series.v1` becomes a strict profile so `anglican.html`
  migrates by rename.
- **One contract, two renderers.** The engine renders `interval` (calendar
  slider, dated-places predicate against the collection's own stops) and
  `stages` (Pulotu time strip). `series` with the Anglican grammar stays
  standalone until consent clears and JB rules on an engine mode.
- **Each collection is its own data source** (Pulotu ruling generalised):
  selecting it swaps the timeline to its own stops; PoW dots remain
  optional; never merged with census or with each other; own regime line
  and credit in the passport (replace hardcoded Pulotu credit L4684-4692).
- **Identity link:** `pow_site_ref` on a unit; when a station becomes an
  accepted PoW site the runtime dedupes (hide / badge / both — JB rule).
- **People are attributes of units.** Missionaries → `tenures[]` on
  stations (mirrors Anglican clergy tenures). Historical deceased
  missionaries are a different privacy posture from living clergy; names on
  screen is a per-collection ruling.
- **Pilot:** Woodberry Vanuatu missions — the "second dataset" the Anglican
  synthesis required before generalising.

### What a "submap" is

Not a new surface for engine-renderable collections: a country page whose
`REGION_CONFIG` declares `collections{}`/`overlays{}` plus a **preset** (a
named hash state with title and credit card), e.g.
`/regions/vu/#p=woodberry-missions`, listed on the country overview page
and in the region catalog. Consent-gated or grammar-specific data
(Anglican) stays a standalone page reading the same contract.

### What is general to every map

1. **PoW input/review** — one pipeline. Collections that assert PoW facts
   (mission stations are almost always worship sites) enter it via the
   bulk lane (`site_lifespan_v1` after PR-B; today `batchImport.ts`), with
   credit to the source, and the collection stays a display layer. Rule:
   **Convex holds claims about places of worship; everything else is a
   governed product.** The collection builder emits the bulk-import CSV
   from day one so the PoW lane is ready when ruled (avoids double entry).
2. **Credit and licence** — `meta.credit` + data-manifest.v2 per product,
   rendered in passport and popup.
3. **Time** — one visible time control, rebuilt from the active source's
   own model.
4. **URL hash state** — `s=<collection>` `t=<stop>` `m=<metric>`
   `dom=<domain>` `p=<preset>` beside `d=metric:year`; handoff carries them
   (`handoffCarrySegment` L5271).
5. **Manifest** — extend `REGION_CONFIG` (`overlays`, `collections`,
   `presets`; retire `pulotuCultures` into `collections.pulotu` behind a
   shim); `build_region_catalog.py` aggregates. No third file.

## Build sequence (each a PR; no behaviour change for non-opted-in pages)

Pilot 1 — Woodberry collection (proves Family 2):
1. pow-research: quarantine the four xlsx under `data/raw/vu_woodberry/`
   with `sources.csv` (SHA-256, permission text) per
   `docs/playbooks/guy-vu-spreadsheets.md`; profile in
   `research/countries/vu/woodberry-data-profile.md` (date columns,
   georeference source, atlas licences, station↔missionary join).
2. places-of-worship: `schemas/collection.v1.schema.json`; fixtures from
   the Anglican feed and Bob's data; `schemas/README.md`.
3. pow-research: `pipeline/build_vu_woodberry_missions.R` (model:
   `build_pulotu_cultures.R`) → `apps/regions/vu/data/collections/
   woodberry_missions.geojson` + `manifests/vu-woodberry-missions-*.json`
   + bulk-import CSV.
4. region-map.js: generalise `pulotuState`/`PULOTU_*` (L4172-4545) into
   `collectionState` + `RC.collections`; source select from config;
   timeline branches on `temporal_model.kind`; legend/passport from
   `meta`; interval filter reuses the dated-places predicate (L4127-4135).
   Gate: Pulotu byte-identical/screenshot-identical on all nine opt-in
   pages.
5. `apps/regions/vu/index.html`: `collections: {pulotu, woodberry_missions}`
   + preset; overview page credit.
6. Hash state `s/t/m/p`; addendum to `multi-domain-overlay-design.md`.
7. After PR-B0/PR-B and D1–D12: stations into the bulk lane with Bob as
   ra+reviewer; `pow_site_ref` back-filled; dedupe rule live.

Pilot 2 — VU language domain (proves Family 1 beyond religion):
8. `area-summary.v3` schema (or sibling) — JB rules first.
9. pow-research: `pipeline/build_vu_language_area_summary.R` → 
   `area_summary_<level>_language.json` + manifest crediting Guy.
10. Runtime `metricsFromProduct` + per-domain popup; gate: NZ/BR/VU
    byte-identical for religion.
11. VU `overlays: {religion: legacy, language: {...}}`; domain select
    appears.

Then: Anglican feed → collection.v1 (rename, standalone stays);
socio-economic domains per country as route probes deliver products.

## Rulings (JB, 2026-08-29)

- Woodberry collection pilot first; VU language domain second; socio-
  economic domains after both.
- Missionaries render as tenures on stations **with names**. Bob's
  records are historical references to deceased persons, not subject to
  the living-clergy quarantine applied in the Anglican prototype; names
  appear in the station popup's tenure disclosure with their source, and
  Bob reviews the material before it ships. (Supersedes the sitting's first
  draft, which had applied the Anglican clergy rule by analogy.)
- Stations: display collection now; **and immediately** seed Bob's sites
  as tasks in Guy's Vanuatu task list (the `adminUpsertTasksFromStaticMap`
  route used for the Port Vila 2010 survey batch), with Street View links
  where Vanuatu coverage allows; bulk lifespan import follows PR-B0/PR-B.
  The collection builder emits the task-seed and bulk-import CSVs from
  day one.
- Non-religion area domains use `area-summary.v3`; religion stays on v2.
- Submap = preset hash state on the country page (no dedicated pages for
  engine-renderable collections).
- Anglican: **permanent standalone**, kept live. Noel Derbyshire's advisor
  (Peter Lineham) will confirm the sources and provide permission; the
  submap credits Noel Derbyshire and Peter Lineham. Approximate parish
  locations are already public in Anglican records; religionmap.org is a
  research tool consistent with Noel's interest in sharing his work.
- Contributor portal declutter (same sitting, supersedes PR-A order in
  `docs/portal-temporal-redesign-plan.md` §1 where they conflict): sign-in
  only on entry → chooser (Assigned tasks | Add places) → separate portal
  modes; the add-place map offers address search, lat/long entry, and pin
  drop, with satellite imagery (MapTiler, paid plan authorised) so
  contributors can guide pins onto structures. Build lane opened
  2026-08-29 (branch `codex/portal-signin-chooser`).
- Collaborator communication: Claude may write to Guy and Bob from JB's
  email, identifying itself as Claude, sending clear HTML documents or
  links that describe the plans and their work and seek their feedback.

## Decisions still reserved for JB

1. Woodberry temporal treatment: calendar interval on own stops
   (recommended) vs Pulotu-style stages; Bob's credit line wording;
   licence of the atlases he georeferenced.
2. Who assigns `founding_stated` vs `first_seen_only` basis for stations;
   dedupe behaviour when a unit gains `pow_site_ref` (hide / badge / both).
3. Public label of the source control ("Data source" vs "Collection").
4. VU language geography; VBoS island-table permission — asked of Guy by
   email 2026-08-29.

## Verification

- Products validate against their schema (`scripts/validate_area_summaries.sh`
  extended to `collection.v1`); manifests validate.
- Byte-identical religion products and screenshot-identical NZ/BR/VU and
  the nine Pulotu pages before/after each runtime step.
- VU page: Woodberry source selectable, own timeline, credit visible,
  census artefacts untouched; preset hash opens the state; handoff to the
  global map carries it.
