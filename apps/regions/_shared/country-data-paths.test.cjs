const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "../../..");
const regions = path.join(repo, "apps", "regions");
const origin = "https://religionmap.org";

test("country configs reference existing local data files", async (t) => {
  const { tokens } = await import("../../../scripts/stamp_csp.mjs");
  const missing = [];
  let configs = 0;
  let files = 0;

  for (const entry of fs.readdirSync(regions, { recursive: true }).sort()) {
    if (path.basename(entry) !== "index.html") continue;
    const page = path.join(regions, entry);
    const pagePath = path.relative(repo, page).split(path.sep).join("/");
    const script = tokens(fs.readFileSync(page, "utf8")).find((token) =>
      token.name === "script" && /^\s*window\.REGION_CONFIG\s*=/m.test(token.body || "")
    );
    if (!script) continue;

    const window = {};
    vm.runInNewContext(script.body, { window }, { filename: pagePath });
    const config = window.REGION_CONFIG;
    const levels = [config.censusLevels, ...Object.values(config.overlays || {}).map((overlay) => overlay.levels)];
    const urls = [config.datedPlaces];
    for (const group of levels) {
      for (const level of Object.values(group || {})) {
        urls.push(level.boundaries, level.summary, level.summaryColumns);
      }
    }

    configs += 1;
    for (const href of urls.filter(Boolean)) {
      const url = new URL(href, `${origin}/${pagePath}`);
      if (url.origin !== origin) continue;
      files += 1;
      const file = path.join(repo, decodeURIComponent(url.pathname));
      if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
        missing.push(`${pagePath} → ${href}`);
      }
    }
  }

  assert.ok(configs > 0 && files > 0, "no country data paths were checked");
  t.diagnostic(`${files} local data paths across ${configs} country configs`);
  assert.deepEqual(missing, [], "missing local country data files");
});
