# Planning

This file is the planning source of truth for the repository.

Use it for priorities, decisions, sequencing, and open questions. Keep other
docs focused on implementation detail, operations, or reference material.

## Planning rules

- Put active priorities here before changing roadmap-related docs elsewhere.
- Treat `docs/` as supporting reference unless a document explicitly replaces a
  section here.
- Prefer deterministic pipelines over one-off manual cleanup.
- Reserve manual review for ambiguous cases that cannot be resolved safely by
  rule.
- Record scope decisions here when they affect inclusion, exclusion, or
  interpretation of data.

## Current state

As of 2 April 2026:

- The global static app lives in `apps/global/`.
- The NZ regional app lives in `apps/regions/nz/`.
- NZ territorial authority codes now align with official boundary codes.
- The NZ places dataset has been reduced from 4,718 committed records to 3,618
  after staged cleanup passes.
- The NZ manual review queue currently contains 719 records in
  `docs/nz-manual-review-queue.md`.
- The NZ cleanup workflow is now documented and auditable:
  - `scripts/clean_nz_places.py`
  - `scripts/build_nz_review_queue.py`
  - `docs/nz-data-cleanup-audit.md`
- The legacy global extractor remains too permissive for research-grade use.
- `scripts/extract_global_data.R` is the best starting point for a replacement
  global pipeline, but it still needs explicit cleaning, deduplication, review
  queues, and run manifests.
- Some source extracts and intermediate files may currently only exist in
  Google Drive. Treat Google Drive as temporary holding, not the long-term
  system of record.

## Redevelopment objective

Rebuild the data pipeline so that global and regional outputs are:

- reproducible
- auditable
- deterministic by default
- conservative about inclusion
- explicit about ambiguous cases
- ready for temporal extension

The working model is:

1. extract raw source data
2. normalise to a stable schema
3. apply deterministic inclusion and exclusion rules
4. deduplicate obvious support buildings and weak duplicates
5. emit review queues for ambiguous residual cases
6. apply explicit reviewed overrides
7. publish app-ready outputs plus run metadata

## Immediate priorities

### 1. Stabilise NZ as the reference implementation

- Finish the remaining NZ manual review queue in staged batches.
- Convert ad hoc NZ cleaning logic into named rule groups.
- Write a clear NZ inclusion policy for edge cases:
  - school chapels
  - retreat centres
  - prayer houses
  - temporary worship sites
  - demolished or historical sites
- Keep NZ as the test case for any new global cleaning rule before wider use.

### 2. Rebuild the global extraction path

- Make `scripts/extract_global_data.R` the source of truth for new global
  extraction work.
- Stop relying on broad `religion=*` capture as a primary inclusion rule.
- Use a conservative global inclusion baseline:
  - `amenity=place_of_worship`
  - explicit religious buildings such as `church`, `mosque`, `temple`,
    `synagogue`, `chapel`, `cathedral`, `shrine`, and other clearly religious
    building types where justified
- Emit one raw extract per country and one cleaned output per country.
- Keep the legacy Python extractor only as archive/reference until parity is
  confirmed.
- Keep the research-facing global pipeline in R so collaborators can review,
  modify, and rerun it directly.

### 3. Build a deterministic cleaning pipeline

- Separate pipeline stages:
  - raw extract
  - normalised country dataset
  - cleaned country dataset
  - review queue
  - reviewed override layer
  - published output
- Add a shared cleaner for cross-country rules.
- Keep country-specific override files separate from shared logic.
- Add deterministic duplicate rules for obvious adjunct buildings:
  - halls
  - centres
  - houses
  - parish facilities
  - youth facilities
- Generate machine-readable review queues per country for ambiguous cases.

### 4. Add provenance and run tracking

- Record retrieval date, source, script path, and pipeline commit for each run.
- Emit counts and checksums per country.
- Keep lightweight manifests in-repo.
- Move from ad hoc Google Drive storage to immutable dated snapshots plus
  manifests.
- Store large immutable snapshots and diffs outside the repo when needed.
- Make it possible to answer:
  - what changed
  - when it changed
  - why it changed
  - which rule or review decision caused it

