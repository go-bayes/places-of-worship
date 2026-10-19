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
};

// the identifiers that name the place this task is about: a link to any of
// them names the place itself, not another
export function ownIdentifiers(task: TaskIdentifiers): string[] {
  return [task.task_id, task.matched_current_site_id, task.candidate_site_id]
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
