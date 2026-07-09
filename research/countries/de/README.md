# Country data map: Germany (DE)

## Status

- **Tier**: B
- **Build state**: Built at Kreis level for Zensus 2011 and Zensus 2022 compact legal-membership religion tables.
- **Last verified**: 2026-07-10

## Built products

| Product | Unit | Waves | Notes |
| --- | --- | --- | --- |
| `apps/regions/de/data/area_summary_kreis.json` | Kreis | 2011, 2022 | Main area-summary product, 812 rows across the two period geographies. |
| `apps/regions/de/data/area_summary_kreis.csv` | Kreis | 2011, 2022 | Tabular companion for inspection and reuse. |
| `apps/regions/de/data/de_kreis_2011.geojson` | Kreis | 2011 | BKG VG250 Kreis boundaries for the 9 May 2011 Zensus geography; 412 features. |
| `apps/regions/de/data/de_kreis_2022.geojson` | Kreis | 2022 | BKG VG250 Kreis boundaries for the 15 May 2022 Zensus geography; 400 features. |
| `docs/manifests/de-census-religion-2011-2022.json` | Manifest | 2011, 2022 | Source, licence, category, validation, and geography notes. |

## Religious data over time

| Source | Construct | Smallest public unit used | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Zensus 2011 results database](https://ergebnisse.zensus2011.de/) table `1000X-1014` | Legal membership in public-law religious societies (`RELZG2`) | Kreis (`GEOLK1`) | 2011 | Zensusdatenbank flat CSV export | Open web | German statistical offices; reuse terms need case-specific review |
| [Zensus 2022 results database](https://ergebnisse.zensus2022.de/) table `1000A-1018` | Legal membership in public-law religious societies (`RELZG2`) | Kreis (`GEOLK4`) | 2022 | Zensusdatenbank API JSON | Open web | German statistical offices; reuse terms need case-specific review |
| [EKD church-membership statistics](https://www.ekd.de/statistik-kirchenmitglieder-17279.htm) | Protestant church administrative membership | Regional church / Land series | Annual long-running series | HTML/PDF | Open web | EKD website terms |
| [German Bishops' Conference church statistics](https://www.dbk.de/presse/kirchenstatistik-2024) | Catholic church administrative membership | Diocese | Annual long-running series | HTML/PDF | Open web | DBK website terms |

## Category mapping

| Zensus code | Source label | Map treatment |
| --- | --- | --- |
| `REL-EV-OR` | Evangelische Kirche (öffentlich-rechtlich) | Counts toward `religious_affiliation_count`. |
| `REL-RK-OR` | Römisch-katholische Kirche (öffentlich-rechtlich) | Counts toward `religious_affiliation_count`. |
| `REL-SONST-X` | Sonstige, keine, ohne Angabe | Kept out of `religious_affiliation_count`; no-religion fields stay null because other religion, no public-law membership, and no response are combined. |

The built construct is legal membership in public-law religious societies. The voluntary 2011 faith item is excluded; the metric does not measure belief, practice, or attendance.

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [BKG VG250 annual archive](https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/) | Kreis | The 2011 product uses the main `de1101` Kreis layer because table `1000X-1014` is dated 9 May 2011, before the September 2011 Mecklenburg-Vorpommern reform. The 2022 product uses the 2022 VG250 Kreis layer for the 15 May 2022 Zensus geography. |

BKG boundaries are attributed as `© GeoBasis-DE / BKG` under `dl-de/by-2-0`.

## Geography and reconciliation

The two Zensus waves ship on their own Kreis vintages. The 2011 table has
412 `GEOLK1` rows on the 9 May 2011 territory; the 2022 table has 400
`GEOLK4` rows on the 15 May 2022 territory. Separate boundary sets avoid
cross-vintage aggregation across Mecklenburg-Vorpommern's September 2011
reform, the 2016 Goettingen merger, the 2021 Eisenach change, and other
Kreis-set changes.

Regional sums do not exactly match the published Deutschland rows. The
tested regional routes use `PRS018`, and the tested Deutschland routes use
`PRS001`; Zensus metadata entries label both codes as Persons. The code
difference is an observation rather than an explanation. The
metadata-supported explanation is that Deutschland totals include persons
assignable to no Kreis, including German personnel stationed abroad, and that
the Zensus results database documents subpopulation non-additivity. The build
preserves the regional source counts and records the source residuals in the
manifest. The 2011
regional sums differ from the Deutschland `PRS001` row by -9,698 persons on
total population, +17 Protestant, -6 Catholic, and -9,662 residual. The 2022
regional sums differ by -8,258 persons on total population, +4 Protestant,
+10 Catholic, and -8,258 residual. The Protestant and Catholic regional sums
match the Deutschland rows within ±17 persons, which supports category
integrity.

## Access the data yourself

For Zensus 2022, open the Zensusdatenbank and search for table `1000A-1018`.
Select `Landkreise u. krsfr. Städte (Stand 15.05.22)` / `GEOLK4` and the
`RELZG2` legal-membership categories.

For Zensus 2011, open the Zensus 2011 results database and search for table
`1000X-1014`. Select `Landkreise und kreisfreie Städte` / `GEOLK1`, export
the flat CSV, and use the `RELZG2` legal-membership categories.

For boundaries, download the BKG VG250 annual archive for 2011 and 2022 from the `vg250_ebenen_0101` product series, then use the Kreis layer matching each Zensus geography date.

## Places-of-worship layer

No governed Germany OpenStreetMap place-of-worship snapshot is included in
this country data-map release. Place-density metrics are null until a
separate site layer is built and reviewed.

## Deep-history potential

High. Imperial and Weimar census volumes, state statistical yearbooks, parish
registers, diocesan archives, Protestant regional-church archives, synagogue
community records, and municipal address books can support deeper site
histories.
