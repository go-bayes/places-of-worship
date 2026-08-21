# Defining a place of worship: decision note and discussion topic

Date: 2026-08-22. Status: discussion draft; the rulings marked **RULING** include pre-filled recommendations that become the decision unless overruled, and section 6 lists the questions the team is still working through. Origin: a team question about what the project counts as a place of worship, raised while the taxonomy of standard and edge cases is being built. Scope: the definition itself, the threshold that makes it operational, a site-category attribute that lets several classes of site co-exist in the master record, and the rulings on the edge categories that have come up so far.

## 1. What the project says now

The project holds three statements of the object. They do not quite agree. `LEXICON.md` defines a **Place Of Worship** as "a site where worship use occurs or occurred. It may be a church, mosque, temple, synagogue, meeting house, prayer room, shared building, or other locatable place used for worship", layered on a **Mappable Site**, "the physical place we can put on a map: a building, parcel, compound, point, or locality", which is the lowest unit of analysis and holds the `site_id`. `schemas/site.schema.json` describes a site as a "persistent location (parcel/compound) where religious activity occurs, distinct from structures and organisations". The lexicon says *worship use*; the schema says *religious activity*. The difference decides exactly the edge cases the team is asking about, because a retreat centre, a Masonic lodge, and a wāhi tapu all host religious activity while none hosts a congregation.

Three operational rules are consistent across the lexicon, the pilot task description, the triage guide, and the evidence template, and they stand. First, the object is the worship *function*, not the building: "do not treat a visible building as proof of worship use; we are tracking the worship function of the site, not only whether a building exists" (`docs/ra-nz-pilot-task.md:346`). Building existence and worship use are recorded in separate fields, and a target year is `present` only when a source supports active worship use in that year. Second, shared and multi-purpose buildings count while the use persists: a school hall used on Sundays is a place of worship. Third, the unit is the site; several congregations at one site are one `site_id`, and denomination and shared use are attributes of it.

Beneath these statements lies a fourth, extensional definition, and it is the one the team may in practice be meeting. The current map's intake is OSM `amenity=place_of_worship` (`docs/data-pipeline-architecture.md:45`), with a fallback that accepts `building` values in `{church, chapel, mosque, synagogue, temple, cathedral, shrine}` and marks anything else `weak_worship_tags` (`scripts/build_nz_verification_tasks.py:120`). A place of worship on the live map is therefore whatever OSM mappers tagged as one. The storage-pipeline register already records the consequence for Vanuatu, where the tag pulls in nakamals alongside churches and the density metric is "places of worship as OSM records them".

## 2. The problem

The lexicon definition is deliberately inclusive and sets no threshold. "Occurs or occurred" admits a single service; "used for worship" says nothing about whether a community gathers, how often, or whether the public can attend. That silence was harmless while the pilot worked through OSM-tagged churches, because OSM mappers had already applied a threshold of their own. It stops being harmless once the candidate-site lane brings in heritage registers, denominational directories, and open POI corpora, each with its own notion of the category, and once users of the public map start asking why an airport prayer room and a cathedral are the same kind of dot.

A single inclusion boundary would not solve this, because the edge cases are not errors to be filtered out. A prison chapel holds recurring services for a congregation that cannot choose to be elsewhere; a retreat centre holds worship for a community that changes every week; an airport prayer room is used constantly and by nobody in common. Each is a legitimate research object for some question and noise for another. The right response is to record the class of site as data and let the question choose the filter, rather than to rule each case in or out of the master record.

## 3. The definition and its threshold

- **RULING A — the definition.** Recommendation: *A place of worship is a mappable site at which religious worship is practised on a recurring basis by or for a community, as evidenced by a source.* The three qualifiers do the work that the current definition leaves undone. *Recurring* excludes the one-off service and the venue hired once. *By or for a community* admits the congregation, the resident religious community, and the institution's population, and excludes private domestic devotion. *Evidenced by a source* restates the project's standing rule that the master record holds source-backed claims and nothing else. The canonical term remains **worship use**; `schemas/site.schema.json` should adopt it in place of "religious activity" so that the three statements of the object agree. The definition is time-indexed, as the lexicon's "occurs or occurred" already is: a site that met the definition in 1950 and ceased in 1975 stays in the master record with its worship use ended, which is what the target-year and lifecycle fields exist to record.

The threshold on *recurring* is left qualitative on purpose. A weekly rule would exclude the annual pilgrimage site and the monthly rural service that are the substance of the historical record; a lower rule is hard to evidence. An RA judges recurrence from the source as they already judge worship use, and the `uncertain` value exists for the cases that do not settle.

## 4. Categories that co-exist: a site-category attribute

- **RULING B — record the class of site rather than gate on it.** Recommendation: add a `site_category` attribute to the accepted site record, enforced by validator, with the master record holding every category and the public map and research outputs filtering. The inclusion decision becomes a reversible data value instead of an irreversible intake gate; a user who wants only sites with congregations switches off the other categories; the annual census of change (see the vocabulary decision doc, section 7) is unaffected by which filter a consumer applies, because the category is an attribute of the site rather than a criterion for its existence. Category belongs on the site, not the structure: whether a building is purpose-built or a shared hall is a fact about the structure (`schemas/structure.schema.json`) and the shared-use vocabulary already records part of it.

