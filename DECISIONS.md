# Decisions — revisions pipeline

Adjudicated: 2026-06-12.
Inputs: [CRITIQUE.md](CRITIQUE.md) (2026-05-02), [PLANNING.md](PLANNING.md)
(state of 14 May 2026), `schemas/`, `crates/pow-cli`, and the RA evidence
templates under `docs/templates/ra-historical-site-evidence/`.

This register records the standing ruling for each design decision the
revisions pipeline depends on: what we decided, why, what the ruling
forecloses, and what it would cost to reverse. `JOURNAL.md` records dated
narrative; this file records current rulings. When a ruling changes, update
the entry here and add a journal entry explaining the change.

Status labels: **Ratified** — already designed or implemented, confirmed
here. **Amended** — confirmed with a change, either to a contract file
shipped with this register or to the recommendation being adjudicated.
**New** — decided here for the first time. **Sequencing** — order-of-work
only, cheap to revisit.

Several rulings ratify designs that moved from CRITIQUE.md into
`schemas/change-event.schema.json`, `schemas/geometry-history.schema.json`,
and `crates/pow-cli` after the critique landed. Ratification still does
work: it converts implementation facts into commitments with named
reversal costs.

## D1. Site identity across location change

**Ruling.** `site_id` names the mappable place. Geometry refinement, address
renumbering, and demolition-with-rebuild under continuous worship use keep
the `site_id` and append a geometry-history state. A congregation that moves
to a materially different place closes worship use at the origin site and
receives a new `site_id` at the destination, linked by a `site_relocated`
event and a `successor_of` relation; organisation links carry the
continuity of the worshipping community. Ambiguous cases route to review
with `identity_rule_applied = uncertain_requires_review`; reviewers must
not be forced into a same-site or new-site call the evidence cannot support.

**Rationale.** The two failure modes pull in opposite directions: one
`site_id` per congregation breaks "what stood at this point in 1981?"
lookups; one `site_id` per coordinate breaks congregation histories. Tying
identity to the mappable place serves the spatial questions (counts and
densities at dates), while relocation events and organisation links carry
community continuity explicitly rather than by overloading the key.

**Forecloses.** Congregation-level longitudinal series keyed on `site_id`
alone — community continuity must be derived through organisation links and
relocation chains. Also forecloses any later redefinition of `site_id` as
the congregation.

**Cost to reverse.** Irreversible in practice once events are accepted:
re-keying identity rewrites every snapshot, area assignment, density
series, and published citation. Staged events carry no such cost, which is
why ambiguity routes to review before acceptance.

**Status.** Ratified (PLANNING.md "Decided: identity on relocation and
geometry correction"; `geometry-history.schema.json` `identity_rule_applied`;
`RelocationPayload` in the change-event schema).

## D2. Denomination taxonomy as a versioned artefact

**Ruling.** The controlled vocabulary moves out of
`apps/regions/nz/js/denomination-mapper.js` into
[schemas/denomination-taxonomy.json](schemas/denomination-taxonomy.json), a
versioned instance validated by
[schemas/denomination-taxonomy.schema.json](schemas/denomination-taxonomy.schema.json).
Codes are dotted and hierarchical (`christian.anglican`), with the religion
segment drawn from OSM `religion=*` values. Entries carry locale labels
(English, plus te reo Māori where attested), `osm_aliases` for raw source
strings, supersession links (`merged_into`, `split_into`, `renamed_to`) with
effective dates, and a document-level `unresolved_aliases` list for strings
whose placement needs review. The JavaScript mapper becomes a derived
consumer; generating it from the taxonomy is follow-up work.

**Rationale.** A Rust CLI cannot validate submissions against a JavaScript
class, and the mapper already disagrees with itself: it lists
`Latter-day Saints` under Christian and `latter-day_saints` under Other
Religions, so the same denomination string in different case yields
different categories. Bare codes also collide across religions: `orthodox`
names both Eastern Orthodox Christianity and Orthodox Judaism in OSM
tagging. The dotted prefix removes the collision and makes codes
self-describing in event payloads.

**Forecloses.** Free-text denominations in accepted events; per-app
vocabularies; bare single-segment codes in payloads. The bare codes in
`docs/examples/revisions/` and the `pow-cli` test fixtures become migration
debt to clear before taxonomy-membership validation (D9 gate 6) is
enforced.

