# Sri Lanka census-religion route probe

Verified 2026-07-11 (probe-only; nothing built, nothing committed). Sri Lanka has a strong, verified subnational census-religion route across all four modern waves. The Department of Census and Statistics (DCS, statistics.gov.lk) is the source of record and collected religion in the 1981, 2001, 2012, and 2024 Censuses of Population and Housing. One consolidated DCS publication — Statistical Abstract 2023, Table 2.14, "Population by religion and district, Census 1981, 2001, 2012" — carries all three pre-2024 waves at district level as exact counts in a single harmonised PDF, with the 2001 northern/eastern coverage gap marked explicitly on the page. The 2024 wave is already tabulated by district (counts and percentages) and by Divisional Secretariat Division (DSD, counts) inside the DCS Population Preliminary Report. The build blocker is not the census data — it is the licence position (DCS asserts all rights reserved, no open licence) and two sensitivity flags the probe records but must not resolve: the ethnic-religious sensitivity of religion data in Sri Lanka, and the 2001 unenumerated-districts coverage fact.

**This probe FLAGS the standing sensitivities for the conductor and project lead (see the flagged sections): the ethnic-religious conflict context, the 2001 unenumerated northern and eastern districts (render-the-record), and small-cell treatment in mixed and post-war districts. Under render-the-record the probe records each exactly and resolves none.**

## Probe result and verdict

The four waves resolve to a clean, count-valued district series with a stable six-category religion frame and exact national anchors for every wave. The strongest first product is a district choropleth of religious-affiliation shares for the three fully-enumerated waves (1981, 2012, 2024) plus the 18-district 2001 wave rendered as published, on 25 modern districts, with the 2001 coverage gap stated on the surface. The single consolidated Table 2.14 removes the multi-file extraction burden for 1981/2001/2012; the 2024 Preliminary Report adds the fourth wave without any separate release. Finer DSD geography is available for 2012 (25 per-district A4 PDFs) and 2024 (report Table A7) if the project wants sub-district depth.

