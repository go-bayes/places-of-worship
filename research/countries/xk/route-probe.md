# Kosovo census-religion route probe

Verified 2026-07-12. The Kosovo Agency of Statistics (KAS, Albanian ASK; `ask.rks-gov.net`, data portal `askdata.rks-gov.net`) publishes religion **by municipality** as a count-valued cross-tab for both modern censuses — **2011 and 2024** — in a single machine-readable PxWeb table, `census2024_10.px` ("Population by religion and sex at country and municipal level for the years 2011 and 2024"). One table carries both waves, the national ("KOSOVA") row, and all 38 municipalities, on the six-category frame Islam / Orthodox / Catholic / Others / No religious affiliation / Prefers not to answer (plus a Total column). Every wave reconciles exactly at both margins: every municipality row sums across the six categories to its printed total, and every religion column sums across municipalities to the printed national total (2011 total 1,739,825; 2024 total 1,585,566). The queue premise holds on waves and geography and is refuted only on route quality — this is a clean machine-readable API route (PxWeb JSON-stat2), not browser work. The single load-bearing coverage fact is the boycott record, rendered as published and never repaired: in 2011 the four northern Serb-majority municipalities (Leposaviq, Zubin Potok, Zveqan, and North Mitrovica) are **absent from the table** (empty cells), and in 2024 those same four carry implausibly low counts (Leposaviq 3,185; Zubin Potok 763; Zveqan 434; North Mitrovica 2,326) consistent with a continued partial boycott. The boundary route is clean: geoBoundaries XKX ADM2 records 38 municipalities under a stated Creative Commons Attribution-ShareAlike 2.0 licence, joining the census one-to-one after a small name crosswalk (one non-obvious pair, Drenas ↔ Gllogoc). The licence gate is cleared cleanly: the 2024 First Final Results report prints, verbatim, "© Kosovo Agency of Statistics. Reuse is authorised provided the source is acknowledged." — an explicit open reuse grant with attribution.

## Build decision (recommendation to the conductor)

- **Recommendation: BUILD** a 38-municipality, two-wave religious-affiliation series (2011 and 2024). The subnational bar is cleared comfortably — two waves, 38 municipalities, count-valued, exact-margin reconciliation in every wave, from a machine-readable official API.
- **Licence: ACCEPTED, no ruling needed.** KAS grants reuse with source acknowledgement in its own census report ("Reuse is authorised provided the source is acknowledged.", quoted verbatim below and cached). This is a clean open-reuse-with-attribution posture; the census data need no PI ruling. The product ships with attribution to the Kosovo Agency of Statistics.
- **Coverage / comparability (CHANGE-WITHHOLD).** The 2011 and 2024 waves do not cover the same territory: the 2011 census omits the four northern municipalities entirely (boycott; North Mitrovica did not yet exist as a separate municipality — it was carved from Mitrovica in 2013), while the 2024 census enumerates them only partially (a continued northern boycott, visible in the tiny 2024 counts). No cross-wave municipal change is claimed; each wave ships as levels, and the four northern units render as null-religion features in 2011 (Sri Lanka unenumerated-district precedent). The two waves ride the same 38-unit boundary frame, so the geometry is stable across waves even though the 2011 coverage is incomplete.
- **Map-worthy pattern.** Kosovo is overwhelmingly Muslim and the religious geography is legible by municipality. Nationally in 2011 Islam is 95.6% (1,663,412 / 1,739,825), Catholic 2.2% (38,438), Orthodox 1.5% (25,837); the Catholic share concentrates in the western Gjakovë/Klinë/Prizren belt and the Orthodox share in the Serb-majority enclaves (Graçanicë, Shtërpcë, Ranillug, Partesh, Kllokot) and the north. Between waves the "No religious affiliation" and "Prefers not to answer" lines grow sharply (nationally 1,242 → 7,899 and 9,708 → 23,718), a within-wave/response-climate signal to display as levels, never asserted as a cross-wave affiliation change across the coverage break.

## Published waves and geography

