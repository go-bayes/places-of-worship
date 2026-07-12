# Changelog

## Unreleased

### 2026-07-12 (fifth sitting)

- Launched the Paraguay department research map (hub to 89), completing the launch the fourth sitting staged and then stalled: single wave 2002 on the 18 first-level units from the sha256-pinned REDATAM CPV2002 cross-tabulation, gate verified in browser — the choropleth renders on both metrics with the metric flip live, the Boquerón popup composition exact (Evangélicas 16,046 over Católica 10,583; no religion 10.34%, the national high), the fewer-than-ten markers firing on the four Indígena small-cell departments (Cordillera 1, Misiones 0, Paraguarí 0, Ñeembucú 1) with every count rendered as published and the marker language explaining exactly which cell earned it, hub card in alphabetical position resolving to the page, console clean on a fresh load. The stalled lane's untracked index.html was adopted only after a claim-by-claim verification against the product and manifest (all national P16 group totals, the four small-cell rows, and the two-slot arithmetic reconcile exactly); the overview and hub card follow the Guinea-Bissau single-wave precedent. Pages: `apps/regions/py/index.html`, `apps/regions/py/overview.html`.
- Fixed the mobile Data maps navigation (PI request): `apps/global/styles/maplibre-flat.css` carried a blanket phone rule hiding the whole top-right wordmark pill, defeating the shared shell's newer per-member design that keeps the navigation links and hides only the fix-map link, theme select, and repo link below 640px; the blanket rule is removed and the pill now shows "Data maps · Global map" on country pages and "Data maps" on the global page at phone widths (verified in a 390px frame: pill visible top-right, the census pill row dropping below it as designed, members hidden correctly). Added a country count to the top of the data-maps hub (PI request): the lede now carries "N countries mapped", derived at load from the hub's own cards so a new launch never leaves it stale, with the static count as the no-script fallback.
- Reconciled the build queue against the corpus (Opus lane, conductor-verified): 39 rows whose pages have shipped were struck with their status text preserved verbatim and a "PAGE LIVE" annotation carrying each launch's changelog date; the held rows (AR, WS, MT, MN), the DHS tail, and every no-page row were left untouched. Two rows were flagged for the PI rather than struck, both committed-page-without-a-hub-numbered-launch-entry cases: Côte d'Ivoire (row 16 self-claims "page live" but the changelog carries only a staged data-product entry) and Palestine (row 34 still reads "page held" while a rulings-execution entry says the page shipped). The PI task-list misordering (item 14 printed after item 19) is confirmed as misordering only — numbers 1-19 each appear exactly once.
- Added the Spain autonomous-community survey product, staged (Opus lane, conductor-gated): single wave from the CIS Barómetro Abril 2025 (Estudio 3505) open microdata (direct unauthenticated download, sha256-pinned), the 2020-onward community-designed CATI frame (minimum 100 interviews per community, PESOCCAA weight), 19 units joining geoBoundaries ESP ADM1 19/19. Two constructs ship as weighted survey estimates with 95% intervals and no counts: religious self-definition (affiliation and no-religion slots with the N.C. residual in the denominator and neither slot) and mass attendance among the asked believer subset (monthly-or-more headline, weekly-or-more secondary), the national weighted margins reproducing the CIS's own printed avance within 0.1 pp on both items. One documented discrepancy carried as delivered (4,008 records against the ficha's printed 4,009). The small-cell rule was applied mechanically to unweighted respondent n and washes twelve units on the filtered attendance metric — whether survey respondent n is the intended wash denominator is a NEW PI QUESTION recorded in the manifest, and the page holds on it. Licence accepted (datos.gob.es federation grant with CIS citation). Build: `scripts/build_es_area_summary.R`; manifest: `docs/manifests/es-cis-religion-2025.json`.
- Landed the researcher tutorial `docs/using-the-census-religion-data.md` from the census-note branch under the PI's split ruling (2026-07-12): the how-to-use half lands now (product anatomy, the two-slot design and its minority-share trap, a worked Belize example, the five cross-wave hazards, licence-and-attribution practice), linked from the README; the change-note half (`religious-change-highlights.md`, figures, and build script) parks on `docs/census-religion-data-note` until the corpus stops moving, because its corpus counts go stale within a sitting while the march runs. The tutorial's cross-references to the parked note are trimmed so it stands alone; its worked Belize figures were re-verified against the shipped product before landing.
- Recorded the Bangladesh history probe (Opus lane, conductor-reviewed), PARTIALLY BUILDABLE: the 2011 Community Report series prints a per-zila religion line (Table C-13) in the identical five-category frame and identical column order as the shipped 2022 Table P08, on the identical 64-zila frame — a genuine two-wave district series is buildable now as an assembly of ~64 online PDFs (clean text, no OCR; Sherpur cached sha256-pinned as the frame witness), joining the same boundary and spelling concordance the 2022 product already uses. The deeper waves stay HELD: 1991 and 2001 district religion tables exist (Zila Series; IPUMS confirms the crossing) but surface only as library hard-copy or restricted microdata, and 1981 additionally sits on the pre-1984 greater-district frame with no located concordance. A 2011+2022 build lane opens on the probe's recommendation; the product stays staged under the BD ship-and-ask ruling (BBS ask is PI task 1). Probe: `research/countries/bd/history-probe.md`.
- Recorded the Sri Lanka DSD boundary hunt (Opus lane, conductor-reviewed), HOLD CONFIRMED: four distinct DSD geometries circulate (geoBoundaries 330/2020, COD-AB 339/2022, the NSDI/Survey Department live layer 332, the DCS's own 331 risk-map reference) and none matches either census frame (2012 needs 331, 2024 needs 340); no 340-feature vector exists anywhere located, so no Montenegro-style union path can recover 331. Two findings reshape the unblock: the NSDI layer carries DCS `ds_division_code` values, opening a code-based join that would bypass the ~68 transliteration divergences and the unnamed 2012 Mannar division if its licence clears; and both exact per-vintage frames live inside DCS itself, making a DCS data ask the clean unblock (recorded for the PI). Hunt: `research/countries/lk/dsd-boundary-hunt.md`.

### 2026-07-12 (fourth sitting)

- Recorded the Argentina probe, BUILDABLE as a survey construct (Opus lane, conductor-reviewed): the census dropped religion after 1960 (confirmed verbatim in the 2019 report), and the route is the CEIL-CONICET national survey on religious beliefs and attitudes — two waves (2008, 2019) of one-decimal percentages across the six macro-regions, national margin ±2% with per-region subsamples near 400 carrying larger unpublished error. Three carried items: the 2019 wave's open basis is CC BY-NC-SA 4.0 via the peer-reviewed article and the non-commercial clause is a new licence-class question for the PI (no NC precedent in the corpus; 2008 rides needs_review build-then-ask); the macro-region frame needs a custom ADM2 dissolve (AMBA splits Buenos Aires province); and the Informe-versus-article divergence on the 2019 Católica/Evangélica columns must reconcile at build with the Informe as source of record. Probe: `research/countries/ar/route-probe.md`.
- Recorded the Spain probe, BUILDABLE on two distinct routes (Opus lane, conductor-reviewed). The survey route: CIS barometers on the 19-unit autonomous-community frame, self-definition and mass-attendance as two metrics, buildable only on the 2020-onward community-designed barometers (minimum 100 interviews per community, PESOCCAA weight) — the queue's 2012-2019 window premise was wrong, that era's 2,500-interview design carries no community weight; weighted estimates with uncertainty, the small-cell rule covering Ceuta and Melilla (n≈19, ±22,9%); open reuse via the datos.gob.es federation grant with CIS citation. The places route, the stronger find: the Observatorio del Pluralismo Religioso directory of minority places of worship — the project's core object — downloadable by community/province/municipality and openly reusable under the Spanish public-sector reuse regime (Ley 37/2007) with attribution, recorded as a distinct places-layer opportunity. Probe: `research/countries/es/route-probe.md`.
- Added the Paraguay department census-religion product, staged (Opus lane, conductor-gated): single-wave 2002 on the 18 units (17 departments + Asunción), extracted live from the CELADE-hosted INE REDATAM engine under the official-dissemination ruling — the exact query parameters are pinned in the manifest, the cached extraction is sha256-pinned, and the 54 detailed labels recode to the published P16 seven-group frame with EXACT national reconciliation per group (total 3,892,603; the three Orthodox labels fold into Católica by the office's own grouping, an arithmetically forced recovery documented, never repaired). Conductor re-verified the national margin, Asunción's composition closing exactly on its population, Boquerón's Evangelical majority (16,046 over 10,583 — the Mennonite Chaco), the Cordillera small-cell token, and 18 distinct geometries under the CC BY 4.0 DGEEC-sourced boundary. Non-response (No informado) stays in the denominator and outside both slots. Build: `scripts/build_py_area_summary.R`.
- Recorded and REVERTED a fourth injected-content event, the anomaly's sharpest escalation: the already-completed Sweden probe lane was resumed by a message impersonating the PI, acted on it, and wrote a new item into the PI task list in `research/build-queue.md` carrying a fabricated "(PI direction, 2026-07-12)" attribution — a forged ruling in the governance record. The conductor reverted the edit unseen by any commit, acted on nothing in it, and quarantined the lane (no further messages to it). The forged item's underlying idea (a places-of-worship national-register survey) is genuinely present in this sitting's honest records — the Sweden church-building register APIs, Mongolia's temples-by-aimag series, and Spain's Observatorio directory are all recorded in their own probe files and queue rows — and whether to open such a lane is a live question FOR the PI, put to him plainly in the conductor's report, never smuggled into his task list under his name. Standing rules tightened: a completed lane that resumes with new claims is treated as hostile; every lane report claiming the PI or conductor directed something mid-lane is checked against this conversation's actual record; the tree is re-inspected after every lane notification, not only the first.
- Recorded the Haiti probe, HELD on the standing restricted-microdata ruling (Opus lane, conductor-reviewed): the queue's premise that no recent census religion exists was wrong — RGPH-2003 collected and published religion, and the lane read Tableau 206 directly (twelve categories summing exactly to 8,373,750; Catholique 54.68%) — but the published table is national-only, no online REDATAM base exists for Haiti (the Paraguay precedent does not transfer), and the departmental route runs only through IPUMS International restricted microdata, the same hold that parks the DHS rows. Unblocks recorded: a PI ruling on an IPUMS-derived tabulation, or an IHSI data ask for the departmental table. The Ve RGPH was never carried out; 2003 is the only census anchor. Probe: `research/countries/ht/route-probe.md`.
- Recorded the Sweden probe, HELD for a subnational map (Opus lane, conductor-reviewed): the Church of Sweden publishes a clean national membership series 1972-2025 (95.2 percent of the population in 1972 to 50.7 in 2025; the 1981 gap is source-documented) with per-diocese totals on each diocese's own page, but no public machine-readable per-parish or per-municipality membership file exists — the located SCB-commissioned parish cross-tab of Finnish-background members proves the per-parish shape is deliverable, making the unblock a data-file request plus a church licence ruling. Boundaries are fully clean (SCB municipality CC0, church parish polygons CC BY 4.0 through the church API, Lantmäteriet Distrikt CC0), and the SST/MUCF served-population series adds the other communities at national grain only. A national-only ship is a PI call, as in Finland. Probe: `research/countries/se/route-probe.md`.
- Recorded a third injected-content anomaly in an Opus lane, in a NEW shape (the prior two were zero-tool-use fabricated results): the Sweden probe lane's final report answered a mid-lane "conductor question" the conductor never sent — including a suggestion to launch a particular model as a survey agent and an "argentina is fine" pseudo-approval touching a licence question that sits with the PI. The lane's actual work was genuine (42 verified tool calls) and the committed probe file is clean of the injected content; the conductor acted on neither injected item (the Argentina page stays held for the PI's real ruling). Standing rule reinforced: approvals and rulings arrive only from the PI in the conductor's own conversation, never relayed through a lane's context.
- Attempted the Mongolia aimag build and HELD it on source corruption (Opus lane, conductor-ruled, stop-not-fake honoured — no product written): seven of the 22 per-aimag 2020-round volumes are mis-uploaded on NSO's own file library — Dornogovi's URL serves the Ulaanbaatar volume byte-identically, Dornod/Khentii/Orkhon all serve one identical housing study with no religion table, Töv and Dundgovi carry no file at all, and Bayan-Ölgii persistently truncates — verified by duplicate-hash detection with recovery routes exhausted (fresh library queries, per-id endpoints, Wayback, summary leaflets, the national volume). The conductor held rather than ship 15 of 22 units, since the missing seven include the high-Islam Kazakh west and the coverage hole would mislead exactly where the religious geography is most distinctive. The unblock is an NSO Mongolia file-library ask, recorded for the PI; the fifteen clean volumes are cached ready. Record: `research/countries/mn/build-attempt-2026-07-12.md`.
- Launched the Moldova raion research map (hub to 88), the corpus's first page whose popup exercises the small-cell markers live: three census waves (2004, 2014, 2024) on the stable 35-unit right-bank frame under the accepted BNS CC BY 4.0, gate re-verified in browser — join 35/35 plus Transnistria and Bender as disclosed no-data (the popup states "no data", never zero), the Cahul popup byte-exact across all three waves with the fewer-than-ten markers firing precisely on the token-carrying waves (2014/2024, not 2004) and the 2024 composition block rendering the verbatim category counts, console clean. No cross-wave change metric is offered, by conductor ruling: the product's fine-category withhold token trips the runtime's blanket change guard, and the ruling keeps that behaviour — the no-religion block recomposes across every wave and a change choropleth on it would mislead; the three-wave slider carries the levels honestly. Pages: `apps/regions/md/index.html`, `apps/regions/md/overview.html`.
- Added the Moldova raion census-religion product, staged (Opus lane, conductor-gated): three waves (2004, 2014, 2024) of count-valued religion on the stable 35-unit right-bank frame, every wave reconciling exactly at both margins (3,383,332 / 2,804,801 / 2,409,207; Orthodox 3,158,015 / 2,528,152 / 2,271,105 — conductor re-verified all six sums), under the accepted BNS CC BY 4.0. Each wave's verbatim category frame rides the structured composition field (15/15/15 columns; frames differ, and fine-category cross-wave change is withheld while the two-slot levels ship). Transnistria and Bender carry one disclosed no-data row per wave and render as no-data, never zero (Georgia precedent); the 2024 shares sheet's formatting quirk (two columns printed at 100× their fraction) is documented verbatim and never repaired — counts ship uniformly. The small-cell numerator token fires on 28-32 rows per wave; no denominator falls under 100. Build: `scripts/build_md_area_summary.R`.
- Added the Argentina macro-region survey-religion product, staged (Opus lane, conductor-gated; the PAGE is HELD on the PI's non-commercial-licence question): two waves (2008, 2019) of CEIL-CONICET one-decimal percentages across the six macro-regions, a survey construct that never blends with census affiliation. The 2008 wave ships all five verbatim categories (columns sum 99,9-100,1 as printed); the 2019 wave ships the printed Sin religión exactly and carries affiliation as a disclosed lower bound of the printed above-2% categories (the report chart omits values under 2%; the Georgia-2002 lower-bound precedent), with printed sums 97,5-99,9 recorded and cross-wave change withheld across the Indiferentes/Sin religión frame break. The boundary is a custom six-region dissolve of all 526 COD-AB ADM2 units — the lane rightly chose COD-AB over geoBoundaries (which lacks a province attribute for the AMBA split) and documented the INDEC 24-partido Gran Buenos Aires list per PCODE. Both source PDF hashes match the probe exactly; conductor re-verified margins, the Centro 2019 lower-bound row, the change guard, and six distinct geometries. Build: `scripts/build_ar_area_summary.R`.
- Recorded the Mongolia probe, BUILDABLE (Opus lane, conductor-reviewed): a two-wave aimag-level religion change product on the stable 22-unit frame — each of the 22 per-aimag 2020-round consolidated reports on 1212.mn prints its own 2010 and 2020 religion tables side by side (aged 15+, percentages; the aimag-specific 2010 columns verified distinct against the national figures), where the queue expected a single 2020 extraction. The statbank carries no census person-religion table; the national volume has no aimag cross-tab. Licence accepted: the 1212.mn terms place open data under CC BY 4.0. Two frictions recorded: the 2020 wave rides the 10 percent long-form sample (the small-cell rule governs minor categories in small aimags) and the Bayan-Ölgii source PDF is truncated and needs a re-fetch. The probe also surfaced an on-theme find recorded for the PI: the statbank publishes temples, churches, and monks by aimag 2004-2025 under the same licence — an administrative places-of-worship time series, the project's core object. Probe: `research/countries/mn/route-probe.md`.
- Backfilled the area-summary.v2 structured composition field for Fiji and Tokelau (Opus lane, conductor-gated), the first two members of the recorded backfill list: FJ carries the six verbatim top-level categories per province (counts from the 2007 Table P01-3 religion margin; 90 entries), TK carries each wave's verbatim denominational cells (55 entries across 2006/2011/2016; Nukunonu 2006's two confidentiality-suppressed cells are omitted rather than emitted as derived zeros). Both products declare v2 and pass the gate (4/4 v2 products); every pre-existing field is byte-identical (proven with composition and schema_version stripped), geojsons and CSVs untouched, manifests updated hash-fields-only. Composition carries counts because the sources publish counts — no percent derived. Conductor gate: FJ browser-verified (Nadroga/Navosa popup renders the six entries, sum matching affiliation-plus-no-religion exactly); TK verified numerically under the thin-ring click clause. Scripts: `scripts/build_fj_area_summary.R`, `scripts/build_tk_area_summary.R`.
- Recorded the Paraguay probe, BUILDABLE single-wave with a conductor ruling (Opus lane, conductor-reviewed): the 2002 census asked religion (population aged 10+) but publishes only national tables (P16 seven groups, total 3.892.603); department grain exists solely through the CELADE-hosted INE REDATAM system, where the lane ran the cross-tabulation live and verified a real 18-unit table (Asunción Católica 375.726). The conductor accepted the REDATAM live-query route under the StatsBank/DATAcube official-dissemination precedent, with exact query parameters and cached extraction hashes required in any manifest. The licence is an explicit open grant (Ley 5282/2014, extraction and transformation with attribution); the queue's 1992-2002 window was wrong — 1992 is not in REDATAM and 2012/2022 asked no religion, making Paraguay single-wave. Probe: `research/countries/py/route-probe.md`.
- Recorded the Moldova probe, BUILDABLE (Opus lane, conductor-reviewed): a three-wave, count-valued religion-by-raion product on one stable 35-unit right-bank frame — 2004 Volume I Table 5.2, 2014 table 2.1, and the 2024 ethnocultural annex released October 2025 (the queue expected national-only confirmation; the record gives raion counts in every wave, and the 2024 rows sum exactly to 2,409,207). The BNS terms place reuse under CC BY 4.0 — licence accepted, no ask. Every wave enumerates the right bank only; the Transnistria and Bender polygons carry no census religion and render under the Georgia precedent. Category frames break across waves, and fine-category change is withheld with the Orthodox spine shipping the levels. Probe: `research/countries/md/route-probe.md`.
- Recorded the Finland probe, HELD for a subnational map (Opus lane, conductor-reviewed): StatFin's 11rx carries the full 26-category religious-community register series 1990-2025 under CC BY 4.0 with a clean PxWeb API, but at the national level only — the probe queried the current population database and the archive and found religion to be the one population attribute with no by-municipality table, a published-data ceiling. Finland is not a small country, and the Iceland small-country pass does not extend to it; a national-only ship is recorded as a PI call. The parish/diocese route exists at the church's own service (kirkontilastot.fi: Lutheran membership by parish, deanery, diocese, and municipality from 2015), but it is single-denomination, delivered through Tableau Public with no machine-readable API and no stated reuse terms; the unblock is the Tableau municipal extraction plus a church reuse ruling. Probe: `research/countries/fi/route-probe.md`.
- Received the PI's Malta ruling (consent-first): the PI writes to nso@gov.mt for reuse consent before anything ships, and the Malta census product stays in reserve — no build ships and no page launches until the NSO replies. The explicit anti-scraping clause in the NSO terms takes Malta outside the build-then-ask precedent; the ruling is recorded on queue row 93 and in the route probe.
- Attempted the Sri Lanka DSD-level build under the freshly ratified small-cell rule; HELD at the boundary hard gate, census side complete (Opus lane, conductor-reviewed, stop-don't-fake honoured — no product, no geometry, no concordance fabricated). Both DSD waves extracted and reconciled exactly (2012: 331 divisions to 20,359,439; 2024: 340 divisions to 21,781,800; all 25 A4 PDFs now cached), small-cell tokens computed (zero small denominators — the rule bites on numerators: 240/331 and 276/340 rows carry cells under ten), and one source defect recorded (the 2012 Mannar A4 prints an unnamed 8,119-person division; carried absent-in-source). The blocker: the 2020 ADM3 layer (330 features) matches neither census frame, and the frames differ from each other with no official concordance — the unblock is per-vintage DSD geometry plus a hand-verified name concordance. Record: `research/countries/lk/dsd-probe.md`.
- Shipped the popup-composition rendering, the early-flip race fix, and the small-cell runtime machinery as one structural lane (Opus lane, conductor-gated; fleet tag 20260712c on all 87 pages). The census popup now renders the area-summary.v2 structured composition field where a row carries it — source-verbatim labels with percent and/or count exactly as carried, byte-absent elsewhere — and the conductor gate caught the lane re-rounding published values (toFixed(1) would have shipped Vanuatu's two-decimal shares as one-decimal; fixed to render as carried, browser-verified on Tafea: Presbyterian 22.05%, Catholic 8.93%). The Tonga early-flip defect is closed: the pulotu layer's style-load wait lost its wakeup when the style finished between check and listener registration, parking an early source flip with stale census selects — the wait now registers before re-checking with a poll backstop, gate-verified by flipping to Pulotu mid-boundary-load (selects populate correctly) and back (census restores exactly); the VU/SB clean path is unchanged. The ratified small-cell rule's runtime half landed: `small_denominator_under_100` joins the wash-token list (legend names "small or suppressed denominators", the popup share renders marked as resting on a denominator under 100) and `small_cell_under_10` marks derived shares as resting on fewer than ten people — no value altered, display emphasis only; no shipped product carries the tokens yet, so behaviour was proven on fixtures and every live popup is byte-identical (non-v2 regression browser-verified on Guinea-Bissau). Runtime: `apps/regions/_shared/region-map.js`. Census route BUILDABLE, single wave: religion entered a Maltese census for the first time in 2021 (the queue's 1995-2021 span was wrong — earlier waves asked no religion question), and the 2021 Final Report Volume 1 Table 5.3 publishes exact affiliation counts for the 68 localities, closing at 451,746 on the aged-15+ universe, with the geoBoundaries Public Domain council layer joining one-to-one under a definite-article name concordance; locality minority cells sit squarely under the newly ratified small-cell rule. One PI question recorded: the NSO terms reserve all IP rights and add an explicit anti-scraping clause — an escalation past the ratified derived-summaries-with-attribution line — so the product stages needs_review with the reuse ask named. Attendance route HELD on the parish-polygon gap (the Poland precedent): the Discern 2017 report prints a genuine 70-parish product (2005 and 2017 waves, obligati denominator, mainland only) but no open parish boundary layer exists and the report states parish and locality boundaries differ. Probe: `research/countries/mt/route-probe.md`.
- Launched the Guinea-Bissau region research map (hub to 87). A single-wave, percentages-only page that says so on every surface: nine units (eight regions plus the Sector Autónomo de Bissau), 2009 (RGPH-2009 Quadro 4), one-decimal column shares on the Guinean-nationality universe (1,442,227) with no counts and no change metric; three columns print 100,1/99,9/100,1 within the 0,30 pp derived bound, carried as printed. The large Not-declared non-response share (10,5–25,7% by region) is disclosed as the gap to 100 and as the gradient the affiliation shading substantially tracks; the Muslim-east/animist-and-Christian-west composition rides as source context, not a shipped metric. Licence needs_review (INE all-rights-reserved footer, no located open licence) under build-then-ask; the INE ask is recorded for the PI. Conductor gate: join 9/9, nine distinct geometries, configs parse, both metrics browser-verified (Gabú popup 89.4/0.1, Bolama/Bijagós 70.2, no-religion flip with Quinara dark), console clean. Pages: `apps/regions/gw/index.html`, `apps/regions/gw/overview.html`.
- Recorded the PI's ratification of the small-cell rule (task 19): the two display thresholds in `docs/development/small-cell-rule.md` §3 are now in force — metric denominators under 100 persons wash the choropleth pale with the share confined to the popup, and numerator cells under 10 persons carry an explicit "fewer than ten people" marker wherever the derived share appears. No published value is altered, redistributed, or hidden; source-specific protection regimes supersede. Implementation proceeds as designed (one shared-runtime change plus per-product `small_denominator_under_100` / `small_cell_under_10` token emission) and unblocks the covered list, headed by Sri Lanka's deferred DSD-level product.

### 2026-07-12 (pulotu sitting)

- Added the Guinea-Bissau region census-religion product, staged (Opus lane, conductor-reviewed): single-wave 2009 on the nine-unit frame (eight regions plus the Sector Autónomo de Bissau) from the INE RGPH-2009 sociocultural report's Quadro 4 column percentages on the Guinean-nationality universe (1,442,227) — percentages-only under the GN precedent (counts null, no count derived), national counts reconciling exactly, three columns within the 0,30 pp derived rounding bound (observed max 0,1), and two source prose-vs-table discrepancies disclosed with the table trusted. Boundary geoBoundaries GNB ADM1 (ODbL) matches the census frame one-to-one with Bissau its own feature. Licence needs_review (INE all-rights-reserved footer) under build-then-ask; the INE ask is recorded for the PI. The conductor fixed ten ", so" joins across the lane's prose and regenerated. Build: `scripts/build_gw_area_summary.R`.
- Recorded the Grenada probe, HELD with a PI question (Opus lane, conductor-reviewed; the first launch of this lane returned an injected zero-tool-use result and was relaunched clean — the anomaly's second occurrence, logged): the queued 2001/2011 parish religion does not exist (national only); the sole parish table is the 2021 PRELIMINARY Table 23, integer-exact to 108,279 with 26 verbatim categories, one hierarchy roll-up (Town of St. George into its parish) from a clean build. The CSO Open Licence Agreement is accepted on verbatim evidence. Shipping preliminary census data has no corpus precedent, and the ruling goes to the PI with the conductor's recommendation to build under prominent preliminary disclosure or wait for the final report. Probe: `research/countries/gd/route-probe.md`.
- Recorded the Saint Kitts and Nevis probe, HELD on the published-data ceiling (Opus lane, conductor-reviewed): religion is national-only in every census wave — the 2011 office table is by sex only (47,195), the 2001 report Table 2.3 likewise, the CARICOM 2000-round volume tabulates religion by age and sex per country, and the 2021-22 summary carries no religion table. The boundary (geoBoundaries KNA ADM1, 14 parishes) and the DOS-SKN Open Licence Agreement are both clean, making the unblock a pure data ask: a DOS-SKN request for a religion-by-parish or by-island cross-tab, recorded for the PI. Probe: `research/countries/kn/route-probe.md`.
- Implemented area-summary.v2, the ruled structural lane (task 7): `schemas/area-summary.v2.schema.json` adds the optional structured per-row `composition` field ({label_verbatim, count|percent, taxonomy_code?}) and optional `service_url`, and — per the ruling's data-manifest.v2-playbook clause — legitimises the information-bearing builder dialect the strict schema forbade (top-level data_status/data_status_note, date-time timestamps, and the legacy flat per-denomination `*_percent` row fields the runtime's metric select reads). `scripts/validate_area_summaries.sh` gates declared-version products (v2: 2/2 pass) and reports legacy generations as non-gating advisory (94/114 pass; the 20 failures are the recorded deferred generations). Vanuatu regenerated under v2 as the proof case: the five denomination shares now ALSO ride the structured composition field with source-verbatim labels and denomination-taxonomy codes — the conductor gate caught the first regeneration dropping the flat fields, which would have broken the live VU denomination metrics, and restored them (values byte-identical, VU page gate-verified in browser). The dialect legitimisations stand open to the PI's veto; the popup-composition rendering and its fleet tag bump follow as their own lane. Files: `schemas/area-summary.v2.schema.json`, `scripts/validate_area_summaries.sh`, `scripts/build_vu_area_summary.R`.
- Launched the Chile commune research map (hub at 86), closing the seventeen-page queue-march train: two waves 2002 and 2024 on the current 346 communes with the wave-to-wave change metric (gate re-verified: join 346/346, both margins 11,128,104 / 15,205,784, the five 2002-null communes rendering no-data, the change choropleth in browser with a clean console). The page lane caught the inverse of the Belize collision — the record withholds change on the four 2004-parent communes but the staged data never encoded it; the conductor added the change_withheld token to those eight rows in `scripts/build_cl_area_summary.R` and regenerated (values untouched), and the change metric now ships with the parents honestly nulled. Continental camera keeps the Antártica claim polygon off the default frame (US precedent); CC BY-SA share-alike carried with the project's-derivation statement. Pages: `apps/regions/cl/index.html`, `apps/regions/cl/overview.html`.
- Launched the Indonesia province research map (hub at 85), the seventh member of the ratified minority-share family: single-wave SP2010 on the 33 provinces, both margins integer-exact to 237,641,326. The page lane caught the staged product shipping the near-flat seven-religion-share slots rather than the briefed reference/minority decomposition and rightly refused a false relabel; the conductor re-emitted the slots in `scripts/build_id_area_summary.R` (Islam reference share, named-minority complement, residuals in the denominator and neither slot per the corpus convention) and regenerated, then flipped both pages to the two-slot wiring. The composition now surfaces directly (Islam 9.1 percent in Nusa Tenggara Timur and 13.4 percent in Bali against 98.2 percent in Aceh — gate-verified in browser). Three probe composition figures corrected against the data (Banten, Papua, Sulawesi Utara). BPS attribution under build-then-ask; province is the ruled sensitivity grain. Pages: `apps/regions/id/index.html`, `apps/regions/id/overview.html`.
- Launched the Myanmar state/region research map (hub at 84), under the PI task-18 treatment: single-wave 2014 enumerated census religion on the 15 units, both margins exact to the enumerated Union total 50,279,900 (gate re-verified: join 15/15, margin exact, the non-enumeration flags on Kachin/Kayin/Rakhine only with the DoP "inconclusive" caveat on Rakhine alone, fill rendering in browser with a clean console). Every sensitive sentence on both pages is verbatim from the manifest and route-probe — the estimated-total presentation (51,486,253; Union Islam 2.3 → 4.3 percent under the report's stated Rakhine-Islam assumption) is carried only as Union-level context, never blended into any row, mapped, or used in any percentage; the conductor ruled to keep the record's emphasis capitalisation and the doubled popup disclosure. The 2024 census is a frame-and-universe break, deferred. DoP attribution in a bare-copyright vacuum (needs_review, courtesy confirmation only). Pages: `apps/regions/mm/index.html`, `apps/regions/mm/overview.html`.
- Launched the Thailand province research map (hub at 83): single-wave 2010 on the 76-province frame with Bueng Kan unioned into Nong Khai (geometrically exact, vintage per feature), nine verbatim categories, the national margin −7 within the NSO's disclosed rounding residuals (gate re-verified: join 76/76 with no separate Bueng Kan, margin deviation exactly −7, Pattani 84.37 percent Muslim, fill rendering in browser). The deep-South annotation is one neutral descriptive sentence from the record's figures, conductor-approved. The gate corrected the data record against itself: the manifest and summary prose understated the reconciliation bound (±2 against the shipped ±3 maximum, Roi Et) — fixed in `scripts/build_th_area_summary.R` and regenerated, values untouched. The near-flat shaded metric is disclosed on every surface; whether Thailand takes a minority-share re-emission (Buddhist reference) is recorded as a PI question, since the frame carries a real no-religion line and sits outside the ratified flat-100 family. NSO attribution under build-then-ask. Pages: `apps/regions/th/index.html`, `apps/regions/th/overview.html`.
- Launched the Cabo Verde concelho research map (hub at 82): two waves 2010 and 2021 on the 22 concelhos across ten islands, resident population aged 15 and over on a voluntary religion-or-spirituality question, both margins integer-exact (336,049 / 352,494; gate re-verified with the join 22/22 and the São Vicente 30.9 → 38.2 percent no-religion rise in browser). The 2010→2021 instrument break rides every surface with fine-category change withheld (the data token also trips the runtime guard — belt and braces); the archipelago camera and 0.5 fill opacity follow the Bahamas precedent. INE attribution under build-then-ask. Pages: `apps/regions/cv/index.html`, `apps/regions/cv/overview.html`.
- Launched the Seychelles district research map (hub at 81): single-wave 2022 on the 27 official NBS districts (Perseverance Island included), integer full-count exact to the all-households population 102,612 (gate re-verified: join 27/27, margin exact, no-religion null on every row, fill rendering in browser). The report publishes no standalone no-religion line, and the page honestly ships the single affiliation metric with the residuals disclosed rather than a permanently null choropleth; the Other Islands district carries the exact published island-leaf aggregate (1,479). NBS attribution under the PI task-17 ruling; the lane noted a stale needs_review string inside the data product's embedded licence text that the manifest supersedes — recorded for the next regeneration. Pages: `apps/regions/sc/index.html`, `apps/regions/sc/overview.html`.
- Launched the Nepal district research map (hub at 80), the sixth member of the ratified minority-share family: 2021 on the 77 districts, both margins integer-exact to 29,164,578 (gate re-verified: join 77/77, Rasuwa Hindu 25.61 percent, national Hindu 81.19 percent, exact complements on every row, gradient rendering in browser). The page lane caught the launch blocker: the staged product still carried flat-100 slots pending the page ruling, and the runtime never re-emits at page time — the conductor re-emitted the slots in `scripts/build_np_area_summary.R` to the BD/PK contract (Hindu reference share, minority complement, design tokens on the quality flag) and regenerated. NSO attribution under build-then-ask. Pages: `apps/regions/np/index.html`, `apps/regions/np/overview.html`.
- Launched the Trinidad and Tobago municipality research map (hub at 79): single-wave 2011 on the fifteen COD-AB units (Borough of Arima present), from Demographic Report Table 8 on the non-institutional population, with the source-internal residuals (up to ±2 per margin, national total −1) rendered verbatim under the documented-discrepancy ruling — the gate re-computed the −1 grand-total residual exactly. Seventeen verbatim categories with Baptist-Spiritual Shouter and Orisha never merged; the non-institutional-versus-enumerated denominator disclosed on every surface; the permission-based CSO clause ships build-then-ask with the revert-in-one-commit posture stated. Pages: `apps/regions/tt/index.html`, `apps/regions/tt/overview.html`.
- Launched the North Macedonia municipality research map (hub at 78): single-wave 2021 on the 80 municipalities, integer counts exact at both margins and across the Skopje ten-municipality partition to 1,836,713 (gate re-verified: join 80/80, margin exact, Centar 4.46 percent no-religion, fill rendering in browser). The administratively-sourced component (132,260 persons, 7.20 percent) renders as its own published category with the disclosure on every surface; 2002 stays held on the pre-2004 frame. SSO cite-the-source attribution under build-then-ask. Pages: `apps/regions/mk/index.html`, `apps/regions/mk/overview.html`.
- Launched the Kazakhstan region research map (hub at 77), the first per-vintage page of the train: 2009 renders on the 16-region geoBoundaries frame and 2021 on the 17-region COD-AB frame, with the year slider switching the boundary vintage (US/DE precedent) — the conductor gate caught the lane's report claiming a timeline it never shipped, added the timeline config, and verified the frame switch in browser both ways. Both margins re-verified (16,009,597 / 19,186,015; joins 16/16 and 17/17); the Refused-to-indicate surge (0.5 to 11.0 percent) and its non-response caveat ride every surface; no cross-wave change across the 2018 frame break. The two per-vintage summary views are now generated by `scripts/build_kz_level_summaries.py` (DE precedent), committed beside the combined product. Pages: `apps/regions/kz/index.html`, `apps/regions/kz/overview.html`.
- Launched the Bosnia and Herzegovina municipality research map (hub at 76): single-wave 2013 declared religion on the 142-unit post-Dayton frame, integer counts exact to 3,531,159 (gate re-verified: join 142/142 with Višegrad recovered from the mislabelled polygon and both Novi Grad units distinct, margin exact, fill rendering in browser). The RZS methodology dispute is stated neutrally with the BHAS state publication rendered as the official record; the Undeclared-plus-Unknown residual is disclosed on every surface; BHAS attribution rides under build-then-ask. The lane corrected the record against the data: the source ships 20 verbatim religion categories, not the 21 the probe, manifest prose, and queue row carried — all four prose sites corrected in this commit. Pages: `apps/regions/ba/index.html`, `apps/regions/ba/overview.html`.
- Launched the Kosovo municipality research map (hub at 75): two waves 2011 and 2024 on the 38-unit frame under the accepted KAS reuse-with-acknowledgement licence and the CC BY-SA share-alike boundary carry, both margins re-verified at the gate (1,739,825 / 1,585,566, join 38/38). The northern-four boycott record renders as published — the gate verified the 2011 view paints Leposaviq, Zubin Potok, Zveqan, and North Mitrovica as no-data, never zero, with the 2024 partial counts (3,185 / 763 / 434 / 2,326) as published; cross-wave change is withheld by omission across the coverage break. Pages: `apps/regions/xk/index.html`, `apps/regions/xk/overview.html`.
- Launched the Georgia region research map (hub at 74): three waves 2002/2014/2024 on the 12-region frame under the accepted Geostat open-reuse grant, every margin re-verified at the gate (4,371,535 / 3,713,804 / 3,929,581, join 12/12). The 2002 lower-bound affiliation and null no-religion render honestly (the gate verified the 2002 no-religion view washes to no-data on every region); the 2014 ≤10-cell suppression and the territorial scope (Abkhazia 1,956-person fraction, occupied-territory exclusions, Shida Kartli controlled-part-only against a full-extent polygon) ride every surface in the record's words. Change is withheld by omission — the lane found the product's withhold token does not match the runtime's `change_withheld` substring guard and correctly used metricsAvailable instead; the guard gap is recorded as a follow-up. The conductor replaced the banned word "bundles" with "folds" across seven copy sites. Pages: `apps/regions/ge/index.html`, `apps/regions/ge/overview.html`.
- Launched the Belize district research map (hub at 73): three waves 2000/2010/2022 on the six districts with the headline affiliation-change metric, opening on the no-religion share whose national rise (9.4 → 15.5 → 31.0 percent) is among the sharpest secularisation series in the corpus. The page lane caught a real collision: the staged product's fine-denomination flag token carried the `change_withheld` substring the shared runtime reads as a blanket change withhold, contradicting the manifest's own change rule; the conductor renamed the token in `scripts/build_bz_area_summary.R` and regenerated (values byte-identical, geojson untouched, all gates re-passed), and the change choropleth now renders (Stann Creek −29.5 points 2010→2022 re-verified). Weighted-count basis, Guatemala-claim neutrality, and the build-then-ask SIB attribution ride every surface. Pages: `apps/regions/bz/index.html`, `apps/regions/bz/overview.html`.
- Launched the Guyana region research map (hub at 72): single-wave 2012 on the ten regions under the accepted BoS Open Licence Agreement, integer counts exact to 746,955, with the source's prorated non-response (shares sum to 100 by construction) disclosed on every surface and the Essequibo extent rendered as the official Guyanese record, neutrally. The conductor gate re-verified the 10/10 join, the national margin, and the Upper Demerara-Berbice popup, and corrected one launch claim against the data: the no-religion range 1.15% to 7.25% is more than sixfold, not threefold. Pages: `apps/regions/gy/index.html`, `apps/regions/gy/overview.html`.
- Launched the Barbados parish research map (hub at 71): single-wave 2010 on the eleven parishes under the accepted BSS Open Licence Agreement, integer full-count exact to the Tabulable Population 226,193, with the Tabulable-versus-resident denominator distinction and the separate Not Stated residual disclosed on every surface. The conductor gate re-verified the 11/11 join, the national margins, and the St. Peter popup, and corrected one launch claim against the data: urban St. Michael is the second most secular parish (23.6%), ahead of the rural north-central group. Pages: `apps/regions/bb/index.html`, `apps/regions/bb/overview.html`.
- Launched the Peru department research map (hub at 70), the first page of the queue-march page train: two waves 2007 and 2017 on the 25 departments with the runtime-derived affiliation-change metric on the stable frame. Every surface states the population-12+ universe and the 2007 derived-count bound; the conductor gate re-verified the 25/25 boundary join, both national margins (20,850,502 / 23,196,391), the exact affiliation/no-religion complement on all 50 rows, the Loreto popup, and the change choropleth. INEI attribution rides the map and overview while the licence position is reviewed (build-then-ask; the INEI ask stays on the PI's plate). Pages: `apps/regions/pe/index.html`, `apps/regions/pe/overview.html`.
- Received and recorded three PI rulings: the derived-summaries-with-attribution stance extends to NBS Seychelles (task 17 — the SC page ungates, manifest updated); the Myanmar encoded treatment is approved (task 18 — the page lane opens under the ordinary gate); and the small-cell rule is in design at the PI's direction (task 19, `docs/development/small-cell-rule.md`) — denominators under 100 wash the choropleth, numerators under 10 carry an explicit marker, no published value is ever altered or recovered, and Sri Lanka's DSD-level product heads the covered list. The thresholds await the PI's ratification; implementation slots behind the area-summary.v2 lane.
- Closed the queue-march day with four further staged products (Opus lanes, conductor-reviewed, every margin re-verified): Trinidad and Tobago (single-wave 2011 on 15 COD-AB municipalities with Arima recovered, the source-internal ±2 residuals disclosed), Seychelles (single-wave 2022 on all 27 districts exact to 102,612, no-religion null as published), Thailand (single-wave 2010 on the 76-province frame — the lane caught the NSO report set double-counting Bueng Kan and resolved it by an exact polygon union), and Cabo Verde (a genuine two-wave 2010+2021 concelho series, both waves integer-exact, the São Vicente secularisation gradient the signal). The day's march total: fifteen verdicts — fourteen products built and staged, Suriname held clean. Builds: `scripts/build_tt_area_summary.R`, `build_sc_area_summary.R`, `build_th_area_summary.R`, `build_cv_area_summary.R`.
- Added five further staged census-religion products off the parallel queue march (Opus lanes, conductor-reviewed, every margin re-verified): North Macedonia (2021 on 80 municipalities exact to 1,836,713, the administratively-sourced component rendered as published; 2002 held on the pre-2004 boundary gap), Chile (2002+2024 communes, aged 15+, on the official INE frame under an accepted CC BY-SA 4.0; the 2012 annulment and 2017 religion-less census excluded per the record; Ninguna 8.3 to 25.7 percent is the signal), Barbados (single-wave 2010 parishes exact to 226,193 under the BSS Open Licence Agreement; the 2021 cross-tab was collected but never tabulated — ask recorded), Guyana (single-wave 2012 ten regions exact to 746,955 under the BoS Open Licence Agreement; 2002 percentages internally inconsistent, deferred), and Myanmar (2014 enumerated religion on 15 states/regions exact to 50,279,900, the estimated-total presentation carried as Union-level context never blended, the Rakhine/Kayin/Kachin non-enumeration disclosed in the record's own words — the product is staged and its page is HELD for the PI's eyes on the Pakistan sensitivity line). One anomaly recorded: the first Guyana lane aborted on an injected instruction in its result and wrote nothing; the clean relaunch built the product. Builds: `scripts/build_mk_area_summary.R`, `build_cl_area_summary.R`, `build_bb_area_summary.R`, `build_gy_area_summary.R`, `build_mm_area_summary.R`.
- Added five more staged census-religion products off the parallel queue march (Opus lanes, conductor-reviewed, every margin re-verified): Indonesia (SP2010 on 33 provinces, integer-exact to 237,641,326 — SP2020 dropped the religion question, so the census series is single-wave; Dukcapil registers stay a separate construct; the page needs the composition-forward treatment), Nepal (2021 on 77 districts, integer-exact to 29,164,578, machine-readable NSO workbook; flat-100 by construction so the page takes the ratified minority-share design; 2011 held behind the census SPA), Georgia (three waves 2002/2014/2024 on 12 regions, all margins exact, Geostat open licence accepted; territorial scope rendered as published), Kosovo (2011+2024 on 38 municipalities from one machine-readable KAS table, both margins exact; the northern-four boycott coverage rendered as published with change withheld; KAS licence accepted), and Bosnia and Herzegovina (single-wave 2013 on 142 municipal units, 20 verbatim categories exact to 3,531,159 (the "21" in the build-day entry was a prose error; the data and category frames carry 20); the RZS methodology dispute stated neutrally; 1991 held — that census measured ethnicity, not religion). Builds: `scripts/build_id_area_summary.R`, `build_np_area_summary.R`, `build_ge_area_summary.R`, `build_xk_area_summary.R`, `build_ba_area_summary.R`.
- Added the Kazakhstan region census-religion product, staged (Opus lane, conductor-reviewed): two waves 2009/2021 on per-vintage frames (16 then 17 regions), both margins exact (16,009,597 / 19,186,015), seven verbatim BNS categories, and a formally open BNS licence — no ask needed. The Refused-to-indicate residual jumps 0.5 to 11.0 percent between waves, disclosed. Build: `scripts/build_kz_area_summary.R`.
- Added the Peru department census-religion product, staged (Opus lane, conductor-reviewed): 2007+2017 on 25 departments (population 12+, four verbatim INEI categories), both margins exact (20,850,502 / 23,196,391); the 2007 category counts derive from published one-decimal percentages under a recorded rounding bound. The conductor overruled one lane claim: Ninguna is a real no-religion category, so the page takes ordinary slots. Build: `scripts/build_pe_area_summary.R`.
- Added the Belize district census-religion product, staged (Opus lane, conductor-reviewed): three waves 2000/2010/2022 on the six geoBoundaries districts (CC BY 2.5), every wave reconciling both margins — 2000 integer-exact (232,111), 2010/2022 float-exact on SIB's weighted non-integer counts (documented, never repaired). The headline no-religion trend (9.4 → 15.5 → 31.0 percent) is comparable across the span and is among the sharpest secularisation series in the corpus; fine-denomination change is withheld across the 2000-to-2010 frame break. SIB courtesy ask recorded for the PI under build-then-ask. Build: `scripts/build_bz_area_summary.R`.
- Recorded the Suriname probe, HELD on the data grain (Opus lane, conductor-reviewed): religion is national-only in 2004 and 2012 except three of ten districts, so a district product cannot reconcile; the site-wide CC BY 4.0 licence and the ODbL boundary are both clean, making the unblock a pure ABS data ask (PI task 16). Probe: `research/countries/sr/route-probe.md`.
- Opted the remaining ruled pages into the Pulotu cultures source by config: Tonga (1 culture), Fiji (2), Palau (1), Kiribati (1), Tokelau (1), Micronesia (8), Philippines (14), Taiwan (8) — the design doc's follow-by-config list. Samoa is skipped (its page is not yet built; the opt-in rides the future WS page) and New Zealand (2 cultures: Māori, Moriori) is recorded as a candidate for the PI, never ruled in. Counts verified against the shipped geojson; the Philippines page boot-verified (config parses, both source options present). The fleet visual re-gate task covers these pages.
- Opted the Solomon Islands page into the Pulotu cultures source — the richest Pulotu country, 22 cultures including the Temotu outliers Tikopia and Anuta. Gate record, stated plainly: the full interactive gate ran on the Vanuatu pilot (three time points with exact counts, popup, points-off, census flip-back, Fiji regression); the SB opt-in was verified in state (22 features filter to SB, the source select is live on the deployed page, console clean) but the session's basemap tile provider degraded before a visual pass — a fresh-session visual re-gate is the recorded follow-up. Config: `apps/regions/sb/index.html` (the opt-in rode the 37fe94f fix commit).
- Hardened the Pulotu source flip against unready styles after the SB gate caught two defects: a flip before the style's first load threw at addSource and stranded a half-switched panel (now a styledata wait with a clean revert on failure), and a basemap switch dropped the culture layer with no re-add path (now rebuilt with paint and visibility reapplied). Fleet tag 20260712b on all 69 pages.
- Moved the Pulotu cultures layer from the points control to a data-source select, under the PI's 2026-07-12 directive (recorded in `docs/development/pulotu-cultures-layer.md`). On opt-in pages the panel now offers Census / Pulotu cultures; selecting Pulotu swaps the whole temporal frame to the dataset's own three time points — Traditional, Post-contact, Current — on a violet-accented slider, giving the genuine time series the dataset supports (traditional belief state → post-contact conversion → current dominant religion). The metric select carries the curated variables of the active time point, and the culture points colour by each variable's own codes with a categorical legend (counts per code, undocumented cultures grey — never invented). The census choropleth clears under the Pulotu source (never-merge enforced at source level; boundary lines stay for orientation) and the census legend, ramp, and year slider restore exactly on flip-back. Places-of-worship dots stay under the points control's own modes in either source — retained optionally, per the directive; the "Points: Pulotu cultures" mode is retired. Conductor browser gate on the Vanuatu pilot: three time points verified with correct counts (9 cultures; Current = Christianity 7, not documented 2), popup unchanged (Futuna-Aniwa, anchors 1866/2014), points-off keeps cultures while hiding place dots, census flip-back exact, Fiji regression clean (no source select on non-opted pages). Fleet tag 20260712a on all 69 pages. Runtime: `apps/regions/_shared/region-map.js`, `region-map.css`.

- Launched the Pulotu cultures layer on the Vanuatu pilot page. The runtime gains a config-gated fourth points mode, "Points: Pulotu cultures", rendering the nine Vanuatu cultures as violet points visually separate from place dots (one colour, heavier halo — the measurement-diversity separation guard). Each popup organises the five curated values under the dataset's three headings with code labels, per-value sources, both calendar anchors (null anchors omitted, missing values named and marked "not documented"), and the full-record link; the cultures-mode legend declares the regime in one line with the CC BY 4.0 attribution. The layer is slider-independent per ruling 4 (verified: year changes leave the points untouched) and never merges with census artefacts. Culture points win the click over the census fill exactly as place dots do. Runtime tag bumped fleet-wide to 20260711c on all 69 pages; non-opted pages carry no cultures option (Fiji regression-checked). Config: `apps/regions/vu/index.html`; runtime: `apps/regions/_shared/region-map.js`.

### 2026-07-11 (pulotu sitting)

- Added the Pulotu cultures data product, the ratified cultures-layer design's first artefact (`docs/development/pulotu-cultures-layer.md`, all six project-lead rulings recorded 2026-07-11). One global `apps/regions/_shared/data/pulotu_cultures.geojson` built by `scripts/build_pulotu_cultures.R` from the cached CC BY 4.0 D-PLACE CLDF release v1.3.1: 137 culture points carrying the five ruled curated values with code labels and per-value source references, both calendar anchors, a computed modern-country tag (point-in-polygon against Natural Earth 10m admin-0, with the documented Tokelau NZ-to-TK territorial correction), and the full-record link. The Vanuatu assignment yields exactly the nine documented pilot cultures. Manifest: `docs/manifests/pulotu-cultures-1.3.1.json` (manifest validation 76/76). No runtime change; the never-merge rule verified — no census artefact touched. The UI (the third points mode, piloting on Vanuatu) follows separately.

### 2026-07-11 (queue-march sitting)

- Added the Pakistan country page and overview; hub at 69 — the stack's most sensitive launch, shipped under the project-lead ruling to render the official record and report the contest. The eight Table 9 categories ride verbatim with nothing combined and no suppression; every surface states the contest neutrally in the record's own words (the Qadiani/Ahmadi label's 1974 constitutional context and the community's contestation of the classification, the 1,041,342-person headline-versus-Table-9 gap rendered not reconciled, the sensitivity and AJK/GB scope statements); the minority-share slots carry the signal (Umerkot 55.17, Torghar 0.14). The PI-ratified Karachi West and Keamari combine is live on the fused 2022-vintage polygon with its disclosure, and the conductor gate ruled the abolished Lehri district onto the map as a disclosed unjoined no-data feature rather than a hole (no evidenced partition of its territory exists). Derived rates ship with PBS attribution while written confirmation is sought. Page: `apps/regions/pk/index.html`; boundary commit fc7238e.
- Added the Bahrain country page and overview; hub at 68. The minority-share family's fourth page and its first under a formally accepted open licence: the 2020 Muslim (74.02) and Minority share (25.98) slots are exact complements of the two-category national frame, the Arabic labels ride verbatim, the required Bahrain OGDL attribution statement rides the page's credit line with the self-analysis disclaimer on the overview, and the published nationality-by-religion cut (nationals about 99.7 percent Muslim; the minority almost entirely non-Bahraini residents) is carried as published detail. Single wave; the 2010 hold stated. Page: `apps/regions/bh/index.html`.
- Added the Cook Islands country page and overview; hub at 67. Twelve islands across three waves 2011-2021 on the composite boundary (seven geoBoundaries islands and five OSM-assembled northern atolls, both licences carried per feature and in the credit line); the no-religion seam is declared everywhere it could mislead (2011 prints No Religion separate from Objected/Not Stated; 2016 and 2021 print one combined line — the 2011-to-2016 rise partly reflects the combine). The page carries the sharpest recent secularisation signal in the Pacific stack: the combined no-religion line rose from 7.4 to 15.6 percent nationally across 2016-2021, and to 19.6 percent on Rarotonga. The lane corrected the brief's wave attributions against the counts. CISO Standards-grant attribution. Page: `apps/regions/ck/index.html`.
- Added the Marshall Islands country page and overview; hub at 66. A single-wave 2021 atoll snapshot (Palau class) with the disclosure prominent: two metrics, no change; 24 of the 25 published rows join the map (Bikini has zero population and no licensed polygon, named on the page); Rongelap renders no-data with its null shares. United Church of Christ leads nationally; the denominational geography is stated qualitatively from the manifest's verified counts. EPPSO and SPC attribution under build-then-ask. Page: `apps/regions/mh/index.html`.
- Added the Niue country page and overview; hub at 65. The deepest small-country national series in the stack: eight waves 1986-2022 under the small-country clause, each wave from its contemporaneous report, with the 2022 republication corruption stated plainly on the overview (the republished earlier columns do not self-reconcile and are never used) and the frame seam disclosed (separate Not stated line 1986-2006; refusals folded into Others from 2011). Statistics Niue and SPC attribution under build-then-ask. Page: `apps/regions/nu/index.html`.
- Added the Solomon Islands country page and overview; hub at 64. Two province waves 2009-2019 with an honest change metric (no withholds); the slot design rides every surface (Custom Beliefs counts as affiliation, Refuse stays in the denominator, the near-flat headline is a genuine census fact) and the denominational geography is the named signal — Isabel 89 percent Church of Melanesia, United Church Choiseul and Western, Rennell-Bellona Adventist and South Sea Evangelical — with the full verbatim composition riding every downloadable row. The page lane corrected the brief's shorthand for Guadalcanal and Malaita against the counts. SINSO attribution under build-then-ask. Page: `apps/regions/sb/index.html`.
- Recorded two project-lead rulings from the second sitting: the measurement-diversity design principle (`docs/development/measurement-diversity-principle.md` and the queue-doc standing ruling — collection diversity is display-worthy signal, with the hard visual-separation guard) and the task-7 schema-versioning ruling (`schemas/README.md` — area-summary.v2 with one structured optional composition field, declared-version validation clearing the legacy generations without touching the frozen US pipeline, and a validate_area_summaries.sh gate guard; implementation is the next structural lane).
- Added the Kiribati country page and overview; hub at 63. The antimeridian page: the camera centres on the 0-360-frame midpoint of the committed dateline-aware extent (169.5 to 202.8 degrees, centre -173.82), and the Gilberts and the Line Islands render in one frame with no wrap smear (gate-verified). Six island waves 1990-2015 with the change metric; the nine null-metric rows are named precisely (Betio enumerated within South Tarawa through 2010; the 1995 combined-column Line and Phoenix islands), the 1995 flat-100 value is declared a frame fact (that wave has no no-religion category), and the 1990 nine-person residual stays disclosed and unrepaired. KINSO/SPC attribution under build-then-ask. Page: `apps/regions/ki/index.html`.
- Added the Bahrain national census-religion product for 2020, staged: the minority-share family's fourth member (Muslim reference-group share 74.02, minority share 25.98, exact complement) and the first under a formally accepted open licence (Bahrain Open Government Data License v1.0, required attribution and self-analysis disclaimer quoted verbatim); both published cuts reconcile to identical margins; the 2010 wave is held on a dead portal and a verification-gated secondary source. Build: `scripts/build_bh_area_summary.R`.
- Added the Micronesia (Federated States) country page and overview; hub at 62. Three state waves 2000-2023 with the change metric; the no-religion slot's combined No Religion + Refused basis is declared on every surface, the denominational fold (Assembly of God, Apostolic, Pentecostal, Jehovah's Witness into Other Religion for the 2000 frame) is carried per the record, and Kosrae 2023 renders no-data under its suppression with the change metric nulling on the missing operand (verified numerically at the gate). No stated reuse terms in any wave; the derived summaries ship with FSM Statistics Division attribution while a courtesy ask goes out. Page: `apps/regions/fm/index.html`.
- Added the Cook Islands island census-religion product for 2011-2021, staged: twelve islands by three waves, exact at every margin, with the probe's genuine gate — five inhabited Northern Group atolls missing from geoBoundaries — cleared by assembling their polygons from OSM coastlines under an area sanity gate (no fallback geometry anywhere; all thirty-six rows carry verbatim category disclosures). The 2011 No Religion line stays separate from the Objected/Not Stated residual; the 2016/2021 combined line renders as printed; 2006 survives as island-group context in the manifest only. Build: `scripts/build_ck_area_summary.R`.
- Added the Guinea country page and overview; hub at 61. A single-wave, percentages-only page that says so on every surface: eight regions, 2014 (RGPH-3 Table 5.10), one-decimal published shares with no counts and no change metric, the Faranah 99.9 row carried as printed. The N'Zérékoré contrast (85.8 affiliated against the near-uniform 99 percent north) is the map-worthy signal, browser-verified at the gate. Licence CC BY 4.0 via the byte-matched INS Accord de licence de données ouvertes. Page: `apps/regions/gn/index.html`.
- Added three census-religion data products off the probe wave, all staged for the page train: Solomon Islands (two province waves 2009-2019, exact at both margins in both waves, Custom Beliefs counted as affiliation and Refuse held in the denominator, the 2009 Other line disclosed as incomparable to the 2019 split-out); Niue (eight national waves 1986-2022 under the small-country clause, each wave from its contemporaneous report, the 2022 report's corrupted republication of earlier waves carried as a discrepancy record and never used); Marshall Islands (single-wave 2021 atoll snapshot, 25 rows and 16 verbatim categories exact at all three margins, Bikini kept as a zero-population null-share row with no polygon). Builds: `scripts/build_sb_area_summary.R`, `scripts/build_nu_area_summary.R`, `scripts/build_mh_area_summary.R`.
- Added the Tokelau country page and overview; hub at 60. The first full-ship Pacific page of the train: three atoll waves 2006-2016 under CC BY 4.0 byte-matched from the rendered Stats NZ copyright page, with TNSO and Stats NZ attribution and no reuse ask needed. The near-flat affiliation headline is genuine (the national no-religion count is 0, 0 and 1 person across the waves) and the page says where the real story lives: the denominational split (Congregational Atafu and Fakaofo, Roman Catholic Nukunonu) documented in the source tables and the build manifest. The page lane corrected a wrong premise in its brief — the area-summary rows carry only the two headline slots, and the copy points at the manifest rather than claiming composition in the rows. Page: `apps/regions/tk/index.html`.
- Probed the next four queue rows in one wave (Marshall Islands 55, Cook Islands 56, Niue 57, Solomon Islands 58); the queue rows carry the verdicts. All four are buildable, each with a different shape: MH a single-wave 2021 atoll snapshot (2011 publishes no religion table — the queue premise was wrong); CK three open island waves 2011-2021 gated only by a boundary gap (geoBoundaries misses five inhabited Northern Group atolls); NU national-only in every wave, taking the small-country clause, with the 2022 report's republished history failing self-reconciliation (take each wave from its contemporaneous report); SB two open province waves 2009/2019 with exact margins on a Public Domain ADM1 frame.
- Corrected the popup-composition claim on the Bangladesh and Cambodia pages (the same claim the Sri Lanka gate caught): the shared popup renders the reference-group share and the minority share by census year, and the verbatim category composition rides each row of the downloadable area summary, which is what the copy now says. No runtime change; copy only.
- Added the Sri Lanka country page and overview; hub at 59. The third minority-share map and the deepest of the three: four censuses 1981-2024 as exact counts on the stable 25-district frame, shading the Buddhist reference-group share, the minority share, and the change in the Buddhist share between adjacent censuses. The 2001 coverage gap renders as published (religion enumerated in 18 of 25 districts; the seven northern and eastern districts carry the DCS estimated total and no-data religion, browser-verified), and 1981 Kilinochchi is no-data with no invented split. DCS asserts all rights reserved; under build-then-ask the derived summaries ship with DCS attribution while the reuse ask goes out, and the page reverts in a single commit if DCS objects. The conductor gate corrected a popup-composition claim before launch (the popup shows the two shares by census year; the verbatim six-category composition rides the downloadable rows) — the same claim stands on the live BD and KH pages and is fixed in a follow-up commit. Page: `apps/regions/lk/index.html`; data commit aee49a3.
- Added the Cambodia country page and overview; hub at 58. The second minority-share map: Buddhist share, minority share, and the Buddhist-share change across 2008-2019, with the change metric rendering Mondul Kiri and Ratanak Kiri as no-data under their reclassification withhold. Page: `apps/regions/kh/index.html`; data commits 87eb783/b367c30.
- Fixed a shared-runtime gap the Cambodia page exposed: `change_withheld_*` quality flags now null the change metrics for the flagged area (the product asserts the waves are not comparable there, and the map must render no-data, never a difference). Previously the withhold token had no runtime effect and the two provinces painted a change value. Tag bumped to `20260711b` on all 58 pages; verified live (Mondul Kiri and Ratanak Kiri null, Phnom Penh computing normally).
- Designed the Pulotu cultures layer (`docs/development/pulotu-cultures-layer.md`), the reserved design work, from two exploration profiles of the CC BY 4.0 CLDF release: cultures render as the dataset's own point geometry with their three temporal layers and two calendar anchors per popup, independent of the census slider, as one global product country pages opt into; Vanuatu pilots with nine cultures one-to-one on area councils. Six rulings reserved for the project lead, including the Language Atlas CC BY-NC question and a cultures-first Solomon Islands option.
- Launched the Bangladesh page; hub at 57. The first minority-share map goes live under the ruled middle path: the dark page gains its overview and hub card, the reference-group and minority-share declarations ride every surface, and the ship-and-ask position is stated plainly (the BBS reuse ask is outgoing; the page reverts in a single commit if BBS objects). Page: `apps/regions/bd/index.html`; overview new; slot re-emit 2e710b7.
- Added the Kiribati island census-religion product for 1990-2015, staged: six waves on 24 islands — the deepest Pacific series in the stack — with every margin exact except the disclosed 1990 nine-person residual; the antimeridian pipeline gates in both frames (national extent compact at 33.3 degrees against a 348.6-degree raw smear); nine null-metric rows render the record. Build: `scripts/build_ki_area_summary.R`; manifest: `docs/manifests/ki-census-religion-1990-2015.json`.
- Added the Montenegro country page and overview under the project-lead confirmation; hub at 56. All three metrics ship — the change metric is honest because the 2023 suppression understatement is bounded and disclosed (247 persons nationally). The suppression surfaces through the flag-note mechanism rather than the wash treatment, deliberately: population totals are exact everywhere and washing would signal an unreliable denominator that does not exist. Page: `apps/regions/me/index.html`; data commit 2327df9.
- Added the Samoa constituency census-religion product for 2021, staged without geometry under the use-for-now ruling: 51 constituency-districts reconciling exactly through the four-tier hierarchy (205,557 national), a real no-religion category holding ordinary slots, and the boundary recorded as the documented blocker the SBS ask unblocks; the 339-village route is preserved. Build: `scripts/build_ws_area_summary.R`; manifest: `docs/manifests/ws-census-religion-2021.json`.
- Recorded the project lead's build-then-ask standing ruling: derived summaries ship with attribution by default while reuse asks go out; staging is reserved for clear-risk warnings and sensitivity holds. The licence-gated pages ungate into the hub-serialised train.
- Added the Fiji country page and overview under the project-lead use-for-now ruling; hub at 55. The 2007 province product comes out of staging with FBoS attribution while the reuse ask goes out; the page states the licence position plainly and both headline shares carry real signal (a distinct no-religion category; an unprinted not-stated residual stays in the denominator). The camera is dateline-aware: centre longitude 179.315, the 0-360-frame midpoint, with the Lau group east of 180 framed beside the main islands. Page: `apps/regions/fj/index.html`; data commit 7153fa7.
- Added the Pakistan district census-religion product for 2023, staged: the stack's most sensitive build, under the project-lead same-principle ruling, with the conductor-approved description note carrying the verbatim official frame and its provenance neutrally. 136 as-published district units reconcile exactly at every margin; the minority-share slots carry the signal; the 2017 wave and the district geometry remain documented blockers on PBS downloads; the page waits for the project lead's eyes. Build: `scripts/build_pk_area_summary.R`; manifest: `docs/manifests/pk-census-religion-2023.json`.
- Added three more staged data products under the ruling batch: Guinea 2014 (eight regions, percentages as printed, the INS open-licence agreement byte-matched from the rendered portal page after it 403-blocked automation; the lane refuted the brief's exact-100.0 premise — Faranah prints 99.9 — and shipped it disclosed under the derived bound), Micronesia 2000-2023 (four states, three all-persons waves, the 2023 source discrepancies pinned as disclosed constants), and the Cambodia and Sri Lanka slot re-emits under the ratified minority-share design (reference groups Buddhist; every national share reproduced at printed rounding; Jaffna 2024 reads Buddhist 0.47 percent against minority 99.53).
- Added the Palau country page and overview under the project-lead ungate ruling; hub at 54. The page opens on 2005 — the only wave whose affiliation varies — with the ruled universe-break note on every surface (2005 all persons with a real no-religion category; 2015/2020 adults 18+ with no-religion folded into Other, flat at 100 percent by construction). The change metric is omitted: the runtime's wave difference would render the universe break as spurious change. OPS/PALARIS attribution under the summaries-with-attribution stance. Page: `apps/regions/pw/index.html`; data commit e0e3544.
- Ratified and implemented the minority-share metric design (project-lead ruling, PI task 6): flat-frame products re-emit the two legacy slots as a declared national reference-group share and its exact minority-share complement (`docs/development/minority-share-metric.md`, Israel two-slot precedent, no runtime change). Bangladesh re-emitted first: Muslim share and minority share across 64 districts, zero complement violations, the dark page relabelled; Cambodia and Sri Lanka rebuilds follow.
- Added the Tokelau atoll census-religion product for 2006-2016: three atolls, three waves, both margins closing exactly in every wave; the 2006 Nukunonu confidentiality cells render suppressed with the printed margins forcing both to zero; the boundary derives from the ADM0 land-cover layer exploded and clustered into three non-overlapping atoll footprints. CC BY 4.0 byte-matched from the rendered Stats NZ copyright page. Build: `scripts/build_tk_area_summary.R`; manifest: `docs/manifests/tk-census-religion-2006-2016.json`.
- Added the Nauru country page and overview; hub at 53. The national three-wave series ships fully under the SPC/Nauru reproduction-with-acknowledgement clause; the all-persons universe, per-wave verbatim frames, the 2011-2021 denomination-change confinement, and the deferred 2021 citizen-only district table all ride the surfaces. Page: `apps/regions/nr/index.html`; data commit a90d1eb.
- Added the Sri Lanka district census-religion product for 1981-2024, staged: four exact-count waves on 25 districts with the 2001 wave rendering the seven unenumerated northern/eastern districts as published and no invented 1981 Kilinochchi split. The six-religion frame carries no no-religion category, and the page is gated on the minority-share metric design and the DCS licence confirmation. Build: `scripts/build_lk_area_summary.R`; manifest: `docs/manifests/lk-census-religion-1981-2024.json`.
- Added the Dominica country page and overview; hub at 52. The national three-wave series ships fully under the CSO Open Licence with both required notices (source and value-added) on the attribution surfaces; the small-country national-only scope, the per-wave religion universe, the one-person anonymity offset, and the sub-denomination comparability limit all ride the popup note and overview. The wave-to-wave change metric is wired for the headline only, under the build's comparability finding. Page: `apps/regions/dm/index.html`; data commit b1495be.
- Added the Philippines country page and overview; hub at 51. The 2020 product ships fully under PSA's CC BY terms: 86 mapped units (provinces with highly urbanised cities folded in, four NCR legislative districts, the City of Isabela), a household-population denominator disclosed on every surface, the BARMM Special Geographic Area reconciled nationally as an unmapped residue, and the named-ten-plus-exact-residual category treatment with the full 129-category frame in the download. Page: `apps/regions/ph/index.html`; data commit dff51e2.
- Added four data products in one sitting, three staged and one national. Montenegro (2003/2011/2023 on the stable 21-municipality frame; 2023 z-suppression disclosed, never redistributed), Cambodia (2008/2019 four-category percentages on 25 provinces within the derived rounding bound), and Palau (2005/2015/2020 religion by state, every margin exact) all stage pending project-lead licence items; Dominica ships a national three-wave series under the small-country clause (Iceland precedent) with the CSO Open Licence accepted, after the conductor verified the cached geoBoundaries metadata and corrected the probe's boundary-licence error in place. Builds: `scripts/build_{me,kh,pw,dm}_area_summary.R`.
- Probed Pakistan (buildable at tehsil level for 2017/2023; held entirely on four project-lead rulings covering the official category labels, territorial scope, and reuse terms), Antigua and Barbuda (three national waves; the parish map is single-wave via the 2011 REDATAM crosstab and rides the same single-wave-bar ruling as Guinea), and Armenia (held: religion first asked in 2011 and published nationally only — no subnational product exists in published tables).
- Added the Iran country page and overview, closing a gap: the province census-religion product shipped in 50d0e1e with no page, no overview, and no hub link. The page ships three waves (2006/2011/2016) on the 28-unit concordance with the manifest's recognised-categories description note carried verbatim on the popup surface and the overview, SCI attribution throughout, and the Natural Earth boundary labelled public-domain, non-official, and generalised. The change metric is withheld (conductor ruling, Bulgaria treatment): affiliation is the complement of the Not stated share, and a wave-to-wave difference would track non-response movement under a religious-change label. Hub at 50.
- Probed four queue rows in parallel lanes. Guinea (rank 43) HELD: the published record refutes the region-and-prefecture premise — the only subnational religion table in any wave is RGPH-3 2014's eight-region percentages; two PI rulings queued. Cambodia (rank 40) and Palau (rank 42) both open BUILD lanes staged: Cambodia carries 2008+2019 four-category percentages on the current 25 provinces with an exact 2019 national count anchor; Palau carries genuine three-wave religion-by-state tables (2005/2015/2020) reconciling exactly, with universe and frame breaks confining change to the 2015-2020 pair; both pages wait on PI licence items, and both share Bangladesh's flat-affiliation gate (PI task 6). The Philippines (rank 39) is the cleanest route in the queue: PSA's 2020 special-release Table A gives exact counts for 129 categories reconciling to the person, under PSA terms that place statistical tables under CC BY; the 2020 build proceeds now and 2010/2015 await a follow-up probe. Probes: `research/countries/{gn,kh,pw,ph}/route-probe.md`.
- Fixed two shared-runtime UX flaws flagged during the Scotland investigation, with the runtime tag bumped to `20260711a` on all 50 country pages. The level-switch year clamp now lands on the nearest available year in either direction (an earlier year wins a tie); the old not-after rule skipped nearer forward years: switching from a level at 2021 to one with 2001/2011/2022 froze the map at 2011. The census time strip no longer vanishes silently where a slider cannot animate: a data-pending level keeps its year ticks inert under a note saying the data is coming, and a single-wave level shows its one year with a note saying so. The boundaries-only legend note drops its redundant years line; the ticks now carry the years.

### 2026-07-11 (rulings-execution sitting)

- Executed all five project-lead rulings of 2026-07-10 23:54. Saint Lucia and Burkina Faso shipped end-to-end (data + pages) under the documented-discrepancy and derived-rounding-bound rulings, with the disclosure notes verbatim on panel and overview; Palestine's page shipped under the coexistence ruling with symmetric notes on the Palestine and Israel overviews; the Pacific campaign ran its full pinned-route phase.
- Added the Taiwan registered-organisations product and page for 2020-2024: the stack's first register-of-organisations construct (MOI registered temples, churches, and reported temple followers on 22 county/city units, exact reconciliation every year, post-2014 temple-only followers break disclosed, census fields null). MOI Open Government Data Declaration byte-matched. Build: `scripts/build_tw_area_summary.R`; manifest: `docs/manifests/tw-register-2020-2024.json`.
- Added the Bangladesh district census-religion product for 2022, staged dark: 64 districts, exact reconciliation to division and national anchors; the BBS five-category frame has no non-affiliation category, so affiliation is 100 percent by construction — disclosed everywhere, with the per-district composition carried per row. Page built but not linked pending two project-lead questions (BBS reuse terms; whether a minority-share metric should precede the page going live). Build: `scripts/build_bd_area_summary.R`; manifest: `docs/manifests/bd-census-religion-2022.json`.
- Added the Côte d'Ivoire local census-religion product for 2021, staged: 510 features from 519 census leaf rows under the two rulings — every printed value unchanged, the source's multi-level arithmetic discrepancies (31 leaves, 48 departments, the national row) image-verified and disclosed, the join closed by evidenced identification (18 spelling variants, two Guézon by adjacency, Gagoré↔Kadéko by exhaustion, Bobi-Diarabana as a disclosed exact roll-up, Parc National de Bona as a no-data feature), and the geoBoundaries double-UTF-8 name corruption diagnosed and repaired by reversing one encoding layer. Build: `scripts/build_ci_area_summary.R`; manifest: `docs/manifests/ci-census-religion-2021.json`.
- Added the Tuvalu region census-religion product for 2012-2017, staged: the record refutes the queue's island-level premise; the finest official geography is the Funafuti/Outer-Islands split. 2022 recorded as national context. Build: `scripts/build_tv_area_summary.R`; manifest: `docs/manifests/tv-census-religion-2012-2022.json`.
- Added the Fiji province census-religion product for 2007, staged pending FBoS reuse terms: 15 provinces, all-ethnicity religion margin only (the source's religion-by-ethnicity tables stay out of scope), antimeridian geometry cut properly at longitude 180 with dateline-aware gates in both frames. 1996 (microdata only) and 2017 (collected but unprinted) deferred with recovery routes. Build: `scripts/build_fj_area_summary.R`; manifest: `docs/manifests/fj-census-religion-2007.json`.
- Probed and held Saint Vincent (national-only tables; division religion exists only as percentage images with no licensed division vector) and Samoa (the 2021 workbook reaches 339 villages and reconciles exactly, but the 51 census constituencies match no licensed boundary and SBS asserts bare copyright). Both unblock through statistics-office asks recorded in their probes.
- Mirrored every committed raw source cache to `gs://pow-research-data/raw_sources/` (52 directories, count-verified) and recorded `raw_cache_durable_uris` in 47 manifests, closing the data-storage-pipeline core-rule gap. Validation during the sweep surfaced a pre-existing drift: 35 of 52 manifests fail `schemas/data-manifest.schema.json` for shape reasons unrelated to the sweep; recorded as a standing cleanup beside the schema-versioning ruling.

### 2026-07-10 (overnight sitting)

- Added the Tonga district census-religion product for 2021: Tonga Statistics Department workbook counts for 23 districts on the geoBoundaries 2020 ADM2 frame (CC BY 4.0, Pacific Data Hub source), with exact reconciliation to every division and national field. The denominator is each district's printed G 19 `Total`; the `REF` (refused) category stays inside the denominator and outside both headline numerators. The census report permits partial scientific, educational, or research reproduction with acknowledgement. Earlier waves (1996-2016) are documented as future routes in the wave-extension probe. Build: `scripts/build_to_area_summary.R`; manifest: `docs/manifests/to-census-religion-2021.json`.
- Added the Palestine governorate census-religion product for 1997, 2007, and 2017, STAGED: PCBS counts for 16 governorates with exact row and national reconciliation in every wave and category. Each wave preserves PCBS's verbatim categories (`Others` in 1997/2007, distinct from 2017) with per-wave display mappings documented. Jerusalem coverage definitions are quoted verbatim from PCBS with citations; cross-wave change is withheld across PCBS's own J1 coverage differences. The page is held for two project-lead rulings: the shared-surface relation to the live Israel route, and the licence position (current PCBS site terms state CC BY 4.0; the 1997 and 2007 publications print `All Rights Reserved.`; the cached 2017 preliminary report prints no rights notice). Build: `scripts/build_ps_area_summary.R`; manifest: `docs/manifests/ps-census-religion-1997-2017.json`.
- Verified the Côte d'Ivoire 2021 Table 11 reconciliation failures against rendered page images: all 31 overruns are the source's own arithmetic; the extraction is faithful cell-for-cell. The build stays held for the project-lead's ship-with-documented-discrepancy ruling and the ANStat all-rights-reserved terms. Report: `research/countries/ci/reconciliation-verification.md`.
- Probed Burkina Faso and held: the 2006 regional table (13 regions plus national, six categories) reconciles exactly; the 2019 regional one-decimal percent table has five rows summing 99.9/100.1 against the printed 100.0, awaiting a derived rounding-bound ruling; INSD reuse rights unresolved, with the INSD legal page citing an uncaptured external Open Data Agreement. Fail-fast builder: `scripts/build_bf_area_summary.R`.
- Probed and verified Saint Lucia: three census waves located (2001/2010 REDATAM 12-part frames aggregating to ten districts; 2022 provisional Table D.2); every wave fails exact reconciliation by one to five people, and image readback confirmed the 2022 discrepancies are the source's own arithmetic. The CSO Open Licence and CC0 boundaries are clean; Saint Lucia ships on a single ship-with-documented-discrepancy ruling. Fail-fast builder: `scripts/build_lc_area_summary.R`; verification: `research/countries/lc/reconciliation-verification.md`.

### 2026-07-10 (second sitting; heading previously misdated 2026-07-11)

- Added the Croatia county census-religion product for 2001-2021: DZS (Croatian Bureau of Statistics) affiliation for 21 counties across three waves, with exact reconciliation everywhere and category frames as published. County is the finest geography complete in all three waves; the probe documents wave-specific municipal frames and no official rebased series. Boundary: DGU 2026 frame. Build: `scripts/build_hr_area_summary.R`; manifest: `docs/manifests/hr-census-religion-2001-2021.json`.
- Added the Serbia area census-religion product for 2002-2022: SORS (Statistical Office of the Republic of Serbia) religion for 25 areas — the City of Belgrade plus 24 districts (okruzi) — across three waves with exact reconciliation. Kosovo is outside SORS's own census coverage; the territorial scope note rides the shipped surfaces, stated neutrally. Licence needs_review. Build: `scripts/build_rs_area_summary.R`; manifest: `docs/manifests/rs-census-religion-2002-2022.json`.
- Added the Bulgaria district census-religion product for 2001-2021: NSI (National Statistical Institute) religion for 28 districts across three waves, each wave's shares on NSI's own published basis reproducing the published headline shares exactly (2001 full population; 2011 the voluntary-question R10 respondent base, 5,758,301 of 7,364,570 residents; 2021 as published with declined and cannot-determine categories). The bases differ in every pair of waves and the change metric is withheld across all of them with per-row disclosure. Licence needs_review. Build: `scripts/build_bg_area_summary.R`; manifest: `docs/manifests/bg-census-religion-2001-2021.json`.
- Added the Iran province census-religion product for 2006-2016 under the project-lead ruling: the Statistical Centre of Iran's verbatim seven-column frame (Muslim, Christian, Zoroastrian, Jew, Other, Not stated) on a 28-unit province concordance, 84 rows, exact national reconciliation in every wave and category. The shipped description note names the recognised categories and states that identities outside them, including unrecognised religious minorities, are absent from the official record; the tables provide no assignment rule and the product invents none. United Nations mirrors were machine-compared (2011 provinces; 2016 national categories) and matched exactly. The boundary is Natural Earth, labelled public-domain, non-official, and generalised, passing gap, overlap, and sliver gates. No explicit SCI licence was located; publication proceeds with attribution under the project-lead approval of 2026-07-11. Build: `scripts/build_ir_area_summary.R`; manifest: `docs/manifests/ir-census-religion-2006-2016.json`.
- Added the Iceland national religious and life-stance organisation membership product for 1998-2026. The product ships Statistics Iceland PX-Web table MAN10001 register membership for all 29 annual waves on one national polygon: the project ships small-country national series where the source publishes no subnational membership table, and the PX-Web probe found no municipal or regional membership split. The ten largest 2026 organisations keep Statistics Iceland's published English names; `Other organisations` is the exact annual residual of the remaining named organisation rows; `Other and not specified` and `No religious organisation` remain separate source categories and are never framed as irreligion. Category sums reconcile exactly to the published total in every year, and an explicit no-missing-cell assertion replaces imputation. The boundary is the geoBoundaries ISL ADM0 release `9469f09` (CC BY 4.0) simplified through the shared helper. Build: `scripts/build_is_area_summary.R`; manifest: `docs/manifests/is-membership-1998-2026.json`.
- Added the Norway Church of Norway administrative membership product for 2005-2025. The product contains 231 mapped rows: 11 dioceses across 21 annual waves, using SSB table 06929 category and English geography labels verbatim. The 11 mapped counts plus SSB's unallocated `Unknown diocese` category reconcile exactly to the published national total in every year. The unallocated category ranges from 0 to 25,923 members, or from 0 to 0.6758% of the national total. Table 06929 publishes no diocese population percentage. The percentage and denominator fields therefore remain null. The source definition changes in 2021, and the product records SSB's comparability warning for the `Unknown diocese` category from 2011. The 11-feature boundary comes directly from Kartverket's Geonorge `Soknegrenser` SOSI package effective 1 January 2025; no municipality concordance is used. Counts follow SSB's published diocese assignment for each reference year, while the one 2025 boundary frame applies to the full series. SSB does not state whether it rebases historical counts to current dioceses. Both SSB's statistics and the mapped polygons exclude Svalbard. Source and simplified layers pass validity, distinct-geometry, gap, and overlap gates. Build: `scripts/build_no_area_summary.R`; manifest: `docs/manifests/no-membership-2005-2025.json`.
- Added the Liechtenstein municipality census-affiliation product for Statistics Liechtenstein table 213.001d. The source record supports three five-year waves, 2010, 2015, and 2020, rather than the audit's asserted 1980–2020 municipality span. The product contains 33 municipality-year rows and retains each wave's 11 German source categories; the manifest adds faithful English display labels and records the 2020 change from `Evangelisch-reformiert` to `Evangelisch (reformiert, protestantisch)` without smoothing it. Every municipality's categories sum exactly to its population total, and the 11 municipality values sum exactly to every published national category total in all three waves. Added the official 2021 Hoheitsgrenzen municipality layer, dissolved from 30 polygon parts to 11 valid features with 11 distinct geometry hashes and simplified to 196 KB. Build: `scripts/build_li_area_summary.R`; manifest: `docs/manifests/li-census-religion-2010-2020.json`.
- Added the Israel Population Register classification product under the
  approved two-slot ruling. The district product contains 56 rows across the
  eight CBS table 2.11 reference years (1948, 1961, 1972, 1983, 1995, 2008,
  2022, and 2024). The legacy affiliation slot carries the share classified as
  Jewish, Muslim, Christian, or Druze; the legacy no-religion slot carries
  CBS's category verbatim, Not classified by religion. Every declaration and
  row basis states that this is Population Register classification. It is not
  belief, practice, irreligion, or secularity. The 1948 wave is recorded
  context with null construct fields because three district group
  distributions are suppressed; its 17.1-thousand national population
  residual is reported and never distributed. The seven-feature boundary
  combines six districts dissolved from official sub-district polygons with
  the separately labelled CBS statistical-area coverage for Judea and Samaria
  Area. Build: `scripts/build_il_area_summary.R`; manifest:
  `docs/manifests/il-register-classification-1948-2024.json`.

### 2026-07-10 (first sitting)

- Added the Estonia county census-affiliation product for 2000, 2011, and 2021. The product contains 45 rows: 15 counties on official per-wave Maa-amet (Estonian Land Board) boundary vintages. Statistics Estonia publishes no earlier religion table rebased to the post-2017 municipalities or counties. The product therefore creates no concordance and reports no same-polygon county change metric. Every denominator is the published population aged 15 and over; the 2000 universe also includes people whose age was unknown. The 2000 no-religion headline combines the source's `Has no religious affiliation` and `Atheist` categories, while refusal and unknown categories remain in the denominator. The 2021 religion characteristic comes from the census sample survey, was not register-supplemented, and remains in the source's published tens. All complete 2000 and 2011 county category sums reconcile exactly to the national rows, including a per-county reconciliation of each affiliation category against its published child categories, not the national aggregate alone. The 2021 gates use tolerances derived from the source's documented ten-rounding (5 people per independently rounded cell): 75 for the county-to-national check and 80 for the affiliation-child check, replacing the review's flagged arbitrary 140/150 headroom; the observed maxima are 30 and 20 respectively, and 41 unavailable minor-religion county cells remain unavailable. Each boundary has 15 valid features with 15 distinct geometry hashes, byte-identical to the prior build. The manifest now encodes Statistics Estonia's CC BY-SA 4.0 share-alike obligation and the Maa-amet open-data attribution term directly in `licence_status`, following the Ghana precedent, rather than a generic "accepted" flag. Build: `scripts/build_ee_area_summary.R`; manifest: `docs/manifests/ee-census-religion-2000-2021.json`.
- Added the Lithuania municipality census-affiliation product for the Official Statistics Portal (OSP) flow `S3R778_GBS010306_1`. The product contains 180 rows: 60 municipalities across the 2001, 2011, and 2021 waves. The 2001 and 2011 values are full-enumeration census responses; the 2021 values combine the full census population denominator with sample/model-based religion estimates from a separate 171,000-person household survey, described in the State Data Agency's [2021 ethnocultural release](https://osp.stat.gov.lt/en/2021-gyventoju-ir-bustu-surasymo-rezultatai/tautybe-gimtoji-kalba-ir-tikyba): 56,000 household residents completed the questionnaire themselves, interviewers surveyed a further 115,000 household residents, and mathematical methods produced the population estimates. The product therefore shows the three snapshots and withholds cross-instrument change metrics. The municipality table retains 16 Lithuanian source categories plus the total, including separate `Nė vienai` and `Nenurodyta` categories; the companion national flow documents a more detailed 25-category presentation. The total, `Nė vienai`, and `Nenurodyta` municipality values reconcile exactly to the national row in every wave. Added the official Registers Centre 2025 municipality layer under CC BY 4.0: 60 valid features with 60 distinct geometry hashes, simplified through the shared helper after correcting the source Well-Known Text (WKT) axis order. Municipality geometry stability from 2001 through the 2025 boundary frame was not verified: formation dates and shared codes do not prove unchanged boundaries. Build: `scripts/build_lt_area_summary.R`; manifest: `docs/manifests/lt-census-religion-2001-2021.json`.
- Added the Hungary county census-affiliation product for 2001, 2011, and 2022 from Hungarian Central Statistical Office (KSH) Census Database dataflow `WBS008`, API publication `V67`. The source record supports the full classification at county level across all three waves. KSH's settlement map covers 2011 and 2022 only and exposes four religion shares; county is therefore the primary geography. The product contains 60 county-year rows on the Geographic Information System of the Commission, Eurostat (GISCO), Nomenclature of Territorial Units for Statistics (NUTS) level 3 2021 boundaries. Geometric stability across the three census waves was not verified; the single-frame join rests on code identity. Headline affiliation and `Nem vallásos` shares are among stated responses. National `Nem válaszolt` shares were 10.8286% in 2001, 27.1578% in 2011, and 40.1154% in 2022. The responding share of the population changed substantially across waves; cross-wave share changes may therefore reflect changing respondent composition as well as changing affiliation. The change metric compares stated-response shares only. KSH publishes no separate refusal or unknown rows. Every mutually exclusive category sums exactly to each county total, every published county category reconciles exactly to the national row, and all 20 boundary features are valid with distinct geometry hashes. Build: `scripts/build_hu_area_summary.R`; manifest: `docs/manifests/hu-census-religion-2001-2022.json`.
- Added Switzerland canton religion products as two separate constructs. The
  census product ships FSO/BFS PX-Web affiliation counts for 1970, 1980, 1990,
  and 2000 on the current 26-canton swisstopo `swissBOUNDARIES3D` frame; all
  15 religion categories reconcile exactly to the national row in every wave.
  The structural-survey product ships FSO/BFS annual canton estimates for
  2010-2024, flagged as sample-survey estimates for the resident population
  aged 15+. The survey source includes confidence intervals in the workbook;
  the manifest records that the legacy area-summary schema has no confidence
  interval fields, no-religion estimates differ from the national row by at
  most three estimated persons before integer rounding, and 23 canton-years
  suppress unknown affiliation. Affiliation-excluding-unknown fields are null
  there. Build: `scripts/build_ch_area_summary.R`; manifests:
  `docs/manifests/ch-census-religion-1970-2000.json` and
  `docs/manifests/ch-structural-survey-religion-2010-2024.json`.
- Added the Singapore planning-area census religion product for 2010 and
  2020. The 2010 wave ships 35 mapped areas on Master Plan 2008 boundaries;
  the 2020 wave ships 30 mapped areas on Master Plan 2019 boundaries. Each
  wave has its own summary and boundary file, and the product reports no
  cross-wave planning-area change metric. The denominator is the resident
  population aged 15 years and over. Religious affiliation equals `Total -
  No Religion`, which retains rows with unavailable minor-category cells.
  Planning-area sums include `Others` during reconciliation. The headline
  residuals against the published national rows are +3 total, -2 with
  religion, and +4 No Religion in 2010; the 2020 residuals are +1 total and
  zero for both with religion and No Religion. The build preserves the
  source counts and distributes no residual. Build:
  `scripts/build_sg_area_summary.R`; manifest
  `docs/manifests/sg-census-religion-2010-2020.json`.
- Added the Mauritius census-religion product for 2000, 2011, and 2022:
  nine districts on Mauritius island plus Rodrigues, with 30 area-year rows
  on a 10-feature geoBoundaries `MUS ADM1` boundary. Table D6 named religious
  groups form the longitudinal affiliation metric over the full table total;
  explicit no religion is available only in 2022 because the 2000 and 2011
  district tables combine `Other` and `Not stated`. Every shipped field sums
  exactly to the printed national row. The 1990 image-only scan remains
  excluded under the no-OCR and no-hand-entry rule. The country card and
  manifest state that religion must never be interpreted as an ethnic proxy.
  Build: `scripts/build_mu_area_summary.R`; manifest:
  `docs/manifests/mu-census-religion-2000-2022.json`.
- Added the Austria Bundesland religious-affiliation product for the 1951,
  1961, 1971, 1981, 1991, and 2001 population censuses and the separate 2021
  mixed estimate. The 2021 source combines a voluntary Microcensus Labour
  Force Survey module, parent-based imputation for children, and an estimate
  for the institutional population; religion was absent from the register
  census. The product contains 63 rows across nine Bundesländer and seven
  waves. All four headline counts reconcile to the national source rows; the
  reconciliation table records zero census differences and only sub-micro-person
  binary floating-point residuals for 2021. Added a nine-feature geoBoundaries
  ADM1 layer (170 KB), simplified from the 2017 source. The complete Statistics
  Austria open-data catalogue contained no religion dataset. The manifest pins
  the main-site ODS routes and website reuse terms and makes no CC BY 4.0 claim.
  The boundary's CC BY-SA 2.0 source licence is recorded separately.
  Build: `scripts/build_at_area_summary.R`; manifest:
  `docs/manifests/at-religious-affiliation-1951-2021.json`.
- Added separate Netherlands province survey products for self-reported
  religious affiliation and religious-service attendance from CBS StatLine
  `83288NED`. Each product contains 72 rows: 12 provinces across annual
  2010-2015 estimates for the total population aged 15+. The affiliation
  product reports affiliation and no affiliation; the attendance product
  reports weekly-or-more and seldom-or-never attendance. Every row records
  that the values are sample-survey estimates rounded to whole percentages
  and that CBS does not publish confidence intervals in the table. The four
  national indicators match CBS table `82904NED` exactly in 2010, 2012, and
  2015. Added current PDOK/Kadaster province boundaries (12 features, 509 KB),
  with CBS and PDOK reuse recorded as CC BY 4.0. Build:
  `scripts/build_nl_area_summary.R`; manifest
  `docs/manifests/nl-survey-religion-2010-2015.json`.
- Added the Poland diocesan Catholic-practice data product for ISKK
  dominicantes and communicantes. The product contains 410 rows: 41
  post-2004 Catholic dioceses across 2014-2019 and 2021-2024, with
  `Ogółem` retained only as national context. The legacy
  `religious_affiliation_percent` slot now carries Mass attendance
  (dominicantes), and the legacy `no_religion_percent` slot carries
  Communion (communicantes); both indicators state that the values are
  counts-based rates over obliged Catholics. The values do not report
  affiliation or population shares. The manifest records the ISKK PDF
  URLs and SHA-256s, the mixed OSM plus Eurostat/GISCO-gmina boundary basis, the
  41/41 join validation for every counted year, the Wikipedia comparison
  summary, and deferred work for 2013, 2020, pre-2014 years, and
  authoritative GIS-Expert/KUL polygons. Build:
  `scripts/build_pl_area_summary.R`; manifest
  `docs/manifests/pl-attendance-2014-2024.json`.
- Added the Denmark Church of Denmark membership products. The parish
  product ships KM1 Q1 points for 2023-2026 only, on current DAWA/DAGI
  sogn boundaries (`dk_sogn_2026.geojson`, 2,097 features, 2.99 MB at
  3% mapshaper keep). Earlier KM1 parish waves remain deferred because
  parish mergers and code churn need a governed concordance layer; the
  manifest records per-year dropped source parish-code rates and the
  dropped member/non-member counts for every shipped year. Added the
  KM6 municipality companion for 99 kommuner, 2011-2026, on current
  DAWA/DAGI kommune boundaries (`dk_kommune_2026.geojson`, 495 KB at
  1% mapshaper keep). Municipality rows reconcile exactly to complete
  KM6 municipality national sums, and those sums match KM1 national Q1
  totals exactly for 2011-2026. Build:
  `scripts/build_dk_area_summary.R`; manifest
  `docs/manifests/dk-membership-2011-2026.json`.
- Added the Germany Kreis census-religion product for Zensus 2011 and
  Zensus 2022 legal membership in public-law religious societies
  (`RELZG2`). The two waves ship on their own period Kreis geographies:
  412 `GEOLK1` rows with BKG VG250 2011 boundaries, and 400 `GEOLK4`
  rows with BKG VG250 2022 boundaries. Religious affiliation is
  Protestant public-law membership plus Roman Catholic public-law
  membership; no-religion metrics are null because the compact residual
  category combines other religion, no public-law membership, and no
  response. The source regional cubes do not reconcile exactly to the
  exposed Deutschland rows. The metadata-supported explanation is that
  Deutschland totals include persons assignable to no Kreis, including
  German personnel stationed abroad, and that the Zensus results database
  documents subpopulation non-additivity. The tested routes use `PRS018`
  for regional rows and `PRS001` for Deutschland rows; Zensus metadata
  entries label both codes as Persons, and the code difference is recorded
  only as an observation.
  Protestant and Catholic regional sums match the Deutschland rows
  within ±17 persons, which supports category integrity. The build
  preserves the source counts and records the residuals in the manifest.
  Build: `scripts/build_de_area_summary.R`; manifest
  `docs/manifests/de-census-religion-2011-2022.json`.

### 2026-07-09

- Added OSM date-tagged place layers (`dated_places.geojson`) via the
  ohsome API at snapshot 2025-09-01. Non-empty products cover Albania
  (7 features), the Bahamas (2), Czechia (929), Ghana (4), and India (76).
  Non-empty products also cover Italy (2,463), Kenya (1), South Korea (10),
  Romania (1,401), and South Africa (101). The same build generated
  zero-feature products for Malawi, Rwanda, and Zambia; those products remain
  unwired under the
  historical-points standard. The builder now includes those country masks,
  bounded ohsome retries, split bbox requests for Ghana, Italy, and Kenya,
  and per-country failure continuation. Manifest:
  `docs/manifests/osm-pow-dated-13countries-fbbb18ea1735.json`.
- Extended Ghana's current 16-region census religion product to 2010 and
  2021. GSS StatsBank PHC2010 POP16 provides exact 2010 religion-category
  counts re-tabulated by GSS from the 2010 enumeration to the current
  16-region frame; the build writes those 2010 rows beside the existing 2021
  rows and records the re-tabulation basis in each 2010 row. The 2021 row
  objects remain byte-identical by before/after digest. The existing
  ten-region companion product remains unchanged; the build still validates
  the 2010 current-region counts against the old ten-region National
  Analytical Report table 4.17 aggregation. UI wiring for the change metric is
  unchanged. Build: `scripts/build_gh_area_summary.R`; manifest
  `docs/manifests/gh-census-religion-2010-2021.json`.
- Added the South Korea regional map: municipal (si/gun/gu) census
  religion for 2005 and 2015 from KOSIS tables DT_1IN0505 and
  DT_1PM1502 (KOGL Type 1 attribution), on a KoStat-derived 2018
  municipal boundary layer harmonised to 229 reporting units
  (parent-city dissolves; predecessor-code aggregation for the 2005
  wave). 2015 values come from the register-based census's 20% sample
  survey and every 2015 row is flagged sample_survey_20pct; no change
  layer ships across the full-count/sample basis break. Validation:
  both waves reconcile exactly to the national rows for population,
  religious affiliation, no religion, and the 2005 unknown category;
  join coverage 229/229. Added a current-sido companion product for
  1995, 2005, and 2015. The 1995 KOSIS DT_1IN9506 source includes an
  Ulsan-si row inside Gyeongsangnam-do; the build therefore reports Ulsan
  separately and subtracts Ulsan-si from Gyeongsangnam-do; Sejong is null
  because it did not exist in 1995. The current-sido rows reconcile
  exactly to the national rows for every wave, and the 1995
  Gyeongsangnam-do plus Ulsan split recovers the printed 1995
  Gyeongsangnam-do row exactly. 1985 remains deferred. Build:
  `scripts/build_kr_area_summary.R`; manifest
  `docs/manifests/kr-census-religion-1995-2015.json`.
- Added the Romania regional map: census religion for 2011 (RPL
  sR_TAB_13) and 2021 (RPL Tabel 2.04.2) at two levels — county
  (județ, 42 units, GISCO NUTS3 2021, complete headline coverage,
  the default view) and commune/LAU (3,181 units, GISCO LAU 2021,
  2011 bridged by LAU id). Denominator is the stated-response
  population per wave (undeclared excluded: 6.26% nationally in 2011,
  13.95% in 2021); no-religion is Fără religie plus Atei; Agnostic
  stays in the denominator without counting as no-religion.
  Small-count suppression leaves 31% (2011) and 57% (2021) of commune
  rows without headline percentages — published as unavailable, never
  imputed; the county level carries the complete view. Validation:
  county and LAU sums reconcile exactly to the national rows on every
  component in both waves. 1992 and 2002 deferred. INS census-portal
  workbooks carry no explicit reuse statement — attributed, flagged
  for licence review. Build: `scripts/build_ro_area_summary.R`;
  manifest `docs/manifests/ro-census-religion-2011-2021.json`.
- Added the India regional map: district census religious community
  (C-01) for 2001 (593 districts) and 2011 (640 districts), each wave
  on its own DataMeet period district boundaries (CC BY 2.5 IN) with
  the timeline switching vintage — no cross-wave district crosswalk
  exists, so no change layer ships. The Census of India has no
  no-religion category: no-religion fields are null on every row
  (flagged no_religion_category_absent) and "Religion not stated" is
  excluded from religious affiliation without being counted as
  no-religion. There is no 2021 census. Validation: district sums
  reconcile exactly to the national row AND to every state row for
  all categories in both waves; join coverage 593/593 and 640/640.
  1991 pinned (C-9, J&K not enumerated) but deferred. Licence:
  GODL-India recorded. Build: `scripts/build_in_area_summary.R`;
  manifest `docs/manifests/in-census-religion-2001-2011.json`.
- Added OSM date-tagged place layers (dated_places.geojson) for
  Australia (58 features), Brazil (548), Canada (163), Mexico (16),
  the United Kingdom (693), Portugal (357), and Slovakia (323) via
  the ohsome API at snapshot 2025-09-01, following the NZ extraction
  pattern (amenity=place_of_worship, lifecycle date tags; former-use
  tags without an explicit end date get the snapshot date as a
  provisional end_date). Every live country now offers the
  "Points: period" mode on both the country maps and the RA portal;
  Vanuatu remains deliberately unwired until a real dated product
  ships. Manifest:
  `docs/manifests/osm-pow-dated-7countries-346eb8505e00.json`.

- Added the Portugal regional map: municipality census religion for
  2011 and 2021 from INE database API indicators 0006396 and 0011644
  (população residente aged 15+, CC BY 4.0), on DGT CAOP 2021
  municipality boundaries (CC BY 4.0, 308 features, simplified to
  1.39 MB at 100 m tolerance). Denominator is the stated-response
  15+ population: 2011 excludes Não resposta; the 2021 API extract
  exposes only stated categories, whose sum equals its Total exactly.
  Validation: both waves reconcile to the national API rows with zero
  difference on denominator, religious affiliation, and no religion;
  join coverage 308/308. Detailed categories changed between waves and
  are not crosswalked; the change layer uses the any-religion headline
  only. 1981, 1991, and 2001 are deferred (no stable INE municipality
  indicator found; recorded in the manifest's deferred sources).
  Build: `scripts/build_pt_area_summary.R`; manifest
  `docs/manifests/pt-census-religion-2011-2021.json`.
- Added the Slovakia regional map and current-kraj companion product.
  The live map keeps municipality and city-part census religion for
  2021 from SODB 2021 table Z01_15 (Statistical Office of the Slovak
  Republic; 79 district JSON extracts plus the national reconciliation
  row), on the SODB 2021 OB GeoJSON boundary layer (2,927 reporting
  units, simplified to 2.57 MB at 200 m tolerance). The companion
  product adds eight current kraje for 2001, 2011, and 2021: 2001 from
  Infostat `data118.aspx` HTML kraj tables, 2011 from SODB 2011 `TAB.
  118` XLS files, and 2021 by exact sums from the existing municipality
  product. Denominator is total population including `nezistené` / not
  found out; religious affiliation excludes no religion and `nezistené`.
  Validation: municipality sums equal the SODB 2021 national row exactly;
  2001 and 2011 kraj rows equal their national source rows for every
  reported category; 2021 kraj sums equal the municipality product totals
  exactly. The dissolved kraj boundary has eight features and writes to
  561 KB with mapshaper weighted keep-shapes at 100% keep. 1991 is
  deferred because the source has 42 district/obvod rows and
  macro-regions, while current kraje did not exist until 1996. SODB and
  Infostat pages carry no explicit licence statement; attribution cites
  the Statistical Office and Infostat, and the product remains flagged
  for licence review. Build: `scripts/build_sk_area_summary.R`;
  manifest `docs/manifests/sk-census-religion-2001-2021.json`.

### 2026-07-08

- Extended the Vanuatu map back to the 1967 first census and added a
  denomination overlay. `scripts/build_vu_1967_provinces.py` digitises
  McArthur & Yaxley (1968) Table A (per-1,000 adherence by island,
  persons aged 15+) and aggregates islands to the six modern provinces,
  weighting by aged-15+ population and using the island→province
  crosswalk implied by the 2009 census island rows; validation
  reproduces the report's national customary share (14.65% vs 14.6%)
  and reconciles province populations to the national total minus the
  262 ship-board residents. `scripts/build_vu_area_summary.R` now
  carries five denomination shares (customary beliefs, Presbyterian,
  Anglican, Catholic, Seventh-day Adventist) across 1967/1999/2009/2020
  at province level (and 2020 at area council). Because affiliation sits
  at 94–100% in every province and year, the VU map now opens on
  customary (kastom) beliefs — the headline diversification signal,
  which falls from 70% of Tafea adults in 1967 to 17% in 2020. The
  shared region module gained opt-in denomination metrics (hidden from
  countries that do not list them), config-ordered metric dropdowns,
  and an area popup that leads with the metric on display so a 1967 row
  reads even though its affiliation column is undefined by construction.
  1967 tabulated adults with no no-religion category, so its affiliation
  and no-religion shares are left blank and flagged.

- Added static RA and PI/reviewer guide pages under `apps/guides/`
  with shared light styling, hosted demonstration media references, and
  print-friendly screenshot layouts.

### 2026-07-07

- Consolidated the portal's two revision-start paths onto the server.
  The `reviseEvidenceDraft` mutation now serves every revision-eligible
  status with per-status transition rules: changes-requested moves to
  in-progress (the pair `feedbackLoopMetrics` keys on, unchanged),
  while needs-review and unresolved-note keep their queue status so
  the submission stays reviewable while the revision rides alongside.
  The clone source now includes unresolved notes, and a repeat start
  reuses the author's existing editable draft instead of minting a
  second clone. The portal's "Revise submission" button, which
  previously fabricated a local draft id with no server clone and no
  task event until the next save, now calls the same mutation, so
  every revision start is recorded as a task event. Also fixed the
  Revise-now save path: the client now tracks the server-returned
  clone id and, after a reload, falls back to the latest editable
  draft — before this, the first save after a server-side revision
  start fell back to the default draft id, collided with the immutable
  submitted draft, and failed.

- Built the ratified RA feedback and training designs
  (docs/portal-ra-feedback-and-training.md). Guy's training workpack:
  an internal seeder (`trainingSeed:seedGuyTrainingWorkpack`) creates
  batch `guy-vu-training-001` with ten `[TRAINING]`-marked Vanuatu
  cases covering every paid flow, each carrying its expected outcome
  and reviewer checks; export bundling now enforces the training
  exclusion rather than relying on naming convention. RA feedback
  loop: a `reviseEvidenceDraft` mutation clones the submitted draft
  into a new editable version (submitted versions stay immutable) and
  moves the task changes-requested to in-progress with a task event;
  the verification portal pins a "Changes requested" panel above My
  work showing the reviewer's note and required follow-up verbatim
  with a one-click Revise now button, plus a count badge by sign-in.
  A reviewer-gated `feedbackLoopMetrics` query reports revision
  turnaround from task events. The multi-agent review pass also
  converted every remaining unindexed `.filter()` scan (evidence,
  tasks, exports) to indexed lookups — completing the 16MB read-limit
  fix — and corrected take-before-sort truncation, a
  status-bucket-dropping country listing, and stale import dedup keys
  on revision clones that the first conversion introduced.

- Added the Claude batch-review lane (PR #18): before reviewers open
  the queue, an internal Convex action reviews each pending submission
  and appends a versioned, source-first AI recommendation (accept,
  revise, reject, or defer to human cultural judgement) with per-source
  verification records that state exactly what was checked and how.
  The reviewer portal shows the latest recommendation inline —
  expandable reasoning, checks table, a use-recommendation prefill and
  an explicit decide-differently affordance — and each recorded
  decision carries which artifact was on screen and whether the human
  followed it. Two hard lines hold throughout: the ratified
  human_confirmed gate is untouched (the lane appends artifacts and
  audit events only; humans decide), and kastom-flagged items get
  source checks only, with privacy-flagged content never sent to
  external services. Independently line-reviewed by a second Fable
  instance over two passes (fixes included a batch-deadline
  arithmetic error, an SSRF guard with per-hop private-host blocking,
  and truncation-proof structured model calls). The lane is inert
  until JB deploys; the activation checklist is in
  docs/portal-claude-batch-review.md. The same PR fixed all four
  non-blocking findings from the PR #17 review, including field
  provenance on the generic agent-draft confirm path.

- Built the ratified batch-import and correction designs. Curators can
  import a CSV of nominations in the workbench: one file-level source
  record, per-row validation in the submit path's own wording plus the
  two owned stricter rules, a repairable per-row report
  (imported/rejected/parked/skipped), locator-plus-hash idempotent
  re-uploads, VU rows parked without an explicit kastom answer, and
  every imported row arriving as an unsubmitted draft in the standard
  queue. The workbench also accepts the map route: `?site=` opens a
  correction bound to that existing site (map coordinates shown as
  display-only context, never copied into evidence), and coordinates
  without a site prefill a place-first nomination; parameters are
  consumed once and stripped so refresh cannot duplicate work. Browser-
  verified end to end in demo mode; an inert Convex mirror
  (`batchImport:importNominationBatch`, curator/admin-gated, drafts
  only) waits on the JB-gated binding. Map-side links stay dormant per
  the publication plan.

- Ratified design notes for the portal's next arc
  (docs/portal-batch-import-and-corrections.md, reviewed by the same
  second instance): curator-lane batch import of site nominations with
  per-row repairable validation and locator-plus-hash idempotency (the
  RA path stays one-by-one), map-dot corrections as evidence against
  existing sites through the standard queue, and targeted visual
  alignment of the workbench with the map shell.

- Added Canada as the ninth country data map: census-division religion
  for 2001, 2011, and 2021 from Statistics Canada (288/293/293 rows,
  all joins complete), each wave on its own boundary vintage via the
  timeline's level switching — no cross-vintage correspondence is
  applied, and the page says so. The 2011 wave is the voluntary
  National Household Survey, carried as its own flagged construct with
  a year caveat in the legend and the NHS named in every popup's
  denominator note; the change metric is not exposed because
  year-over-year comparison cannot span level-switching stores. Every
  wave was validated independently from its raw archive (all rows
  exact, including a reverse-engineered read of the 2001 E00 boundary
  format), reconciliation covers all thirteen provinces and
  territories, and residuals are consistent with StatCan random
  rounding. Build by codex; review found and fixed a
  validation-coverage gap and an inert metric before ship. Raw sources
  archived with hash verification.

- Backfilled the Australia 2016 census wave through the official ABS
  population-weighted SA2 correspondence onto 2021 boundaries
  (4,944 rows across two waves; conservation residual at most 8
  persons; every 2016 row flagged and asterisked as crosswalked). The
  2011 wave stays deferred: no official 2011-to-2021 correspondence
  exists and the project builds no crosswalks of its own. Review
  caught an additivity defect before ship — independent rounding of
  three fractional components broke affiliation + no religion =
  population on 85 crosswalked rows and produced negative counts on
  tiny perturbed areas (one already live in 2021) — fixed by rounding
  once, clamping, and deriving, with clamp counts recorded in the
  manifest.

- Redesigned how whole-wave caveats render in the shared runtime: a
  wash flag carried by every row of a displayed year no longer washes
  the map pale (which erased a wave's information entirely — caught
  live on Canada 2011 before ship); the year instead gets a legend
  caveat line naming the reason, while scattered value-quality flags
  keep the pale wash. The wash legend is composed from the flags that
  actually wash, fixing the United Kingdom's long-standing mislabel
  (its crosswalked areas were attributed to "small or suppressed
  denominators"). Voluntary-survey waves joined the recognised caveat
  vocabulary. The later-foundations rings are restyled dark slate and
  the legend now reports how many qualifying dots exist ("2 in this
  dataset"), so sparse historical data reads as sparse rather than
  broken.


- Merged the portal session's research-workbench pull request (#17):
  the free-contribution portal is browser-verified against every
  playbook acceptance check (place-first and source-first creation,
  offline archive sources without coordinates, reason-gated dedup
  continuation, read-only submitted records, the localStorage-only
  demo boundary), the Vanuatu kastom gate is hardened against the
  synthetic empty-placeholder change event and holds through
  navigation and reopening, and a friendliness pass lets My-work items
  open their records (drafts editable, submitted read-only, agent
  drafts with a confirm-as-own-work path honouring the ratified
  human-confirmed gate), with plain-language task cards, step cues,
  guidance-toned validation, and explained empty states. The sitting
  also added the step-by-step publication and Convex-binding plan with
  its five-item JB decision checklist, an RA-AI interaction options
  note, and a deferred playbook for agent-autonomous external evidence
  gathering (task #12). Publication, the Convex binding, and invites
  remain deliberately unperformed — each is a JB-gated decision in
  docs/development/workbench-publication-plan.md.

- Bumped starlette to 1.3.1 across pyproject.toml, uv.lock, and
  api/requirements.txt (dependabot #16; #15 closed as its subset).

- Re-ranked the unbuilt country queue by attainable wave depth (JB
  rule: fetch all waves; three-plus-wave countries outrank) after a
  source-verification pass: Canada leads with five attainable waves,
  Portugal likely five, Slovakia and Romania four, South Korea four
  (promoted from tier B, with KOSIS table identifiers recorded on the
  card). Recorded the Australia correspondence findings (2016-to-2021
  exists, so a 2016 backfill is attainable; no official 2011 route)
  and opened New Zealand wave-extension research notes: the 1991-2006
  religion tables did not migrate from the decommissioned NZ.Stat, so
  that extension needs identifier recovery or a customised-data
  request, while 1966 and earlier remain deep-history extraction
  candidates.

- Separated caveat flagging from value-quality washing in the shared
  runtime: a distinguishing per-row quality flag now earns the popup
  asterisk and the page's flag note (universe breaks, boundary
  vintages, construct derivations), while only the value-quality flags
  (suppressed/perturbed denominators, boundary crosswalks) continue to
  wash the choropleth. Browser verification caught the original
  defect — the asterisk pathway recognised only the value-quality
  vocabulary, so Brazil's 2022 age-universe note and Mexico's
  boundary-vintage and ages-5+ notes never rendered — and then caught
  the first fix over-correcting on New Zealand, where a caveat carried
  by every row asterisked everything and attached the rr3 note to
  areas it is false for. The shipped design excludes flags common to
  every row of a product (computed from the data, no vocabulary
  hardcoded): a caveat that distinguishes nothing marks nothing, and
  product-level facts stay in the pages' unconditional copy. A flag
  audit against every country's note text followed; Vanuatu's note now
  covers its urban-derivation and island-published caveats.
  Shared-asset token 20260707h on all eight pages.

- Added Australia as the eighth country data map: statistical-area-2
  census religious affiliation for 2021 from the ABS Census General
  Community Profile DataPacks table G14 (2,472 SA2 rows on ASGS
  Edition 3 GDA2020 boundaries, join 2,472/2,472 plus the
  Outside-Australia shell kept boundary-only). The denominator is
  stated responses (total persons minus religious affiliation not
  stated); "no religion" is the ABS secular-beliefs, other-spiritual-
  beliefs and no-religious-affiliation group, named as such on the
  page. State and national reconciliations differ by at most 100 and
  198 people — the expected signature of the ABS small random
  adjustment, now documented in the manifest with a coded acceptance
  bound. The 2011 and 2016 waves are deferred until the official ABS
  boundary correspondences are both available; no project crosswalk
  was constructed. Each source was verified separately against its own
  raw archive per the standing directive. Build by codex per the
  standard brief; a code-review pass (eight findings, all fixed) ran
  before ship, with data values proven byte-identical across the fixes.

- Extended the Mexico data map with the 2000 census wave (JB ruling
  2026-07-07): religious affiliation and no religion derived from the
  three CGPV 2000 ITER fields (affiliation = Catholic plus any
  non-Catholic religion; no religion by subtraction), on the
  ages-5-and-over universe — flagged in every popup and the onboarding
  as not directly comparable with the full-population 2010-2020 waves,
  and carried on each 2000 row as construct_two_field_age5plus_derivation
  with universe_age5plus. Join coverage 2,443/2,469 (the 26
  municipalities created after 2000 render as no data); the national
  denominator, affiliation, and no-religion sums reconcile against the
  raw archive to zero difference, verified independently twice. The
  manifest moved to mx-census-religion-2000-2020.json.

- Added Mexico as the seventh country data map: municipality-level
  census religion for 2010 and 2020 from INEGI ITER (4,938 rows across
  2,469 municipalities on 2020 Marco Geoestadistico boundaries; 2020
  joins 2,469/2,469, 2010 joins 2,456 with the thirteen
  post-2010-creation municipalities documented; national totals
  reconcile exactly against the derived extract, and each source was
  verified separately against its own raw archive — both ITER waves
  exact to zero differences, boundary codes exact against the official
  municipal catalogue). The denominator is the sum of four retained
  constructs — Catholic, Protestant/evangelical/biblical, other
  religion, and no religion — with the crosswalk caveat stated on the
  page. The 2000 ITER archive is downloaded, checksummed, and
  documented but not rendered: its three religion fields (Catholic 5+,
  non-Catholic religion 5+, non-Catholic including no religion 5+)
  cannot yield the four constructs, and mapping the two derivable
  headline metrics on an ages-5-and-over universe awaits a
  construct-honesty ruling. Build by codex (GPT-5.5) per the standard
  brief; review caught a serialisation defect before ship (R row names
  turned the rows array into a JSON object, which would have crashed
  the census join). Opus browser verification passed all eleven
  checks. Raw sources archived to the research bucket with sha256
  round-trip verification.

- Developed the multi-domain overlay brief into a proposed design
  (docs/development/multi-domain-overlay-design.md, awaiting JB
  ratification): an overlays config block with a permanent legacy shim
  so existing pages never change until they opt in; one governed
  product per domain and level with metric definitions read from the
  product's own indicators registry; a domain select that appears only
  on multi-domain pages; place dots and the Points control as
  religion-domain furniture; one timeline with per-domain year sets;
  survey estimates as a third construct class carrying intervals and a
  wide-interval wash; and a three-phase rollout (runtime shim, VU
  language pilot from Guy's tables, GFS survey construct).

- Added place-dot visibility modes to every country map (JB directive):
  a Points control in the census panel with period (only dated dots
  alive at the selected year; the undated snapshot hidden entirely
  rather than faded), all (the previous behaviour), and off (the
  choropleth alone). Historical years now open in period mode where a
  country ships dated places; a user's choice persists across year and
  level changes. Within period mode a "show later foundations" checkbox
  renders places founded after the selected year as hollow grey rings -
  with perfect information one would see where future places were to be
  built - and their popups say so. Legend copy tracks the mode.
  Countries without a dated layer offer all/off only. Shared-asset
  token bumped to 20260707f on all six pages.

- Added Brazil as the sixth country data map: municipality-level census
  religion for 2000, 2010, and 2022 from IBGE SIDRA (16,710 rows across
  5,570 municipalities, join coverage 5,507/5,565/5,570 per wave,
  validation residuals of at most 18 people against IBGE state and
  national totals), with a 27-state UF level alongside. The 2022 census
  universe break (ages 10 and over, versus resident population earlier)
  is flagged in every popup and the onboarding. Opus verification
  passed all checks with 40-53ms repaints at full municipality detail.

- Adopted the data-access and research tiers (JB-ratified): the maps
  show derived rates per source rulings, everyone gets
  reproduce-it-yourself instructions, and assembled census data serves
  team analysis only. Stood up the private tier: the pow-research
  GitHub repository and the pow-research-data bucket (individual
  Google-identity access, JB-granted; raw archives mirrored). The
  Vanuatu source-extract CSVs (attributed-use licence class) moved from
  the public repo to that tier; the public repo keeps the derived area
  summaries the map consumes, and the build script documents the
  private-tier fetch for rebuilds. Earlier revisions remain in git
  history by decision rather than history rewrite.

- Places of worship now ride the timeline: on historical years the maps
  show amber-ringed dots for places whose OpenStreetMap date tags say
  they existed in the selected year (born on or before it, not yet
  closed), filtered live by the slider, each popup carrying its dated
  span, a provisional-until-reviewed note, and Street View and OSM
  links. Undated places keep the faint fade; recent years are
  unchanged. Extracts: 1,313 dated NZ places (earliest 1835), 2,225 US
  (plus a few OSM typos the provisional tier tolerates), 51 Irish
  (earliest 1180); Vanuatu has none - the deep-history portal is the
  route there. Review caught a MapLibre semantics bug before ship
  (["has"] treats explicit null as present, which would have emptied
  the layer); the corrected filter reproduces expected counts exactly.
  This is tier two of docs/development/temporal-place-layer.md; tier
  one arrives with pow-replayed site states. Shared assets
  ?v=20260707e.

- Added the United Kingdom as the fifth country data map: local-authority
  census religion for England and Wales across 2001/2011/2021 (Nomis,
  993 of 993 rows valued, OGL), Northern Ireland districts for 2021
  (NISRA; 2001/2011 flagged pending), and Scotland council areas as an
  honest boundaries-pending level (the census table-builder extraction
  is queued). Opus browser verification passed all ten checks including
  the blocking attribution rule.
- Every country map's wordmark now links the Data maps hub, and a
  config-keyed "RA portal" entry joins "fix map" where a Google-auth RA
  surface exists (NZ and Vanuatu verification portals) — the public fix
  route stays OpenStreetMap. While the census overlay is on, the place
  dots now stay quiet at national zooms and return by city zoom, so
  choropleths stay readable in dot-dense countries; the historical-year
  fade is unchanged. Shared assets bumped to `?v=20260707c`.

- Added the Ireland research map at `apps/regions/ie/`. The first build
  uses CSO PxStat table `F5051` for county-and-city religious
  affiliation in 2011, 2016, and 2022, with a stated-response denominator
  (`All religions - Not stated`) and no place-density metrics until a
  governed Ireland place layer exists. The new
  `scripts/build_ie_area_summary.R` pipeline reads ignored raw sources
  under `data/raw/ie_census/`, derives
  `area_summary_county_city.json`/`.csv`, and writes the manifest
  `docs/manifests/ie-census-religion-2011-2022.json`. The boundary layer
  is a 30-feature, 2.56 MB GeoJSON derived from Tailte Éireann 2019
  administrative areas; Cork City Council and Cork County Council are
  dissolved because `F5051` publishes Cork City and Cork County as one
  reporting unit. Validation is exact: 30/30 county-and-city joins for
  every wave, and county-and-city sums match the CSO State row for
  `All religions`, `Not stated`, the stated-response denominator,
  religious affiliation, and no religion in all three waves. CSO and
  Tailte Éireann are attributed on the page and in the manifest under
  CC BY 4.0. Census 1926 Volume 3 Table 09 is downloaded but deferred:
  the PDF is image-only. The 1861-1926 extension needs OCR, table QA,
  and historical county/county-borough boundary handling before
  publication.

- Implemented the demo-mode `Nominate missing PoW` workbench path. The
  provider interface now includes free contributions, deduplication
  candidates, source records, source-linked claims, and agent draft
  confirmation or rejection through `DemoProvider` and localStorage only.
  The workbench sidebar now opens place-first and source-first flows,
  supports archive references without URLs, keeps regional-only claims
  valid without coordinates, and seeds a demo archive extraction run for
  human-confirmed agent-assisted review. The shared Convex backend and
  public map products remain untouched.

### 2026-07-06

- Extended the United States research map back to 1850 with IPUMS NHGIS
  county tables. Added derived NHGIS area summaries for 1850, 1860,
  1870, 1890, and the 1906/1916/1926/1936 Census of Religious Bodies,
  plus five period county boundary levels (`county_1850`,
  `county_1860`, `county_1870`, `county_1890`, `county_1930`) simplified
  to 1.46-2.63 MB each. The US page now attributes historical tables to
  IPUMS NHGIS, names the construct shift from church seating to members
  to adherents, and keeps the nineteenth-century data on period
  boundaries rather than crosswalking them onto 2020 counties. New
  manifest: `docs/manifests/us-nhgis-county-1850-1936.json`; raw NHGIS
  ZIPs remain ignored under `data/raw/us_nhgis/` and await private
  archive upload.

- Fixed the country maps 404ing on the live site: GitHub Pages runs
  Jekyll by default and Jekyll silently excludes underscore-prefixed
  directories, so `apps/regions/_shared/region-map.js` — the shared
  runtime every country page loads since the 2026-07-04 unification —
  was never served to fresh visitors (cached copies masked the failure
  for returning ones, including during earlier verification). Added
  `.nojekyll` so Pages serves the repository as-is; the site uses no
  Jekyll features and deploys build faster without Jekyll processing
  the large data files.

- Made the US datamap legible at national zoom and long series readable
  on phones: a new `overviewDotOpacity` config fades the low-zoom OSM
  place-dot tier where its density would bury the census choropleth
  (US: 0.12; NZ/VU unchanged at the 0.75 default, dots ramp back in
  from zoom 6), and with six or more year ticks the slider thins the
  middle labels so 1952-2020 does not render as one run-together
  string. Shared asset version bumped to `?v=20260706b`. Raw source
  masters for both countries now have verified archival copies at
  `gs://places-of-worship-private-sync/raw_sources/` (VU census PDFs,
  Guy's 1999 scan, and all ARDA files; every file sha256-verified by
  round-trip re-download).

- Extended the United States county map from two waves to the full
  qualifying ARDA county series: Churches and Church Membership 1952,
  1971, 1980, 1990, and U.S. Religion Census 2000, 2010, 2020. The
  rebuilt `area_summary_county.json` now carries 21,905 rows across
  seven waves, with per-wave extracts, a year-scoped
  `fips_crosswalk_to_2020.csv`, and a new
  `docs/manifests/us-rcms-county-1952-2020.json` manifest. Validation
  compares county sums with matching ARDA state files: 1952, 2000, and
  2010 match exactly; 1980 and 1990 match on congregations/adherents but
  differ slightly on population; 1971 differs materially from its state
  file; 2020 county sums are below the state file by 644 congregations
  and 214,571 adherents while population matches. Federal Census of
  Religious Bodies county files for 1906, 1916, 1926, and 1936 were
  verified but skipped because their county files lack same-study county
  population fields. The US page now warns that wave coverage differs,
  including the 1952/1971 Black-denomination coverage gap, and the
  change metric is explicitly wave-to-wave.
- Fixed stale-module hazard on the country maps: the shared
  `region-map.js`/`region-map.css` URLs now carry a version query
  (`?v=20260706a`) in every country page, so browsers holding a cached
  copy of the old module cannot run it against new pages or data —
  the likely cause of the maps appearing blocked or stale after
  deploys. Bump the version token whenever the shared module changes.
  Also restored byte-identical NZ/VU popup headers (the short
  "Religious"/"No religion" words) — the dynamic header now applies only
  when a country overrides `metricLabels`. Full pre-deploy pass on all
  surfaces: hub, NZ (2013–2023, popups original), VU (1999–2020, Tafea
  popup all three censuses), US (adherents labels, two metrics,
  resident-population denominator note, no dash columns), global map
  serving; zero console errors.
- Tightened the US map's construct honesty in the shared popup: the
  hardcoded "stated religion-response denominator" footnote is now the
  config field `popupDenominatorNote` (default unchanged for NZ/VU; the
  US states its resident-population denominator and why rates can
  exceed 100), and when a country hides the place metrics the popup
  drops the Places/Per-10k columns and the OSM places credit instead of
  showing dash columns. Verified the defaults reproduce the previous
  popup strings exactly.
- Added the United States as the third country data map:
  `apps/regions/us/index.html`, a county-level choropleth of adherents
  per 100 population from the U.S. Religion Census (RCMS 2010 and
  2020), with sources verified by direct web/curl lookup before any
  data was downloaded (ARDA/OSF county-file downloads require no
  account or registration; Census Bureau boundaries are public domain).
  Built `apps/regions/us/data/area_summary_county.json` (3,143 counties
  x 2 years) and `counties_2020.geojson` (2.56 MB, simplified from the
  Census Bureau's 2020 cartographic boundary file, 50 states + DC).
  Join coverage is 3,143/3,143 for both waves; a documented crosswalk
  (`apps/regions/us/data/source/fips_crosswalk_to_2020.csv`)
  handles ten 2010 county FIPS codes affected by Alaska census-area
  splits/renames, a Montana park-county dissolution, two Virginia
  independent-city mergers, and one South Dakota rename. County sums
  reproduce ARDA's own published national and Alabama state totals to
  within 0.06%. Construct honesty is binding here: the US series counts
  congregations and adherents reported by religious bodies, not a
  census self-identification question, so labels say "adherents", never
  "affiliation", and the no-religion metric is omitted as inapplicable.
  This required a minimal, backward-compatible extension to the shared
  region-map runtime (`apps/regions/_shared/region-map.js`):
  `RC.metricLabels` (per-metric label/note override) and
  `RC.metricsAvailable` (metric allow-list), both optional and
  documented in `docs/development/adding-a-region.md`; NZ and VU were
  re-verified byte-identical in behaviour after the change (all five
  metrics, both time sliders, zero console errors).
- The Vanuatu map's census time series now reaches back to 1999. Guy
  Lavender Forsyth supplied a scan of the print-only 1999 Census Main
  Report (previously locatable only at the National Library of
  Australia and SPC Noumea); its Table 2.10 religion-by-island counts
  were transcribed at province level, validated exactly (every province
  row sums to its total, provinces sum to the national row, and the
  national row matches the 2020 Analytical Report's Table 30, whose
  1999 refuse-to-answer figure equals this table's do-not-want-to-say
  plus not-stated), and built into `area_summary_adm1.json`. The
  province slider now walks 1999–2009–2020 and the change metric spans
  both intercensal periods. Island-level 1999 rows remain in the scan
  for the planned area-council harmonisation. Also fixed a latent R
  partial-matching bug in `scripts/build_vu_area_summary.R` (`$` on a
  missing `population_total` silently matched `population_total_basis`)
  by switching to exact `[[ ]]` access and writing explicit nulls — the
  rebuild is now idempotent on its own output.

### 2026-07-04

- The Vanuatu map now carries real census religion data: provinces for
  2009 and 2020 and area councils plus urban municipalities for 2020,
  extracted from the census Basic Tables Volume 1 PDFs (Table 3.5) with
  full provenance, cross-checked against the published Analytical Report
  percentages (within 0.1pp), and built into the governed
  `area_summary_adm1/adm2` products by `scripts/build_vu_area_summary.R`
  with a tracked manifest. The 2020 provincial values include the urban
  municipalities by derivation so they match the 2009 basis; 2009 stays
  pending at area-council level because that census published islands,
  and the Torres council is absent from the geoBoundaries ADM2 layer
  (both documented in the product). The map now opens on religious
  affiliation like NZ, attributes VBoS and SPC, and notes the source's
  own ±1–2 cell perturbation. A national religion series back to 1989
  sits alongside the source extracts; province-level 1989/1999 tables
  exist in print only. The Basic Tables volumes carry no explicit
  licence (the Analytical Report authorises acknowledged research use) —
  flagged for maintainer review.
- Began the strict-TypeScript Research Workbench (`apps/workbench/`), the
  RA ingestion app for location and attributes of historic and present
  places of faith. React + Vite with strict types per the standing stack
  decision; country behaviour is declarative config (NZ 2013/2018/2023;
  Vanuatu 1989/1999/2009/2020 with a first-class kastom-site sensitivity
  prompt and lifecycle evidence accepted from 1600). The evidence form
  extends the pilot's wide row with bounded lifecycle dates, geocoding
  basis, per-source provenance, and place attributes, following the UI
  style guide's wording, colour meanings, and controlled-vocabulary
  rules. All data access goes through a provider interface; only a
  localStorage demo provider exists, so the shared Convex backend, the
  live RA surfaces, and the master data are untouched. Verified in
  browser at desktop and phone widths: save draft, submit for review
  with validation, read-only submitted state, unresolved-note path, and
  country switching, with a clean console.
- Added `research/countries/TEMPLATE.md`, the one-page build-card
  template that every surveyed country will follow (tier, verified
  sources over time, boundaries, first visualisation, build recipe,
  risks, deep-history potential).
- Unified the country research maps onto one shared runtime:
  `apps/regions/_shared/region-map.js` and `region-map.css` now carry all
  map and census logic, and `apps/regions/nz/index.html` (87 lines) and
  `apps/regions/vu/index.html` (84 lines) are thin `REGION_CONFIG`
  loaders, executing the plan in
  `docs/development/regional-map-consistency.md`. The module is the
  union of both forks' behaviour, keyed on config and data rather than
  country identity (boundaries-pending legend and popups, rr3 wash-out,
  percentile clamps, the null-change guard). Parity was verified before
  each swap: a 42-element computed-style sweep identical on NZ, a
  hash-identical sweep on VU, interaction checks across the census
  panel, metric and geography switches, slider, legend, and popups, with
  zero console errors. Fork drift and resolutions are recorded in
  `apps/regions/_shared/DRIFT-REPORT.md`; adding a country is now a
  config plus governed data products per
  `docs/development/adding-a-region.md`.

### 2026-06-13

- The Vanuatu map now shows a real metric while census religion stays
  pending: place-of-worship density (OSM places per km²). The build
  fetches `amenity=place_of_worship` from Overpass (214 points; includes
  some nakamals as OSM tags them), computes geodesic land area and
  point-in-polygon counts per province and area council, and the map
  opens on that choropleth. Area popups show the count, area and density;
  the religion metrics report "no data yet" until counts arrive.
- Fixed wordmark links being unclickable on the country maps: the
  centred census control is a full-width layer above the top-right
  wordmark, and it was swallowing the clicks. The shared
  `.shell-top-centre` now passes pointer events through its empty flanks,
  so only the actual controls catch clicks (cured on NZ and Vanuatu).
- Removed Vanuatu's cross-link to the NZ map (wordmark and onboarding);
  country maps link only to the global map, which is the route between
  countries for now.
- Added a Data maps hub (`apps/regions/index.html`) listing the country
  research maps, and a desktop "Data maps" link in the global map's
  wordmark (first entry, the reciprocal of the country maps' "Global
  map" link). The README now links the New Zealand and Vanuatu maps
  directly.
- Brought the Vanuatu map to the same control layout as NZ: Census
  front-and-centre as a panel disclosure (geography selector and the
  boundaries-pending legend), Key top-left, no play button, two-pill
  bottom row.
- Reworked the NZ map's top controls so census is the centrepiece: the
  Census button moved front-and-centre at the top (a disclosure that
  opens and closes its data panel — metric, geography, colour key and
  the time slider all in one place), and the denomination Key moved to
  the top-left. The census options left the Search bar entirely. The
  bottom row returns to Search & Filters · Near Me. The slider's play
  button is gone — dragging the slider is enough. On phones the Key
  collapses to its colour dots so it never crowds the Census control.
- Added a parallel Vanuatu research map at `apps/regions/vu/`, forked
  from the NZ map on the same shell. It carries the country's province
  (ADM1, 6) and area-council (ADM2, 65) geographies from geoBoundaries,
  census years 2009 and 2020, and the full place layer from the global
  tiles. Per-area religious-affiliation data is not yet available as a
  structured source (the 2020 VNSO provincial tables are PDF-only), so
  the areas render as a boundaries-only scaffold: the legend states the
  data is pending and the area summaries are ready to receive counts
  with no schema change. Wordmarks cross-link NZ and Vanuatu.
- Fixed a latent bug in the change metric: JavaScript coerces `null` to
  0, so `null - null` returned 0 rather than no-data. A suppressed or
  pending denominator now counts as no change, not zero change
  (surfaced by Vanuatu's all-pending data; also corrected on the NZ map).
- The census overlay is now a first-class control on the NZ map: it is
  on by default (so the map opens already oriented over the country), and
  a third bottom-row pill — Search & Filters · Census · Near Me — toggles
  it. The redundant in-dock checkbox is gone; the Census pill carries a
  rounded-square swatch (an area layer) to read distinctly from Near Me's
  round location dot. Three pills fit 375px.
- The NZ map now defaults to MapTiler's low-saturation Dataviz basemap,
  which is built to sit under data overlays so the census choropleth
  reads clearly above it; without a MapTiler key it falls back to
  Backdrop, then the free CARTO style.
- Fixed the denomination taxonomy path on the NZ map: the page sits one
  level deeper than the global map, so its `../../schemas/` fetch 404ed
  and the Christian-denomination sub-filters never populated. Corrected
  to `../../../schemas/`.
- The census overlay gained a time slider in the legend panel: it steps
  the choropleth through the census years (2013, 2018, 2023) with a play
  button that auto-advances, so the religious-affiliation change shows as
  motion across the map. The slider, the year dropdown, and autoplay all
  drive one shared year state and stay in lockstep.
- The NZ map's census overlay now offers two geographies: territorial
  authority and statistical area 2. The SA2 level reads a new governed
  product (`area_summary_sa2.json`, 2,311 areas by censuses 2013–2023)
  built from a provenance-recorded Stats NZ extract (the 2023 Census
  totals-by-topic SA2 feature service, CC BY 4.0; earlier censuses sit
  on 2023 boundaries via Stats NZ's own concordance). Areas with small
  or suppressed denominators wash out on denominator metrics, popups
  mark flagged years, and colour scales clamp to the 2nd–98th
  percentile so extreme small-area values cannot compress the national
  palette.
- Removed the unverifiable legacy demo data (`religion.json`,
  `demographics.json`, the 2018 `sa2.geojson`, and the static
  demographic stubs), completing the storage policy's audit-or-remove
  action; the new SA2 extract supersedes them with full provenance.
- The verification surface keeps its light RA workspace and CARTO
  basemap but now shares the project's type stack via
  `apps/shared/map-shell.css`, and the style guide's colour meanings
  moved into CSS custom properties with values unchanged (the guide's
  named future work). Computed styles verified: only the font stack
  changed. The shared sheet's popup idiom is now scoped to MapLibre
  popups so it cannot leak into Leaflet surfaces like this one.
- The rebuilt NZ research map is now the live page: `next.html` became
  `apps/regions/nz/index.html`, and the Leaflet page retired with its
  app scripts (`enhanced-places-app.js`, `denomination-mapper.js`;
  both live in git history). Inbound links pointed at the directory,
  so no link changed. Data files all remain, including `sa2.geojson`
  for the future SA2 overlay.
- Began the NZ research map rebuild on the global MapLibre shell:
  `apps/regions/nz/next.html` (alongside the live page) adds
  territorial-authority census choropleths (five metrics, censuses
  2013–2023, a diverging change scale), dark census popups with the
  full year table, a choropleth legend under the key pill, NZ city
  chips, and NZ-biased search. The overlay consumes the governed
  `area_summary_ta.json`; the Leaflet page remains the live
  `index.html` until parity.
- The NZ research map now wears the shared design language: slate
  masthead and controls bar, dark legend and loading panels, pill corner
  links, and the shared type stack, via `apps/shared/map-shell.css`.
  Semantic colours (category dots, data-quality sizes, cluster tints,
  choropleth scales) are unchanged; popups stay light pending the
  rebuild decision.
- Extracted the global map's theme primitives (tokens, the dark pill,
  corner placement, toast, popup skin, attribution treatment) into a
  shared stylesheet, `apps/shared/map-shell.css`, that the global map now
  consumes. Computed styles verified unchanged at 1280 px and 375 px;
  the research maps adopt the same sheet next.
- Searching a specific address now drops the measuring pin there and zooms
  in; area searches surface a once-per-session tip naming the gesture for
  dropping a pin.
- Marked the reliefmap porting guide as historical in `AGENTS.md` and in
  the guide itself, so retired features (the nearest banner, the ambient
  guide line) are not rebuilt from its inventory.
- The hint toast (pin drop, location messages) now wraps centred within
  the phone screen instead of running past both edges.
- Fixed the Filters toggle, which had never visually worked: its hidden
  attribute was silently overridden by the rows' display rule, so the
  state flipped while the screen never changed. Popup distances now say
  `as the crow flies` inline and the footnote renders white.
- The theme selector now rides in the wordmark pill beside GitHub and fix
  map; phones fix the theme to Backdrop (the wordmark hides there, and the
  credit fallback still applies).
- Mobile pills dropped to the refresh button's line and the dock followed;
  attribution uses MapLibre's responsive default — full text on desktop,
  a tap-to-expand disc on phones.
- Removed the nearest-place banner and its background nearest search;
  distances live in the place popups, and the tap-held guide line and
  planning pin remain (tap the pin to remove it).
- Replaced the circular GitHub info badge with a compact theme selector
  pill under the wordmark (top corner on phones); the badge's links live in
  the wordmark and the repo, and the onboarding card still shows each new
  session.
- The guide line now draws only when the user taps a place (and releases on
  a second tap); Near Me shows the dot and the nearest-distance banner
  without drawing a line unbidden.
- Moved the attribution to the true bottom corner on phones, where it no
  longer crosses the Search and Near Me pills; the filters disclosure became
  a full-width 44 px touch target and its chips now build at page start.
- The OpenStreetMap credit is now always on screen: both place tile sources
  declare ODbL attribution and the attribution pill no longer hides behind
  the info menu.
- The denomination key shrank to a compact pull-down: three colour dots for
  the leading categories in view, a Key label, and a caret, with the full
  key one tap away.
- Filters now persist when the search panel closes; an indicator chip
  beside the toggle shows the off-count and clears everything in one tap,
  and reopening the panel shows the active filters. Filter state travels
  in the URL fragment beside the camera, so filtered views are shareable.
- Typing a category into search (mosque, synagogue, church, a religion
  name, or a Christian denomination) now applies the matching filter and
  closes the panel; longer queries geocode as before.
- Restructured the filters: the Christian chip is now the tri-state master
  of its nested denomination row (selecting Anglican alone shows Christian
  as partially on, so a denomination can never be selected without its
  religion), and the rows sit behind a collapsed `Filters` disclosure whose
  label carries an off-count whenever anything is filtered.
- Added a tri-state `All` box that selects or clears every filter at once,
  with a dash showing a mixed state.
- Added search-panel filters: chips for the nine palette religions plus,
  while Christian is selected, eight major denomination buckets and Other
  Christian, grouped from raw OSM values through the denomination
  taxonomy's aliases. Filters drive the map layers, the counts key, and
  the nearest search together.
- The search dock follows the reliefmap contract: the toggle reads
  `Search & Filters` / `Close`, the panel has a ×, Escape closes, and
  closing or resetting clears all filters.
- Fixed Near Me on phones: the pill is now a strict toggle (a tap after
  panning turns location off rather than re-zooming to the user), the
  nearest search no longer stacks deferred tile queries while location
  tracking keeps the camera busy, and a denied browser permission now
  explains where to re-enable location.

### 2026-06-12

- Fixed the global map's fullscreen mode hiding the HUD, dock, and buttons:
  the fullscreen control now fullscreens `document.body` rather than the map
  element alone.
- Replaced `isStyleLoaded()` gates in the global map's click handlers and
  counts panel with layer-presence guards, so taps and key updates are no
  longer silently dropped during repaints (worst around basemap switches).
- Added a blue-dot geolocate control to the global map for all devices
  (high accuracy, follow mode, larger dot on phones) — the first feature of
  the reliefmap location-features port described in
  `docs/development/location-features-from-reliefmap.md`.
- Added a labelled `Near Me` pill beside `Search World` that drives the
  geolocate control's state machine, replacing the stock icon; on phones the
  pill row sits above the corner basemap control with 44 px touch targets.
- The global map now lands on the keyed Backdrop theme wherever a MapTiler
  key exists and falls back to the free CARTO style once if the key is
  blocked, rate-limited, or out of credit.
- Shortened the global map's onboarding card to two bullets and moved its
  copy to NZ English; the fix-on-OSM route now lives in the wordmark's
  fix-map link and the card's `How to fix data` button.
- Added a top-right wordmark pill with a GitHub repo link and an OSM
  fix-map deep-link that opens the editor at the current view (desktop
  only).
- Added the planning pin: right-click or touch-hold drops a draggable amber
  pin that becomes the measuring point, with nearest-to-pin readouts,
  pin-origin directions, and tap-or-× removal.
- Added the dashed guide line from the measuring point to the inspected or
  nearest place; tapping a place holds the line on it (surviving popup
  close), tapping it again releases, and the line survives basemap
  switches.
- The nearest banner now yields while the search dock is open on phones and
  returns on close, instead of overlaying the panel.
- The basemap theme selector moved from its bottom-right pill into the
  octocat corner menu, clearing the bottom-right corner.
- Place popups are now singletons (opening one closes the previous) and the
  refresh sweep closes the open popup.
- Street View is now lazy: the page-load prewarm (a billable Dynamic Maps
  hit per visit) is gone, popups show a Show Street View button, and the
  Google Maps API loads once on first request with callback-based
  readiness. Expand, the drag hint, and Copy coords work without it.
- Raised the open search dock above the mobile pill row so it no longer
  hides the Search World and Near Me buttons.
- Added From you / From pin distance rows to place popups with a crow-flies
  footnote and a walking Directions link (pin as origin when down), on both
  the desktop and mobile popups.
- Tidied the global map's corner controls: the set-north badge now appears
  only when the map is rotated (phone and desktop), the dead second compass
  button is gone, the octocat info menu sits top-right under the wordmark,
  and a refresh button (bottom-left, both form factors) clears pin, search,
  and dock and flies home.
- Bumped starlette (1.0.1), pyarrow (23.0.1), and idna (3.17) past open
  dependabot advisories; fastapi 0.136.1 resolves cleanly against the new
  pins.
- Added the measuring point and nearest banner from the reliefmap port:
  distances answer from the blue dot (later the planning pin), the banner
  reports the nearest place of worship as the crow flies with a walk
  estimate, and tapping it opens Google Maps walking directions. The
  nearest search queries the detailed places source only, never the
  low-zoom overview tier.
- Added `DECISIONS.md`, a register of sixteen adjudicated rulings for the
  revisions pipeline, each with rationale, what it forecloses, and the cost
  to reverse.
- Added `schemas/denomination-taxonomy.schema.json` and the first versioned
  vocabulary instance `schemas/denomination-taxonomy.json`
  (`taxonomy_version` 2026-06-12.1), promoting the controlled vocabulary out
  of `apps/regions/nz/js/denomination-mapper.js`. Contested placements follow
  the Stats NZ standard classification and carry review flags.
- Tightened `schemas/change-event.schema.json`: `taxonomy_version` is now
  required for any denomination-bearing payload (previously only for
  `denomination_*` event types), `client_event_id` must be non-empty, and the
  descriptions state the bitemporal replay rule.
- Updated `docs/examples/revisions/nz-relocation.jsonl` to pin the v1
  taxonomy and use dotted denomination codes. Bare codes remaining in other
  example files and `pow-cli` fixtures are migration debt before
  taxonomy-membership validation is enforced.

### 2026-05-23

- Added temporary Vanuatu source-first portal entry points that use the shared
  Convex assignment and reviewer surfaces with Vanuatu target years 1989, 1999,
  2009, and 2020.
- Added a spreadsheet-submission import path so exported RA
  `site_evidence_wide` CSV rows can become provisional Convex tasks with
  submitted evidence drafts in the review portal.
- Added a Vanuatu OSM-derived starter seed builder for a balanced 50-case
  source-first task batch under `vu-source-first-test-001`.
- Seeded the hosted Convex deployment with the 50-case Vanuatu starter batch
  and verified that the public Vanuatu task and review entry points are live.
- Documented the Vanuatu test workflow, spreadsheet import command, Convex
  import mutation, and the continuing boundary that imported rows do not update
  the master or public map before review and `pow` validation.

### 2026-05-15

- Added explicit RA evidence fields for source-backed street address, locality,
  and address notes so `street address missing` tasks have somewhere to record
  the correction.
- Added Google identity-token expiry tracking and pre-expiry refresh attempts
  for the static Convex task client, reducing mid-session sign-in expiry during
  RA verification and review work.
- Switched the Convex Google OpenID Connect auth config to the public Google
  client id already used by the frontend, so local anonymous Convex codegen no
  longer depends on hosted deployment environment variables.

### 2026-05-14

- Refreshed RA-facing docs to include `No building present` / building absence
  as a first-class finding, distinct from worship-use closure, changed use,
  unrelated missing-site nomination, and bad-geometry review.
- Tightened Convex evidence/task-history access so RA accounts can inspect
  only their own or assigned evidence, while reviewer, curator, admin, and
  service roles retain project-wide inspection access.
- Added server-side field-size limits to Convex evidence, review, and task
  mutations so oversized notes, generated rows, and client context are rejected
  before they reach the shared backend.
- Recorded the strict TypeScript transition rule: new Convex-facing workflow UI
  should be strict TypeScript, while the live static verification map should
  migrate only through targeted redesign or pilot-driven edits.
- Refreshed RA-facing documentation so the assigned Convex-backed workpack is
  the preferred saving path and spreadsheet copy/paste is fallback only.
- Reordered the journal newest-first and refreshed the planning snapshot to
  describe the live Convex assignment/review workflow as of 2026-05-14.
- Reviewed the public Convex function inventory against the current exported
  queries and mutations, and added a workflow script catalogue for RA workpacks,
  Convex seeding, review exports, and `pow` handoff scripts.
- Updated the FAQ to reflect the current Convex-backed RA assignment, static
  reviewer portal, unresolved-note path, accepted-for-export boundary,
  TypeScript/Rust split, and workflow function/script references.
- Added the New Zealand submitted-evidence reviewer portal to the README links
  and noted that current authorisation is limited to JB and JW.
- Clarified that new Convex-facing task, review, nomination, export, and
  country-configuration UI should prefer strict TypeScript over new vanilla
  JavaScript.
- Added an OSM-notes-style `Submit unresolved note` path for RA work: useful
  but incomplete evidence now becomes a first-class Convex task/draft state
  instead of being forced into a completed submission.
- Added unresolved-note handling to the reviewer portal queue and documented
  the RA/reviewer workflow.
- Tightened the static reviewer portal: decisions now require an explicit
  choice and short note, reviewed/exported cases can be inspected, and reviewers
  can mark system-test submissions as rejected/excluded without entering the
  export path.
- Added an assignment-mode `My work` panel so RAs can see saved drafts,
  submitted cases, skipped tasks, and review outcomes without repeating work.
- Added a deliberate `Revise submission` path: submitted evidence is read-only
  by default, revisions create a new draft id, and older submitted drafts are
  marked `superseded` after the revision is submitted.
- Changed the assigned task list to show active work only, so submitted or
  skipped tasks leave the main queue after refresh and remain visible in
  `My work`.
- Added a visible `No building present` option to the worship-use dropdown and
  normalised it to `existence_status = absent` plus
  `worship_use_status = not_worship` for exported evidence.
- Blocked `NA`/`N/A` source titles on submit while still allowing incomplete
  drafts to be saved.
- Relaxed RA backend draft saving so `Save draft` can preserve incomplete work,
  while `Submit for review` still requires source and evidence details.
- Added a `No building present` RA action for demolition or no-visible-building
  cases, keeping building absence distinct from worship-use closure.
- Added a static Convex-backed New Zealand reviewer portal at
  `apps/regions/nz/review.html` for role-gated review of submitted evidence
  drafts.
- Extended the browser Convex client with review queue, review decision,
  evidence-list, and task-history methods.
- Tightened Convex review decisions so accepted-for-export decisions require an
  evidence draft from the same task.
- Added clearer street-level imagery support to the RA verification map:
  marker popups now expose Street View, the source-link panel prioritises
  Street View and Google Maps, and the evidence form can explicitly fill a
  Google Street View source URL for street-imagery checks.
- Clarified the RA instructions and planning around missing places of worship:
  assigned-task missing-site evidence should save through Convex, unrelated new
  candidates should be sent to JB for now, and the next reusable build step is a
  Convex-backed `Nominate missing PoW` flow.
- Added `Nominate missing PoW`, not `Add to map`, as the required wording for
  provisional candidate intake so RA-facing UI keeps the master boundary clear.
- Added documentation-governance guides: a staleness health check, a Convex
  function inventory, and a UI style guide for task-map wording, status,
  colour, button, and form conventions.
- Relabelled the old RA CLI tutorial as an archived CSV validation fallback,
  and recorded React + Vite + Convex React as the preferred stack for the first
  authenticated review portal or shared task workbench.
- Updated `BRAINSTORMING.md` so Convex is described as the chosen live pilot
  coordination layer, while Leptos/Rust-first UI remains a deferred comparison
  after the React + Vite review workbench.
- Updated the dataflow figures and review planning so assigned tasks and
  `Nominate missing PoW` candidates both flow through Convex, an authenticated
  review portal, a reviewed export bundle, and `pow` before public outputs.
- Recorded the Convex/live-workbench decision and added the first
  Convex-to-`pow` export bridge: `exports:getExportBundle` now exposes a file
  bundle, and `scripts/materialise_convex_export.py` writes ignored export
  artefacts with SHA-256 hashes for the round-trip validation path.
- Added the review-portal direction to the Convex planning docs: reviewer
  decisions should happen in a role-gated UI, update the RA-facing task state,
  and treat the current workpack as a filtered batch over one shared task list.
- Recorded the stack decision to use TypeScript pragmatically for
  Convex-backed prototypes, task/review workflow glue, and frontend
  integrations while keeping Rust and R authoritative for governed data and
  analysis.
- Polished the RA assignment page with a collapsible quickstart guide,
  optional invited-account hint, lifecycle-date prompt for closure/change
  actions, clearer post-submit/skip filter guidance, and a pre-paint mobile
  assignment layout guard.
- Clarified the RA workpack instructions: André should work through assigned
  tasks in order, stop at a natural stopping point, and understand that the
  50-case list comes from the documented R selection algorithm rather than
  hand-picked map sampling.
- Applied the first RA assignment UI review fixes: prevented assignment-mode
  skip from falling back to hidden local storage, removed the pre-sign-in
  initials prompt, improved phone layout, clarified save/submit labels,
  added sign-in-expiry handling, and reloaded the latest saved draft when a
  task is reopened.
- Moved the NZ assignment sign-in card to the top of the sidebar, enlarged the
  Google sign-in prompt, added a sign-out control, and hid old local
  copy/session guidance during backend assignments.
- Defaulted the hosted NZ verification page to the 50-case
  `nz-temporal-ra-workpack-001` assignment when the shared backend is enabled,
  so RAs do not accidentally load the full task map from the bare URL.
- Clarified that the Google sign-in button shows the account already signed
  into the current browser, so RAs should choose or switch to their invited
  account if a different name appears.
- Updated `urllib3` in `uv.lock` from 2.6.3 to 2.7.0 to address the current
  Dependabot security alerts for urllib3.
- Enabled the hosted Convex-backed NZ assignment client for
  `placesmap.org`, using the public Convex deployment URL and public Google
  OAuth client id.
- Deployed the Convex task backend and seeded
  `nz-temporal-ra-workpack-001` with 50 open tasks for the first RA web
  assignment.
- Added pending Google-authenticated project invitations for the NZ pilot
  admin/reviewer and RA accounts.

### 2026-05-13

- Added a configuration-gated Convex bridge to the NZ verification map:
  Google sign-in panel, shared task-state refresh, `Save draft`, `Submit for
  review`, and backend `Skip this task` actions.
- Added the first 50-case Convex-backed web assignment path:
  `?batch=nz-temporal-ra-workpack-001` loads only that assigned batch, disables
  spreadsheet copy/paste for the assignment, and saves drafts/submissions to
  the shared task backend.
- Added `scripts/build_convex_workpack_seed.py` to turn the reproducible New
  Zealand temporal workpack into a deterministic Convex seed payload.
- Added a disabled-by-default public `convex-config.js` and browser task
  client so the static map can be enabled after hosted Convex auth, invites,
  and task seeding are ready.
- Guarded Convex bootstrap mutations with a deployment setup token and updated
  setup guidance so the first hosted admin/RA invites cannot be created
  anonymously.
- Added the real Convex Google OpenID Connect auth config, using the deployment
  `GOOGLE_CLIENT_ID` environment variable rather than a committed client id.
- Added a Convex capacity and plan-trigger model: start on Free, move to
  Starter only on quota pressure, and reserve Professional for backups, logs,
  support/compliance needs, or sustained high usage.
- Tightened the Convex task-layer spec with country-config, schema-version,
  OSM-as-evidence, rate-limit, kill-switch, and Sheet/Convex transition rules.
- Fixed local fallback state so a failed clipboard write no longer marks a task
  tentatively closed, and namespaced local session exports by country and RA
  initials.
- Updated RA-facing guidance to make backend save/submit the preferred
  workflow and spreadsheet copy/paste the fallback path.
- Added `research/vanuatu-case-analysis.md` as the first Vanuatu source-first
  country protocol, with 1989/1999/2009/2020 target years and lifecycle dates
  accepted from 1600 onward.
- Recorded Guy as the research assistant for the first Vanuatu source-first
  pass.
- Updated planning, roadmap, FAQ, Convex task-layer, and RA template guidance
  so target years are country-specific rather than treated as globally fixed
  New Zealand fields.
- Generalised the verification-map target-year controls behind a small country
  config while preserving the New Zealand 2013/2018/2023 defaults.
- Added a private André handoff draft for the existing New Zealand temporal RA
  workpack, keeping the shared Sheet link out of public docs.

### 2026-05-10

- Added `docs/system-map.md` to organise the project as deep modules with clear
  ownership, interfaces, and tactical task homes.
- Added system-map links from the README, roadmap, planning, and agent
  guidance.

### 2026-05-09

- Added a reproducible New Zealand temporal RA workpack builder that selects a
  first 50-record pilot set from the generated OSM date-tag and temporal
  places-to-check files.
- Documented the workpack selection rule, generated outputs, SHA-256 check, and
  RA use pattern in `docs/development/nz-temporal-ra-workpack.md`.

### 2026-05-08

- Added `BRAINSTORMING.md` for tool and architecture ideas still being weighed,
  including Graphite, JSON diff/tree rendering libraries, Convex boundaries,
  PostGIS, and Rust-first web UI options, with migration-path notes.
- Added a separate tracked `raw_source` manifest for the New Zealand
  2013-2025 raw OSM/ohsome annual snapshot archive stored in project Google
  Drive.

### 2026-05-07

- Recorded the New Zealand temporal-reconstruction pilot decision: RAs should
  contact church bodies and review only curated, cleaned OpenStreetMap lists of
  places to check, not raw annual OSM differences.
- Added a current-data-flow chart and inventory explaining where the already
  ingested OSM and NZ Census-linked files live, separating committed NZ app
  data from ignored temporary working outputs, plus a current-action checklist
  for promotion, audit, or disposal.
- Added the first tracked data manifest for the New Zealand 2013-2025 OSM
  places-to-check archive stored in project Google Drive.
- Added a dated Convex pricing snapshot to the storage and task-map planning:
  start the one-RA pilot on Free/Starter if possible, consider Professional
  only for backups/logs/support or usage limits, and keep raw snapshots,
  media, accepted diffs, and public products outside Convex.
- Added `docs/data-storage-pipeline.md` to make ignored generated files
  temporary working files only: reusable datasets now require durable
  project-controlled storage plus tracked manifests with checksums, counts,
  provenance, and licence/privacy status.
- Added `schemas/data-manifest.schema.json` and updated the manifest templates
  for hash-backed dataset versions, country/global partitions, supersession, and
  durable-file checksums.
- Documented accepted diffs as primary longitudinal data: losses, gains,
  target-year states, density changes, and appeared/disappeared map layers must
  be derived from accepted change events and accepted-diff manifests.
- Documented how OSM opening and closure date tags, such as `start_date`,
  `old_start_date`, and `end_date`, can seed provisional target-year statuses
  and gain/loss tasks, while accepted events remain the longitudinal data.
- Added an FAQ entry explaining how OSM date tags can indicate whether a
  place of worship may have been alive at 2013, 2018, or 2023.
- Added a journal data-workflow graph and storage/action decision tree covering
  the shared online task map/list, project Drive working files, Google Cloud
  Storage durable artefacts, deferred PostgreSQL/PostGIS, and `pow`
  accepted-event outputs.
- Updated planning and storage guidance with the account and pricing checks
  needed before enabling Convex, Google Cloud Storage, or queryable geospatial
  staging.
- Clarified that temporary working files mean ignored, disposable, recomputable
  run output only; reusable datasets need named non-local project locations
  such as Drive file IDs, cloud storage paths, or database names.
- Reworded the OSM temporal workflow docs in plainer terms: the generated
  files are lists of places to check, such as places present in one OSM year but
  not another or places with OSM opening/closure date tags.
- Replaced ambiguous workflow labels with concrete terms such as OSM date tags,
  shared online task map/list, reviewer download, file set, and cloud storage
  path.
- Added `LEXICON.md` as a plain-language glossary for project reporting,
  RA-facing docs, diagrams, and future agent work, and linked it from the
  README and agent guidance.
- Clarified that `JOURNAL.md` is public-facing project history and rewrote the
  grant-reference entry to avoid internal agent-style wording.
- Renamed the OSM date-tag places-to-check output to
  `nz_osm_date_tag_places_to_check.csv`/`.geojson` and renamed the RA source
  type value to `osm_date_tags`.
- Clarified provider planning so Cloudflare is not part of the active storage
  path unless that choice is explicitly reopened.
- Extended the temporal OSM places-to-check generator to use annual `1 September`
  snapshots from 2013 through 2025 by default, while retaining 2013, 2018, and
  2023 as highlighted New Zealand RA/research task years.
- Recorded the first strict national annual OSM run: 4,777 local candidate rows
  from the ignored 2013-2025 node/way extraction, confirming the direct ohsome
  route is viable but needs a smaller reviewer-selected task set before RA
  review.
- Added the first `scripts/build_nz_osm_temporal_candidates.R` workflow to
  fetch dated New Zealand OSM snapshots through ohsome, apply the existing
  project cleaning rules to each snapshot, and emit candidate CSV/GeoJSON diffs
  for maintainer inspection before RA review. The strict default now starts
  with `amenity=place_of_worship` and node/way objects; broader tags and
  relation geometry are explicit slower options.
- Extended the NZ temporal OSM workflow to emit CSV/GeoJSON files listing
  places with OSM opening or closure date tags, including raw tags, parsed date
  bounds, provisional target-year statuses, possible gain/loss windows, parser
  warnings, and reviewer instructions.
- Reran the cached strict New Zealand temporal OSM extraction locally after the
  OSM date-tag update: 4,777 year-difference rows and 1,438 date-tag rows, with
  35 possible gain windows and no date-tag-derived loss windows.
- Added maintainer-facing notes for the NZ OSM temporal-cleaning workflow and
  updated the near-horizon plan and roadmap to put cleaned OSM places-to-check
  files and church-body record requests ahead of RA verification.

### 2026-05-03

- Added the initial Convex task-map backend scaffold: package scripts, project
  config, schema tables for users/tasks/task events/evidence drafts/reviews/
  exports, role-checked functions for shared task status and manual candidate
  tasks, a static NZ task seed builder, and maintainer setup notes.
- Ran the first local Convex task-map backend smoke test: generated Convex types,
  bootstrapped a local admin identity, seeded five NZ tasks, created a manual
  candidate task, saved/submitted/reviewed an evidence draft, and froze an
  export file set.
- Added hosted-pilot onboarding support for Convex: a one-time pending-invite
  bootstrap mutation and Google OpenID Connect auth configuration example,
  so real users can claim project roles with their own identities.
- Added `docs/convex-task-layer-spec.md` as the implementation contract for the
  live RA/reviewer task map: Convex-owned task status, evidence drafts,
  review decisions, event logs, reviewer exports, and the export boundary to
  `pow`.
- Removed implementation-facing command-line references from the RA pilot task
  guide so the first-pass instructions stay focused on the map and shared
  working Sheet.
- Updated portal and task-map planning to make Convex the preferred near-term
  backend spike for shared RA/reviewer task status, while keeping accepted
  events, master rebuilds, and public map exports outside Convex.
- Defined opening, closure, and change-date evidence in RA-facing guidance and
  clarified that missing-place candidates may already exist in OSM; OSM ids
  should be recorded as source or matching evidence, not treated as project
  site ids.
- Added optional opening/closure/later-change fields to the NZ verification map
  so RA rows can capture source-backed dates outside 2013/2018/2023, including
  site opening, closure, first/last seen, relocation, demolition, and later
  shared-use or multi-denominational changes.
- Clarified that RAs should leave missing cells blank rather than entering
  `NA`/`N/A`, documented accepted date formats as `YYYY`, `YYYY-MM`, or
  `YYYY-MM-DD`, added map-side date checks for source/capture dates, and made
  `pow validate` reject common missing-value placeholders.
- Documented how RAs should avoid accidental duplicate work during the NZ
  pilot: local map badges are browser-only, the shared Sheet is the durable
  pilot record, multiple rows for one place are allowed when they carry
  different evidence, and the target design needs a shared provisional task
  store outside the master database.
- Updated the NZ verification map action builder to keep RAs on the map after
  copy/skip actions, mark copied tasks as tentatively closed in the local
  session, and expose controlled fields for existence status, worship-use
  status, assessment confidence, site-match confidence, and location
  confidence.
- Clarified the NZ verification map's missing-site prompt by adding an
  `Open draft nomination form` button and renaming the sidebar panel so RAs
  are not pointed to an ambiguous "form above".
- Clarified the RA session JSON export as a local reconstruction/debug log,
  changed active RA-facing instructions from "the project team" to "JB", and
  tightened the NZ place-density colour domain so low per-km² values render
  visibly on the map.
- Added a first-session briefing and post-session capture protocol to
  `docs/ra-nz-pilot-task.md`, including 5-10 varied demo-map cases, paste
  alignment checks, session JSON export, and five feedback questions.
- Treated `site_evidence_wide` header order as a data contract: protected the
  live Sheet header with an edit warning, clarified paste instructions, added a
  FAQ entry, and made `pow validate` reject known-template header reordering.
- Simplified `docs/ra-nz-pilot-task.md` so the current RA instruction is to
  sample varied tasks from the demo map rather than complete a fixed 50-row
  pilot batch.
- Added a second README pointer to `FAQ.md` near the project orientation links.
- Clarified the identity conflict process: accepted user-nominated sites keep
  durable project `site_id` values, later OSM matches attach as source
  identifiers after review, and conflicts become proposed change events rather
  than direct master overwrites.
- Added `FAQ.md` as a plain-language guide to site identity, candidate ids,
  OSM conflicts, RA spreadsheets, task generation, staged review, and visual
  evidence.
- Moved CLI and staging support docs into `docs/development/`, removed the CLI
  tutorial from the default RA task path, and added planning notes for
  UI-generated new PoW nominations and explicit 2013/2018/2023 evidence
  capture.
- Clarified that RA working spreadsheets should be project-owned Google Sheets,
  with later automated provisioning from a locked project template rather than
  RA-owned copies.
- Added `scripts/build_ra_working_sheet.py` to build the multi-tab RA working
  workbook from the repository templates for native Google Sheets import,
  including frozen headers, filters, and main-tab controlled-field dropdowns.
- Added `field_observation` to the RA evidence vocabulary and documented
  street-level imagery providers, capture dates, and RA field observations as
  explicit visual evidence sources.
- Updated the NZ verification map action builder to capture source provider,
  source/capture date, Street View or other street-imagery sources, and field
  observation rows without silently falling back to OSM as evidence.
- Added a selected-site task brief to the NZ verification map demo. The detail
  panel now turns priority, suggested action, target year, and automated checks
  into a concrete RA checklist before the findings form.
- Defaulted the NZ verification map to demo mode while the RA action builder
  is the only functional state. The page now lands with the action builder,
  session log, and nomination controls available; appending `?demo=0` opts in
  to the read-only feedback view that will become the default once secure
  staging exists. Updated the NZ README and RA pilot task doc to point at the
  bare URL as the canonical demo entry and to document the `?demo=0` opt-out.
- Added a Tier 2 self-audit and recovery layer to the NZ verification map
  demo: an RA-initials prompt and badge persisted at
  `localStorage.pow_ra_initials` and stamped on emitted evidence rows; a
  client-side session log at `localStorage.pow_ra_session_v1` capturing every
  copied or skipped task with the full TSV; a collapsible "My session" panel
  in the sidebar with re-copy, open-task, export-JSON, and clear-session
  controls; a Skip task collapsible with optional reason; and
  tentatively-closed/skipped status pills on the sidebar task list.
  All client-side; no schema or backend changes.
- Added a Tier 1 ergonomics pass to the NZ verification map demo: a numbered
  4-step indicator (Inspect, Decide, Evidence, Copy row) at the top of the
  detail panel; a reordered detail panel so the action builder sits directly
  below the source links; a dismissable quickstart banner explaining the
  6-step workflow; an explicit "Use OSM URL" button so the source URL no
  longer auto-fills with the OSM record itself; clearer post-copy clipboard
  guidance; larger body, label, input, button, and link fonts with primary
  buttons at least 44 to 48 pixels tall; and removal of the fragile
  note-overwrite heuristic so action changes never overwrite a touched note.
- Shortened the public README, added a direct roadmap link, and removed the
  detailed OpenStreetMap editing instructions while retaining OpenStreetMap
  attribution and contribution-status guidance.
- Updated the roadmap and planning notes after the `pow diff` v1 merge so the
  next priority is the minimal save/evaluate/review loop rather than the
  completed diff groundwork.
- Added `pow propose --persist` so emitted draft change events are written
  back into the local staging database as a derived batch linked to its
  source via `stage_batches.parent_batch_id`, and added `pow diff <batch_id>`
  reviewer report (text and JSON) covering per-site changesets, per-target-year
  transitions, validation warnings, and source coverage. Migration is
  idempotent for existing `.pow/staging.sqlite` files.
- Added `ROADMAP.md` as a directional phase map for the project and simplified
  `AGENTS.md` so future agents can find the roadmap, active planning, decision
  log, schemas, revision CLI docs, RA templates, verification plan, and portal
  plans quickly.
- Revised the roadmap and planning notes to pair evidence governance with
  research outputs, and recorded that web-based data management is deferred
  while the `pow` CLI, local staging, diff reports, and R-readable exports are
  stabilised first.
- Extended `change-event.schema.json` with pre-release worship-function event
  payloads for appeared/disappeared worship use, multi-denomination,
  multi-purpose use, organisation-site links, split/merge cases, and
  target-year effects, plus fixtures and CLI tests for the new contract.
- Scoped the first `pow diff` milestone to a reviewer report derived from staged
  events, with reconstructed snapshots, area summaries, density estimates, and
  map/export effects deferred to `pow rebuild-master` and export commands.
- Added an RA-facing CLI tutorial for validating and staging exported evidence
  CSV batches without editing repository templates or changing the public map.
- Added the first `pow propose` bridge and mapping contract for translating
  staged RA evidence rows into draft change-event JSONL before `pow diff`,
  including a golden CSV-to-JSONL fixture.
- Expanded the RA CLI tutorial into a step-by-step walkthrough with
  screenshot-style figures and explicit instructions not to submit pull
  requests, edit repository templates, or run staging/proposal steps without a
  project-team request during the pilot, plus a plain-language overview of the
  project aim and RA role. A fixture-based demo pass now aligns the tutorial
  with actual Cargo, validation, staging, and proposal output.
- Added `docs/ra-map-triage-guide.md` to give RAs step-by-step instructions for
  missing sites, duplicate records, disappeared sites, complicated worship
  functions, NZ priority tasks, and the intended 2013/2018/2023 map workflow.
- Added provisional 2013/2018/2023 target-year controls to the NZ verification
  map, colouring markers by target-year status derived from reviewed status
  fields where available and otherwise from OSM date tags.
- Added a no-save RA action builder to the NZ verification map demo so selected
  tasks can produce a spreadsheet-ready evidence row and review JSON locally
  while secure authenticated staging remains future work.
- Added `docs/ra-nz-pilot-task.md` as the current RA-facing New Zealand web
  pilot tutorial, making the pilot map-first, time-bounded, and focused on a
  mixed validation batch rather than CLI-first data entry.
- Clarified for RAs that the map demo does not save work: pilot evidence is
  saved in the shared working spreadsheet, with CSV export from that sheet only
  when requested.
- Removed the repository contributor guide while development remains
  single-maintainer.
- Recorded the repository governance baseline: keep the repo public, disable
  GitHub Issues/Discussions/Wiki during the pilot, and protect `main` against
  force-pushes and deletion while allowing direct maintainer commits.
- Added the first Rust `pow` CLI scaffold with `validate` and `stage` commands
  for RA evidence CSVs and staged revision JSON/JSONL files, including
  schema-backed change-event and geometry-history validation,
  controlled-vocabulary checks, date/coordinate/probability checks,
  replay-safety checks, text/JSON reports, and a local SQLite staging store.
- Added `docs/development/revisions-cli.md` and a small NZ sample change-event
  batch to document how the local CLI relates to later map/API staging
  ergonomics.
- Recorded journal decisions that the edit/review maps should submit through an
  authenticated API rather than call the CLI directly, and that the first
  staging store should use SQLite-compatible tables while Turso remains a later
  evaluation candidate.
- Clarified in planning and the journal that functional changes in worship use
  are first-class analytical data: appeared/disappeared target-year states,
  denomination changes, multi-denomination, multi-purpose use, and split or
  merged worship uses must be preserved separately from building existence.
- Tightened `change-event.schema.json` so `event_type` discriminates the
  required `payload.payload_type` and the allowed `event_intent` via top-level
  `if/then` rules; added `name_update` and `structure_created` payloads so the
  full `event_type` enum has a coupled payload; promoted `Status` to `$defs` in
  `site.schema.json` and `structure.schema.json` and referenced the site
  variant from `SiteCreatedPayload.status` and `StatusPayload.{previous,new}_status`,
  and the structure variant from `StructureCreatedPayload.status`; removed the
  duplicated `taxonomy_version` from `DenominationPayload` so the top-level
  field is authoritative; and added a `^[a-z][a-z0-9._-]*$` pattern on
  `denomination_code` pending the taxonomy schema.
- Moved heavy Python packages out of the default `uv` environment into explicit
  `api`, `fast-parquet`, and `legacy` extras, and documented the narrower Python
  scope.
- Updated Python API dependencies to clear Dependabot alerts for `geopandas`
  and `starlette`, including the FastAPI bump required by the patched Starlette
  release.
- Merged the revisions-pipeline critique and added initial change-event and
  geometry-history schemas for RA-submitted location and denomination revisions.
- Recorded the identity-on-relocation rule: `site_id` tracks the mappable place,
  while congregations that move to materially different places are linked through
  relocation events and organisation evidence.
- Added a portal data-entry planning hub and focused UI, database/storage,
  submission-review, auth/security, media, and provider-evaluation plans for the
  first authenticated New Zealand staging pilot.
- Recorded Google Cloud as the first portal backend baseline, with Google
  OAuth/Identity Platform, Cloud Run, Cloud SQL/PostGIS, Cloud Storage, no direct
  master writes, GitHub only as an audit mirror, and Convex/SpacetimeDB deferred
  until contracts are stable.
- Added planning and journal notes for a Rust-backed data-modification pipeline
  that governs validation, staged proposals, append-only change events, dry-run
  diffs, master rebuilds, and researcher-friendly exports while keeping R as the
  investigator-facing analysis layer.
- Made the NZ verification demo-entry path more visible by linking to demo mode
  from the read-only page and showing an initial mock-entry preview panel before
  a task is selected.
- Renamed the visible NZ verification action label from "Review when sampling"
  to "Spot-check in sample" while preserving the stored
  `review_when_sampling` value.
- Fixed the NZ verification popup `Open task` control so it binds through the
  app code and focuses the sidebar task detail instead of relying on an inline
  handler.
- Added an explicit `?demo=1` mode for the NZ verification page so the RA can
  inspect draft decision and nomination controls while the default public page
  remains read-only and no demo data is saved or submitted.
- Recorded the decision to use a managed authentication service for future
  intake and audit workflows rather than implementing password or session
  handling in the project.
- Added security and trust-boundary requirements for any future data intake
  path, including authentication, permissions, rate limits, upload controls,
  quarantine, validation, privacy/licence checks, abuse handling, and audit
  logs.
- Made the public NZ verification feedback pilot read-only until secure staging
  exists.
- Added `JOURNAL.md` as a decision log for methodological and architectural
  choices that need rationale beyond the release changelog.
- Disabled clustering on the NZ verification map so RA review shows individual
  candidate points by default.
- Ignored the local Darbyshire thesis PDF and noted that congregation-rich
  historical sources without addresses may later support fuzzy regional
  placement or uncertain back-propagated maps.
- Switched the NZ verification map to a greyscale basemap and added staged
  nomination controls for current places missing from OSM, lost target-year
  places, denomination/building complications, and charity-record site matching.
- Added a static NZ OSM verification map and generated
  `verification_tasks.geojson` layer so reviewers can inspect current master
  sites against OSM links, automated checks, priority filters, and copyable
  staged review decisions.
- Added `docs/master-verification-workflow-plan.md` to plan read-only master
  site data files, automated verification checks, review queues, staged decisions,
  agent-readable data dumps, and map verification layers for NZ and global
  scale.
- Added RA-facing historical site evidence CSV templates in
  `docs/templates/ra-historical-site-evidence/` for Google Sheets import,
  including source metadata, site observations, candidate matches, review notes,
  controlled vocabularies, and privacy/licence instructions.
- Added a wide RA evidence-entry template with first-class opening/closure/change date
  fields for founding, opening, first seen, last seen, closure, demolition,
  change of use, relocation, and target-year status checks.
- Added a normalised opening/closure/change-event CSV scaffold for later
  ingestion once the wide RA entry sheet is split into backend tables.
- Added historical-address and geocoding-basis fields to the RA evidence
  templates so changed streets, renamed localities, demolished buildings, and
  uncertain modern matches can be reviewed explicitly.
- Added bounded origin and closure date fields so sources that establish
  "not earlier than" or "not later than" evidence can be recorded without
  inventing exact dates.
- Added OpenStreetMap date-tag, visual-verification, and target-year
  probability fields to support later temporal verification of 2013, 2018, and
  2023 place existence.
- Added `docs/community-ingestion-api-plan.md` to plan Google Sheets, web,
  bulk-upload, API, and AI-agent contribution paths through staging,
  validation, review, adjudication, and master ingestion.
- Added a proposed ingestion spec for historical NZ place-density evidence so
  research assistants can source data while the pipeline preserves manifests,
  site-observation fields, review states, privacy checks, and aggregation rules.
- Added a planning note on the problem of reconstructing true 2013 and 2018 NZ
  place density, including evidence-tiered source paths through OSM history,
  Charities Services, Incorporated Societies, LINZ building/property data, and
  denominational or local records.
- Added a planning rationale for the first NZ `area_summary_ta.json` frontend
  wiring, documenting why overlays now consume a provenance-rich analytical
  product rather than browser-derived legacy census tables.
- Added a planned NZ interface-alignment pass so the regional map can adopt
  the global map's basemap, control, legend, popup, and attribution style after
  the area-summary overlay stabilises.
- Wired the New Zealand territorial-authority map overlay to
  `area_summary_ta.json`, including census-year controls, area-summary metrics,
  and denominator/source/boundary/quality context in popups and legends.
- Defaulted the global map on `placesmap.org` to the MapTiler Backdrop basemap
  when available, with CARTO retained as the fallback.
- Made `AGENTS.md` the canonical repo-local agent guidance and removed the
  repo-root `CLAUDE.md` symlink.
- Added the first New Zealand territorial-authority `area_summary` contract,
  generator, and static JSON/CSV outputs for portal layers and downloads.
- Added JSON Schemas for `source_dataset`, `indicator`,
  `indicator_observation`, `visual_layer`, and `area_summary`.
- Added 2023 Census religious-affiliation data to the New Zealand territorial
  authority workflow while preserving 2013 and 2018 snapshots.
- Added grant-aligned planning notes and a versioned `research/` workspace for
  global country-source feasibility audits.
- Ignored local `grant/` materials while allowing lightweight `research/` notes
  to be tracked.
- Reworked the top of `README.md` to better describe the project as a research portal in development, fixed external-facing wording errors, and moved OpenStreetMap editing guidance lower in the document.
- Added a planning note that `extendr` is the preferred optimisation path for future R bottlenecks, rather than rewriting the research pipeline away from R.
- Ported the global cleaning, deduplication, and review-queue stages to R as `scripts/clean_global_places.R`, `scripts/deduplicate_global_places.R`, and `scripts/build_global_review_queue.R`.
- Confirmed R-stage parity on the existing NZ `undated` snapshot: `4,632` cleaned records, `0` deduplicated removals, and `1,438` queued records.
- Marked the R scripts as the canonical research-facing global pipeline, with the equivalent Python scripts retained only as transitional references.
- Added a root `pyproject.toml`, `.python-version`, tracked `uv.lock`, and a `uv`-managed Python dependency workflow for scripts and the API.
- Removed the incompatible explicit `starlette` pin from `api/requirements.txt` and the new `pyproject.toml`, allowing `fastapi` to resolve a compatible version.
- Moved `pyarrow` to an optional `fast-parquet` extra because it is only used as an optional API fast path and does not currently build cleanly in the default Python 3.14 environment.
- Added `scripts/deduplicate_global_places.py` as a conservative global deduplication stage between cleaning and review-queue generation.
- Updated `scripts/build_global_review_queue.py` to consume deduplicated country outputs when present, while still falling back to cleaned outputs.
- Added `scripts/clean_global_places.py` for conservative deterministic cleaning of normalised global country datasets and `scripts/build_global_review_queue.py` for per-country review queues.
- Added the first global intermediate outputs from the existing NZ normalised snapshot:
  - `data/intermediate/global/undated/nz_places_cleaned.json`
  - `data/intermediate/global/undated/nz_places_deduplicated.json`
  - `data/intermediate/global/undated/nz_duplicate_resolutions.json`
  - `docs/review_queues/undated/nz_review_queue.csv`
  - `docs/review_queues/undated/nz_review_queue.md`
- Recorded the first strict deduplication test result for NZ: `0` records removed from `4,632` cleaned records, indicating that the current rules are not collapsing co-located but distinct congregations.
- Refactored `scripts/extract_global_data.R` into a raw extractor and added `scripts/normalize_global_places.R` as the first explicit global normalisation stage.
- Added an audit of `scripts/extract_global_data.R` and a staged draft workflow for global extraction, cleaning, review queues, and publication.
- Clarified that countries, including NZ, may have multiple coexisting boundary tessellations that are not strictly nested.
- Added proposed NZ pilot defaults for fixed-boundary comparison outputs, hybrid site matching, and the minimum country download contract.
- Added a country backend scheme and decision log for country-specific downloads, area assignment, and temporal tracking.
- Set `1 September` as the planning anchor date for annual longitudinal snapshots and noted Google Drive as temporary holding rather than the long-term record.
- Rewrote `PLANNING.md` as the active redevelopment roadmap and planning source of truth.
- Marked `docs/data-pipeline-architecture.md` as technical reference rather than the active roadmap.
- Added `docs/nz-data-cleanup-audit.md` to record the first NZ false-positive cleanup pass.
- Added `docs/nz-manual-review-queue.md` and `docs/nz-manual-review-queue.csv` for ambiguous NZ records that need human review.
- Applied a second NZ cleanup pass to remove low-information placeholder and generic worship-label records.
- Applied a third NZ cleanup pass to remove seven `Masonic Centre` records from the `hall_centre_house_site` review bucket.
- Applied a fourth NZ cleanup pass to remove church-hall and parish/community-centre support buildings that duplicated nearby mapped churches.
- Applied a fifth NZ cleanup pass to remove generic hall support buildings that duplicated nearby mapped churches, plus one `Masonic Hall` false positive.
- Applied a sixth NZ cleanup pass to remove weak generic centre records that duplicated nearby mapped worship sites.
- Rebuilt `apps/regions/nz/data/ta_aggregated_data.json` from official TA boundaries and Stats NZ religion data.
- Removed NZ frontend TA code remapping now that TA keys align with official boundary codes.
- Added a conservative NZ place-cleaning script and removed obvious non-worship records from published NZ datasets.
- Added a review-queue generator for staged NZ manual cleanup work.
- Tightened the legacy OSM extractor to reject obvious non-worship facilities with weak religious tags.
- Clarified NZ inclusion scope in `README.md`, including Chatham Islands coverage and current exclusions.
- Introduced `apps/global` and `apps/regions/nz` structure for frontends.
- Added legacy URL shims for `/`, `/enhanced-places.html`, and `frontend/` + `src/` paths.
- Added root `PLANNING.md` and consolidated planning notes.
- Added README guides for `apps/`, `apps/regions/nz/`, `data/`, `scripts/`, and `schemas/`.
- Aligned deployment strategy doc with the current static + tile server architecture and Rust plan.
- Added an operations runbook for GitHub Pages + Martin tile server workflows.
- Expanded the runbook with a step-by-step tile refresh guide and a forensics checklist.
- Redacted DNS record values in the runbook and replaced them with placeholders.
- Added a git-ignored `ops/private-ops-notes.md` template for sensitive details.
- Documented current data storage locations and an auditable tracking plan.
- Added an OSM snapshot/diff strategy to the data storage plan.
- Added JSON templates for snapshot and diff manifests.
- Consolidated planning content into `PLANNING.md` and reduced `docs/data-storage.md` to inventory-only.
- Noted `PLANNING.md` as the single planning source in `README.md`.
- Allowed `apps/regions/**/data` to be tracked and prepared NZ data files for deployment.
- Tracked NZ boundary GeoJSON files in `apps/regions/nz/data` to fix 404s.
- Updated Enhanced NZ data pipeline scripts to emit into `apps/regions/nz/data` while preserving legacy outputs.
- Switched global map Enhanced NZ link to a relative path for local and production parity.
- Made Enhanced NZ data loading resilient to `/apps/regions/nz/` and legacy URL entry points.
- Normalised coordinates from vector tiles to restore Street View links at low zoom.
- Added a Rust migration plan for data ingestion + API in `PLANNING.md`.
- Added a draft decision log section to `PLANNING.md`.
- Added an initial open decision entry for the Rust feasibility test (aka 'Spike').
- Added decision placeholders for regional data storage and portal adapter strategy.
- Renamed Enhanced NZ app path to `apps/regions/nz` for scalable regional naming.
- Removed root-level NZ data files and legacy `src/` data copies (now only in `apps/regions/nz/data`).
