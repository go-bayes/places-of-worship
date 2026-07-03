# Keeping the regional maps consistent across countries

Status: **completed 2026-07-04**. The migration below was executed as
planned: `apps/regions/_shared/region-map.js` + `region-map.css` now carry
all map and census logic, and the NZ and VU pages are thin
`REGION_CONFIG` loaders. Parity was verified before each swap (42-element
computed-style sweep identical on NZ; hash-identical sweep on VU;
interaction checks on panel, metric, level, slider, legend; zero console
errors). Fork differences and their resolutions are recorded in
`apps/regions/_shared/DRIFT-REPORT.md`. For adding countries, see
`docs/development/adding-a-region.md`. The historical plan follows.

## The problem

Each country map is a full fork of the global MapLibre shell:

- `apps/regions/nz/index.html` — New Zealand (~3,300 lines, inline JS + CSS)
- `apps/regions/vu/index.html` — Vanuatu (~3,300 lines, inline JS + CSS)

They share `apps/shared/map-shell.css` (tokens, the dark pill, the popup idiom)
but **not** the JavaScript or the page structure. Every UI change is therefore
O(N) hand-edits across countries, and the forks drift between edits. This has
already bitten twice: the "census front-and-centre" rework was applied to NZ
(`3036a15`) and then hand-ported to Vanuatu (`5444800`). The shared stylesheet
keeps the chrome aligned, but the logic diverges with every change.

## The key realisation

Most of what *looks* country-specific is already **data-driven**, not
hardcoded, so the shared surface is small:

- The **boundaries-only** behaviour built for Vanuatu (pending legend, hidden
  slider, pending area popups) keys on the area-summary having no values. It
  works for any country whose data is pending — nothing about it says
  "Vanuatu".
- New Zealand's **rr3 wash-out and percentile clamp** key on `quality_flag`
  strings and value presence *in the area-summary product*, not on "this is
  NZ".

What remains genuinely country-specific is declarative: centre and zoom, the
census level definitions, city presets, geocoding bias, copy, and cross-links.

## The approach: one runtime module, thin per-country pages

```
apps/regions/
  _shared/
    region-map.js     all map + census logic; reads window.REGION_CONFIG;
                      injects the chrome markup into a root element
    region-map.css    census panel / key CSS beyond map-shell.css
  nz/
    index.html        ~50 lines: REGION_CONFIG (NZ) + the shared script tags
    config.js         local keys (gitignored, as today)
    data/             NZ census products
  vu/
    index.html        ~50 lines: REGION_CONFIG (VU)
    data/             VU boundary scaffold
```

No build step: the shared JS loads at runtime, which suits GitHub Pages static
hosting. A UI change happens once in `_shared/`. A new country is a config plus
a governed data product, nothing more.

### `REGION_CONFIG` — the whole country-specific surface

```js
window.REGION_CONFIG = {
  countryCode: "NZ",
  title: "Places of Worship | NZ Research Map",
  center: [174.0, -41.0],
  initialZoom: 5.2,
  censusLevels: {            // today's CENSUS_LEVELS, verbatim
    ta:  { label, boundaries, summary, codeProp, nameProp, credit },
    sa2: { ... }
  },
  defaultLevel: "ta",
  defaultMetric: "religious_affiliation_percent",
  cityPresets: [ ... ],
  geocode: { country: "nz", biasLngLat: [174.8, -41.3] },
  onboarding: { title, bullets: [ ... ] },
  wordmarkLinks: [ { label: "Global map", href: "../../global/" },
                   { label: "Verification", href: "verification.html" } ],
  censusSourceAttribution: '© <a ...>Stats NZ</a> (CC BY 4.0)'
};
```

Vanuatu's config is the same shape with its own values and a geoBoundaries
attribution; no `verification` link. The census **metrics** (`CENSUS_METRICS`)
are shared in the module — they are the same five everywhere — and could be
made config-overridable later if a country needs a different set.

### What does NOT move into config

The behaviour that keys on data stays in the shared module and runs the same
everywhere:

- boundaries-only legend / hidden slider / pending popups (keys on absent
  values)
- rr3 wash-out and percentile-clamped colour domains (keys on `quality_flag`)
- the `null - null` change-metric guard

This is why the config surface is small: the module already behaves correctly
for both a full-data country and a pending one, from the data alone.

## Migration — staged, using the verify-before-swap method that worked

The Leaflet→MapLibre rebuild proved this sequence (build alongside, verify
parity, swap). Reuse it:

1. **Extract** NZ's inline `<script>` into `apps/regions/_shared/region-map.js`,
   replacing NZ constants with `REGION_CONFIG` reads, and the census `<style>`
   into `region-map.css`. Have the module inject the chrome markup so the
   per-country HTML carries no structure to drift.
2. **Stand NZ up as a thin loader alongside** the live page (e.g.
   `apps/regions/nz/next.html`) using the shared module + NZ config.
3. **Verify parity** against the live page with the computed-style and
   interaction diffs used throughout this project (47-element style sweep;
   panel toggle, metric/level selects, slider, popups).
4. **Swap** `nz/index.html` to the thin loader once green.
5. **Convert Vanuatu** to a thin loader with its config (drops ~3,200 lines to
   ~50 + config).
6. **Document** `docs/development/adding-a-region.md`: write a config, provide a
   governed area-summary and boundaries, link it from the global map.

The global map (`apps/global/`) can join the module later or stay separate — it
carries globe / PMTiles specifics that the country maps do not. Treat it as a
follow-up, not a blocker.

## Tradeoffs

- **For:** one source of truth; UI changes land once; a new country is
  config + data; the drift fought today ends.
- **Against:** a real refactor with risk to the live NZ map during the swap —
  mitigated by the alongside-verify-swap staging. All countries then share one
  JS file, so a bug reaches all of them; that is the cost of consistency, and
  the parity check on swap is the guard.

## Alternatives considered

- **Build-time templating** (generate each `index.html` from a template): adds
  a build step to a currently-static repo and more machinery; rejected unless
  pre-rendered pages are wanted later.
- **Parity checker only** (keep the forks, detect drift with a script): does
  not prevent drift and still costs O(N) hand-edits per change; rejected.

## Estimate

Roughly half a day for the extraction plus NZ parity verification; Vanuatu
conversion is quick afterwards. The riskiest step (the NZ swap) is the one the
project has already done safely once.
