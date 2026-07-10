# Statistics Estonia PXWeb probe: census religious affiliation

## Probe result

Statistics Estonia publishes county religion tables for the 2000, 2011, and 2021 censuses. Every table covers the population aged 15 and over. The 2000 source also includes people whose age was unknown in this universe. The product uses the published age-15-plus total for every denominator and never uses total population.

The source does not publish the 2000 or 2011 religion results rebased to the post-2017 municipalities or counties. The build therefore ships the 15 counties on three official Maa-amet (Estonian Land Board) boundary vintages. Repeated county names do not establish unchanged polygons, and the product reports no county-level change statistic across boundary vintages.

The source record changes the initial route. `RL21454` is the 2021 settlement-region table with sex, age, and ethnic-nationality dimensions; it does not contain administrative units. `RL0451` is the 2011 national urban/rural table; it does not contain counties or individual municipalities. The mapped build instead uses `RL21452` for 2021 administrative units and `RL0453` for 2011 counties. The 2000 build uses `RL229`.

## Exact API endpoints

### Product tables

| Wave | Table | English API endpoint | Estonian API endpoint |
| --- | --- | --- | --- |
| 2000 | `RL229.PX` | <https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2000/usk/RL229.PX> | <https://andmed.stat.ee/api/v1/et/stat/rahvaloendus/rel2000/usk/RL229.PX> |
| 2011 | `RL0453.PX` | <https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2011/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk/RL0453.PX> | <https://andmed.stat.ee/api/v1/et/stat/rahvaloendus/rel2011/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk/RL0453.PX> |
| 2021 | `RL21452.px` | <https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2021/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk/RL21452.px> | <https://andmed.stat.ee/api/v1/et/stat/rahvaloendus/rel2021/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk/RL21452.px> |

The extraction posts JSON-stat2 requests to the English endpoints. The requests select the national row, all 15 county rows, and every published religion category. The manifest records each complete request body.

### Initial-route tables

- `RL21454.px`: <https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2021/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk/RL21454.px>. The geography variable has four values: whole country, city settlement region, town settlement region, and rural settlement region.
- `RL0451.PX`: <https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2011/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk/RL0451.PX>. The geography variable has six values: whole country, urban settlements, rural settlements, cities, Tallinn, and rural municipalities.

### Religion branches

- 2000: <https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2000/usk>
- 2011: <https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2011/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk>
- 2021: <https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2021/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk>

## Waves and geography

| Wave | Religion table geography actually published | Finest mapped level suitable for this product | Boundary treatment |
| --- | --- | --- | --- |
| 2000 | `RL229`: national, all cities, all rural municipalities, 15 counties, county city aggregates, selected named cities, Tallinn districts, and county rural-municipality aggregates | 15 counties | Official Maa-amet historical county layer dated 4 December 2000 |
| 2011 | `RL0453`: national, 15 counties, and subordinate rows for Tallinn, Narva, and Tartu; `RL0451` contains national urban/rural aggregates only | 15 counties | Official Maa-amet historical county layer dated 8 June 2011 |
| 2021 | `RL21452`: national, three settlement-region aggregates, five statistical regions, 15 counties, 79 municipalities, and eight Tallinn districts; `RL21454` contains settlement-region aggregates only | 15 counties for the three-wave product; 79 municipalities are available for a later 2021-only product | Official Maa-amet historical county layer dated 1 January 2021 |

Statistics Estonia exposes no individual rural-municipality religion rows for 2000 or 2011. A municipality-level three-wave product would therefore require an unofficial reconstruction, which this lane forbids.

## Construct, universe, and response handling

The construct is self-reported census religious affiliation. Church membership, baptism, attendance, and practice do not determine the source classification. The 2000 and 2011 censuses asked the religion question as a voluntary item. The 2021 census collected religion through its sample survey because religion was unavailable in registers. Nearly half of the population participated, Statistics Estonia generalised the responses to the population aged 15 and over, and the published religion values were not supplemented from registers.

The age-15-plus source total remains the denominator even when a person refused, could not define an affiliation, or had unknown religion status. The build does not use a stated-response denominator.

| Wave | Affiliation numerator | No-religion numerator | Categories retained in the age-15-plus denominator but outside both numerators |
| --- | --- | --- | --- |
| 2000 | `Kindlat usku tunnistav` / Follower of a particular faith | `Usu suhtes ükskõikne` / Has no religious affiliation plus `Ateist` / Atheist | Cannot define the affiliation; Refused to answer; Religious affiliation unknown |
| 2011 | `Peab omaks mõnd usku` / Feels an affiliation to a religion | `Ei pea omaks ühtegi usku` / Does not feel an affiliation to any religion | Refused to answer; Religious affiliation unknown |
| 2021 | `Peab omaks mõnd usku` / Feels an affiliation to a religion | `Ei pea omaks ühtegi usku` / Does not feel an affiliation to any religion | Refused to answer; Religious affiliation unknown |

