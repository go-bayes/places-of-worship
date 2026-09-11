import { HASH_CONTRACT, canonicalJsonStrict, isObjectHash, objectHash, withoutUndefined } from "./canonicalJson";
import type { JsonValue } from "./canonicalJson";

// evidence-version.v1: the immutable record of what a contributor (or a
// review-side writer) submitted for one evidence record. the builder here is
// pure so the same inputs give the same envelope in tests, in the server
// helper, and in the golden fixtures; the rust command `pow object verify`
// checks the same envelope shape and set-like ordering rules.
export const EVIDENCE_VERSION_SCHEMA = "evidence-version.v1" as const;
export const EVIDENCE_VERSION_OBJECT_TYPE = "evidence_version" as const;

export type EvidenceVersionKind =
  | "submitted"
  | "unresolved_note"
  | "guided_submission"
  | "rapid_current_observation"
  | "spreadsheet_import"
  | "occupancy_import"
  | "agent_intake"
  | "occupancy_set_recorded"
  | "superseded_by_later_set"
  | "reviewer_edit"
  | "reviewer_derivation_decision"
  | "migration_copy";

// evidence_drafts fields that are locators, storage metadata, mutable
// coordination state, or import and idempotency bookkeeping. every other
// field on the row is submitted content and enters the payload
export const EVIDENCE_ROW_EXCLUDED_FIELDS: ReadonlySet<string> = new Set([
  "_id",
  "_creationTime",
  "evidence_draft_id",
  "task_id",
  "draft_status",
  "created_by",
  "created_at",
  "updated_at",
  "guided_submission_key",
  "intake_submission_key",
  "import_batch_id",
  "source_claim_key",
  "claim_hash",
  "agent_intake_hash",
  "evidence_version_hash",
  "evidence_family_id",
  "revision_of_evidence_draft_id",
  "revision_intent",
  // cards typed before submission become occupancy rows; the server
  // validation summary describes checks, not evidence
  "pending_occupancy_cards",
  "validation_summary",
]);

// site_occupancies fields outside the observation itself
export const OCCUPANCY_ROW_EXCLUDED_FIELDS: ReadonlySet<string> = new Set([
  "_id",
  "_creationTime",
  "task_id",
  "parent_evidence_draft_id",
  "claim_status",
  "submission_key",
  "created_by",
  "created_at",
  "updated_at",
]);

export function evidenceContentFromRow(row: Record<string, unknown>): Record<string, JsonValue> {
  const content: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (!EVIDENCE_ROW_EXCLUDED_FIELDS.has(key)) content[key] = row[key];
  }
  return withoutUndefined(content) as Record<string, JsonValue>;
}

export function occupancyContentFromRow(row: Record<string, unknown>): Record<string, JsonValue> {
  const content: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (!OCCUPANCY_ROW_EXCLUDED_FIELDS.has(key)) content[key] = row[key];
  }
  return withoutUndefined(content) as Record<string, JsonValue>;
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

// the set-like ordering rule for the occupancy set: by segment index, then
// by the stable occupancy identifier. the rust verifier enforces the same rule
export function sortOccupancyContent<T extends { segment_index: unknown; occupancy_id: unknown }>(rows: T[]): T[] {
  for (const row of rows) {
    if (typeof row.segment_index !== "number" || !Number.isFinite(row.segment_index) || typeof row.occupancy_id !== "string") {
      throw new TypeError("Every occupancy needs a numeric segment_index and a string occupancy_id.");
    }
  }
  return [...rows].sort((left, right) => {
    const bySegment = Number(left.segment_index) - Number(right.segment_index);
    if (bySegment !== 0) return bySegment;
    return compareUtf16(String(left.occupancy_id), String(right.occupancy_id));
  });
}

export type EvidenceVersionLineage =
  | { relation: "first" }
  | { relation: "child"; parent_object_hash: string }
  // a correction of a submission recorded before the contract: the
  // locator is kept and no historical hash is invented
  | { relation: "revises_pre_contract"; revises_evidence_draft_id: string }
  // a new dated observation that follows an earlier family
  | { relation: "follows"; follows_evidence_draft_id: string; follows_object_hash?: string };

export type EvidenceVersionMigration = {
  run_id: string;
  copied_at: string;
  source_created_by: string;
  source_created_at: string;
  source_updated_at: string;
};