### 5. Define temporal scope before time-slice work begins

- Anchor annual snapshots to `1 September` each year.
- Decide how to represent:
  - demolished places
  - historical-only places
  - approximate locations
  - renamed congregations in the same structure
  - temporary displacement during reconstruction
- Reprocess all prior annual snapshots whenever the cleaning rules change, so
  measured differences reflect site change rather than pipeline drift.
- Keep temporal design compatible with static published outputs and future API
  work.

### 6. Keep frontend and backend expectations aligned

- Preserve current JSON output contracts for the NZ app unless there is a clear
  migration plan.
- Update manifests and counts whenever published data changes.
- Keep Martin tiles plus static JSON as the current delivery path.
- Treat any Rust API work as a later implementation option, not a prerequisite
  for data cleanup.

### 7. Design the country backend pattern before scaling beyond NZ

- Use NZ as the pilot country, but do not hard-code NZ boundary assumptions into
  the shared data model.
- Assume that countries may have multiple coexisting tessellations or area
  systems, including systems that are not strictly nested within one another.
- Define a generic country backend pattern that separates:
  - site identity
  - yearly site state
  - boundary definitions
  - site-to-area assignment
  - downloadable products
- Treat country-specific geography as adapter logic, not as the core schema.
- Make the backend able to serve both:
  - map-ready responses
  - downloadable tabular and spatial outputs
- Keep country-level downloads compatible with future temporal comparisons.

## Deterministic cleaning strategy

The default policy should be:

- deterministic rules for obvious false positives and obvious duplicates
- manual review only for the ambiguous tail

This means:

- no broad manual editing of published JSON as the main workflow
- no irreversible cleanup steps without an audit trail
- no country-by-country eyeballing except as validation or queue resolution

The deterministic rule classes should be:

- hard exclusion
  - cemeteries
  - schools without separately mapped worship space
  - childcare
  - offices
  - residences
  - pubs
  - clearly non-worship community facilities
- hard inclusion
  - `amenity=place_of_worship`
  - explicit religious buildings where naming and tags agree
- duplicate-support-building removal
  - halls, centres, houses, and adjunct facilities beside a clearly mapped
    primary worship site
- review-queue classification
  - weak names
  - missing core tags
  - institutional edge cases
  - retreat and prayer sites
  - historically ambiguous records

## Country backend scheme

Detailed reference: `docs/country-backend-scheme.md`.

The country-specific backend should be organised around the following entities:

- `site`
  - stable internal identifier for the place of worship
  - should not depend solely on a current OSM object id
- `site_snapshot`
  - the state of a site as of `1 September YYYY`
  - includes name, denomination, status, geometry, confidence, and source links
- `boundary_set`
  - identifies a country-specific administrative geography and vintage
  - examples: NZ TA 2025, NZ SA2 2018, UK LAD 2023
- `area_unit`
  - a single area within a boundary set
  - includes code, name, level, parent linkage, and geometry
- `site_area_assignment`
  - links a site snapshot to an area unit under a specific boundary set
  - must be date-aware or boundary-set-aware
- `manual_override`
  - reviewed corrections, inclusions, exclusions, and status fixes
- `run_manifest`
  - records source snapshot, pipeline version, counts, checksums, and outputs

The backend should produce four kinds of country outputs:

- cleaned site rows
- area-level summaries
- downloadable extracts
- metadata and provenance files

The backend should support at least these output forms:

- CSV for downloads and statistical work
- GeoJSON or Parquet for spatial work
- metadata JSON for provenance and reproducibility

## Country backend design principles

- The global map and country maps can share site data, but country backends need
  richer area and download functionality.
- Area assignment must be explicit and reproducible. Do not derive it ad hoc in
  the frontend.
- Countries may have multiple coexisting area tessellations for different
  purposes such as administration, census, health, education, or electoral
  analysis.
- These tessellations may be nested, partially nested, or non-nested.
- Boundary changes over time must be treated as a methodological issue, not an
  implementation detail.
