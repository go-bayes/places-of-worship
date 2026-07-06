# Country data map: Tunisia (TN)

## Status

- **Tier**: C (documented exclusion)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=TN&f=json | respondent religious affiliation if present in recodes; single old survey estimate | DHS region to verify | 1988 | API metadata, PDF report, recode ZIP | reports open; recodes require DHS approval | DHS terms |
| Institut National de la Statistique census releases, https://www.ins.tn/ | census population context; public religion table not found in this sweep | governorate for population context | 2014, 2024 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: a single old DHS estimate is not a longitudinal census-affiliation source.

## Boundaries

- Official boundary files: geoBoundaries ADM1 governorates, 2017, ODbL; ADM2 delegations, 2017, ODbL.
- Boundary changes between waves and the harmonisation plan: no map build until a public multi-wave religion source is found.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass only if the country is reopened.
- Country-specific registers that could seed or verify the layer: Ministry of Religious Affairs mosque records, Catholic Archdiocese of Tunis, Jewish community heritage records.

## First visualisation

None. The sweep found only one old DHS wave and no public subnational multi-wave religion source.

## Build recipe

1. Do not build a country map using only the 1988 DHS.
2. Reopen only if INS publishes religion by governorate or a comparable multi-wave survey source is identified.
3. Boundaries: geoBoundaries `TUN ADM1` if a public source appears.
4. Region page: none until the exclusion is reversed.
5. Verification: require a second source confirming subnational religion rows.

## Risks and open questions

- No 2020-2024 public religion source was found.
- Minority religion data are sensitive and sparse.

## Deep-history potential

Archives nationales de Tunisie, Ministry of Religious Affairs records, habous/waqf records, Jewish community archives, Catholic Archdiocese of Tunis archives, and French Protectorate records.
