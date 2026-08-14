# Drift report: apps/global/index.html vs region-map.js at convergence

Recorded 2026-08-14 on branch `c1-global-convergence`, adjudicating the 146
drift entries from the four domain analysts (core, places, chrome,
census-residual) against the current files: `apps/global/index.html`
(2,952 lines) and `apps/regions/_shared/region-map.js` (5,467 lines).
Method and vocabulary follow the 2026-07 `DRIFT-REPORT.md` from the NZ/VU
extraction. Every difference resolves to one of: **config** (declared in
the global page's new `REGION_CONFIG`), **union** (behaviour moves into the
runtime, keyed on data or config, inert where absent), **global-only-gated**
(a global behaviour the runtime gains behind a config-absence key),
**runtime-only-inert** (census-era machinery that must provably no-op on
global), or **comment-only**. Hard constraints: zero behaviour change for
the ~100 country pages; zero behaviour loss for the global page.

The bulk verdict first: the span global 376–1279 against runtime 459–1362
is byte-identical (one comment-rule width differs), and the analysts'
"identical" classifications held on every spot check. All line references
below were re-verified against the current files.

## The two absence keys

Everything in this report hangs on two predicates the runtime gains:

- **`HAS_CENSUS`** — `Boolean(CENSUS_LEVELS && Object.keys(CENSUS_LEVELS).length)`,
  computed once immediately after `CENSUS_LEVELS` binds (runtime 2998).
  Verified: all 100 country pages declare non-empty `censusLevels` and none
  declares `overlays`, so `HAS_CENSUS` is true on every live country page
  and every guard keyed on it is unreachable there. On global (no
  `censusLevels`) the legacy shim yields `levels: undefined` and
  `HAS_CENSUS` is false.
- **`HANDOFF_HOME`** — becomes `RC.countryCode ? RC.countryCode.toLowerCase() : null`
  (runtime 5202). The shared resolver already implements both semantics on
  one code path (`region-resolve.js` 81–100: homeCode set → country
  handoff semantics; absent → global semantics), so the offer engine forks
  on `HANDOFF_HOME` with no resolver change.

The global `REGION_CONFIG` deliberately declares **no `countryCode`**. The
seven `RC.countryCode` reads were audited: 1695 (onboard key — bypassed by
`onboardStorageKey`, `||` short-circuits so the derived template never
evaluates), 4213 and 4263 (pulotu — requires `RC.pulotuCultures`, absent),
5202 (made conditional), 5260/5262 (`renderOfferToggle` — reachable only in
`toggle` mode, which requires `HANDOFF_HOME`), 5457 (dm-previous write —
gated on `HANDOFF_HOME`).

## Differences resolved as config

