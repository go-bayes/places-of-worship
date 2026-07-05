# Playbook: MANIFEST.md and country-docs architecture

Status: READY (run last, after other playbooks land)
Tasks: #1, #4, #8. Effort: one sitting, documentation only.

## Part 1 — MANIFEST.md (current-state inventory)

The changelog answers "what happened"; nothing answers "what exists
right now". Create root `MANIFEST.md`:

- **Live surfaces**: global map, NZ/VU research maps (shared runtime,
  thin configs), NZ/VU verification + review portals (live RA surfaces —
  protected), Data maps hub, Research Workbench (demo mode, unpublished
  unless that changed).
- **Data products**: per country, each governed product with its
  manifest link (NZ ta/sa2 summaries; VU adm1/adm2 summaries +
  vu-census-religion manifest; place layers/tiles).
- **Backends**: Convex task layer (roles, live batches), `pow` CLI
  (validate/stage/propose/diff).
- **Contracts**: one line per schema in `schemas/`.
- **Doc set**: one line per governance doc, marking ACTIVE / HISTORICAL
  / COMPLETED (several docs already carry these statuses — mirror them,
  don't re-adjudicate).

One line per item: what it is, where, status, owner-doc link. No
content duplication — links only. Statuses must be verified against the
working tree, not copied from this playbook.

Wire it in: add to `AGENTS.md` Where To Look (top), README maintainer
references, and `docs/documentation-health-check.md` as a per-session
staleness check ("does MANIFEST.md still describe what exists?").

## Part 2 — country-docs architecture (#4)

Mostly exists; finish and document the pattern in
`docs/development/adding-a-region.md` (extend, don't fork a new doc):

- `research/countries/<iso2>-<name>.md` — build card (TEMPLATE.md
  governs headings; survey playbook fills them).
- `research/country-survey.md` — global matrix (from survey playbook).
- `apps/regions/<cc>/` — page + data products;
  `docs/manifests/` — data manifests.
- State the lifecycle: card (survey) → data products + manifest →
  region page → hub/README links → MANIFEST.md row.

## Part 3 — governance wrap (#8)

- `JOURNAL.md`: one entry covering the 2026-07-04 overnight session:
  shared-runtime unification (why one module; parity method), VU census
  extraction (source perturbation finding; derived-province decision;
  licence position awaiting JB), workbench start (provider-interface
  boundary), playbook-driven execution model (Fable plans, cheap
  executors). Public register tone.
- `FAQ.md`: add entries if the session's decisions clarify durable
  behaviour (e.g. "why does the VU map show ±1–2 inconsistencies?").
- `PLANNING.md`: refresh the near-horizon list to point at
  `docs/playbooks/`.
- Run `docs/documentation-health-check.md` once across README/ROADMAP/
  PLANNING/FAQ/AGENTS for drift introduced by the session.
- Changelog, commit, push.
