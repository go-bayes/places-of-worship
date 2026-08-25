# Field Observation Packet Specification

Status: design baseline for the internal image-and-guided-dictation pilot. The denomination and guided-note fields are the first implementation slice; media capture, storage, and AI assistance remain separately gated work.

## Scientific Purpose

The project begins with places where people worship, have worshipped, or may worship in the future. It does not follow that these places arrive as ready-made scientific objects. The measurement system must state which features it represents—such as a mappable site, a worship-function state, an organisation or community, a denomination or tradition label, or a change through time—and preserve how fallible observations support claims about those objects.

A field-observation packet is evidence about one or more possible scientific claims. It is not itself a site state, denomination, historical event, correction, or accepted database record.

```text
capture artefact
  -> field-observation packet
  -> observer-confirmed account
  -> provisional claims
  -> human review
  -> governed pow export
  -> accepted event and reconstructed state
```

The separation matters because an image captured today can support a dated observation without establishing when the observed condition began, and an exact denomination label can be preserved as evidence without yet deciding how it maps into the project taxonomy.

## Pilot Record

Each packet should connect one observation to an assigned task and an existing or provisional site identifier. It should preserve the observer, the expected task location, capture references, sensitivity and access state, the observer-confirmed account, provisional claims, and amendment history.

The first pilot should use one context image by default and an optional task-specific detail image. It should exclude intentional photographs of people, children, active worship, private interiors, and culturally restricted material unless a later approved protocol provides a lawful and locally appropriate path.

## Time And Location

The original capture time and location should be retained internally because they materially improve verification. These measurements remain fallible and must not be collapsed into a single unqualified timestamp or location.

Time records should distinguish device or image capture time, timezone information, portal capture time, server receipt time, observer-confirmed time, provenance, and confidence. Location records should distinguish image metadata coordinates, a one-time browser or device observation with its accuracy radius, the task's expected site coordinates, calculated discrepancy, observer confirmation, provenance, confidence, and any access restriction.

Capture time is an observation time, not automatically the effective time of a historical event. Task coordinates are an expected location, not automatically the location from which an image was captured. The interface should display these distinctions to reviewers rather than forcing false precision. A present-day field observation with no assessed project target year remains in the evidence and review JSONL trail; it must not be emitted as a `site_evidence_wide` event-candidate row that `pow propose` cannot interpret.

## Storage And Access

Images are internal evidence by design. The pilot must have no public media bucket, anonymous media endpoint, public image derivative, public image URL, or media field in public exports. A future proposal to publish images would require a new governance decision rather than changing a routine visibility flag.

Convex may store an opaque observation or media identifier, workflow status, guided text, and review events. It must not store image bytes, thumbnails, original filenames, full metadata payloads, durable signed URLs, exact restricted coordinates, or audio. An approved project-controlled object store should hold immutable originals, restricted metadata manifests, and internal review derivatives behind role-checked, short-lived access.

The original should retain its checksum and acquisition metadata. An internal review derivative may correct orientation and reduce size, but it should omit unnecessary embedded device metadata and present relevant time and location through the controlled reviewer interface.

## Guided Observation

The entry interface should use focused prompts while retaining an escape route for unexpected evidence. The primary fields are direct observation, interpretation, and uncertainty or follow-up. Task-specific prompts may ask for an exact transcription or another bounded detail. The observer's confirmed wording remains primary after structured claims are proposed.

Direct observation asks what the contributor observed at the site or read in a named source. It does not create a route for recording private conversations. Interpretation asks what claim that observation might support. Uncertainty asks what the observation cannot establish or what another source should check. These fields must not be silently merged in storage, although a backward-compatible summary may be generated for an older export.

Device dictation should enter text into one prompted field at a time. The contributor must review and correct the transcript before submission, especially names, dates, and local-language labels. The first pilot should retain no audio and should not claim that dictation is processed only on the device unless the actual pilot devices and settings have been verified.

## Denomination And Tradition Evidence

The live portal should preserve starting source wording and any starting project taxonomy code separately from the contributor's evidence. A contributor may record the exact observed or reported label, who supplied it, and its provisional relation to the project record.

The raw label is evidence, not an accepted taxonomy value. The immediate slice records label basis separately from a provisional relation such as label only, possible correction, possible historical change, possible shared or concurrent use, or uncertainty. These selections must not alter `site_type`, set a target-year worship state, or change another accepted site-state field. A raw-label record with no separately assessed target year remains in the evidence and review JSONL trail rather than becoming a `site_evidence_wide` event-candidate row. The slice does not represent a complete correction, transition, or concurrent-use object: later contracts must preserve prior and later labels, repeated concurrent groups, and effective dates or bounds. Mapping into a versioned project taxonomy remains a review operation, and accepted denomination events remain gated by the governed `pow` validation, diff, replay, and export path.

## Review Model

One packet may support several provisional claims. Review should eventually operate at claim level so that a reviewer can accept a transcription, defer a taxonomy mapping, and reject an unsupported historical inference without accepting or rejecting the whole packet as a block.

The immediate portal slice remains draft-level because that is the current Convex contract. It nevertheless stores direct observation, interpretation, uncertainty, the exact denomination label, label basis, and provisional relation separately so that later claim extraction does not have to reconstruct those distinctions from one catch-all note. A contract version prevents legacy generic evidence notes from being relabelled as direct observations.

## AI Assistance

AI assistance is a medium-range measurement tool, not an acceptance authority. The intended interaction is a short adaptive interview: deterministic checks first, then a small number of model-generated suggestions or follow-up questions when a confirmed account is missing a scientifically important distinction.

An assistant may propose an exact transcription, a structured claim, a candidate taxonomy mapping with abstention, or a focused question. The contributor must accept, edit, or reject each proposal. The system should preserve the confirmed original text, model and prompt version, suggested value, human edit, confirmation state, and time of confirmation.

The assistant must not overwrite the observer's wording, infer denomination from a person's appearance, treat architecture alone as proof of current use, turn a correction into a historical change, collapse concurrent uses into one label, accept a claim, or write to the master database. The first image pilot should not send images, exact coordinates, contributor identity, private media references, or culturally or privacy-restricted text to an external model.

Procedural help and evidence clarification should remain distinct. General help may explain how to enter a bounded date. Evidence clarification may ask why a label was attributed to a community, but the confirmed answer becomes part of the observation packet and review trail.

## Pilot Evaluation

The pilot question is whether image plus guided dictation reduces the total work needed to produce a correctly classified, reviewable observation without weakening privacy, cultural governance, or measurement accuracy.

Evaluation should include contributor time per packet, reviewer time per claim and packet, clarification requests, transcript corrections, taxonomy suggestions accepted or changed, disagreements between observation and interpretation, sensitivity misses found in audit, location discrepancies, upload failures, return visits avoided, and accepted claims per hour of combined contributor and reviewer work. An independently reviewed audit sample is necessary because speed alone is not success.

## Delivery Sequence

1. Repair the live portal's denomination evidence and guided-note contract end to end through Convex and the reviewer view.
2. Add provider-neutral observation-packet, capture-time, capture-location, sensitivity, and media-reference contracts without activating uploads.
3. Implement the authenticated private media service and image-plus-device-dictation pilot with synthetic and deliberately staged test images.
4. Establish a non-AI baseline, then add bounded text-only assistance with field-level provenance, abstention, evaluation, and a kill switch.

The TypeScript workbench should become the eventual shared implementation surface for media and assisted entry. The current static portal receives the first narrow repair because it is the live New Zealand and Vanuatu workflow; the project should not create a third incompatible evidence model.