| Where | Global today | Runtime today | Config key |
|---|---|---|---|
| camera seed | `center: [174.7762, -41.2865]`, `initialZoom: 4.5` (global 100–101) | `RC.center` / `RC.initialZoom` (runtime 176–177) | `center`, `initialZoom` — move verbatim; the Wellington-centred seed is acknowledged hand-port residue and stays byte-identical (feeds first paint and `resetSite`'s fly-home; `hash: "map"` masks a wrong value except on bare load and reset) |
| `document.title` / `<title>` | static tag only, "Places of Worship \| MapLibre Flat Prototype" (global 6) | `document.title = RC.title` (runtime 21) | `title` — transcribed **verbatim** this lane; retitling for religionmap.org is a flagged follow-up, not a convergence edit |
| overview dot opacity | literal `0.75` stops (global 1313–1314) | `RC.overviewDotOpacity ?? 0.75` (runtime 1399–1400) | **omit the key** — `?? 0.75` reproduces global's paint exactly; setting it would dim the world overview tier |
| onboarding copy | authored dialog (global 15–26) | `RC.onboarding.{title,intro,bullets,links}` (runtime 32–59) | `onboarding` — global's single action link carries `external: true`, matching its authored `target="_blank" rel="noopener"` |
| onboarding dialog aria-label | `"What am I looking at?"` (global 15) | hard-coded `"About this map"` (runtime 49) | **new** `onboarding.ariaLabel`, template default `"About this map"` — country pages unchanged, global keeps its label |
| wordmark links | hard-coded GitHub anchor with `target=_blank rel=noopener` (global 28) | `RC.wordmarkLinks` template with **no** external support (runtime 42–44) | `wordmarkLinks` — template gains an `external` flag (union, see below); global's entry sets it |
| onboard dismissal key | `"pow-onboard-dismissed"` (global 1586) | `` `pow-${RC.countryCode.toLowerCase()}-onboard-dismissed` `` (runtime 1695) | **new** `onboardStorageKey`, default the derived form — all 100 country keys byte-identical, global's existing dismissals preserved |
| city presets | 12 hard-coded world cities (global 1587–1600) | `RC.cityPresets` (runtime 1697) | `cityPresets` — the 12-city array moves verbatim; the key is mandatory (`cityPresets.forEach` at 1722 is unguarded) |
| geocoder country bias | none (global 2137–2203) | `countrycodes=${RC.geocode.country}` (2246), `country=${RC.geocode.country}` (2270), photon `lat/lon` bias (2292) | `geocode` becomes **optional**: each parameter is appended only when `RC.geocode` supplies it, at the same position in the URL, so country URLs stay byte-identical and global's stay bias-free. Unguarded, a missing `RC.geocode` throws inside every geocoder and search degrades to "Search Unavailable" |
| taxonomy fetch depth | `fetch("../../schemas/denomination-taxonomy.json")` (global 2385) | `fetch("../../../schemas/denomination-taxonomy.json")` (runtime 2499) | **new** `schemaBase`, default `"../../../schemas/"`; global sets `"../../schemas/"`. The failure is silent by design (catch → `christianBuckets = null`, runtime 2513–2516), so verify the denomination row renders on both surfaces |
| regions/hub base path | `../regions/` in href, offer target, manifest fetch (global 50, 2868, 2883, 2933) | `../` throughout (runtime 83, 5237, 5285, 5325, 5376) | **new** `regionsBase`, default `"../"`; global sets `"../regions/"`. Drives: the `#datamaps-go` template href (the switcher derives `hubUrl` from it — a wrong value 404s the catalogue and strands the panel), the resting href, `handoffHref`, `prefetchHandoffPage`, and the manifest path `${regionsBase}_shared/data/region-bboxes.json` |
| key placement | `#counts-wrap.shell-top-centre` wrapper, key top-centre (global 54–68) | injected `#top-left-controls` wrapper (runtime 88–100) | **new** `keyPlacement: "top-centre"` — template emits global's `#counts-wrap` wrapper for that value, `#top-left-controls` otherwise. `#counts-wrap` rules live in `maplibre-flat.css` 464–477, which every surface loads; `#top-left-controls` rules live in `region-map.css`, which global does not load — so each surface's wrapper is styled by a stylesheet it already ships |
| script order | config → maplibre → region-resolve → inline → switcher (global 89–92, 2949) | config → maplibre → REGION_CONFIG → region-resolve → runtime → switcher (to/index.html 14–17, 105–107) | page-level: global copies the country pattern exactly; `config.public.js`/`config.js` tags stay same-directory and verbatim. Reordering region-resolve after the runtime throws at 5216 |

## Differences resolved as union (module, config-keyed, inert where absent)

1. **Desktop UI-click guard selector** (global 1547–1549, runtime 1649–1651,
   duplicated at 5401–5403). The merged string is the superset
   `"button, a, input, select, textarea, label, #dock, #counts-wrap, #key-wrap, #census-wrap, #wordmark, #corner-refresh, .maplibregl-ctrl"`,
   applied to **both** copies. Each id is inert where its element is absent
   (`#counts-wrap` on country pages, `#census-wrap` on global). Keeping
   `#counts-wrap` in the list matters on global: its flex gap sits between
   the key bar and panel, and dropping it would let clicks there fall
   through to the map.
2. **Census short-circuit in the desktop click handler** (runtime
   1667–1671). Kept; self-guarding on `map.getLayer(CENSUS.fill)`, which
   never exists on global.
3. **`DRAG_SELECTORS`** (global 1795 vs runtime 1901). Runtime's
   `["#census-wrap", "#key-wrap", "#wordmark", "#dock"]` kept verbatim:
   `makeDraggable(null)` returns immediately (1932) and
   `clearDragTransforms` null-guards (1907), so the absent `#census-wrap`
   is a no-op on global.
4. **`wordmarkLinks` external flag** (runtime 42–44). The template gains
   `link.external ? 'target="_blank" rel="noopener" ' : ""`, mirroring the
   onboarding-links template at 36–39. No country page sets the flag, so
   every existing injected anchor stays byte-identical (verified against
   nz/vu/to per DRIFT-REPORT judgement call 4); global's GitHub link keeps
   its new-tab behaviour.
5. **`addCustomLayers` census teardown/rebuild** (runtime 1554–1559). Kept
   verbatim, census-first ordering intact. `addCensusLayers` opens with
   `if (!censusState.enabled || !store || !store.geojson) return;` (3700)
   and the removal loops are null-safe, so global's layer stack is
   byte-identical to today's (`nudgeMap`-visible order: overview,
   polygons, buildings, places). The runtime's teardown here omits
   `CENSUS.hatch` where `removeCensusLayers` (3752) includes it — a
   pre-existing runtime asymmetry, deliberately not tidied.
