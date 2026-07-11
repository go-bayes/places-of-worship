# Pulotu data profile

Exploration-lane profile of the Pulotu database of Austronesian religions, feeding the Pulotu design lane (priority entry at the top of `research/build-queue.md`). This document reports facts only: structure, temporal model, variable inventory, geography, and data quality. It makes no design recommendation — the conductor holds design. Author of the profile: exploration agent, 2026-07-11.

## 0. Release cached

Source of record is the D-PLACE curated CLDF repository `github.com/D-PLACE/dplace-dataset-pulotu`. The latest release at profiling time is **v1.3.1**, published 2026-03-20, one commit ahead of the v1.3 concept the queue entry names. The queue entry cites Zenodo DOI `10.5281/zenodo.5669235` (the concept DOI that always resolves to the newest version); v1.3.1's version DOI is `10.5281/zenodo.19127704`.

The release zipball is cached (gitignored under `data/`) at `data/raw/pulotu/pulotu-v1.3.1.zip`, unpacked to `data/raw/pulotu/dplace-dataset-pulotu-1.3.1/`. The CLDF tables live in the `cldf/` subdirectory of the unpacked tree.

SHA256 (release + CLDF payload):

```
c3230e3f5f8fdc44a65b8754271959d801c2d4dcbb6fd3414f32cc908b689755  pulotu-v1.3.1.zip
89cd5c271f8deeda7f128c0ec1a9fa2bcf4dcfad7cdeb67c01e99237936449ea  cldf/StructureDataset-metadata.json
b69fb44194f83f1a0e983671b33e9e8298213c9bbe75004e439c961b779f998d  cldf/codes.csv
3bebc7b2233b91e8a27db0b6f53bb8d54e47870d4ab78cd6d277c681618cfe6a  cldf/data.csv
1766e8cd8c23b72c294ad1ff3287cd665c2c16129101f03f709fec29905280fe  cldf/glossary.csv
b95209d6ac98502bfb0b4b7722f4470d709d78dd36c3d4f182b98bfde38517c7  cldf/societies.csv
7346fc4ecdc6f164380b0865c7eaed5f525802ceee51fdc0745cb56d2c5bc735  cldf/sources.bib
c71463d1da2bab037b51770ab2b7fdc4e10e3104068269a5dadb070c0b4f0f6b  cldf/variables.csv
945fbcb37deca05bccd7c3ca0e261679f1f5373515504fdbad68f6f3cf6f49b9  LICENSE
f4054a7a2c06a53ad1c60688281e21e3116dcf33425c449716ab1130bae041a4  metadata.json
026776b2c4a28f81666a03151613ea55f264043cfde016da3517d3f44cb58099  .zenodo.json
```

### Licence

The CLDF metadata declares the licence machine-readably. In `cldf/StructureDataset-metadata.json` and the top-level `metadata.json`:

```
"dc:license": "https://creativecommons.org/licenses/by/4.0/"
```

`.zenodo.json` carries `"license": {"id": "CC-BY-4.0"}`. The bundled `LICENSE` file is the canonical Creative Commons Attribution 4.0 International legal code (first line, byte for byte: `Attribution 4.0 International`; it contains the single line `Creative Commons Attribution 4.0 International Public License`). The licence is clean CC BY 4.0 — attribution only, no non-commercial or share-alike restriction. Required citation (from `cldf/README.md`, verbatim): Watts J., Sheehan O., Greenhill S.J., Gomes-Ng S., Atkinson Q.D., Bulbulia J., Gray R.D. (2015). Pulotu: Database of Austronesian Supernatural Beliefs and Practices. PLoS ONE 10(9). DOI: `10.1371/journal.pone.0136783`, plus the version DOI. Joseph Bulbulia (VUW) is a listed author on both the article and the Zenodo release (`.zenodo.json` creators).

## 1. Dataset structure

