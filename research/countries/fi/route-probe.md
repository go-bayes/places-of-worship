# Finland religious-community route probe

Verified 2026-07-12. Verdict: **HELD for a subnational map; the national register series is independently buildable.** Statistics Finland (Tilastokeskus, `stat.fi`) publishes register-based religious-community membership at the **whole-country level only**. Its single religion table, `11rx`, carries the full 26-category religious-community frame by age and sex for every year 1990-2025, but it has no municipality or region dimension, and no archived StatFin table crosses religion with area. Finland is not a small single-polygon country; the Iceland small-country clause that shipped a national-only register series (IS, BUILT 2026-07-11) therefore does not extend to it. The subnational route the queue asked to probe is real but sits with the Evangelical Lutheran Church of Finland's own statistics service (`kirkontilastot.fi`): membership by parish (seurakunta), deanery, diocese, and by municipality (2015 onwards), 1999-2025. That route is single-denomination (Lutheran membership, not the full affiliation frame), it is delivered through Tableau Public workbooks rather than a machine-readable API, and it carries no stated reuse licence. The boundary side is clean: Statistics Finland and the National Land Survey both publish municipal boundaries under CC BY 4.0. A subnational Finland product is therefore possible along the Norway diocese precedent (NO, BUILT 2026-07-11: single-church membership on official polygons), but it is blocked on three items — browser or Tableau extraction, an unstated church-statistics licence, and a construct that is Lutheran-only.

## Build decision (recommendation to the conductor)

- **StatFin full-religion route (`11rx`)**: **national only, 1990-2025.** Machine-readable, clean, CC BY 4.0. This is a buildable national register series (36 annual observations, 26 categories including the Evangelical Lutheran Church of Finland and the Greek Orthodox Church). It is not a subnational product. Whether a national-only Finland ships is a conductor or PI call, because the Iceland small-country pass does not apply to a country of 5.65 million on a large territory.
- **Church Lutheran route (`kirkontilastot.fi`)**: **the genuine subnational route, HELD.** Lutheran membership by parish, deanery, diocese, and municipality exists (parish series 1999-2025; municipality 2015 onwards). It is single-denomination, Tableau-delivered, and licence-unstated. Named unblocks below.
- **Boundaries**: **clean and available.** Municipal boundaries publish under CC BY 4.0 from Statistics Finland (WFS / OGC API Features; the `geofi` R package wraps the same source) and from the National Land Survey. A dedicated open parish (seurakunta) polygon vector was not confirmed; the pragmatic subnational geography is the municipality.

## The StatFin route: national only (verified by API)

Statistics Finland's PxWeb API base for the population-structure database (väestörakenne, `vaerak`) is `https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/`. The database listing (retrieved 2026-07-12) contains exactly one religion table:

- `11rx.px` — **"Belonging to a religious community by age and sex, 1990-2025"**.

The table title names age and sex, not area. The metadata confirms it. Fetched from `https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/11rx.px` (2026-07-12), `11rx` has four dimensions and no geography:

| Dimension (code) | Values | Note |
| --- | --- | --- |
| Religious community (`uskontokunta_10_20190101`) | 26 | TOTAL, five world-religion headings, CHRISTIANITY with 11 sub-communities, OTHER RELIGIOUS GROUPS with six, and PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY |
| Sex (`sukupuoli_9_20180101`) | 3 | Total, Males, Females |
| Age (`ikaryhma_10_20180101`) | 6 | Total, 0-14, 15-24, 25-44, 45-64, 65- |
| Year (`timeperiod_y`) | 36 | 1990 through 2025, no missing year |

There is no municipality, region, or area dimension. The parallel demographic tables in the same database do carry area — language has both `11rl` ("Language according to age and sex by region") and `11rm` ("Language according to sex by municipality"); citizenship, country of birth, and origin each have region and municipality tables. Religion has only `11rx`, and `11rx` has no area dimension. The subnational grain that StatFin publishes for every other population attribute is absent for religion.

The archive database (`StatFin_Passiivi`, discontinued tables) was checked at `https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin_Passiivi/vaerak/` (2026-07-12): 50 tables, none crossing religion with area (the archived `vaerak` tables cover population by sex and area, language, urban-rural classification, and urbanisation — no religion). No Paavo postal-code religion table exists either (`Postinumeroalueittainen_avoin_tieto` top level, 2026-07-12: no religion match). The national-only finding is therefore a published-data ceiling for the full-affiliation construct, not a retrieval gap.

