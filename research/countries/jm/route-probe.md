# Jamaica census-religion route probe

Verified 2026-07-12. PROBE ONLY — no build. **Verdict: BUILDABLE (single wave, 2011) — refutes the queue premise.** The queue row 112 reads "parish table not located in published portal; religion release not found in sweep". The published record refutes both clauses. Jamaica's Statistical Institute (STATIN) publishes a full religion-by-parish count table for the 2011 census: **Volume 6, Table 5, "Population by Sex and Religious Affiliation/Denomination, by Parish"**, in the *Ethnic Origin & Religious Affiliation* thematic report. It carries one national block ("All Jamaica") plus one block for each of the 14 parishes, in counts (Total, Male, Female), over a 19-category parish frame. The 14 parish totals sum integer-exact to the national religion universe of 2,684,115, and the named denominational rows reconcile parish-to-national exactly (Roman Catholic 58,082; Seventh-Day Adventist 322,261; Pentecostal 319,730 each equal their 14-parish sum). The prior sweep missed it because it searched only the main-site census index (`statinja.gov.jm/Census/PopCensus/…`), which lists no religion table; the thematic volumes sit on a separate reports subdomain (`census.statinja.gov.jm/census-reports/`). The licence is an open reuse grant (STATIN Terms & Conditions of Data Use, quoted verbatim below): a non-exclusive, royalty-free licence to copy, use, and create derivative works for commercial and non-commercial purposes with attribution. The boundary is licensed: geoBoundaries JAM ADM1, 14 parishes, one-to-one to the census frame. A single-wave 2011 parish product is buildable now.

## Premise corrections (the record refutes the queue row)

The queue row 112 reads: `2011-2022 | parish table not located in published portal | census affiliation collected in questionnaire; religion release not found in sweep | browser work | probe then build`. The published record refutes its two central claims.

The first claim the record refutes is that no parish religion table is published. STATIN Volume 6 Table 5 is a religion-by-parish count table covering all 14 parishes, published openly as a PDF on the STATIN 2011 census reports portal. The prior survey (README, 2026-07-07) swept the main-site census index at `statinja.gov.jm/Census/PopCensus/Popcensus2011Index.aspx`, where every parish table is another subject (population by sex, age, housing, education, economic activity, disability) and the string "relig" never appears. The religion table lives instead in the thematic report volumes on `census.statinja.gov.jm`, a subdomain the earlier sweep did not reach.

The second claim the record refutes is that the religion release was not found. Religion was both collected (Individual Questionnaire item 1.5, "What is your/….'s religious affiliation or denomination?") and released: at the national level in the *General Report* Volume 1 (Table xiii, 2001 and 2011), and at the parish level in Volume 6 Table 5 (2011). The release exists; it was simply on the reports subdomain.

The third point concerns the wave span. The queue names "2011-2022". The 2022 census is in early release and publishes no religion product yet (see below), so the buildable wave is 2011 alone. This narrows the span, as with the Grenada and Barbados sibling probes.

## Published waves, geography, and grain

| Wave | Religion published? | Finest open geography | Counts or percentages | Universe | Source |
| --- | --- | --- | --- | --- | --- |
| 2001 (census) | Yes, national only in the located sources | national | counts + percent, 23-category frame | de jure population | *General Report* Vol 1, Table (xiii), 2001 column (national); no 2001 parish religion volume located |
| 2011 (census) | **Yes, national + all 14 parishes** | **14 parishes (ADM1)** | **counts** (Total/Male/Female) | de jure population, religion universe 2,684,115 | **Vol 6, Table 5** (parish); Vol 1 Table (xiii) and Vol 6 national block (national) |
| 2022 (census) | No religion release yet | — | — | — | 2022 index lists 6 early tables (population/dwelling counts, intercensal movement); no religion |

The 2011 parish religion table (Vol 6 Table 5) is the buildable product. The 2011 national religion figures appear in two places with a small processing difference: Vol 6 Table 5's national block totals **2,684,115** (23 categories, sums exact), while Vol 1 Table (xiii) totals **2,683,105** (the 2001-vs-2011 comparison run). A build must take Vol 6 Table 5 as the single source for the parish product and not mix the two runs.

## The parish table (Vol 6, Table 5) — frame, grain, reconciliation

