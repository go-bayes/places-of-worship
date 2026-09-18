# Simple nominations and RA agent assistance

Status: interactive workbench prototype for review. Open the workbench with `?concept=agent`. The prototype saves drafts and request previews in the current browser tab through `sessionStorage`; it neither submits evidence nor starts an agent. The live verification portal, map, and review workflow remain unchanged.

## Public contribution

The public entry asks for a place name or description and a location. A contributor can name a town, landmark, address, or map link and explicitly mark the location approximate. A collapsed optional section accepts a note and a source link. The contributor can leave a useful lead before investigating its history.

The public action retains the existing wording, **Nominate missing PoW**. A connected service would acknowledge the nomination with a private receipt, explain that it awaits triage, and allow a contributor to correct or withdraw the lead. A source-backed first pass would then identify useful claims, unresolved questions, and the next investigation. Review remains a distinct stage before evidence can affect the map.

The reference [poo.co.nz](https://poo.co.nz/) was inspected on 2026-09-18. Its missing-place form requires name and location and makes further detail optional. The PoW prototype applies that small entry requirement and keeps optional detail collapsed. The proposed PoW intake additionally accepts approximate location text so that uncertain leads can enter triage.

## RA assistance

The RA workspace places **Ask an agent** beside the current evidence. An RA can type a question or select a suggestion about sources, dates, or duplicates. The `@research` tag is a shorthand for the research service; the button also works with an ordinary question. The selected place and evidence version automatically accompany the request.

The prototype uses an invented chapel and an explicit demonstration evidence version. An example source dates a building, leaving worship commencement unresolved. The research-record view retains the source quotation, qualification, attribution, and follow-up question beside the claim. The example agent response is an authored illustration.

An agent answer should propose additions to the RA's evidence. The live implementation must preserve the original note, display each proposed change, and require explicit confirmation before creating an ordinary evidence revision. A changed evidence version makes an earlier answer stale for application; the answer remains available as research history. The RA can continue other work while a request is pending.

## Interaction contract

| Moment | Contributor sees | Required connected behaviour |
| --- | --- | --- |
| Leave a lead | Place, location, optional note or source | Validate bounded input; preserve uncertainty and submit idempotently |
| Receipt | Saved nomination with a stable reference | Acknowledge only after persistence; retain the draft on failure |
| Ask for help | Current place, question, attached evidence version | Verify access to the task and bind the request to its current content hash |
| Research in progress | Queued, researching, or waiting for access | Derive status from controller events; avoid fabricated progress or promises |
| First pass returned | Claims, sources, qualifications, and next questions | Pin the returned record and preserve every earlier pass |
| Apply a suggestion | Proposed evidence changes | Recheck the evidence hash and require human confirmation |
| Review | Submitted evidence version and decision | Use the existing review, PI authority, and governed export contracts |

The prototype implements local draft restoration, missing-field feedback, HTTP(S) link-scheme validation, duplicate request previews, question history, and focus transfer to the local receipt. Request previews explicitly say that they have not been sent. Browser storage failures produce a warning and retain the current form in memory. The drawing beside the form is an illustration. Live mapping and geolocation remain implementation steps.

## Backend integration

The first backend increment should support signed-in RA assistance. Add an assistance-request table with requester, task identifier, evidence-version hash, question, request idempotency key, creation time, disposition, and controller receipt. Validate the requester's task access server-side. The configured assignment policy determines tool and data access for every request, including tagged questions.

The request transaction should atomically create an outbox event. A deterministic dispatcher claims the event under a lease, selects the approved model and source policy, and dispatches a bounded attempt. A completion transaction verifies the active lease and records an immutable first-pass reference. Model output can update research status and propose evidence; acceptance and release remain human operations.

Public intake requires a separate, restricted ingress before anonymous access is enabled. Limit request size and submission rate, issue unguessable private receipts, avoid revealing nearby private evidence, and quarantine attachments. Duplicate suggestions should use public records and allow the contributor to explain a distinct worship use at a shared place. The controller selects worker tools, budgets, deployment, and source scope from the approved policy.

Attachment support should follow the quarantined storage path. A phone camera or file picker can reduce effort, but upload, scanning, restricted metadata, licence handling, and isolated extraction must exist before that control promises submission. The prototype therefore concentrates on text and public links. Source fetching, mapping, and uploads remain implementation steps.

## Delivery sequence

1. Review the prototype's nomination, assistance, and research-record flows on desktop and phone. Confirm that the small form still elicits enough information for triage.
2. Implement authenticated RA assistance and the controller outbox on an isolated development deployment. Exercise stale evidence, duplicate retries, worker loss, blocked sources, and access revocation.
3. Connect verified private object storage and demonstrate recovery of research history. Expose returned source-linked records beside the RA's current evidence.
4. Add reviewed evidence preparation and public intake after abuse controls and source restrictions are tested. Update the live RA guide with the connected flow in the same change.

## Local review

```sh
cd apps/workbench
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
# Open http://127.0.0.1:5174/?concept=agent
npm run build
```

The existing workbench opens normally without the concept parameter. The prototype uses the existing React and TypeScript dependencies. The production build remains ignored under the existing workbench publication policy. Publishing or connecting the prototype is a separate reviewed change.
