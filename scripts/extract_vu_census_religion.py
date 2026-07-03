# extract religion tables from vanuatu 2009 and 2020 census pdfs into long-format csvs
# inputs: the four census pdfs in this directory; outputs: csv files + validation report on stdout
import csv
import re
import unicodedata
from pathlib import Path

import pdfplumber

BASE = Path(__file__).parent

DASH_CHARS = {"-", "‐", "‑", "‒", "–"}


def is_value_token(text):
    # a token is a data value if it is a dash (zero) or digits/commas
    if text in DASH_CHARS:
        return True
    return bool(re.fullmatch(r"[\d,]+", text))


def cluster_rows(words, tol=6.0):
    # group words into visual rows: sorted by top, new row when vertical gap > tol
    words = sorted(words, key=lambda w: w["top"])
    rows, current, last_top = [], [], None
    for w in words:
        if last_top is not None and w["top"] - last_top > tol:
            rows.append(current)
            current = []
        current.append(w)
        last_top = w["top"]
    if current:
        rows.append(current)
    return rows


def merge_fragments(tokens, gap=1.5):
    # rejoin numbers the pdf split into fragments (e.g. "3" + "5,602"); fragments touch, columns are far apart
    tokens = sorted(tokens, key=lambda t: t["x0"])
    merged = []
    for t in tokens:
        if merged and t["x0"] - merged[-1]["x1"] <= gap:
            merged[-1] = {
                "text": merged[-1]["text"] + t["text"],
                "x0": merged[-1]["x0"],
                "x1": t["x1"],
            }
        else:
            merged.append({"text": t["text"], "x0": t["x0"], "x1": t["x1"]})
    return merged


def parse_page(page, label_max_x0, ncols, top_min=110, top_max=800):
    # parse one table page: returns list of (label, {col_index: value_string}) using x1 anchors
    words = [
        w
        for w in page.extract_words()
        if w["x0"] >= 20 and w["x1"] <= page.width - 5 and top_min <= w["top"] <= top_max
    ]
    rows = []
    for row_words in cluster_rows(words):
        # keep every word left of the label boundary, including digits ("Central Pentecost 1")
        # and dashes ("Canal - Fanafo"); values live strictly right of the boundary
        label_words = sorted(
            (w for w in row_words if w["x0"] < label_max_x0), key=lambda w: w["x0"]
        )
        if all(is_value_token(w["text"]) for w in label_words):
            continue
        value_words = [w for w in row_words if w["x0"] >= label_max_x0 and is_value_token(w["text"])]
        if not label_words or len(value_words) < 3:
            continue
        label = " ".join(w["text"] for w in label_words)
        if any(k in label for k in ("Region", "Place of residence", "Table", "Religion")):
            continue
        tokens = merge_fragments(value_words)
        rows.append((label, tokens))

    # derive column anchors from token right edges across the whole page
    edges = sorted(t["x1"] for _, tokens in rows for t in tokens)
    anchors, group = [], [edges[0]]
    for e in edges[1:]:
        if e - group[-1] > 8:
            anchors.append(max(group))
            group = []
        group.append(e)
    anchors.append(max(group))
    if len(anchors) != ncols:
        raise ValueError(f"page {page.page_number}: expected {ncols} columns, found {len(anchors)}: {anchors}")

    parsed = []
    for label, tokens in rows:
        cells = {}
        for t in tokens:
            dists = [abs(t["x1"] - a) for a in anchors]
            ci = dists.index(min(dists))
            if min(dists) > 10:
                raise ValueError(f"page {page.page_number} row '{label}': token {t} matches no column")
            if ci in cells:
                raise ValueError(f"page {page.page_number} row '{label}': column {ci} filled twice")
            cells[ci] = t["text"]
        parsed.append((label, cells))
    return parsed


def to_count(text):
    # dash means zero in these tables
    if text in DASH_CHARS or all(c in DASH_CHARS for c in text):
        return 0
    return int(text.replace(",", ""))