**Cost to reverse.** Renaming a code later is cheap — supersession entries
exist for exactly that purpose. Changing the code shape after events
accumulate would require rewriting accepted events, which D14 forbids; the
shape decision is effectively one-shot, which is why it is taken now while
the accepted event log is still empty.

**Status.** Amended — both files ship with this register; classification of
contested entries (Rātana, Latter-day Saints, Jehovah's Witnesses,
Christian Science, Iglesia ni Cristo) follows the Stats NZ standard
classification of religious affiliation and is flagged for project review
in the instance notes.

## D3. Bitemporal event contract

**Ruling.** Every event carries two clocks: `effective` (when the world
changed or the corrected fact became true; exact or bounded, with precision
and basis) and `recorded_at` (UTC system time when the project logged the
event; never backdated). The replay rule: the snapshot for date S as
publishable at audit time T replays accepted events with effective time ≤ S
and `recorded_at` ≤ T. Bounded effective times order by their latest
admissible date: an event certainly in place by S (`not_later_than` ≤ S)
replays into S, while bounds that straddle S contribute uncertainty, not
state. Current products use T = now; published artefacts pin T and
source-dataset versions in their run manifests.

**Rationale.** The project's research contract is reproducible annual
snapshots. After a 2027 correction to a 1981 fact, the project must produce
both the corrected 1981 snapshot and the 1981 snapshot as it was published
in 2026 — the first for analysis, the second for audit. Two clocks are the
minimum structure that supports both queries.

**Forecloses.** Single-timestamp logs; in-place row edits; any consumer
that conflates when the world changed with when the project learnt of it.

**Cost to reverse.** Keeping the contract costs one timestamp per event.
Dropping `recorded_at` is unrecoverable in reverse: provenance never
recorded cannot be reconstructed, and the reproducibility contract fails at
the first retroactive correction.

**Status.** Amended — implemented in `change-event.schema.json`; the schema
descriptions shipped with this register now state the replay rule and the
no-backdating constraint.

## D4. Corrections are not changes

**Ruling.** Keep the implemented `event_intent` axis (`correction`,
`observed_change`, `lifecycle`, `evidence_observation`, `review_state`) and
the paired event types (`site_location_corrected` vs `site_relocated`;
`denomination_corrected` vs `denomination_changed`). Replay semantics: a
correction rewrites the corrected fact across its whole effective validity;
observed changes and lifecycle events apply from their effective date
forward. Intake surfaces (the Convex evidence form and the spreadsheet
template) must force the contributor to choose; the schema already rejects
events whose type and intent disagree.

**Rationale.** A relocation in 1987 must not rewrite the 1981 snapshot; a
correction to a wrongly recorded 1981 location must. Collapsing the two
poisons every historical series the pipeline exists to produce. The RA
templates already separate observations from conclusions; the event types
carry that separation into the log.

**Forecloses.** A generic `update` event; retroactive snapshot drift from
world changes; intake forms that leave intent implicit.

**Cost to reverse.** Coarsening later (merging the pair into one type) is
mechanical but destroys information. Refining later (splitting a collapsed
type) requires re-reviewing every collapsed event against sources —
prohibitive at any realistic volume. The asymmetry decides the timing.

**Status.** Ratified (implemented, including the schema `allOf` bindings
between event types and intents).

## D5. Snapshots are caches, not records

**Ruling.** `site_snapshot` rows are derived by `pow rebuild-master`
replaying accepted events against pinned source-dataset versions. No other
writer exists: not the CLI's other verbs, not Convex, not scripts, not
manual edits. Accepted corrections trigger regeneration of every affected
year, and each regenerated artefact carries a data manifest.

**Rationale.** A mutable snapshot is the path to silent provenance loss:
the row changes, nothing records why, and the replay test can no longer
distinguish drift from correction. Deriving snapshots from the log makes
the log the single point of truth and the snapshot disposable.

**Forecloses.** Hot-fixing published rows; using snapshot tables as a
working surface; any tooling shortcut that writes a snapshot directly.

**Cost to reverse.** Keeping the rule costs nothing beyond rebuild time. A
single direct write is silent provenance loss, detectable afterwards only
as a replay mismatch (D15) and not attributable once found.

**Status.** Ratified. Enforcement (CLI refusal plus a replay check in CI)
is tracked as `pow` work.

