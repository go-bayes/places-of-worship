# Country data map: Palestine (PS)

## Status

- **Tier**: B (three census-affiliation snapshots extracted; PCBS publication notices require licence review)
- **Build state**: data product staged; licence review, country page, and hub wiring remain outside this lane
- **Last verified**: 2026-07-10

## Statistical coverage

The source of record is the Palestinian Central Bureau of Statistics (PCBS). The product reproduces PCBS statistical coverage as published for each census wave. PCBS publishes `West Bank` and `Gaza Strip` as distinct geographic regions and 16 governorates beneath them. The product does not harmonise PCBS geography with another country's statistical geography.

The cached 1997 final report states in Table 22: “Jerusalem: Does not include those parts of Jerusalem which were annexed by Israel after its occupation of the West Bank in 1967.”

The cached 2007 final report defines the coverage as follows: “The first part (J1) includes that part of Jerusalem, which was annexed forcefully by Israel following its occupation of the West Bank in 1967.” It then states: “The second part Jerusalem (J2) Includes Jerusalem governorate except that part of Jerusalem which was forcefully Annexed by Israel following its occupation of the West Bank in 1967.” These quotations appear under “Definitions of Jerusalem J1&J2”, p. 30 (PDF p. 316). The report's “Important Notes” also states that the reduced Jerusalem J1 questionnaire's household roster includes “relationship to the head, sex, religion, age, refugee status, educational level, marital status” (PDF p. 295).

The cached 2017 final detailed report states: “Jerusalem (Area J1): includes those parts of Jerusalem which were annexed by Israeli occupation in 1967.” It defines the other area by listing its localities under “Jerusalem (Area J2): Includes the following localities” in the “Notice For Users” (PDF p. 223). The staged snapshots retain these quoted coverage statements. All cross-wave change metrics are withheld.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PCBS 1997 final population report](https://www.pcbs.gov.ps/media/dtgbbijp/book426-1997.pdf), Table 22 | census affiliation | governorate | 1997 | PDF and official XLS | open web | Cached PDF prints “All Rights Reserved.” Current PCBS terms state: “Unless otherwise noted, all content on this website is licensed under a Creative Commons Attribution 4.0 International License.” Review required. |
| [PCBS 2007 final population report](https://www.pcbs.gov.ps/media/1b3ejexf/book1853-2007.pdf), Table 13 and 16 governorate reports | census affiliation | governorate | 2007 | PDF and official XLS/XLSX | open web | Cached PDF prints “All Rights Reserved.” Current PCBS terms state: “Unless otherwise noted, all content on this website is licensed under a Creative Commons Attribution 4.0 International License.” Review required. |
| [PCBS 2017 preliminary results](https://www.pcbs.gov.ps/portals/_pcbs/PressRelease/Press_En_Preliminary_Results_Report-en-with-tables.pdf), Table 3 | census affiliation | governorate | 2017 | text-bearing PDF | open web | No rights-reservation notice appears in the cached PDF. Current PCBS terms state: “Unless otherwise noted, all content on this website is licensed under a Creative Commons Attribution 4.0 International License.” Review required. |

The published category frame is `Total`, `Islam`, `Christian`, `Other` or `Others`, and `Not Stated`. PCBS publishes no no-religion category in these tables. The staged product assigns no identity to `Other`, `Others`, or `Not Stated`, and all `no_religion` fields are null.

The display indicator is `Reported a PCBS religion category (%)`. It equals 100 times `Total - Not Stated`, divided by `Total`. The denominator retains the source's `Not Stated` cases, which exposes non-response instead of removing it.

## Access the data yourself

- **Source of record**: [Palestinian Central Bureau of Statistics publications](https://www.pcbs.gov.ps/en/publications/)
- **Exact tables**: 1997 final Table 22, “Palestinian Population by Governorate, Sex and Religion”; 2007 final Table 13, “Palestinian Population in the Palestinian Territory by Age Group, Sex and Religion, 2007”, together with Table 13 in each governorate report; 2017 preliminary Table 3, “Palestinian Population in Palestine by Governorate and Religion, 2017”
- **Licence**: [Current PCBS terms](https://www.pcbs.gov.ps/en/reference/terms-of-use/) state, “Unless otherwise noted, all content on this website is licensed under a Creative Commons Attribution 4.0 International License.” The cached 1997 and 2007 final reports print “All Rights Reserved.” The cached 2017 preliminary report has no rights-reservation notice. Conductor review is required before public release.
- **Our extraction script**: `scripts/build_ps_area_summary.R`
- **Retrieval recipe and hashes**: `docs/manifests/ps-census-religion-1997-2017.json` records URLs and SHA-256 hashes for every cached object
- **Detailed coverage probe**: `research/countries/ps/route-probe.md`

## Boundaries

- The geoBoundaries PSE ADM1 release is a two-unit `territory` layer and does not match the PCBS governorate rows.
- The selected geoBoundaries PSE ADM2 2017 release identifies `governorate` as its canonical level, contains 16 units, and carries a Creative Commons Attribution 4.0 licence in its release metadata.
- The simplified staged boundary contains 16 valid features with 16 distinct geometry hashes and is 1,247,851 bytes.
- Governorate boundary stability across the three census waves remains unverified. The product uses the 2017 boundary frame and discloses that the Jerusalem polygon exceeds the 1997 data basis.

## Places-of-worship layer

No governed Palestine place-of-worship snapshot is included in this release. Place counts and derived density fields are null.

## First visualisation

Separate governorate snapshots of the share reporting a PCBS religion category for 1997, 2007, and 2017 on the 2017 governorate frame. The visualisation must withhold cross-wave change and retain the Jerusalem and West Bank/Gaza coverage statements.

## Build recipe

1. Extract the 1997 governorate rows and national total from official workbook Table 22.
2. Extract each 2007 governorate report's Table 13 total row and reconcile the 16 rows to the official Palestinian Territory workbook.
3. Transcribe the visually verified 2017 preliminary Table 3 and require exact row and national arithmetic.
4. Join the 16 PCBS governorates to geoBoundaries PSE ADM2 2017 and simplify through `scripts/lib/simplify_boundary.R` below 3 MB.
5. Validate the area-summary schema, the manifest schema, the 48 output rows, and all geometry gates.

## Risks and open questions

- PCBS coverage and Jerusalem J1 treatment differ across the three sources. The product withholds every cross-wave change metric.
- The 2017 governorate-by-religion table comes from the official preliminary report. The final Palestine report does not republish that governorate table and documents later J1 imputation.
- Current PCBS website terms state that website content is licensed under CC BY 4.0 unless otherwise noted. The cached 1997 and 2007 final reports print “All Rights Reserved.” The cached 2017 preliminary report has no rights-reservation notice. Public release requires conductor review of this licence position.
- How should PCBS statistical geography relate to the live Israel route on shared surfaces such as the global map, and may overlapping claims appear together? This open PI ruling remains recorded without resolution.

## Deep-history potential

PCBS historical census reports and earlier official Palestine census volumes may support longer-run contextual work. No earlier governorate-affiliation wave enters this product.
