# NZ Data Cleanup Audit

## Scope

This note records the staged cleanup passes over the committed New Zealand places dataset in April 2026.

Files affected:

- `apps/regions/nz/data/nz_places.json`
- `data/global/nz_places.json`

The aim of this pass was narrow: remove obvious false positives while preserving ambiguous cases for later review.

## Summary

The pre-cleanup NZ dataset contained 4,718 records.

Pass 1 removed 97 obvious false positives, leaving 4,621 records.

Pass 2 removed a further 978 low-information and institutional priority-1 records, leaving 3,643 records.

Pass 3 removed 7 `Masonic Centre` records from the `hall_centre_house_site` bucket, leaving 3,636 records.

Pass 4 removed 7 church-hall and parish/community-centre support buildings that duplicated nearby mapped churches, leaving 3,629 records.

Total removed so far: 1,089 records.

These false positives were OSM-derived features, but many were not mapped in OpenStreetMap as `amenity=place_of_worship`. They entered the dataset through broad inclusion rules around weak religious tags and loosely religious building metadata.

## Pass 1: obvious false positives

Removal counts by amenity tag:

- `<missing>`: 51
- `grave_yard`: 25
- `community_centre`: 7
- `place_of_worship`: 6
- `childcare`: 2
- `pub`: 2
- `college`: 2
- `events_venue`: 1
- `library`: 1

Pattern counts from names and metadata:

- cemetery or burial sites: 48
- office or residence records: 6
- community or event facilities: 6
- childcare or school facilities: 4
- other obvious false positives: 33

## Examples

Childcare or school:

- `Moriah Kindergarten`
- `College of Saint John the Evangelist`
- `South Pacific Bible College`
- `Haleema Kindergarten - Haleema Kindergarten Trust`

Office or residence:

- `Bishop's Residence`
- `Saint Barnabas Church Office`
- `Saint Andrews Office`
- `Manukau Memorial Gardens Office & Chapel`
- `Newlands Baptist Church Office`

Cemetery or burial:

- `St Mary’s Church cemetery`
- `Lyttelton Anglican Cemetery`
- `Lyttelton Catholic and Public Cemetery`
- `Albany Village Cemetery`
- `Warkworth Anglican Cemetery`

Community or event facility:

- `Saint Peter’s Parish Centre`
- `Knox Centre`
- `Church Hall`
- `The Homestead Community House`
- `Saint Peters Church Hall`

Other obvious false positives:

- `The Church Pub`
- `Good Union`
- `Anglican Place of Worship`
- `Christian Place of Worship`
- `Kāhui St David's`

## Pass 1 rule set

The conservative cleanup pass removes records when any of the following are true:

- `country_code` is not `NZ`
- coordinates fall outside a New Zealand bounding box that allows for Chatham Islands and the antimeridian
- `tags_raw.amenity` is one of: `childcare`, `school`, `hospital`, `social_facility`, `college`, `university`, `kindergarten`, `community_centre`, `events_venue`, `library`, `pub`, `grave_yard`, `parking`
- `tags_raw.building` is `school`
- the record name contains one of: `cemetery`, `burial`, `urupa`, `office`, `residence`, `pub`, `kindergarten`

In code, the name-pattern filter uses the ordinary spelling `cemetery`.

## Pass 2: low-information priority-1 records

This pass removed three narrow classes from the retained NZ dataset:

- 906 placeholder-name records of the form `Place of Worship <id>` where `tags_raw` was empty
- 65 generic labels such as `Christian Place of Worship` or `Anglican Place of Worship` where both `amenity` and `building` were missing
- 7 school-like or seminary-like institutional sites that were not separately mapped as chapels or explicit `place_of_worship` features

These records were not removed because they were definitely not places of worship. They were removed because they carried too little supporting information to justify keeping them in the published dataset ahead of better-documented sites.

The current manual review queue in `docs/nz-manual-review-queue.md` starts after this second pass.

## Pass 3: obvious non-worship centres in the hall/centre/house bucket

This pass applied one additional narrow exclusion:

- records named `Masonic Centre`

Seven records matched and were removed from the published NZ dataset:

- `Bay of Plenty Masonic Centre`
- `Whanganui Masonic Centre`
- `Wairoa Masonic Centre`
- `Whangarei Masonic Centre`
- `Morrinsville Masonic Centre`
- `Northcote Masonic Centre`
- `Thames Masonic Centre`

These records had generally been tagged as `amenity=place_of_worship` in OSM, but they are not places of worship in the project sense and were better treated as false positives than as ambiguous review candidates.

## Pass 4: duplicate support buildings beside mapped churches

This pass removed a narrow class of support-building records from the `hall_centre_house_site` bucket:

- names containing `church hall`, `parish centre`, or `community centre`
- within 80 metres of a separately mapped worship site
- with either shared identity tokens or a denomination-only support-building label

Seven records matched and were removed from the published NZ dataset:

- `St Columba Community Centre`
- `Greyfriars church hall`
- `St Mark's Parish Centre`
- `All Saints Church Hall`
- `St James Church Hall`
- `Church Hall`
- `Methodist Church Hall`

These records looked like adjunct halls or parish facilities rather than the primary place of worship, because a corresponding church was already mapped immediately beside them.

## Current queue after pass 4

The remaining manual review queue contains 730 records:

- 280 priority 1
- 372 priority 2
- 78 priority 3

## What this audit does not settle

This pass does not yet resolve harder scope questions such as:

- school chapels that are genuine worship spaces
- retreat centres and prayer houses
- halls that share space with congregational worship
- marae-linked sacred spaces
- historical or demolished sites

Those cases need a clearer project policy rather than a purely mechanical filter.