6. **`resetSite`** (global 1731–1741, runtime 1828–1848). The merged body
   keeps the runtime's additions with two gates: the offer reset becomes
   `if (handoffRegions) setOffer(HANDOFF_HOME ? "toggle" : "resting", null);`
   (country pages byte-behaviour identical; global's pill returns to
   resting instead of a stale offer — see judgement call 3), and
   `setCensusEnabled(true)` is a no-op on global via the `HAS_CENSUS`
   guard. `showOnboard()` is adopted for global (judgement call 2).
   `handoffTapTarget = null` is harmless (the binding exists, always null
   on global).
7. **`updateCounts` keyDotsOff lines** (runtime 2875, 2878). Kept verbatim.
   `keyDotsOff` initialises false and only `syncKeyToDots` sets it, whose
   only callers sit behind census entry points that `HAS_CENSUS` forecloses
   — so `disableToggle` reduces exactly to global's expression. Residue:
   `countsToggle.title = ""` now stamps an empty `title` attribute on
   global's toggle where global never touched it — attribute-level only, no
   rendered or behavioural difference.

## Global-only behaviour, gated into the runtime

These are the behaviours only the global page has. Each keys on the absence
of `HANDOFF_HOME` (or presence of a config value), so no country page can
reach them.

1. **The `hint` offer state** (global 2894–2898, 2905–2908, 2919–2924).
   The pill's state machine becomes four named states:
   `resting | toggle | hint | offer`. `updateBorderHandoff` forks:
   - `HANDOFF_HOME` set (country): unchanged — below `HANDOFF_MIN_ZOOM`
     → `toggle` (before any resolve, as today at 5338); neighbour under
     centre → `offer`; home/water → `toggle`.
   - `HANDOFF_HOME` null (global): resolve without homeCode; found and
     zoom ≥ 3 → `offer`; found below 3 → `hint` ("Zoom for X data",
     class `hinting`, href = `regionsBase`); not found → `resting`.
   `setOffer` gains the hint branch (label, `hinting` class, aria-label);
   `classList.toggle("hinting", false)` is a no-op on country pages, and
   the `.hinting` rule already ships in `maplibre-flat.css` (420), which
   both surfaces load. The hint click does
   `map.jumpTo({ zoom: HANDOFF_MIN_ZOOM + 0.4 })` — **jumpTo is
   load-bearing**: global's own comment records that flyTo/zoomTo no-op on
   this surface.
