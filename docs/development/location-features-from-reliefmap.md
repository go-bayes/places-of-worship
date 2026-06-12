# Porting the location features from reliefmap

Instructions for the Claude instance adopting the reliefmap location/UX
features into this project. Written 2026-06-12 by the instance that built
them. Joseph has asked for "a version of these features" here; adapt to this
project's register and conventions rather than copying wholesale.

## Provenance

`places-of-relief` (live at https://reliefmap.info, local
`/Users/joseph/GIT/places-of-relief/`, private repo `go-bayes/places-of-relief`)
is a fork of THIS project's `apps/global/index.html`, so the two maps share a
skeleton: MapLibre GL 3.6.1, `styles/maplibre-flat.css`, the dock/search UI,
popup machinery, and Street View integration. The canonical implementation of
everything below is in relief's `docs/apps/global/index.html` and
`docs/apps/global/styles/maplibre-flat.css`, commits `b479471..94071ae`
(2026-06-11 to -12; the addendum at the end covers the second-day round).
Read those two files side by side with this project's
`apps/global/index.html`; most code transplants with renames.

The 2026-06-09 decoupling decision still stands for the DATA layer: worship is
a research data platform and must not inherit relief's data-layer choices.
This port concerns interaction features only.

## Feature inventory (in dependency order)

1. **Blue dot** — `maplibregl.GeolocateControl` (high accuracy,
   `trackUserLocation`, `fitBoundsOptions.maxZoom 16`), added for all devices.
   Phone dot enlarged to 22 px (halo 28 px) via
   `.maplibregl-user-location-dot` overrides under 640 px.
2. **Near me pill** (`#near-me`, in a `#bottom-actions` flex container beside
   the search toggle) — labelled primary control; the stock geolocate icon is
   hidden in CSS (`:has()` on the ctrl group). `geolocate.trigger()` drives the
   state machine: off → locate, following → off (dot removed), background →
   recentre. State shown via `aria-pressed` + `.active`.
3. **Measuring point** — `referencePoint()` returns pin-or-blue-dot (pin
   wins). Every distance answers from it.
4. **Nearest banner** (`#nearest-loo`, a `<div role=status>` with delegated
   clicks — nested buttons are invalid HTML) — "Nearest X: 220 m · ~4 min
   walk · crow flies ↗". Tap opens Google Maps walking directions
   (`directionsUrl()`, `&origin=` the pin when down). Walk estimate =
   straight-line × 1.3 detour at 4.8 km/h, omitted past 90 min
   (`walkSuffix`/`distanceSummary`/`formatDistance`).
