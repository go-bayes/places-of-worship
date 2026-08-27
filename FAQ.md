# Places of Worship FAQ

This FAQ explains current operating rules for the New Zealand pilot and the
planned staged data workflow. The authoritative contracts remain in schemas and
planning documents; this page is a readable guide.

## What is the project doing right now?

The New Zealand pilot is using a Convex-backed web assignment rather than a
spreadsheet-first workflow. André (the NZ RA) opens the assigned New Zealand workpack,
signs in with Google, saves drafts, submits unresolved notes, or submits
evidence for review. JB and JW use the reviewer portal to inspect submitted
evidence and record review decisions.

The live backend is still a coordination layer. It records task status,
evidence drafts, review decisions, and export metadata. It does not update the
master database or public map. Reviewed evidence must still be exported,
validated by `pow`, staged, diffed, and replayed before it becomes research or
public-map data.

Vanuatu is the next country case. Its rapid-entry path lets an invited RA pin a provisional missing place and record a dated observation about its current physical existence and worship use in one submission. The same portal retains a detailed form for source leads concerning 1989, 1999, 2009, and 2020 and for older lifecycle evidence back to 1600. The temporary Vanuatu portal is a test surface over the shared Convex review layer, not a final country map.

## Does “the place currently exists” mean that worship currently occurs there?

No. Physical existence and worship function are separate observations. The rapid Vanuatu form therefore asks the RA to choose among four claims at an exact observation date: the site is used for worship; the place exists but worship use is uncertain; the place exists but is not used for worship; or its status could not be determined. Here, “current” means at that recorded date, not a timeless property. The server preserves the explicit answer and derives provisional review fields from it. It does not infer worship from a building, nor use a present observation to fill a historical target year.

## How should an RA record known history?

Submit the rapid observation or guided evidence first, then choose `Add known history`. All configured country verification portals offer the same action through the shared New Zealand portal. Record one historical event or state at a time. Keep structure history, worship-function history, denomination or affiliation, leadership, and shared or concurrent use as separate claims because evidence for one does not establish the others.

