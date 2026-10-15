import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { policyFor, speculationRulesHash, stamp } from "./stamp_csp.mjs";

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link href="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.css" rel="stylesheet">
</head>
<body>
  <script src="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js"></script>
  <script>
    window.REGION_CONFIG = { countryCode: "NZ" };
  </script>
  <script src="../_shared/region-map.js"></script>
</body>
</html>
`;

function scriptSrc(policy) {
  return policy.split("; ").find((d) => d.startsWith("script-src "));
}

test("the policy carries the hash of each inline script and no unsafe-inline", () => {
  const body = '\n    window.REGION_CONFIG = { countryCode: "NZ" };\n  ';
  const hash = createHash("sha256").update(body, "utf8").digest("base64");
  const src = scriptSrc(policyFor(PAGE));
  assert.ok(src.includes(`'sha256-${hash}'`));
  assert.ok(!src.includes("'unsafe-inline'"));
  assert.ok(!src.includes("'unsafe-eval'"));
});

test("the meta sits straight after the charset, before any script or link", () => {
  const out = stamp(PAGE, "test.html");
  const meta = out.indexOf('<meta http-equiv="Content-Security-Policy"');
  assert.ok(meta > out.indexOf("<meta charset"));
  assert.ok(meta < out.indexOf("<link"));
  assert.ok(meta < out.indexOf("<script"));
});

test("stamping twice changes nothing", () => {
  const once = stamp(PAGE, "test.html");
  assert.equal(stamp(once, "test.html"), once);
});

test("an edited config script gets a new hash", () => {
  const once = stamp(PAGE, "test.html");
  const edited = once.replace('countryCode: "NZ"', 'countryCode: "AU"');
  assert.notEqual(stamp(edited, "test.html"), edited);
});

test("the unpkg maplibre tags carry integrity and crossorigin", () => {
  const out = stamp(PAGE, "test.html");
  assert.match(out, /maplibre-gl\.js" integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous"><\/script>/);
  assert.match(out, /maplibre-gl\.css" rel="stylesheet" integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous">/);
});

test("a page without a charset line is refused", () => {
  assert.throws(() => stamp("<html><head></head></html>", "bare.html"), /no <meta charset>/);
});

test("the speculation-rules hash is the hash of the switcher's JSON text", () => {
  const source = 'const rules = {};\n      rules.textContent = JSON.stringify({\n        prerender: [{ source: "document", eagerness: "moderate" }]\n      });\n';
  const text = JSON.stringify({ prerender: [{ source: "document", eagerness: "moderate" }] });
  const hash = createHash("sha256").update(text, "utf8").digest("base64");
  assert.equal(speculationRulesHash(source), `'sha256-${hash}'`);
  assert.ok(scriptSrc(policyFor(PAGE)).includes("'sha256-"));
});