- Country-specific geography should be provided by adapters with a shared
  contract.
- NZ is the pilot implementation, not the universal template.

## Country backend pilot plan

### NZ pilot scope

- One cleaned NZ place dataset
- Multiple NZ boundary sets, including systems that may not be strictly nested
  within one another
- One reproducible site-to-area assignment step
- One country download path
- One yearly snapshot comparison path anchored to `1 September`

### Proposed NZ pilot defaults

- Use fixed-boundary outputs as the default longitudinal comparison product.
- Use a hybrid site-identity strategy:
  - deterministic matching first
  - reviewed overrides for difficult cases
- Publish a minimum three-part NZ download contract:
  - cleaned site rows
  - area summaries
  - metadata bundle
- Keep richer or alternative products optional until the pilot is stable.

### Shared contract to define now

- `country_code`
- `boundary_level`
- `boundary_set_id`
- `area_unit_id`
- `site_id`
- `site_snapshot_id`
- `snapshot_date`
- `status`
- `location_confidence`
- `assignment_method`

### Backend product types to support

- raw country place download
- cleaned country place download
- area summary download
- area-by-religion summary download
- review-queue export
- run manifest and metadata export

## Scope decisions

### Decided: unit of analysis

- The primary unit is the mapped place or building used for worship, not the
  congregation as a social group.

### Decided: current NZ geographic scope

- NZ regional outputs follow the territorial authority geography used in
  `apps/regions/nz/data/territorial_authorities.geojson`.
- This includes Chatham Islands Territory.
- It does not currently include Cook Islands, Niue, or Tokelau.

### Decided: annual snapshot anchor

- Annual longitudinal tracking will be indexed to `1 September`.
- This is intended to align with the timing of the current data pull, which was
  likely completed at the end of August.
- The exact anchor date should remain fixed across years unless there is a
  documented methodological reason to change it.

### Decided: country backend strategy

- Country-specific backends will be built around a shared schema plus
  country-specific boundary adapters.
- NZ will be used as the pilot implementation.
- Area assignment and download products belong in the backend, not only in the
  frontend.
- The shared model must support multiple coexisting area systems within a
  country, including non-nested tessellations.

### Decided: multiple area systems within countries

- The project will treat country geography as potentially multi-tessellation.
- This includes NZ, where different official geographies may coexist for
  different analytical purposes.
- A site may therefore need assignments to more than one boundary set for the
  same snapshot date.

### Decided: NZ pilot boundary comparison default

- The NZ pilot will use fixed-boundary outputs as the default longitudinal
  comparison product.
- Native-boundary outputs may be added later as supplementary products, but
  they will not be the primary comparison series for the pilot.
- The purpose is to minimise measurement error introduced by changing boundary
  definitions across years.

### Decided: NZ pilot site identity strategy

- The NZ pilot will use a hybrid site identity strategy:
  - deterministic matching across years as the default
  - explicit reviewed overrides for difficult matches
- OSM ids will be stored as source references, but they will not be treated as
  the stable longitudinal site identifier.

### Decided: NZ pilot minimum download contract

- Every NZ pilot release should include:
  - cleaned site rows
  - area summaries
  - metadata bundle
- Additional download products such as raw extracts, review queues, and
  area-by-religion tables can be added, but they are not required for the first
  backend milestone.

## Open decisions

### Open: historical and demolished places

- Context: time-slice work will need a rule for sites that no longer exist or
  no longer have an identifiable address.
- Options:
  - keep exact historical coordinates where known
  - keep approximate coordinates with an uncertainty flag
  - exclude sites below a location-confidence threshold
- Risks:
  - false precision
  - inconsistent historical coverage
  - confusion between present and past landscapes
- Next step:
  - define a location-confidence field and a publication rule.

### Open: boundary comparability over time beyond the NZ pilot

- Context: country area units change across years, but longitudinal analysis
  needs comparability.
- Options:
  - use fixed boundary sets for all yearly comparisons
  - use year-specific boundaries plus crosswalks
  - publish both fixed-boundary and native-boundary outputs
