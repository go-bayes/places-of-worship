# Operational definition of a place of worship

**At a specified time, a place of worship is a reproducibly mappable site for which source evidence supports recurring religious worship by or for a community.**

Current version: 0.1.5. Adopted: 2026-09-03.

The [2026-09-22 discussion of counting places and coherent worship complexes](development/pow-counting-and-complexes-discussion-2026-09-22.md) records the proposed direction for shared rooms, distinct chapels, rebuilding, and replacement venues. Its examples and open boundary questions inform a later revision of this definition.

## Criteria

A site meets the definition when source evidence supports all three criteria:

1. **Reproducibly mappable site.** Preserved location evidence allows investigators to identify the same physical place at the spatial precision required by the study. The site may be a building, parcel, compound, room, adapted or shared venue, temporary structure, or natural place.
2. **Recurring religious worship.** Evidence supports repeated or established worship use. Weekly services, seasonal practice, and an established annual pilgrimage may each qualify. Uncertain recurrence remains provisional. For the census-year derivation, a recorded period of regular (weekly or more), monthly, or several-times-a-year use establishes the place as in use for the years it covers; a period of annual, occasional, or uncertain use covers those years without establishing it, and they derive as uncertain until a reviewer decides on the evidence (ruling R-F1, 2026-09-03).
3. **Worship by or for a community.** Worship occurs by or for a congregation, resident religious community, or defined institutional population. *For* admits worship conducted on a community's behalf: a chaplaincy serving a hospital, prison, or military population, or a ritual specialist performing worship for a community that does not assemble as a congregation. The criterion therefore does not presuppose that the community is the agent of worship. Restricted access is compatible with community use.

Private devotion, religious affiliation, sacred significance, religious architecture, an organisation's address, and a one-off ceremony are candidate evidence assessed against all three criteria. Privacy, access, and cultural rules govern collection, storage, and publication.

## Identity over time

A place of worship persists through change. It may relocate, be burnt down and rebuilt, or replace every particle of its original construction and remain the same place of worship; its identity was never lodged in the material fabric. What a place of worship cannot do is be in two places at once.

Identity reaches the map through dated occupancy records. At any moment of its recorded existence, a place of worship occupies one mappable location, and the map at a given time renders each place of worship at its then-current location. The constraint is deliberately asymmetric: a place of worship occupies one place at a time, while one site may host several places of worship, as shared buildings commonly do.

Two examples show how the rule applies. When a community worships in a temporary structure while its building is restored, and then returns, the place of worship remains one unit with one identifier; its occupancy history runs from the original site to the temporary site and back. When recurring collective worship instead continues at both locations — the temporary shrine stays in use after the restored building reopens — the one-place constraint forces a split. Identity follows the continuity of the worshipping community where evidence supports a judgement; a new place of worship begins at the other location, linked to its parent. Each simultaneously active place of worship therefore has its own identifier, and the links preserve the history.

A place of worship is neither a building nor an organisation. An organisation may conduct worship in many places; each mappable place of collective worship is its own unit, and organisations and congregations are recorded as linked entities.

Identity is not observable at a site visit. Whether worship at a location continues an earlier place of worship is an inference from evidence about the community and its practice. The project therefore records identity as an explicit, revisable review decision with a stated basis — same place, relocation, split, merge, or uncertain — and no import pipeline or proximity heuristic settles identity silently.

A shared representative point is evidence about location alone. Two distinct hospital chapels known only to the same hospital centroid remain two places of worship drawn at the same point; identity requires evidence about the places the point represents (recorded 2026-09-22).

## Measurement over time

The analytical unit is a place of worship's time-indexed **worship-function state**. Record physical existence, worship use, location, organisations, congregations, timing, and uncertainty as distinct claims. The `site_id` identifies the place of worship rather than a location; dated occupancy records locate the place of worship.

Source records, OpenStreetMap objects, and field observations provide evidence about the worship-function state. Reviewer acceptance establishes supported claims as recorded states and longitudinal events. An accepted record may preserve a time-bounded history after worship use ends. Preserve the source or community description alongside any project classification.

Each study states its target population, observation times, evidence standard, and filters.

A country is an index derived from location, never a claim about the place. Each record carries the present-day country under its point, resolved from the location at entry and recoverable from the geometry at any later time; the contributor's own position or the page they opened plays no part. Where a study needs the polity a place stood in at a given date, that is a time-indexed claim recorded with the place's history, distinct from the index (recorded 2026-09-23).

## Version history

Versioned snapshots preserve the rule used by each study: [version 0.1.5](development/place-of-worship-definition-2026-09-03-v0.1.5.md), [version 0.1.4](development/place-of-worship-definition-2026-09-01-v0.1.4.md), [version 0.1.3](development/place-of-worship-definition-2026-08-31-v0.1.3.md), [version 0.1.2](development/place-of-worship-definition-2026-08-27-v0.1.2.md), [version 0.1.1](development/place-of-worship-definition-2026-08-27-v0.1.1.md), [version 0.1.0](development/place-of-worship-definition-2026-08-27.md), and the [version 0.0.1 discussion draft](development/place-of-worship-definition-2026-08-22.md). A later revision records its implications for accepted states, event derivations, study populations, and earlier estimates.

Pending revision (recorded 2026-09-22): the [2026-09-22 discussion of counting places and coherent worship complexes](development/pow-counting-and-complexes-discussion-2026-09-22.md) records a direction that departs from the Identity section on replacement venues. This page also differs from its dated version on two points: the frequency paragraph under Criteria still states ruling R-F1, whereas version 0.1.5 records the amendment R-F1′; and the country-index paragraph under Measurement over time and the shared-point sentence under Identity over time await a dated snapshot. Version 0.1.6 reconciles these in a dated snapshot.
