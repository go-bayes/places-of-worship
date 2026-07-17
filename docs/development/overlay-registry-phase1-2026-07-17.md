# Overlay registry, phase 1 — implementation record

Opened 2026-07-17 (JB selected the lane this sitting; the design it
builds is docs/development/multi-domain-overlay-design.md, 2026-07-07,
with the sidebar note of 2026-07-16). Phase 1 is runtime
generalisation behind the permanent legacy shim: all 100 pages render
identically, and the machinery for a second domain exists end to end.

## What phase 1 builds

1. **Domain registry.** `OVERLAY_DOMAINS` normalised at startup: from
   `RC.overlays` when present, else a single `religion` domain built
   from the legacy keys (`censusLevels`, `defaultLevel`,
   `defaultMetric`, `defaultYear`, `timeline`, `metricLabels`,
   `metricsAvailable`). The shim is permanent; no page migrates.
2. **Domain-scoped constants.** `CENSUS_LEVELS`, `CENSUS_METRICS`,
   `CENSUS_TIMELINE`, and the `censusState` defaults derive from the
   active domain block instead of top-level `RC`. Under the shim the
   derived values are identical, so every downstream reader is
   untouched.
3. **Domain switching.** `setOverlayDomain(id)` rebinds the domain
   constants, snaps level/metric/year to the target domain's defaults
   (year carries over when the target has it, per design §5), clears
   and reloads the level store, and repaints. `censusState.domain`
   joins the state.
4. **Domain select.** Rendered as the first control in the census
   panel ONLY when the page declares two or more domains (design §3).
   Single-domain pages — all 100 — see no control and no change.
5. **Dots rule.** `syncPlaceDotEra` gains the domain gate: place dots
   and the Points row show only while the religion domain is active
   (design §4); the Points mode is remembered and restored. Under the
   shim the religion domain is always active, so nothing changes.
6. **Product domain check.** A loaded area summary whose top-level
   `domain` field disagrees with the config slot that loads it fails
   loudly (console error, level renders pending) — design §2.

## Deferred within the design, with reasons

- **Product-indicators metric definitions** (design §2's registry
  read): deferred to a `metricsFromProduct: true` domain flag that
  only non-legacy domain blocks may set. Existing products already
  carry `indicators` blocks whose labels differ from the runtime's
  table in places; switching the source of truth silently would
  change visible labels on some pages and violate phase 1's
  no-visible-change acceptance. New domains (the VU language pilot)
  set the flag from day one.
- **Per-domain popup tables** (design §7): built when a second domain
  first ships (phase 2); the single-domain popup is already the
  active-domain table.
- **Survey construct class** (design §6): phase 3, blocked on the GFS
  ruling.

## Acceptance

Phase 1 ships only when representative pages render identically
before and after: NZ (multi-level timeline, diverging metric, dated
places), US (six county vintages on RC.timeline), VU (pulotu second
source beside the domain machinery, five denomination shares), VC
(share-only metrics), BT (place_count), NO (counts-only opt-in), plus
a console-clean check. The pulotu source select stays a data-source
switch inside the religion domain — it is not a domain and does not
migrate in phase 1.

## Rollout position

Phase 2 (VU language pilot) waits on Guy's language tables through
the research tier. Phase 3 (survey construct) waits on the GFS
ruling. This record supersedes nothing; the 2026-07-07 design remains
the binding spec.
