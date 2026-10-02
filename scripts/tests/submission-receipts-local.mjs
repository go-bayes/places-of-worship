import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { wideEvidenceFields } from "../../convex/lib/wideEvidenceFields.ts";

// refuse hosted targets even if shell or .env.local names one
const config = JSON.parse(fs.readFileSync(".convex/local/default/config.json", "utf8"));
assert.equal(config.ports.cloud, 3260);
assert.equal(config.ports.site, 3261);
assert.match(config.deploymentName, /^anonymous-/);
const root = new ConvexHttpClient("http://127.0.0.1:3260", { logger: false });
root.setAdminAuth(config.adminKey);
const clients = [];
async function scene(country = "VU") {
  const subject = `receipt-test-${randomUUID()}`,
    issuer = "https://receipt-test.invalid";
  const seeded = await root.mutation("receiptLocalTest:seed", {
    subject: `${issuer}|${subject}`,
    taskId: `synthetic-${randomUUID()}`,
    country,
  });
  const client = new ConvexHttpClient("http://127.0.0.1:3260", { logger: false });
  client.setAdminAuth(config.adminKey, { subject, issuer });
  clients.push(client);
  return { client, identity: { subject, issuer }, ...seeded };
}
const observation = {
  current_status: "currently_used_for_worship",
  observation_basis: "local_investigator_account",
  observed_on: "2026-09-20",
  direct_observation: "Synthetic local worship observation.",
  privacy_flag: "clear",
};
const candidate = {
  name: "Synthetic local candidate",
  address: "Synthetic address",
  locality: "Synthetic locality",
  latitude: -17.74,
  longitude: 168.31,
};
const rapid = (id = randomUUID()) => ({
  clientSubmissionId: id,
  candidate,
  observation,
  clientContext: { placement_zoom: 18, proximity_checked: true, nearby_count: 0 },
});
const inspect = (w) => root.query("receiptLocalTest:inspect", { memberId: w.memberId });
const call = (w, name, args) =>
  w.client.mutation(`submissionReceipts:${name}`, args, { skipQueue: true });
let checks = 0;
function passed(name) {
  console.log(`PASS ${name}`);
  checks++;
}

