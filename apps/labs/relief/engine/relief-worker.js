import { collectPlaces } from "./extent.js";
import { binPlaces } from "./hexbin.js";

async function gunzip(buffer) {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

// accepts the same request as the worker. fetchResponse is injectable for offline use.
export async function buildRelief(
  { bbox, zoom, cellMetres, tileUrlTemplate },
  { fetchResponse = globalThis.fetch } = {}
) {
  if (typeof tileUrlTemplate !== "string"
    || !["{z}", "{x}", "{y}"].every((part) => tileUrlTemplate.includes(part))) {
    throw new Error("Expected a tile URL template containing {z}, {x} and {y}");
  }
  const fetchTile = async ({ z, x, y }) => {
    const url = tileUrlTemplate.replaceAll("{z}", z).replaceAll("{x}", x).replaceAll("{y}", y);
    const response = await fetchResponse(url);
    if (response.status === 204) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  };
  const { points, reconciliation } = await collectPlaces({ bbox, zoom, fetchTile, gunzip });
  const { cells, totals } = binPlaces(points, { bbox, cellMetres });
  const features = cells.flatMap(({ id, ring, segments, ...summary }) => {
    const geometry = { type: "Polygon", coordinates: [ring] };
    return [
      {
        type: "Feature", id, geometry,
        properties: { kind: "footprint", cell_id: id, ...summary }
      },
      ...segments.map((segment) => ({
        type: "Feature", id: `${id}/${segment.category}`, geometry,
        properties: { kind: "segment", cell_id: id, ...segment }
      }))
    ];
  });
  return { cells: { type: "FeatureCollection", features }, totals, reconciliation };
}

if (typeof DedicatedWorkerGlobalScope !== "undefined" && self instanceof DedicatedWorkerGlobalScope) {
  self.addEventListener("message", async ({ data }) => {
    try {
      self.postMessage(await buildRelief(data));
    } catch (error) {
      self.postMessage({ error: error.message });
    }
  });
}
