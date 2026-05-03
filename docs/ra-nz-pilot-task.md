# RA NZ Web Pilot Task

This is the current task guide for the New Zealand research-assistant (RA) web
pilot.

## Start Here

Your main task is to test the map-first evidence workflow. Start with the New
Zealand verification map, inspect one case at a time, find source evidence, and
record what the evidence supports in the working spreadsheet.

The command-line tool is not part of the default RA workflow for this pilot.
JB will handle validation unless he explicitly asks otherwise.

In practical terms:

1. Open the NZ verification task map.
2. Open the shared working spreadsheet link supplied by JB. This
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
10. Tell JB when the spreadsheet rows are ready, and include notes
   on confusing cases.

Do not submit pull requests, commit files, edit repository templates, or put
private/restricted source material into GitHub. Nothing entered in the demo map
is saved or submitted.

## First Sampling Brief

Open <https://www.placesmap.org/apps/regions/nz/verification.html>, sample
5 to 10 varied cases, and paste the generated TSV rows under the header in the
shared Sheet. Aim for variety: some confirm-current cases, one or two missing
sites, one or two duplicates, one closed or lifecycle case, and one or two
deliberate skips for control. Do not worry about coverage; pick cases that are
informative.

This is the first real test of the page. Tell JB anything that
confuses you: labels you did not trust, fields you were not sure how to fill,
a moment when you were not sure where to click next, or anything that made you
slow down. A note in the session-log `Reason` field, or a message after the
session, both work.

When you paste a row into the Sheet, glance at the first two columns to make
sure they line up with the headers `evidence_row_id` and `collection_batch`.
If they do not, stop and contact JB before pasting more rows.

Use blanks for missing information. Do not type `NA`, `N/A`, or similar
placeholders into open cells. Use dropdown values such as `unknown`,
`uncertain`, `none`, or `not_assessed` only where the Sheet or map gives that
option.

