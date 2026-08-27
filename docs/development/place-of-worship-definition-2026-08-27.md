# Defining a place of worship: working operational definition

Version: 0.1.0. Date: 2026-08-27. Status: adopted working operational definition. This version governs current measurement design, accepted site records, and longitudinal derivations until a later versioned decision changes it. It does not settle the site-category taxonomy, the target population for every study, or culturally specific access and publication decisions.

## 1. Working definition

**At a specified time, a place of worship is a reproducibly mappable site for which source evidence supports recurring religious worship by or for a community.**

The scientific object is the time-indexed **worship-function state** at the site. A source record, OpenStreetMap object, building, organisation, congregation, or field observation may provide evidence about that state, but none is the state itself.

A site is reproducibly mappable when the preserved location evidence lets independent project workers identify the same physical place at the spatial precision required by the study. The site may be a building, parcel, compound, room, adapted or shared venue, temporary structure, or natural place. A diffuse area may fail the mapping requirement. A private or culturally restricted place may meet the scientific definition while privacy, access, or publication rules restrict its collection, storage, or release.

Recurring means that the evidence supports repeated or established worship use. Evidence of a single event supports only that event. The definition sets no universal frequency threshold: weekly services, seasonal practice, and an established annual pilgrimage may each be recurring. When the available evidence does not settle recurrence, the claim remains uncertain or provisional rather than being converted into an accepted worship-use state.

By or for a community includes congregations, resident religious communities, and defined institutional populations. It does not require unrestricted public access. Private devotion, religious affiliation, sacred significance, religious architecture, an organisation's address, or a one-off ceremony does not alone establish that the site meets the operational definition.

## 2. Conceptual lineage and present narrowing

This working definition develops the candidate concept in JW's 24 August 2026 M1 working draft: “a geographically identifiable physical site used for religious worship or ritual practice”. M1 treats that concept as a broad starting point rather than a final quantitative rule. It usefully separates a physical site from an organisation or belief, requires actual use rather than religious appearance, and argues that local descriptions of practice must be preserved alongside a comparative project classification.

For the present measurement programme, the project narrows that candidate concept in four ways. It requires reproducible mapping rather than geographical identifiability in the abstract; evidence of recurring use rather than any ritual occurrence; worship by or for a community rather than individual devotion alone; and an explicit time index. These restrictions define the current analytical object without claiming that other sacred, ritual, devotional, or culturally important places are unimportant.

The conceptual contribution and the operational decision are therefore distinct. M1 supplies a useful conceptual starting point and comparison dimensions. The versioned project definition determines what is measured as a place-of-worship state in current data products.

## 3. Four operational rules

1. **Distinguish worship function from physical existence.** Evidence of a building establishes a claim about physical existence; current worship use requires its own evidence. Building construction, existence, demolition, and repurposing are distinct claims from the beginning, continuation, or ending of worship at the site.
2. **Apply the functional threshold to every kind of physical setting.** Purpose-built, shared, adapted, institutional, residential, temporary, and natural settings can qualify while source evidence supports recurring worship by or for a community. The type of structure does not decide inclusion.
3. **Give the mappable site the durable identity.** The `site_id` identifies the physical place. Organisations and congregations are linked users of the site. Several congregations may use one `site_id`; a congregation that relocates normally becomes linked to a new `site_id` through relocation evidence.
4. **Preserve local evidence before comparative classification.** Record the community's or source's own description of the place, activity, and participants. Use a distinct field for the project's comparative assessment, including uncertainty, disagreement, access restrictions, and culturally restricted information. The comparative rule must remain explicit and reviewable.

## 4. What enters the record

An accepted site record may preserve the history of a place that met the definition at one time even when its current worship use has ended. For example, a site that supported recurring worship in 1950 and ceased in 1975 remains a site with a time-bounded worship-function history; it is not counted as present after 1975 unless later evidence supports renewed use.

Candidate intake is intentionally broader than accepted classification. An OSM tag, directory listing, building type, sacred-place description, public nomination, or field observation may justify a candidate or review task. Acceptance requires evidence that supports the operational definition at one or more specified times. This distinction allows the project to preserve boundary cases without silently counting them as places of worship.

Study-specific target populations may be narrower than the master historical record. A study may, for example, include only congregational sites, exclude privacy-restricted locations, or require a particular evidence standard. Each protocol must state its population and filter without redefining the underlying site-time worship-function object.

## 5. Consequences for current measurement

The lexicon, FAQ, and site-schema description use this definition. The canonical term is **worship use**; **religious activity** is broader than the measured function.

OSM remains a fallible source frame. `amenity=place_of_worship` and related tags identify records to inspect; they do not establish a project site, a worship-function state, or a longitudinal event. The annual OSM comparison must first describe changes in OSM source records, then resolve identity and review evidence before deriving appeared, disappeared, continued, or changed worship-function states.

The Vanuatu field audit directly evaluates transfer of the rule. It should preserve local terms and observed activities, identify cases that the definition classifies poorly or ambiguously, and report the consequences of any proposed revision for New Zealand, Vanuatu, and the longitudinal census.

Any later change to the definition requires a dated version, a stated rationale, and an assessment of which accepted states, event derivations, study populations, and earlier estimates require reclassification or re-baselining.

## 6. Questions still open

The definition does not by itself decide the best taxonomy for congregational, institutional, residential, devotional, ceremonial, temporary, natural, shared, or restricted-access settings. A `site_category` field remains a design proposal until its axis, values, temporal behaviour, and study filters are specified and implemented in the schema and validator.

The following boundary classes require cases designed to distinguish candidate rules and, where relevant, appropriate Māori, Pacific, or other community advice before general rulings are adopted: marae-based worship; wāhi tapu and other culturally restricted sacred places; Vanuatu nakamals and places described in local terms; domestic worship; individual devotional sites; natural or diffuse ritual landscapes; and ceremonial venues without an established worship community. Consultation may change the operational rule, the evidence protocol, the publication rule, or all three; those are separate decisions and should be recorded separately.

The immediate methodological questions are how recurrence can be evidenced consistently, how mapping precision should vary by study, how uncertainty and disagreement should be represented, and which study-specific filters are justified. These questions refine application of the definition. They do not permit unreviewed source tags or intuitive judgements to become accepted site states.
