# Joining the private research tier

The project keeps assembled census data in a private tier for the
team's own analysis and publications, because the project does not
redistribute source data (design and classification rules:
`docs/data-access-and-research-tiers.md`). This page states the steps;
membership itself is JB's grant.

## What you get

- **`pow-research` (GitHub, private)**: R analysis workflows,
  harmonised-dataset builders, small derived tables, and manifest
  pointers to bucket objects.
- **`gs://pow-research-data/` (GCS, private)**: the data itself, under
  two prefixes — `raw_sources/` (source-of-record files as retrieved)
  and `research_datasets/` (harmonised, analysis-ready tables).

## The steps

1. JB invites you to the `go-bayes/pow-research` repository and grants
   bucket access under your own Google account (the same identity you
   use for the project's task portals). Every data access is an
   identifiable person; there are no shared keys.
2. Accept the GitHub invitation and clone the repository.
3. `gcloud auth login` with that Google account.
4. `./pull-data.sh <prefix>` (for example
   `./pull-data.sh research_datasets/vu_census_extracts`) fetches the
   objects a workflow needs; verify each object's SHA-256 against its
   public manifest in `docs/manifests/`.
5. Work locally. New build products go back with
   `./push-data.sh <local-dir> <prefix>`, and each new object gets
   recorded in the relevant public manifest.

## The rules

- Do not copy bucket contents to shared drives or send them by email;
  the tier exists so the team can analyse without redistributing.
- Papers cite the sources of record and the public manifests.
  Supplementary data releases contain only what each source's licence
  permits, assessed against the manifest classification at submission
  time. When in doubt, JB rules.
