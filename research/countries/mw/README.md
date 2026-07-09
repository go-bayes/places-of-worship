# Country data map: Malawi (MW)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (2018 wave)
- **Last verified**: 2026-07-09 (built: NSO 2018 Malawi PHC Main Report table E5, 32 district/city rows folded to 28 districts; geoBoundaries MWI ADM2 2020; district sums reconcile exactly to the MALAWI national row before and after city folding)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| National Statistical Office 2018 Malawi Population and Housing Census Main Report, https://www.nsomalawi.mw/2018-population-and-housing-census/ | census denomination | district (with four cities broken out) | 2018 | PDF report table (E5) requires extraction | open web | licence not stated |
| NSO 2008 and 1998 census reports, https://www.nsomalawi.mw/ | census religion | national only in the main report | 1998, 2008 | PDF/report | open web | licence not stated |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=MW&f=json | respondent religious affiliation in survey recodes; survey estimates | DHS region | 1992-2024 | API metadata, reports, recode ZIPs | reports open; recodes require DHS approval | DHS terms |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay in separate layers.

**2008 wave probe (2026-07-09)**: not retrievable at district level and not comparable. The 2008 Malawi PHC Main Report reports religion only in Table 3.2, a single national table with four coarse categories alongside 1998 — Christian 82.7%, Muslim 13.0%, Other 1.9%, None 2.5% (2008 total 13,029,498). It carries no district breakdown, and the four coarse categories are not comparable to the 2018 ten-denomination table. Only the 2018 wave is shipped; the 2008 sub-national wave is deferred and recorded in the manifest's `deferred_sources`.

**Cities-vs-districts decision**: Table E5 reports 32 rows — the 28 districts plus four cities broken out separately (Lilongwe City, Blantyre City, Zomba City, Mzuzu City). geoBoundaries MWI ADM2 has only the 28 district polygons and no city polygons (`admUnitCount` 28). Each city is folded into the district that encloses it (Lilongwe City into Lilongwe, Blantyre City into Blantyre, Zomba City into Zomba, Mzuzu City into Mzimba), so the 28 mapped district values cover the whole district including its city. The 32-row and 28-district totals both reconcile exactly to the MALAWI national row.

**Category mapping (2018, Table E5)**: religious affiliation combines the nine named-denomination columns (Catholic, CCAP, SDA/Baptist/Apostolic, Anglican, Pentecostal, Other Christian Denominations, Islam, Traditional, Other Denomination); no religion is the No Religion column. Table E5 allocates every usual resident to one of these ten categories with no not-stated residual, so the denominator is the district total. Table E5's Other Denomination column folds Buddhism, Hinduism, and other non-Christian denominations that the national Table 3.4 reports as separate rows (992,304 nationally = 983,587 other non-Christian + 5,506 Buddhism + 3,211 Hinduism). Nationally: total 17,563,749; religious affiliation 17,186,965 (97.85%); no religion 376,784 (2.15%).

## Access the data yourself

This project does not redistribute source data; the map shows derived
rates with attribution. To obtain the data from the source of record:

- **Source of record**: National Statistical Office of Malawi, [2018 Malawi Population and Housing Census](https://www.nsomalawi.mw/2018-population-and-housing-census/).
- **Exact table**: Main Report, Table E5 "Population of Malawi by Denomination, Region, and District, 2018" (Series E, Social Tables). The Main Report PDF is hosted by [UNFPA Malawi](https://malawi.unfpa.org/sites/default/files/resource-pdf/2018%20Malawi%20Population%20and%20Housing%20Census%20Main%20Report%20(1).pdf).
- **Boundaries**: geoBoundaries MWI ADM2 (2020 districts), CC BY 3.0 IGO — [metadata/API](https://www.geoboundaries.org/api/current/gbOpen/MWI/ADM2/).
- **Licence**: NSO Malawi publishes the census report for open download and requests attribution; no explicit reuse licence is stated. geoBoundaries MWI ADM2 is CC BY 3.0 IGO (boundary source National Statistics Office of Malawi and OCHA ROSEA via HDX).
- **Our extraction script**: [`scripts/build_mw_area_summary.R`](../../../scripts/build_mw_area_summary.R) — parses Table E5 from the Main Report PDF with `pdftotext -layout`, folds the four cities into their districts, derives the two headline metrics, joins to the geoBoundaries districts, and writes the `area_summary` products.
- **Retrieval recipe and hashes**: [`docs/manifests/mw-census-religion-2018.json`](../../../docs/manifests/mw-census-religion-2018.json) — URLs, retrieval steps, and SHA-256s for every object used.

## Boundaries

- Official boundary files: geoBoundaries ADM2 districts, 2020, CC BY 3.0 IGO (28 district polygons; no separate city polygons).
- Boundary changes between waves and the harmonisation plan: anchor on 2018/2020 districts; the four cities fold into their enclosing districts.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Malawi Council of Churches, Episcopal Conference of Malawi, Muslim Association of Malawi, CCAP synod records.

## First visualisation

Census religious-affiliation percent by district, 2018, on 2020 district boundaries. (Shipped.)

## Build recipe

1. Extract: Table E5 from the 2018 PHC Main Report with `pdftotext -layout`; parse the both-sexes block only. 2008 and 1998 religion are national-only in the main reports.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `MWI ADM2`, join by district name after folding cities into parents.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals (32 rows and 28 districts), join coverage, licence and attribution strings.

## Risks and open questions

- Current NSO pages are client-rendered; the Main Report PDF was retrieved from the UNFPA Malawi mirror of the official NSO report.
- Religious categories changed between 2008 (four coarse categories) and 2018 (ten denominations), so no comparable time series is available.

## Deep-history potential

National Archives of Malawi, Livingstonia Mission archives, Universities' Mission to Central Africa records, CCAP synod archives, Catholic mission archives, and historical Nyasaland newspapers.
