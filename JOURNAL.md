# Project Journal

This journal records decision points: why choices were made, what they imply,
and what remains open. `CHANGELOG.md` records what changed; this file records
the reasoning that should remain visible when the project is reported, audited,
or handed to collaborators.

## 2026-05-01: Keep the changelog lean and use this journal for decisions

Decision:
Use `JOURNAL.md` for decision rationale and `CHANGELOG.md` for implementation
changes.

Rationale:
Many project choices are methodological rather than only technical. Examples
include what counts as site evidence, how to treat current versus historical
place counts, and how to stage community or AI contributions before master
ingestion.

Consequences:
Future entries should summarise context, decision, rationale, consequences, and
open questions. The changelog should stay concise and release-oriented.

## 2026-05-01: Treat the grant as a reporting reference, not a tracked source

Decision:
Keep original grant materials in the ignored local `grant/` folder and use them
as the document we report against.

Rationale:
The grant sets objectives and accountability, but it may contain private or
administrative material that should not be committed.

Consequences:
Planning notes should remain mindful of grant aims and explain justified shifts
in scope. Repo documentation should not depend on the grant file being present.

## 2026-05-01: Keep the research pipeline R-first

Decision:
Use R as the primary research-facing pipeline language, with Python retained for
API, tooling, and support scripts. Use `uv` for Python work.

Rationale:
The research pipeline needs to remain legible to investigators and research
assistants. Python is useful for app support and static-task generation, but the
main extraction, cleaning, and analytical products should remain reviewable in R
unless there is a clear reason to move a component elsewhere.

Consequences:
Optimisation should target specific bottlenecks rather than trigger a wholesale
rewrite. `extendr` remains a possible later path for hot R code.

## 2026-05-01: Use area summaries as the portal contract

Decision:
Make `area_summary_ta.json` the first New Zealand example of a provenance-rich
analytical product for the map and future portal.

Rationale:
Map layers should consume reproducible analytical products with explicit units,
years, boundaries, denominators, sources, and quality flags. This better matches
researcher download and citation needs than browser-derived legacy census
tables.

Consequences:
The current NZ area summary combines current committed place counts with
2013, 2018, and 2023 Census religion denominators. It must be labelled as a
current inventory overlay, not a historical place-density estimate.

## 2026-05-01: Do not back-project current places into historical density

Decision:
Do not interpret current `nz_places.json` counts as true 2013 or 2018 place
density.

Rationale:
True historical density requires evidence that a place existed and was in
worship use at the target year. Current OSM-derived inventories cannot safely
answer that question alone.

Consequences:
Historical density should be reconstructed through evidence layers such as OSM
history, lifecycle tags, visual evidence, directories, denominational sources,
charity or organisation records, building evidence, and reviewed target-year
status.

## 2026-05-01: Collect bounded historical evidence before exact dates

Decision:
RA templates should record exact dates when available and bounded dates when
sources only show limits, such as "opened by 2013" or "closed after 2018".

Rationale:
Forcing vague source evidence into exact birth or death dates would create
false precision.

Consequences:
The ingestion model needs first-class fields for `not_earlier_than` and
`not_later_than` evidence, source wording, precision, and review status.

## 2026-05-01: Contributions should stage evidence, not write to the master

Decision:
Human, RA, community, scripted, and AI-assisted contributions should go through
staging, validation, review, adjudication, and master-change proposals.

Rationale:
The master database needs auditability, reproducibility, and protection from
unchecked edits.

Consequences:
Google Sheets can be the first familiar RA adapter. A later API can accept
structured contributions from humans and agents, but master updates should be
accepted only through reviewed proposals.

## 2026-05-01: Verification edits are staged, reversible, and auditable

Decision:
The NZ verification map is a staging surface. It prepares review or nomination
JSON and does not directly edit the master database.

Rationale:
Reviewers need a fast way to inspect evidence and propose changes, while the
master needs an audit trail.

Consequences:
Before submission, a reviewer can discard or regenerate staged JSON. After
staging, undo should mean a `retracted` decision or a superseding decision linked
by `supersedes_decision_id`. After master acceptance, undo should require a
reviewed reversal proposal and an audit entry. Silent overwrites should be
avoided.

## 2026-05-01: Use the NZ verification map as a feedback pilot

Decision:
The current verification map should be treated as an internal or RA-facing
feedback pilot, not a public correction interface.

Rationale:
The workflow is still being tested. It is useful for reviewers to identify
records, evidence gaps, and ergonomic problems, but the backend staging and
review contract is not complete.

Consequences:
For this pilot, staged JSON is sufficient. A future version can post to a
staging API once validation and undo semantics are clearer.

Implementation note:
For RA feedback, the verification map should show individual points by default
rather than clustered markers. Clustering is useful for public browsing, but it
hides co-located or nearby records that reviewers need to notice.

Follow-up decision:
The public RA feedback page should be read-only until a secure staging sink
exists. The earlier draft decision and nomination controls generated only local
browser JSON, which was useful for a smoke test but too easy to confuse with a
real submission path.

