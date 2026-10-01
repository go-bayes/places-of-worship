const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// the module attaches itself to window, as in the portal page
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "confidence-panel.js"), "utf8"), { window });
const panel = window.PowConfidencePanel;

// the committed synthetic fixture gives rows the exact shape the ingest
// accepts; stored rows flatten the subject and carry the read's embedded
// dispositions
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../../schemas/fixtures/agent-judgment-v1-1/expected-judgments.json"), "utf8"));
const inputs = fixture.batches.flat();
// local noon, so the rendered calendar day is 2026-10-01 in every zone
const BASE = new Date(2026, 9, 1, 12, 0, 0).getTime();
function stored(input, index, extra = {}) {
    const { subject, ...rest } = input;
    return {
        judgment_id: fixture.judgment_ids[index] || "f".repeat(64),
        subject_kind: subject.kind,
        subject_ref: subject.ref,
        ...rest,
        parents: [],
        actor_user_id: "users:service",
        ai_generated: true,
        created_at: BASE - index * 1000,
        dispositions: [],
        ...extra,
    };
}
const rows = inputs.map((input, index) => stored(input, index));
const forRef = (ref) => rows.filter((row) => row.subject_ref === ref);
const screened = forRef("osm:way/1001");
const review = forRef("osm:way/1002");
const escalate = forRef("osm:node/2001");
const pending = forRef("osm:way/1004");

test("nothing to show renders nothing; a load error renders the reason alone", () => {
    assert.equal(panel.panelHtml([]), "");
    assert.equal(panel.panelHtml(null), "");
    const html = panel.panelHtml([], { error: "Function not found" });
    assert.match(html, /Could not load recorded judgments: Function not found/);
    assert.doesNotMatch(html, /<h4>Judgments<\/h4>/);
});

test("the lead row is the newest registration_confidence row with a score", () => {
    const lead = panel.leadJudgment(screened);
    assert.equal(lead.judgment_kind, "registration_confidence");
    // a newer sibling of another kind does not take the lead
    const newerStatus = { ...screened[1], created_at: BASE + 5000 };
    assert.equal(panel.leadJudgment([...screened, newerStatus]).judgment_kind, "registration_confidence");
    // without a registration row the newest scored row leads
    assert.equal(panel.leadJudgment(screened.slice(1)).judgment_kind, "status_assessment");
    assert.equal(panel.leadJudgment([{ judgment_kind: "status_assessment", outcome: "unknown" }]), null);
});

test("tier pill: the tier word, amber for escalate alone, with its one-line hint", () => {
    assert.equal(panel.tierClass("escalate"), "amber");
    assert.equal(panel.tierClass("review"), "grey");
    assert.equal(panel.tierClass("screened"), "grey");
    const html = panel.panelHtml(escalate);
    assert.match(html, /<span class="pill amber">escalate<\/span>/);
    assert.match(html, /The scorer asks for a closer look/);
    const screenedHtml = panel.panelHtml(screened);
    assert.match(screenedHtml, /<span class="pill grey">screened<\/span>/);
    assert.match(screenedHtml, /No tier accepts; the decision stays yours/);
    assert.match(panel.panelHtml(review), /The composite, a component or an indicator fell short of the cut points\./);
    assert.doesNotMatch(screenedHtml, /pill green/);
});

test("AI-generated and deterministic-uncalibrated pills, and provenance with standard, edition date and vector hash", () => {
    const html = panel.panelHtml(screened);
    assert.match(html, /<span class="pill">AI-generated<\/span>/);
    assert.match(html, /<span class="pill">Deterministic, uncalibrated<\/span>/);
    assert.match(html, /osm-confidence-scorer p2-heuristic-0\.2\.0/);
    assert.match(html, /confidence-standard\/0\.3\.1/);
    assert.match(html, /edition 2026-09-01/);
    assert.match(html, /vectors b5937e6c0ac0/);
    assert.match(html, /code a1b2c3d4e5f6/);
    assert.match(html, /recorded 2026-10-01/);
    assert.equal(panel.editionDate("osm-pow:nz:edition:2026-09-01:0123abcd4567"), "2026-09-01");
    assert.equal(panel.editionDate("something-else"), "something-else");
});

test("composite and the four components beside the cut points; a component under its floor is marked", () => {
    const html = panel.panelHtml(screened);
    assert.match(html, /<div>Composite<\/div><div>0\.9126 <span class="muted score-note">screened ≥ 0\.9, review ≥ 0\.6<\/span><\/div>/);
    assert.match(html, /<div>Identity<\/div><div>0\.97 <span class="muted score-note">floor 0\.7<\/span><\/div>/);
    assert.match(html, /<div>Denomination<\/div><div>0\.93 <span class="muted score-note">floor 0\.7<\/span> <span class="muted score-note">outside the composite<\/span><\/div>/);
    assert.doesNotMatch(html, /below floor/);
    const low = panel.panelHtml(escalate);
    const denomination = JSON.parse(JSON.stringify(screened));
    for (const row of denomination) if (row.score) row.score.components.denomination = 0.5;
    assert.match(panel.panelHtml(denomination), /<div>Denomination<\/div><div>0\.5 <span class="pill amber">below floor<\/span> <span class="muted score-note">floor 0\.7<\/span> <span class="muted score-note">outside the composite<\/span><\/div>/);
    assert.match(low, /<div>Identity<\/div><div>[0-9.]+ <span class="pill amber">below floor<\/span> <span class="muted score-note">floor 0\.7<\/span><\/div>/);
});