`Usk teadmata` / Religion unknown is nested inside the affiliation parent in 2011 and 2021. `Usk teadmata` / faith unknown has the same nested role in 2000. The headline affiliation count therefore uses the source parent row rather than re-summing detail categories.

## Rounding and unavailable cells

The 2000 and 2011 APIs publish integer counts that reconcile exactly. The 2021 API publishes values in multiples of ten and states that aggregated values may differ from their component sums because of rounding. The build retains every published count. It distributes no reconciliation residual and derives percentages only from the published numerator and the published age-15-plus denominator.

The 2021 county query contains 41 unavailable minor-religion cells marked by the source as too uncertain for publication. All county totals, affiliation parent counts, no-affiliation counts, refusal counts, and relationship-unknown counts are present. The missing minor cells remain unavailable and do not affect the headline product.

## Category inventories

The manifest keeps the Estonian source labels and adds Statistics Estonia's English display labels. Category hierarchies remain as published.

### 2000 categories (19)

| Code | Estonian source label | English display label | Product role |
| --- | --- | --- | --- |
| `+` | Kokku | Religious affiliation total | age-15-plus total |
| `10` | Kindlat usku tunnistav | Follower of a particular faith | affiliation headline |
| `110` | ..luterlane | ..Lutheran | affiliation detail |
| `111` | ..õigeusklik | ..Orthodox | affiliation detail |
| `112` | ..baptist | ..Baptist | affiliation detail |
| `113` | ..katoliiklane | ..Roman-Catholic | affiliation detail |
| `114` | ..jehoovatunnistaja | ..Jehovah Witness | affiliation detail |
| `115` | ..nelipühilane | ..Pentecostal | affiliation detail |
| `116` | ..vanausuline | ..Old Believer | affiliation detail |
| `117` | ..adventist | ..Adventist | affiliation detail |
| `118` | ..metodist | ..Methodist | affiliation detail |
| `119` | ..muslim/moslem | ..Muslim | affiliation detail |
| `1M` | ..muu usk | ..other religion | affiliation detail |
| `1X` | ..usk teadmata | ..faith unknown | affiliation detail |
| `20` | Usu suhtes ükskõikne | Has no religious affiliation | no-religion component |
| `30` | Ateist | Atheist | no-religion component |
| `40` | Ei oska vastata | Cannot define the affiliation | response outside both headlines |
| `50` | Ei soovi vastata | Refused to answer | response outside both headlines |
| `60` | Suhtumine religiooni teadmata | Religious affiliation unknown | response outside both headlines |

### 2011 categories (22)

| Code | Estonian source label | English display label | Product role |
| --- | --- | --- | --- |
| `899` | Usk kokku | Religion total | age-15-plus total |
| `898` | Peab omaks mõnd usku | Feels an affiliation to a religion | affiliation headline |
| `102` | Õigeusklik | Orthodox | affiliation detail |
| `101` | Luterlane | Lutheran | affiliation detail |
| `104` | Baptist | Baptist | affiliation detail |
| `103` | Katoliiklane | Roman-Catholic | affiliation detail |
| `105` | Jehoova tunnistaja | Jehovah's Witness | affiliation detail |
| `107` | Vanausuline | Old Believer | affiliation detail |
| `131` | Kristlikud vabakogudused | Christian Free Congregations | affiliation detail |
| `135` | Maausuline | Earth Believer | affiliation detail |
| `121` | Eristamata kristlane | Unidentified Christian | affiliation detail |
| `106` | Nelipühilane | Pentecostal | affiliation detail |
| `110` | Islamiusuline | Muslim | affiliation detail |
| `108` | Adventist | Adventist | affiliation detail |
| `119` | Budist | Buddhist | affiliation detail |
| `109` | Metodist | Methodist | affiliation detail |
| `157` | Taarausuline | Taara Beliver | affiliation detail |
| `OTH` | Muu usk | Other religion | affiliation detail |
| `893` | Usk teadmata | Religion unknown | affiliation detail |
| `892` | Ei pea omaks ühtegi usku | Does not feel an affiliation to any religion | no-religion headline |
| `891` | Ei soovinud vastata | Refused to answer | response outside both headlines |
| `890` | Suhe religiooni teadmata | Religious affiliation unknown | response outside both headlines |

### 2021 categories (21)