Demo-mode exception:
The RA may inspect draft decision and nomination controls through an explicit
`?demo=1` URL. Demo mode must show clear warnings that nothing is saved or
submitted, and it must keep the normal public verification URL read-only.

## 2026-05-01: Missing sites and building complications require first-class staging

Decision:
Verification must support nominations that are not simply fixes to existing
OSM-derived master rows.

Rationale:
Important evidence may concern current places missing from OSM, lost places
present in 2013 or another target year, denomination switches, shared buildings,
split/merged site records, and organisation evidence that does not map directly
to a building.

Consequences:
Nominations need their own ids, evidence, target-year status, proposed action,
and links to any relevant master, OSM, building, or organisation records.

## 2026-05-01: Treat charity data as organisation evidence

Decision:
Charity records should be modelled as organisation observations before they are
linked to site observations.

Rationale:
Annual returns, registration dates, deregistration dates, activities, and
addresses can be valuable, but one charity may operate multiple sites and one
building may host several communities.

Consequences:
Charity evidence should support site matching with explicit confidence and date
bounds. It should not automatically become building-level evidence.

## 2026-05-01: Defer fuzzy placement from address-poor historical sources

Decision:
Historical sources without street addresses can be retained as congregation or
regional evidence, but should not yet enter site-level density products.

Rationale:
Sources such as theses and denominational histories may contain substantial
evidence about congregations while only identifying parishes, towns, or regions.
That evidence is valuable, but precise placement would require assumptions.

Consequences:
Preserve raw wording and regional cues. Later, fuzzy regional placement may
support uncertain back-propagated maps or regional counts once confidence rules
and uncertainty visualisation are defined.

## Open Decision: OSM fixes versus project audit API

Question:
Should the review surface direct users to OSM to fix errors, or to a project
API to audit evidence and stage proposed changes?

Current recommendation:
For the research workflow, direct reviewers to a project audit API or staged
audit form. Keep OSM links as source context and optional external editing links,
but do not make OSM editing the primary correction path.

Rationale:
The project needs to track evidence for historical status, non-OSM sites,
lost sites, building complications, and organisation-level sources. OSM is an
important source, but it cannot represent all research evidence and should not
be treated as the master correction channel.

Near-term pilot:
Expose the NZ verification draft to the RA for feedback first. Avoid exposing
the global map as an input surface until staging, moderation, and abuse controls
exist. Keep any input as draft staged JSON or a test-only endpoint that is not
linked to the master.

## 2026-05-01: Treat data intake as a security boundary

Decision:
Any workflow that accepts incoming data must be designed as an untrusted-input
surface from the beginning.

Rationale:
RA spreadsheets, public forms, direct API clients, file uploads, partner bulk
submissions, and AI-agent contributions can introduce bad data, spam, malicious
files, private information, licence violations, or attempts to alter published
outputs. Security cannot be added only after the intake path exists.

Consequences:
The default architecture is read-only master exports plus staged submissions.
Before any intake endpoint is exposed beyond the core team, define
authentication or contributor identification, permission scopes, rate limits,
upload type and size limits, malware scanning where feasible, privacy and
licence checks, validation, quarantine for low-trust submissions, audit logs,
abuse handling, and reviewed promotion into accepted data. No intake path should
write directly to the master or to public map products.

## 2026-05-01: Use managed authentication

Decision:
Use a managed authentication service. Do not build authentication ourselves.

Rationale:
Password storage, password reset, multi-factor authentication, login sessions,
token refresh, and account recovery are security-sensitive systems. The project
needs staged evidence, permission scopes, and audit records, but it should not
carry the operational risk of custom authentication.

Consequences:
The future staging API should verify provider-issued identity tokens and then
map authenticated identities to project permissions such as submit-only, review,
adjudicate, and master-commit. Scripts and AI agents should use scoped machine
credentials. The project should store provider subject ids, contributor records,
permission grants, and audit events, not passwords or session secrets. Provider
selection remains a later deployment decision.

## 2026-05-01: Use Rust for governed data modification

Decision:
Use Rust as the preferred systems layer for data modification, validation,
staging, event application, master rebuilding, and export generation. Keep R as
the primary investigator-facing layer for analysis, summaries, plots, and
reports.

Rationale:
The project needs strict contracts around data changes: immutable inputs,
typed validation, reproducible diffs, auditable acceptance, and explainable
master snapshots. Rust is well suited to this governed state-change layer.
R remains better for collaborator-facing research work, data exploration, and
statistical reporting, and it is already the canonical research pipeline.

Consequences:
Rust should not become a general rewrite of the research workflow. It should
begin with explicit invariants and an event model: staged proposals, validation
results, review decisions, accepted changes, and rebuild manifests. The first
implementation should be a local CLI that validates and diffs a small NZ staged
batch without writing to the master. Future API work can reuse the same typed
contracts once authentication, permissions, and staging storage are ready.

Open questions:
The repository still needs a concrete event schema, storage choice for staged
and accepted events, and a migration path from current static JSON outputs to
event-rebuilt master snapshots. These should be specified before a Rust service
or public write endpoint is built.

## 2026-05-02: Use Google Cloud for the first portal staging baseline

