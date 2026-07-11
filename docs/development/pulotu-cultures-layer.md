# Pulotu on the maps: the cultures-layer design

Status: DESIGN AWAITING RATIFICATION (the project lead is a Pulotu author; every recommendation below is his to accept, amend, or reject). Prepared by the conductor 2026-07-11 from the two exploration profiles, `research/pulotu/data-profile.md` and `research/pulotu/geography-notes.md`, which carry the facts this design rests on.

## What the dataset is, in the terms the design needs

Pulotu (D-PLACE CLDF release v1.3.1, CC BY 4.0, byte-confirmed) documents 137 Pacific cultures through 88 variables and 10,423 value rows, with dense per-value sourcing. Three facts govern everything that follows. First, the geometry is points: every culture carries one coordinate pair and no polygon exists anywhere in the release. Second, the temporal model lives on the variables, and the layers are unequal: 68 variables describe Traditional Culture, 16 describe Post-Contact History, and 4 describe Current Culture, while each culture carries two explicit calendar anchors — a Traditional State Time Focus (all 137 cultures; range 1521–1983, median 1895) and a Contemporary Time Focus (121 cultures, mostly 2014–2020). There is no per-value dating and no series between the anchors. Third, the cultures sit unevenly on the project's frames: Vanuatu holds nine cultures that map one-to-one onto its 65 area councils, Micronesia holds eight that do not aggregate losslessly to its four states, the Philippines holds fourteen and Taiwan eight on already-shipped pages, Solomon Islands holds twenty-one with no census route, and most Pacific microstates hold exactly one whole-country culture (Tuvalu and Nauru hold none).

## The central decision: what a culture is on the map

Four representations were assessed, and the design recommends the first.

**Recommended: cultures as a point layer.** Points are the dataset's own geometry — rendering them fabricates nothing, works identically on every country page whether it holds one culture or fourteen, and inherits the dated-places machinery the runtime already has. The project lead's framing that the cultures "reveal the minimum boundaries of an edge" is, on this reading, an argument for points: a point plus its documented variables IS the minimum boundary claim, and the map should not draw an edge the data never asserts.

**Rejected for the pilot: summarising culture values onto census polygons.** Both aggregation directions destroy meaning. Where several cultures share a polygon (Tafea holds four), a summary either averages incommensurable ordinal codes or picks a winner; where one culture spans several polygons, the same value stamps areas the sources never described. This option also silently converts a culture-level scholarly reconstruction into an area statistic, which the render-the-record rule forbids.

**Deferred, one ruling required: culture-area polygons from the Language Atlas of the Pacific Area.** The revised digital Wurm & Hattori atlas offers speaker-area polygons for 1,769 Pacific languages keyed to glottocodes, and would give the cultures visible extents. Two obstacles: the licence is CC BY-NC 4.0 — compatible with the project's non-commercial reality but a restriction the stack has never shipped and a constraint on downstream reuse, which is squarely a project-lead ruling — and the join is imperfect (three glottocodes are shared by two societies each; eight societies, including the Vanuatu pilot culture futuna-west, carry no glottocode). This is the natural phase-two upgrade if the lead rules the licence acceptable.

**Rejected: whole-country roll-ups.** They discard exactly the subnational structure that makes Vanuatu and Micronesia interesting.

## The temporal decision: how deep history meets the year slider

The design recommends that the cultures layer be independent of the census time slider. The census slider steps through enumeration years of a different construct; a culture's traditional time focus is the anchor of a scholarly reconstruction, and threading it onto the same slider would imply a comparability the data cannot support (there is nothing between 1895 and 2014 to slide through). Instead each culture's popup states its two calendar anchors explicitly and organises its variables under the dataset's own three headings — Traditional Culture, Post-Contact History, Current Culture — so the deep-history layering is visible per culture rather than simulated as a series. The dated-places interval semantics (`start_year`/`end_year`) remain available as a phase-two option if the lead prefers markers that participate in period mode, using each culture's own traditional focus as the start anchor; the design does not recommend it initially because staggered focus years would make cultures blink in and out of a census-year view for reasons no user could infer.

## The variable decision: what a popup carries

The pilot popup carries a curated set chosen for coverage and map-worthiness, in three groups as the dataset organises them: the religious-change pair (Adoption of a world religion, 129 cultures; Dominant world religion, 111 — the direct hook into the project's change-over-time objective), three Traditional Culture belief scales at ~95 percent coverage (belief in god(s), ancestral spirits, supernatural punishment for impiety), and the two time-focus anchors. Every value cites its Pulotu sources (95 percent of value rows carry references); the popup links the culture's full Pulotu record for the remaining 80 variables rather than reproducing them. Which variables make the curated set is explicitly the project lead's call — this list is a coverage-ranked starting proposal.

## Product shape and pilot

One global product, not per-country builds: a single `pulotu_cultures.geojson` (137 point features carrying the curated values, both time anchors, the source references, and a computed modern-country tag) plus a small manifest, built by one `scripts/build_pulotu_cultures.R` from the cached CC BY 4.0 release. Country pages opt in by config, and the layer surfaces through the existing points control as a third mode alongside the place dots, with its own dataNoun-style label ("Cultures") and the never-merge rule in force: Pulotu values never enter area summaries, census metrics, or change layers.

The pilot is Vanuatu: nine cultures, the one-to-one area-council correspondence documented for the popup text, the project lead's own research ground, and an existing page whose island spine is already under active development. Tonga, Fiji, Samoa, Palau, Kiribati, Tokelau, Micronesia, the Philippines, and Taiwan follow by config once the pilot is ratified. Solomon Islands — the richest Pulotu country at twenty-one cultures, with no census route — is recorded as a standing option for a cultures-first country page, which would invert the stack's usual order and deserves its own ruling.

## The questions reserved for the project lead

1. Ratify or amend the point-layer representation (against the polygon-summary and atlas-polygon alternatives).
2. Rule on the Language Atlas CC BY-NC 4.0 licence for phase-two culture extents.
3. Approve or reshape the curated variable set.
4. Confirm the slider-independent temporal treatment (against dated-places participation).
5. Ratify Vanuatu as the pilot, and decide whether a cultures-first Solomon Islands page is in scope.
6. Name the construct as it should appear on public surfaces ("Cultures" is the placeholder; the label, like everything here, renders a record he co-authored).