NORMALISE = {
    "Total": "total",
    "Anglican": "anglican",
    "Presbyterian": "presbyterian",
    "Catholic": "catholic",
    "SDA": "seventh_day_adventist",
    "Seventh Day Adventist (SDA)": "seventh_day_adventist",
    "Church of Christ": "church_of_christ",
    "Churches of Christ": "church_of_christ",
    "AOG": "assemblies_of_god",
    "Assemblies of God (AOG)": "assemblies_of_god",
    "Assemblies of God": "assemblies_of_god",
    "NTM": "neil_thomas_ministry",
    "Neil Thomas Ministry / Inner Life Ministry": "neil_thomas_ministry",
    "Neil Thomas Ministry": "neil_thomas_ministry",
    "Apostolic": "apostolic",
    "Others": "other",
    "Other": "other",
    "Other churches": "other",
    "Customary beliefs": "customary_beliefs",
    "Latter Day Saints (Mormon)": "latter_day_saints",
    "Latter-day Saints (Mormon)": "latter_day_saints",
    "No religion": "no_religion",
    "No Religion/Faith": "no_religion",
    "Refuse to answer": "refuse_to_answer",
    "Not Stated": "not_stated",
}

PROVINCES = {"TORBA", "SANMA", "PENAMA", "MALAMPA", "SHEFA", "TAFEA"}


def geo_level(label, year):
    if label == "VANUATU":
        return "nation"
    if label in ("URBAN", "RURAL"):
        return "urban_rural_total"
    if label in ("Port Vila", "Luganville"):
        return "urban_municipality"
    if label.upper() == label and label in PROVINCES:
        return "province"
    return "area_council" if year == 2020 else "island"


def fix_label(label):
    # normalise unicode dashes/apostrophes and stray double spaces in row labels
    label = unicodedata.normalize("NFKC", label)
    return re.sub(r"\s+", " ", label).strip()


def extract_2020():
    # 2020 basic tables vol 1, table 3.5: pdf pages 62-65; panel 1 (9 cols) pages 62-63, panel 2 (6 cols) pages 64-65
    cols_p1 = [
        "Total",
        "Presbyterian",
        "Seventh Day Adventist (SDA)",
        "Catholic",
        "Anglican",
        "Churches of Christ",
        "Assemblies of God (AOG)",
        "Neil Thomas Ministry / Inner Life Ministry",
        "Customary beliefs",
    ]
    cols_p2 = [
        "Apostolic",
        "Latter Day Saints (Mormon)",
        "Other churches",
        "No Religion/Faith",
        "Refuse to answer",
        "Not Stated",
    ]
    pdf = pdfplumber.open(BASE / "vu_2020_census_basic_tables_vol1.pdf")
    panel1, panel2 = [], []
    for pno in (61, 62):
        panel1 += parse_page(pdf.pages[pno], label_max_x0=130, ncols=9)
    for pno in (63, 64):
        panel2 += parse_page(pdf.pages[pno], label_max_x0=130, ncols=6)

    labels1 = [fix_label(l) for l, _ in panel1]
    labels2 = [fix_label(l) for l, _ in panel2]
    assert labels1 == labels2, f"row label mismatch between panels:\n{labels1}\n{labels2}"

    records = {}
    for (label, cells1), (_, cells2) in zip(panel1, panel2):
        label = fix_label(label)
        rec = {}
        for i, col in enumerate(cols_p1):
            rec[col] = to_count(cells1[i]) if i in cells1 else 0
        for i, col in enumerate(cols_p2):
            rec[col] = to_count(cells2[i]) if i in cells2 else 0
        records[label] = rec
    return records, cols_p1 + cols_p2


def extract_2009():
    # 2009 basic tables vol 1, table 3.5: pdf pages 34-35, 13 columns
    cols = [
        "Total",
        "Anglican",
        "Presbyterian",
        "Catholic",
        "SDA",
        "Church of Christ",
        "AOG",
        "NTM",
        "Apostolic",
        "Others",
        "Customary beliefs",
        "No religion",
        "Refuse to answer",
    ]
    pdf = pdfplumber.open(BASE / "vu_2009_census_basic_tables_vol1.pdf")
    rows = []
    for pno in (33, 34):
        rows += parse_page(pdf.pages[pno], label_max_x0=130, ncols=13, top_max=790)
    records = {}
    for label, cells in rows:
        label = fix_label(label)
        if label.startswith("*"):
            continue
        records[label] = {col: (to_count(cells[i]) if i in cells else 0) for i, col in enumerate(cols)}
    return records, cols