Status:
Superseded in part by the 2026-05-03 Convex task-map decision below. Google
Cloud remains the durable staging, geospatial storage, media quarantine, and
provider-neutral export reference; Convex is now the preferred near-term spike
for live shared task/review state.

Decision:
Use Google Cloud as the reference backend for durable authenticated staging,
geospatial storage, private media quarantine, and provider-neutral archival
exports in the New Zealand portal pilot.

Rationale:
The immediate problem is safe, auditable intake: managed authentication,
permission scopes, staged submissions, geospatial validation, image quarantine,
reviewer decisions, and dry-run master diffs. Google Cloud provides mature
pieces for this path:
Identity Platform for managed OAuth and multi-factor authentication support,
Cloud Run for a Rust API, Cloud SQL/PostgreSQL with PostGIS for staging and
review geometry, Cloud Storage for raw submissions and quarantined images, and a
durable ecosystem that is likely to remain available over the long horizon.

Consequences:
The planning docs should treat Google Cloud as the baseline implementation, while
keeping provider-neutral contracts for identity claims, SQL/GeoJSON exports,
object storage references, audit records, and master-change manifests. GitHub
may be used as an audit or export mirror, but not as the primary review backend.

Open questions:
SpacetimeDB remains a possible later spike if the portal needs Rust-first
realtime state or reducer-style governed updates. Convex is now handled by the
2026-05-03 task-map decision below.

## 2026-05-02: Treat relocation as new site identity when place changes

Decision:
Use `site_id` for the mappable place of worship, not for a congregation or
organisation that may move between places. If a worship community relocates to a
materially different place, create a new `site_id` for the destination and link
the records through a relocation event, successor relation, and organisation
evidence where available. Geometry corrections, address renumbering, street
renaming, and better building outlines should preserve `site_id` and append
geometry-history states.

Rationale:
The project reports places located in space and time. Treating a moving
congregation as one site would blur place-based density, area assignment, and
historical map products. Treating every corrected coordinate as a new site would
inflate counts and break longitudinal continuity. The stable rule is therefore
place continuity first, organisation continuity second.

Consequences:
`schemas/change-event.schema.json` is the append-only event envelope for
accepted or staged changes, with both effective dates and `recorded_at` for
bitemporal replay. `schemas/geometry-history.schema.json` records time-bounded
geometry states for a site or structure. `site_snapshot` rows should be treated
as derived caches rebuilt from accepted change events, not as directly edited
records.

## 2026-05-02: Keep Python narrow and optional

Decision:
Keep Python as a lightweight support layer, not as the default research or
governed-ingestion stack. The default `uv` environment should stay minimal.
Install the FastAPI/GeoPandas API prototype only through an explicit `api` extra,
keep Parquet acceleration in the existing `fast-parquet` extra, and keep
archive-only dependencies in a `legacy` extra.

Rationale:
The active research pipeline is R-first, and the governed mutation layer is
planned for Rust. Most current Python scripts under `scripts/` use only the
standard library. Keeping FastAPI, Starlette, GeoPandas, Pandas, Polars,
OSM conversion, and legacy parser packages in the default environment increases
security surface and maintenance cost without supporting routine RA or research
work.

Consequences:
Routine Python utility work should use `uv sync` and `uv run`. API prototype work
should use `uv sync --extra api`; Parquet fast-path work should add
`--extra fast-parquet`; archived legacy inspection should use `--extra legacy`.
New canonical data-cleaning, event-replay, and master-rebuild work should go to
R or Rust rather than expanding the default Python dependency set.

## 2026-05-02: Keep edit and review maps API-backed, not CLI-backed

Decision:
The edit map should remain map-first and should not call the Rust CLI directly.
The first `pow validate` CLI is the local and CI validation surface for exported
RA spreadsheets, bulk evidence files, and agent-produced event proposals. A
future authenticated map should submit proposals to a backend API that reuses the
same Rust validation rules, writes only to staging, and returns clear submission
states: staged, rejected by validation, or saved only locally in demo mode.

Rationale:
The working map needs to feel fast and spatial. Large explanatory panels would
make the core task harder: selecting a site, building, or point and entering the
smallest relevant correction or nomination. The safety boundary belongs at the
API and staging layer, not inside a static HTML page. Keeping the CLI and API on
the same validation contracts means RA spreadsheets, map submissions, bulk
uploads, and AI-assisted proposals can converge on one governed path without
allowing direct master writes.

Consequences:
The entry UI should use concise controls, disabled states, and confirmation
messages that identify the true persistence state. The reviewer UI should show
the same map and site context, plus validation warnings, nearby duplicate
candidates, linked OSM objects, linked building geometry, existing master
values, proposed values, and the evidence trail. Review decisions should emit
accepted or rejected change events; public map layers should still be derived
from reviewed exports and rebuilt snapshots rather than live unreviewed
submissions.

## 2026-05-02: Use SQLite-compatible staging first, evaluate Turso later

Decision:
Use a plain SQLite-compatible staging design for the next local `pow stage` and
`pow diff` milestone. Treat Turso as a possible later spike, not the default
database choice for the first staging implementation.