5. **Planning pin** — right-click / 600 ms long-press (12 px tolerance,
   cancelled by pan or second finger) drops a draggable amber (#f59e0b)
   Marker. Tap the pin to remove it (click-on/click-off; `pinDragging` flag +
   80 ms post-dragend timeout swallows the drag-click). `referenceChanged()`
   invalidates the stale nearest whenever the measuring point changes.
6. **Guide line** — dashed 3 px blue line from measuring point to the nearest
   feature, or to the feature being inspected: `focusLoo()` toggles focus
   keyed on osm identity, and focus SURVIVES popup close (Joseph wants this);
   clicking the same feature again releases it.
7. **Popup additions** — "From you" and "From pin" rows (both when both
   exist), a crow-flies footnote pointing at Directions, and a Directions
   link via `directionsUrl()`.
8. **Popup singleton** — `trackLooPopup()`: opening any popup removes the
   previous one. Without it, repeated opens stack translucent copies that
   read as a darkening box needing multiple ×. Also: on mobile, a direct tap
   fires BOTH the layer click handler and the generic bbox tap handler —
   the generic one must skip direct hits (mirror the desktop handler).
9. **Lazy Street View** — popups show a "Show Street View" button
   (`.sv-show`); the Google Maps API loads only on click. The page-load
   prewarm was removed (a billable Dynamic Maps load per visit). Copy-coords
   and Expand listeners live OUTSIDE the Street View path.
10. **Dock behaviour** — one `setDockOpen()` path shared by the toggle, a
    panel × (`#dock-close`), and Escape; closing clears all filter
    checkboxes (`clearFiltersIfAny()`) because a filter behind a closed
    panel is invisible state.
11. **Compass on demand** — `#corner-reset` hidden unless |bearing| > 0.5°,
    synced on rotate/rotateend/load (the URL hash can restore a bearing).
12. **Crow-flies labelling** — all straight-line distances say so; hills and
    harbours ignore the haversine.

## Hard-won gotchas (do not relearn these)

- **Never gate queries/`setData` on `map.isStyleLoaded()`** — it is false
  during ANY pending repaint (e.g. right after adding a layer) and silently
  skips synchronous updates. Gate on `map.getSource(SOURCE_ID)` presence.
- **`querySourceFeatures` sees loaded tiles only** — recompute after the
  geolocate fly-to settles (debounce + `map.once("idle")`), re-run on
  moveend, keep the previous answer when the fix is off-bounds, and dedupe
  tile-boundary duplicates on osm identity.
- **`loading=async` Maps API is NOT ready at `script.onload`** — readiness
  must come from the `callback=` URL param; cache the promise so rapid
  clicks don't inject the script twice. Relief's prewarm had masked this
  race for months.
- **`geolocate._watchState` is private API** — used to distinguish full-off
  from background on `trackuserlocationend`; code must degrade gracefully
  if it vanishes in a MapLibre upgrade.
- **Custom sources/layers die on `setStyle`** — re-add the guide line inside
  the layer-rebuild path that runs on every `style.load`.
- **Local dev needs HTTP Range support** — `python3 -m http.server` ignores
  Range (200 + full body) and PMTiles silently renders nothing; use
  `npx http-server`. Relief keeps a `.claude/launch.json` for the preview
  harness; replicate it here (mind which port any origin-locked keys allow).
- **Preview testing: cache-bust BOTH the HTML and the stylesheet** —
  http-server 304s made fresh CSS look broken.
- **Coordinate quantisation** — at the tileset's maxzoom, feature coords are
  quantised (~10 m for relief's z10 tiles); irrelevant for distances, worth
  remembering for Street View anchoring.

## Adapting to this project (do not copy blindly)

- **Wording and colours obey `docs/ui-style-guide.md` and `LEXICON.md`**, not
  relief's choices. "Nearest loo" becomes whatever the style guide calls a
  site. Relief's playful register ("loo", "crow flies") may or may not fit —
  "crow flies" is honest and plain; keep unless the style guide objects.
- **Reserve hues**: blue = the user, amber = the pin. Relief recoloured its
  category palette (Okabe–Ito green/vermillion + purple) partly to free
  blue; this map colours by religion, so check the existing palette for
  collisions with blue/amber before porting the pin and dot.
- **Filters**: relief shares one `currentFilterClauses()` between the layer
  filter and the nearest-search so "nearest" respects active filters. This
  map's religion filters should thread through the same way.
- **Data source**: the nearest-search needs the detailed places source layer
  (check `source-layer` names here — relief has a single `loos` layer; this
  map's two-tier overview/places split means the overview layer must NOT be
  what nearest queries hit at low zoom).
- **Research context**: this map fronts RA workflows (task layers, triage).
  Check `PLANNING.md` before rearranging UI furniture the RA docs reference
  (e.g. if RA instructions say "tap the locate icon", update them or keep
  the icon).

## Verification recipe (what proved the relief build)

Serve with `npx http-server`, open the preview at a city with data, then in
the console/preview-eval: set `userLocation = [lng, lat]`, call
`updateNearestLoo()`, and assert banner text, line geometry
(`map.getSource("nearest-line")._data`), and popup rows. Capture
`window.open` to assert the directions URL (with and without the pin). Click
the same feature twice to verify focus toggling, open popups five times to
verify the singleton, and confirm no Google script tag exists before
`.sv-show` is clicked. Real-device checks Joseph cares about: long-press
feel, pin tap vs drag, dot size, colour legibility in sunlight.

## Process

Work feature-by-feature in the inventory order above (each is a small
commit), render/verify between steps, and record durable decisions in
`JOURNAL.md` + a dated `CHANGELOG.md` entry per this project's conventions.
Joseph approves UI decisions quickly when shown screenshots; when a relief
decision conflicts with a worship convention, ask rather than guess — this
project pays the rent.

## Addendum — second-day round (relief commits e86f590..94071ae)

**Fix this first, port or no port: the fullscreen bug exists in THIS repo
today.** `apps/global/index.html` adds `new maplibregl.FullscreenControl()`
with no container option, and this map's UI (HUD, dock, buttons) are siblings
of the map element. The Fullscreen API renders only the fullscreened
element's subtree, so entering fullscreen hides every control except
MapLibre's own. One-line fix, verified on relief:
`new maplibregl.FullscreenControl({ container: document.body })`. Browsers
refuse synthetic fullscreen gestures, so verify by hand.

Additional features adopted on relief, in the same adapt-don't-copy spirit:

13. **Ambient legend** — the counts/key toggle became the legend itself:
    colour chips always visible in a compact strip, tap for the counts
    panel. Principle: the map's colour vocabulary should not hide behind a
    toggle. Caveat here: worship colours by religion, a much larger palette —
    a full ambient legend may not fit 375 px. Consider top-N categories with
    "more…", or keep the toggle but put real colour dots on it.
14. **Dark stock controls** — `.maplibregl-ctrl-group` in the dark pill
    idiom; icons are dark data-URI SVGs, lightened with
    `filter: invert(0.9) hue-rotate(180deg)` (hue-rotate keeps the compass
    needle red). Scope the filter to `-group` so the white attribution pill
    is untouched.
15. **Dock hygiene** — toggle labelled for what it holds ("Search &
    filters" / "Close"), a quiet panel ×, Escape closes, and closing CLEARS
    the filter checkboxes: a filter behind a closed panel is invisible state
    that quietly hides data.
16. **Reset button** (replaced the info menu): one tap sweeps pin, filters,
    popups, search text, flies to the default view; keeps the tile cache and
    the blue dot. Licence trap: if an info menu is the only route to map
    credits, removing it must make the attribution pill always visible.
17. **Wordmark with a fix-map link** — deep-links the OSM editor to the
    current view, href computed at click time. A static pill that looks like
    a button reads as broken; give it work or flatten it.

Further gotchas earned on day two:

- **Fourth `isStyleLoaded()` instance** (updateCounts): audit EVERY
  `isStyleLoaded()` gate in this map's file before porting — for queries,
  setData, and UI toggling it is always wrong (false during any pending
  repaint, silently swallows the action). Guard on source/layer presence.
- **Hidden preview windows lie**: `requestAnimationFrame` never fires
  (shim with `setTimeout` to test rAF-deferred UI), MapLibre camera
  animations don't tick (capture `flyTo` args instead of asserting the
  camera moved), tiles never paint (rendered-feature counts come back 0),
  and the window can wedge at `innerWidth: 0` (fix with an explicit
  `preview_resize` then reload). Cache-bust BOTH the HTML and the CSS.
- **When the dev network blocks the live site** (e.g. FortiGuard at VUW),
  verify deploys with `gh api repos/<owner>/<repo>/pages/builds/latest`
  instead of curl-ing the domain.
- **New domains get quarantined**: FortiGuard-style filters block "Newly
  Registered Domain" for ~4 days. Relevant if this project ever launches a
  new public domain — plan the announcement after the quarantine, and the
  block page's re-rate link is the fastest unblock.
