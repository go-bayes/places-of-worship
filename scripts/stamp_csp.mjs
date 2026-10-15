#!/usr/bin/env node
// stamp a content-security-policy <meta> into every served html page.
//
// github pages cannot send response headers, so the policy travels in the
// page. every page gets the same source list plus the sha-256 hashes of its
// own inline scripts, which keeps 'unsafe-inline' out of script-src. pages
// on one origin share storage, so they share one source list as well.
//
// the script also pins the unpkg maplibre tags with subresource integrity.
//
//   node scripts/stamp_csp.mjs           rewrite pages in place
//   node scripts/stamp_csp.mjs --check   exit 1 if any page is stale
//
// edit an inline config script, then rerun the stamp: a stale hash blocks
// that script in the browser and the page stops working.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// maplibre-gl 3.6.1 from unpkg; hashes checked against the npm tarball
const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.css";
const SRI = {
  [MAPLIBRE_JS]: "sha384-uofOi1moPDuBpTo0FkNAG4WsnGegNBw9g6c0yU85W9DOyVkz3Ht2vKC744Y92hu0",
  [MAPLIBRE_CSS]: "sha384-p5cy4wHtKSqjnLUNjQ+8ffCwUp0vlLS+6lg1lc3qqXax2E1EmVCMCAimU+R0MOZH"
};

// map data and basemaps, geocoders, osm history, the portal backend and
// attachment uploads, google sign-in and the street view embed. no google
// maps script host is listed: its loader echoes a callback parameter into
// the script it returns, so allowing it would admit any injected script tag
const TILES = [
  "https://tiles.placemap.org",
  "https://api.maptiler.com",
  "https://tile.openstreetmap.org"
];

const SOURCES = {
  "default-src": ["'self'"],
  "script-src": ["'self'", MAPLIBRE_JS, "https://accounts.google.com/gsi/client"],
  "style-src": ["'self'", "'unsafe-inline'", MAPLIBRE_CSS, "https://accounts.google.com/gsi/style"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    ...TILES,
    "https://pub-7ea3480b1cda47698311dce4dbab438c.r2.dev"
  ],
  "font-src": ["'self'"],
  "connect-src": [
    "'self'",
    ...TILES,
    "https://photon.komoot.io",
    "https://nominatim.openstreetmap.org",
    "https://api.openstreetmap.org",
    "https://pastel-goshawk-398.convex.cloud",
    // attachment uploads go to presigned urls on the account's r2 host
    "https://*.r2.cloudflarestorage.com",
    "https://accounts.google.com/gsi/"
  ],
  "worker-src": ["'self'", "blob:"],
  "frame-src": ["https://accounts.google.com/gsi/", "https://www.google.com/maps/embed/"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"]
};

// the data-maps switcher appends one speculation-rules script built from a
// constant object. chromium refuses it under 'inline-speculation-rules' when
// the policy arrives by meta, so the policy carries the hash of its text,
// read from the switcher source itself to keep the two in step
const SWITCHER = "apps/shared/datamaps-switcher.js";
const RULES_CALL = "rules.textContent = JSON.stringify(";

// the end of a balanced bracket expression starting at `open`, skipping
// string literals and comments so a ")" inside a selector does not count
function closingIndex(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i += 1; i < source.length && source[i] !== ch; i += 1) {
        if (source[i] === "\\") i += 1;
      }
    } else if (ch === "/" && source[i + 1] === "/") {
      i = source.indexOf("\n", i);
      if (i < 0) break;
    } else if (ch === "/" && source[i + 1] === "*") {
      i = source.indexOf("*/", i + 2) + 1;
      if (i <= 0) break;
    } else if (ch === "(" || ch === "{" || ch === "[") {
      depth += 1;
    } else if (ch === ")" || ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`${SWITCHER}: unbalanced speculation rules expression`);
}

export function speculationRulesHash(source) {
  const start = source.indexOf(RULES_CALL);
  if (start < 0) throw new Error(`${SWITCHER}: speculation rules not found`);
  const open = start + RULES_CALL.length - 1;
  const call = source.slice(start + "rules.textContent = ".length, closingIndex(source, open) + 1);
  const text = runInNewContext(call, Object.create(null));
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

const RULES_HASH = speculationRulesHash(readFileSync(join(ROOT, SWITCHER), "utf8"));

const META_RE = /^[ \t]*<meta http-equiv="Content-Security-Policy" content="[^"]*">\n/m;
const CHARSET_RE = /^([ \t]*)<meta charset="[^"]*">\n/im;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
// attribute values may hold ">", so quoted values are matched whole
const ATTRS = `((?:[^>"']|"[^"]*"|'[^']*')*)`;
const SCRIPT_RE = new RegExp(`<script\\b${ATTRS}>([\\s\\S]*?)</script\\s*>`, "gi");
const TAG_RE = (name) => new RegExp(`<${name}\\b${ATTRS}>`, "gi");
const FIRST_RESOURCE_RE = /<(?:script|link|style)\b/i;