2. **`zoomend` offer refresh** (global 2939). Registered only when
   `!HANDOFF_HOME`. The hint↔offer transition is purely zoom-driven, so
   dropping it would freeze the hint until a pan; adding it on country
   pages would double-call `updateBorderHandoff` per zoom (moveend also
   fires), so it stays global-only.
3. **Manifest fetch timing and caching** (global 2932–2945 vs runtime
   5373–5376). Both survive, keyed on `HANDOFF_HOME`: country pages keep
   `{ cache: "no-cache" }` fetched immediately at script evaluation (new
   country launches propagate); global keeps default caching behind the
   `document.readyState === "complete"` / window-load gate (manifest off
   the critical path). One `armOffers()` function, two arming schedules.
4. **Tap-to-offer, movestart tap-clearing, dm-previous** (runtime
   5388–5418, 5450–5461). Registered/executed only when `HANDOFF_HOME` —
   global has no tap-to-offer today, and `dm-previous` would name a home
   that does not exist. The `handoffTapTarget` check at the top of
   `updateBorderHandoff` stays; it is inert on global (never set).
5. **`handoffCarrySegment`** (runtime 5230–5232). Returns `""` unless
   `HAS_CENSUS` (and not pulotu), so global's offer hrefs never gain
   `&d=undefined:undefined`. Country hrefs unchanged.
6. **Geolocate-abroad census-off hook** (runtime 5354–5371). Already
   double-guarded (`!handoffRegions` and `Boolean(home)`); with
   `HANDOFF_HOME` null the `find` returns undefined and `abroad` is false.
   Left in place — inert by construction, not by accident, once
   `HANDOFF_HOME` is explicitly null.

## Runtime-only census machinery: the inertness proof for global

The ~2,200-line census/pulotu/dated surface stays in the runtime untouched
except for three guards. Without them the module **throws or misbehaves**
on a censusless config; with them, every country page reaches its current
code path bit-for-bit (`HAS_CENSUS` true everywhere today).

1. **Module-level `Object.entries(CENSUS_LEVELS)` throw** (runtime
   5085–5096). This is the hard blocker: with no census config
   `CENSUS_LEVELS` is `undefined`, the loop throws at top level, and
   everything after 5096 dies — metric/domain/source/points wiring, the
   five tile-status bindings (5175–5185), and the whole border-handoff
   block (5187–5467). Two-part fix: the injected chrome omits the census
   block on a censusless config (below), so `censusLevelSelect` is null on
   global; and the guard becomes `if (censusLevelSelect && HAS_CENSUS)` as
   defence in depth. `Object.entries` order — which sets the level
   dropdown order — is untouched for country pages.
2. **`map.on("load")` census boot** (runtime 1593–1609). The fourth idle
   handler becomes:
   `map.once("idle", async () => { if (HAS_CENSUS) await setCensusEnabled(true); window.__DATAMAP_FIRST_IDLE__ = true; document.dispatchEvent(new CustomEvent("datamap:first-idle")); })`.
   The dispatch stays **inside the idle, outside the census test**: country
   pages keep releasing prefetch only after the default boundary and
   summary complete (the contention the comment at 1604–1605 exists to
   prevent), and global now also emits first-idle — harmless there, since
   the switcher's `currentCode` is null on `/apps/global/` and
   `prefetchReady` arms from window load instead (datamaps-switcher.js
   137, 154–155, 347).
3. **`setCensusEnabled` absence guard** (runtime 4934). First line:
   `if (!HAS_CENSUS) return;`. This forecloses every census entry point at
   once — the load-idle boot, `resetSite`'s restore, the toggle click, the
   abroad hook — before `censusState.enabled = on` is assigned, so the
   flag can never be left true with no store. The analysts' option (c)
   (ship `censusLevels: {}`) is **rejected**: verified at 3518/3566 that
   the empty-map path flashes "Loading census boundaries…" then "Census
   data failed to load" at the user.

Everything else in the census domain is already inert without those three
entry points, verified by tracing rather than assumed:

- `addCensusLayers` (3698–3700) returns on `!censusState.enabled || !store`;
  `censusActive()` reads `censusState.levels[undefined]` → null before
  touching `censusLevelDef()`.
- `syncPlaceDotEra` / `syncPointsControl` / `syncKeyToDots` (4506–4579) are
  reached only via `applyCensusPaint`, `setCensusEnabled`, `setDataSource`,
  `setOverlayDomain` — all foreclosed (no pulotu select, single shim
  domain so no domain select, `setCensusEnabled` guarded). The place/
  overview layers are painted once by `addPlacesLayer`/`addOverviewLayer`
  and never repainted on global, exactly as today.
- `populateMetricOptions` (5097–5098) sits behind `if (censusMetricSelect)`
  — null on global with the chrome suppressed, so no five-option census
  dropdown ever renders.
- `updateCensusLegend` (4714–4731): `censusLegend` is null on global
  (chrome suppressed), and its 4731 store guard fires before the
  `censusLevelDef()` call at 4742 in any case.
- `writeCensusHash` (3199–3202): `carriable` false → `writeHashParam("d", null)`
  → no-op. `applyCarriedCensusView` (3191–3198) can set
  `censusState.metric` from a pasted `#d=` fragment but nothing consumes it.
- `pulotuState`/`PULOTU`/`CENSUS`/`DATED` stay unconditional module
  bindings; the six external readers of `pulotuState.active` all read
  `false`. Do not make any of them conditional.
- Dated places and pulotu layers: already config-keyed on `RC.datedPlaces`
  (4018, 4098) and `RC.pulotuCultures` (4220, 4487) — the cleanest
  precedent in the file; global declares neither. Note for a future lane:
  pulotu on global would need an all-countries mode (the layer filter at
  4263 keys on `RC.countryCode`).
- `CENSUS_PANEL_DISMISSED_KEY` is origin-shared and mobile-only; global
  never renders the panel so never reads or writes it.
- The evidence drawer's relative `overview.html` link (4711) is unreachable
  on global (no passport without a store). `apps/global/` ships no
  overview.html; if global ever gains a passport this link 404s — recorded,
  not fixed.

**Chrome suppression.** `renderChrome` wraps the whole
`#top-center-controls > #census-wrap` block (runtime 105–149) in a
conditional on `Boolean(RC.censusLevels || RC.overlays)`, tested on RC
directly because the chrome renders before `CENSUS_LEVELS` binds. All 100
country pages pass the test (verified), so their injected markup is
byte-identical; global's DOM carries no census element, which is what
makes the null-guard inertness above hold. Because the census chrome is
absent, **global does not add `region-map.css`** — every id in its injected
chrome is styled by `map-shell.css` + `maplibre-flat.css`, exactly as its
authored markup is today, and no census rule can collide with global's
layout. The chrome-domain analyst's suggestion to split region-map.css is
overruled as unnecessary.

## Comment-only drift (no behaviour)

- AttributionControl comment: runtime appends "per-product source terms
  recorded in the manifests prevail where they differ" (369 vs global 286).
  Runtime wording survives.
- Popup-offset section-rule width (global 816 vs runtime 899) — the only
  byte difference in the 900-line identical span.
- Global's drag-roster block carries "ported from the region pages' shared
  module … for parity" (1790–1791); dies with the inline script.
- `DEFAULT_BASEMAP_ID` indirection (runtime 300–303): the nested ternary
  returns `"backdrop"` on both branches, so the runtime's extra constant is
  form-only. Recorded so a reviewer does not "fix" it.

## Hand-port residue kept verbatim (deliberate)

- `CONFIG.tiles.polygons` → `tiles.placemap.org/nz-polygons` on the world
  map, and the `tiles.placemap.org` host throughout: unchanged (fixing is
  a behaviour change on both sides; domain rename is a separate lane).
