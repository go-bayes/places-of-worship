#!/usr/bin/env python3
"""Seed Vanuatu verification tasks from the Vanuatu Christian Council's list of Port Vila churches.

Input: the council's list as Guy Lavender Forsyth transcribed it ("Churches in Port Vila and
Their Locations.docx", email of 2026-09-04; filed off-Git at pow-research
data/raw/vu_council_list_2026/vcc_churches_in_port_vila_2026.docx). The list names 61
churches said to be operating in Port Vila in September 2026, each with a rough location
phrase. Names and location phrases are kept verbatim, typos included, per Guy's note.

Outputs:
  apps/regions/vu/data/source/vu_port_vila_council_list_2026.csv  (batch-import format, committed)
  exports/convex-task-seed/vu-vila-council-list-2026-001.json      (ignored local data)
  exports/convex-task-seed/vu-vila-council-list-2026-001.run.json  (payload + actor_email)

Each row's point is one of: a named OSM place of worship whose name matches the entry
(osm_name_match), the OSM centroid of the locality the phrase names (described_locality, the
same centroids as the 2010 survey batch), or the Port Vila centroid when the phrase gives no
locality (regional_only). The location table below records that reading; the verbatim phrase
travels with the task as location_as_given.

Run: python3 scripts/build_vu_council_list_tasks.py [path/to/docx]
Then, as the seeding service user (docs/development/convex-task-layer-setup.md):
  npx convex run tasks:adminUpsertTasksFromStaticMap "$(cat exports/convex-task-seed/vu-vila-council-list-2026-001.run.json)"
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = Path.home() / "GIT" / "pow-research" / "data" / "raw" / "vu_council_list_2026" / "vcc_churches_in_port_vila_2026.docx"
CSV_PATH = REPO / "apps" / "regions" / "vu" / "data" / "source" / "vu_port_vila_council_list_2026.csv"
SURVEY_CSV_PATH = REPO / "apps" / "regions" / "vu" / "data" / "source" / "vu_port_vila_churches_2010.csv"
OSM_PATH = REPO / "archive" / "osm-vu-pow" / "pow_vu.json"
OUT_PATH = REPO / "exports" / "convex-task-seed" / "vu-vila-council-list-2026-001.json"

BATCH_ID = "vu-vila-council-list-2026-001"
COUNTRY = "VU"
TAXONOMY_VERSION = "2026-06-12.1"
# same census years as the survey batch so the vu portal shows one set of year states;
# the council attests 2026 only, earlier years stay not_assessed unless the RA learns more
TARGET_YEARS = [1989, 1999, 2009, 2020]
SOURCE_CITATION = (
    "Vanuatu Christian Council (2026). Churches in Port Vila and their locations. List of churches "
    "operating in Port Vila, brainstormed by council staff for Guy Lavender Forsyth, September 2026; "
    "transcribed verbatim by Guy (email to J. Bulbulia, 2026-09-04)."
)
PORT_VILA_CENTROID = (-17.7415, 168.3150)
NEARBY_RADIUS_M = 400

# locality centroids: OSM neighbourhood/village nodes via Nominatim 2026-09-06, or the same
# points the 2010 survey batch used for the same names (so both batches share a centroid)
LOCALITIES = {
    "Freswota 1": (-17.7215, 168.3205),
    "Freswota 3": (-17.7215, 168.3205),
    "Freswota 4": (-17.7215, 168.3205),
    "Freswota 5": (-17.7191, 168.3195),
    "Freswota": (-17.7215, 168.3205),
    "Nambatu": (-17.7499, 168.3160),
    "Nambatri": (-17.7575, 168.3139),
    "Pango": (-17.7765, 168.2907),
    "Ohlen": (-17.7160, 168.3172),
    "Ohlen Freswind": (-17.7129, 168.3172),
    "Ohlen Whitewood": (-17.7163, 168.3186),
    "Seaside": (-17.7447, 168.3210),
    "Erakor": (-17.7744, 168.3161),
    "Tebakor": (-17.7177, 168.3107),
    "Simbolo": (-17.7192, 168.3181),
    "Tagabe": (-17.7067, 168.3094),
    "Wan Smolbag, Tagabe": (-17.7057, 168.3076),
    "Beverly Hills": (-17.7245, 168.3251),
    "Agathis": (-17.7113, 168.3120),
    "Anabrou": (-17.7218, 168.3132),
    "Namburu": (-17.7218, 168.3132),
    "Vila Central Hospital, Seaside": (-17.7426, 168.3214),
    "Bauerfield Airport, Tagabe": (-17.6991, 168.3193),
    "Route Pompidou, Stade": (-17.7327, 168.3155),
}

# per entry (1-based list number): religion as read from the name, taxonomy code, locality key or
# None, geocoding basis, location confidence, matched OSM object, transcription note.
# codes: "" = body named but not in the taxonomy; "christian" = name states no affiliation.
E = {}
def _e(n, religion, code, locality, basis, confidence, osm=None, note=""):
    E[n] = dict(religion=religion, code=code, locality=locality, basis=basis, confidence=confidence, osm=osm, note=note)

_e(1, "Apostolic", "", "Freswota 3", "described_locality", "low")
_e(2, "United Pentecostal Church", "christian.pentecostal", None, "osm_name_match", "medium", "node/5349063832",
   "Location phrase names the Lycée Antoine de Bougainville (not in OSM). Point is OSM 'United Pentecostal Church' near Anabrou; the name match is partial, confirm.")
_e(3, "Christian (affiliation not stated)", "christian", "Nambatu", "described_locality", "low")
_e(4, "Christian (affiliation not stated)", "christian", "Pango", "described_locality", "low")
_e(5, "Pentecostal", "christian.pentecostal", "Ohlen Freswind", "described_locality", "low")
_e(6, "Anglican", "christian.anglican", "Seaside", "described_locality", "low")
_e(7, "Presbyterian", "christian.presbyterian", "Erakor", "described_locality", "low")
_e(8, "Presbyterian (youth)", "christian.presbyterian", None, "osm_name_match", "medium", "node/5349175323",
   "Council gives 'Port Vila' only. Point is OSM 'Malasitapu' in Freswota; the survey batch has a Freswota site at the same point. Confirm this is a worship site, not only a youth programme.")
_e(9, "Christian (affiliation not stated)", "christian", "Tebakor", "described_locality", "low")
_e(10, "Christian Mission Fellowship International", "christian.pentecostal", "Simbolo", "described_locality", "low",
   note="See entry 53, also CMFI at Simbolo; possibly the same congregation.")
_e(11, "Seventh-day Adventist", "christian.seventh_day_adventist", "Ohlen Freswind", "described_locality", "low",
   note="Council gives 'Port Vila' only; locality read from the name (Freshwind = Ohlen Freswind).")
_e(12, "Seventh-day Adventist", "christian.seventh_day_adventist", None, "osm_name_match", "high", "node/5349196221")
_e(13, "Seventh-day Adventist", "christian.seventh_day_adventist", None, "regional_only", "low",
   note="Mission headquarters with a PO Box only; may not be a worship site.")
_e(14, "Christian (affiliation not stated)", "christian", "Nambatri", "described_locality", "low")
_e(15, "Christian (affiliation not stated)", "christian", "Wan Smolbag, Tagabe", "described_locality", "medium",
   note="Point is the Wan Smolbag theatre (OSM); the church is described as behind it.")
_e(16, "Assemblies of God", "christian.pentecostal", None, "osm_name_match", "high", "way/332930201")
_e(17, "Presbyterian", "christian.presbyterian", None, "osm_name_match", "high", "node/11817228242")
_e(18, "Christian (affiliation not stated)", "christian", "Freswota 1", "described_locality", "low")
_e(19, "Church of Christ", "christian.church_of_christ", "Freswota 1", "described_locality", "low")
_e(20, "Christian (affiliation not stated)", "christian", "Route Pompidou, Stade", "described_locality", "low",
   note="'Pompiptu' read as Pompidou (Route Pompidou, Stade area); unverified reading.")
_e(21, "Presbyterian", "christian.presbyterian", None, "osm_name_match", "high", "way/333002330")
_e(22, "Presbyterian", "christian.presbyterian", "Seaside", "described_locality", "low", note="Seaside Futuna community.")
_e(23, "Presbyterian", "christian.presbyterian", "Seaside", "described_locality", "low", note="Seaside Tongoa community.")
_e(24, "Church of Christ", "christian.church_of_christ", None, "osm_name_match", "high", "node/6117356871")
_e(25, "Church of Christ", "christian.church_of_christ", "Vila Central Hospital, Seaside", "described_locality", "medium",
   note="Point is Vila Central Hospital (OSM); the church is described as opposite it.")
_e(26, "Presbyterian Reformed", "christian.reformed", "Freswota 5", "described_locality", "low")
_e(27, "Assemblies of God", "christian.pentecostal", "Freswota 5", "described_locality", "low")
_e(28, "Christian (affiliation not stated)", "christian", None, "regional_only", "low",
   note="Location given only as '(VCC)'; possibly meets at Vanuatu Christian Council premises. Ask the council.")
_e(29, "Seventh-day Adventist", "christian.seventh_day_adventist", None, "regional_only", "low",
   note="Location given only as '(VCC)'; possibly meets at Vanuatu Christian Council premises. Ask the council.")
_e(30, "Christian (affiliation not stated)", "christian", None, "regional_only", "low",
   note="Location given only as '(VCC)'; possibly meets at Vanuatu Christian Council premises. Ask the council.")
_e(31, "Presbyterian", "christian.presbyterian", "Beverly Hills", "described_locality", "low")
_e(32, "Assemblies of God", "christian.pentecostal", "Beverly Hills", "described_locality", "low")
_e(33, "Presbyterian", "christian.presbyterian", "Beverly Hills", "described_locality", "low")
_e(34, "Apostolic", "", "Beverly Hills", "described_locality", "low")
_e(35, "Seventh-day Adventist", "christian.seventh_day_adventist", None, "osm_name_match", "high", "node/6763543388")
_e(36, "Church of Christ", "christian.church_of_christ", "Beverly Hills", "described_locality", "low")
_e(37, "Anglican", "christian.anglican", "Tagabe", "described_locality", "low")
_e(38, "Anglican", "christian.anglican", "Freswota", "described_locality", "low")
_e(39, "Anglican", "christian.anglican", "Seaside", "described_locality", "low", note="'Seaside Tonga', read as Seaside Tongoa.")
_e(40, "Presbyterian", "christian.presbyterian", "Bauerfield Airport, Tagabe", "described_locality", "low",
   note="Point is Bauerfield airport (OSM); the church is described as at the airport.")
_e(41, "Presbyterian", "christian.presbyterian", "Tagabe", "described_locality", "low", note="Described as at Tagabe Bridge.")
_e(42, "Presbyterian", "christian.presbyterian", "Ohlen Whitewood", "described_locality", "low")
_e(43, "Apostolic", "", "Ohlen", "described_locality", "low")
_e(44, "Presbyterian", "christian.presbyterian", "Ohlen", "described_locality", "low", note="Ohlen Mataso community.")
_e(45, "Presbyterian", "christian.presbyterian", "Ohlen Freswind", "described_locality", "low")
_e(46, "Apostolic Life Ministry", "", "Ohlen", "described_locality", "low")
_e(47, "Christian (affiliation not stated)", "christian", "Freswota 3", "described_locality", "low")
_e(48, "Foursquare (Pentecostal)", "christian.pentecostal", "Freswota 1", "described_locality", "low",
   note="OSM has a Foursquare Gospel Church at Tagabe, not Freswota; not matched.")
_e(49, "Presbyterian", "christian.presbyterian", None, "osm_name_match", "high", "node/4874870727",
   note="OSM spells it 'Pakaroa Presbyterian Church'; it sits in Agathis, the locality the council gives ('Agasi').")
_e(50, "Neil Thomas Ministries", "", "Agathis", "described_locality", "low")
_e(51, "Neil Thomas Ministries", "", None, "osm_name_match", "medium", "node/4336537376",
   note="Point is an OSM node named 'NTM' in Freswota; a second NTM node sits 20 m away.")
_e(52, "Seventh-day Adventist", "christian.seventh_day_adventist", "Simbolo", "described_locality", "low")
_e(53, "Christian Mission Fellowship International", "christian.pentecostal", "Simbolo", "described_locality", "low",
   note="See entry 10, Pasifika Harvest Centre (CMFI) at Simbolo; possibly the same congregation.")
_e(54, "Christian (affiliation not stated)", "christian", "Simbolo", "described_locality", "low")
_e(55, "Apostolic", "", None, "osm_name_match", "medium", "way/332869006",
   note="Point is OSM 'Apostolic Church' in Ohlen; the council says Ohlen Nabaga.")
_e(56, "Christian (affiliation not stated)", "christian", "Ohlen", "described_locality", "low")
_e(57, "Christian (affiliation not stated)", "christian", "Freswota 4", "described_locality", "low")
_e(58, "New Covenant Church", "", None, "osm_name_match", "high", "node/5371386023")
_e(59, "Catholic", "christian.catholic", "Anabrou", "described_locality", "low")
_e(60, "Catholic", "christian.catholic", None, "osm_name_match", "medium", "way/332908898",
   note="'Barai' read as Paray: OSM 'Eglise du Coeur Immaculé de Marie de Paray' in Nambatu.")
_e(61, "Catholic", "christian.catholic", None, "osm_name_match", "high", "way/319762684")

CSV_FIELDS = [
    "name", "country_code", "religion", "denomination_code", "taxonomy_version", "lat", "lng",
    "locality", "location_as_given", "containing_area", "geocoding_basis", "location_confidence",
    "matched_osm_id", "source_locator", "source_url", "first_date", "last_date", "date_confidence",
    "culturally_sensitive", "notes",
]

STOPWORDS = {
    "church", "churches", "of", "the", "and", "de", "du", "in", "presbyterian", "anglican", "catholic",
    "christian", "seventh", "seven", "day", "adventist", "adventists", "sda", "pentecostal", "ministry",
    "ministries", "centre", "center", "fellowship", "vanuatu", "port", "vila", "international", "memorial",
    "tabernacle", "assembly", "assemblies", "god", "aog", "life", "christ", "hills", "bevelly", "beverly",
    "temple", "united", "mission", "hq",
}


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def read_docx_rows(path: Path) -> list[tuple[str, str]]:
    # the docx holds one two-column table: numbered church name, location phrase
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8")
    cells = []
    for tc in re.findall(r"<w:tc[ >].*?</w:tc>", xml, flags=re.S):
        text = "".join(re.findall(r"<w:t(?: [^>]*)?>(.*?)</w:t>", tc, flags=re.S))
        text = (text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", '"').replace("&apos;", "'"))
        cells.append(text.strip())
    rows = []
    for i in range(0, len(cells) - 1, 2):
        name, loc = cells[i], cells[i + 1]
        m = re.match(r"^(\d+)\.\s*(.*)$", name)
        if not m:
            continue
        rows.append((re.sub(r"\s+", " ", m.group(2)).strip(), loc))
    return rows


def load_osm_points() -> tuple[list[dict], dict[str, dict]]:
    if not OSM_PATH.exists():
        return [], {}
    data = json.loads(OSM_PATH.read_text(encoding="utf-8"))
    elements = data.get("elements", data) if isinstance(data, dict) else data
    points, by_id = [], {}
    for el in elements:
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lng is None:
            continue
        tags = el.get("tags", {})
        p = {
            "osm_id": f"{el.get('type', 'node')}/{el.get('id')}",
            "name": tags.get("name") or "",
            "denomination": tags.get("denomination") or "",
            "lat": float(lat),
            "lng": float(lng),
        }
        points.append(p)
        by_id[p["osm_id"]] = p
    return points, by_id


def build_csv(docx: Path, osm_by_id: dict[str, dict]) -> list[dict]:
    entries = read_docx_rows(docx)
    if len(entries) != len(E):
        raise SystemExit(f"docx has {len(entries)} entries, location table has {len(E)}")
    rows = []
    for n, (name, loc) in enumerate(entries, start=1):
        e = E[n]
        if e["basis"] == "osm_name_match":
            p = osm_by_id.get(e["osm"])
            if not p:
                raise SystemExit(f"entry {n}: OSM {e['osm']} not in {OSM_PATH}")
            lat, lng, locality = p["lat"], p["lng"], ""
        elif e["basis"] == "described_locality":
            lat, lng = LOCALITIES[e["locality"]]
            locality = e["locality"]
        else:
            lat, lng, locality = "", "", ""
        rows.append({
            "name": name,
            "country_code": COUNTRY,
            "religion": e["religion"],
            "denomination_code": e["code"],
            "taxonomy_version": TAXONOMY_VERSION,
            "lat": f"{lat:.4f}" if lat != "" else "",
            "lng": f"{lng:.4f}" if lng != "" else "",
            "locality": locality,
            "location_as_given": loc,
            "containing_area": "Port Vila" if n != 4 and n != 7 else "Efate",
            "geocoding_basis": e["basis"],
            "location_confidence": e["confidence"],
            "matched_osm_id": e["osm"] or "",
            "source_locator": f"council list entry {n}",
            "source_url": "",
            "first_date": "",
            "last_date": "2026-09",
            "date_confidence": "attested_operating",
            "culturally_sensitive": "",
            "notes": e["note"],
        })
    return rows


def write_csv(rows: list[dict]) -> None:
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(rows)


def name_tokens(name: str) -> set[str]:
    return {t for t in re.findall(r"[a-zà-ÿ]+", name.lower()) if len(t) > 3 and t not in STOPWORDS}


def survey_matches(row: dict, lat: float, lng: float, survey: list[dict]) -> list[str]:
    # survey rows that share a distinctive name token, or the same denomination within 300 m
    out = []
    toks = name_tokens(row["name"])
    for s in survey:
        shared = toks & name_tokens(s["name"])
        close = False
        if s["lat"] and row["denomination_code"] and s["denomination_code"] == row["denomination_code"]:
            close = haversine_m(lat, lng, float(s["lat"]), float(s["lng"])) <= 300
        if shared or close:
            why = "name" if shared else "same denomination nearby"
            out.append(f"{s['name']} ({s['locality'] or 'no locality'}; {why})")
    return out[:4]


def priority_for(row: dict) -> str:
    if row["geocoding_basis"] == "osm_name_match":
        return "high"
    if row["geocoding_basis"] == "regional_only":
        return "low"
    return "medium"


def checks_for(row: dict, nearby: list[dict], survey_hits: list[str]) -> list[dict]:
    checks = [{
        "check_id": "council_list_lead",
        "severity": "info",
        "message": "Named by the Vanuatu Christian Council (September 2026) as a church operating in Port Vila. Confirm on the ground: is there a place of worship, and where exactly?",
        "suggested_action": "seek_source_evidence",
    }]
    if row["geocoding_basis"] == "osm_name_match":
        checks.append({
            "check_id": "location_from_osm_name_match",
            "severity": "info" if row["location_confidence"] == "high" else "warning",
            "message": f"Point is OSM {row['matched_osm_id']}, whose name matches the council entry ({row['location_confidence']} confidence). Confirm it is the same site.",
            "suggested_action": "review_location",
        })
    elif row["geocoding_basis"] == "described_locality":
        checks.append({
            "check_id": "location_is_locality_centroid",
            "severity": "warning",
            "message": f"Point is the centroid of '{row['locality']}', read from the council's phrase '{row['location_as_given']}'. Record the actual location.",
            "suggested_action": "review_location",
        })
    else:
        checks.append({
            "check_id": "location_regional_only",
            "severity": "blocker",
            "message": f"The council's location phrase '{row['location_as_given']}' names no locality; the point is the Port Vila centroid. Locate the site or mark it unlocatable.",
            "suggested_action": "review_location",
        })
    if not row["denomination_code"]:
        checks.append({
            "check_id": "denomination_unmatched",
            "severity": "info",
            "message": f"'{row['religion']}' has no code in the project denomination taxonomy; record the body's own description.",
            "suggested_action": "review_if_needed",
        })
    elif row["denomination_code"] == "christian":
        checks.append({
            "check_id": "affiliation_not_stated",
            "severity": "info",
            "message": "The council's entry names no affiliation; record the body's own description on the visit.",
            "suggested_action": "review_if_needed",
        })
    if nearby:
        names = ", ".join(f"{n['name']} ({n['distance_m']} m)" for n in nearby[:3])
        checks.append({
            "check_id": "nearby_osm_place_of_worship",
            "severity": "info",
            "message": f"OSM place(s) of worship within {NEARBY_RADIUS_M} m: {names}. Check whether one is this site.",
            "suggested_action": "review_duplicate",
        })
    if survey_hits:
        checks.append({
            "check_id": "possibly_in_survey_batch",
            "severity": "info",
            "message": "Possibly the same site as a 2010 survey task (batch vu-port-vila-survey-2010-001): " + "; ".join(survey_hits) + ". If so, verify once and note the match on both.",
            "suggested_action": "review_duplicate",
        })
    if "may not be a worship site" in row["notes"] or "youth programme" in row["notes"]:
        checks.append({
            "check_id": "site_status_uncertain",
            "severity": "warning",
            "message": "The entry may name an organisation or programme rather than a worship site. Confirm whether a place of worship exists.",
            "suggested_action": "review_inclusion",
        })
    return checks


def brief_for(row: dict) -> str:
    where = row["locality"] or ("the OSM-matched site" if row["matched_osm_id"] else "Port Vila")
    return (
        f"Verify {row['name']} ({row['religion']}) in {where}; the Vanuatu Christian Council listed it in "
        f"September 2026 as a church operating in Port Vila, location given as '{row['location_as_given']}'. "
        f"Confirm there is a place of worship, record the exact location, the body's own name and affiliation, "
        f"and anything known about when worship began here. Council list entry: {row['source_locator']}."
    )


def build(docx: Path) -> dict:
    osm_points, osm_by_id = load_osm_points()
    rows = build_csv(docx, osm_by_id)
    write_csv(rows)
    csv_sha = hashlib.sha256(CSV_PATH.read_bytes()).hexdigest()
    docx_sha = hashlib.sha256(docx.read_bytes()).hexdigest()
    survey = list(csv.DictReader(SURVEY_CSV_PATH.open(encoding="utf-8"))) if SURVEY_CSV_PATH.exists() else []
    tasks = []
    for index, row in enumerate(rows, start=1):
        if row["lat"]:
            lat, lng = float(row["lat"]), float(row["lng"])
        else:
            lat, lng = PORT_VILA_CENTROID
        nearby = []
        for p in osm_points:
            d = haversine_m(lat, lng, p["lat"], p["lng"])
            if d <= NEARBY_RADIUS_M and p["osm_id"] != row["matched_osm_id"]:
                label = f"{p['name'] or 'unnamed place of worship'} (OSM {p['osm_id']})"
                nearby.append({"name": label, "distance_m": round(d)})
        nearby.sort(key=lambda n: n["distance_m"])
        survey_hits = survey_matches(row, lat, lng, survey)
        checks = checks_for(row, nearby, survey_hits)
        digest = hashlib.sha256(f"{row['source_locator']}|{row['name']}".encode("utf-8")).hexdigest()[:12]
        tid = f"vu-council2026-{index:03d}-{digest}"
        task = {
            "task_id": tid,
            "batch_id": BATCH_ID,
            "country_code": COUNTRY,
            "task_type": "missing_from_project_map",
            "priority": priority_for(row),
            "status": "open",
            "target_years": TARGET_YEARS,
            "candidate_site_id": f"candidate:{tid}",
            "source_record_id": f"{CSV_PATH.relative_to(REPO)}:{index}",
            "name": row["name"],
            "locality": row["locality"] or None,
            "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
            "nearby_site_refs": nearby[:5],
            "automated_checks": checks,
            "task_brief": brief_for(row),
            "source_context": {
                "case_type": "council_list_lead",
                "selection_reason": "Seeded from the Vanuatu Christian Council's September 2026 list of Port Vila churches for Guy Lavender Forsyth's field verification.",
                "council_list": {
                    "citation": SOURCE_CITATION,
                    "locator": row["source_locator"],
                    "name_as_given": row["name"],
                    "location_as_given": row["location_as_given"],
                    "religion_as_read": row["religion"],
                    "denomination_code": row["denomination_code"] or None,
                    "attested_operating": "2026-09",
                    "transcription_notes": row["notes"],
                    "source_docx_sha256": docx_sha,
                },
                "location": {
                    "geocoding_basis": row["geocoding_basis"],
                    "location_confidence": row["location_confidence"],
                    "matched_osm_id": row["matched_osm_id"] or None,
                    "containing_area": row["containing_area"],
                },
                "source_file": str(CSV_PATH.relative_to(REPO)),
                "source_file_sha256": csv_sha,
                "source_row": index,
                "source_hints": "Start from the council's name and location phrase (verbatim, typos included). Confirm on site or with the congregation; use imagery only as a secondary aid. Answer the cultural-sensitivity prompt before submitting.",
                "target_year_statuses": {str(y): {"status": "not_assessed", "basis": "", "evidence": ""} for y in TARGET_YEARS},
            },
        }
        if row["matched_osm_id"]:
            kind, _, _ = row["matched_osm_id"].partition("/")
            task["matched_osm_id"] = row["matched_osm_id"]
            task["osm_object_type"] = kind
        if row["locality"] is None or row["locality"] == "":
            task.pop("locality")
        tasks.append(task)
    batch = {
        "batch_id": BATCH_ID,
        "country_code": COUNTRY,
        "source_kind": "spreadsheet_submission",
        "source_manifest_id": f"vu_port_vila_council_list_2026.csv:{csv_sha[:12]}",
        "target_years": TARGET_YEARS,
        "status": "active",
        "notes": (
            f"Port Vila churches seeded from {SOURCE_CITATION} Tabulated 2026-09-06 "
            f"(scripts/build_vu_council_list_tasks.py); {len(tasks)} tasks; CSV SHA-256 {csv_sha}; docx SHA-256 {docx_sha}. "
            "Tasks are prompts for field verification by the Vanuatu RA, not accepted project records."
        ),
    }
    return {"batch": batch, "tasks": tasks}


SERVICE_ACTOR_EMAIL = "service+claude@religionmap.org"
RUN_PATH = OUT_PATH.with_suffix(".run.json")


def main() -> None:
    docx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DOCX
    if not docx.exists():
        raise SystemExit(f"council docx not found: {docx}")
    payload = build(docx)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    RUN_PATH.write_text(
        json.dumps({"actor_email": SERVICE_ACTOR_EMAIL, **payload}, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    tasks = payload["tasks"]
    by_priority: dict[str, int] = {}
    for t in tasks:
        by_priority[t["priority"]] = by_priority.get(t["priority"], 0) + 1
    by_basis: dict[str, int] = {}
    for t in tasks:
        b = t["source_context"]["location"]["geocoding_basis"]
        by_basis[b] = by_basis.get(b, 0) + 1
    with_survey = sum(1 for t in tasks if any(c["check_id"] == "possibly_in_survey_batch" for c in t["automated_checks"]))
    print(f"wrote {len(tasks)} rows to {CSV_PATH.relative_to(REPO)}")
    print(f"wrote {len(tasks)} tasks for batch {BATCH_ID} to {OUT_PATH.relative_to(REPO)}")
    print(f"wrote run args (actor {SERVICE_ACTOR_EMAIL}) to {RUN_PATH.relative_to(REPO)}")
    print(f"priority: {by_priority}; basis: {by_basis}; tasks with a possible 2010 survey match: {with_survey}")


if __name__ == "__main__":
    main()
