# Cloudflare Pages hosting

Status: repository side only. The hosting move follows the maintainer's decision of 2026-10-13. The dashboard steps below are the maintainer's. Statements marked "to confirm on the first deploy" are expectations that Cloudflare's header documentation does not support; the checks at the end settle them.

## Direction

religionmap.org is served from GitHub Pages (`main`, directory `/`). The move serves the same repository root from Cloudflare Pages, with no build step. DNS is already on Cloudflare. GitHub Pages stamps every asset with one deploy-wide ETag and `max-age=600`, so a returning visitor's cache seldom survives a working session. Expected, to confirm on the first deploy: Cloudflare Pages ETags are content hashes, so a file left unchanged by a deploy revalidates with 304, and the platform serves Brotli and HTTP/3.

## Header policy

`_headers` at the repository root sets `Cache-Control` for static responses (Cloudflare documents the file for the build output directory, which here is the root; `#` comment lines are documented).

- Pages, scripts, styles and data, including `/schemas/*`: `public, max-age=600, stale-while-revalidate=86400`. They keep revalidation.
- `/apps/vendor/*`: `public, max-age=31536000, immutable`. Library versions are in the directory names (`leaflet@1.9.4`), so the files never change in place.

Cloudflare merges the headers of every matching rule and joins duplicates with a comma. A catch-all `/*` rule beside `/apps/vendor/*` would therefore send both values for vendor files, so the file lists the revalidating paths one by one. A new top-level directory has no rule until one is added; it then gets the Pages default, which is expected to revalidate (to confirm on the first deploy; the documentation does not state the default). `/index.html` has no rule of its own: it is expected to resolve to `/` (to confirm on the first deploy).

The `?v=` stamps on scripts and styles keep their role. A stamp changes the URL, so a browser inside the 600-second window fetches the new file at once instead of waiting out the old copy; the content-hash ETag only makes the revalidation cheap.

## Dashboard steps (maintainer)

1. Workers & Pages, Create, Pages, Connect to Git; choose `go-bayes/places-of-worship`.
2. Production branch `main`. Build command empty (Cloudflare's static-site guide suggests `exit 0` if the field must be filled; the header documentation does not cover build settings, so confirm which is accepted). Build output directory `/` (the root; to confirm on the first deploy, since the documentation does not state that `/` is accepted: check that the site serves `/` and that `_headers` takes effect).
3. Custom domains: add `religionmap.org` and `www.religionmap.org`. Cloudflare is expected to rewrite the DNS records to the project's `pages.dev` name (to confirm on the first deploy).
4. Keep GitHub Pages enabled for a week after the cutover.

The `CNAME` file in the root is a GitHub Pages convention. Cloudflare Pages is expected to ignore it and serve it as a static file (to confirm on the first deploy; the documentation does not mention it). It must stay while GitHub Pages is the rollback.

## Rollback

Restore the four GitHub Pages A records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and the `www` CNAME to `go-bayes.github.io`.

## Preview origins

The tile Worker, the basemap referrer lock and the sign-in origins are configured for the unchanged production origin. A `pages.dev` preview origin is not among them, so previews show the basemap without place dots until the Worker, the referrer lock and the sign-in origins add that origin.

## Checks after cutover

`curl -sI` on a runtime script shows `content-encoding: br` and a content ETag; a second deploy that leaves the file unchanged keeps the ETag; `/apps/vendor/leaflet@1.9.4/...` shows a single `Cache-Control` value with `immutable` and no second value.