**VERDICT: BUILDABLE (four-wave district series) — route quality is machine-clean (text-bearing PDFs, `pdftotext -layout` extracts exactly). LICENCE: no open licence; DCS asserts "@ All Rights Reserved" — the derived-summaries-with-attribution treatment (Iran / Côte d'Ivoire / Romania / Slovakia / Canada precedent) is the release requirement, and a project-lead ruling confirming that line for DCS is the clean unblock. SENSITIVITY FLAG: ON (ethnic-religious conflict context; small-cell disclosure in mixed/post-war districts). SCOPE FLAG: ON (2001 enumerated only 18 of 25 districts; render the coverage gap per wave).**

## Wave and route matrix

| Census wave | Subnational religion table verified? | Finest verified geography | Format and route | Enumeration coverage | Build decision |
| --- | --- | --- | --- | --- | --- |
| 1981 | Yes | District (24 districts) | Statistical Abstract 2023 Table 2.14, exact counts | Full island; 24 districts (Kilinochchi did not yet exist — carved from Jaffna 1984) | Buildable. Fold onto modern Jaffna+Kilinochchi for a 25-district join, or render on 24. |
| 2001 | Yes (18 of 25 districts) | District (18 enumerated + 7 estimated-total-only) | Table 2.14 (counts) and standalone `p9p9Religion.pdf` (counts + percentages, 18-district total) | **Partial** — religion given only for the 18 districts fully enumerated; the 7 northern/eastern districts carry an estimated total with religion marked ".." | Buildable as published. The coverage gap is a render-the-record fact, stated per wave. |
| 2012 | Yes | DSD (per-district A4); District (Table 2.14) | Table 2.14 (district counts); 25 per-district A4 PDFs (DSD counts by sex) | Full island; all 25 districts | Buildable. District from Table 2.14; DSD from the 25 A4 files if finer geography is wanted. |
| 2024 | Yes | DSD (report Table A7); District (report Table A3) | Population Preliminary Report: Table A3 (district counts + percentages), Table A7 (DSD counts), Table 8 (national) | Full island; all 25 districts | Buildable now — the tables ship inside the preliminary report. |

The build-queue row premise ("1981-2024; District; some later releases report DSD; religion tables may be released separately") is confirmed and sharpened: the pre-2024 waves are consolidated in one abstract table (no separate-release hunt needed), and the 2024 religion tabulation is already inside the preliminary report at both district and DSD level.

## Exact data routes

| Purpose | Exact URL | Verified finding |
| --- | --- | --- |
| **Master pre-2024 route** — 1981+2001+2012 district religion, counts | <https://www.statistics.gov.lk/abstract2023/CHAP2/2.14.pdf> | Table 2.14; exact counts; harmonised 6-category frame; 2001 coverage footnote on page; national anchors every wave |
| Percentage twin of Table 2.14 | <https://www.statistics.gov.lk/abstract2023/CHAP2/2.15.pdf> | Table 2.15, "Percentage distribution of population by religion and district, Census 1981, 2001, 2012" |
| National religion by census year | <https://www.statistics.gov.lk/abstract2023/CHAP2/2.13.pdf> | Table 2.13, "Population by religion and census years" (1981, 2001, 2012) |
| 2001 district religion (standalone) | <https://www.statistics.gov.lk/Resource/en/Population/PopHouStat/PDF/Population/p9p9Religion.pdf> | 2001 census; district counts AND percentages; "Total (18 districts) 16,929,689"; 6-category frame |
| 2012 DSD religion (per district; Colombo shown) | <http://www.statistics.gov.lk/PopHouSat/CPH2011/Pages/Activities/Reports/District/Colombo/A4.pdf> | Table A4, DSD rows, counts by sex; one file per district (swap `Colombo` for other district names) |
| 2024 all-wave report (district A3 p93, DSD A7 p148, national Table 8 p78) | <https://www.statistics.gov.lk/Resource/en/Population/CPH_2024/Population_Preliminary_Report.pdf> | 187-pp trilingual report; A3 district counts+percentages; A7 DSD counts; Table 8 national 2012 vs 2024 |
| 2012 census visualisation (secondary) | <http://www.statistics.gov.lk/PopHouSat/CPH2012Visualization/htdocs/index.php?action=Map&indId=10&usecase=indicator> | Interactive map; a viewer, not the authoritative table — use Table 2.14 / A4 as source of record |
| DCS copyright/terms (licence evidence) | <https://www.statistics.gov.lk/> | Footer asserts all rights reserved (verbatim below) |

The `p9p8Religion.pdf` / `p9p10Religion.pdf` sibling slugs return an HTTP-200 HTML fallback, not PDFs; `p9p9Religion.pdf` is a standalone 2001 table, not part of a per-wave series. Any downloader must verify content type, not just status code.

## Category frames (VERBATIM as published)

Two label conventions coexist in the DCS record for the **same six substantive categories**. Both are transcribed exactly; the choice of display labels and any cross-source harmonisation note is a build decision, not a probe resolution.

### Abstract 2023 convention (Table 2.14 / 2.15, applied across 1981/2001/2012)

Column headers, verbatim and in published order: `Total`, `Buddhist`, `Hindus`, `Muslims`, `Catholics`, `Christians`, `Others`. (Sinhala and Tamil headers accompany each; English shown here.)

### Census-table convention (2001 `p9p9Religion.pdf`, 2012 A4, 2024 A3/A7)

Column headers, verbatim and in published order: `Total Population` / `All religions` / `Total`, `Buddhist`, `Hindu`, `Islam`, `Roman Catholic`, `Other Christian`, `Other`.

The correspondence is exact: `Hindus`≡`Hindu`, `Muslims`≡`Islam`, `Catholics`≡`Roman Catholic`, `Christians`≡`Other Christian`, `Others`≡`Other`. The frame is stable across all four modern waves (a genuine six-category comparability, unlike the frame breaks seen in Pakistan or Côte d'Ivoire). Values are COUNTS in Table 2.14 / A4 / A7 / A3, and both counts and percentages in `p9p9Religion.pdf` and A3.

## National and district anchors for reconciliation

**National (Table 2.13 / Table 2.14 / 2024 Table 8), exact counts:**

- 1981: `Total` 14,846,750; Buddhist 10,288,328; Hindu 2,297,806; Islam 1,121,715; Roman Catholic 1,023,713; Other Christian 106,854; Other 8,334.
- 2001: `Total` 18,797,257 marked `(1)` estimate, religion `..` at national level; the **18 enumerated districts** sum to 16,929,689 (Buddhist 12,986,548 / Hindu 1,312,970 / Islam 1,435,896 / Roman Catholic 1,035,740 / Other Christian 150,182 / Other 8,353, from `p9p9Religion.pdf`).
- 2012: `Total` 20,359,439; Buddhist 14,272,056; Hindu 2,561,299; Islam 1,967,523; Roman Catholic 1,261,194; Other Christian 290,967; Other 6,400.
- 2024: `Total` 21,781,800; Buddhist 15,199,093; Hindu 2,734,839; Islam 2,337,379; Roman Catholic 1,224,348; Other Christian 282,185; Other 3,956.

**District spot-anchors (2012, from Table 2.14, reconcile against the 2012 A4 DSD sums):** Colombo total 2,324,349 (Buddhist 1,632,225); Jaffna 583,882 (Hindu 483,255); Ampara 649,402 (Islam 281,987). A builder should sum each wave's district religion columns to the published national row and disclose any residue per the standing reconciliation gate.

## SCOPE FLAG — 2001 unenumerated northern and eastern districts (record neutrally, do not resolve)

The 2001 census could not be carried out completely in the war-affected north and east. Table 2.14 marks the seven affected districts with footnote `(1)` "Estimates" and religion columns `..`: **Jaffna, Mannar, Vavuniya, Mullaitivu, Kilinochchi, Batticaloa, Trincomalee**. The national 2001 row is likewise `(1)` with `..`. The page footnote is verbatim:

> "Data are given only for 18 districts where the Census of Population and Housing 2001 was carried out completely."

Consequently the 2001 wave publishes district religion for 18 of 25 districts. This is a coverage fact to state plainly per wave (render-the-record), not a data defect to patch: the seven districts carry an estimated total population with no religion breakdown. Whether the 2001 map renders only the 18 districts, greys the seven with a coverage note, or is omitted in favour of the three fully-enumerated waves is a project-lead decision. The probe records the gap and resolves nothing.

## SENSITIVITY FLAG — ethnic-religious context and small cells (for the conductor and project lead)

Religion in Sri Lanka is politically sensitive and closely tied to ethnicity and the 1983-2009 civil war. Three points for the project lead, recorded not resolved:

1. **Ethnic-religious overlay.** Religion and ethnicity are near-collinear in several districts (e.g. Sri Lanka Tamil ≈ Hindu in Jaffna; Sri Lanka Moor ≈ Islam in the east). A religion map inevitably reads as an ethnic map in the north and east; the surrounding text should be factual and avoid inference beyond the published categories.
2. **Small-cell disclosure.** In majority-homogeneous districts the minority religion counts fall to double or single digits at district level and lower at DSD level (e.g. Hambantota 2012: Hindu 1,222, Other 302). The DSD tables (2012 A4, 2024 A7) will expose very small cells in mixed and post-war resettlement areas. The existing LK card already flags avoiding small-cell disclosure; a suppression or minimum-cell rule is a project-lead ruling before any DSD-level release. No official small-cell suppression guidance was located on the DCS tables in this probe (the published tables print exact small counts).
3. **Post-war resettlement.** The 2001-to-2012 change in northern/eastern districts partly reflects displacement and return, not only affiliation change. Any change series across 2001→2012 in those districts should carry that caveat, and the 2001 coverage gap already precludes a 2001-based change there.

## Boundaries and vintages

| Layer | geoBoundaries release (verbatim metadata) | Units | Represented year | Licence (verbatim from release metadata) | Source |
| --- | --- | --- | --- | --- | --- |
| ADM2 (district) | `LKA-ADM2-46371173` | `admUnitCount` 25 | `boundaryYearRepresented` 2017 | `Open Data Commons Open Database License 1.0` (ODbL) | OpenStreetMap, Wambacher |
| ADM3 (DSD) | see cached `gb_lka_adm3_meta.json` | `admUnitCount` 330 | `boundaryYearRepresented` 2020 | `Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)` | OCHA ROAP, **Survey Department of Sri Lanka** |

Per the project rule these are the release-specific metadata fields, not a site banner. Two observations follow. The ADM3 (DSD) layer carries the cleaner licence — CC BY 3.0 IGO with an official Survey Department of Sri Lanka lineage — and its 330 units approximate the 331 official DSDs; **dissolving ADM3 up to 25 districts yields a district layer with the stronger licence and official provenance**, and is the recommended boundary source over the OSM/ODbL ADM2 layer (the CI ADM3 CC-BY-3.0-IGO precedent). The ADM2 layer (25, ODbL) is the OSM fallback (Ghana/Malaysia ShareAlike precedent) if the ADM3 dissolve is deferred. An official Survey Department district layer, if obtainable directly, would be preferable to either.

District vintage across waves, documented for the project lead:

- **1981**: 24 districts. **Kilinochchi did not exist** — it was carved from Jaffna in 1984; 1981 Jaffna (830,552) therefore contains present-day Kilinochchi territory. Mullaitivu (created 1979) is present in 1981. Join: fold modern Kilinochchi into Jaffna to build a 1981-comparable 24-district frame, or render 1981 on its own 24 districts.
- **2001**: 25 districts nominally (Kilinochchi present), but religion for 18 only (see scope flag).
- **2012 / 2024**: 25 districts, full coverage. The modern 25-district frame is the natural anchor; the only harmonisation needed is the 1981 Jaffna/Kilinochchi fold.

Join feasibility per wave is high: district names are stable and few (25), and the modern waves need no concordance. The DSD frame (2012/2024) has grown over time (DSD splits) and would need a per-wave DSD concordance if a DSD-level change series is attempted; a district-level series avoids that entirely and is the recommended first product.

## Licence and terms (VERBATIM)

No open licence governs DCS census output. The DCS website footer states, verbatim:

> "@ All Rights Reserved"

(The glyph renders in the copyright position; the HTML text node is the string above.) The DCS operates under the Census Ordinance and the Statistics Ordinance and references the Right to Information Act; no Creative Commons or open-data licence, and no separate terms-of-use or reuse page, was located in this probe. The publications (Statistical Abstract tables, census reports) are freely downloadable but carry no reuse grant.

The project's standing practice — publish DERIVED rates, not a redistribution of the source tables, with DCS attribution, raw PDFs staying git-ignored — is the posture already ratified for Iran, Côte d'Ivoire, Romania, Slovakia, and Canada (no open licence; derived summaries with attribution under project-lead approval). Licence position: **needs_review**; attribution mandatory; derived-rates-only; raw cache git-ignored. A project-lead ruling confirming the derived-summaries line extends to DCS is the clean unblock (a DCS reuse-confirmation email is the alternative clean path).

## Retrieval record

All inputs retrieved 2026-07-11 into `data/raw/lk_census/` (git-ignored). Every cached PDF was verified as a real PDF (three probed sibling religion slugs returned HTML fallbacks and were not cached). Certificate verification was ordinary for all hosts.

| Cached input | SHA-256 |
| --- | --- |
| `abstract2023_2.14.pdf` (1981/2001/2012 district religion, counts) | `36e3fbf9f464c60512d8b2921be4f4e8ad7e3b109675745670f9234a99e18d65` |
| `abstract2023_2.15.pdf` (percentage twin) | `2f9729adde83732f5333be7977ecfd54074b8fa5d76f61d47815836904e76089` |
| `abstract2023_2.13.pdf` (national by census year) | `43c1731eab9c812edc4abe146275dac947918bd461e7225aa0751da1d9991e7d` |
| `p9p9Religion.pdf` (2001 district, counts + percentages) | `c756f5d983f283bb0eede69d7a5570a858deeb448c233baa24b209232b2f9357` |
| `a4_colombo_2012.pdf` (2012 DSD, Colombo) | `e9368d176b8ca58cb583f4acbc111a2b53ffd32d7b9fc5bce99143bea8327036` |
| `cph2024_preliminary.pdf` (2024 district A3, DSD A7, national Table 8) | `1ee768d1ce23b55497f8ee343c825b6d96363aa85e1f7ab3f3f94c086f11f093` |
| `gb_lka_adm2_meta.json` (district boundary metadata) | `d5e4ea2abd3071d18d0cf0c8fc8cd9b32feaaa3477432eb63ecde7d76188eb9d` |
| `gb_lka_adm3_meta.json` (DSD boundary metadata) | `6a794718c383cd621232ef14be0c628e209abed95d2fadaf069026f892ba3fae` |
| `dcs_home.html` (licence evidence) | `725448751dbbb2c9cb84809e035617347d5436bdd3d2a46d72da7bc607f1972b` |

## Build/hold recommendation for the conductor

**BUILD** the four-wave district series on the census data; hold public release only until the licence line is ruled and the sensitivity flags are acknowledged. Concretely:

1. **First product**: district religious-affiliation shares, censuses 1981 / 2001 (18 districts as published) / 2012 / 2024, on the 25 modern districts (ADM3 dissolved to districts, CC BY 3.0 IGO, Survey Department lineage), 1981 rendered with Kilinochchi folded into Jaffna. Denominator = each district's `Total` published religion population; frame = the six stable categories. Source: Table 2.14 (1981/2001/2012) + 2024 Preliminary Report Table A3.
2. **On-surface statements (render-the-record)**: the 2001 coverage gap ("religion published for 18 of 25 districts; the seven northern/eastern districts carry estimated totals only") and the label harmonisation (Muslims≡Islam, Catholics≡Roman Catholic, Christians≡Other Christian).
3. **Held pending project-lead ruling**: (a) the licence position — derived-summaries-with-attribution under the DCS all-rights-reserved footer (Iran/CI precedent recommended; DCS email the clean alternative); (b) small-cell treatment if a DSD-level product is pursued.
4. **Finer geography (optional, later)**: DSD-level 2012 (25 A4 PDFs) and 2024 (Table A7) products, gated on the small-cell ruling and a per-wave DSD concordance.