// the backend serialises indexed receipt insertion under OCC
{
  const w = await scene(),
    args = rapid();
  const before = await inspect(w);
  const results = await Promise.all(
    Array.from({ length: 8 }, () => call(w, "submitCurrentObservationV1", args)),
  );
  assert.equal(results.filter((result) => !result.deduped).length, 1);
  for (const result of results)
    assert.deepEqual(result, {
      ...results.find((value) => !value.deduped),
      deduped: result.deduped,
    });
  const after = await inspect(w);
  assert.equal(
    after.counts.client_submission_receipts - before.counts.client_submission_receipts,
    1,
  );
  assert.equal(after.counts.tasks - before.counts.tasks, 1);
  assert.equal(after.counts.evidence_drafts - before.counts.evidence_drafts, 1);
  passed("identical concurrent requests produce one task, observation, version and receipt");
}
{
  const w = await scene(),
    args = rapid();
  const before = await inspect(w);
  const results = await Promise.all(
    [
      args,
      {
        ...args,
        observation: { ...observation, direct_observation: "Differing concurrent content." },
      },
    ].map((arg) => call(w, "submitCurrentObservationV1", arg)),
  );
  assert.deepEqual(results.map((result) => result.outcome).sort(), [
    "committed",
    "content_conflict",
  ]);
  const after = await inspect(w);
  assert.equal(
    after.counts.client_submission_receipts - before.counts.client_submission_receipts,
    1,
  );
  assert.equal(after.counts.evidence_drafts - before.counts.evidence_drafts, 1);
  passed("differing concurrent requests return one commit and one charged conflict");
}
{
  const w = await scene(),
    args = rapid();
  const before = await inspect(w);
  await assert.rejects(
    call(w, "submitCurrentObservationV1", {
      ...args,
      source: {
        kind: "register",
        countryCode: "VU",
        sourceType: "denominational_directory",
        title: `Synthetic rollback ${randomUUID()}`,
        url: "https://example.org/source",
      },
      observation: { ...observation, direct_observation: "x" },
    }),
    /short direct observation/,
  );
  const after = await inspect(w);
  assert.deepEqual(after.counts, before.counts);
  // time replenishment is independent; refusal creates no allowance record
  assert.equal(after.allowance.value, before.allowance.value);
  assert.equal(
    await w.client.query("submissionReceipts:getClientSubmissionReceipt", {
      clientSubmissionId: args.clientSubmissionId,
    }),
    null,
  );
  passed("thrown validation rolls back source/task writes, receipt and real component charge");
}
{
  const w = await scene(),
    args = rapid();
  const first = await call(w, "submitCurrentObservationV1", args);
  const before = await inspect(w);
  const refused = await call(w, "submitCurrentObservationV1", {
    clientSubmissionId: randomUUID(),
    taskId: first.task_id,
    observation,
    candidateComparison: { ...candidate, name: "Changed candidate" },
  });
  assert.equal(refused.outcome, "correction_required");
  const after = await inspect(w);
  assert.deepEqual(after.counts, before.counts);
  assert.ok(after.allowance.value < before.allowance.value);
  await root.mutation("receiptLocalTest:alter", { taskId: first.task_id, status: "reviewed" });
  assert.deepEqual(await call(w, "submitCurrentObservationV1", args), { ...first, deduped: true });
  const other = await scene();
  assert.equal(
    await other.client.query("submissionReceipts:getClientSubmissionReceipt", {
      clientSubmissionId: args.clientSubmissionId,
    }),
    null,
  );
  await root.mutation("receiptLocalTest:alter", { memberId: w.memberId, status: "disabled" });
  await assert.rejects(call(w, "submitCurrentObservationV1", args), /not active/);
  passed(
    "correction refusal charges only attempts; replay bypasses status; member lookup and revocation hold",
  );
}
{
  const w = await scene(),
    args = rapid();
  await call(w, "submitCurrentObservationV1", args);
  const before = await inspect(w);
  let conflicts = 0,
    exhausted = false;
  // sequential network calls are deliberately fast enough to exhaust burst 20
  for (let i = 0; i < 40; i++) {
    try {
      const result = await call(w, "submitCurrentObservationV1", {
        ...args,
        observation: { ...observation, direct_observation: `Changed conflict ${i}` },
      });
      assert.equal(result.outcome, "content_conflict");
      conflicts++;
    } catch (error) {
      assert.match(String(error), /RateLimited|rate limit|retryAfter/i);
      exhausted = true;
      break;
    }
  }
  assert.ok(exhausted);
  assert.ok(conflicts >= 19 && conflicts < 30);
  const after = await inspect(w);
  assert.deepEqual(after.counts, before.counts);
  passed(
    `real token bucket exhausts after ${conflicts} returned conflicts, with no creation writes`,
  );
}