Rationale:
The immediate need is a small, auditable local staging store for RA batches:
raw-input snapshots, parsed rows, validation diagnostics, staged proposals,
review decisions, accepted change events, and diff reports. SQLite is sufficient
for that milestone, is easy to inspect, and keeps the database contract simple.
The linked Turso project is promising because it is written in Rust, is
SQLite-compatible, and advertises features relevant to future collaboration
such as change data capture, improved write concurrency, multi-language
bindings, and WebAssembly support. However, its repository currently describes
the software as beta and advises caution with production data. That makes it a
candidate for evaluation after the schema, staging, and review contracts are
stable, not the foundation for the first governed intake path.

Consequences:
Design the next staging tables in standard SQLite terms and avoid relying on
provider-specific extensions. Keep exports explicit enough to migrate later to
Turso, libSQL, Cloud SQL/PostgreSQL/PostGIS, or another backend. Turso should be
evaluated only when we have concrete pressure for SQLite-compatible sync, change
data capture, browser/WASM workflows, or agent-friendly local database
inspection that plain SQLite cannot handle well.

## 2026-05-03: Treat functional changes as data

Decision:
The project should treat changes in place-of-worship function as first-class
data. The mission-critical diffs are whether a site functioned as a place of
worship at a specified time, whether that worship use appeared or disappeared,
and whether the use changed denomination, became multi-denominational, became
multi-purpose, split across several worship uses, or merged previously separate
uses.

Rationale:
The research objective is spatial and temporal analysis of worship places, not
only inventory management for buildings. A building may exist before worship use
begins and may remain after worship use ends. Building outlines, demolition,
rebuilding, imagery, and property evidence are therefore supporting evidence and
structure history. The analytical state is the function of the site at a time:
worship use, denomination or tradition set, organisation links, confidence, and
target-year status.

Consequences:
`pow diff` must report functional transitions separately from geometry or
structure changes. Accepted changes should preserve effective time, evidence,
review status, confidence, and target-year implications. The current
`change-event` schema is a start, but it still needs an explicit functional
state model before review decisions depend on it: worship-use status,
denomination sets, multi-denomination, multi-purpose use, organisation-site
links, and appeared/disappeared target-year states should be specified rather
than squeezed into a single status or denomination field.

## 2026-05-03: Surface research outputs through CLI contracts first

Status:
Superseded in part by the later Convex task-layer decision. The `pow` contracts
remain authoritative for accepted data changes, but provisional web-based task
coordination can now proceed through Convex.

Decision:
Defer web-based data management and make the local governed data-modification
contracts strong first. The near-term surface for data modification,
verification, and analytical consequences is the `pow` CLI plus SQLite staging,
plain reports, and R-readable exports.

Rationale:
The key research-facing outputs must be efficient, safe, and robust. A web
portal can make contribution easier, but it should not decide the underlying
semantics of validation, staging, review, diffing, replay, or export. Building
`pow diff` first lets the project show exactly how a proposed batch would change
target-year worship-function states, appeared/disappeared counts, denomination
or tradition summaries, multi-use classifications, area densities, map layers,
downloads, and uncertainty statements before any interactive editor can submit
to a backend.

Consequences:
The roadmap should keep evidence governance and research outputs coupled in
each phase. The next CLI milestone should produce both review-facing and
investigator-facing artefacts: text summaries for humans, JSON for audit and
API reuse, CSV/GeoJSON for maps and downloads, and R-readable outputs for
analysis workflows. A later TUI or authenticated portal should call the same
contracts rather than invent its own data-management path. Public web products
should consume reviewed or explicitly provisional exports, not live unreviewed
submissions.

## 2026-05-03: Treat change-event schemas as pre-release contracts

Decision:
Do not preserve backward compatibility for awkward change-event shapes before
`pow diff`, portal intake, or master rebuilds exist. Preserve internal coherence
instead: update schemas, examples, tests, and RA vocabularies together.

Rationale:
The schema is currently a design contract, not a public API or accepted master
data format. Carrying forward early modelling mistakes would make the later
diff, review, and export surfaces harder to reason about.

Consequences:
The immediate schema work can tighten rules and rename vocabulary where needed.
The project should still avoid gratuitous churn, but if a schema shape prevents
direct representation of worship-function change, it should be corrected now
rather than worked around in `pow diff`.

## 2026-05-03: Scope `pow diff` v1 to the reviewer report

Decision:
The first `pow diff` implementation should produce the reviewer report only:
per-site changesets, per-target-year affects, validation and warning rollups,
source coverage, and identity-decision flags for one staged batch.

Rationale:
Those outputs can be derived directly from staged change events using the new
`previous_*` fields and `target_year_affects`. Full `before.geojson`,
`after.geojson`, `area_summary_diff.csv`, density estimates, and map/export
effects require complete state reconstruction. That work fits naturally with
`pow rebuild-master` and later export commands.

Consequences:
`pow diff` v1 should still emit machine-readable JSON, but the JSON should
describe reviewer-facing event effects. Full rebuilt snapshot comparisons
belong in the rebuild/export layer. The security and audit issues raised in
review, including cryptographic identity binding, source content hashes,
batch-hash linkage, `client_event_id` uniqueness, licence policy, and takedown
semantics, remain a separate pre-portal audit pass.

