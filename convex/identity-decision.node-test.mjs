import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { identityDecision } = await import("./model.ts");

const validatorValues = identityDecision.members.map((member) => member.value);

// the review form's identity choices, read from the portal source
function formValues() {
  const source = fs.readFileSync(new URL("../apps/regions/nz/js/review-portal.js", import.meta.url), "utf8");
  const select = source.match(/<select id="identityDecision"[\s\S]*?<\/select>/);
  assert.ok(select, "the review form has an identity decision select");
  return [...select[0].matchAll(/<option value="([^"]*)">/g)].map((match) => match[1]).filter((value) => value !== "");
}

test("the identity validator carries the definition 0.1.6 bases", () => {
  for (const value of ["same_site", "conversion", "successor_at_new_site", "end_and_new_foundation", "new_candidate", "duplicate", "split", "merge", "uncertain"]) {
    assert.ok(validatorValues.includes(value), value);
  }
});

test("the validator keeps the pre-0.1.6 relocation value, so it does not narrow", () => {
  assert.ok(validatorValues.includes("relocation"));
});

test("the review form offers every current basis and no longer offers relocation", () => {
  const offered = formValues();
  assert.deepEqual([...offered].sort(), validatorValues.filter((value) => value !== "relocation").sort());
  assert.ok(!offered.includes("relocation"));
});
