# Pulotu culture units against the polygon frame — geography notes

Status: EXPLORATION (2026-07-11). Facts and options only; no chosen design. Prepared for the Pulotu design work. Out of scope by instruction: design recommendations, `apps/` edits, builders, manifests, CHANGELOG, the queue doc.

## Provenance and licence (verified, not assumed)

- Dataset: Pulotu, Database of Austronesian Religions, D-PLACE CLDF edition v1.3.1. Fetched from `github.com/D-PLACE/dplace-dataset-pulotu` (`cldf/` tree) on 2026-07-11 and cached under `data/raw/pulotu/` (my files carry a `pulotu_` prefix to avoid clobbering the concurrent data-profile lane's `dplace-dataset-pulotu-1.3.1/` extraction and `pulotu-v1.3.1.zip`).
- Licence: **CC BY 4.0**, verified in three places — `cldf/StructureDataset-metadata.json` `dc:license = https://creativecommons.org/licenses/by/4.0/`, `metadata.json` `license: CC-BY-4.0`, and a full CC BY 4.0 `LICENSE` file. Attribution and commercial reuse both permitted with attribution.
- Citation: Watts, Sheehan, Greenhill, Gomes-Ng, Atkinson, **Bulbulia**, Gray (2015), PLoS ONE 10(9), DOI 10.1371/journal.pone.0136783. The project lead is a Pulotu co-author.
- Geometry: **points only**. `cldf/societies.csv` carries one `Latitude`/`Longitude` per society and a `Glottocode`; there are no polygon, shapefile, or geometry fields anywhere in the dataset. This is the same point-only model D-PLACE uses for all societies.
- Scope: 137 societies with coordinates span the whole Austronesian world (Taiwan, island SE Asia, Madagascar, Melanesia, Micronesia, Polynesia). Only a minority sit in the project's shipped/staged Pacific country products; the rest (e.g. Batak, Iban, Toraja, Merina) fall thousands of km outside every current product and are listed here only where a wide bounding box produced a false hit.

## Method for the overlap tables

Ray-casting point-in-polygon of each society's Pulotu coordinate against each country product's GeoJSON. Pulotu coordinates are society centroids often placed just offshore of small islands, so a point frequently falls in ocean outside the land polygon; where it does, the table reports the nearest polygon by centroid distance (great-circle, cos-lat corrected) so the intended island is still identifiable. Distances under ~20 km are the same island; distances of hundreds of km are a different country caught only by a padded bounding box and are flagged as intruders, not members.

---

## 1. Concrete overlap per country product

### Tonga (`to/`, `to_district_2020.geojson`, 23 districts) — pilot

| Pulotu id | Name | Coord (lat,lon) | Glottocode | Polygon relation |
|---|---|---|---|---|
| `tonga` | Tonga | -21.20, -175.20 | tong1325 | IN district **Vaini** (Tongatapu) |

One Pulotu culture for the entire kingdom. It resolves to a single point in one Tongatapu district, but it **represents the WHOLE country**, not that district. Cardinality: 1 culture → whole country; 22 of 23 districts carry no Pulotu point.

### Vanuatu (`vu/`, `adm1_2020.geojson` 6 provinces, `adm2_2020.geojson` 65 area councils) — pilot

Nine societies are genuinely Vanuatu. Each is a single island or island-group culture. Note the two-level behaviour: at province (adm1) level several cultures collapse into one polygon; at area-council (adm2) level each culture maps to a distinct polygon.

| Pulotu id | Name | Coord | Glotto | adm1 province | adm2 area council | Fit note |
|---|---|---|---|---|---|---|
| `tanna` | Tanna | -19.50,169.40 | kwam1252 | Tafea | IN **Whitesands** | on-island |
| `aneityum` | Aneityum | -20.20,169.80 | anei1239 | Tafea | IN **Aneityum** | on-island |
| `erromango` | Erromango | -18.80,169.20 | urav1235 | Tafea | IN **North Erromango** | on-island |
| `futuna-west` | Futuna-Aniwa | -19.50,170.20 | *(empty)* | Tafea (nearest) | nearest **Futuna** (~4 km) | offshore point |
| `Seniang` | Seniang | -16.50,167.40 | sout2857 | Malampa (nearest) | nearest **South West Malekula** (~14 km) | SW Malekula culture |
| `small_islands` | Small Islands | -16.10,167.50 | moro1286 | Malampa (nearest) | nearest **Central Malekula** (~9 km) | Vao/Wala/Rano/Atchin islets |
| `nguna` | Nguna | -17.40,168.40 | nort2836 | Shefa (nearest) | nearest **Nguna** (~8 km) | offshore point |
| `south_pentecost` | South Pentecost | -15.90,168.20 | saaa1241 | Penama | IN **South Pentecost** | on-island |
| `mota` | Mota | -13.80,167.70 | mota1237 | Torba (nearest) | nearest **Mota** (~5 km) | Banks Islands |

Cardinality inside Vanuatu:
- **Province (adm1) level: several cultures per polygon.** Tafea province alone holds four Pulotu cultures (Tanna, Aneityum, Erromango, Futuna-Aniwa); Malampa holds two (Seniang, Small Islands). Six adm1 polygons, at most four of which carry Pulotu points; none of the nine cultures spans several provinces.
- **Area-council (adm2) level: one culture per polygon.** Each of the nine maps to a single distinct area council out of 65. No Pulotu culture spans several area councils; ~56 of 65 councils carry no Pulotu point.

Intruders excluded (caught only by a 1° bounding-box pad, then rejected on distance): `lifou` (-21.0,167.2, Lifou/Dehu, New Caledonia Loyalty Islands, ~274 km to nearest VU polygon), `mare` (New Caledonia), `tikopia` (-12.3,168.8, Solomon Islands Temotu, ~184 km). These are not Vanuatu and must not be summarised onto VU polygons.

### Fiji (`fj/`, `fj_province_2020.geojson`, 15 provinces)

Fiji straddles the antimeridian, so its union bounding box spans the globe and produced many false hits; only two societies are actually Fijian.

| Pulotu id | Name | Coord | Glotto | Polygon relation |
|---|---|---|---|---|
| `fijians` | Fijians (I-Taukei) | -17.80,178.00 | west2519 | IN province **Nadroga/Navosa**; represents the WHOLE main-group nation |
| `rotuma` | Rotuma | -12.50,177.10 | rotu1241 | IN province **Rotuma** |

Cardinality: two cultures. `fijians` is one culture for the whole I-Taukei nation (whole-country roll-up), resolving to one point in one province; `rotuma` is a distinct culture that coincides exactly with the single Rotuma province (1 culture → 1 polygon). Fourteen of fifteen provinces carry no distinct Pulotu culture. Every other society the padded box flagged (Tonga, Samoa, New Caledonia, Vanuatu, Madagascar, etc.) is thousands of km away and not Fijian.

### Samoa (`ws/`, `area_summary_constituency` — no geometry)

| Pulotu id | Name | Coord | Glotto | Polygon relation |
|---|---|---|---|---|
| `samoan` | Samoa | -13.90,-171.80 | samo1305 | no polygon layer exists to test against |

One Pulotu culture for the country. Samoa ships a constituency summary with **no GeoJSON**, so there is no polygon to map onto at all; the only available spatial rendering for `samoan` is a point or a whole-country roll-up. Cardinality: 1 culture → whole country, geometry absent.

### Tokelau (`tk/`, `tk_atoll_2022.geojson`, 3 atolls)

| Pulotu id | Name | Coord | Glotto | Polygon relation |
|---|---|---|---|---|
| `tokelau` | Tokelau | -9.40,-171.20 | toke1240 | nearest atoll **Fakaofo** (~3 km, offshore point) |

One culture for the territory. Point sits ~3 km off Fakaofo. Cardinality: 1 culture → whole country (3 atolls); it does not distinguish Atafu/Nukunonu/Fakaofo.

### Kiribati (`ki/`, `ki_island_2017.geojson`, 24 islands)

| Pulotu id | Name | Coord | Glotto | Polygon relation |
|---|---|---|---|---|
| `kiribati` | Kiribati (I-Kiribati) | -1.20,174.70 | gilb1244 | nearest island **North Tabiteuea** (~3 km, offshore point) |

One culture for the nation. Every other society the wide (176E to -171) box flagged is island SE Asia (Batak, Iban, Toraja, Dayak, Nias, etc.), thousands of km away, not Kiribati. Cardinality: 1 culture → whole country (24 islands).

### Micronesia — FSM (`fm/`, `fm_state_2019.geojson`, 4 states)

FSM is the one multi-state product with real internal Pulotu structure, but the cultures do not align to the four-state frame one-to-one.

| Pulotu id | Name | Coord | Glotto | State relation |
|---|---|---|---|---|
| `yap` | Yap | 9.50,138.10 | yape1248 | IN **Yap** state |
| `Pohnpei` | Pohnpei | 6.90,158.20 | pohn1238 | IN **Pohnpei** state |
| `kosrae` | Kosrae | 5.30,163.00 | kosr1238 | IN **Kosrae** state |
| `chuuk` | Chuuk | 7.30,151.60 | chuu1238 | nearest **Chuuk** state (~21 km, offshore point) |
| `ulithi` | Ulithi | 10.10,139.70 | ulit1238 | outer island of **Yap** state (~339 km from Yap centroid) |
| `ifaluk` | Ifaluk | 7.20,144.50 | wole1240 | outer island of **Yap** state (~279 km) |
| `nukuoro` | Nukuoro | 3.80,155.00 | nuku1260 | Polynesian-outlier atoll in **Pohnpei** state (~310 km) |
| `kapingamarangi` | Kapingamarangi | 1.00,154.80 | kapi1249 | Polynesian-outlier atoll in **Pohnpei** state (~493 km) |

Cardinality inside FSM: eight cultures, four states. Four cultures match a state one-to-one (Yap, Pohnpei, Kosrae, Chuuk — the last ~21 km offshore). The other four are **sub-state**: Ulithi and Ifaluk are separate cultures inside Yap state, and Nukuoro and Kapingamarangi are separate Polynesian-outlier cultures inside Pohnpei state. So two of the four states each carry three Pulotu cultures, and no single aggregation onto the four-state frame is lossless.

### Palau (`pw/`, `pw_state_2017.geojson`, 16 states)

| Pulotu id | Name | Coord | Glotto | Polygon relation |
|---|---|---|---|---|
| `palau` | Palau | 7.40,134.60 | pala1344 | nearest state **Airai** (~6 km, offshore point) |

One culture for the nation across sixteen states. Cardinality: 1 culture → whole country. (Palau's own census note: the 2005 wave has a real None/refused category and is a documented boundary case in the minority-share design; unrelated to Pulotu geometry but relevant if a Pulotu construct were ever slotted alongside census metrics here.)

### Nauru (`nr/`, `nr_adm0_2005.geojson`, 1 national polygon)

**Zero Pulotu societies.** Nauruan is Micronesian but is not sampled in Pulotu. No overlap at any cardinality.

### Tuvalu (`tv/`, `tv_region_2017.geojson`, 2 regions)

**Zero Pulotu societies.** Tuvalu is Polynesian but is not sampled in Pulotu. No overlap. (Nearby Polynesian cultures that Pulotu does hold — `tokelau`, `rotuma`, `samoan`, `uvea`, `futuna` — all sit in other countries.)

### Overlap summary

| Country | Product polys | Pulotu cultures | Dominant cardinality |
|---|---|---|---|
| Tonga | 23 districts | 1 | 1 → whole country |
| Vanuatu | 6 prov / 65 councils | 9 | several per province; 1 per area council |
| Fiji | 15 provinces | 2 | 1 whole-nation + 1 that equals Rotuma province |
| Samoa | constituencies, no geometry | 1 | 1 → whole country, no polygons |
| Tokelau | 3 atolls | 1 | 1 → whole country |
| Kiribati | 24 islands | 1 | 1 → whole country |
| FSM | 4 states | 8 | 4 match a state; 4 are sub-state outer islands |
| Palau | 16 states | 1 | 1 → whole country |
| Nauru | 1 national | 0 | no overlap |
| Tuvalu | 2 regions | 0 | no overlap |

The recurring shape: for most Pacific states Pulotu carries exactly one whole-nation culture that resolves to a single arbitrary polygon; Vanuatu and FSM are the exceptions with genuine intra-country structure, and only Vanuatu's finest level (area councils) gives a clean one-culture-per-polygon map.

---

## 2. Representation options — prerequisites, costs, losses

Each option below is stated as a fact set, not a recommendation. Pulotu meaning that can be lost: the society is a *reconstruction at a named time focus* of a *belief/practice profile* (88 coded variables), attached to a *point*, not an areal claim.

### (a) Point markers at culture coordinates (a dated-places-like layer)

- Prerequisites: society coordinates (present), a start year per marker (Pulotu's Traditional State Time Focus supplies one — see §3), and the runtime's existing dated-places rendering. Offshore points must be accepted as-is or nudged onto land.
- Cost: one GeoJSON of ~137 points (or the ~24 genuinely inside shipped Pacific products); no new geometry authored; joins to the existing `dated_places` machinery.
- What survives: the exact Pulotu spatial semantics — a point standing for a society, no false areal extent. Per-society variable values and the time focus attach naturally to the marker popup. Sub-state structure (Ulithi vs Yap, Nukuoro vs Pohnpei) is preserved because each is its own point.
- What is lost: nothing of Pulotu's own model; the loss is only that a point cannot answer "which share of area X holds belief Y" — it makes no areal or per-capita claim, by design.

### (b) Culture values summarised onto existing census polygons

- Prerequisites: an assignment of each society to a polygon (the §1 tables), plus an **explicit aggregation rule** for the two mismatch directions, plus a declared construct per metric slot.
- Aggregation rule when several cultures share one polygon (Tafea holds 4; Malampa 2; FSM's Yap and Pohnpei states hold 3 each): a choice is forced — mode, first-listed, count, or "multiple (n)" — and any single-value choropleth colour for that polygon discards the others. Categorical Pulotu variables have no natural mean.
- Aggregation rule when one culture spans several polygons (every whole-country culture: Tonga, Samoa, Tokelau, Kiribati, Palau, Fiji-main): the value must be broadcast to all polygons of the country, which paints the whole country one colour and asserts uniformity Pulotu never measured at sub-national level.
- What survives: a familiar choropleth that reuses the census renderer and the two-slot metric machinery.
- What is lost: the point-level truth. A whole-nation culture broadcast to 23 Tongan districts fabricates 23 areal readings from one reconstruction; a several-cultures-per-polygon collapse hides the very intra-country diversity (Tafea, FSM outer islands) that is Pulotu's spatial signal. The reconstruction's time focus (a single historical year per society) also fights the census choropleth's year semantics (§3).

### (c) Dedicated culture-area polygons

- Do authoritative Pacific culture/language-area polygons exist? **One serious candidate found, licence verified.**
  - **Wurm & Hattori, Language Atlas of the Pacific Area, revised digital edition** (Nature Scientific Data 2024; ECAI digitisation). CLDF dataset at `github.com/cldf-datasets/languageatlasofthepacificarea`, archived Zenodo DOI 10.5281/zenodo.12543015. Provides GeoJSON speaker-area MultiPolygons for **1,769 Pacific languages**, at feature, language, and family aggregation, each carrying a Glottocode via `cldf:languageReference`.
  - **Licence (verified, not assumed): `CC-BY-NC-4.0`** — read verbatim from the repo's `metadata.json` `license` field; the GitHub API reports `NOASSERTION` for the repo as a whole. The **non-commercial** clause is the operative constraint and differs from Pulotu's own CC BY 4.0. The paper's prose ("ECAI released the data allowing derived works") does not override the machine-readable NC field; treat the layer as NC until a rights holder says otherwise.
  - Glottolog itself distributes **points, not polygons** (verified against the Glottolog data model). `cldf/cldfgeojson` is tooling for antimeridian-safe GeoJSON, not a polygon dataset; it references Glottolog for coordinate validation and Rantanen's Uralic database as an example, and is Apache-2.0 code, not a Pacific culture layer.
- Prerequisites if the Wurm & Hattori layer were used: a **glottocode join** from Pulotu societies to language polygons, plus resolution of the NC licence against the project's use, plus reconciliation of language-area vs culture-area (they are not the same construct).
- Join quality caveat (measured): the glottocode key is imperfect for Pulotu. Three glottocodes are shared by two societies each — `raro1241` (Rarotonga + Mangaia), `renn1242` (Rennell + Bellona), `plat1254` (Merina + Tanala) — so those societies cannot be separated by glottocode; and eight societies have an **empty** glottocode, including the Vanuatu pilot society `futuna-west` (Futuna-Aniwa). A glottocode join therefore silently drops or merges these.
- What survives: a true areal extent, and a defensible "minimum boundary of an edge" reading if language area is accepted as a proxy for culture area.
- What is lost: Pulotu's construct is a *religious-culture reconstruction at a point*, not a language territory; language area over- or under-states it. The NC licence constrains reuse. And no polygon exists for a Pulotu society lacking a matched glottocode.

### (d) Whole-country roll-up

- Prerequisites: the country's single national polygon (present for Nauru; derivable elsewhere), and a rule for countries with more than one culture (Fiji 2, Vanuatu 9, FSM 8).
- What survives: correct for the many one-culture nations (Tonga, Samoa, Tokelau, Kiribati, Palau) — it makes exactly the claim Pulotu supports, "this reconstruction is of this country".
- What is lost: everything sub-national. It erases Vanuatu's nine-island differentiation and FSM's eight cultures, and it has nothing to say where a country holds two cultures without an extra rule (Fiji main-group vs Rotuma).

---

## 3. Temporal dimension and its spatial consequence

Pulotu codes each society at **two explicit time foci**, both stored as calendar years in `data.csv`:

- **Traditional State Time Focus** (variable id 1): the ethnographic reconstruction year, "the earliest that allows a detailed reconstruction of the indigenous religion", typically near first sustained missionary/European contact. Across all 137 societies these years range **1521 to 1983, median 1895**. Pilot values: Tonga 1810; Vanuatu 1774 (Tanna) to 1914 (Small Islands); Fiji 1840 (Fijians), 1839 (Rotuma); FSM 1824 (Kosrae) to 1947 (Ifaluk).
- **Contemporary Time Focus** (variable id 82): "as recent and narrow as practical", overwhelmingly **2014** for the Pacific societies (a handful null, e.g. Nguna, Rotuma, Nukuoro).

What the runtime can already express (from `apps/regions/_shared/region-map.js` and `docs/development/temporal-place-layer.md`):

- **Era-based level switching.** `RC.timeline = [{year, level}, ...]` (region-map.js ~L2914-2942) lets one slider span eras that live on different boundary vintages and auto-switch geography level as the year crosses an era boundary (the US 1850-2020 across six county vintages is the worked example). Pulotu has no analogous multi-vintage boundary series, so this mechanism is not the natural fit for it.
- **Dated places with start/end years.** The normative historical-points standard (temporal-place-layer.md L8-67): a `dated_places.geojson` feature renders for selected year Y iff `start_year` present and `start_year <= Y` and (`end_year` absent/null or `end_year >= Y`). Modes `period`/`all`/`off`; a prospective "later foundations" tier renders `start_year > Y`. This is a per-feature interval model keyed to the same year slider.

Where Pulotu does and does not fit that model:

- **Fits the dated-places interval model as two snapshots, not a continuum.** Each society naturally yields a marker with `start_year` = its Traditional Time Focus (1774-1947 for the pilots). In `period` mode it would appear once the slider passes that society-specific year. The Contemporary Focus (~2014) gives a natural second snapshot. So Pulotu maps cleanly to *two dated states per society*, echoing the interim-tier idea of distinct evidence states at distinct years.
- **Does not fit a continuous per-year census timeline.** Pulotu measures no annual or per-wave series; there is no value "between" the traditional focus and 2014. A census choropleth advances year by year with real per-year data; Pulotu has two dated points. Broadcasting a Pulotu value across every slider year (option 2b) would assert continuity the data lack.
- **The foci are society-specific, not shared.** Because each society's traditional focus is a different year (Tanna 1774 vs Small Islands 1914), a single global "traditional" slider position does not line all cultures up; markers would switch on at staggered years. This is expressible in the dated-places predicate (each feature carries its own `start_year`) but not in a single-year choropleth snapshot.
- **The zero-feature rule bites for any empty era.** Per the wiring rule (temporal-place-layer.md L60-67), a `dated_places.geojson` with zero features must stay unwired on every surface, because an empty product in `period` mode blanks every dot and reads as "no places existed", which is false. Vanuatu is the standing example of the empty-product rule. Any Pulotu dated layer must ship with real features or not be wired.

## 4. Repo precedents the design should know

- **The practice/membership construct family (non-census constructs, own dataNoun, never merged).** The shared runtime lets a product relabel its data via `RC.dataNoun` (region-map.js L105-3794 substitutes it everywhere "Census" would appear). Shipped values in `apps/regions/*/index.html`: `Register` (Israel and four others), `Survey` (two), `Attendance` (one), default `Census`. The country-survey playbook (`docs/playbooks/country-survey.md` L28-30) enumerates the construct types — census affiliation, church-tax/administrative membership, attendance counts, congregation directories, survey — and states the rule verbatim: "Never merge constructs; name each." Manifests carry the construct in their filename (`is-membership-*`, `no-membership-*`, `pl-attendance-*`). A Pulotu layer is a non-census construct and would take this route: its own `dataNoun`, its own declaration, never blended into a census metric. Country-card "wave badges" are hand-authored per shipped product (`docs/development/adding-a-region.md` L167-169; deriving them at render time is a noted open improvement), and UI status pills/badges are catalogued in `docs/ui-style-guide.md` L53-76.
- **The Israel two-slot declarations.** Israel (`apps/regions/il/index.html`, `dataNoun: "Register"`) established the pattern that the two legacy metric slots each carry a *declared construct*, relabelled verbatim per page through `metricLabels`, with the declaration riding the indicators block and no runtime or schema change. `religious_affiliation_percent` carries "classified in a recognised religion group"; `no_religion_percent` carries "not classified by religion" (explicitly not a secularity measure); both are null for the 1948 recorded-context wave. This generalised into the ratified minority-share design (`docs/development/minority-share-metric.md`, "designed on the Israel two-slot precedent"), where slot one is a declared reference-group share and slot two its exact complement, held constant across waves, and every page relabels the two slots. If Pulotu values were ever summarised onto polygons (option 2b), this is the existing mechanism for declaring two Pulotu constructs into the two metric slots without touching the runtime — with the honest declaration that they are point reconstructions, not areal measures.
- **The zero-feature dated_places rule.** Restated from §3 because it directly governs any Pulotu point/dated layer: a `dated_places.geojson` with zero features stays unwired on every surface (no `datedPlaces` key in the region config, none in the portal `COUNTRY_CONFIGS`), and when a real product ships it is wired in both the MapLibre country map and the Leaflet portal in the same commit, with the date predicate duplicated and kept in lockstep across `region-map.js`, `verification-map.js`, and the standard doc (`docs/development/temporal-place-layer.md` L24-67). Vanuatu is the current empty-product example.

## Files touched by this note

- Cache written: `data/raw/pulotu/pulotu_{societies,variables,codes,data,glossary}.csv`, `pulotu_StructureDataset-metadata.json`, `pulotu_LICENSE.txt` (prefixed to coexist with the data-profile lane's `dplace-dataset-pulotu-1.3.1/` and `pulotu-v1.3.1.zip`).
- No `apps/` files, builders, manifests, or queue docs were edited.