## 2026-05-03: Keep RA validation explicit and single-maintainer

Decision:
For the current New Zealand RA pilot, make the command-line workflow extremely
explicit and step-by-step, with screenshot-style figures, and instruct RAs not
to open pull requests, commit changes, edit repository templates, or submit
GitHub changes. Remove the general contributor guide while Joseph remains the
single developer until the data contracts, RA validation workflow, and map
products are stable.

Rationale:
The RA task is evidence checking, not software contribution. A detailed tutorial
reduces avoidable support friction and lowers the chance that evidence work is
mixed with repository changes. Keeping development single-maintainer also
protects the still-moving schema, CLI, staging, and review contracts from
premature external workflow commitments.

Consequences:
RA-facing documentation should direct assistants to the agreed spreadsheet,
CSV export, `pow validate`, optional local staging, and project-team review.
Repository documentation can still invite public OpenStreetMap corrections, but
it should not invite GitHub pull requests until contribution, review, security,
and licensing policies are stable. Future agents should not recreate
`CONTRIBUTING.md` unless the project explicitly reopens GitHub contribution.

## 2026-05-03: Keep the repository public but narrow GitHub intake

Decision:
Keep the GitHub repository public because the public map links to it and the
project benefits from transparent source, licensing, and provenance. During the
single-maintainer pilot, disable GitHub Issues, Discussions, and Wiki, and add
minimal `main` branch protection that prevents force-pushes and branch deletion
without requiring pull requests.

Rationale:
Making the repository private would reduce transparency and complicate the
public map's source trail. The main risks are not public read access; they are
premature contribution channels, accidental private or restricted data intake,
and destructive repository operations. Those risks are better handled by
keeping raw RA evidence outside Git, disabling public GitHub intake surfaces,
and protecting `main` while preserving efficient maintainer pushes.

Consequences:
For now, documentation, planning, small schema-contract changes, and narrow CLI
patches can be committed directly to `main` when reviewed locally. Use short
branches only for risky code, multi-file migrations, experiments that may be
discarded, or work that needs explicit review before landing. Public users
should still be directed to correct OpenStreetMap where appropriate; project
evidence intake should wait for the staged RA workflow and later authenticated
portal/API.

## 2026-05-03: Treat the map-first RA workflow as the product target

Decision:
Clarify that the current RA pilot uses the NZ map for search and triage, the
spreadsheet for evidence entry, and `pow validate` for checking exported CSVs.
The product target is a map-first workflow in which an authenticated RA can
select 2013, 2018, or 2023, click a site or empty location, and propose a
missing site, duplicate/merge, closure, changed use, denomination change,
shared-building case, or uncertain target-year state.

Rationale:
The CLI tutorial explained validation mechanics but not how an RA should move
from a map finding to a concrete evidence row. Missing current sites, duplicate
points, and places present in 2013 but absent in 2018 are the core temporal and
identity problems the system must handle. Documenting those cases now gives RAs
a usable interim procedure and gives the later portal a concrete interaction
specification.

Consequences:
Until authenticated map intake exists, RAs should record these cases in the
wide spreadsheet and send validated CSVs for review. The map demo remains
non-saving and unsuitable for private or restricted data. The future portal
should expose time-point controls for 2013, 2018, and 2023 and route every
proposal through staging and review rather than writing directly to the master
database.

Implementation note:
The first static version of this idea now appears on the NZ verification map as
provisional 2013, 2018, and 2023 target-year controls. It uses explicit
target-year fields when available and otherwise derives a visible provisional
status from OSM lifecycle tags. This makes missing or ambiguous lifecycle
evidence visible to RAs without treating OSM dates as accepted historical truth.
In demo mode, the map also now includes a local RA action builder that can
produce a tab-separated wide evidence row and a review JSON preview from the
selected task. This is deliberately no-save and no-submit: it tests the
ergonomics of a map-first workflow while leaving authentication, staging,
validation, and master writes outside the static page.

Design note:
Use the current static verification map for the first RA workbench controls
before committing to a Leptos or other Rust frontend. The immediate problem is
interaction design: which actions should be selectable, what evidence fields
are genuinely needed, how target-year states should be shown, and where RAs get
confused. A static no-save workbench can answer those questions quickly. Once
the actions and staged event contracts are stable, a Leptos frontend remains a
reasonable candidate for an authenticated Rust-oriented portal, provided it
uses the same validation contracts and API rather than inventing a parallel
data path.

## 2026-05-03: Make the current RA task map-first and time-bounded

Decision:
For the current New Zealand pilot, direct the RA to start from the verification
map and produce a small mixed evidence batch rather than treating the CLI as
the centre of the work. The pilot target is a varied set of high-value cases:
high-priority records, missing lifecycle dates, duplicates, missing current
sites, 2013-present/2018-absent cases, shared or changed-use sites, and a small
control sample.

Rationale:
RA time is limited. A broad search or a CLI-first workflow would produce
volume before the save, evaluate, review, and merge-track flow has been tested.
A compact map-first batch gives the project real examples across the categories
the future portal must support, while still keeping evidence in the
spreadsheet and validation contracts.

