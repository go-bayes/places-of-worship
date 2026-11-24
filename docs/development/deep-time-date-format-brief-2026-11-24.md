# Deep-time dates: design brief, 24 November 2026

**Status.** Draft for Joseph's rulings. The brief proposes; section 10 lists the decisions. Nothing here is ruled except the quoted rulings of 2 September 2026. Joseph asked for the brief on 24 November 2026, after saying of the date floors "we must make dates robust".

## 1. What the brief asks

The portal and the backend refuse correct dates. For example, a contributor cannot record that St George's Basilica in Prague was founded about 920, or that the structure of the Western Wall dates from 19 BCE.

The brief makes three proposals.

1. **Historical dates from year 1.** A historical date accepts a year below 1000 when the contributor writes the year with four digits, as `0920`.
2. **A confirmed date below the floor.** The backend accepts a date earlier than the country's floor when the submission records that the contributor confirmed the date.
3. **Years before the common era.** A second stage accepts BCE years.

Proposals 1 and 2 must ship together. Either proposal alone leaves St George's Basilica refused: the format refuses `0920` in one field, and Czechia's floor of 1000 refuses it in the others.

Ruling R6 of 2 September 2026 accepted the floor table "as an interim typo guard" and said that "a deep-time date format (signed years, BCE, one sanity bound near 12000 BCE) is a separate follow-on ruling, scheduled after PR-D". The brief is the proposal for that ruling. The brief does not establish whether PR-D, the import of the Woodberry records with their periods, is complete.

## 2. Terms

- A *partial date* is a date written as a year (`1880`), a year and month (`1880-03`), or a full date (`1880-03-01`).
- A *historical date* says when something happened at a place: the bounds of a dated claim, the start and end of a period of use, a date in a function chain (the dated sequence of changes in how a place was used), and the lifecycle date on an evidence form.
- An *observation date* says when evidence was made or consulted: the date of an observation, a photograph, a publication or a visit to a source.
- The *floor* is the earliest year a country accepts in a historical date (`convex/lib/countryYears.ts`).
- A *validator* is the code that accepts or refuses a date. The backend holds the validators that bind. The contributor portal, the review page, the curators' workbench, the agent intake and the command-line tools hold copies.

## 3. What is refused today

Two rules refuse correct dates, and the two rules apply to different fields.

**The format.** In the backend, a year or a year and month must lie between 1000 and 2100. A full date may carry any four-digit year, so `0920-05-01` passes where `0920` fails. The lifecycle date and every observation date meet the format and no floor.

**The floor.** Dated claims, periods and function chains meet the floor.

| Floor | Countries |
|---|---|
| 1000 | Ireland, India, South Korea, Portugal, Romania, Slovakia and the United Kingdom (ruled, R6); Albania, Czechia, Ghana and Kenya |
| 1500 | Brazil, Canada, Mexico and the United States (ruled, R6); the Bahamas and South Africa |
| 1600 | New Zealand, Vanuatu and Australia (ruled, R6); Malawi, Rwanda and Zambia; every country without an entry |

