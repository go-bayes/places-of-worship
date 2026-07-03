# Drift report: nz/index.html vs vu/index.html at extraction

Recorded 2026-07 while extracting the shared runtime module
(`region-map.js`, `region-map.css`) from the two forked country pages, per
`docs/development/regional-map-consistency.md`. The full `diff` between the
forks was 194 lines. Every difference is listed here with its resolution:
**config** (declared per country in `REGION_CONFIG`), **union** (the richer
behaviour moves into the module, keyed on data), or **module** (one wording
kept for both). NZ (`apps/regions/nz/index.html`) is the extraction base;
Vanuatu (`apps/regions/vu/index.html`) was the hand-port that then gained
features.

## Differences resolved as config

| Where | NZ | VU | Config key |
|---|---|---|---|
| `<title>` / `document.title` | "Places of Worship \| NZ Research Map" | "…Vanuatu Research Map" | `title` |
| Onboarding heading | "NZ research map" | "Vanuatu research map" | `onboarding.title` |
| Onboarding intro `<p>` | census overlays copy | "geographies ready for…" copy | `onboarding.intro` |
| Onboarding bullets (3) | census-on / slider / census detail | density / pending / density popup | `onboarding.bullets` |
| Onboarding actions | Global map + "How to fix data" (GitHub) | Global map only | `onboarding.links` |
| Wordmark links | Global map + Verification | Global map only | `wordmarkLinks` |
| `CONFIG.center` / `initialZoom` | `[174.7762, -41.2865]` / `4.5` | `[167.9, -16.3]` / `6` | `center`, `initialZoom` |
| `ONBOARD_STORAGE_KEY` | `pow-nz-onboard-dismissed` | `pow-vu-onboard-dismissed` | derived: `` `pow-${countryCode.toLowerCase()}-onboard-dismissed` `` |
| `cityPresets` | 12 NZ cities | 8 VU centres | `cityPresets` |
| Nominatim `countrycodes` | `nz` | `vu` | `geocode.country` |
| MapTiler geocode `country` | `nz` | `vu` | `geocode.country` |
| Photon bias `lat`/`lon` | `-41.3` / `174.8` | `-16.3` / `167.9` | `geocode.biasLngLat` (`[lng, lat]`) |
| `CENSUS_LEVELS` | `ta` + `sa2` (Stats NZ paths, `TA2025_V1` etc.) | `adm1` + `adm2` (geoBoundaries paths, `area_code`) | `censusLevels` (verbatim, incl. `credit`) |
| `censusState.level` | `"ta"` | `"adm1"` | `defaultLevel` |
| `censusState.metric` | `religious_affiliation_percent` | `place_density_per_sq_km` | `defaultMetric` |
| `censusState.year` | `2023` | `2020` | `defaultYear` |
| Census source attribution (map credit line) | Stats NZ (CC BY 4.0) link | geoBoundaries link | `censusSourceAttribution` |
| rr3 footnote wording in the census popup | "under **Stats NZ rr3** rounding" | "under **census confidentiality** rounding" | `censusFlagNote` (full note text) |

## Differences resolved as union (module, data-keyed)

These are the behaviours VU gained after the hand-port. All key on the data
product, never on country, so they now run for every country and are inert
where the data is complete (verified: every NZ ta/sa2 row carries a finite
`population_total`, so no NZ code path changes).

1. **Boundaries-only census popup scaffold** (`openCensusPopup`). When no
   year's row for the clicked area has a finite `population_total`, the
   popup shows the area name, the OSM place count / land area / density
   attributes when present, and a "religion data pending" note instead of a
   table of dashes. VU version adopted verbatim.
2. **`fmtCount` guard in the census table**: `place_count` renders as "–"
   when not finite (NZ rendered the raw value; NZ counts are always finite,
   so output is identical). VU version adopted.
3. **Boundaries-only legend** (`updateCensusLegend`). VU's three-stage guard
   adopted: (a) hide only when census is off or the store/geojson is absent;
   (b) when *no* metric has a domain, show the "boundaries are ready to
   receive data" note plus available census years; (c) when *this* metric
   has no domain but others do, show a per-metric pending note. NZ's older
   guard (`!enabled || !domain` → hide) is subsumed: with full NZ data every
   metric has a domain, so NZ renders exactly as before.
4. **Time-slider guard** (`syncCensusTimeSlider`): VU adds `hasAnyData`
   (any metric domain present) beside the two-stop minimum, so a
   fully-pending level hides the slider. NZ has domains, slider unchanged.
