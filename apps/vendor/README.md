# Vendored browser libraries

Third-party builds served from this repository instead of a CDN. Each folder is `<package>@<version>/` and holds the package's `LICENSE` (plus `THIRD-PARTY-NOTICES.md` where the build inlines other packages) and a `README.md` naming the source URL, version, licence and SHA-384 of each file. Files are unmodified copies of the npm package contents, with one exception: `authkit-js@0.20.5/` holds a browser build made from the package's own module with a pinned esbuild, because the package ships no single-file browser script; its `README.md` records the build command and the hashes of input and output.

Used by `apps/regions/nz/verification.html` and `apps/regions/nz/review.html`. The country and global map pages still load MapLibre GL 3.6.1 from unpkg.com; vendoring it is a later step.
