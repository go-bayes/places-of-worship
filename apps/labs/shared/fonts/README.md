# Fonts for the labs pages

Self-hosted so the site policy's `font-src 'self'` holds. Both families are by Adobe, released under the SIL Open Font License 1.1; the licence texts are `OFL-source-sans-3.txt` and `OFL-source-serif-4.txt`.

- Source Sans 3, variable weight, upright: `source-sans-3-latin-wght-normal.woff2` and `source-sans-3-latin-ext-wght-normal.woff2`, from the npm package `@fontsource-variable/source-sans-3@5.3.1`.
- Source Serif 4, variable weight, italic: `source-serif-4-latin-wght-italic.woff2` and `source-serif-4-latin-ext-wght-italic.woff2`, from the npm package `@fontsource-variable/source-serif-4@5.3.1`.

The files are unmodified copies. `../labs.css` declares them with the subsets' unicode ranges, so a page fetches the extended Latin file only when it shows those characters.
