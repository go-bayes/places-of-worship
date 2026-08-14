# Data-source register — religionmap.org

Date: 2026-08-14. Audience: project owner, deciding which external sources to integrate. Scope: six candidate sources scanned for licensing, spatial resolution, taxonomy crosswalk, access mechanics, and value. Frame: every source here complements the statistics-office outreach lane; none replaces it. The Pew-class sources are country-level, so their value is validation baselines and context layers, never entries in the governed master record.

## Summary

One source in this survey earns integration, and it is not the one the survey set out to find: GeoNames — global, point-level, CC BY 4.0, and independent of OpenStreetMap — supports both a coverage-validation baseline across the ~100 country pages and a candidate-site feed, at near-zero licensing risk and roughly a day of work. Behind it, ranked: the ARDA-hosted RCMS county files give the one strong US validation baseline (congregations per county, seven waves 1952–2020), fully permitted as internal analysis but blocked from published redistribution without ASARB permission — and the repo currently ships an ARDA-derived county layer whose manifest misstates the redistribution position, which is a live compliance issue to fix now. Pew's global composition estimates are a permissioned context layer for the long tail of countries with no census religion question; a written-permission ask to Pew is cheap and, on the Our World in Data precedent, likely to succeed. WVS supplies a one-line attendance-versus-affiliation context sentence and nothing more. Pew RLS supplies one small hand-transcribed US state table for the unaffiliated share. The World Christian Database is blocked outright by the De Gruyter licence terms and should stay out of the pipeline, the master record, and the map. Nothing in this survey supplies affiliation counts, denominational detail, or sub-national depth at the grain the census-office outreach lane buys; the survey's chief lesson is that outreach remains the only route to the project's distinctive assets.

## Register

| Source | Verdict | Licensing (one line) | Finest resolution | Crosswalk difficulty |
|---|---|---|---|---|
| Pew Global Religious Futures (2010/2020 composition) | context-layer-only | Custom revocable grant; excerpts and derivatives permitted, whole-corpus republication needs written permission | Country (201 countries, 2010 and 2020) | Lossy upward only: 7 buckets; Rātana/Ringatū conflict; never map downward |
| Pew Religious Landscape Study 2023–24 | context-layer-only | Pew's own dataset terms permissive for derived aggregates; the ARDA-hosted copy of the same file carries a far harsher EULA — take it from Pew, never ARDA | US national + 4 census regions (public file); state/MSA only as published tables | Wrong construct (people, not buildings); RELTRAD cuts across the taxonomy; 9 of 16 categories map |
| ARDA (RCMS, WRP, RCS-Dem) | validation-only (kill on published redistribution) | ARDA grants nothing; ASARB forbids reposting RCMS data without permission; COW forbids third-party distribution of WRP | US county (RCMS, 7 waves); country-year elsewhere | RCMS needs a 372-body bridge; WRP collapses 18 codes into one Protestant bucket |
| World Christian Database (Brill) | blocked-by-licence | Subscription; De Gruyter GTC 7.6.9–7.6.12 forbid public display, local storage, derivatives, and re-serving | Country, with modelled province estimates; no points | Megablocs cut across census categories; code list itself paywalled |
| World Values Survey | validation-only | Non-redistribution licence; publishing results permitted, data files and downstream reuse grants forbidden | Country-wave only in practice (region cells too small) | 9-category Q289; no NZ-specific bodies; aggregate-to-aggregate only |
| Historical gazetteers (GeoNames, NHLE, Pleiades) | context-layer-only; GeoNames integrate-grade | GeoNames CC BY 4.0; Pleiades CC BY 3.0; NHLE OGL v3 (unverified — check before integrating); NZ Heritage List unresolved | GeoNames: global points; NHLE: building polygons, England; Pleiades: ancient points | GeoNames: religion-level for 3 codes, no denominations; Pleiades: categorically outside the taxonomy |

## Pew Research Center — Global Religious Futures

**Verdict: context-layer-only.** Core assets: the "Dataset of Global Religious Composition Estimates for 2010 and 2020" (doi:10.58094/vhrw-k516) and the "Religious Composition by Country, 2010-2020" interactive table (doi:10.58094/5shf-2d69); globalreligiousfutures.org is dead and content now lives on pewresearch.org.

### Licensing

Not open data — a custom, revocable, non-sublicensable, non-transferable grant. The grant itself is broad: Section 1 permits display, distribution, publication, and derivatives, and Section 13 repeats that for datasets. Two clauses do the constraining work, and both point the same way: whole-corpus republication needs express written permission; excerpts and derivatives do not.

> "Under no circumstances may the Content be reproduced in principal part, mirrored, catalogued, framed, displayed simultaneously with another site or otherwise republished in its entirety or in principal part without the express written permission of the Center" — https://www.pewresearch.org/about/terms-and-conditions/

