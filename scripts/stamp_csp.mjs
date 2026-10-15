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
const MAPLIBRE = "https://unpkg.com/maplibre-gl@3.6.1/dist/";
const SRI = {
  "maplibre-gl.js": "sha384-uofOi1moPDuBpTo0FkNAG4WsnGegNBw9g6c0yU85W9DOyVkz3Ht2vKC744Y92hu0",
  "maplibre-gl.css": "sha384-p5cy4wHtKSqjnLUNjQ+8ffCwUp0vlLS+6lg1lc3qqXax2E1EmVCMCAimU+R0MOZH"
};

// map data and basemaps, geocoders, osm history, the portal backend and
// attachment storage, google sign-in and the street view api
const TILES = [
  "https://tiles.placemap.org",
  "https://api.maptiler.com",
  "https://tile.openstreetmap.org"
];
const GOOGLE_MAPS_IMG = [
  "https://*.googleapis.com",
  "https://*.gstatic.com",
  "https://*.ggpht.com"
];
const ATTACHMENTS = "https://*.r2.cloudflarestorage.com";

const SOURCES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "https://unpkg.com/maplibre-gl@3.6.1/",
    "https://accounts.google.com/gsi/client",
    "https://maps.googleapis.com"
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://unpkg.com/maplibre-gl@3.6.1/",
    "https://accounts.google.com/gsi/style",
    "https://fonts.googleapis.com"
  ],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    ...TILES,
    ...GOOGLE_MAPS_IMG,
    "https://pub-7ea3480b1cda47698311dce4dbab438c.r2.dev",
    ATTACHMENTS
  ],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "connect-src": [
    "'self'",
    ...TILES,
    "https://photon.komoot.io",
    "https://nominatim.openstreetmap.org",
    "https://api.openstreetmap.org",
    "https://pastel-goshawk-398.convex.cloud",
    ATTACHMENTS,
    "https://accounts.google.com/gsi/",
    "https://maps.googleapis.com"
  ],
  "worker-src": ["'self'", "blob:"],
  "frame-src": ["https://accounts.google.com/gsi/"],
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

export function speculationRulesHash(source) {
  const start = source.indexOf(RULES_CALL);
  if (start < 0) throw new Error(`${SWITCHER}: speculation rules not found`);
  let depth = 0;
  let end = start + RULES_CALL.length - 1;
  do {
    const ch = source[end];
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    if (ch === ")" || ch === "}" || ch === "]") depth -= 1;
    end += 1;
  } while (depth > 0 && end < source.length);
  const call = source.slice(start + "rules.textContent = ".length, end);
  const text = runInNewContext(call, Object.create(null));
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

const RULES_HASH = speculationRulesHash(readFileSync(join(ROOT, SWITCHER), "utf8"));

const META_RE = /^[ \t]*<meta http-equiv="Content-Security-Policy" content="[^"]*">\n/m;
const CHARSET_RE = /^([ \t]*)<meta charset="[^"]*">\n/im;
const INLINE_RE = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;

// the workbench page is a vite development entry: vite serves it with inline
// hot-reload scripts, and in production its module 404s and nothing runs
const SKIP = new Set(["apps/workbench/index.html"]);

function servedPages() {
  const out = execFileSync("git", ["ls-files", "-z", "*.html"], { cwd: ROOT, encoding: "utf8" });
  return out.split("\0").filter((page) => page && !SKIP.has(page)).sort();
}

function inlineScriptHashes(html) {
  const hashes = [];
  for (const m of html.matchAll(INLINE_RE)) {
    const attrs = m[1] || "";
    if (/\ssrc\s*=/.test(attrs)) continue;
    const digest = createHash("sha256").update(m[2], "utf8").digest("base64");
    const token = `'sha256-${digest}'`;
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

function pinMaplibre(html) {
  let out = html;
  for (const [file, hash] of Object.entries(SRI)) {
    const url = MAPLIBRE + file;
    const tag = file.endsWith(".js")
      ? new RegExp(`<script src="${url.replace(/[.]/g, "\\.")}"[^>]*></script>`, "g")
      : new RegExp(`<link href="${url.replace(/[.]/g, "\\.")}"[^>]*>`, "g");
    const pinned = file.endsWith(".js")
      ? `<script src="${url}" integrity="${hash}" crossorigin="anonymous"></script>`
      : `<link href="${url}" rel="stylesheet" integrity="${hash}" crossorigin="anonymous">`;
    out = out.replace(tag, pinned);
  }
  return out;
}

export function stamp(html, page) {
  const pinned = pinMaplibre(html);
  const charset = pinned.match(CHARSET_RE);
  if (!charset) throw new Error(`${page}: no <meta charset> line to anchor the policy`);
  const meta = `${charset[1]}<meta http-equiv="Content-Security-Policy" content="${policyFor(pinned)}">\n`;
  const bare = pinned.replace(META_RE, "");
  const anchor = bare.match(CHARSET_RE);
  const at = anchor.index + anchor[0].length;
  return bare.slice(0, at) + meta + bare.slice(at);
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
