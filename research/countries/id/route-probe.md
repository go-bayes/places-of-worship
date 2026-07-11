# Indonesia census-religion route probe

Verified 2026-07-12. Indonesia's Badan Pusat Statistik (BPS) published religion by province and by kabupaten/kota from the 2010 census (SP2010), openly and count-valued, through the census tabulation portal `sensus.bps.go.id`. The queue premise ("2010-2024 | Kabupaten/kota route in BPS table interface | census religious affiliation | published provincial and kabupaten religion tables") is refuted on three points that together decide the buildable shape. First, the 2020 census (SP2020) dropped the religion question: BPS ran a short-form pandemic census and did not collect or tabulate religion, so census affiliation has a single modern wave with a published subnational religion table, SP2010. Second, the 2020-and-later subnational religion figures that circulate come from Ditjen Dukcapil (Ministry of Home Affairs civil registration), released semi-annually since about 2020; that is administrative registration, a different construct from census self-report, which this product keeps out and never merges. Third, the kabupaten/kota grain is data-available in SP2010 but boundary-blocked for a clean build: every open licensed regency/city layer is the 2020 (519-unit) frame, while SP2010 used the roughly 497-unit 2010 frame, and mapping across the 2010-to-2020 kabupaten splits would require an invented concordance, which the project forbids. The buildable product is therefore a single-wave province series (33 provinces, 2010 frame), which reconciles exactly at both margins and joins a CC BY 3.0 IGO boundary after one documented dissolve.

BUILT 2026-07-12, STAGED (no page, no hub link): `scripts/build_id_area_summary.R` produces 33 rows (33 provinces x 1 wave), `apps/regions/id/data/area_summary_province.{json,csv}`, `apps/regions/id/data/id_province_2019.geojson`, and `docs/manifests/id-census-religion-2010.json`. Both schema checks pass; all 80 manifests validate.

## Build decision

- **Recommendation**: BUILT a 33-unit, single-wave (SP2010) province religious-affiliation series. The subnational bar is cleared comfortably — 33 large, religiously contrasted provinces, count-valued, exact-margin reconciliation. WAVES-OVER-DISTRICTS does not favour a coarse multi-wave alternative here because there is no second census religion wave; the province product is the strongest cleanly-buildable shape, and kabupaten is boundary-blocked.
- **Wave**: 2010 (SP2010), from the BPS census tabulation portal, "Penduduk Menurut Wilayah dan Agama yang Dianut" (population by region and religion), integer full-count.
- **Geography**: 33 provinces on the 2010 census frame. The boundary (geoBoundaries IDN ADM1, gbHumanitarian, 34 provinces) is dissolved by uniting Kalimantan Utara into Kalimantan Timur — North Kalimantan was carved wholly out of East Kalimantan in 2012, after SP2010, so the union reconstructs the single 2010 province. This is a complete-unit aggregation, never an invented concordance (the Montenegro/Peru precedent).
- **Construct**: census affiliation — each resident's reported religion, asked of the whole resident population, not practice, attendance, or membership.
- **Slot design**: the Indonesian official frame has NO no-religion category. All seven lines are religions (Islam, Kristen, Katolik, Hindu, Budha, Khong Hu Chu, Lainnya), and Lainnya is other religions/beliefs. `religious_affiliation_percent` is the seven-religion share of the published Total; `no_religion` is null (rendered, not invented). The two non-response columns (Tidak Terjawab = not answered; Tidak Ditanyakan = not asked) stay in the denominator and in neither slot, so the affiliation share sits just below 100 (the FJ/SB/BZ unallocated-residual precedent). The seven-religion composition — the real signal — rides verbatim on each row's quality flag.
- **Map-worthy pattern**: the province-level composition is the reason to map Indonesia. Islam dominates the western provinces (Aceh, Sumatera Barat, Jawa Barat, Banten above 97 percent). Protestant (Kristen) and Catholic (Katolik) majorities hold the east: Nusa Tenggara Timur is 54 percent Catholic, Papua 65 percent Catholic and Protestant combined, Sulawesi Utara 64 percent Protestant-plus-Catholic, Maluku split Muslim/Christian. Hindu concentrates overwhelmingly in Bali (3,247,283 of 3,890,757, 83 percent). Confucian (Khong Hu Chu) and Buddhist populations concentrate in Kepulauan Bangka Belitung, Kepulauan Riau, and DKI Jakarta.
- **Rights position**: no open-data licence is stated on the BPS SP2010 source (copyright assertion only). Ship derived province summaries with attribution to BPS under BUILD-THEN-ASK; licence_status needs_review; a BPS reuse-confirmation ask is recorded for the PI. The boundary is CC BY 3.0 IGO.

