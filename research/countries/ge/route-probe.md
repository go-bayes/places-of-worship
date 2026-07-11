# Georgia census-religion route probe

Verified 2026-07-12. Georgia asked religion in **three** national censuses — 2002, 2014, and 2024 — and the National Statistics Office of Georgia (Geostat, `geostat.ge`) publishes a **count-valued religion-by-region table for every wave**. The queue premise ("2002-2024 | region/municipality to extract | census religion; census religious belief; census religion, if released | browser work | probe then build") holds, and the record settles the open question: the 2024 census religion result **is released** (final detailed data, published 2026), so this is a **three-wave** product, not two. Each wave reconciles exactly at both margins (every region column sums to its printed total; every religion column sums to its printed national total). The build ships a three-wave region-level product on a single licensed boundary; the 2024 wave additionally publishes municipality-level (self-governed-unit) religion, carried as a documented deeper product that a boundary-vintage mismatch defers.

## Build decision (recommendation to the conductor)

- **Recommendation: BUILD** a three-wave region-level religious-affiliation product (2002, 2014, 2024) on the geoBoundaries GEO ADM1 frame. Three census waves, count-valued, exact-margin reconciliation in every wave, a licensed boundary, and a clean open licence — a strong subnational time series. The dominant substantive contrasts (Orthodox majority; Muslim concentration in Adjara, Kvemo Kartli and Kakheti; Armenian Apostolic in Samtskhe-Javakheti) are legible and exactly comparable across all three waves through the per-wave verbatim category breakdowns.
- **Licence: ACCEPTED, no ask needed.** The Geostat Terms of Use grant free reuse for any purpose (including commercial, including derivative works) with a source reference — an open licence with attribution, quoted verbatim below and captured. This needs no PI ruling.
- **Waves and sources**:
  - **2002**: General Population Census Results, **Volume I**, **Table #29** "საქართველოს მოსახლეობის განაწილება სარწმუნოების მიხედვით მსხვილი ადმინისტრაციულ-ტერიტორიული ერთეულების (მხარეების) ჭრილში" (Distribution of Georgia's population by religion across large administrative-territorial units / regions). 12 region rows, 6 named categories plus one residual, integer full-count. National total 4,371,535. Text-extractable scanned PDF.
  - **2014**: General Population Census Results, table "Population by regions and religion" (XLS). 11 region rows, 12 categories, integer counts with `…`(≤10) suppression on small cells. National total 3,713,804.
  - **2024**: Population Census results, "Population by regions, self-governed units, sex and religion" (XLSX). 11 region rows + 64 self-governed-unit rows, 10 categories, integer counts, no suppression. National total 3,929,581.
- **Geography**: 12 regions on geoBoundaries GEO ADM1 (CC BY 3.0, 12 units, 2015 vintage). The 11 controlled regions carry all three waves; the Abkhazia A.R. polygon carries the 2002 wave only (see territorial scope).
- **Construct**: census affiliation — each resident's reported religion, asked of the whole enumerated population, not practice, attendance, or membership. Religion was first tabulated in the 2002 census (Volume I states the confessional structure "was established for the first time" in 2002).

## Published waves and geography

