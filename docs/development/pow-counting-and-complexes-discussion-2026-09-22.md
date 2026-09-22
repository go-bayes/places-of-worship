# Counting places of worship within coherent complexes

Date: 2026-09-22. Status: public discussion of the direction agreed with the project lead. The examples clarify the intended counting unit; the general rule for identifying a coherent complex still needs operational criteria. This discussion precedes a versioned revision of the [operational definition](../operational-definition.md) and the corresponding implementation.

Update, 2026-09-22: [version 0.1.6 of the operational definition](place-of-worship-definition-2026-09-22-v0.1.6.md) adopted the rule that a move to a new site begins a new place of worship, so the Transitional Cathedral has its own identifier, and adopted the shared-room and distinct-chapel examples. The four operational questions below remain open, and the implementation still follows the earlier rule.

## The proposed counting unit

A place of worship (PoW) is counted at the level of a mappable worship place or coherent worship complex. Once that spatial unit is defined, it has one PoW identifier at a given time. Communities, religious affiliations, rituals, and internal structures describe the PoW and can change through time. Multiple affiliations or rituals within the same unit do not multiply its PoW count.

Worship “by or for a community” establishes the community relationship in the definition. The community may assemble, visit separately, or be represented by a person conducting worship on its behalf. A shared prayer room can therefore be a multi-faith PoW. Its communities, private prayer, last rites, and other qualifying rituals are attributes of its use.

A coherent worship complex can include buildings, rooms, altars, and outdoor worship spaces. By contrast, a larger facility serving another purpose can contain distinct PoWs. A hospital's roof or ownership does not by itself unite its chapels into a worship complex. The proposed distinction depends on the relationship between the worship spaces, with examples needed to make that relationship reproducible.

## Examples of the intended unit

The examples below specify the assumed relationship between the spaces. The identifier column counts distinct PoWs retained in the record. An active-site count additionally depends on activity at the observation time and the investigator's declared threshold. The examples specify hypothetical arrangements and their counting consequences.

| Arrangement | PoW identifiers | Attributes or relationships to preserve |
| --- | --- | --- |
| A hospital prayer room shared by Muslims and Catholics | 1 | Multi-faith use, communities served, rituals, schedules, and activity estimates. |
| A hospital with a distinct Catholic chapel and a distinct Muslim prayer room | 2 | Each worship space's location, community relationships, rituals, and activity history; the shared hospital context. |
| A shared prayer room used by different communities at different times of day | 1 | Time-specific use and affiliation within the same place. |
| A cathedral containing several altars | 1 | Altars and their ritual uses as components of the cathedral. |
| A temple repeatedly demolished and rebuilt within the continuing worship site | 1 | Dated structures, orientations, rituals, and active, inactive, or uncertain periods. |
| Three adjacent temple buildings forming a coherent worship complex | 1 | Building-level differences in ritual and recurrence within the complex. |
| A convent whose worship rooms form a coherent worship complex, or a modern worship complex containing several buildings | 1 | Internal worship spaces and their changing activities. |
| Two adjacent, independently established worship places that form distinct complexes | 2 | Distinct PoWs, with any shared ownership or community relationships recorded. |
| Two distinct hospital chapels whose locations are known only to the same hospital centroid | 2 | Evidence of distinct spaces, uncertainty about their locations, and the basis of the representative point. |

Distinct hospital chapels and internal convent worship rooms expose the boundary that needs clarification. Physical separation between rooms can occur within a coherent worship complex or between distinct PoWs. Religious difference also occurs in either arrangement. Additional examples should explain why the spaces form a complex and where comparable neighbouring spaces remain distinct.

## Persistence and activity through time

A PoW retains its identifier through rebuilding and inactive periods. Changes in building fabric, orientation, or ritual use become dated attributes. Demolition switches the complex's worship activity off only where qualifying worship ceases throughout the complex; worship may continue in another component. Unknown activity remains distinguishable from an evidenced inactive period.

A transfer of worship to a distinct replacement venue links different PoWs. In the cathedral example, the original cathedral retains its identifier while inactive, and a distinct temporary cathedral has its own identifier. If the original reopens while worship continues at the replacement venue, both can contribute to the active-site count. If the replacement venue ceases worship, its identifier remains available for its recorded history. Temporary use alone does not make the replacement venue the same PoW.

