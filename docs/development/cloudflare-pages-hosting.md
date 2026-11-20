# Cloudflare Pages hosting

GitHub Pages serves `religionmap.org`. Cloudflare manages DNS. Cloudflare Pages builds the same repository and serves the site at `places-of-worship.pages.dev` and its preview subdomains. The maintainer decided on 2026-10-13 to switch the custom domain to Cloudflare Pages. The cutover is planned.

## Current production setup

The root `CNAME` sets the GitHub Pages custom domain. At the apex, A records point to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`. For `www`, the CNAME points to `go-bayes.github.io`. Keep these records DNS only while GitHub Pages serves the custom domain. For certificate recovery, see the [storage guide](../data-storage.md#current-data-locations).

On 2026-11-20, production responses returned `Server: GitHub.com` and `Cache-Control: max-age=600`, a ten-minute cache lifetime. Four responses had distinct ETags with a common prefix. Compare ETags for the same unchanged file across GitHub Pages deployments to determine whether the ETag stays the same.

## Header policy

The repository tracks `_headers` at its root. Cloudflare Pages applies the rules from the deployed `_headers` file to responses for static assets. On 2026-11-20, a vendor file at `places-of-worship.pages.dev` returned `Cache-Control: public, max-age=31536000, immutable`. See the [Cloudflare Pages header documentation](https://developers.cloudflare.com/pages/configuration/headers/).

- Pages, scripts, styles and data, including `/schemas/*`: `public, max-age=600, stale-while-revalidate=86400`. They keep revalidation.
- `/apps/vendor/*`: `public, max-age=31536000, immutable`. Library versions are in the directory names (`leaflet@1.9.4`), so the files never change in place.

Cloudflare merges the headers of every matching rule and joins duplicates with a comma. A catch-all `/*` rule beside `/apps/vendor/*` would therefore send both values for vendor files, so the file lists the revalidating paths one by one. A new top-level directory uses the Pages default until `_headers` lists the path. The plan expected the default to revalidate and `/index.html` to resolve to `/`.

When a `?v=` stamp changes on a script or stylesheet, browsers request the new URL even if they still hold the old file in cache.

## Planned cutover

1. Verify the connected repository, production branch, build command and build output directory in the Cloudflare Pages dashboard.
2. At cutover, add `religionmap.org` and `www.religionmap.org` as custom domains in Cloudflare Pages. Verify the resulting DNS records and HTTPS for both names.
3. Keep GitHub Pages enabled for a week after the cutover, as specified in the 2026-10-13 plan.

## Preview origins

In the tile Worker, `originAllowed` accepts the production origins and both `https://places-of-worship.pages.dev` and `https://<label>.places-of-worship.pages.dev`. Verify tile loading, basemaps and sign-in on a deployed preview.

## Verify Cloudflare Pages responses

On Cloudflare Pages, request a runtime script with `Accept-Encoding: br` and inspect the response encoding and ETag. After a deploy that leaves the script unchanged, verify whether the ETag stays the same and a conditional request returns 304. Verify HTTP/3, the default cache policy and the responses to `/index.html` and `/CNAME`. After cutover, verify that a file under `/apps/vendor/leaflet@1.9.4/` on the custom domain returns a single `Cache-Control` value with `immutable`.
