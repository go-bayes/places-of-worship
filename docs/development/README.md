# Development Docs

This folder holds implementation-facing notes, command-line tutorials, and
pipeline contracts that are useful for maintainers but should not be the first
surface for research assistants in the NZ pilot.

The current RA workflow is map-first:

1. Open the assigned NZ verification-map workpack link.
2. Sign in with Google when the shared backend is enabled.
3. Use the UI to inspect tasks and record source-backed evidence.
4. Save a draft or submit for review through the shared backend.
5. Use the spreadsheet row export only as a fallback or debugging path.

Development docs here may mention `pow validate`, `pow stage`, `pow propose`,
or staging internals. Use them when maintaining the backend and CLI pipeline,
not as the default RA task guide.

Current development references:

- `nz-osm-temporal-cleaning.md`: how the annual OSM places-to-check files are
  generated.
- `nz-temporal-ra-workpack.md`: how the first curated 50-record New Zealand RA
  temporal workpack is selected from those generated files and converted into a
  Convex-backed web assignment.
