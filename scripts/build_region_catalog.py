#!/usr/bin/env python3
"""Build the compact country data-map catalogue.

Reads each country page's default REGION_CONFIG level, the shipped
area-summary product, and the generated region bounding boxes. Writes a
deterministic catalogue for the shared country switcher:

    python3 scripts/build_region_catalog.py
"""

import hashlib
import json
import math
import re
import sys
import zlib
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
REGIONS = REPO / "apps" / "regions"
BBOXES = REGIONS / "_shared" / "data" / "region-bboxes.json"
OUT = REPO / "apps" / "shared" / "data" / "region-catalog.json"
TZ_OUT = REPO / "apps" / "shared" / "data" / "tz-index.json"
# system tz tables, best first: zone1970.tab leads each zone's codes
# column with its primary country; the deprecated zone.tab (all macOS
# ships) lists one country per row, which serves the same lookup
TZ_TABS = [
    Path("/usr/share/zoneinfo/zone1970.tab"),
    Path("/usr/share/zoneinfo/zone.tab"),
    Path("/var/db/timezone/zoneinfo/zone1970.tab"),
    Path("/var/db/timezone/zoneinfo/zone.tab"),
]
# hub codes are catalogue identities, not pure ISO 3166
ISO_TO_CATALOGUE = {"gb": "uk"}
NEIGHBOUR_GAP_DEG = 3.0
# symmetric adjacency overrides for isolated countries the degree rule
# misses: the tasman is wider than any gap threshold worth having, yet
# nz<->au is the hop those pages' users actually make
NEIGHBOUR_OVERRIDES = [
    ("nz", "au"),
]


def hub_names():
    # hub cards define the public country names and catalogue membership
    html = (REGIONS / "index.html").read_text(encoding="utf-8")
    names = {}
    for match in re.finditer(
        r'<a class="map-card" href="([a-z]{2})/">\s*'
        r'<div class="map-card-title">([^<]+)',
        html,
    ):
        names[match.group(1)] = match.group(2).strip()
    return names


def balanced_value(text, start, opening, closing):
    # scan one javascript object or array while ignoring quoted delimiters
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = start
    while index < len(text):
        char = text[index]
        nxt = text[index + 1] if index + 1 < len(text) else ""
        if line_comment:
            if char == "\n":
                line_comment = False
        elif block_comment:
            if char == "*" and nxt == "/":
                block_comment = False
                index += 1
        elif quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char in "'\"`":
            quote = char
        elif char == "/" and nxt == "/":
            line_comment = True
            index += 1
        elif char == "/" and nxt == "*":
            block_comment = True
            index += 1
        elif char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
        index += 1
    raise ValueError(f"unclosed {opening}{closing} value")


def property_container(text, name, opening, closing):
    # locate a conventional unquoted REGION_CONFIG property
    match = re.search(rf"\b{re.escape(name)}\s*:\s*{re.escape(opening)}", text)
    if not match:
        return None
    start = match.end() - 1
    return balanced_value(text, start, opening, closing)


def quoted_property(text, name):
    # config paths and level names are static quoted strings on shipped pages
    match = re.search(rf"\b{re.escape(name)}\s*:\s*(['\"])(.*?)\1", text, re.S)
    return match.group(2) if match else None


def config_payloads(page):
    # resolve the configured default level without evaluating page javascript
    html = page.read_text(encoding="utf-8")
    config = property_container(html, "REGION_CONFIG", "{", "}")
    if config is None:
        # REGION_CONFIG appears after an assignment rather than as a property
        match = re.search(r"window\.REGION_CONFIG\s*=\s*\{", html)
        if not match:
            raise ValueError("missing REGION_CONFIG")
        config = balanced_value(html, match.end() - 1, "{", "}")
    default_level = quoted_property(config, "defaultLevel")
    levels = property_container(config, "censusLevels", "{", "}")
    if not default_level or levels is None:
        raise ValueError("missing defaultLevel or censusLevels")
    level = property_container(levels, default_level, "{", "}")
    if level is None:
        raise ValueError(f"default level {default_level!r} is not configured")
    boundary = quoted_property(level, "boundaries")
    summary = quoted_property(level, "summary")
    if not boundary or not summary:
        raise ValueError(f"default level {default_level!r} lacks payload paths")

    # multi-vintage pages declare their complete wave sequence in timeline
    timeline = property_container(config, "timeline", "[", "]")
    waves = sorted({int(value) for value in re.findall(r"\byear\s*:\s*(\d{4})", timeline or "")})
    return boundary, summary, waves


def summary_waves(path):
    # ordinary pages derive their slider waves from the default summary rows
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as err:
        raise ValueError(f"unreadable summary: {err}") from err
    waves = sorted({row.get("year") for row in doc.get("rows", []) if isinstance(row.get("year"), int)})
    if not waves:
        legacy = doc.get("waves", [])
        waves = sorted({wave.get("year") for wave in legacy if isinstance(wave, dict) and isinstance(wave.get("year"), int)})
    if not waves:
        raise ValueError("summary contains no integer census waves")
    return waves


