#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

SRC_1967 = ROOT / "apps/regions/vu/data/source/vu_religion_by_island_1967_mcarthur_tableA.csv"
SRC_2009 = ROOT / "data/raw/vu_census_extracts/vu_religion_by_province_2009_basictables_t3_5.csv"
SRC_ADM2_2020 = ROOT / "apps/regions/vu/data/adm2_2020.geojson"
SRC_ADM1_2020 = ROOT / "apps/regions/vu/data/adm1_2020.geojson"

OUT_CSV = ROOT / "research/countries/vu/island_unit_concordance_draft.csv"
OUT_NOTES = ROOT / "research/countries/vu/island_unit_concordance_notes.md"

CSV_COLUMNS = [
    "island_unit_id",
    "island_unit_name",
    "islands_1967",
    "islands_2009",
    "area_councils_2020",
    "province",
    "notes",
]


def unit(
    island_unit_id: str,
    island_unit_name: str,
    islands_1967: list[str],
    islands_2009: list[str],
    area_councils_2020: list[str],
    province: str,
    notes: str = "",
) -> dict[str, str | list[str]]:
    # builds one hand-mapped island-unit row from source names used verbatim.
    return {
        "island_unit_id": island_unit_id,
        "island_unit_name": island_unit_name,
        "islands_1967": islands_1967,
        "islands_2009": islands_2009,
        "area_councils_2020": area_councils_2020,
        "province": province,
        "notes": notes,
    }


