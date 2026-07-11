# Pakistan district boundary probe (2023 census Table 9 frame)

Probed 2026-07-11 (probe-only; no boundary product built, nothing committed). The census-religion data product ships staged with the boundary lane held as its only blocker: geoBoundaries gbOpen PAK ADM2 (126 districts, 2019) under-counts the 2023 frame and carries no explicit licence string, and gbOpen PAK ADM3 (554 tehsils, 2017, ODbL) is vintage-misaligned to the 2023 district roster. This probe tests four candidate routes for a licensed district layer that matches the 136-unit Table 9 tabulation frame (KP 34 districts + Malakand Protected Area = 35; Punjab 36; Sindh 30; Balochistan 34; ICT 1). One route clears both gates.

## Verdict

**RECOMMENDED ROUTE: OCHA COD-AB PAK on HDX (`cod-ab-pak`), admin level 2.** It carries an explicit, permissive licence (Creative Commons Attribution 3.0 IGO), and its ADM2 layer aligns 1:1 with 135 of the 136 census Table 9 units, with a single documented gap (Keamari District, Sindh). The geoBoundaries `gbHumanitarian` ADM2 release is the same WFP-SDI/HDX data mirrored under a second CC BY 3.0 IGO statement, so it corroborates the licence from an independent source and offers an alternative download. The other two routes fail: PBS publishes no downloadable district geodata, and the WFP/FAO GeoHub lineage collapses into the same COD already found on HDX.

The COD-AB ADM2 layer resolves the licence blocker outright (explicit CC BY 3.0 IGO, versus the unresolved public-domain pointer on gbOpen ADM2) and very nearly resolves the roster blocker (135/136). The residual work is a name-key crosswalk (roughly ten spelling/word-order variants) and a project-lead decision on the single Keamari gap. Under the render-the-record rule this probe reports the gap exactly and proposes no invented split or merge.

## Route-by-route findings

| Route | Layer | Vintage | Units | Licence (verbatim, with URL) | Roster alignment | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1. OCHA COD-AB on HDX | `cod-ab-pak` ADM2 | COD v01, valid 2022-09-09; reviewed 2024-09-27 | 160 ADM2 (incl. AJK 10 + GB 14 out of scope) | CC BY-IGO (see below) | 135/136 matched; gap = Keamari | **RECOMMENDED** |
| 2. PBS GIS outputs | pbs.gov.pk/gis | 2023 | n/a | none stated for geodata | no geodata offered | NO-ROUTE (no downloadable geometry) |
| 3. geoBoundaries gbHumanitarian ADM2 | `PAK-ADM2-19695364` | 2022 | 160 | CC BY 3.0 IGO (see below) | same data as route 1 | USE AS MIRROR / licence corroboration |
| 3b. geoBoundaries gbAuthoritative ADM2 | — | — | — | — | — | DOES NOT EXIST (API 404) |
| 4. WFP/FAO/UN GeoHub mirror | WFP SDI | 2022 | 160 | (is the COD source) | identical to route 1 | COLLAPSES INTO ROUTE 1 |

### Route 1 — OCHA COD-AB PAK on HDX (RECOMMENDED)

The HDX dataset `cod-ab-pak` ("Pakistan - Subnational Administrative Boundaries") is the UN Common Operational Dataset for administrative boundaries, quality-assured and published by OCHA Field Information Services from the World Food Programme Spatial Data Infrastructure. Its structure, from the dataset notes verbatim: "Admin 1: 7 Province or Territory", "Admin 2: 160 District", "Admin 3: 577 Tehsil"; "09 September 2022: valid for use by the humanitarian community"; "27 September 2024: dataset reviewed for accuracy and completeness". The ADM2 attribute table (`pak_admin_boundaries.xlsx`, `cod_version` = `V_01`, `valid_on` = 2022-09-09) confirms 160 ADM2 rows with `PK5xx`/`PK6xx`/`PK7xx`/`PK2xx`/`PK4xx` P-codes.

Licence, quoted verbatim from the HDX CKAN API (`https://data.humdata.org/api/3/action/package_show?id=cod-ab-pak`):

> `"license_id": "cc-by-igo"`, `"license_title": "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)"`, `"license_url": "http://creativecommons.org/licenses/by/3.0/igo/legalcode"`, `"dataset_source": "World Food Programme SDI"`, `"organization": "OCHA Field Information Services Section (FISS)"`.

CC BY 3.0 IGO is a permissive attribution licence; use requires crediting OCHA/WFP. This is the load-bearing improvement over the held gbOpen ADM2 layer, whose release metadata carried only a public-domain pointer and no explicit licence string. Downloads are offered as Geodatabase, Shapefile, GeoJSON, and XLSX (attribute table); the geometry download (shp/geojson) was not pulled in this probe because the attribute table alone answers the roster question.

