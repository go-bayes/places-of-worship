# Country data map: United States (US)

## Status

- **Tier**: A (live, with source caveats)
- **Build state**: map live at county level; README card is authoritative
- **Last verified**: 2026-07-07; verification URLs:
  <https://www.nhgis.org/>, <https://www.usreligioncensus.org/>, and
  <https://www.thearda.com/>

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| IPUMS NHGIS nineteenth-century census church statistics | church edifices, seating, and property value by denomination | county | 1850, 1860, 1870, 1890 | API extract, CSV, codebooks | registered IPUMS API key | raw redistribution restricted; derived attributed products need licence confirmation |
| IPUMS NHGIS Census of Religious Bodies | members reported by religious bodies | county | 1906, 1916, 1926, 1936 | API extract, CSV, codebooks | registered IPUMS API key | raw redistribution restricted; derived attributed products need licence confirmation |
| U.S. Religion Census / ARDA county files | congregations, adherents, or members reported by religious bodies | county | 1952, 1971, 1980, 1990, 2000, 2010, 2020 | Excel/SPSS/Stata/ASCII | open with citation notice | cite ARDA and collectors; formal redistribution terms need final confirmation |

## Boundaries

- Official boundary files: existing live map uses U.S. Census Bureau 2020
  counties for 1952-2020 and NHGIS period county boundaries for 1850, 1860,
  1870, 1890, and 1930.
- The current live product keeps nineteenth-century waves on period
  boundaries and uses 1930 boundaries for 1906-1936.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run as a separate US survey
  output.
- Country-specific registers: National Register of Historic Places, state
  historic preservation offices, city directories, denominational yearbooks,
  Sanborn and other fire-insurance maps, HathiTrust, Internet Archive,
  newspapers, congregation archives.

## First visualisation

Already live: county-level institutional religion rate, 1850-2020. The map
labels the construct shift from seating to members to adherents or members.

## Build recipe

1. Extract: preserve the existing NHGIS and ARDA/RCMS build scripts described
   in `research/countries/us/README.md`.
2. Governed product: existing `area_summary` outputs and manifests remain the
   record for the live US map.
3. Boundaries: keep NHGIS `GISJOIN` joins for period counties and 2020 county
   joins for ARDA/RCMS.
4. Region page: existing shared region-map runtime is already configured.
5. Verification: maintain state and national validation against NHGIS and
   ARDA/RCMS totals, and resolve the NHGIS derived-product licence question.

## Risks and open questions

- The United States census asks no self-identification religion question.
- The live layer is institutional religion. Census affiliation is not
  measured.
- Source constructs change across eras; changes should be interpreted as
  descriptive institutional shifts.

## Deep-history potential

NHGIS already supplies county-level institutional religion from 1850. Further
site-level depth can come from denominational yearbooks, Sanborn maps, city
directories, state historical societies, church archives, newspapers,
HathiTrust, Internet Archive, local histories, and county atlases.