The proposed categories follow one axis, the kind of community the worship serves, because that axis is what the team's examples (airport prayer rooms, retreat centres, prison chapels) all vary on. Five values, pre-filled; the taxonomy in progress may collapse or split them.

| `site_category` | Meaning | Standard examples |
| --- | --- | --- |
| `congregational` | A congregation or community gathers here for recurring worship open to that community. The standard case and the default filter for the public map. | Church, mosque, temple, synagogue, gurdwara, Salvation Army corps, a congregation meeting in a hired hall |
| `institutional` | A chapel or prayer room within a host institution, serving that institution's population. Access is set by the host. | Hospital, airport, university, school, prison, and military chapels; multi-faith rooms |
| `residential_religious` | Worship by a resident religious community, or by visitors on retreat. | Monastery, convent, ashram, retreat centre |
| `devotional` | Individual or occasional devotion at a fixed site with no congregation. | Shrine, grotto, wayside cross, memorial chapel, pilgrimage site without regular services |
| `ceremonial_venue` | Religious ceremonies held on demand rather than recurring congregational worship. | Funeral, cemetery, crematorium, and wedding chapels |

A site takes one primary category. A cathedral with a pilgrimage shrine is `congregational`; the shrine is evidence in the note until the taxonomy decides whether secondary functions are worth a field. A change of category is a lifecycle event: a congregational church that becomes a funeral chapel is `use_changed` with a date, and the category it moves to is the value the census of change reports.

### Edge-case rulings so far

Each row states the pre-filled ruling and its reason. The rows marked *consult* are the ones on which the project should not rule alone.

| Case | Ruling | Reason |
| --- | --- | --- |
| Prison chapel | Include, `institutional` | Recurring services for a defined community; restricted access is a property of the host, not of the worship. The example the team raised; the category records it rather than arguing about it. |
| Airport, hospital, university prayer rooms | Include, `institutional` | Recurring use for the institution's population; excluded from the default public filter. |
| Retreat centre, monastery, convent | Include, `residential_religious` | Recurring worship by a community, resident or rotating. |
| School with a chapel | The chapel is `institutional`; the school is not a site | The unit is the place of worship, not the institution that contains it. |
| Congregation in a hired hall, cinema, or community centre | Include, `congregational` | Standing rule: shared buildings count while the use persists. A move is a site-level closure and opening, which the census of change reports as churn; that is the correct consequence of a site-based unit. |
| Closed or converted church | Stays in the record; worship use ended | The definition is time-indexed; the target-year and lifecycle fields record the ending. |
| Home church | Exclude unless a source evidences recurring communal worship at the address | Mostly unrecordable under the project's privacy rule on personal details; the rare evidenced case is `congregational`. |
| Masonic and similar lodges | Exclude | Not religious worship by the body's own description. |
| Salvation Army corps, citadels | Include, `congregational` | Hold recurring worship meetings; the hall's social-service function is an attribute. |
| Religious bodies without theistic worship (Buddhist meditation centres, for example) | Include where recurring communal religious practice is held, by the body's self-description | Worship is defined in the body's own terms; `schemas/denomination-taxonomy.json` handles classification. |
| Humanist and secular assemblies | Exclude | Non-religious by self-description. *Consult* if the team wants the comparison class. |
| Marae | Exclude by default; a marae-based congregation is `congregational` | A marae is a community institution at which karakia is integral, not a place of worship in the sense the definition gives. Rātana and Ringatū worship, and Māori Anglican and Catholic pastorates, are congregational sites in their own right wherever they meet. *Consult*: this ruling needs Māori advice before it is applied, and it is the one most likely to change. |
| Wāhi tapu and other sacred sites | Record only with the relevant iwi or hapū's agreement; exclude from the public map by default | Public location of sacred sites can breach cultural protocol regardless of licence. *Consult.* |
| Nakamal (Vanuatu) | Exclude unless a church uses it | A social and political institution; its presence in the OSM extract inflates the Vanuatu density metric, and the category lets the intake keep the record while the filter drops it. |
| Open-air shrines and roadside memorials | Include, `devotional` | Fixed, locatable, recurring individual devotion. |

## 5. Consequences for existing rules

Four things change if rulings A and B stand. The site schema's description changes to the canonical term. The intake filter's `weak_worship_tags` warning becomes a category assignment step: `amenity=place_of_worship` is evidence for `congregational` pending review, and the `building` fallback set is evidence for a structure, not a site. The Vanuatu density metric is recomputed on the `congregational` filter once the OSM nakamals are categorised, and its register row is updated. And the definition and its category list acquire a version, because a change to either is a re-baseline of the annual census of change in the same way that a vocabulary change is.

## 6. For discussion

The team is building the taxonomy of standard and edge cases, and the rulings above are inputs to it rather than a substitute for it. The open questions are these.

1. Whether five categories on one axis is the right shape, or whether the taxonomy wants a second axis (purpose-built versus shared, public versus restricted access) recorded as separate attributes.
2. Whether a site holds one primary category or several, and if several, how the public filter and the census of change treat a site whose categories overlap.
3. What the public map shows by default: `congregational` only, or everything, with the filter offered.
4. Who rules on the rows marked *consult*, and on what timeline, given that the Māori and Pacific rulings bear directly on the New Zealand pilot and the Vanuatu layer.
5. Whether the recurrence threshold stays qualitative or the taxonomy wants a stated minimum, and if so what evidence an RA could be expected to find for it.
