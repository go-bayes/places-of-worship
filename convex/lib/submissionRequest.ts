import type { GenericValidator } from "convex/values";
import { canonicalJsonStrict, objectHash, withoutUndefined } from "./canonicalJson";
import type { receiptOperation } from "./submissionReceiptModel";

export const REQUEST_CONTRACT = "submission-request.v1";

// decode the declared projection once; the digest and writer share this object
// extension JSON keeps its strings, including whitespace and empty strings
export function normaliseInput<T>(validator: GenericValidator, input: T, path = "request"): T {
  const spec = validator as GenericValidator & {
    fields?: Record<string, GenericValidator>;
    members?: GenericValidator[];
    element?: GenericValidator;
    key?: GenericValidator;
    value?: unknown;
  };
  if (input === undefined && spec.isOptional === "optional") return input;
  if (spec.kind === "union") {
    for (const member of spec.members ?? []) {
      try {
        return normaliseInput(member, input, path);
      } catch {
        /* try the next validated alternative */
      }
    }
    throw new Error(`${path} has an invalid value.`);
  }
  if (spec.kind === "object") {
    if (input === null || typeof input !== "object" || Array.isArray(input))
      throw new Error(`${path} must be an object.`);
    const record = input as Record<string, unknown>;
    const fields = spec.fields ?? {};
    for (const key of Object.keys(record))
      if (!Object.hasOwn(fields, key)) throw new Error(`Unknown field ${path}.${key}.`);
    const entries: [string, unknown][] = [];
    for (const [key, field] of Object.entries(fields)) {
      // audit context is validated by the first-write gates and never compared
      const value =
        key === "clientContext" || key === "validation_summary" || key === "pending_occupancy_cards"
          ? record[key]
          : normaliseInput(field, record[key], `${path}.${key}`);
      if (value !== undefined) entries.push([key, value]);
    }
    return Object.fromEntries(entries) as T;
  }
  if (spec.kind === "record") {
    if (input === null || typeof input !== "object" || Array.isArray(input))
      throw new Error(`${path} must be a record.`);
    const entries = Object.entries(input).map(
      ([key, value]) =>
        [
          normaliseInput(spec.key!, key, `${path}.key`),
          normaliseInput(spec.value as GenericValidator, value, `${path}.${key}`),
        ] as const,
    );
    if (new Set(entries.map(([key]) => key)).size !== entries.length)
      throw new Error(`${path} has duplicate normalised keys.`);
    return Object.fromEntries(entries) as T;
  }
  if (spec.kind === "array") {
    if (!Array.isArray(input) || input.length > 256)
      throw new Error(`${path} exceeds the array bound or is invalid.`);
    return input.map((value, index) =>
      normaliseInput(spec.element!, value, `${path}[${index}]`),
    ) as T;
  }
  if (spec.kind === "string") {
    if (typeof input !== "string") throw new Error(`${path} must be text.`);
    const text = input.trim();
    if (!text && spec.isOptional === "optional") return undefined as T;
    if (!text) throw new Error(`${path} requires text.`);
    return text as T;
  }
  if (spec.kind === "literal") {
    if (input !== spec.value) throw new Error(`${path} has an invalid value.`);
    return input;
  }
  if (spec.kind === "float64" && (typeof input !== "number" || !Number.isFinite(input)))
    throw new Error(`${path} must be a finite number.`);
  if (spec.kind === "boolean" && typeof input !== "boolean")
    throw new Error(`${path} must be a boolean.`);
  if (spec.kind === "any") canonicalJsonStrict(input);
  return input;
}

export function assertRequestBounds(input: unknown): void {
  let nodes = 0;
  function visit(value: unknown, depth: number): void {
    if (++nodes > 16_384 || depth > 24) throw new Error("Submission exceeds the decoding bound.");
    if (typeof value === "string" && value.length > 24_000)
      throw new Error("Submission text exceeds the decoding bound.");
    if (value && typeof value === "object")
      for (const child of Object.values(value)) visit(child, depth + 1);
  }
  visit(input, 0);
  if (canonicalJsonStrict(withoutUndefined(input)).length > 192_000)
    throw new Error("Submission exceeds the payload bound.");
}

