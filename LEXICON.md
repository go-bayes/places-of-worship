# Places of Worship Lexicon

This lexicon explains project terms in plain language. The audience is potential contributors.

The preferred style is to be concrete and to avoid jargon terms.  We try to name the thing a person can see or do. For example we use
"shared online task map/list" rather than "task layer";  rather than "export bundle"; "cloud storage path" rather than "URI".

## Preferred Plain Language

| Avoid or limit | Prefer                                             | Meaning                                                                                |
| -------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| task layer     | shared online task map/list                        | The live map/list where RAs and reviewers see what needs checking.                     |
| URI            | cloud storage path, Drive file ID, or web link     | A durable address for a stored file.                                                   |
| bundle         | file set, reviewer download                        | Several CSV/JSON files downloaded together for checking.                               |
| curator        | project reviewer, or person with export permission | The person who reviews or freezes data for the next step.                              |
| lead           | place to check, possible opening/closure row       | A clue that needs review before it becomes data.                                       |
| lifecycle      | opening, closure, and change dates                 | Dates about worship beginning, ending, moving, demolition, or changed use.             |
| local cache    | temporary working files                            | Files on a working computer that are disposable and not the project record.            |
| manifest       | file record                                        | A tracked record describing where a data file lives, its checksum, source, and status. |

Some code and spreadsheet column names still use older terms such as
`lifecycle_event`, `curator`, `bundle`, or `intermediate_lead`. Treat those as
technical labels, we are aiming for clearer reporting language now. Public, RA-facing, and report-facing
prose should use the preferred terms above unless a code value must be quoted.

## Core Research Terms

### Research Assistant (RA)

A person who checks tasks and records source-backed evidence. An RA can say
what a source shows; project review decides whether that evidence changes the
master record.

### Project Reviewer

The person who reviews submitted evidence and decides whether it should be
accepted, rejected, returned for more evidence, or marked for later. Some
backend code may call this role a `curator`; in prose, prefer "project
reviewer" or "person with export permission".

### Place Of Worship

At a specified time, a place of worship is a reproducibly mappable site for which source evidence supports recurring religious worship by or for a community. Accepted records may preserve earlier worship use after it ends, with the worship-function state and its time bounds held in distinct fields.

### Mappable Site

The physical place that preserved location evidence allows independent project workers to identify at the spatial precision required by the study. It may be a building, parcel, compound, room, shared or temporary venue, or natural place. This is the lowest-level unit of analysis; the `site_id` identifies this unit.

### `site_id`

The project's durable identifier for an accepted mappable site. It is not the
same as an OSM id, a congregation id, or a building id.

### Candidate Site

A possible new place of worship that has not yet been accepted into the master
record. It may later become an accepted `site_id`, be matched to an existing
site, or be rejected.

### Worship Use

Whether source evidence supports recurring religious worship by or for a community at the site at a specified time. A building can exist without current worship use, and worship use can occur in a shared, adapted, temporary, multi-purpose, or natural setting.

### Target Year

A year we explicitly care about for analysis. For the New Zealand pilot, the
main target years are 2013, 2018, and 2023. Each target-year status should be
recorded as `present`, `absent`, `uncertain`, or `not_assessed`.

### Opening, Closure, And Change Dates

Source-backed dates that tell us when something changed. Examples include when
worship began at a site, when worship use ended, when a building was opened,
when a site was first or last seen in a source, when a congregation moved, or
when a place became shared or multi-denominational.

### Density

A research summary showing places of worship relative to an area or population,
for example places per square kilometre or places per 10,000 residents. Density
estimates should use reviewed data, not raw map differences.

## Map And Review Terms

### Current Map

The public or regional map as it currently appears. It is useful for inspection,
but it is not automatically a historical truth source.

### Verification Task Map

The New Zealand map used to select places for checking. The current public demo
does not save data. It helps RAs produce spreadsheet-ready rows until the shared
backend is wired.

### Shared Online Task Map/List

The planned authenticated task system, likely using Convex for the pilot. It
will show the same task status to multiple people: open, claimed, skipped,
provisionally done, needs review, reviewed, or reopened.

### Add A Missing Place (Nomination)

The portal action for telling the project about a place of worship that is
not on the map. The contributor locates the place (by searching a name or
address, typing coordinates, or dropping and dragging a pin on the map),
then records what they know. The nomination goes to human review as a
candidate site; it does not change the public map. Some code and older
documents call this flow `Nominate missing PoW`; treat that as a technical
label.

### Task

One thing to check. Examples: confirm a current place, investigate a possible
duplicate, check whether a place existed in 2013, or review a possible missing
site.

### Provisional Done Status

A temporary status saying an RA believes a task has been handled. It helps
avoid duplicate work, but it does not update the master map or research data.

### Reviewer Download

A frozen set of files, usually CSV or JSON, taken from the shared task map/list
so the project can validate and review submitted evidence.

### Project Review

The step where a project reviewer accepts, rejects, asks for more evidence, or
marks a task for later. Only reviewed decisions should move toward the master
record.

## Data Terms

### Source Evidence

The material supporting a claim: a directory, church-body record, OSM history,
Street View image, archived website, field observation, charity record, or other
source.

