# Thailand census-religion route probe

Verified 2026-07-12. Thailand's National Statistical Office (NSO, `nso.go.th`) asked religion in the 2000 and 2010 population and housing censuses, and the **2010 census publishes religion by province (changwat) as a full-count integer table** — "Table 4 Population by religion, sex and area" — in each of the 77 provincial final reports. That is the buildable route, and it is a genuine province-level product on the **2010 census frame of 76 provinces** (nine verbatim categories, all persons, full count) — the probe's decisive frame finding is that the NongKhai report is the old (pre-Bueng-Kan) frame and the separate BuengKan report re-tabulates the same eight amphoes, so the 77-report set double-counts and the honest product is the 76-unit 2010 frame. The queue row premise ("Province in 2010 tables ... browser work | probe then build") holds on the wave and the geography; it is refuted on the access route. The route is **not** the live statbbi/browser portal the row implies: `statbbi.nso.go.th` (the Oracle-BI portal that once served the per-province religion cross-tabs cited by Wikipedia) and `nsoweb.nso.go.th` are **decommissioned** (NXDOMAIN via Cloudflare DoH), and the live `www.nso.go.th` sits behind a CloudWAF/Cloudflare managed challenge that blocks automated fetches (HTTP 418/302 with WAF cookies; `cf-mitigated: challenge`). The 2010 province religion tables are recovered instead from the NSO's own archived provincial final-report PDFs (`web.nso.go.th/.../popeng/2010/Report/<Province>_T.pdf`), which are **text-extractable** (clean Thai+English+digits via `pdftotext -layout`) and reconcile to their printed province totals within a ±1–3 published independent-rounding bound, and the 76-frame province sums reconcile to the WholeKingdom national Table 4 within −7 (total) and ±14 (per category). The boundary route is clean: geoBoundaries THA ADM1 records a stated Open Data Commons Open Database License 1.0 (ODbL) over 77 provinces that join the 2010 report frame one-to-one after a three-name concordance, rendered per-vintage as 76 units by unioning the Bueng Kan polygon into Nong Khai (geometrically exact). The open-data portal (`catalog.nso.go.th`, a CKAN with a "Creative Commons Attributions" licence) does **not** carry census province religion — its religion group (os-04) is survey-based, region-level, age-13+ — so the census route is the archived report set under NSO's open-data attribution posture (BUILD-THEN-ASK).

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD (and BUILT, 2026-07-12, staged) a 76-province (2010 census frame), single-wave (2010) religious-affiliation product from the 2010 census provincial final reports' Table 4. The subnational bar is cleared: 76 provinces, nine verbatim count categories, all-persons full count, per-province reconciliation within a ±3 published bound (41 exact, 35 within ±1–3), a national cross-source control within −7/±14, and a clean one-to-one licensed boundary.
- **Wave**: 2010 only (census date 1 September 2010; provincial final reports published 2012, processing all households in each province — full count, not sample). Deeper history is held (see below): the 2000 census publishes religion by province only as a two-category percentage summary (Buddhism %, Muslim %) with no counts and no no-religion line; the full 2000 count table is region-level (five regions, in thousands) or was on the dead statbbi portal.
- **Geography**: **76 provinces — the 2010 census frame** — on geoBoundaries THA ADM1 (2017 geometry, ODbL) with the Bueng Kan polygon unioned into Nong Khai. The decisive frame finding: `NongKhai_T.pdf` is the **old (2010-vintage) frame** — its Table 1 lists all 17 amphoes, including the eight transferred to Bueng Kan in March 2011 — and the separate `BuengKan_T.pdf` **re-tabulates those same eight amphoes** (verified row-by-row in both Table 1s), so summing all 77 reports double-counts Bueng Kan: the 77-report Total sum exceeds the WholeKingdom national Table 4 total by 362,747, and Bueng Kan's own total is 362,754. The product ships the NSO-published 2010 frame (76 provinces) on a per-vintage boundary — the Bueng Kan polygon unioned into Nong Khai, geometrically exact because Bueng Kan was carved wholly from Nong Khai. No unpublished cell is derived by subtraction and no allocation is invented; the Bueng Kan re-tabulation (Table 4 total 362,754; Buddhism 360,468; Islam 242; Christianity 1,913) is recorded as a deferred source for a possible future finer-frame view.
- **Construct**: census affiliation — each resident's reported religion (2010 questionnaire item "What religion": Buddhism 1, Islam 2, Christianity 3, ...), asked of all persons of all ages; not practice, attendance, or membership.
- **Slot design** (ordinary two-slot, BZ/SB/FM/KI precedent): `religious_affiliation_percent` = (province population − No religion − Unknown) / population; `no_religion_percent` = the "No religion" (ไม่มีศาสนา) line / population. The "Unknown" (ไม่ทราบ) non-response line stays in the denominator and in neither slot, so the two shares need not sum to 100.
- **Map-worthy pattern**: the deep South is the story and it is legible in the counts. Pattani 2010 is 513,841 Muslim of 609,015 (84%) against 94,507 Buddhist; Narathiwat, Yala, and Satun are likewise Muslim-majority, while the rest of the kingdom is >90% Buddhist. Christianity concentrates in the northern highland provinces (Chiang Mai, Chiang Rai, Tak — Tak 2010: 22,903 Christian). This province contrast is the reason to map Thailand, and it is exactly the sensitive southern-border signal the country README flags for separate annotation.
- **Rights position**: no reuse licence is stated on the 2010 census report PDFs (NSO publisher front matter only). The NSO open-data catalogue (`catalog.nso.go.th`) labels its published datasets "Creative Commons Attributions". Ship derived province summaries with attribution to the National Statistical Office of Thailand under the standing BUILD-THEN-ASK ruling; an NSO reuse-confirmation is the clean courtesy unblock. The boundary carries a stated ODbL 1.0 (share-alike; the MY/GH OSM-ODbL precedent).