Consequences:
`docs/ra-nz-pilot-task.md` is now the first RA-facing document for the current
pilot. The CLI tutorial remains important, but as a validation and support
guide. The next engineering step should use these pilot rows to wire the
minimal save/evaluate/review loop rather than waiting for exhaustive NZ
coverage. Until backend save exists, the shared working spreadsheet is the
persistent working store; the map demo is only an inspection and copy-helper
surface.

## 2026-05-03: Proposed events live as derived stage batches

Decision:
`pow propose --persist` writes its emitted change events back into
`.pow/staging.sqlite` as a new derived batch, with each event stored as one
row in the existing `stage_records` table (`record_kind = 'proposed_event'`)
and the new batch linked to its source via `stage_batches.parent_batch_id`.
`pow diff <batch_id>` reads any batch whose stored records are change events,
whether they came from `pow propose --persist` or from `pow stage` of a JSONL
batch.

Rationale:
The reviewer needs a canonical place to read proposed events from. Stdout-only
output is fine for inspection but cannot be diffed without an external file.
A dedicated `proposed_events` table would have duplicated `stage_records`
behaviour (raw + parsed JSON, indexed by batch and record). Reusing the
existing tables keeps the read path uniform: a `record_kind` filter is enough
to distinguish proposed events from raw RA evidence rows, and the new
`parent_batch_id` column makes the source lineage navigable in plain SQL.

Consequences:
`pow diff` v1 is implemented around this storage convention. The migration
adds one nullable column to `stage_batches` and one composite index. Existing
`.pow/staging.sqlite` files upgrade idempotently on the next CLI run. The
deferred audit/security pass (cryptographic identity binding, source content
hashes, immutability enforcement, client-event uniqueness, licence blocking,
takedown semantics) and the future review/accept commands remain on the
checklist; nothing in this storage decision pre-commits the portal contract.

## 2026-05-03: Treat the RA action builder as the default verification surface

Decision:
For the current pilot, the NZ verification map should land in demo mode: the
RA action builder, session log, and nomination controls are visible on first
paint, and `?demo=0` opts in to the read-only feedback view. This was
implemented as a single-line flip of the `DEMO_MODE` parser plus updates to
the NZ README and `docs/ra-nz-pilot-task.md` so the bare URL is the canonical
demo entry.

Rationale:
The non-demo state is read-only with no functional path behind it; gating the
only working surface behind a small inline "Open demo mode" link added
friction without protecting anything. The Tier 1 demo banner already tells
the visitor that nothing is saved or submitted and that private data should
not be entered, so the safety framing is preserved by making demo the
default. While the RA workflow is the only audience and there is no real
read-only product yet, defaulting to demo matches what the page is actually
for.

Consequences:
External reviewers landing on the page will see draft controls immediately
rather than a read-only view; this is acceptable while the pilot audience is
known but the default should flip back once a secure-staged read-only product
exists. The `pow_ra_session_v1`, `pow_ra_initials`, and
`pow_ra_quickstart_dismissed_v1` keys remain client-side and namespaced, so
the future flip back can migrate or warn cleanly. The Tier 3 PR carries the
documentation updates (NZ README and RA pilot task) so any reviewer following
the docs lands in the same state the code produces.

## 2026-05-03: Stage the RA verification UI in three small tiers

Decision:
The RA-facing verification map work landed as three small pull requests
rather than one large UI rewrite: ergonomics first, session workflow second,
and demo-by-default documentation third.

Rationale:
Small, focused PRs made the RA pilot surface easier to review and revert.
This was appropriate for an active pilot, where usability fixes needed to land
without broad backend, schema, or evidence-template changes.

Consequences:
Stacked PRs require care after squash merges. Before merging the next branch
in a stack, rebase or restack it onto current `main` and retarget the PR so the
diff is real. The durable coordination rule belongs in `AGENTS.md`; the
journal only needs to preserve the decision and the lesson.

## 2026-05-03: Keep the RA pilot UI-first

Decision:
Move CLI tutorials, staging notes, and proposal-mapping docs that are not
essential for the research-assistant pilot into `docs/development/`. The
default RA path is now the NZ verification map plus the shared working
spreadsheet; command-line validation and staging remain project-team or
developer tasks unless explicitly assigned.

Rationale:
RA time is limited, and the pilot is testing whether a map-first evidence
workflow can support useful New Zealand validation. Surfacing CLI material in
the RA start path split attention away from the UI tasks we need tested now.

Consequences:
RA-facing docs should explain what to inspect, how to record evidence, how to
nominate missing places, and how to mark 2013, 2018, and 2023 target-year
states. Development docs can still document `pow validate`, `pow stage`,
`pow propose`, and staging internals, but they should not be linked as the
default RA workflow.

## 2026-05-03: Project-owned RA working sheets

Decision:
Use project-owned Google Sheets as the temporary RA evidence store, not
RA-owned copies. The immediate pilot can share one project-controlled working
sheet directly with the RA. A later provisioning step should create per-RA or
per-batch sheets from a locked project-owned template and grant RA access.