Movement within the same operationally defined worship complex can retain the PoW identifier. Changes in the complex's footprint and the locations of its components can be dated. The parameters for distinguishing an internal change, an expansion, and a separate replacement venue remain to be specified.

## Mappable places with uncertain geography

A PoW can be mappable at a coarser resolution than a building. A named spatial unit and a documented representative point, such as its centroid, can express the available location evidence for a specified period. The record should identify the spatial unit, its boundary version where available, the basis of the representative point, and the location uncertainty.

The geographical extent of a PoW and uncertainty about its location are different properties. A hospital centroid used for a chapel does not make the entire hospital a PoW. Coincident representative points can describe distinct worship spaces, while different source coordinates can describe components of the same complex. Identity requires evidence about the places represented by those coordinates.

## Operational questions for coherent complexes

The phrase “coherent worship complex” states a direction that still needs an example-based boundary rule. Four operational questions remain open.

1. **The first operational question concerns complex membership.** Which evidence establishes that worship spaces belong to the same complex? Candidate evidence includes descriptions of a recognised precinct, shared facilities, physical organisation, and historical continuity. Adjacency, affiliation, ownership, and a common roof each require context.
2. **The second operational question concerns change in the complex boundary.** When does a new building extend an existing complex, and when does it establish another PoW? Examples should include expansion onto adjacent land, intervening roads, changes in property boundaries, and a temporary venue that continues after the original reopens.
3. **The third operational question concerns component activity.** How should investigators derive a complex's activity level when its components have different rituals and recurrence rates? The frequency of activity anywhere in the complex and the total number of distinct worship occasions are different measures. Summing component estimates can duplicate a ceremony described for several spaces.
4. **The fourth operational question concerns unresolved membership.** How should reviewers represent evidence consistent with either a shared complex or distinct PoWs? Retain the alternatives, their evidence, and confidence so investigators can assess the consequences for counts. A count must avoid including a complex and its internal components as additional PoWs at the same observation time.

Each added example should describe the spatial arrangement, community relationships, evidence of complex membership, and relevant time period. Record the proposed identifier count, its rationale, and the information that would change the judgement. Contrasting examples should vary the relationship at issue so readers can see why the count changes.

## Entry review and analysis

Contributors estimate worship activity for the reported place, specify its temporal coverage, and record confidence and supporting evidence. Component details can be recorded when known. Entry should remain usable without an exhaustive inventory of internal spaces or a decision about a study's counting threshold. Reviewers assess identity, complex membership, and what the evidence supports.

Activity estimates can be associated with years, decades, or bounded periods while retaining their temporal meaning. Activity somewhere within a decade differs from activity throughout that decade. Frequency and confidence also remain distinct: confidently evidenced annual worship is low-frequency activity, while an uncertain estimate of weekly worship has a different evidential status.

Investigators declare an activity threshold and an uncertainty treatment when deriving counts. Each qualifying PoW contributes at most once at the observation time. Retained frequency categories support the distinctions they record; exact totals of worship occasions require corresponding event or rate evidence. Changes to component attributes can be studied alongside counts of PoWs.

## Relation to the current definition and workflow

The [current operational definition](../operational-definition.md#identity-over-time) allows a PoW identifier to follow relocation and allows several PoWs at a site. The [occupancy specification](occupancy-build-brief-2026-09-02.md) likewise treats relocation as continuity under the same identifier. The direction discussed here instead gives distinct replacement venues their own identities and counts shared use within an operationally defined place as attributes of that PoW. A later revision must reconcile the meaning of “site”, complex membership, and relocation across the definition, entry, review, and export contracts.

The canonical and dated definitions need consistent guidance on worship frequency. The [dated definition's amendment](place-of-worship-definition-2026-09-03-v0.1.5.md#revision-note-014--015) distinguishes known annual or occasional use from uncertain use, whereas the canonical definition still reproduces the earlier derivation threshold. A coordinated revision should preserve the distinction between activity and confidence. Publication of this discussion does not change accepted identifiers, observations, or implemented counting rules.