- `nz-census*` layer ids, `isPlacesmapHost`, `showStatus`, `googleMapsReady`,
  the second legacy `map.on("error")` CARTO fallback (runtime 1611–1618),
  the terrain-toggle dead scaffolding, the null lookups
  (`censusYear`, `terrain-toggle`, `corner-info*`, `onboard-toggle`): all
  carried verbatim; global's copies die with its inline script. None is
  tidied in this lane — the merge diff stays purely subtractive on the
  global side.
- The camera seed stays the Wellington residue, verbatim.

## Judgement calls

1. **`HAS_CENSUS` over per-call-site patching.** One predicate, three
   guards (5086, 1602, 4934), each provably unreachable on live country
   pages. The overlay shim (2964–2985) is untouched — changing its return
   shape would alter what every country page's `activeDomain()` returns.
2. **`showOnboard()` on reset is adopted for global** — a deliberate small
   behaviour addition, not an accident: the country pages ruled reset as
   the recovery path for the how-to card (jb 2026-07-09), and forking
   reset per surface for this would add a config flag with no user asking
   for it. Flagged here so it arrives on the record.
3. **Reset now rests the global pill immediately** (`setOffer("resting")`)
   where today a stale offer can survive reset — global's animated camera
   transitions are inert (its own comment), so no moveend reliably
   re-derives the state. A fix-by-union, flagged as the one intentional
   global behaviour delta beyond the onboarding resurface.
4. **`prefetchHandoffPage` now runs on global offers** — link-prefetch of
   the target country page, built on `regionsBase` so the URL is correct.
   A benign addition kept because gating it would add a branch with no
   protective value.
5. **Title transcribed verbatim** ("MapLibre Flat Prototype") — retitling
   is copy, not convergence, and would break the DOM-parity check this
   lane relies on. Follow-up flagged.
6. **The resolver hard-require moves to global** — the runtime reads
   `window.RegionResolve.normaliseLng` unguarded at top level (5216),
   where global's IIFE today degrades gracefully if the script is missing.
   Accepted: the converged page loads region-resolve.js exactly as 100
   country pages do, and a missing committed asset is already fatal there.
   Kept verbatim per the chrome analyst's warning against changing when
   the binding evaluates.
7. **First-idle now fires on global** (see census boot above) — verified
   harmless against datamaps-switcher.js; the country dispatch point is
   unmoved.
8. **`geocode` becomes optional rather than a dummy value** — passing a
   fake country would bias world search; the conditional-parameter form
   keeps both surfaces' request URLs byte-identical to today's.

## Config surface

The full shape the global page declares (new keys marked):

```js
window.REGION_CONFIG = {
  // no countryCode: the world map has no home country — its absence is the
  // switch for handoff semantics, the census toggle, and the abroad hook
  title: "Places of Worship | MapLibre Flat Prototype",
  center: [174.7762, -41.2865],
  initialZoom: 4.5,
  keyPlacement: "top-centre",             // NEW: key stays top-centre under #counts-wrap
  regionsBase: "../regions/",             // NEW: hub/handoff/manifest base (default "../")
  schemaBase: "../../schemas/",           // NEW: taxonomy base (default "../../../schemas/")
  onboardStorageKey: "pow-onboard-dismissed", // NEW: preserves existing dismissals
  cityPresets: [ /* the 12 world cities, verbatim from global 1587–1600 */ ],
  onboarding: {
    title: "What am I looking at?",
    ariaLabel: "What am I looking at?",   // NEW subkey (default "About this map")
    intro: "Global places of worship, mapped from OpenStreetMap.",
    bullets: [
      "Colours show broad religion categories.",
      "Zoom in for individual places and Street View."
    ],
    links: [
      { label: "How to fix data",
        href: "https://github.com/go-bayes/places-of-worship?tab=readme-ov-file#how-can-i-add-or-correct-a-place-of-worship-on-the-map",
        external: true }
    ]
  },
  wordmarkLinks: [
    { id: "wordmark-repo", label: "GitHub",
      href: "https://github.com/go-bayes/places-of-worship",
      title: "Project repository on GitHub",
      external: true }                    // NEW flag on the wordmark template
  ]
  // deliberately absent: geocode (world search must not bias),
  // censusLevels / overlays / defaultLevel / defaultMetric / defaultYear /
  // timeline / metricLabels / metricsAvailable / censusSourceAttribution /
  // censusFlagNote / popupDenominatorNote / pendingAreaNote /
  // censusFillOpacity / dataNoun / datedPlaces / pulotuCultures /
  // overviewDotOpacity / disableBorderHandoff
};
```