Pulotu ships as a **CLDF StructureDataset** (`dc:conformsTo` → `cldf.clld.org/v1.0/terms.rdf#StructureDataset`), the standard cross-linguistic tabular layout: one long-format value table plus reference tables for languages/societies, parameters/variables, and codes. Five CSV tables, related by foreign keys declared in `StructureDataset-metadata.json`.

| table | CLDF role | rows (`dc:extent`) | grain |
|---|---|---|---|
| `societies.csv` | LanguageTable | **137** | one row per culture |
| `variables.csv` | ParameterTable | **88** | one row per variable |
| `codes.csv` | CodeTable | **277** | one row per categorical answer option |
| `data.csv` | ValueTable | **10,423** | one row per (culture × variable) observation |
| `glossary.csv` | — | 65 | term definitions |

**`societies.csv`** — the culture units. Columns: `ID` (slug primary key, e.g. `manam`, `toba-batak`, `hawaiians`), `Name`, `Macroarea`, `Latitude`, `Longitude`, `Glottocode`, `ISO639P3code`, `Comment`, `Ethonyms` (a `; `-separated list of alternative ethnonyms). There are 137 cultures — the abstract's "more than 130 cultures from the Moken of mainland Asia to the Māori of New Zealand." Identifiers are stable lowercase slugs.

**`variables.csv`** — 88 variables. Columns: `ID` (numeric string `1`–`88`), `Name` (full question text), `Description` (the coding definition), `ColumnSpec` (a JSON slot, empty throughout this release), `Simplified_Name` (short label), `Datatype` (`Option` / `Float` / `Int` / `Text`), `Section_Notes`, `Category`, `Section`, `Subsection`. Variables carry their own three-level taxonomy in `Category` → `Section` → `Subsection` (see §3). Datatype breakdown: 79 `Option` (categorical/ordinal), 6 `Float`, 1 `Int`, 2 `Text`.

**`data.csv`** — the long-format value table. Columns: `ID`, `Language_ID` (→ `societies.csv`), `Parameter_ID` (→ `variables.csv`), `Value`, `Code_ID` (→ `codes.csv`), `Comment`, `Source` (a `;`-separated list of `sources.bib` keys). For an `Option` variable, `Value` holds the integer code and `Code_ID` resolves to the code's human-readable `Description` in `codes.csv`; for `Float`/`Int`/`Text` variables `Value` holds the literal number or string and `Code_ID` is blank. The table is genuinely long: 10,423 rows, and it stores only observed cells — there are no explicit null rows (0 rows with empty or `?` value; absence is by omission, see §5).

