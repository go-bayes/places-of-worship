# Deep-time dates: design brief, 24 November 2026

**Status.** Draft for Joseph's rulings. The brief proposes; section 8 lists the decisions. Nothing here is ruled except the quoted rulings of 2 September 2026.

## 1. What the brief asks

The portal and the backend refuse true dates. For example, a contributor cannot record that St George's Basilica in Prague was founded about 920, or that the Western Wall dates from 19 BCE. Joseph, 24 November 2026: "we must make dates robust".

The brief proposes two changes to the date format and one change to the date floor.

1. **Stage 1: years 1 to 999.** Accept a year below 1000 when the contributor writes it with four digits, as `0920`.
2. **Stage 2: years before the common era.** Accept BCE years, stored in the signed form of the international date standard (ISO 8601), with one new comparison routine replacing text comparison.
3. **The floor becomes a question.** Today a date earlier than the country's floor is refused. The brief proposes that the portal ask the contributor to confirm such a date, and that the backend accept it.

Ruling R6 of 2 September 2026 accepted the floor table "as an interim typo guard" and scheduled "a deep-time date format (signed years, BCE, one sanity bound near 12000 BCE)" as "a separate follow-on ruling". This brief is the proposal for that ruling.

## 2. What is refused today

A *partial date* is a date written as a year (`1880`), a year and month (`1880-03`), or a full date (`1880-03-01`). Dated claims, periods of use and function chains all take partial dates.

Two rules refuse true dates.

- **The format.** The year takes four digits and, for a year or a year and month, must lie between 1000 and 2100. No date before 1000 CE can be written.
- **The floor.** Each country has an earliest accepted year: 1600 in New Zealand, Vanuatu and Australia and in every country without a ruled floor, 1500 in the Americas and South Africa, and 1000 elsewhere (`convex/lib/countryYears.ts`).

| Place | Date | Refused by |
|---|---|---|
| St Martin's Church, Canterbury | before 597 | the format |
| St George's Basilica, Prague | c. 920 | the format |
| Mahabodhi Temple, Bodh Gaya | founded in the 3rd century BCE | the format |
| Western Wall, Jerusalem | 19 BCE | the format |
| Pantheon, Rome | c. 126 | the format and Italy's default floor of 1600 |
| A pre-Columbian temple in Mexico | before 1500 | Mexico's floor of 1500 |

Section 7 of the slider brief of 2 September 2026 lists more cases.

## 3. How dates work today

These facts come from a read-only inventory of the repository at `51f9782b`.

- **Storage.** Every partial date is stored as text. Every census year is stored as a number. No index uses a date.
- **Comparison.** The code compares dates as text. Text comparison orders four-digit years correctly, including `0920`. Text comparison orders signed years wrongly. For example, `-0500` sorts after `-0100`, although the year written `-0500` came four centuries earlier.
- **Year extraction.** The code reads the year as the first four characters. For `-0500` the first four characters give −50.
- **Copies.** The backend holds the validator (`convex/lib/limits.ts`). The contributor portal holds four copies, the review page one, and the workbench, the agent intake, the Python tools and the Rust command-line tool one each. No test compares the validator with its copies, and the copies already disagree: the backend caps the year at 2100 and three portal copies do not.
- **Hashes.** Evidence versions, review snapshots, derived rows and submission receipts hash records that contain date text. A frozen export is served from stored bytes.
- **The public map.** The map reads a numeric start year and end year for each dated place. The United Kingdom file already carries the years 772 and 925 from OpenStreetMap, and the map draws them. The slider covers census years only (ruling R7).

## 4. Stage 1: years 1 to 999

**Proposal.** A year below 1000 is written with leading zeros: `0920`, `0920-05`, `0920-05-01`. The year `0000` is refused, because the common era has no year zero.

**Why four digits.** Text comparison, year extraction, the map builder and the map already handle `0920` correctly. A leading zero is also deliberate: nobody types `0920` when they mean 1920. When a contributor types `920`, the portal answers "For a year before 1000, write four digits: 0920."

**What changes.**

- The two patterns in `convex/lib/limits.ts` that cap a year and a year and month at 1000 to 2100, and the matching check in `verification-map.js`.
- The "around this year" helper in the portal, which builds the neighbouring years without padding. The helper already fails for "around 1000", which yields `999`.
- The helper that finds the last day of a month, which uses a JavaScript routine that maps years 0 to 99 onto 1900 to 1999.
- The test that requires every floor to lie between 1000 and 1600.
- `docs/convex-task-layer-spec.md`, which still says "from 1600 onward".