def payload_record(path, page_dir):
    # raw bytes bound parse and memory spend and feed the hash; the
    # zlib-6 length approximates the host's gzip transfer size, which
    # the switcher's prefetch budget spends (raw-byte budgeting barred
    # a third of the fleet's pairs from warming)
    data = path.read_bytes()
    return [
        path.relative_to(page_dir).as_posix(),
        len(data),
        hashlib.sha256(data).hexdigest(),
        len(zlib.compress(data, 6)),
    ]


def interval_gap(first, second):
    # minimum circular-longitude separation between two bbox intervals
    west_a, east_a = first
    west_b, east_b = second
    if east_a < west_a:
        east_a += 360.0
    if east_b < west_b:
        east_b += 360.0
    gaps = []
    for shift in (-360.0, 0.0, 360.0):
        left = west_b + shift
        right = east_b + shift
        gaps.append(max(left - east_a, west_a - right, 0.0))
    return min(gaps)


def box_gap(first, second):
    # euclidean separation in degrees between the nearest bbox edges
    lng_gap = interval_gap((first[0], first[2]), (second[0], second[2]))
    lat_gap = max(second[1] - first[3], first[1] - second[3], 0.0)
    return math.hypot(lng_gap, lat_gap)


def neighbours_for(code, boxes_by_code):
    # any pair of clustered country boxes within three degrees is adjacent,
    # plus the declared overrides (applied in both directions)
    overridden = {b for a, b in NEIGHBOUR_OVERRIDES if a == code}
    overridden |= {a for a, b in NEIGHBOUR_OVERRIDES if b == code}
    neighbours = []
    for other, other_boxes in sorted(boxes_by_code.items()):
        if other == code:
            continue
        if other in overridden or any(
            box_gap(first, second) <= NEIGHBOUR_GAP_DEG for first in boxes_by_code[code] for second in other_boxes
        ):
            neighbours.append(other)
    return neighbours


def tz_index(codes):
    # IANA zone name -> catalogue code, only for countries with data
    # maps; the switcher's home warm reads this to guess the visitor's
    # country from the device timezone without any permission prompt
    for tab in TZ_TABS:
        if not tab.is_file():
            continue
        index = {}
        for line in tab.read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) < 3:
                continue
            primary = fields[0].split(",")[0].strip().lower()
            code = ISO_TO_CATALOGUE.get(primary, primary)
            if code in codes:
                index.setdefault(fields[2].strip(), code)
        if index.get("Pacific/Auckland") == "nz":
            return index
        sys.exit(f"{tab} parsed but lacks Pacific/Auckland -> nz; refusing a broken index")
    sys.exit("no system zone tab found; cannot build the timezone index")


def main():
    names = hub_names()
    try:
        bbox_doc = json.loads(BBOXES.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        sys.exit(f"cannot read {BBOXES.relative_to(REPO)}: {err}")
    boxes_by_code = {region["code"]: region["boxes"] for region in bbox_doc.get("regions", [])}
    if set(names) != set(boxes_by_code):
        sys.exit("hub cards and region-bboxes country codes differ; rebuild region-bboxes first")

    catalogue = []
    for code, name in sorted(names.items()):
        page = REGIONS / code / "index.html"
        try:
            boundary_rel, summary_rel, waves = config_payloads(page)
            boundary = REGIONS / code / boundary_rel
            summary = REGIONS / code / summary_rel
            if not boundary.is_file() or not summary.is_file():
                raise ValueError("configured default payload is missing")
            if not waves:
                waves = summary_waves(summary)
        except (OSError, ValueError) as err:
            sys.exit(f"{code}: {err}")
        catalogue.append({
            "code": code,
            "name": name,
            "url": f"apps/regions/{code}/",
            "html_bytes": page.stat().st_size,
            "boundary": payload_record(boundary, page.parent),
            "summary": payload_record(summary, page.parent),
            "waves": waves,
            "neighbours": neighbours_for(code, boxes_by_code),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {"payload_fields": ["path", "bytes", "sha256", "gzip_bytes"], "regions": catalogue},
            ensure_ascii=False,
            separators=(",", ":"),
        ) + "\n",
        encoding="utf-8",
    )
    size = OUT.stat().st_size
    if size >= 40 * 1024:
        sys.exit(f"catalogue is {size} bytes; compact it below 40 KB")
    print(f"wrote {OUT.relative_to(REPO)}: {len(catalogue)} countries, {size} bytes")

    zones = tz_index({entry["code"] for entry in catalogue})
    TZ_OUT.write_text(
        json.dumps(zones, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    tz_size = TZ_OUT.stat().st_size
    if tz_size >= 16 * 1024:
        sys.exit(f"timezone index is {tz_size} bytes; keep it below 16 KB")
    print(f"wrote {TZ_OUT.relative_to(REPO)}: {len(zones)} zones, {tz_size} bytes")


if __name__ == "__main__":
    main()