test("tier reasons and pending conditions read as words", () => {
    assert.match(panel.panelHtml(screened), /Reasons: none\. Pending: none\./);
    assert.match(panel.panelHtml(review), /Reasons: composite 0\.6 to 0\.9, duplicate\. Pending: none\./);
    assert.match(panel.panelHtml(pending), /Reasons: composite 0\.6 to 0\.9, generic name cross source pending\. Pending: cross source match\./);
    assert.match(panel.panelHtml(escalate), /Reasons: composite below 0\.6, conflict, identity below 0\.7/);
    assert.match(panel.panelHtml(screened), /<div>tag completeness score<\/div><div>0\.857<\/div>/);
});

test("signals: fired terms per component, allowlisted values with nulls omitted, and indicator flags", () => {
    const html = panel.panelHtml(screened);
    assert.match(html, /<summary>Signals<\/summary>/);
    assert.match(html, /<div>identity<\/div><div>name specific, religion present, building worship specific<\/div>/);
    assert.match(html, /<div>tag count<\/div><div>9<\/div>/);
    assert.match(html, /<div>has name<\/div><div>yes<\/div>/);
    assert.match(html, /<div>footprint area m2<\/div><div>412\.5<\/div>/);
    // a way carries null node signals; they are counted, not listed
    assert.doesNotMatch(html, /<div>node in building<\/div>/);
    assert.match(html, /4 signals unknown or not applicable/);
    assert.match(html, /<div>Cross-source<\/div><div>match, 2 sources<\/div>/);
    assert.match(html, /<div>Duplicate<\/div><div>no<\/div>/);
    const conflict = panel.panelHtml(escalate);
    assert.match(conflict, /<div>Conflict<\/div><div><span class="pill amber">yes<\/span> <span class="muted">ruins with active amenity, end date passed with active amenity<\/span><\/div>/);
    assert.match(panel.panelHtml(review), /<div>Duplicate<\/div><div><span class="pill amber">yes<\/span><\/div>/);
});

