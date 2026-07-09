# Country data map: South Africa (ZA)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (province, 3 waves)
- **Last verified**: 2026-07-09 (religion: Stats SA Cultural Dynamics Report 03-01-84, Table 4.1; population: Census 2022 Statistical Release P0301.4, Table 2.1; boundaries: geoBoundaries ZAF ADM1, https://www.geoboundaries.org/api/current/gbOpen/ZAF/ADM1/)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Stats SA Cultural Dynamics in South Africa (Report 03-01-84), Table 4.1, https://www.statssa.gov.za/publications/03-01-84/03-01-84.pdf | census affiliation (harmonised cross-wave) | province | 1996, 2001, 2022 | PDF | open web | Stats SA terms; attribution requested, licence not stated |
| Stats SA Census 2022 Statistical Release (P0301.4), https://census.statssa.gov.za/assets/documents/2022/P03014_Census_2022_Statistical_Release.pdf | census affiliation (2022 detailed) + province populations | province | 1996, 2001, 2011, 2022 (population); 2022 (religion) | PDF | open web (census.statssa.gov.za) | Stats SA terms; attribution requested, licence not stated |
| Stats SA Community Survey 2016 statistical release, https://cs2016.statssa.gov.za/ | household-survey affiliation | province | 2016 | PDF/web | open web | Stats SA terms; attribution requested, licence not stated |

Constructs are not interchangeable: census affiliation and survey (Community Survey 2016) affiliation are separate layers and are not mixed.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Statistics South Africa, census products (https://www.statssa.gov.za/?page_id=3839); the Census 2022 release is mirrored at https://census.statssa.gov.za/.
- **Exact tables**: religion — Cultural Dynamics in South Africa (Report 03-01-84), **Table 4.1** (percentage distribution of population by religious denomination and province, Censuses 1996, 2001 and 2022), cross-checked against Census 2022 Statistical Release (P0301.4) **Table 2.10** (2022 religion by province); population denominators — P0301.4 **Table 2.1** (distribution of population by province and sex, 1996–2022).
- **Licence**: Stats SA census releases are open downloads with attribution requested; no explicit reuse licence is stated on the releases. Boundaries are geoBoundaries ZAF ADM1, CC BY 3.0 IGO (boundary source OCHA ROSEA and the South African Municipal Demarcation Board).
- **Our extraction script**: `scripts/build_za_area_summary.R` (parses both PDFs with poppler `pdftotext -layout`, joins geoBoundaries ADM1, reconciles against the printed national religion row, and writes the `area_summary` product).
- **Retrieval recipe and hashes**: `docs/manifests/za-census-religion-1996-2022.json` (source URLs, retrieval date, SHA-256s, row/feature counts, reconciliation numbers).

## Boundaries

- Official boundary files: geoBoundaries ADM1 provinces, 2020 (pinned release commit `9469f09`), CC BY 3.0 IGO; ADM2 district municipalities also exist for later downscaling.
- The join uses the clean geoBoundaries `shapeISO` code (the feature carrying ISO `NC` has the misspelled `shapeName` "Nothern Cape", corrected to "Northern Cape" in the product).
- Boundary changes between waves: provincial boundaries shifted slightly between 1996/2001 and 2022 (cross-border municipality reallocations, resolved 2005–2006), but Stats SA tabulates all three waves by the same nine province names, so the product anchors every wave on the 2020 provinces and follows the source.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before adding a place layer. No governed place layer or place metric is built yet, so the map ships religion metrics only.
- Country-specific registers that could seed or verify the layer: South African Council of Churches, Catholic dioceses, Anglican Church of Southern Africa, Muslim Judicial Council, South African Jewish Board of Deputies.

## First visualisation (built)

Census religious-affiliation and no-religion percent by province, censuses 1996, 2001 and 2022, on the 2020 provinces. Two headline metrics use the stated-response denominator (named religions plus no religion, excluding the Undetermined residual); the exact province population is the denominator of record.

## Build recipe (as built)

1. Extract: `scripts/build_za_area_summary.R` parses Cultural Dynamics Table 4.1 (religion by province, 1996/2001/2022) and P0301.4 Table 2.1 (province populations) from the source PDFs.
2. Governed product: `apps/regions/za/data/area_summary_province.{json,csv}` (27 rows: 9 provinces × 3 waves) per the shared `area_summary` contract, with the tracked manifest `docs/manifests/za-census-religion-1996-2022.json`.
3. Boundaries: geoBoundaries `ZAF ADM1` provinces, simplified to `apps/regions/za/data/za_province_2020.geojson`, joined by `shapeISO`.
4. Region page: `apps/regions/za/index.html` (`REGION_CONFIG`) and overview `apps/regions/za/overview.html`.
5. Verification: national religion cross-check (population-weighted provincial aggregate vs printed national row) within ~0.1 pp per wave; 9/9 join coverage; licence and attribution strings recorded.

## Probes and reconciliation

- **2011 gap (confirmed)**: the 2011 census dropped the religion question. Table 4.1 (religion) covers 1996, 2001 and 2022 only, while Table 2.1 (population) includes 2011 — the direct source signature of the gap. No 2011 religion wave is fabricated.
- **2016 Community Survey (deferred, separate construct)**: CS 2016 reintroduced religion after the 2011 gap (religiously unaffiliated ≈ 10,7% nationally), but it is an intercensal household survey, not a census, so it is recorded and deferred rather than mixed into the census layers.
- **2001 municipal-level probe**: 2001 religion was published at municipality level historically (Census 2001 community profiles / interactive tabulation), but the 2022 religion release (P0301.4) and the harmonised cross-wave Table 4.1 are province-level only. The first product anchors on province for 1996–2001–2022 comparability; a municipal (ADM2) downscaling is deferred to a later district build.
- **National reconciliation**: the population-weighted provincial aggregate reproduces the printed national religion row (Figure 4.1) within the maximum per-category differences 0,08 pp (1996), 0,04 pp (2001) and 0,06 pp (2022). Province populations sum to the national total exactly in 1996 and within 1 person in 2001 and 2022 (Stats SA rounding).

## Risks and open questions

- The 1996 wave carries a high Undetermined share (about 9% nationally) and codes Traditional African Religion as 0,0 in every province, both artefacts of 1996 census processing; the stated-response denominator absorbs the Undetermined residual, and 1996 Traditional-African comparisons are treated with care.
- Stats SA main-site access (www.statssa.gov.za) sits behind an Imperva/Incapsula layer; the P0301.4 release is reliably reachable at census.statssa.gov.za.

## Deep-history potential

National Archives and Records Service of South Africa, Cape Archives, Moravian Church archives, London Missionary Society records, Anglican and Catholic diocesan archives, and digitised South African newspaper collections.
