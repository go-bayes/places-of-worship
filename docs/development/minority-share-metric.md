# Minority-share metric for flat-frame census products

Ratified by the project lead 2026-07-11 (PI task 6); designed by the conductor on the Israel two-slot precedent. This document is normative for every product whose category frame sums to 100 percent by construction.

## The problem

Several official category frames partition the enumerated population into religions with no non-affiliation category: Bangladesh (five categories), Cambodia (four, re-based), and Sri Lanka (six). For these products the legacy headline metric `religious_affiliation_percent` is 100 everywhere by construction, and a choropleth of it carries no signal. The informative variation is composition — which religion people report — and the shared runtime exposes no composition metric. Their pages have been staged dark on exactly this gap (the Bangladesh ruling of 2026-07-11: the first public map must carry real signal rather than a flat-100 choropleth).

## The design: two-slot reuse with a declared reference group

The Israel product established the pattern this design generalises: the two legacy metric slots carry declared constructs, the declaration rides the indicators block, and each page relabels the metrics verbatim through `metricLabels`. No runtime change, no schema change, and no page-tag bump is needed.

For a flat-frame product the builder emits:

- **`religious_affiliation_percent` := the reference-group share.** The reference group is the product's largest published category at the national level in the most recent wave, declared once per product and held constant across every wave and area (Bangladesh: Muslim; Cambodia: Buddhist; Sri Lanka: Buddhist). The slot's declaration names the group and states that the value is that group's share of the frame, never a measure of affiliation versus non-affiliation.
- **`no_religion_percent` := the minority share**, the exact complement: the summed share of every published category outside the reference group. The declaration states that this is arithmetic on published affiliation categories — the share outside the country's largest published category — and is not a measure of no religion, belief, practice, or secularity.
- **`religious_change`** then differences the reference-group share across comparable waves, which is a real quantity (the change in the largest group's share), subject to each product's existing comparability rulings (Cambodia withholds it for the two reclassification provinces; Sri Lanka's 2001 nulls break the chain where coverage was unenumerated).

Each page relabels the two slots verbatim: the affiliation slot as "<Reference group> (%)" and the no-religion slot as "Minority share (%)", with a note reading "share outside <country>'s largest published category, <reference group>". The popup denominator note and the overview repeat the declaration.

## Why the reference group is fixed nationally

A per-area largest group would flip the metric's meaning from area to area and wave to wave — the same colour would answer different questions in different places. One fixed reference group per product keeps a single construct on the map: every shaded value answers "what share of this area's enumerated population reported a religion other than the country's largest published category?" The minority share is highest exactly where the map is most informative (Rangamati, Ratanak Kiri, the Northern Province), which is the signal the flat headline hides.

## What this design is not

The minority share makes no claim about belief, practice, minority status in law, or self-understood identity; it is arithmetic on the official frame. Products whose frames carry a real non-affiliation category keep the ordinary slot semantics — this design never applies to them. Palau is the boundary case and stays OUT: its 2005 wave has a real None-or-refused category in the no-religion slot, and its 2015/2020 waves ship with the flat-construction disclosure note instead (project-lead ruling, task 10) rather than a mid-series construct switch.

## Implementation

Builder-level re-emit for `bd`, `kh`, and `lk`: each builder assigns the two slots as above, declares both constructs in the manifest indicators block, and records the reference group and its national most-recent-wave share as evidence. Pages wire `metricLabels` relabelling and carry the declarations. The runtime is untouched.