def write_long_csv(path, records, cols, year, order):
    # long format: one row per geography x religion category, including the Total row
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "geography",
                "geo_level",
                "province",
                "census_year",
                "religion_label_source",
                "religion_label_normalised",
                "count",
            ]
        )
        province = ""
        for label in order:
            lvl = geo_level(label, year)
            if lvl == "province":
                province = label.title()
            prov_out = (
                province
                if lvl in ("area_council", "island")
                else (label.title() if lvl == "province" else "")
            )
            for col in cols:
                w.writerow(
                    [label, lvl, prov_out, year, col, NORMALISE[col], records[label][col]]
                )


def validate(records, cols, year, report):
    # cross-checks: category sums vs total; hierarchy sums
    cats = [c for c in cols if c != "Total"]
    bad = []
    for label, rec in records.items():
        s = sum(rec[c] for c in cats)
        if s != rec["Total"]:
            bad.append(f"  {label}: categories sum {s:,} vs Total {rec['Total']:,} (diff {s - rec['Total']:+d})")
    report.append(f"[{year}] rows: {len(records)}; category-sum-vs-total mismatches: {len(bad)}")
    report.extend(bad)

    provs = [l for l in records if geo_level(l, year) == "province"]
    for col in cols:
        psum = sum(records[p][col] for p in provs)
        nat = records["VANUATU"][col]
        rural = records["RURAL"][col]
        urban = records["URBAN"][col]
        pvl = records["Port Vila"][col] + records["Luganville"][col]
        if urban + rural != nat:
            report.append(f"  [{year}] {col}: URBAN+RURAL {urban + rural:,} != VANUATU {nat:,}")
        if pvl != urban:
            report.append(f"  [{year}] {col}: PortVila+Luganville {pvl:,} != URBAN {urban:,}")
        target_name = "RURAL" if year == 2020 else "VANUATU"
        target = rural if year == 2020 else nat
        if psum != target:
            report.append(f"  [{year}] {col}: province sum {psum:,} != {target_name} {target:,}")
    # sub-units sum to province
    sub_level = "area_council" if year == 2020 else "island"
    order = list(records)
    current = None
    groups = {}
    for label in order:
        lvl = geo_level(label, year)
        if lvl == "province":
            current = label
        elif lvl == sub_level and current:
            groups.setdefault(current, []).append(label)
    for prov, subs in groups.items():
        for col in cols:
            s = sum(records[x][col] for x in subs)
            if s != records[prov][col]:
                report.append(
                    f"  [{year}] {prov} {col}: {sub_level} sum {s:,} != province {records[prov][col]:,}"
                )
    report.append(f"[{year}] hierarchy checks done (only mismatches listed above)")


def main():
    report = []
    rec20, cols20 = extract_2020()
    rec09, cols09 = extract_2009()

    write_long_csv(
        BASE / "vu_religion_by_region_2020_basictables_t3_5.csv", rec20, cols20, 2020, list(rec20)
    )
    write_long_csv(
        BASE / "vu_religion_by_province_2009_basictables_t3_5.csv", rec09, cols09, 2009, list(rec09)
    )

    validate(rec20, cols20, 2020, report)
    validate(rec09, cols09, 2009, report)

    # derived 2020 provinces including urban municipalities (port vila -> shefa, luganville -> sanma)
    with open(BASE / "vu_religion_by_province_2020_incl_urban_DERIVED.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "province",
                "census_year",
                "religion_label_source",
                "religion_label_normalised",
                "count",
                "derivation",
            ]
        )
        for prov in ["TORBA", "SANMA", "PENAMA", "MALAMPA", "SHEFA", "TAFEA"]:
            for col in cols20:
                v = rec20[prov][col]
                deriv = "province (rural) as published"
                if prov == "SANMA":
                    v += rec20["Luganville"][col]
                    deriv = "province (rural) + Luganville"
                if prov == "SHEFA":
                    v += rec20["Port Vila"][col]
                    deriv = "province (rural) + Port Vila"
                w.writerow([prov.title(), 2020, col, NORMALISE[col], v, deriv])

    print("\n".join(report))
    print("national 2020 total:", rec20["VANUATU"]["Total"])
    print("national 2009 total:", rec09["VANUATU"]["Total"])


if __name__ == "__main__":
    main()
