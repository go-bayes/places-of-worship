#!/usr/bin/env python3
"""digitise missing polish latin diocese boundaries from gmina assignments.

This script completes the practice-lane `pl_diocese_2004` layer by preserving
the 24 OSM-derived anchor dioceses and assigning the remaining national
territory to the 17 missing Latin-rite dioceses by clipped Polish gmina
fragments. The replayable route is:

1. Load Eurostat/GISCO LAU 2024 municipality boundaries, filter Poland, and
   cache the 2,477 Polish LAU features under `data/raw/pl_practice/`.
2. Compute the unassigned zone as the Poland outline minus the 24 anchor
   dioceses.
3. Intersect gminy with the unassigned zone.
4. Scrape Polish Wikipedia deanery categories and pages for the 17 missing
   dioceses, then assign gminy whose names match listed parish localities.
5. Fill remaining gmina fragments by adjacency and diocese-seat distance,
   recording every non-direct assignment in `digitisation_report.json`.
6. Dissolve by diocese, merge with the 24 anchors, validate coverage/overlap
   and published diocese areas, and simplify the merged output with the house
   mapshaper ladder.

The current project Python target is newer than the available Shapely wheels on
some machines. A working local replay command is:

UV_CACHE_DIR=/private/tmp/uv-cache uv run --no-project \
  --python /opt/homebrew/bin/python3.13 \
  --with geopandas==1.1.2 --with shapely==2.1.1 \
  --with pandas==2.3.1 --with pyproj \
  scripts/digitise_pl_diocese_boundaries.py --reuse-cache
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
from shapely import make_valid
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data/raw/pl_practice"
APP_GEOJSON = ROOT / "apps/regions/pl/data/pl_diocese_2004.geojson"
NAMES_CSV = RAW_DIR / "diocese_names.csv"
PARTIAL24_GEOJSON = RAW_DIR / "pl_diocese_2004_partial24.geojson"
POLAND_GEOJSON = RAW_DIR / "pl_osm_relation_49715.geojson"
REPORT_JSON = RAW_DIR / "digitisation_report.json"
GMINA_META_JSON = RAW_DIR / "pl_gmina_boundaries_meta.json"
LAYER_META_JSON = RAW_DIR / "pl_diocese_2004_meta.json"
GISCO_EU_GEOJSON = RAW_DIR / "gisco_lau_rg_01m_2024_4326.geojson"
GISCO_PL_GEOJSON = RAW_DIR / "gisco_lau_pl_2024.geojson"
UNSIMPLIFIED_GEOJSON = RAW_DIR / "pl_diocese_2004_gmina_digitised_unsimplified.geojson"
WIKI_CACHE_DIR = RAW_DIR / "wikipedia_deanery_cache"
POLAND_GEOB_ADM0_META = "https://www.geoboundaries.org/api/current/gbOpen/POL/ADM0/"
GISCO_DOWNLOAD_PAGE = "https://gisco-services.ec.europa.eu/distribution/v2/lau/download/"
GISCO_DOWNLOAD_URL = (
    "https://gisco-services.ec.europa.eu/distribution/v2/lau/geojson/"
    "LAU_RG_01M_2024_4326.geojson"
)
MAX_OUTPUT_BYTES = 1_500_000
BOUNDARY_SET_ID = "pl_diocese_2004"
BOUNDARY_LEVEL = "diocese"
USER_AGENT = "places-of-worship-pl-gmina-digitisation/0.1 (research data preparation)"
SIMPLIFICATION_KEEP_LADDER = [45, 40, 35, 30, 25, 20, 15, 12, 10, 8, 6, 5, 4, 3, 2, 1]
MIN_GMINA_FRAGMENT_KM2 = 0.01
ADJACENCY_BUFFER_METRES = 35.0
OVERLAP_TOLERANCE_PERCENT = 0.5
MIN_COVERAGE_PERCENT = 99.0
PROJECTED_CRS = "EPSG:2180"
PUBLISHED_AREA_TOLERANCE = 0.15
SOFT_VALIDATION_GATES = {"digitised_areas_within_15_percent_of_published"}
OSM_ATTRIBUTION = "© OpenStreetMap contributors"
GISCO_ATTRIBUTION = "Eurostat/GISCO Local Administrative Units 2024"
MIXED_LAYER_LICENCE_NOTE = (
    "The completed pl_diocese_2004 layer mixes 24 OSM-derived anchor polygons "
    "with 17 digitised polygons derived from Eurostat/GISCO LAU 2024 gmina "
    "geometry. Attribute OpenStreetMap as '© OpenStreetMap contributors' under "
    "the Open Database Licence (ODbL), and attribute the gmina-derived polygon "
    "basis as 'Eurostat/GISCO Local Administrative Units 2024'."
)

MISSING_CODES = [
    "bialystok",
    "bydgoszcz",
    "czestochowa",
    "elblag",
    "gdansk",
    "gniezno",
    "kielce",
    "lodz",
    "lomza",
    "lublin",
    "sandomierz",
    "sosnowiec",
    "swidnica",
    "wloclawek",
    "wroclaw",
    "zamosc_lubaczow",
    "zielona_gora_gorzow",
]

WIKIPEDIA_CATEGORIES = {
    "bialystok": "Kategoria:Dekanaty archidiecezji białostockiej",
    "bydgoszcz": "Kategoria:Dekanaty diecezji bydgoskiej",
    "czestochowa": "Kategoria:Dekanaty archidiecezji częstochowskiej",
    "elblag": "Kategoria:Dekanaty diecezji elbląskiej",
    "gdansk": "Kategoria:Dekanaty archidiecezji gdańskiej",
    "gniezno": "Kategoria:Dekanaty archidiecezji gnieźnieńskiej",
    "kielce": "Kategoria:Dekanaty diecezji kieleckiej",
    "lodz": "Kategoria:Dekanaty archidiecezji łódzkiej",
    "lomza": "Kategoria:Dekanaty diecezji łomżyńskiej",
    "lublin": "Kategoria:Dekanaty archidiecezji lubelskiej",
    "sandomierz": "Kategoria:Dekanaty diecezji sandomierskiej",
    "sosnowiec": "Kategoria:Dekanaty diecezji sosnowieckiej",
    "swidnica": "Kategoria:Dekanaty diecezji świdnickiej",
    "wloclawek": "Kategoria:Dekanaty diecezji włocławskiej",
    "wroclaw": "Kategoria:Dekanaty archidiecezji wrocławskiej",
    "zamosc_lubaczow": "Kategoria:Dekanaty diecezji zamojsko-lubaczowskiej",
    "zielona_gora_gorzow": "Kategoria:Dekanaty diecezji zielonogórsko-gorzowskiej",
}

WIKIPEDIA_DIOCESE_AREA_TITLES = {
    "bialystok": "Archidiecezja białostocka",
    "bydgoszcz": "Diecezja bydgoska",
    "czestochowa": "Archidiecezja częstochowska",
    "elblag": "Diecezja elbląska",
    "gdansk": "Archidiecezja gdańska",
    "gniezno": "Archidiecezja gnieźnieńska",
    "kielce": "Diecezja kielecka",
    "lodz": "Archidiecezja łódzka",
    "lomza": "Diecezja łomżyńska",
    "lublin": "Archidiecezja lubelska",
    "sandomierz": "Diecezja sandomierska",
    "sosnowiec": "Diecezja sosnowiecka",
    "swidnica": "Diecezja świdnicka",
    "wloclawek": "Diecezja włocławska",
    "wroclaw": "Archidiecezja wrocławska",
    "zamosc_lubaczow": "Diecezja zamojsko-lubaczowska",
    "zielona_gora_gorzow": "Diecezja zielonogórsko-gorzowska",
}

SEAT_POINTS = {
    "bialystok": [(23.1688, 53.1325)],
    "bydgoszcz": [(18.0084, 53.1235)],
    "czestochowa": [(19.1220, 50.8118)],
    "elblag": [(19.4045, 54.1561)],
    "gdansk": [(18.6466, 54.3520)],
    "gniezno": [(17.5827, 52.5349)],
    "kielce": [(20.6286, 50.8661)],
    "lodz": [(19.4560, 51.7592)],
    "lomza": [(22.0720, 53.1781)],
    "lublin": [(22.5684, 51.2465)],
    "sandomierz": [(21.7490, 50.6829)],
    "sosnowiec": [(19.1041, 50.2863)],
    "swidnica": [(16.4880, 50.8430)],
    "wloclawek": [(19.0677, 52.6483)],
    "wroclaw": [(17.0385, 51.1079)],
    "zamosc_lubaczow": [(23.25197, 50.7230), (23.1234, 50.1570)],
    "zielona_gora_gorzow": [(15.5062, 51.9356), (15.2288, 52.7368)],
}

SPOT_CHECKS = [
    {
        "area_code": "sosnowiec",
        "source": "GIS-Expert 2017 diecezje dominicantes raster and Sosnowiec parish map",
        "source_url": "https://www.gis-expert.pl/mapy-religijnosci-polakow",
        "comparison": (
            "The dissolved polygon sits between Częstochowa/Kielce/Kraków/Katowice, "
            "covering Sosnowiec, Dąbrowa Górnicza, Jaworzno, Olkusz, Wolbrom, "
            "Pilica, Siewierz, Łazy, and Sączów, matching the published small "
            "south-central shape."
        ),
    },
    {
        "area_code": "bydgoszcz",
        "source": "Bydgoszcz diocesan map reproduced on parish site",
        "source_url": "https://duchswiety-bydgoszcz.pl/nasza-parafia/mapa-parafii/",
        "comparison": (
            "The dissolved polygon forms the expected west-of-Bydgoszcz block "
            "with Nakło, Szubin, Kcynia, Łobżenica, Mrocza, Sępólno Krajeńskie, "
            "Białe Błota, and Bydgoszcz."
        ),
    },
    {
        "area_code": "lodz",
        "source": "Archdiocese of Łódź deanery map",
        "source_url": "https://www.archidiecezja.lodz.pl/spis-parafii/",
        "comparison": (
            "The dissolved polygon keeps Łódź central and extends to the "
            "Poddębice, Łask, Zduńska Wola, Bełchatów, Piotrków, Wolbórz, "
            "Tomaszów, Koluszki, Stryków, Zgierz, and Ozorków edges shown "
            "on the published map."
        ),
    },
]

MANUAL_GMINA_OVERRIDES = {
    # Sosnowiec deanery pages list these edge gminy, but several names also
    # appear in neighbouring diocesan evidence or get captured by adjacency.
    "PL_1001121200613": ("sosnowiec", "Sosnowiec deanery evidence: Sułoszowa"),
    "PL_1001121231206": ("sosnowiec", "Sosnowiec deanery evidence: Trzyciąż"),
    "PL_1001121231207": ("sosnowiec", "Sosnowiec deanery evidence: Wolbrom"),
    "PL_1001241500103": ("sosnowiec", "Sosnowiec deanery evidence: Wojkowice"),
    "PL_1001241500104": ("sosnowiec", "Sosnowiec deanery evidence: Bobrowniki"),
    "PL_1001241500105": ("sosnowiec", "Sosnowiec deanery evidence: Mierzęcice"),
    "PL_1001241500107": ("sosnowiec", "Sosnowiec deanery evidence: Siewierz"),
    "PL_1001241501607": ("sosnowiec", "Sosnowiec deanery evidence: Pilica"),
    "PL_1001241506801": ("sosnowiec", "Sosnowiec deanery evidence: Jaworzno"),
}


@dataclass(frozen=True)
class DioceseName:
    """store the output names for one diocese area code."""

    area_code: str
    area_name: str
    area_name_en: str


@dataclass
class Assignment:
    """store one clipped-gmina assignment and its evidence route."""

    row_index: int
    area_code: str
    method: str
    evidence: str
    candidate_dioceses: list[str]


def parse_args() -> argparse.Namespace:
    """parse command-line options and return the selected run controls."""

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reuse-cache",
        action="store_true",
        help="reuse cached source and Wikipedia files before fetching",
    )
    parser.add_argument(
        "--skip-simplify",
        action="store_true",
        help="write the unsimplified merged output without replacing the app file",
    )
    return parser.parse_args()


def read_json(path: Path) -> Any:
    """read a json file from disk and return the decoded object."""

    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    """write stable utf-8 json to disk for generated artefacts."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_url(url: str, output_path: Path, reuse_cache: bool) -> bytes:
    """fetch a URL into output_path and return the downloaded bytes."""

    if reuse_cache and output_path.exists() and output_path.stat().st_size > 0:
        return output_path.read_bytes()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None
    for attempt in range(1, 6):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = response.read()
            output_path.write_bytes(payload)
            return payload
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(min(30, attempt * 5))
    raise RuntimeError(f"failed to fetch {url}: {last_error}")


