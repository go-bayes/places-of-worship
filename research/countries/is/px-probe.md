# Statistics Iceland PX-Web probe: religious and life-stance organisation membership

## Probe result

Statistics Iceland publishes one national annual stock table for religious and life-stance organisation membership: `MAN10001.px`, *Populations by religious and life stance organizations 1998-2026*. The table covers 1998-2026 without a missing year. Its construct is administrative membership recorded in the National Register of Persons. It does not measure census affiliation, belief, practice, or attendance.

The public PX-Web religious-organisation branch contains no municipality, region, or capital-versus-rest breakdown for all religious and life-stance organisations. The branch also contains parish tables for National Church membership. Those tables use ecclesiastical units, cover only National Church member status, and do not provide the all-organisation categories in `MAN10001.px`. The Iceland product therefore uses one national polygon.

The source record agrees with the brief's 1998-2026 span. Statistics Iceland updated the table on 12 March 2026.

## National annual table

- **Table ID**: `MAN10001.px`
- **English title**: *Populations by religious and life stance organizations 1998-2026*
- **Icelandic title**: *Mannfjöldi eftir trú og lífsskoðunarfélögum 1998-2026*
- **English table page**: <https://px.hagstofa.is/pxen/pxweb/en/Samfelag/Samfelag__menning__5_trufelog__trufelog/MAN10001.px/>
- **Icelandic table page**: <https://px.hagstofa.is/pxis/pxweb/is/Samfelag/Samfelag__menning__5_trufelog__trufelog/MAN10001.px/>
- **English API endpoint**: <https://px.hagstofa.is/pxen/api/v1/en/Samfelag/menning/5_trufelog/trufelog/MAN10001.px>
- **Icelandic API endpoint**: <https://px.hagstofa.is/pxis/api/v1/is/Samfelag/menning/5_trufelog/trufelog/MAN10001.px>
- **Unit**: persons
- **Reference time**: population on 1 January
- **Years**: every year from 1998 through 2026, 29 values

### Variables

`MAN10001.px` has three variables.

1. **Year** (`Ár`): `1998`, `1999`, `2000`, `2001`, `2002`, `2003`, `2004`, `2005`, `2006`, `2007`, `2008`, `2009`, `2010`, `2011`, `2012`, `2013`, `2014`, `2015`, `2016`, `2017`, `2018`, `2019`, `2020`, `2021`, `2022`, `2023`, `2024`, `2025`, `2026`.
2. **Religious** (`Trú- og lífsskoðunarfélög`): 64 values, listed below in source order with their PX codes.
3. **Division** (`Skipting`): `0` Total; `1` Males; `2` Females; `3` 0 - 17 years; `4` 18 years and over; `5` Percent; `6` Parish fees payers.

The complete English `Religious` value list is:

- `-`: Total
- `1`: The Evangelical Lutheran Church of Iceland
- `2`: The Independent Congregation of Reykjavík
- `3`: The Independent Congregation
- `8`: The Independent Congregation of Hafnarfjörður
- `7`: The Roman Catholic Church
- `4`: The Seventh Day Adventist Church
- `6`: The Pentecostal Church of Iceland
- `5`: The Congregation of Sjónarhæð
- `V`: Jehova Witnesses
- `B`: The Bahá'í Community
- `Á`: Pagan Worship
- `K`: The Church of Smárinn
- `M`: The Church of Jesus Christ the Latter-day Saints
- `C`: The Christian Way, a Church for You
- `D`: Word of Life
- `E`: The Rock - Christian Community
- `F`: The Icelandic Buddhist Society
- `G`: The Church of Kefas
- `H`: The First Baptist Church
- `J`: The Icelandic Muslim Association
- `L`: The Icelandic Church of Christ
- `N`: The Church of the Annunciation
- `P`: The Society of Believers
- `Q`: Nátthagi - Zen Buddhism
- `R`: Betania Christian Community
- `S`: The Russian Orthodox Church
- `T`: The Serbian Orthodox Church
- `U`: Family Federation for World Peace and Unification (Sun Myung Moon)
- `X`: The Pagan Chieftainship of Reykjavík
- `Y`: Home Church
- `Þ`: Soko Gakkai International
- `Æ`: The Islamic Cultural Center of Iceland
- `Ö`: The Church of the Resurrected Life
- `Ú`: The International Church of God and the Office of Jesus Christ
- `W`: Catch the Fire, a Christian Society
- `Ý`: The Christian Society of Vonarhöfn
- `Í`: Heaven on Earth
- `A`: The House of Prayer
- `Ð`: Loftstofan Baptist Church
- `É`: The Salvation Army
- `I`: Iceland - a Christian Nation
- `Ó`: Zuism
- `O`: The Icelandic Ethical Humanist Association
- `Z`: The Reborn Christian Church of God
- `#`: The Beth Shekinah Apostle Church
- `$`: The New Avalon Center
- `%`: DiaMat
- `@`: Tibetan Buddhist
- `/`: The Islamic Foundation of Iceland
- `&`: Ánanda Márga
- `)`: The Iceland Diamond Way Centre
- `<`: Vitund
- `=`: Ashutosh Yoga Iceland
- `:`: Ethiopian Orthodox Tewahedo in Iceland
- `!`: ICCI (Islamic Cultural Centre of Iceland)
- `'`: The Jewish Community of Iceland
- `*`: Wat Phra Dhammakaya Iceland
- `(`: The Theosophical Society of Iceland
- `Ä`: Ahmadiyya Muslim Community
- `°`: Parish of St. Bartholomew the Apostle
- `Ë`: ISKCON ICELAND
- `9`: Other and not specified
- `0`: No religious organisation