| Year | Official route | Religion-by-municipality table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2011 | KAS ASKdata PxWeb, table [`census2024_10.px`](https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__Census%20population__1_Demographic_Characteristics/census2024_10.px/) (Year = 2011 slice) | Population by religion and sex at country and municipal level | usually resident population, all ages | 38 municipalities (34 enumerated; 4 northern absent) | Ship the 2011 wave; the four northern municipalities render as null-religion features. |
| 2024 | KAS ASKdata PxWeb, table `census2024_10.px` (Year = 2024 slice); national figures corroborated by the [2024 First Final Results](https://askapi.rks-gov.net/Custom/bffbac3c-f325-4b18-b0e3-755dcb4cccf0.pdf) Tab. 3.6 | Population by religion and sex at country and municipal level | usually resident population, all ages | 38 municipalities (all present; northern four partial-boycott low counts) | Ship the 38-municipality 2024 wave. |

Two source facts govern the routing. The first source fact is that a single PxWeb table carries both waves at municipal level: `census2024_10.px` has dimensions KOMUNA (39 values: KOSOVA plus 38 municipalities), Viti/Year (2024, 2011), Gjinia/Sex (Male, Female, Total), and RELIGJIONI/Religion (Total, Islam, Orthodox, Catholic, Others, No religious affiliation, Prefers not to answer); the build reads the Total-sex slice. The second source fact is that the same religion figures appear in the printed 2024 First Final Results report (Tab. 3.6 "Usually resident population by religion, sex and age": Total 1,585,566; Islamic 1,482,276; Orthodox 36,683; Catholic 27,815; Other 7,175; No religion 7,899; Preferred not to answer 23,718), which matches the PxWeb cube exactly and fixes the universe wording ("usually resident population") and the licence.

## Category frame (verbatim, three languages)

The six substantive categories plus the Total column are identical across both waves. KAS publishes the PxWeb portal in Albanian (sq), English (en), and Serbian (sr); all three verbatim label sets are cached and carried on the product.

| English (portal en) | Albanian (portal sq) | Serbian (portal sr) | Product role |
| --- | --- | --- | --- |
| Total | Gjithsej | Ukupno | control total |
| Islam | Islam | Islam | religious affiliation |
| Orthodox | Ortodoks | Pravoslavni | religious affiliation |
| Catholic | Katolik | Katolički | religious affiliation |
| Others | Të tjerë | Ostali | residual affiliation |
| No religious affiliation | Asnjë besim fetar | Nema versku pripadnost | no-religion |
| Prefers not to answer | Preferon të mos përgjigjet | Preferira da ne odgovori | non-response residual |

The printed 2024 report uses the English variants "Islamic", "Other", "No religion", "Preferred not to answer" for the same categories; the build carries the portal's English labels ("Islam", "Others", "No religious affiliation", "Prefers not to answer") with the Albanian and Serbian originals recorded verbatim on every row's quality flag. No category is invented, merged, redistributed, or backcast.

## Universe and denominator

Both waves count the usually resident population of all ages (religion was asked of the whole enumerated resident population), so the municipal denominators are internally comparable within each wave. Each wave's religion-table total equals the census resident total in the table: 2011 total 1,739,825; 2024 total 1,585,566. The 2011 total is the standard published 2011 census figure (which itself excludes the boycotted north), and the 2024 religion-table universe (1,585,566) is the usually-resident enumerated population reported in the First Final Results religion tabulation. Shares are read within each municipality's own wave denominator; population change across the pair is never treated as a religion change, and — because the two waves cover different territory (the northern coverage break) — no cross-wave municipal change is claimed at all.

## Slot design (ordinary two-slot, KZ/BZ precedent)

Kosovo has a real "No religious affiliation" category, so the product uses the ordinary two-slot design, not the minority-share design (no task-6 gate).

- `religious_affiliation_percent` = summed share of every religious-affiliation category (Islam + Orthodox + Catholic + Others) / population. `religious_affiliation_count` = population − No religious affiliation − Prefers not to answer.
- `no_religion_percent` = the single "No religious affiliation" line (Asnjë besim fetar) / population.
- "Prefers not to answer" (Preferon të mos përgjigjet) stays in the denominator and in neither slot, so the two shares need not sum to 100 (the KZ Refused-to-indicate precedent). This matters because the non-response line grows to 1.50% nationally in 2024.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **2011**: the 34 enumerated municipality totals sum to the printed national 1,739,825, and every religion column sums across those municipalities to its printed national total (Islam 1,663,412; Orthodox 25,837; Catholic 38,438; Others 1,188; No religious affiliation 1,242; Prefers not to answer 9,708). Every enumerated municipality row sums across the six categories to its printed total. The four northern municipalities (Leposaviq, Zubin Potok, Zveqan, North Mitrovica) are empty in the source and are carried as null, never imputed. Both margins close exactly.
- **2024**: all 38 municipality totals sum to the printed national 1,585,566, and every religion column sums to its printed national total (Islam 1,482,276; Orthodox 36,683; Catholic 27,815; Others 7,175; No religious affiliation 7,899; Prefers not to answer 23,718). Every municipality row closes exactly. Both margins close exactly.
- The build stops and records any failing row on mismatch; no value is allocated, inferred, imputed, or tuned. Two blank-cell conventions govern the read, and the reconciliation gates enforce the difference. The first blank-cell convention is the unenumerated municipality: in 2011 the four northern municipalities have a **null Total**, marking absent enumeration; they are carried as null, never imputed. The second blank-cell convention is the zero category: in 2024, 21 small-category cells are blank while the municipality Total is present, and every such row still closes exactly to its Total, so PxWeb is rendering a genuine zero as a blank — read as zero, not suppression. The row gate is the guard: any blank that would break a municipality's reconciliation to its Total (genuine suppression) stops the build.

## Boundary source and licence

The boundary is [geoBoundaries XKX ADM2](https://www.geoboundaries.org/api/current/gbOpen/XKX/ADM2/), pinned at commit `9469f09`. The release metadata records `"admUnitCount": "38"`, `"boundaryType": "ADM2"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wambacher"`, and — the load-bearing field, quoted verbatim — `"boundaryLicense": "Creative Commons Attribution-ShareAlike 2.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`. The licence field is non-null, so the boundary route is accepted (the CC BY-SA share-alike is carried; Belize CC BY 2.5 and Ghana ODbL-sharealike precedent). The 38 `shapeName` values ("Municipality of …") join the 38 census municipalities one-to-one after a transliteration/name crosswalk. Thirty-seven join by an obvious name normalisation (Gjakova↔Gjakovë, Peja↔Pejë, Pristina↔Prishtinë, Skenderaj↔Skënderaj, Suhareka↔Suharekë, Malisheva↔Malishevë, Kamenica↔Kamenicë, Klina↔Klinë, Gracanica↔Graçanicë, Han i Elezit↔Hani i Elezit, Mamusha↔Mamushë, North Mitrovica↔Mitrovicë e Veriut, Zveçan↔Zveqan, Podujeva↔Podujevë, and the identity cases). The one non-obvious pair is **Drenas ↔ Gllogoc** — the geoBoundaries layer uses the Albanian name Drenas for the municipality the census lists as Gllogoc (Glogovac); this is the same municipality and is recorded in the crosswalk. The extent spans lon 20.01 to 21.79 E and lat 41.86 to 43.27 N, wholly within the standard frame and far from the antimeridian; no dateline handling is needed. Both waves ride this single 38-unit boundary set (the census frame is stable across waves; only the 2011 coverage is incomplete).

The geoBoundaries XKX ADM1 release is the wrong layer for this product (`admUnitCount: 48`, an OSM artefact rather than Kosovo's seven districts), so ADM2 is used directly for the municipality frame. OCHA COD-AB and official KAS cadastral layers are recorded as alternative routes but are not needed: geoBoundaries ADM2 already delivers the exact 38-municipality frame with a stated licence.

## Licence position (accepted)

The census data ship under the KAS open reuse grant. The 2024 First Final Results report (`askapi.rks-gov.net/Custom/bffbac3c-f325-4b18-b0e3-755dcb4cccf0.pdf`, front matter, retrieved 2026-07-12) states verbatim:

> "Publisher: Kosovo Agency of Statistics (KAS). Publication date: December, 2024. © Kosovo Agency of Statistics. Reuse is authorised provided the source is acknowledged. A lot of information is available on the internet, which can be accessed through the KAS website http://ask.rks-gov.net"

This is an open licence conditioned only on source acknowledgement: `licence_status: accepted`. The required attribution is the Kosovo Agency of Statistics (KAS / Agjencia e Statistikave të Kosovës). No courtesy ask is needed. The PxWeb JSON-stat2 responses carry `"source":"Kosovo Agency of Statistics"` in-band, corroborating the publisher.

## Status note (contested status, rendered plainly)

Kosovo's international status is contested; the project takes no position on it. The product renders the official Kosovo Agency of Statistics record on the official Kosovo administrative frame (38 municipalities), as published. The dataset uses the country code XK (ISO 3166 user-assigned; XKX in geoBoundaries), consistent with the repository's existing Kosovo handling and separate from Serbia. The northern-municipality boycott is a coverage fact of the KAS record, disclosed on the product and never editorialised.

## Premise corrections (trust the record)

- **The route is machine-readable, not browser work.** The queue row ("browser work") is refuted: KAS serves both waves at municipal level through the ASKdata PxWeb JSON-stat2 API, retrieved with a single POST. No browser session was needed.
- **One table, both waves.** The brief implied separate 2011 and 2024 releases (ask.rks-gov.net for 2011, askdata.rks-gov.net for 2024). The record consolidates both waves in a single 2024-vintage PxWeb table, `census2024_10.px`, on the current 38-municipality frame — this is the operative route.
- **The boycott persists into 2024.** The brief flagged the 2011 boycott (four northern municipalities). The record shows the boycott continued into 2024: those four municipalities carry implausibly low 2024 counts (763–3,185), not full enumeration. Both waves' northern coverage is incomplete; the 2011 wave omits the north entirely, the 2024 wave enumerates it partially. Rendered as published, never repaired.
- **North Mitrovica is a post-2011 municipality.** North Mitrovica (Mitrovicë e Veriut) was established from Mitrovica in 2013, so its 2011 absence is both a boycott effect and a frame effect; the table lists it as a 38th municipality with empty 2011 cells.

## Retrieval record

Every cached input is under `data/raw/xk_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `census2024_10_religion.json` | ASKdata PxWeb POST, table `census2024_10.px` (en, Total sex, both years, all municipalities/religions) | json-stat2 | `5b4b74c9fc2952ef86263344230d2ee837b74610b728f1a73aa736166a4b54b6` |
| `census2024_10_meta.json` | <https://askdata.rks-gov.net/api/v1/en/ASKdata/Census%20population/1_Demographic_Characteristics/census2024_10.px> | json | `bdb0a93c905af51008a2727e5041edb2403f2f2828de615b96cbc4a83238f42f` |
| `census2024_10_meta_sq.json` | ASKdata PxWeb metadata (sq / Albanian) | json | `96d523207ccbd55da1be426ae9c894740694b2f129cf6eacfc8414236076ce6e` |
| `census2024_10_meta_sr.json` | ASKdata PxWeb metadata (sr / Serbian) | json | `c86044e87fb5e326c5915d66c198d169b50447a6bd421b973956f5def551db08` |
| `xk_2024_first_final_results.pdf` | <https://askapi.rks-gov.net/Custom/bffbac3c-f325-4b18-b0e3-755dcb4cccf0.pdf> | pdf | `88784927499a623b7b203dfbd81e1f6d29d33cd4809f6be7f0f7b78c47c56e49` |
| `geoBoundaries-XKX-ADM2.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/XKX/ADM2/geoBoundaries-XKX-ADM2.geojson> | geojson | `f04b49acd0fee5fa14db1377afa8f1d30b1530643d4aa063133a7b69b04c4b90` |
| `gb_xkx_adm2_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/XKX/ADM2/> | json | `cc64f2198d3ee8e6460c5b834b6577ae902dd90471351a4e873464f546161bf2` |

## Blockers and held items

None material. The build ships two waves, both reconcile exactly at both margins, the boundary is licensed (CC BY-SA 2.0), and the census licence is an explicit open reuse grant with attribution. Recorded caps: the northern-municipality coverage is incomplete in both waves (2011 absent, 2024 partial boycott) and is rendered as published; no cross-wave municipal change is claimed (the coverage break); the "usually resident population" universe and the enumerated (non-estimated) religion totals are what ship, and the KAS "with estimation" population products (used for some ethnicity tables) are not mixed into the religion figures.

## Product boundary

A build on this probe stages municipality-level religious-affiliation summaries for 2011 (34 enumerated + 4 null northern municipalities) and 2024 (all 38 municipalities) on the single geoBoundaries XKX ADM2 38-unit frame (CC BY-SA 2.0), with the verbatim six-category frame in Albanian, Serbian, and English, fail-fast reconciliation at both margins (both waves close exactly), and the ordinary two-slot design (Prefers-not-to-answer as a disclosed denominator residual). It carries no place-of-worship layer, no cross-wave municipal change layer (the northern coverage break), and no pre-2011 wave (religion by municipality is published only for 2011 and 2024 in this table). The census licence is an accepted open reuse grant; the product ships with attribution to the Kosovo Agency of Statistics.