### OpenStreetMap (OSM)

A volunteer-built global map. OSM is a major source for current places of
worship and some date information, but it is evidence to check, not automatic
truth.

### OSM Id

The identifier used by OpenStreetMap for a mapped object. It helps us match and
audit source evidence, but it does not define the project's `site_id`.

### OSM Date Tags

OSM fields such as `start_date`, `old_start_date`, and `end_date`. These can
suggest openings, closures, or possible target-year states, but they may refer
to a building, organisation, dedication, or mapper interpretation rather than
worship use.

### Places-To-Check File

A generated CSV or GeoJSON file listing possible issues for review. Example:
places present in one OSM year but not another, or places with OSM opening or
closure date tags.

### CSV

A spreadsheet-like text file. It is useful because spreadsheets, R, Rust, and
other tools can all read it reliably.

### JSON

A structured text format used by software. It is good for nested records and
review logs.

### GeoJSON

JSON with map geometry. It stores points, lines, polygons, and properties so a
map can display the data.

### Geometry

The mapped shape or position of a site: usually a point, building outline,
parcel, or compound. Geometry can be corrected without necessarily changing the
site identity.

### Checksum Or Hash

A fingerprint of a file's exact bytes. If the file changes, the checksum
changes. We use checksums to prove that later analysis used the intended file.

### File Record (Manifest)

A small tracked record that says what a dataset is, where the durable copy
lives, who made it, what source it came from, how many rows it has, its
checksum, licence/privacy status, and whether it is raw, staged, accepted, or
public.

## Storage Terms

### Temporary Working Files

Files created while scripts run. They may live under ignored folders such as
`data/intermediate/` and can be deleted or regenerated. They are not a safe
storage location and should not be given to RAs as the source of truth.

### Project-Owned Google Drive

The near-term place for shared working files, spreadsheets, PDFs, and review
materials. Native Google files should be exported to CSV, JSON, PDF, or another
stable format before hashing or ingestion.

### Google Cloud Storage

A durable cloud file store for large or important files, especially raw
snapshots, reviewed exports, and rebuild inputs. Use this when Drive is too
fragile or too mutable for the data.

### Cloud Storage Path

The address of a file in cloud storage. It is the plain-language replacement
for "URI" in most project documents.

### Database

A structured store for records that need to be queried or updated. We should
only add database complexity when files and the shared task map/list are not
enough.

## Workflow Terms

### Validation

Automatic checks that a row or event has the right columns, dates, controlled
vocabulary, and required fields. Validation can reject bad format, but it does
not decide whether a historical claim is true.

### Staging

The holding area for evidence or proposed changes before they are accepted.
Staged data can be checked, compared, and reviewed without changing the master
map.

### Approved Change

A reviewed change that can be used to rebuild the master record. Examples:
worship use appeared, worship use disappeared, denomination changed, location
corrected, duplicate merged, or source evidence superseded an earlier claim.

### Approved Change Summary

A machine-readable and human-readable summary of approved changes: what changed,
which files and events were used, which target years are affected, and what
hashes make the result reproducible.

### Master Record

The governed project record from which public maps, downloads, and research
outputs are rebuilt. RAs and public users should not write directly to it.

### Rebuild

The process of regenerating maps, tables, and downloads from approved changes
and stored source files. Rebuilds make outputs reproducible.

## Tools And Systems

### `pow`

The Rust command-line tool for governed data modification. It validates,
stages, proposes, and compares evidence before anything reaches the master
record.

### Rust

The programming language preferred for strict validation, staging, rebuilding,
and other governed data-modification steps.

### R

The main language for research analysis, summaries, density estimates, plots,
and reports.

### Convex

The candidate backend for the shared online task map/list. In the pilot,
Convex should coordinate tasks, evidence drafts, review decisions, and reviewer
downloads. It must not be the master record.

### API

A controlled way for a map, script, or tool to ask a backend to do something,
such as save a draft or validate a row. An API should check permissions and
validate input.

### Backend

The server-side part of the system: authentication, shared task status,
validation, storage, review decisions, and exports.

### Frontend

The user-facing map or web page that RAs, reviewers, or public users see.

### Authentication

The sign-in process. For the pilot, Google sign-in through Convex is the
preferred simple route if deployment checks confirm it works. Sign-in proves
who someone is; project roles still decide what they are allowed to do.

## Status Labels

### `present`

The evidence supports that worship use was present at the target date.

### `absent`

The evidence supports that worship use was absent at the target date.

### `uncertain`

The evidence is relevant but does not settle the target-year status.

### `not_assessed`

No judgement has been made yet.

### `provisional`

Useful for coordination or triage, but not yet reviewed enough for research
outputs.

### `accepted`

Reviewed and allowed to enter the governed research record.

## Reporting Rules

1. Say "evidence suggests" or "place to check" for unreviewed OSM or RA rows.
2. Say "approved change" only after project review.
3. Say "temporary working files" for local ignored data.
4. Say "project-owned storage" when a durable copy exists outside a personal
   laptop.
5. Say "shared online task map/list" when describing the Convex pilot.
6. Say "master record" for the governed data used to rebuild public maps and
   research outputs.
