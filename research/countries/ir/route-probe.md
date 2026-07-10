# Iran census-religion route probe

## Probe result

Iran has a verified province-level census-affiliation route for 1996, 2006, 2011, and 2016. The strongest initial change-over-time series uses 2006, 2011, and 2016 because the category frame is stable and every wave follows the 2004 division of Khorasan. The 1996 wave is a candidate extension after a coarser boundary concordance and clarification of its retrospective province rows.

The current Statistical Centre of Iran (SCI) portal was unreachable from this sandbox on 10 July 2026. HTTPS requests to `amar.org.ir` and `www.amar.org.ir` failed during the SSL connection, while HTTP returned an empty response. The source-of-record links below therefore include archived SCI pages and institutional or intergovernmental mirrors. Iran Open Data is a secondary mirror and does not replace SCI as the source of record.

## Wave and route matrix

| Census wave | Province religion table verified? | Verified geography | Published category frame recovered in this probe | Format and route finding |
| --- | --- | --- | --- | --- |
| 1956 | No | No official source for the 1956 province structure was located; the structure is not verified in this probe | No source table recovered | Iran Data Portal lists the census but its year page exposes no files; printed census volumes require an archive or library route |
| 1966 | No | 13 provinces, eight general governorates, and 146 counties; 21 regional census volumes were published | A United Nations census handbook records the questionnaire examples `Moslem`, `Jew`, `Zoroastrian`, `Armenian`, `other Christian`, and `other`, but no province publication table was recovered | Printed bilingual fascicles; no usable official download located |
| 1976 | No; national table only | 21 provinces and two general governorates | `Total`, `Moslem`, `Zoroastrian`, `Jew`, `Christian`, `Other` | Archived SCI HTML table, “Followers of Selected Religions in the 1976 & 1986 Censuses” |
| 1986 | No; national table only | Approximately 24 provinces after the Tehran/Markazi reorganisation and earlier promotions | `Total`, `Moslem`, `Zoroastrian`, `Jew`, `Christian`, `Other`, `Not reported` | Same archived SCI HTML table as 1976 |
| 1996 | Yes | 28 published province rows; Qazvin and Golestan are retrospective rows because their provincial creation followed census night | `Total`, `Muslim`, `Zoroastrian`, `Christian`, `Jew`, `Other`, `Not stated` | Archived SCI HTML portal table 2.17 |
| 2006 | Yes | 30 provinces | `Total`, `Muslim`, `Zoroastrian`, `Christian`, `Jew`, `Other`, `Not stated` | XLSX institutional mirror; archived SCI HTML also survives; Persian province reports are PDFs |
| 2011 | Yes | 31 provinces | `Total`, `Muslim`, `Christian`, `Zoroastrian`, `Jew`, `Other`, `Not stated` | SCI Statistical Yearbook 1390, table 2.18, text-bearing PDF; English and Persian province workbooks are XLS |
| 2016 | Yes | 31 provinces | `Total`, `Muslim`, `Christian`, `Zoroastrian`, `Jew`, `Other`, `Not stated` | SCI Statistical Yearbook 1399, table 3.18, Persian text-bearing PDF; Iran Open Data indexes an extracted CSV |

The evidence does not support the audit row's implication that every census from 1956 to 2016 supplies a web-recoverable province religion table. National religion counts exist for the early waves. Province publication was verified only from 1996 onward.

## Exact data routes

