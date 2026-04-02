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
- Store large immutable snapshots and diffs outside the repo when needed.
- Make it possible to answer:
  - what changed
  - when it changed
  - why it changed
  - which rule or review decision caused it

### 5. Define temporal scope before time-slice work begins

- Decide how to represent:
  - demolished places
  - historical-only places
  - approximate locations
  - renamed congregations in the same structure
  - temporary displacement during reconstruction
- Choose a snapshot cadence for OSM-based historical analysis.
- Keep temporal design compatible with static published outputs and future API
  work.

### 6. Keep frontend and backend expectations aligned

- Preserve current JSON output contracts for the NZ app unless there is a clear
  migration plan.
- Update manifests and counts whenever published data changes.
- Keep Martin tiles plus static JSON as the current delivery path.
- Treat any Rust API work as a later implementation option, not a prerequisite
  for data cleanup.

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

## Scope decisions

### Decided: unit of analysis

- The primary unit is the mapped place or building used for worship, not the
  congregation as a social group.

### Decided: current NZ geographic scope

- NZ regional outputs follow the territorial authority geography used in
  `apps/regions/nz/data/territorial_authorities.geojson`.
- This includes Chatham Islands Territory.
- It does not currently include Cook Islands, Niue, or Tokelau.

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
  - keep pipeline work in R/Python for now
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
4. Add run manifests and per-country counts.
5. Pilot the new global pipeline on a small country set before full rollout.
