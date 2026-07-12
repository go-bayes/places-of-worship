import copy
import json

# derived per-vintage views of the committed kazakhstan product
# apps/regions/kz/data/area_summary_region.json: the region-map runtime
# derives each census level's year list solely from the rows in that
# level's summary file, and the 2009 (16 regions, geoBoundaries ADM1)
# and 2021 (17 regions, OCHA COD-AB dissolved) waves live on separate
# boundary vintages that must never cross-paint. each vintage therefore
# needs a summary file carrying only its own year (DE kreis precedent,
# scripts/build_de_level_summaries.py). this script does not modify the
# committed combined product; it writes the two filtered views consumed
# only by apps/regions/kz/index.html.

SRC = "apps/regions/kz/data/area_summary_region.json"

with open(SRC) as f:
    d = json.load(f)

VIEWS = [
    (
        2009,
        {
            "boundary_set_id": "kz-region-2009-geoboundaries-adm1",
            "country_code": "KZ",
            "level": "region",
            "vintage": "2009 census 16-region frame (geoBoundaries ADM1, 2017)",
            "source_dataset_id": "geoboundaries-kaz-adm1-2017",
        },
    ),
    (
        2021,
        {
            "boundary_set_id": "kz-region-2021-ocha-codab-adm1",
            "country_code": "KZ",
            "level": "region",
            "vintage": "2021 census 17-region frame (OCHA COD-AB 2023 dissolved to pre-2022 parents)",
            "source_dataset_id": "ocha-codab-kaz-adm1-2023",
        },
    ),
]

for year, boundary_set in VIEWS:
    out = copy.deepcopy(d)
    out["generated_at"] = "2026-07-12T00:00:00Z"
    out["generated_by"] = (
        f"derived view of area_summary_region.json (rows filtered to "
        f"year={year} for the per-vintage census level; page lane 2026-07-12)"
    )
    out["boundary_set"] = boundary_set
    out["rows"] = [r for r in d["rows"] if r["year"] == year]
    dest = f"apps/regions/kz/data/area_summary_region_{year}.json"
    with open(dest, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(dest, len(out["rows"]), "rows")
