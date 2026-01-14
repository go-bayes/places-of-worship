# Contributing to the Global Places of Worship Map

Thanks for contributing. This project keeps a *fast*, accessible map of global religious landscapes and respects ODbL requirements.

## Quickstart (frontend-only)

1) Run a static server from `apps/global/`:

```bash
python3 -m http.server 8080
```

2) Open `http://localhost:8080/`.

Optional local config:
- Copy `apps/global/config.example.js` to `apps/global/config.js` only if you can run the local API on your machine; otherwise leave it unset and use the default public endpoints.

## Where to make changes

- Map UI logic: `apps/global/index.html`
- Map styles: `apps/global/styles/maplibre-flat.css`
- Public keys/config: `apps/global/config.public.js`

## Data pipeline and tiles (optional)

Only needed if you are touching data/tiles:
- R 4.2+ for statistical processing and data cleaning.
- Python 3.14+ for utilities and manifests.
- Tippecanoe for tile generation.
- Docker + Martin for local tile serving.

See `docs/architecture.md` and `scripts/` for the current pipeline and tile endpoints.

## Data and licensing

- ODbL attribution must be preserved when using OSM data.
- Do *not* commit large datasets or raw exports (see `.gitignore` for `data/`, `research/`, `raw_data/`).

## Submitting changes

- Create a feature branch (e.g., `feature/temporal-slider` or `fix/mobile-dock`).
- Use Conventional Commits (e.g., `feat: add denomination filter`).
- Open a PR to `main` with a clear description and screenshots for UI changes.
