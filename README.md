# Places of Worship

This is an open research project for mapping places of worship and studying religious
and cultural variation across space and time.

Our long-term aim is a reproducible research portal that can track opening,
closure, persistence, relocation, shared use, and repurposing at the level of
the place itself, linking such place to historical data relevant to testing theories about the social consequences of religion  The public map is an active prototype (i.e. not yet fully polished).

## Links

- **[RA assignment: New Zealand 50-case workpack](https://www.placesmap.org/apps/regions/nz/verification.html)**
- **[Reviewer portal: New Zealand submitted evidence](https://www.placesmap.org/apps/regions/nz/review.html)**,
  currently authorised for JB and JW only.
- **[Vanuatu source-first test portal](https://www.placesmap.org/apps/regions/vu/verification.html)**
- **[Reviewer portal: Vanuatu submitted evidence](https://www.placesmap.org/apps/regions/vu/review.html)**,
  currently a test surface over the shared review layer.
- [Global map](https://go-bayes.github.io/places-of-worship/index.html)
- [New Zealand regional map](https://www.placesmap.org/enhanced-places.html)
- [Roadmap](ROADMAP.md)
- [System map](docs/system-map.md)
- [FAQ](FAQ.md)
- [Lexicon](LEXICON.md)

## Current Work

New Zealand serves as a proof-of-concept for temporal validation. Vanuatu is
now beginning as a source-first test, with spreadsheet submissions routed into
the same Convex-backed review layer rather than treated as accepted data. The
pilot task map can save evidence drafts, provisional task status, and reviewer
queues directly.

The evidence workflow collects source-backed information about:

- places of worship present or absent in 2013, 2018, and 2023,
- missing or duplicate mapped sites,
- closures and changes of use,
- apparent building absence, demolition, or bad geometry,
- denomination or tradition changes,
- shared buildings and multi-purpose sites,
- uncertainty that requires reviewer judgement.

See `research/vanuatu-case-analysis.md`.

## Scope

The lowest-level analytical unit is a mappable place of worship with
worship-function state, not merely a building record and not necessarily a
congregation as a social group.

## Data

The project uses OpenStreetMap data and thanks the OpenStreetMap community for
the base global places-of-worship data. We also use public statistical and
boundary data, including Statistics New Zealand data where documented in the
relevant data products.

OpenStreetMap-derived databases are distributed under the Open Database Licence
(ODbL 1.0), consistent with OSM licence terms.

Large, private, or generated data are not tracked directly in Git. See
[docs/data-storage-pipeline.md](docs/data-storage-pipeline.md) for the storage
policy: local ignored data is cache only, and reusable datasets need durable
project-controlled storage plus tracked manifests.

## Project Team

The project is led by Professor Joseph Bulbulia (Victoria University of
Wellington, New Zealand) and Dr Joseph Watts (University of Canterbury, New
Zealand). We thank Nick Young at the University of Auckland Centre for
eResearch for the initial inspiration.

This work is supported by a Templeton Religion Trust subgrant
(TRT-2022-30666).

## Contribution Status

This repository is not currently accepting pull requests while the data
contracts, research-assistant workflow, and map products are stabilising.
Research assistants should follow the agreed map-first pilot and shared backend
workflow rather than submitting GitHub changes.

Public corrections to places of worship should generally be made through
OpenStreetMap itself, following OpenStreetMap's own contribution rules and
licence requirements.

See [ROADMAP.md](ROADMAP.md) for planned phases, [PLANNING.md](PLANNING.md)
for current implementation priorities, [FAQ.md](FAQ.md) for plain-language
answers about site identity, task generation, and staged review, and
[LEXICON.md](LEXICON.md) for preferred project terms. Maintainer references
include the [documentation health check](docs/documentation-health-check.md),
the [Convex function inventory](docs/api/convex-functions.md), the
[workflow script catalogue](docs/api/workflow-scripts.md), and the [UI style
guide](docs/ui-style-guide.md).


## Note

The `pow` Rust CLI provides local validation, staging, proposal, and reviewer
diff reports. Convex coordinates live RA and reviewer task state; accepted data
still has to pass through `pow` before it can affect the master or public map.