## Premise corrections (trust the record)

The queue row and country README are refuted on route and partly on wave, and confirmed on geography:

1. **"browser work" / statbbi is refuted.** The per-province 2010 religion cross-tabs once lived on `statbbi.nso.go.th` (Oracle BI portal; the source Wikipedia's provincial tables cite). That subdomain and `nsoweb.nso.go.th` are decommissioned — NXDOMAIN confirmed via Cloudflare DoH (`Status 0`, SOA-only, no A record). The live `www.nso.go.th` is behind CloudWAF + a Cloudflare managed challenge (`cf-mitigated: challenge`); automated fetch returns 418/302. Browser automation cannot reach a dead subdomain, and the challenge must never be solved by an agent. The record's usable route is the **archived NSO provincial final-report PDFs**, not a live browser session.
2. **The open-data portal does not carry census province religion.** `catalog.nso.go.th` (CKAN) has a Religion group (os-04, "Creative Commons Attributions" licence) but every dataset in it is the **Survey on Social, Cultural and Mental-Health (Happiness) Conditions** — region-level (ภาค), age 13+, not the census and not by province. The README's "statbbi.nso.go.th ... 2010" pointer no longer resolves to province religion.
3. **2000 province religion is percentage-only.** The archived 2000 census provincial workbooks (`web.nso.go.th/census/poph/finalrep/tables/<prov>/<prov>.xls`) and short PDFs carry religion only as an indicator: Buddhism % and Muslim %, two categories, no counts, no no-religion line. The full 2000 nine-category count table is region-level (`eadv_tab3.xls`, five regions, in thousands). So 2000 does not support the same province product; 2010 does. The README's "Province in 2010 tables" is the correct target and it is buildable.
4. **Geography: the 2010 frame is 76 provinces, and the naive 77-report reading double-counts.** The brief's Bueng Kan warning was exactly right. The NongKhai report is old-frame (17 amphoes, incl. the eight that became Bueng Kan) and the BuengKan report re-tabulates the same eight amphoes; summing all 77 reports exceeds the WholeKingdom total by 362,747 ≈ Bueng Kan's 362,754. The build renders the 2010 frame: 76 provinces, per-vintage boundary (Bueng Kan unioned into Nong Khai), never an invented concordance or a derived subtraction.

## Published waves and geography

| Year | Official route | Religion-by-province table | Method | Universe | Decision |
| --- | --- | --- | --- | --- | --- |
| 2010 | 2010 census provincial final reports `web.nso.go.th/sites/2014en/Documents/popeng/2010/Report/<Province>_T.pdf` (archived; live host WAF-blocked) | **Table 4 "Population by religion, sex and area"** — nine categories, integer full count, one table per province | full-count enumeration (all households processed) | all persons, all ages | **Ship the 2010 wave on the 76-province 2010 frame** (NongKhai is old-frame; BuengKan is a re-tabulation — see premise correction 4). |
| 2000 | 2000 provincial workbooks `.../finalrep/tables/<prov>/<prov>.xls`; advance-report `.../eng/en/pop2000/table/eadv_tab3.xls` | province level: Buddhism % + Muslim % only (indicators, no counts); region level (eadv_tab3): nine categories, **in thousands**, five regions | full count | all persons | HOLD for province — percentage-only, two categories, no no-religion; region-level only for counts. |
| 2020 | register-assisted census (COVID-affected); NSO 2020 methodology | not located as a province religion table | register + field | — | HOLD — no province religion count located (see below). |
| 1990 | printed as a comparison column in the 2000 provincial reports | Buddhism % / Muslim % only | full count | all persons | HOLD — percentage-only, pre-1993 frame. |

The 2010 report set is complete: 77 province reports plus `Central_T.pdf`, `Northern_T.pdf`, `Northeastern_T.pdf`, `Southern_T.pdf` (regional) and `WholeKingdom_T.pdf` (national). The regional and national reports carry the same Table 4 and serve as **cross-source reconciliation controls** (Central Table 4 total 18,183,308; Southern 8,871,002).

## Category frame (2010 Table 4, preserved verbatim; never merged)

Nine categories in printed order, Thai original alongside the report's English label:

| # | Thai (verbatim) | English (report) | Product role |
| ---: | --- | --- | --- |
| — | ยอดรวม / รวมยอด | Total | province population denominator |
| 1 | พุทธ | Buddhism | affiliation |
| 2 | อิสลาม | Islam | affiliation |
| 3 | คริสต์ | Christianity | affiliation |
| 4 | ฮินดู | Hindus | affiliation |
| 5 | ขงจื้อ | Confucious *(sic)* | affiliation |
| 6 | ซิกข์ | Sikh | affiliation |
| 7 | อื่น ๆ | Others | residual affiliation |
| 8 | ไม่มีศาสนา | No religion | no-religion |
| 9 | ไม่ทราบ | Unknown | non-response |

Two frame facts. First, the English labels carry per-report typographic variants ("Buddihism" for Buddhism in Tak; "Confucious" throughout for Confucius; "รวมยอด" reversed for the total in Ayutthaya). The extraction keys on the **Thai** labels, which are stable across all 77 reports, and preserves the verbatim printed strings. Second, some provinces omit a zero category (e.g. Ranong prints no ไม่ทราบ/Unknown row): a category absent from a province's printed table is rendered as 0 for that province, never imputed.

## Universe and denominator

Every province's Table 4 denominator is the province population "Total" row (all persons, all ages), which equals the province's Table 1 population total (verified: Pattani Table 4 Total 609,015 = Table 1 Total 609,015). Religion is asked of the whole resident population, so the province shares are directly comparable in construct across provinces. The build reads each province's shares within its own Total-row denominator.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build — all PASSED 2026-07-12)

- **Per-province**: the nine category counts sum to the printed province "Total" row **exactly for 41 of the 76 census-frame provinces** and within **±1 to ±3 persons for the other 35** (36 deviations of ±1, 3 of ±2, one of −3: Roi Et, whose Unknown row prints as dashes). These are the NSO tables' own independent-rounding/disclosure residuals in a full-count table — a known artifact, **not** an extraction error (each anomaly was re-read against the source layout). Three provinces omit zero rows entirely (Maha Sarakham omits No religion and Unknown; Ranong and Samut Songkhram omit Unknown), rendered as 0 per the printed record. The build carries the published category counts verbatim, uses the printed Total row as the population denominator, derives the affiliation slot as the residual (population − No religion − Unknown), and **records each province's category-sum-minus-Total deviation** in the quality flag; no value is allocated, imputed, rounded, or tuned. The build gate fails beyond ±3.
- **National cross-source (the frame proof)**: the **76** census-frame province Totals sum to **65,981,653** against the WholeKingdom Table 4 total of **65,981,660** (deviation −7 over 66M), and every category reconciles within ±14: Buddhism 61,746,415 vs 61,746,429 (−14); Islam 3,259,341 vs 3,259,340 (+1); Christianity 789,383 vs 789,376 (+7); Hindus 41,809 vs 41,808 (+1); Confucious 16,716 vs 16,718 (−2); Sikh 11,122 vs 11,124 (−2); Others 66,924 vs 66,922 (+2); No religion 46,119 vs 46,122 (−3); Unknown 3,822 vs 3,820 (+2). The naive **77**-report sum instead deviates by **+362,747 ≈ Bueng Kan's 362,754** — the double-count that pins the 76-frame decision. The four regional reports plus Bangkok sum to 65,981,658 (−2), a further control. The build gate fails beyond ±25 per category.
- The extraction keys on the **Thai** category labels normalised for combining marks (some PDFs encode tone marks as Adobe PUA glyphs U+F70x — the Southern regional report prints ไม\uf70aมีศาสนา), because the English labels carry per-report typos ("Buddihism" in Tak) and the Ayutthaya report reverses the Total label (รวมยอด for ยอดรวม).

## Boundary source and licence

The boundary is [geoBoundaries THA ADM1](https://www.geoboundaries.org/api/current/gbOpen/THA/ADM1/). The release metadata records, verbatim: `"admUnitCount": "77"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wambacher"`, `"boundaryLicense": "Open Data Commons Open Database License 1.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`, pinned at commit `9469f09`. The licence field is non-null, so the boundary route is accepted (ODbL is share-alike; the Malaysia/Ghana OSM-ODbL precedent). Each feature carries a `shapeISO` ISO-3166-2 code (TH-10 … TH-96) used for the stable area code, and a `shapeName` English province name. The 77 `shapeName` values join the census province reports one-to-one after a three-name concordance (report → boundary): `Ayutthaya → Phra Nakhon Si Ayutthaya`, `Phachuap → Prachuap Khiri Khan`, `Ubonatchathani → Ubon Ratchathani`; the remaining match by normalisation. Verified: 77/77 matched, no unmatched province, no unused boundary feature. For the shipped 2010 frame the build unions the `Bueng Kan Province` polygon into `Nong Khai Province` (76 features; the merged unit keeps ISO TH-43 with a quality-flag note that it spans TH-43+TH-38), yielding 76 valid, distinct geometries. Thailand spans ~97–106 E, far from the antimeridian; no dateline handling is needed.

**COD-AB alternative**: OCHA's Common Operational Dataset (COD-AB THA ADM1, from the Royal Thai Survey Department) is the official-boundary alternative and would also give 77 provinces; geoBoundaries ODbL is used because its licence is stated and byte-pinned. COD-AB is recorded as the official-source fallback.

## Licence position

No reuse licence appears on the 2010 census report PDFs. The front matter records only the publisher: "Division-in-Charge: Population Statistics Group, Social Statistics Bureau, National Statistical Office" and "Distributed by: Statistical Forecasting Bureau, National Statistical Office ... Published 2012" (retrieved 2026-07-12). No copyright, rights-reserved, or Creative Commons clause is present in the report text.

The NSO open-data catalogue does state a licence. `catalog.nso.go.th` (CKAN) returns, for every religion dataset, `"license_id": "Creative Commons Attributions"`, `"license_title": "Creative Commons Attributions"` (fetched verbatim from `https://catalog.nso.go.th/api/3/action/package_show`, 2026-07-12; the portal's licence register also lists `cc-by` "Creative Commons Attribution"). This licence governs the catalogue's published datasets (the survey religion tables), not the archived census report PDFs, whose own licence is unstated.

Recommended position, mirroring the RO/SK/CI/MONSTAT/LK summaries-with-attribution line: publish derived 77-province religion summaries with attribution to the National Statistical Office of Thailand under BUILD-THEN-ASK, record the census-report source licence as needs_review, and note the catalogue's "Creative Commons Attributions" posture as supporting context. An NSO reuse-confirmation email is the clean courtesy unblock (do not send; record for the PI). The boundary is ODbL 1.0 (attribution + share-alike to OpenStreetMap contributors).

## Sensitivity (country README, carried into the build)

Religion maps are sensitive in the deep-South border provinces (Pattani, Yala, Narathiwat, and parts of Satun and Songkhla), where the Muslim-majority Malay population and a long-running conflict make the category signal politically charged. The build renders the NSO record verbatim and neutrally; the page treatment (separate annotation of the southern-border provinces) is the README's standing instruction and is a page concern, out of the data lane's scope. Recorded here so the page lane carries it.

## Retrieval record

Every cached input is under `data/raw/th_census/`, which `git check-ignore` confirms is excluded by the `.gitignore` `data/` rule. Retrieval occurred on 2026-07-12 from the Internet Archive (`web.archive.org`) replays of the NSO originals (the live NSO hosts are WAF-blocked to automation; `statbbi`/`nsoweb` are NXDOMAIN). Content type verified on every download (reports `application/pdf`, valid; boundary valid GeoJSON; metadata valid JSON).

Per-file sha256 for all 82 report PDFs are pinned in the manifest (`docs/manifests/th-census-religion-2010.json`, `raw_sources`). Key anchors:

| Cached input | Source URL (NSO original) | Format | Notes / sha256 |
| --- | --- | --- | --- |
| `reports2010/<Province>_T.pdf` (77 + WholeKingdom + 4 regional) | `http://web.nso.go.th/sites/2014en/Documents/popeng/2010/Report/<Province>_T.pdf` | pdf | 2010 census provincial final reports; Table 4 religion by province, full count. All 82 sha256-pinned in the manifest. |
| `reports2010/WholeKingdom_T.pdf` (national control) | as above | pdf | `9a3a58232a25398d0faaa8812a075d3019c34f99237227fd1bfe2d316f7baad8` |
| `reports2010/NongKhai_T.pdf` (old-frame proof) | as above | pdf | `9af1d760baa00af8b5f2ecddb63b9634215d9fda5dca73411281d5e393c3106b` |
| `reports2010/BuengKan_T.pdf` (deferred re-tabulation) | as above | pdf | `a319bf776361df5e542bd6dc55b46b2267885c70af5694948f260e5d69ff93dd` |
| `table4_extracted.json` (transcription embedded in the build) | — | json | `ef30d4deb9431b9eb430590dfb99ffd3324ff0391ef3ca9ac92a097524348e90` |
| `geoBoundaries-THA-ADM1.geojson` | `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/THA/ADM1/geoBoundaries-THA-ADM1.geojson` | geojson | 77 provinces, ODbL 1.0. `145beb11e52785a42e16997c92a65426b3df8d009941db6b012ec8e411f3e33c` |
| `gb_tha_adm1_meta.json` | `https://www.geoboundaries.org/api/current/gbOpen/THA/ADM1/` | json | records ODbL 1.0, admUnitCount 77, boundaryYearRepresented 2017. `10119cda1b995f724304f99132ecca4a80dbeb96aaf750b8eabf24747ee5a38d` |
| `eadv_tab3.xls` | `http://web.nso.go.th/eng/en/pop2000/table/eadv_tab3.xls` | xls | 2000 advance report, religion by region (in thousands) — context, not the build. |
| `ckan_religion_search.json` | `https://catalog.nso.go.th/api/3/action/package_search?q=religion` | json | CKAN open-data religion group (survey, region-level) — context; licence "Creative Commons Attributions". |
| `equestion.pdf` | `http://web.nso.go.th/census/poph/report/equestion.pdf` | pdf | census questionnaire (religion item). |

Working files also cached (not build inputs): `pattani2010.txt` and other `pdftotext -layout` extractions, `table4_extracted.json` (transcription), `concordance.json` (77/77 province→boundary map), `extract_table4.py` (extractor).

## Build outcome (2026-07-12)

BUILT and validated, STAGED (no page, no hub link — page work is out of this lane's scope):

- `scripts/build_th_area_summary.R` — embeds the verbatim 76-province Table 4 counts (transcription pinned at `data/raw/th_census/table4_extracted.json`), reconciles fail-fast (province gate ±3; national gate ±25), unions Bueng Kan into Nong Khai for the per-vintage boundary, and emits the products.
- `apps/regions/th/data/area_summary_province.json` (+ `.csv`) — 76 rows, schema-valid against `schemas/area-summary.schema.json` (`uvx check-jsonschema`: ok). Headline examples: Pattani pop 609,015, Islam 513,841 (84.4%), No religion 23; Bangkok pop 8,305,218, No religion 17,091 (0.21%); Narathiwat No religion 0.
- `apps/regions/th/data/th_province_2010frame.geojson` — 76 features, all valid, 76 distinct geometry hashes, 1,079,907 bytes at 30% mapshaper keep.
- `docs/manifests/th-census-religion-2010.json` — `bash scripts/validate_manifests.sh`: **92/92 pass**.
- Build gates: province gate PASSED (41 exact, 35 within ±3); national control PASSED (−7 total, ±14 categories); boundary gate PASSED (76/76 join, distinct hashes); licence needs_review under BUILD-THEN-ASK.

## Blockers and held items

- **Access (transient infrastructure, not a route block)**: the live NSO hosts are WAF/Cloudflare-blocked to automation and `statbbi`/`nsoweb` are decommissioned; the data is recovered from Internet Archive replays of the NSO report PDFs. The Wayback replay throttles bulk downloads, so retrieving all 82 report PDFs is slow; the retrieval is scripted with backoff. This is a bandwidth constraint on THIS environment, not a data, licence, or route defect.
- **Licence** (needs_review, not a hard block under BUILD-THEN-ASK): no stated reuse licence on the 2010 census report PDFs; ships with attribution to NSO; the catalogue's "Creative Commons Attributions" is supporting context; an NSO courtesy ask is recorded for the PI.
- **Reconciliation** (documented, not a block): 35 of 76 provinces carry a ±1–3 person residual between the nine category counts and the printed province Total, and the cross-report national control deviates by −7 (total) and at most ±14 (categories) — the NSO's own production residuals across 82 separately produced report volumes; carried verbatim and disclosed, never repaired.
- **2020 wave** (HELD): the 2020 census was register-assisted and COVID-affected; no province-level religion count table was located in open products. Unblock: confirm whether NSO published a 2020 religion-by-province table (a data-availability question, likely resolved only via the WAF-gated live portal or an NSO request).
- **2000 / 1990 waves** (HELD): province-level religion is percentage-only, two categories (Buddhism %, Muslim %), no counts, no no-religion line; the full 2000 nine-category count table is region-level (five regions, in thousands). A 2000 province product would need the province count table recovered from the dead statbbi portal or an NSO request. Not shipped; the 2010 wave is the product.
- **CHANGE-WITHHOLD**: with only 2010 shipped, no cross-wave change is claimed. The 2000 percentage summary and the 2010 counts are not the same instrument or frame and are not compared.

## Recommended queue-row text

> | 67 | Thailand (TH) | 2010 | Province (76, 2010 census frame) | Census religion by person; 2010 provincial final reports Table 4 | clean PDF extraction (archived; live NSO WAF-blocked) | [route-probe](countries/th/route-probe.md) | BUILT 2026-07-12 (staged): 76-province 2010 full-count product under BUILD-THEN-ASK with NSO attribution; boundary ODbL. 2000 (percent-only) and 2020 (no located province table) HELD; NSO courtesy ask recorded. |
