# Croatia census-religion route probe

Verified 2026-07-10. The Croatian Bureau of Statistics (DZS) publishes self-declared religious affiliation for the whole population at town/municipality and county levels in 2001, 2011, and 2021. The three town/municipality frames differ, and DZS does not publish the religion series rebased to one local-government frame. The governed product therefore uses the 21 published county rows in every wave and creates no unofficial concordance.

## Exact result endpoints

| Wave | Official table | Pinned endpoint | Product rows |
| --- | --- | --- | --- |
| 2001 | Table 14, “Population by Religion, by Towns/Municipalities, Census 2001” | [English Hypertext Markup Language (HTML)](https://web.dzs.hr/Eng/censuses/Census2001/Popis/E01_02_04/E01_02_04.html); [Croatian HTML](https://web.dzs.hr/Hrv/censuses/Census2001/Popis/H01_02_04/H01_02_04.html) | national row and 21 county rows in the index table |
| 2011 | Table 3, “Population by Religion, by Towns/Municipalities, 2011 Census” | [English Microsoft Excel binary workbook (XLS)](https://web.dzs.hr/eng/censuses/census2011/results/xls/Grad_03_EN.xls); [Croatian XLS](https://web.dzs.hr/hrv/censuses/census2011/results/xls/Grad_03_HR.xls) | national row and 21 county rows; town, municipality, and Zagreb district rows remain unshipped |
| 2021 | Sheet `2.`, “Population by Religion, by Towns/Municipalities, 2021 Census” | [bilingual Microsoft Excel Open XML workbook (XLSX)](https://podaci.dzs.hr/media/td3jvrbu/popis_2021-stanovnistvo_po_gradovima_opcinama.xlsx), pinned by the [official English results page](https://dzs.gov.hr/u-fokusu/popis-2021/popisni-upitnik/english/results/1501) | national row and 21 county rows; town, municipality, and Zagreb district rows remain unshipped |

The builder caches both language versions where DZS publishes separate files. It verifies that the Croatian and English counts agree and keeps the Croatian category names with English display labels.

## Construct and universe

The construct is self-declared census religious affiliation. DZS defines religion as affiliation to a religious system regardless of registered membership or practice. The question allowed free declaration in every wave. Parents, adoptive parents, or guardians supplied the 2001 answer for children younger than 15. The source tables cover the whole census population rather than an age-restricted universe.

The product divides each headline numerator by the whole census population. Every agnostic, non-declaration, and unknown category stays in that denominator. The approach avoids a changing respondent denominator, but two cross-wave breaks remain. First, the statistical definition of the total population changed between 2001 and 2011. Second, the category treatment changed across waves, especially for non-declaration and `Ostali kršćani` (Other Christians) in 2021.

Official methodology:

- [2001 methodology](https://web.dzs.hr/Eng/censuses/Census2001/census_met.htm)
- [2011 methodology](https://web.dzs.hr/Eng/censuses/census2011/results/censusmetod.htm)
- [2021 methodology and territorial constitution](https://podaci.dzs.hr/2021/en/39858)

## Category inventory: 2001

The 2001 table has 25 published columns including the total. Seventeen top-level categories are mutually exclusive; seven Orthodox church columns are details beneath `Pravoslavna crkva — svega` (Orthodox Church — All) and must never be summed again.

| Source code | Croatian source category | English display label | Product role |
| --- | --- | --- | --- |
| `TOTAL` | Ukupno | Total | population total |
| `CATHOLIC_CHURCH` | Katolička crkva | Catholic Church | religious affiliation |
| `GREEK_CATHOLIC_CHURCH` | Grkokatolička crkva | Greek Catholic Church | religious affiliation |
| `OLD_CATHOLIC_CHURCH` | Starokatolička crkva | Old-Catholic Church | religious affiliation |
| `ORTHODOX_CHURCH` | Pravoslavna crkva — svega | Orthodox Church — All | religious affiliation parent |
| `ORTHODOX_BULGARIAN` | Bugarska pravoslavna crkva | Bulgarian Orthodox Church | Orthodox detail; excluded from headline sum |
| `ORTHODOX_MONTENEGRIN` | Crnogorska pravoslavna crkva | Montenegrin Orthodox Church | Orthodox detail; excluded from headline sum |
| `ORTHODOX_GREEK` | Grčka pravoslavna crkva | Greek Orthodox Church | Orthodox detail; excluded from headline sum |
| `ORTHODOX_MACEDONIAN` | Makedonska pravoslavna crkva | Macedonian Orthodox Church | Orthodox detail; excluded from headline sum |
| `ORTHODOX_ROMANIAN` | Rumunjska pravoslavna crkva | Romanian Orthodox Church | Orthodox detail; excluded from headline sum |
| `ORTHODOX_RUSSIAN` | Ruska pravoslavna crkva | Russian Orthodox Church | Orthodox detail; excluded from headline sum |
| `ORTHODOX_SERBIAN` | Srpska pravoslavna crkva | Serbian Orthodox Church | Orthodox detail; excluded from headline sum |
| `ISLAMIC_RELIGIOUS_COMMUNITY` | Islamska vjerska zajednica | Islamic Religious Community | religious affiliation |
| `JEWISH_RELIGIOUS_COMMUNITY` | Židovska vjerska zajednica | Jewish Religious Community | religious affiliation |
| `ADVENTIST_CHURCH` | Adventistička crkva | Adventist Church | religious affiliation |
| `BAPTIST_CHURCH` | Baptistička crkva | Baptist Church | religious affiliation |
| `EVANGELIC_CHURCH` | Evangelička crkva | Evangelic Church | religious affiliation |
| `JEHOVAHS_WITNESSES` | Jehovini svjedoci | Jehovah's Witnesses | religious affiliation |
| `CALVINIST_CHURCH` | Kalvinistička crkva | Calvinist Church | religious affiliation |
| `METHODIST_CHURCH` | Metodistička crkva | Methodist Church | religious affiliation |
| `CHRIST_PENTECOSTAL_CHURCH` | Kristova pentekostna crkva | Christ Pentecostal Church | religious affiliation |
| `OTHER_RELIGIONS` | Ostale vjere | Other religions | religious affiliation |
| `AGNOSTIC_AND_UNCOMMITTED` | Agnostici i neizjašnjeni | Agnostic and uncommitted | mixed agnostic/non-declaration category; outside both headlines |
| `NON_BELIEVERS` | Nisu vjernici | Non-believers | no-religion headline |
| `UNKNOWN` | Nepoznato | Unknown | unknown; outside both headlines |

The 2001 `Agnostici i neizjašnjeni` category combines an agnostic answer with non-declaration. The build does not split that published count. It excludes the mixed category from both headline numerators and retains it in the whole-population denominator.

## Category inventory: 2011 and 2021

Both later waves have 13 published columns including the total. All 12 categories beneath the total are mutually exclusive.

| Source code | Croatian source category | English display label | Product role |
| --- | --- | --- | --- |
| `TOTAL` | Ukupno | Total | population total |
| `CATHOLICS` | Katolici | Catholics | religious affiliation |
| `ORTHODOX` | Pravoslavci | Orthodox | religious affiliation |
| `PROTESTANTS` | Protestanti | Protestants | religious affiliation |
| `OTHER_CHRISTIANS` | Ostali kršćani | Other Christians | religious affiliation |
| `MUSLIMS` | Muslimani | Muslims | religious affiliation |
| `JEWS` | Židovi | Jews | religious affiliation |
| `ORIENTAL_RELIGIONS` | Istočne religije | Oriental religions | religious affiliation |
| `OTHER_RELIGIONS_MOVEMENTS_WORLDVIEWS` | Ostale religije, pokreti i svjetonazori | Other religions, movements and life philosophies | religious affiliation |
| `AGNOSTICS_AND_SCEPTICS` | Agnostici i skeptici | Agnostics and sceptics | agnostic; outside both headlines |
| `NOT_RELIGIOUS_AND_ATHEISTS` | Nisu vjernici i ateisti | Not religious and atheists | no-religion headline |
| `NOT_DECLARED` | Ne izjašnjavaju se | Not declared | non-declaration; outside both headlines |
| `UNKNOWN` | Nepoznato | Unknown | unknown; outside both headlines |

The later tables distinguish `Ne izjašnjavaju se` (Not declared) from `Nepoznato` (Unknown). The 2011 methodology says an enumerator marked “not declared” when a person did not want to declare a religion. The 2021 workbook likewise records the answer a person gave, including agnostic, not religious, atheist, or unwilling to declare.

The 2021 workbook documents an additional classification break. `Ostali kršćani` (Other Christians) includes people who answered Christian without naming a denomination. The workbook reports that 96.47% of the category gave that answer; when asked about religious community, 87.26% of those respondents named the Catholic Church. The product retains the published `Ostali kršćani` category and reassigns nobody.

## Geography decision

| Wave | Published local-government frame | Product geography |
| --- | --- | --- |
| 2001 | 122 towns and 423 municipalities, situation on 31 March 2001 | 20 counties and the City of Zagreb |
| 2011 | 127 towns and 429 municipalities, situation on 31 March 2011 | 20 counties and the City of Zagreb |
| 2021 | 128 towns and 428 municipalities, situation on 31 August 2021 | 20 counties and the City of Zagreb |

The [2001 territorial explanation](https://web.dzs.hr/Eng/censuses/Census2001/census_terr.htm), [2011 methodology](https://web.dzs.hr/Eng/censuses/census2011/results/censusmetod.htm), and [2021 methodology](https://podaci.dzs.hr/2021/en/39858) establish different local-government frames. No pinned DZS table rebases the earlier religion results to the 2021 towns and municipalities. The municipal route therefore fails the official-concordance condition.

County is the finest complete fallback published in all three tables. The build assigns the 21 county rows to official county codes `01` through `21` in the source order and verifies those codes and Croatian names against the boundary source. This join establishes identity for the product on the 2026 boundary frame. It does not establish unchanged historical polygons.

## Boundaries and reuse terms

The boundary source is the State Geodetic Administration (DGU) Infrastructure for Spatial Information in Europe (INSPIRE) Administrative Units Web Feature Service (WFS):

- [WFS capabilities](https://geoportal.dgu.hr/services/inspire/au/wfs?service=WFS&request=GetCapabilities&version=2.0.0)
- [Pinned county request](https://geoportal.dgu.hr/services/inspire/au/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=au%3AAU.AdministrativeUnit&cql_filter=national_level%3D%272ndOrder%27&outputFormat=application%2Fjson&srsName=EPSG%3A4326)
- [Official metadata record](https://geoportal.nipp.hr/geonetwork/srv/hrv/xml.metadata.get?uuid=08b28e14-01d7-4142-ae8e-217bf2a8d21b)
- [Croatian Open Licence](https://data.gov.hr/otvorena-dozvola)

The request filters `national_level=2ndOrder` and returns 21 county features. The official metadata states that reuse follows the Croatian Open Licence and that public access has no limitations. The product attributes DGU and records the retrieval date and source hash.

Geometric stability of the county polygons across 2001, 2011, and 2021 remains unverified. The product uses the 2026 DGU frame for display and reports no same-polygon county change statistic. The boundary was retrieved on 2026-07-10. Repeated codes and names do not prove polygon stability.

## Reconciliation and product gates

- **Wave coverage**: passed. The product has 21 rows for each of 2001, 2011, and 2021.
- **Category structure**: passed. The 2001 category hierarchy retains the Orthodox parent and seven details without double counting. The 2011 and 2021 tables each contain 12 mutually exclusive categories beneath the total.
- **Within-area reconciliation**: passed. Every mutually exclusive category set equals its published area total exactly.
- **County-to-national reconciliation**: passed. Every published category sums from the 21 county rows to the national row exactly in every wave. No rounding tolerance or residual allocation is used.
- **Response handling**: passed with disclosed limitations. Croatian source names remain intact; the 2001 mixed category and later separate non-declaration categories remain distinct.
- **Geometry**: passed. The simplified GeoJSON has 21 non-empty, valid features and 21 distinct SHA-256 geometry hashes.
- **Provenance**: passed. The manifest records URL, retrieval date, byte size, and SHA-256 for every cached source and generated output.

## Licence record

The [DZS website terms](https://dzs.gov.hr/uvjeti-koristenja/76) require users to name the Croatian Bureau of Statistics as the source when reproducing a publication. The terms page does not assign a named open licence. The committed product contains derived county summaries and does not redistribute the source workbooks or HTML tables.