Use date formats exactly: `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. For example,
`2018`, `2018-09`, or `2018-09-01`. If a date is unknown, leave the date cell
blank and explain the uncertainty in the evidence note.

## Where Your Work Is Saved

The map demo does not save anything. It only helps you inspect a case and, in
demo mode, copy a draft row.

Your saved work lives in a project-controlled Google Sheet in the project
workspace. JB will send you the sheet link directly. Do not look for the sheet
in GitHub, and do not add the link to GitHub.

Each case you work on should become one row in that spreadsheet. For the NZ
pilot, expect a project-owned sheet named `NZ PoW RA Pilot Working Sheet` with
`site_evidence_wide` as the main evidence-entry tab.

At the end of the work period, either:

1. leave the completed rows in the shared spreadsheet and tell JB
   they are ready, or
2. if asked, export the active sheet/tab as CSV and send that file through the
   agreed project channel.

In Google Sheets, CSV export is:

1. open the evidence-entry tab,
2. choose `File > Download > Comma-separated values (.csv)`,
3. save the file,
4. send the CSV to JB if requested.

Do not upload the CSV to GitHub. JB will validate, stage, and
review the data separately.

## Avoiding Accidental Duplicate Work

The map can mark a task as `tentatively closed` or `skipped`, but only in the
same browser. This is a local reminder, not a shared saved status.

The shared Sheet is the record of work completed in this pilot. Before spending
time on a task, check whether the Sheet already has a row for the same
`source_record_id` (the map task id), `matched_current_site_id`,
`candidate_site_id`, or `matched_osm_id`.

It is OK for the Sheet to contain more than one row for the same place when the
rows add different evidence. For example, one row might support 2013 status, a
second might support 2018 status, and a third might record a duplicate or
shared-use issue. Do not add another row that repeats the same source and same
claim. If you add another row for a place already in the Sheet, explain what is
new in the evidence note.

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

Sample a small, high-value set of demo-map tasks that helps JB design the save,
evaluate, review, and merge-track flow. Do not try to
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
staging, or proposal commands unless JB explicitly asks.

## Links

- NZ verification task map (lands in demo mode by default):
  <https://www.placesmap.org/apps/regions/nz/verification.html>
- Read-only feedback view (no action builder):
  <https://www.placesmap.org/apps/regions/nz/verification.html?demo=0>
- Detailed case guide:
  `docs/ra-map-triage-guide.md`

## Sampling Tasks From The Demo Map

Unless JB assigns a specific set of sites, sample tasks directly
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
   ask JB before continuing.
3. Choose the target year you are checking: 2013, 2018, or 2023.
4. Use the map, priority list, and target-year status filters to choose one
   case.
5. Click the task on the map or in the list.
6. Inspect the task panel: name, master id, OpenStreetMap id, address,
   denomination or tradition, lifecycle tags, automated checks, and links.
7. Open source links in new tabs and search for evidence.
8. Decide which action best fits the evidence.
9. Use the dropdown fields to record status and confidence. Then record the
   evidence in the working spreadsheet. If using demo mode, click
   `Copy spreadsheet row`, click column A in the next empty row under the
   unchanged spreadsheet header, paste, and review the pasted row. The map
   will mark the task as tentatively closed in this browser; then choose
   another task from the map or list.
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

## Lifecycle And Later Changes

Record useful dates even when they are outside 2013, 2018, and 2023. The
target-year fields answer the census-wave question; the lifecycle/change fields
preserve evidence for later reconstruction.

Use the optional lifecycle or later-change section when a source gives evidence
such as:

- the organisation or congregation was founded,
- worship began at the site,
- the building was opened or dedicated,
- the site was first seen or last seen in a source,
- worship use ended,
- the building was demolished,
- the congregation relocated,
- the site became shared, multi-use, or multi-denominational.

For example, if a source says a church became shared Anglican/Methodist in
2024, choose `Use changed / shared use began`, enter `2024`, set precision to
`Year`, and explain the claim in the lifecycle/change note.

The map can put one structured lifecycle or change date into each copied row.
If the same source gives several distinct dates, copy one row for the main
task, then copy another row for each additional date worth preserving. Use the
note to make clear that the repeated site is intentional.

## Sources To Try First

Use public or project-approved sources:

- official place or congregation website,
- denominational directory or yearbook,
- OpenStreetMap object and history,
- street-level imagery such as Google Street View, Apple Look Around,
  Mapillary, KartaView, or similar services,
- RA field observations where JB has approved the visit and
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
what was visible. Use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` for capture and visit
dates. Do not save or upload screenshots. For RA field observations,
record the visit date and site-level observation only; do not record private
conversations, personal contact details, photos, or videos unless explicitly
approved.

Do not paste private contact details, restricted files, or raw uploaded source
material into GitHub or the public repository.

## What To Send Back

At the end of the assigned work period, send JB:

1. the updated working spreadsheet or exported CSV,
2. a short list of confusing cases,
3. a short list of map or spreadsheet fields that slowed you down,
4. any cases that seem important but require reviewer judgement.
5. the exported session JSON from the `Export session JSON` button at the
   bottom of the `My session` panel. This file is a local session log, not a
   map submission. It records copied and skipped cases, action choices, reason
   notes, timestamps, and the generated TSV rows so JB can reconstruct what
   happened if a paste goes wrong or a case is confusing.

After the first sampling session, answer these five questions:

1. Where did you stop or hesitate?
2. Were any field labels unclear or surprising?
3. Did the workflow steps, `Inspect`, `Decide`, `Evidence`, and `Copy row`,
   match how you actually worked?
4. Did you skip anything for control sampling rather than because you were
   unsure? Include a count and how you communicated it.
5. Did anything paste wrong into the Sheet? If yes, include row numbers.

Do not send a pull request. Do not commit files to the repository.

## When To Stop And Ask

Stop and ask JB if:

- a source appears private, restricted, or licence-sensitive,
- the only evidence is personal information,
- a case requires more than about 10 to 15 minutes and still remains unclear,
- two sites may be separate congregations sharing a building,
- a historical source gives a congregation but no usable location,
- you are unsure whether a building, organisation, or worship site is being
  described.

These are useful findings. Mark them clearly rather than resolving them by
guesswork.
