#!/usr/bin/env python3
"""Scrub build-machine identities and private paths from the public tile records.

The 2026-10-07 manifests, validation reports, changelog entries and build scripts
recorded the build machine's name and the absolute paths of its work directories
(`green:/Users/...`, `~/tiles-build-...`). The public information boundary keeps
machine identities and storage layouts out of the public repository, so this script
rewrites them to neutral placeholders:

  green:<path>/<name>.pmtiles        -> build-cache:<name>.pmtiles
  <private work directory>/...       -> <work>/...
  <private archive directory>/...    -> <archive>/...
  "on green" / "from green"          -> "on the build machine" / "from the build machine"

Digests, counts and manifest ids are untouched: a manifest id hashes the archive
digests and the build parameters, not the file locations. Run from the repository
root; `--check` only reports what remains. The private handover keeps the real
locations.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TARGETS = [
    "CHANGELOG.md",
    "tools/tiles-r2/README.md",
    "tools/tiles-r2/build_tiles_v2.py",
    "tools/tiles-r2/build_places_v2.py",
    "tools/tiles-r2/run_tiles_v2.sh",
    "tools/tiles-r2/run_places_v2.sh",
    *sorted(str(p.relative_to(REPO)) for p in (REPO / "tools/tiles-r2/manifests").glob("*")),
]
# order matters: the specific archive and work-directory shapes first, the bare prefixes last
RULES = [
    (re.compile(r"green:(?:/Users/[^/\s\"']+|~)/[A-Za-z0-9._/-]*/([A-Za-z0-9._-]+\.(?:pmtiles|mbtiles|ndjson|json))"), r"build-cache:\1"),
    (re.compile(r"(?:/Users/[^/\s\"']+|~)/tiles-archive-2026-07/tiles-migration/"), "<archive>/"),
    (re.compile(r"(?:/Users/[^/\s\"']+|~)/tiles-build-2026-10-07/work-fallback/"), "<work-fallback>/"),
    (re.compile(r"(?:/Users/[^/\s\"']+|~)/tiles-build-2026-10-07/places-v2/?"), "<work-places>/"),
    (re.compile(r"(?:/Users/[^/\s\"']+|~)/tiles-build-2026-10-07/v3/work/?"), "<work>/"),
    (re.compile(r"(?:/Users/[^/\s\"']+|~)/tiles-build-2026-10-07/work/?"), "<work>/"),
    (re.compile(r"(?:/Users/[^/\s\"']+|~)/tiles-build-2026-10-07/?"), "<work>/"),
    (re.compile(r"\bon green\b"), "on the build machine"),
    (re.compile(r"\bfrom green\b"), "from the build machine"),
    (re.compile(r"\(green\)"), "(the build machine)"),
    (re.compile(r"<work>//"), "<work>/"),
]
LEAK = re.compile(r"/Users/[A-Za-z]|green:/|green:~|~/tiles-|\bon green\b|\bfrom green\b")


def scrub(text):
    for pattern, repl in RULES:
        text = pattern.sub(repl, text)
    return text


def main():
    check = "--check" in sys.argv
    leaks = []
    for rel in TARGETS:
        path = REPO / rel
        if not path.is_file():
            continue
        before = path.read_text(encoding="utf-8")
        after = before if check else scrub(before)
        if not check and after != before:
            path.write_text(after, encoding="utf-8")
            print(f"scrubbed {rel}")
        for i, line in enumerate(after.splitlines(), 1):
            if LEAK.search(line):
                leaks.append(f"{rel}:{i}: {line.strip()[:120]}")
    if leaks:
        print("remaining private strings:", file=sys.stderr)
        for leak in leaks:
            print(" ", leak, file=sys.stderr)
        sys.exit(1)
    print("no private strings remain in the tile records")


if __name__ == "__main__":
    main()