### Route 2 — PBS GIS outputs (NO-ROUTE for geometry)

The PBS GIS page (`https://www.pbs.gov.pk/gis/`) documents that PBS "prepared various layers using ArcGIS techniques for administrative and census boundaries" for the 2023 census, but offers no downloadable geodata. The page links only PDF reference tables (Administrative Units 2023, Delimitation Plan 2023, List of Administrative Districts 2023, Number of Census Areas 2023, Urban Areas 2023) and states no geodata licence. The census dashboards (`psi.pbos.gov.pk`, `census23.pbos.gov.pk`) are JS-rendered interactive viewers, not downloadable licensed geodata — recorded here as a byte-match gap (no served geometry file to hash). PBS therefore supplies no district geometry with stated terms; the only PBS artefacts are the Table 9 PDFs (census counts, already cached) and PDF admin lists.

### Route 3 — geoBoundaries gbHumanitarian / gbAuthoritative ADM2

The geoBoundaries `gbHumanitarian` PAK ADM2 release (`PAK-ADM2-19695364`, `boundaryYearRepresented` 2022, `admUnitCount` 160) is the same COD data mirrored by geoBoundaries. Its release metadata carries the licence verbatim (`https://www.geoboundaries.org/api/current/gbHumanitarian/PAK/ADM2/`):

> `"boundaryLicense": "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)"`, `"boundarySource": "World Food Programme SDI, HDX"`, `"licenseSource": "data.humdata.org/dataset/cod-ab-pak"`, `"boundarySourceURL": "data.humdata.org/dataset/cod-ab-pak"`.

This independently corroborates route 1's licence and offers ready GeoJSON/TopoJSON downloads (`.../gbHumanitarian/PAK/ADM2/geoBoundaries-PAK-ADM2.geojson`). The `gbAuthoritative` PAK ADM2 release does NOT exist — `https://www.geoboundaries.org/api/current/gbAuthoritative/PAK/ADM2/` returns HTTP 404. So the choice is `gbHumanitarian` (this COD mirror, CC BY 3.0 IGO) or the direct HDX download; both are the same 160-unit, 2022 WFP-SDI geometry. The `gbOpen` ADM2 layer (126 units, 2019, unresolved licence) remains rejected and is superseded by this route.

### Route 4 — WFP/FAO/UN GeoHub mirror (collapses into route 1)

The COD's stated source is the World Food Programme SDI, so a WFP/FAO GeoHub copy is the same lineage, not a fresher independent edition. No public edition newer than the HDX COD v01 (valid 2022, reviewed 2024-09-27) that resolves the Keamari gap was found. Route 4 requires no separate action; use the HDX or geoBoundaries download.

## Exact roster alignment against the 136-unit Table 9 frame

Comparison is the COD-AB ADM2 four-provinces + ICT subset (160 units minus AJK 10 and GB 14 = 136 in-scope units) against the 136 census Table 9 units. The two totals coincide at 136, but the per-province composition differs and must be reconciled unit by unit.

| Province | Census Table 9 units | COD-AB ADM2 (in scope) | Matched 1:1 | Discrepancy |
| --- | --- | --- | --- | --- |
| Khyber Pakhtunkhwa | 35 (34 districts + Malakand PA) | 35 | 35 | none (name variants + Malakand caveat) |
| Punjab | 36 | 36 | 36 | none (Layyah/Leiah variant) |
| Sindh | 30 | 29 | 29 | **census `sd-keamari` has no COD polygon** |
| Balochistan | 34 | 35 | 34 | COD phantom `Lehri` (abolished 2018) to drop |
| ICT | 1 | 1 | 1 | none |
| **Total** | **136** | **136** | **135** | **1 gap (Keamari)** |

**Net result: 135 of 136 census units map 1:1 to a COD-AB ADM2 polygon. One census unit (Keamari) has no COD counterpart. COD carries one in-scope phantom (Lehri) plus 24 out-of-scope units (AJK 10, GB 14) to drop.**

### The single true gap — Keamari District (Sindh)

The census 2023 Table 9 frame enumerates seven Karachi districts (Central, East, South, West, Korangi, Malir, and Keamari); COD-AB v01 carries only six, with Keamari's territory still inside West Karachi. Keamari District was created on 21 August 2020 (notified early September 2020) by carving the SITE, Baldia, Keamari, and Mauripur sub-divisions out of Karachi West (`https://www.dawn.com/news/1575499`; `https://en.wikipedia.org/wiki/Keamari_District`). The COD-AB roster, frozen at a pre-2020 Karachi state in this spot, does not reflect the split, so the census Keamari cannot be recovered from COD geometry — COD's West Karachi polygon covers both the census Karachi West and Keamari. This is a project-lead decision, not a probe resolution: render 135 units with geometry and flag Keamari (null geometry, or shown fused with Karachi West), or source a post-2020 Karachi-West-split polygon from another licensed layer. The probe proposes no invented split.