# hand concordance for coordinator review. comments name the non-obvious
# source-name decisions and the deliberately unresolved placements.
UNITS: list[dict[str, str | list[str]]] = [
    # torba: the six known multi-island AC rules are encoded as island groups.
    unit(
        "torres-group",
        "Torres group",
        ["Hiu", "Tegua", "Lo", "Toga"],
        ["Hiu", "Loh", "Metoma", "Tegua", "Toga"],
        ["Torres"],
        "Torba",
        "island-GROUP rule: Torres combines Hiu, Tegua, Loh/Lo, Toga, and Metoma; Torres has no ADM2 polygon.",
    ),
    unit("ureparapara", "Ureparapara", ["Ureparapara"], ["Ureparapara"], ["Ureparapara"], "Torba"),
    unit(
        "motalava-rah-group",
        "Mota Lava and Rah group",
        ["Mota Lava"],
        ["Motalava", "Rah"],
        ["Motalava"],
        "Torba",
        "island-GROUP rule: Motalava combines Mota Lava and Rah; 1967 has no separate Rah row.",
    ),
    unit(
        "vanua-lava-kwakea-group",
        "Vanua Lava and Kwakea group",
        ["Vanua Lava", "Pakea"],
        ["Kwakea", "Vanualava"],
        ["Vanua Lava"],
        "Torba",
        "island-GROUP rule: Vanua Lava combines Vanua Lava and Kwakea; 1967 Pakea is treated as Kwakea.",
    ),
    unit("mota", "Mota", ["Mota"], ["Mota"], ["Mota"], "Torba"),
    unit("gaua", "Gaua", ["Gaua"], ["Gaua"], ["Gaua"], "Torba"),
    unit(
        "merelava-merig-group",
        "Mere Lava and Merig group",
        ["Merig", "Mere Lava"],
        ["Merelava", "Merig"],
        ["Merelava"],
        "Torba",
        "island-GROUP rule: Merelava combines Mere Lava and Merig; 1967 writes Mere Lava with a space.",
    ),

    # sanma: large-island ACs map to the large island; small satellites without
    # a distinct 2020 row stay unresolved rather than being folded into Santo.
    unit(
        "santo",
        "Santo",
        ["Santo"],
        ["Santo"],
        [
            "North West Santo",
            "North Santo",
            "West Santo",
            "South Santo",
            "East Santo",
            "South East Santo",
            "Canal - Fanafo",
            "Luganville",
        ],
        "Sanma",
        "large island split across several 2020 ACs; Luganville maps to Santo.",
    ),
    unit("pilot", "Pilot", ["Pilot"], [], [], "Sanma", "UNRESOLVED 2009/2020 placement; no source-row match is encoded."),
    unit("mafia", "Mafia", ["Mafia"], [], [], "Sanma", "UNRESOLVED 2009/2020 placement; no source-row match is encoded."),
    unit("ais", "Ais", ["Ais"], [], [], "Sanma", "UNRESOLVED 2009/2020 placement; no source-row match is encoded."),
    unit("tutuba", "Tutuba", ["Tutuba"], ["Tutuba"], [], "Sanma", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("aore", "Aore", ["Aoro"], ["Aore"], [], "Sanma", "1967 Aoro is treated as Aore; UNRESOLVED 2020 AC placement."),
    unit(
        "malo",
        "Malo",
        ["Malo"],
        ["Malo"],
        ["West Malo", "East Malo"],
        "Sanma",
        "large island split across two 2020 ACs.",
    ),
    unit(
        "malokilikili",
        "Malokilikili",
        ["Malokilikili"],
        ["Malokilikili"],
        [],
        "Sanma",
        "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name.",
    ),
    unit("urelapa", "Urelapa", ["Urelapa"], [], [], "Sanma", "UNRESOLVED 2009/2020 placement; no source-row match is encoded."),
    unit("tangoa", "Tangoa", ["Tangoa"], ["Tangoa"], [], "Sanma", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("araki", "Araki", ["Araki"], ["Araki"], [], "Sanma", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("bokissa", "Bokissa", [], ["Bokissa"], [], "Sanma", "UNRESOLVED 1967/2020 placement; no exact 1967 or 2020 row."),
    unit("mavea", "Mavea", [], ["Mavea"], [], "Sanma", "UNRESOLVED 1967/2020 placement; no exact 1967 or 2020 row."),

    # penama: 1967 Aoba is the older spelling for Ambae.
    unit(
        "ambae",
        "Ambae",
        ["Aoba"],
        ["Ambae"],
        ["West Ambae", "North Ambae", "East Ambae", "South Ambae"],
        "Penama",
        "1967 Aoba is treated as Ambae; large island split across four 2020 ACs.",
    ),
    unit("maewo", "Maewo", ["Maewo"], ["Maewo"], ["North Maewo", "South Maewo"], "Penama"),
    unit(
        "pentecost",
        "Pentecost",
        ["Pentecost"],
        ["Pentecost"],
        ["North Pentecost", "Central Pentecost 1", "Central Pentecost 2", "South Pentecost"],
        "Penama",
        "large island split across four 2020 ACs.",
    ),

    # malampa: Malekula and Ambrym are split across ACs; offshore islands
    # without a distinct 2020 row are left unresolved for review.
    unit(
        "malekula",
        "Malekula",
        ["Malekula"],
        ["Malekula"],
        [
            "North West Malekula",
            "North East Malekula",
            "Central Malekula",
            "South West Malekula",
            "South East Malekula",
            "South Malekula",
        ],
        "Malampa",
        "large island split across six 2020 ACs.",
    ),
    unit("vao", "Vao", ["Vao"], ["Vao"], [], "Malampa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("atchin", "Atchin", ["Atchin"], ["Atchin"], [], "Malampa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("wala", "Wala", ["Wala"], ["Wala"], [], "Malampa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("ranro", "Ranro", ["Rano"], ["Ranro"], [], "Malampa", "1967 Rano is treated as Ranro; UNRESOLVED 2020 AC placement."),
    unit("norsup", "Norsup", ["Norsup"], ["Norsup"], [], "Malampa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("uripiv", "Uripiv", ["Uripiv"], ["Uripiv"], [], "Malampa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("uri", "Uri", ["Uri"], ["Uri"], [], "Malampa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit(
        "sakao-khoti",
        "Sakao/Khoti",
        ["Sakau"],
        ["Khoti (Sakao)"],
        [],
        "Malampa",
        "1967 Sakau is treated as 2009 Khoti (Sakao); UNRESOLVED 2020 AC placement.",
    ),
    unit("kolivu", "Kolivu", ["Kolivu"], [], [], "Malampa", "UNRESOLVED 2009/2020 placement; no source-row match is encoded."),
    unit("uliveo", "Uliveo", [], ["Uliveo"], [], "Malampa", "UNRESOLVED 1967/2020 placement; no exact 1967 or 2020 row."),
    unit("lembong", "Lembong", [], ["Lembong"], [], "Malampa", "UNRESOLVED 1967/2020 placement; no exact 1967 or 2020 row."),
    unit("avock", "Avock", ["Avock"], ["Avock"], [], "Malampa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("ahamb", "Ahamb", ["Ahamb"], ["Akhamb"], [], "Malampa", "1967 Ahamb is treated as 2009 Akhamb; UNRESOLVED 2020 AC placement."),
    unit("toman", "Tomman", ["Toman"], ["Tomman"], [], "Malampa", "1967 Toman is treated as 2009 Tomman; UNRESOLVED 2020 AC placement."),
    unit(
        "ambrym",
        "Ambrym",
        ["Ambrym"],
        ["Ambrym"],
        ["North Ambrym", "West Ambrym", "South East Ambrym"],
        "Malampa",
        "large island split across three 2020 ACs.",
    ),
    unit("paama", "Paama", ["Paama"], ["Paama"], ["Paama"], "Malampa"),
    unit("lopevi", "Lopevi", ["Lopevi"], [], [], "Malampa", "UNRESOLVED 2009/2020 placement; no source-row match is encoded."),

    # shefa: Makimae and Nguna are known island groups; Port Vila maps to Efate.
    unit("lamen", "Lamen", ["Lamen"], ["Lamen"], [], "Shefa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit(
        "epi",
        "Epi",
        ["Epi"],
        ["Epi"],
        ["Vermali", "Vermaul", "Varisu", "South Epi"],
        "Shefa",
        "large island split across four 2020 ACs.",
    ),
    unit("tongoa", "Tongoa", ["Tongoa"], ["Tongoa"], ["North Tongoa"], "Shefa"),
    unit("tongariki", "Tongariki", ["Tongariki"], ["Tongariki"], ["Tongariki"], "Shefa"),
    unit("buninga", "Buninga", ["Buninga"], ["Buninga"], [], "Shefa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit(
        "makimae-group",
        "Makimae group",
        ["Emae", "Makura", "Mataso"],
        ["Emae", "Makira", "Mataso"],
        ["Makimae"],
        "Shefa",
        "island-GROUP rule: Makimae combines Emae, Makira/Makura, and Mataso.",
    ),
    unit(
        "efate",
        "Efate",
        ["Efate"],
        ["Efate"],
        ["Malorua", "North Efate", "Mele", "Pango", "Erakor", "Eratap", "Eton", "Port Vila"],
        "Shefa",
        "large island split across several 2020 ACs; Port Vila maps to Efate.",
    ),
    unit(
        "nguna-pele-group",
        "Nguna and Pele group",
        ["Nguna", "Pele"],
        ["Nguna", "Pele"],
        ["Nguna"],
        "Shefa",
        "island-GROUP rule: Nguna combines Nguna and Pele.",
    ),
    unit("emau", "Emau", ["Emau"], ["Emau"], ["Emau"], "Shefa"),
    unit("moso", "Moso", ["Moso"], ["Moso"], [], "Shefa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("lelepa", "Lelepa", ["Leleppa"], ["Lelepa"], [], "Shefa", "1967 Leleppa is treated as Lelepa; UNRESOLVED 2020 AC placement."),
    unit("iririki", "Iririki", ["Iririki"], ["Iririki"], [], "Shefa", "UNRESOLVED 2020 AC placement; no distinct 2020 AC row/name."),
    unit("ifira", "Ifira", ["Fila"], ["Ifira"], ["Ifira"], "Shefa", "1967 Fila is treated as Ifira."),
    unit("kakula", "Kakula", [], ["Kakula"], [], "Shefa", "UNRESOLVED 1967/2020 placement; no exact 1967 or 2020 row."),

    # tafea: large islands split across ACs; small islands have direct AC rows.
    unit("erromango", "Erromango", ["Erromango"], ["Erromango"], ["North Erromango", "South Erromango"], "Tafea"),
    unit(
        "tanna",
        "Tanna",
        ["Tanna"],
        ["Tanna"],
        ["North Tanna", "West Tanna", "Middle Bush Tanna", "South West Tanna", "Whitesands", "South Tanna"],
        "Tafea",
        "large island split across six 2020 ACs.",
    ),
    unit("aniwa", "Aniwa", ["Aniwa"], ["Aniwa"], ["Aniwa"], "Tafea"),
    unit("futuna", "Futuna", ["Futuna"], ["Futuna"], ["Futuna"], "Tafea"),
    unit("aneityum", "Aneityum", ["Aneityum"], ["Aneityum"], ["Aneityum"], "Tafea"),

    # non-island 1967 rows are kept only to satisfy full source-row coverage.
    unit(
        "ships-floating-population",
        "Ships floating population",
        ["Ships"],
        [],
        [],
        "",
        "non-island 1967 row; retained for coverage only and excluded from island-unit analysis.",
    ),
    unit(
        "new-hebrides-national-total",
        "New Hebrides national total",
        ["New Hebrides"],
        [],
        [],
        "",
        "non-island 1967 national total row; retained for coverage only and excluded from island-unit analysis.",
    ),
]

SPELLING_DECISIONS = [
    "Lo -> Loh",
    "Mota Lava -> Motalava",
    "Vanua Lava -> Vanualava",
    "Pakea -> Kwakea",
    "Mere Lava -> Merelava",
    "Aoro -> Aore",
    "Aoba -> Ambae",
    "Rano -> Ranro",
    "Sakau -> Khoti (Sakao)",
    "Ahamb -> Akhamb",
    "Toman -> Tomman",
    "Emae source rows are unaccented in both 1967 and 2009",
    "Makura -> Makira",
    "Leleppa -> Lelepa",
    "Fila -> Ifira",
]

GROUP_RULES = [
    "Torres: Hiu; Tegua; Loh/Lo; Toga; Metoma",
    "Makimae: Emae; Makira/Makura; Mataso",
    "Merelava: Mere Lava; Merig",
    "Motalava: Mota Lava; Rah",
    "Vanua Lava: Vanua Lava; Kwakea/Pakea",
    "Nguna: Nguna; Pele",
]


def read_1967_islands() -> list[str]:
    # returns 1967 source-row names in csv order.
    with SRC_1967.open(newline="", encoding="utf-8-sig") as handle:
        return [row["island"] for row in csv.DictReader(handle)]


def read_2009_islands() -> list[str]:
    # returns unique 2009 island rows in source order.
    islands: list[str] = []
    with SRC_2009.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            if row["geo_level"] == "island" and row["geography"] not in islands:
                islands.append(row["geography"])
    return islands


def find_2020_table() -> Path:
    # returns the 2020 religion table path, preferring the source folder.
    source_candidates = sorted((ROOT / "apps/regions/vu/data/source").glob("vu_religion_by_region_2020*.csv"))
    if source_candidates:
        return source_candidates[0]
    raw_candidate = ROOT / "data/raw/vu_census_extracts/vu_religion_by_region_2020_basictables_t3_5.csv"
    if raw_candidate.exists():
        return raw_candidate
    raise FileNotFoundError("could not find a vu_religion_by_region_2020*.csv source")


def read_2020_table_area_councils(path: Path) -> list[str]:
    # returns unique 2020 area-council rows in source order.
    councils: list[str] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            if row["geo_level"] == "area_council" and row["geography"] not in councils:
                councils.append(row["geography"])
    return councils


def read_adm2_area_councils() -> list[str]:
    # returns ADM2 area_name values in geojson feature order.
    data = json.loads(SRC_ADM2_2020.read_text(encoding="utf-8"))
    return [feature["properties"]["area_name"] for feature in data["features"]]


def read_adm1_provinces() -> set[str]:
    # returns valid province names from the ADM1 GeoJSON.
    data = json.loads(SRC_ADM1_2020.read_text(encoding="utf-8"))
    return {feature["properties"]["area_name"] for feature in data["features"]}


def join_names(names: list[str]) -> str:
    # serialises a source-name list without altering any individual name.
    return ";".join(names)


def flatten(rows: list[dict[str, str | list[str]]], column: str) -> list[str]:
    # expands one list-valued hand-map column across all island units.
    values: list[str] = []
    for row in rows:
        values.extend(row[column])  # type: ignore[arg-type]
    return values


def validate_coverage(label: str, expected: list[str], observed: list[str]) -> None:
    # stops on any missing, duplicate, or unexpected source name.
    expected_counts = Counter(expected)
    observed_counts = Counter(observed)
    missing = sorted(name for name, count in expected_counts.items() if observed_counts[name] != count)
    duplicate = sorted(name for name, count in observed_counts.items() if count > expected_counts.get(name, 0))
    unexpected = sorted(name for name in observed_counts if name not in expected_counts)
    problems = []
    if missing:
        problems.append(f"missing {label}: {missing}")
    if duplicate:
        problems.append(f"duplicate {label}: {duplicate}")
    if unexpected:
        problems.append(f"unexpected {label}: {unexpected}")
    if problems:
        raise SystemExit("; ".join(problems))


def validate_units(
    islands_1967: list[str],
    islands_2009: list[str],
    ac_2020_union: list[str],
    provinces: set[str],
) -> None:
    # validates complete one-to-one source coverage and province names.
    validate_coverage("1967 rows", islands_1967, flatten(UNITS, "islands_1967"))
    validate_coverage("2009 island rows", islands_2009, flatten(UNITS, "islands_2009"))
    validate_coverage("2020 AC table/geojson names", ac_2020_union, flatten(UNITS, "area_councils_2020"))
    invalid_provinces = sorted({row["province"] for row in UNITS if row["province"]} - provinces)  # type: ignore[operator]
    if invalid_provinces:
        raise SystemExit(f"invalid province names: {invalid_provinces}")


def source_only_2020(table_names: list[str], geojson_names: list[str]) -> tuple[list[str], list[str]]:
    # reports names present on only one 2020 source side.
    table_only = sorted(set(table_names) - set(geojson_names))
    geojson_only = sorted(set(geojson_names) - set(table_names))
    return table_only, geojson_only


def source_absence(column_a: str, column_b: str) -> list[str]:
    # returns names in one mapped source column where the paired source column is empty.
    names: list[str] = []
    for row in UNITS:
        if row[column_a] and not row[column_b]:
            names.extend(row[column_a])  # type: ignore[arg-type]
    return names


def unresolved_rows() -> list[str]:
    # returns compact notes for rows flagged for coordinator review.
    notes: list[str] = []
    for row in UNITS:
        note = str(row["notes"])
        if "UNRESOLVED" in note:
            notes.append(f"- {row['island_unit_id']}: {note}")
    return notes


def write_concordance() -> None:
    # writes the draft concordance csv with semicolon-joined source names.
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in UNITS:
            writer.writerow(
                {
                    "island_unit_id": row["island_unit_id"],
                    "island_unit_name": row["island_unit_name"],
                    "islands_1967": join_names(row["islands_1967"]),  # type: ignore[arg-type]
                    "islands_2009": join_names(row["islands_2009"]),  # type: ignore[arg-type]
                    "area_councils_2020": join_names(row["area_councils_2020"]),  # type: ignore[arg-type]
                    "province": row["province"],
                    "notes": row["notes"],
                }
            )


def write_notes(
    islands_1967: list[str],
    islands_2009: list[str],
    table_2020: list[str],
    geojson_2020: list[str],
    table_only_2020: list[str],
    geojson_only_2020: list[str],
    table_2020_path: Path,
) -> None:
    # writes a coordinator-facing summary of source mismatches and decisions.
    rows_1967_without_2009 = source_absence("islands_1967", "islands_2009")
    rows_2009_without_1967 = source_absence("islands_2009", "islands_1967")
    unresolved = unresolved_rows()
    lines = [
        "# Vanuatu island-unit concordance draft notes",
        "",
        "Generated by `scripts/draft_vu_island_concordance.py`.",
        "",
        "## Source coverage",
        "",
        f"- 1967 source rows covered: {len(islands_1967)}.",
        f"- 2009 unique island names covered: {len(islands_2009)}.",
        f"- 2020 unique area-council table names covered: {len(table_2020)} from `{table_2020_path.relative_to(ROOT)}`.",
        f"- 2020 ADM2 GeoJSON feature names covered: {len(geojson_2020)} from `{SRC_ADM2_2020.relative_to(ROOT)}`.",
        f"- 2020 table/GeoJSON union covered: {len(set(table_2020) | set(geojson_2020))}.",
        "",
        "## Count and source-shape mismatches",
        "",
        "- The prompt and playbook describe 66 1967 island rows, but the current CSV has 65 data rows: 63 named land-island rows, `Ships`, and `New Hebrides`.",
        "- `Ships` is a floating-population row and `New Hebrides` is the national total row; both are retained in the CSV only to satisfy complete 1967 source coverage.",
        f"- The 2020 area-council table has {len(table_2020)} unique names, while the ADM2 GeoJSON has {len(geojson_2020)} feature names.",
        f"- The 2020 table-only name is: {', '.join(table_only_2020) if table_only_2020 else 'none'}.",
        f"- The 2020 GeoJSON-only names are: {', '.join(geojson_only_2020) if geojson_only_2020 else 'none'}.",
        "",
        "## 1967 rows without a matched 2009 row",
        "",
        *(f"- {name}" for name in rows_1967_without_2009),
        "",
        "## 2009 rows without a matched 1967 row",
        "",
        *(f"- {name}" for name in rows_2009_without_1967),
        "",
        "## Name-spelling decisions",
        "",
        *(f"- {decision}" for decision in SPELLING_DECISIONS),
        "",
        "## Island-group rules applied",
        "",
        *(f"- {rule}" for rule in GROUP_RULES),
        "",
        "## Torres polygon gap",
        "",
        "- `Torres` appears in the 2020 area-council religion table but not in `apps/regions/vu/data/adm2_2020.geojson`.",
        "- The draft keeps `Torres` in the 2020 concordance column and notes the missing polygon on the Torres group row.",
        "",
        "## Unresolved placements",
        "",
        *(unresolved if unresolved else ["- None."]),
        "",
    ]
    OUT_NOTES.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    # coordinates source reads, validation, and output writing.
    islands_1967 = read_1967_islands()
    islands_2009 = read_2009_islands()
    table_2020_path = find_2020_table()
    table_2020 = read_2020_table_area_councils(table_2020_path)
    geojson_2020 = read_adm2_area_councils()
    ac_2020_union = table_2020 + [name for name in geojson_2020 if name not in table_2020]
    provinces = read_adm1_provinces()

    validate_units(islands_1967, islands_2009, ac_2020_union, provinces)
    table_only_2020, geojson_only_2020 = source_only_2020(table_2020, geojson_2020)
    write_concordance()
    write_notes(
        islands_1967,
        islands_2009,
        table_2020,
        geojson_2020,
        table_only_2020,
        geojson_only_2020,
        table_2020_path,
    )
    print(f"wrote {OUT_CSV.relative_to(ROOT)}")
    print(f"wrote {OUT_NOTES.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