### Category frame (verbatim, as published)

The 26 `11rx` religious-community values, in source order with PxWeb codes:

| Code | English label | Code | English label |
| --- | --- | --- | --- |
| SSS | TOTAL | F07 | Methodism |
| A00 | INDIGENEOUS RELIGIONS AND NEO-PAGANISM | F08 | Greek Orthodox Church |
| B00 | BUDDHISM | F09 | Evangelical Lutheran Church of Finland |
| C00 | HINDUISM | F10 | Free churches |
| D00 | ISLAM | F11 | Other Christian |
| E00 | JUDAISM | G00 | OTHER RELIGIOUS GROUPS |
| F00 | CHRISTIANITY | G01 | Bahá'í communities |
| F01 | Adventism | G02 | Jehovah's Witnesses |
| F02 | Anglican churches | G03 | Church of Jesus Christ of Latter-day Saints |
| F03 | Baptism | G04 | Christian Community of Finland |
| F04 | Evangelical Lutheran free congregations | G05 | Liberal Catholic Church |
| F05 | Pentecostalism | G06 | Others |
| F06 | Roman Catholic Church | H00 | PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY |

The English label "INDIGENEOUS" is Statistics Finland's own spelling; a build would carry source labels unaltered (the Iceland "Jehova Witnesses" precedent). The `A00`/`B00`/… headings and their `F01`-`F11`, `G01`-`G06` children form a hierarchy: `CHRISTIANITY` (`F00`) is the parent total of the eleven Christian communities, `OTHER RELIGIOUS GROUPS` (`G00`) the parent of the six. A build would treat the leaf communities as the mutually exclusive frame and the headings as roll-ups, never double-counting.

### Data slice (route proven to extract)

A POST to `https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/11rx.px` selecting the total sex and total age, for TOTAL, the Evangelical Lutheran Church, the Greek Orthodox Church, and non-members, returned cleanly (json-stat2, HTTP 200, 2026-07-12):

| Religious community | 1990 | 2000 | 2010 | 2020 | 2025 |
| --- | ---: | ---: | ---: | ---: | ---: |
| TOTAL | 4,998,478 | 5,181,115 | 5,375,276 | 5,533,793 | 5,652,881 |
| Evangelical Lutheran Church of Finland | 4,390,739 | 4,409,576 | 4,207,192 | 3,749,713 | 3,457,125 |
| Greek Orthodox Church | 53,427 | 56,807 | 60,851 | 60,086 | 58,073 |
| PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY | 510,516 | 659,979 | 1,032,429 | 1,627,727 | 2,030,491 |

The series carries a strong substantive signal — the Evangelical Lutheran membership falls from 4.39 million (1990) to 3.46 million (2025) while non-members rise from 0.51 million to 2.03 million — but it is national. The queue's "national-only tail" premise for the StatFin route is confirmed.

## The church route: subnational, Lutheran-only, Tableau-delivered, licence-unstated

The Evangelical Lutheran Church of Finland runs its own statistics service, the Kirkon tilastopalvelu, at `https://www.kirkontilastot.fi/` (retrieved 2026-07-12). Its member-statistics products include:

- **Jäsentilasto 1999-2025 / Medlemsstatistik 1999-2025** (member statistics 1999-2025), `https://www.kirkontilastot.fi/viz?id=304`;
- **Kirkkoon kuuluvuus 2025 / Kyrkotillhörighet 2025** (church membership 2025);
- **Jäsenennuste 2025-2040** (member projection).

The service's own data descriptions (`Tilastotietojen_kuvaukset.pdf`, fetched 2026-07-12) list the area classifications used: **parishes (seurakunnat)** as the primary unit, then **deaneries (rovastikunnat)**, **dioceses (hiippakunnat)**, and a diocese-level roll-up. A web search of the service confirms member statistics organised at the **municipality** level from 2015 onwards. The parish/diocese route the queue flagged as unverified is therefore verified to exist: Lutheran membership publishes at parish, deanery, diocese, and (recent years) municipality grain.

