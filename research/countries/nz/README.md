# Country data map: New Zealand (NZ)

Status: live pilot country — the survey card for NZ follows once the
country-survey playbook runs; the authoritative record of what is built
meanwhile lives in the changelog, the manifests, and
`apps/regions/nz/`.

- **Live**: territorial-authority and SA2 census religious-affiliation
  overlays, censuses 2013/2018/2023 (Stats NZ, CC BY 4.0), on the
  shared region-map runtime.
- **Deep-history potential** (to be surveyed properly): Papers Past,
  NZ Heritage List / Rārangi Kōrero, denominational yearbooks and
  archives, historical censuses (religion asked from the 19th
  century), Retrolens aerial imagery.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: OpenStreetMap via ohsome API, <https://api.ohsome.org/v1/elements/centroid>.
- **Exact tables**: `osm-ohsome-elements-centroid`; no census table ID appears in the OSM manifests. Filter `amenity=place_of_worship`; 1 September snapshots for 2013-2025. Source-data access for the census data map is pending a Stats NZ customised-data request.
- **Licence**: ODbL-1.0
- **Our extraction script**: `scripts/build_nz_osm_temporal_candidates.R`.
- **Retrieval recipe and hashes**: `docs/manifests/osm-pow-nz-2013-2025-raw-ohsome-dffb55663f94.json` and `docs/manifests/osm-pow-nz-2013-2025-places-to-check-ef64ba809ced.json`.
