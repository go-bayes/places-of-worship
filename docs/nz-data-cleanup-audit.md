# NZ Data Cleanup Audit

## Scope

This note records the first conservative cleanup pass over the committed New Zealand places dataset in April 2026.

Files affected:

- `apps/regions/nz/data/nz_places.json`
- `data/global/nz_places.json`

The aim of this pass was narrow: remove obvious false positives while preserving ambiguous cases for later review.

## Summary

The pre-cleanup NZ dataset contained 4,718 records.

The cleanup removed 97 records, leaving 4,621 records.

These false positives were OSM-derived features, but many were not mapped in OpenStreetMap as `amenity=place_of_worship`. They entered the dataset through broad inclusion rules around weak religious tags and loosely religious building metadata.

## Main false-positive classes

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

## Current rule set

The conservative cleanup pass removes records when any of the following are true:

- `country_code` is not `NZ`
- coordinates fall outside a New Zealand bounding box that allows for Chatham Islands and the antimeridian
- `tags_raw.amenity` is one of: `childcare`, `school`, `hospital`, `social_facility`, `college`, `university`, `kindergarten`, `community_centre`, `events_venue`, `library`, `pub`, `grave_yard`, `parking`
- `tags_raw.building` is `school`
- the record name contains one of: `cemetery`, `burial`, `urupa`, `office`, `residence`, `pub`, `kindergarten`

In code, the name-pattern filter uses the ordinary spelling `cemetery`.

## What this audit does not settle

This pass does not yet resolve harder scope questions such as:

- school chapels that are genuine worship spaces
- retreat centres and prayer houses
- halls that share space with congregational worship
- marae-linked sacred spaces
- historical or demolished sites

Those cases need a clearer project policy rather than a purely mechanical filter.
