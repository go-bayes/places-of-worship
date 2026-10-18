# Edge cases

This register records real places that test the project's rules. A case belongs here when a place met in the field, in the portal, in review or in correspondence exposes a gap or a strain in the [operational definition](operational-definition.md), the data model, or the path from evidence to the public map. The definition's worked examples illustrate its rules; the cases here are the evidence those rules must survive.

Each entry records what happened, which rule the case tests, how the project handled it, and what it implies. When a case leads to an adopted rule, the entry links to the rule, and the rule's own document carries the authority.

## Adding an entry

- Number entries in order (`EC-001`, `EC-002`, …) and never reuse a number.
- Record public facts only: place names, public addresses, source identifiers and dates. A correspondent or informant appears as "a correspondent" unless they have agreed to be named. Personal details never enter this file (see [`docs/people/README.md`](people/README.md)).
- Cite sources a reader can check: OpenStreetMap object identifiers, tileset names, registers, published pages.
- Keep the status current: `open` while a decision or a fix is pending, `resolved` once the record and any rule are settled.

### Template

```markdown
## EC-NNN: <place>, <locality>, <country>

- Found: <date and how the case came to light>
- Status: open | resolved
- Tests: <the rules or parts of the system the case tests>

**What happened.** …

**Why it is hard.** …

**Handling.** …

**Implications.** …
```

## EC-001: Wayside Baptist Church, Kendall, Florida, United States

- Found: 13 October 2026, when a correspondent looked for the church on the live United States map; checked 16 October 2026.
- Status: open.
- Tests: identity (correction or new place), the temporal model (a change in the world or a change in our knowledge), and the path from a reviewed correction to the public map.

**What happened.** A correspondent looked on the live United States map for Wayside Baptist Church at 7701 SW 98th St, Kendall (Miami-Dade County), and could not find it. On 16 October we found OpenStreetMap node [358729928](https://www.openstreetmap.org/node/358729928), named "Wayside Church" and tagged `amenity=place_of_worship` and `religion=christian` with no denomination, in the live tiles (`places-v2-20260722-grid`). The node sits about 87 m from the church building. The building itself is OpenStreetMap relation [6474428](https://www.openstreetmap.org/relation/6474428), tagged only `building=church`, without a name; it is absent from our tiles, which carried no multipolygon relations in a sample of the surrounding area. The correspondent confirmed on 16 October that the node is the church.

**Why it is hard.** Three separate questions meet in one dot.

1. *Identity.* The congregation has not moved; the source point sits beside its building. Under the [operational definition](operational-definition.md) (version 0.1.6) this is one place of worship at one site, so the right record is a correction of the existing place, not a new place. A contributor who pins the building and nominates a missing place would create a near-duplicate. The portal's proximity check (150 m) lists nearby tasks already loaded in the portal; it does not list tile dots, so the Wayside dot appears only on the map beside the pin, and the contributor must recognise it there.
2. *Time.* A correction recorded in 2026 changes what we know, not what happened. If the project compares one year's dataset with the next, the corrected location and denomination must not read as a 2026 change in the world.
3. *Publication.* A reviewed correction reaches the public map only through the dated-places file. Its points show with the census panel on, either with points set to "period", which hides every tile dot, or with points set to "all" when the selected census year lies more than 15 years in the past. The map has no way to hide the single tile dot that a correction replaces, so wherever tile dots show, the old position stays until the tiles are rebuilt.

**Handling.** Pending. The proposed record is a revision of the existing place: the location moved onto the building and the denomination set to Baptist, with the church's own public pages and street-level imagery as sources, each cited with its address, retrieval date and, for imagery, the provider and capture date. The correspondent's confirmation identifies the place but is not cited as evidence. Correcting the OpenStreetMap node at its source would also help every user of those data; that is a public edit and a decision for the project lead. How a reviewed correction should replace a tile dot on the public map is an open design question.

**Implications.** OpenStreetMap error here takes two forms: a point placed beside the building, and generic labels (`religion=christian`, a shortened name). The two forms bias different estimates. An offset matters for an area count only when it carries a place across an area boundary, so its effect grows as the areas shrink. A missing denomination drops the place from its denomination's count at every scale. Which form dominates in a given analysis depends on the scale of its areas and on how many places lack a denomination.
