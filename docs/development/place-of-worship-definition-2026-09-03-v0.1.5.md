# Operational definition of a place of worship

Version: 0.1.5. Date: 2026-09-03. Status: adopted working operational definition. This dated snapshot preserves version 0.1.5. The [canonical operational definition](../operational-definition.md) presents the current version.

**At a specified time, a place of worship is a reproducibly mappable site for which source evidence supports recurring religious worship by or for a community.**

## Criteria

A site meets the definition when source evidence supports all three criteria:

1. **Reproducibly mappable site.** Preserved location evidence allows investigators to identify the same physical place at the spatial precision required by the study. The site may be a building, parcel, compound, room, adapted or shared venue, temporary structure, or natural place.
2. **Recurring religious worship.** Evidence supports repeated or established worship use. Weekly services, seasonal practice, and an established annual pilgrimage may each qualify. Uncertain recurrence remains provisional. For the census-year derivation, a recorded period of worship at any known frequency establishes the place as in use for the years it covers, and each such year also carries a level of use: regular (weekly or more, monthly, or several times a year) or intermittent (annual or occasional). Only a period whose frequency of use is uncertain covers its years without establishing use; those years derive as uncertain until a reviewer decides on the evidence (rulings R-F1 and R-F1′, 2026-09-03).
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

## Revision note (0.1.4 → 0.1.5)

Amendment R-F1′ (JB, later on 2026-09-03, applied in place because the version had not yet been cited outside the repository): the derivation threshold below is revised. Presence is an epistemic status; an annual service is certain knowledge of rare use, and rarity can be the significance. A period of annual or occasional use therefore derives present, at the intermittent level of use, with the same certainty as regular use; only an uncertain frequency derives an uncertain presence. The level of use (regular or intermittent) is a second derived field per census year, confirmed with the presence and exported beside it. The paragraph that follows records the original ruling and stands as history.

This revision states the frequency threshold for the census-year derivation (JB ruling R-F1, 2026-09-03, `docs/development/function-chain-brief-2026-09-02.md`). Version 0.1.4 admitted seasonal practice and an established annual pilgrimage as recurring worship without saying how a recorded frequency bears on a census year. Version 0.1.5 keeps that admission for the definition and fixes the derivation: regular, monthly, and several-times-a-year use establishes a place of worship in use for the years a period covers; annual, occasional, and uncertain use covers them without establishing it, so those years derive uncertain and reach a recorded state only by reviewer decision. The rule is deliberately conservative: an annual service in a deconsecrated building keeps the fact in the data with an honest derived state rather than losing it from every product. Identity over time, the one-place-at-a-time constraint, accepted states, event derivations, study populations, and earlier estimates are unaffected; a study that treats annual worship as in use states that choice and re-derives from the recorded frequency.