Country pages change nothing: every new key defaults to today's runtime
behaviour when absent.

## Paths

The runtime executes against the page's own directory. `apps/global/` sits
one level shallower than `apps/regions/<cc>/`. Every relative reference in
the runtime, audited:

| Path in runtime | Depth-sensitive? | Resolution |
|---|---|---|
| `../../../schemas/denomination-taxonomy.json` (2499) | yes | `schemaBase` config (default keeps country literal; global `"../../schemas/"`) |
| `../_shared/data/region-bboxes.json` (5376) | yes | `${regionsBase}_shared/data/region-bboxes.json` (country `"../_shared/…"`, global `"../regions/_shared/…"`) |
| `../${code}/` handoff href (5237) and prefetch (5325) | yes | `${regionsBase}${code}/` |
| `../` resting/template href for `#datamaps-go` (83, 5285) | yes | `regionsBase` — also fixes the switcher's derived `hubUrl`, `catalogUrl`, `tzIndexUrl` (datamaps-switcher.js 21–23), which all resolve correctly from `/apps/regions/` |
| `data/…` census boundaries/summaries | no | config-supplied per level; global declares none |
| `RC.datedPlaces`, `RC.pulotuCultures.data` | no | config-supplied; absent on global |
| `overview.html` (evidence drawer, 4711) | yes but unreachable | census-only; recorded above |
| page-level tags (`config.public.js`, `config.js`, `../shared/map-shell.css`, `styles/maplibre-flat.css`, `../shared/region-resolve.js`, `../regions/_shared/region-map.js`, `../shared/datamaps-switcher.js`) | page-authored | global's index.html uses its own depths; not the runtime's concern |

Rule: no path is counted at runtime from `location.pathname`; every
depth-sensitive path rides one of the two config bases, so a hosting
rearrangement changes two config lines, not a code audit.

## Verification checklist for the implementer

- Country page (nz or to): DOM diff of the injected chrome before/after —
  must be byte-identical. Census loads, level/metric/year controls work,
  pill toggles census, border pan offers the neighbour, `#d=` carry
  present, taxonomy row renders, `datamap:first-idle` fires after the
  census load.
- Global: rendered-layer dump contains no `nz-census*` layer and the
  `pow-*` order matches today's; no census pill or panel in the DOM; key
  sits top-centre and drags; denomination filter row renders (taxonomy
  fetch resolves at the shallower depth); search unbiased; offer pill
  hints below z3, offers above, rests over ocean; hint click jumps to
  z3.4; `#datamaps-go` resting href is `../regions/`; switcher panel lists
  countries (catalogue fetch resolves); no console errors on load, click,
  reset, basemap switch, or geolocate.

## Post-verification notes (2026-08-14, after implementation)

- Line references above cite the pre-implementation runtime (5,467 lines); the implemented tree is 5,555 lines, so references drift by roughly 18–88 lines (e.g. `HAS_CENSUS` now binds at 3028, `HANDOFF_HOME` at 5238). Every content claim was re-verified by the three verification agents against the implemented tree; treat the line numbers as approximate.
- One further micro-delta beyond the judgement calls: on manifest arrival, global now runs `writeHashParam("handoff-from", null)`, which on a fragment-less URL appends a bare `#` via `history.replaceState`. Country pages already behave this way; the old global page did not. Cosmetic only.
- The dock toggle's authored label changes from "Search World" to "Search & Filters", but both the old and new page rewrite it synchronously via `syncDockToggleLabel(false)` during script evaluation, so the authored string could only ever appear during a slow-network flash before script run.
