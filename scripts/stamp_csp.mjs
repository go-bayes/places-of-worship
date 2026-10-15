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

// a small tokeniser for the parts of html that matter here: comments are
// skipped, raw-text elements (script, style, textarea, title, noscript)
// keep their bodies verbatim, and start tags yield parsed attributes
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "noscript"]);

function parseAttributes(html, from) {
  const attrs = [];
  let i = from;
  for (;;) {
    while (i < html.length && /[\s/]/.test(html[i])) i += 1;
    if (i >= html.length || html[i] === ">") return { attrs, end: i + 1 };
    const start = i;
    while (i < html.length && !/[\s/>=]/.test(html[i])) i += 1;
    const name = html.slice(start, i).toLowerCase();
    let value = "";
    let j = i;
    while (j < html.length && /\s/.test(html[j])) j += 1;
    if (html[j] === "=") {
      j += 1;
      while (j < html.length && /\s/.test(html[j])) j += 1;
      const quote = html[j];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, j + 1);
        value = html.slice(j + 1, close < 0 ? html.length : close);
        j = close < 0 ? html.length : close + 1;
      } else {
        const valueStart = j;
        while (j < html.length && !/[\s>]/.test(html[j])) j += 1;
        value = html.slice(valueStart, j);
      }
      i = j;
    }
    attrs.push({ name, value, raw: html.slice(start, i) });
  }
}

export function tokens(html) {
  const out = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) break;
    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      i = close < 0 ? html.length : close + 3;
      continue;
    }
    const endTag = /^<\/([a-zA-Z][\w-]*)[^>]*>/.exec(html.slice(lt, lt + 200));
    if (endTag) {
      out.push({ type: "end", name: endTag[1].toLowerCase(), start: lt, end: lt + endTag[0].length });
      i = lt + endTag[0].length;
      continue;
    }
    const startTag = /^<([a-zA-Z][\w-]*)/.exec(html.slice(lt, lt + 64));
    if (!startTag) {
      i = lt + 1;
      continue;
    }
    const name = startTag[1].toLowerCase();
    const { attrs, end } = parseAttributes(html, lt + startTag[0].length);
    const token = { type: "start", name, attrs, start: lt, end };
    out.push(token);
    i = end;
    if (RAW_TEXT.has(name)) {
      const closeRe = new RegExp(`</${name}[\\s/>]`, "ig");
      closeRe.lastIndex = end;
      const close = closeRe.exec(html);
      const bodyEnd = close ? close.index : html.length;
      token.body = html.slice(end, bodyEnd);
      i = bodyEnd;
    }
  }
  return out;
}

const attr = (token, name) => {
  const found = token.attrs.find((a) => a.name === name);
  return found ? found.value : null;
};

const isPolicyMeta = (t) =>
  t.type === "start" && t.name === "meta" &&
  (attr(t, "http-equiv") || "").toLowerCase() === "content-security-policy";

function inlineScriptHashes(html) {
  const hashes = [];
  for (const t of tokens(html)) {
    if (t.type !== "start" || t.name !== "script" || attr(t, "src") !== null) continue;
    // the html parser turns crlf and lone cr into lf before the browser hashes
    const body = t.body.replace(/\r\n?/g, "\n");
    const token = `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
    if (!hashes.includes(token)) hashes.push(token);
  }
  return hashes;
}

// remove every policy meta, with its line when it stands alone on one
function withoutPolicy(html) {
  let out = html;
  for (const t of tokens(html).filter(isPolicyMeta).reverse()) {
    let start = t.start;
    let end = t.end;
    const lineStart = out.lastIndexOf("\n", start - 1) + 1;
    if (/^[ \t]*$/.test(out.slice(lineStart, start)) && out[end] === "\n") {
      start = lineStart;
      end += 1;
    }
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

export function policyFor(html) {
  const bare = withoutPolicy(html);
  const directives = Object.entries(SOURCES).map(([name, list]) => {
    const values = name === "script-src" ? [...list, RULES_HASH, ...inlineScriptHashes(bare)] : list;
    return `${name} ${values.join(" ")}`;
  });
  return directives.join("; ");
}

// set integrity and crossorigin on the maplibre tags, whatever the attribute
// order, keeping every other attribute as written
function pinMaplibre(html) {
  let out = html;
  const targets = tokens(html).filter((t) => t.type === "start" && (
    (t.name === "script" && attr(t, "src") === MAPLIBRE_JS) ||
    (t.name === "link" && attr(t, "href") === MAPLIBRE_CSS)));
  for (const t of targets.reverse()) {
    const url = t.name === "script" ? MAPLIBRE_JS : MAPLIBRE_CSS;
    const kept = t.attrs.filter((a) => a.name !== "integrity" && a.name !== "crossorigin").map((a) => a.raw);
    const tag = `<${t.name} ${[...kept, `integrity="${SRI[url]}"`, 'crossorigin="anonymous"'].join(" ")}>`;
    out = out.slice(0, t.start) + tag + out.slice(t.end);
  }
  return out;
}

export function stamp(html, page) {
  const bare = withoutPolicy(pinMaplibre(html));
  const all = tokens(bare);
  const charset = all.find((t) => t.type === "start" && t.name === "meta" && attr(t, "charset") !== null);
  if (!charset) throw new Error(`${page}: no <meta charset> to anchor the policy`);
  // a meta policy governs only what follows it, inside the head
  const head = all.find((t) => t.type === "start" && t.name === "head");
  const headEnd = all.find((t) => t.type === "end" && t.name === "head");
  if (!head || charset.start < head.start || (headEnd && charset.start > headEnd.start)) {
    throw new Error(`${page}: <meta charset> must sit inside <head>`);
  }
  const early = all.find((t) => t.type === "start" && ["script", "link", "style"].includes(t.name) && t.start < charset.start);
  if (early) {
    throw new Error(`${page}: a script, link or style precedes <meta charset>; the policy would not cover it`);
  }
  const lineStart = bare.lastIndexOf("\n", charset.start - 1) + 1;
  const indent = /^[ \t]*$/.test(bare.slice(lineStart, charset.start)) ? bare.slice(lineStart, charset.start) : "";
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor(bare)}">`;
  const at = charset.end;
  return bare[at] === "\n"
    ? `${bare.slice(0, at + 1)}${indent}${meta}\n${bare.slice(at + 1)}`
    : `${bare.slice(0, at)}${meta}${bare.slice(at)}`;
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
