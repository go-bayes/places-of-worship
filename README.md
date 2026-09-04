# Places of Worship

This research project maps places of worship and studies religious and cultural variation across space and time.

## Operational definition

[**At a specified time, a place of worship is a mappable site with evidence of recurring communal religious worship.**](docs/operational-definition.md)

A site meets the operational definition when source evidence supports all three criteria:

1. **Reproducibly mappable site**
2. **Recurring religious worship**
3. **Worship by or for a community**

Our long-term aim is to build a research portal for places of worship (PoWs) that can track opening, closure, persistence, relocation, shared use, and repurposing at the level of the place itself. These site histories can be linked to other historical data when evaluating theories about the social consequences of religion. The public map is an active prototype under development. The lowest-level analytical unit is a mappable place of worship with a time-indexed worship-function state. Buildings, organisations, and congregations are distinct objects linked to that site.

Building historical datasets fit for scientific inference is remarkably difficult because the records are diffuse and incomplete. Somewhat inconveniently, our ancestors documented only a fraction of what we would now like to know. Having built a prototype global location map, we are focusing on New Zealand and Vanuatu, two very different island settings, to establish the feasibility of scientific work on religion that uses PoWs as the smallest units of analysis.

## Links

- [Global map](https://religionmap.org/)
- [Australia regional map](https://religionmap.org/apps/regions/au/)
- [India regional map](https://religionmap.org/apps/regions/in/)
- [Ireland regional map](https://religionmap.org/apps/regions/ie/)
- [New Zealand regional map](https://religionmap.org/apps/regions/nz/)
- [Brazil regional map](https://religionmap.org/apps/regions/br/)
- [Canada regional map](https://religionmap.org/apps/regions/ca/)
- [Mexico regional map](https://religionmap.org/apps/regions/mx/)
- [Portugal regional map](https://religionmap.org/apps/regions/pt/)
- [Romania regional map](https://religionmap.org/apps/regions/ro/)
- [Slovakia regional map](https://religionmap.org/apps/regions/sk/)
- [South Korea regional map](https://religionmap.org/apps/regions/kr/)
- [United Kingdom regional map](https://religionmap.org/apps/regions/uk/)
- [United States regional map](https://religionmap.org/apps/regions/us/)
- [Vanuatu regional map](https://religionmap.org/apps/regions/vu/)
- [Roadmap](ROADMAP.md)
- [System map](docs/system-map.md)
- [FAQ](FAQ.md)
- [Lexicon](LEXICON.md)
- [Religious change in the census-religion corpus](docs/religious-change-highlights.md)
- [Using the census-religion data](docs/using-the-census-religion-data.md)


## Project audiences

Instructions are audience-addressed under [docs/people/](docs/people/): [JB](docs/people/jb/), [research assistants](docs/people/ra/), [JW](docs/people/jw/), [Guy](docs/people/guy/), and [RW](docs/people/rw/). The public/private rule lives there too.

## Ongoing Work

- **[RA assignment: New Zealand 50-case workpack](https://religionmap.org/apps/regions/nz/verification.html)**
- **[Reviewer portal: New Zealand submitted evidence](https://religionmap.org/apps/regions/nz/review.html)**, currently authorised for investigators and RAs. 
- **[Vanuatu source-first test portal](https://religionmap.org/apps/regions/vu/verification.html)**
- **[Reviewer portal: Vanuatu submitted evidence](https://religionmap.org/apps/regions/vu/review.html)**, currently a prototype surface over the shared review layer.



## Data

The project uses OpenStreetMap data for the preliminary global map. We thank the OpenStreetMap community for the base global places-of-worship data.

We also use public statistical and boundary data, including Statistics New Zealand data where documented in the relevant data products.

OpenStreetMap-derived databases are distributed under the Open Database Licence (ODbL 1.0), consistent with OpenStreetMap's licence terms.

## Licence

The project's original code, documentation, map pages, manifests, derived summaries, and figures are licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/). The licence requires attribution and ShareAlike distribution and limits use to non-commercial purposes.

Source data retain their own licences, recorded per product in provenance manifests held in the project's private research tier during the work phase. Each map page states its source, construct, and licence position; collaborators may request the manifest detail. Where a source licence requires different terms, including CC BY-SA or ODbL, those terms govern the product. See [LICENSE.md](LICENSE.md) and [docs/data-access-and-research-tiers.md](docs/data-access-and-research-tiers.md).

## Project Team

The project team includes Professor Joseph Bulbulia (Victoria University of Wellington, New Zealand), Dr Joseph Watts (University of Canterbury, New Zealand), and Professor Robert Woodberry (Baylor University, United States), who contributes the historical mission-station data and reviews it. We thank Nick Young at the University of Auckland Centre for eResearch for the initial inspiration.

This work is supported by a Templeton Religion Trust subgrant (TRT-2022-30666).

## Contribution Status

During stabilisation, contribution intake runs through the agreed map-first pilot and shared backend workflow. The maintainers will reopen external pull requests after the data contracts, research-assistant workflow, and map products stabilise.

Public corrections to places of worship should generally be made through OpenStreetMap itself, following OpenStreetMap's own contribution rules and licence requirements.

See [ROADMAP.md](ROADMAP.md) for planned phases, [FAQ.md](FAQ.md) for plain-language answers about site identity, task generation, and staged review, and [LEXICON.md](LEXICON.md) for preferred project terms. Planning and decision records live in the project's private research tier during the work phase. Maintainer references include the [documentation health check](docs/documentation-health-check.md), the [Convex function inventory](docs/api/convex-functions.md), the [workflow script catalogue](docs/api/workflow-scripts.md), and the [UI style guide](docs/ui-style-guide.md).


## Note

The `pow` Rust CLI provides local validation, staging, proposal, and reviewer diff reports. Convex coordinates live RA and reviewer task state; accepted data passes through `pow` before it can affect the master or public map.
