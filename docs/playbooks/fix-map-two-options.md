# Playbook: fix-map with two routes (OSM and RA workbench)

Status: READY (not started)
Task: #9. Effort: small; one sitting.

## Goal

On the map sites, the "fix map" affordance offers two routes: fix in
OpenStreetMap (current behaviour, public contributors) and open the
Research Workbench (RAs reach their work from the main map). JB
direction 2026-07-04.

## Where the change lives

- Country maps: ONE place — `apps/regions/_shared/region-map.js`
  (wordmark pill; the existing `fixmap-link` id opens the OSM editor at
  the current view, desktop only). Config gains an optional
  `workbenchHref` in `REGION_CONFIG`; when present the module renders
  the second entry. NZ/VU configs set it (relative
  `../../workbench/` once the built workbench is published; until then
  point at the repo path only if JB has published it — see Guardrails).
- Global map: `apps/global/` has its own wordmark; mirror the same
  two-entry pattern there.
- Onboarding copy: NZ config's "How to fix data" link stays; add a line
  in the RA-facing docs, not the public card.

## Presentation

Keep the wordmark pill compact: `fix map` becomes two adjacent entries
`fix map (OSM)` · `RA workbench` (shell-divided idiom), or a single
entry opening a two-option chooser if width at 375px demands it — test
both; pick whichever keeps the pill on one line on phones (note the
wordmark hides on phones on the global map; country maps may differ —
verify actual behaviour before deciding).

## Guardrails

- The workbench is demo-mode (localStorage) until its Convex binding is
  deployed. Do NOT link it from public maps before JB confirms either
  (a) demo-mode linking is acceptable with the demo banner, or (b) the
  link waits for the authenticated portal. Ask; do not assume.
- `verification.html`/`review.html` are untouched; this is not a
  replacement for their entry points.
- The workbench is a Vite app: publishing it on placesmap.org requires
  committing `dist/` or a CI build (see `apps/workbench/README.md`) —
  that publish decision is JB's and is a precondition of this playbook.

## Steps

1. Confirm preconditions with JB (workbench published? demo linking?).
2. Add `workbenchHref` to the shared module + configs; mirror on global.
3. Verify in browser at 1280px and 375px on NZ, VU, global: both routes
   work, pill fits, no console errors. The parity concern from the
   migration does not apply (this is a deliberate shared change), but
   re-check one full-data and one pending country after editing the
   shared module.
4. Update `docs/development/adding-a-region.md` config-surface list and
   `docs/ui-style-guide.md` if new wording is introduced. Changelog,
   commit, push.
