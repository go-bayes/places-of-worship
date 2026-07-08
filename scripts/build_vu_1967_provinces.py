# build the 1967 vanuatu province-level religion extract from the McArthur &
# Yaxley (1968) first-census Table A (per-1,000 adherence rates by island,
# persons aged 15+). the published table is island-level; this script
# aggregates islands to the six modern provinces using the island->province
# crosswalk implied by the 2009 census island rows, weighting each island by
# its aged-15+ population. output matches the project census-extract shape
# (geography, geo_level, province, census_year, religion_label_source,
# religion_label_normalised, count) so scripts/build_vu_area_summary.R can
# consume it exactly like the 1999/2009/2020 extracts.
#
# input:  data/VAN/religion_proportion_by_island_1967.xlsx (committed)
# output: data/raw/vu_census_extracts/vu_religion_by_province_1967_mcarthur_tableA.csv
# run from the repo root: uv run --with openpyxl python3 scripts/build_vu_1967_provinces.py

import csv
import os
from collections import defaultdict

import openpyxl

XLSX = "data/VAN/religion_proportion_by_island_1967.xlsx"
OUT = "data/raw/vu_census_extracts/vu_religion_by_province_1967_mcarthur_tableA.csv"

# per-1,000 columns of Table A, in sheet order, mapped to the project's
# normalised religion vocabulary. french_protestant has no later-census
# equivalent (the movement folded into other reformed churches); it is kept
# verbatim so provinces still sum to their island totals.
CATEGORIES = [
    ("Presbyterian", "presbyterian"),
    ("Anglican (Melanesian Mission)", "anglican"),
    ("Roman Catholic", "catholic"),
    ("Seventh Day Adventist", "seventh_day_adventist"),
    ("French Protestant", "french_protestant"),
    ("Churches of Christ", "church_of_christ"),
    ("Apostolic", "apostolic"),
    ("Custom", "customary_beliefs"),
    ("Other", "other"),
]

# island -> modern province. the assignments for named islands come straight
# from the 2009 census island rows (geo_level=island); the small satellite
# islets that 2009 does not list individually are placed by their island group
# (Banks/Torres -> Torba; Santo/Malo satellites -> Sanma; Malekula satellites
# -> Malampa; Efate/Shepherd satellites -> Shefa). "Ships" is the floating
# ship-board population and belongs to no province, so it is dropped (it is the
# 262-person gap between the province total and McArthur's national row).
CROSSWALK = {
    # Torba: Torres + Banks
    "Hiu": "Torba", "Tegua": "Torba", "Lo": "Torba", "Toga": "Torba",
    "Ureparapara": "Torba", "Mota Lava": "Torba", "Vanua Lava": "Torba",
    "Pakea": "Torba", "Mota": "Torba", "Gaua": "Torba", "Merig": "Torba",
    "Mere Lava": "Torba",
    # Sanma: Santo + Malo + satellites
    "Santo": "Sanma", "Pilot": "Sanma", "Mafia": "Sanma", "Ais": "Sanma",
    "Tutuba": "Sanma", "Aoro": "Sanma", "Malo": "Sanma", "Malokilikili": "Sanma",
    "Urelapa": "Sanma", "Tangoa": "Sanma", "Araki": "Sanma",
    # Penama
    "Aoba": "Penama", "Maewo": "Penama", "Pentecost": "Penama",
    # Malampa: Malekula + satellites + Ambrym + Paama
    "Malekula": "Malampa", "Vao": "Malampa", "Atchin": "Malampa",
    "Wala": "Malampa", "Rano": "Malampa", "Norsup": "Malampa",
    "Uripiv": "Malampa", "Uri": "Malampa", "Sakau": "Malampa",
    "Kolivu": "Malampa", "Avock": "Malampa", "Ahamb": "Malampa",
    "Toman": "Malampa", "Ambrym": "Malampa", "Paama": "Malampa",
    "Lopevi": "Malampa",
    # Shefa: Epi + Shepherds + Efate + satellites
    "Lamen": "Shefa", "Epi": "Shefa", "Tongoa": "Shefa", "Tongariki": "Shefa",
    "Buninga": "Shefa", "Emae": "Shefa", "Makura": "Shefa", "Mataso": "Shefa",
    "Efate": "Shefa", "Nguna": "Shefa", "Pele": "Shefa", "Emau": "Shefa",
    "Moso": "Shefa", "Leleppa": "Shefa", "Iririki": "Shefa", "Fila": "Shefa",
    # Tafea
    "Erromango": "Tafea", "Tanna": "Tafea", "Aniwa": "Tafea",
    "Futuna": "Tafea", "Aneityum": "Tafea",
    # floating population, assigned to no province
    "Ships": None,
}