## Published waves, universe, and geography

| Year | Reachable official route | Religion-by-province table | Universe | Decision |
| --- | --- | --- | --- | --- |
| 2010 (SP2010) | [BPS Sensus Penduduk 2010 tabulation portal](https://sensus.bps.go.id/topik/tabular/sp2010/12/0/0) (sensus.bps.go.id) | "Penduduk Menurut Wilayah dan Agama yang Dianut" — integer full-count, ten-column frame, 33 provinces (drills to kabupaten/kota) | all persons, all ages | Ship (exact counts, province). |
| 2020 (SP2020) | BPS Sensus Penduduk 2020 | **No religion table** — SP2020 dropped the religion question (pandemic short form) | — | HELD — no census religion collected. |
| 2020+ (Dukcapil) | [Ditjen Dukcapil GIS / semester releases](https://gis.dukcapil.kemendagri.go.id/peta/) | Religion by province and kabupaten/kota, semi-annual | civil-registration records | SEPARATE CONSTRUCT — administrative registration, not census; not merged. |
| 2000 and earlier | Provincial BPS tables (e.g., Bali 1971/2000/2010) | Province religion appears in provincial BPS tables, no single reachable national cross-province table pinned | census | HELD — deeper-history route needing province-by-province national assembly across changing province frames. |

The SP2010 table is server-rendered HTML at the tabulation portal (not a JSON API), so it was retrieved by direct request and parsed deterministically; a small-model fetch mis-aligned the category columns (it reported Bali and Nusa Tenggara Timur "Budha" values that are actually the Hindu/Catholic figures), confirming that only the deterministic parse of the source HTML is trustworthy for the build. The parsed province table matches the widely-cited official SP2010 national figures exactly (Islam 207,176,162; Kristen 16,528,513; Katolik 6,907,873; Hindu 4,012,116; Budha 1,703,254; Khong Hu Chu 117,091; Lainnya 299,617; national 237,641,326).

## Category frame (verbatim, SP2010)

| BPS category (verbatim) | Translation | Product role |
| --- | --- | --- |
| Islam | Islam | religious affiliation |
| Kristen | Protestant Christian | religious affiliation |
| Katolik | Catholic | religious affiliation |
| Hindu | Hindu | religious affiliation |
| Budha | Buddhist | religious affiliation |
| Khong Hu Chu | Confucian | religious affiliation |
| Lainnya | Other religion/belief | residual religious affiliation |
| Tidak Terjawab | Not answered | non-response residual (in denominator) |
| Tidak Ditanyakan | Not asked | non-response residual (in denominator) |

The verbatim BPS spelling is preserved and never normalised: "Budha" (not Buddha), "Khong Hu Chu" (not Khong Hu Cu), "Lainnya" (Other). No category is merged, redistributed, or backcast. The frame has no no-religion / atheist line, so the no-religion slot is null. The two non-response columns are kept as published, in the denominator, per the record's own Total.

## Universe and denominator

Every province row's denominator is the published census Total, which counts all persons of all ages and includes the Tidak Terjawab (not answered) and Tidak Ditanyakan (not asked) residual columns. Tidak Ditanyakan is nationally 757,118 and concentrates in a few provinces (Jawa Timur 264,535; Papua 23,352), marking areas where the religion question was not asked; it is disclosed and kept in the denominator, never repaired. The affiliation numerator is the seven-religion sum, so `religious_affiliation_percent` sits just below 100 by the residual (national residual 896,700 of 237,641,326, 0.38 percent).

## Reconciliation gates (verified; fail-fast in the builder)

- **Province rows**: every one of the 33 provinces' nine published category columns sums to its printed province Total; all 33 gates pass integer-exact.
- **Religion columns**: every one of the nine category columns sums over the 33 provinces to its printed national control (Islam 207,176,162; Kristen 16,528,513; Katolik 6,907,873; Hindu 4,012,116; Budha 1,703,254; Khong Hu Chu 117,091; Lainnya 299,617; Tidak Terjawab 139,582; Tidak Ditanyakan 757,118); all nine gates pass integer-exact.
- **Grand totals**: the 33 province Totals sum to 237,641,326, and the nine national controls sum to 237,641,326.
- The build stops on any margin failure and never allocates, infers, rounds, imputes, or tunes a published value. Two cells published as "-" (Maluku Tidak Terjawab; Papua Barat Lainnya) read as nil (0), as printed.

## Boundary source and licence

The boundary is [geoBoundaries IDN ADM1 (gbHumanitarian)](https://www.geoboundaries.org/api/current/gbHumanitarian/IDN/ADM1/). The release metadata states verbatim `"boundaryLicense": "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2019"`, `"admUnitCount": "34"`, `"boundarySource": "OCHA Regional Office for Asia and the Pacific (ROAP), HDX"`, and `"gjDownloadURL"` pinned at commit `9469f09`. This is the OCHA COD-AB layer (BPS lineage), a clean CC BY 3.0 IGO position; the build uses that metadata as the licence authority.

The 34 boundary provinces dissolve to the 33 census provinces after a three-name crosswalk (boundary "Aceh" to census "NANGGROE ACEH DARUSSALAM"; "Dki Jakarta" to "DKI JAKARTA"; "Daerah Istimewa Yogyakarta" to "DI YOGYAKARTA") and one complete-unit union (Kalimantan Utara into Kalimantan Timur). The dissolve is verified by the land area: the merged Kalimantan Timur is 196,250 km² (East Kalimantan proper ~127,000 plus North Kalimantan ~72,000), and Papua is 314,032 km² (the largest province). The extent spans lon ~95E to ~141E and lat ~6N to ~11S, wholly within the standard frame and far from the antimeridian; no dateline handling is needed, confirming the brief's expectation. The alternative geoBoundaries gbOpen ADM1 layer is OSM-derived under ODbL 1.0 (share-alike, 34 units, 2017); the gbHumanitarian CC BY 3.0 IGO layer is preferred as the cleaner, BPS-lineage boundary that matches the census authority. The full COD-AB combined download on HDX (all levels ADM0-ADM4, 456 MB) was not needed.

The 2022 creation of four new provinces from Papua post-dates both the census and the 2019 boundary vintage, so it does not affect this product; Papua and Papua Barat were already separate provinces in both SP2010 and the boundary.

## Licence position

No open-data licence is stated on the BPS Sensus Penduduk 2010 source. The `sensus.bps.go.id` page footer asserts, verbatim from the cached HTML (retrieved 2026-07-12): "Copyright © 2026 - Badan Pusat Statistik | Sensus Penduduk 2010" — a copyright assertion with no reuse grant. The main `bps.go.id` term-of-use page sits behind a Cloudflare "Just a moment..." human-verification challenge, which this lane does not complete (the standing no-CAPTCHA rule); the challenge did not clear passively on a wait, so the full BPS terms are a recorded gap.

Recommended position (RO/SK/CI/MONSTAT precedent, BUILD-THEN-ASK): publish derived 33-province religion summaries with attribution to Badan Pusat Statistik (BPS), record the source licence as needs_review, and defer to a PI ruling. A BPS reuse-confirmation ask is the clean unblock; none is held. No microdata is touched.

## Retrieval record

Every cached input is under `data/raw/id_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `sp2010_religion_province_national.html` | <https://sensus.bps.go.id/topik/tabular/sp2010/12/0/0> | html | `128523b66613fd5166fb89b0f1c31aebc542ede7855789686d55febda9029101` |
| `geoBoundaries-IDN-ADM1-gbHum.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbHumanitarian/IDN/ADM1/geoBoundaries-IDN-ADM1.geojson> | geojson | `88eb119bf5eaa57060e53616313a02ef69ceb8d4a91cb9a282cf9d0e7c84b828` |
| `gb_idn_adm1_gbhum_meta.json` | <https://www.geoboundaries.org/api/current/gbHumanitarian/IDN/ADM1/> | json | `38a7b843f5959e5cba3a0868d31f31a788b922f13330b7a55577fe665deda482` |

Also cached (context / working files, not build inputs): `gb_idn_adm1_meta.json` and `gb_idn_adm2_meta.json` (gbOpen ADM1 ODbL and ADM2 CC BY 3.0 IGO metadata), `hdx_cod_ab_idn.json` (HDX COD-AB package metadata, CC BY-IGO), `sp2010_province_clean.json` and `sp2010_province_parsed.json` (the reconciled province extraction).

## Blockers and deferred routes

- **Licence** (the one genuine gate, needs_review): no open-data licence stated on the BPS source; the bps.go.id term-of-use is behind an uncompleted Cloudflare challenge. Resolve by PI ruling (summaries-with-attribution under BUILD-THEN-ASK, the shipped stance) or a BPS reuse-confirmation ask.
- **Kabupaten/kota (SP2010)**: data-available via the 33 province drill-downs (~497 units) but boundary-blocked — the open licensed ADM2 layers are the 2020 519-unit frame, and mapping across the 2010-to-2020 kabupaten splits needs an invented concordance (forbidden). HELD as the deeper route pending a licensed 2010-vintage ADM2 layer.
- **SP2020**: no census religion (question dropped). Not a wave.
- **Dukcapil 2020+**: administrative civil-registration religion by province and kabupaten/kota, semi-annual — a separate construct recorded as a future option, never merged into the census product. A genuine multi-wave *administrative-register* province series is buildable here (Taiwan register precedent) if the PI wants it as a distinct construct.
- **SP2000 and earlier**: province religion exists in provincial BPS tables but no single reachable national cross-province table was pinned; a deeper-history route needing province-by-province assembly across the changing province frame (Banten 2000, Gorontalo 2000, Kepulauan Bangka Belitung 2000, Kepulauan Riau 2004, Sulawesi Barat 2004, Papua Barat 2003, Maluku Utara 1999). HELD, no backcast.

## Product boundary

The build stages 33-province religious-affiliation summaries for 2010 (all persons, from SP2010 "Penduduk Menurut Wilayah dan Agama yang Dianut") on the geoBoundaries IDN ADM1 (gbHumanitarian) frame dissolved to the 33-unit 2010 census frame, with the seven-religion composition carried verbatim on each row. It carries the verbatim ten-column frame, the three-name boundary crosswalk plus the Kalimantan Utara union, and fail-fast integer-exact reconciliation at both margins. It does not contain a place-of-worship layer, place-density metrics, a no-religion slot (absent from the official frame — null, not invented), a kabupaten layer (data-available but boundary-blocked), an SP2020 wave (religion dropped), a Dukcapil administrative series (separate construct), or an SP2000 wave (national assembly not pinned). The BPS licence confirmation is the clean unblock; the kabupaten route (with a licensed 2010-vintage ADM2 layer) and the Dukcapil administrative-register series (as a distinct construct) are the recorded routes to deepen the coverage.
