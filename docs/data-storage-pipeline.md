# Data Storage Pipeline

This document defines how generated and contributed data should be stored so
the project can recover from laptop loss, audit sources, and rebuild outputs.

## Core Rule

No important dataset may exist only in a local ignored folder.

Local paths such as `data/raw/`, `data/intermediate/`, `data/derived/`, and
`exports/` are working caches. They are useful because they keep large,
licensed, private, or noisy files out of Git. They are not durable storage.

Every dataset that may be used for analysis, review, publication, or future
task generation needs:

1. a local cache copy for processing;
2. a durable project-controlled copy outside the laptop;
3. a tracked manifest in Git that identifies the durable copy and records
   provenance, checksums, row counts, licence/privacy status, and rebuild
   instructions.

Git stores code, schemas, documentation, and manifests. It should not store
large raw extracts, private source files, or generated intermediate products.

## Storage Tiers

### Tier 0: Local Cache

Purpose:
temporary processing, inspection, and smoke testing.

Examples:

- `data/raw/...`
- `data/intermediate/...`
- `data/derived/...`
- `exports/...`

Rules:

- Treat as disposable.
- Never cite a local-only file as the source of a map or analysis product.
- Do not ask RAs or collaborators to depend on a local path.
- Promote or discard local outputs promptly after inspection.

### Tier 1: Project Working Store

Purpose:
near-term resilience for pilot data and collaborator handoff.

Default:
project-controlled Google Drive, using stable folders and file IDs.

Examples:

- RA working Sheets.
- exported RA session JSON.
- church-body spreadsheets or PDFs supplied for review.
- first-pass generated candidate CSV/GeoJSON files that need curator review.

Rules:

- Use project-owned files or folders, not a collaborator's personal copy, when
  the file becomes project evidence.
- Preserve original uploads separately from edited derivatives.
- Record the Drive file ID or URL in a tracked manifest.
- Export native Google Sheets to a stable file format before ingestion.
- Do not rely on Drive alone for accepted or published master outputs.

### Tier 2: Durable Archive And Staging

Purpose:
longer-term storage for immutable raw snapshots, reviewed exports, media
quarantine, and rebuild inputs.

Default reference:
Google Cloud Storage for object storage; PostgreSQL/PostGIS when the project
needs durable geospatial staging. This follows the portal storage plan and keeps
the path compatible with future Rust services.

Rules:

- Store immutable snapshots under dated keys.
- Never overwrite a dated object. Supersede it with a new version and manifest.
- Keep private or restricted source material out of public buckets.
- Use signed or role-restricted access for non-public artefacts.
- Accepted exports must still pass through the `pow` validation/replay path
  before changing public maps or density products.

## Minimum Manifest

Each durable dataset needs a small tracked manifest. The manifest should live in
Git under a documentation or manifest folder, while the data files live in the
working store or durable archive.

Required fields:

- `manifest_id`: stable identifier for this manifest.
- `dataset_id`: stable identifier for the dataset or run.
- `dataset_role`: one of `raw_source`, `intermediate_lead`,
  `staged_evidence`, `accepted_export`, `public_product`.
- `country_code`: ISO country code where applicable.
- `created_at`: UTC timestamp.
- `created_by`: person, script, or service.
- `pipeline_commit`: Git commit used to generate the file, when applicable.
- `source`: provider, source URL, retrieval date, licence, and citation.
- `durable_files`: durable URI or Drive file ID, format, byte size, SHA-256,
  row count or feature count, and privacy/licence status.
- `local_cache_hint`: optional relative local cache path for regeneration or
  inspection. This is only a hint, not the record.
- `validation`: command run, result, warnings, and whether the file is accepted
  for downstream use.
- `downstream_status`: whether the data is a lead, staged, accepted, exported,
  or superseded.

The tracked manifest is the recovery handle. If the laptop dies, a maintainer
should be able to use the manifest to find the durable files, verify their
checksums, and rerun the relevant pipeline.

## Versioning And Hashing

Hashing is part of the storage contract, not a later verification step. The
global pipeline will eventually contain millions of sites and many country,
year, and processing-stage partitions, so version identifiers must be stable,
machine-readable, and cheap to compare.

### Identifier Levels

Use three related identifiers:

- `dataset_id`: stable logical dataset name, such as
  `osm-pow:nz:2025-09-01:cleaned` or `osm-pow:global:2025-09-01:raw`.
- `dataset_version_id`: immutable version of that dataset, formed from the
  `dataset_id` plus a short manifest hash, for example
  `osm-pow:nz:2025-09-01:cleaned:4f8a91c2d3aa`.
- `manifest_id`: stable manifest record for the run, usually matching the
  `dataset_version_id` with a `manifest:` prefix.

The `dataset_id` is human-facing and can be reused when a dataset is superseded.
The `dataset_version_id` and `manifest_id` are immutable.

### Required Hashes

Each manifest must record:

- `sha256` for every durable file, computed from the exact bytes that would be
  downloaded or restored;
- `manifest_sha256`, computed from a canonical JSON representation of the
  manifest with `manifest_sha256` itself set to `null`;
