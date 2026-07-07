# Research Workbench

The strict-TypeScript RA ingestion app for places-of-faith evidence:
location and attributes of historic and present places of worship,
feeding the deep-history programme. React + Vite, with the
[UI style guide](../../docs/ui-style-guide.md) wording, colour meanings,
and form conventions.

## Status

Demo mode only. Work saves to the browser's localStorage through
`DemoProvider`; nothing reaches the shared Convex backend, the master
data, or the public map. The existing NZ/VU verification and review
pages remain the live RA surfaces.

## Design

- Every screen talks to `src/data/provider.ts` (`WorkbenchProvider`),
  never to a backend directly. A future `ConvexProvider` binds the same
  interface to the shared task backend behind the project's auth,
  role, and export boundaries.
- Country specifics are declarative: `src/config/nz.ts`, `src/config/vu.ts`.
  A new country is a config file (target years, lifecycle floor,
  guidance, suggested sources, sensitivity prompt), not a fork.
- The evidence model (`src/data/types.ts`) is a superset of the pilot's
  `site_evidence_wide` row: target-year statuses, existence and
  worship-use status (including `No building present` normalisation),
  confidences, location evidence with geocoding basis, place attributes,
  bounded lifecycle claims, and per-source provenance.

## Commands

```sh
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build to dist/
npm run typecheck
```

## Deploying (deliberate step, not automatic)

The repo deploys static files from `main`. To publish the workbench,
build locally and commit `dist/` (or add a CI build) — a decision for
JB, recorded here so the demo surface cannot drift onto placesmap.org
by accident. Connecting `ConvexProvider` to the hosted deployment is a
separate deliberate step with its own review. The prepared step-by-step
plan for both, with the JB decision checklist, is
[docs/development/workbench-publication-plan.md](../../docs/development/workbench-publication-plan.md).
