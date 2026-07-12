# Cabo Verde census religion route probe

Verified 2026-07-12. The Instituto Nacional de Estatística de Cabo Verde (INE, `ine.cv`) publishes religion **by concelho** as a count-valued cross-tab for **two** census waves — **2010 and 2021** — across the 22 concelhos (municipalities), for the resident population aged 15 and over. The queue premise ("2010, 2021 | municipality | voluntary census religion or spirituality for residents aged 15+ | browser work | audit A row | probe then build") holds on every count: two waves, municipality geography (concelho, 22 units), the voluntary religion/spirituality question asked of residents 15+, and browser work. It is refined only on the shape of the two sources — the 2010 concelho religion table sits in the national "Cabo Verde em Números" workbook (Tabela 12), while the 2021 concelho religion tables sit in 22 separate per-concelho "Quadros por Concelho" workbooks (Tabela 54); the 2021 national workbook publishes religion only at the national level. Both waves reconcile integer-exact at both margins to the published national 15+ totals (336,049 in 2010; 352,494 in 2021). The concelho frame is stable across the two waves (all 22 concelhos existed in 2010 and 2021; Calheta de São Miguel was renamed São Miguel, same territory), so this is a genuine two-wave time series on identical geography — a strong case under the WAVES-OVER-DISTRICTS priority. The boundary route is clean: geoBoundaries CPV ADM1 records a stated Open Data Commons Open Database License 1.0 over the 22 concelhos, which join the census one-to-one by name. The licence gate is the one open item: INE publishes no explicit open-data reuse licence and asserts no explicit all-rights-reserved copyright; its Política de Difusão states that published statistics are freely and universally accessible at www.ine.cv, and statistical confidentiality protects only individual microdata. The product therefore ships under the standing BUILD-THEN-ASK ruling with attribution to INE, a courtesy reuse ask recorded for the PI, and licence_status needs_review.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILT. A 22-concelho, two-wave (2010, 2021) religion/spirituality series. The subnational bar is cleared strongly — two waves, 22 concelhos, count-valued, integer-exact reconciliation in every wave, on a stable frame.
- **Waves and sources**:
  - **2010**: 2010 Census "Cabo Verde em Números" national workbook, sheet `Relig_3` = Tabela 12, "População residente com 15 anos ou mais segundo a religião por sexo e concelho" — integer counts, 14 categories, 22 concelhos plus the national row. Every concelho column and every religion row reconciles to the printed national total exactly (national 336,049; Católica 259,723; Sem religião 36,272).
  - **2021**: 2021 Census "Quadros por Concelho" workbooks (22 files, one per concelho), sheet `RELIGIÃO_1` = Tabela 54, "População residente no concelho ... com 15 anos ou mais segundo religião ou espiritualidade pelo meio de residência e o sexo" — integer counts, 15 categories. The 22 concelho totals sum to the national 352,494 exactly, and every category sums to the national Tabela 52 total exactly (Católica 255,511; Sem religião 54,814).
- **Geography**: 22 concelhos on geoBoundaries CPV ADM1 (22 units; one-to-one join by `shapeName`; the census concelho labels differ trivially by wave and are crosswalked to the boundary names in the builder).
- **Construct**: census affiliation — each resident's reported religion (2010) or religion/spirituality (2021), asked of the resident population aged 15+ as a voluntary question; not practice, attendance, or membership.
- **Slot design** (ordinary two-slot, BZ/SB/FM/KI precedent): `religious_affiliation_percent` = (population15+ − Sem religião − non-response) / population15+; `no_religion_percent` = the single "Sem religião" line / population15+. The non-response line (2010 "ND"; 2021 "Não sabe / Não respondeu") stays in the denominator and in neither slot, so the two shares need not sum to 100 (the BZ/Barbados/Belize precedent). Cabo Verde has a real, regionally-varying "Sem religião" category, so no minority-share (task-6) treatment applies.
- **Map-worthy pattern**: the secularisation gradient is the story and it is legible by concelho. The national no-religion share rose from 10.8% (2010) to 15.6% (2021). Urban São Vicente (Mindelo) is the most secular concelho by a wide margin — 30.9% no-religion in 2010, 38.2% in 2021 — while the rural Santiago interior concelhos remain near-universally religious (São Domingos 0.40% no-religion in 2010; São Salvador do Mundo 0.77% in 2021). Islam concentrates in the tourism islands (Sal, Boa Vista) and among the West African migrant population.
- **Rights position**: needs_review under BUILD-THEN-ASK. INE's Política de Difusão states free and universal access to published statistics; no explicit reuse grant was located. Ship derived concelho summaries with attribution to INE; an INE reuse-confirmation email is the clean courtesy unblock, recorded for the PI. The boundary carries a stated ODbL 1.0.

