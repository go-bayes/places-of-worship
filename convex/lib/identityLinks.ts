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

// the forms a place identifier takes (jb, 2026-11-03: a well-formed
// identifier is accepted without a task behind it, so a typo is caught
// without a site table):
// - a map site id, the first letter of the osm type and the osm id, as
//   scripts/normalize_global_places.R and the nz pipeline build it: n123,
//   w123, r123
// - an osm reference, as vanuatu's site ids, internal-intake place refs and
//   the judgment subjects spell it: osm:node/123, osm:way/123,
//   osm:relation/123
// - a candidate id, "candidate:" and a task id or a country, batch and row,
//   as tasks.ts, rapidEntry.ts, batchImport.ts and the seed scripts mint it
export const OSM_REFERENCE = /^osm:(node|way|relation)\/([1-9][0-9]*)$/;
export const MAP_SITE_ID = /^([nwr])([1-9][0-9]*)$/;
export const CANDIDATE_SITE_ID = /^candidate:[A-Za-z0-9][A-Za-z0-9._:#/-]*$/;

const OSM_TYPE_BY_PREFIX: Record<string, string> = { n: "node", w: "way", r: "relation" };

export function isPlaceIdentifier(id: string): boolean {
  return MAP_SITE_ID.test(id) || OSM_REFERENCE.test(id) || CANDIDATE_SITE_ID.test(id);
}

// the osm object a map site id or an osm reference names: n123 and
// osm:node/123 name one object, so one place
function osmObjectOf(id: string): { type: string; number: string } | undefined {
  const site = MAP_SITE_ID.exec(id);
  if (site !== null) return { type: OSM_TYPE_BY_PREFIX[site[1]], number: site[2] };
  const ref = OSM_REFERENCE.exec(id);
  return ref === null ? undefined : { type: ref[1], number: ref[2] };
}

// the key under which two identifiers name the same place
export function placeKey(id: string): string {
  const osm = osmObjectOf(id);
  return osm === undefined ? id : `osm:${osm.type}/${osm.number}`;
}

// the identifiers that name the place this task is about, including the
// source record and the osm reference an internal-intake task may carry
// without either site id, and the other spelling of each osm object (n123
// for osm:node/123 and back), a pure mapping with no lookup: a link to any
// of them names the place itself, not another
export function ownIdentifiers(task: TaskIdentifiers): string[] {
  const osmRef = task.osm_object_type !== undefined && task.matched_osm_id !== undefined
    ? `osm:${task.osm_object_type}/${task.matched_osm_id}`
    : undefined;
  const ids = [task.task_id, task.matched_current_site_id, task.candidate_site_id, task.source_record_id, osmRef]
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const spellings = new Set(ids);
  for (const id of ids) {
    const osm = osmObjectOf(id);
    if (osm === undefined) continue;
    spellings.add(`osm:${osm.type}/${osm.number}`);
    spellings.add(`${osm.type[0]}${osm.number}`);
  }
  return [...spellings];
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

// resolution (jb, option b and its revision of 2026-11-03: "an academic
// site, not fort knox"). convex holds no master site table, and a global
// published list cannot practically be loaded into it, so a link resolves
// in two steps, in any country, because definition 0.1.6 permits a
// successor across a border:
// 1. through the tasks: a site id a task carries is stored as entered; a
//    record reference a task carries (a task id, a source record id, or an
//    osm object by either spelling) is stored as the site id of the place
//    behind it, so a stored link names a place, never a document;
// 2. otherwise by form: a well-formed place identifier (above) is stored as
//    entered, and anything else is refused as a likely typo.
// a well-formed identifier that no task carries may still be a mistyped
// number (n12354 for n12345), so it is held back once with a warning (jb,
// 2026-11-03): the decision is refused with the unmatched identifiers named,
// and the reviewer keeps them by recording the decision again with
// confirm_unmatched_links set. the flag is not stored and not hashed.

// the stable start of that refusal, which the portal recognises
export const UNMATCHED_LINK_PREFIX = "Unmatched linked place";

// tasks one record reference may name before the reviewer is asked for the
// site identifier instead: each lookup reads one more row than this, so a
// lookup that is cut short is refused rather than read as complete, and one
// decision (ten links, two site lookups and three record lookups of eleven
// rows) reads at most 350 tasks
export const MAX_RESOLUTION_MATCHES = 10;

// typed against the generated data model, so a renamed index or field
// fails the typecheck; the tests supply an in-memory table of the same shape
export type TaskReader = QueryCtx["db"];
const take = MAX_RESOLUTION_MATCHES + 1;

// the places a record reference resolves to: the site identifiers carried
// by the tasks that hold it, one per place; where none carries one, the
// reference itself if it is a place identifier, else each task's osm
// reference (an internal-intake task names its place that way) or task id
function placesOf(tasks: TaskIdentifiers[], input: string): string[] {
  const sites = new Map<string, string>();
  for (const task of tasks) {
    const site = (task.matched_current_site_id ?? task.candidate_site_id)?.trim();
    if (site !== undefined && site.length > 0 && !sites.has(placeKey(site))) sites.set(placeKey(site), site);
  }
  if (sites.size > 0) return [...sites.values()];
  if (isPlaceIdentifier(input)) return [input];
  const fallback = new Set<string>();
  for (const task of tasks) {
    const osmRef = task.osm_object_type !== undefined && task.matched_osm_id !== undefined
      ? `osm:${task.osm_object_type}/${task.matched_osm_id}`
      : undefined;
    fallback.add(osmRef ?? task.task_id);
  }
  return [...fallback];
}

// the refusal for links accepted by form alone, naming every one
export function unmatchedLinksMessage(ids: readonly string[]): string {
  const named = ids.map((id) => `"${id}"`).join(", ");
  return ids.length === 1
    ? `${UNMATCHED_LINK_PREFIX}: ${named} matches no place the review system knows. Check the identifier, or record the decision again to keep it.`
    : `${UNMATCHED_LINK_PREFIX}s: ${named} match no place the review system knows. Check the identifiers, or record the decision again to keep them.`;
}

// resolves each link that assertIdentityLinks has trimmed and checked to
// the identifier to store, and refuses, naming the identifier, a link that
// no task carries and that fits no place-identifier form, a reference that
// matches more than one place, a link to this task's own place, and two
// links that name the same place; after those checks, it refuses links
// accepted by form alone unless confirmUnmatched is true
export async function resolveIdentityLinks(
  db: TaskReader,
  task: TaskIdentifiers,
  links: readonly string[],
  confirmUnmatched = false,
): Promise<string[]> {
  const ownPlaces = new Set(ownIdentifiers(task).map(placeKey));
  const resolved: string[] = [];
  const resolvedFrom = new Map<string, string>();
  const unmatched: string[] = [];
  for (const id of links) {
    let canonical: string;
    // a site id a task carries stands as entered, whatever its form
    if ((await db.query("tasks").withIndex("by_matched_site", (q) => q.eq("matched_current_site_id", id)).take(1)).length > 0) {
      canonical = id;
    } else if ((await db.query("tasks").withIndex("by_candidate_site", (q) => q.eq("candidate_site_id", id)).take(1)).length > 0) {
      canonical = id;
    } else {
      const holders = new Map<string, TaskIdentifiers>();
      // a lookup that fills its read is cut short, and a later task could
      // name another place, so it is refused rather than read as complete
      const complete = <T>(rows: T[]): T[] => {
        if (rows.length > MAX_RESOLUTION_MATCHES) {
          throw new Error(`Linked place "${id}" is shared by more than ${MAX_RESOLUTION_MATCHES} tasks; give the site identifier of the place meant.`);
        }
        return rows;
      };
      const osm = osmObjectOf(id);
      if (osm !== undefined) {
        // the index narrows to one osm number; the type is checked here
        for (const row of complete(await db.query("tasks").withIndex("by_osm", (q) => q.eq("matched_osm_id", osm.number)).take(take))) {
          if (row.osm_object_type === osm.type) holders.set(row.task_id, row);
        }
      }
      for (const row of complete(await db.query("tasks").withIndex("by_task_id", (q) => q.eq("task_id", id)).take(take))) holders.set(row.task_id, row);
      for (const row of complete(await db.query("tasks").withIndex("by_source_record_id", (q) => q.eq("source_record_id", id)).take(take))) holders.set(row.task_id, row);
      if (holders.has(task.task_id)) {
        throw new Error(`Linked place "${id}" is this task's own record; a link must name another place.`);
      }
      if (holders.size > 0) {
        const places = placesOf([...holders.values()], id);
        if (places.length > 1) {
          throw new Error(`Linked place "${id}" matches more than one place (${places.slice(0, 3).join(", ")}${places.length > 3 ? ", ..." : ""}); give the site identifier of the one meant.`);
        }
        canonical = places[0];
      } else if (isPlaceIdentifier(id)) {
        canonical = id;
        unmatched.push(id);
      } else {
        throw new Error(`Linked place "${id}" is not a place identifier and no task carries it. Give a site identifier such as n123 or w456, an OpenStreetMap reference such as osm:node/123, a candidate identifier such as candidate:nz-candidate-1, or the task identifier or source record of a place in the portal.`);
      }
    }
    if (ownPlaces.has(placeKey(canonical))) {
      throw new Error(`Linked place "${id}" resolves to this task's own place (${canonical}); a link must name another place.`);
    }
    const earlier = resolvedFrom.get(placeKey(canonical));
    if (earlier !== undefined) {
      throw new Error(`Linked places "${earlier}" and "${id}" name the same place (${canonical}); name it once.`);
    }
    resolvedFrom.set(placeKey(canonical), id);
    resolved.push(canonical);
  }
  if (unmatched.length > 0 && !confirmUnmatched) throw new Error(unmatchedLinksMessage(unmatched));
  return resolved;
}
