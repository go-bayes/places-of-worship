# Country data map: Albania (AL)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (prefecture, 2 waves)
- **Last verified**: 2026-07-09 (religion 2023: INSTAT Census 2023 Tab. 1.13 by prefecture; religion 2011: INSTAT Census 2011 prefecture booklets, table 1.1.13; boundaries: geoBoundaries ALB ADM1, https://www.geoboundaries.org/api/current/gbOpen/ALB/ADM1/)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| INSTAT Census 2023, Tab. 1.13 (resident population by religion and sex, by prefecture), https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/ | census religious belief | prefecture | 2023 | XLS (SpreadsheetML) | open web | INSTAT terms; attribution requested, licence not stated |
| INSTAT Census 2011, prefecture result booklets, table 1.1.13 (resident population by religious affiliation), https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/publications/2011/publications-of-population-and-housing-census-2011/ | census religious affiliation | prefecture | 2011 | PDF (12 booklets) | open web | INSTAT terms; attribution requested, licence not stated |
| INSTAT Census 2001 | census population; no comparable religion table exposed in this sweep | national/prefecture context | 2001 | XLS/PDF | open web | INSTAT terms |

Constructs are not interchangeable: both shipped waves are census religion self-declarations, but the category sets differ slightly between 2011 and 2023 (see Probes).

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Institute of Statistics of Albania (INSTAT), Census of Population and Housing (https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/).
- **Exact tables**: 2023 — **Tab. 1.13** "Popullsia banuese sipas besimit fetar dhe gjinisë / Resident population by religion and sex", the by-prefecture (qarqe) workbook with one worksheet per prefecture. 2011 — **table 1.1.13** "Resident population by religious affiliation" inside each of the twelve prefecture result booklets (1 Berat … 12 Vlorë).
- **Licence**: INSTAT census results are open downloads with attribution requested; no explicit reuse licence is stated on the results. Boundaries are geoBoundaries ALB ADM1 (12 prefectures), boundary licence Public Domain, source geoBoundaries and Wikipedia.
- **Our extraction script**: `scripts/build_al_area_summary.R` (parses the 2023 SpreadsheetML workbook with `xml2` and the twelve 2011 booklets with poppler `pdftotext -layout`, joins geoBoundaries ADM1 by name, reconciles against the printed national counts, and writes the `area_summary` product).
- **Retrieval recipe and hashes**: `docs/manifests/al-census-religion-2011-2023.json` (source URLs, retrieval date, SHA-256s, row/feature counts, reconciliation numbers).

## Boundaries

- Official boundary files: geoBoundaries ADM1 prefectures (pinned release commit `9469f09`), boundary licence Public Domain (boundary source geoBoundaries and Wikipedia); ASIG/INSTAT administrative boundaries are the official alternative if a finer or authoritative geometry is wanted later.
- The join uses the geoBoundaries `shapeName`, which matches the census prefecture names exactly, with diacritics (Berat, Dibër, Durrës, Elbasan, Fier, Gjirokastër, Korçë, Kukës, Lezhë, Shkodër, Tiranë, Vlorë), so no name correction is needed.
- Boundary changes between waves: the twelve-prefecture (qark) geography is unchanged between the 2011 and 2023 censuses, so both waves map on the same boundaries. The product anchors on prefectures and avoids the 2015 municipality reform.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep. No governed place layer or place metric is built yet, so the map ships religion metrics only.
- Country-specific registers that could seed or verify the layer: Muslim Community of Albania, Orthodox Autocephalous Church of Albania, Catholic dioceses, the Bektashi World Centre (Kryegjyshata), and the cultural-monuments register.

## First visualisation (built)

Census religious-affiliation and no-religion percent by prefecture, censuses 2011 and 2023, on the geoBoundaries ALB ADM1 prefectures. Two headline metrics use the stated-response denominator (named religions plus atheists, excluding the non-response categories); the exact prefecture resident population is the denominator of record.

## Build recipe (as built)

1. Extract: `scripts/build_al_area_summary.R` parses the 2023 Tab. 1.13 SpreadsheetML workbook (12 worksheets) and the 2011 booklet table 1.1.13 from the twelve prefecture PDFs.
2. Governed product: `apps/regions/al/data/area_summary_prefecture.{json,csv}` (24 rows: 12 prefectures × 2 waves) per the shared `area_summary` contract, with the tracked manifest `docs/manifests/al-census-religion-2011-2023.json`.
3. Boundaries: geoBoundaries `ALB ADM1` prefectures, simplified to `apps/regions/al/data/al_prefecture_2023.geojson`, joined by name.
4. Region page: `apps/regions/al/index.html` (`REGION_CONFIG`) and overview `apps/regions/al/overview.html`.
5. Verification: national reconciliation (parsed prefecture counts vs printed national counts) exact for both waves; 12/12 join coverage; licence and attribution strings recorded.

## Probes and reconciliation

- **2023 prefecture religion (shipped)**: Tab. 1.13 exposes resident population by ten religion categories per prefecture (Muslim, Muslim-Bektashi, Christian-Catholic, Christian-Orthodox, Christian-Evangelical, Other religion, Believers without denomination, Atheists, Prefer not to answer, Not available). Parsed prefecture counts sum exactly to the printed national total 2,402,113.
- **2011 prefecture religion (shipped)**: each prefecture booklet carries table 1.1.13 with eleven categories (adds Other Christians and a separate Others, and Not-relevant/not-stated). Parsed prefecture counts sum exactly to the printed national total 2,800,138, and each prefecture total equals the sum of its own categories.
- **Non-response (large and contested)**: the 2011 census asked religion for the first time since communism and the result was politically disputed (the Orthodox Autocephalous Church of Albania publicly rejected the 2011 Orthodox figure). Non-response is historically large: the non-response categories are 16.22% of residents nationally in 2011 (prefer-not-to-answer 13.79% + not-relevant/not-stated 2.43%) and 15.77% in 2023 (prefer-not-to-answer 10.17% + not-available 5.60%). Both are excluded from the stated-response denominator and their size is stated prominently on the map and overview.
- **Believers-without-denomination call**: counted as religious affiliation (the census footnote defines them as persons who answered "I don't belong to any religion, but I am a believer"), following the Czechia believers precedent. Their national share rose from 5.49% of residents in 2011 to 13.82% in 2023, so a growing part of the affiliation figure is undenominational belief; excluding it would lower the affiliation share.
- **National stated-response shares**: affiliation 97.02% / no religion 2.98% in 2011; affiliation 95.78% / no religion 4.22% in 2023 (no religion is the Atheist category only). Nationally the Muslim share fell from 56.70% of residents (2011) to 45.86% (2023), so Albania is no longer Muslim-majority on the census count.
- **2001 probe (deferred)**: the 2001 census did not expose a comparable prefecture religion table in this sweep; a 2001 wave is deferred rather than fabricated.
- **Municipality probe (deferred)**: INSTAT publishes 2023 results to municipality level and the 2011 booklets carry commune detail; a municipality (bashki) downscaling is deferred to a later build for 2011–2023 comparability at prefecture level first.

## Risks and open questions

- The very large non-response share (about one resident in six in both waves) means the stated-response shares rest on an incomplete base; the 2011 Orthodox count in particular is contested. The product ships INSTAT's published counts as the record and does not adjudicate the dispute.
- Counting believers without denomination as affiliation is a modelling choice; the reading notes report the share so a reader can reinterpret it.
- Category sets differ slightly between waves (2011 splits Other Christians and Others; 2023 folds minor faiths into one Other category), so only the two harmonised headline shares are mapped across waves.

## Deep-history potential

State archives, Ottoman records, waqf and Bektashi archives, Catholic and Orthodox parish records, interwar census materials (the 1927 count is widely cited), and cultural-heritage inventories.
