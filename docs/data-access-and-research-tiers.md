# Data access and research tiers

Status: DESIGN by Fable for JB review, 2026-07-07. Prompted by JB's
ruling: census data cannot be shared; the team can use it for its own
analysis and publications.

## The principle

The project separates three things that are usually conflated:

1. **Showing** — map visualisations of derived rates, published where a
   source's terms permit attributed display (per-source rulings: NHGIS
   derived-rates position, VBoS attributed-use position, OGL/CC-BY
   sources permit freely).
2. **Pointing** — telling anyone how to obtain the data themselves from
   the source of record. Always public: the manifests carry URLs, table
   identifiers, and retrieval recipes, and the extraction scripts are
   public code. Reproducibility without redistribution.
3. **Sharing datasets** — handing over assembled census data. The
   project does not do this publicly. Assembled research data serves
   the team's analysis and publications only, inside an authenticated
   private tier.

## Tier map

| Tier | Audience | Contents | Home |
| --- | --- | --- | --- |
| Public map products | everyone | `area_summary` derived rates that feed the live maps, per source ruling; boundaries per their licences | public repo, placesmap.org |
| Public access instructions | everyone | per-country "obtain the data yourself" recipes: source URLs, table ids, licence notes, our extraction scripts | public repo (country cards + manifests) |
| Private research tier | authenticated team | raw source files, verbatim/reformatted source tables, harmonised analysis datasets, research workflows, drafts | private repo + private GCS bucket |
| JB-only | JB | credentials, contacts, personal notes | `.private/` sync (existing) |

## Licence classification rule (per source, recorded in its manifest)

- **Open redistribution licence** (OGL v3, CC BY 4.0: UK, IE, NZ,
  AU, CA...): source extracts MAY stay in the public repo; derived
  products unrestricted with attribution.
- **Attributed-use or unclear** (VBoS/SPC, NHGIS pending the IPUMS
  reply): derived map rates only in public, per the specific JB ruling
  recorded in the manifest; source-table extracts live in the private
  tier.
- **No-redistribution** (IPUMS International microdata, restricted
  archives): nothing public beyond pointers; even derived subnational
  aggregates get a per-source ruling before display.

Open question for JB: the public repo currently tracks source-extract
CSVs for VU (transcribed census tables; attributed-use class). Under
this rule they would RELOCATE to the private tier, with the public repo
keeping only the area summaries the maps consume. Recommend yes.

## The private research tier, concretely

- **Repo**: `pow-research` (GitHub, private; collaborators = JB, JW,
  Guy, RAs as warranted). Holds: R analysis workflows, harmonised
  dataset builders, small derived analysis tables, paper drafts'
  data appendices, and MANIFEST-pointers to bucket objects — never
  large raw files in git.
- **Bucket**: reuse `gs://places-of-worship-private-sync/` with two
  prefixes and distinct IAM: `raw_sources/` (already populated) and
  `research_datasets/` (harmonised, analysis-ready). Access via a
  Google group (e.g. `pow-research-team@`), so authentication is the
  same Google identity RAs already use for Convex; JB grants/revokes
  by group membership.
- **Workflow for a team member**: accept GitHub invite → `git clone`
  private repo → `gcloud auth login` (their own identity) →
  `make pull-data` (a script that fetches named bucket objects and
  verifies manifest SHA-256s) → run R workflows locally. No shared
  service keys; every access is an identifiable person.
- **Publication rule**: papers cite the sources of record and the
  public manifests; supplementary data releases contain only what each
  source's licence permits, checked against the manifest classification
  at submission time.

## Public access instructions (the "pointing" tier)

Each country card gains an **"Access the data yourself"** section
(template addition): source of record, exact table identifiers, licence
summary, link to our public extraction script, and the sentence "This
project does not redistribute source data; the map shows derived rates
with attribution." The manifests already carry retrieval URLs and
hashes; the card section makes them human-followable.

## Migration steps (once JB ratifies)

1. Create `pow-research` private repo; seed with README, the
   data-pull script, and the classification table.
2. Create the Google group; grant bucket IAM (`roles/storage.objectViewer`
   on the two prefixes) to the group.
3. Relocate attributed-use source extracts (VU CSVs) from the public
   repo to `research_datasets/`, leaving area summaries; record the
   move in manifests and changelog.
4. Add the "Access the data yourself" section to TEMPLATE.md and
   backfill live country cards (codex sweep).
5. `docs/people/` gains a team-onboarding page (public: the steps;
   membership itself is JB's grant).

## Decisions JB must ratify

1. Relocate attributed-use source extracts out of the public repo
   (recommended yes; open-licensed extracts stay).
2. Private repo named `pow-research` under the same GitHub owner
   (or JB names otherwise).
3. Team access via Google group + bucket IAM as designed (vs per-user
   grants; group recommended).
4. Who is in the first cohort: JB, JW, Guy (+ RAs per workpack need?).
