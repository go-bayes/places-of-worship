# Country data map: Canada (CA)

## Status

- **Tier**: A (buildable now)
- **Build state**: data map built with census-division fallbacks
- **Last verified**: 2026-07-07; verification URLs:
  <https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/page.cfm?Lang=E&SearchText=Canada&DGUIDlist=2021A000011124&GENDERlist=1,2,3&STATISTIClist=1&HEADERlist=0>
  and
  <https://www12.statcan.gc.ca/nhs-enm/2011/dp-pd/prof/details/Page.cfm?Lang=E&Geo1=PR&Code1=01&Data=Count&SearchText=Canada&SearchType=Begins&SearchPR=01&A1=All&B1=All&GeoLevel=PR&GeoCode=01>

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistics Canada, Census Profile 2021, religion topic | census religious affiliation, 25 percent sample | census division in the shipped map; census subdivision source rows were extracted, but CSD boundary output exceeded the 4 MB layer budget | 2021 | web table and CSV/TAB/IVT complete-geography downloads | open | Statistics Canada Open Licence |
| Statistics Canada, 2011 National Household Survey Profile, religion topic | voluntary survey religious affiliation | census division in the shipped map; CSD source rows failed province and national reconciliation | 2011 | web table and CSV/TAB downloads | open | Statistics Canada Open Licence |
| Statistics Canada, 2001 Census tabulation `95F0450XCB2001006` | census religious affiliation, 20 percent sample | census division | 2001 | web table and XML full table | open | Statistics Canada Open Licence |
| Statistics Canada historical census volumes | census religious affiliation | varies; province or county-equivalent extraction likely | 1871 onward where asked | scanned volumes or PDFs | open | confirm volume-level terms |

## Boundaries

- Official boundary files: Statistics Canada 2021, 2011, and 2001
  cartographic boundary files. The shipped map uses each wave's own census
  division vintage: `cd_2021`, `cd_2011`, and `cd_2001`.
- No cross-vintage correspondence was built. The timeline switches the
  selected boundary level by year.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Canada Revenue Agency charities listings,
  provincial heritage registers, Canadian Register of Historic Places,
  Library and Archives Canada, diocesan archives, denominational yearbooks,
  local directories, fire-insurance plans, newspapers.

## First visualisation

Religious-affiliation percent by census division for 2001, 2011, and 2021,
rendered on each wave's own Statistics Canada cartographic boundaries. The
2021 CSD source rows were extracted, but the CSD boundary layer did not fit the
4 MB budget after the required simplification. The 2011 CSD source rows failed
province and national reconciliation. The map therefore uses the validated 2011 CD
product.

## Build recipe

1. Extract: use the 2021 Census Profile complete-geography CSV for Canada,
   provinces, territories, CDs, and CSDs (`GEONO=005`), the 2011 National
   Household Survey CD CSV (`CSV701`) after the CSD reconciliation failure, and
   the 2001 XML tabulation `95F0450XCB2001006`.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join 2021 DGUID CD codes to `lcd_000a21a_e.zip`, 2011 CDUID
   codes to `gcd_000b11a_e.zip`, and 2001 CDUID codes to the polygonised
   `gcd_000b01a_e.zip` AVCE00 boundary.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare area sums with national and province totals, verify
   join coverage, and record the Statistics Canada attribution string.

## Risks and open questions

- The 2011 source is the voluntary National Household Survey. The shipped rows
  carry `voluntary_survey_nhs`.
- Religion was asked in 2001 and 2021, with a 2011 survey bridge; category
  and sample-design differences need a source-era label.
- Very small census subdivisions may have suppression or high sampling error;
  Canada currently ships at CD for all built waves.

## Deep-history potential

Canada has religion counts in historical census reporting from 1871 onward,
with much of the older material in scanned Statistics Canada or Library and
Archives Canada volumes. Site histories can use city directories, fire
insurance plans, provincial archives, parish and diocesan records, local
newspapers, the Canadian Register of Historic Places, and provincial heritage
inventories.

## Known presentation limitation (2026-07-07)

The per-vintage level design gives each census year its own store, so
popups show one year at a time and the per-row caveat asterisk cannot
fire (a flag universal to a single-year store distinguishes nothing
within it). The 2011 NHS voluntary-survey caveat therefore rides the
unconditional popup denominator note and the onboarding copy, which
name the NHS in every popup. The religious-change metric is not
exposed: year-over-year comparison cannot span level-switching stores.