**One shared test.** Stage 1 adds a file of test dates, each marked valid or invalid, and runs every copy of the validator against the file. A copy that drifts then fails in continuous integration.

## 5. The floor becomes a question

**Proposal.** A date earlier than the country's floor is accepted after the contributor confirms it. The portal asks, for example, "1344 is earlier than most dated places in New Zealand. Is the year right?" The backend applies the format, the sanity bound and the rule that a date cannot follow the evidence's reference date. The backend does not apply the floor.

**Why.** The floor exists to catch a slip of the keyboard. A confirmation catches the slip equally well, and a true date still gets through. A refusal cannot be overridden by the contributor who is holding the source. The floor table stays, as the list of years below which the portal asks.

**What the proposal gives up.** A batch import has no contributor to ask. The proposal is that an import reports each date below the floor in its preview, and a curator confirms the preview as today.

**The alternative.** Keep the refusal and lower the floors: the countries at 1000 drop to year 1, and Joseph rules the others one by one. The alternative keeps a guard in the backend. The alternative also keeps refusing true dates wherever a floor is set too high.

## 6. Stage 2: years before the common era

**Proposal for the stored form.** A BCE year is stored as a minus sign and four or five digits, counted as the standard counts: `0000` is 1 BCE, `-0018` is 19 BCE, `-9499` is 9500 BCE. The standard's count runs one behind the BCE label because the standard has a year zero.

**Proposal for entry and display.** Contributors never see the signed form. The portal takes "19 BCE" and shows "19 BCE"; the conversion happens once, in one shared routine with its own tests.

**Proposal for precision.** A BCE date takes a year only. Sources for BCE foundations rarely give a month. A year-only rule also removes the calendar arithmetic for negative years.

**Sanity bound.** Ruling R6 names "one sanity bound near 12000 BCE". The brief proposes 12000 BCE.

**What changes.** Text comparison and four-character year extraction both fail for signed years. Stage 2 replaces both.

- One routine parses a partial date into numbers and compares two dates. Every comparison in `convex/lib/historicalClaims.ts`, `occupancies.ts` and `functionChain.ts`, and in the portal copies, calls the routine.
- Every pattern that expects a four-digit year, in the backend, the portal, the workbench, the agent intake and its schema, the Python intake (whose date type stops at year 1) and the Rust tool.
- The date inputs in the portal, which allow ten characters and a numeric keyboard.
- The builder of dated places, which today cannot read a year from `-0500`, and three places in the map popup that treat a year of 0 as missing.

**Calendar.** Dates are ordered on the Gregorian calendar extended backwards. A source that gives a day before 15 October 1582 usually gives it on the Julian calendar, up to ten days apart. The brief proposes recording the date as the source gives it and accepting that difference. At year precision the difference rarely changes the recorded year.

## 7. What does not change

- **Stored records.** No stored date is rewritten. Both stages only widen what the validator accepts, so every existing record keeps its text and its hashes.
- **Frozen exports.** A frozen export is served from stored bytes and cannot change.
- **The slider.** The slider stays on census years (ruling R7). Whether the public map should offer a deep-time view is a separate question.
- **Definition.** Whether an ancient ruin or a sacred site of great antiquity counts as a place of worship is a question for the operational definition. The date format only ensures that the answer can be recorded.

## 8. Decisions for Joseph

Each decision carries the brief's recommendation.

1. **Staging.** Build stage 1 and the floor change first, and stage 2 after. *Recommended.* Stage 1 is small and removes most refusals; stage 2 touches every comparison.
2. **The floor.** Replace the refusal with a confirmation in the portal (section 5). *Recommended.* The alternative keeps the refusal and lowers the floors.
3. **Stage 1 form.** Four digits with leading zeros, and `0000` refused. *Recommended.*
4. **Stage 2 stored form.** The signed form of ISO 8601. *Recommended*, because the form is standard and other date tools read it.
5. **Stage 2 entry.** Contributors write and read "19 BCE". *Recommended.*
6. **Stage 2 precision.** Year only for BCE dates. *Recommended.*
7. **Sanity bound.** 12000 BCE. *Recommended*, following R6.
8. **Calendar.** Record a date as the source gives it, ordered on the extended Gregorian calendar. *Recommended.*

## 9. Build order

1. Stage 1 and the shared test file, in one pull request. Backend first, because the change widens validation.
2. The floor change, in a second pull request, with the RA guide updated to describe the confirmation.
3. Stage 2, after rulings 4 to 8: the comparison routine and its tests first, then the callers, then entry and display.

Each pull request states which copies of the validator it changes and shows the shared test passing against all of them.
