# Multi-domain overlays without clutter — design brief

Status: EARLY PRIORITY at handover (JB, 2026-07-07). Fable-level design
task: develop before demographic, economic, language, and other
cultural overlays are built, not after.

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

## To decide during design

- Config shape and area_summary versioning for multi-domain products.
- Whether domains share the census panel or earn a domain switcher pill.
- Small-multiples/compare mode for the research portal (out of map scope?).
- How Guy's VU language-by-AC tables land as the second domain (the
  pilot case: religion + language on the same page).

Related: docs/development/temporal-place-layer.md,
docs/development/adding-a-region.md, the ranked build queue.
