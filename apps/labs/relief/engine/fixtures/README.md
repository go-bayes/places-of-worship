# Vector tiles from Wellington

Four XYZ tiles were retrieved from the public tile service for religionmap.org on 2026-11-20. Each file contains an uncompressed Mapbox Vector Tile protobuf with a `places` layer. At zoom 12, the `places` and `places-v2-20260722-grid` tilesets share identical payloads. [Source archive manifest](../../../../../tools/tiles-r2/manifests/places-v2-20260722-grid.manifest.json) · [Tile archive documentation](../../../../../tools/tiles-r2/README.md#grid-thinned-tiers)

Run `node apps/labs/relief/engine/fixtures/minimise.mjs` to rebuild the property dictionaries. The script preserves the point geometry and each occurrence. It keeps `id`, `name`, `religion`, `denomination`, `start_date` and the remaining fields used to reconcile tile ownership (`osm_id`, `osm_type`, `country_code` and `country` where present). The resulting tiles contain no phone, address, website or raw tags fields.

| Fixture | Address | SHA-256 | Features |
| --- | --- | --- | ---: |
| `wellington-z12-4036-2564.pbf` | [12/4036/2564](https://tiles.placemap.org/places-v2-20260722-grid/12/4036/2564) | `d0aabd5230f8349b1f4e09a609d1d81041af80381a1a0c5cf329cc13dad59fd0` | 86 |
| `wellington-z12-4036-2565.pbf` | [12/4036/2565](https://tiles.placemap.org/places-v2-20260722-grid/12/4036/2565) | `01e28159907d90ee1f6051f196db7339bb1fa2dee8958b023cd465b611c9c7f8` | 34 |
| `wellington-z12-4037-2564.pbf` | [12/4037/2564](https://tiles.placemap.org/places-v2-20260722-grid/12/4037/2564) | `5d6714c176e28479bb8630beda307502f7cae6dabd54e2bd63a3f080aab64da6` | 5 |
| `wellington-z12-4037-2565.pbf` | [12/4037/2565](https://tiles.placemap.org/places-v2-20260722-grid/12/4037/2565) | `3a3a7f25a7881fd49a75c5605ad886ea6101ab96c7b30eb3a35c66ea0bfed3e8` | 12 |

Data © OpenStreetMap contributors, licensed under the Open Data Commons Open Database Licence (ODbL) 1.0. [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright)
