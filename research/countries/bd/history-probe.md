# Bangladesh census-religion history probe — backward extension of the 2022 district product

Probe verified 2026-07-12. Question: can the shipped 2022 district (zila) religion product be extended backward into a genuine multi-wave district religion series — 1981, 1991, 2001, 2011 — from published BBS census products? This probe is a backward-extension follow-up to [route-probe.md](route-probe.md), which pinned 2022 (district, Table P08) and cached one 2011 Community Report (Sherpur) as a frame witness; it does not re-prove the shipped 2022 build.

## Verdict

**PARTIALLY BUILDABLE — a two-wave district series (2011 + 2022) is buildable now; the deeper 1991/2001/1981 waves are HELD on source access, and 1981 additionally on a frame break.**

The single genuine advance this probe supports is adding the **2011 wave at zila grain**, which turns the current single-wave 2022 map into a real change-over-time product on a stable geography. The 2011 Population and Housing Census published religion down to community (union/ward) level in the per-zila **Community Report** series, and each report prints a **"[Zila] Total"** religion line in the identical five-category frame (Muslim, Hindu, Christian, Buddhist, Others) and the identical column order as the 2022 Table P08. The 2011 and 2022 waves share the **same 64-zila administrative frame** (stable since the 1984 district reorganisation); the 2011 zila totals therefore join the same geoBoundaries BGD ADM2 layer and the same nine-name spelling concordance the 2022 product already uses — no cross-wave concordance need be invented. The 2011 route is an assembly of 64 Community Report PDFs (there is no single online consolidated volume carrying a zila-by-religion cross-tab), and it is online at a reachable non-BBS host pattern; extraction is clean text (no optical character recognition), as the cached Sherpur report demonstrates.

The **2001 and 1991** district religion tabulations genuinely exist — BBS published a **Zila Series** (one volume per district) and a **Community Series** for each census, IPUMS International confirms a RELIGION variable crossed with the district geography (GEO2_BD2001, GEO2_BD1991) in the microdata, and national religion totals are established for both waves — but no online, extractable district-level religion table was located for either wave. The published subnational volumes surface only as hard-copy library holdings (HathiTrust, Chittagong University Library, Google Books snippets) and the microdata are restricted (out of scope by the standing microdata ruling). Both waves sit on the 64-zila frame; either would therefore align cleanly to the 2022 product **if** an extractable district table is obtained. They are HELD on source access, not on frame or category comparability.

The **1981** wave is HELD on two independent blockers. First, no online district religion table was located (national figures only: Hindu 12.13%). Second, the 1981 census predates the 1984 reorganisation and used the earlier ~20-21 **greater districts** rather than the 64 zilas; aligning 1981 religion to the 2022 frame would require either the 1981 data at a finer grain re-aggregated to the 64 zilas or a published greater-district→zila concordance carrying the religion counts, and neither was located. The five-category frame itself is consistent back to 1981 (the 2011 Volume-2 infographic prints all four historical waves in the same five categories); the 1981 blocker is therefore geography and source, not the category frame.

## Per-wave findings

| Wave | (a) Religion × district table | (b) Frame vs 2022 five-category | (c) Universe / denominator | (d) District frame | (e) Format / extractability | (f) Licence host | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **1981** | None located online; national only (Hindu 12.13%, Buddhist ~538k, Christian ~275k) | Same five categories (Vol-2 infographic) | full enumerated population | **~20-21 greater districts** (pre-1984) — frame break | not located online; library hard-copy | BBS copyright | **HELD** — frame break + no online source |
| **1991** | Zila Series (per-district volumes) exist; IPUMS RELIGION × GEO2_BD1991 (microdata). No online district table located | Same five categories | full enumerated population | **64 zilas** (post-1984) — consistent | library hard-copy (Google Books, CU Library); microdata restricted | BBS copyright | **HELD** — source access only |
| **2001** | Zila Series (2001) + Community Series (2003) exist; IPUMS RELIGION × GEO2_BD2001 (microdata). No online district table located | Same five categories | full enumerated population | **64 zilas** — consistent | library hard-copy (HathiTrust, sciepub refs); microdata restricted | BBS copyright | **HELD** — source access only |
| **2011** | **Community Report series, Table C-13 "Distribution of population by religion, residence and community"** — per-zila PDF, "[Zila] Total" line | **Identical** five categories, identical column order | full enumerated population (no not-stated, no hijra split) | **64 zilas** — identical to 2022 | **online PDF, clean text extraction** (64-PDF assembly) | BBS copyright (also on Internet Archive) | **BUILDABLE** (with 2022) |
| **2022** | Table P08 "Population by Religion, Sex and District" (already shipped, staged) | reference frame | sex-classified pop, excludes 8,124 hijra | 64 zilas | online PDF (mirror) | BBS copyright | **SHIPPED (staged)** |

