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
3. **Link it.** Add the country to the Data maps hub
   (`apps/regions/index.html`) and, when appropriate, the README.
4. **Verify.** Serve the repo root and check: page loads with no
   console errors; census panel opens; each level and metric renders or
   reports pending honestly; popups show the year table; attribution
   names the source and licence. Test at 1280px and 375px.

## Rules

- Do not add country-conditional logic to the shared module. If a new
  country genuinely needs new behaviour, key it on a config field or on
  the data shape, so every country gets it for free.
- UI changes happen once, in `_shared/`. After any shared change,
  re-test one full-data country (NZ) and one pending country.
- The census metrics are shared across countries by design. A country
  without data for a metric shows the pending message; do not remove
  metrics per country.
- `apps/regions/_shared/DRIFT-REPORT.md` records how the 2026-07-04
  unification resolved the NZ/VU fork differences; consult it before
  attributing an odd behaviour to the migration.
