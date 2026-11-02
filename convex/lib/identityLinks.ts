import type { QueryCtx } from "../_generated/server";

// identity bases and their links (operational definition 0.1.6; jb,
// 2026-10-19 on pr #205): a successor at a new site, an end and new
// foundation, a split and a merge each relate this place to another, and
// the decision names that place in linked_site_ids rather than in its note.
// relocation, the pre-0.1.6 basis under which one identifier followed a
// community to a new site, stays in the validator so stored rows remain
// valid, and is refused on new decisions.

export const MAX_LINKED_SITES = 10;
export const MAX_LINKED_SITE_ID = 200;

// bases that relate this place to another, so a link is required
export const LINK_REQUIRED_BASES: readonly string[] = Object.freeze([
  "successor_at_new_site",
  "end_and_new_foundation",
  "split",
  "merge",
]);

// bases where a link is useful but not always known: the record a
// duplicate repeats, or the alternatives an uncertain decision keeps
export const LINK_OPTIONAL_BASES: readonly string[] = Object.freeze([
  "duplicate",
  "uncertain",
]);

type TaskIdentifiers = {
  task_id: string;
  matched_current_site_id?: string;
  candidate_site_id?: string;
  source_record_id?: string;
  osm_object_type?: string;
  matched_osm_id?: string;
};

