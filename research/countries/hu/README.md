# Country data map: Hungary (HU)

## Status

- **Tier**: A (buildable now)
- **Build state**: data extracted
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Hungarian Central Statistical Office (KSH) Census Database dataflow WBS008](https://nepszamlalas2022.ksh.hu/en/database/) | census affiliation from a voluntary question | county, with settlement type as a dimension | 2001, 2011, 2022 | public JSON API and web export | open | KSH Census 2022 terms: CC BY 4.0, with the section 3.3 database-selection caveat |
| [KSH settlement map](https://map.ksh.hu/nepszamlalas/?locale=en) | selected census-affiliation shares | settlement | 2011, 2022 | ArcGIS REST and web map | open | KSH attribution; insufficient category and wave coverage for the primary product |

KSH dataflow `WBS008` supports a complete three-wave county product. The settlement map covers two waves and four religion shares and therefore cannot supply the required full three-wave classification.

## Access the data yourself

- **Source of record**: [KSH Census Database](https://nepszamlalas2022.ksh.hu/en/database/), dataflow `WBS008`, API publication `V67`.
- **Exact table**: “Population by religion, county and type of settlement”; use county codes `HU110` through `HU333`, settlement type `HU` (Total), and all `VALLAS_V2` rows for 2001, 2011, and 2022.
- **Licence**: [KSH Census 2022 terms](https://nepszamlalas2022.ksh.hu/felhasznalasi-feltetelek) apply CC BY 4.0 with KSH attribution and state a section 3.3 caveat for individually selected internal-database files.
- **Our extraction script**: `scripts/build_hu_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/hu-census-religion-2001-2022.json`.
- **Route evidence**: `research/countries/hu/route-probe.md`.

## Boundaries

- Boundary file: the Geographic Information System of the Commission, Eurostat (GISCO), Nomenclature of Territorial Units for Statistics (NUTS) level 3 2021 layer. The build filters the layer to the 20 Hungarian county codes and simplifies it through `scripts/lib/simplify_boundary.R`.
- Boundary terms: GISCO download provisions and Eurostat reuse policy, with attribution to Eurostat GISCO and `© EuroGeographics for the administrative boundaries`.
- Geometric stability of Hungarian county boundaries across 2001, 2011, and 2022 was not verified. The single 2021 frame join rests on identity of the 20 NUTS level 3 codes in KSH `WBS008` and GISCO.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Catholic, Reformed, Lutheran, Jewish, and Muslim community directories; KSH settlement gazetteer.

## First visualisation

Religious affiliation and `Nem vallásos` (No religion) among religion-question respondents by county, 2001, 2011, and 2022, on GISCO NUTS 3 2021 boundaries.

## Build recipe

1. Extract: query KSH `WBS008` publication `V67` for the 20 county codes, settlement type Total, all three waves, and every religion row.
2. Governed product: `area_summary` per `schemas/area-summary.schema.json`, with the stated-response denominator `TOTAL - Nem válaszolt`.
3. Boundaries: filter GISCO NUTS 3 2021 to Hungary, join by NUTS 3 code, and simplify through the shared helper.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: require every mutually exclusive category to sum to the county total, every published county category to sum to the national row, all three waves to be present, and all 20 geometries to be valid and distinct.

## Risks and open questions

- National `Nem válaszolt` shares were 10.8286% in 2001, 27.1578% in 2011, and 40.1154% in 2022. The headline shares are among stated responses, and the non-response category remains separate. The responding share of the population changed substantially across waves; cross-wave share changes may therefore reflect changing respondent composition as well as changing affiliation. The change metric compares stated-response shares only.
- KSH publishes `Nem válaszolt` as one category. It does not publish separate refusal and unknown rows in `WBS008`, and the product does not invent them.
- The settlement map remains a possible two-wave extra level, but its four published shares cannot reproduce the complete classification.

## Deep-history potential

Hungarian Central Statistical Office historical census volumes, Catholic schematisms, Reformed and Lutheran parish archives, Jewish community records, and county archives.