const draft = {
  observation_contract_version: "guided_observation_v1",
  source_type: "denominational_directory",
  source_title: "Synthetic local directory",
  source_url_or_file: "https://example.org/directory",
  source_date_or_capture_date: "2016-07",
  action: "confirm_current_record",
  evidence_note: "Synthetic local directory confirms worship use.",
  privacy_flag: "clear",
  licence_flag: "needs_review",
};
const segment = {
  contract_version: "occupancy_v1",
  segment_index: 0,
  start_mode: "known",
  start_date: "2000",
  start_basis: "founding_stated",
  end_mode: "still_active",
  end_basis: "unknown",
  still_active_asof: "2016-07",
  location_relation: "same_as_task_point",
  confidence: "high",
  confidence_basis: "Synthetic dated source was read.",
  source_basis: "named_public_source",
  source_title: "Synthetic periods",
  source_reference: "https://example.org/periods",
  source_account: "Synthetic account for this period.",
  privacy_flag: "clear",
};
// round-1 repairs are exercised against real transactions and limiter state
for (const intent of ["correction", "new_observation"]) {
  const w = await scene();
  const first = await call(w, "submitEvidenceDraftWithOccupanciesV1", {
    clientSubmissionId: randomUUID(), taskId: w.taskId, draft, segments: [segment],
  });
  const editableId = `${w.taskId}:ordinary-autosave`;
  await w.client.mutation("evidence:saveEvidenceDraft", {
    taskId: w.taskId, evidenceDraftId: editableId, draft,
  });
  const args = {
    clientSubmissionId: randomUUID(), revision: { taskId: w.taskId, intent },
    draft: { ...draft, evidence_note: "Synthetic complete intended revision." }, segments: [segment],
  };
  const revised = await call(w, "submitEvidenceDraftWithOccupanciesV1", args);
  assert.equal(revised.evidence_draft_id, editableId);
  const receipt = await w.client.query("submissionReceipts:getClientSubmissionReceipt", {
    clientSubmissionId: args.clientSubmissionId,
  });
  assert.equal(receipt.resolved_bindings.source_draft_id, first.evidence_draft_id);
  assert.equal(receipt.resolved_bindings.source_version_hash, first.evidence_version_hash);
  assert.equal(receipt.resolved_bindings.revision_intent, intent);
  assert.equal(receipt.resolved_bindings.revision_reused, true);
  assert.deepEqual(await call(w, "submitEvidenceDraftWithOccupanciesV1", args), { ...revised, deduped: true });
  passed(`ordinary editable draft receives transactional ${intent} lineage`);
}
{
  const w = await scene();
  const chain = {
    contract_version: "function_chain_v1", start: {
      label: "Synthetic tradition", label_basis: "named_documentary_source",
      date: { mode: "known", date: "2000" },
    }, changes: [],
  };
  for (const [field, value] of [["latitude", 0], ["denomination", "Contradictory tradition"]]) {
    const before = await inspect(w);
    await assert.rejects(call(w, "submitEvidenceDraftWithOccupanciesV1", {
      clientSubmissionId: randomUUID(), taskId: w.taskId,
      draft: { ...draft, generated_wide_row: {
        fields: wideEvidenceFields([2013, 2018, 2023]), row: { [`target_year_2013_${field}`]: value },
      } }, segments: [segment], chain,
    }), /Wide-row/);
    const after = await inspect(w);
    assert.deepEqual(after.counts, before.counts);
    assert.deepEqual(after.allowance, before.allowance);
  }
  passed("historical location and denomination contradictions roll back all writes and real charges");
}
{
  const w = await scene();
  const locationAssertion = {
    contract_version: "location_assertion_v1", mode: "approximate_area", basis: "named_source_description",
    latitude: candidate.latitude, longitude: candidate.longitude, uncertainty_radius_m: 100,
    source_wording: "  Near the village centre  ", confidence: "moderate", contributor_confirmed: true,
  };
  const legacyCandidate = { ...candidate, locationAssertion };
  const first = await w.client.mutation("rapidEntry:submitCurrentObservation", {
    ...rapid(), candidate: legacyCandidate,
  });
  const corrected = await call(w, "submitCurrentObservationV1", {
    clientSubmissionId: randomUUID(), taskId: first.task_id,
    candidateComparison: legacyCandidate, observation,
  });
  assert.equal(corrected.outcome, "committed");
  assert.equal(corrected.corrected, true);
  passed("legacy whitespace-equivalent location assertion permits an observation correction");
}
{
  const w = await scene();
  const first = await call(w, "submitCurrentObservationV1", rapid());
  for (const changed of [
    { observed_on: "2026-02-30" }, { direct_observation: "x".repeat(23_000) },
    { observed_on: "2026-02-30", direct_observation: "x".repeat(23_000) },
  ]) {
    const before = await inspect(w);
    await assert.rejects(call(w, "submitCurrentObservationV1", {
      clientSubmissionId: randomUUID(), taskId: first.task_id,
      candidateComparison: { ...candidate, name: "Changed candidate" }, observation: { ...observation, ...changed },
    }), /observation date|direct observation/);
    const after = await inspect(w);
    assert.deepEqual(after.counts, before.counts);
    assert.deepEqual(after.allowance, before.allowance);
  }
  passed("malformed candidate corrections throw without charging the real attempt bucket");
}

