# Country data map: Vanuatu (VU)

Status: live pilot country — the survey card follows the
country-survey playbook; current authoritative record: changelog,
`docs/manifests/vu-census-religion-*.json`, `apps/regions/vu/`.

- **Live**: province religious affiliation 1999/2009/2020 and area
  councils 2020 (VNSO/VBoS & SPC, attributed research use, JB-approved
  2026-07-04); the 1999 province table came from Guy Lavender
  Forsyth's scan of the print-only Main Report.
- **In progress**: Guy's harmonised area-council spreadsheet from the
  first census (1967) onward — see
  `docs/playbooks/guy-vu-spreadsheets.md`; 1999 island rows await
  transcription; pre-1994 waves need the eleven-region crosswalk.
- **Deep-history potential**: mission archives (PAMBU, Presbyterian,
  Melanesian Mission, Marist), New Hebrides colonial records, National
  Archives of Vanuatu; kastom-site sensitivity is first-class in the
  country protocol.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Vanuatu Bureau of Statistics (VBoS) / Vanuatu National Statistics Office (VNSO), via SPC Digital Library, <https://www.spc.int/digitallibrary/get/2dwwa> and <https://www.spc.int/digitallibrary/get/aazaf>.
- **Exact tables**: VNSO 1999 Main Report `T2.10`, VBoS 2020 Basic Tables Volume 1 `T3.5`, VNSO 2009 Basic Tables Volume 1 `T3.5`, 2020 Analytical Report Volume 2 `T30` and `T31`, and derived `vu-2020-province-incl-urban-derived`.
- **Licence**: no explicit licence on Basic Tables volumes; 2020 Analytical Report authorises research/educational reproduction with acknowledgement of SPC and VBoS. JB reviewed and signed off the attributed-use position 2026-07-04: publication as attributed map products (VBoS & SPC credited on the map and in this manifest) is approved; any redistribution beyond that returns for review.
- **Our extraction scripts**: `scripts/extract_vu_census_religion.py` and `scripts/build_vu_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/vu-census-religion-2009-2020-d17f5596eca1.json`.
- **Restricted extracts**: VU census source extracts live in the project's private research tier and are not redistributed; the retrieval recipe remains public.