def fetch_json_url(url: str, cache_path: Path, reuse_cache: bool) -> dict[str, Any]:
    """fetch a json URL into cache_path and return its decoded object."""

    if reuse_cache and cache_path.exists() and cache_path.stat().st_size > 0:
        return read_json(cache_path)

    last_error: Exception | None = None
    for attempt in range(1, 7):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read()
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(payload)
            time.sleep(0.2)
            return json.loads(payload.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code == 429:
                time.sleep(20 + attempt * 10)
                continue
            time.sleep(min(20, attempt * 4))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            time.sleep(min(20, attempt * 4))
    raise RuntimeError(f"failed to fetch json {url}: {last_error}")


def normalise_text(value: str) -> str:
    """normalise Polish place text for case-insensitive matching."""

    cleaned = value.replace("–", "-").replace("—", "-")
    cleaned = re.sub(r"\([^)]*\)", "", cleaned)
    cleaned = re.sub(r"\bgmina\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bmiasto\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bpw\.\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż -]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip().lower()
    return unicodedata.normalize("NFC", cleaned)


def slugify(value: str) -> str:
    """turn a unicode value into an ascii-ish filename slug."""

    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    ascii_value = re.sub(r"[^a-zA-Z0-9]+", "_", ascii_value).strip("_").lower()
    return ascii_value or "value"


def read_names() -> dict[str, DioceseName]:
    """read diocese names from the concordance CSV keyed by area code."""

    names: dict[str, DioceseName] = {}
    with NAMES_CSV.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            names[row["area_code"]] = DioceseName(
                area_code=row["area_code"],
                area_name=row["polish_official_name"],
                area_name_en=row["english_name"],
            )
    return names


def polygonal_part(geometry: Any) -> Polygon | MultiPolygon:
    """return repaired polygonal content from an arbitrary geometry."""

    repaired = make_valid(geometry)
    if isinstance(repaired, (Polygon, MultiPolygon)):
        return repaired
    if isinstance(repaired, GeometryCollection):
        polygons: list[Polygon] = []
        for part in repaired.geoms:
            if isinstance(part, Polygon):
                polygons.append(part)
            elif isinstance(part, MultiPolygon):
                polygons.extend(part.geoms)
        if polygons:
            return MultiPolygon(polygons)
    return MultiPolygon([])


def repair_geometries(frame: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """repair a GeoDataFrame's polygonal geometries without changing fields."""

    out = frame.copy()
    out["geometry"] = out.geometry.map(polygonal_part)
    out = out[~out.geometry.is_empty].copy()
    return out


def load_gminy(reuse_cache: bool) -> gpd.GeoDataFrame:
    """load or create the filtered Polish GISCO LAU 2024 gmina layer."""

    if not GISCO_EU_GEOJSON.exists():
        print("fetching GISCO LAU 2024 GeoJSON", flush=True)
        fetch_url(GISCO_DOWNLOAD_URL, GISCO_EU_GEOJSON, reuse_cache=reuse_cache)

    if not (reuse_cache and GISCO_PL_GEOJSON.exists()):
        print("filtering GISCO LAU 2024 to Poland", flush=True)
        gminy = gpd.read_file(GISCO_EU_GEOJSON, where="CNTR_CODE = 'PL'")
        if len(gminy) != 2477:
            raise RuntimeError(f"expected 2,477 Polish LAU features, found {len(gminy)}")
        gminy.to_file(GISCO_PL_GEOJSON, driver="GeoJSON")
    else:
        gminy = gpd.read_file(GISCO_PL_GEOJSON)

    gminy = repair_geometries(gminy)
    gminy_2180 = gminy.to_crs(PROJECTED_CRS)
    source_area_km2 = float(gminy_2180.geometry.area.sum() / 1_000_000)
    write_json(
        GMINA_META_JSON,
        {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source": "Eurostat/GISCO Local Administrative Units 2024",
            "download_page": GISCO_DOWNLOAD_PAGE,
            "download_url": GISCO_DOWNLOAD_URL,
            "cached_europe_geojson": str(GISCO_EU_GEOJSON.relative_to(ROOT)),
            "cached_poland_geojson": str(GISCO_PL_GEOJSON.relative_to(ROOT)),
            "licence_note": (
                "GISCO LAU data are distributed by Eurostat/GISCO for reuse "
                "with source acknowledgement; the source page should be kept "
                "with downstream products."
            ),
            "country_filter": "CNTR_CODE = 'PL'",
            "feature_count": int(len(gminy)),
            "area_km2_epsg2180": round(source_area_km2, 2),
            "crs": str(gminy.crs),
        },
    )
    return gminy


def load_anchor_features() -> list[dict[str, Any]]:
    """load the 24 OSM anchor features and add boundary basis metadata."""

    data = read_json(PARTIAL24_GEOJSON)
    features = data.get("features", [])
    if len(features) != 24:
        raise RuntimeError(f"expected 24 anchor dioceses, found {len(features)}")
    for feature in features:
        props = feature.setdefault("properties", {})
        props["boundary_basis"] = "osm_relation"
    return features


def feature_collection_to_gdf(features: list[dict[str, Any]]) -> gpd.GeoDataFrame:
    """convert GeoJSON features to a projected GeoDataFrame."""

    rows = []
    for feature in features:
        rows.append({**feature["properties"], "geometry": shape(feature["geometry"])})
    frame = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")
    return repair_geometries(frame).to_crs(PROJECTED_CRS)


def fetch_geoboundaries_poland_outline(reuse_cache: bool) -> None:
    """fetch a fallback Poland ADM0 outline if the OSM outline is absent."""

    meta_path = RAW_DIR / "geoboundaries_pol_adm0_meta.json"
    meta = fetch_json_url(POLAND_GEOB_ADM0_META, meta_path, reuse_cache)
    url = meta.get("gjDownloadURL")
    if not url:
        raise RuntimeError("geoBoundaries POL ADM0 response did not include gjDownloadURL")
    fetch_url(str(url), POLAND_GEOJSON, reuse_cache=reuse_cache)


def load_poland_geometry(reuse_cache: bool) -> Polygon | MultiPolygon:
    """load the Poland outline geometry in EPSG:2180."""

    if not POLAND_GEOJSON.exists():
        fetch_geoboundaries_poland_outline(reuse_cache)
    frame = repair_geometries(gpd.read_file(POLAND_GEOJSON, on_invalid="fix")).to_crs(PROJECTED_CRS)
    frame = repair_geometries(frame)
    geometry = polygonal_part(unary_union(frame.geometry))
    if geometry.is_empty:
        raise RuntimeError("Poland outline geometry is empty")
    return geometry


def clipped_gmina_fragments(
    gminy: gpd.GeoDataFrame,
    anchor_features: list[dict[str, Any]],
    poland_geometry_2180: Polygon | MultiPolygon,
) -> tuple[gpd.GeoDataFrame, dict[str, float], Polygon | MultiPolygon]:
    """intersect gminy with Poland-minus-anchor unassigned territory."""

    gminy_2180 = repair_geometries(gminy).to_crs(PROJECTED_CRS)
    gmina_land_union = polygonal_part(unary_union(gminy_2180.geometry))
    land_poland_geometry = polygonal_part(poland_geometry_2180.intersection(gmina_land_union))
    anchors = feature_collection_to_gdf(anchor_features)
    anchor_union = polygonal_part(unary_union(anchors.geometry))
    unassigned_zone = polygonal_part(land_poland_geometry.difference(anchor_union))
    zone = gpd.GeoDataFrame([{"zone": "unassigned", "geometry": unassigned_zone}], crs=PROJECTED_CRS)

    # The source gmina layer and the OSM outline are not identical; overlay keeps
    # only the territory relevant to the 17 digitised dioceses.
    clipped = gpd.overlay(gminy_2180, zone, how="intersection", keep_geom_type=True)
    clipped = repair_geometries(clipped)
    clipped["fragment_area_km2"] = clipped.geometry.area / 1_000_000
    clipped = clipped[clipped["fragment_area_km2"] >= MIN_GMINA_FRAGMENT_KM2].copy()
    clipped.reset_index(drop=True, inplace=True)
    gmina_union = polygonal_part(unary_union(clipped.geometry))
    metrics = {
        "poland_outline_area_km2": float(poland_geometry_2180.area / 1_000_000),
        "gisco_gmina_land_union_area_km2": float(gmina_land_union.area / 1_000_000),
        "poland_land_reference_area_km2": float(land_poland_geometry.area / 1_000_000),
        "anchor_union_area_km2": float(anchor_union.area / 1_000_000),
        "unassigned_zone_area_km2": float(unassigned_zone.area / 1_000_000),
        "clipped_gmina_area_km2": float(gmina_union.area / 1_000_000),
        "uncovered_unassigned_zone_km2": float(unassigned_zone.difference(gmina_union).area / 1_000_000),
        "clipped_gmina_fragment_count": int(len(clipped)),
    }
    return clipped, metrics, land_poland_geometry


def mediawiki_api(params: dict[str, str], cache_path: Path, reuse_cache: bool) -> dict[str, Any]:
    """call the Polish Wikipedia API with caching and return JSON."""

    query = urllib.parse.urlencode(params)
    url = f"https://pl.wikipedia.org/w/api.php?{query}"
    return fetch_json_url(url, cache_path, reuse_cache)


def category_members(category_title: str, cache_path: Path, reuse_cache: bool) -> list[dict[str, Any]]:
    """return all category members for one Polish Wikipedia category."""

    members: list[dict[str, Any]] = []
    cmcontinue: str | None = None
    page = 0
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": category_title,
            "cmlimit": "500",
            "format": "json",
        }
        if cmcontinue is not None:
            params["cmcontinue"] = cmcontinue
        payload = mediawiki_api(
            params,
            cache_path.with_name(f"{cache_path.stem}_{page}.json"),
            reuse_cache,
        )
        members.extend(payload.get("query", {}).get("categorymembers", []))
        cmcontinue = payload.get("continue", {}).get("cmcontinue")
        if not cmcontinue:
            return members
        page += 1


def include_deanery_subcategory(title: str) -> bool:
    """decide whether a deanery subcategory should be expanded."""

    title_norm = normalise_text(title)
    if "dekanat" not in title_norm:
        return False
    if re.search(r"dekanaty (diecezji|archidiecezji)", title_norm):
        return False
    return True


def deanery_pages_for_diocese(
    area_code: str,
    category_title: str,
    reuse_cache: bool,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """collect deanery pages from the main category and selected city subcategories."""

    cache_path = WIKI_CACHE_DIR / area_code / f"category_{slugify(category_title)}.json"
    members = category_members(category_title, cache_path, reuse_cache)
    pages = [item for item in members if int(item.get("ns", -1)) == 0]
    subcategories = [item for item in members if int(item.get("ns", -1)) == 14]
    expanded_subcategories: list[str] = []

    for subcategory in subcategories:
        subcat_title = str(subcategory["title"])
        if not include_deanery_subcategory(subcat_title):
            continue
        expanded_subcategories.append(subcat_title)
        sub_cache = WIKI_CACHE_DIR / area_code / f"category_{slugify(subcat_title)}.json"
        pages.extend(
            item
            for item in category_members(subcat_title, sub_cache, reuse_cache)
            if int(item.get("ns", -1)) == 0
        )

    deduped: dict[int, dict[str, Any]] = {}
    for page in pages:
        if not str(page.get("title", "")).lower().startswith("dekanat"):
            continue
        page_id = int(page["pageid"])
        deduped[page_id] = page
    return list(deduped.values()), {
        "category_title": category_title,
        "page_count": len(deduped),
        "direct_member_count": len([item for item in members if int(item.get("ns", -1)) == 0]),
        "expanded_subcategories": expanded_subcategories,
        "ignored_subcategories": [
            str(item["title"])
            for item in subcategories
            if str(item["title"]) not in expanded_subcategories
        ],
    }


def fetch_wikitext(page: dict[str, Any], area_code: str, reuse_cache: bool) -> str:
    """fetch one deanery page's wikitext from Polish Wikipedia."""

    title = str(page["title"])
    page_id = int(page["pageid"])
    cache_path = WIKI_CACHE_DIR / area_code / f"page_{page_id}_{slugify(title)}.json"
    payload = mediawiki_api(
        {
            "action": "query",
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "formatversion": "2",
            "pageids": str(page_id),
            "format": "json",
        },
        cache_path,
        reuse_cache,
    )
    pages = payload.get("query", {}).get("pages", [])
    if not pages:
        return ""
    revisions = pages[0].get("revisions", [])
    if not revisions:
        return ""
    return str(revisions[0].get("slots", {}).get("main", {}).get("content", ""))


def wikipedia_page_url(title: str) -> str:
    """build the canonical browser URL for a Polish Wikipedia page title."""

    return "https://pl.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe="_")


def fetch_wikipedia_title_wikitext(
    title: str,
    area_code: str,
    reuse_cache: bool,
) -> tuple[dict[str, Any], str, Path]:
    """fetch one Polish Wikipedia page by title and return page metadata and wikitext."""

    cache_path = WIKI_CACHE_DIR / area_code / f"published_area_{slugify(title)}.json"
    payload = mediawiki_api(
        {
            "action": "query",
            "redirects": "1",
            "prop": "info|revisions",
            "inprop": "url",
            "rvprop": "content",
            "rvslots": "main",
            "formatversion": "2",
            "titles": title,
            "format": "json",
        },
        cache_path,
        reuse_cache,
    )
    pages = payload.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        raise RuntimeError(f"Polish Wikipedia page not found for published area: {title}")
    page = pages[0]
    revisions = page.get("revisions", [])
    if not revisions:
        raise RuntimeError(f"Polish Wikipedia page has no wikitext revisions: {title}")
    wikitext = str(revisions[0].get("slots", {}).get("main", {}).get("content", ""))
    return page, wikitext, cache_path


def clean_wiki_area_value(value: str) -> str:
    """strip common wiki markup from an infobox area value before parsing."""

    cleaned = value.replace("&nbsp;", " ").replace("\xa0", " ")
    cleaned = re.sub(r"<ref[^>/]*/>", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<ref[^>]*>.*?</ref>", " ", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"\[\[[^|\]]+\|([^\]]+)\]\]", r"\1", cleaned)
    cleaned = re.sub(r"\[\[([^\]]+)\]\]", r"\1", cleaned)
    cleaned = re.sub(r"\{\{[^{}]*\}\}", " ", cleaned)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def parse_published_area_km2(raw_value: str) -> float:
    """parse a Polish infobox area value into square kilometres."""

    cleaned = clean_wiki_area_value(raw_value)
    match = re.search(r"\d+(?:[ .,]\d+)*", cleaned)
    if not match:
        raise RuntimeError(f"could not parse published area value: {raw_value}")
    token = match.group(0).replace(" ", "")
    if "," in token:
        token = token.replace(".", "").replace(",", ".")
    elif "." in token:
        parts = token.split(".")
        if all(part.isdigit() for part in parts) and len(parts[-1]) == 3:
            token = "".join(parts)
    area = float(token)
    if re.search(r"\btys\b|tys\.", cleaned, flags=re.IGNORECASE):
        area *= 1000
    return round(area, 2)


def extract_published_area_raw(wikitext: str, title: str) -> str:
    """extract the raw powierzchnia field from a diocesan infobox."""

    for line in wikitext.splitlines():
        match = re.match(r"\s*\|\s*powierzchnia\s*=\s*(.+?)\s*$", line, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    raise RuntimeError(f"no powierzchnia field found on Polish Wikipedia page: {title}")


def fetch_published_area_records(
    names: dict[str, DioceseName],
    reuse_cache: bool,
) -> dict[str, dict[str, Any]]:
    """fetch published Wikipedia infobox areas for the digitised dioceses."""

    records: dict[str, dict[str, Any]] = {}
    for area_code in MISSING_CODES:
        title = WIKIPEDIA_DIOCESE_AREA_TITLES.get(area_code, names[area_code].area_name)
        print(f"fetching published area for {area_code}", flush=True)
        page, wikitext, cache_path = fetch_wikipedia_title_wikitext(title, area_code, reuse_cache)
        resolved_title = str(page.get("title", title))
        raw_value = extract_published_area_raw(wikitext, resolved_title)
        records[area_code] = {
            "area_code": area_code,
            "area_name": names[area_code].area_name,
            "area_name_en": names[area_code].area_name_en,
            "source": "Polish Wikipedia diocesan infobox field `powierzchnia`",
            "source_title": resolved_title,
            "source_pageid": int(page["pageid"]),
            "source_url": str(page.get("fullurl") or wikipedia_page_url(resolved_title)),
            "source_cache_json": str(cache_path.relative_to(ROOT)),
            "raw_area_value": raw_value,
            "published_area_km2": parse_published_area_km2(raw_value),
        }
    return records


def clean_link_text(raw: str) -> str:
    """clean a raw wiki link target or display value into a candidate place."""

    value = raw.split("|")[-1]
    value = value.split("#")[-1]
    value = re.sub(r"\([^)]*\)", "", value)
    value = value.replace("_", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def place_from_religious_title(title: str) -> str | None:
    """extract the place after 'w/we' from parish or deanery titles."""

    title = clean_link_text(title)
    match = re.search(r"\b(?:w|we)\s+([^,;–—\-\(\[]+)", title, flags=re.IGNORECASE)
    if not match:
        return None
    place = match.group(1).strip()
    place = re.sub(r"\s+(?:pw|pod wezwaniem)\b.*$", "", place, flags=re.IGNORECASE)
    return place or None


def extract_localities(page_title: str, wikitext: str) -> set[str]:
    """extract locality evidence from deanery wikitext and its page title."""

    localities: set[str] = set()
    title_place = place_from_religious_title(page_title)
    if title_place:
        localities.add(title_place)
    deanery_title_match = re.match(r"(?i)^dekanat\s+(.+)$", page_title.strip())
    if deanery_title_match:
        title_value = re.sub(
            r"\b(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII)\b$",
            "",
            deanery_title_match.group(1).strip(),
        ).strip(" -")
        for part in re.split(r"[-–—]", title_value):
            clean = clean_link_text(part)
            if is_probable_place(clean):
                localities.add(clean)

    for line in wikitext.splitlines():
        stripped = line.strip()
        if not stripped.startswith("*") and "miejscowość" not in stripped:
            continue

        # Parish titles often contain "w PLACE"; parenthetical links give
        # concrete towns or city districts. Both are kept and later matched to
        # official LAU names, so district-only evidence usually falls away.
        for raw_link in re.findall(r"\[\[([^\]]+)\]\]", stripped):
            target = raw_link.split("|", 1)[0]
            display = raw_link.split("|", 1)[1] if "|" in raw_link else target
            for candidate in (target, display):
                place = place_from_religious_title(candidate)
                if place:
                    localities.add(place)
                clean = clean_link_text(candidate)
                if is_probable_place(clean):
                    localities.add(clean)
        for place in re.findall(r"\(([^)]{2,80})\)", stripped):
            for part in re.split(r"[-,;/]", place):
                clean = clean_link_text(part)
                if is_probable_place(clean):
                    localities.add(clean)
    return {value for value in localities if is_probable_place(value)}


def is_probable_place(value: str) -> bool:
    """test whether a scraped token is plausibly a locality name."""

    value_norm = normalise_text(value)
    if len(value_norm) < 3:
        return False
    blocked_tokens = {
        "parafia",
        "parafii",
        "dekanat",
        "diecezja",
        "archidiecezja",
        "kosciol",
        "kościół",
        "bazylika",
        "katedra",
        "matki",
        "najswietszej",
        "najświętszej",
        "swietego",
        "świętego",
        "sw",
        "św",
        "nmp",
        "bozej",
        "bożej",
        "chrystusa",
        "jezus",
        "jezusowy",
        "apostola",
        "apostoła",
        "biskupa",
        "meczennika",
        "męczennika",
        "wiki",
    }
    words = set(value_norm.split())
    if words & blocked_tokens:
        return False
    if value_norm.startswith(("pw ", "rzymskokatolicka", "katolicka")):
        return False
    return bool(re.search(r"[a-ząćęłńóśźż]", value_norm))


def scrape_wikipedia_evidence(reuse_cache: bool) -> tuple[dict[str, set[str]], dict[str, Any]]:
    """scrape deanery pages and return locality evidence by diocese."""

    evidence: dict[str, set[str]] = {}
    report: dict[str, Any] = {}
    for area_code, category_title in WIKIPEDIA_CATEGORIES.items():
        print(f"scraping Wikipedia deanery evidence for {area_code}", flush=True)
        pages, category_report = deanery_pages_for_diocese(area_code, category_title, reuse_cache)
        localities: set[str] = set()
        page_reports: list[dict[str, Any]] = []
        for page in pages:
            wikitext = fetch_wikitext(page, area_code, reuse_cache)
            page_localities = extract_localities(str(page["title"]), wikitext)
            localities.update(page_localities)
            page_reports.append(
                {
                    "pageid": int(page["pageid"]),
                    "title": str(page["title"]),
                    "locality_count": len(page_localities),
                    "sample_localities": sorted(page_localities)[:8],
                }
            )
        evidence[area_code] = localities
        report[area_code] = {
            **category_report,
            "locality_count": len(localities),
            "sample_localities": sorted(localities)[:20],
            "pages": page_reports,
        }
    return evidence, report


def area_comparison_row(
    area_code: str,
    computed_area_km2: float,
    published_area_records: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """compare one computed diocese area with its published area."""

    source = published_area_records[area_code]
    published_area_km2 = float(source["published_area_km2"])
    absolute_deviation_km2 = computed_area_km2 - published_area_km2
    percent_deviation = absolute_deviation_km2 / published_area_km2 * 100 if published_area_km2 else math.inf
    within_tolerance = abs(percent_deviation) <= PUBLISHED_AREA_TOLERANCE * 100
    return {
        "area_code": area_code,
        "area_name": source["area_name"],
        "area_name_en": source["area_name_en"],
        "computed_area_km2": round(float(computed_area_km2), 2),
        "published_area_km2": round(published_area_km2, 2),
        "absolute_deviation_km2": round(absolute_deviation_km2, 2),
        "percent_deviation": round(percent_deviation, 2),
        "absolute_percent_deviation": round(abs(percent_deviation), 2),
        "tolerance_percent": round(PUBLISHED_AREA_TOLERANCE * 100, 2),
        "within_tolerance": within_tolerance,
        "confidence": "standard" if within_tolerance else "low",
        "source": source["source"],
        "source_title": source["source_title"],
        "source_url": source["source_url"],
        "raw_area_value": source["raw_area_value"],
    }


def published_area_validation(
    digitised_area_lookup: dict[str, float],
    published_area_records: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """build the published-area validation table for the digitised dioceses."""

    missing_sources = sorted(set(MISSING_CODES) - set(published_area_records))
    missing_computed = sorted(set(MISSING_CODES) - set(digitised_area_lookup))
    if missing_sources:
        raise RuntimeError(f"missing published area source records for: {', '.join(missing_sources)}")

    table = [
        area_comparison_row(area_code, float(digitised_area_lookup.get(area_code, 0.0)), published_area_records)
        for area_code in MISSING_CODES
        if area_code not in missing_computed
    ]
    low_confidence_area_codes = [
        row["area_code"]
        for row in table
        if not row["within_tolerance"]
    ]
    return {
        "source": "Polish Wikipedia diocesan infoboxes",
        "tolerance_percent": round(PUBLISHED_AREA_TOLERANCE * 100, 2),
        "source_record_count": len(published_area_records),
        "missing_computed_area_codes": missing_computed,
        "low_confidence_area_codes": low_confidence_area_codes,
        "all_within_tolerance": not low_confidence_area_codes and not missing_computed,
        "table": table,
    }


def build_locality_index(evidence: dict[str, set[str]]) -> dict[str, set[str]]:
    """invert locality evidence to area-code sets keyed by normalised place."""

    index: dict[str, set[str]] = defaultdict(set)
    for area_code, localities in evidence.items():
        for locality in localities:
            norm = normalise_text(locality)
            if norm:
                index[norm].add(area_code)
    return index


def projected_seat_points() -> dict[str, list[Any]]:
    """return diocese seats as EPSG:2180 shapely points."""

    seats = []
    area_codes = []
    for area_code, lon_lats in SEAT_POINTS.items():
        for lon, lat in lon_lats:
            seats.append({"area_code": area_code, "geometry": gpd.points_from_xy([lon], [lat], crs="EPSG:4326")[0]})
            area_codes.append(area_code)
    frame = gpd.GeoDataFrame(seats, geometry="geometry", crs="EPSG:4326").to_crs(PROJECTED_CRS)
    out: dict[str, list[Any]] = defaultdict(list)
    for _, row in frame.iterrows():
        out[str(row["area_code"])].append(row.geometry)
    return out


def nearest_seat_area_code(geometry: Any, candidate_codes: list[str], seats: dict[str, list[Any]]) -> str:
    """choose the nearest candidate diocese seat for one geometry centroid."""

    centroid = geometry.representative_point()
    best_code: str | None = None
    best_distance = math.inf
    for area_code in candidate_codes:
        for seat in seats[area_code]:
            distance = centroid.distance(seat)
            if distance < best_distance:
                best_distance = distance
                best_code = area_code
    if best_code is None:
        raise RuntimeError("could not choose nearest seat")
    return best_code


def seat_distance_km(geometry: Any, area_code: str, seats: dict[str, list[Any]]) -> float:
    """measure the distance in kilometres from one geometry to a diocese seat."""

    centroid = geometry.representative_point()
    return min(float(centroid.distance(seat) / 1000) for seat in seats[area_code])


def plausible_wikipedia_candidates(
    geometry: Any,
    candidate_codes: list[str],
    seats: dict[str, list[Any]],
) -> list[str]:
    """filter direct Wikipedia candidates by broad spatial plausibility."""

    all_distances = {
        area_code: seat_distance_km(geometry, area_code, seats)
        for area_code in MISSING_CODES
    }
    nearest_distance = min(all_distances.values())
    plausible: list[str] = []
    for area_code in candidate_codes:
        distance = all_distances[area_code]
        if distance <= 160 or distance <= nearest_distance * 2.5:
            plausible.append(area_code)
    return plausible


def assign_direct_wikipedia(
    fragments: gpd.GeoDataFrame,
    locality_index: dict[str, set[str]],
    seats: dict[str, list[Any]],
) -> tuple[dict[int, Assignment], list[dict[str, Any]]]:
    """assign fragments whose LAU name appears in Wikipedia locality evidence."""

    assignments: dict[int, Assignment] = {}
    tiebreaks: list[dict[str, Any]] = []
    for row_index, row in fragments.iterrows():
        norm_name = normalise_text(str(row["LAU_NAME"]))
        raw_candidates = sorted(locality_index.get(norm_name, set()))
        candidates = plausible_wikipedia_candidates(row.geometry, raw_candidates, seats)
        if not candidates:
            continue
        if len(candidates) == 1:
            assignments[int(row_index)] = Assignment(
                row_index=int(row_index),
                area_code=candidates[0],
                method="wikipedia_lau_name",
                evidence=f"LAU_NAME matched scraped locality '{row['LAU_NAME']}' after seat-distance filter",
                candidate_dioceses=raw_candidates,
            )
            continue
        chosen = nearest_seat_area_code(row.geometry, candidates, seats)
        assignments[int(row_index)] = Assignment(
            row_index=int(row_index),
            area_code=chosen,
            method="wikipedia_lau_name_ambiguous_nearest_seat",
            evidence=(
                "LAU_NAME matched multiple scraped localities after seat-distance "
                f"filter: {', '.join(candidates)}"
            ),
            candidate_dioceses=raw_candidates,
        )
        tiebreaks.append(tiebreak_record(row, chosen, "wikipedia_lau_name_ambiguous_nearest_seat", raw_candidates))
    return assignments, tiebreaks


def build_neighbour_index(fragments: gpd.GeoDataFrame) -> dict[int, list[int]]:
    """build a neighbour index for clipped gmina fragments."""

    neighbours: dict[int, list[int]] = {int(idx): [] for idx in fragments.index}
    spatial_index = fragments.sindex
    for idx, geom in fragments.geometry.items():
        query_geom = geom.buffer(ADJACENCY_BUFFER_METRES)
        for other_idx in spatial_index.query(query_geom):
            other_idx = int(other_idx)
            idx = int(idx)
            if other_idx == idx:
                continue
            other_geom = fragments.geometry.iloc[other_idx]
            if geom.distance(other_geom) <= ADJACENCY_BUFFER_METRES:
                neighbours[idx].append(other_idx)
    return neighbours


def shared_boundary_length(geom_a: Any, geom_b: Any) -> float:
    """measure shared boundary length between two projected geometries."""

    try:
        return float(geom_a.boundary.intersection(geom_b.boundary).length)
    except Exception:  # noqa: BLE001
        return 0.0


def tiebreak_record(
    row: pd.Series,
    chosen: str,
    method: str,
    candidate_dioceses: list[str],
) -> dict[str, Any]:
    """build one report row for a non-direct gmina assignment."""

    return {
        "gmina_id": str(row["GISCO_ID"]),
        "gmina_name": str(row["LAU_NAME"]),
        "assigned_area_code": chosen,
        "method": method,
        "candidate_dioceses": candidate_dioceses,
        "fragment_area_km2": round(float(row["fragment_area_km2"]), 4),
    }


def fill_by_adjacency(
    fragments: gpd.GeoDataFrame,
    assignments: dict[int, Assignment],
    neighbours: dict[int, list[int]],
    seats: dict[str, list[Any]],
) -> tuple[dict[int, Assignment], list[dict[str, Any]]]:
    """fill unassigned fragments from neighbouring assigned dioceses."""

    tiebreaks: list[dict[str, Any]] = []
    changed = True
    while changed:
        changed = False
        for row_index, row in fragments.iterrows():
            idx = int(row_index)
            if idx in assignments:
                continue
            neighbour_codes = sorted({assignments[n].area_code for n in neighbours[idx] if n in assignments})
            if not neighbour_codes:
                continue
            if len(neighbour_codes) == 1:
                chosen = neighbour_codes[0]
                assignments[idx] = Assignment(
                    row_index=idx,
                    area_code=chosen,
                    method="adjacency_single_neighbour",
                    evidence=f"only adjacent assigned diocese was {chosen}",
                    candidate_dioceses=neighbour_codes,
                )
                changed = True
                continue

            lengths: dict[str, float] = defaultdict(float)
            for neighbour_idx in neighbours[idx]:
                if neighbour_idx not in assignments:
                    continue
                code = assignments[neighbour_idx].area_code
                lengths[code] += shared_boundary_length(row.geometry, fragments.geometry.iloc[neighbour_idx])
            ranked = sorted(lengths.items(), key=lambda item: item[1], reverse=True)
            if ranked and ranked[0][1] > 0 and (len(ranked) == 1 or ranked[0][1] > ranked[1][1]):
                chosen = ranked[0][0]
                method = "adjacency_max_shared_boundary"
            else:
                chosen = nearest_seat_area_code(row.geometry, neighbour_codes, seats)
                method = "adjacency_nearest_seat"
            assignments[idx] = Assignment(
                row_index=idx,
                area_code=chosen,
                method=method,
                evidence=f"adjacent assigned dioceses: {', '.join(neighbour_codes)}",
                candidate_dioceses=neighbour_codes,
            )
            tiebreaks.append(tiebreak_record(row, chosen, method, neighbour_codes))
            changed = True
    return assignments, tiebreaks


def fill_by_nearest_seat(
    fragments: gpd.GeoDataFrame,
    assignments: dict[int, Assignment],
    seats: dict[str, list[Any]],
) -> tuple[dict[int, Assignment], list[dict[str, Any]]]:
    """assign remaining fragments to the nearest missing-diocese seat."""

    tiebreaks: list[dict[str, Any]] = []
    candidate_codes = sorted(MISSING_CODES)
    for row_index, row in fragments.iterrows():
        idx = int(row_index)
        if idx in assignments:
            continue
        chosen = nearest_seat_area_code(row.geometry, candidate_codes, seats)
        assignments[idx] = Assignment(
            row_index=idx,
            area_code=chosen,
            method="nearest_seat_no_wiki_or_adjacency",
            evidence="no Wikipedia locality match and no assigned neighbour was available",
            candidate_dioceses=candidate_codes,
        )
        tiebreaks.append(tiebreak_record(row, chosen, "nearest_seat_no_wiki_or_adjacency", candidate_codes))
    return assignments, tiebreaks


def apply_manual_overrides(
    fragments: gpd.GeoDataFrame,
    assignments: dict[int, Assignment],
) -> tuple[dict[int, Assignment], list[dict[str, Any]]]:
    """apply named gmina overrides from audited deanery evidence."""

    tiebreaks: list[dict[str, Any]] = []
    for row_index, row in fragments.iterrows():
        gmina_id = str(row["GISCO_ID"])
        if gmina_id not in MANUAL_GMINA_OVERRIDES:
            continue
        chosen, evidence = MANUAL_GMINA_OVERRIDES[gmina_id]
        previous = assignments.get(int(row_index))
        if previous is not None and previous.area_code == chosen:
            continue
        assignments[int(row_index)] = Assignment(
            row_index=int(row_index),
            area_code=chosen,
            method="manual_wikipedia_deanery_tiebreak",
            evidence=evidence,
            candidate_dioceses=[previous.area_code] if previous is not None else [],
        )
        record = tiebreak_record(
            row,
            chosen,
            "manual_wikipedia_deanery_tiebreak",
            [previous.area_code] if previous is not None else [],
        )
        record["evidence"] = evidence
        tiebreaks.append(record)
    return assignments, tiebreaks


def assignment_table(fragments: gpd.GeoDataFrame, assignments: dict[int, Assignment]) -> list[dict[str, Any]]:
    """serialise per-gmina assignments for the report."""

    rows: list[dict[str, Any]] = []
    for row_index, row in fragments.iterrows():
        assignment = assignments[int(row_index)]
        rows.append(
            {
                "gmina_id": str(row["GISCO_ID"]),
                "gmina_name": str(row["LAU_NAME"]),
                "assigned_area_code": assignment.area_code,
                "method": assignment.method,
                "evidence": assignment.evidence,
                "candidate_dioceses": assignment.candidate_dioceses,
                "fragment_area_km2": round(float(row["fragment_area_km2"]), 4),
            }
        )
    return rows


def assign_fragments(
    fragments: gpd.GeoDataFrame,
    wiki_evidence: dict[str, set[str]],
) -> tuple[gpd.GeoDataFrame, list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """assign every clipped gmina fragment to one of the missing dioceses."""

    seats = projected_seat_points()
    locality_index = build_locality_index(wiki_evidence)
    assignments, tiebreaks = assign_direct_wikipedia(fragments, locality_index, seats)
    direct_count = len(assignments)
    neighbours = build_neighbour_index(fragments)
    assignments, adjacency_tiebreaks = fill_by_adjacency(fragments, assignments, neighbours, seats)
    tiebreaks.extend(adjacency_tiebreaks)
    assignments, nearest_tiebreaks = fill_by_nearest_seat(fragments, assignments, seats)
    tiebreaks.extend(nearest_tiebreaks)
    assignments, manual_tiebreaks = apply_manual_overrides(fragments, assignments)
    tiebreaks.extend(manual_tiebreaks)

    if len(assignments) != len(fragments):
        raise RuntimeError(f"assigned {len(assignments)} of {len(fragments)} gmina fragments")

    assigned = fragments.copy()
    assigned["assigned_area_code"] = [assignments[int(idx)].area_code for idx in assigned.index]
    assigned["assignment_method"] = [assignments[int(idx)].method for idx in assigned.index]
    assigned["assignment_evidence"] = [assignments[int(idx)].evidence for idx in assigned.index]
    method_counts = dict(assigned["assignment_method"].value_counts().sort_index())
    report = {
        "direct_wikipedia_assignment_count": direct_count,
        "assigned_fragment_count": int(len(assigned)),
        "method_counts": {str(key): int(value) for key, value in method_counts.items()},
    }
    return assigned, assignment_table(fragments, assignments), tiebreaks, report


def dissolved_digitised_features(
    assigned_fragments: gpd.GeoDataFrame,
    names: dict[str, DioceseName],
    published_area_records: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """dissolve assigned fragments and return output features plus route rows."""

    dissolved = assigned_fragments.dissolve(by="assigned_area_code", as_index=False)
    dissolved = repair_geometries(dissolved).to_crs("EPSG:4326")
    features: list[dict[str, Any]] = []
    route_rows: list[dict[str, Any]] = []
    areas = assigned_fragments.groupby("assigned_area_code")["fragment_area_km2"].sum().to_dict()
    counts = assigned_fragments.groupby("assigned_area_code").size().to_dict()
    methods_by_code = (
        assigned_fragments.groupby(["assigned_area_code", "assignment_method"]).size().reset_index(name="count")
    )
    methods_lookup: dict[str, dict[str, int]] = defaultdict(dict)
    for _, row in methods_by_code.iterrows():
        methods_lookup[str(row["assigned_area_code"])][str(row["assignment_method"])] = int(row["count"])

    for _, row in dissolved.iterrows():
        area_code = str(row["assigned_area_code"])
        diocese_name = names[area_code]
        area_comparison = area_comparison_row(
            area_code,
            float(areas.get(area_code, 0.0)),
            published_area_records,
        )
        feature = {
            "type": "Feature",
            "properties": {
                "area_code": area_code,
                "area_name": diocese_name.area_name,
                "area_name_en": diocese_name.area_name_en,
                "osm_relation_id": None,
                "boundary_set_id": BOUNDARY_SET_ID,
                "boundary_level": BOUNDARY_LEVEL,
                "boundary_basis": "gmina_digitisation",
                "confidence": area_comparison["confidence"],
                "computed_area_km2": area_comparison["computed_area_km2"],
                "published_area_km2": area_comparison["published_area_km2"],
                "published_area_deviation_percent": area_comparison["percent_deviation"],
            },
            "geometry": mapping(polygonal_part(row.geometry)),
        }
        features.append(feature)
        route_rows.append(
            {
                "area_code": area_code,
                "route": "gmina_digitisation",
                "status": "ok" if area_comparison["within_tolerance"] else "low_confidence",
                "low_confidence": not area_comparison["within_tolerance"],
                "gmina_fragment_count": int(counts.get(area_code, 0)),
                "area_km2": round(float(areas.get(area_code, 0.0)), 2),
                "published_area_km2": area_comparison["published_area_km2"],
                "published_area_deviation_percent": area_comparison["percent_deviation"],
                "method_counts": methods_lookup.get(area_code, {}),
            }
        )

    missing = sorted(set(MISSING_CODES) - {feature["properties"]["area_code"] for feature in features})
    if missing:
        raise RuntimeError(f"missing digitised polygons for: {', '.join(missing)}")
    return features, sorted(route_rows, key=lambda row: row["area_code"])


def validate_features(
    features: list[dict[str, Any]],
    poland_geometry_2180: Polygon | MultiPolygon,
    published_area_records: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """calculate coverage, overlap, and area metrics for a feature collection."""

    frame = feature_collection_to_gdf(features)
    geometries = list(frame.geometry)
    areas = [float(geometry.area / 1_000_000) for geometry in geometries]
    dissolved = polygonal_part(unary_union(geometries))
    poland_area = float(poland_geometry_2180.area / 1_000_000)
    coverage_area = float(dissolved.intersection(poland_geometry_2180).area / 1_000_000)
    pairwise_total = 0.0
    max_pairwise = {
        "area_code_a": None,
        "area_code_b": None,
        "overlap_km2": 0.0,
        "percent_of_smaller": 0.0,
    }

    for i, geom_a in enumerate(geometries):
        for j in range(i + 1, len(geometries)):
            geom_b = geometries[j]
            if not geom_a.intersects(geom_b):
                continue
            overlap_area = float(geom_a.intersection(geom_b).area / 1_000_000)
            if overlap_area <= 0.001:
                continue
            pairwise_total += overlap_area
            denominator = min(areas[i], areas[j])
            percent = overlap_area / denominator * 100 if denominator else 0.0
            if percent > max_pairwise["percent_of_smaller"]:
                max_pairwise = {
                    "area_code_a": str(frame.iloc[i]["area_code"]),
                    "area_code_b": str(frame.iloc[j]["area_code"]),
                    "overlap_km2": round(overlap_area, 4),
                    "percent_of_smaller": round(percent, 4),
                }

    area_lookup = {
        str(row["area_code"]): round(float(area), 2)
        for (_, row), area in zip(frame.iterrows(), areas, strict=True)
    }
    digitised_area_lookup = {
        code: area
        for code, area in area_lookup.items()
        if code in MISSING_CODES
    }
    published_validation = published_area_validation(digitised_area_lookup, published_area_records)
    coverage_percent = coverage_area / poland_area * 100 if poland_area else 0.0
    overlap_percent = pairwise_total / poland_area * 100 if poland_area else 0.0
    return {
        "feature_count": int(len(features)),
        "poland_area_km2": round(poland_area, 2),
        "sum_area_km2": round(sum(areas), 2),
        "dissolved_area_km2": round(float(dissolved.area / 1_000_000), 2),
        "coverage_area_km2": round(coverage_area, 2),
        "coverage_percent_of_poland_outline": round(coverage_percent, 4),
        "pairwise_overlap_total_km2": round(pairwise_total, 4),
        "pairwise_overlap_total_percent_of_poland": round(overlap_percent, 4),
        "max_pairwise_overlap": max_pairwise,
        "areas_km2": area_lookup,
        "digitised_areas_km2": digitised_area_lookup,
        "published_area_validation": published_validation,
        "passes": {
            "all_41_features_present": len(features) == 41,
            "all_17_digitised_present": not (set(MISSING_CODES) - set(digitised_area_lookup)),
            "published_area_sources_available_for_17_digitised": published_validation["source_record_count"] == 17,
            "digitised_areas_within_15_percent_of_published": published_validation["all_within_tolerance"],
            "coverage_at_least_99_percent": coverage_percent >= MIN_COVERAGE_PERCENT,
            "overlap_below_0_5_percent": overlap_percent < OVERLAP_TOLERANCE_PERCENT,
        },
    }


def simplify_with_mapshaper(input_path: Path, output_path: Path) -> dict[str, Any]:
    """simplify the merged layer with mapshaper and keep it under the byte cap."""

    env = os.environ.copy()
    env.setdefault("NPM_CONFIG_CACHE", "/private/tmp/npm-cache")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    attempts: list[dict[str, Any]] = []
    chosen: dict[str, Any] | None = None
    for keep in SIMPLIFICATION_KEEP_LADDER:
        temp_path = output_path.with_name(f"{output_path.stem}.keep_{keep}.geojson")
        command = [
            "npx",
            "--yes",
            "mapshaper",
            str(input_path),
            "-clean",
            "-simplify",
            "weighted",
            "keep-shapes",
            f"{keep}%",
            "-clean",
            "-o",
            "precision=0.00001",
            "format=geojson",
            str(temp_path),
        ]
        subprocess.run(command, cwd=ROOT, env=env, check=True, capture_output=True, text=True)
        byte_size = temp_path.stat().st_size
        attempts.append({"keep_percentage": keep, "byte_size": byte_size})
        if byte_size <= MAX_OUTPUT_BYTES:
            temp_path.replace(output_path)
            chosen = {
                "keep_percentage": keep,
                "byte_size": byte_size,
                "command": " ".join(command),
                "attempts": attempts,
            }
            break
        if keep != SIMPLIFICATION_KEEP_LADDER[-1]:
            temp_path.unlink()

    if chosen is None:
        keep = SIMPLIFICATION_KEEP_LADDER[-1]
        temp_path = output_path.with_name(f"{output_path.stem}.keep_{keep}.geojson")
        temp_path.replace(output_path)
        chosen = {
            "keep_percentage": keep,
            "byte_size": output_path.stat().st_size,
            "command": "last simplification attempt from ladder",
            "attempts": attempts,
        }
    return chosen


def merge_feature_collections(
    anchor_features: list[dict[str, Any]],
    digitised_features: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """merge and sort anchor plus digitised features by area code."""

    merged = anchor_features + digitised_features
    return sorted(merged, key=lambda feature: feature["properties"]["area_code"])


def gate_or_raise(validation: dict[str, Any]) -> None:
    """raise if any hard validation gate fails."""

    failed = [
        name
        for name, passed in validation["passes"].items()
        if not passed and name not in SOFT_VALIDATION_GATES
    ]
    if failed:
        raise RuntimeError(f"validation gates failed: {', '.join(failed)}")


def load_previous_report() -> dict[str, Any] | None:
    """load the previous digitisation report before this run overwrites it."""

    if not REPORT_JSON.exists():
        return None
    try:
        return read_json(REPORT_JSON)
    except json.JSONDecodeError:
        return None


def compare_assignment_changes(
    previous_report: dict[str, Any] | None,
    current_assignments: list[dict[str, Any]],
) -> dict[str, Any]:
    """compare current gmina assignments with the report present before the run."""

    if previous_report is None:
        return {
            "previous_report_available": False,
            "changed_assignment_count": None,
            "changed_assignments": [],
        }

    previous_rows = {
        str(row["gmina_id"]): row
        for row in previous_report.get("per_gmina_assignments", [])
    }
    current_rows = {str(row["gmina_id"]): row for row in current_assignments}
    compared_ids = sorted(set(previous_rows) & set(current_rows))
    changed: list[dict[str, Any]] = []
    for gmina_id in compared_ids:
        previous = previous_rows[gmina_id]
        current = current_rows[gmina_id]
        if previous.get("assigned_area_code") == current.get("assigned_area_code"):
            continue
        changed.append(
            {
                "gmina_id": gmina_id,
                "gmina_name": current.get("gmina_name"),
                "previous_area_code": previous.get("assigned_area_code"),
                "current_area_code": current.get("assigned_area_code"),
                "previous_method": previous.get("method"),
                "current_method": current.get("method"),
                "fragment_area_km2": current.get("fragment_area_km2"),
            }
        )

    previous_area_cap_count = sum(
        1
        for row in previous_rows.values()
        if row.get("method") == "area_cap_nearest_non_overfull_seat"
    )
    changed_from_area_cap_count = sum(
        1
        for row in changed
        if row["previous_method"] == "area_cap_nearest_non_overfull_seat"
    )
    return {
        "previous_report_available": True,
        "previous_report_generated_at_utc": previous_report.get("generated_at_utc"),
        "compared_gmina_count": len(compared_ids),
        "previous_area_cap_assignment_count": previous_area_cap_count,
        "changed_assignment_count": len(changed),
        "changed_from_previous_area_cap_count": changed_from_area_cap_count,
        "changed_assignments": changed,
    }


def update_layer_meta_licence() -> None:
    """record mixed OSM and GISCO-LAU licensing on the adjacent layer metadata."""

    if not LAYER_META_JSON.exists():
        return
    meta = read_json(LAYER_META_JSON)
    meta["completed_layer_licence_note"] = MIXED_LAYER_LICENCE_NOTE
    meta["completed_layer_sources"] = {
        "osm_anchor_polygons": {
            "feature_count": 24,
            "source": "OpenStreetMap religious-administration relations",
            "licence": "Open Database Licence (ODbL)",
            "attribution": OSM_ATTRIBUTION,
        },
        "gisco_lau_digitised_polygons": {
            "feature_count": 17,
            "source": "Eurostat/GISCO Local Administrative Units 2024",
            "download_page": GISCO_DOWNLOAD_PAGE,
            "download_url": GISCO_DOWNLOAD_URL,
            "attribution": GISCO_ATTRIBUTION,
        },
    }
    write_json(LAYER_META_JSON, meta)


def main() -> int:
    """run the full gmina digitisation build and validation workflow."""

    args = parse_args()
    previous_report = load_previous_report()
    names = read_names()
    gminy = load_gminy(args.reuse_cache)
    anchor_features = load_anchor_features()
    poland_geometry = load_poland_geometry(args.reuse_cache)
    fragments, clipping_metrics, poland_land_geometry = clipped_gmina_fragments(gminy, anchor_features, poland_geometry)
    wiki_evidence, wiki_report = scrape_wikipedia_evidence(args.reuse_cache)
    published_area_records = fetch_published_area_records(names, args.reuse_cache)
    assigned, assignments, tiebreaks, assignment_report = assign_fragments(fragments, wiki_evidence)
    assignment_change_summary = compare_assignment_changes(previous_report, assignments)
    digitised_features, route_rows = dissolved_digitised_features(assigned, names, published_area_records)
    final_features = merge_feature_collections(anchor_features, digitised_features)
    write_json(UNSIMPLIFIED_GEOJSON, {"type": "FeatureCollection", "features": final_features})
    validation_unsimplified = validate_features(final_features, poland_land_geometry, published_area_records)
    gate_or_raise(validation_unsimplified)

    simplification = None
    validation_final = None
    if not args.skip_simplify:
        simplification = simplify_with_mapshaper(UNSIMPLIFIED_GEOJSON, APP_GEOJSON)
        validation_final = validate_features(read_json(APP_GEOJSON)["features"], poland_land_geometry, published_area_records)
        gate_or_raise(validation_final)
    update_layer_meta_licence()

    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "gmina_digitisation_from_GISCO_LAU_2024_with_Wikipedia_deanery_evidence",
        "licence_note": MIXED_LAYER_LICENCE_NOTE,
        "attribution": {
            "osm_anchor_polygons": OSM_ATTRIBUTION,
            "gisco_lau_digitised_polygons": GISCO_ATTRIBUTION,
        },
        "gmina_source": read_json(GMINA_META_JSON),
        "inputs": {
            "anchor_partial24_geojson": str(PARTIAL24_GEOJSON.relative_to(ROOT)),
            "poland_outline_geojson": str(POLAND_GEOJSON.relative_to(ROOT)),
            "diocese_names_csv": str(NAMES_CSV.relative_to(ROOT)),
        },
        "outputs": {
            "app_geojson": str(APP_GEOJSON.relative_to(ROOT)),
            "unsimplified_geojson": str(UNSIMPLIFIED_GEOJSON.relative_to(ROOT)),
            "report_json": str(REPORT_JSON.relative_to(ROOT)),
        },
        "clipping_metrics": {key: round(value, 4) for key, value in clipping_metrics.items()},
        "wikipedia_evidence": wiki_report,
        "published_area_sources": [published_area_records[area_code] for area_code in MISSING_CODES],
        "published_area_validation": (
            validation_final or validation_unsimplified
        )["published_area_validation"],
        "assignment_summary": assignment_report,
        "assignment_change_summary": assignment_change_summary,
        "per_gmina_assignments": assignments,
        "tiebreak_count": len(tiebreaks),
        "tiebreaks": tiebreaks,
        "routes": route_rows,
        "validation_unsimplified": validation_unsimplified,
        "validation_final_simplified": validation_final,
        "simplification": simplification,
        "spot_checks": SPOT_CHECKS,
    }
    write_json(REPORT_JSON, report)
    print(json.dumps(
        {
            "gmina_count": report["gmina_source"]["feature_count"],
            "routes": route_rows,
            "validation": validation_final or validation_unsimplified,
            "simplification": simplification,
            "tiebreak_count": len(tiebreaks),
        },
        ensure_ascii=False,
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
