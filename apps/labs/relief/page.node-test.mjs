import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as palette from "../shared/palette.mjs";
import { CITIES } from "../shared/cities.mjs";
import { religionCategories } from "./engine/categories.js";
import { tilesCoveringBbox } from "./engine/extent.js";
import * as view from "./view.mjs";

async function reliefPage() {
  const elements = new Map();
  const createElement = () => ({
    children: [], dataset: {}, textContent: "", hidden: false,
    addEventListener() {},
    replaceChildren(...children) { this.children = children; }
  });
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const legendCount = createElement();
  get("legend-traditions").children.push({
    dataset: { key: "christian" }, querySelector: () => legendCount, classList: { toggle() {} }
  });
  const workers = [];
  class Worker {
    constructor() { workers.push(this); }
    handlers = {};
    addEventListener(type, handler) { this.handlers[type] = handler; }
    postMessage() {}
    terminate() { this.terminated = true; }
  }
  const map = {
    handlers: {}, on(type, handler) { this.handlers[type] = handler; },
    addControl() {}, getCanvas: () => ({ setAttribute() {} }), getSource() {}
  };
  const url = new URL("./relief.mjs", import.meta.url);
  const source = await readFile(url, "utf8");
  const start = source.indexOf("const TILE_URL");
  const end = source.indexOf("// ---- start ");
  const page = runInNewContext(
    source.slice(start, end).replaceAll("import.meta.url", JSON.stringify(url.href))
      + "\n({ state, compute, showResult, startMap, get worker() { return worker; } })",
    {
      window: { matchMedia: () => ({ matches: false }) }, location: { search: "" },
      document: { documentElement: { dataset: {} }, getElementById: get, createElement },
      URLSearchParams, URL, Worker, CITIES, religionCategories, tilesCoveringBbox, ...view, ...palette,
      maplibregl: { Map: function () { return map; }, NavigationControl: class {} }
    }
  );
  return { ...page, get, map, workers, legendCount, currentWorker: () => page.worker };
}

test("loading and worker errors clear every Relief total and release the worker", async () => {
  const { state, compute, get, workers, legendCount, currentWorker } = await reliefPage();
  state.result = { totals: { count: 117 } };
  for (const id of ["how-lines", "table-body", "table-foot"]) get(id).children.push("117");
  get("count-line").textContent = legendCount.textContent = "117";
  compute();
  for (const id of ["how-lines", "table-body", "table-foot"]) assert.equal(get(id).children.length, 0, id);
  assert.equal(legendCount.textContent, "");
  assert.doesNotMatch(get("count-line").textContent, /117/);
  workers[0].handlers.error({ message: "worker stopped" });
  assert.equal(workers[0].terminated, true);
  assert.equal(currentWorker(), null);
  assert.equal(get("count-line").textContent, "");
  assert.match(get("failure-text").textContent, /No totals/);
});

test("a rejected Relief result never reaches the table or page state", async () => {
  const { state, showResult, get } = await reliefPage();
  showResult({ cells: { features: [] }, totals: { count: 2 } });
  assert.equal(state.result, null);
  assert.equal(state.cells.length, 0);
  assert.equal(get("table-foot").children.length, 0);
  assert.match(get("failure-text").textContent, /No totals/);
});

test("invalid Relief tile enumeration clears stale totals and reports a failure", async () => {
  const { state, compute, workers, get } = await reliefPage();
  state.result = { totals: { count: 117 } };
  state.city = { label: "Date line", coords: [179.99, 0] };
  get("table-foot").children.push("117");
  compute();
  assert.equal(state.result, null);
  assert.equal(workers.length, 0);
  assert.equal(get("table-foot").children.length, 0);
  assert.match(get("failure-text").textContent, /non-wrapping bbox/);
});

test("a basemap error leaves the Relief counting status and worker independent", async () => {
  const { map, startMap, compute, get, currentWorker } = await reliefPage();
  get("basemap-notice").hidden = true;
  compute();
  const worker = currentWorker();
  const countStatus = get("count-line").textContent;
  startMap();
  map.handlers.error?.({ sourceId: "omt", error: { status: 403 } });
  assert.equal(get("basemap-notice").hidden, false);
  assert.equal(get("count-line").textContent, countStatus);
  assert.equal(currentWorker(), worker);
});

test("the Relief basemap warning clears on successful basemap recovery", async () => {
  const { map, startMap, get } = await reliefPage();
  const notice = get("basemap-notice");
  notice.hidden = true;
  const failedTile = { state: "errored" };
  map.style = { tileManagers: { omt: { getIds: () => ["failed"], getTileByID: () => failedTile } } };
  startMap();
  map.handlers.error({ sourceId: "omt", tile: failedTile, error: { status: 503 } });
  assert.equal(notice.hidden, false);
  map.handlers.sourcedata?.({ sourceId: "ground", tile: { state: "loaded" } });
  map.handlers.sourcedata?.({ sourceId: "omt", tile: { state: "loaded" } });
  assert.equal(notice.hidden, false);
  failedTile.state = "loaded";
  map.handlers.sourcedata?.({ sourceId: "omt", tile: failedTile });
  assert.equal(notice.hidden, true);
});
