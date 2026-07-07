# Temporal place layers — linking PoW points to the timeline

Status: DESIGN (2026-07-07, JB-prompted). The interim honesty rule is
implemented; the event-derived layers are the destination.

## The problem

The map's place dots are a current OpenStreetMap snapshot. The census
timelines now reach 1850 (US), 1999 (VU), 2013 (NZ). Sliding to a
historical year while showing today's dots asserts something false —
today's places were not 1850's places — and the converse gap is worse:
places born and dead before OSM existed appear nowhere at all, though
they are precisely the deep-history evidence the project exists to
assemble.

## Interim rule (implemented in the shared runtime)

When the selected census year sits more than 15 years before today, the
dot layers fade to a faint texture and the legend states: "place dots
show today's OpenStreetMap places, not {year} places — historical place
layers are being assembled from evidence." Data-keyed, no country
conditionals; the census choropleth (which IS year-true) stays fully
saturated. Recent years keep normal dots because a current snapshot is a
reasonable stand-in within roughly one census cycle.

## Place-dot visibility modes (JB directive 2026-07-07, implemented)

Implemented in the shared runtime 2026-07-07: a `Points` select in the
census panel (period/all/off; period offered only where the country
ships a dated layer), the later-foundations checkbox inside period
mode, mode persistence across year and level changes, and legend copy
per mode. The design below is the spec it implements.

A `Points` control joins the census panel with three modes:

- **Period** (default whenever the selected year is historical): only
  dated dots alive at the year render (the current amber-ring layer);
  the undated snapshot tier is hidden entirely rather than faded.
- **All**: today's full OSM snapshot plus the dated layer — the current
  behaviour.
- **Off**: no place dots at all; the choropleth alone.

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
