# Temporal place layers — linking PoW points to the timeline

Status: DESIGN (2026-07-07, JB-prompted). The interim honesty rule is
implemented; the event-derived layers are the destination. The
cross-surface standard below (2026-07-09) is normative for every
surface that shows historical points.

## The historical-points standard (normative, 2026-07-09)

Two runtimes render historical points: the shared country-map module
(`apps/regions/_shared/region-map.js`, MapLibre) and the shared portal
(`apps/regions/nz/js/verification-map.js`, Leaflet). The global map
(`apps/global/`) has no year control, so no dot modes apply there; it
joins this standard only if it ever gains one. Both runtimes MUST
follow the rules below; where a rule is surface-specific, the standard
says so and says why.

**Modes.** Internal values `period` / `all` / `off`; user-facing labels
"Points: period", "Points: all", "Points: off"; option order
period, all, off on every surface. `period` is offered only when the
country wires a dated-places product containing at least one feature.

**Date predicate (identical on every surface).** In `period` mode a
feature renders for selected year Y iff `start_year` is present and
`start_year <= Y` and (`end_year` is absent or null or `end_year >=
Y`). Features without `start_year` never render in `period` mode.
The prospective tier ("show later foundations", country maps only)
renders features with `start_year > Y`. Because the runtimes cannot
share a module, the predicate is deliberately duplicated: a MapLibre
filter expression in `region-map.js` and a plain JS filter in
`verification-map.js`. Any change to the predicate MUST update both
files and this section in the same commit.

**Defaults (surface-specific, deliberate).** Country maps open in `all` on every year (Joseph B, 2026-09-21: show place points on first opening). Previously, a year more than 15 years before the current year selected `period` when a dated product was wired. The Bahamas' 2010 default crossed that threshold in 2026, so its map opened with two dated places and the snapshot hidden. Of the current country configurations, only the Bahamas combined a default year at or before 2010 with a dated product. `period` remains an explicit choice where a dated product is wired, and the chosen mode persists across year and level changes. The portal defaults to `off` so task markers remain the primary display.

**Styling (surface-specific, deliberate).** Country maps colour dated
dots by religion with the amber date-tag stroke, scale radius by zoom,
and fade the undated snapshot tiers on stale years (the interim
honesty rule below). The portal keeps uniform slate-grey fixed-radius
context dots so task markers dominate visually; it has no undated
snapshot tier and therefore no fading rule. The portal has no
prospective tier — later foundations serve research reading, not
point-verification at a target year.