test("one block per judgment row, each with four disposition controls and a note field", () => {
    const html = panel.panelHtml(review);
    const blocks = html.match(/class="judgment-block" data-judgment-id="[0-9a-f]{64}"/g) || [];
    assert.equal(blocks.length, review.length);
    for (const row of review) assert.match(html, new RegExp(`data-judgment-id="${row.judgment_id}"`));
    assert.equal((html.match(/data-disposition="agreed"/g) || []).length, review.length);
    assert.equal((html.match(/data-disposition="disagreed"/g) || []).length, review.length);
    assert.equal((html.match(/data-disposition="corrected"/g) || []).length, review.length);
    assert.equal((html.match(/data-disposition="not_considered"/g) || []).length, review.length);
    assert.equal((html.match(/class="judgment-note"/g) || []).length, review.length);
    assert.match(html, /<strong>Registration confidence: review<\/strong>/);
    assert.match(html, /<strong>Duplicate: unclear<\/strong>/);
    // each categorical assessment carries its provisional status
    assert.match(html, /<strong>Status: likely active<\/strong>/);
    assert.match(html, /confidence medium · provisional and uncalibrated \(until calibration replaces it\)/);
    assert.equal((html.match(/<span class="pill">provisional<\/span>/g) || []).length, review.length);
    assert.match(html, /<strong>Status: likely active<\/strong> <span class="pill">provisional<\/span>/);
    assert.match(html, /<p class="muted">Confidence on scorer rows is the scorer's support for each component \(worship continues; pin within 75 m\), not a calibrated probability; low support reads as unknown or unclear, never as a negative finding\.<\/p>/);
    // the long generated basis note folds away
    assert.match(html, /<summary>Basis note<\/summary>/);
});

test("dispositions read newest first, the viewer as you, others unnamed, notes escaped", () => {
    const row = stored(inputs[0], 0, {
        dispositions: [
            { disposition_id: "d1", judgment_id: fixture.judgment_ids[0], reviewer_user_id: "users:me", disposition: "agreed", created_at: BASE + 1000 },
            { disposition_id: "d2", judgment_id: fixture.judgment_ids[0], reviewer_user_id: "users:other", disposition: "disagreed", note: "The <b>tags</b> are stale.", created_at: BASE + 2000 },
        ],
    });
    const html = panel.panelHtml([row], { viewerId: "users:me" });
    const line = html.match(/<p class="muted judgment-dispositions">([\s\S]*?)<\/p>/)[1];
    assert.match(line, /^Disagreed · another reviewer · 2026-10-01 · “The &lt;b&gt;tags&lt;\/b&gt; are stale\.”<br>Agreed · you · 2026-10-01$/);
    assert.equal(panel.dispositionLabel("not_considered"), "Not considered");
    assert.equal(panel.needsNote("disagreed"), true);
    assert.equal(panel.needsNote("corrected"), true);
    assert.equal(panel.needsNote("agreed"), false);
    assert.equal(panel.needsNote("not_considered"), false);
});

test("a model judgment about the place renders its provider, model and confidence beside the scorer rows", () => {
    const model = {
        judgment_id: "ab".repeat(32),
        schema_version: "agent-judgment.v1",
        subject_kind: "place",
        subject_ref: "osm:way/1001",
        judgment_kind: "status_assessment",
        outcome: "likely_active",
        confidence: "medium",
        access_method: "model_assessment",
        basis_note: "Dossier: services listed for 2026 & a <b>recent</b> photo.",
        judge: { agent_name: "first-pass-researcher", model_provider: "anthropic", model_requested: "claude-x", model_reported: "claude-x-2026", prompt_version: "first-pass-v1" },
        run: { attempt: 1, cost_basis: "unknown" },
        context: { place_ref: "osm:way/1001", country_code: "NZ" },
        ai_generated: true,
        created_at: BASE + 10_000,
        dispositions: [],
    };
    const html = panel.panelHtml([...screened, model]);
    assert.match(html, /<strong>Status: likely active<\/strong> <span class="muted">· first-pass-researcher · anthropic · claude-x-2026 · confidence medium · 2026-10-01<\/span>/);
    assert.match(html, /services listed for 2026 &amp; a &lt;b&gt;recent&lt;\/b&gt; photo/);
    // the model row is newest but the scorer's registration row still leads
    assert.match(html, /<span class="pill grey">screened<\/span>/);
    // model rows alone: no tier pill, no deterministic pill, still AI-generated
    const alone = panel.panelHtml([model]);
    assert.doesNotMatch(alone, /pill grey|pill amber/);
    assert.doesNotMatch(alone, /Deterministic/);
    assert.doesNotMatch(alone, /provisional|Confidence on scorer rows/);
    assert.match(alone, /<span class="pill">AI-generated<\/span>/);
    assert.doesNotMatch(alone, /Outcome left open/);
});

test("a model judgment with an unreported returned model says so", () => {
    const unknown = {
        judgment_id: "cd".repeat(32), schema_version: "agent-judgment.v1.1", subject_kind: "place", subject_ref: "osm:way/1001",
        judgment_kind: "status_assessment", outcome: "likely_active", confidence: "low", access_method: "model_assessment",
        judge: { agent_name: "first-pass-researcher", model_provider: "anthropic", model_requested: "claude-x", model_unreported_reason: "provider omitted it", prompt_version: "first-pass-v1" },
        run: { attempt: 1, cost_basis: "unknown" }, context: { place_ref: "osm:way/1001", country_code: "NZ" },
        ai_generated: true, created_at: BASE + 10_000, dispositions: [],
    };
    const html = panel.panelHtml([unknown]);
    assert.match(html, /claude-x requested, returned model not reported \(provider omitted it\)/);
});

test("one block renders alone with the same markup the panel uses, so a disposed row can be replaced in place", () => {
    const row = stored(inputs[0], 0, {
        dispositions: [{ disposition_id: "d1", judgment_id: fixture.judgment_ids[0], reviewer_user_id: "users:me", disposition: "corrected", note: "Footprint is the hall next door.", created_at: BASE + 1000 }],
    });
    const block = panel.judgmentBlockHtml(row, panel.leadJudgment([row, ...screened.slice(1)]), "users:me").trim();
    assert.match(block, /^<div class="judgment-block" data-judgment-id="[0-9a-f]{64}">/);
    assert.match(block, /Corrected · you · 2026-10-01 · “Footprint is the hall next door\.”/);
    assert.match(block, /<\/div>\s*$/);
    const whole = panel.panelHtml([row, ...screened.slice(1)], { viewerId: "users:me" });
    assert.ok(whole.includes(block), "the panel embeds exactly the block the block renderer returns");
});

test("a row scored under another edition says so in its block", () => {
    const earlier = {
        ...screened[1],
        judgment_id: "cd".repeat(32),
        created_at: BASE - 100_000,
        score: { ...screened[1].score, edition_id: "osm-pow:nz:edition:2026-03-01:0000aaaa1111", composite: 0.71, tier: "review" },
    };
    assert.equal(panel.sameScore(earlier, screened[0]), false);
    assert.equal(panel.sameScore(screened[1], screened[0]), true);
    const html = panel.panelHtml([...screened, earlier]);
    assert.match(html, /Scored under edition 2026-03-01: composite 0\.71, tier review\./);
    assert.equal((html.match(/Scored under edition/g) || []).length, 1);
});
