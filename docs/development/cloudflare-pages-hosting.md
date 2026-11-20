# Cloudflare Pages hosting

Cloudflare Pages publishes the static site at `religionmap.org` when `main` advances. The maintainer decided on 2026-10-13 to move the site to Cloudflare Pages. Cloudflare manages DNS.

## Direction

The 2026-10-13 plan specified serving the repository root as static files. On GitHub Pages, one deploy-wide ETag and `max-age=600` shortened the useful life of a returning visitor's cache. The plan expected Cloudflare Pages to retain ETags for unchanged files across deploys and to serve Brotli and HTTP/3.

## Header policy

`_headers` at the repository root sets `Cache-Control` for static responses (Cloudflare documents the file for the build output directory, which here is the root; `#` comment lines are documented).

- Pages, scripts, styles and data, including `/schemas/*`: `public, max-age=600, stale-while-revalidate=86400`. They keep revalidation.
- `/apps/vendor/*`: `public, max-age=31536000, immutable`. Library versions are in the directory names (`leaflet@1.9.4`), so the files never change in place.

Cloudflare merges the headers of every matching rule and joins duplicates with a comma. A catch-all `/*` rule beside `/apps/vendor/*` would therefore send both values for vendor files, so the file lists the revalidating paths one by one. A new top-level directory uses the Pages default until `_headers` lists the path. The plan expected the default to revalidate and `/index.html` to resolve to `/`.

When a `?v=` stamp changes on a script or stylesheet, browsers request the new URL even if they still hold the old file in cache.

## Original dashboard plan (2026-10-13)

The steps below record the planned settings. Verify the active settings in the dashboard before changing them.

1. Connect the Pages project to `go-bayes/places-of-worship` under Workers & Pages.
2. Use `main` as the production branch and the repository root (`/`) as the build output directory. Leave the build command empty or use `exit 0` if the field is required.
3. Add `religionmap.org` and `www.religionmap.org` as custom domains. The plan expected Cloudflare to point both DNS records to the project's `pages.dev` hostname.
4. Keep GitHub Pages enabled for a week after the cutover.

## Rollback

The root `CNAME` retains the GitHub Pages custom domain for rollback. Before restoring DNS for GitHub Pages, verify that GitHub Pages can serve the custom domain. Restore the four GitHub Pages A records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and the `www` CNAME to `go-bayes.github.io`. For DNS-only records and certificate recovery, see the [storage guide](../data-storage.md#current-data-locations).

## Preview origins

In the tile Worker, `originAllowed` accepts the production origins and both `https://places-of-worship.pages.dev` and `https://<label>.places-of-worship.pages.dev`. Verify tile loading, basemaps and sign-in on a deployed preview.

## Checks after cutover

Request a runtime script with `Accept-Encoding: br` and check the response encoding and ETag. After a deploy that leaves the script unchanged, check whether the ETag is stable and a conditional request returns 304. Check HTTP/3, the default cache policy, and the responses to `/index.html` and `/CNAME`. Verify that a file under `/apps/vendor/leaflet@1.9.4/` returns a single `Cache-Control` value with `immutable`.
