# RA NZ Web Pilot Task

This is the current task guide for the New Zealand research-assistant (RA) web
pilot.

## Start Here

Your main task is to test the map-first evidence workflow. Start with the New
Zealand verification map, inspect one case at a time, find source evidence, and
record what the evidence supports in the working spreadsheet.

The command-line tool is not part of the default RA workflow for this pilot.
The project team will handle validation unless they explicitly ask otherwise.

In practical terms:

1. Open the NZ verification task map.
2. Open the shared working spreadsheet link supplied by the project team. This
   is where your work is saved.
3. Choose a target year: 2013, 2018, or 2023.
4. Sample one task from the demo map, using the map, filters, or priority list.
5. Check the links and search for source evidence.
6. Decide what kind of case it is: confirmed site, missing site, duplicate,
   closure, changed use, shared use, or uncertain.
7. Record the evidence in the working spreadsheet. If you are using demo mode,
   use `Copy spreadsheet row` to create a draft row, then review it in the
   sheet.
8. If a place is missing from the map, use the draft nomination panel to
   capture the candidate details and record the evidence in the spreadsheet.
9. Mark uncertain cases `needs_review` and move on.
10. Tell the project team when the spreadsheet rows are ready, and include notes
   on confusing cases.

Do not submit pull requests, commit files, edit repository templates, or put
private/restricted source material into GitHub. Nothing entered in the demo map
is saved or submitted.

## Where Your Work Is Saved

The map demo does not save anything. It only helps you inspect a case and, in
demo mode, copy a draft row.

Your saved work lives in a project-controlled Google Sheet in the project
team's private Google Drive workspace. The project team will send you the sheet
link directly. Do not look for the sheet in GitHub, and do not add the link to
GitHub.

Each case you work on should become one row in that spreadsheet. For the NZ
pilot, expect a project-owned sheet named `NZ PoW RA Pilot Working Sheet` with
`site_evidence_wide` as the main evidence-entry tab.

At the end of the work period, either:

1. leave the completed rows in the shared spreadsheet and tell the project team
   they are ready, or
2. if asked, export the active sheet/tab as CSV and send that file through the
   agreed project channel.

In Google Sheets, CSV export is:

1. open the evidence-entry tab,
2. choose `File > Download > Comma-separated values (.csv)`,
3. save the file,
4. send the CSV to the project team if requested.

Do not upload the CSV to GitHub. The project team will validate, stage, and
review the data separately.

## What This Pilot Is For

We are not trying to finish New Zealand in this first pass. We are trying to
learn how the save, evaluate, review, and merge-track workflow should work
before we scale up.

The best use of RA time is to sample real tasks from the demo map and tell us
where the workflow is clear or slow. We need examples that test the full
workflow: straightforward confirmations, missing lifecycle dates, duplicates,
missing current sites, places present in 2013 but absent by 2018, and shared or
changed-use sites.

## Goal

Sample a small, high-value set of demo-map tasks that helps the project team
design the save, evaluate, review, and merge-track flow. Do not try to
exhaustively check New Zealand yet.

A useful pilot row has:

- a clear map task or candidate place,
- a source title and source link or agreed file reference,
- a short evidence note,
- target-year status for any year the source supports,
- uncertainty marked clearly where the source does not settle the issue,
- no private contact details or restricted source material.

## Main Rule

Start from the map, not the CLI.

Use the UI and working spreadsheet. Do not run command-line validation,
staging, or proposal commands unless the project team explicitly asks.

## Links

- NZ verification task map (lands in demo mode by default):
  <https://www.placesmap.org/apps/regions/nz/verification.html>
- Read-only feedback view (no action builder):
  <https://www.placesmap.org/apps/regions/nz/verification.html?demo=0>
- Detailed case guide:
  `docs/ra-map-triage-guide.md`

## Sampling Tasks From The Demo Map

Unless the project team assigns a specific set of sites, sample tasks directly
from the demo map. Prioritise variety over volume. A useful session might
include:

- a few high-priority current map records,
- a few records with missing or ambiguous lifecycle dates,
- an apparent duplicate if one is easy to find,
- a current place of worship missing from the map if evidence appears quickly,
- a possible site present in 2013 but absent by 2018,
- a denomination-change, shared-building, or multi-use case,
- one or two low- or medium-priority controls.

There is no fixed row target for the demo-map sampling phase. Do not spend a
large amount of time on one difficult case unless it is unusually important.
Mark it `needs_review`, explain the uncertainty, and move on.

## Step-By-Step Workflow

1. Open the NZ verification task map.
2. Use the default action-builder view. If the page opens in read-only mode,
   ask the project team before continuing.
3. Choose the target year you are checking: 2013, 2018, or 2023.
4. Use the map, priority list, and target-year status filters to choose one
   case.
5. Click the task on the map or in the list.
6. Inspect the task panel: name, master id, OpenStreetMap id, address,
   denomination or tradition, lifecycle tags, automated checks, and links.
7. Open source links in new tabs and search for evidence.
8. Decide which action best fits the evidence.
9. Record the evidence in the working spreadsheet. If using demo mode, click
   `Copy spreadsheet row`, paste it under the spreadsheet header, and review
   the pasted row.
10. For a place missing from the map, use the draft nomination panel and record
    the same source evidence in the spreadsheet.
11. Mark unclear cases `needs_review`.
12. Add a short note on any confusing user-interface or source problem.
13. Move to the next case.

## Choosing The Action

Use the closest action available in the map action builder:

- `Confirm current site`: source supports the existing map record.
- `Missing current site`: source supports a current place of worship that is
  not on the map.
- `Possible duplicate`: two or more mapped records may represent one site.
- `Present in 2013, absent in 2018`: source supports worship use in 2013 and
  non-use, closure, demolition, or changed use by 2018.
- `Closed or changed use`: source suggests worship use ended or the building
  changed function.
- `Denomination/shared use`: source suggests denomination change, shared
  building, multiple congregations, or multi-purpose use.
- `Needs review`: the evidence is relevant but does not settle the case.

Use `needs_review` freely. The pilot is designed to find difficult cases, not
to force final decisions.

## Target-Year Status

For 2013, 2018, and 2023, use:

- `present`: source supports active worship use in that target year.
- `absent`: source supports absence, closure, changed use away from worship, or
  no worship use in that target year.
- `uncertain`: source is relevant but does not settle the target-year status.
- `not_assessed`: you did not assess that target year from this source.

Do not treat a visible building as proof of worship use. We are tracking the
worship function of the site, not only whether a building exists.

## Sources To Try First

Use public or project-approved sources:

- official place or congregation website,
- denominational directory or yearbook,
- OpenStreetMap object and history,
- street-level imagery such as Google Street View, Apple Look Around,
  Mapillary, KartaView, or similar services,
- RA field observations where the project team has approved the visit and
  storage rules,
- aerial imagery,
- Charities Services or incorporated-society records,
- local council, heritage, or property records,
- archived web pages,
- local histories or directories where licence and access are acceptable.

For each source, record enough information for someone else to find it again:
source type, source title, URL or agreed file reference, retrieval date, and a
short evidence note.

For street-level imagery, record the provider, URL, displayed capture date, and
what was visible. Do not save or upload screenshots. For RA field observations,
record the visit date and site-level observation only; do not record private
conversations, personal contact details, photos, or videos unless explicitly
approved.

Do not paste private contact details, restricted files, or raw uploaded source
material into GitHub or the public repository.

## What To Send Back

At the end of the assigned work period, send the project team:

1. the updated working spreadsheet or exported CSV,
2. a short list of confusing cases,
3. a short list of map or spreadsheet fields that slowed you down,
4. any cases that seem important but require reviewer judgement.

Do not send a pull request. Do not commit files to the repository.

## When To Stop And Ask

Stop and ask the project team if:

- a source appears private, restricted, or licence-sensitive,
- the only evidence is personal information,
- a case requires more than about 10 to 15 minutes and still remains unclear,
- two sites may be separate congregations sharing a building,
- a historical source gives a congregation but no usable location,
- you are unsure whether a building, organisation, or worship site is being
  described.

These are useful findings. Mark them clearly rather than resolving them by
guesswork.
