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

- `research/countries/<iso2>/README.md` — build card (TEMPLATE.md
  governs headings; survey playbook fills them).
- `research/country-survey.md` — global matrix (from survey playbook).
- `apps/regions/<cc>/` — page + data products;
  `docs/manifests/` — data manifests.
- State the lifecycle: card (survey) → data products + manifest →
  region page → hub/README links → MANIFEST.md row.

## Part 2b — audience re-organisation (JB, 2026-07-07)

`docs/people/{ra,jw,guy}/README.md` exist as entry points with the
public/private rule in `docs/people/README.md` (private = `.private/`
via private-sync, never git). Finish the job here:

- MOVE the RA-facing documents into `docs/people/ra/`
  (`ra-nz-pilot-task.md`, `ra-map-triage-guide.md`) and fix every
  inbound link (README, AGENTS.md, FAQ, templates, verification-page
  copy if any). Keep redirects-by-stub only if an external link is
  known to exist.
- Sweep the tracked tree for privacy-rule violations: personal emails,
  phone numbers, per-person assignment tracking, credentials. Move
  content to `.private/` and scrub git history ONLY if JB approves a
  history rewrite (otherwise note the exposure and rotate the secret).
- Audit `docs/` top level: each file gets an audience tag line at the
  top (RA / JW / collaborator / maintainer / agent) or moves under its
  audience directory; MANIFEST.md records the audience per doc.

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
