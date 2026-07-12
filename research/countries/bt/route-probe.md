# Bhutan religious-institutions route probe

Verified 2026-07-13. PROBE ONLY — no build. **Verdict: BUILDABLE (register construct, annual per-dzongkhag counts of religious institutions and monuments) — the queue premise holds, and the companion census-affiliation route is refuted.** The National Statistics Bureau of Bhutan (NSB) publishes two annual per-dzongkhag products that carry the construct the queue names: the *Dzongkhag at a Glance* (DAG) fact sheets and the fuller *Annual Dzongkhag Statistics* (ADS). Each DAG dzongkhag sheet prints a "12. RELIGION & CULTURE" block with two clean indicators — **Religious institutions** and **Religious monuments** — in whole numbers, with a trailing three-year column set (the 2019 edition shows 2016/2017/2018). Each ADS dzongkhag booklet prints "Table 13.2 Number of Historical sites and Recreations", which disaggregates the same infrastructure into Dzongs (monuments), Government/Community/Private owned Lhakhang, and Chortens, with its own trailing year columns (the 2017 edition shows 2013-2016). Both are an **administrative register of religious infrastructure compiled by the Dzongkhag Administration**, never population affiliation — the Taiwan (TW) construct class. The census route does not compete: the 2017 Population and Housing Census of Bhutan (PHCB 2017) publishes **no religion table at any grain**; religion is not a census variable in Bhutan, and no affiliation layer exists to keep separate. The boundary is clean: geoBoundaries BTN ADM1, 20 dzongkhags, CC BY 3.0, names one-to-one to the NSB frame. Licence: the NSB site carries an all-rights-reserved footer with no reuse grant located — the build-then-ask family (Côte d'Ivoire / Montenegro / Sri Lanka line). One operational caveat dominates: nsb.gov.bt is unreachable from this environment (connection timeout to 43.230.208.104); every capture here therefore came through the Internet Archive Wayback Machine, and a build fetches through a reachable route.

## Routes assessed

Three routes were probed. The first two share the queue's register construct; the third is the census-affiliation route the task asked to assess separately.

**The first route is the Dzongkhag at a Glance (DAG) per-dzongkhag fact sheets.** This is the product the coverage audit cites. Each dzongkhag has its own DAG sheet, published in annual editions 2016 through 2023 (download categories `dzongkhag-at-a-glance-2016` … `-2023` on the NSB download portal). The Trashigang 2019 sheet (download id 4164) prints, verbatim:

```
12. RELIGION & CULTURE
(Nos.)                          2016       2017      2018
Religious institutions              8         8         8
Religious monuments                ...        5         5
Source: Dzongkhag Administration
```

A second dzongkhag sheet from the same edition (download id 4167) carries the same two rows ("Religious Institutions", "Religious Monuments"), confirming the block is a standing DAG feature, not a one-off. The two indicators are pre-aggregated whole counts; the DAG does not break them into lhakhang types. Grain: one sheet per dzongkhag (20 units). Wave depth: each edition prints a trailing three-year window; the 2016-2023 editions together supply an annual series from roughly 2015 to 2022. The queue's "2017-2019" undercounts the available span.

**The second route is the Annual Dzongkhag Statistics (ADS) subject booklets.** Each dzongkhag booklet runs fourteen numbered subjects; subject 13, "Historical sites and Recreations", holds the religious-infrastructure table. The Trongsa 2017 booklet's Table 13.2 prints, verbatim:

```
Table 13.2: Number of Historical sites and Recreations, (2013-2016)
Historical sites                           2013       2014          2015      2016
Dzongs (monuments)                                        4               4      4
Government owned Lhakhang                                 3               3      3
Community owned Lhakhang                                 42            42       42
Private owned Lhakhang                                   18            18       18
Chortens                                               144            144      144
Museum                                          1         1               1      1
Children park ... Drayangs ... Discotheques ... Archery ground ... Foot ball ground ... Basketball court
Source: Dzongkhag Administration
```

The ADS table gives a richer disaggregation than the DAG (five religious-infrastructure lines plus a museum line), but it **mixes religious institutions with recreational facilities** in one table — a build must select only the religious-infrastructure rows (Dzongs, the three Lhakhang ownership types, Chortens) and drop the museum and recreation rows. Wayback holds the 2017 edition in full (88 archived files across the dzongkhags) and only one file of the 2018 edition; earlier ADS years (2010, 2011, 2012) survive under the old `/pub/ads/` path.

**The third route is the PHCB 2017 census affiliation route — refuted.** The 2017 census publishes no population-by-religion table. A full-text sweep of the national PHCB 2017 report (`PHCB2017_national.pdf`) finds the string "religio"/"affiliat" nowhere in the table list; the only religion-adjacent content is monastic *education* (public/private monasteries as a schooling type; "Gomchen/Laymonks" as an occupation-education category) and a health-access reason coded "No Faith". A domain-wide sweep of every archived NSB URL (2,884 PDF URLs, 30,000 URLs total) returns zero hits on "religio". Bhutan does not collect religious affiliation in its census; the DAG/ADS register is the only religion signal NSB publishes. There is therefore no affiliation series to keep separate from the institution counts — the separation the queue and the Taiwan precedent demand is automatic here.

## Construct discipline (the governing rule)

The DAG and ADS counts are an **administrative register of religious infrastructure** — buildings and monuments enumerated by the Dzongkhag Administration — and are **never** a measure of what people believe or how many adhere to a faith. This is the Taiwan register-of-organisations class exactly: counts of institutions, not affiliation shares. A build declares the construct in the manifest, the indicators, and every row flag, exactly as the TW product does. Because Bhutan's census carries no affiliation variable, no affiliation column can leak into the product by accident, and no minority-share metric applies. The mapped statistic is a count (and, if a denominator is wanted, institutions or monuments per 10,000 residents using the PHCB population), never a "% religious".

One definitional caveat must be settled before a build, and it is not cosmetic. The DAG "Religious institutions" count is far narrower than the ADS lhakhang counts: Trashigang's DAG shows 8 religious institutions, while a comparable dzongkhag's ADS Table 13.2 (Trongsa) shows 4 dzongs plus 63 lhakhangs plus 144 chortens. The DAG and ADS therefore do not report the same quantity. A build chooses **one** product and states its definition; it does not splice DAG "institutions" onto ADS "lhakhangs". The DAG two-indicator pair (institutions, monuments) is the literal match to the queue row and the audit; the ADS pair (lhakhangs/dzongs, chortens) is the richer alternative. The DAG's internal definition of "religious institution" should be read from the DAG methodology notes before shipping.

## Waves, geography, and grain

| Route | Editions located | In-table year columns | Finest geography | Values | Indicators |
| --- | --- | --- | --- | --- | --- |
| DAG (Dzongkhag at a Glance) | 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023 | trailing 3-year window per edition (e.g. 2019 → 2016/2017/2018) | 20 dzongkhags | whole counts | **Religious institutions; Religious monuments** |
| ADS (Annual Dzongkhag Statistics) | 2010-2012 (old path), 2017 (full in archive), 2018 (partial) | trailing multi-year window per edition (e.g. 2017 → 2013-2016) | 20 dzongkhags | whole counts | **Dzongs; Government/Community/Private owned Lhakhang; Chortens** (mixed with recreation rows) |
| PHCB 2017 census affiliation | 2017 (and 2005) | — | — | — | **none — no religion table published** |

The buildable product is a 20-dzongkhag annual panel of religious-institution and religious-monument counts. The DAG editions 2016-2023 supply the widest annual span from one consistent two-indicator frame; the ADS supplies a disaggregated alternative for a narrower set of archived years. Both are PDF tables; `pdftotext -layout` recovers the cells cleanly (demonstrated above). Machine-readability is PDF-table extraction, matching the queue's "browser work" grade; no clean XLSX release was located (the ADS `/xl/` path served PDFs in the archive).

## Licence position (verbatim where quoted)

The NSB website carries an **all-rights-reserved footer and no located reuse grant**. The footer, verbatim from the archived *Dzongkhag at a Glance* index page (`wb_dag.html`, Wayback capture 2026-03-16 of `https://www.nsb.gov.bt/publications/insights/dzongkhag-at-a-glance/`):

> Copyright ©  2020 National Statistics Bureau. All Rights Reserved

No terms-of-use, open-data, or reuse-licence page was located in the domain-wide URL sweep (2026-07-13); the NSB site exposes an "about" and "publication" set but no reuse instrument. The DAG sheets themselves carry a print credit — "Design & Printed @ KUENSEL Corporation Ltd., 2019" — and a data-source line, "Source: Dzongkhag Administration"; neither is a reuse grant.

**Classification: no stated reuse grant, all-rights-reserved footer.** This is the ratified build-then-ask category — the Côte d'Ivoire / Montenegro / Sri Lanka / Iran line, where NSB is the same shape as ANStat, MONSTAT, and DCS. Under the standing BUILD-THEN-ASK ruling (PI, 2026-07-11), derived summary counts ship with attribution to NSB and a source link, `licence_status: needs_review`, and a courtesy reuse ask is recorded for the PI's list (NSB, `nsb@nsb.gov.bt` / the office contact on the site). No explicit prohibition, restricted-data condition, or sensitive-data hold was found in the licence text itself; the sensitivity question below is separate.

The boundary carries its own licence (below).

## Boundary

geoBoundaries gbOpen BTN ADM1 is clean and matches the NSB frame. Metadata (`gb_btn_adm1_meta.json`) records, verbatim: `"boundaryType": "ADM1"`, `"admUnitCount": "20"`, `"boundaryCanonical": "Dzongdeys"`, `"boundaryYearRepresented": "2010"`, `"boundaryLicense": "Creative Commons Attribution 3.0 License"`, `"licenseSource": "commons.wikimedia.org/wiki/File"`. The geometry (`geoBoundaries-BTN-ADM1.geojson`, 20 features) carries the 20 dzongkhag names: Bumthang, Chukha, Dagana, Gasa, Haa, Lhuntse, Mongar, Paro, Pemagatshel, Punakha, Samdrup Jongkhar, Samtse, Sarpang, Thimpu, Trashigang, Trashiyangtse, Trongsa, Tsirang, Wangdue Phodrang, Zhemgang. These join one-to-one to the NSB dzongkhag list (allowing spelling variants: Chhukha/Chukha, Thimphu/Thimpu, Lhuentse/Lhuntse, Wangdue/Wangdue Phodrang, Trashiyangtse/Tashi Yangtse). Bhutan's 20-dzongkhag frame has been stable across the period; the 2010 boundary vintage therefore fits the 2016-2022 data. CC BY 3.0 is a stated, non-null licence; the boundary ships with attribution to geoBoundaries and the Wikimedia source. An official NSB/GIS dzongkhag vector would be an alternative (the old NSB GIS path held per-dzongkhag maps), but geoBoundaries is sufficient and licensed.

## Sensitivity assessment (Bhutan regulates religion)

Bhutan gives constitutional standing to Buddhism as the country's spiritual heritage, the Drukpa Kagyu school is effectively the state religion, and proselytising is restricted; Christian and Hindu minorities are present but not officially enumerated. The Myanmar pattern (contested categories, non-enumeration, disputed group labels) is the reference case for sensitivity discipline. **That discipline largely does not bite here, for a structural reason: this product counts buildings, not people.** The register enumerates religious infrastructure (institutions and monuments), overwhelmingly Buddhist, compiled administratively; it does not enumerate any population by faith, does not name minority communities, and cannot be interpreted as a minority-share or affiliation measure — because Bhutan collects no such data at all. The chief sensitivity obligations are therefore modest and mostly about framing: (1) present the counts strictly as administrative infrastructure, never as population religiosity or adherence; (2) state plainly on the surfaces that Bhutan does not collect religious affiliation, and that no affiliation layer exists or is implied; (3) avoid any inference from "religious institutions per capita" to a claim about belief. No category is contested in the source, no group is non-enumerated in a way that needs the Myanmar render-the-record treatment, and no cell suppression appears. A light disclosure note, not the full Myanmar hold, is the proportionate discipline. The PI should still see the sensitivity framing before the page goes live, as with any religion-regulating state.

## Cached inputs

Every input is under `data/raw/bt_census/` (git-ignored; `git check-ignore` confirms `data/`). Retrieval date 2026-07-13. Downloads used `curl` with a browser user-agent through the Wayback Machine (the live NSB host is unreachable from this environment — see blockers). Content type verified on each object.

| Cached input | Source (via Wayback) | SHA-256 | Type |
| --- | --- | --- | --- |
| `dag2019_4164.pdf` | `nsb.gov.bt/download/4164/` (DAG 2019, Trashigang) | `ff8025982aa2a9dda59d34f0bfc4227da7a47e86226de261952982c870f550ee` | pdf (**Religion & Culture block**) |
| `dag2019_4167.pdf` | `nsb.gov.bt/download/4167/` (DAG 2019, second dzongkhag) | `080e3e308fefa16370d91426ac28e5ed39cc7aae639be8020ea7074c3a48df2e` | pdf (Religion & Culture block) |
| `trongsa_2017_t13_2.pdf` | `nsb.gov.bt/xl/…/ADS - Trongsa 2017/13. Historical sites and Recreations/Table 13.2 …pdf` | `b6415aafc8f31765e62fa49a4aa1e816079965c10185b61f2f1581acd17acdce` | pdf (**dzongs/lhakhangs/chortens**) |
| `trongsa_2017_t13_1.pdf` | `nsb.gov.bt/xl/…/ADS - Trongsa 2017/13. …/Table 13.1 Number of Administrative Units.pdf` | `f737926946e4108225555c8691e224c547aa11bbb6e116635fb43e1139412f13` | pdf (admin units, context) |
| `phcb2017_national.pdf` | `nsb.gov.bt/publication/files/PHCB2017_national.pdf` | `507308d9ab0fa44f15545fe810b299dcba26b8e1167db4eba27af974f8b03153` | pdf (**no religion table** — refutation) |
| `geoBoundaries-BTN-ADM1.geojson` | `github.com/wmgeolab/geoBoundaries/raw/9469f09/…/BTN/ADM1/…geojson` | `93cdf50d9b03f43e6fd967c24e2362147ac2c24015f452e19181412f09af9f5a` | geojson (20 dzongkhags) |
| `gb_btn_adm1_meta.json` | `geoboundaries.org/api/current/gbOpen/BTN/ADM1/` | `c5fdd6c1d4e4a4ad4be7102373fb4c9af02fd63b983e0eb472774a1892ae579b` | json (boundary licence CC BY 3.0) |
| `wb_dag.html` | Wayback of `nsb.gov.bt/publications/insights/dzongkhag-at-a-glance/` | `49203261cc9e006b4a2bbd9e6488fd659a5a344977a0da30e7f249f35d803619` | html (**licence footer**; DAG editions 2016-2023) |
| `wb_ads.html` | Wayback of `nsb.gov.bt/publications/annual-dzongkhag-statistics/` | `0d721ace5836b89aaf8a4330fa6cf58e90faba8bc51b3a6c3448a8f5bb82ec22` | html (ADS index) |
| `dag2019_cat.html` | Wayback of `nsb.gov.bt/?dlm_download_category=dzongkhag-at-a-glance-2019` | `c9d310f7c62f545f518cd519d511588cbb53abbcc21ee321179470af8bdb7b3c` | html (DAG 2019 download ids) |
| `wb_syb.html` | Wayback of `nsb.gov.bt/publications/statistical-yearbook/` | `bfa64b342f8e3c1699f6539516aa0dbcb2d6033b64567111fb3ffcd30a6c1075` | html (yearbook index) |
| `cdx_pdf.txt` | Wayback CDX, `nsb.gov.bt` PDFs (2,884 URLs) | `c0143ebeba35deb1289b50771cdfa45b41748c8efdce82796a8f159a1dd4120f` | text (URL inventory) |
| `cdx_all.txt` | Wayback CDX, `nsb.gov.bt` all mimetypes (30,000 URLs) | `19ea2cbb21a156b80d5a9efd7d936f42f3531f2f561d78176a1f0bd1e768d6a4` | text (URL inventory) |

## Blockers and unblocks

- **Host reachability (operational, not a data or licence block).** `www.nsb.gov.bt` (IP 43.230.208.104) times out to both `curl` and WebFetch from this environment; `web.archive.org` is blocked to WebFetch but reachable to `curl`. Every capture here came through the Wayback Machine via `curl`. This is the Taiwan `religion.moi.gov.tw` situation — a network path issue, not a refusal by the source. **Unblock:** fetch the live DAG/ADS PDFs through a reachable network, the user's browser session, or the Wayback copies already cached here. The Wayback holds enough (full ADS 2017; DAG editions listed with resolvable download ids) to build without the live host, if a broader edition sweep confirms.
- **DAG vs ADS definition (must settle before build, not a block).** The DAG "Religious institutions" count and the ADS lhakhang counts are different quantities. Choose one product and document its definition; do not splice. The DAG two-indicator pair matches the queue and audit; the ADS pair is the richer alternative.
- **ADS mixes religious and recreational rows (handle at parse).** Table 13.2 lists dzongs/lhakhangs/chortens beside football grounds and discotheques. Select only the religious-infrastructure rows; drop museum and recreation.
- **Edition/year sweep still to do at build time.** This probe confirmed the construct from the DAG 2019 (2016-2018) and ADS 2017 (2013-2016) editions and located the DAG 2016-2023 download categories. A build must harvest each DAG edition's 20 dzongkhag sheets and reconcile the overlapping year columns across editions into one annual panel.
- **Licence: no stated reuse grant.** All-rights-reserved footer; build-then-ask with attribution under the standing ruling, and a courtesy NSB reuse ask for the PI's list.
- **Sensitivity: PI eyes on framing.** Bhutan regulates religion; because the counts measure infrastructure rather than affiliation, the discipline is a disclosure note rather than the Myanmar hold. The PI should see the framing before the page ships.

## Recommendation

Build a 20-dzongkhag annual panel of religious-institution and religious-monument counts from the NSB *Dzongkhag at a Glance* editions (2016-2023), declared as an administrative register of religious infrastructure in the Taiwan construct class, never as population affiliation. Take the DAG two-indicator frame ("Religious institutions", "Religious monuments") as the primary series for the literal queue match, and hold the ADS Table 13.2 disaggregation (dzongs, lhakhang ownership types, chortens) as an optional richer alternative for the archived years, choosing one definition and documenting it. Boundary: geoBoundaries BTN ADM1, 20 dzongkhags, CC BY 3.0, one-to-one join. Licence: build-then-ask, NSB attribution, `licence_status: needs_review`, courtesy reuse ask recorded. Carry a disclosure note that Bhutan does not collect religious affiliation; the product measures infrastructure, and no affiliation layer exists. Refute the census-affiliation route on the page's provenance: PHCB 2017 publishes no religion table.

- **Draft queue-row status clause (do not apply):** `probed 2026-07-13, BUILDABLE (register construct, refutes the census-affiliation premise): NSB Dzongkhag at a Glance carries a "Religion & Culture" block with two per-dzongkhag annual indicators — Religious institutions and Religious monuments (whole counts, Source: Dzongkhag Administration) — across editions 2016-2023 (2019 edition shows 2016/2017/2018); ADS Table 13.2 gives the disaggregated dzongs/lhakhangs/chortens alternative. Administrative register of religious infrastructure, never affiliation — the Taiwan class; Bhutan collects no census religion (PHCB 2017 has no religion table). Boundary: geoBoundaries BTN ADM1, 20 dzongkhags, CC BY 3.0, one-to-one. Licence: NSB all-rights-reserved footer, no reuse grant — build-then-ask with attribution. Caveat: live host unreachable from this environment, captures via Wayback; DAG "institutions" is a narrower count than ADS "lhakhangs" — pick one definition ([route-probe](countries/bt/route-probe.md))`.
</content>
</invoke>
