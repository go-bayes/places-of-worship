# Vector tiles from Wellington

The four fixtures come from `places-v2-20260901-grid`, which includes places tagged `amenity=place_of_worship` in OpenStreetMap as of 1 September 2026. Extract each XYZ tile with `pmtiles tile` and decompress it with `gzip -dc` to obtain the Mapbox Vector Tile protobuf for the `places` layer. [Source archive manifest](../../../../../tools/tiles-r2/manifests/places-v2-20260901-grid.manifest.json) · [Tile archive documentation](../../../../../tools/tiles-r2/README.md#openstreetmap-edition-build-2026-09-01)

Each raw record has `id`, `osm_id`, `osm_type`, `name`, `religion`, `denomination` and `country_code`. Optional fields are `name_en` and `start_date`. Contact fields and raw tags were absent from all 105 decoded records. Run `node apps/labs/relief/engine/fixtures/minimise.mjs` after extraction to remove `name_en` from the fixture property dictionaries. The script keeps the point geometry and all records, including any `start_date` values.

| Fixture | Address | SHA-256 | Features |
| --- | --- | --- | ---: |
| `wellington-z12-4036-2564.pbf` | [12/4036/2564](https://tiles.placemap.org/places-v2-20260901-grid/12/4036/2564) | `6f0730393ba79303f20565dd3132c314d38671b84b439788c7acbe5f1dde5489` | 66 |
| `wellington-z12-4036-2565.pbf` | [12/4036/2565](https://tiles.placemap.org/places-v2-20260901-grid/12/4036/2565) | `2c3a208e33154f9c6279196dc8f4ba3457206cf638647bc1459114c38bbdb041` | 26 |
| `wellington-z12-4037-2564.pbf` | [12/4037/2564](https://tiles.placemap.org/places-v2-20260901-grid/12/4037/2564) | `31fc51ffb8af62ddb3409bf23657a4bb77accba39188ae38738f1b5086fa9e60` | 4 |
| `wellington-z12-4037-2565.pbf` | [12/4037/2565](https://tiles.placemap.org/places-v2-20260901-grid/12/4037/2565) | `89c1a2558af7a2c79c99b12060e1eeaf55b33aba877f04f8c29a050aa33797e1` | 9 |

Of the 105 decoded records, zero are buffer copies and ten fall outside the central Wellington study area. The study area contains 95 distinct places.

Data © OpenStreetMap contributors, licensed under the Open Data Commons Open Database Licence (ODbL) 1.0. [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright)