**Legend.** Every surface offering dot modes MUST explain the active
mode in one line: what the dots are (dated OSM evidence vs today's
snapshot) and what the year filter means. The requirement is the
presence of those content elements, not identical strings — each
surface words its note for its own tiers (the portal has no undated
snapshot tier, so the country maps' longer copy would mislead there).
The country maps do this via `dotEraNote`; the portal via
`updatePointsNote`.

**Reviewed tier (PR-C, 2026-09-02).** A `dated_places.geojson` may carry,
beside its OSM date-tag features, one feature per reviewer-accepted
occupancy (`source: "reviewed_occupancy"`, `kind: "occupancy"`) and
`LineString` transition features (`kind: "transition"`), built by
`scripts/build_occupancy_dated_places.py` from a materialised Convex
export. The date predicate above is unchanged and still decides
aliveness from `start_year` and `end_year`; a reviewed feature sets
`start_year` to its earliest possible start and `end_year` to its
latest possible end, so it stays alive through both windows. The
country maps add a window rule on top: year Y is inside a window when
`Y < start_upper`, or `Y > end_lower`, or `end_unknown` and
`Y > start_upper`; such a place renders as an amber dashed ring instead
of the solid dot, an approximate place adds a pale disc for `radius_m`,
and a transition line renders while `year_lower <= Y <= year_upper`.
Every point layer filters on point geometry so the line features never
reach a circle layer. The portal keeps its plain predicate and skips
features without two coordinates; it does not render windows or
transitions (its context dots stay subordinate to task markers). Full
contract: `public-map-occupancy-slider-brief-2026-09-02.md`.

**Wiring rule for data products.** A `dated_places.geojson` with zero
features is unwired everywhere (no `datedPlaces` key in the region
config, no `datedPlaces` in the portal's `COUNTRY_CONFIGS`) — an empty
product in `period` mode would blank every dot and read as "no places
existed", which is false. When a real dated product ships for a
country, wire it in BOTH surfaces in the same commit. Vanuatu is the
current example of the empty-product rule; AU/BR/CA/MX/UK simply have
no product yet.

## The problem

The map's place dots are a current OpenStreetMap snapshot. The census
timelines now reach 1850 (US), 1999 (VU), 2013 (NZ). Sliding to a
historical year while showing today's dots asserts something false —
today's places were not 1850's places — and the converse gap is worse:
places born and dead before OSM existed appear nowhere at all, though
they are precisely the deep-history evidence the project exists to
assemble.

## Interim rule (implemented in the shared runtime)

When the selected census year sits more than 15 years before today, the snapshot dots fade to roughly half their normal opacity and the legend explains that the dots represent today's OpenStreetMap places. The census choropleth retains its selected-year values. Recent years keep normal snapshot opacity; the snapshot remains contemporary context even when displayed beside a historical census.

## Place-dot visibility modes (JB directive 2026-07-07, implemented)

Implemented in the shared runtime 2026-07-07: a `Points` select in the
census panel (period/all/off; period offered only where the country
ships a dated layer), the later-foundations checkbox inside period
mode, mode persistence across year and level changes, and legend copy
per mode. The design below is the spec it implements.

A `Points` control joins the census panel with three modes:

- **Period** (explicit choice where a dated product is wired): dated dots meeting the selected-year predicate render, and the snapshot is hidden.
- **All** (country-map default): today's OSM snapshot renders. The dated layer also renders when the selected year is more than 15 years before the current year; recent years retain the existing snapshot-only behaviour.
- **Off**: place dots are hidden and the choropleth remains.

Within Period mode, a **"show later foundations"** checkbox additionally
renders dated dots with start_year AFTER the selected year in a distinct
prospective style (e.g. hollow grey ring): with perfect information one
would see where future PoWs were to be built — useful for studying
antecedents of religious expansion. Copy must say what it is ("founded
after {year}"). Implementation: extend syncDatedPlaces with a mode
state + second filter branch; config-free (all countries get it);
version-bump on ship; Opus verifies including the mode persistence
across year changes and level switches.

## Destination: year-aware place states, three evidence tiers

A dot for year Y should reflect what is KNOWN about that site at Y:

1. **Accepted events (gold).** `pow` replay of accepted change events
   yields per-site target-year states (present/absent/uncertain, with
   worship-function state). Sites whose lifecycle bounds contain Y
   render solid; sites known absent at Y do not render; sites first
   evidenced later do not render. This is the existing master-
   reconstruction contract — the map work is an export shape
   (per-year site states as tiles or per-year GeoJSON) plus a renderer
   that keys dot presence/style on the selected year.
2. **Provisional bounds (silver).** OSM `start_date`/`end_date` tags and
   unreviewed-but-plausible source evidence give provisional bounds.
   Render distinctly (hollow ring), labelled provisional in popups.
3. **Undated (default).** Sites with no temporal evidence render in an
   "undated" style when a historical year is selected — visible but
   visually humble (the current faded treatment) — inviting exactly the
   RA/portal work that dates them.

Historical sites with no modern OSM presence (born and died pre-OSM)
enter ONLY through tier 1/2: deep-history evidence via the workbench
portal (source-first claims, agent-assisted extraction) → review → `pow`
→ per-year states. They will be the first dots that exist in 1890 and
not in 2026 — the visible payoff of the deep-history programme.

## Build sequence (when scheduled)

1. Define the per-year site-state export from `pow` replay (schema:
   site_id, year, state, basis tier, style hints) — an export contract,
   not a UI guess.
2. Renderer: dot layer keyed on selected year against that export, with
   the three-tier styling; fall back to the interim rule where a country
   has no state export yet.
3. Seed tier-2 provisional bounds from the existing OSM date-tag
   pipeline (nz date-tag leads already exist).
4. Retire the interim fade country-by-country as state exports land.

The census timeline and the place timeline then share one year control:
the slider Joseph already drags.
