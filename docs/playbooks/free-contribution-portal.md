# Playbook: free-contribution portal (RAs add, not only review)

Status: BUILD SITTING IMPLEMENTED; awaiting maintainer browser verification and commit.
Task: #10. Effort: one design sitting + one build sitting.

## Goal

Extend the Research Workbench (`apps/workbench/`) so an RA can freely
ADD information about places of faith — new sites, sources, attributes,
lifecycle claims — without an assigned task, from any source including
offline archives. JB direction 2026-07-04. The review boundary is
untouched: everything an RA adds is a provisional claim
(`Nominate missing PoW` wording, never `Add to map`) that flows through
reviewer acceptance and `pow` before any public product.

## Design constraints (already decided)

- Strict TypeScript; all data access through
  `apps/workbench/src/data/provider.ts` — extend `WorkbenchProvider`,
  implement in `DemoProvider` first; Convex binding is a separate,
  deliberate step gated on JB.
- UI wording, colours, button hierarchy, controlled-vocabulary
  dropdowns: `docs/ui-style-guide.md`. Dense workbench, not a landing
  page; 44px touch targets; NZ English.
- Country configs (`src/config/*.ts`) drive target years, lifecycle
  floor, sensitivity prompt. VU kastom prompt must appear before
  location entry on free additions too.
- Offline sources: source entry must validate with no URL (archive
  repository, collection, item reference, consulted date) per the
  deep-history schema. A "source-first" record with no coordinates and
  `geocoding_basis: regional_only` is a legitimate complete submission.

## Shape of the feature (design sitting deliverable)

Write `docs/portal-free-contribution-design.md` covering:

1. **Entry points**: a "Nominate missing PoW" button in the workbench
   sidebar (always visible), plus the map route created by
   `fix-map-two-options.md`.
2. **Two flows**: (a) *place-first* — RA knows a place: minimal identity
   (name, locality or map point, denomination guess) then evidence; (b)
   *source-first* — RA holds a source: source record first, then any
   number of site claims extracted from it (one source, many places —
   this matches archival workflow).
3. **Dedup assistance, not enforcement**: before creating, query
   existing sites near the point/name and show candidates ("is it one of
   these?"); choosing a candidate turns the contribution into evidence
   against that site rather than a new nomination.
4. **Provisional identity**: client-generated candidate ids; durable
   `site_id` is assigned only at acceptance (FAQ identity rules).
5. **State model**: draft → submitted for review → (accepted for export
   | changes requested | rejected); unresolved-note path preserved.
6. **What Convex needs later**: a `nominations`/free-evidence table
   mirroring assigned-task evidence, same role gates and field-size
   limits as existing mutations — spec only, no deployment.

## Build sitting

1. Implement both flows in the workbench against `DemoProvider`
   (localStorage), reusing `EvidenceForm` sections (sources, lifecycle,
   attributes, location) — factor them for reuse rather than duplicating.
2. `npm run build` clean; verify in browser: create place-first and
   source-first records in NZ and VU (kastom prompt enforced), dedup
   candidates appear, My work lists them, submitted records read-only.
3. Changelog, commit, push. Do not deploy Convex; do not link from the
   live maps until JB reviews (the fix-map playbook links to the
   workbench generally, which is acceptable in demo mode only if JB has
   approved that ordering — check with JB if unclear).

## Acceptance checks

- A complete source-first submission with an offline archive source and
  no coordinates passes validation.
- Nothing in the flow writes outside localStorage in demo mode.
- Wording audit: no "Add to map" anywhere; statuses match the style
  guide list.