const claim = {
  claim_kind: "worship_function",
  claim_timing: "state",
  claim_text: "Synthetic historical worship use.",
  earliest_supported_date: "2000",
  latest_supported_date: "2015",
  continues_through_observation: false,
  confidence: "high",
  confidence_basis: "Synthetic history source was read.",
  source_basis: "named_public_source",
  source_title: "Synthetic history",
  source_reference: "https://example.org/history",
  source_account: "Synthetic history account.",
  privacy_flag: "clear",
};
{
  const w = await scene(),
    args = rapid();
  const original = await call(w, "submitCurrentObservationV1", args);
  const correction = {
    clientSubmissionId: randomUUID(),
    taskId: original.task_id,
    candidateComparison: candidate,
    observation: { ...observation, direct_observation: "Synthetic corrected local observation." },
  };
  const before = await inspect(w);
  const results = await Promise.all(
    Array.from({ length: 4 }, () => call(w, "submitCurrentObservationV1", correction)),
  );
  assert.equal(results.filter((result) => !result.deduped).length, 1);
  assert.ok(results.every((result) => result.corrected));
  const after = await inspect(w);
  assert.equal(after.counts.evidence_drafts - before.counts.evidence_drafts, 1);
  assert.equal(
    after.counts.client_submission_receipts - before.counts.client_submission_receipts,
    1,
  );
  passed("concurrent corrections sharing an id commit one supersession and receipt");
}
for (const guided of [false, true]) {
  const w = await scene(),
    id = randomUUID();
  const fn = guided ? "submitEvidenceDraftWithOccupanciesV1" : "submitEvidenceDraftV1";
  const args = {
    clientSubmissionId: id,
    taskId: w.taskId,
    draft,
    ...(guided ? { segments: [segment] } : {}),
  };
  const before = await inspect(w);
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => call(w, fn, args)));
  assert.equal(concurrent.filter((result) => !result.deduped).length, 1);
  const first = concurrent.find((result) => !result.deduped);
  assert.equal(first.outcome, "committed");
  assert.deepEqual(await call(w, fn, args), { ...first, deduped: true });
  const after = await inspect(w);
  assert.equal(
    after.counts.client_submission_receipts - before.counts.client_submission_receipts,
    1,
  );
  if (guided) {
    const revision = {
      clientSubmissionId: randomUUID(),
      draft: { ...draft, evidence_note: "Synthetic changed guided content." },
      revision: { taskId: w.taskId, intent: "correction" },
      segments: [segment],
    };
    const revised = await call(w, fn, revision);
    assert.deepEqual(await call(w, fn, revision), { ...revised, deduped: true });
    assert.equal(
      (
        await call(w, fn, {
          ...revision,
          revision: { taskId: w.taskId, intent: "new_observation" },
        })
      ).outcome,
      "content_conflict",
    );
    const receipt = await w.client.query("submissionReceipts:getClientSubmissionReceipt", {
      clientSubmissionId: revision.clientSubmissionId,
    });
    assert.equal(receipt.resolved_bindings.source_draft_id, first.evidence_draft_id);
    assert.equal(receipt.resolved_bindings.source_version_hash, first.evidence_version_hash);
    await w.client.mutation("evidence:reviseEvidenceDraft", {
      taskId: w.taskId,
      intent: "correction",
    });
    await assert.rejects(
      call(w, fn, {
        ...revision,
        clientSubmissionId: randomUUID(),
        revision: { taskId: w.taskId, intent: "new_observation" },
      }),
      /open revision/,
    );
    const reused = {
      ...revision,
      clientSubmissionId: randomUUID(),
      revision: { taskId: w.taskId },
    };
    await call(w, fn, reused);
    const reuseReceipt = await w.client.query("submissionReceipts:getClientSubmissionReceipt", {
      clientSubmissionId: reused.clientSubmissionId,
    });
    assert.equal(reuseReceipt.resolved_bindings.revision_reused, true);
  } else {
    const periods = {
      clientSubmissionId: randomUUID(),
      taskId: w.taskId,
      parentEvidenceDraftId: first.evidence_draft_id,
      segments: [segment],
    };
    const results = await Promise.all(
      Array.from({ length: 4 }, () => call(w, "submitOccupanciesV1", periods)),
    );
    assert.equal(results.filter((result) => !result.deduped).length, 1);
    assert.deepEqual(await call(w, "submitOccupanciesV1", periods), {
      ...results.find((result) => !result.deduped),
      deduped: true,
    });
    const history = {
      clientSubmissionId: randomUUID(),
      taskId: w.taskId,
      parentEvidenceDraftId: first.evidence_draft_id,
      claim,
    };
    const histories = await Promise.all(
      Array.from({ length: 3 }, () => call(w, "submitHistoricalClaimV1", history)),
    );
    assert.equal(histories.filter((result) => !result.deduped).length, 1);
    const historical = histories.find((result) => !result.deduped);
    assert.deepEqual(await call(w, "submitHistoricalClaimV1", history), {
      ...historical,
      deduped: true,
    });
    assert.equal(
      (
        await call(w, "submitHistoricalClaimV1", {
          ...history,
          claim: { ...claim, claim_text: "Changed historical claim." },
        })
      ).outcome,
      "content_conflict",
    );
  }
  passed(
    guided
      ? "guided and revision commit/replay/intent/reuse use real transactions"
      : "general, concurrent occupancies and historical commit/replay use real transactions",
  );
}
{
  const w = await scene(),
    args = rapid();
  await w.client.mutation("rapidEntry:submitCurrentObservation", args);
  const legacy = await call(w, "submitCurrentObservationV1", args);
  assert.equal(legacy.legacy_unverified, true);
  assert.equal(legacy.deduped, true);
  assert.equal(
    await w.client.query("submissionReceipts:getClientSubmissionReceipt", {
      clientSubmissionId: args.clientSubmissionId,
    }),
    null,
  );
  passed("legacy rows return deduped results and legacy_unverified without fabricated equality");
}