## Recommendation to the conductor

- **Build a two-wave district series (2011 + 2022).** Assemble the 64 Community Report zila totals (Table C-13) into a 2011 zila religion product on the same geoBoundaries BGD ADM2 boundary and the same spelling concordance as the shipped 2022 product; the two waves then support a genuine change metric on 64 stable zilas. This is the deepest supportable Bangladesh district series from online published products. It carries the same licence posture as the already-staged 2022 wave (BBS copyright asserted, no open-reuse licence; ships staged under the standing build-then-ask ruling and the BD ship-and-ask ruling, with the BBS reuse ask on the PI's list as task 1).
- **Hold 1991, 2001, 1981.** Do not invent an offline or microdata route. A four/five-wave series waits on locating extractable published district religion tables for 1991 and 2001 (both frame-consistent), and 1981 additionally on a greater-district→zila concordance carrying the religion counts.
- **Small-cell treatment applies at 2011 zila grain.** Minority cells are small in some zilas (Sherpur Buddhist 34, Others 1,142); the small-cell rule (build-queue task 19, ratified 2026-07-12) governs display, as it does elsewhere.

## Evidence

### 2011 — Community Report series, Table C-13 (buildable route)

The 2011 census published religion at community (union/ward) level in a per-zila **Community Report** series, one PDF per district (~64 reports). The cached exemplar is Sherpur (`phc2011_community_sherpur.pdf`, sha256 `97da896179df3d4bf96d426c8a36aeb1bb850f4bf57554273ee23c8a21aed92d`), retrieved from the National Statistical Data System host `nsds.bbs.gov.bd`. Its **Table C-13, verbatim: "Distribution of population by religion, residence and community"**, prints a zila-total line that reads directly as the district figure:

```
                                                     Total     Muslim    Hindu   Christian  Buddhist  Others
Sherpur Zila Total                                  1358325   1313519    34944      8686        34     1142
```

The column order (Total, Muslim, Hindu, Christian, Buddhist, Others) is the identical five-category frame and identical order as the 2022 Table P08. The residence rows below the total (RMO 1/2/3 = Rural, Urban, Other Urban) sum to the zila total; the product needs only the total line per zila. The East View unified catalog of the 2011 census (`GCA-PUBS_Bangladesh_2011_catalog.pdf`) lists the Community Report series alphabetically by zila (Bagerhat, Bandarban, Barguna, Barisal, … through Patuakhali and beyond), confirming the full ~64-report set. The series is online at the `nsds.bbs.gov.bd/storage/files/1/Publications/PHC_2011 Community Report/<DIVISION>/` path and mirrored on divisional portal hosts (for example a Chittagong report on `file-chittagong.portal.gov.bd` and a Bhola report on `nsds.bbs.gov.bd/.../BARISAL DIVISION/COMMUNITY_Bhola.pdf`).

There is **no single online consolidated volume** carrying a zila-by-religion cross-tab for 2011. The National Report **Volume-2 (Union Statistics)**, held on the Internet Archive, tabulates only household/population/age/literacy at zila and union grain (Table Z01 "Administrative Unit, Household, Population and Literacy by Sex"; Table Z04 "Household and Population by Selected Age Group, Literacy and …"; Table U01 union statistics) — no religion cross-tab. Its front matter carries a national **"Population By Religion (%)"** infographic only. The 2011 zila religion product therefore requires the 64-Community-Report assembly, which is a valid build route (clean text extraction, exact reconciliation, one licensed 64-feature boundary).

### National five-category frame, consistent 1981-2011 (frame-alignment evidence)

The 2011 National Report Volume-2 (Internet Archive full-text, cached as `phc2011_national_vol2_union_djvu.txt`, sha256 `e0b5914d0c1ff42ad444d827dc44863b9b8bc48b7e76c3b265778ab70906c2b2`) prints a national **"Population By Religion (%)"** series across four censuses in the identical five categories (Muslim, Hindu, Buddhist, Christian, Others):

| Category | 2011 | 2001 | 1991 | 1981 |
| --- | ---: | ---: | ---: | ---: |
| Muslim | 90.39 | 89.58 | 88.31 | 86.65 |
| Hindu | 8.54 | 9.34 | 10.52 | 12.13 |
| Buddhist | 0.60 | 0.62 | 0.58 | 0.62 |
| Christian | 0.37 | 0.31 | 0.33 | 0.31 |
| Others | 0.14 | … | … | … |

The five-category frame is therefore stable back to 1981 and aligns to the 2022 frame; category comparability is not a blocker for any wave. National counts cross-check the percentages: the 1991 totals (Muslim 93,886,769; Hindu 11,184,337; Buddhist 616,626; Christian 350,839; Others 276,418; sum 106,314,989) give Muslim 88.31%; the 2001 totals (Muslim 111,397,444; Hindu 11,614,781; Buddhist 771,002; Christian 385,501; Others 186,532; sum 124,355,263) give Muslim 89.58% — both reproduce the Volume-2 infographic.

### 2001 and 1991 — published but offline (held)

BBS published district-level religion for both waves, but only in hard-copy series:

- **2001**: "Population Census 2001, Zila Series" (BBS 2001, one volume per zila) and "Population Census 2001, Community Series" (BBS 2003), each carrying household and population by religion. These surface as library catalog records (HathiTrust "Bangladesh population census, 2001. Zila…", the rubibook listing "Population Census-2001, Community Series, Zila: Dhaka", sciepub reference stubs). No online extractable district religion file was located.
- **1991**: "Bangladesh Population Census, 1991, Zila [name]" volumes (Google Books entries for Cox's Bazar, Gazipur; a Chittagong University Library OPAC record for Barguna). National totals are established. No online extractable district religion file was located.

IPUMS International confirms the underlying district religion exists for both waves — the RELIGION variable is available crossed with GEO2_BD2001 and GEO2_BD1991 (zila) in the census microdata — but IPUMS microdata are restricted and out of scope by the standing ruling (microdata never enter git). IPUMS and the IHSN catalog (`catalog.ihsn.org/catalog/115`, 1991) serve here only as finding aids confirming existence; the IHSN 1991 record is a Public Use microdata dataset ("All for statistical and research purposes only", no redistribution), not a published district table.

### 1981 — frame break and no online source (held)

The 1981 census predates the 1984 district reorganisation. In 1984 the government upgraded subdivisions to districts, creating the 64-zila frame (the Districts-of-Bangladesh timeline records roughly 23 districts established in 1984); the count has been stable at 64 since. The 1981 census therefore used the earlier ~20-21 greater districts, a materially different geography from the 64 zilas of 2022. National 1981 religion is established (Hindu 12.13%; roughly 538,000 Buddhists, 275,000 Christians in secondary summaries), but no district (greater-district) religion table was located online, and no published greater-district→zila concordance carrying religion counts was located. Aligning 1981 to the 2022 frame is unsupported by the located record on two counts, geography and source.

### District frame across waves (part d, consolidated)

- **1981**: ~20-21 greater districts (pre-1984). Frame break versus 2022.
- **1991, 2001, 2011, 2022**: 64 zilas (post-1984 reorganisation, stable). The 2022 product's geoBoundaries BGD ADM2 layer (64 features, `BGD-ADM2-16705992`, CC BY 3.0 IGO) and its nine-name anglicised-spelling concordance apply unchanged to 1991, 2001 and 2011. No new zilas were created between 1991 and 2022; a 1991-2022 district join therefore needs no concordance invention, only the earlier waves' religion tables, which are the missing inputs for 1991 and 2001.

## Licence posture

The census content carries BBS copyright with no located open-reuse licence, identical to the shipped 2022 wave's posture (route-probe.md; the data.gov.bd Terms of Use grant only reprint-without-modification and establish no derivative basis). A 2011 district product would ship staged (`licence_status: needs_review`, `downstream_status: staged`) under the standing **build-then-ask** ruling and the BD **ship-and-ask** ruling, attributing BBS, with the BBS reuse ask already on the PI's list (task 1). The Internet Archive host is licence-cleaner as a *host* (it served the Volume-2 full text where the BBS TLS chains fail), but the underlying content is still BBS copyright; the host does not change the reuse position. The boundary licence (geoBoundaries CC BY 3.0 IGO) is independent and clean and already accepted in the 2022 product.

## Access note

The BBS hosts remain hard to reach: `data.bbs.gov.bd` refused the connection (`ECONNREFUSED 203.112.218.68:443`) and `bbs.gov.bd` failed TLS chain validation ("unable to verify the first certificate"), matching the prior probe. The 2011 Community Reports are reachable on `nsds.bbs.gov.bd` and divisional portal mirrors (the cached Sherpur report was retrieved there with TLS verification disabled after the local chain failure). The Internet Archive served the 2011 Volume-2 full text cleanly. No human-verification challenge was encountered. No page or hub edit was made in this lane.

## Retrieval record

All inputs verified 2026-07-12 (2011 Sherpur and geoBoundaries inputs carried over from the 2026-07-10 route probe). Cache under `data/raw/bd_census/` is git-ignored (`.gitignore` line 120 ignores `data/`).

| Cached / verified input | Source | Format | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| `phc2011_national_vol2_union_djvu.txt` (Vol-2 Union Statistics full text; national religion time series 1981-2011; Z-tables carry no religion) | archive.org item `BangladeshPopulationAndHousingCensus-2011_NationalReportVolume-2` | text | 2,106,353 | `e0b5914d0c1ff42ad444d827dc44863b9b8bc48b7e76c3b265778ab70906c2b2` |
| `phc2011_community_sherpur.pdf` (Table C-13 zila-total religion witness) | `nsds.bbs.gov.bd/.../PHC_2011 Community Report/MYMENSING DIVISION/Com_Sherpur.pdf` | pdf | 7,918,289 | `97da896179df3d4bf96d426c8a36aeb1bb850f4bf57554273ee23c8a21aed92d` |
| `geoboundaries_bgd_adm2.geojson` (64 zila boundary, shared 2011/2022 frame) | `github.com/wmgeolab/geoBoundaries/.../BGD/ADM2` | geojson | 46,554,183 | `54379ccc77f6f59dab3569ecc5f9b3850dbed2d65a5f43a034bdf92179f5621b` |
| East View 2011 unified catalog (finding aid; Community Report series list) | `eastview.com/.../GCA-PUBS_Bangladesh_2011_catalog.pdf` | pdf | ~125.7 KB | not cached (session tool-results only) |

Findable-only sources (no extractable district religion; recorded as finding aids): IPUMS International RELIGION × GEO2_BD1991 / GEO2_BD2001 / GEO2_BD2011 (restricted microdata); IHSN catalog record 115 (1991 Public Use microdata); HathiTrust record 005405157 and Google Books entries for the 2001/1991 Zila Series volumes (hard-copy).

## Unblocks (for the held waves)

1. **2001 district religion, online-extractable.** Locate a machine-readable 2001 Zila Series or Community Series religion table online (BBS `nsds.bbs.gov.bd` / `data.bbs.gov.bd`, or an archive mirror), or a BBS data request for the 2001 zila-by-religion tabulation. Frame-consistent (64 zilas); would join the 2022 boundary directly.
2. **1991 district religion, online-extractable.** Same, for 1991 (Zila Series). Frame-consistent (64 zilas).
3. **1981 district religion + concordance.** Both a greater-district religion table and a published greater-district→zila concordance carrying the religion counts (or the 1981 data at a finer grain re-aggregable to the 64 zilas). Frame break; the harder hold.
4. **BBS reuse confirmation (task 1, already on the PI's list).** Governs whether any Bangladesh district product — the buildable 2011+2022 series included — moves from staged to live.