| Purpose | Exact route | Verified finding |
| --- | --- | --- |
| SCI source of record | <https://amar.org.ir> | Unreachable from this sandbox; current Persian and English portal behaviour could not be examined |
| Archived 1976/1986 SCI table | <https://web.archive.org/web/20131029184117/http://amar.sci.org.ir/Detail.aspx?Ln=E&no=95486&S=GW> | One national table by sex; no province rows |
| Archived 1996 SCI table | <https://web.archive.org/web/20130618134922/http://amar.sci.org.ir/Detail.aspx?Ln=E&no=91751&S=GW> | Table 2.17, 28 province rows and national total |
| 2006 province XLSX | <https://irandataportal.syr.edu/wp-content/uploads/18-population-by-religion-and-ostan-1385-census-2006.xlsx> | English table 18, 30 province rows and national total; file metadata names SCI as source |
| 2006 Persian province-volume hub | <https://irandataportal.syr.edu/2006-census> | Iran Data Portal describes all province attachments as Persian-only PDFs |
| 2011 SCI results at the United Nations | <https://unstats.un.org/unsd/demographic-social/census/documents/Iran/Iran-2011-Census-Results.pdf> | National 2006–2011 category comparison and SCI attribution |
| 2011 SCI yearbook mirror | <https://istmat.org/files/uploads/44180/iran_statistical_yearbook_2011-2012_1390.pdf> | Table 2.18 on printed page 125, 31 province rows |
| 2011 English province workbooks | <https://irandataportal.syr.edu/2011-census/provincial-data-english> | 31 province XLS files; Iran Data Portal identifies SCI as source |
| 2011 Persian province workbooks | <https://irandataportal.syr.edu/2011-census/provincial-data-persian> | 31 province XLS files |
| 2016 SCI yearbook mirror | <https://www.iranopendata.org/res/get/datasets/Sources/iod451.pdf> | Persian table 3.18, printed page 154; search-index text exposes the province-and-religion heading and named categories |
| 2016 secondary dataset index | <https://iranopendata.org/en/dataset/?end_date__year=2016&publisher=31&section=population&start_date__year=2016> | Index entry “Population by Province and Religion - Oct 2016”; it identifies SCI and table 3-18 as the source |
| UNdata confirmation | <https://data.un.org/Data.aspx?d=POP&f=tableCode%3A28%3BcountryCode%3A364> | Official secondary national tabulation for 2016, including the seven-output frame |

## Category frames and Persian labels

| Wave | Published English labels | Persian labels verified or matched to the later SCI publication frame | Comparability note |
| --- | --- | --- | --- |
| 1956 | Not recovered | Not recovered | Do not infer the frame from later national series |
| 1966 | No publication table recovered | Not recovered | The United Nations inventory documents collection only; it does not verify a province table |
| 1976 | `Moslem`, `Zoroastrian`, `Jew`, `Christian`, `Other` | Persian table not recovered | No separate `Not reported` output in the archived table |
| 1986 | `Moslem`, `Zoroastrian`, `Jew`, `Christian`, `Other`, `Not reported` | Persian table not recovered | National-only table adds a non-response output |
| 1996 | `Muslim`, `Zoroastrian`, `Christian`, `Jew`, `Other`, `Not stated` | Later SCI Persian frame: `مسلمان`, `زرتشتی`, `مسیحی`, `کلیمی`, `سایر`, `اظهار نشده` | Province table; category order differs slightly from later English tables |
| 2006 | `Muslim`, `Zoroastrian`, `Christian`, `Jew`, `Other`, `Not stated` | `مسلمان`, `زرتشتی`, `مسیحی`, `کلیمی`, `سایر`, `اظهار نشده` | Same six affiliation outputs as 1996 |
| 2011 | `Muslim`, `Christian`, `Zoroastrian`, `Jew`, `Other`, `Not stated` | `مسلمان`, `مسیحی`, `زرتشتی`, `کلیمی`, `سایر`, `اظهار نشده` | Stable later-wave frame |
| 2016 | `Muslim`, `Christian`, `Zoroastrian`, `Jew`, `Other`, `Not stated` | `مسلمان`, `مسیحی`, `زرتشتی`, `کلیمی`, `سایر`, `اظهار نشده` | Stable later-wave frame |

Every province table also contains `Total` (`جمع`). The Persian term `کلیمی` is the SCI publication label translated as `Jew` in the English tables. The English labels `Not reported` and `Not stated` reflect source wording and should remain wave-specific. No source recovered in this probe defines the identities contained in `Other` or `Not stated`.

## English and Persian portal availability

The older SCI English portal survives unevenly through the Internet Archive. It provides browser-readable English tables for 1976/1986 and 1996. Iran Data Portal preserves an English 2006 province XLSX and labels the much larger 2006 province reports as Persian-only. The 2011 route is the strongest bilingual release because both English and Persian province workbooks remain downloadable. The 2016 province table is easiest to recover from the Persian yearbook and a secondary extracted-data index. An English SCI yearbook version is indexed through mirrors, but the current SCI English portal could not be verified.

## Boundary history and concordance