- Risks:
  - false comparability
  - complicated interpretation
  - duplicated maintenance burden
- Next step:
  - decide whether the NZ fixed-boundary default should generalise to other
    countries or whether country-specific policies are needed.

### Open: site identity matching across years beyond the NZ pilot

- Context: OSM objects can split, merge, move, or be renamed, so a stable
  longitudinal site identity cannot rely on a single source id.
- Options:
  - derive internal site ids from matching rules
  - curate manual identity links for difficult cases
  - hybrid model with deterministic matching plus reviewed overrides
- Risks:
  - false splits or false merges
  - unstable longitudinal counts
  - hidden manual judgement
- Next step:
  - test the hybrid NZ strategy and document where country-specific matching
    rules are still required.

### Open: country download contract beyond the NZ pilot

- Context: country maps will need downloadable data for sites nested within
  country-specific area units.
- Options:
  - provide raw sites only
  - provide cleaned sites plus precomputed area summaries
  - provide both machine-oriented and analyst-oriented download products
- Risks:
  - oversized downloads
  - unclear provenance
  - inconsistent country coverage
- Next step:
  - decide what should be mandatory across all countries beyond the NZ pilot
    minimum of cleaned sites, area summaries, and metadata.

### Open: boundary hierarchy contract

- Context: countries have different administrative hierarchies, names, and
  vintages, and may also have multiple coexisting tessellations that are not
  strictly hierarchical.
- Options:
  - free-form per-country hierarchies
  - standard shared levels plus local aliases
  - strict canonical hierarchy classes with adapter mapping
  - support parallel boundary families within the same country
- Risks:
  - loss of country-specific meaning
  - awkward cross-country comparisons
  - brittle backend code
  - forced false nesting where none exists
- Next step:
  - choose the boundary metadata fields required across all country adapters.

### Open: long-term snapshot storage

- Context: some current source material may only be stored in Google Drive,
  which is not suitable as the authoritative long-term archive for yearly
  tracking.
- Options:
  - continue with Google Drive plus manifests
  - move immutable yearly snapshots to object storage
  - keep a hybrid model with Drive for working files and object storage for
    published snapshots
- Risks:
  - accidental overwrite
  - unclear provenance
  - weak reproducibility
- Next step:
  - inventory what currently exists only in Drive and define the canonical
    snapshot layout.

### Open: school chapels and institutional worship spaces

- Context: some school or college chapels are genuine worship sites; others are
  internal facilities that should not appear in the main map.
- Options:
  - include all named chapels
  - include only publicly accessible worship spaces
  - include but flag institutional context
- Risks:
  - inconsistent treatment across countries
  - inflated counts in school-dense areas
- Next step:
  - write a rule and test it on the NZ review queue.

### Open: global override format

- Context: some edge cases will always need country or source-specific fixes.
- Options:
  - CSV override files
  - YAML rule files
  - reviewed JSON patch files
- Risks:
  - unreviewed drift
  - duplicate logic between code and overrides
- Next step:
  - choose one human-readable format and enforce review comments in the file.

### Open: Rust adoption timing

- Context: Rust may be useful for ingestion and API performance, but it is not
  required to complete the data cleanup rebuild.
- Options:
  - keep the research pipeline in R and the API/support tooling in Python for now
  - build a Rust ingestion spike after pipeline rules stabilise
  - move directly to a hybrid Rust stack now
- Risks:
  - architecture churn before data policy is settled
  - slower cleanup progress
- Next step:
  - defer major Rust work until the deterministic pipeline design is stable.

## Next concrete steps

1. Finish the next NZ cleanup slices from the remaining review queue.
2. Design the shared global cleaner and review-queue schema.
3. Refactor `scripts/extract_global_data.R` into explicit extract, normalise,
   clean, and export stages.
4. Inventory what is currently stored only in Google Drive and migrate it into
   a dated snapshot structure.
5. Add run manifests and per-country counts.
6. Define the shared country backend schema and NZ boundary adapter contract.
7. Define the minimum NZ download products and area-summary outputs.
8. Pilot the new global pipeline on a small country set before full rollout.
