# Vendored browser libraries

Third-party builds served from this repository instead of a CDN. Each folder is `<package>@<version>/` and holds the package's `LICENSE` and a `README.md` naming the source URL, version, licence and SHA-384 of each file. Files are unmodified copies of the npm package contents.

Used by `apps/regions/nz/verification.html` and `apps/regions/nz/review.html`. The country and global map pages still load MapLibre GL 3.6.1 from unpkg.com; vendoring it is a later step.
