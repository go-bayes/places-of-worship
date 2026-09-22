// renders the canonical operational definition (docs/operational-definition.md)
// into the guides' html template at apps/guides/definition.html, so the page
// the ras and reviewers read is the markdown the project adopts. the markdown
// is the source; this script owns the html.
//
//   node scripts/build_definition_guide.mjs --write
//   node scripts/build_definition_guide.mjs --check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "docs/operational-definition.md");
const targetPath = path.join(repoRoot, "apps/guides/definition.html");
const repoDocsUrl = "https://github.com/go-bayes/places-of-worship/blob/main/docs/";

const escapeHtml = (text) => text
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

// relative links in the markdown are relative to docs/; the page lives on the
// site, so they point at the rendered file on github
const resolveHref = (href) => {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [file, anchor] = href.split("#");
  const resolved = path.posix.normalize(path.posix.join("docs", file)).replace(/^docs\//, "");
  return `${repoDocsUrl}${resolved}${anchor ? `#${anchor}` : ""}`;
};

// the subset of markdown the definition uses: bold, italics, code, links
const inline = (text) => {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${escapeHtml(resolveHref(href))}">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)]|$)/g, "$1<em>$2</em>");
  return out;
};

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const render = (markdown) => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i += 1; continue; }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) { blocks.push({ type: `h${heading[1].length}`, text: heading[2] }); i += 1; continue; }
    if (/^(-|\d+\.)\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^(-|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^(-|\d+\.)\s+/, ""));
        i += 1;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|-\s|\d+\.\s)/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }

  const title = blocks.find((b) => b.type === "h1")?.text ?? "Operational definition";
  const version = blocks.find((b) => b.type === "p" && /^Current version:/.test(b.text))?.text ?? "";
  const lead = blocks.find((b) => b.type === "p" && /^\*\*/.test(b.text))?.text ?? "";
  const sections = [];
  let current = null;
  for (const block of blocks) {
    if (block.type === "h1" || block === blocks.find((b) => b.text === version) || block.text === lead) continue;
    if (block.type === "h2") {
      current = { id: slug(block.text), title: block.text, body: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    if (block.type === "h3") current.body.push(`  <h3 id="${slug(block.text)}">${inline(block.text)}</h3>`);
    else if (block.type === "p") current.body.push(`  <p>${inline(block.text)}</p>`);
    else current.body.push(`  <${block.type} class="prose-list">\n${block.items.map((item) => `    <li>${inline(item)}</li>`).join("\n")}\n  </${block.type}>`);
  }

  const toc = sections.map((s) => `      <li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join("\n");
  const body = sections.map((s) => `<section class="guide-section prose-section" id="${s.id}">\n  <h2>${escapeHtml(s.title)}</h2>\n${s.body.join("\n")}\n</section>`).join("\n\n");
  const adopted = version.match(/Adopted:\s*([0-9-]+)/)?.[1] ?? "";

  return `<!DOCTYPE html>
<html lang="en-NZ">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Places of Worship — ${escapeHtml(title)}</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="guide.css">
</head>
<body class="definition-guide">
  <header class="page-header">
    <div class="header-inner">
      <p class="eyebrow">Places of Worship research project</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="purpose">${inline(lead)}</p>
      <nav class="site-nav" aria-label="Guide links">
        <a href="ra.html">RA field guide</a>
        <a href="pi.html">PI &amp; reviewer guide</a>
        <a href="../regions/">Data maps</a>
      </nav>
      <p class="storage-note">${escapeHtml(version)} This page is rendered from the <a href="${repoDocsUrl}operational-definition.md">canonical definition</a> in the repository; the Markdown is the source, and dated snapshots of every adopted version are linked under Version history.</p>
    </div>
  </header>
  <main>
  <nav class="toc" aria-labelledby="contents-heading">
    <h2 id="contents-heading">Contents</h2>
    <ol>
${toc}
    </ol>
  </nav>

${body}
  </main>
  <footer>
    <p>Places of Worship research project · definition adopted ${escapeHtml(adopted)} · rendered from docs/operational-definition.md</p>
  </footer>
</body>
</html>
`;
};

const mode = process.argv[2];
const rendered = render(fs.readFileSync(sourcePath, "utf8"));
if (mode === "--write") {
  fs.writeFileSync(targetPath, rendered);
  console.log(`wrote ${path.relative(repoRoot, targetPath)}`);
} else if (mode === "--check") {
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";
  if (current !== rendered) {
    console.error(`${path.relative(repoRoot, targetPath)} is stale: run node scripts/build_definition_guide.mjs --write`);
    process.exit(1);
  }
  console.log(`${path.relative(repoRoot, targetPath)} is current`);
} else {
  console.error("usage: node scripts/build_definition_guide.mjs --write | --check");
  process.exit(2);
}
