# Cambodia census-religion route probe

Probed 2026-07-11 (build-queue rank 40). Cambodia collected religion in the 1998, 2008, and 2019 general population censuses. The province-level religion series exists in exactly one published place: Table 2.5.1 of the 2019 census final report, which prints one-decimal percentages for four religion categories, by province, for both 2008 and 2019, harmonised onto the current 25-province frame. No public source — not the report, not the priority-table workbook, not the CamStat portal, not the provincial reports — publishes religion **counts** by province. The machine-readable CamStat portal carries religion only at the national level. The build is therefore a two-wave (2008, 2019) province-level percentage-share product on 25 provinces, joinable to geoBoundaries ADM1 under the Open Database Licence, with a derived-count or derived-share treatment because the province cells are percentages, not counts.

## Institution and portals

The National Institute of Statistics (NIS), under the Ministry of Planning of the Royal Government of Cambodia, is the source of record. Three routes were checked.

- [NIS census landing page](https://nis.gov.kh/en/general-population-census-of-cambodia/) — hosts every 1998/2008/2019 report PDF and the 2019 priority-table workbook (direct URLs recorded below).
- [CamStat](https://camstat.nis.gov.kh/) — a SIS-CC `.Stat Suite` data explorer ("National Indicator Reporting Platform"), machine-readable over an SDMX (NSI) web service. The service base is `https://nsiws-stable-camstat-live.officialstatistics.org/rest/`; the config, styles, and Keycloak realm are hosted on `*.officialstatistics.org`.
- [NIS microdata catalogue](https://microdata.nis.gov.kh/index.php/catalog) — 1998 (catalog/25), 2008, and 2019 census microdata behind a registration/restricted-access wall (not pursued; microdata never enter git).

## Waves and published geography

| Wave | Verified religion publication | Published geography | Format | Build decision |
| --- | --- | --- | --- | --- |
| 1998 | CamStat `DF_CULTURE` (national percentages); [1998 national report](https://nis.gov.kh/wp-content/uploads/2025/09/General-Population-Census1998.pdf) Table A3 "Population by Religion, Age and Sex" | National only (24 provinces then; no province × religion table located) | SDMX-CSV + PDF | National context only. No subnational 1998 religion table is published. |
| 2008 | [2019 final report](https://nis.gov.kh/wp-content/uploads/2025/09/Final-General-Population-Census-2019-English.pdf) Table 2.5.1; CamStat `DF_POPULATION_BY_REGION` / `DF_CULTURE` (national) | **Province** (25, retabulated onto the current frame) in Table 2.5.1; national in CamStat | PDF percentages (province); SDMX-CSV (national) | Buildable, percentages only. |
| 2019 | [2019 final report](https://nis.gov.kh/wp-content/uploads/2025/09/Final-General-Population-Census-2019-English.pdf) Table 2.5.1; national counts in the priority-table workbook Table A4 | **Province** (25) in Table 2.5.1; national counts in Table A4; national percentages in CamStat | PDF percentages (province); XLSX counts (national) | Intended finest-geography product, percentages only. |

The 2008 census final report PDF ([`GPC2008_Report_ENG.pdf`](https://nis.gov.kh/wp-content/uploads/2025/09/GPC2008_Report_ENG.pdf), 147 MB, 308 pp) is a scanned image with no text layer; any 2008-native province religion table it contains would need optical character recognition and is not required, because Table 2.5.1 already republishes the 2008 province percentages on the current frame. The 2019 provincial reports were checked (Kep, `23.Kep-Provincial-Report.pdf`, has a text layer) and carry **no** religion table.

### Table 2.5.1 — the province route (verbatim extraction)

Title as printed: *"Table 2.5.1. Percentage distribution of population by religion, area, and province, Cambodia, 2008-2019\*"*. Footnotes as printed: *"\*Note: These figures exclude migrants working abroad."* and *"Note: The sum of the four religion categories amounts to 100 percent."* Column heads: `Buddhist  Muslims  Christians  Other` (repeated for 2008 and for 2019). Values are one-decimal percentages. The 2008 block is retabulated onto 25 provinces — Tbong Khmum, created 2013 from Kampong Cham, appears as its own 2008 row — so both waves share one 25-province frame.

| Province (as printed) | 2008 Bud | Mus | Chr | Oth | 2019 Bud | Mus | Chr | Oth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Total | 96.9 | 1.9 | 0.4 | 0.8 | 97.1 | 2.0 | 0.3 | 0.5 |
| Banteay Meanchey | 99.2 | 0.5 | 0.3 | 0.0 | 99.3 | 0.4 | 0.2 | 0.0 |
| Battambang | 98.3 | 1.3 | 0.3 | 0.0 | 98.3 | 1.4 | 0.3 | 0.0 |
| Kampong Cham | 97.6 | 2.3 | 0.1 | 0.0 | 97.6 | 2.3 | 0.1 | 0.0 |
| Kampong Chhnang | 94.7 | 4.2 | 0.4 | 0.7 | 93.1 | 5.8 | 0.3 | 0.9 |
| Kampong Speu | 99.7 | 0.1 | 0.2 | 0.0 | 99.8 | 0.1 | 0.1 | 0.0 |
| Kampong Thom | 99.0 | 0.6 | 0.4 | 0.0 | 98.6 | 1.0 | 0.3 | 0.0 |
| Kampot | 97.1 | 2.7 | 0.2 | 0.0 | 96.9 | 2.8 | 0.2 | 0.0 |
| Kandal | 98.0 | 1.2 | 0.7 | 0.1 | 98.3 | 1.2 | 0.4 | 0.1 |
| Koh Kong | 95.2 | 4.6 | 0.2 | 0.0 | 95.1 | 4.6 | 0.2 | 0.0 |
| Kratie | 94.0 | 5.6 | 0.4 | 0.1 | 93.1 | 6.6 | 0.2 | 0.1 |
| Mondul Kiri | 54.7 | 5.5 | 4.4 | 35.5 | 70.4 | 4.4 | 4.0 | 21.2 |
| Phnom Penh | 97.5 | 1.5 | 0.8 | 0.1 | 97.8 | 1.6 | 0.5 | 0.1 |
| Preah Vihear | 99.4 | 0.3 | 0.3 | 0.0 | 99.1 | 0.5 | 0.3 | 0.0 |
| Prey Veng | 99.5 | 0.1 | 0.2 | 0.1 | 99.5 | 0.2 | 0.3 | 0.0 |
| Pursat | 97.4 | 2.4 | 0.2 | 0.0 | 96.9 | 3.0 | 0.1 | 0.0 |
| Ratanak Kiri | 49.3 | 1.3 | 2.3 | 47.2 | 73.4 | 1.3 | 2.1 | 23.2 |
| Siem Reap | 99.7 | 0.2 | 0.1 | 0.0 | 99.3 | 0.2 | 0.4 | 0.1 |
| Preah Sihanouk | 94.5 | 4.7 | 0.7 | 0.1 | 96.2 | 3.6 | 0.2 | 0.0 |
| Stung Treng | 96.1 | 1.3 | 0.4 | 2.2 | 93.6 | 4.7 | 0.4 | 1.3 |
| Svay Rieng | 99.7 | 0.1 | 0.2 | 0.0 | 99.8 | 0.1 | 0.1 | 0.1 |
| Takeo | 99.1 | 0.7 | 0.2 | 0.0 | 99.2 | 0.6 | 0.1 | 0.0 |
| Otdar Meanchey | 99.8 | 0.1 | 0.1 | 0.0 | 99.5 | 0.2 | 0.3 | 0.0 |
| Kep | 98.7 | 1.2 | 0.0 | 0.0 | 97.5 | 1.7 | 0.7 | 0.1 |
| Pailin | 99.1 | 0.7 | 0.2 | 0.0 | 98.3 | 1.0 | 0.7 | 0.0 |
| Tbong Khmum | 88.9 | 11.0 | 0.1 | 0.0 | 88.1 | 11.8 | 0.1 | 0.0 |

The table also prints Urban and Rural rows (2008: 97.4/1.6/0.8/0.2 and 96.8/2.0/0.3/0.9; 2019: 97.7/1.6/0.4/0.2 and 96.7/2.3/0.2/0.8), retained for reconciliation. Note the strong Mondul Kiri and Ratanak Kiri "Other" shares (highland indigenous religion) and the between-wave jump there, which the report attributes to reclassification; treat any 2008→2019 change in those two provinces with caution.

## National anchors for reconciliation

The 2019 priority-table workbook ([`Final-Priority-Tables-A-H.xlsx`](https://nis.gov.kh/wp-content/uploads/2025/09/Final-Priority-Tables-A-H.xlsx), sheet "Tables A", Table A4 "De facto population: Sex and 5-year age group by Religion") gives exact **national counts** for 2019:

| Category (A4 label) | Count |
| --- | ---: |
| Total Pop. | 15,552,211 |
| Buddhism | 15,096,757 |
| Islam | 317,649 |
| Christianity | 49,160 |
| Other | 85,443 |
| Not Stated | 3,202 |

The five categories sum to 15,552,211 exactly. The four-religion percentages (Buddhism 97.07, Islam 2.04, Christianity 0.32, Other 0.55, re-based to exclude the 3,202 "Not Stated") match the Table 2.5.1 national row (97.1/2.0/0.3/0.5). CamStat supplies national percentages for all three waves — 1998: Islam 2.15, Christianity 0.46, Other 0.82; 2008: Islam 1.92, Christianity 0.37, Other 0.76; 2019: Islam 2.0, Christianity 0.3 — as a cross-check.

## Category frame (verbatim labels)

Two label sets exist and must be recorded as published, not merged.

- **2019 final report, Table 2.5.1:** `Buddhist`, `Muslims`, `Christians`, `Other`. Four categories, re-based to 100 percent (no "Not Stated" column).
- **Priority-table workbook (Table A4) and CamStat SDMX codelist:** `Buddhism`, `Islam`, `Christianity`, `Other`, `Not Stated`.
- **Questionnaire code frame (1998 form, verbatim):** religion codes `1: Buddhism`, `2: Islam`, `3: Christianity` (higher codes for other/none). The "Other" category, per the report, "mainly refers to the local religious system of the highland tribal groups and a few minority religious groups from other countries."

No verbatim Khmer religion labels were captured in machine-readable form; the report body and workbook publish English labels. The Khmer report PDFs (`Final-General-Population-Census-2019-Khmer.pdf`, `GPC2008_Report_KHM.pdf`) hold the Khmer strings if needed for a bilingual panel.

## Machine-readable CamStat route (national religion only)

CamStat exposes two dataflows that carry the religion indicator. Both were pulled as SDMX-CSV and confirmed **national-only, percentages-only**.

- `KH_NIS:DF_POPULATION_BY_REGION(1.1)` — the "Population by Religion" indicator has 24 observations, every one `REF_AREA = ASIKHM (Cambodia)`, `UNIT_MEASURE = PERCENT`, for 2008 and 2019 by sex. The dataflow's `REF_AREA` codelist does include all 25 provinces and district codes, but no religion observation is coded to any province.
- `KH_NIS:DF_CULTURE(1.1)` — 36 observations, "Population by Religion", national, percentages, adding the **1998** national wave.

Structure and data endpoints (SDMX 2.1 REST):

- Dataflow structure: `https://nsiws-stable-camstat-live.officialstatistics.org/rest/dataflow/KH_NIS/DF_POPULATION_BY_REGION/1.1?references=all`
- Data (SDMX-CSV, labels=both): `https://nsiws-stable-camstat-live.officialstatistics.org/rest/data/KH_NIS,DF_POPULATION_BY_REGION,1.1/all?startPeriod=2008&endPeriod=2020`
- Verbatim source annotations on the religion observations: `MoP, NIS_General Population Census of Cambodia 2008_2009` and `MoP, NIS_General Population Census of Cambodia 1998_1999`; responsible agency `MOP_NIS: Ministry of Planning`.

The portal is therefore useful as a national cross-check and as a citation of the underlying censuses, but it does not shorten the province route: the province cells still come from Table 2.5.1 in the PDF.

## Reuse terms (verbatim)

No open-data licence was located for the NIS census outputs. The two authoritative statements are quoted byte-for-byte:

- **NIS website footer** (`https://nis.gov.kh/`): `© 2025 វិទ្យាស្ថានជាតិស្ថិតិ ក្រសួងផែនការ នៃរាជរដ្ឋាភិបាលកម្ពុជា។ រក្សាសិទ្ធិគ្រប់យ៉ាង។` — "© 2025 National Institute of Statistics, Ministry of Planning of the Royal Government of Cambodia. All rights reserved." The closing phrase `រក្សាសិទ្ធិគ្រប់យ៉ាង` is "all rights reserved".
- **CamStat portal**: the `.Stat Suite` footer links `Terms & Conditions` to `http://www.oecd.org/termsandconditions`, and the share `disclaimer` string is empty. This is the **unmodified SIS-CC/.Stat template default** (it points at OECD's generic terms, not a NIS grant); it is not an authoritative NIS reuse licence and should not be quoted as one.

Position: NIS asserts bare all-rights-reserved copyright, with no permissive licence. This is the Côte d'Ivoire / Iran situation. Under the ratified precedent (PI, 2026-07-10/11) derived category summaries — not raw source tables — may publish with NIS/Ministry of Planning attribution under PI approval, with the raw PDFs and workbook staying git-ignored. Confirm the PI extends that ruling to Cambodia before shipping.

## Boundaries

The 25 current provinces match [geoBoundaries KHM ADM1](https://www.geoboundaries.org/api/current/gbOpen/KHM/ADM1/) one-to-one. The **release-specific** metadata (not the site banner) records boundary ID `KHM-ADM1-37992800`, 25 features, year represented 2017, licence `Open Data Commons Open Database License 1.0` (ODbL), licence source `www.openstreetmap.org/copyright`, source `wambachers-osm.website/boundaries/` (OpenStreetMap-derived). The pinned geometry is [`geoBoundaries-KHM-ADM1.geojson`](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1.geojson) (25 features, `shapeName` field). ODbL is a share-alike open licence usable under the ratified Ghana/Malaysia OSM-ODbL precedent, with attribution and share-alike on the derived boundary layer.

Because year 2017 is after the 2013 Tboung Khmum split, the layer already carries all 25 provinces including Tbong Khmum, and Table 2.5.1 already retabulates 2008 onto the same 25-province frame. **Both waves join to one 25-province geometry** — no cross-wave concordance is needed. Five `shapeName` spellings need normalisation to the census names: `Bantey Meanchey → Banteay Meanchey`, `Mondulkiri → Mondul Kiri`, `Oddar Meanchey → Otdar Meanchey`, `Ratanakiri Province → Ratanak Kiri`, and `Tbong Khmum` (report) vs `Tboung Khmum` (provincial-report filename); the remaining 20 match on a simple case/space fold. No 1998 boundary is needed because 1998 religion is national-only.

## Boundary and province-change notes

The 1998 census used 24 provinces (Kampong Cham combined). Tboung Khmum split from Kampong Cham in 2013 and appears from 2019. Because the province religion series starts at 2008 and NIS publishes the 2008 figures already split onto 25 provinces (Table 2.5.1), the split does not force a harmonisation choice for this build; the 25-province ADM1 layer serves both waves directly.

## Cached inputs (git-ignored, `data/raw/kh_census/`)

| File | SHA-256 |
| --- | --- |
| `gpc2019_final_en.pdf` | `8a10064a917f4492136abc770901ddfc868490e0558bd12ac1e4ded86d9d36b5` |
| `gpc2008_report_en.pdf` (scanned, no text layer) | `8822426da56ae8fee7d89381f840bc6bfd95010f8aab0799fc7c32aca6cf7bd6` |
| `gpc1998.pdf` | `d5acab6f5b18df91368b9f580fa2e38724b52a7643112380e4be939a0ec5d25b` |
| `priority_tables_A-H.xlsx` | `1855425d8f588626ccf64a413f8172150e9d8b8f535d0deeb038d6e0e73d35f3` |
| `prov_kep_2019.pdf` (no religion table; evidence) | `7f82be666b32f1f7d4a9ac052cb9cc9570913cdb6a8fc2f24787c26b8a7f976f` |
| `df_pop_by_region.csv` (CamStat SDMX-CSV) | `096c2ce8042ca8e3fcecc2e2d4e6071cc9f341b3c61730879cc82fc0d03ad26e` |
| `df_culture.csv` (CamStat SDMX-CSV) | `01e064f855dd03357dca1878013a6eb165a9262e8b1d45dc705465ed99274855` |
| `gb_khm_adm1_meta.json` | `ab0351fd84cb7bdede92c0de370ab0d4e05a199126f54019d9d24f80cd29d4eb` |
| `gb_khm_adm1.geojson` | `e057f5378e3e01e55b8ff6c91c97d665d7636de1b903cce4ba7d318f1e653b28` |

## Blockers

1. **No province-level counts anywhere public.** The province religion cells are one-decimal percentages (Table 2.5.1). Exact per-province count reconciliation is impossible; a count product must be derived (province percentage × province total population), and a share product carries a rounding bound. This is the Burkina Faso / Estonia derived-bound situation, not a hard blocker.
2. **All-rights-reserved licence.** NIS publishes no open licence and asserts "all rights reserved". Shipping needs the PI to extend the CI/Iran derived-summaries-with-attribution ruling to Cambodia.
3. **Boundary share-alike.** The only pinned open ADM1 layer is OSM-derived under ODbL; publication inherits ODbL attribution and share-alike (already-ratified precedent).
4. **Highland-province comparability.** Mondul Kiri and Ratanak Kiri show large 2008→2019 shifts in the "Other" (indigenous) share; the report flags reclassification. Any change layer for those two provinces should carry a caveat or withhold change.

## Build/hold recommendation

**BUILD**, as a two-wave (2008, 2019) province-level religious-share product on the 25-province geoBoundaries ADM1 (ODbL) frame, four categories (Buddhist/Muslim/Christian/Other), one-decimal percentages from Table 2.5.1, with the 2019 national counts (Table A4) as the reconciliation anchor and CamStat national percentages (1998/2008/2019) as a cross-check. The build is small and clean: 25 units, a one-to-one single-frame join with five name normalisations, no cross-wave concordance, and an exact national reconciliation at the aggregate. It sits squarely under three already-ratified rulings — the Burkina Faso derived-bound treatment for percentage-only tables, the Côte d'Ivoire / Iran derived-summaries-with-attribution treatment for an all-rights-reserved source, and the Ghana / Malaysia OSM-ODbL boundary precedent. The only conductor decision needed before a build lane opens is to confirm those three precedents apply to Cambodia; if so, proceed. Hold only the 1998 wave (national-only) and any Mondul Kiri / Ratanak Kiri change layer (reclassification).
