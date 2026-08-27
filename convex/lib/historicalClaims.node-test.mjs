import assert from "node:assert/strict";
import test from "node:test";
import { assertHistoricalClaim } from "./historicalClaims.ts";

const validClaim = {
  claim_kind: "structure",
  claim_timing: "event",
  claim_text: "The structure was built",
  earliest_supported_date: "1880",
  latest_supported_date: "1890",
  continues_through_observation: false,
  confidence: "high",
  confidence_basis: "A dated foundation plaque supplies the interval.",
  source_basis: "inscription_or_document_observed",
  source_title: "Foundation plaque at the west entrance",
  source_account: "The plaque dates construction between 1880 and 1890.",
  privacy_flag: "needs_review",
};

test("bounded structure events preserve year-only intervals", () => {
  assert.doesNotThrow(() => assertHistoricalClaim(validClaim, "2026-08-28"));
});

test("structure history does not imply worship or affiliation history", () => {
  assert.equal(validClaim.claim_kind, "structure");
  assert.equal(validClaim.claim_text, "The structure was built");
  assert.equal("denomination_or_affiliation" in validClaim, false);
});

test("open states omit an invented end date", () => {
  assert.doesNotThrow(() => assertHistoricalClaim({
    ...validClaim,
    claim_kind: "leadership",
    claim_timing: "state",
    claim_text: "Anglican leadership",
    earliest_supported_date: "1890",
    latest_supported_date: undefined,
    continues_through_observation: true,
    source_account: "Local records describe Anglican leadership through the observation date.",
  }, "2026-08-28"));
  assert.throws(() => assertHistoricalClaim({
    ...validClaim,
    claim_timing: "event",
    continues_through_observation: true,
  }, "2026-08-28"), /Only a historical state/);
});

test("vague war-period wording stays unresolved when no dates are supported", () => {
  assert.doesNotThrow(() => assertHistoricalClaim({
    ...validClaim,
    claim_kind: "shared_use",
    claim_timing: "state",
    claim_text: "Methodist services shared the site during a war period",
    earliest_supported_date: undefined,
    latest_supported_date: undefined,
    source_account: "The source says Methodist services were held during the war.",
    uncertainty_note: "The source does not identify the war or support calendar-year bounds.",
  }, "2026-08-28"));
  assert.throws(() => assertHistoricalClaim({
    ...validClaim,
    earliest_supported_date: undefined,
    latest_supported_date: undefined,
    uncertainty_note: undefined,
  }, "2026-08-28"), /date bounds or explain/);
});

test("date bounds cannot reverse or extend beyond the observation", () => {
  assert.throws(() => assertHistoricalClaim({
    ...validClaim,
    earliest_supported_date: "1900",
    latest_supported_date: "1890",
  }, "2026-08-28"), /earliest supported date cannot be after/);
  assert.throws(() => assertHistoricalClaim({
    ...validClaim,
    earliest_supported_date: "2027",
    latest_supported_date: undefined,
  }, "2026-08-28"), /after the current observation date/);
});

test("named public sources require a concrete reference", () => {
  assert.throws(() => assertHistoricalClaim({
    ...validClaim,
    source_basis: "named_public_source",
  }, "2026-08-28"), /requires a URL, archive reference/);
});

test("source wording and confidence basis are required", () => {
  assert.throws(() => assertHistoricalClaim({
    ...validClaim,
    source_account: "",
  }, "2026-08-28"), /Retain the source wording/);
  assert.throws(() => assertHistoricalClaim({
    ...validClaim,
    confidence_basis: "",
  }, "2026-08-28"), /explain the confidence/);
});
