# Places of Worship FAQ

This FAQ explains current operating rules for the New Zealand pilot and the
planned staged data workflow. The authoritative contracts remain in schemas and
planning documents; this page is a readable guide.

## What is the unit of analysis?

The primary unit is a mappable place of worship: a building, parcel, compound,
or otherwise locatable site where worship use occurs or occurred. It is not
simply a building record and it is not always the same as a congregation or
organisation.

## Does an OpenStreetMap id define a project site?

No. The project uses durable internal `site_id` values for accepted places.
OpenStreetMap (OSM) ids are source identifiers attached to a project site. The
same principle applies to charity ids, directory ids, and provider-specific
record ids.

External ids help us match and audit evidence, but they do not define project
identity.

## What happens when a user suggests a missing place of worship?

The suggestion starts as a candidate, with a provisional `candidate_site_id`.
It should include source evidence, location evidence, target-year status where
known, and review notes.

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
- OSM adds a lifecycle date that conflicts with accepted evidence.

Review decides whether the conflict is a correction, observed change, duplicate,
split, merge, relocation, or source error. Accepted decisions become change
events and are included in later rebuilds and diffs.

## How does the shared RA spreadsheet fit in?

For the current pilot, the project uses a project-owned Google Sheet as the
working evidence store. Trusted editors may add or revise evidence rows there.
The Sheet is not the master database.

Rows from the Sheet should later be exported or ingested, validated, staged,
reviewed, and converted into accepted change events. Only accepted events affect
rebuilt master outputs.

## Will the map generate tasks automatically?

That is the target workflow. A deterministic task generator should read the
current master, OSM snapshots, RA evidence, and other source batches, then emit
review tasks such as:

- missing lifecycle evidence,
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
