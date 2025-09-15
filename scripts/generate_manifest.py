#!/usr/bin/env python3
"""
Generate a lightweight dataset manifest for global places.

Outputs: data/global/manifest.json

Includes:
- generation timestamp
- total counts (from Parquet if available)
- per-country counts (from *_places.json files)
- file sizes and checksum placeholders
- ODbL attribution
"""

from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
import hashlib

try:
    import pyarrow.parquet as pq  # type: ignore
except Exception:
    pq = None  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "global"
MANIFEST = DATA_DIR / "manifest.json"


def sha256sum(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    meta = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "attribution": {
            "license": "ODbL-1.0",
            "url": "https://opendatacommons.org/licenses/odbl/1-0/",
            "text": "© OpenStreetMap contributors"
        },
        "files": {},
        "totals": {
            "global": None,
            "by_country": {}
        }
    }

    # Global Parquet summary
    parquet = DATA_DIR / "churches.parquet"
    if parquet.exists() and pq is not None:
        try:
            md = pq.ParquetFile(parquet).metadata
            meta["files"]["churches.parquet"] = {
                "size_bytes": parquet.stat().st_size,
                "sha256": sha256sum(parquet)
            }
            # Row count may be available via metadata or by reading
            try:
                row_groups = md.num_row_groups
                rows = sum(md.row_group(i).num_rows for i in range(row_groups))
                meta["totals"]["global"] = int(rows)
            except Exception:
                meta["totals"]["global"] = None
        except Exception:
            pass

    # Per-country JSON counts
    for fp in sorted(DATA_DIR.glob("*_places.json")):
        cc = fp.name[:2].upper()
        try:
            # Count records by scanning bytes for '\n  {' is fragile; better to load
            data = json.loads(fp.read_text())
            count = len(data)
        except Exception:
            count = None
        meta["totals"]["by_country"][cc] = count
        meta["files"][fp.name] = {
            "size_bytes": fp.stat().st_size,
            "sha256": sha256sum(fp)
        }

    MANIFEST.write_text(json.dumps(meta, indent=2))
    print(f"Wrote manifest: {MANIFEST}")


if __name__ == "__main__":
    main()

