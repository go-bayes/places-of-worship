# Country data map: Rwanda (RW)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live
- **Last verified**: 2026-07-09 (verification: https://www.statistics.gov.rw/statistical-publications; https://www.geoboundaries.org/api/current/gbOpen/RWA/ADM2/)

Two waves ship at district level: census 2012 (RPHC4) and census 2022 (RPHC5),
on the 30 post-2006 districts. Correction to the earlier survey note: the 2022
census did **not** drop the religion question. RPHC5 collected religious
affiliation with ten modalities (the 2012 nine plus an added Other Christians
category), and the RPHC5 Social-cultural Characteristics thematic report
publishes it by sector with an exact district Total row per district. Both
waves therefore map; nationally, no religion rose from about 2.5 percent (2012)
to about 3.0 percent (2022) and the Catholic share fell from about 44 to about
40 percent.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| NISR RPHC5 thematic report: Social-cultural Characteristics of the Population (Table D.1), via https://www.statistics.gov.rw/statistical-publications | census affiliation | district (exact district Total row; sectors below) | 2022 | PDF | open web | open download, attribution requested, no explicit reuse licence stated |
| NISR RPHC4 thematic report: Socio-cultural Characteristics of the Population (Table 26), via https://www.statistics.gov.rw/statistical-publications | census affiliation | sector (aggregated to district) | 2012 | PDF | open web | open download, attribution requested, no explicit reuse licence stated |
| Rwanda Data Portal religion series, https://rwanda.opendataforafrica.org/ | census affiliation | district where exposed by table | 2012, 2022 | web table/API portal | open web | portal terms (recorded as alternative access point; not used) |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay in separate layers.

## Boundaries

- Official boundary files: geoBoundaries ADM2 districts, 2012, CC BY 4.0; ADM1 provinces, 2020, CC BY 4.0.
- Boundary changes between waves and the harmonisation plan: anchor on the 30-district system and retain sector identifiers only if both waves expose them.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Rwanda Governance Board organisation records, Rwanda Interfaith Council, Catholic dioceses, Protestant Council of Rwanda.

## First visualisation

Census religious-affiliation percent by district, 2012 and 2022, on the 30-district boundary set.

## Build recipe

1. Extract: start with the RPHC5 district religion table, then add the RPHC4 socio-cultural religion table.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `RWA ADM2`, join by district name after standardising Kigali district labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with
attribution. To obtain the data from the source of record:

- **Source of record**: National Institute of Statistics of Rwanda, statistical
  publications, https://www.statistics.gov.rw/statistical-publications
- **Exact tables**: RPHC4 (2012) *Socio-cultural Characteristics of the
  Population*, Table 26 (distribution % of the resident population by religious
  affiliation and sector of residence); RPHC5 (2022) *Social-cultural
  Characteristics of the Population*, Table D.1 (the same table, with an exact
  district Total row per district).
- **Licence**: NISR census reports are open downloads with attribution requested
  and no explicit reuse licence stated. Boundaries are geoBoundaries RWA ADM2
  (30 districts), CC BY 4.0, boundary source Open Data Rwanda (NISR geoportal,
  licence source statistics.gov.rw/terms-use).
- **Our extraction script**: `scripts/build_rw_area_summary.R` (aggregates the
  416 2012 sectors to districts, reads the 30 exact 2022 district Total rows,
  reconciles both to the national totals).
- **Retrieval recipe and hashes**: `docs/manifests/rw-census-religion-2012-2022.json`.

## Probes and deferrals

- **2022 religion question (corrected)**: NOT dropped. RPHC5 collected religion
  with ten modalities (Catholic, Protestant, Adventist, Other Christians,
  Muslim, Jehovah's Witness, Traditionalist/Animist, Other Religion, No
  Religion, Not Stated), published by sector with district Total rows. The 2022
  wave ships.
- **2002 census (RPHC3), deferred**: religion was enumerated on the pre-2006
  twelve-prefecture geography. The 2006 reform replaced the twelve prefectures
  with five provinces and thirty districts, so 2002 does not join the modern
  30-district set. Deferred pending a re-tabulation of the 2002 microdata on
  modern boundaries or a prefecture-to-district concordance; the 1978&ndash;2022
  national religion trend is recorded in both thematic reports.
- **Counts**: religion is published as percentages in both reports; the product
  ships percentages with the exact district population as the denominator (no
  religion counts are published). 2012 district shares carry one-decimal source
  precision (aggregated from sectors); 2022 shares carry two decimals.

## Risks and open questions

- NISR site paths are unstable; preserve downloaded source hashes in the manifest.
- Ethnicity is not part of the religion map and must not be inferred.

## Deep-history potential

Rwanda National Archives, Belgian African Archives, Missionaries of Africa archives, Catholic diocesan archives, Protestant mission records, and genocide memorial documentation where worship-site evidence is ethically usable.