> "the Center provides you with a nonexclusive, non-sublicensable, non-transferable, revocable, worldwide, and royalty-free license to access, copy, reproduce, cite, link, display, download, distribute, broadcast, transmit, publish, modify, create derivatives of, or otherwise exploit the survey datasets ... made available on this website ("Data"), provided that:" — https://www.pewresearch.org/about/terms-and-conditions/

> "any reproduction, display, distribution, broadcast, transmission, or publication of the Data is limited to excerpts and may not be reproduced, displayed, distributed, broadcast, transmitted, or published in full or substantially in full;" — https://www.pewresearch.org/about/terms-and-conditions/

Mandatory conditions on any use: Pew's citation format, a verbatim disclaimer ("Pew Research Center bears no responsibility for the analyses or interpretations of the data presented here. The opinions expressed herein, including any implications for policy, are those of the author and not of Pew Research Center."), preservation of copyright notices, and no use implying Center endorsement. "Any rights not expressly granted herein are reserved." No fees.

Practical reading: a clearly attributed country choropleth built from Pew estimates sits inside the grant as a derivative; shipping the full 201-country table as a project download, or re-serving it through the project's own API, trips both the "in principal part" and "excerpts only" clauses and the non-sublicensable terms — that needs written permission. The grant is revocable, so a permanent layer rests on a licence Pew can withdraw. Precedent: Our World in Data republishes the full Pew country table publicly with attribution, stating "All data, visualizations, and code produced by Our World in Data are completely open access under the Creative Commons BY license" while scoping its CC BY to OWID's own processing (https://ourworldindata.org/grapher/religious-composition). Asking Pew for written permission is cheap and, given that precedent, likely to succeed; ask before any public layer ships.

### Resolution

Country and territory only — no sub-national geography anywhere in the product line. Coverage is 201 countries and territories at 99.98% of world population, two snapshot years (2010, 2020), built from more than 2,700 censuses and surveys. The legacy 2010–2050 projections are country-level, superseded, and eleven years without reissue. This is a table joined on country name; it cannot touch the NZ/VU/Pacific sub-national census depth.

### Crosswalk

The target is /Users/joseph/GIT/places-of-worship/schemas/denomination-taxonomy.json (taxonomy_version 2026-06-12.1: 8 religion codes, 37 denomination codes). Mapping repo codes up to Pew's seven buckets is mechanical and safe; mapping Pew down to repo codes is impossible and must never be attempted. All 25 christian.* codes collapse into "Christians". Sikh and bahai disappear irreversibly into "other religions". Pew codes Rātana and Ringatū adherents as Christians where the repo's Stats NZ basis classes them under Māori religions — a documented conflict to record as an unresolved-alias note, never silently reconciled. "Religiously unaffiliated" has no taxonomy counterpart and belongs in a separate census-affiliation field. Folk/traditional religions — the worst possible fold for the Pacific work — is a standalone category in the projections but folded into "other religions" in the 2020 round. Keep Pew values in their own namespace with their own seven-value vocabulary.

### Access

Bulk ZIP of Excel worksheets, verified openly fetchable (HTTP 200, no authentication) at pewresearch.org/wp-content/uploads/sites/20/2025/06/Religious-Composition-2010-2020-dataset.zip; the DOI landing page gates the same content behind a free account and click-through. No API, no ISO codes guaranteed (a country-name join table is needed), no versioned release feed — treat as a manual, occasional refresh. Two citable DOIs. Free.

### Value

Modest and strictly secondary. Three uses. The first use is a validation baseline: Pew's independently modelled estimates give a second opinion on every census-derived country share, and a large divergence signals a bug in the extraction or the rollup — real quality assurance, no public display needed. The second use is a context layer for the long tail: countries whose statistics office asks no religion question get a coarse seven-category choropleth instead of a blank page. The third use is temporal framing: 2010 versus 2020 gives a decade of change at global scope. It adds no places, no geometry, no denominations, no sub-national resolution; it is modelled estimate, never enumeration, and must never enter the governed record. Wherever a census exists, Pew is strictly worse and should be hidden.

## Pew Research Center — Religious Landscape Study 2023–24

**Verdict: context-layer-only.** Public-use file via Pew account; mirrored by ARDA as RELLAND24 (OSF DOI 10.17605/OSF.IO/JMQTV); restricted-use file at ICPSR 39498.

### Licensing

Not a kill, but a two-tier trap: the same bytes carry incompatible licences depending on where you download them. Pew's own dataset terms are genuinely permissive for our purpose — publishing our own state-level aggregates sits inside the grant; mirroring or API-re-serving the microdata does not.

> "the Center provides you with a nonexclusive, non-sublicensable, non-transferable, revocable, worldwide, and royalty-free license to access, copy, reproduce, cite, link, display, download, distribute, broadcast, transmit, publish, modify, create derivatives of, or otherwise exploit the survey datasets ... provided that: any reproduction, display, distribution, broadcast, transmission, or publication of the Data is limited to excerpts and may not be reproduced, displayed, distributed, broadcast, transmitted, or published in full or substantially in full" — https://www.pewresearch.org/about/terms-and-conditions/

> "you may not: ... engage in unauthorized spidering, "scraping," or harvesting of content or personal information, or use any other unauthorized automated means to compile information" — https://www.pewresearch.org/about/terms-and-conditions/

The scraping ban means the 51-row state matrix must be transcribed by hand as an attributed excerpt, never crawled. The ARDA-hosted copy of the identical microdata is governed by a much harsher Pew EULA:

> "the ARDA hereby grants to the User a non-exclusive, revocable, limited, non-transferable license to use the Data solely for (1) research, scholarly or academic purposes, or (2) your own personal non-commercial use. The foregoing license grant is personal to User, and User may not share (or otherwise permit access to) the Data to any other individual or entity ... User may not reproduce, sell, rent, lease, loan, distribute or sublicense or otherwise transfer any Data, in whole or in part, to any other party, or use the Data to create any derivative work or product for resale, lease or license." — https://www.thearda.com/data-archive?fid=RELLAND24&tab=3

> "Upon termination of this EULA, User agrees to (a) destroy all copies of any Data, in whole or in part and in any and all media, in User's custody and control" — https://www.thearda.com/data-archive?fid=RELLAND24&tab=3

A termination-plus-destroy clause is incompatible with a persistent published layer. Take the file from pewresearch.org under the permissive dataset terms, never from ARDA. The restricted-use file at ICPSR is "restricted from general dissemination" under a Restricted Data Use Agreement (https://www.icpsr.umich.edu/web/ICPSR/studies/39498/publications) and is unusable as a public-map input. No fees; a free Pew account is required.

### Resolution

US only, one wave (2023–24, n=36,908), and the geography is stripped from every file we can freely use — the decisive finding. The public file's only geographic variable is REG (four census regions), despite ARDA summary text quoting Pew's state/MSA weighting methodology; that text is copied boilerplate, and Pew confirms: "The PUF does not include any information about geography, and it excludes information on several other sensitive variables (including detailed variables about religious identity)" (https://www.pewresearch.org/dataset/2023-24-religious-landscape-study-rls-dataset/). Practical tiers: national plus 4 regions from microdata (ours to tabulate); 51 states and 34 MSAs only as Pew-published numbers, transcribable but not recomputable; full geography only in the restricted ICPSR file. Nothing below state/MSA exists in any tier. The repo's existing US layer is county-level across seven waves — finer than anything RLS can supply.

### Crosswalk

Four problems, descending severity. First, the construct is wrong-way-round: our taxonomy classifies buildings, Pew classifies people, and congregation size varies by an order of magnitude across traditions. Second, Pew's RELTRAD tradition categories (Evangelical, Mainline, Historically Black Protestant) cut across denominational families — a Presbyterian building is mainline if PCUSA and evangelical if PCA, and Historically Black Protestant is defined partly by respondent race, which is not a property of a building; mapping any of them onto christian.evangelical would be a category error. Third, the FAMILY variable that would crosswalk almost one-to-one onto the christian.* codes is withheld from the public file. Fourth, roughly 30% of the sample (unaffiliated 29.4%) falls outside the taxonomy entirely and belongs on the area-summary no_religion_percent field. Nine of Pew's sixteen top-level categories map cleanly (Catholic, Orthodox, Latter-day Saint, Jehovah's Witness, and the Jewish/Muslim/Buddhist/Hindu religion codes).

### Access

Preferred route: bulk download from pewresearch.org/dataset/2023-24-religious-landscape-study-rls-dataset/ (free account, permissive dataset licence); also open-access at openICPSR project 221062. Avoid the ARDA route. State and metro percentages are readable web pages under pewresearch.org/religious-landscape-study/database/ — key them in by hand, cite, never crawl. No API. Contact: Gregory A. Smith, gsmith@pewresearch.org.

### Value

Narrow but real, landing on one specific gap: in all 21,905 existing RCMS county rows, no_religion_count and no_religion_percent are null, because a congregational-rolls census has no category for people who belong to nothing. RLS measures exactly that, with published state breakdowns, and gives an independent check on RCMS's known undercount of historically Black and nondenominational bodies. The sensible product is a single state-level context table for one country — 51 rows plus 34 MSAs, hand-transcribed, attributed, flagged as self-reported identity — on the pattern of apps/regions/ch/data/area_summary_canton_survey.json. Roughly a day of work; worth doing after higher-value lanes.

## Association of Religion Data Archives (ARDA)

**Verdict: validation-only; kill=true on published redistribution.** The kill flag and the verdict are consistent once scoped: the kill applies to publishing ARDA-sourced values as project data layers; internal analysis, validation statistics, and reports are unambiguously permitted today. Assessed at site level and for the RCMS county files, the World Religion Project (WRP), and RCS-Dem 2.0.

### Licensing

ARDA is an aggregator, and two layers must both be cleared. The ARDA layer grants nothing: the site carries "© 2026 The Association of Religion Data Archives. All rights reserved." with no terms-of-use page anywhere, and its four-point download click-through contains no redistribution clause at all — silence plus all-rights-reserved means no affirmative permission, and the original collector's terms govern. The collector layer is where the block lands. For the U.S. Religion Census family — the single most valuable ARDA holding for this project — ASARB is plain:

> "You can download the dataset for free from this site as well as from the Association of Religion Data Archives. This includes permission to use the data for studies or reports or analyses, but does not grant permission to redistribute or repost the data." — https://www.usreligioncensus.org/faq

> "ASARB (the U.S. Religion Census copyright holder and study sponsor) wants you to use the data and products, but we do not want you to distribute the dataset or products without proper permission. If you have any question about obtaining proper permission, please contact us." — https://www.usreligioncensus.org/faq

Publishing per-county congregation and adherent values as JSON on religionmap.org is reposting on any ordinary reading. For WRP, ARDA mirrors a Correlates of War dataset under stricter terms still:

> "Users agree not to distribute the dataset to any third party without written permission of the COW director and data host. Users agree to ask permission for any dissemination, posting, or other use of the data that is not covered by the above restrictions." — https://correlatesofwar.org/data-sets/

The OSF mirrors of WRP and RCS-Dem carry no licence object (node_license reported null via the OSF API for spqbc, 7sr4m, 2mwe8 — asserted without a quotable artefact; see Gaps and caveats), which under OSF defaults means all rights reserved. The prohibition is permission-gated rather than absolute: ASARB publishes a contact route and "wants you to use the data", so a written grant is a cheap and plausible ask that fits the existing outreach lane.

**Live compliance issue.** apps/regions/us/data/area_summary_county.json already ships ARDA-sourced RCMS county rows for 1952–2020, and each source_datasets entry asserts redistribution_limits: "No explicit restriction on derived or aggregated products found". That assertion is contradicted by ASARB's published FAQ for the 1990–2020 waves. The 1952 (National Council of Churches) and 1971/1980 (Glenmary) waves sit with pre-ASARB copyright holders who publish no terms, so the risk there is materially lower — though that reading is inference, not quoted text. Correct the manifest now, and either obtain ASARB written permission for the published layer or restrict it to the pre-1990 waves and the NHGIS-sourced 1850–1936 waves until permission lands.

### Resolution

ARDA holds no point data of any kind — the U.S. Religion Census states that congregation names and addresses are never collected or published. The finest geography is the US county: RCMS covers every county across waves 1952, 1971, 1980, 1990, 2000, 2010, 2020 (2020: 372 religious bodies, 356,642 congregations, 161,224,088 adherents). Outside the US the unit is the country: WRP is a state–five-year file, 1945–2010; RCS-Dem 2.0 is a state-year file back to 1900 and often 1800, stopping at 2015. Both are estimate-and-impute products, not enumerations. Nothing sub-national outside the US; nothing mappable as a site.

### Crosswalk

Target: schemas/denomination-taxonomy.json (LEXICON.md is a glossary, not a taxonomy). WRP is the poorest fit despite being the obvious cross-national candidate: twelve variables map cleanly, but CHRSTPROT swallows eighteen repo denomination codes into one Protestant bucket, irreversibly — a Vanuatu row reporting Presbyterian at 57.57% and Seventh-day Adventist at 9.97% can only be checked as a summed Protestant share, exactly the granularity the project exists to improve on. The maori codes have no WRP home. RCS-Dem matches the grain better at 100 denominations but descends from the World Christian Encyclopedia's ecclesiastical-family tree and adds composites ("Western Christianity") that must be dropped, never mapped. RCMS is finer in a tractable way: its 372 units are named organisations, so the crosswalk is a hand-built many-to-one bridge, with one axial collision — ASARB's Evangelical/Mainline grouping cross-cuts rather than nests inside the repo scheme. None of this cost has been paid yet: the extracts the repo ships carry only cng/adh/pop totals with no denominational breakdown.

### Access

Free bulk download, no account: SPSS, Stata, Excel, ASCII per dataset page, click-through revealed client-side, many files hosted on OSF with DOIs. No API. The same RCMS files are downloadable from usreligioncensus.org, which is where the operative ASARB terms live — a reader who only visits ARDA never encounters the redistribution prohibition. Permission requests: ASARB contact form (RCMS); support@thearda.com (ARDA-level).

### Value

ARDA adds no places to a places map; its contribution is one strong validation baseline plus a thin context layer. The strong piece is the RCMS county congregation count: a like-for-like denominator for the repo's OSM-derived place_count that exists nowhere else at that grain, letting the project put a number on OSM's US coverage ratio and how it varies with urbanity and region — calibration that then informs trust in OSM counts where no baseline exists. The extracts are already pulled locally, so the cost is analysis, and analysis is squarely permitted. The second piece is US historical depth: seven RCMS waves stack onto the NHGIS 1850–1936 series for an affiliation series from 1850 to 2020. The third and weakest piece is cross-national context from WRP/RCS-Dem as an ingestion smell test — country-level, interpolated, stale (2010/2015), and largely derived from the same census returns the project obtains at first hand. The asymmetry is the key fact: the highest-value use is fully permitted today, and the lowest-value use is the one needing permission. Do the validation work now; treat any published ARDA-derived layer as a separate, permission-gated decision.

## World Christian Database (Brill / De Gruyter)

**Verdict: blocked-by-licence.** Ed. Gina A. Zurlo; data from the Center for the Study of Global Christianity; Brill is the platform and rights holder.

### Licensing

Subscription-only, and the subscription licence forbids exactly what religionmap.org would do. The operative terms are the De Gruyter Group General and Licence Terms and Conditions (the De Gruyter–Brill merger makes the GTC govern Brill online databases — an inference; see Gaps and caveats):

> "7.6.9 The Client and the Approved Users are not allowed to make the Contents or parts thereof available to third parties or publicly. It is especially not permitted to make available any of the Contents to third parties via open data networks, in particular the World Wide Web, for the purpose of downloading, saving or any other form of multiplication." — https://www.degruyterbrill.com/publishing/terms-conditions

> "7.6.10 The client and the Approved User are also prohibited from reproducing the Contents (in whole or in parts) on permanent data processing media and passing them on to third parties and/or from using the Contents in whole or in parts to develop systematic compilations or in a local retrieval system and/or from translating the Contents to other data formats and/or from saving the Contents permanently unless this is provided by a function that is made available by De Gruyter." — https://www.degruyterbrill.com/publishing/terms-conditions

> "7.6.11 The Client and the Approved Users may not process, operate on or in any other way alter the Contents (in whole or in part) unless this is necessary for the contractual use." — https://www.degruyterbrill.com/publishing/terms-conditions

Clause 7.6.9 blocks the public map; 7.6.10 blocks ingestion into the master record or Convex backend; 7.6.11 blocks derivative aggregates; 7.6.12 confines text and data mining to non-commercial purposes and reserves commercial mining to the publisher. An institutional EULA restates it bluntly: "It is strictly forbidden to change, rewrite, systematically copy, redistribute, sell, publish or in any way use the material in commercial purposes" (https://emedia.lub.lu.se/db/info/658). Attribution does not cure any of this — the required citation ("Gina A. Zurlo, ed. World Christian Database (Brill, accessed August 2026)") is a citation rule, never a redistribution grant. Access is registration- and fee-gated (re3data r3d100012240); pricing is unpublished (sales@brill.com). A subscriber may read WCD and cite figures in a paper; a subscriber may not put WCD values behind a public map, cache them, re-serve them, or publish derived aggregates.

### Resolution

Country is the working unit (234–237 countries), with modelled figures for ~3,000 provinces, 5,000 cities, and 13,000 peoples — estimates fitted to civil boundaries, never observations, and WCD's own methodology concedes that ecclesiastical boundaries "bear little or no relation" to the administrative units. It counts ~3 million congregations but publishes only national totals per denomination: no coordinates, no addresses, nothing to put on a pin map. Temporal reach is its one distinction — 1900–2050 in the sibling World Religion Database, updated weekly.

### Crosswalk

WCD counts affiliated people; the repo counts mappable sites; no key joins them. The six Christian megablocs (Roman Catholic, Orthodox, Protestant, Anglican, Independent, Marginal) cut across census categories: "Marginal" holds Latter-day Saints and Jehovah's Witnesses, which NZ and most censuses count inside Christian, so a naive Christian-share comparison disagrees by definition rather than measurement. The NZ religion manifest's total-responses denominator (each person counted in every stated group, randomly rounded base 3) is incompatible with WCD's single-assignment estimates without explicit reconciliation. The code list itself (300 traditions, ~33,800 denominations) is paywalled subscription content, so even a crosswalk table could not be published. One scan-level claim to discard: the WCD scan asserted the repo's coded taxonomy "does not yet exist"; it does — schemas/denomination-taxonomy.json, version 2026-06-12.1.

### Access

Paid subscription via web interface; no open download, no API; report exports only, with permanent local storage prohibited beyond Brill's own functions; automated harvesting separately banned. Check whether VUW already holds access through a Brill reference package before considering purchase — though access changes nothing about redistribution.

### Value

Real but thin, and entirely unpublishable: an offline sanity check that a country page's headline figure sits in a plausible range, with a temporal reach no census office matches. Its sub-national figures are modelled, so validating a CC BY census count against them inverts the evidence hierarchy; its country-level context is largely available on far friendlier terms from Pew and ARDA; it contributes nothing to the places layer. Cite it in the manuscript where a long global series is genuinely needed; keep it out of the pipeline, the master record, and the map.

## World Values Survey

**Verdict: validation-only.** Wave 7 (2017–2022) plus the EVS/WVS Integrated Values Surveys trend file 1981–2022.

### Licensing

No open licence — a registration-gated non-redistribution licence with four conditions:

> "CONDITIONS OF USE These data files are available without restrictions, provided: a) that they are used for non-profit purposes; b) correct citations are provided and sent to the World Values Survey Association for each publication of results based in part or entirely on these data files; c) the data files themselves are not redistributed; d) proper citation to the WVS data is included into the references list of the publication" — https://www.worldvaluessurvey.org/AJDownloadLicense.jsp

Publishing our own aggregates as results is contemplated by condition (b); shipping microdata, mirroring files, or re-serving through our API is forbidden by (c). The real friction for a public web map is downstream reuse: with no open licence we can grant our users no reuse rights over WVS-derived content, so any project download or public API endpoint must exclude WVS-derived fields. A downloadable derived country-aggregate CSV is a grey zone — Our World in Data publishes such aggregates with the note that "original data providers' license terms apply" (https://ourworldindata.org/grapher/confidence-in-un-wvs), which is precedent, never permission. Condition (b) also imposes an ongoing obligation: citations must be actively sent to the WVSA. Free of charge. For written clarification: Jaime Diez-Medrano (jdiezmed@jdsurvey.net) or the WVSA Secretariat, Kseniya Kizilova (wvsa.secretariat@gmail.com).

### Resolution

Finer than country on paper (ISO 3166-2 region codes, even settlement names), but sample size kills the sub-national use: country-waves run ~1,200–2,000 respondents, so an NZ region cell holds tens of people, and the country-wave is the only defensible unit for religion variables. Wave 7 covers 64+ countries including NZ (2020) and Australia (2018); the trend file spans ~120 countries, 1981–2022; NZ has six waves from 1985. The critical gap: no Pacific beyond NZ and Australia — no Vanuatu, Fiji, Samoa, Tonga, or PNG, so the project's deepest census work gets nothing.

### Crosswalk

Q289 is a 9-category harmonised list whose single "Protestant" bucket merges Anglican, Presbyterian, Methodist, and Baptist — exactly the distinctions the map turns on. The richer Q289CS annex (~286 named bodies) contains no Aotearoa-specific bodies: no Rātana, no Ringatū, NZ respondents collapse into "Anglican; nfd". Category 9 "Other" absorbs Sikh, Bahá'í, and folk traditions, all of which have distinct mappable buildings. Structurally decisive: WVS measures self-reported individual affiliation, the repo records buildings and worship use, and no key joins a respondent to a site_id — any crosswalk is aggregate-to-aggregate.

### Access

Free but gated and manual: a registration form per download, files in SPSS/Stata/SAS/R/CSV, no API and no bulk endpoint — plan a single manual pull recorded with a checksum. The WVSOnline analysis tool exports tabulations without touching microdata, a legitimate route to a handful of country figures.

### Value

A validation baseline and a one-line context panel, never a layer. Its one distinctive contribution is behaviour: Q171 (attendance) and Q172 (prayer) measure what no census asks, giving a defensible answer to the most likely public misreading of an affiliation choropleth — that ticking a box means attending. A country-page sentence comparing WVS monthly attendance against the census affiliation share is real value, cheap, and needs no layer. The trend file adds temporal context, strongest for NZ where the pilot is. Do not build a WVS choropleth; do not let it substitute for a single census-office ask.

## Historical gazetteers — GeoNames, Historic England NHLE, Pleiades

**Verdict: context-layer-only overall; GeoNames is the survey's one integrate-grade candidate.** Screened and set aside: World Historical Gazetteer (discovery index, few worship sites), US NRHP (public domain but geographically redacted), NZ Heritage List (licence unresolved).

### Licensing

All three scored candidates are permissively licensed for redistribution, derivatives, public display, and API re-serving, subject only to attribution.

> "This work is licensed under a Creative Commons Attribution 4.0 License" — http://download.geonames.org/export/dump/readme.txt

> "Using, sharing, and remixing of the content is permitted under terms of the Creative Commons Attribution 3.0 License (cc-by)." — https://pleiades.stoa.org/credits

NHLE is Open Government Licence v3 with a two-part attribution string ("© Historic England [year]" plus the Ordnance Survey line for spatial data) that must be passed down to sub-licensees — a real obligation for reviewer downloads and public exports. However, both NHLE quotes in the scan are self-admitted paraphrases recovered from search snippets after the terms page returned 403: **unverified — check before integrating** (read https://historicengland.org.uk/terms/website-terms-conditions/open-data-hub/ in a browser first). The NZ Heritage List is the one genuine licence risk in the set: data.govt.nz records it as "Other licensing (check with source agency)" (https://catalogue.data.govt.nz/dataset/new-zealand-heritage-list-rarangi-korero), so it must be cleared with Heritage New Zealand Pouhere Taonga (info@heritage.org.nz) before any public display. No fees anywhere.

### Resolution

GeoNames: global points, every country, religious features in class S (CH church, MSQE mosque, TMPL temple, SYG synagogue, MSTY monastery, SHRN shrine, and others); precision uneven — a CH point is often a locality centroid rather than a building; essentially no temporal metadata. NHLE: the finest resolution in the survey — point and polygon at building level, England only, ~400k entries, updated daily, with listing dates and described construction dates that support genuine opening dates for the lifecycle fields. Pleiades: ~40,000 ancient places, points with stated uncertainty, roughly 1000 BCE to early medieval, with first-class attested time periods.

### Crosswalk

GeoNames maps at religion level for three codes only (CH → christian, MSQE → muslim, SYG → jewish); TMPL collapses hindu, buddhist, and East Asian traditions; sikh, bahai, and maori have no representation; and no denomination concept exists, so denominations must be recovered by name parsing — reuse the existing mapper at apps/regions/nz/js/denomination-mapper.js rather than building a second one. Pleiades is categorically outside the taxonomy: its temples are Greco-Roman and Near Eastern polytheistic cult sites, and the census-aligned taxonomy deliberately has no home for them. NHLE has no religion field at all; a register entry named "Primitive Methodist Chapel" persists after the 1913 merger, which is exactly what the taxonomy's succession/merged_into records handle, but the register gives no cessation date, so the succession must still be supplied by the project.

### Access

Entirely self-service bulk download — the lane's main practical virtue. GeoNames: allCountries.zip plus daily modification files for incremental refresh; the rate-limited API (10,000 credits/day) is irrelevant since the dump is the right route. Pleiades: dated numbered releases in CSV/GeoJSON/RDF, suiting the repo's checksum discipline; the CSV export is lossy relative to the graph. NHLE: ArcGIS Open Data Hub with GeoJSON/WFS, updated daily. NZ Heritage List: CSV via API, but the licence email comes first.

### Value

The ranking inverts the brief: the item worth wiring is not a historical gazetteer. GeoNames earns integration on being global, point-level, CC BY, and independent of OSM — descending largely from NGA GNS, its errors are uncorrelated with OSM's, making it a genuine second opinion. Two uses: differencing CH/MSQE/TMPL/SYG counts per country against OSM-derived counts localises where OSM coverage is thin, answering the prioritisation question the global lane keeps guessing at; and unmatched GeoNames points feed the candidate-site pipeline, never the master record. It supplies no denomination and no dates. Heritage registers are the only source with historical depth at building level, but "the registers" is a category error — dozens of national registers with incompatible schemas and licences; the right framing is per-country context layers, and for NZ specifically a short outreach email in the existing queue. Pleiades is a deep-time visual toggle that would contribute nothing to research outputs; build it only if the visual is wanted for its own sake. WHG's genuine use is reconnaissance before writing to a country's statistics office.

## Gaps and caveats

**Unverified licensing text.** The Historic England NHLE OGL quotes are paraphrases recovered from search snippets after the terms page returned 403 to automated fetch; the scan flags this itself. The overall gazetteer no-kill does not hinge on NHLE — GeoNames and Pleiades are verbatim-supported — but any NHLE-specific go decision is **unverified — check before integrating**: read the Open Data Hub terms in a browser first. Likewise the claim that the ARDA OSF mirrors carry no licence (node_license null for spqbc, 7sr4m, 2mwe8) is asserted from an API check without a quotable artefact; it does not change the ARDA kill call, which rests on the quoted ASARB and COW terms, but re-verify before relying on it in any permission correspondence.

**Inferences flagged as inferences.** The WCD verdict rests on the premise that the De Gruyter Group GTC governs Brill's WCD product — an inference from the merger, corroborated by the Lund EULA and re3data; if WCD is ever reconsidered, confirm the GTC applies to that specific product before acting. The lower-risk reading of the pre-1990 RCMS waves (1952, 1971, 1980, whose pre-ASARB copyright holders publish no terms) is likewise inference, not quoted text.

**ARDA's flags disagree on their face.** kill=true sits beside verdict "validation-only". The reconciliation: the kill applies to published redistribution of ARDA-sourced values; internal analysis and validation statistics are permitted today. Do not misread the kill as barring the validation work — and do not misread the verdict as licensing the existing published county layer, which is the live compliance issue.

**One scan claim to discard.** The WCD scan asserted the coded denomination taxonomy "does not yet exist", citing docs/ra-map-triage-guide.md. That contradicts the other five scans and the file on disk: schemas/denomination-taxonomy.json, taxonomy_version 2026-06-12.1, exists and is the crosswalk target throughout this register. The WCD crosswalk verdict survives without the claim. Relatedly, all six scans correctly identify LEXICON.md as a plain-language glossary carrying no religion categories; nothing crosswalks against it.

**Sources this survey missed.** Three, in descending importance. Wikidata is the largest single omission: CC0, global, point-level places of worship carrying religion (P140) and denomination as structured data at site level — the only open source that does — and partly independent of OSM; it belongs in the next scan round ahead of everything in this register except GeoNames. Overture Maps' places theme offers a global POI layer including places of worship under permissive terms (CDLA-Permissive-2.0 for the non-OSM-derived parts) with conflation already done — a cheap second coverage baseline distinct from raw OSM and GeoNames. Charity and nonprofit registers (UK Charity Commission under OGL, NZ Charities Register under CC BY, ACNC) carry congregation-level names, addresses, and denominational affiliation from statutory filings under open licences — a places-lane feed, unlike every area-level estimate above. Statistics-office census portals were correctly excluded per the brief.

## Addendum 2026-08-14: post-scan verification of the US compliance flag

Owner review and record checks after the scan narrow the compliance flag in three ways. First, NHGIS permission exists and is explicit: the Gmail thread "Confirming publication of derived county rates from NHGIS church statistics" (nhgis@umn.edu, 14–17 July 2026) records NHGIS user support confirming "Your use of NHGIS does conform with our license", closed after the project adopted their requested sentence following the Version 21.0 citation. The 1850–1936 waves are therefore fully cleared. Second, the published layer does not ship the RCMS dataset: each county-year row carries only the all-bodies totals (adherent count, population, computed percent) — no denominational breakdown, no congregation-level data, and the page offers no download links. The adherent and population totals are nonetheless source-file columns (e.g. TOTADH_2020, POP2020) republished verbatim per county, so the layer sits between "reporting analyses" (permitted) and "reposting the data" (permission-gated); the register's ASARB reading concerns that gap, for the 1952–2020 waves only. Third, no ASARB or usreligioncensus.org correspondence exists in the project's email; the manifest's "no explicit restriction found" wording records the ARDA download route, which never displays the ASARB FAQ. The recommendation below stands but is a judgement call for the owner, with the NHGIS thread as a working template for a confirmation ask, and the Trinidad and Tobago card as the in-repo precedent for shipping with attribution while an ask is outstanding.

## Recommended next actions

1. **Fix the RCMS manifest now.** Correct the redistribution_limits assertions in apps/regions/us/data/area_summary_county.json, and either restrict the published layer to the pre-1990 and NHGIS-sourced waves or gate the 1990–2020 waves until ASARB permission lands. (See the addendum above: the layer ships all-bodies totals only, and the NHGIS waves are cleared — the open question is confined to the ARDA-era waves.)
2. **Send two permission emails through the existing outreach lane**: ASARB (contact form) for published RCMS-derived county layers, and Pew for a public composition context layer, citing the OWID precedent. Both are cheap asks with plausible yes answers.
3. **Wire GeoNames.** Pull the country dumps, difference CH/MSQE/TMPL/SYG counts against OSM-derived place counts per country, and route unmatched points into the candidate-site pipeline. Roughly a day; near-zero licensing risk; answers the coverage-prioritisation question directly.
4. **Scan the three missed sources** — Wikidata first (CC0, site-level denomination), then Overture places, then the charity registers — with the same licensing-evidence discipline as this round.
5. **Run the RCMS county validation analysis** (OSM coverage ratio by county, urbanity, and region) as internal work, which ASARB's terms permit today, so the calibration is ready whether or not the published layer is approved.