| Code | Estonian source label | English display label | Product role |
| --- | --- | --- | --- |
| `1` | Usk kokku | Religion total | age-15-plus total |
| `2` | Peab omaks mõnd usku | Feels an affiliation to a religion | affiliation headline |
| `3` | ..Luterlane | ..Lutheran | affiliation detail |
| `4` | ..Õigeusklik | ..Orthodox | affiliation detail |
| `5` | ..Katoliiklane | ..Roman Catholic | affiliation detail |
| `6` | ..Baptist | ..Baptist | affiliation detail |
| `7` | ..Jehoova tunnistaja | ..Jehovah's Witness | affiliation detail |
| `8` | ..Nelipühilane | ..Pentecostal | affiliation detail |
| `9` | ..Vanausuline | ..Old Believer | affiliation detail |
| `10` | ..Adventist | ..Adventist | affiliation detail |
| `11` | ..Metodist | ..Methodist | affiliation detail |
| `12` | ..Islamiusuline | ..Muslim | affiliation detail |
| `13` | ..Budist | ..Buddhist | affiliation detail |
| `14` | ..Kristlik vabakoguduslane | ..Christian Free Congregations | affiliation detail |
| `15` | ..Maausuline | ..Earth Believer | affiliation detail |
| `16` | ..Taarausuline | ..Taara Beliver | affiliation detail |
| `17` | ..Muu usk | ..Other religion | affiliation detail |
| `18` | ..Usk teadmata | ..Religion unknown | affiliation detail |
| `19` | Ei pea omaks ühtegi usku | Does not feel an affiliation to any religion | no-religion headline |
| `20` | Ei soovinud vastata | Refused to answer | response outside both headlines |
| `21` | Suhe religiooni teadmata | Religious affiliation unknown | response outside both headlines |

## Concordance decision

The primary product contains 45 rows: 15 counties in each of 2000, 2011, and 2021. Each row joins only to the official boundary vintage selected for that wave. The combined area-summary file records a different `boundary_set_id` for each wave, and the three GeoJSON files remain separate.

The build creates no settlement-level or municipality-level concordance. Statistics Estonia's religion branches contain no table that rebases the earlier waves onto the 79 post-reform municipalities or the 2021 county frame. A future 2021-only municipality product can use `RL21452`, but it would be a separate geography product.

## Boundaries and reuse terms

The official boundary source is the Estonian Land and Spatial Development Board historical administrative-division WFS (Web Feature Service): <https://teenus.maaamet.ee/ows/wms-ajalooline-haldus?service=WFS&request=GetCapabilities&version=2.0.0>. The selected feature types are `maakonnad_2000`, `maakonnad_2011`, and `maakonnad_2021`. Each contains 15 counties with an EHAK (Estonian Administrative and Settlement Classification) `MKOOD` code.

The [administrative and settlement division catalogue](https://geoportaal.maaamet.ee/eng/spatial-data/administrative-and-settlement-division-p312.html) states that use is unrestricted when the Estonian Land and Spatial Development Board and the data validity date are cited. The Board's [open-data licence](https://geoportaal.maaamet.ee/docs/Avaandmed/Licence-of-open-data-of-Estonian-Land-Board.pdf) permits derivatives and redistribution with origin and age or extraction-date attribution. The project records these terms without assigning a Creative Commons identifier to the boundary.

Statistics Estonia states that its open data are reusable under [Creative Commons Attribution-ShareAlike 4.0 International](https://www.stat.ee/en/statistics-estonia/about-us/strategy/principles-dissemination-official-statistics), with Statistics Estonia cited as the source.

## Build-gate results

- **Wave coverage**: passed. The product contains 15 county rows for each of 2000, 2011, and 2021.
- **Universe**: passed. Every product denominator and note identifies the population aged 15 and over. The 2000 source's inclusion of people with unknown age is recorded.
- **Reconciliation**: passed. All complete 2000 and 2011 county category sums match the national rows exactly. The 2021 headline county sums differ from national published values by no more than 30 people, consistent with values published in tens and the source rounding footnote. Within-area top-level categories differ from their published totals by no more than 10 people. No residual is distributed.
- **Unavailable cells**: passed with a source limitation. The 41 unavailable 2021 minor-religion county cells remain unavailable; every headline cell is present.
- **Geography**: passed. Every row uses its wave's official county boundary. The product makes no rebasing or same-polygon claim.
- **Geometry**: passed. Each simplified GeoJSON contains 15 non-empty, valid features with 15 distinct SHA-256 geometry hashes.
- **Provenance**: passed. The manifest records URL, retrieval date, byte size, and SHA-256 for every cached source and generated output.

