# Poland practice-lane pilot: scoping

Scoping notes for the ratified practice lane (research/country-survey.md,
"Practice lane"). Poland is the pilot: map Catholic religious *practice*
(Mass attendance) by diocese as its own construct, with census affiliation
by voivodeship as context. This document records the sources found, ranks
the diocese-polygon options, maps the years and boundary vintages, states
the licence positions, and proposes a build sequence. It is a scoping note,
not a build; nothing here is committed to a product.

## Sources found

### ISKK practice data (dominicantes, communicantes)

- Annual full count of Sunday Mass attendance in every Polish Catholic
  parish, run by ISKK with the Polish Episcopate since 1980 (pilots 1978,
  1979; Zdaniewicz and Adamczuk methodology). The operational unit is the
  parish; the analytical unit is the diocese. A single October or November
  Sunday is counted each year; the series is therefore a decades-long annual panel
  at diocese level.
- **e-Dominicantes** — interactive dashboard and current-year reporting
  workflow: https://iskk.pl/dominicantes/ (2025 collection cycle at
  https://panel.iskk.pl/). Public dashboard; no documented bulk download.
- **Annuarium Statisticum Ecclesiae in Polonia** — annual statistical
  yearbook, free public PDFs on iskk.pl, each carrying diocese-level
  dominicantes and communicantes tables:
  - 2024 data, English edition: https://iskk.pl/wp-content/uploads/2026/03/Annuuarium_za_24_ENG_3.03.2026.pdf
  - 2023 data: https://iskk.pl/wp-content/uploads/2024/12/Annuarium_Statisticum_2023.pdf
  - 2022 data: https://iskk.pl/wp-content/uploads/2023/12/Annuarium_Statisticum_DANE_za-2022_19.12.pdf
  - 2020 data: https://www.ekai.pl/wp-content/uploads/2021/12/ANNUARIUM-STATISTICUM-ECCLESIAE-IN-POLONIA.-Dane-za-rok-2020.pdf
  - Publications index: https://iskk.pl/publikacje/
- The diocese-level tables are in the free PDFs (the annual press coverage
  ranks dioceses straight from them). Format is PDF tables, not CSV; a
  parse-and-transcribe step is required. An English edition eases parsing.