| Census frame | Province-level structure relevant to the table | Change that affects comparison | Required treatment |
| --- | --- | --- | --- |
| 1956 | Not verified in this probe | No official source for the 1956 province structure was located | Recover census-vintage polygons and county membership only after the reporting structure is verified |
| 1966 | 13 provinces plus eight general governorates | The 21 province-level reporting units are not equivalent to later provinces | Preserve the general-governorate distinction; no province religion table is yet available |
| 1976 | 23 province-level units | Bushehr/Hormozgan naming and status changed around this period; later Tehran/Markazi reorganisation altered central Iran | Recover the 23-unit census frame from SCI maps if the religion geography is ever found |
| 1986 | About 24 provinces | Markazi divided into a smaller Markazi and Tehran, with parts transferred to Esfahan, Semnan, and Zanjan; part of Kerman moved to Yazd | Use the census publication map; a current 31-province layer is unsuitable |
| 1996 publication | 28 labelled rows | Qazvin and Golestan appear as rows although their provincial establishment followed census night; Khorasan remains one row | Treat the rows as retrospective reporting units pending SCI metadata; merge all later Khorasan provinces and Yazd for an extension |
| 2006 | 30 provinces | Khorasan had divided into three in 2004; Alborz remained in Tehran; Ferdows and Tabas were in their 2006 assignments | Base frame for the initial series |
| 2011 | 31 provinces | Alborz split from Tehran in 2010; Ferdows had moved to South Khorasan; Tabas was counted in Yazd | Merge Tehran and Alborz; merge Razavi Khorasan, South Khorasan, and Yazd |
| 2016 | 31 provinces | Tabas had returned to South Khorasan | Apply the same two aggregate merges |

The [Encyclopaedia Iranica census history](https://www.iranicaonline.org/articles/census-i/) documents the 1966 reporting units and 1976 census administration. The compiled [Iran administrative change history](https://statoids.com/uir.html) records the province promotions and splits, while the [Khorasan population history](https://www.iranicaonline.org/articles/khorasan-xxix-population-of-modern-khorasan/) documents the Ferdows and Tabas transfers. These sources establish the concordance problem; a future build still needs census-vintage geometry.

The preferred initial concordance has 28 analytical units after two aggregations. The first aggregation combines Tehran and Alborz. The second aggregation combines Razavi Khorasan, South Khorasan, and Yazd. North Khorasan remains separate. Province-level religion counts cannot support a finer reassignment because the required county-by-religion cells were not recovered.

The Integrated Public Use Microdata Series (IPUMS) project supplies a [consistent 2006–2011 province variable](https://catalog.ihsn.org/catalog/13278/variable/H/GEO1_IR?name=GEO1_IR) and explicitly combines Tehran with Alborz. It can anchor a future boundary assessment. The current [geoBoundaries IRN ADM1 release](https://www.geoboundaries.org/api/current/gbOpen/IRN/ADM1/) reports 33 units for a 2017 OpenStreetMap-derived layer, which does not reconcile to the 31 SCI provinces. No verified official, openly licensed polygon package for all required census vintages was found.

## Licence and terms

No explicit SCI portal licence or reuse terms were found. The [SCI law described by the International Monetary Fund](https://dsbb.imf.org/e-gdds/data-integrity-report/country/IRN/category/IRNNSO00) authorises statistical collection, processing, and dissemination and protects confidential responses. It does not establish an open licence for republication. A [2017 review of Iran's Publication and Free Access to Information Act](https://www.article19.org/wp-content/uploads/2017/09/Iran-FOI-review-English-.pdf) states that the law gives no guidance on republication and reuse.

The mirror terms cannot fill that gap. Syracuse University's Iran Data Portal is an institutional preservation route. [Iran Open Data's 2026 terms](https://iranopendata.org/en/copyright/) claim rights in its hosted content and permit only limited access under its own subscription terms. A future product should extract from an SCI object where possible, publish derived rates rather than mirrored files, attribute SCI, and obtain written SCI permission before public release.

## Sensitivity flag

SCI separately publishes Muslim, Christian, Zoroastrian, and Jewish counts, plus `Other` and `Not stated`. Bahá’í is not a named census output, and the official tables provide no rule for assigning Bahá’í or other unrecognised identities to either residual column. A render-the-record product would reproduce the six published religion and non-response columns and total population. It would preserve the official publication frame while leaving unrecognised identities unnamed. Province display would also reveal small recognised-minority counts in some areas. The project lead must decide whether that record can be mapped, what explanatory text is required, and whether aggregation or suppression is necessary.

**VERDICT: BUILDABLE — route quality is adequate for a derived-rate product using 2006, 2011, and 2016 on the 28-unit aggregate concordance; add 1996 only after its retrospective geography is documented. SENSITIVITY FLAG: ON — no build or public release should proceed before the project-lead ruling, and SCI reuse permission remains a release requirement.**
