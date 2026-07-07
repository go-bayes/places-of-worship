# Places of Worship

This is a research project for mapping places of worship and studying religious and cultural variation across space and time.

Our long-term aim is to build a research portal for Places of Worship (PoWs) that can track opening, closure, persistence, relocation, shared use, and repurposing at the level of the place itself, linking such place information to other historical data relevant to testing theories about the social consequences of religion.  The public map is an active prototype (i.e. not yet fully polished). The lowest-level analytical unit is a mappable place of worship with
worship-function state, thus not merely a building record and not necessarily a congregation as a social group.

Building historical datasets fit for scientific inferences is remarkably difficult because the historical records are diffuse and incomplete. Somewhat inconveniently our ancestors were not carefully documenting everything we'd want to know. Indeed,  in most cases, they didn't document anything.  Having build a prototype global location map, we're focussing on New Zealand and Vanuatu, two very different island settings, to establish the feasibility of scientific work on religion that uses PoWs as the smallest units of analysis.  

## Links

- [Global map](https://www.placesmap.org/)
- [Australia regional map](https://www.placesmap.org/apps/regions/au/)
- [Ireland regional map](https://www.placesmap.org/apps/regions/ie/)
- [New Zealand regional map](https://www.placesmap.org/apps/regions/nz/)
- [Brazil regional map](https://www.placesmap.org/apps/regions/br/)
- [Mexico regional map](https://www.placesmap.org/apps/regions/mx/)
- [United Kingdom regional map](https://www.placesmap.org/apps/regions/uk/)
- [United States regional map](https://www.placesmap.org/apps/regions/us/)
- [Vanuatu regional map](https://www.placesmap.org/apps/regions/vu/)
- [Roadmap](ROADMAP.md)
- [Country survey](research/country-survey.md)
- [System map](docs/system-map.md)
- [FAQ](FAQ.md)
- [Lexicon](LEXICON.md)


## Who reads what

Instructions are audience-addressed under [docs/people/](docs/people/):
[research assistants](docs/people/ra/), [JW](docs/people/jw/), and
[Guy](docs/people/guy/). The public/private rule lives there too.

## Ongoing Work

- **[RA assignment: New Zealand 50-case workpack](https://www.placesmap.org/apps/regions/nz/verification.html)**
- **[Reviewer portal: New Zealand submitted evidence](https://www.placesmap.org/apps/regions/nz/review.html)**,
  currently authorised for JB and JW only.
- **[Vanuatu source-first test portal](https://www.placesmap.org/apps/regions/vu/verification.html)**
- **[Reviewer portal: Vanuatu submitted evidence](https://www.placesmap.org/apps/regions/vu/review.html)**,
  currently a test surface over the shared review layer.



## Data

The project uses OpenStreetMap data for the preliminary global map. We thanks the OpenStreetMap community for
the base global places-of-worship data. 

We also use public statistical and boundary data, including Statistics New Zealand data where documented in the
relevant data products.

OpenStreetMap-derived databases are distributed under the Open Database Licence
(ODbL 1.0), consistent with OSM licence terms.

## Project Team

The main project is includes Professor Joseph Bulbulia (Victoria University of
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