## D6. Intake boundary and first deliverable

**Ruling.** The governed boundary is the `pow` CLI and its verb set
(`validate`, `stage`, `propose`, `diff`, `accept`, `rebuild-master`,
`export`), treated as a stable contract. One amendment to CRITIQUE.md,
which named RA spreadsheets as the first input surface: since May the
primary RA entry surface is the Convex task layer, with spreadsheets as
fallback and interchange. The boundary is unchanged — Convex exports frozen
evidence batches that enter `pow validate`, and Convex never writes the
master or public products. The authenticated portal write path stays
deferred.

**Rationale.** The contract that needs to hold for research integrity is
the validation/staging/replay path, not the entry surface. Convex solved a
real coordination need (live multi-user task state) without touching the
boundary; the CLI remains the only door to the master.

**Forecloses.** Portal-first construction; any architecture where a live
backend mutates the master; treating Convex as the canonical database.

**Cost to reverse.** Low. Under any future portal, the backend reuses the
same validation and staging rules; investment in the CLI carries over
whole.

**Status.** Amended — the boundary CRITIQUE.md argued for stands as built;
its spreadsheet-first intake detail is overtaken by the Convex pilot.

## D7. Staging substrate

**Ruling.** SQLite at `.pow/staging.sqlite` for staging. Add SpatiaLite
only when a staging-side spatial predicate is actually needed — the D9
distance checks can use a haversine computation in Rust without it. The
durable event log is JSONL/GeoParquet artefacts with manifests in
project-controlled storage; raw snapshots are JSON. PostGIS waits until a
live spatial query requirement exists, which is portal-era.

**Rationale.** The first milestone validates and diffs small staged
batches from CSV and Convex exports. PostGIS on day one buys operational
cost without a query to serve. The logical schemas are shared with the
eventual PostGIS backend, so the substrate is an implementation detail of
the milestone, not an architecture commitment.

**Forecloses.** Nothing structural.

**Cost to reverse.** Low by construction: D15 makes any future substrate a
replay target rather than a migration problem — stand up the new store and
replay the accepted log into it.

**Status.** Ratified (implemented).

## D8. Diff and dry-run are the leverage point

**Ruling.** Reviewer leverage concentrates in `pow diff`. The v1 scope is
ratified: per-site changesets, per-target-year transitions, validation
warnings, and source coverage, in Markdown for reviewers and JSON for
downstream R work. Full before/after reconstruction, `area_summary_diff`,
and density consequences belong to `pow rebuild-master` and the export
layer, because they require replaying accepted events into complete
snapshots. Reviewer-facing count deltas of the form "accepting this batch
changes the 1981 Anglican count from 412 to 411" arrive with the replay
milestone, not diff v1. Engineering budget goes to the diff and replay
surfaces before intake polish.

**Rationale.** A reviewer who can see consequences decides in seconds;
a reviewer who sees raw rows re-derives the pipeline by hand. Most of the
pipeline's value to a small review team lives in this surface, and the
machine-readable artefact lets the replay layer reuse the same event
interpretation rather than re-implementing it.

**Forecloses.** Diff growing into a state reconstructor; near-term
investment in submission-form refinement.

**Cost to reverse.** Trivial — a prioritisation, revisited at the replay
milestone.

**Status.** Ratified (diff v1 implemented in `pow-cli`).

## D9. Day-one validation gates

**Ruling.** Seven gates at `pow validate`/`stage`, none waived:

1. **Schema** — JSON Schema per event type, versioned with the event.
2. **Geometry plausibility** — WGS84 ranges, point within the declared
   `country_code`, plausible distance from prior geometry on relocation.
3. **Date plausibility** — `valid_from <= valid_to`; no future effective
   dates for completed events; effective dates within the source's known
   coverage.
4. **Identity collision** — a proposed new site within 50 m of an existing
   site is flagged duplicate-risk and routed to review. The 50 m default is
   country-configurable; the gate only ever flags — no auto-merge, no
   auto-reject.
5. **Source presence** — every event cites at least one source ref or
   contributor attestation, else it is rejected at validation (the schema's
   `minItems: 1` on `source_refs` enforces the floor).
6. **Taxonomy membership** — denomination codes must resolve in the cited
   `taxonomy_version`. The taxonomy instance now exists (D2); the `pow`
   lookup is follow-up work.