// a named attribute in a tag's attribute text, quoted values masked so
// that a value containing " src=" is not taken for the attribute
function hasAttr(attrs, name) {
  const masked = attrs.replace(/"[^"]*"|'[^']*'/g, '""');
  return new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`, "i").test(masked);
}

function attrValue(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

function inlineScriptHashes(html) {
  const hashes = [];
  for (const m of html.replace(COMMENT_RE, "").matchAll(SCRIPT_RE)) {
    if (hasAttr(m[1], "src")) continue;
    // the html parser turns crlf and lone cr into lf before the browser hashes
    const body = m[2].replace(/\r\n?/g, "\n");
    const token = `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
    if (!hashes.includes(token)) hashes.push(token);
  }
  return hashes;
}

export function policyFor(html) {
  const withoutMeta = html.replace(META_RE, "");
  const directives = Object.entries(SOURCES).map(([name, list]) => {
    const values = name === "script-src" ? [...list, RULES_HASH, ...inlineScriptHashes(withoutMeta)] : list;
    return `${name} ${values.join(" ")}`;
  });
  return directives.join("; ");
}

// set integrity and crossorigin on the maplibre tags, whatever the attribute
// order, keeping every other attribute
function pinMaplibre(html) {
  const pin = (tag, attrs, url) => {
    const kept = attrs
      .replace(/\s+(?:integrity|crossorigin)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/gi, "")
      .replace(/\s*\/?\s*$/, "");
    return `<${tag}${kept} integrity="${SRI[url]}" crossorigin="anonymous">`;
  };
  return html
    .replace(TAG_RE("script"), (whole, attrs) =>
      attrValue(attrs, "src") === MAPLIBRE_JS ? pin("script", attrs, MAPLIBRE_JS) : whole)
    .replace(TAG_RE("link"), (whole, attrs) =>
      attrValue(attrs, "href") === MAPLIBRE_CSS ? pin("link", attrs, MAPLIBRE_CSS) : whole);
}

export function stamp(html, page) {
  const bare = pinMaplibre(html).replace(META_RE, "");
  const anchor = bare.match(CHARSET_RE);
  if (!anchor) throw new Error(`${page}: no <meta charset> line to anchor the policy`);
  const at = anchor.index + anchor[0].length;
  // a meta policy governs only what follows it, inside the head
  const head = bare.search(/<head\b/i);
  const headEnd = bare.search(/<\/head\s*>/i);
  const firstResource = bare.search(FIRST_RESOURCE_RE);
  if (head < 0 || anchor.index < head || (headEnd >= 0 && at > headEnd)) {
    throw new Error(`${page}: <meta charset> must sit inside <head>`);
  }
  if (firstResource >= 0 && firstResource < at) {
    throw new Error(`${page}: a script, link or style precedes <meta charset>; the policy would not cover it`);
  }
  const meta = `${anchor[1]}<meta http-equiv="Content-Security-Policy" content="${policyFor(bare)}">\n`;
  return bare.slice(0, at) + meta + bare.slice(at);
}

// the workbench page is a vite development entry: vite serves it with inline
// hot-reload scripts, and in production its module 404s and nothing runs
const SKIP = new Set(["apps/workbench/index.html"]);

function servedPages() {
  const out = execFileSync("git", ["ls-files", "-z", "*.html"], { cwd: ROOT, encoding: "utf8" });
  return out.split("\0").filter((page) => page && !SKIP.has(page)).sort();
}

function main() {
  const check = process.argv.includes("--check");
  const stale = [];
  for (const page of servedPages()) {
    const path = join(ROOT, page);
    const html = readFileSync(path, "utf8");
    const next = stamp(html, page);
    if (next === html) continue;
    stale.push(page);
    if (!check) writeFileSync(path, next);
  }
  if (check && stale.length) {
    console.error(`content-security-policy stale on ${stale.length} page(s); run node scripts/stamp_csp.mjs`);
    for (const page of stale) console.error(`  ${page}`);
    process.exit(1);
  }
  console.log(check ? "content-security-policy current on every page" : `stamped ${stale.length} page(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