## Published waves and geography

| Year | Official route | Religion-by-concelho table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2010 | 2010 "Cabo Verde em Números" national workbook (XLS), sheet `Relig_3` | Tabela 12 "População residente com 15 anos ou mais segundo a religião por sexo e concelho" (integer, 14 categories) | resident population aged 15+ (336,049); voluntary religion question | 22 concelhos | Ship the 22-concelho 2010 wave. |
| 2021 | 22 "Quadros por Concelho" per-concelho workbooks (XLSX), sheet `RELIGIÃO_1` | Tabela 54 "... com 15 anos ou mais segundo religião ou espiritualidade pelo meio de residência e o sexo" (integer, 15 categories) | resident population aged 15+ (352,494); voluntary religion/spirituality question | 22 concelhos | Ship the 22-concelho 2021 wave. |

The 2021 national workbook (`CABO VERDE EM NÚMEROS - CORRIGIDO.xlsx`, sheets `RELIGIÃO_ESPIRITUALIDADE_1/2` = Tabelas 52/53) publishes religion only at the national level (by residence/sex and by age group), not by concelho; it supplies the national control totals against which the 22 per-concelho files reconcile. The 2000 census ("Características Socioculturais - Censo 2000") is a documented deeper-history wave, not probed for a concelho religion table in this pass.

## Category frames (preserved verbatim per wave; never merged across the instrument break)

| 2010 (Tabela 12, 14 categories) | 2021 (Tabela 52/54, 15 categories) | Role |
| --- | --- | --- |
| Católica | Católica | affiliation |
| Adventista | Adventista | affiliation |
| Igreja do Nazareno | Igreja do Nazareno / Protestante | affiliation |
| Assembleia de Deus | Assembleia de Deus | affiliation |
| Testemunho de Jeová | Testemunha de Jeová | affiliation |
| Racionalismo Cristão | Racionalismo Critão | affiliation |
| Universal do Reino de Deus | Universal do Reino de Deus | affiliation |
| Nova Apastólica | Nova Apastólica | affiliation |
| Deus é amor | Deus é Amor | affiliation |
| Islâmica | Islâmica / Muçulmano | affiliation |
| Judaica | Judaica | affiliation |
| (in Outra) | Jesus Cristo dos Santos dos últimos dias / Mórmons | affiliation |
| Outra | Outra | residual affiliation |
| Sem religião | Sem religião | no-religion |
| ND | Não sabe / Não respondeu | non-response |

Two frame facts govern comparability. The first frame fact is the instrument break: the 2021 frame splits "Igreja do Nazareno / Protestante" (2010 named only "Igreja do Nazareno"), adds "Jesus Cristo dos Santos dos últimos dias / Mórmons" as a separate line (folded into "Outra" in 2010), renames "Islâmica" to "Islâmica / Muçulmano", "Testemunho de Jeová" to "Testemunha de Jeová", and "ND" to "Não sabe / Não respondeu", and the construct name changes from "religião" (2010) to "religião ou espiritualidade" (2021). Fine-category change is therefore not asserted across the break; the headline no-religion and affiliation shares are comparable across the two waves. The second frame fact is spelling: the 2021 per-concelho workbooks carry trivial spelling variants (some print "Racionalismo Cristão" and "Últimos Dias" where the national table prints "Racionalismo Critão" and "últimos dias"); the extraction is positional, so the counts are unaffected, and the national Tabela 52 spelling is the canonical rendered frame. The category spellings are transcribed exactly as printed, including the "Nova Apastólica" and "Racionalismo Critão" typos in the source.

## Universe and denominator

Each wave's religion-table denominator is the resident population aged 15 and over: 336,049 (2010) and 352,494 (2021). The religion/spirituality question is voluntary and asked only of residents 15+, so the denominator is the published 15+ population, not the whole resident population (491,233 in 2021). The build reads each concelho's counts within its own wave's 15+ denominator and never treats population growth as a religion change. The non-response line — "ND" (não declarado) in 2010, "Não sabe / Não respondeu" in 2021 — is a real published category inside the 15+ universe; it rides in the denominator and in neither headline share, disclosed on the quality flag, never redistributed or repaired.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **2010 (Tabela 12)**: the 22 concelho totals sum to the printed national 336,049; every one of the 14 religion categories sums across the 22 concelhos to its printed national total (Católica 259,723; Adventista 5,147; Igreja do Nazareno 5,644; Islâmica 6,008; Racionalismo Cristão 6,263; Sem religião 36,272; ND 2,570; …); and every concelho's 14 categories sum to its printed Total. Integer-exact at every margin, no cell suppression.
- **2021 (Tabela 54, 22 files)**: the 22 concelho totals sum to the printed national 352,494; every one of the 15 religion categories sums across the 22 per-concelho files to the national Tabela 52 total (Católica 255,511; Adventista 6,626; Igreja do Nazareno / Protestante 6,175; Islâmica / Muçulmano 4,616; Mórmons 3,565; Sem religião 54,814; Não sabe / Não respondeu 1,311; …); and every concelho's 15 categories sum to its printed Total. Integer-exact at every margin, no cell suppression.
- The build stops and records any failing row on mismatch; no value is allocated, inferred, imputed, rounded, or tuned.