7. **Idempotency** — replay must not double-apply the same
   (`client_event_id`, batch) pair; `client_event_id` now requires
   `minLength: 1` in the schema.

**Rationale.** Each gate blocks a failure class that is cheap to stop at
intake and expensive to repair in the log. The 50 m default reflects NZ
urban parcel spacing: distinct places of worship rarely sit within 50 m,
while shared campuses and adjacent halls do — exactly the cases that need
a human decision rather than a threshold.

**Forecloses.** Unsourced events entering staging, ever; silent duplicate
creation; trusting client-supplied ids without batch scoping.

**Cost to reverse.** Thresholds are configuration — trivial. Removing the
source-presence gate would unmake the research-grade claim; treat it as
constitutional.

**Status.** Amended — gates 1, 5, and 7 are implemented or
schema-enforced; the 50 m default is set here; gates 2, 3, 4, and 6 are
named `pow` work.

## D10. No public edit path in this phase

**Ruling.** Defer any public or semi-public write path until the §10/§13
prerequisites exist: managed OIDC identity, permission scopes, rate
limits, abuse handling, upload quarantine, and a review queue for
low-trust contributors. The invite-only Convex pilot remains the only live
write surface, and it writes provisional task state only.

**Rationale.** Every intake channel is a security surface, and the
reviewer pool is currently two people. Public intake without quarantine
converts reviewer attention into the binding constraint on the whole
pipeline.

**Forecloses.** Community contribution volume during the pilot — accepted.

**Cost to reverse.** Lifting the deferral is the planned direction and
carries a checklist, not a redesign. Opening early is the costly
direction: junk enters the review queues and the event log as retraction
noise, and reviewer time is unrecoverable.

**Status.** Ratified.

## D11. Location corrections first, denomination revisions second

**Ruling.** The first accepted revisions are location corrections: they
are geometric, cheap to validate, and exercise the full
stage–diff–accept–replay path. Denomination revisions wait for the D9
gate-6 lookup and a proven replay. One amendment: the taxonomy artefact
itself ships now (D2) because it is cheap, it unblocks gate 6, and it
stabilises intake vocabularies — only the *acceptance* of denomination
revisions waits.

**Rationale.** Denomination change is the subtle case — taxonomy
versions, splits, mergers, multi-denomination sites. Proving the pipeline
on the geometrically checkable case first means taxonomy subtleties land
on tested machinery.

**Forecloses.** Nothing — order only.

**Cost to reverse.** Trivial.

**Status.** Sequencing — confirmed, with the taxonomy artefact pulled
forward as a prerequisite (D2).

## D12. Conflicts route to adjudication

**Ruling.** Conflicting proposals against the same target and field route
to review with `review_status = adjudication_required`. Resolution emits
accepted events plus `proposal_superseded` links through
`supersedes_event_ids`; both sides remain on the chain. No
last-write-wins; no majority voting.

**Rationale.** With few, trusted contributors, conflicts are information:
two sources disagreeing about the world, not noise to be averaged away.
The superseded chain preserves the disagreement for later re-adjudication
when better evidence arrives.

**Forecloses.** Unattended throughput at scale: reviewer capacity bounds
the acceptance rate. Accepted while contributors are few and trusted.

**Cost to reverse.** Rule-based auto-resolution for low-stakes fields can
sit on top of the chain later without schema change. Starting permissive
is the irreversible direction — proposals overwritten by last-write-wins
are gone.

**Status.** Ratified (`adjudication_required` and the supersession chain
are in the schema).

## D13. Approximate and historical locations

**Ruling.** Keep low-confidence geometries as records, never as map
points. Every geometry-history state carries `geometry_role` and
`location_confidence`. Publication rule: site-mode map points require
`location_confidence` in {`exact`, `building`, `parcel_or_compound`};
street-, locality-, and area-level placements contribute to area-level
products only, flagged by evidence basis. Fuzzy historical placement stays
out of site-level density products until explicit confidence rules and
uncertainty display exist.

**Rationale.** The alternative rulings each lose data or honesty:
excluding poorly located historical sites biases historical coverage
toward well-documented places; plotting them as points manufactures
precision. Keeping the record while gating the display preserves both.

**Forecloses.** Deleting poorly located historical sites; false precision
on the public map; locality-level evidence inflating point counts.