For each claim, retain the source wording or a short confirmed dictated account. Enter the earliest and latest dates only when the source supports those bounds, using `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. If a source says only “during the war”, retain those words and explain that the war or calendar bounds remain unresolved. Do not translate the phrase into years without additional evidence. An ongoing state may be marked open through the parent evidence date, or through the claim-recording date when the parent evidence has no date. An event cannot remain open.

Each historical claim enters human review as provisional evidence. It does not change the current observation, fill a target-year state, become an accepted event, or update the master or public map. The first version stores confirmed text only: an RA may use device dictation, but the portal retains no audio and performs no AI extraction.

## What is the unit of analysis?

The primary unit is a mappable place of worship: a building, parcel, compound,
or otherwise locatable site where worship use occurs or occurred. It is not
simply a building record and it is not always the same as a congregation or
organisation.

## What do opening, closure, and change dates mean here?

These are source-backed dates and changes in the history of a worship site,
organisation, building, or worship function. Examples include organisation
founding, worship beginning at a site, building opening or dedication, first or
last sighting in a source, closure or end of worship use, demolition,
relocation, or a later change such as shared or multi-denominational use.

For this project, the most important dates are dates about worship use at a
mappable site. A building may exist before worship begins and may remain after
worship ends, so building dates and worship-use dates should stay separate
where the source allows.

## Does an OpenStreetMap id define a project site?

No. The project uses durable internal `site_id` values for accepted places.
OpenStreetMap (OSM) ids are source identifiers attached to a project site. The
same principle applies to charity ids, directory ids, and provider-specific
record ids.

External ids help us match and audit evidence, but they do not define project
identity.

## What happens when a user suggests a missing place of worship?

The interface should call this `Nominate missing PoW`, not `Add to map`,
because the user is making a provisional claim for review.

The suggestion starts as a candidate, with a provisional `candidate_site_id`.
Here, "missing" usually means missing from the project map or master list. OSM
may already contain a candidate object, and that OSM id should be recorded as
source or matching evidence rather than treated as the project identity.

The candidate should include source evidence, location evidence, target-year
status where known, any relevant OSM object ids, and review notes.

The Vanuatu rapid-entry path implements this nomination as an atomic review submission: it creates the provisional candidate and submitted evidence together, then places the task in the human review queue. It requires a building-accurate point, a nearby-place check, an exact observation date, an evidence basis, one of four explicit current-status claims, and a sensitivity setting. It does not create an accepted site or change the public map.

The ordinary country nomination path may instead preserve an approximate area when the contributor cannot identify a building. The contributor places the centre of the supported area, records an uncertainty radius, retains what the source or informant says about the location, states the basis and confidence, and confirms that this description matches the evidence. The centre is not treated as an accepted site point. Review must establish or retain the appropriate location representation before export can affect accepted data.

A statement such as “roughly two kilometres from the town centre” supports a relative distance but, without a direction, does not support a single approximate-area centre. The contributor should retain that wording as unresolved location evidence rather than invent a point. A later relative-location contract will represent distance bounds, the named anchor, and direction when supported; the roadmap keeps that increment explicit.

A reviewer can then reject it, link it to an existing site, request more
evidence, or accept it as a new project site. Acceptance mints or assigns a
durable internal `site_id`; it does not write directly from the suggestion into
the master without review.

## What if OSM later contains the same site?

The OSM refresh should generate a possible identity-link task against the
existing project site. If review confirms the match, the OSM id and source
metadata are attached to the existing `site_id`.

The system should not create a second master site simply because OSM supplied a
new object id. If a duplicate candidate was created, it should be resolved by a
reviewed rejection, identity link, or duplicate-merge event.

## What if OSM conflicts with an accepted project site?

OSM is evidence, not automatic truth. Conflicts should create review tasks and
proposed change events. Examples include:

- OSM tags change away from worship use,
- OSM supplies a different denomination,
- OSM geometry moves beyond the expected tolerance,
- an OSM object disappears,
- OSM adds an opening, closure, or change date that conflicts with accepted
  evidence.

Review decides whether the conflict is a correction, observed change, duplicate,
split, merge, relocation, or source error. Accepted decisions become change
events and are included in later rebuilds and diffs.

## Can OSM date tags tell us whether a place was alive in 2013, 2018, or 2023?

They can provide useful first-pass evidence. Tags such as `start_date`,
`old_start_date`, and `end_date` can seed provisional target-year statuses and
candidate gain/loss tasks. For example, a `start_date` before 2013 with no
earlier `end_date` is a clue that the site may have been present in 2013, 2018,
and 2023. A start date between 2013 and 2018 is a possible gain window. An end
date between 2018 and 2023 is a possible loss window.

These tags still need review. OSM date values may refer to a building, an
organisation, a previous mapper's interpretation, or an imprecise local memory,
while the project needs worship use at a mappable site. OSM date tags therefore
create tasks and evidence rows. Accepted gain/loss data comes later,
through reviewed change events with source references, target-year affects,
hashes, and manifests.

## What if a source shows no building at the mapped point?

Treat this as a building-existence finding, not automatically as a worship-use
closure. The current RA interface calls this `No building present`. Use it when
street-level imagery, aerial imagery, a property record, or another source
suggests the mapped building is gone, no building is visible at that point, or
the geometry may be wrong.

If the building is absent, the evidence can support `existence_status =
absent` and `worship_use_status = not_worship`, with an evidence note saying
whether the issue appears to be demolition, relocation, bad geometry, or
something else. If the building remains but worship use has ended, record that
as closed or changed use instead.

## How does the shared RA spreadsheet fit in?

The spreadsheet is now the fallback and export format, not the preferred RA
working surface. The New Zealand task map now uses Convex so trusted assistants
can save drafts, submit unresolved notes, submit evidence for review, and skip
tasks without copying rows by hand.

If Convex is unavailable, the project can still use a project-owned Google
Sheet as the temporary evidence store. Rows from the Sheet, or exports from
Convex, should later be validated, staged, reviewed, and converted into
accepted change events. Only accepted events affect rebuilt master outputs.

The Vanuatu source-first test also supports the opposite direction: a
project-owned `site_evidence_wide` spreadsheet can be exported as CSV and
imported into Convex as submitted evidence drafts. Those rows then appear in
the reviewer portal instead of remaining a separate worksheet.

## How can RAs avoid duplicating task work?

In the current assigned workpack, RAs should rely on backend task status:
open, in progress, draft saved, unresolved note, skipped, needs review, changes
requested, reviewed, exported, or reopened. That status is visible to signed-in
project users and is meant to prevent duplicate work.

In spreadsheet fallback mode, the map only remembers copied or skipped tasks in
the same browser. A `tentatively closed` badge means the browser has copied a
row for that task. It is not a shared review decision, and it is not visible to
another browser or collaborator. In that mode, check whether the Sheet already
has a row with the same `source_record_id` (the map task id),
`matched_current_site_id`, `candidate_site_id`, or `matched_osm_id`.

Multiple rows for the same place can be correct when they capture different
evidence: for example, one row for a 2013 directory, one row for 2018 Street
View, one row for a duplicate judgement, or one row for a denomination/shared
use finding. Avoid adding a second row that repeats the same source and same
claim. When adding another row for the same place, make the new evidence or
reason clear in the evidence note.

The shared backend is that task store. Accepted review decisions then become
change events and rebuild the master; the task store itself is not the master.

## What is an unresolved note?

An unresolved note is useful but incomplete evidence. It is for cases where an
RA has found something worth preserving but cannot yet make a clean submission:
for example, a source suggests a closure but the target year remains unclear,
or a Street View check shows no visible building but the source does not prove
when worship use ended.

Submitting an unresolved note removes the task from the RA's active list and
keeps the note visible in `My work` and in the reviewer queue. A reviewer can
then accept it, reject it, defer it, mark it duplicate, or ask for more
evidence. An unresolved note does not update the master or public map.

## How will review decisions get back to RAs?

The current path is the authenticated reviewer portal. A reviewer signs in,
opens submitted evidence or unresolved notes, records a decision, and the same
decision is written back to the shared task history. The RA can then see
whether a task was accepted for export, rejected, deferred, marked as a
duplicate, or returned for more evidence.

The first New Zealand workpack is a filtered batch over that shared task list,
not a separate data silo. This matters because later New Zealand batches,
Vanuatu tasks, and missing-site nominations should merge into the same review
queue rather than becoming separate worksheets that have to be reconciled by
hand.

## What does accepted for export mean?

`accepted_for_export` means a reviewer accepts the submitted evidence for the
next governed handoff. It does not mean the public map or master database has
changed.

Accepted-for-export decisions become eligible for a frozen export bundle. That
bundle should contain the tasks, task events, evidence drafts, review
decisions, wide evidence CSV, manifest, and hashes needed for `pow` validation
and diffing. Only after the `pow` path accepts and replays the change can it
affect rebuilt research outputs or public map products.

## Will Convex be the master database?

No. Convex is the current shared live task map for the pilot: assignments,
task status, evidence drafts, reviewer comments, provisional closures, review
decisions, and export metadata. It helps multiple RAs and reviewers see the
same task status without relying on browser-local storage or a manually checked
spreadsheet.

The master database should still be rebuilt from accepted change events through
the Rust validation and replay pipeline and the research-facing R outputs.
Convex task state should export staged evidence and review decisions; it should
not directly publish to the public map or mutate canonical site records.

## Can the RA spreadsheet columns be reordered?

No. The `site_evidence_wide` header order is a data contract. The map copies a
tab-separated row in that exact order, so reordered, renamed, or missing
columns can put correct evidence into the wrong cells.

Editors should paste generated rows into column A of the next empty row under
the unchanged header. The project-owned pilot Sheet warns before header edits,
and `pow validate` should reject exported CSVs whose headers look like a known
template but no longer match its exact order.

## Should RAs type NA when a field is not applicable?

No. Leave the cell blank. Blank means missing, not applicable, or not collected
unless the field has a specific controlled value. Use values such as `unknown`,
`uncertain`, `none`, or `not_assessed` only where they appear in a dropdown or
controlled vocabulary.

Dates should use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`: for example, `2018`,
`2018-09`, or `2018-09-01`. If the source gives an imprecise or prose date,
record the interpretation in the date field only when it can be expressed in
one of those formats, set the matching precision field where available, and
preserve the original wording in the evidence note or raw-date field.

