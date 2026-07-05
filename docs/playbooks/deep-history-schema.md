# Playbook: deep-history evidence contract

Status: READY (not started)
Task: #7. Effort: one sitting, design + schema files, no UI.

## Goal

Extend the project's data contracts so RA-supplied deep-history evidence
— location and attributes of historic and present places of faith, often
from sources that are NOT online — validates, stages, and replays through
the existing pipeline. Design only what the contracts need; the portal UI
consumes this later (`free-contribution-portal.md`).

## Context the executor must internalise

- `schemas/change-event.schema.json` is the governed contract. Existing
  `payload_type` values: site_created, structure_created, status_update,
  name_update, denomination_update, geometry_update, site_relocation,
  worship_function_update, organisation_link_update, duplicate_resolution,
  proposal_state. `event_type` discriminates payload and `event_intent`
  via top-level allOf; `taxonomy_version` is required for any
  denomination-bearing payload; bitemporal replay rule is stated in the
  descriptions. Follow these idioms exactly.
- Standing rulings live in `DECISIONS.md` — check before changing any
  identity, taxonomy, or event-contract behaviour. `site_id` tracks the
  mappable place; relocations create a new site linked by a relocation
  event. Accepted diffs are the longitudinal data.
- The workbench's TypeScript mirror of the evidence model is
  `apps/workbench/src/data/types.ts` (BoundedDate, LifecycleClaim,
  SourceRecord, LocationEvidence, SiteAttributes). It was written to
  anticipate this schema work; treat it as a draft to align with, not
  authority.
- RA evidence templates: `docs/templates/ra-historical-site-evidence/`
  already have bounded origin/closure dates and historical-address and
  geocoding-basis fields.

## Design decisions already taken (do not reopen)

1. **Bounded dates everywhere a source may only bracket an event**:
   `{value?, not_earlier_than?, not_later_than?}`, each `YYYY`,
   `YYYY-MM`, or `YYYY-MM-DD`. Blank means unknown; no placeholders.
2. **Offline sources are first-class.** A source reference must validate
   with NO url: require a title plus at least one of url or
   `archive_ref` {repository_name, collection, item_ref?, consulted_date,
   location?}. Photographs of documents are media evidence attached to
   the source, subject to the media quarantine rules in
   `docs/portal-media-and-provider-evaluation-plan.md`.
3. **Fuzzy placement is data, not failure.** Location claims carry
   `geocoding_basis` (exact_address | historical_address_matched |
   described_locality | map_georeference | regional_only | unknown) and
   an optional containing-area reference instead of coordinates when the
   source only supports a region.
4. **Cultural sensitivity is a flag with consequences**: a
   `culturally_sensitive` boolean plus free-text basis on site-level
   claims (kastom sites, urupā, etc.); sensitive records may enter
   staging but must not reach public map products until a reviewer
   explicitly clears display. Enforce in `pow` export checks, not just UI.
5. **Lifecycle floor per country config** (VU accepts from 1600); the
   schema itself takes any Gregorian date — floors are validation
   context, not schema constants.

## Steps

1. Read `schemas/change-event.schema.json`, `site.schema.json`,
   `structure.schema.json`, `DECISIONS.md`, and the RA template README in
   full.
2. Add `$defs` for `BoundedDate`, `ArchiveRef`, and `SourceReference`
   (title + url-or-archive_ref rule) to `change-event.schema.json`, or a
   new `schemas/evidence-source.schema.json` if the defs are shared more
   widely — prefer whichever the existing cross-referencing style uses
   (site/structure already share Status via `$defs`).
3. Add payload types, following the existing if/then discrimination
   pattern, each with fixtures:
   - `attribute_update` (building material, capacity, architecture
     notes, name history entries — the SiteAttributes surface),
   - `lifecycle_claim` (event kind from: founding, opening, first_seen,
     last_seen, closure, demolition, change_of_use, rebuild — relocation
     and denomination changes stay in their existing payloads; bounded
     date; confidence; source references),
   - extend site-level payloads with `culturally_sensitive` +
     `sensitivity_basis`.
   Where an existing payload already covers a concept (name_update,
   worship_function_update), extend it rather than duplicating.
4. Update `pow` (Rust) validation to accept the new payloads: schema
   validation is data-driven, but add the cross-field checks — bounded
   date ordering (not_earlier ≤ value ≤ not_later), source rule,
   sensitivity export gate. Add CLI test fixtures mirroring the JSON
   fixtures. `cargo fmt --all && cargo test && cargo clippy --all-targets
   -- -D warnings`.
5. Align `apps/workbench/src/data/types.ts` field names with the final
   schema names (snake_case in schema, camelCase in TS is fine — the
   adapter maps; but semantics and enums must match). `npm run typecheck`
   in `apps/workbench/`.
6. Record the contract decisions in `JOURNAL.md` (public register) and
   add a `DECISIONS.md` entry for the offline-source rule and the
   sensitivity export gate.

## Acceptance checks

- New fixtures validate; a fixture with url-less archive source passes;
  a source with neither url nor archive_ref fails; an inverted bounded
  date fails; a sensitive site_created fixture is blocked at export
  without reviewer clearance.
- No existing fixture or test breaks. Workbench typechecks.

## Out of scope

Convex schema changes, portal UI, media upload implementation.