Three properties hold this route short of an immediate build:

1. **Delivery is Tableau Public, not a machine-readable API.** Every member-statistics view is an embedded Tableau workbook (the `viz?id=304` page embeds the Tableau Public workbook `F52R2KJSY` through `viz_v1.js`). There is no PxWeb-style API and no plain CSV or XLSX download located on the service. The EVL Plus statistics-and-documents page (`https://evl.fi/plus/hallinto-ja-talous/tilastot-ja-asiakirjat/`, fetched 2026-07-12) is a navigation hub with no direct membership file download. Extraction would need a browser or a Tableau crosstab export — browser work, not a pinned machine-readable route.
2. **The construct is single-denomination.** The church service reports Evangelical Lutheran membership only. It is not the full 26-category affiliation frame of `11rx`; it is the Lutheran slice at fine geography. A subnational church product would carry Lutheran membership (or the church-membership share), disclosed as a single-denomination measure, along the Norway Church-of-Norway diocese precedent.
3. **No reuse licence is stated.** The data-descriptions PDF and the EVL Plus page carry no licence, terms-of-use, or copyright-reuse statement. The church service is not covered by the Statistics Finland CC BY 4.0 grant. A church-statistics reuse ruling (or an `evl.fi` confirmation) is the licence unblock.

## Licence positions (verbatim)

**Statistics Finland — CC BY 4.0 (clean).** Statistics Finland's open-data terms state that its statistical data are released under the open-data licence CC BY 4.0: the data may be copied, edited, shared, combined with other data, and used commercially, provided the source and the material version date are named and a reference and hyperlink to the CC BY 4.0 licence are attached. The `stat.fi` terms-of-use and open-data-and-interfaces pages carry this grant (`https://stat.fi/en/services/statistical-data-services/open-data-and-interfaces`; `https://stat.fi/en/about-us/get-to-know-statistics-finland/legislation/terms-of-use`, both current 2026-07-12). This covers `11rx` and the StatFin municipal boundary vectors.

**Evangelical Lutheran Church statistics — unstated.** No licence, terms-of-use, or copyright-reuse statement was located on `kirkontilastot.fi`, in the service's data-descriptions PDF, or on the EVL Plus statistics page (2026-07-12). This is the Palau / FSM vacuum — no reuse terms at all — rather than an explicit all-rights-reserved footer. Under the standing build-then-ask ruling a derived summary could ship with church attribution, but the church route is not yet built for the extraction reason above; the licence therefore sits as a named ask, not a live gate.

## Boundaries

- **Municipality (kunta) — clean, CC BY 4.0.** Statistics Finland publishes municipal boundaries as open geographic data through its WFS and OGC API Features interfaces (`https://stat.fi/tup/avoin-data/paikkatietoaineistot_en.html`), and the `geofi` R package (rOpenGov) wraps the same source. The National Land Survey of Finland publishes the authoritative administrative-area (municipal) division under its own CC BY 4.0 open-data licence (`https://www.maanmittauslaitos.fi/en/opendata-licence-cc40`). Either source gives a licensed municipal vector that joins one-to-one to a municipality-grain religion table.
- **Parish (seurakunta) — not confirmed.** The church has about 354 parishes, and parish boundaries broadly track municipal boundaries but diverge through parish mergers and multi-parish municipalities. A dedicated open parish polygon vector was not located in this probe. The pragmatic subnational geometry is the municipality; a parish-level product would need a parish vector confirmed and licensed first.

## Premise corrections (trust the record)

- **The StatFin religion table is national only, and no archived StatFin table adds area.** The queue names the route "machine-readable" and "national-only tail" — both correct for `11rx`. The full-affiliation register frame exists only at the whole-country level, 1990-2025.
- **The parish or diocese route is no longer unverified: it exists, at the church.** Lutheran membership publishes by parish, deanery, diocese, and (2015 onwards) municipality on `kirkontilastot.fi`. It is Lutheran-only, Tableau-delivered, and licence-unstated — a genuine subnational route with three named blockers, not an open question.
- **The small-country pass does not apply.** Finland (5.65 million, large territory) is not the Iceland case. A national-only Finland is a conductor or PI call, not an automatic ship.
- **The route mixes two very different delivery qualities.** StatFin is a clean PxWeb API; the church service is Tableau Public browser work. The queue's single "machine-readable" tag fits the StatFin national route, not the subnational church route.

