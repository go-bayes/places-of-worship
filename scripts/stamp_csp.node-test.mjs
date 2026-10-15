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

function hashOf(text) {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

function pageWith(body) {
  return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

test("script detection follows the html parser, not the source spelling", () => {
  const src = scriptSrc(policyFor(pageWith(
    '<SCRIPT>upper()</SCRIPT>\n' +
    '<script>spaced()</script >\n' +
    '<script data-note=" src=x">masked()</script>\n' +
    '<script data-x="a>b">quoted()</script>\n' +
    '<!-- <script>commented()</script> -->\n' +
    '<script src="x.js"></script>'
  )));
  for (const body of ["upper()", "spaced()", "masked()", "quoted()"]) {
    assert.ok(src.includes(hashOf(body)), body);
  }
  assert.ok(!src.includes(hashOf("commented()")));
  assert.ok(!src.includes(hashOf("")));
});

test("crlf in a script is hashed as the browser sees it", () => {
  const src = scriptSrc(policyFor(pageWith("<script>a()\r\nb()\rc()</script>")));
  assert.ok(src.includes(hashOf("a()\nb()\nc()")));
});

test("a resource before the charset line is refused", () => {
  const html = '<html>\n<head>\n<script src="early.js"></script>\n  <meta charset="UTF-8">\n</head>\n</html>\n';
  assert.throws(() => stamp(html, "early.html"), /precedes <meta charset>/);
});

test("pinning ignores attribute order and keeps other attributes", () => {
  const out = stamp(pageWith(
    '<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.css">\n' +
    '<script defer src="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js"></script>'
  ), "order.html");
  assert.match(out, /<link rel="stylesheet" href="[^"]+maplibre-gl\.css" integrity="sha384-[^"]+" crossorigin="anonymous">/);
  assert.match(out, /<script defer src="[^"]+maplibre-gl\.js" integrity="sha384-[^"]+" crossorigin="anonymous"><\/script>/);
  assert.equal(stamp(out, "order.html"), out);
});

test("a bracket inside a selector string does not end the rules expression", () => {
  const source = 'rules.textContent = JSON.stringify({ where: { selector_matches: "a:not(.x))" } }); // )\n';
  const text = JSON.stringify({ where: { selector_matches: "a:not(.x))" } });
  assert.equal(speculationRulesHash(source), hashOf(text));
});

test("no google maps script host and no wildcard script source", () => {
  const policy = policyFor(PAGE);
  assert.ok(!policy.includes("maps.googleapis.com"));
  assert.ok(!/script-src[^;]*\*/.test(policy));
});

test("a comment-like string inside a script is hashed as written", () => {
  const body = 'window.note="<!-- keep -->";';
  assert.ok(scriptSrc(policyFor(pageWith(`<script>${body}</script>`))).includes(hashOf(body)));
});

test("a commented-out charset line is not the anchor", () => {
  const html = '<html>\n<head>\n<!-- <meta charset="UTF-8"> -->\n  <meta charset="UTF-8">\n</head>\n</html>\n';
  const out = stamp(html, "commented.html");
  const comment = out.indexOf("-->");
  assert.ok(out.indexOf('http-equiv="Content-Security-Policy"') > comment);
  assert.equal(stamp(out, "commented.html"), out);
});

test("pinning reads attribute boundaries, not text inside values", () => {
  const out = stamp(pageWith(
    '<script data-note=" src=other.js integrity=keep" src="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js"></script>'
  ), "boundaries.html");
  assert.match(out, /<script data-note=" src=other\.js integrity=keep" src="[^"]+maplibre-gl\.js" integrity="sha384-[^"]+" crossorigin="anonymous"><\/script>/);
});