export function requestContent(input: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(input).filter(
    ([key]) =>
      ![
        "clientSubmissionId",
        "clientContext",
        "validation_summary",
        "pending_occupancy_cards",
      ].includes(key),
  );
  return withoutUndefined(
    Object.fromEntries(
      entries.map(([key, value]) => [
        key,
        key === "draft" && value && typeof value === "object"
          ? requestContent(value as Record<string, unknown>)
          : value,
      ]),
    ),
  );
}

// retain this normaliser when later contracts are introduced; receipt versions
// select the implementation rather than silently adopting a new projection
export function requestDigest(
  contract: string,
  operation: typeof receiptOperation.type,
  input: Record<string, unknown>,
): string {
  if (contract !== REQUEST_CONTRACT)
    throw new Error(`Unsupported submission request contract ${contract}.`);
  return objectHash({ contract, operation, content: requestContent(input) });
}

export function defaultLocation(latitude: number, longitude: number) {
  return {
    contract_version: "location_assertion_v1" as const,
    mode: "building_identified" as const,
    basis: "map_placement" as const,
    latitude,
    longitude,
    confidence: "high" as const,
    contributor_confirmed: true,
  };
}

export function normaliseCandidate<
  T extends {
    name: string;
    latitude: number;
    longitude: number;
    locationAssertion?: ReturnType<typeof defaultLocation> | unknown;
    probableSameAs?: { task_id: string; name?: string; distance_m?: number }[];
  },
>(candidate: T): T {
  const links = (candidate.probableSameAs ?? [])
    .map(({ task_id }) => ({ task_id: task_id.trim() }))
    .sort((a, b) => (a.task_id < b.task_id ? -1 : a.task_id > b.task_id ? 1 : 0));
  if (links.length > 5 || new Set(links.map((link) => link.task_id)).size !== links.length)
    throw new Error("The linked-place list has duplicates or exceeds five links.");
  return {
    ...candidate,
    name: candidate.name.trim() || "Unknown place of worship",
    locationAssertion:
      candidate.locationAssertion ?? defaultLocation(candidate.latitude, candidate.longitude),
    probableSameAs: links,
  };
}

// incompatible date members must fail before projection, including on retries
export function assertDateShape(input: unknown): void {
  if (!input || typeof input !== "object") return;
  if (Array.isArray(input)) {
    input.forEach(assertDateShape);
    return;
  }
  const row = input as Record<string, unknown>;
  function allowed(mode: unknown, fields: string[], choices: Record<string, string[]>): void {
    if (typeof mode !== "string") return;
    for (const field of fields)
      if (row[field] !== undefined && !(choices[mode] ?? []).includes(field))
        throw new Error(`${field} is incompatible with date mode ${mode}.`);
  }
  allowed(row.start_mode, ["start_date", "start_not_earlier_than", "start_not_later_than"], {
    known: ["start_date"],
    between: ["start_not_earlier_than", "start_not_later_than"],
    by: ["start_not_later_than"],
    unknown: [],
  });
  allowed(
    row.end_mode,
    ["end_date", "end_not_earlier_than", "end_not_later_than", "still_active_asof"],
    {
      known: ["end_date"],
      between: ["end_not_earlier_than", "end_not_later_than"],
      after: ["end_not_earlier_than"],
      still_active: ["still_active_asof"],
      unknown: [],
    },
  );
  allowed(row.mode, ["date", "not_earlier_than", "not_later_than"], {
    known: ["date"],
    between: ["not_earlier_than", "not_later_than"],
    by: ["not_later_than"],
  });
  for (const [key, value] of Object.entries(row))
    if (
      ![
        "clientContext",
        "generated_wide_row",
        "validation_summary",
        "pending_occupancy_cards",
      ].includes(key)
    )
      assertDateShape(value);
}

export function normaliseSegments<T extends { segment_index: number }>(segments: T[]): T[] {
  if (
    segments.length > 20 ||
    new Set(segments.map((segment) => segment.segment_index)).size !== segments.length
  )
    throw new Error("Periods require unique segment indices and at most 20 segments.");
  return [...segments].sort((a, b) => a.segment_index - b.segment_index);
}
