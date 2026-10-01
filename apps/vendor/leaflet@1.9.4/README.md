# Leaflet 1.9.4 (vendored)

Byte-for-byte copy of the npm package `leaflet@1.9.4`, added 2026-10-02 so that the portals no longer load it from unpkg.com.

- Source: https://registry.npmjs.org/leaflet/-/leaflet-1.9.4.tgz (the files unpkg.com serves at https://unpkg.com/leaflet@1.9.4/dist/).
- Version: 1.9.4.
- Licence: BSD 2-Clause (see `LICENSE`).
- Package integrity (npm registry `dist.integrity`, SHA-512 of the tarball): `sha512-nxS1ynzJOmOlHp+iL3FyWqK89GtNL8U8rvlMOsQdTTssxZwCXh8N2NB3GDQOL+YR3XnWyZAxwQixURb+FA74PA==`.

| File | SHA-384 |
| --- | --- |
| `dist/leaflet.js` | `sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH` |
| `dist/leaflet.css` | `sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H` |

The portals' earlier unpkg tags pinned `leaflet.js` at `sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=` and `leaflet.css` at `sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=`; both files here match those values.

`dist/images/` holds the five images `leaflet.css` references by relative path. The source maps (`leaflet.js.map`) are not vendored; the trailing `sourceMappingURL` comment is left as published, so a browser with developer tools open may report one missing map.
