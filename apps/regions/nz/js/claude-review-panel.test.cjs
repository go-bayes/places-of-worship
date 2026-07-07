// logic tests for claude-review-panel.js: loads the real browser module
// in node and asserts the mapping + agreement semantics and safe rendering
const fs = require("fs");
const path = require("path").join(__dirname, "claude-review-panel.js");
global.window = {};
eval(fs.readFileSync(path, "utf8"));
const panel = global.window.PowClaudeReviewPanel;

let failures = 0;
function check(name, condition) {
  if (!condition) {
    failures += 1;
    console.log(`FAIL: ${name}`);
  } else {
    console.log(`ok: ${name}`);
  }
}

// recommendation -> decision mapping
check("accept maps to accepted_for_export", panel.decisionForRecommendation("accept") === "accepted_for_export");
check("revise maps to needs_more_evidence", panel.decisionForRecommendation("revise") === "needs_more_evidence");
check("reject maps to rejected", panel.decisionForRecommendation("reject") === "rejected");
check("defer_cultural has no prefill", panel.decisionForRecommendation("defer_cultural") === null);

// agreement derivation
const acceptArtifact = { recommendation: "accept", agent_review_id: "t1:agent-review:1:1" };
check("explicit choice wins", panel.deriveAgreement(acceptArtifact, "rejected", "followed") === "followed");
check("matching decision derives followed", panel.deriveAgreement(acceptArtifact, "accepted_for_export", undefined) === "followed");
check("contradicting decision derives disagreed", panel.deriveAgreement(acceptArtifact, "rejected", undefined) === "disagreed");
check("no artifact derives undefined", panel.deriveAgreement(null, "rejected", undefined) === undefined);
const deferArtifact = { recommendation: "defer_cultural" };
check("defer_cultural derives followed for any human decision", panel.deriveAgreement(deferArtifact, "rejected", undefined) === "followed");

// rendering: pills
check("queue pill for accept is green", panel.queuePillHtml(acceptArtifact).includes("pill green") && panel.queuePillHtml(acceptArtifact).includes("AI: accept"));
check("queue pill for defer reads human judgement", panel.queuePillHtml(deferArtifact).includes("AI: human judgement"));
check("no artifact renders no pill", panel.queuePillHtml(null) === "");

// rendering: panel content and escaping
const artifact = {
  agent_review_id: "task-9:agent-review:1751800000000:2",
  recommendation: "revise",
  reasoning: "The source supports existence but the <b>date</b> is unclear & unverified.",
  sources_checked: [
    { check: "existence", method: "http_fetch", outcome: "supported", note: "Page names the chapel.", url_or_file: "https://example.org/x" },
    { check: "date_support", method: "http_fetch", outcome: "unclear", note: "No 1885 mention." },
  ],
  cultural_sensitivity: { flagged: false },
  model_name: "claude-sonnet-5",
  prompt_version: "claude-batch-review-v1",
  version: 2,
  created_at: 1751800000000,
};
const html = panel.panelHtml(artifact);
check("panel renders recommendation label", html.includes(">revise<"));
check("panel renders AI-generated pill", html.includes("AI-generated"));
check("panel escapes reasoning html", html.includes("&lt;b&gt;date&lt;/b&gt;") && html.includes("&amp; unverified"));
check("panel shows version line for re-reviews", html.includes("review 2 of this task"));
check("panel lists both source checks", html.includes("date support") && html.includes("existence"));
check("panel offers Use recommendation for mappable rec", html.includes("useAgentRecommendation"));
check("panel always offers Decide differently", html.includes("disagreeAgentRecommendation"));

const deferHtml = panel.panelHtml({ ...artifact, recommendation: "defer_cultural", cultural_sensitivity: { flagged: true, basis: "Vanuatu country default." } });
check("defer panel hides prefill button", !deferHtml.includes("useAgentRecommendation"));
check("defer panel keeps disagree affordance", deferHtml.includes("disagreeAgentRecommendation"));
check("defer panel states source-check-only boundary", deferHtml.includes("no judgement on the cultural claim"));

check("absent artifact renders empty panel", panel.panelHtml(null) === "");

console.log(failures === 0 ? "ALL PANEL TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