### Resolved apparent mismatches (name variants and COD phantom)

- **Balochistan `Surab` ↔ COD `Shaheed Sikandarabad`**: the same district under its dual official name, "Shaheed Sikandarabad (Surab) District", created 2017 from Kalat (`https://en.wikipedia.org/wiki/Surab_District`). This is a name-variant match, not a gap.
- **COD `Lehri` (Balochistan)**: a phantom. Lehri District was created May 2013 from Sibi and Kachhi, then abolished January 2018 and reannexed into Sibi and Kachhi (`https://en.wikipedia.org/wiki/Lehri_District`). The census 2023 correctly omits it; COD-AB v01 retains it. To reproduce the census Sibi/Kachhi footprints, COD Lehri dissolves back into them (an obvious dissolve, flagged not performed).
- **KP `Malakand Protected Area` ↔ COD `Malakand` (District)**: a status/label difference over the same footprint (the Malakand PATA / Malakand District, ~906 km2). Treat as a matched unit; confirm coincidence visually before build.
- **Spelling / word-order variants** requiring a crosswalk key (not automatic string equality): Dera Ismail Khan ↔ `D. I. Khan`; Lower/Upper Chitral ↔ `Chitral Lower`/`Chitral Upper`; Lower/Upper Kohistan ↔ `Kohistan Lower`/`Kohistan Upper`; Torghar ↔ `Tor Ghar`; Layyah ↔ `Leiah`; the four Karachi units word-flipped (`Central Karachi` etc.); Shaheed Benazirabad ↔ `Shaheed Benazir Abad`; Umer Kot ↔ `Umer Kot`.

All former-FATA KP districts (Bajaur, Khyber, Kurram, Mohmand, Orakzai, North Waziristan, South Waziristan) are present in COD-AB as KP districts, matching the post-2018-merger census frame; South Waziristan is a single unit in both. The likely misalignment points named in the task brief (Malakand PA, former-FATA districts, post-2019 Sindh/Balochistan splits) therefore reduce to: Malakand (matched, label caveat), FATA (all matched), Keamari (the one gap), and the Surab/Shaheed Sikandarabad and Lehri naming/vintage artefacts (resolved above).

## Recommended next step (for the conductor / project lead)

Adopt the COD-AB PAK ADM2 layer (via HDX `cod-ab-pak` or the geoBoundaries `gbHumanitarian` mirror), attribute to OCHA/WFP under CC BY 3.0 IGO, drop the 24 AJK+GB units and the Lehri phantom, build and verify the ~10-entry name crosswalk to the census `area_code`s, and rule on the single Keamari gap. That clears the boundary blocker for 135 of 136 units on an explicitly licensed layer. The tehsil-level alternative (COD-AB ADM3, 577 tehsils, same CC BY 3.0 IGO) is available if a finer product is later wanted, but the district product needs only ADM2.

## Retrieval record (cached, git-ignored under `data/raw/pk_census/`)

Content type verified on each download (JSON and Microsoft Excel 2007+; no WordPress-fallback HTML captured).

| Cached capture | Source URL | SHA-256 |
| --- | --- | --- |
| `hdx_cod_ab_pak_package_show.json` | `https://data.humdata.org/api/3/action/package_show?id=cod-ab-pak` | `16bd275fee253b29591414bd5bc01c0a330f9bb11ab60fa1f41785d944f93520` |
| `gb_pak_adm2_humanitarian_meta.json` | `https://www.geoboundaries.org/api/current/gbHumanitarian/PAK/ADM2/` | `eec8518af067cd326f3eae05176314f6ce9c2c6025bbe7e5da84ccf92a15d263` |
| `cod_ab_pak_admin_boundaries.xlsx` | `https://data.humdata.org/dataset/a64d1ff2-7158-48c7-887d-6af69ce21906/resource/f0b98d07-efd4-4020-ae47-2779b817c01d/download/pak_admin_boundaries.xlsx` | `a8449748db5122051fc3d23b7dc6f43af8783c8c64e9b20422220a0a7c764caf` |

Byte-match gaps (no hashable geometry served): PBS GIS page (PDF tables only, no geodata); PBS/PSI census dashboards (JS-rendered viewers); geoBoundaries `gbAuthoritative` PAK ADM2 (HTTP 404, release does not exist).