Table 5 prints one block per geography. The national ("All Jamaica") block breaks out 23 categories; each parish block collapses the four small non-Christian groups (Baha'i, Hinduism, Islam, Judaism) into "Other Religious Affiliation/Denomination", giving a **19-category parish frame**. Vol 6 states the collapse explicitly in a footnote to the national block, quoted verbatim: "* This table does not represent the sum of the parish tables for the Bahai, Hinduism, Islam and Judaism". For every other category the national figure is the exact sum of the 14 parishes.

The 19-category parish frame, in printed order (Kingston block, transcribed exactly, "Seventh-Day Adventist" and "Jehovah's Witness" as spelled):

Anglican; Baptist; Brethren; Church of God in Jamaica; Church of God of Prophecy; New Testament Church of God; Other Church of God; Jehovah's Witness; Methodist; Moravian; Pentecostal; Rastafarian; Revivalist; Roman Catholic; Seventh-Day Adventist; United Church; Other Religious Affiliation/Denomination; No Religious Affiliation/Denomination; Not Reported.

National block (23 categories, verbatim counts, Total column; the four *italicised-here* groups are parish-collapsed into "Other"):

| Category | National count |
| --- | --: |
| Anglican | 75,143 |
| Baptist | 180,712 |
| Brethren | 24,128 |
| Church of God in Jamaica | 129,540 |
| Church of God of Prophecy | 121,254 |
| New Testament Church of God | 192,128 |
| Other Church of God | 247,291 |
| Jehovah's Witness | 50,854 |
| Methodist | 43,387 |
| Moravian | 18,358 |
| Pentecostal | 319,730 |
| Rastafarian | 29,040 |
| Revivalist | 36,413 |
| Roman Catholic | 58,082 |
| Seventh-Day Adventist | 322,261 |
| United Church | 56,334 |
| Bahai | 269 |
| Hinduism | 1,838 |
| Islam | 1,512 |
| Judaism | 506 |
| Other Religion/Denomination | 141,979 |
| No Religion/Denomination | 571,982 |
| Not Reported | 61,374 |
| **Total** | **2,684,115** |

Reconciliation verified in this probe. The 23 national categories sum to 2,684,115 exactly. The 14 parish totals sum to 2,684,115 exactly (Kingston 84,606; St Andrew 571,194; St Thomas 93,742; Portland 81,566; St Mary 113,172; St Ann 171,740; Trelawny 74,991; St James 182,820; Hanover 69,398; Westmoreland 143,847; St Elizabeth 150,025; Manchester 188,826; Clarendon 244,655; St Catherine 513,533). Three named denomination rows were summed across all 14 parish blocks and each equals its national total exactly: Roman Catholic 58,082, Seventh-Day Adventist 322,261, Pentecostal 319,730. A build script would parse every cell and fail-fast on any nonzero margin deviation, never allocating or imputing a missing cell.

The religion universe (2,684,115) is slightly below the full 2011 de jure census population (2,697,983 reported elsewhere on the STATIN site); the difference is a residual not carried in the religion tabulation. The parish product's denominator is the religion-universe total, and the shares are internally consistent to it.

## Small-cell and frame considerations

The four small non-Christian groups (Baha'i 269, Hinduism 1,838, Islam 1,512, Judaism 506 nationally) are **not** separately published by parish — STATIN folds them into the parish "Other" line by design, documented in the footnote. A parish product therefore ships the 19-category parish frame with "Other Religious Affiliation/Denomination" absorbing those four groups; it does not attempt to reconstruct Islam-by-parish or Hinduism-by-parish (which would be a redistribution the source forbids). No cell suppression by "-" appears in the parish blocks; the small non-Christian collapse is the only frame reduction. The build must also settle a two-slot no-religion design: "No Religious Affiliation/Denomination" (the affirmative none) is distinct from "Not Reported" (non-response); the former is the no-religion slot, the latter a non-response slot.

## Licence position (fetched and quoted verbatim)

STATIN publishes an explicit open reuse grant for its data. The governing text is the "Terms & Conditions of Data Use", fetched from `https://statinja.gov.jm/terms-of-use.aspx` on 2026-07-12 (cached `data/raw/jm_census/terms-of-use.html`, sha256 `d6a13671144cb51983eab771d92e650266a25ba88b5fff04124eae3ea11a7a81`). The load-bearing clauses, verbatim:

> **Licence.** STATIN grants to the Data User a non-exclusive, royalty-free licence to copy, use and create derivative works from STATIN's Data for commercial and non-commercial purposes, released through its website, www.statinja.gov.jm , subject to the terms of this Licence.

> **Approved use.** The Data User is permitted to produce and distribute derived works from STATIN's Data subject to proper attribution.

> **Attribution.** The Data User agrees to offer clear attribution to STATIN for all uses and derivations of STATIN's Data in any reasonable manner, but not in any way that suggests that STATIN endorses you or your use. The Data User also agrees to clearly indicate if changes were made to the data received from STATIN. Additionally, for data freely accessible on STATIN's website, data users are required to provide a link to the original data produced by STATIN.

> **Citation.** … the Data User agrees to properly cite STATIN's Data, including the Data Identifier, in any publications or in the metadata of any derived data products that are produced.

The definitions clause scopes the grant to "STATIN's Data … provided through the organization's website, publications or through other media" and to "Published Data … released by STATIN for general use via the Institute's website, publications or other medium" — which covers the Volume 6 report. The site footer carries a separate website-chrome copyright, verbatim: "Copyright © [year] Statistical Institute of Jamaica. All Rights Reserved" (from `statinja.gov.jm`, cached `statin_home.html`, sha256 `4e3b05e78589b9a029890ff697eb4cd025f201d42b838ebb19bb19f534fad2fd`). The footer governs the website content; the Terms of Use govern the data and grant open reuse.

**Classification: open licence (accepted).** The grant is a clear open reuse licence with attribution, in the family of the Grenada/Barbados/Guyana CSO Open Licence Agreements (PRASC pattern), though Jamaica's is STATIN's own instrument, not PRASC. `licence_status: accepted`; `licence_basis: statin_terms_and_conditions_of_data_use`. A build ships with attribution to STATIN, a note that the data were adapted, and a link to the source volume. No reuse ask is needed. The reports subdomain (`census.statinja.gov.jm`) carries no distinct licence in its static HTML; it is a STATIN publication and falls under the same Terms of Use.

## Boundary route (fetched and recorded verbatim)

The boundary is clean. geoBoundaries JAM ADM1 (metadata cached `gb_jam_adm1_meta.json`, sha256 `f2d174ffcc2af398a9728e4057a0cf471531cbd51e8511e4afaae80906108058`; geometry cached `geoBoundaries-JAM-ADM1.geojson`, sha256 `54e50f3b788cfcabe8d7b17031bc103c7dd550082da4755f9de6617b82d8d5b0`) records, verbatim: `"boundaryType": "ADM1"`, `"admUnitCount": "14"`, `"boundaryCanonical": "parish"`, `"boundaryYearRepresented": "2011"`, `"boundarySource": "OpenStreetMap, Wambacher"`, `"boundaryLicense": "Creative Commons Attribution-ShareAlike 2.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`, `gjDownloadURL` pinned at commit `9469f09`. The 14 `shapeName` values (Clarendon, Hanover, Kingston, Manchester, Portland, Saint Andrew, Saint Ann, Saint Catherine, Saint Elizabeth, Saint James, Saint Mary, Saint Thomas, Trelawny, Westmoreland) join one-to-one to the 14 census parishes ("Saint" ↔ the census "St" abbreviation). The boundary matches the census frame exactly in count and name. CC BY-SA 2.0 is a stated, non-null licence (share-alike; the derived boundary ships under CC BY-SA with attribution to OpenStreetMap contributors — the standard OSM precedent). An official National Land Agency parish vector would be an alternative if share-alike is unwanted, but the geoBoundaries layer is sufficient and licensed.

## Dead ends and negative findings (documented so the next probe does not repeat them)

- **Main-site 2011 census index** (`Popcensus2011Index.aspx`): fully inventoried; lists ~40 parish tables (population, housing A–K PDFs, education, economic activity, disability) and both questionnaires. The string "relig" appears zero times. This is the index the prior sweep saw, and it genuinely has no religion table — the religion product is on the reports subdomain, not here.
- **2022 census index** (`Popcensus2022Index.aspx`): lists 6 early-release 2022 tables (Components of Population Growth; Population and Dwelling counts by Community; Population Change by Parish; Population Change for the Four Fastest Growing Parishes; Summary of Intercensal Population Movements; Urban-Rural Enumeration Districts by Parish) plus a re-listing of the 2011 parish tables. No religion release; "relig" appears zero times. The 2022 census is delayed and only population/dwelling counts are out as of 2026-07-12.
- **2001 census page** (`Popcensus.aspx`): a landing page with no data-table links. The 2001 national religion figures survive as the 2001 column of Vol 1 Table (xiii); no 2001 religion-by-parish volume was located on either the main site or the reports subdomain (the reports subdomain hosts 2011 volumes only). A 2001 parish wave would need the 2001 census thematic reports, not found in this sweep.
- **CARICOM regional census tables** (fallback route): not needed. STATIN's own Volume 6 supplies the parish product directly, at finer category detail than a harmonised CARICOM table would carry, under STATIN's own open licence. CARICOM was not pursued because the primary source is complete and buildable.

## Retrieval record

Every cached input is under `data/raw/jm_census/`, confirmed git-ignored by `.gitignore:120` (the `data/` rule; `git check-ignore -v` returns `data/`). Retrieval date 2026-07-12. Downloads used `curl` with a browser user-agent. Content type verified on each object.

| Cached input | Source URL | SHA-256 | Bytes | Type |
| --- | --- | --- | --- | --- |
| `vol6_religion.pdf` | https://census.statinja.gov.jm/wp-content/themes/futurio-child/Census2011Reports/Population and Housing Census 2011 Jamaica Ethnic Origin & Religious Affiliation Vol 6 .pdf | `fb6b1c30cd2d760bad4025249a2e12c3444ef7d13746645dfb89ba6171145dd1` | 614090 | application/pdf (**Table 5: religion by parish**) |
| `vol1_general.pdf` | https://census.statinja.gov.jm/wp-content/themes/futurio-child/Census2011Reports/Population and Housing Census 2011 Jamaica General Report Vol 1.pdf | `7b81cfa16010a6bfab8d2ce2c44b1d15e9b0ca7851a9b12d5dfc556e7e93e25d` | 14184789 | application/pdf (national religion, Table xiii) |
| `indiv_q2011` | https://statinja.gov.jm/Census/Census2011/Individual%20Questionnaire_Census2011_FINAL.pdf | `c2aa5d1168c500afecfeca888f38f8182ba92854e032df25934186c5e7517163` | 205722 | application/pdf (item 1.5 religion) |
| `2011idx.html` | https://statinja.gov.jm/Census/PopCensus/Popcensus2011Index.aspx | `33146122795a267f4b7eb794e7766066b83735d9dc0b2cdd50c754502dc7345d` | 100237 | text/html (main index, no religion) |
| `2022idx.html` | https://statinja.gov.jm/Census/PopCensus/Popcensus2022Index.aspx | `2be92515e197dda88822d9f3d8e6a9b152094c0527912626d6cb1af0a2eeb764` | 102741 | text/html (2022 early tables, no religion) |
| `popcensus2001` | https://statinja.gov.jm/Popcensus.aspx | `6a653a395dab1ecda83881d9d2eb36a52e32c26ea7193fc325741056bd7d18df` | 81731 | text/html (2001 landing, no tables) |
| `terms-of-use.html` | https://statinja.gov.jm/terms-of-use.aspx | `d6a13671144cb51983eab771d92e650266a25ba88b5fff04124eae3ea11a7a81` | 84919 | text/html (**licence, verbatim**) |
| `census_reports.html` | https://census.statinja.gov.jm/census-reports/ | `32807400b2614878a4ae649faa3daedb633d8a5520fab95c23500f5318c09bc3` | 54907 | text/html (thematic volume index) |
| `statin_home.html` | https://statinja.gov.jm/ | `4e3b05e78589b9a029890ff697eb4cd025f201d42b838ebb19bb19f534fad2fd` | 5654122 | text/html (footer copyright) |
| `geoBoundaries-JAM-ADM1.geojson` | https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/JAM/ADM1/geoBoundaries-JAM-ADM1.geojson | `54e50f3b788cfcabe8d7b17031bc103c7dd550082da4755f9de6617b82d8d5b0` | 446783 | geojson (14 parishes) |
| `gb_jam_adm1_meta.json` | https://www.geoboundaries.org/api/current/gbOpen/JAM/ADM1/ | `f2d174ffcc2af398a9728e4057a0cf471531cbd51e8511e4afaae80906108058` | 1729 | json (boundary licence, CC BY-SA 2.0) |

Derived working files also present (pdftotext `-layout` extractions, not source objects): `vol6_religion.txt`, `vol1_general.txt`.

## Recommendation and product boundary

Build the single-wave 2011 parish religious-affiliation product. Source: Vol 6 Table 5, 14 parishes on the geoBoundaries JAM ADM1 CC BY-SA 2.0 frame, the verbatim 19-category parish frame, fail-fast reconciliation at both margins (the wave closes integer-exact to 2,684,115), "Other Religious Affiliation/Denomination" carrying the four collapsed non-Christian groups as the source dictates, and a settled two-slot design ("No Religious Affiliation/Denomination" as the no-religion slot, "Not Reported" as non-response). It carries no cross-wave change layer (2001 is national-only in the located sources; 2022 has no religion release), no place-of-worship layer, and no parish break-out of the four small non-Christian groups (source-collapsed). Licence: accepted open reuse grant, shipped with STATIN attribution and a source link.

- **Blocker: none for the 2011 parish product.** The table, the licence, and the boundary are all clean and byte-recorded here.
- **Secondary gap (documented, not a block):** a 2001 parish religion wave would need the 2001 census thematic reports, not located in this sweep; a 2022 religion release awaits STATIN's continued 2022 publication. Both are future-wave extensions, not blocks to the 2011 build.
- **Recommended queue-row edit (draft; do not apply):** `probed 2026-07-12, BUILDABLE (refutes premise): the 2011 parish religion table IS published — STATIN Vol 6 Table 5 "Population by Sex and Religious Affiliation/Denomination, by Parish", counts, all 14 parishes, 19-category parish frame, integer-exact to the 2,684,115 religion universe (Roman Catholic/SDA/Pentecostal reconcile parish-to-national exactly). Prior sweep missed it: religion is absent from the main-site census index but sits in the thematic volumes on census.statinja.gov.jm. Licence: STATIN Terms & Conditions of Data Use — open reuse grant with attribution (verbatim). Boundary: geoBoundaries JAM ADM1, 14 parishes, CC BY-SA 2.0, one-to-one join. 2022 census has no religion release yet (6 early tables only); 2001 religion is national-only in located sources. Build 2011 single wave ([route-probe](countries/jm/route-probe.md))`.

## Correction (2026-07-12, build lane)

The probe's claim of a uniform 19-category parish frame was over-generalised; the build lane's full-cell parse of Table 5 corrects it here without rewriting the record above. The printed record: eleven parishes print 19 categories with the four small non-Christian groups included in the parish "Other" line, and three parishes additionally break out small non-Christian groups as printed — St Andrew prints all four (Bahai 109, Hinduism 967, Islam 483, Judaism 326; 23 categories), St James prints Hinduism (387; 20 categories), and St Catherine prints Islam (371; 20 categories). The footnote quoted above says small numbers "in most parishes" — most, not all — which the probe's "each parish block collapses the four small non-Christian groups" overstated. The four small groups are therefore non-additive parish-to-national by source design: the un-broken-out residuals (Bahai 160, Hinduism 484, Islam 658, Judaism 180; 1,482 in all) sit inside the parish "Other" lines, whose sum (143,461) exceeds the national "Other" line (141,979) by exactly 1,482.

The parse also corrects two smaller characterisations. The first correction concerns the tail-slot labels: the three tail slots carry three printed spellings each across the parish blocks ("Other Religious Affiliation/Denomination" / "Other Religion/Denomination" / "Other"; "No Religious Affiliation/Denomination" / "No Religion/Denomination" / "None"; "Not Reported" / "Not Stated"), so the single-spelling frame transcribed above from the Kingston block is one parish's spelling, not the table's. The second correction concerns the sex columns: the printed Male/Female columns carry small margin defects, verified against the PDF pages — St Mary's Moravian row prints 49 = 25 + 25; eight blocks' sex columns sum across categories to within 1-2 of their printed block sex headers, but not exactly; and the 14 parish Male headers sum to 1,332,794 against the printed national Male header of 1,324,690 (+8,104; the Female mirror is -8,104), which suggests the national sex split comes from a different tabulation run than the parish sex splits. The Total column is unaffected: it reconciles integer-exact at every printed margin, all 16 denominational lines printed in every parish reconcile parish-to-national exactly (not only the three the probe sampled), and the no-religion (571,982) and non-response (61,374) roles reconcile exactly.

The build (conductor ruling, 2026-07-12) ships the heterogeneous frame exactly as printed — per-parish verbatim labels with slot assignment by role, Total-column counts only — via `scripts/build_jm_area_summary.R` into `docs/manifests/jm-census-religion-2011.json`.