export type EvidenceVersionInput = {
  task_id: string;
  evidence_draft_id: string;
  evidence_family_id: string;
  version_index: number;
  version_kind: EvidenceVersionKind;
  lineage: EvidenceVersionLineage;
  actor_user_id: string;
  recorded_at_ms: number;
  evidence_row: Record<string, unknown>;
  occupancy_rows: Record<string, unknown>[];
  migration?: EvidenceVersionMigration;
};

export type EvidenceVersionEnvelope = {
  hash_contract: typeof HASH_CONTRACT;
  object_type: typeof EVIDENCE_VERSION_OBJECT_TYPE;
  schema_version: typeof EVIDENCE_VERSION_SCHEMA;
  logical_id: string;
  parent_object_hashes: string[];
  created_by: string;
  recorded_at: string;
  payload: Record<string, JsonValue>;
  object_hash?: string;
};

export type BuiltEvidenceVersion = {
  envelope: EvidenceVersionEnvelope & { object_hash: string };
  object_hash: string;
  // identity of the submitted content alone: the evidence fields and the
  // period set, without version position, kind, actor, time, or lineage.
  // an unchanged resubmission has the same content hash
  content_hash: string;
  envelope_json: string;
};

export function contentHash(evidence: Record<string, JsonValue>, occupancies: Record<string, JsonValue>[]): string {
  return objectHash({ evidence, occupancies });
}

export function evidenceLogicalId(taskId: string, familyId: string): string {
  return `evidence:${taskId}:${familyId}`;
}

export function actorId(userId: string): string {
  return `actor:${userId}`;
}

export function recordedAtIso(ms: number): string {
  if (!Number.isFinite(ms)) throw new TypeError("recorded_at must be a finite time.");
  return new Date(ms).toISOString();
}

export function buildEvidenceVersion(input: EvidenceVersionInput): BuiltEvidenceVersion {
  if (!Number.isInteger(input.version_index) || input.version_index < 1) {
    throw new TypeError("version_index must be a positive integer.");
  }
  const occupancies = sortOccupancyContent(
    input.occupancy_rows.map((row) => occupancyContentFromRow(row) as Record<string, JsonValue> & { segment_index: unknown; occupancy_id: unknown }),
  );
  const seen = new Set<string>();
  for (const row of occupancies) {
    const id = String(row.occupancy_id);
    if (seen.has(id)) throw new Error(`Duplicate occupancy_id ${id} in the version payload.`);
    seen.add(id);
  }
  const lineage = input.lineage;
  const evidence = evidenceContentFromRow(input.evidence_row);
  const payload = withoutUndefined({
    task_id: input.task_id,
    evidence_draft_id: input.evidence_draft_id,
    version_kind: input.version_kind,
    version_index: input.version_index,
    evidence,
    occupancies,
    revises_evidence_draft_id: lineage.relation === "revises_pre_contract" ? lineage.revises_evidence_draft_id : undefined,
    parent_version_unavailable: lineage.relation === "revises_pre_contract" ? "pre_contract" : undefined,
    follows_evidence_draft_id: lineage.relation === "follows" ? lineage.follows_evidence_draft_id : undefined,
    follows_object_hash: lineage.relation === "follows" ? lineage.follows_object_hash : undefined,
    migration: input.migration,
  }) as Record<string, JsonValue>;
  const parentHashes = lineage.relation === "child" ? [lineage.parent_object_hash] : [];
  for (const hash of parentHashes) {
    if (!isObjectHash(hash)) throw new TypeError(`Parent hash ${hash} is not a pow-object.v1 hash.`);
  }
  const envelope: EvidenceVersionEnvelope = {
    hash_contract: HASH_CONTRACT,
    object_type: EVIDENCE_VERSION_OBJECT_TYPE,
    schema_version: EVIDENCE_VERSION_SCHEMA,
    logical_id: evidenceLogicalId(input.task_id, input.evidence_family_id),
    parent_object_hashes: [...parentHashes].sort(compareUtf16),
    created_by: actorId(input.actor_user_id),
    recorded_at: recordedAtIso(input.recorded_at_ms),
    payload,
  };
  const hash = objectHash(envelope);
  const stamped = { ...envelope, object_hash: hash };
  return {
    envelope: stamped,
    object_hash: hash,
    content_hash: contentHash(evidence, occupancies),
    envelope_json: canonicalJsonStrict(stamped),
  };
}

