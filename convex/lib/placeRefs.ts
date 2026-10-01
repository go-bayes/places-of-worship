import type { Doc } from "../_generated/dataModel";

// the place a task is about, as the refs a judgment or first-pass record
// could name: the matched osm object and the source record id
export function taskPlaceRefs(task: Doc<"tasks">): Set<string> {
  const refs = new Set<string>();
  if (task.osm_object_type !== undefined && task.matched_osm_id !== undefined) refs.add(`osm:${task.osm_object_type}/${task.matched_osm_id}`);
  if (task.source_record_id !== undefined) refs.add(task.source_record_id);
  return refs;
}
