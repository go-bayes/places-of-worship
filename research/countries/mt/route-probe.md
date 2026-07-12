# Malta census-religion and Catholic-attendance route probe

Probe verified 2026-07-12. Malta carries two independent, buildable-in-principle routes that must never share a construct or an axis. The **census route** is a clean single-wave locality product: the National Statistics Office (NSO) 2021 Census Final Report, Volume 1, publishes religious affiliation as exact counts at three grains — national (Table 5.1), district (Table 5.2, six statistical districts), and **locality (Table 5.3, 68 local councils)** — for the resident population aged 15 and over, with a ten-category frame plus a no-religious-affiliation slot that sums to the printed total exactly. Religion was asked for the first time in the 2021 census; the 1995, 2005, and 2011 waves carried no religion question; this route is therefore single-wave (2021 only), not the "1995-2021" span the queue row implies. The **attendance route** is the Discern (Archdiocese of Malta) Sunday Mass Attendance Census: a five-wave series (1967, 1982, 1995, 2005, 2017) whose 2017 report prints attendance by **parish** (Table 13, 70 parishes on mainland Malta, excluding the Diocese of Gozo) over an *obligati* denominator — the exact Poland dominicantes construct, attendance and never affiliation. The attendance route is **HELD** on the same blocker that stopped Poland: no open Catholic **parish** boundary layer exists, and the report states plainly that parish boundaries do not coincide with locality boundaries, and the civil 68-council layer therefore cannot approximate the 70 parishes. Two licence positions are restrictive and sit with the PI: the NSO reserves all intellectual-property rights and prohibits automated extraction, and the Discern report is all-rights-reserved.

## Route verdicts (recommendation to the conductor)

- **Census route: BUILDABLE (single wave, locality grain), STAGED with licence needs_review.** NSO 2021 Census Final Report Volume 1, Table 5.3, gives religious-affiliation counts for 68 localities across six districts; the boundary is geoBoundaries MLT ADM1 (68 local councils, Public Domain) joining one-to-one under a definite-article name concordance. Single wave only (2021). Small cells are pervasive at locality grain and the ratified small-cell rule applies at build time. Licence needs a PI ruling (NSO all-rights-reserved plus an explicit anti-scraping clause).
- **Attendance route: HELD (parish-polygon gap, the Poland precedent).** Discern's 2017 report prints a parish-grain attendance product (Table 13, 2005 and 2017, with a change column) over the obliged-Catholic denominator, and a national 1967-2017 series (Table 1a). No open parish boundary layer exists; the report itself states parish and locality boundaries differ. Unblock: obtain or digitise Malta Catholic parish polygons (an Archdiocese GIS ask, or a manual digitisation validated against the parish list), OR ship attendance as a non-mapped table. Licence also needs a PI ruling (all-rights-reserved).

## Access note (both official routes)

NSO Malta (`nso.gov.mt`) sits behind Cloudflare bot protection and an explicit anti-scraping term. Automated `curl` and the WebFetch backend both received **HTTP 403** on every NSO URL (the Chapter 5 indicator page, the Volume 1 PDF, the MaltaToday mirror article). The report content was recovered through the authenticated browser session: an in-page `fetch()` on `nso.gov.mt` returned the 6,820,290-byte Volume 1 PDF (HTTP 200, `application/pdf`), which was parsed to text in-browser with pdf.js (175 pages, 325,335 characters). The Discern report served cleanly to `curl` with a browser user-agent (HTTP 200). This block is recorded honestly; the census figures below are read from the NSO's own PDF, not from a secondary source.

## Census route — waves and published geography

