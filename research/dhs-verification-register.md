# DHS use and verification register

This register governs the project's use of Demographic and Health Surveys (DHS) Program data; DHS-adjacent survey series named in its terms — the Malaria Indicator Survey (MIS), AIDS Indicator Survey (AIS), and Service Provision Assessment (SPA) — fall under the same rules.

> **Ruling (PI, 2026-07-11): DHS survey data are usable by default, with attribution, wherever use is not clearly prohibited and no restricted data can leak. Every use is recorded in this register with its verification.**

## Standing conditions (project invariants)

1. **No microdata in git.** DHS microdata files never enter any git repository, public or private. They live only in the restricted store (project GCS bucket), readable only by users whom the DHS Program has authorised to access them.
2. **Aggregates only in public products.** Public map products carry design-based regional estimates with uncertainty. Small cells are suppressed following DHS analytic guidance; the suppression rule is recorded per product manifest.
3. **No GPS cluster data.** Cluster-location files (Global Positioning System coordinates for survey clusters) carry stricter terms; the project does not request them. Regional estimates use the survey region variable only.
4. **Attribution per track.** A microdata-track product follows the DHS Program's recommended dataset citation; a report-table-track product cites the final report itself, per the Program's [citation guidance](https://www.dhsprogram.com/publications/Recommended-Citations.cfm). The citation lives in the manifest and the country overview. The current public conditions do not state a separate universal funding-acknowledgement requirement. Every resulting report or publication is submitted to the DHS Program at the address stated in the conditions.
5. **Registered purpose.** Use stays within the registered project purpose; a new use class (new construct, new data type) triggers a register entry and, where terms require, a registration amendment.
6. **Report-table track first.** Where a public DHS final report publishes respondent religion by region, the product is built from the published table (public PDF record; no restricted access). Microdata estimation is the fallback where no such table exists.
7. **Per-country terms gate.** The DHS terms impose additional country-specific requirements for some surveys (the terms page names Bangladesh, Botswana, Cambodia, and Vietnam 2005). Before any country lane starts, its lane brief checks the terms page for country-specific conditions and records the finding in this register. Botswana (rank 22) is already flagged in the country table.

## Prerequisites (open)

- [x] PI registers the project account at dhsprogram.com and requests country datasets. **Status: submitted 2026-07-11 under project title "Places of Faith Map"; approval email pending. No microdata lane starts before approval.** Written DHS consent before sharing data with any RA remains a separate open step.
- [x] Verification 1 below: pin the current conditions-of-use text. **Status: verified 2026-07-10.**

## Verification log

Newest first. Every row records the verification question, source, date, and lane.

| # | Date | What was verified | Source | Finding | Recorded by |
| --- | --- | --- | --- | --- | --- |
| 4 | 2026-07-11 | Dataset request submitted | dhsprogram.com registration flow (PI account) | The PI submitted the Step 3 dataset request under project title "Places of Faith Map", requesting survey datasets across all listed regions. The no-GPS invariant governs use regardless of what the form recorded: GPS and SPA files are never downloaded. Approval arrives by email; scope as granted will be recorded when it does. | conductor, from the PI's report |
| 3 | 2026-07-10 | Uganda DHS final reports: respondent religion by region | [Official Uganda publications catalogue](https://www.dhsprogram.com/Publications/Publication-Search.cfm?country=Uganda&ctry_id=44) and linked DHS final-report PDFs | No religion-by-region cross-tab was found in the six DHS waves: 1988–89 [FR41](https://www.dhsprogram.com/pubs/pdf/FR41/FR41.pdf), 1995 [FR69](https://www.dhsprogram.com/pubs/pdf/FR69/FR69.pdf), 2000–01 [FR128](https://www.dhsprogram.com/pubs/pdf/FR128/FR128.pdf), 2006 [FR194](https://www.dhsprogram.com/pubs/pdf/FR194/FR194.pdf), 2011 [FR264](https://www.dhsprogram.com/pubs/pdf/FR264/FR264.pdf), and 2016 [FR333](https://www.dhsprogram.com/pubs/pdf/FR333/FR333.pdf). The background tables give religion and region as separate marginal distributions. No qualifying table was found in the searched final reports. Uganda 2024–25 is an MIS report, outside this DHS-final-report test. Track: `microdata`. | codex probe lane |
| 2 | 2026-07-10 | Senegal DHS final reports: respondent religion by region | [Official Senegal publications catalogue](https://www.dhsprogram.com/Publications/Publication-Search.cfm?country=Senegal&ctry_id=36) and linked DHS final-report PDFs | No religion-by-region cross-tab was found in the DHS final-report series: 1986 [FR34](https://www.dhsprogram.com/pubs/pdf/FR34/FR34.pdf), 1992–93 [FR55](https://www.dhsprogram.com/pubs/pdf/FR55/FR55.pdf), 1997 [FR89](https://www.dhsprogram.com/pubs/pdf/FR89/FR89.pdf), 1999 [FR113](https://www.dhsprogram.com/pubs/pdf/FR113/FR113.pdf), 2005 [FR177](https://www.dhsprogram.com/pubs/pdf/FR177/FR177.pdf), 2010–11 [FR258](https://www.dhsprogram.com/pubs/pdf/FR258/FR258.pdf), 2012–13 [FR288](https://www.dhsprogram.com/pubs/pdf/FR288/FR288.pdf), 2014 [FR305](https://www.dhsprogram.com/pubs/pdf/FR305/FR305.pdf), 2012–14 synthesis [FR315](https://www.dhsprogram.com/pubs/pdf/FR315/FR315.pdf), 2015 [FR320](https://www.dhsprogram.com/pubs/pdf/FR320/FR320.pdf), 2016 [FR331](https://www.dhsprogram.com/pubs/pdf/FR331/FR331.pdf), 2017 [FR345](https://www.dhsprogram.com/pubs/pdf/FR345/FR345.pdf), 2018 [FR367](https://www.dhsprogram.com/pubs/pdf/FR367/FR367.pdf), 2019 [FR368](https://www.dhsprogram.com/pubs/pdf/FR368/FR368.pdf), and 2023 [FR390](https://www.dhsprogram.com/pubs/pdf/FR390/FR390.pdf). Reports from 2005 onward generally give religion and region as separate marginal distributions in the respondent-background table; no cross-tab was found in the earlier reports either. No qualifying table was found in the searched final reports. Track: `microdata`. | codex probe lane |
| 1 | 2026-07-10 | Current DHS conditions of use: registration, redistribution, publication of aggregates, team-member coverage, attribution wording, and GPS/geospatial terms | [DHS Program terms and access pages](#conditions-of-use-verified-text) | Registration and a country-level project request are required. Use is confined to the registered purpose. The public terms prohibit sharing without written consent and redistribution of micro-level data, require secure storage, prohibit identifiable published results, and require submission of resulting reports/publications. They do not expressly name aggregated statistics or provide a team-member exception. The official citation page gives recommended dataset citations; the conditions page states no separate mandatory acknowledgement wording. GPS/GIS access requires an additional electronic consent, whose text is shown only in the logged-in selection flow. | codex probe lane |

## Country status

Queue ranks refer to [build-queue.md](build-queue.md). Track: `report-table` (public PDF route) or `microdata` (registered-access route); every country starts `unprobed`.

| Rank | Country | DHS span in queue | Track | Status |
| ---: | --- | --- | --- | --- |
| 3 | Senegal (SN) | 1986-2023 | microdata | probed — no respondent religion-by-region cross-tab found in the searched final-report series; later reports give separate religion and region marginals. |
| 6 | Uganda (UG) | 1988-2024/25 | microdata | probed — no respondent religion-by-region cross-tab found in the six searched final reports; 2024–25 is an MIS wave and falls outside this test. |
| 8 | Madagascar (MG) | 1992-2021 | tbd | unprobed |
| 9 | Tanzania (TZ) | 1991/92-2022 | tbd | unprobed |
| 10 | Zimbabwe (ZW) | 1988-2015 | tbd | unprobed |
| 12 | Cameroon (CM) | 1991-2022 | tbd | unprobed |
| 15 | Ethiopia (ET) | 2000-2019 | tbd | unprobed |
| 17 | Liberia (LR) | 1986-2022 | tbd | unprobed |
| 18 | Namibia (NA) | 1992-2023 | tbd | unprobed |
| 19 | Mozambique (MZ) | 1997-2022 | tbd | unprobed |
| 20 | Benin (BJ) | 1996-2017 | tbd | unprobed |
| 21 | Togo (TG) | 1988-2022 | tbd | unprobed |
| 22 | Botswana (BW) | 1988-2022 | tbd | unprobed — the DHS terms page names Botswana among surveys with additional country-specific requirements; the lane brief must pin them (invariant 7). |
| 23 | Egypt (EG) | 1988-2017 | tbd | unprobed |
| 46 | Niger (NE) | 1992-2006 | tbd | unprobed |
| 47 | Chad (TD) | 1996/97-2014/15 | tbd | unprobed |
| 61 | DR Congo (CD) | 2007-2013/14 | tbd | unprobed |

## Conditions of use (verified text)

Retrieved 2026-07-10 from current official DHS Program pages.

### (a) Registration and project request

[Access Instructions](https://www.dhsprogram.com/data/Access-Instructions.cfm):

> To request dataset access, you must first be a registered user of the website.

> Access to DHS, MIS, AIS and SPA survey datasets (Surveys, HIV, and GPS) is requested and granted by country.

> Dataset requests must include contact information, a research project title, and a description of the analysis you propose to perform with the data.

[New User Registration](https://www.dhsprogram.com/data/new-user-registration.cfm):

> Before you can download datasets, you must register as a DHS data user. Dataset access is only granted for legitimate research purposes.

The registration form marks the user’s email address, password, name, institution or organisation, organisation type, country of residence, and phone number as required fields.

### (b) Redistribution prohibition

[Terms of Use](https://www.dhsprogram.com/data/terms-of-use.cfm):

> Agree that the datasets will not be shared with other researchers without the written consent of The DHS Program.

> Agree that the DHS micro-level data will not be re-distributed, either directly or within any tool/dashboard.

### (c) Publication of aggregated statistics or estimates

The public conditions do not use the terms “aggregated statistics”, “aggregates”, or “estimates”. They contemplate publication and impose a disclosure limit and a deposit requirement.

[Terms of Use](https://www.dhsprogram.com/data/terms-of-use.cfm):

> Agree that no results will be published in which communities or individuals can be identified.

> Agree to submit a copy of any reports/publications resulting from using the data files to: references@dhsprogram.com.

These clauses address publication of results, including non-identification, but they do not expressly authorise an “aggregates” category or state a general cell-suppression rule.

### (d) Team members and authorised users

The public terms provide no project-team or co-author exception to the sharing restriction and do not explain how a principal investigator adds authorised team members.

[Terms of Use](https://www.dhsprogram.com/data/terms-of-use.cfm):

> Agree that the datasets will not be shared with other researchers without the written consent of The DHS Program.

> Agree to keep the data files in a secure location where they cannot be accessed by unauthorized users.

The public wording therefore does not establish that registration by one project member covers other team members. Written DHS consent is the only stated route for sharing with another investigator.

### (e) Citation and acknowledgement wording

The conditions page requires users to submit resulting reports and publications, but it does not prescribe a citation or acknowledgement sentence. The DHS Program publishes citation guidance on a separate page styled as “Recommended Citations”.

[Recommended Citations](https://www.dhsprogram.com/publications/Recommended-Citations.cfm):

> For a single dataset, the citation should be based on the citation used in the final report, but with a number of additions:

> Insert "[Dataset]" after the title of the survey.

> Follow the list of institutions involved in the report with "[Producers]".

> Add "ICF [Distributor], year" to the end with the year the dataset was made available for distribution (typically the same as the year of publication of the report).

For more than three datasets from multiple countries, the page gives this exact form:

> ICF. 2004-2017. Demographic and Health Surveys (various) [Datasets]. Funded by USAID. Rockville, Maryland: ICF [Distributor].

This funding phrase appears in the generic multiple-country citation. The current public conditions do not state that it is a universal acknowledgement requirement.

### (f) GPS and geospatial files

The general conditions state that they apply to all datasets downloaded from the DHS Program website. The public access pages impose an additional consent step for GPS/GIS files.

[Access Instructions](https://www.dhsprogram.com/data/Access-Instructions.cfm):

> Access to HIV and GIS datasets requires an online acknowledgment of the conditions of use.

> Because of the sensitive nature of GPS, HIV and other biomarkers datasets, permission to access these datasets requires that you accept a Terms of Use Statement. After selecting GPS/HIV/Other Biomarkers datasets, the user is presented with a consent form which should be signed electronically by entering the password for the user's account.

[Registration Rationale](https://www.dhsprogram.com/data/Registration-Rationale.cfm):

> Because there are additional ethical concerns for sharing HIV prevalence data and GPS coordinates, users requesting HIV or GIS data are required to sign a digital consent that acknowledges the terms of use.

The public pages do not display the additional consent form’s clauses. Its exact text could not be verified without entering the logged-in dataset-selection flow.