- input hashes for source files, raw exports, or previous-stage manifests;
- output hashes for each generated partition;
- the Git commit and command or parameters used to generate the outputs.

Native Google Sheets, Docs, or Slides are not hashable as live mutable objects.
Before ingestion, export them to a stable file format such as CSV, TSV, XLSX,
JSON, or PDF, then hash the exported bytes and record the Drive file ID plus the
export MIME type.

### Hash Timing

Hash at these boundaries:

1. immediately after downloading or exporting a source file;
2. after writing each raw snapshot;
3. after each normalise, clean, deduplicate, review-queue, or export stage;
4. after copying or uploading to durable storage, using the durable bytes where
   possible;
5. before any accepted dataset changes a public map, density product, or master
   rebuild.

If a file is compressed, hash the stored compressed bytes and record the
compression format. If downstream code needs the uncompressed record stream, add
an optional `content_sha256` for a canonical uncompressed representation.

### Global Partitioning

Global data should be partitioned before it becomes large enough to be awkward:

- by `dataset_family`, for example `osm-pow`;
- by snapshot date, using the fixed annual anchor where applicable;
- by pipeline stage: `raw`, `normalised`, `cleaned`, `deduplicated`,
  `review_queue`, `accepted`, or `public`;
- by `country_code` for country products;
- by tile or grid only when country partitioning is too coarse for review or
  map serving.

Each country partition needs its own file hashes and row/feature counts. A
global rollup manifest should list all country partition manifests and aggregate
counts, rather than storing one opaque global file as the only recovery unit.

### Supersession

Never overwrite an immutable version. If a script, source, cleaning rule,
schema, or manual decision changes, create a new `dataset_version_id` and mark
the old manifest as superseded by the new one. The old durable files may be
retained or lifecycle-managed later, but the manifest must remain sufficient to
explain what changed.

### Near-Term Requirement

Before the next serious data run is used for Convex task generation, RA review,
analysis, or public products, add manifest validation around the run. The first
implementation can be small: compute file SHA-256 values, row/feature counts,
the generating Git commit, and a manifest hash for the NZ OSM annual extraction.
The same convention should then be applied to global country partitions.

## Implementation Milestones

### Milestone 1: NZ Hash Manifest

Before the 2026-05-07 NZ OSM annual extraction is used for any task generation,
create a tracked manifest that validates against
`schemas/data-manifest.schema.json`. The manifest should record the candidate
CSV, candidate GeoJSON, generated manifest, and any retained raw snapshot files.
It should include byte counts, SHA-256 hashes, row or feature counts, the
generating Git commit, command, and validation notes.

### Milestone 2: Manifest Validation Command

Add a repository command that validates data manifests against
`schemas/data-manifest.schema.json`. The command should be usable locally and in
continuous integration once CI is configured. The current templates have valid
JSON syntax, but schema validation is not yet automated in the repository.

### Milestone 3: Pipeline Integration

Update extract, normalise, clean, deduplicate, review-queue, and export scripts
so each stage emits or updates a manifest. A stage may consume local cache
files, but it must record input manifest IDs and output hashes. This makes the
global pipeline replayable by country and stage.

### Milestone 4: Global Rollup Manifests

Once country manifests exist, add a global rollup manifest per snapshot date.
The rollup should contain aggregate counts and references to country partition
manifests, not a single unpartitioned global artefact as the only recovery
handle.

## NZ OSM Annual Extraction

The 2026-05-07 strict New Zealand annual OSM extraction currently exists as
ignored local output under `data/intermediate/nz_osm_temporal/`. The run is
documented in `JOURNAL.md` and `docs/development/nz-osm-temporal-cleaning.md`,
but the generated files still need promotion to durable storage before they are
used as an input to RA task generation or analysis.

Required promotion before use:

1. copy the candidate CSV, candidate GeoJSON, manifest, and any raw snapshot
   files needed for reproducibility to the project working store or durable
   archive;
2. compute SHA-256 checksums after upload/export;
3. add a tracked manifest recording object/file IDs, counts, checksums, source,
   script, parameters, and Git commit;
4. mark the dataset as `intermediate_lead`, not accepted evidence;
5. only then curate a smaller RA task set or import leads into Convex.

## Operational Workflow

For each data-producing run:

1. Run the script into an ignored local cache.
2. Inspect counts, warnings, and a sample of rows.
3. If the output is not useful, delete or leave it as disposable cache.
4. If the output may be reused, upload or copy it to durable project-controlled
   storage.
5. Generate checksums and counts from the durable copy or exported file.
6. Commit a manifest and, where useful, a journal note.
7. Downstream scripts consume either the durable copy or a local cache restored
   from the durable copy, never an undocumented local-only file.

## Current Defaults

- RA-facing working files: project-controlled Google Drive.
- Live task coordination: Convex.
- Local processing cache: ignored `data/` and `exports/`.
- Durable reference for future staging and object storage: Google Cloud.
- Public map/data products: generated only from reviewed exports and tracked
  committed app data.

This document deliberately does not add another storage provider. The immediate
problem is recoverability and provenance, not provider proliferation.
