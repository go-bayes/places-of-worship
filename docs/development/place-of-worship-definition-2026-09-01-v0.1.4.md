# Operational definition of a place of worship

Version: 0.1.4. Date: 2026-09-01. Status: adopted working operational definition. This dated snapshot preserves version 0.1.4. The [canonical operational definition](../operational-definition.md) presents the current version.

**At a specified time, a place of worship is a reproducibly mappable site for which source evidence supports recurring religious worship by or for a community.**

## Criteria

A site meets the definition when source evidence supports all three criteria:

1. **Reproducibly mappable site.** Preserved location evidence allows investigators to identify the same physical place at the spatial precision required by the study. The site may be a building, parcel, compound, room, adapted or shared venue, temporary structure, or natural place.
2. **Recurring religious worship.** Evidence supports repeated or established worship use. Weekly services, seasonal practice, and an established annual pilgrimage may each qualify. Uncertain recurrence remains provisional.
3. **Worship by or for a community.** Worship occurs by or for a congregation, resident religious community, or defined institutional population. *For* admits worship conducted on a community's behalf: a chaplaincy serving a hospital, prison, or military population, or a ritual specialist performing worship for a community that does not assemble as a congregation. The criterion therefore does not presuppose that the community is the agent of worship. Restricted access is compatible with community use.

Private devotion, religious affiliation, sacred significance, religious architecture, an organisation's address, and a one-off ceremony are candidate evidence assessed against all three criteria. Privacy, access, and cultural rules govern collection, storage, and publication.

## Identity over time

A place of worship persists through change. It may relocate, be burnt down and rebuilt, or replace every particle of its original construction and remain the same place of worship; its identity was never lodged in the material fabric. What a place of worship cannot do is be in two places at once.

Identity reaches the map through dated occupancy records. At any moment of its recorded existence, a place of worship occupies one mappable location, and the map at a given time renders each place of worship at its then-current location. The constraint is deliberately asymmetric: a place of worship occupies one place at a time, while one site may host several places of worship, as shared buildings commonly do.

Two examples show how the rule applies. When a community worships in a temporary structure while its building is restored, and then returns, the place of worship remains one unit with one identifier; its occupancy history runs from the original site to the temporary site and back. When recurring collective worship instead continues at both locations — the temporary shrine stays in use after the restored building reopens — the one-place constraint forces a split. Identity follows the continuity of the worshipping community where evidence supports a judgement; a new place of worship begins at the other location, linked to its parent. Each simultaneously active place of worship therefore has its own identifier, and the links preserve the history.

A place of worship is neither a building nor an organisation. An organisation may conduct worship in many places; each mappable place of collective worship is its own unit, and organisations and congregations are recorded as linked entities.

Identity is not observable at a site visit. Whether worship at a location continues an earlier place of worship is an inference from evidence about the community and its practice. The project therefore records identity as an explicit, revisable review decision with a stated basis — same place, relocation, split, merge, or uncertain — and no import pipeline or proximity heuristic settles identity silently.

## Measurement over time

The analytical unit is a place of worship's time-indexed **worship-function state**. Record physical existence, worship use, location, organisations, congregations, timing, and uncertainty as distinct claims. The `site_id` identifies the place of worship rather than a location; dated occupancy records locate the place of worship.

Source records, OpenStreetMap objects, and field observations provide evidence about the worship-function state. Reviewer acceptance establishes supported claims as recorded states and longitudinal events. An accepted record may preserve a time-bounded history after worship use ends. Preserve the source or community description alongside any project classification.

Each study states its target population, observation times, evidence standard, and filters.

## Revision note (0.1.3 → 0.1.4)

This revision restates identity over time (JB ruling, 2026-09-01). Version 0.1.3 lodged identity in the location: `site_id` named the physical place, and a relocated congregation normally linked to a new `site_id`. Version 0.1.4 makes the place of worship a continuant whose identity survives relocation, demolition and rebuilding, and complete material replacement, realised through dated occupancy records under a one-place-at-a-time constraint; splits and mergers are adjudicated review decisions. The superseded relocation rule is withdrawn: an identifier now follows the place of worship through a relocation rather than ending at it. Identifiers created under the earlier rule remain valid; a predecessor–successor link created for a relocation is reread as one place of worship's occupancy history. The temporal-redesign relocation mechanics (ruling D10, 2026-08-31) are reread the same way. Accepted states, event derivations, study populations, and earlier estimates are otherwise unaffected, and identity decisions remain explicit, revisable, and reviewer-adjudicated.