| Year | Official route | Religion-by-region table | Universe | Region units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2002 | [2002 census results, Vol I PDF](https://geostat.ge/media/44559/I-tomi.pdf) | Table #29 (region × 6 religions + residual) | whole enumerated population, all ages | 12 (incl. Abkhazia A.R. = 1,956) | Ship the 2002 wave. |
| 2014 | [Population by regions and religion (XLS)](https://geostat.ge/media/44724/22_Population-by-regions-and-religion.xls) | region × 12 religions (`Total` block) | whole population, all ages | 11 | Ship the 2014 wave. |
| 2024 | [Population by regions, self-governed units, sex and religion (XLSX)](https://geostat.ge/media/80625/6.-Population-by-regions%2C-self-governed-units%2C-sex-and-religion.xlsx) | region + self-gov-unit × 10 religions (`Both Sexes` block) | whole population as of 14 Nov 2024 | 11 regions (+64 self-gov units) | Ship the 2024 region wave; defer municipality. |

Two source facts govern the routing. The first source fact is that the 2024 census religion result is published, contrary to the queue's "if released" caveat: the 2024 Population Census "Demographic and Social Characteristics" results (`census2024.geostat.ge` → `geostat.ge/en/modules/categories/910`) include the region-and-self-governed-unit religion table, and the national counts match the published totals (Orthodox 3,223,206; Muslim 437,458; Armenian Apostolic 101,736; Catholic 19,593; Jehovah's Witnesses 10,787; None 19,214). The second source fact is that the 2002 region religion table lives only inside a scanned census volume, not a spreadsheet: Volume I Table #29 is the sole subnational religion tabulation, but it is cleanly text-extractable (`pdftotext -layout`, margin-verified below), so no image transcription is needed. The 2002 English results page (`geostat.ge/en/modules/categories/877`) is empty; the volume PDFs are on the Georgian page.

## Category frames (preserved verbatim per wave; never merged)

The three waves do **not** share one category frame. Each wave is transcribed in its own printed order and labelled by wave; the frame break bars any invented cross-wave category concordance (CHANGE-WITHHOLD).

| 2002 (Table #29) | 2014 (region table) | 2024 (region table) | Product role |
| --- | --- | --- | --- |
| მართლმადიდებელი (Orthodox) | Orthodox | Orthodox | affiliation |
| მაჰმადიანური (Muslim) | Muslim | Muslim | affiliation |
| სომხურ-გრიგორიანული (Armenian-Gregorian) | Armenian apostolic | Armenian apostolic | affiliation |
| კათოლიკური (Catholic) | Catholic | Catholic | affiliation |
| — | Jehovah's Witnesses | Jehovah's Witnesses | affiliation |
| — | Yazidis | (in Other) | affiliation |
| — | Protestant | (in Other) | affiliation |
| იუდეური (Judaism) | Judaism | Judaism | affiliation |
| სხვა სარწმუნოება (Other religion — see note) | Other | Other | affiliation / residual |
| (bundled in the residual) | None | None | no-religion |
| — | Refusal | Refusal | non-response |
| — | Not stated | Not stated | non-response |

Three frame facts govern comparability. The first frame fact is the 2002 residual: Table #29 prints only one residual column, "სხვა სარწმუნოება" (other religion), whose national value (62,111) equals the national Table #28 lines "Other" (33,468) + "None/none — arcerToi" (28,631) + a 12-person unclassified remainder. At **region** level the 2002 table therefore cannot separate other-religion from no-religion, so the 2002 wave has **no isolable no-religion cell**. The second frame fact is the 2014→2024 category collapse: 2014 names Yazidis and Protestant as separate lines, while 2024 folds both into "Other" — so the fine-denomination lines are not comparable across the 2014/2024 break, though the great-tradition spine (Orthodox, Muslim, Armenian Apostolic, Catholic, Jehovah's Witnesses, Judaism) is. The third frame fact is response categories: 2002 has no Refusal or Not-stated categories at all (everyone is classified into a religion or the residual), while 2014 and 2024 both carry Refusal and Not-stated. The comparable, exactly-published spine across all three waves is the set of five great-tradition shares (Orthodox, Muslim, Armenian Apostolic/Gregorian, Catholic, Judaism), which the per-region verbatim breakdowns carry unchanged.

## Slot design

Ordinary two-slot design (SB/FM/KZ precedent), with a per-wave adjustment forced by the 2002 residual.

- `religious_affiliation_percent`:
  - **2014, 2024** = `(population − None − Refusal − Not stated) / population`. This counts everyone who named any religion (including "Other"). It is exact for every region even where a small affiliation sub-category is suppressed, because None, Refusal, and Not-stated are never suppressed.
  - **2002** = `(Orthodox + Catholic + Armenian-Gregorian + Judaism + Muslim) / population` — a **recorded lower bound** on affiliation, because the "other religion" residual (which bundles genuine other-religion affiliates with no-religion, inseparably) is excluded. The bound is tight (the five named religions are 98.6% of the national population). The exact-margins ruling's "within a recorded derived bound" covers this; the bound is disclosed on the flag and never repaired.
- `no_religion_percent`:
  - **2014, 2024** = `None / population` (the single None line).
  - **2002** = **null** — the residual bundles no-religion with other-religion; render the record, do not split.
- Refusal and Not-stated (2014, 2024) stay in the denominator and in neither slot, so the two shares need not sum to 100 (the KZ Refused-to-indicate precedent; Not-stated is large in 2024 at 2.5%).

## Universe and denominator

Every wave counts the whole enumerated resident population of all ages (religion asked of everyone), so there is no universe break and the region shares are construct-comparable. Each wave's religion-table total equals the census population: 4,371,535 (2002), 3,713,804 (2014), 3,929,581 (2024). The population falls then rises across the series; shares are read within each region's own wave denominator and population change is never treated as a religion change. Because the category frames differ across waves (see above), no cross-wave category **change** is claimed; the product ships the three waves as levels.

## Territorial scope (render the record)

Geostat has not enumerated Abkhazia or the Tskhinvali Region / former South Ossetia Autonomous Oblast since the 1990s conflicts. The record's own coverage, rendered as published:

- **2002**: Volume II states the census "was conducted on the territory under Georgia's jurisdiction (except Abkhazia and the former South Ossetia Autonomous Oblast)." Table #29 nonetheless prints an **Abkhazia A.R.** row of **1,956** persons — the minuscule fraction under Georgian control at the census date (the upper Kodori Gorge area). The build renders this row verbatim so the national total 4,371,535 reconciles, and maps it onto the Abkhazia polygon with a prominent per-feature flag that 1,956 is a tiny enumerated fraction, not Abkhazia's population. The 2002 wave is the only wave with any Abkhazia figure.
- **2014**: the region table covers the 11 controlled regions; Abkhazia and South Ossetia are absent (no row).
- **2024**: the table footnote states verbatim "Note: Does not include occupied territories of Georgia"; the 11 controlled regions are covered, Abkhazia and South Ossetia absent.
- **Shida Kartli, all waves**: the census enumerates only the Georgian-controlled part of Shida Kartli; the Tskhinvali/South Ossetia portion is not enumerated. The geoBoundaries Shida Kartli polygon spans the full region extent (including the non-enumerated Tskhinvali area), so the Shida Kartli shares describe the enumerated (controlled) population within a polygon drawn to the administrative extent. This is disclosed on the Shida Kartli flag (the Serbia/Palestine render-the-record precedent). No count is invented for the non-enumerated area.

The build takes no position on the status of the territories; it renders the official Georgian census record and states the coverage plainly.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **2002 (Table #29)**: every region row's six category cells sum to its printed total (e.g. Tbilisi 988,664+2,715+51,687+2,320+11,438+24,855 = 1,081,679); every category column sums to its printed national total (Orthodox 3,666,233; Muslim 433,784; Armenian-Gregorian 171,139; Catholic 34,727; Judaism 3,541; residual 62,111); the 12 region totals sum to 4,371,535. Integer-exact at both margins; dashes read as 0, no suppression.
- **2014 (region table, Total block)**: the two headline slots reconcile exactly at both margins — None, Refusal, and Not-stated are printed for every region, so `affiliation = total − None − Refusal − Not-stated` and `None` close to the national totals; the national row sums exactly over all 12 categories to 3,713,804. The `…`(≤10) suppression falls only on small affiliation sub-categories (Guria/Mtskheta-Mtianeti Judaism; Racha-Lechkhumi Muslim/Armenian/Protestant/Other; Shida Kartli Yazidis); those suppressed cells are carried verbatim as `…` in the per-region breakdown and never repaired, and the build records the per-row suppression bound (`total − sum(known) ≤ 10 × n_suppressed`).
- **2024 (region rows of the region+self-gov table, Both Sexes block)**: the 11 region totals sum to 3,929,581 and every religion column sums to its printed national total (Orthodox 3,223,206; Muslim 437,458; Armenian Apostolic 101,736; Catholic 19,593; Jehovah's Witnesses 10,787; Judaism 1,013; Other 10,493; None 19,214; Refusal 8,912; Not-stated 97,169). Both margins close exactly; no suppression.
- The build stops and records any failing row on mismatch; no value is allocated, inferred, imputed, or tuned.

## Boundary source and licence

The boundary is [geoBoundaries GEO ADM1](https://www.geoboundaries.org/api/current/gbOpen/GEO/ADM1/) (`gbOpen`, pinned commit `9469f09`). The release metadata records `"boundaryType": "ADM1"`, `"admUnitCount": "12"`, `"boundaryYearRepresented": "2015"`, `"boundarySource": "geoBoundaries, Wikimedia"`, and — the load-bearing field, verbatim — `"boundaryLicense": "Creative Commons Attribution 3.0 License"`, `"licenseSource": "commons.wikimedia.org/wiki/File"`. The licence is non-null, so the route is accepted (the Dominica/Belize CC BY precedent). The 12 `shapeName` values (Abkhazia, Adjara, Guria, Imereti, Kakheti, Kvemo Kartli, Mtskheta-Mtianeti, Racha-Lechkhumi and Kvemo Svaneti, Samegrelo-Zemo Svaneti, Samtskhe–Javakheti, Shida Kartli, Tbilisi) match the census regions one-to-one after normalising the printed region names (self-governing-city/AR prefixes, and the en-dash in "Samtskhe–Javakheti"). The extent lies wholly within the standard frame (about 40–47 °E, no antimeridian). One boundary set serves all three waves (the modern region frame is stable across 2002–2024); Abkhazia is used for the 2002 wave only.

**OCHA COD-AB** was considered as an alternative; geoBoundaries ADM1 is licensed (CC BY 3.0, not null) and matches the census frame one-to-one, so it is the primary route and no second provider is needed.

## Licence position (accepted)

The Geostat Terms of Use (`geostat.ge/en/page/monacemta-gamoyenebis-pirobebi`, retrieved 2026-07-12, captured to `data/raw/ge_census/geostat_terms_of_use_en.txt`) state verbatim:

> "The National Statistics Office of Georgia (GEOSTAT) allows its users, with the exception listed below the right to download, use, adapt, modify, create derivative works of, disseminate, copy, and share to the third parties, for any purpose, including commercial and non-commercial use, without restriction, statistical data, metadata, official publications and other published documents placed on GEOSTAT website without prior permission."

and the attribution condition:

> "Users should indicate Geostat as a source of information when using data of GEOSTAT."

This is an open reuse licence conditioned only on source attribution: `licence_status: accepted`. The required attribution is the National Statistics Office of Georgia (Geostat). No courtesy ask is needed. The page is JavaScript-rendered, so the capture is the rendered text (the page's own copyright material of third parties, logos, and trademarks are excluded from the grant, none of which the build touches).

## Premise corrections (trust the record)

- **The 2024 religion result is released — this is a three-wave product.** The queue row hedged "census religion, if released"; the 2024 Population Census "Demographic and Social Characteristics" results publish religion by region and self-governed unit, so 2002, 2014, and 2024 all ship.
- **2002 publishes religion by region, not only nationally.** The 2002 result is often cited only at national level (88.6% Christian, of which 83.9% Orthodox), but Volume I Table #29 gives the full 12-region cross-tab, which reconciles exactly. Its residual column, however, bars an isolable 2002 no-religion cell (documented above).
- **Municipality religion is a 2024-only, boundary-blocked deeper product.** The queue's "region/municipality to extract" is met at region level for all waves; municipality (self-governed-unit) religion is published only for 2024 (64 units, clean, exact). The obstacle is the boundary: geoBoundaries GEO **ADM2** is a **2007** vintage of **68** units that predates the self-governing-city reforms and mismatches the 2024 self-gov frame (64 units), so a municipality build would need a concordance the project forbids inventing, or an official/COD-AB self-gov layer of the 2024 vintage. Deferred, not built (the Peru-district / Mali-boundary precedent).
- **2014 municipality religion** was not found as an open table on the demographic-social-characteristics page (only the region table); the Geostat census results database may hold it, but the region series is the cross-wave product and the deeper 2014 municipality route is not pursued here.

## Retrieval record

Every cached input is under `data/raw/ge_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download.

| Cached input | Source URL | Format | SHA-256 (first 16) |
| --- | --- | --- | --- |
| `ge_2002_vol_I-tomi.pdf` | <https://geostat.ge/media/44559/I-tomi.pdf> | pdf | `ef80478888abe4e9` |
| `ge_2014_population_by_regions_and_religion.xls` | <https://geostat.ge/media/44724/22_Population-by-regions-and-religion.xls> | xls | `174c501ccf4bbe27` |
| `ge_2024_population_by_regions_selfgov_sex_religion.xlsx` | <https://geostat.ge/media/80625/6.-Population-by-regions%2C-self-governed-units%2C-sex-and-religion.xlsx> | xlsx | `0093286100a4edea` |
| `geoBoundaries-GEO-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GEO/ADM1/geoBoundaries-GEO-ADM1.geojson> | geojson | `d9a34f3b97c39a00` |
| `gb_geo_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/GEO/ADM1/> | json | `8128e773ce31499b` |
| `geostat_terms_of_use_en.txt` | <https://www.geostat.ge/en/page/monacemta-gamoyenebis-pirobebi> | txt (rendered capture) | `4f8dfb46e7173d94` |

Also cached (context / provenance, not build inputs): the 2002 Volumes II, III-1, III-2, IV PDFs and their `pdftotext -layout` extractions (Volume II = rural population by nationality; Volumes III/IV carry no religion-by-region table); the 2024 XLSX self-governed-unit rows (the deferred municipality product); the LibreOffice-converted `ge_2014_...xlsx` (the old .xls trips `xlrd` on a formula token, so it is converted for extraction, both cached).

## Blockers and held items

- **Licence**: accepted (open reuse with attribution); no ask, no block.
- **2002 no-religion slot** (documented, not a block): the Table #29 residual bundles other-religion with no-religion, so 2002 ships `no_religion_percent = null` and `religious_affiliation_percent` as a recorded lower bound.
- **2014 suppression** (documented, not a block): `…`(≤10) on small affiliation sub-categories; the two headline slots stay exact, the verbatim breakdown carries `…`, the suppression bound is recorded.
- **Territorial scope** (documented, not a block): Abkhazia and South Ossetia are not enumerated; 2002 carries a 1,956-person Abkhazia fraction (flagged), Shida Kartli is enumerated only in its controlled part (flagged); rendered as published, no coverage invented.
- **Municipality (2024)** (HELD, deeper product): clean 64-unit self-gov religion data exists, but no boundary of the matching 2024 self-gov vintage is licensed and public (geoBoundaries ADM2 is a 68-unit 2007 vintage). Unblock: an official Geostat self-governed-unit layer or a 2024-vintage COD-AB ADM2. Deferred, no concordance invented.
