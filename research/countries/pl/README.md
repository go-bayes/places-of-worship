# Country data map: Poland (PL)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Poland NSP 2021 final ethno-cultural tables](https://stat.gov.pl/spisy-powszechne/nsp-2021/nsp-2021-wyniki-ostateczne/) | census affiliation | voivodeship for public religion detail found in this sweep | 2011, 2021; historical national series farther back | XLSX/PDF/web | open | Statistics Poland reuse terms |
| [ISKK e-Dominicantes](https://iskk.pl/dominicantes/) | Catholic attendance counts: dominicantes and communicantes | parish input, public reporting by diocese | annual, current workflow 2025; dashboard/report shows 2014-2024 series | web/PDF/report | partly open; parish panel requires codes | ISKK terms |

## Boundaries

- Official boundary files: Statistics Poland TERYT and state geodetic boundaries; Eurostat GISCO LAU can support gmina and voivodeship joins.
- Boundary changes between waves and the harmonisation plan: anchor a first product on 2021 voivodeships or Catholic dioceses; gmina-level census religion needs a separate table confirmation before use.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep; run a country extract before build.
- Country-specific registers that could seed or verify the layer: ISKK parish reporting, Catholic diocesan directories, Ministry of Interior register of churches and religious associations.

## First visualisation

Catholic practice by diocese, annual dominicantes and communicantes series from ISKK, with census-affiliation context by voivodeship for 2011 and 2021.

## Build recipe

1. Extract: ISKK Annuarium 2024 and e-Dominicantes public material; preserve the distinction between attendance counts and census affiliation.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with separate `construct` values for Catholic attendance and census affiliation.
3. Boundaries: diocesan polygons from church GIS/manual digitisation, or voivodeships from GISCO/National Register of Boundaries.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national ISKK totals, diocese totals, and census voivodeship totals; record ISKK access limits.

## Risks and open questions

- ISKK measures Catholic practice rather than affiliation for all religious groups.
- Parish-level panel data are not publicly downloadable.
- Diocese and civil boundaries do not align.

## Deep-history potential

Diocesan and parish archives, Catholic schematisms, state archive parish-register holdings, Jewish Historical Institute materials, Lutheran and Orthodox consistory records, and pre-war statistical yearbooks.