Rationale:
Project ownership keeps the evidence store retrievable, permissioned,
offboardable, and auditable. RA-owned copies would remove the manual
sheet-supply step but would make access control and long-term custody harder.

Consequences:
Sheet links should be supplied directly and kept out of GitHub. Planning should
favour automated provisioning within the project Google Drive workspace, with
locked headers, batch metadata, RA access grants, and later portal integration.
The first helper is `scripts/build_ra_working_sheet.py`, which builds the
multi-tab workbook from the repository CSV templates for import into Google
Drive as a native project-owned Sheet, with frozen headers, filters, and
main-tab controlled-field dropdowns.

## 2026-05-03: Street imagery and field observation evidence

Decision:
Treat dated street-level imagery and approved field observations as explicit
RA evidence types. Use `source_type = street_imagery` for providers such as
Google Street View, Apple Look Around, Mapillary, KartaView, Bing Streetside,
or similar services, and `source_type = field_observation` for approved RA or
project-team site visits.

Rationale:
Visual evidence can have low measurement error for visible worship-use claims,
such as signs, service boards, and named place-of-worship markers. It is weaker
for absence because missing visible signage does not prove that worship use was
absent.

Consequences:
Rows should record provider or observer type, source link or agreed reference,
capture or visit date, and a short site-level visual claim. Do not store or
republish Street View screenshots, RA photos, videos, private conversations, or
personal contact details in Git or public outputs unless a later approved media
workflow covers consent, licensing, quarantine, and review.

## 2026-05-03: Project ids outrank external ids

Decision:
Accepted places of worship receive durable project-owned `site_id` values.
RA, community, or map-generated suggestions use provisional `candidate_site_id`
values until review. OSM object ids, charity ids, directory ids, and other
provider record ids are source identifiers attached to a project site; they do
not define project site identity.

Rationale:
The master must remain stable when upstream sources change. A trusted user may
nominate a missing place before the next OSM refresh supplies the same site
with an OSM id. In that case, OSM should enrich or challenge the existing
project site after review, not replace the project identity or create an
unreviewed duplicate.

Consequences:
The August/September OSM refresh should generate identity-link and conflict
tasks against the current master. If OSM matches an accepted project site,
review can attach the OSM id and source metadata to the existing `site_id`. If
OSM conflicts with accepted evidence, it should create proposed change events
against the existing site unless review decides that the record is a distinct
site, duplicate, split, merge, or relocation. Accepted events then rebuild the
master and produce diffs; OSM and user suggestions never overwrite the master
directly.

## 2026-05-03: Add a project FAQ

Decision:
Create a root `FAQ.md` for plain-language operational rules that cut across
planning, RA guidance, schemas, and future backend work.

Rationale:
Several important design choices are easy to ask in ordinary language but hard
to find in long planning documents: whether the Sheet is shared, whether OSM
ids define sites, how accepted candidates handle later OSM matches, and how
tasks become master changes.

Consequences:
The FAQ is explanatory, not the only source of truth. Authoritative contracts
remain in schemas and planning documents, but the README should link to the FAQ
so RAs, collaborators, and future agents can quickly find the project model.

## 2026-05-03: Treat RA sheet header order as a contract

Decision:
Treat the `site_evidence_wide` column order as a data contract between the map
action builder, the Google Sheet, CSV export, and `pow validate`. The map emits
tab-separated rows in this exact order, so generated rows should be pasted into
column A under the unchanged header.

Rationale:
If the Sheet header is reordered, renamed, or missing columns, a copied row can
paste valid-looking values into the wrong cells. That would waste RA work and
could silently corrupt staged evidence.

Consequences:
The live pilot Sheet has a warning protection on the header row. RA guidance
now says to paste into column A under the unchanged header. The CLI validator
should error when an exported CSV has the same known template columns in a
different order, or appears to be a known template but no longer matches the
template header exactly.

## 2026-05-03: Separate shared task state from the master

Decision:
The RA map's `tentatively closed` state is only a local browser aid for the
current demo. The durable target is a shared task store outside the master
database that defines task assignment and provisional closure until review.

Rationale:
The shared Sheet can legitimately contain multiple rows for the same place when
each row contributes different evidence: a different source, target year,
identity judgement, duplicate judgement, or worship-function claim. That is not
the same problem as duplicate labour. Avoiding accidental duplicate work
requires shared task status, while preserving multiple evidence rows requires a
one-to-many relationship from task or site to evidence rows.

Consequences:
RA-facing guidance now tells assistants that browser task badges are local only
and that the shared Sheet is the durable pilot record. Planning now calls for a
shared task store with statuses such as `open`, `in_progress`,
`provisionally_closed`, `needs_review`, `reviewed`, and `reopened`. Accepted
review decisions become change events for the master; provisional task statuses
do not mutate the master directly.

## 2026-05-03: Capture lifecycle and later changes during target-year triage

Decision:
Keep the 2013, 2018, and 2023 target-year fields as the New Zealand estimation
spine, but let each RA-generated map row carry one structured lifecycle or
later worship-function change date when a source supports it.

