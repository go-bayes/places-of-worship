# Portal Entry UI Plan

Public direction: `ROADMAP.md`. Detailed active planning and governance records are maintained in the private research tier.

Portal hub: `docs/portal-data-entry-plan.md`.

## Purpose

The entry UI should make source-backed contribution fast while keeping the
security boundary visible. Contributors should be able to identify a site,
select a building or point, add evidence, and submit a staged proposal without
needing to understand the master database.

## Entry Path

Replace the global map's current external correction link with a project action
such as "Fix or modify data". The public link should send the user to managed
authentication. After login, authorised users should land on an authenticated
edit map that looks and behaves like the global map.

For the first pilot:

- limit submission access to invited New Zealand users
- reuse the global MapLibre visual language, basemap defaults, attribution, and
  place layers
- disable clustering in edit and review contexts where individual sites matter
- keep existing OSM links as source context, not the main correction path
- show that submitted data enters review and does not immediately alter the map

## Contributor Workflow

1. Search by address, site name, locality, or longitude/latitude.
2. Pan and zoom on the map as needed.
3. Select an existing point to revise or review a known site.
4. Select a building where the building tile returns one clear candidate.
5. Fall back to point selection when there is no building, multiple buildings, or
   a source only supports approximate placement.
6. Review the selected geometry and source context.
7. Fill a short staged-submission form.
8. Attach an optional internal field-observation packet only after the separate media pilot is enabled.
9. Submit and receive a tracking id.

The building selection should draw a visible outline around the selected
building. If the hit test is ambiguous, the interface should ask the contributor
to choose point mode rather than guess.

## Form Scope

The first form should be short enough for field use:

- proposed action: add, modify, close, reopen, split, merge, flag, or review
- site name and alternative names
- the exact denomination or tradition label where observed, kept separate from the starting project label and any later taxonomy mapping
- who supplied the label: named documentary source, displayed sign or public notice, named public community self-description, local investigator account, or unknown
- the provisional relation to the project record: label only, possible record correction, possible historical change, possible shared or concurrent use, or uncertainty
- current or historical status
- target years affected, especially 2013, 2018, and 2023 for New Zealand
- selected geometry and geometry basis
- source title and URL or agreed file reference
- date evidence, including exact and bounded dates
- direct observation, interpretation, and uncertainty or follow-up as separate guided fields
- optional internal image capture only after the media and sensitivity gates are met

The form should preserve uncertainty. It should allow "known by this date",
"not earlier than", "not later than", approximate locality, and unknown values
without forcing false precision.

The first live repair collects raw-label evidence only. Possible correction, historical-change, or shared-use selections route follow-up; they do not represent a complete denomination revision or event, because those objects require a separate contract for prior and later labels, concurrent groups, and effective dates or bounds. Taxonomy mapping is a versioned reviewer operation, and enabling intake does not enable accepted denomination events in the master.

Device dictation may fill one guided text field at a time, but the contributor must confirm the resulting text before submission. The first pilot retains no audio.

## Vanuatu Rapid Current Entry

The Vanuatu field-entry path should minimise taps without collapsing physical existence into worship use. Its required first question has four answers at an exact observation date: used for worship; place exists but worship use is uncertain; place exists but is not used for worship; or status could not be determined. “Current” is indexed to that observation date, not treated as a timeless property. The server derives provisional existence, worship-use, action, and review fields from that answer; the browser does not supply those derived classifications.

A rapid submission records an exact observation date, an evidence basis, a sensitivity flag, and optional exact denomination wording, direct observation, and uncertainty. A new place also requires a building-accurate point after a nearby-place check. All Vanuatu historical target years remain `not_assessed`; rapid entry must not turn a present observation into evidence for 1989, 1999, 2009, or 2020.

One authenticated mutation should create the candidate task when needed, save the submitted evidence, append audit events, and move the task to human review atomically. Client-generated UUIDs make retries idempotent. Server-side role checks, Vanuatu coordinate bounds, field limits, controlled validators, and per-user and global rate limits apply before a write. The response should immediately re-arm the map for the next place. Detailed historical or complicated cases remain available through the full form.

Images, audio, and public media delivery are outside this path. The later media pilot must keep originals and exact capture metadata in restricted object storage, use Convex only for workflow state and opaque references, and meet the separate media launch gate before upload controls appear.

After submitting rapid or guided evidence in any configured country portal, an RA may choose `Add known history`. The country pages share the New Zealand portal runtime. The same `historical_claim_v1` form therefore applies without country-specific forks. The form records one event or state at a time so structure history, worship function, denomination or affiliation, leadership, and shared use remain separate scientific claims. Each claim retains the source wording or confirmed dictated text, optional partial date bounds, an open-through-reference-date setting for states, confidence and its basis, source or informant details, unresolved date or interpretation limits, and sensitivity. A missing date bound remains missing; wording such as “during the war” must not acquire calendar years without supporting evidence.

The first historical-claim increment performs no AI extraction and stores no audio. Device dictation may fill the retained text field, but the RA must confirm the text before submission. Historical claims remain provisional, appear separately in reviewer inspection, and travel in `historical_claims.jsonl`; they do not alter the parent evidence, assess a target year, create an accepted change event, or update the master or public map.

## Review-Oriented UI Rules

The edit map should remain map-first. Avoid large explanatory panels on the
working surface. Use concise controls, clear disabled states, and confirmation
messages that state whether data was staged, rejected by validation, or saved
only locally in a demo mode.

The reviewer version should show the same site context plus validation warnings,
nearby duplicates, linked OSM objects, linked building geometry, existing master
values, proposed values, and the evidence trail.
