# Country data map: Canada (CA)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; verification URLs:
  <https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/page.cfm?Lang=E&SearchText=Canada&DGUIDlist=2021A000011124&GENDERlist=1,2,3&STATISTIClist=1&HEADERlist=0>
  and
  <https://www12.statcan.gc.ca/nhs-enm/2011/dp-pd/prof/details/Page.cfm?Lang=E&Geo1=PR&Code1=01&Data=Count&SearchText=Canada&SearchType=Begins&SearchPR=01&A1=All&B1=All&GeoLevel=PR&GeoCode=01>

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistics Canada, Census Profile 2021, religion topic | census religious affiliation, 25 percent sample | dissemination area in profile downloads; use census subdivision first | 2021 | web table and CSV/TAB/IVT complete-geography downloads | open | Statistics Canada Open Licence |
| Statistics Canada, 2011 National Household Survey Profile, religion topic | survey religious affiliation | complete-geography downloads; use census subdivision or census division first | 2011 | web table and CSV/TAB downloads | open | Statistics Canada Open Licence |
| Statistics Canada, 2001 Census Profile, religion table catalogue `97F0006XCB2001006` | census religious affiliation | profile geography; use census division first | 2001 | web table, CSV view, IVT/XML full table | open | Statistics Canada Open Licence |
| Statistics Canada historical census volumes | census religious affiliation | varies; province or county-equivalent extraction likely | 1871 onward where asked | scanned volumes or PDFs | open | confirm volume-level terms |

## Boundaries

- Official boundary files: Statistics Canada 2021 cartographic boundary files,
  including census subdivisions
  <https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/files-fichiers/lcsd000a21a_e.zip>
  and census divisions
  <https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/files-fichiers/lcd_000a21a_e.zip>.
- Use 2021 census subdivision boundaries for the first modern map and add
  2011/2001 correspondence work before interpreting change.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Canada Revenue Agency charities listings,
  provincial heritage registers, Canadian Register of Historic Places,
  Library and Archives Canada, diocesan archives, denominational yearbooks,
  local directories, fire-insurance plans, newspapers.

## First visualisation

Religious-affiliation percent by census subdivision for 2011 and 2021,
anchored on 2021 census subdivision boundaries. Add 2001 at census division
first if subdivision harmonisation is slow.

## Build recipe

1. Extract: start with the 2021 Census Profile complete-geography CSV for
   census metropolitan areas, census agglomerations, and census subdivisions
   (`GEONO=003`), then extract the 2011 National Household Survey complete
   geography CSV for the same practical level.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join `DGUID` or CSDUID-style codes to `lcsd000a21a_e.zip`;
   use census division boundaries if suppression or harmonisation makes census
   subdivision output unstable.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare area sums with national and province totals, verify
   join coverage, and record the Statistics Canada attribution string.

## Risks and open questions

- The 2011 source is the voluntary National Household Survey. Label 2011
  separately from census long-form waves.
- Religion was asked in 2001 and 2021, with a 2011 survey bridge; category
  and sample-design differences need a source-era label.
- Very small census subdivisions may have suppression or high sampling error.

## Deep-history potential

Canada has religion counts in historical census reporting from 1871 onward,
with much of the older material in scanned Statistics Canada or Library and
Archives Canada volumes. Site histories can use city directories, fire
insurance plans, provincial archives, parish and diocesan records, local
newspapers, the Canadian Register of Historic Places, and provincial heritage
inventories.