Rationale:
Sources often answer more than the immediate target-year question. A directory,
Street View capture, field observation, or denominational record may show that
worship began before a target year, ended after a target year, or changed to a
shared or multi-denominational use later, such as in 2024. Losing that evidence
would make later reconstruction and denomination/use-change analysis harder.

Consequences:
The RA action builder now exposes optional lifecycle/change controls before row
copying and maps the selected event into the existing wide evidence date and
precision fields. If one source supports several distinct lifecycle claims,
multiple evidence rows for the same site are acceptable when the notes make the
repeat intentional. Review and later ingestion still decide whether those rows
become accepted change events.

## 2026-05-03: Spike Convex for shared task-map state

Decision:
Use Convex as the preferred near-term backend spike for the live New Zealand
task map and reviewer workbench. Keep the master database, accepted change
events, rebuilds, and public map exports outside Convex.

Rationale:
The immediate bottleneck is coordination, not canonical storage. Browser-local
task badges cannot coordinate multiple RAs, devices, or curator review passes.
Convex is built for live application state and can support shared assignments,
provisional closures, evidence drafts, reviewer comments, and curator queues
with less custom infrastructure than a Rust/PostGIS portal.

Consequences:
The next backend prototype should model tasks, task events, evidence drafts,
review decisions, user roles, and weekly curator exports in Convex. A
curator-triggered or scheduled export must feed the existing `pow` validation,
proposal, diff, replay, and research-output path. Google Cloud/PostGIS remains
the durable staging and storage reference for heavier geospatial queries,
quarantined media, and provider-neutral archival exports if the task pilot
outgrows Convex. Convex task state must not mutate the master directly or appear
on public maps except through reviewed exports.

## 2026-05-03: Specify the Convex task layer before implementation

Decision:
Write the Convex task-layer contract before adding a backend dependency or
rewiring the NZ verification map.

Rationale:
Convex can reduce the RA workflow friction, but only if its responsibilities
are narrow: live task state, evidence drafts, review decisions, and curator
exports. Without a contract, it would be easy for the live workbench to blur
into canonical storage or public publication.

Consequences:
`docs/convex-task-layer-spec.md` is now the implementation reference for the
first Convex spike. It defines roles, statuses, tables, task events, evidence
drafts, review decisions, export batches, security boundaries, and the
Convex-to-`pow` export contract. Implementation should start with the smallest
slice that replaces browser-local task/session state while preserving the Sheet
and `pow` export fallback.

## 2026-05-03: Scaffold the Convex task database

Decision:
Add an initial Convex backend scaffold for shared New Zealand RA task state
before wiring the live verification map to backend writes.

Rationale:
The immediate product risk is wasting RA time through browser-local task state
and manual Sheet/session-JSON coordination. A narrow Convex scaffold lets us
test shared task exposure, provisional closure, evidence drafts, reviewer
decisions, export batches, and user-nominated candidates without changing the
master database or public map. Keeping the frontend disconnected for this first
step preserves the current RA demo while backend contracts are checked.

Consequences:
`convex/` now contains the provisional schema and role-checked functions.
`scripts/build_convex_task_seed.py` converts the current NZ verification
GeoJSON into a Convex import payload, and
`docs/development/convex-task-layer-setup.md` explains how to run a local
deployment and seed a sample. The next steps are dependency install/codegen,
sample import, function-runner smoke tests, and then small frontend wiring for
task reads and provisional status writes. Convex still cannot mutate the master
or public map products directly.

## 2026-05-03: Smoke-test the local Convex task loop

Decision:
Use a local Convex deployment to smoke-test the scaffold before wiring the NZ
verification map to it.

Rationale:
The first risk was whether the provisional task-store model could actually
carry the loop we need: task import, manual candidate creation, task claiming,
evidence draft save, submission for review, reviewer decision, export bundle
creation, and export freezing. Testing that loop locally keeps the current RA
page stable and avoids exposing unfinished backend writes.

Consequences:
The local smoke test generated Convex `_generated` files, imported a five-task
NZ sample, created one manual candidate task for a site not on OSM/project map,
and proved the save-submit-review-export path. The next implementation step is
frontend wiring behind a clear development/demo gate: read tasks from Convex
first, then write claim/skip/provisional-close states, then save evidence
drafts. The local smoke data are test-only and do not enter the master.

## 2026-05-03: Prefer pending invites for hosted Convex onboarding

Decision:
For the hosted RA pilot, bootstrap pending project-user invites rather than
creating active users from mocked command-line identities.

Rationale:
The local smoke test used a mocked identity, which is fine for proving the
backend loop but wrong for real RA work. Andre should claim a pending `ra`
invite using his own Google-authenticated identity, and JB should likewise
claim the admin role with a real identity. That gives the task-event log a
stable identity chain before any evidence is saved.

Consequences:
`users:bootstrapPendingInvites` can initialise a fresh deployment with a
pending admin and one or more pending RA invites. The Google OpenID Connect
auth config is kept as a development example until the hosted deployment has a
real `GOOGLE_CLIENT_ID`; this avoids breaking local Convex checks with a
missing environment variable. The remaining work is hosted deployment setup,
Google client configuration, and frontend sign-in/wiring behind the Convex demo
gate.
