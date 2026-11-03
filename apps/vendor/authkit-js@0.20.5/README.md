# WorkOS AuthKit JS 0.20.5 (vendored browser build)

A single-file browser build of `@workos-inc/authkit-js` 0.20.5, added 2026-11-03 for the portals' WorkOS sign-in. The package ships ES and CommonJS modules only, and the portals have no build step, so the module is bundled once into a script that defines the global `WorkOSAuthKit` (`createClient`, `getClaims` and the error classes). The policy on every page allows scripts from the site itself, so the build is served from here rather than from a CDN.

- Source: https://registry.npmjs.org/@workos-inc/authkit-js/-/authkit-js-0.20.5.tgz
- Version: 0.20.5.
- Licence: MIT, `LICENSE` (copied from the package). The package vendors `browser-tabs-lock` (MIT, SuperTokens and VRAI Labs); both notices head the built file.
- Tarball SHA-256: `caba8ad04f9cff8b79919d53194a88e97c4f32fe3da0c13b147653acdbbc1b4d`.
- Package integrity (npm registry `dist.integrity`, SHA-512 of the tarball, checked against the download): `sha512-5e3C0xTMMlnDlaVAIOCk/G91W83lpb9ChPolCxTOQCkCuwn3w5qfuJze+5UNOIX1RRZv6rnzyb2FRfPdSThDkw==`.
- Input: the package's own `dist/index.mjs`, which imports nothing. The source was read before the build: it talks only to `api.workos.com` (`/user_management/authorize` by navigation, `/user_management/authenticate` and `/user_management/sessions/logout` by fetch).
- Build: esbuild 0.24.2, installed outside the repository with `npm install --save-exact esbuild@0.24.2`, run as

  ```sh
  esbuild <package>/dist/index.mjs --bundle --format=iife --global-name=WorkOSAuthKit \
    --minify --target=es2020 --legal-comments=none --charset=utf8 --outfile=authkit-build.js
  ```

  The two licence notices were then prepended as one comment, giving `dist/authkit.iife.min.js`.

| File | SHA-256 | SHA-384 |
| --- | --- | --- |
| `dist/authkit.iife.min.js` | `6de05fd974163c3f42f69f29f1b0e8a9a731b4bce5d720017f988f491ab1864c` | `sha384-Xb480BLL6+jtmlYmpSE/foQvtK3toejXy2JHaKRZsFlfFuO6qcLai++7to8J39Ey` |

Used by `apps/regions/nz/verification.html`, `apps/regions/nz/review.html` and `apps/regions/nz/auth-callback.html`, through `apps/regions/nz/js/convex-task-client.js`. The client creates it with `devMode: true`, which keeps the refresh token in the browser's local storage; see `docs/development/workos-sessions.md`.
