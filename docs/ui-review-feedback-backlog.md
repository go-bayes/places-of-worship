# UI review feedback backlog

Triaged from André De Vito's email "religionmap.org - bugs, inconsistency, improvements" (2026-08-07, Gmail message 19fda2266ea08f87). One row per reported item, in André's order. Status: `[ ]` open, `[~]` in progress, `[x]` done.

## Map page

- `[ ]` **Hover popup covers the marker.** The popup label sits over half of the place-of-worship circle. Offset the popup from the pinpoint. *(bug, small)*
- `[ ]` **Hover popup ignores overlapping markers.** When pinpoints overlap, the popup shows only one; show a list of what sits underneath. *(UX, medium)*
- `[ ]` **No leader line from popup to marker.** In tight groupings the reader cannot tell which pinpoint the popup describes; a connecting line would disambiguate. Consider together with the two popup items above — one popup redesign covers all three. *(UX, small)*
- `[ ]` **Server call on every slight pan.** The map refetches on any movement. Fetch a buffer larger than the viewport so small pans need no new request. Aligns with the existing map-performance lane; André independently proposed the same over-fetch fix. *(performance, medium)*
- `[ ]` **Country selection still loads other countries.** When a country is selected, skip loading the rest, or offer a toggle. Also a server-load reduction. *(performance, medium)*
- `[ ]` **Religion-key panel jumps on country selection.** The panel moves to the far left of the screen when a country is selected. *(bug, small)*
- `[ ]` **Search & filters panel is draggable.** Probably fix it at its current position. *(UX, small)*

## Review page

- `[ ]` **Highlight the Guide button for new reviewers.** If the next step involves more people (especially students) reviewing data, make the guide prominent. *(UX, small)*
- `[ ]` **Hide review boundary and queue when signed out.** Or prompt sign-in before showing or letting the visitor act on review data. *(UX/auth, small)*
- `[ ]` **Low-contrast census lists.** A couple of lists in "Show Census Data" render light grey text on a white background. Accessibility fix. *(bug, small)*
- `[ ]` **Drafts and skipped tasks are hard to find.** No intuitive route back to saved drafts or skipped items (André had 41 submitted + 1 draft + 1 skipped). Add shortcuts to both. *(UX, medium)*
- `[ ]` **"Refresh task list" gives no feedback.** The button appears to do nothing; confirm whether it works and add a visible "tasks refreshed" response either way. *(bug, small)*
- `[ ]` **Majority-vote review for student cohorts.** Give all students essentially the same task set, aggregate their responses, and discard outliers. A design question rather than a fix; consider alongside `docs/portal-ra-feedback-and-training.md`. *(feature, large)*