PROVINCES = ["Malampa", "Penama", "Sanma", "Shefa", "Tafea", "Torba"]
CITATION_LABEL = {norm: src for src, norm in CATEGORIES}


def read_islands():
    # returns list of (island_name, pop15, {normalised_label: per_1000_rate})
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["Sheet1"]
    rows = list(ws.iter_rows(values_only=True))
    islands = []
    national = None
    # data begins after the header row (index 4); columns 1..9 are the rate
    # columns in CATEGORIES order, column 10 is the aged-15+ total
    for r in rows[5:]:
        if not r or r[0] is None:
            continue
        name = str(r[0]).strip()
        rec = (name, r[10] or 0, {norm: (r[1 + i] or 0) for i, (_, norm) in enumerate(CATEGORIES)})
        if name == "New Hebrides":
            national = rec
        else:
            islands.append(rec)
    return islands, national


def aggregate(islands):
    # weighted aggregation: adherent count = rate/1000 * island pop15, summed to
    # the province, then rounded once at the province level
    prov = defaultdict(lambda: {"pop15": 0.0, **{norm: 0.0 for _, norm in CATEGORIES}})
    unmapped = []
    for name, pop15, rates in islands:
        if name not in CROSSWALK:
            unmapped.append(name)
            continue
        p = CROSSWALK[name]
        if p is None:
            continue
        prov[p]["pop15"] += pop15
        for _, norm in CATEGORIES:
            prov[p][norm] += rates[norm] / 1000.0 * pop15
    if unmapped:
        raise SystemExit(f"unmapped islands (extend CROSSWALK): {unmapped}")
    return prov


def validate(prov, national):
    # the reconstructed national customary share must match McArthur's national
    # row, and the province populations must sum to the national aged-15+ total
    # minus the ship-board population
    nat_pop = sum(prov[p]["pop15"] for p in PROVINCES)
    nat_cust = sum(prov[p]["customary_beliefs"] for p in PROVINCES)
    ships_pop = 262  # McArthur "Ships" row, excluded from provinces
    expected_pop = national[1] - ships_pop
    assert abs(nat_pop - expected_pop) < 1, (nat_pop, expected_pop)
    recon_cust_pct = 100 * nat_cust / nat_pop
    published_cust_pct = national[2]["customary_beliefs"] / 10.0
    assert abs(recon_cust_pct - published_cust_pct) < 0.2, (recon_cust_pct, published_cust_pct)
    print(f"validation ok: national pop15+ {nat_pop:.0f} (= {national[1]} - {ships_pop} ships); "
          f"customary {recon_cust_pct:.2f}% vs published {published_cust_pct:.1f}%")


def write_csv(prov):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["geography", "geo_level", "province", "census_year",
                    "religion_label_source", "religion_label_normalised", "count"])
        for p in PROVINCES:
            d = prov[p]
            pop = round(d["pop15"])
            # total first, then each denomination as a rounded adherent count
            w.writerow([p, "province", p, 1967, "Total (persons aged 15+)", "total", pop])
            for src, norm in CATEGORIES:
                w.writerow([p, "province", p, 1967, src, norm, round(d[norm])])
    print(f"wrote {OUT}")


def main():
    islands, national = read_islands()
    prov = aggregate(islands)
    validate(prov, national)
    write_csv(prov)


if __name__ == "__main__":
    main()
