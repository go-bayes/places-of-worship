# The small-cell rule: display and derivation for small counts

Status: RATIFIED 2026-07-12 by the PI ("I've read and agree with the small cell decision in docs", fourth sitting), having been PROPOSED earlier the same day by the conductor at the PI's direction ("let's develop a small cell rule"). The principles in §2 restate standing practice; the thresholds in §3 are now in force; implementation proceeds as §4 describes and unblocks the covered list in §5. Sri Lanka's DSD-level product is the motivating case and heads the covered list.

## 1. The problem the rule solves

Fine-grained products put small numbers on public maps. A division of 40 people whose census row shows 3 Muslims renders a 7.5 percent share with the same visual authority as a district of 400,000, and a single household's response can move a small unit's choropleth colour across the whole ramp. Two distinct risks follow. The first risk is statistical: shares computed on small denominators are fragile, and the map's colour encoding cannot show that fragility unless we make it. The second risk is interpretive: a derived share can appear to reveal more than the source chose to publish, especially where a source protects its own small cells and our arithmetic could undo that protection. The corpus already handles source-applied protections case by case (NZ's rr3 rounding, MONSTAT's z-suppression, Geostat's ≤10 suppression); this rule fills the remaining gap — sources that publish exact small counts with no protection of their own — and fixes one uniform display treatment for both.

## 2. Principles (standing practice, restated as rule)

The first principle: the project republishes only what the source published. A cell the source suppressed stays suppressed on every surface, and the project never recovers a suppressed cell by differencing margins, even where the arithmetic is trivial — the Georgia 2014 treatment (bounds recorded, cells never recovered) is the model.

The second principle: published small cells render — the render-the-record rule is not suspended for small numbers. A source that printed a 3-person cell made that disclosure decision itself; the project neither hides the cell nor pretends it carries more precision than it does.

The third principle: the project's own derivations must not outrun the record. Shares, densities, and change values computed from small cells carry the fragility of their inputs, and the display must declare it.

## 3. The thresholds (recommendation, awaiting ratification)

The rule uses two thresholds, one on the denominator and one on the numerator.

The denominator threshold governs the choropleth. Where a unit's metric denominator (the universe total the share is computed over) falls below **100 persons**, the unit washes pale on the map (the existing pale-wash machinery) and its popup leads with the published counts; the share still computes and appears in the popup, marked as resting on a denominator under 100, but it never colours the map. The wash treatment extends the established semantics (rr3 and suppressed denominators already wash) to unprotected small denominators.

The numerator threshold governs share display inside popups and downloads. Where a metric's numerator count falls below **10 persons**, the share renders with an explicit small-count marker ("fewer than ten people") wherever it appears; minority-share and no-religion metrics are the main carriers. The count itself renders as published.

Source-specific regimes supersede both thresholds: where a source applies its own protection (rr3, z-suppression, ≤10 suppression), the product keeps that regime's disclosed handling and does not stack this rule on top of it.

## 4. Implementation shape

Affected rows carry two new quality-flag tokens, `small_denominator_under_100` and `small_cell_under_10`, emitted by the build scripts from the published counts. The shared runtime adds `small_denominator` to its wash-token list so the existing legend note machinery names the reason ("small or suppressed denominators"), and the popup renders the small-count marker from the numerator token. No value is altered, redistributed, or hidden by the implementation; the tokens change display emphasis only. Implementation follows ratification as one runtime change plus per-product token emission, and slots behind the area-summary.v2 structural lane in the work order.

## 5. Covered products

The rule covers any product whose finest geography yields metric denominators or numerator cells below the thresholds. The list at proposal, with Sri Lanka added by the PI (2026-07-12):

- **Sri Lanka, DSD-level (the motivating case).** The live LK page renders 25 districts; the deeper Divisional Secretariat Division product was recorded at build time as needing exactly this rule. Ratification unblocks that lane.
- **Solomon Islands, ward-level.** Religion is published for ~180 wards in both waves; the ward product waits on a ward boundary layer and, once unblocked, on this rule.
- **Samoa, village-level.** The 339-village route preserved at build time as the deeper product.
- **Antigua and Barbuda, parish-level.** Barbuda's small population sits under any reasonable threshold.
- Any future settlement-grain or enumeration-area product.

## 6. What this rule does not do

The rule does not suppress, perturb, or round any published value; it does not apply to national or large-unit products whose cells all clear the thresholds; and it does not replace source-specific protection regimes or the documented-discrepancy machinery. It is a display-honesty rule: the map stops asserting precision the record cannot support, and every number a reader can reach remains exactly the number the source printed.
