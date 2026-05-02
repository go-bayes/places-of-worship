# Portal Entry UI Plan

Planning source of truth: `PLANNING.md`.

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
8. Attach an optional image for quarantine, if the pilot enables upload.
9. Submit and receive a tracking id.

The building selection should draw a visible outline around the selected
building. If the hit test is ambiguous, the interface should ask the contributor
to choose point mode rather than guess.

## Form Scope

The first form should be short enough for field use:

- proposed action: add, modify, close, reopen, split, merge, flag, or review
- site name and alternative names
- denomination or tradition where known
- current or historical status
- target years affected, especially 2013, 2018, and 2023 for New Zealand
- selected geometry and geometry basis
- source URL, file reference, or evidence note
- date evidence, including exact and bounded dates
- optional image upload
- contributor note for reviewers

The form should preserve uncertainty. It should allow "known by this date",
"not earlier than", "not later than", approximate locality, and unknown values
without forcing false precision.

## Review-Oriented UI Rules

The edit map should remain map-first. Avoid large explanatory panels on the
working surface. Use concise controls, clear disabled states, and confirmation
messages that state whether data was staged, rejected by validation, or saved
only locally in a demo mode.

The reviewer version should show the same site context plus validation warnings,
nearby duplicates, linked OSM objects, linked building geometry, existing master
values, proposed values, and the evidence trail.
