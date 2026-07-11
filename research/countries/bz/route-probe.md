# Belize census-religion route probe

Verified 2026-07-12. The Statistical Institute of Belize (SIB, `sib.org.bz`) publishes religion **by district** as a count-valued cross-tab for three census waves — **2000, 2010, and 2022** — across the six districts (Corozal, Orange Walk, Belize, Cayo, Stann Creek, Toledo). The queue premise ("2000-2022 | district | census affiliation and demographics | browser work | probe then build") holds on geography and waves; it is refuted only on route quality — the district religion tables are direct open downloads (a machine-readable Excel workbook for 2010 and 2022, a clean PDF for 2000), not browser work. Every wave reconciles exactly at both margins in the source. The one genuine finding to flag is the 2022 census method: SIB applied **census weighting and non-response adjustment through the assignment of weights**, so the 2022 (and the re-tabulated 2010) district religion cells are **non-integer weighted counts**, not raw enumeration counts; the 2000 table is an integer full-count. The boundary route is clean: geoBoundaries BLZ ADM1 records a stated Creative Commons Attribution 2.5 Generic licence over the six districts, which join the census one-to-one with no name concordance. The licence gate is the SIB posture: the 2010 census report prints a verbatim "all rights reserved, short sections may be copied with full acknowledgement" clause and the SIB website footer asserts "Copyright © 2026. All Rights Reserved.", so the product ships under the standing BUILD-THEN-ASK ruling with attribution to SIB, a courtesy reuse ask recorded for the PI.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a six-district, three-wave religious-affiliation series (2000, 2010, 2022). The subnational bar is cleared comfortably — three waves, six districts, count-valued, exact-margin reconciliation in every wave.
- **Waves and sources**:
  - **2000**: 2000 Census Report (PDF) Table B2 "Population by Religion and Sex for Major Divisions" — integer full-count, ~17 named categories plus None and DK/NS, six districts. Every district column and every category row reconciles to the printed totals exactly (country total 232,111; None 21,795; DK/NS 1,367).
  - **2010**: 2010 General Characteristics Tables (Excel) sheet `Religion_by_District`, Table 9 — weighted counts, twelve categories (ten denominations plus None and Don't Know/Not Stated), six districts. Reconciles float-exact at both margins (national 322,423.82; None 49,972.08; Don't Know 2,028.07).
  - **2022**: 2022 General Characteristics Tables (Excel) sheet `Religion_by_District`, Table 9 (= Key Findings Report Table A.2) — weighted counts, the same twelve-category frame, six districts. Reconciles float-exact (national 397,483.46; None 123,372.67; Don't Know 4,134.76). The rounded national counts match the Key Findings Report Table 3.5 published integers exactly.
- **Geography**: 6 districts on geoBoundaries BLZ ADM1 (six units, one-to-one join by name, no concordance needed).
- **Construct**: census affiliation — each resident's reported religion, asked of the whole resident population; not practice, attendance, or membership.
- **Slot design** (ordinary two-slot, SB/FM/KI precedent): `religious_affiliation_percent` = share of the district population reporting a named religion = (population − None − non-response) / population; `no_religion_percent` = the single None line / population. The non-response line (2000 "DK/NS"; 2010/2022 "Don't Know/Not Stated") stays in the denominator and in neither slot, so the two shares need not sum to 100 (the FJ/SB unallocated-residual precedent). No `Custom Beliefs`-style ambiguous category appears in any Belize wave.
- **Map-worthy pattern**: the sharp secularisation trend is the story and it is legible by district. National no-religion share rose 9.4% (2000) → 15.5% (2010) → 31.0% (2022); Roman Catholic fell 49.6% → 40.1% → 31.8%. By district in 2022, no-religion already exceeds Roman Catholic in Belize District (30.8% None vs 33.4% RC is close) and Stann Creek is the most secular; Cayo is the Pentecostal stronghold; Toledo and Corozal remain the most Catholic; Mennonite concentrates in Orange Walk and Corozal.
- **Rights position**: SIB asserts copyright with reproduction permitted for short sections with full acknowledgement (2010 report) and an all-rights-reserved website footer; no open-data licence is stated. Ship derived district summaries with attribution to the Statistical Institute of Belize under BUILD-THEN-ASK (the RO/SK/CI/MONSTAT summaries-with-attribution line); a SIB reuse-confirmation email is the clean courtesy unblock, recorded for the PI. The boundary carries a stated CC BY 2.5 Generic licence.

## Published waves and geography

| Year | Official route | Religion-by-district table | Method | Universe | Decision |
| --- | --- | --- | --- | --- | --- |
| 2000 | [2000 Census Report](https://sib.org.bz/wp-content/uploads/2000_Census_Report.pdf) (PDF) | Table B2 "Population by Religion and Sex for Major Divisions" (integer, ~17 categories) | full-count enumeration | tabulated population (232,111) | Ship the six-district 2000 wave. |
| 2010 | [2010 General Characteristics Tables](https://sib.org.bz/wp-content/uploads/Census2010_GeneralCharacteristics.xlsx) (Excel), sheet `Religion_by_District` | Table 9 "Population by Religion, District and Sex: 2010" (weighted, 12 categories) | weighted census population (322,423.82) | Ship the six-district 2010 wave. |
| 2022 | [2022 General Characteristics Tables](https://sib.org.bz/wp-content/uploads/Census2022_GeneralCharacteristics.xlsx) (Excel), sheet `Religion_by_District` | Table 9 "Population by Religion, District and Sex: 2022" (weighted, 12 categories); = [Key Findings Report](https://sib.org.bz/wp-content/uploads/CensusKeyFindingsReport_2022.pdf) Table A.2 | weighted census population (397,483.46) | Ship the six-district 2022 wave. |
| 1991 | 2000 Census Report Table B2 (1991 column) | full-count, but folds "None" into a combined "None/Not Stated" line | full-count | 184,722 | HOLD — the combined None/Not-Stated line cannot isolate the no-religion slot; a documented deeper-history wave, not shipped. |

The two national religion infographics — [Religion_2010.pdf](https://sib.org.bz/wp-content/uploads/Religion_2010.pdf) and [Religion_2022_web.pdf](https://sib.org.bz/wp-content/uploads/Religion_2022_web.pdf) — are single-page national summaries with no district breakdown; they are corroborating context, not the route. The 2010 Census Report also prints an alternative, richer integer full-count district religion table (**Table R1.1**, 20 categories with `**` suppression on cells of ten or fewer persons, country total 322,453). The build uses the 2010 Excel Table 9 instead of Table R1.1 because it shares the identical twelve-category frame and weighted method with 2022, giving a clean same-instrument 2010→2022 pair; Table R1.1 is recorded as the richer-frame alternative 2010 source (deferred).

## Category frames (preserved verbatim per wave; never merged)

| 2000 (Table B2) | 2010 (Table 9) | 2022 (Table 9) | Role |
| --- | --- | --- | --- |
| Anglican | Anglican | Anglican | affiliation |
| Bahai Faith | (in Other) | (in Other) | affiliation |
| Baptist | Baptist | Baptist | affiliation |
| Hindu | (in Other) | (in Other) | affiliation |
| Jehovah Witness | Jehovah's Witness | Jehovah's Witness | affiliation |
| Mennonite | Mennonite | Mennonite | affiliation |
| Methodist | Methodist | Methodist | affiliation |
| Mormon | (in Other) | (in Other) | affiliation |
| Muslim | (in Other) | (in Other) | affiliation |
| Nazarene | Nazarene | Nazarene | affiliation |
| Pentecostal | Pentecostal | Pentecostal | affiliation |
| Roman Catholic | Roman Catholic | Roman Catholic | affiliation |
| Seventh Day Adventist | Seventh Day Adventist | Seventh Day Adventist | affiliation |
| Salvation Army | (in Other) | (in Other) | affiliation |
| Other | Other | Other | residual affiliation |
| None | None | None | no-religion |
| DK/NS | Don't Know/Not Stated | Don't Know/Not Stated | non-response |

Two frame facts govern comparability. The first frame fact is category collapse: the 2000 frame names Bahai Faith, Hindu, Mormon, Muslim, and Salvation Army as separate lines, while the 2010 and 2022 twelve-category frame folds them (and other small bodies) into "Other" — so the 2000 "Other" and the 2010/2022 "Other" are not comparable, and neither are the individual small-denomination lines across the 2000/2010 break. The broad spine (Roman Catholic, Pentecostal, Seventh Day Adventist, Anglican, Mennonite, Baptist, Methodist, Nazarene, Jehovah's Witness) plus the always-separate None is comparable across all three waves. The second frame fact is method: the 2000 cells are integer full-counts while the 2010 and 2022 cells are weighted (non-integer) counts from the SIB weighting-and-non-response-adjustment methodology; shares are ratios and remain construct-comparable, but the underlying counts are not the same kind of number, so denomination-count change across the 2000→2010 break is not asserted. Change is withheld on the fine denominations; the headline no-religion and affiliation shares are comparable across all three waves.

## Universe and denominator

Each wave's religion table denominator is the population tabulated by religion in that wave: 232,111 (2000, "tabulated population"), 322,423.82 (2010, weighted), 397,483.46 (2022, weighted). Religion is asked of the whole resident population in every wave (no age restriction), so the district shares are directly comparable in construct. The 2000 denominator (232,111) is the religion-table "tabulated population" and is the denominator SIB itself uses for the 2000 religion percentages; the build reads each district's shares within its own wave denominator and never treats population growth (232k → 322k → 397k) as a religion change.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **2000 (Table B2)**: the six district totals (32,209 + 38,060 + 63,061 + 51,221 + 24,443 + 23,117) sum to the printed 232,111; None sums to 21,795; DK/NS to 1,367; every category row sums across districts to its printed country total (Roman Catholic 115,035; Anglican 12,386; Pentecostal 17,189; Seventh Day Adventist 12,160; Mennonite 9,497; …). Integer-exact at both margins, no cell suppression in the 2000 count columns.
- **2010 (Table 9)**: the six district totals sum to 322,423.82; every district column sums over the twelve categories to its district total and every category row sums to its national total, float-exact (residual < 1e-2). None 49,972.08, Don't Know 2,028.07.
- **2022 (Table 9)**: the six district totals sum to 397,483.46; both margins close float-exact. None 123,372.67, Don't Know 4,134.76. The rounded national counts equal the Key Findings Report Table 3.5 published integers exactly (Roman Catholic 126,596; None 123,373; total 397,483).
- The build stops and records any failing row on mismatch; no value is allocated, inferred, imputed, or tuned. Weighted cells are carried verbatim; integer rounding is a display convenience for the count fields, and every reconciliation gate runs on the as-published values.

## Boundary source and licence

The boundary is [geoBoundaries BLZ ADM1](https://www.geoboundaries.org/api/current/gbOpen/BLZ/ADM1/). The release metadata records `"admUnitCount": "6"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2006"`, `"boundarySource": "geoBoundaries, Wikimedia Commons"`, and — the load-bearing field, quoted verbatim — `"boundaryLicense": "Creative Commons Attribution 2.5 Generic"`, `"licenseSource": "commons.wikimedia.org/wiki/File"`. The licence field is non-null, so the boundary route is accepted (the Dominica ADM1 CC BY 2.5 precedent). The six `shapeName` values (Orange Walk, Corozal, Belize, Cayo, Stann Creek, Toledo) match the six census districts one-to-one with no name concordance. The extent spans lon −89.23 to −87.76 E and lat 15.89 to 18.49 N, wholly within the standard frame and far from the antimeridian; no dateline handling is needed. The pin is commit `9469f09`.

**Guatemala territorial note**: Belize's western and southern land border with Guatemala is subject to a long-standing Guatemalan territorial claim (before the International Court of Justice). The geoBoundaries BLZ ADM1 layer renders the official Belizean administrative extent, which is what the SIB census enumerates. The build renders the official Belizean record as published and takes no position on the dispute; the district boundaries and census counts are those of the Government of Belize.

## Licence position

No open-data licence is stated on any SIB census product. The rights posture, fetched and quoted verbatim:

- **2010 Census Report** (PDF, front matter): "Copyright © 2013, The Statistical Institute of Belize. Short sections of this publication may be copied for individual use without permission, provided the source is fully acknowledged. Otherwise, no part of this publication may be reproduced or transmitted in any form or by any means, electronic or mechanical, including photocopying, recording, or any information storage and retrieval system, without permission in writing from the Statistical Institute of Belize." (retrieved 2026-07-12).
- **SIB website** (policies and documentation pages, footer): "Statistical Institute of Belize. Copyright © 2026. All Rights Reserved." (retrieved 2026-07-12, `sib.org.bz/about-us/about-sib/policies/` and `sib.org.bz/data-portals/documentation/`).
- The microdata-portal (REDATAM) end-user terms restrict redistribution of the raw dataset ("The data and other materials will not be redistributed or sold … without the written agreement of the Statistical Institute of Belize … used solely for reporting of aggregated information"); this governs raw microdata, which the build never touches.

The product is a derived aggregate summary (district religion shares) carrying full attribution to SIB, built from openly published aggregate tables, leaking no microdata. Under the standing BUILD-THEN-ASK ruling it ships with attribution; the "short sections may be copied with full acknowledgement" clause supports the derived-aggregate use. A SIB reuse-confirmation email is the clean courtesy unblock, recorded here for the PI (do not send). Licence recorded as needs_review with a build-then-ask attribution basis.

## Retrieval record

Every cached input is under `data/raw/bz_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `bz_2000_Census_Report.pdf` | <https://sib.org.bz/wp-content/uploads/2000_Census_Report.pdf> | pdf | `dfd0069eb1f4c4010fd7c23ee04f31f487d3a81b528e4b2567450827560f358d` |
| `bz_Census2010_GeneralCharacteristics.xlsx` | <https://sib.org.bz/wp-content/uploads/Census2010_GeneralCharacteristics.xlsx> | xlsx | `17cce2129571548df5b4c76447db856a11f9271d393ca046f6afce48a18c9db5` |
| `bz_Census2022_GeneralCharacteristics.xlsx` | <https://sib.org.bz/wp-content/uploads/Census2022_GeneralCharacteristics.xlsx> | xlsx | `8d649118178f8cc01f9188c049489a9e02817439cdaf78dfe704cd254bf3cdfc` |
| `bz_2010_Census_Report.pdf` | <https://sib.org.bz/wp-content/uploads/2010_Census_Report.pdf> | pdf | `5d4ac18dd131509e9b1bb7a6fe85418000ce178c70a4b1b3e52357a0ca8e7e28` |
| `bz_CensusKeyFindingsReport_2022.pdf` | <https://sib.org.bz/wp-content/uploads/CensusKeyFindingsReport_2022.pdf> | pdf | `e6abc6265b8268c82f7ef638f0f2f78ff011fc2cdc85ec1eddd2e38ef3cafef0` |
| `geoBoundaries-BLZ-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BLZ/ADM1/geoBoundaries-BLZ-ADM1.geojson> | geojson | `c75826394c11129d493cc4a250005fae1bfd26d60921edc1ed9471609866083b` |
| `gb_blz_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/BLZ/ADM1/> | json | `79fe5a14a552b8c2a29989fcbeb128401545948906510ba414b7809cd3c0e7e9` |

Also cached (context, not build inputs): `bz_religion_2010.pdf`, `bz_religion_2022_web.pdf` (national infographics), and `pdftotext -layout` extractions of the PDFs.

## Blockers and held items

- **Licence** (needs_review, not a hard block under BUILD-THEN-ASK): no stated open-data licence on the SIB tables; ships with attribution; SIB courtesy ask recorded for the PI.
- **2022 weighting** (documented, not a block): the 2022 and re-tabulated 2010 district cells are weighted non-integer counts (SIB non-response-adjustment methodology); rendered verbatim, rounded for display only, reconciling on the as-published values.
- **Frame breaks** (documented): the 2000 ~17-category frame collapses to the 2010/2022 twelve-category frame; fine-denomination change is not asserted across the 2000 break; the headline no-religion/affiliation shares are comparable across all three waves.
- **1991** (HELD): available in the 2000 report Table B2 but folds None into a combined None/Not-Stated line, so the no-religion slot cannot be isolated; a documented deeper-history wave, not shipped.
- **2010 Table R1.1** (deferred alternative): the richer 20-category integer full-count district table with `**` suppression on small cells; recorded as the deeper-frame 2010 source, not used in favour of the same-frame-as-2022 Excel Table 9.
