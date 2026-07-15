# Data sidebar design space and overlay-ready layer model

Drafted 2026-07-16. This note records a deliberate widening of the sidebar design space, the direction chosen, and the layer model the sidebar must be ready to carry when economic and demographic overlays arrive. Provenance: a GPT-5.6 (high effort) brainstorm over the live runtime on 2026-07-16, curated and decided by the conductor; design authority stays with the project lead, and nothing here is built yet.

## The problem

The panel improved recently, but it still carries its contents implicitly. Dataset identity, construct, denominator, coverage, source, and licence are scattered across `dataNoun`, `metricLabels`, onboarding copy, popup notes, attribution strings, and the area-summary product; the panel presents only a subset, and the runtime still defines metrics in JavaScript while the shipped products already carry `source_datasets`, `indicators`, and `visual_layers`. Two pages show the strain plainly. The Netherlands page bends its geography selector into a construct selector (affiliation versus attendance). The United States page changes construct across its own timeline (seating, then members, then adherents) and must explain that shift in prose. A reader should be able to answer "what exactly am I looking at?" from the panel alone, with zero interaction.

## Directions considered

Six directions were assessed, from cheapest to heaviest:

1. **Dataset passport with expandable evidence.** A two-line passport above the controls (source · construct on the first line; geography · wave · universe on the second), a persistent one-sentence colour-meaning statement under the legend, and collapsed evidence sections (Source and licence; Coverage; Comparability; Method). Zero-interaction answer, one tap to full provenance. Effort 4–7 days.
2. **Annotated cartographic legend.** The legend becomes the organising object: its title names dataset, construct, indicator, geography, and wave; its body explains colour direction, range, clamping, no-data, and quality washes. Near-zero interaction cost, very high code reuse, limited room for multiple layers. Effort 2–4 days.
3. **Layer-recipe breadcrumb.** The map state as a tappable recipe (Religion → Census affiliation → Affiliated share → SA2 → 2023). Legible hidden state, but more taps for routine switching.
4. **Research evidence inspector.** A dockable rail with Map / Method / Sources / Area tabs. Serves investigators; heavy for casual visitors. Effort 2–3 weeks.
5. **Explicit layer stack.** One card per visible layer (fill, context overlays, points), each carrying source, period, construct, and comparability status; only one card owns the choropleth fill. The right shape once overlays exist; premature before then. Effort 2–3 weeks with the multi-domain runtime.
6. **Minimal map card plus full dossier.** A terse card on the map; everything else in a dossier page. The project already half-owns this direction: every country ships an `overview.html` dossier.

## Decision

Adopt a composite of directions 1 and 2 now: a **dataset passport** above the controls, with the legend upgraded to carry the annotated title and the colour-meaning sentence, and collapsed evidence sections below. Keep `overview.html` as the dossier (direction 6 already exists in that form) and link it from the passport's evidence sections. Defer the layer-stack cards (direction 5) until the overlay registry lands — it is the planned growth path, and the passport's first line is designed to become the "active fill" card when that day comes. The research inspector (direction 4) stays a possible research-mode enhancement and is never the default surface. The breadcrumb (direction 3) is declined: it taxes routine switching to solve a problem the passport solves statically.

Two implementation rules bind. The first rule is that the passport must be generated from product metadata (`source_datasets`, `indicators`, `visual_layers`, and the per-page config); hand-written per-country passport prose is excluded, because parallel prose copies drift and 100 pages make drift certain. The second rule is that the panel keeps a zero-interaction answer: passport, active legend, and colour sentence are always visible; everything else is progressive disclosure. On mobile, the passport and legend stay in the top sheet and the evidence sections open in a scrollable bottom sheet (the current `touch-action: none` treatment needs narrowing to permit that scroll).

## Layer model for economic and demographic overlays

The overlay plan in [multi-domain-overlay-design.md](multi-domain-overlay-design.md) stands: domain → metric hierarchy, one choropleth fill at a time, a single timeline, and a compatibility shim for current pages. The additions below make the sidebar honest about multi-layer state.

**Indicator observations go long-form.** The wide religion-specific row schema does not extend to income or age structure. The canonical analytical product becomes long-form observations (country, boundary_set_id, area_unit_id, indicator_id, period_id, value, denominator_value, uncertainty, source_dataset_ids, quality_flags), and each indicator declares its domain, construct, collection method, unit and denominator, native period, universe, sources, and licence. Construct and collection method are separate fields: survey affiliation and census affiliation share a construct and differ in method and uncertainty. A compiled map payload per domain × boundary set is generated from the canonical observations; the runtime reads `indicators` and `visual_layers` from the product, with the hardcoded religion metric table retained only as the legacy fallback.

**Time alignment is explicit, never silent.** Every layer stores its native period. Alignments to religion waves are generated records (anchor wave, layer period, offset, method, status, maximum allowed gap) with four states: exact, near, crosswalked, unavailable. The UI never relabels a 2021 income estimate as "2023 income"; the passport shows the offset ("Income · 2021 · two years before the 2023 wave") and the comparability status. Interpolated or modelled alignments require their own declared visual layer.

**Comparability flags become typed.** Product-level (construct, universe, method, boundary compatibility), period-level (source and question changes, crosswalks), and area-level (suppression, coverage, instability) flags carry severity, scope, and display text; the existing washes, hatches, and popup marks become renderers of those flags. Bivariate displays exist only as governed `visual_layer` definitions; selecting two layers must never create one implicitly.

## Sequence

1. Dataset passport + annotated legend (4–7 days) — build first, on the current single-domain products.
2. Metadata-driven overlay registry with the legacy shim (1–2 weeks) — before any new domain ships.
3. Temporal alignment and comparability contract (4–7 days) — with the first economic layer.
4. Layer-stack cards in the sidebar (2–3 weeks) — when two or more domains are live.

Storage, serving, prefetching, and the analytics path are planned separately in the research repository (data storage and analytics plan, 2026-07-16), because they bind the same metadata but answer a different question.

## Risks

Sidebar overload is the design risk: progressive disclosure must protect the zero-interaction answer. Metadata drift is the engineering risk: panel, dossier, downloads, and citations must all be generated from the same governed metadata. False temporal comparison and construct collapse are the scientific risks: the alignment states and the construct/method split exist precisely so the sidebar can state, rather than imply, what a comparison means.