// the identifiers that name the place this task is about, including the
// source record and the osm reference an internal-intake task may carry
// without either site id: a link to any of them names the place itself,
// not another
export function ownIdentifiers(task: TaskIdentifiers): string[] {
  const osmRef = task.osm_object_type !== undefined && task.matched_osm_id !== undefined
    ? `osm:${task.osm_object_type}/${task.matched_osm_id}`
    : undefined;
  return [task.task_id, task.matched_current_site_id, task.candidate_site_id, task.source_record_id, osmRef]
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

// validates the decision's identity basis and links, and returns the links
// to store: trimmed, or undefined when none were given
export function assertIdentityLinks(
  task: TaskIdentifiers,
  decision: { identity_decision?: string; linked_site_ids?: string[] },
): string[] | undefined {
  const own = ownIdentifiers(task);
  const basis = decision.identity_decision;
  if (basis === "relocation") {
    throw new Error("Relocation is no longer an identity basis (definition 0.1.6). Choose successor at a new site for a move to a different property, or same place for a building moved within its site.");
  }
  const raw = decision.linked_site_ids ?? [];
  if (raw.length > MAX_LINKED_SITES) {
    throw new Error(`A decision links at most ${MAX_LINKED_SITES} places.`);
  }
  const links = raw.map((id) => id.trim());
  for (const id of links) {
    if (id.length === 0) throw new Error("A linked place identifier cannot be blank.");
    if (id.length > MAX_LINKED_SITE_ID) {
      throw new Error(`A linked place identifier must be ${MAX_LINKED_SITE_ID} characters or fewer.`);
    }
    if (/[\u0000-\u001f\u007f]/.test(id)) throw new Error("A linked place identifier cannot contain control characters.");
    if (own.includes(id)) throw new Error("A linked place must be another place, not this task's own record.");
  }
  if (new Set(links).size !== links.length) throw new Error("Each linked place is named once.");
  if (basis !== undefined && LINK_REQUIRED_BASES.includes(basis)) {
    if (links.length === 0) {
      throw new Error("This identity basis relates the place to another: give the linked place's identifier, or choose uncertain if it is not known.");
    }
  } else if (basis === undefined || !LINK_OPTIONAL_BASES.includes(basis)) {
    if (links.length > 0) {
      throw new Error("Linked places apply only to a successor at a new site, an end and new foundation, a split, a merge, a duplicate, or an uncertain decision.");
    }
  }
  return links.length === 0 ? undefined : links;
}

// resolution against known records (jb ruling, option b, before merging
// pr #206): every link must name a place that a task row in this deployment
// already carries, in any country, because definition 0.1.6 permits a
// successor across a border. convex holds no master site table; the tasks
// table is its register of known places, and five of its indexes prove an
// identifier exists. a site identifier (current or candidate) is stored as
// entered; a record reference (a task id, a source record id or an
// osm:<type>/<id> reference) is stored as the site identifier of the place
// that carries it, so a stored link names a place, never a document.

// rows read per index per link: ten links and five lookups bound one
// decision at under a thousand reads
export const MAX_RESOLUTION_MATCHES = 25;

const OSM_REFERENCE = /^osm:(node|way|relation)\/([0-9]+)$/;

// typed against the generated data model, so a renamed index or field
// fails the typecheck; the tests supply an in-memory table of the same shape
type TaskReader = QueryCtx["db"];
const take = MAX_RESOLUTION_MATCHES;

// the place a record reference resolves to: the site identifiers carried by
// the tasks that hold the reference; where none carries one, the osm
// reference (an internal-intake task names its place that way), and then
// the task id
function placesOf(tasks: TaskIdentifiers[], input: string): string[] {
  const sites = new Set<string>();
  for (const task of tasks) {
    const site = task.matched_current_site_id ?? task.candidate_site_id;
    if (site !== undefined && site.trim().length > 0) sites.add(site);
  }
  if (sites.size > 0) return [...sites];
  if (OSM_REFERENCE.test(input)) return [input];
  const fallback = new Set<string>();
  for (const task of tasks) {
    const osmRef = task.osm_object_type !== undefined && task.matched_osm_id !== undefined
      ? `osm:${task.osm_object_type}/${task.matched_osm_id}`
      : undefined;
    fallback.add(osmRef ?? task.task_id);
  }
  return [...fallback];
}

// resolves each link that assertIdentityLinks has trimmed and checked to
// the canonical identifier of a known place, and refuses, naming the
// identifier, a link that names no known place, more than one place, or
// this task's own place, and two links that name the same place
export async function resolveIdentityLinks(
  db: TaskReader,
  task: TaskIdentifiers,
  links: readonly string[],
): Promise<string[]> {
  const own = new Set(ownIdentifiers(task));
  const resolved: string[] = [];
  const resolvedFrom = new Map<string, string>();
  for (const id of links) {
    let canonical: string;
    if ((await db.query("tasks").withIndex("by_matched_site", (q) => q.eq("matched_current_site_id", id)).take(1)).length > 0) {
      canonical = id;
    } else if ((await db.query("tasks").withIndex("by_candidate_site", (q) => q.eq("candidate_site_id", id)).take(1)).length > 0) {
      canonical = id;
    } else {
      const holders = new Map<string, TaskIdentifiers>();
      const osm = OSM_REFERENCE.exec(id);
      if (osm !== null) {
        // the index narrows to one osm number; the type is checked here
        for (const row of await db.query("tasks").withIndex("by_osm", (q) => q.eq("matched_osm_id", osm[2])).take(take)) {
          if (row.osm_object_type === osm[1]) holders.set(row.task_id, row);
        }
      }
      for (const row of await db.query("tasks").withIndex("by_task_id", (q) => q.eq("task_id", id)).take(take)) holders.set(row.task_id, row);
      for (const row of await db.query("tasks").withIndex("by_source_record_id", (q) => q.eq("source_record_id", id)).take(take)) holders.set(row.task_id, row);
      if (holders.size === 0) {
        throw new Error(`Linked place "${id}" is not a known place. Give the site identifier, candidate identifier, task identifier, source record or osm:<type>/<id> reference of a place already in the portal.`);
      }
      if (holders.has(task.task_id)) {
        throw new Error(`Linked place "${id}" is this task's own record; a link must name another place.`);
      }
      const places = placesOf([...holders.values()], id);
      if (places.length > 1) {
        throw new Error(`Linked place "${id}" matches more than one place (${places.slice(0, 3).join(", ")}${places.length > 3 ? ", ..." : ""}); give the site identifier of the one meant.`);
      }
      canonical = places[0];
    }
    if (own.has(canonical)) {
      throw new Error(`Linked place "${id}" resolves to this task's own place (${canonical}); a link must name another place.`);
    }
    const earlier = resolvedFrom.get(canonical);
    if (earlier !== undefined) {
      throw new Error(`Linked places "${earlier}" and "${id}" name the same place (${canonical}); name it once.`);
    }
    resolvedFrom.set(canonical, id);
    resolved.push(canonical);
  }
  return resolved;
}