{
  const w = await scene(),
    args = rapid();
  let dropped = false;
  const lossy = new ConvexHttpClient("http://127.0.0.1:3260", {
    logger: false,
    fetch: async (...values) => {
      const response = await fetch(...values);
      if (!dropped && response.ok) {
        dropped = true;
        await response.text();
        throw new Error("Synthetic response lost after commit.");
      }
      return response;
    },
  });
  lossy.setAdminAuth(config.adminKey, w.identity);
  await assert.rejects(
    lossy.mutation("submissionReceipts:submitCurrentObservationV1", args),
    /response lost/,
  );
  const receipt = await w.client.query("submissionReceipts:getClientSubmissionReceipt", {
    clientSubmissionId: args.clientSubmissionId,
  });
  assert.ok(receipt);
  const before = await inspect(w);
  assert.deepEqual(await call(w, "submitCurrentObservationV1", args), {
    outcome: "committed",
    ...receipt.result,
    deduped: true,
  });
  assert.deepEqual((await inspect(w)).counts, before.counts);
  passed("a lost HTTP response after commit recovers the receipt and cannot duplicate evidence");
}

{
  const w = await scene();
  const args = {
    ...rapid(),
    source: {
      kind: "register",
      countryCode: "VU",
      sourceType: "denominational_directory",
      title: `Synthetic atomic source ${randomUUID()}`,
      url: "https://example.org/atomic",
    },
    observation: { ...observation, observation_basis: "named_public_source" },
    segments: [{ ...segment, still_active_asof: observation.observed_on }],
  };
  const before = await inspect(w),
    first = await call(w, "submitCurrentObservationV1", args);
  assert.equal(first.period_result.occupancy_ids.length, 1);
  const receipt = await w.client.query("submissionReceipts:getClientSubmissionReceipt", {
    clientSubmissionId: args.clientSubmissionId,
  });
  assert.equal(receipt.resolved_bindings.source.title, args.source.title);
  assert.equal((await inspect(w)).counts.sources - before.counts.sources, 1);
  await root.mutation("receiptLocalTest:alter", {
    sourceId: receipt.resolved_bindings.source.source_id,
    status: "active",
  });
  const committed = await inspect(w);
  assert.deepEqual(await call(w, "submitCurrentObservationV1", args), { ...first, deduped: true });
  assert.deepEqual((await inspect(w)).counts, committed.counts);
  passed(
    "source registration, candidate, observation and periods commit together; replay retains original source snapshot",
  );
}
console.log(
  `Local integration checks: ${checks} passed; backend=${config.backendVersion}; ports=3260/3261`,
);
