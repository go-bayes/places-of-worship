# Measurement diversity is display-worthy signal

Ratified by the project lead, 2026-07-11. Recorded by the conductor the same sitting.

## The principle

For a global map, the diversity of the data collections is part of the data interest. The heterogeneity of measurement regimes across countries — instrument, category frame, universe, geography grain, wave depth, licence posture — is signal to display, never harmonisation debt to hide. The project renders each country's record exactly and declares its measurement regime in a standard vocabulary; the aggregate of those declarations is itself a dataset, and a mappable one.

## What follows from it

- A measurement-regime view of the global map is in scope: categorical layers generated from the corpus's own manifests and quality-flag declarations. Candidate layers: instrument (census, survey, register, attendance count); wave depth and span; whether a no-religion category exists in the published frame (the flat-100 family is a finding about states, not a gap in the data); whether not-stated is separate, folded, or absent; counts versus percent-only publication; universe basis; geography grain; licence posture.
- The view requires no new data collection. Every layer derives from declarations the products already carry. The declarations discipline (render the record; bespoke meaning in standard vocabulary on a general shape) is what makes the aggregation possible.
- Standing rulings gain a display rationale: render-the-record, the refusal to invent concordances, and frame facts kept as frame facts (the Kiribati 1995 flat-100 precedent) become visible objects of study on the global surface.
- A tagged release gains a second citable artefact: the measurement-regime table alongside the data itself.

## The design guard (firm)

The measurement-regime view must be visually unconfusable with the substantive religion views. A country shaded for a frame property (for example "no no-religion category in the census") must never be readable as a religiosity value. The view is a fully separate mode with a categorical palette and its own legend, never an overlay on religion shading.

## Sequencing

The implementation slots after the area-summary.v2 work: the same metadata extractor over manifests and flags can feed the popup composition rendering and the global measurement-regime view from one declarations source. Neither is built yet; this document records the ratified principle and its boundaries.
