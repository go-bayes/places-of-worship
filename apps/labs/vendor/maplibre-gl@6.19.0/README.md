# MapLibre GL JS 6.19.0 (vendored for the labs pages)

Byte-for-byte copies of the browser build in the npm package `maplibre-gl@6.19.0`, added 2026-11-20 for the experimental pages under `apps/labs/`. The live map pages still load MapLibre GL 3.6.1 from unpkg.com and do not load these files.

- Source: https://registry.npmjs.org/maplibre-gl/-/maplibre-gl-6.19.0.tgz, files `dist/maplibre-gl.mjs`, `dist/maplibre-gl-worker.mjs`, `dist/maplibre-gl.css` and `LICENSE.txt`.
- Version: 6.19.0 (published 2026-11-17).
- Licence: BSD 3-Clause (`LICENSE.txt`, which also carries the mapbox-gl-js notice). The licences of the packages the build inlines are in `THIRD-PARTY-NOTICES.md`.
- Package integrity (npm registry `dist.integrity`, SHA-512 of the tarball): `sha512-3bOrnfddggUYudLGJFsYFvqulUyvSxy4iQzd/uURI7ZhgYEZifdSrECujRSghaCpc+v/ZsFI0Y6ZsGSilEtE+w==`.

| File | SHA-384 |
| --- | --- |
| `maplibre-gl.mjs` | `sha384-xwIwS2ZrVZdy1v8I+MtCDAkB+tCwelpTdNz9yPRN03mYLaG5HTwyhOnylbOgukuC` |
| `maplibre-gl-worker.mjs` | `sha384-E8aY1WBd+z+8ZBL1QMJn5vLopbA5jLXMO0KIHrPsXtYOgv5R8WZX8O0YTlvx57vN` |
| `maplibre-gl.css` | `sha384-S+OnE5M4U3Qc2nR0RgljGrVs06xqfRg8L7uFk/pOF5+sRuSDG4oKkqKZmFrx7w09` |

Version 6 ships as ES modules only. A page imports `maplibre-gl.mjs` from a same-origin module script; the build finds `maplibre-gl-worker.mjs` beside itself through `import.meta.url` and starts it as a same-origin module worker, which the site policy's `worker-src 'self'` allows. Version 6 also requires WebGL 2. The source maps are not vendored; the trailing `sourceMappingURL` comments are left as published, so a browser with developer tools open may report missing maps.