5. **`place_density_per_sq_km` metric**: present and identical in *both*
   forks' `CENSUS_METRICS` (the 2026-06-13 density work landed in both
   pages and in the shared data products; the geodesic area computation
   lives in the data pipeline, not the page). Stays in the module's shared
   `CENSUS_METRICS`; availability keys on the summary rows.

## Comment-only drift (no behaviour)

- The `null - null` change-metric guard carries different comments (NZ:
  suppressed denominator must not read as zero change; VU: a fully-pending
  level would fake an all-zero domain). The module keeps the guard verbatim
  with a merged comment covering both readings.
- The census section header comment: NZ said "territorial-authority
  choropleths"; VU said "province and area-council choropleths" but then
  kept NZ's stale body text ("data/area_summary_ta.json, 67 TAs x 3 census
  years… TA2025_V1") — hand-port residue describing the wrong country. The
  module carries a generic comment describing the config contract.
- VU's legend comment named Vanuatu ("Vanuatu's religion metrics are
  pending"); generalised to "religion metrics can be pending while place
  density is live".

## Hand-port residue kept verbatim (deliberate)

- **`CENSUS` layer/source ids are `nz-census*` in both forks** — VU never
  renamed them. Kept verbatim in the module (`nz-census`,
  `nz-census-fill`, `nz-census-line`, `nz-census-hover`): they are internal
  ids invisible to users, and renaming would deviate from both live pages
  before the parity check.
- **`CONFIG.tiles.polygons` points at `tiles.placemap.org/nz-polygons` in
  both forks** (and `layerDefaults.polygons: "nz-polygons"`). VU requests
  the NZ parcel-polygon tileset today; the requests return nothing over
  Vanuatu. Kept as a module constant since the forks agree. Candidate for
  a config key when a second polygon tileset exists.
- **Shared sessionStorage keys** `pow-drag-hint-dismissed` and
  `pow-pin-tip` are identical in both forks (one dismissal covers both
  countries on the same origin). Kept shared.
- **Null element lookups** (`censusYear`, `terrain-toggle`, `corner-info*`,
  `onboard-toggle`) exist in both forks with no matching markup; the code
  guards on null. Kept verbatim, and the injected chrome deliberately does
  not add the missing elements.

## Judgement calls

1. **`defaultYear` added to `REGION_CONFIG`** (beyond the spec's surface).
   `censusState.year` is initialised before any data loads (NZ `2023`, VU
   `2020`) and there is no `#censusYear` element to re-derive it from; the
   value had to travel with the config. Both values equal the latest year
   in the country's summary product.
2. **`censusFlagNote` added to `REGION_CONFIG`.** The rr3 footnote names
   the statistical agency's rounding regime — country copy, not behaviour —
   so the full note text moved to config rather than forcing one wording on
   both pages.
3. **`onboarding.intro` and `onboarding.links` added** (spec listed only
   `title` and `bullets`): the `<p>` line differs per country and NZ's
   "How to fix data" GitHub link has no VU counterpart.
4. **`wordmarkLinks` entries carry `id` and `title`** so the injected
   anchors are byte-identical to the source pages (`wordmark-global`,
   `verification-link`); only `fixmap-link` is read by the JS, but the ids
   are kept for CSS/DOM parity.
5. **Chrome injection root**: pages provide `<div id="region-root"></div>`
   and the module sets its `innerHTML`. The wrapper is static and
   untransformed, so the `position: fixed` chrome and `#map { position:
   fixed; inset: 0 }` (maplibre-flat.css) lay out exactly as when the
   elements sat directly under `<body>`.
6. **No IIFE, no strict mode**: the module is a classic top-level script,
   like the inline script it replaces, so hoisting and global semantics are
   unchanged. `RC` is the only new top-level binding.
7. **`document.title = RC.title`** runs in the module even though each
   `next.html` also sets `<title>` statically (identical values); the
   static tag keeps the title correct before JS runs.

## Config surface actually used

`countryCode`, `title`, `center`, `initialZoom`, `censusLevels`,
`defaultLevel`, `defaultMetric`, `defaultYear`, `cityPresets`,
`geocode.country`, `geocode.biasLngLat`, `onboarding.{title,intro,bullets,links}`,
`wordmarkLinks`, `censusSourceAttribution`, `censusFlagNote`.

## Paths

The module loads from `../_shared/` but executes in the page's own
directory, so all relative fetches resolve as before: `data/…` (census
levels, from config), `../../../schemas/denomination-taxonomy.json`
(taxonomy, kept in the module — both pages sit at the same depth), and the
`../../global/config.public.js` + `../../global/config.js` key-loading
pattern stays in each `next.html` verbatim (including the 404-tolerant
optional `config.js`).