| Wave | Religion question | Verified religion tables | Published geography | Format |
| --- | --- | --- | --- | --- |
| 1995, 2005, 2011 | none | — | — | Religion not asked (2021 was the first census to ask it) |
| 2021 | yes (aged 15+) | [Final Report Volume 1](https://nso.gov.mt/wp-content/uploads/Census-of-Population-2021-volume1-final.pdf), Tables 5.1-5.5 | national (5.1), **district** (5.2, 6 districts + Malta/Gozo split), **locality** (5.3, 68 local councils) | Exact counts, PDF (text layer extractable) |

The tables-annex contents page (Volume 1, p.10) lists verbatim:

- **TABLE 5.1. Population aged 15 and over by religious affiliation, sex and age** (p.160)
- **TABLE 5.2. Population aged 15 and over by religious affiliation, district and sex** (p.161)
- **TABLE 5.3. Population aged 15 and over by religious affiliation and locality** (pp.162-164)
- **TABLE 5.4. Population aged 15 and over by type of citizenship, sex and religious affiliation** (p.165)
- **TABLE 5.5. Population aged 15 and over by … religious affiliation** (p.166, title truncated in extract)

Table 5.3 is the finest grain and the shipped subnational table: exact affiliation counts for 68 localities, grouped under the six statistical districts (Southern Harbour, Northern Harbour, South Eastern, Western, Northern, Gozo and Comino). Counts, not percentages.

### Category frame (verbatim, as printed in Tables 5.1-5.3)

Ten mutually exclusive religion categories plus a no-affiliation slot; no separate "not stated" line appears (the ten categories plus no-affiliation sum exactly to the aged-15+ total):

| Source category | Product role |
| --- | --- |
| Roman Catholicism | religious affiliation |
| Islam | religious affiliation |
| Orthodoxy | religious affiliation |
| Hinduism | religious affiliation |
| Church of England | religious affiliation |
| Protestantism | religious affiliation |
| Buddhism | religious affiliation |
| Judaism | religious affiliation |
| Other religious groups | religious affiliation |
| No religious affiliation | no religion |

### National counts (Table 5.1, aged 15+), reconciliation

| Category | Count |
| --- | ---: |
| Roman Catholicism | 373,304 |
| Islam | 17,454 |
| Orthodoxy | 16,457 |
| Hinduism | 6,411 |
| Church of England | 5,706 |
| Protestantism | 4,516 |
| Buddhism | 2,495 |
| Judaism | 1,249 |
| Other religious groups | 911 |
| No religious affiliation | 23,243 |
| **Total** | **451,746** |

The ten categories plus no-affiliation sum to exactly 451,746 (373,304 + 17,454 + 16,457 + 6,411 + 5,706 + 4,516 + 2,495 + 1,249 + 911 + 23,243 = 451,746). Table 5.2 reconciles the same total across the Malta/Gozo split: Malta (island) 417,450 + Gozo and Comino 34,296 = 451,746. Roman Catholicism is 82.6% of the aged-15+ population; no-religious-affiliation is 5.1% (23,243). The universe is the resident population aged 15 and over (the religion question was put only to those aged 15+); total Malta 2021 population was larger (~519,000); the denominator is therefore the 15+ base, never the whole population — pin this on the card.

### Small cells (Table 5.3, locality grain) — the small-cell rule applies

Locality × minority-category cells are frequently small, and some are nil. Verbatim examples from Table 5.3: Floriana has Judaism 6 and Other religious groups "‐" (nil); Ħal Kirkop has Judaism 1, Other religious groups 1; Il-Qrendi has Hinduism "‐" and Buddhism "‐". Many localities carry minority counts in single or low-double digits. Under the ratified small-cell rule (`docs/development/small-cell-rule.md`, RATIFIED 2026-07-12): where a locality's denominator falls below 100 persons the unit washes pale (no locality denominator is that small here — the smallest locality totals are ~1,800), but the numerator rule bites hard — every minority-category cell below 10 persons renders with the "fewer than ten people" marker, and Roman Catholicism and no-affiliation shares over small minority tails render as published. The rule is a display-honesty treatment only; no value is altered. Record the tokens `small_cell_under_10` at build time from the published counts.

### Census boundary layer

- **geoBoundaries MLT ADM1** — release metadata (retrieved 2026-07-12): `boundaryType` ADM1, `admUnitCount` 68, `boundaryYearRepresented` 2022, `boundarySource` "geoBoundaries, d-maps.com", `boundaryLicense` **"Public Domain"**, `licenseSource` `d-maps.com/conditions.php?lang=en`. [ADM1 metadata](https://www.geoboundaries.org/api/current/gbOpen/MLT/ADM1/); [ADM1 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MLT/ADM1/geoBoundaries-MLT-ADM1.geojson). The GeoJSON carries 68 features whose `shapeName` values are the 68 Maltese local councils (Attard, Balzan, Birgu, Birkirkara, Birżebbuġa, Bormla, … Żejtun, Żurrieq). geoBoundaries MLT **ADM2 returns HTTP 404** — Malta has only ADM0 and this 68-unit ADM1 in geoBoundaries; the 68-unit layer is the locality product's base.

The 68 geoBoundaries councils match the 68 Table 5.3 localities one-to-one, needing only a definite-article name concordance: the census prints Maltese article-and-euphonic forms (Ħal Luqa, Il-Gudja, Iż-Żejtun, Ħaż-Żabbar, Tas-Sliema, San Pawl il-Baħar) while geoBoundaries prints bare forms (Luqa, Gudja, Żejtun, Żabbar, Sliema, Saint Paul's Bay). Two Gozo/Malta homonyms (Rabat Malta/Rabat Gozo, Żebbuġ Malta/Żebbuġ Gozo) are disambiguated by district in the census table. Build the concordance from the Table 5.3 district grouping. A six-district (Table 5.2) product, if wanted, dissolves the 68 councils into the six statistical districts.

### Census licence position (needs PI ruling)

The NSO Terms of use (`nso.gov.mt/terms-of-use/`, retrieved 2026-07-12) is restrictive and carries an explicit anti-scraping clause, quoted verbatim:

> The NSO reserves in full all Intellectual Property rights and any other rights at law. Unauthorized web scraping of content from this website is strictly prohibited. Web scraping refers to the automated extraction of data from websites without prior consent. Any attempt to engage in web scraping without explicit, written consent from the website owner is a violation of these terms. … To request consent, please send a written request on nso@gov.mt …

The site footer reads "© 2023 National Statistics Office". This is stronger than a bare all-rights-reserved footer: it both reserves all IP rights and names automated extraction as a violation absent written consent. The census figures are, however, official published aggregate statistics released in a public report. The position mirrors the RO/SK/CA/CI/IR "derived-summaries-with-attribution" line the corpus has taken over all-rights-reserved offices, but the anti-scraping clause is a distinctive escalation. **Recorded ask for the PI:** does the derived-summaries-with-attribution stance extend to NSO Malta, given the explicit anti-scraping term, or should the clean unblock be an NSO reuse-confirmation email (and/or the formal data request at `workflow.gov.mt/eservice/S10375`) before the locality product ships? **PI RULING (2026-07-12, same day):** consent-first. The PI writes to nso@gov.mt for reuse consent before anything ships; the census product stays in reserve — no build ships and no page launches until the NSO replies. Build-then-ask does not apply here; the anti-scraping clause takes Malta outside that precedent. Attribution, if consent arrives, is "Source: National Statistics Office, Malta — Census of Population and Housing 2021". Boundary is Public Domain.

## Attendance route — waves, grain, and the parish-boundary blocker

The Archdiocese of Malta assigns the Sunday Mass Attendance Census to Discern (Institute for Research on the Signs of the Times). The 2017 report states verbatim (Foreword): "so far five such Censuses have been held, specifically in 1967, 1982, 1995, 2005 and last in 2017." It is a full count (a census, not a sample survey) of persons physically present at Mass on one count weekend.

- Source of record: [Malta Sunday Mass Attendance Census 2017](https://discern.mt/wp-content/uploads/2024/06/Malta-Sunday-Mass-Attendance-Census-2017.pdf) (Discern, published 2018, ISBN 978-99957-341-4-5). Landing page: [discern.mt/research/malta-sunday-mass-attendance-census-2017/](https://discern.mt/research/malta-sunday-mass-attendance-census-2017/). The 2005 report is linked from Discern's [publications page](https://discern.mt/publication/) (hosted at `centesimusannus.org`). Retrieved 2026-07-12; the 2017 PDF served HTTP 200 to `curl`.
- **Grain: parish.** The report profiles individual parishes and prints **Table 13. Attendance Rates by Parish** — 2017 attendance, 2005 attendance, change 2005-2017, 2017 residents' attendance rate, per-parish, for 70 parishes. Data were "collected from 70 parishes which include questionnaires collected in Chaplaincies of Foreign Catholics."
- **Coverage: mainland Malta only, excluding Gozo.** Verbatim: "This Census covers only Mass attendance in the Archdiocese of Malta and excludes the Diocese of Gozo." The census route (NSO) covers the whole country including Gozo; the attendance route covers the Archdiocese of Malta (mainland) only. The two frames therefore differ.
- **Construct: attendance over an *obligati* denominator (the Poland precedent), never affiliation.** The 2017 rate is computed over "a studied weighted estimate of the total Catholic population in Malta on Census day" aged 7 and over obliged to attend — 309,421 — not the total population and not all Catholics. Headline: "the number of people who attended Mass on Census day was 111,578, or 36.1% of the Catholic population present in mainland Malta and obliged to go to Mass." Table 1a prints the national series: 1967 = 198,150 (81.9%); 1982 = 182,851 (72.7%); 1995 = 190,926 (64.3%); 2005 = 168,721 (50.6%); 2017 = 111,578 (36.1%). This is the exact Italy/Poland practice-lane construct — attendance frequency, its own `construct`, carried on its own axis, never compared to the census affiliation share.
- **The blocker — no open parish boundary layer.** The report states verbatim that parish and locality boundaries diverge: "the boundaries of some parishes are therefore not the same as those of the Locality" (Catholic Parish Populations section), and Discern obtained per-parish populations by asking the NSO to sum residents over street lists inside each parish, precisely because the civil geography does not carry the parish frame. A web search (2026-07-12) for Malta Catholic parish boundaries in GIS format returned only civil administrative layers (local councils, districts) from Malta GeoHub, the INSPIRE geoportal, geoBoundaries, and commercial vendors; no ecclesiastical/parish polygon layer was located. This is the Poland diocese-polygon problem exactly (`research/countries/pl-practice-lane-scoping.md`): the attendance count exists at parish grain, but the mapping polygon does not exist openly, and civil polygons cannot approximate it. A parish product cannot ship a choropleth until parish polygons are obtained.

### Attendance licence position (needs PI ruling)

The 2017 report copyright page reads verbatim:

> Copyright © Discern - Institute for Research on the Signs of the Times, 2018
> All rights reserved. Except for the quotation of short passages for the purpose of research and review, no part of this publication may be reproduced, stored in a retrieval system, or transmitted in any form or by any means, electronic, mechanical, photocopying, recording or otherwise, without the prior permission of the publisher.

This is all-rights-reserved with a research-quotation exception. It parallels the Poland ISKK position (published figures in a free public report; the project would show derived rates with attribution and not redistribute the source PDF) but is more restrictive on its face. **Recorded ask for the PI:** does the derived-rates-with-attribution stance extend to Discern/Archdiocese of Malta, or is a Discern reuse-confirmation the unblock? Moot while the route is HELD on the boundary gap.

## Premise corrections (trust the record)

- **Census religion is single-wave (2021 only), not "1995-2021".** The queue row's 1995-2021 span fits the attendance series (1967-2017, with 1995/2005/2017 among the waves), not census affiliation. Religion was asked in a Maltese census for the first time in 2021; 1995, 2005, and 2011 carried no religion question. The census route ships the 2021 wave only.
- **Census religion IS published at locality grain, not district-only.** The mt/README.md hedged "District in the 2021 final report; locality route to verify." Verified: Table 5.3 publishes religion by locality (68 local councils) as exact counts. The locality route is the stronger census product; the district table (5.2) is a coarser alternative.
- **The two routes cover different territories.** The NSO census covers all of Malta including Gozo (Table 5.2 splits Malta 417,450 / Gozo and Comino 34,296). The Discern attendance census covers the Archdiocese of Malta (mainland) only and excludes the Diocese of Gozo. They are not the same frame and must not be reconciled to each other.
- **"Parish or locality in reports" conflates two different geographies.** The census publishes by **locality** (civil local council); the attendance census publishes by **parish** (ecclesiastical). The report is explicit that these boundaries differ. The census locality layer is open (geoBoundaries, Public Domain); the parish layer is not.
- **Route is browser-gated, not a clean download, for NSO.** The queue's "browser work" tag is correct for NSO: the site blocks automated fetch (HTTP 403) and carries an anti-scraping term; the report was read through the authenticated browser session. Discern is a clean download.

## Retrieval record

All inputs retrieved 2026-07-12. NSO content read through the browser session (site blocks `curl`/WebFetch); Discern and geoBoundaries downloaded directly. Working copies held in the session scratchpad only (this lane's sole write target is this probe file; no `data/raw` cache was created).

| Input | Source URL | Access | Note |
| --- | --- | --- | --- |
| Census 2021 Final Report Vol.1 (religion Tables 5.1-5.5) | <https://nso.gov.mt/wp-content/uploads/Census-of-Population-2021-volume1-final.pdf> | browser in-page fetch (curl/WebFetch → 403) | 175pp, 6,820,290 bytes, `application/pdf`; parsed via pdf.js |
| NSO Chapter 5 indicator page | <https://nso.gov.mt/selected_indicators/final-report-volume-1-chapter-5-religious-affiliation/> | browser (curl/WebFetch → 403) | summary shell; data live in Vol.1 PDF |
| NSO Volume 1 publication landing | <https://nso.gov.mt/themes_publications/census-of-population-and-housing-2021-final-report-population-migration-and-other-social-characteristics-volume-1/> | search-indexed | publication home |
| NSO Terms of use (licence source) | <https://nso.gov.mt/terms-of-use/> | browser | all-IP-reserved + anti-scraping clause quoted above |
| Discern Sunday Mass Attendance Census 2017 | <https://discern.mt/wp-content/uploads/2024/06/Malta-Sunday-Mass-Attendance-Census-2017.pdf> | curl 200 | sha256 `2fff8443d327f8d76ec241c760731f90927714dfd016291052b5d3cc9f8d68c7`; 2.8MB; Tables 1a, 13 |
| Discern research/publications pages | <https://discern.mt/research/malta-sunday-mass-attendance-census-2017/> ; <https://discern.mt/publication/> | curl 200 | 2005 report linked (centesimusannus.org) |
| geoBoundaries MLT ADM1 metadata | <https://www.geoboundaries.org/api/current/gbOpen/MLT/ADM1/> | WebFetch 200 | 68 councils, Public Domain, 2022 |
| geoBoundaries MLT ADM1 GeoJSON | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MLT/ADM1/geoBoundaries-MLT-ADM1.geojson> | curl 200 | sha256 `7d7f4853b270c3afbbef522b54fc3ea1bcedf27e3912a33574024b5cdd304fe3`; 68 features |
| geoBoundaries MLT ADM2 | <https://www.geoboundaries.org/api/current/gbOpen/MLT/ADM2/> | WebFetch 404 | Malta has no ADM2 in geoBoundaries |

## Build recommendation

**Census route: BUILD (single wave, 68-locality), STAGED, licence needs_review.** The 2021 Census Final Report Volume 1, Table 5.3, supports a single-wave, 68-locality, ten-category-plus-no-affiliation religion-count choropleth on a Public-Domain boundary layer that matches the census localities one-to-one under a definite-article concordance. The text layer extracts without optical character recognition; the national frame reconciles exactly to 451,746 aged 15+, and the Malta/Gozo split reconciles to the same total. Two constraints attach: the small-cell rule applies at locality grain (minority-category cells below ten render the "fewer than ten people" marker; no value altered), and the NSO licence needs the PI ruling above (all-IP-reserved plus an anti-scraping clause). Universe is population aged 15+, single wave 2021 — no change metric, no earlier wave. No page or hub edit in this lane.

**Attendance route: HELD (parish-polygon gap).** The Discern 2017 report carries a genuine parish-grain attendance product (Table 13: 70 parishes, 2005 and 2017, change column) over the obliged-Catholic denominator, and a national 1967-2017 series — the Italy/Poland practice-lane construct, attendance as its own value. It is HELD on the boundary: no open Catholic parish polygon layer exists, and the report states parish boundaries differ from locality boundaries, and the civil 68-council layer therefore cannot stand in. The named unblock is a Malta parish polygon source — an Archdiocese/Discern GIS request or a manual digitisation validated against the 70-parish list — mirroring the Poland diocese-polygon decision the PI already holds. Until a parish layer lands, attendance can only ship as a non-mapped table, not a choropleth. Licence (all-rights-reserved) is a second, subordinate PI ask.
