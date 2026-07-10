# RA portal scaling roadmap

> Planning record. Two workstreams ratified by the PI (2026-07-11) for the portal as the project scales beyond the current country set. Neither is scheduled; both are design-first lanes that need a PI-ratified design doc before implementation.

## 1. Clerk authentication

**What.** Replace the current portal auth (Convex Google OAuth invites; see [convex-auth-google.config.example.ts](convex-auth-google.config.example.ts)) with [Clerk](https://clerk.com) as the identity layer in front of Convex.

**Why.** The invite flow today assumes a small RA roster whose accounts the PI seeds by hand (rows in the dev-deployment `users` table that activate on first Google sign-in). A global RA cohort needs self-service sign-up with review, multi-provider sign-in (not every RA has a Google account), organisation/role management, and session management that the project does not want to hand-build. Clerk has a first-class Convex integration path.

**Open design questions (PI holds the rulings).**
- Migration of the existing `users` table and role assignments (all RAs and all PIs currently hold identical privileges across all countries — a deliberate ruling; Clerk roles must reproduce it, and any move to per-country scoping is a separate PI decision, currently ruled out).
- Dev-vs-prod sequencing: dev (`pastel-goshawk-398`) is the live deployment and prod (`valiant-octopus-914`) is empty pending the cutover ruling; introducing Clerk before or after the cutover changes the migration cost materially.
- Invite-only versus application-with-approval for new RAs.
- Whether the seed-service impersonation path (`pow-cli-seed-service`) survives the change or is retired.

## 2. General translate (GT) for the RA portal

**What.** An internationalisation layer for the RA portal so RAs can work in their own languages: portal UI strings, task and guide content, and validation vocabulary served in the RA's language, with English as the reference locale.

**Why.** The project now spans countries whose source records and prospective RAs work in many languages (German, French, Persian, Malay, Norwegian, Icelandic already in the stack). Recruiting RAs locally as coverage scales requires the portal to stop assuming English.

**Open design questions (PI holds the rulings).**
- Scope boundary: UI chrome and guides translate; source data labels do NOT — the render-the-record rule keeps source category names verbatim with English display labels as a separate, documented mapping. GT must never silently translate a source category.
- Translation production: machine translation with RA review, professional translation for high-traffic strings, or a hybrid; and where the reviewed strings live (repo-versioned locale files are the presumption).
- The six-state validation-status vocabulary and review-gate terms are normative project vocabulary; translations need a ratified glossary so statuses mean the same thing in every language.
- Locale routing (per-user preference in the portal profile is the presumption; per-country defaults possible).

## Sequencing note

Clerk precedes GT if both proceed: identity and roles are the substrate the portal serves localised content on. Neither lane starts before its design doc is ratified.