- **Wikipedia**, "Dominicantes i communicantes w Polsce"
  (https://pl.wikipedia.org/wiki/Dominicantes_i_communicantes_w_Polsce)
  compiles the long series and can cross-check a transcription, but every
  value must be traced back to the ISKK source of record, not cited from
  the encyclopedia.

### GUS census affiliation (context layer)

- NSP 2021 final results, religion tables (by voivodeship), published
  2023-11-29 as XLSX: https://stat.gov.pl/spisy-powszechne/nsp-2021/nsp-2021-wyniki-ostateczne/tablice-z-ostatecznymi-danymi-w-zakresie-przynaleznosci-narodowo-etnicznej-jezyka-uzywanego-w-domu-oraz-przynaleznosci-do-wyznania-religijnego,10,1.html
  (table "Ludność według przynależności do wyznania religijnego w 2021 r.").
- NSP 2011 affiliation is coarser (largely national with limited regional
  detail); confirm the exact regional table before using it as a second
  wave. The pl/ card already lists the NSP results hub.

## Diocese-polygon options, ranked

1. **OpenStreetMap `boundary=religious_administration`, `admin_level=6`
   (recommended).** An Overpass extract on 2026-07-09 returned 40 of the
   41 Latin-rite dioceses and archdioceses as full boundary polygons
   (`type=boundary`, `denomination=roman_catholic`), plus the Military
   Ordinariate (Ordynariat Polowy) and the Greek-Catholic eparchies. The
   hierarchy is complete downward too: ~5,100 parishes (level 10) and ~500
   deaneries (level 8). Diecezja sosnowiecka was the one Latin diocese not
   present at level 6 in the extract and must be verified or digitised at
   build. Vintage is current (post-2004). Licence ODbL. This is the fastest
   route to complete modern polygons and the recommended primary source.
2. **GIS-Expert (Lublin) with the KUL Centre for Research on the Historical
   Geography of the Church.** This is ISKK's own cartographic partner; the
   official dominicantes maps come from it (https://www.gis-expert.pl/mapy-religijnosci-polakow).
   The polygons are authoritative and diocese-exact, but the data are
   proprietary and not published for download; use would need permission or
   purchase. Best treated as the authority reference to validate the OSM
   geometry, and as the fallback if OSM proves incomplete.
3. **Atlas Fontium `diecezje` layer** (https://data.atlasfontium.pl/layers/geonode:diecezje).
   Full GIS formats (GeoJSON, shapefile), but these are *historical*
   (sixteenth-century) diocese boundaries — the wrong vintage for a
   modern dominicantes series. Not usable for the pilot.
4. **Wikimedia Commons diocese maps** (Category: Maps of Roman Catholic
   dioceses in Poland). Raster images only; usable as a digitisation
   reference or visual cross-check, not as polygons.
5. **GADM / geoBoundaries / civil administrative files.** Dioceses do not
   align with voivodeships, powiaty, or gminy; civil polygons therefore cannot
   approximate diocese boundaries. Useful only as a digitisation base if a
   diocese has to be drawn by hand.

**Recommendation.** Build on OSM `admin_level=6` diocese polygons (ODbL),
fill the single Sosnowiec gap by hand or from the OSM parish/deanery
members, and validate the geometry against the GIS-Expert/KUL maps and the
Annuarium diocese list. Reserve GIS-Expert as the licensed fallback.

**Extraction outcome (2026-07-10): the OSM route is BLOCKED short of a
complete layer.** Two extraction passes (flat Overpass, then recursive
super-relation assembly through the OSM API with per-diocese area gates)
established the ground truth behind the optimistic relation count: 24 of
41 dioceses have complete level-6 boundary geometry; the other 17 exist
as relations whose member deaneries are only fragmentarily mapped;
member-union assembly therefore recovers 700-2,200 km^2 of dioceses that
actually span 8,000-12,000 km^2. The union of everything assemblable covers 59% of
Poland; Sosnowiec has no boundary object at all. Artefacts preserved
under `data/raw/pl_practice/` (24-diocese partial layer
`pl_diocese_2004_partial24.geojson`, per-diocese assembly report,
relation dumps, name concordance) and the replayable assembler at
`scripts/assemble_pl_diocese_boundaries.py`. The ISKK rates lane is NOT
blocked: 2014-2024 diocese rates are transcribed with provenance in
`data/raw/pl_practice/iskk_diocese_rates.csv` (2020 = no count, COVID;
2013 not freely published). The polygon decision now sits with the PI:
(a) approach GIS-Expert/KUL for the authoritative polygons (permission or
purchase), or (b) commission a digitisation from the published raster
maps, with the 24 OSM dioceses as validation; option (c), waiting for OSM
completion, has no timeline. The pilot cannot ship a choropleth before
one of these lands.

## Years and boundary-vintage mapping

Polish diocese boundaries were reorganised twice within the ISKK series;
each attendance year must therefore join the polygons of its own era:

- **1980–1992**: the old 27-diocese configuration.
- **1992–2004**: after the bull *Totus Tuus Poloniae Populus* (1992),
  which created many new dioceses.
- **2004–present**: stable current configuration (Świdnica and Bydgoszcz
  created 2004). This is what OSM encodes.

The OSM polygons therefore join cleanly only to ISKK years from 2004
onward. A safe pilot span is the online-PDF era, roughly **2013–2024**, all
on current boundaries. Extending the series before 2004 needs period
polygons and a diocese concordance and should stay out of the first
product. State the anchor plainly: dominicantes by diocese on current
(post-2004) boundaries.

## Licence positions

- **ISKK**: dominicantes and communicantes rates are published figures in
  free public PDFs. The project shows derived rates with attribution and
  does not redistribute the source PDFs; parish-level panel data are not
  public and stay out of scope. Confirm ISKK's own reuse terms before
  publishing and attribute to ISKK by yearbook and year.
- **OSM boundaries**: ODbL. Attribution "© OpenStreetMap contributors" and
  ODbL share-alike apply to the polygon layer.
- **GUS**: published aggregate census tables are reusable with source
  attribution ("Źródło: GUS / Statistics Poland, NSP 2021"); confirm the
  current reuse statement on stat.gov.pl at build. Individual (microdata)
  sets are fee-based and not needed here.

## Denominator (honest description)

Both rates are already rates; polygons plus the published percentages therefore
suffice — no separate denominator download is required. The denominator is
*obligati*: Catholics obliged to attend Sunday Mass, i.e. the nominal
Catholic population minus those the Church excuses (children under seven,
the sick and infirm, the very elderly, travellers). Dominicantes is the
share of *obligati* physically present at Mass on the one count Sunday;
communicantes is the share receiving communion. Two honesty constraints
follow. First, describe the base as obliged Catholics, not the total
population and not all Catholics. Second, never compare the dominicantes
rate directly against the GUS affiliation share: different denominator,
different construct, different collection. The census layer is context
beside the practice layer, not the same axis.

## Open questions for the PI

1. Pilot span: adopt 2013–2024 (online Annuarium PDFs, current boundaries),
   or invest in the deeper 1980–present series with period polygons and a
   diocese concordance?
2. Is transcribing diocese tables from the annual PDFs acceptable, given no
   CSV exists, and should the English edition be the transcription source?
3. Confirm ISKK reuse terms are compatible with showing derived
   diocese-level rates with attribution.
4. Accept the OSM ODbL polygons as the shipped boundary source, or seek the
   GIS-Expert/KUL polygons for authority (and cost/permission)?
5. NSP 2011 as a second context wave, or ship 2021 voivodeship affiliation
   alone first?

## Proposed build sequence

1. Extract boundaries: pull the OSM `admin_level=6`
   `boundary=religious_administration` diocese relations for Poland via
   Overpass; verify all 41 Latin dioceses (resolve Sosnowiec); add the
   Military Ordinariate only if it is to be shown (it is non-territorial and
   overlaps every diocese; exclude it from the choropleth). Simplify and
   store at `apps/regions/pl/data/`.
2. Extract rates: transcribe diocese-level dominicantes and communicantes
   from the Annuarium PDFs for the chosen span, with recorded provenance
   and hashes per docs/data-storage-pipeline.md; cross-check against the
   Wikipedia compilation and reconcile the national totals.
3. Build the `area_summary` product per schemas/area_summary.schema.json
   with a distinct `construct` for Catholic practice, never affiliation;
   relabel metrics with `metricLabels`/`metricsAvailable` (the US card is
   the precedent) so the rate reads as "Mass attendance (dominicantes), %
   of obliged Catholics" and set `popupDenominatorNote` to the obligati
   wording.
4. Build the context layer: GUS NSP 2021 affiliation by voivodeship as a
   separate level with its own boundaries and its own construct.
5. Write the region page per docs/development/adding-a-region.md; join key
   is the diocese name (ISKK Polish name to OSM `name`) — build a name
   concordance, since diacritics and word order differ.
6. Verify: national ISKK totals against the summed diocese figures, join
   coverage 41/41, and every attribution and licence string (ISKK, OSM
   ODbL, GUS).
