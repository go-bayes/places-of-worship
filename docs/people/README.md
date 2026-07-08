# Who reads what — audiences and the public/private rule

This repository is public. Research assistants, collaborators, funders,
and strangers can read every tracked file. Only JB commits. These two
facts set the policy:

## The rule

- **Public (tracked in git)**: everything written FOR a named audience —
  RA instructions, reviewer instructions, collaborator instructions,
  governance, engineering docs, data manifests. Write each document so
  its audience can act on it without asking; explicit beats implied,
  because JB works from multiple machines and cannot be the memory.
- **Private (never in git)**: personal contact details (email addresses,
  phone numbers), credentials and API keys, RA assignment tracking that
  names individuals' progress, unredacted operations notes, and
  anything a collaborator sent that they did not agree to publish.
  Private material lives in `.private/` (git-ignored), synced across
  JB's machines via the existing private-sync mechanism
  (`.private-sync.env` → `gs://places-of-worship-private-sync/private/`).
  Named credit in manifests and the changelog is public by design and
  is granted per JB's attribution rule — credit yes, contact details no.

## Audience directories

- `docs/people/ra/` — research assistants (public; RAs work from these
  pages directly).
- `docs/people/jw/` — JW, co-investigator and reviewer.
- `docs/people/guy/` — Guy Lavender Forsyth, Vanuatu census
  collaborator.
- Engineering and agents: `docs/development/`, `docs/playbooks/`,
  `AGENTS.md` (unchanged homes).
- `docs/people/research-tier-onboarding.md` — how team members join the
  private research tier (repo + data bucket); membership is JB's grant.

Each directory's README is the entry point; deeper documents live
alongside. When instructions change, change the document — do not rely
on email threads; the repo is the durable copy (email is where
documents get lost).
