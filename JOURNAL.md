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
