# Country data map: Croatia (HR)

## Status

- **Tier**: A (buildable now)
- **Build state**: data extracted
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Croatian Bureau of Statistics (DZS) census results](https://dzs.gov.hr/u-fokusu/popis-2021/popisni-upitnik/english/results/1501) | self-declared census religious affiliation | town/municipality in each wave; county for the governed three-wave product | 2001, 2011, 2021 | Hypertext Markup Language (HTML), Microsoft Excel binary workbook (XLS), and Microsoft Excel Open XML workbook (XLSX) | open web access | DZS website terms require full source attribution; the terms page assigns no named open licence |

The three censuses measure affiliation to a religious system regardless of registered church membership or practice. The whole census population supplies the denominator. Agnostic, non-declaration, and unknown categories remain distinct from the religious-affiliation and no-religion numerators.

## Access the data yourself

- **Source of record**: [DZS 2021 results page](https://dzs.gov.hr/u-fokusu/popis-2021/popisni-upitnik/english/results/1501), [2011 census portal](https://web.dzs.hr/Eng/censuses/census2011/censuslogo.htm), and [2001 census portal](https://web.dzs.hr/Eng/censuses/Census2001/census.htm).
- **Exact tables**: [2001 Table 14 HTML](https://web.dzs.hr/Eng/censuses/Census2001/Popis/E01_02_04/E01_02_04.html); [2011 Table 3 XLS](https://web.dzs.hr/eng/censuses/census2011/results/xls/Grad_03_EN.xls); [2021 towns/municipalities XLSX](https://podaci.dzs.hr/media/td3jvrbu/popis_2021-stanovnistvo_po_gradovima_opcinama.xlsx), sheet `2.`.
- **Licence**: [DZS website terms](https://dzs.gov.hr/uvjeti-koristenja/76) require users to name the Croatian Bureau of Statistics as the source. The terms page does not state a named open licence.
- **Our extraction script**: `scripts/build_hr_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/hr-census-religion-2001-2021.json`.
- **Route evidence**: `research/countries/hr/route-probe.md`.

## Boundaries

- Official boundary file: the State Geodetic Administration (DGU) [Infrastructure for Spatial Information in Europe (INSPIRE) Administrative Units Web Feature Service (WFS)](https://geoportal.dgu.hr/services/inspire/au/wfs?service=WFS&request=GetCapabilities&version=2.0.0), filtered to the 21 second-order units. The boundary vintage is 2026, and the retrieval date is 2026-07-10.
- Boundary terms: the [official metadata](https://geoportal.nipp.hr/geonetwork/srv/hrv/xml.metadata.get?uuid=08b28e14-01d7-4142-ae8e-217bf2a8d21b) links the [Croatian Open Licence](https://data.gov.hr/otvorena-dozvola) and states that public access has no limitations.
- Geometric stability of Croatian county boundaries across 2001, 2011, and 2021 was not verified. The common 2026 boundary join uses the 21 county positions and official codes shared by the DZS rows and the 2026 DGU layer. Code identity does not prove polygon stability.

## Places-of-worship layer

- OpenStreetMap (OSM) coverage assessment (2026-07-07): the Overpass count did not complete reliably in the expansion survey.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish lists, Serbian Orthodox eparchy directories, the Islamic Community of Croatia, and Jewish community records.

## First visualisation

Self-declared religious affiliation and explicit no-religion shares of the whole census population by county, 2001, 2011, and 2021, displayed on the 2026 DGU county frame.

## Build recipe

1. Extract the national and 21 county rows from the three pinned DZS tables, preserve every Croatian category name, and verify the bilingual counts.
2. Build `area_summary` under `schemas/area-summary.schema.json`, with the whole census population as the denominator.
3. Filter the DGU Administrative Units WFS to `national_level=2ndOrder`, join the 21 county codes, and simplify through `scripts/lib/simplify_boundary.R`.
4. Add a later `REGION_CONFIG` under `docs/development/adding-a-region.md`; the Croatia interface is outside this build.
5. Require exact within-area and county-to-national reconciliation, three-wave coverage, valid distinct geometry, and complete provenance.

## Risks and open questions

- DZS publishes town/municipality religion rows in all three waves, but the frames changed from 122 towns and 423 municipalities in 2001 to 127 and 429 in 2011 and 128 and 428 in 2021. DZS publishes no three-wave religion table rebased to one local-government frame. The product uses the 21-county fallback and creates no unofficial concordance.
- The 2001 `Agnostici i neizjašnjeni` (Agnostic and uncommitted) category mixes an agnostic response with non-declaration. The 2011 and 2021 tables separate `Agnostici i skeptici` (Agnostics and sceptics), `Ne izjašnjavaju se` (Not declared), and `Nepoznato` (Unknown). Headline shares use the whole population denominator, and every category remains separate in the manifest.
- The 2021 `Ostali kršćani` (Other Christians) category includes people who answered Christian without naming a denomination. The source reports that 96.47% of the category gave that answer; when asked about religious community, 87.26% of those respondents named the Catholic Church. The build retains DZS's published classification; this break limits cross-wave interpretation.
- The statistical definition of total population changed between the 2001 and 2011 censuses.

## Deep-history potential

State Archives in Zagreb and regional archives, Catholic and Orthodox parish registers, Jewish community records, Ottoman and Habsburg records for border regions, and historical census volumes.
