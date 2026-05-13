# Places of Worship

An open research project for mapping places of worship and studying religious
change across space and time.

The long-term aim is a reproducible research portal that can track opening,
closure, persistence, relocation, shared use, and repurposing at the level of
the place itself. The public map is an active prototype, not a finished
reference product.

## Links

- [Global map](https://go-bayes.github.io/places-of-worship/index.html)
- [New Zealand regional map](https://www.placesmap.org/enhanced-places.html)
- [New Zealand verification task map](https://www.placesmap.org/apps/regions/nz/verification.html)
- [Roadmap](ROADMAP.md)
- [System map](docs/system-map.md)
- [Planning](PLANNING.md)
- [Brainstorming](BRAINSTORMING.md)
- [FAQ](FAQ.md)
- [Lexicon](LEXICON.md)
- [RA NZ web pilot task](docs/ra-nz-pilot-task.md)

## Current Work

New Zealand is the proof-of-concept country for temporal validation. The pilot
is moving from spreadsheet copy/paste to a Convex-backed task map that can save
evidence drafts, provisional task status, and reviewer queues directly. The
spreadsheet export remains a fallback while the backend is being configured.
The evidence workflow collects source-backed information about:

- places of worship present or absent in 2013, 2018, and 2023,
- missing or duplicate mapped sites,
- closures and changes of use,
- denomination or tradition changes,
- shared buildings and multi-purpose sites,
- uncertainty that requires reviewer judgement.

Vanuatu is the first active Pacific case after New Zealand. It starts with a
source-first protocol rather than immediate map validation at scale; see
`research/vanuatu-case-analysis.md`.

The `pow` Rust CLI provides local validation, staging, proposal, and reviewer
diff reports. Convex coordinates live RA and reviewer task state; accepted data
still has to pass through `pow` before it can affect the master or public map.

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
[LEXICON.md](LEXICON.md) for preferred project terms.
