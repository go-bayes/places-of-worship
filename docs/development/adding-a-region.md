# Adding a country research map

Since 2026-07-04 the country maps share one runtime:
`apps/regions/_shared/region-map.js` (all map + census logic) and
`apps/regions/_shared/region-map.css`. A country page is a thin loader
that declares `window.REGION_CONFIG` and loads the shared assets —
New Zealand is 87 lines, Vanuatu 84. A new country is a config plus
governed data products. Nothing else is forked.

The shared module keys every behaviour on config and data, never on
country identity: a country whose area summaries carry no values gets
the boundaries-pending legend, hidden slider, and pending popups
automatically; quality flags (for example rr3 suppression) wash out and
clamp colour domains wherever they appear in the data.

## Steps

1. **Governed data products first.** A country map consumes:
   - one boundary GeoJSON per census level (official source preferred,
     geoBoundaries otherwise), stored at `apps/regions/<cc>/data/`;
   - one `area_summary` JSON per level following the same contract as
     `apps/regions/nz/data/area_summary_ta.json`, built with recorded
     provenance and a tracked manifest per `docs/data-storage-pipeline.md`.
   A boundaries-only scaffold (summaries with areas but no metric
   values) is a legitimate first release; the page will say the data
   are pending, as Vanuatu's did.
2. **Write the page.** Copy `apps/regions/vu/index.html` to
   `apps/regions/<cc>/index.html` and replace the `REGION_CONFIG`
   values. The config surface (all of it) is:
   - `countryCode`, `title`, `center`, `initialZoom`
   - `censusLevels`: per level `label`, `boundaries`, `summary`,
     `codeProp`, `nameProp`, `credit` (paths resolve from the page's
     directory)
   - `defaultLevel`, `defaultMetric`, `defaultYear`
   - `cityPresets` (`label`, optional `shortLabel`/`aliases`, `coords`,
     `zoom`)
   - `geocode` (`country`, `biasLngLat`)
   - `onboarding` (`title`, `intro`, `bullets`, `links`)
   - `wordmarkLinks` (`id`, `label`, `href`, `title`)
   - `censusSourceAttribution` (HTML string; licence attribution is
     required, not decorative)
   - `censusFlagNote` (footnote naming the agency's suppression rule,
     when the country has one)
   - `metricLabels` (optional; per-metric `{ label, note }` override) and
     `metricsAvailable` (optional; allow-list of metric ids) — see
     "Metric labels and availability" below. Omit both and a country
     gets the NZ/VU defaults unchanged.
   - `timeline` (optional): `[{year, level}, ...]` for countries whose
     eras live on different boundary levels (the US spans 1850-2020
     across six county vintages). The year slider then covers every
     era and switches geography level automatically as the year
     crosses an era boundary; without it the slider spans the active
     level's years.
   - `overviewDotOpacity` (optional, default 0.75): opacity of the
     low-zoom place-dot overview tier. A country whose OSM dot density
     would bury the census choropleth at national zoom (the US) sets a
     low value; the detailed places tier still ramps in from zoom 6.
   - `popupDenominatorNote` (optional): the popup footnote explaining
     the percentage denominator. Defaults to the census stated-response
     wording; a country whose construct uses a different denominator
     (the US uses resident population) must say so here. When the place
     metrics are hidden via `metricsAvailable`, the popup also drops the
     Places/Per-10k columns and the OSM places credit automatically.
3. **Link it.** Add the country to the Data maps hub
   (`apps/regions/index.html`) and, when appropriate, the README.
4. **Verify.** Serve the repo root and check: page loads with no
   console errors; census panel opens; each level and metric renders or
   reports pending honestly; popups show the year table; attribution
   names the source and licence. Test at 1280px and 375px.

## Metric labels and availability

The five census metrics (`religious_affiliation_percent`,
`no_religion_percent`, `places_per_10000_residents`,
`place_density_per_sq_km`, `religious_change`) are built into
`apps/regions/_shared/region-map.js` as `CENSUS_METRICS_BASE`, with
labels and notes written for a census self-identification construct
(NZ, VU). A country whose data measures something else — for example
the US Religion Census, which counts congregations and adherents
reported by religious bodies, not a census question — must not present
that data under the census wording. Two config fields, both optional,
cover this without touching the shared module's metric logic:

- `metricLabels`: an object keyed by metric id, each value a partial
  `{ label, note }` that overrides the base definition's text. The
  metric's `kind` (colour scale) and `format` (value formatting)
  never change, only the words. Use this to rename a metric to match
  the country's construct (`"Adherents per 100 population"` instead of
  `"Religious affiliation %"`).
- `metricsAvailable`: an allow-list of metric ids. When present, only
  listed metrics populate the dropdown, the legend, and the popup
  table's columns. Use this to hide a metric that does not apply to the
  country's construct (a "no religion" share makes no sense where
  absence of reported adherence is not a survey response) or that has
  no data source yet (place-density metrics before an OSM extraction
  pass exists for that country) — the alternative, leaving it selectable
  and permanently "no data", is honest but noisier than omitting it.

Both fields default to absent, which reproduces the original NZ/VU
metric set and wording exactly — implemented as `buildCensusMetrics()`
merging `RC.metricLabels` onto `CENSUS_METRICS_BASE` and filtering by
`RC.metricsAvailable` when either is set. The popup table also drops the
"no religion" column entirely when `no_religion_percent` is not in
`CENSUS_METRICS`, rather than showing a column of dashes. The US config
in `apps/regions/us/index.html` is the reference example.

A country-specific quality flag also needs a matching entry in the
shared module's `rowFlagged()` if it should trigger the same wash-colour
and footnote treatment NZ's `rr3_small_denominator` gets (for example,
`county_boundary_change_crosswalked`) — add the substring to the
existing `||` chain rather than branching on country identity.

## Deploy parity

A local static server serves every file; GitHub Pages does not
necessarily. The `.nojekyll` file at the repo root is load-bearing: it
stops Pages' default Jekyll pass, which would silently exclude
underscore-prefixed paths such as `apps/regions/_shared/` (this broke
every country map on the live site once, 2026-07-06, while local
testing stayed green). After changing deployment-affecting structure,
verify the LIVE asset URLs with curl, not only a local server, and
treat browser-cached modules as capable of masking a live 404.

## Rules

- Do not add country-conditional logic to the shared module. If a new
  country genuinely needs new behaviour, key it on a config field or on
  the data shape, so every country gets it for free.
- UI changes happen once, in `_shared/`. After any shared change,
  re-test one full-data country (NZ) and one pending country.
- The census metrics are shared across countries by design. A country
  without data for a metric shows the pending message, or omits the
  metric via `metricsAvailable` when it does not apply to the country's
  construct at all; do not remove metrics per country by editing the
  shared module.
- `apps/regions/_shared/DRIFT-REPORT.md` records how the 2026-07-04
  unification resolved the NZ/VU fork differences; consult it before
  attributing an odd behaviour to the migration.
