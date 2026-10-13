# Cloudflare Pages hosting

Status: repository side only. The hosting move is item 8 of the 2026-10-13 country-speed plan (ruling D8, Joseph). The dashboard steps below are the maintainer's.

## Direction

religionmap.org is served from GitHub Pages (`main`, directory `/`). The move serves the same repository root from Cloudflare Pages, with no build step. DNS is already on Cloudflare. GitHub Pages stamps every asset with one deploy-wide ETag and `max-age=600`, so a returning visitor's cache seldom survives a working session. Cloudflare Pages ETags are content hashes, so a file left unchanged by a deploy revalidates with 304. Brotli and HTTP/3 come with the platform.

## Header policy

`_headers` at the repository root sets `Cache-Control` for static responses (Cloudflare documents the file for the build output directory, which here is the root).

- Pages, scripts, styles and data: `public, max-age=600, stale-while-revalidate=86400`. They keep revalidation.
- `/apps/vendor/*`: `public, max-age=31536000, immutable`. Library versions are in the directory names (`leaflet@1.9.4`), so the files never change in place.

Cloudflare merges the headers of every matching rule and joins duplicates with a comma. A catch-all `/*` rule beside `/apps/vendor/*` would therefore send both values for vendor files, so the file lists the revalidating paths one by one. A new top-level directory has no rule until one is added; it then gets the Pages default, which revalidates.

The `?v=` stamps on scripts and styles keep their role. A stamp changes the URL, so a browser inside the 600-second window fetches the new file at once instead of waiting out the old copy; the content-hash ETag only makes the revalidation cheap.

## Dashboard steps (maintainer)

1. Workers & Pages, Create, Pages, Connect to Git; choose `go-bayes/places-of-worship`.
2. Production branch `main`. Build command empty (Cloudflare's static-site guide suggests `exit 0` if the field must be filled). Build output directory `/` (the root; the documentation does not state that `/` is accepted, so check the first deploy serves `/index.html` and `/_headers` takes effect).
3. Custom domains: add `religionmap.org` and `www.religionmap.org`. Cloudflare rewrites the DNS records to the project's `pages.dev` name.
4. Keep GitHub Pages enabled for a week after the cutover.

The `CNAME` file in the root is a GitHub Pages convention. Cloudflare Pages does not read it and the documentation does not mention it; it is served as a harmless static file and must stay while GitHub Pages is the rollback.

## Rollback

Restore the four GitHub Pages A records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and the `www` CNAME to `go-bayes.github.io`.

## Preview origins

The tile Worker's CORS list, the MapTiler referrer lock, Google sign-in origins and Convex key on the unchanged production origin. A `pages.dev` preview origin is not on the Worker's list, so previews show the basemap without place dots until a Worker deploy adds that origin.

## Checks after cutover

`curl -sI` on a runtime script shows `content-encoding: br` and a content ETag; a second deploy that leaves the file unchanged keeps the ETag; `/apps/vendor/leaflet@1.9.4/...` shows a single `Cache-Control` value with `immutable` and no second value.
