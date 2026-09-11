import { sha256 } from "./sha256";

// the versioned hash contract for content-addressed review objects
// (docs/development/content-addressed-review.md, hash envelope). the
// canonical bytes follow rfc 8785 (json canonicalization scheme) over the
// i-json domain: members sorted by utf-16 code units, ecmascript number and
// string serialisation, no whitespace. values outside that domain are
// rejected rather than coerced, so a hash never silently covers a value the
// other language cannot reproduce. shared fixtures live in
// schemas/fixtures/pow-canonical-json.v1.json and are checked by both the
// typescript and the rust implementation.
export const HASH_CONTRACT = "pow-object.v1" as const;
export const CANONICAL_JSON_CONTRACT = "pow-canonical-json.v1" as const;
export const CANONICAL_JSON_SCHEME = "RFC 8785" as const;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

// utf-16 code unit comparison, as rfc 8785 section 3.2.3 requires; the
// default javascript string comparison has the same order but the intent is
// spelled out here so a reader need not know that
function compareUtf16(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function assertWellFormed(value: string, path: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) throw new TypeError(`Lone surrogate in string at ${path}.`);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError(`Lone surrogate in string at ${path}.`);
    }
  }
}

// canonical text for a value inside the contract's domain. numbers must be
// finite doubles, strings must be well-formed unicode, objects must be plain,
// and undefined is refused everywhere: an optional field is omitted by the
// caller (see withoutUndefined), never serialised as a placeholder
export function canonicalJsonStrict(value: unknown, path = "$"): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}.`);
      // ecmascript number-to-string (rfc 8785 section 3.2.2.3); -0 prints as 0
      return JSON.stringify(value);
    case "string":
      assertWellFormed(value, path);
      // ecmascript json string serialisation (rfc 8785 section 3.2.2.2)
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((item, index) => canonicalJsonStrict(item, `${path}[${index}]`)).join(",")}]`;
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`Non-plain object at ${path}.`);
      }
      const record = value as Record<string, unknown>;
      const members = Object.keys(record)
        .sort(compareUtf16)
        .map((key) => {
          assertWellFormed(key, `${path}.${key}`);
          return `${JSON.stringify(key)}:${canonicalJsonStrict(record[key], `${path}.${key}`)}`;
        });
      return `{${members.join(",")}}`;
    }
    default:
      throw new TypeError(`Unsupported value of type ${typeof value} at ${path}.`);
  }
}

// drops undefined members from plain objects at every depth so an optional
// field that was never set is absent from the canonical text. undefined
// inside an array is refused because position carries meaning there
export function withoutUndefined<T>(value: T, path = "$"): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item === undefined) throw new TypeError(`Undefined array element at ${path}[${index}].`);
      return withoutUndefined(item, `${path}[${index}]`);
    }) as T;
  }
  // the same domain rule as canonicalJsonStrict: a byte buffer, date, or
  // class instance must fail here rather than collapse to an empty object
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`Non-plain object at ${path}.`);
  }
  const record = value as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (record[key] !== undefined) cleaned[key] = withoutUndefined(record[key], `${path}.${key}`);
  }
  return cleaned as T;
}

// the object hash of the contract: sha256 over the utf-8 canonical bytes,
// written with the algorithm prefix so a later contract can change it
export function objectHash(value: unknown): string {
  return `sha256:${sha256(canonicalJsonStrict(value))}`;
}

export function isObjectHash(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}
