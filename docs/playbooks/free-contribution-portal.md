# Playbook: free-contribution portal (RAs add, not only review)

Status: BUILD VERIFIED IN BROWSER (agent verification, 2026-07-07); all acceptance checks pass. Publication and Convex binding remain JB-gated.
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

## Verification notes (agent browser verification, 2026-07-07)

All acceptance checks passed against the build at commit 7d24426, on a
live Vite preview (port 5176, portal-workbench worktree):

- Place-first (NZ): nomination created with candidate id
  `candidate:nz:<ulid>`, saved as draft, listed in My work.
- Dedup: candidates render under "Is it one of these?"; a
  high-confidence name match disables `Continue as new nomination`
  until a reason is entered; low-confidence matches require no reason.
- Source-first offline: a source with no URL validates via archive
  reference (repository, collection, consulted date); a claim with no
  coordinates and `regional_only` basis plus a containing area submits
  cleanly. This was the key check.
- VU kastom prompt: the sensitivity question is the first and only
  screen of place-first entry; location fields are not rendered until
  it is answered, and `validateForSubmit` independently blocks
  submission. Hardening applied after verification: the gate's
  onChange previously accepted a synthetic change event carrying the
  empty placeholder value (not reachable by real interaction); it now
  ignores the placeholder (`FreeContributionPortal.tsx`). Re-verified
  both ways in the browser.
- Submitted records are read-only (all inputs disabled, revision
  notice shown); statuses observed match the style-guide list; no
  "Add to map" wording in the DOM or `src`.
- Boundary: only localhost Vite asset requests in the network log; the
  sole persistence call in `src` is localStorage in `demoProvider.ts`;
  no fetch/XHR/WebSocket usage anywhere in the app; console clean.

Known limits parked for later sittings: the My work sidebar list is
display-only (no click-through to a detail route), and the
agent-assisted extraction workspace exists behind the provider surface
with seeded demo drafts but has not yet had a dedicated verification
pass of its confirm/reject/submit gating in the browser.

Publication, Convex binding, and invites are prepared as deliberate
JB steps in `docs/development/workbench-publication-plan.md`.