**Cost to reverse.** The publication threshold is configuration. The
foreclosed alternative (dropping the records) would have been
irreversible.

**Status.** New — the fields existed in `geometry-history.schema.json`;
the publication rule is decided here. The PLANNING.md open item
"historical and demolished places" closes with a pointer to this entry.

## D14. Taxonomy version pinning

**Ruling.** Every event whose payload carries denomination codes pins
`taxonomy_version`. The schema previously required this only for
`denomination_*` event types, which let worship-function events carrying
`denomination_set` through unpinned; that gap closes with this register.
Replay interprets codes under the pinned version and maps forward through
supersession entries at read time. Taxonomy updates never rewrite accepted
events.

**Rationale.** A denomination split or rename changes what a code means.
Without pinning, every taxonomy update silently reinterprets the historical
log; with pinning, old events keep their meaning and comparability is a
read-time mapping with an audit trail.

**Forecloses.** Global rename migrations over the event log;
"latest-taxonomy" reinterpretation of old events.

**Cost to reverse.** None to keep. Unpinned events are unrecoverable
ambiguity — nothing records which vocabulary the contributor meant.

**Status.** Amended — schema tightened with this register; the two
nonconforming events in `docs/examples/revisions/nz-relocation.jsonl` now
pin the v1 taxonomy and use dotted codes.

## D15. Replay determinism is the acceptance gate

**Ruling.** The pipeline is research-grade when dropping the staging
database and replaying the accepted event log reproduces the master
byte-identically under a canonical serialisation, verified by manifest
hashes. Consequence: nothing nondeterministic runs inside replay — no live
geocoding, no wall-clock decisions, no network access. Anything
nondeterministic must first be materialised as events or pinned source
snapshots.

**Rationale.** Replay equality catches the failure modes the other rulings
forbid (direct snapshot writes, D5; unpinned vocabularies, D14; hidden
enrichment) without requiring anyone to notice them at the time. It is the
tripwire that makes the rest enforceable.

**Forecloses.** On-the-fly enrichment during rebuild; convenience lookups
inside `pow rebuild-master`.

**Cost to reverse.** None to keep. Quietly abandoning it voids the
reproducibility contract the project cites to collaborators and funders.

**Status.** Ratified — CRITIQUE.md's verification step 8 adopted as the
formal acceptance gate. The canonical serialisation spec is named `pow`
work.

## D16. Rust stays at the governed boundary

**Ruling.** Rust owns the governed boundary (`pow` validation, staging,
identity, event application, master rebuild, export) and nothing else. R
remains the investigator-facing layer for analysis and reporting; `extendr`
acceleration is admissible only after profiling shows a hot loop; no
wholesale rewrite; no Rust API as a prerequisite for data work.

**Rationale.** PLANNING.md carried a contradiction: §12 specifies the
Rust-backed pipeline that now exists in `crates/pow-cli`, while "Open: Rust
adoption timing" still recommends deferring major Rust work. The
resolution is scope, not timing: Rust where strictness and replayability
are the point, R where collaborators need to read and rerun the analysis.

**Forecloses.** Rust expansion into the research pipeline; architecture
churn ahead of data-policy stability.

**Cost to reverse.** Low — the boundary is a build choice, not a data
contract.

**Status.** Ratified; the stale PLANNING.md open item closes with a
pointer here.

## Artefacts changed with this register

- `schemas/change-event.schema.json` — `taxonomy_version` now required for
  any denomination-bearing payload, not only `denomination_*` event types
  (D14); `client_event_id` requires `minLength: 1` (D9 gate 7);
  descriptions state the bitemporal replay rule (D3).
- `schemas/denomination-taxonomy.schema.json` — new contract (D2).
- `schemas/denomination-taxonomy.json` — new v1 instance, NZ pilot scope,
  seeded from `denomination-mapper.js` with contested placements flagged
  (D2).
- `docs/examples/revisions/nz-relocation.jsonl` — both events pin
  `taxonomy_version` and use dotted codes (D14).

Named follow-up work, in dependency order: generate
`denomination-mapper.js` from the taxonomy (D2); wire gates 2, 3, 4, and 6
into `pow` (D9); CLI refusal plus CI replay check for snapshot writes (D5,
D15); canonical serialisation spec (D15); migrate bare codes in the
remaining example files and `pow-cli` fixtures before gate 6 enforcement
(D2).