The nine countries outside R6 were added on 24 November 2026 (#234) and await Joseph's confirmation.

| Place | Date | Record | Refused by |
|---|---|---|---|
| St Martin's Church, Canterbury | before 597 | period of worship | the United Kingdom's floor of 1000 |
| St George's Basilica, Prague | c. 920 | structure | Czechia's floor of 1000; the format, as a lifecycle date |
| Mahabodhi Temple, Bodh Gaya | founded in the 3rd century BCE | structure | the format; India's floor |
| Western Wall, Jerusalem | 19 BCE | structure (prayer at the wall began much later) | the format; the default floor of 1600 |
| Pantheon, Rome | c. 126 | structure | the default floor of 1600 |
| A pre-Columbian temple in Mexico | before 1500 | structure | Mexico's floor of 1500 |

Section 7 of the slider brief of 2 September 2026 lists more cases.

## 4. How dates work today

- **Storage.** Every partial date is stored as text. Every census year is stored as a number. No index uses a partial date.
- **Comparison.** The code compares dates as text. Text comparison orders four-digit years correctly, including `0920`. Text comparison orders signed years wrongly. For example, `-0500` sorts after `-0100`, although the year written `-0500` came four centuries earlier.
- **Year extraction.** The code takes the year from the first four characters. For `-0500` the first four characters give −50.
- **Copies.** A search of the code finds validators in the backend (`convex/lib/limits.ts`, `convex/batchImport.ts`), the portal (three contract scripts and `verification-map.js`), the workbench (two), the agent intake, three Python scripts with their schemas, and three parsers in the Rust tool. The copies disagree. The backend caps a year at 2100 and the portal contracts do not; the workbench accepts the year `0000` and the Rust tool refuses it.
- **Tests.** Two tests compare the portal with the backend on derived presence and on function chains. No test compares the validators on the edges of the date format.
- **Hashes.** Evidence versions, review snapshots, derived rows and submission receipts hash records that contain date text. A frozen export is served from stored bytes.
- **The public map.** The map takes a numeric start year and end year for each dated place. The United Kingdom file already carries the years 772 and 925 from OpenStreetMap. The slider covers census years only (ruling R7).

## 5. Proposal 1: historical dates from year 1

**Two validators.** The backend today uses one validator for historical dates and observation dates. Proposal 1 separates the validators. The historical validator accepts years from 1. The observation validator keeps today's range of 1000 to 2100, so that `0201` typed for 2021 is still refused as the date of a photograph.

**The written form.** A year below 1000 takes leading zeros: `0920`, `0920-05`, `0920-05-01`. Text comparison, year extraction, the map builder and the map already handle the form.

**The year 0000.** Stage 1 refuses `0000` in every form. Stage 2 gives `0000` a meaning (1 BCE), and stage 1 keeps the value free until then. The refusal narrows one case that passes today: a full date such as `0000-01-01` in a field without a floor.

**When a contributor types three digits.** The commonest slip is a dropped digit. The portal therefore asks, "Did you mean 1920, or the year 920? For the year 920, write 0920."

**What changes.**

- The backend patterns for a year and for a year and month, applied to historical dates only.
- The portal contract validators, which today join the format check and the floor check.
- The "around this year" helpers, in three places, which build neighbouring years without padding. "Around 1000" already yields the invalid year `999`.
- The test that requires every floor to lie between 1000 and 1600, and the tests that assert the message "from 1600 onward".
- The documents that still say "from 1600 onward", among them `docs/convex-task-layer-spec.md` and `FAQ.md`.

**A shared test.** Stage 1 adds a file of test dates, each marked valid or invalid for each kind of date, and runs every copy of the validators against the file. The list of copies comes from a search of the code. Three copies need a small extraction before a test can reach them: the workbench pattern, the portal's check of observation dates, and the Rust parsers.

## 6. Proposal 2: a confirmed date below the floor

The floor exists to catch a slip of the keyboard. A refusal catches the slip and also blocks a correct date, and the contributor who holds the source cannot override the refusal.

The brief sets out three options.

- **Option A: keep the refusal and lower the floors.** The countries at 1000 drop to year 1, and Joseph rules the others one by one. A correct date is still refused wherever a floor is set too high.
- **Option B: ask in the portal and drop the floor in the backend.** The workbench, the batch import and any other caller then have no guard, and a reviewer cannot tell a confirmed date from a slip.
- **Option C: keep the floor in the backend and accept a confirmed date.** *Recommended.* A submission may carry a field stating that the contributor confirmed each date below the floor. The backend refuses a date below the floor without the field and stores the field with the record. The review queue marks the record.

Under option C:

- **The portal** asks beside the date field, "1344 is earlier than most dated places in New Zealand. Is the year right?", and sets the field when the contributor confirms.
- **A batch import** today rejects a row whose date is below the floor. Under option C the import file carries the confirmation for each such row, and the curator who prepares the file sets it.
- **The agent intake** applies no floor today. Under option C an agent's record meets the same floor and must carry the same field.
- **Existing records** keep their hashes, because a record without a confirmed date does not carry the field.
- **In New Zealand, Australia and Vanuatu** a date below the floor will often concern an Indigenous sacred site. The confirmation can remind the contributor of the sensitivity flag.

The floor table stays, as the list of years below which a confirmation is required.

## 7. Stage 2: years before the common era

**The stored form.** A BCE year is stored as a minus sign and four digits, in the numbering that astronomers use and that the Extended Date/Time Format (ISO 8601-2, level 1) adopts. The numbering has a year zero: `0000` is 1 BCE, `-0018` is 19 BCE, `-9499` is 9500 BCE. Each year has a single spelling, and the validator refuses any other. A single spelling is required because dates are hashed as text: two spellings of the same year would give two hashes.

**The bound.** Four digits reach `-9999`, which is 10000 BCE. R6 names "one sanity bound near 12000 BCE". A bound of 12000 BCE needs five digits and a second width. The brief recommends 10000 BCE; Göbekli Tepe, at about 9500 BCE, fits.

**Conversion.** JavaScript's and Python's date types cannot hold the stored form. The project converts with a routine of its own: a backend routine, a portal mirror and a test that ties the mirror to the backend, as `functionChainMirror.node-test.mjs` already does for function chains.

**Precision.** A BCE date takes a year only. Sources for BCE foundations rarely give a month.

**Entry and display.** A contributor chooses CE or BCE beside the year and never sees the signed form. Every display shows "19 BCE", including the sentences that the backend stores for a function chain. The stored sentence for a CE date stays byte-identical.

**What changes.**

- A comparison routine parses a partial date into numbers and compares two dates. The routine replaces text comparison and four-character year extraction in the backend and in the portal mirrors.
- Every pattern that expects a four-digit year, in each copy listed in section 4.
- The builder of dated places (`scripts/build_occupancy_dated_places.py`), which today returns no year for `-0500` and so silently drops the place. The builder should stop with an error.
- The map popups, which show a year of 0 as missing and would show −18 for 19 BCE.
- The Rust verifier, which must accept signed years before the first signed date is stored.
- The exports. A spreadsheet reads `-0018` as −18 and strips the zeros from `0920`. The export gains a data dictionary and a numeric year column that is not hashed.

**A safety test.** Stage 2 re-derives every derived row from a current export with the new routine and requires that no hash changes.

## 8. Calendars and approximate dates

**The year.** A stored year is a year of the common era, or before it, that begins on 1 January.

**Julian dates.** A source written before a country adopted the Gregorian calendar gives Julian dates. The two calendars differed by 10 days in 1582, 11 days from 1700, 12 from 1800 and 13 from 1900. Britain and its colonies changed in 1752; Romania changed in 1919. The contributor records a day as the source gives it and names the calendar in the source account.

**The start of the year.** Before 1752, English and Irish sources began the year on 25 March. A date from January to late March in such a source belongs to the following modern year. The guide should say so with an example.

**Other calendars.** Sources for several project countries use the Hijri calendar, the Vikram Samvat, the Buddhist Era or a regnal count. A year in one of these calendars spans two years of the common era. The contributor records such a year as a date between the two.

**Approximate dates.** "Around" today means one year either side, which is too narrow for "c. 920". For a date before 1000 the contributor uses "between". The guide gives worked examples for a century ("3rd century BCE" is 300 to 201 BCE) and for a date in years before present.

## 9. What stays the same

- **Stored records.** No stored date is rewritten, and every existing record keeps its text and its hashes. The one narrowing is the year `0000` (section 5).
- **Frozen exports.** A frozen export is served from stored bytes.
- **The slider.** The slider stays on census years (ruling R7).
- **The definition.** Whether an ancient ruin or a sacred site of great antiquity counts as a place of worship is a question for the operational definition. The date format only ensures that the answer can be recorded.

## 10. Decisions for Joseph

Each decision carries the brief's recommendation.

1. **Stage 1 scope.** Build proposals 1 and 2 together. *Recommended.*
2. **Two validators.** Historical dates accept years from 1; observation dates keep 1000 to 2100. *Recommended.*
3. **Stage 1 form.** Four digits with leading zeros; `0000` refused until stage 2. *Recommended.*
4. **The floor.** Option C, a stored confirmation. *Recommended.* Options A and B are in section 6.
5. **The nine floors of 24 November.** Confirm or change the values in section 3. Under option C each value is the year below which a confirmation is required.
6. **Stage 2 stored form.** A minus sign and four digits, astronomical numbering, one spelling. *Recommended.*
7. **The bound.** 10000 BCE, in place of R6's "near 12000 BCE". *Recommended.* The alternative is 12000 BCE with five digits for every BCE year.
8. **Stage 2 precision.** Year only for BCE dates. *Recommended.*
9. **Entry.** A CE or BCE choice beside the year. *Recommended.*
10. **Calendars.** The rules of section 8. *Recommended.*
11. **Exports.** A data dictionary and an unhashed numeric year column. *Recommended.*

## 11. Build order

1. Stage 1 in the backend: the two validators, the padded form, the confirmation field and the shared test. The backend goes first because the change widens validation.
2. Stage 1 in the portal and the workbench: the confirmation beside the date field, the three-digit question, and the RA guide.
3. Stage 2, after rulings 6 to 9: the comparison routine and its mirror first, then the callers, then entry, display and exports.

Each pull request states which copies of the validators it changes and shows the shared test passing against every copy.

## 12. How the brief was made

Claude Fable 5.2 drafted the brief from a read-only inventory of the repository at `51f9782b`. Claude Sonnet 5.5 reviewed the first draft for accuracy and Claude Opus 5.5 reviewed its design; both asked for changes, and this version answers them.