National headline (2010): affiliation 297,207 (88.4%), Sem religião 36,272 (10.8%), non-response 2,570 (0.8%). National headline (2021): affiliation 296,369 (84.1%), Sem religião 54,814 (15.6%), non-response 1,311 (0.4%). The no-religion shares match INE's own reported figures (10.8% in 2010, 15.6% in 2021) exactly.

## Boundary source and licence

The boundary is [geoBoundaries CPV ADM1](https://www.geoboundaries.org/api/current/gbOpen/CPV/ADM1/). The release metadata records `"admUnitCount": "22"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wambacher"`, and — the load-bearing field, quoted verbatim — `"boundaryLicense": "Open Data Commons Open Database License 1.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`. The licence field is non-null, so the boundary route is accepted (the Guyana/Malaysia/Ghana OSM ODbL share-alike precedent; the unlicensed geoBoundaries releases are the ones rejected). The 22 `shapeName` values join one-to-one to the 22 census concelhos via a fixed name crosswalk (the census "S. Vicente"/"Calheta de S. Miguel" of 2010 and "São Vicente"/"São Miguel" of 2021 both map to the boundary "São Vicente"/"São Miguel"). The extent spans lon −25.4 to −22.7 E and lat 14.8 to 17.2 N, wholly within the standard frame and far from the antimeridian; no dateline handling is needed. The pin is commit `9469f09`.

## Licence position

INE publishes no explicit open-data reuse licence and asserts no explicit all-rights-reserved copyright over its statistical tables. The governing rights evidence, fetched and quoted verbatim:

- **INE Política de Difusão** (Dissemination Policy, PDF, principle 10, retrieved 2026-07-12, `bdmi.ine.cv/site_deploy_api/Uploads/…a23cdbcd….pdf`): "O acesso à informação estatística produzida pelo INE é tendencialmente gratuito e universal. Toda a informação estatística disponível em www.ine.cv, pode ser acedida gratuitamente." (Access to the statistical information produced by INE is generally free and universal; all statistical information available at www.ine.cv can be accessed free of charge.)
- **Statistical confidentiality** (same policy, principle 8, citing Lei n.º 48/IX/2019 do Sistema Estatístico Nacional, art. 10): the "segredo estatístico" clause "prevê a confidencialidade dos dados individuais e garante que os mesmos sejam usados, exclusivamente, para fins estatísticos" — it protects only individual microdata, which this aggregate product never touches.
- The data files themselves carry the source line "Fonte: INE, Censo 2010" / "Fonte: INE, Censo 2021".

The product is a derived aggregate summary (concelho religion shares) built from openly published aggregate tables, carrying attribution to INE, leaking no microdata. Under the standing BUILD-THEN-ASK ruling it ships with attribution; INE's own statement of free and universal access supports the derived-aggregate use. `licence_status: needs_review`; `licence_basis: ine_cv_attribution_build_then_ask`. An INE reuse-confirmation email is the clean courtesy unblock, recorded here for the PI (do not send). The boundary is ODbL 1.0 (attribution to OpenStreetMap contributors; the derived boundary ships share-alike under ODbL).

## Premise corrections (trust the record)

- **The premise holds on waves, geography, indicator, and route class.** Two waves (2010, 2021), municipality (concelho, 22 units), a voluntary religion/spirituality question for residents 15+, and browser work — all confirmed. This is one of the stronger audit-A rows: two count-valued waves on a stable subnational frame.
- **The 2010 and 2021 concelho tables live in different places.** The 2010 concelho religion table is Tabela 12 inside the single national "Cabo Verde em Números" workbook; the 2021 concelho religion tables are Tabela 54 inside 22 separate per-concelho "Quadros por Concelho" workbooks. The 2021 national workbook publishes religion only nationally (Tabelas 52/53).
- **The construct name evolves.** The 2010 census asks "religião" (Situação perante à religião); the 2021 census asks "religião ou espiritualidade". The queue's "religion or spirituality" phrasing matches the 2021 instrument.
- **The route is a JSON-API recovery, not a plain download nor a REDATAM tabulator.** The `ine.cv` site is an Angular single-page application that serves only a bare "INE" shell to WebFetch and to `curl`; the census workbooks are reached through the site's own JSON API (`bdmi.ine.cv/site_deploy_api/api`), whose `Census/content` and `GenericFile/GetFile` endpoints resolve the per-census "Quadros por Concelho" and "Publicações" content items to their `Uploads/…` XLS/XLSX files. The `censo_quadros` page content endpoint carries only zone cartography ("Zonas do Concelho de São Domingos"), not religion tables.
- **No explicit reuse licence exists; INE instead states free and universal access.** The queue implied an uncertain rights posture behind browser work. INE in fact publishes a Política de Difusão affirming free and universal access to published statistics, with confidentiality reserved for individual microdata. Licence needs_review under BUILD-THEN-ASK with attribution; an INE ask is the courtesy unblock.

## Retrieval record

Every cached input is under `data/raw/cv_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download. The `ine.cv` SPA 403s/shell-serves the automated fetch tool; downloads used `curl` with a browser user-agent against the `bdmi.ine.cv` file API, content verified.

| Cached input | Source | Format | SHA-256 |
| --- | --- | --- | --- |
| `cv_2010_national_cvnumeros.xls` | `bdmi.ine.cv/site_deploy_api/Uploads/…1c628c72….xls` (2010 Cabo Verde em Números national workbook) | xls | `97903fb3aa8e186c727bb4e003aaf6dfd3e7760355a94375a5adb111a702638f` |
| `cv_2021_national_cvnumeros_corrigido.xlsx` | `bdmi.ine.cv/site_deploy_api/Uploads/…9cb2b311….xlsx` (2021 Cabo Verde em Números - CORRIGIDO national workbook) | xlsx | `4d3c1758898f71ce9075b578bcacb7fe9884a267682ceda646b002c7cc31ba2e` |
| `cv_2021_quadros_<concelho>.xlsx` (22 files) | `bdmi.ine.cv/site_deploy_api/…GenericFile/GetFile?publicationType=censo` per Quadros por Concelho content item | xlsx | e.g. praia `2cb8cf39…`, brava `6105335c…`, sao_miguel `f67f38c1…` |
| `cv_ine_politica_de_difusao.pdf` | `bdmi.ine.cv/site_deploy_api/Uploads/…a23cdbcd….pdf` (INE Política de Difusão) | pdf | `02f92a16f7fb07894413fd9a46a7396eaa473fbdd492ece3010633f87cbc5d6f` |
| `geoBoundaries-CPV-ADM1.geojson` | `github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CPV/ADM1/geoBoundaries-CPV-ADM1.geojson` | geojson | `1f5178861c917ff24e9e66301dc02c4285e7b4b4a952d2e82c1835ff86dd72ba` |
| `gb_cpv_adm1_meta.json` | `www.geoboundaries.org/api/current/gbOpen/CPV/ADM1/` | json | `5d7be88120588e3cb85d1ec9b9114f8c21bd5b4efec6e7691953eb0503f08ae2` |

Also cached (context, not build inputs): the 2010 per-concelho "Cabo Verde em Números" workbook for Praia (an alternative source of the same 2010 concelho religion table, richer with urban/rural splits), and the 2010 sociocultural/gender analysis PDF.

## Blockers and held items

- **Licence** (needs_review, not a hard block under BUILD-THEN-ASK): no stated open-data reuse licence on the INE tables; the Política de Difusão states free and universal access, and confidentiality is reserved for individual microdata. Ships with attribution; INE courtesy ask recorded for the PI.
- **Cabo Verde open data portal unreachable** (recorded gap, not a block): `caboverde.opendataforafrica.org` (the ANDS/Knoema-style portal) sits behind a Cloudflare "Just a moment" interstitial that resists automated fetch; no CAPTCHA was completed. The census workbooks were recovered from the INE file API instead, so the portal is not needed.
- **Frame break** (documented): the 2010→2021 instrument break (added Mormon line, split Nazareno/Protestante, renamed Islâmica/Muçulmano and the non-response line, construct renamed to "religião ou espiritualidade"); fine-category change is not asserted, the headline no-religion/affiliation shares are comparable across both waves.
- **2000 census** (deferred): a documented deeper-history wave ("Características Socioculturais - Censo 2000"); not probed for a concelho religion table in this pass.
- **Age/residence detail** (deferred): both waves also publish religion by age group (2010 Tabela 11; 2021 Tabela 55) and by urban/rural residence and sex; only the concelho 15+ totals are shipped, the richer splits are documented and not used.
