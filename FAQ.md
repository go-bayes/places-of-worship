# Places of Worship FAQ

This FAQ explains current operating rules for the New Zealand pilot and the
planned staged data workflow. The authoritative contracts remain in schemas and
planning documents; this page is a readable guide.

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

The suggestion starts as a candidate, with a provisional `candidate_site_id`.
Here, "missing" usually means missing from the project map or master list. OSM
may already contain a candidate object, and that OSM id should be recorded as
source or matching evidence rather than treated as the project identity.

The candidate should include source evidence, location evidence, target-year
status where known, any relevant OSM object ids, and review notes.

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

## How does the shared RA spreadsheet fit in?

The spreadsheet is now the fallback and export format, not the preferred RA
working surface once the shared backend is enabled. The New Zealand task map is
being wired to Convex so trusted assistants can save drafts, submit evidence
for review, and skip tasks without copying rows by hand.

If Convex is unavailable, the project can still use a project-owned Google
Sheet as the temporary evidence store. Rows from the Sheet, or exports from
Convex, should later be validated, staged, reviewed, and converted into
accepted change events. Only accepted events affect rebuilt master outputs.

## How can RAs avoid duplicating task work?

When the shared backend is enabled, RAs should rely on backend task status:
open, draft saved, skipped, needs review, reviewed, or reopened. That status is
visible to signed-in project users and is meant to prevent duplicate work.

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

## Will Convex be the master database?

No. Convex is a strong candidate for the shared live task map: assignments,
task status, evidence drafts, reviewer comments, provisional closures, and
weekly project-review queues. It should help multiple RAs and reviewers see
the same task status without relying on browser-local storage or a manually
checked spreadsheet.

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

The intended path is:

1. raw source or user suggestion,
2. staged evidence row or task,
3. validation,
4. reviewer decision,
5. accepted change event,
6. master rebuild,
7. reviewer and research diffs.

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

Record the provider, link or agreed reference, capture or visit date, and a
short site-level visual claim. Do not store screenshots, photos, videos,
private conversations, or personal contact details in Git or public outputs
unless a later approved media workflow covers consent, licensing, quarantine,
and review.