const RFC3339_MS_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// the same checks as `pow object verify`: a stored envelope reproduces its
// hash and obeys the contract's set-like ordering rules. returns every
// failure rather than the first so an audit reads the whole picture
export function verifyEvidenceVersionEnvelope(value: unknown): { valid: boolean; object_hash?: string; errors: string[] } {
  const errors: string[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["envelope must be an object"] };
  }
  const envelope = value as Record<string, unknown>;
  if (envelope.hash_contract !== HASH_CONTRACT) errors.push(`hash_contract must be ${HASH_CONTRACT}`);
  if (envelope.object_type !== EVIDENCE_VERSION_OBJECT_TYPE) errors.push(`object_type must be ${EVIDENCE_VERSION_OBJECT_TYPE}`);
  if (envelope.schema_version !== EVIDENCE_VERSION_SCHEMA) errors.push(`schema_version must be ${EVIDENCE_VERSION_SCHEMA}`);
  if (typeof envelope.logical_id !== "string" || !envelope.logical_id.startsWith("evidence:")) errors.push("logical_id must be an evidence: identifier");
  if (typeof envelope.created_by !== "string" || !envelope.created_by.startsWith("actor:")) errors.push("created_by must be an actor: identifier");
  if (
    typeof envelope.recorded_at !== "string"
    || !RFC3339_MS_UTC.test(envelope.recorded_at)
    || Number.isNaN(Date.parse(envelope.recorded_at))
    || new Date(envelope.recorded_at).toISOString() !== envelope.recorded_at
  ) errors.push("recorded_at must be an rfc 3339 utc time with milliseconds");
  const parents = envelope.parent_object_hashes;
  if (!Array.isArray(parents)) {
    errors.push("parent_object_hashes must be an array");
  } else {
    for (let index = 0; index < parents.length; index += 1) {
      if (!isObjectHash(parents[index])) errors.push(`parent_object_hashes[${index}] is not a pow-object.v1 hash`);
      if (index > 0 && compareUtf16(String(parents[index - 1]), String(parents[index])) >= 0) errors.push("parent_object_hashes must be sorted without duplicates");
    }
  }
  const payload = envelope.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    errors.push("payload must be an object");
  } else {
    const occupancies = (payload as Record<string, unknown>).occupancies;
    if (occupancies !== undefined) {
      if (!Array.isArray(occupancies)) {
        errors.push("payload.occupancies must be an array");
      } else {
        const ids = new Set<string>();
        for (let index = 0; index < occupancies.length; index += 1) {
          const row = occupancies[index] as Record<string, unknown> | null;
          if (row === null || typeof row !== "object" || Array.isArray(row)) {
            errors.push(`payload.occupancies[${index}] must be an object`);
            continue;
          }
          if (typeof row.segment_index !== "number" || !Number.isFinite(row.segment_index)) {
            errors.push(`payload.occupancies[${index}] requires a numeric segment_index`);
            continue;
          }
          if (typeof row.occupancy_id !== "string") {
            errors.push(`payload.occupancies[${index}] requires a string occupancy_id`);
            continue;
          }
          const id = row.occupancy_id;
          if (ids.has(id)) errors.push(`payload.occupancies has duplicate occupancy_id ${id}`);
          ids.add(id);
          if (index > 0) {
            const previous = occupancies[index - 1] as Record<string, unknown>;
            const bySegment = Number(previous.segment_index) - Number(row.segment_index);
            if (bySegment > 0 || (bySegment === 0 && compareUtf16(String(previous.occupancy_id), id) >= 0)) {
              errors.push("payload.occupancies must be sorted by segment_index then occupancy_id");
            }
          }
        }
      }
    }
  }
  if (!isObjectHash(envelope.object_hash)) {
    errors.push("object_hash must be a pow-object.v1 hash");
  } else {
    const { object_hash: _stored, ...unhashed } = envelope;
    let recomputed: string | undefined;
    try {
      recomputed = objectHash(unhashed);
    } catch (error) {
      errors.push(`envelope is outside the canonical domain: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (recomputed !== undefined && recomputed !== envelope.object_hash) {
      errors.push(`object_hash ${envelope.object_hash} does not match recomputed ${recomputed}`);
    }
  }
  return { valid: errors.length === 0, object_hash: typeof envelope.object_hash === "string" ? envelope.object_hash : undefined, errors };
}
