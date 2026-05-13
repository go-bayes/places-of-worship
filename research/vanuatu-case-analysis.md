# Vanuatu Case Analysis And RA Protocol

This note starts the Vanuatu country case analysis. It is a source-first
protocol for research-assistant (RA) work, not a claim that the current map is
ready for Vanuatu temporal reconstruction.

## Purpose

Vanuatu is the first Pacific country case after New Zealand. The immediate goal
is to learn which sources can support a place-level history of worship use, and
how those sources can be linked to a map without losing uncertainty about
dates, names, localities, or denominational change.

Guy is the research assistant for the first Vanuatu pass. For the first week,
he should work on sources and reporting structure
before validating map points at scale. The existing OpenStreetMap-derived
Vanuatu extract is a useful starting inventory, but it is sparse: the current
local extract contains 233 records, many with missing names or denomination
values. Treat those points as prompts for source discovery, not as accepted
historical records.

## Names And Historical Scope

Use these names when searching:

- Vanuatu
- Republic of Vanuatu
- New Hebrides
- Nouvelles-Hebrides
- Anglo-French Condominium
- ni-Vanuatu churches

The interface and evidence sheet must accept historical dates from **1600
onward**. Most useful worship-site evidence will probably cluster later, but a
wide lower bound avoids redesign when the RA works with colonial and mission
materials.

Record dates only as `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. If a source gives a
season, approximate date, or prose description, put the structured
interpretation in the date field only when it fits one of those formats and
preserve the original wording in the raw-date or evidence-note field.

## Target Years

Use these Vanuatu target years for structured status fields:

- 1989
- 1999
- 2009
- 2020

These years are chosen because the Vanuatu Bureau of Statistics census
reporting compares religion across the 1989, 1999, 2009, and 2020 censuses.
Target-year status should answer whether the source supports worship use at a
site in that year: `present`, `absent`, `uncertain`, or `not_assessed`.

Do not force older historical evidence into a target-year field. Use lifecycle
fields for earlier evidence, such as organisation founding, site opening,
building dedication, first seen, last seen, closure, demolition, relocation, or
changed use.

## First Source Inventory

Start with these public source anchors:

| Source | Use | Notes |
| --- | --- | --- |
| Vanuatu Bureau of Statistics census reports | Census years, population context, and official reporting frame | Start with the 2020 reports and earlier census reports where available. |
| Vanuatu 2020 census religion variable | Religion categories and person-level construct | Useful for denomination vocabulary and area-level comparison, not site locations. |
| Vanuatu Christian Council profile | Denominational leads and council history | Records founding as the New Hebrides Christian Council in 1967 and rename in 1980. |
| Britannica Vanuatu history overview | Historical anchors and search terms | Useful for dates such as European contact, mission activity, condominium, and independence. |
| Denominational directories or yearbooks | Site and organisation evidence | Priority sources once located; preserve exact source year and page/reference. |
| Church websites, archived pages, and annual reports | Current and recent site evidence | Use stable URLs or web-archive references where possible. |
| Street-level or aerial imagery | Location and visible-use checks | Useful where available, but absence of signage is weak evidence for absence. |
| Historical maps and gazetteers | Historical locality and geocoding evidence | Record historical locality separately from modern locality or coordinates. |

Initial denomination and tradition terms to expect from official and council
sources include Anglican, Presbyterian, Catholic, Seventh-day Adventist, Church
of Christ, Assemblies of God, Neil Thomas Ministry / Inner Life Ministry,
Apostolic, customary beliefs, no religion/faith, and other Christian or local
movements. Preserve raw source terms before normalising them.

## Administrative Geography

Begin with national and province-level geography. Current Vanuatu provinces are
Malampa, Penama, Sanma, Shefa, Tafea, and Torba. Record island, locality,
village, mission station, or parish where the source gives it. Do not assume
that a historical locality name maps cleanly to a modern province, island, road,
or coordinate.

For every location judgement, record:

- historical locality as written by the source;
- modern locality or address candidate, if known;
- latitude/longitude only when source coordinates, reliable geocoding, a map,
  or careful manual matching supports them;
- geocoding basis and confidence;
- a note if the match depends on a renamed locality, historical map, or
  uncertain mission station.

## Historical Anchors

Use these anchors to organise source searching and timeline display:

- 1606: early European contact by Pedro Fernandez de Quiros.
- 1768 and 1774: later European navigation and the naming of the New Hebrides.
- 1840s: European missionaries and traders on island fringes.
- 1860s onward: stronger social change and return migration from plantation
  labour networks.
- 1887: Joint Naval Commission.
- 1906: Anglo-French Condominium.
- 1967: New Hebrides Christian Council founded.
- 1980: independence as Vanuatu; Vanuatu Christian Council name adopted.
- 1989, 1999, 2009, 2020: census target years for structured status checks.

These anchors are display and search aids. They are not themselves evidence
that a particular place of worship existed.

## First-Week RA Task

The first week is source reconnaissance. Guy should not try to finish a map
validation pass.

Ask Guy to produce:

1. a source register with 10 to 20 promising Vanuatu sources;
2. notes on source access, licence, date coverage, geography, and whether the
   source gives place-level, organisation-level, or population-level evidence;
3. a first list of named churches, mission stations, congregations, or worship
   sites found in the sources;
4. any exact or bounded dates found, especially founding, opening, dedication,
   first seen, last seen, closure, relocation, and changed-use dates;
5. a short list of historical locality terms or island names that may need
   geocoding review.

Where the RA has enough evidence for a place, one evidence row is useful. Where
the evidence is still broad, source-register notes are enough.

## Evidence Entry Rules

- Record one source-place claim per row.
- Keep building existence separate from worship use.
- Use target-year fields only for 1989, 1999, 2009, and 2020 in Vanuatu.
- Use lifecycle fields for all other useful dates back to 1600.
- Preserve raw denomination, tradition, organisation, place, and locality names.
- Mark uncertain site matches as `needs_review`.
- Leave unknown cells blank. Do not enter `NA` or `N/A`.
- Do not store private contact details, restricted source files, screenshots,
  photos, or videos in Git.

## Interface Implications

The Vanuatu interface should use a country configuration rather than hard-coded
New Zealand years:

```json
{
  "country_code": "VU",
  "country_name": "Vanuatu",
  "target_years": [1989, 1999, 2009, 2020],
  "timeline_min_year": 1600,
  "timeline_anchor_years": [1606, 1768, 1774, 1840, 1887, 1906, 1967, 1980, 1989, 1999, 2009, 2020]
}
```

The time slider should be a review and visualisation tool. It should show
available evidence, reconstructed states, and possible changes; it should not
be the primary way RAs enter dates. Early years with no evidence must display
as `unknown` or `not assessed`, not as `absent`.

## Links To Check First

- Vanuatu Bureau of Statistics census reports:
  <https://vbos.gov.vu/index.php/en/census-and-surveys/census-report>
- Vanuatu 2020 census analytical report volume 2:
  <https://vbos.gov.vu/sites/default/files/2020_Vanuatu_National_Population_and_Housing_Census_-_Analytical_report_Volume_2.pdf>
- Vanuatu 2020 census religion metadata:
  <https://microdata.pacificdata.org/index.php/catalog/769/variable/F17/V1092?name=religion>
- Vanuatu Christian Council profile:
  <https://www.oikoumene.org/organization/vanuatu-christian-council>
- Vanuatu history overview:
  <https://www.britannica.com/place/Vanuatu/History>