## Are target years the same for every country?

No. Target years are country-specific research or census anchors. New Zealand
currently uses 2013, 2018, and 2023 because those are the census-linked years
for the pilot. Vanuatu should begin with 1989, 1999, 2009, and 2020 because
those years align with the Vanuatu census reporting frame for religion.

The target-year fields answer a narrow question: what does a source support
about worship use at that site in that year? Other useful dates belong in
lifecycle fields.

## How do we record dates outside a country's target years?

Use the target-year columns for the country-specific status questions. Use
opening, closure, or later-change fields for other useful evidence, such as
when worship began at a site, when a building was opened, when worship use
ended, when a site was first or last seen in a source, or when a later
shared-use or multi-denominational change occurred.

For example, if a source says a site became multi-denominational in 2024, record
the target years that the source supports, then use the opening/closure/change
fields with `use_changed_date = 2024`, date precision `year`, and an evidence
note explaining the claim. If one source gives several distinct opening,
closure, or change dates, it is acceptable to create more than one evidence row
when each row carries a different source-backed claim.

Historical country protocols can allow much earlier dates. For Vanuatu, the
interface should accept valid dates from 1600 onward so RAs can record mission,
colonial, and denominational evidence without forcing it into modern census
target years.

## Will the map generate tasks automatically?

That is the target workflow. A deterministic task generator should read the
current master, OSM snapshots, RA evidence, and other source batches, then emit
review tasks such as:

- missing opening, closure, or change-date evidence,
- missing 2013, 2018, or 2023 status,
- possible duplicate sites,
- new OSM place-of-worship candidates,
- OSM objects that disappeared or changed tags,
- geometry changes,
- denomination or shared-use conflicts,
- user-nominated missing sites.

Trusted users can also create tasks manually. Generated and manual tasks should
share the same review queue but preserve their provenance.

## What is the path from task to master?

The current intended path is:

1. generated task, assigned workpack row, or `Nominate missing PoW` candidate,
2. RA draft, unresolved note, skipped task, or submitted evidence in Convex,
3. reviewer decision in the authenticated portal,
4. frozen Convex export bundle with tasks, evidence, decisions, manifest, and
   hashes,
5. `pow validate`, `pow stage`, `pow propose`, and `pow diff`,
6. accepted change events and replay into rebuilt master outputs,
7. public map products, downloads, and research summaries derived from those
   reviewed outputs.

No intake path should mutate the master directly.

## Why keep change events instead of editing rows in place?

The project studies change over time. Whether a site appeared, disappeared,
changed worship use, changed denomination, became shared, split, merged, or was
corrected is itself data. Change events preserve the evidence and decision
trail needed to reproduce 2013, 2018, 2023, and future outputs.

## Can visual evidence be used?

Yes. Dated street-level imagery and approved field observations can be useful
evidence. Use `source_type = street_imagery` for providers such as Google
Street View, Apple Look Around, Mapillary, KartaView, Bing Streetside, or
similar services. Use `source_type = field_observation` for approved RA or
project-team site visits.

Record the provider, link or agreed reference, capture or visit date, and a short site-level visual claim. Do not store screenshots, photos, videos, private conversations, or personal contact details in Git or public outputs.

The planned field-observation pilot keeps project-captured images internal by design. Restricted object storage will retain the original timestamp and location evidence; Convex will hold only guided text, workflow state, and opaque references. The pilot will have no public media derivative or public image endpoint. See `docs/field-observation-packet-spec.md`.

## If the portal accepts a PNG, PDF, spreadsheet, or another file, can that file become public?

No. Every permitted upload type must enter private project-controlled quarantine and remain private. This rule applies to images, HEIC or JPEG originals, PNG files, PDFs, spreadsheets, CSV or GeoJSON files, and any later allowlisted format. Convex may retain only an opaque reference and workflow state. The file bytes, original filename, full metadata, restricted coordinates, and durable access URLs remain outside Convex and public exports. A future decision to publish a derivative would require separate approval, rights and privacy review, a defined public product, and a new export contract. Routine visibility settings cannot authorise publication.

## How should I record a denomination or tradition?

Preserve the exact wording and record who supplied it: a named documentary source, a displayed sign or public notice, a named public community self-description, a local investigator account, or an unknown source. A self-description must come from a named public source or display unless a separately approved oral-evidence protocol applies; do not record private conversations. Separately state whether the evidence merely records a label or may indicate a correction, historical change, shared or concurrent use, or uncertainty. These relations create follow-up work rather than complete denomination events. Do not replace the starting source wording or project code, and do not invent a taxonomy code. Raw labels are evidence; versioned taxonomy mapping and acceptance remain reviewer and `pow` operations.

## Why use Convex and TypeScript if the governed stack is Rust?

The project uses each tool where it currently helps most. Convex and TypeScript
are useful for live coordination: Google sign-in, assignments, task status,
draft evidence, reviewer queues, and fast interface changes. Rust remains the
governed data spine: validation, staging, diffs, replay, master rebuilds, and
reproducible exports.

This keeps the pilot moving without giving the live task backend authority over
the research data. If the live workbench later becomes stable infrastructure,
parts of it could be rebuilt in a more Rust-centred stack. That is an
aspiration for settled, load-bearing parts, not a reason to slow the current RA
pilot.

## Does the AI recommendation label identify the model that performed the review?

No. “AI recommendation” names the advisory role, not a provider or model. Each append-only review artifact records the actual agent name, model provider, model name, prompt version, and creation time. The reviewer portal displays the recorded agent, provider, and model beside the recommendation. Existing artifacts retain their original execution details when the project changes accounts, providers, or model routes.

## Where are the function and script references?

The public Convex function inventory is
`docs/api/convex-functions.md`. It lists public queries and mutations, who may
call them, what they write, and how they fit into the workflow.

The workflow script catalogue is `docs/api/workflow-scripts.md`. It lists the
scripts that generate OSM temporal leads, curated RA workpacks, Convex seed
payloads, and export bundles for the `pow` handoff.
