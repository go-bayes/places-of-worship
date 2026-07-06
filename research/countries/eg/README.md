# Country data map: Egypt (EG)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=EG&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=EG&f=json | respondent religious affiliation where recodes expose it; survey estimates | DHS governorate/region to verify | 1988, 1992, 1995, 2000, 2003, 2005, 2008, 2014 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| CAPMAS census releases, https://www.capmas.gov.eg/ | census population context; public religion table not verified in this sweep | governorate for population context | 2006, 2017 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation, census population counts, Coptic church records, and Islamic waqf records are different sources.

## Boundaries

- Official boundary files: geoBoundaries ADM1 governorates, 2017, ODbL; ADM2 marakiz and aqsam, 2020, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: use governorates only if religion is exposed in the recodes.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Ministry of Awqaf mosque records, Coptic Orthodox dioceses, Catholic and Protestant church directories, heritage registers.

## First visualisation

No public census religion map. A cautious DHS-derived survey map by governorate is possible only after confirming that religion is present and meaningful in the recodes.

## Build recipe

1. Extract: inspect DHS IR/MR dictionaries for religion variables before any mapping.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `EGY ADM1`, joined to DHS governorate labels where valid.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md` only after sensitivity review.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- Religious minority measurement is sensitive and may not be adequately represented in DHS public tables.
- No 2020-2024 DHS religion wave was found.

## Deep-history potential

Dar al-Wathaiq, Coptic Orthodox Patriarchate archives, monastery archives, Ministry of Awqaf records, Jewish community records, and Ottoman/colonial gazetteers.
