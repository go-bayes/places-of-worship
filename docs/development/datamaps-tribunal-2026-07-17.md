# Data maps tribunal — 2026-07-17

Two-seat tribunal (Fable 5, GPT 5.6 high) convened at JB's request over four questions: country-switcher search ranking, map-data load speed, phone declutter, and the data maps pill's menu affordance. Round 1 produced five disagreements; round 2 resolved all five. This record carries the ratified backlog so the consensus survives the session.

## Shipped this sitting

- Prefix-first switcher search: name-start matches lead, word-start matches follow, substrings trail; the list itself sorts by folded name. `apps/shared/datamaps-switcher.js`.
- Touch screens pin the switcher panel to the top of the viewport, search row first, with `visualViewport`-aware height capping. Same file.
- The pill's caret zone carries a visible "Countries ▴" label on all 101 surfaces; the glyph turns while the panel is open. Both seats independently recommended a visible word and rejected icon-only affordances (the census-caret field lesson generalises: bare glyphs go undiscovered).

## Ratified backlog (consensus, not yet built)

1. Prefetch accounting: add estimated-gzip bytes to `region-catalog.json` (`scripts/build_region_catalog.py`) and budget the switcher's 1 MiB warming limit on compressed bytes — 97/100 boundary+summary pairs fit compressed against 67/100 raw. Warm the boundary as well as the summary on list hover/touch and border-handoff offers; today those paths leave the boundary on the next page's critical path.
2. Boundary outliers: run Malaysia's district file (~10 MB raw, 7 dp, never simplified) through the standard mapshaper keep-shapes + 5 dp pipeline, and add a generic build gate (raw ≤ 3 MB, est. gzip ≤ 1 MB, unchanged feature count and join keys, manifest waiver for true exceptions).
3. Summary compaction: drop pretty-printing in the summary generators (one flag; US 20.6 → 16.6 MB raw) and, for the US/Brazil-class outliers only, hoist the constant per-row fields or emit a compact render payload at the planned compiled-map seam. Parse cost measured small (~20 ms desktop, both seats replicated), so this is hygiene behind items 1–2, not the headline.
4. Census panel on phones: session-remembered dismissal — open on the first teaching visit; once dismissed via × or toggle, later country pages in the session open with the choropleth on and the panel collapsed. Gesture-triggered collapse was considered and rejected (the panel is a working legend; collapsing on first pan removes the key when it becomes useful).
5. Denomination key follows the dots: hide the key pill on phones while "Points: off" is selected (restore on any mode with dots), disable-with-reason on desktop; wire in the existing points-sync path. Fold in the 44 px touch floor for the top pills (`#data-pill`, `#counts-toggle`) while touching that chrome.

## Ratified do-not-do

No TopoJSON or PMTiles migration (gzip already absorbs shared-arc redundancy; the choropleth paint pipeline needs the full attribute table client-side). No blanket year/metric summary splitting (the cross-wave colour domain and change metrics need all years; the geography-level split already defers the heavy files). No streaming parser. No service worker without an offline requirement — stale research data is the failure mode this product cannot afford. Cloudflare-for-brotli is real (~40% off the US pair) but second-order, and safe only with fingerprinted data URLs or a purge contract. Keep the bottom-left reset where the corner grammar puts it — a recovery affordance buried in the Search panel fails exactly when needed.
