# NZ Manual Review Queue

## Scope

This queue lists ambiguous NZ records that survived the conservative cleanup pass and still need human review.

Source file: `apps/regions/nz/data/nz_places.json`

## Summary

- current NZ dataset size: 3643
- queued for manual review: 743
- priority 1 records: 280
- priority 2 records: 385
- priority 3 records: 78

## Categories

- `generic_worship_label`: 78
- `institutional_site`: 7
- `placeholder_name`: 195
- `hall_centre_house_site`: 374
- `retreat_or_prayer_site`: 11
- `missing_core_tags`: 78

## Suggested review order

- Start with priority 1: placeholder names, generic worship labels, and institutional sites.
- Continue with priority 2: retreat, prayer, centre, hall, house, and community-labelled sites.
- Leave priority 3 for last: records with both `amenity` and `building` missing.

## Example records

### generic_worship_label

- `Anglican Place of Worship` (w373165224)
- `Anglican Place of Worship` (w650941166)
- `Anglican Place of Worship` (w778232407)
- `Christian Place of Worship` (n3461337567)
- `Christian Place of Worship` (n4170652906)
- `Christian Place of Worship` (n4170652907)
- `Christian Place of Worship` (n5546977389)
- `Christian Place of Worship` (n7264926466)

### institutional_site

- `Arataki School Hall` (w222749634)
- `Bishop Viard College Chapel` (w927686244)
- `Catholic Cathedral College Chapel` (w1027560212)
- `Christ's College Chapel` (w504382170)
- `Craighead Diocesan School Chapel` (w412567214)
- `Sacred Heart Chapel (remaining part of Erskine College)` (w670185293)
- `Saint John's College Chapel` (w289994446)

### placeholder_name

- `Place of Worship 1051810034` (w1051810034)
- `Place of Worship 1205663183` (w1205663183)
- `Place of Worship 1207073636` (w1207073636)
- `Place of Worship 128976134` (w128976134)
- `Place of Worship 1298726613` (w1298726613)
- `Place of Worship 13078926467` (n13078926467)
- `Place of Worship 169261262` (w169261262)
- `Place of Worship 223255811` (w223255811)

### hall_centre_house_site

- `Abundant Life Centre / Abundant Life Church Wellington` (w256521526)
- `Abundant Life Community Church` (w673517317)
- `Advance Christian Outreach Centre` (w200088290)
- `Afrikaanse Christian Church (Wellington) / Plimmerton Hall` (w618481252)
- `Agape Wesleyan Methodist Tongan / Jack Dickey Community Hall` (w607882199)
- `Al Iqra Islamic Centre - (Takanini Islamic Centre)` (n12527833992)
- `Al Mustafa Charity Centre` (n12501069621)
- `Al Qadiri Islamic Centre Manawatu` (w778740428)

### retreat_or_prayer_site

- `Bethel Prayer Centre / Assembly of God` (w363306829)
- `Chandrakirti Meditation Centre` (n321952895)
- `Dhamma Gavesi Meditation Centre` (w627688720)
- `House Of Prayer` (n5321189334)
- `Muslim Prayer Room` (n10742555935)
- `Muslims Students Association Prayer Rooms` (n9989548739)
- `Olive Prayer Centre` (w338895310)
- `Our Lady of Fourvière House of Prayer and Retreat` (n7185760945)

### missing_core_tags

- `Abbott Family Graves` (w1120933093)
- `All Saint's Kaukapakapa Church` (w802054756)
- `Baptist Place of Worship` (w1199676732)
- `Baptist Place of Worship` (w747603934)
- `Baptist Place of Worship` (w747951148)
- `Bhudda Chey Mongkul Monastery` (w1355446188)
- `Brethren Place of Worship` (w1344430588)
- `Brethren Place of Worship` (w738960577)

## Files

- detailed queue CSV: `docs/nz-manual-review-queue.csv`
