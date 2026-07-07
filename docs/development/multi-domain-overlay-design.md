# Multi-domain overlays without clutter — design

Status: DESIGN PROPOSED (Fable, 2026-07-07) — awaiting JB ratification
before any build. The brief below is unchanged; the Design and Rollout
sections turn its open questions into decisions.

## The problem

Religion is the first overlay family. Census demographics, economic
indicators, language (Guy's VU language tables are already promised),
and other cultural data will multiply metrics per country by five to
ten. The current census panel (one metric dropdown) and the map (one
choropleth + dots) will not scale: clutter risk compounds with every
domain added.

## Principles to design from

1. **One choropleth at a time, always.** Domains never stack visually;
   the user switches. Comparison across domains is a research-portal
   feature (side-by-side or small multiples), not a map-layer feature.
2. **Domain → metric hierarchy in the panel.** The metric dropdown
   becomes two levels: domain (Religion / Population / Economy /
   Language / …) then metric within domain. Config-driven per country:
   `overlays: { religion: {...}, language: {...} }` generalising
   today's censusLevels/metrics shape; area_summary products gain a
   domain field or one product per domain.
3. **The timeline stays singular.** One year slider governs whatever
   overlay is active; overlays declare their year sets (the timeline
   union machinery already exists).
4. **Dots are religion-domain furniture.** Place dots (and the Points
   modes) show only when the religion domain is active, or explicitly
   summoned — a language choropleth under PoW dots is clutter.
5. **Construct honesty scales with domains** — metricLabels-style
   per-domain wording, denominators stated per overlay.
6. **Popups aggregate by domain**, one table per domain, collapsed by
   default except the active domain.

## Non-census sources (JB, 2026-07-07)

Overlay domains will include survey data measured at the individual
level — named example: the Global Flourishing Study (Gallup/Harvard/
Baylor; ~200k respondents, 20+ countries, flourishing and religion
measures; baseline openly accessible via COS/OSF under terms). Design
implications the census machinery does not cover:

- **Microdata never enters the public tier** regardless of openness of
  access — it goes through the research tiers like restricted census
  data; only derived area or country estimates can surface on maps,
  each with a per-source ruling.
- **Survey estimates carry uncertainty**: overlays need an uncertainty
  presentation (intervals in popups at minimum; washed styling for
  wide-interval areas, like the rr3 treatment) — a new construct class
  beside census affiliation and institutional adherence.
- **Aggregation level is an analytic choice** (country, region, or
  model-based small-area estimates), made in the research tier and
  documented in the manifest, not improvised at the map layer.

## Design (proposed 2026-07-07)

### 1. Config shape: `overlays`, with a legacy shim

`REGION_CONFIG.overlays` maps domain id to a domain block that carries
what today sits at the top level for religion:

```js
overlays: {
  religion: {
    label: "Religion",
    levels: { adm1: {...}, adm2: {...} },   // today's censusLevels shape
    defaultLevel: "adm1",
    defaultMetric: "religious_affiliation_percent",
    defaultYear: 2020,
    timeline: [...],                         // optional, per domain
    metricLabels: {...}, metricsAvailable: [...]  // optional overrides
  },
  language: { label: "Language", levels: {...}, ... }
}
```

When `overlays` is absent, the runtime builds a single religion domain
from the legacy keys (`censusLevels`, `defaultLevel`, `defaultMetric`,
`defaultYear`, `timeline`, `metricLabels`, `metricsAvailable`). No
existing country page changes until it gains a second domain; the shim
is permanent, not a migration deadline.

### 2. Products: one per domain × level; metrics defined in the product

Each domain level points at its own governed area-summary product
(`area_summary_<level>_<domain>.json`; the religion products keep their
current names via the shim). The area-summary schema already carries an
`indicators` registry (id, label, description, unit,
denominator_indicator_id, method, quality_notes) that the runtime
currently ignores in favour of a hardcoded religion metric table. The
multi-domain runtime reads metric definitions from the product's
indicators block: label and note from the registry, formatting from
`unit` (percent → one-decimal %, count → integer, rate → per-unit
decimal), ramp kind from a new optional `kind` field (`seq` default,
`div` for signed change metrics). The hardcoded religion table remains
as the fallback for existing products, so nothing rebuilds. One source
of truth per product keeps metric wording under the same governance as
the data it describes.

The schema gains two optional fields, no version break: top-level
`domain` (default `"religion"`) and per-indicator `kind`. A product
whose domain field disagrees with the config slot that loads it fails
loudly at load.

### 3. Panel: a domain select, only when there is a choice

The census panel gains a domain `<select>` as its first control,
rendered only when the page declares two or more domains. Single-domain
pages (all six today) see no change. Switching domain swaps the metric
and level selects to that domain's sets, keeps the panel open, and
repaints. Cross-domain comparison stays out of the map: it is research
portal work (small multiples or side-by-side), out of scope here by
principle 1.

### 4. Dots are religion furniture (principle 4, made concrete)

When the active domain is not religion, the place-dot layers and the
Points row hide, and the dot-era legend note drops; the user's Points
mode and later-foundations choice are remembered and restored when
religion returns. No "summon dots anyway" affordance in the first
build — if a real use case appears, it earns one then.

### 5. One timeline, per-domain year sets

The slider rebuilds from the active domain's year set (its timeline
config, else the active level's years). On domain switch the year
carries over when the target domain has data for it; otherwise it snaps
to the nearest target year. The interim place-dot honesty rule keys on
the selected year exactly as now, but only while religion is active.

### 6. Survey estimates: the third construct class

Domains whose product derives from individual-level survey data (the
Global Flourishing Study is the named case) declare
`construct: "survey_estimate"` in the domain block, and their products
carry per-row interval fields (`<metric>_ci_low`, `<metric>_ci_high`)
plus an `estimate_basis` note naming the aggregation ruling (country,
region, or small-area model — decided in the research tier, recorded in
the manifest). The runtime then: shows the interval beside the value in
popups; washes areas whose interval width exceeds the metric's
declared `wide_interval_threshold` (the rr3 wash treatment, reused);
and appends the domain's basis note to the legend. Microdata never
enters the public tier — products carry derived estimates only, per
source ruling.

### 7. Popups: one table per domain

The area popup renders the active domain's table expanded, other
loaded domains as collapsed rows the user can open (details/summary),
and unloaded domains not at all — no fetch on popup open. Each domain
table keeps its own denominator note; credits list once per popup.

## Rollout

1. **Phase 1 — runtime generalisation (no visible change).** Introduce
   the domain model behind the legacy shim; all six countries render
   identically (verify NZ and BR before/after). My implementation,
   Opus verifies.
2. **Phase 2 — VU language pilot (Guy's tables).** Language domain on
   the VU page from Guy's language-by-area tables, through the research
   tier to `area_summary_adm1_language.json` (+ adm2 where the tables
   support it): domain select appears, dots-hide rule and popup domain
   tables ship. The pilot proves the config, product, and panel
   decisions on real data before any other domain is built.
3. **Phase 3 — survey construct (GFS reference case).** Country-level
   GFS estimates through the research tier with a per-source ruling,
   landing the interval presentation and wash treatment. Blocked on
   the ruling and on the research-tier extraction, not on runtime work.

Acceptance for every phase: attribution visible per domain source,
construct honesty in every label and note, manifests per product, and
no behaviour change for countries that have not opted in.

Related: docs/development/temporal-place-layer.md,
docs/development/adding-a-region.md, the ranked build queue.