## Named unblocks (the paths to a subnational product)

1. **Municipal Lutheran-membership product (the pragmatic path).** Extract church membership by municipality (2015-2025) from the `kirkontilastot.fi` Tableau workbooks, secure a church-statistics reuse ruling (or `evl.fi` confirmation), and join to the Statistics Finland or National Land Survey municipal boundary vector (CC BY 4.0). This yields a single-denomination membership-share choropleth on a short multi-wave window. Blockers: browser or Tableau extraction; church licence.
2. **Parish Lutheran-membership product (the deeper path).** Use the parish member series (1999-2025), which needs a confirmed and licensed parish (seurakunta) polygon vector in addition to the extraction and licence unblocks. This is the closest analogue to the Norway diocese build.
3. **National register series (buildable now, national only).** Ship `11rx` (1990-2025, 26 categories, CC BY 4.0) as a national product if the conductor accepts a national-only Finland for a non-small country. Independent of the church route.

## Retrieval record

All inputs retrieved 2026-07-12; the StatFin API served cleanly to `curl` with a browser user-agent, and no human-verification challenge was encountered. The church service embeds Tableau Public and was not scraped for data in this probe. Cached artifacts held in the session scratchpad (not committed).

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `vaerak_list.json` | `https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/` | json | `07b611f93f3730a5353417db199e1a34c5406c24c95e8d685724dd99e5e04e24` |
| `meta_11rx.json` | `https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/11rx.px` | json | `95f59bde8c5cc35ac87eca954099e0ecea80f7752c5b97b94ef22418cff42871` |
| `slice.json` | POST to `.../StatFin/vaerak/11rx.px` (national data slice) | json-stat2 | `803f0e4f99460789bc9fcf573ace4b2c6440c1623e6872ba52eb614d71c60a7f` |
| `statfin_root.json` | `https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/` | json | `a4c22c9b57286da09b6fb343391f570a4cc8e0a2052bff562afa7ca66c638ed4` |
| `dblist.json` | `https://pxdata.stat.fi/PxWeb/api/v1/en/` | json | `d02d11c96b3ec09c63b390aade2196f133a6b82ab4d32053392f26081fbd60a3` |
| `passiivi_vaerak.json` | `https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin_Passiivi/vaerak/` | json | `55113d5c6d4fe6da5e5998b1d7ff4d06a39b2c6286089f1b469c577fc7c8a6c7` |
| `kirkko.html` | `https://www.kirkontilastot.fi/` | html | `da39c610075cbe4f35f39d267f079152f51475771dbb1ccfec35ef45e7673615` |
| `viz304.html` | `https://www.kirkontilastot.fi/viz?id=304` | html | `d09e24cd72d7d6af24011a3bf30f6f5290b0a698f4855ce11072f4bcd1b0ce15` |

Also fetched (not tabled): `https://stat.fi/en/services/statistical-data-services/open-data-and-interfaces` and `https://stat.fi/en/about-us/get-to-know-statistics-finland/legislation/terms-of-use` (CC BY 4.0 confirmation); `https://www.kirkontilastot.fi/tiedostot/Tilastotietojen_kuvaukset.pdf` (church area classifications, no licence); `https://evl.fi/plus/hallinto-ja-talous/tilastot-ja-asiakirjat/` (no direct download); `https://www.maanmittauslaitos.fi/en/opendata-licence-cc40` (NLS CC BY 4.0).

## Blockers and held items

- **No StatFin subnational religion (the ceiling).** `11rx` is the only religion table, national only, for the full affiliation frame; no current or archived StatFin table crosses religion with area. Published-data ceiling, not a retrieval failure.
- **Church route delivery.** Parish, deanery, diocese, and municipal Lutheran membership sit in Tableau Public workbooks with no machine-readable API or located file download. Browser or Tableau extraction is the retrieval unblock.
- **Church statistics licence.** No reuse terms stated; a church-statistics ruling or an `evl.fi` confirmation is the licence unblock.
- **Parish boundary vector.** A licensed open parish (seurakunta) polygon set was not located; the municipality is the confirmed clean geometry.
