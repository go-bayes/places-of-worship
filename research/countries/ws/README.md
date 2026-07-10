# Country data map: Samoa (WS)

## Status

- **Tier**: B (feasible with extraction work; held on boundaries and licence)
- **Build state**: survey verified; 2021 subnational religion route confirmed and reconciled, no wave shipped
- **Last verified**: 2026-07-11

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [SBS 2021 Census tables workbook](https://www.sbs.gov.ws/wp-content/uploads/2022/12/CensusTablesEXCELFiles.xlsx), sheet `Table 2` | census affiliation | village (region and constituency-district roll-ups) | 2021 | XLSX | open download | bare SBS copyright; no explicit reuse grant |
| [SBS 2016 Census Brief No.1 tables](https://www.sbs.gov.ws/digi/2-2016%20Census%20Brief%20No.1%20Tables.xlsx), `Table 5` | census affiliation | national | 2016 | XLSX | open download | bare SBS copyright |
| [SBS 2011 Census tables workbook](https://www.sbs.gov.ws/digi/Census%202011_Excel_tables.xlsx), `Table 20` | census affiliation | urban-rural (age 5+) | 2011 | XLSX | open download | bare SBS copyright |
| [SBS 2006 Table 5 religion PDF](https://www.sbs.gov.ws/digi/05%20Table%205%20Population%20age%205%20years%20and%20over_religion_major_age.pdf) | census affiliation | national (by age) | 2006 | PDF | open download | bare SBS copyright |
| [PDH Samoa 2011 census catalogue](https://microdata.pacificdata.org/index.php/catalog/250) | census affiliation metadata | record-level microdata | 2011 | metadata | open metadata; data access varies | PDH terms |

Only the 2021 workbook publishes religion below the national level. The 2016 brief religion table is national, 2011 crosses religion with urban-rural residence only, and 2006 crosses religion with age only. The construct throughout is census affiliation, which does not measure practice, attendance, or registered membership.

## Access the data yourself

This project does not redistribute source data; a future map would show derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: [Samoa Bureau of Statistics census downloads](https://www.sbs.gov.ws/census/).
- **Exact tables**: 2021 tables workbook `CensusTablesEXCELFiles.xlsx`, sheet `Table 2`, *Total population by sex, religion and place of residence, 2021*.
- **Licence**: bare "Copyright © Samoa Bureau of Statistics (SBS), Apia, Samoa, 2022"; no SBS terms-of-use or open-data licence page located; reproduction terms not explicitly granted.
- **Our extraction script**: not written; the product is on hold pending a matching licensed boundary and an SBS reuse confirmation.
- **Retrieval recipe and hashes**: `research/countries/ws/route-probe.md` and the `.meta.json` sidecars under `data/raw/ws_census/`.

## Boundaries

- geoBoundaries WSM ADM1 (11 traditional districts, 2018, CC BY-SA 3.0) and ADM2 (43 districts, 2011, CC BY 4.0) both exist, but neither matches the census religion geography (4 regions / 51 constituency-districts / 339 villages) for a one-to-one join.
- The 2021 census constituency split disagrees structurally with the 2011 ADM2 East/West/`(PART)` districts; see `route-probe.md` for the exact failing correspondences. No licensed 4-region or 339-village polygon layer was located.
- A build needs a licensed 2021-constituency layer, an official village layer, or a published constituency-to-ADM2 concordance.

## Places-of-worship layer

- OSM coverage not reassessed in this probe; the earlier assessment (2026-07-07) noted Overpass timeouts.
- Country registers to survey: Congregational Christian Church of Samoa, Methodist Church, Catholic Archdiocese of Samoa-Apia, and Samoa National Archives and Records Authority.

## First visualisation

Religious-affiliation and no-religion percent by constituency-district or village for 2021, once a licensed matching boundary is secured. The 2021 table already reconciles exactly at every level; extraction is therefore not the obstacle; the boundary and licence are.

## Build recipe

1. Extract: read workbook `Table 2`, retain all 26 verbatim source categories, and keep the four nesting levels.
2. Governed product: create `area_summary` rows only after a licensed boundary matches the chosen census level.
3. Boundaries: secure a 2021-constituency layer, an official village layer, or a published concordance to geoBoundaries WSM ADM2.
4. Region page: add `REGION_CONFIG` after a mappable, licensed table is extracted.
5. Verification: the row-internal and hierarchical reconciliations already pass; re-run them in the build script and add the boundary join, geometry, and licence gates.

## Risks and open questions

- The 2021 religion geography (2021 electoral constituencies) does not correspond to any licensed boundary vintage; this is the primary blocker.
- SBS asserts bare copyright with no explicit reuse grant, unlike the Tonga precedent; a reuse confirmation from SBS is needed before shipping.
- Denomination categories differ across waves (2016 and 2011 include not-stated or age restrictions; 2021 has no not-stated category); any future longitudinal work must therefore preserve wave-specific frames.

## Deep-history potential

London Missionary Society, Methodist, Catholic, and Congregational records can support early worship-site histories. Samoa National Archives and mission periodicals are likely routes for pre-census evidence.