The build uses the English labels exactly as Statistics Iceland publishes them, including spellings such as `Jehova Witnesses`. The build does not silently correct source labels.

### Construct notes

Statistics Iceland states that membership in a religious or life-stance organisation recognised by the Ministry of the Interior is registered in the National Register of Persons. The source classifies people in an unrecognised organisation, or people whose status is unknown, as `Other and not specified`. The product keeps `No religious organisation` as the source name and does not interpret it as an attendance, belief, or broader irreligion measure.

Statistics Iceland revised its population-estimation method in March 2024 and updated the time series from 2011 onwards. The revision note is carried into the manifest and quality flags.

### API request

The extraction posts JSON to the English API endpoint. The request selects all 29 years, every `Religious` value, and `Division=0` (`Total`). The full request body is recorded in `docs/manifests/is-membership-1998-2026.json`; its operative shape is:

```json
{
  "query": [
    {"code": "Ár", "selection": {"filter": "item", "values": ["1998", "...", "2026"]}},
    {"code": "Trú- og lífsskoðunarfélög", "selection": {"filter": "all", "values": ["*"]}},
    {"code": "Skipting", "selection": {"filter": "item", "values": ["0"]}}
  ],
  "response": {"format": "json-stat2"}
}
```

## Subnational search

The English and Icelandic PX-Web trees expose the same current religious-organisation tables. The current branch endpoints are:

- English: <https://px.hagstofa.is/pxen/api/v1/en/Samfelag/menning/5_trufelog/trufelog>
- Icelandic: <https://px.hagstofa.is/pxis/api/v1/is/Samfelag/menning/5_trufelog/trufelog>
- Earlier English tables: <https://px.hagstofa.is/pxen/api/v1/en/Samfelag/menning/5_trufelog/trufelogeldra>

The current branch contains `MAN10001.px` and five single-year parish tables, `MAN10289.px` through `MAN10293.px`, for 2019-2023. The earlier branch contains parish tables for 2002-2018 and the national registration-flow table `MAN10200.px` for 1997-2017.

`MAN10289.px`, the 2023 parish table, has three variables: `Parishes` (308 values), `Membership` (Younger than 16 years; Total, 16 years and older; Members of the National Church; Not Members of the National Church), and `Sex` (Total; Males; Females). The parish tables dated 2002-2022 have the same National Church focus. The parish tables do not split `MAN10001.px` by municipality, region, or capital-versus-rest. They also do not preserve membership in all published religious and life-stance organisations.

`MAN10200.px`, *Population by religious and life stance organizations and registration 1997-2017*, has Religious organizations, Sex, Year, and Registrations. Registrations contains New registrations in excess of resignations, New registrations total, and Resignations total. The table has no geography and measures annual registration changes rather than membership stock.

No usable subnational table was found for the selected construct. The source-tree inventory supports the national-only verdict and supersedes the preliminary country card.

## Licence and reuse terms

Statistics Iceland's [Open data access](https://statice.is/publications/open-data-access/) page states that its published statistics are open data. Published website content may be reused, copied, and shared for any purpose under Creative Commons Attribution 4.0 International (CC BY 4.0), with Statistics Iceland credited. Statistics Iceland also states that altered statistics should not be attributed to the institution as the source of the changes.

The national boundary is [geoBoundaries gbOpen ISL ADM0](https://www.geoboundaries.org/api/current/gbOpen/ISL/ADM0/), release commit `9469f09`. The metadata records boundary year 2020, source `Lýsigagnagátt`, and CC BY 4.0. The build uses the raw release GeoJSON and the shared `scripts/lib/simplify_boundary.R` helper.

## Build-gate results

- **Reconciliation**: passed. For every year from 1998 through 2026, the 63 non-total source rows sum exactly to `Total`. The ten largest 2026 organisations, `Other organisations` residual, `Other and not specified`, and `No religious organisation` also sum exactly to `Total` in every year.
- **Year coverage**: passed. All 29 annual values from 1998 through 2026 are present.
- **Geometry**: passed. The simplified ADM0 output has one non-empty, valid polygon. The distinct-feature hash gate is inapplicable to a one-feature boundary.
- **Provenance**: passed. The manifest records the URL, retrieval date, byte size, and SHA-256 for every cached raw response and boundary file.