**`codes.csv`** — the answer key. Columns: `ID`, `Parameter_ID`, `Name` (the code's short label, usually the integer), `Description` (the human-readable meaning). Example, variable 2 "Belief in god(s)": `0` = "Absent (do not feature in the belief system of the culture)", `1` = "Present, but not a major focus of supernatural practice", `2` = "Present, and a major focus of supernatural practice", `3` = "Present, and the principal focus of supernatural practice". The Option variables are therefore mostly **ordinal** (absent → present-minor → present-major → present-principal), not bare presence/absence.

## 2. The temporal model (the design-critical fact)

Pulotu's deep-history claim is realised in **two nested mechanisms**: a top-level partition of the *variables* into three time layers, and per-culture *time-focus text fields* that pin an explicit calendar year to each layer.

### 2a. Time layers are a property of the variable, encoded in `Category`

Every variable belongs to exactly one of three `Category` values, and that Category **is** the time layer it describes:

| `Category` (time layer) | variables | meaning |
|---|---|---|
| **Traditional Culture** | 68 | the pre-/early-contact indigenous state, reconstructed to the culture's traditional time focus |
| **Post Contact History** | 16 | processes across the post-contact period (conversion, colonisation, infrastructure) |
| **Current Culture** | 4 | the culture as it is at or around the time of coding |

So the temporal layering is **per-variable, not per-value and not a single time column**. A culture's row in the long table simultaneously carries Traditional-era observations, Post-Contact-History observations, and Current observations, distinguished only by which variable (hence which Category) each value belongs to. This is the schema-breaking property the queue entry flags: one culture is described at three moments at once.

### 2b. The explicit year lives in per-culture Text time-focus fields

Two variables are free-text time stamps, one per traditional/current layer, carrying an actual calendar year (or interval) for each culture:

- **Variable 1, "Traditional State Time Focus"** (`Datatype = Text`, Category = Traditional Culture). Coverage: **137/137** — every culture has one. Values are years, e.g. `siraya` = 1627, `marquesas` = 1797, `futuna` = 1837, `niue` = 1848, `aeta` = 1903, `gaddang-pagan` = 1965, `ata-tana-aai` = 1977. Definition, verbatim: *"A time focus is the period of time to which ethnographic data on a particular society is applicable. Ethnographies do not always specify a time focus, in which case one must be inferred. If multiple time foci are defensible, the earliest that allows a detailed reconstruction of the indigenous religion should be chosen. When coding variables that have a frequency (e.g. warfare, contact with other societies), the twenty-five year period immediately preceding the time focus should be taken into consideration (cf. Ember & Ember, 1992)."*

- **Variable 82, "Contemporary Time Focus"** (`Datatype = Text`, Category = Current Culture). Coverage: **121/137**. Values cluster on the coding campaign, e.g. `manam`/`moken`/`hawaiians`/`marshall-islands` = 2014, `Maohi` = 2020. Definition, verbatim: *"The contemporary state coding sheet should describe the culture as it is at or around the time of coding. The time focus, then, should be as recent and narrow as is practical. This can be stated in the form of a calendar year or an interval, e.g. (2000-2010)."*

A related field, **variable 45, "Estimate of culture population size at relevant time focus"** (`Int`), ties a population count to the traditional time focus.

**Net temporal model for design.** Each culture carries: one explicit *traditional* year (var 1, 100% coverage) with ~68 variables reconstructed to that year; a block of ~16 *post-contact-history* process variables spanning the interval between the traditional year and the present; and one explicit *contemporary* year (var 82, ~88% coverage) with 4 variables describing the present. There is **no per-value year and no continuous time series within a variable** — the temporal resolution is exactly these three snapshots, and only the traditional and contemporary snapshots carry an explicit date. The Post-Contact-History layer is process/interval-coded (e.g. "did a world religion get adopted", "use of force in conversion"), not dated per culture.

## 3. Variable inventory

The 88 variables in `Category` → `Section` order, with `Datatype` and response coverage (distinct cultures holding a value, out of 137). Because `data.csv` stores only observed cells, coverage here equals rows-present per variable. `Option` = categorical/ordinal (labels in `codes.csv`), `Float`/`Int` = continuous, `Text` = free text.

| id | variable | type | cov/137 | section |
|---|---|---|---|---|
| 1 | Traditional State Time Focus | Text | 137 | Traditional State Time Focus |
| 2 | Belief in god(s) | Option | 131 | Belief (Indigenous) |
| 3 | Belief in nature god(s) | Option | 132 | Belief (Indigenous) |
| 4 | Belief in deified ancestor(s) | Option | 132 | Belief (Indigenous) |
| 5 | Belief in ancestral spirits | Option | 131 | Belief (Indigenous) |
| 6 | Belief in nature spirits | Option | 129 | Belief (Indigenous) |
| 7 | Belief in supernatural punishment for impiety | Option | 131 | Belief (Indigenous) |
| 8 | Supernatural punishment for selfishness | Option | 126 | Belief (Indigenous) |
| 9 | Myth of a primordial pair | Option | 116 | Belief (Indigenous) |
| 10 | Myth of humanity's creation | Option | 117 | Belief (Indigenous) |
| 11 | Belief that others' post-death actions (e.g. funeral rites) affect one's afterlife | Option | 123 | Belief (Indigenous) |
| 12 | Belief that one's actions while living affect one's afterlife | Option | 120 | Belief (Indigenous) |
| 13 | Belief in culture hero(es) | Option | 124 | Belief (Indigenous) |
| 14 | Belief that forces of nature are controlled by / imbued with the supernatural | Option | 130 | Belief (Indigenous) |
| 15 | Social hierarchy tapu | Option | 112 | Belief (Indigenous) |
| 16 | Kinship tapu | Option | 113 | Belief (Indigenous) |
| 17 | Resource management tapu | Option | 111 | Belief (Indigenous) |
| 18 | Mana and social status | Option | 38 | Belief (Indigenous) |
| 19 | Mana related to social influence or technical skill | Option | 122 | Belief (Indigenous) |
| 20 | Mana linked to genealogy | Option | 40 | Belief (Indigenous) |
| 21 | Mana as a personal quality | Option | 123 | Belief (Indigenous) |
| 22 | Mana as a spiritual or religious concept | Option | 125 | Belief (Indigenous) |
| 36 | Costly sacrifices and offerings | Option | 129 | Practice (Indigenous) |
| 37 | Headhunting | Option | 132 | Practice (Indigenous) |
| 38 | Political and religious differentiation (SCCS v 757) | Option | 133 | Practice (Indigenous) |
| 39 | Largest religious community | Option | 127 | Practice (Indigenous) |
| 40 | Genital cutting | Option | 117 | Practice (Indigenous) |
| 41 | Tooth pulling | Option | 113 | Practice (Indigenous) |
| 42 | Tattooing | Option | 120 | Practice (Indigenous) |
| 43 | Scarification | Option | 113 | Practice (Indigenous) |
| 44 | Piercing | Option | 114 | Practice (Indigenous) |
| 86 | Religious Authority | Option | 121 | Practice (Indigenous) |
| 87 | Structure of Religious and Political Authority | Option | 120 | Practice (Indigenous) |
| 45 | Estimate of culture population size at relevant time focus | Int | 129 | Social Environment |
| 46 | Importance of Matrilateral descent (V.2) | Option | 130 | Social Environment |
| 47 | Importance of Patrilateral descent (V.2) | Option | 133 | Social Environment |
| 48 | Jurisdictional hierarchy beyond local community (SCCS v 237) | Option | 137 | Social Environment |
| 49 | Polygamy (SCCS 861) | Option | 118 | Social Environment |
| 50 | Marital residence (SCCS 69) | Option | 116 | Social Environment |
| 51 | Kinship system (if applicable) | Option | 56 | Social Environment |
| 52 | Estimated population of largest political community | Option | 128 | Social Environment |
| 53 | (No) conflict within the local community (SCCS v 767) | Option | 122 | Social Environment |
| 54 | (No) internal warfare (SCCS v 773) | Option | 132 | Social Environment |
| 55 | (No) external warfare (SCCS v 774) | Option | 132 | Social Environment |
| 88 | Political Authority | Option | 126 | Social Environment |
| 56 | Metalworking | Option | 91 | Subsistence and Economy |
| 57 | Animal husbandry as a source of food | Option | 133 | Subsistence and Economy |
| 58 | Land-based hunting performed by individuals | Option | 129 | Subsistence and Economy |
| 59 | Land-based gathering | Option | 130 | Subsistence and Economy |
| 60 | Land-based hunting performed by one or more groups | Option | 128 | Subsistence and Economy |
| 61 | Agriculture / Horticulture | Option | 133 | Subsistence and Economy |
| 62 | Water-based gathering | Option | 126 | Subsistence and Economy |
| 63 | Fishing / water-based hunting performed by one or more groups | Option | 129 | Subsistence and Economy |
| 64 | Fishing / water-based hunting performed by individuals | Option | 130 | Subsistence and Economy |
| 65 | Trade / wage labour as a source of food | Option | 130 | Subsistence and Economy |
| 30 | Longitude of culture's location (°) | Float | 137 | Physical Environment |
| 31 | Latitude of culture's location (°) | Float | 137 | Physical Environment |
| 32 | Number of islands inhabited by culture | Option | 136 | Physical Environment |
| 33 | Island type | Option | 132 | Physical Environment |
| 34 | Maximum elevation (meters) | Float | 129 | Physical Environment |
| 35 | Island Size (km²) | Float | 134 | Physical Environment |
| 23 | Pre-Austronesian population | Option | 134 | Isolation |
| 24 | Christian influence on supernatural belief | Option | 129 | Isolation |
| 25 | Hindu / Buddhist influence on supernatural belief | Option | 135 | Isolation |
| 26 | (Low) contact with other societies (SCCS v 787) | Option | 132 | Isolation |
| 27 | Islamic influence on supernatural belief | Option | 134 | Isolation |
| 28 | Distance to closest landmass inhabited by a different culture (km) | Float | 137 | Isolation |
| 29 | Distance to nearest continent (km) | Float | 136 | Isolation |
| 66 | World-religion adoption: top-down vs bottom-up process | Option | 78 | Religious History |
| 67 | Use of force in conversion | Option | 119 | Religious History |
| 68 | Adoption of a world religion | Option | 129 | Religious History |
| 69 | Resident missionary involvement in conversion process | Option | 122 | Religious History |
| 70 | Syncretic religious movements | Option | 97 | Religious History |
| 71 | Replacement-level immigration | Option | 98 | Secular History |
| 72 | Language shift | Option | 96 | Secular History |
| 73 | Foreign education systems | Option | 108 | Secular History |
| 74 | Foreign government systems | Option | 121 | Secular History |
| 75 | Changes in means of subsistence | Option | 99 | Secular History |
| 76 | Exportation of goods to other cultures | Option | 117 | Secular History |
| 77 | Vehicles and roads | Option | 96 | Secular History |
| 78 | Air travel | Option | 89 | Secular History |
| 79 | Sea port | Option | 106 | Secular History |
| 80 | Loss of autonomy during postcontact period | Option | 123 | Secular History |
| 81 | Nature of loss of autonomy – voluntary vs. forced | Option | 110 | Secular History |
| 82 | Contemporary Time Focus | Text | 121 | Current Time Focus |
| 83 | Syncretism – Unofficial | Option | 58 | Belief (Current) |
| 84 | Religious Syncretism – Institutional | Option | 63 | Belief (Current) |
| 85 | Dominant world religion | Option | 111 | Belief (Current) |

### Highest-coverage and most map-worthy variables

**Full or near-full coverage (≥135/137).** Var 48 Jurisdictional hierarchy (137), var 28/30/31 geography Floats (137), var 1 Traditional time focus (137), var 32 Number of islands (136), var 29 Distance to nearest continent (136), var 25 Hindu/Buddhist influence (135), var 23 Pre-Austronesian population (134), var 27 Islamic influence (134), var 35 Island size (134).

**Map-worthy, high coverage, religion/practice/social-structure (the design-relevant core).** Grouping by the brief's three families:

- *Religious beliefs (Traditional):* var 2 Belief in god(s) (131), var 3 nature gods (132), var 4 deified ancestors (132), var 5 ancestral spirits (131), var 6 nature spirits (129), var 7 supernatural punishment for impiety (131), var 8 supernatural punishment for selfishness (126), var 14 supernatural control of nature (130). These are ordinal absent→principal-focus scales at ~95% coverage — the cleanest single-variable choropleth candidates.
- *Religious practice / authority (Traditional):* var 36 Costly sacrifices (129), var 37 Headhunting (132), var 38 Political-religious differentiation (133), var 39 Largest religious community (127), var 86 Religious Authority (121), var 87 Structure of Religious and Political Authority (120), var 42 Tattooing (120).
- *Social structure (Traditional):* var 48 Jurisdictional hierarchy (137), var 47 Patrilateral descent (133), var 46 Matrilateral descent (130), var 54/55 internal/external warfare (132 each), var 88 Political Authority (126), var 52 largest political community (128), var 45 population estimate (129).
- *Religious change (the temporal hook):* var 68 Adoption of a world religion (129, ordinal by population share), var 85 Dominant world religion (111; codes: Christianity/Islam/Hinduism-Buddhism/Other — 107 of 111 coded cultures are Christianity), var 67 Use of force in conversion (119), var 69 missionary involvement (122), var 80 Loss of autonomy (123). These pair a Traditional-era belief variable with a Post-Contact/Current outcome for the same culture — the direct expression of "change over time" at the culture level.

**Low-coverage variables to treat with care:** var 18 Mana and social status (38), var 20 Mana linked to genealogy (40), var 51 Kinship system (56), var 83/84 Current syncretism (58/63), var 66 conversion process (78), var 78 Air travel (89). Coverage below ~90/137 would leave a sparse map.

## 4. Geography

**What each culture carries.** Point coordinates only: `Latitude` and `Longitude` are present for **137/137** cultures (and duplicated as substantive variables 31/30). `Glottocode` is present for **129/137** (links to Glottolog v5.3, the release's stated derivation source, and thus to the wider D-PLACE society graph). `ISO639P3code` and `Macroarea` are **empty for all 137** rows in this release, and `societies.csv` carries no country, region, or polygon field. There are **no polygons** in Pulotu — the spatial primitive is a single representative point per culture. Cultures are island/coastal societies, so a point sits on (or beside) the culture's main island.

**Cross-tabulation against modern countries.** Pulotu has no country attribute, so cultures were assigned to a modern country by offline reverse geocoding of each culture's point to the nearest populated place (GeoNames `reverse_geocoder`, mode 1). This is the dataset's own location data mapped to present-day sovereignty; it is approximate for remote outliers (see caveats below).

Raw reverse-geocode counts (137 total):

| country | n | | country | n |
|---|---|---|---|---|
| Indonesia | 29 | | Wallis & Futuna | 2 |
| Solomon Islands | 19 | | American Samoa | 2 |
| Philippines | 14 | | Fiji | 2 |
| Papua New Guinea | 13 | | Palau | 1 |
| Vanuatu | 11 | | Tonga | 1 |
| Taiwan | 8 | | Kiribati | 1 |
| Micronesia (FSM) | 8 | | Marshall Islands | 1 |
| New Caledonia | 4 | | Guam | 1 |
| French Polynesia | 4 | | Tokelau | 1 |
| Malaysia | 3 | | Myanmar | 1 |
| New Zealand | 2 | | Timor-Leste | 1 |
| Cook Islands | 2 | | Niue | 1 |
| Madagascar | 2 | | Samoa | 1 |
| | | | Chile (Rapa Nui) | 1 |
| | | | United States (Hawaiʻi) | 1 |

**Caveats — three outlier misassignments corrected.** The nearest-populated-place snap is wrong for four remote cultures, each a Polynesian outlier far from its nearest neighbour's town:
- `Tikopia` (−12.3, 168.8) and `Anuta` (−11.6, 169.8) snapped to Sola, **Vanuatu** but belong to **Solomon Islands** (Temotu Province). Corrected: Vanuatu 11 → **9**, Solomon Islands 19 → **21**.
- `Pukapuka` (−10.9, −165.8) and `Manihiki-Rakahanga` (−10.4, −161.0) snapped to Manuʻa, **American Samoa** but belong to the **Cook Islands** (Northern group). Corrected: American Samoa 2 → **0**, Cook Islands 2 → **4**.

**Cross-tab for the project's shipped/staged Pacific frames** (corrected counts):

| modern country | project status | Pulotu cultures | which |
|---|---|---|---|
| Solomon Islands | (not yet built) | **21** | To'abaita, Kwaio, Lau, Kwara'ae, Cheke Holo, Roviana, Marovo, Simbo, Arosi, Sa'a, Bughotu, Nggela, Kaoka, Rennell, Bellona, Ontong Java, Nendo, Main Reef Is, Taumako, + Tikopia, Anuta |
| Papua New Guinea | (not yet built) | **13** | Motu, Mekeo, Manam, Wogeo, Manus (Titan), Mussau, Lakalai, Tolai, Buka, Varisi, Dobuans, Trobriands, Goodenough |
| Vanuatu | shipped | **9** | Tanna, Nguna, South Pentecost, Mota, Seniang, Small Islands, Aneityum, Erromango, Futuna-Aniwa |
| Micronesia (FSM) | staged | **8** | Chuuk, Yap, Pohnpei, Kosrae, Ulithi, Ifaluk, Kapingamarangi, Nukuoro |
| Fiji | shipped (page dark) | **2** | Fijians, Rotuma |
| Tonga | shipped | **1** | Tonga |
| Samoa | staged | **1** | Samoa |
| Palau | staged | **1** | Palau |
| Kiribati | built | **1** | Kiribati |
| Tokelau | data shipped | **1** | Tokelau |
| Tuvalu | staged | **0** | — none |
| Nauru | shipped | **0** | — none |

Two shipped/staged frames, **Tuvalu and Nauru, have no Pulotu culture at all**; the nearest Polynesian-outlier proxies (Ontong Java, Nukuoro, Kapingamarangi) sit in Solomon Islands / FSM, not on those atolls. Beyond the project's current frames, the bulk of Pulotu is **island Southeast Asia** — Indonesia (29) and the Philippines (14) alone are 43 of 137 — plus **Taiwan** (8 Austronesian cultures, the family's homeland) and the western-Pacific arc (Solomon Islands, PNG, Vanuatu, New Caledonia). The remote east-Polynesian points (French Polynesia 4, Cook Islands 4, Rapa Nui, Hawaiʻi, New Zealand's Māori and Moriori) round out the triangle.

## 5. Data-quality notes

**Missingness is by omission, not by null.** `data.csv` contains only observed cells: 10,423 rows out of a possible 88 × 137 = 12,056, so 1,633 culture×variable cells (13.5%) are simply absent, and there are zero explicit `?`/empty `Value` rows. A consumer must therefore treat "no row" as "not coded", not as a false or zero. Every culture has between 41 and 88 values (median 80); no culture is near-empty. Coverage is high and even across the belief/practice/social-structure core (§3), and thins in the Current-Culture layer (vars 82–85, ~58–121) and parts of the Post-Contact-History layer.

**The sources/references model is dense and per-observation.** `data.csv` carries a `Source` column that is a `;`-separated list of BibTeX keys into `cldf/sources.bib`; 9,923 of 10,423 value rows (95.2%) cite at least one source, and `sources.bib` holds **1,192 references**. Sourcing is therefore at the level of the individual coded value, not the culture — each cell can be traced to its ethnographic authority. A `Comment` column carries coder notes on 366 rows. This provenance density is a strength for a public map: any displayed value can surface its citation.

**Ordinality.** The `Option` variables are predominantly graded ordinal scales (absent → present-minor → present-major → present-principal for beliefs; population-share bands for world-religion adoption), with meanings only in `codes.csv::Description` — `Value` alone (a bare integer) is not self-describing and must be joined through `Code_ID`. A few Options are nominal (var 33 Island type, var 85 Dominant world religion, var 50 Marital residence).

**Derivation and identifiers.** The CLDF is generated (`prov:wasGeneratedBy`) from the internal `D-PLACE/pulotu-internal` repository plus Glottolog v5.3, by `cldfbench`. Society IDs are stable slugs; Glottocodes (129/137) are the join key to Glottolog and the wider D-PLACE catalogue if a design wants to borrow their society polygons or land areas. The empty `Macroarea` and `ISO639P3code` columns and the empty `ColumnSpec` JSON are release artefacts, not data to rely on.
