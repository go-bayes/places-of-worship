// a read meter for export batch composition (lean-storage brief section
// 3.1): the batch budget is not only bundle bytes, because Convex bounds a
// transaction separately by bytes read, documents scanned, and index ranges
// read, and many small rows can exhaust the document or range counts below
// the byte target. The composer therefore runs the same reads prepareFreeze
// will run (the authority recheck and collectBundleRows) through a metered
// view of ctx.db and sums what they touched.
//
// The counts are estimates of Convex's own accounting, deliberately on the
// high side: every terminal query call (collect, take, first, unique) counts
// as one index range, and every db.get as one range and one document;
// documents are counted as returned (an index range without a filter scans
// what it returns); bytes are the utf-8 length of each returned document's
// JSON. Measured figures from a real backend are recorded in
// docs/development/frozen-exports.md.

export type ReadCounts = { bytes: number; documents: number; index_ranges: number };

export function emptyReadCounts(): ReadCounts {
  return { bytes: 0, documents: 0, index_ranges: 0 };
}

export function addReadCounts(a: ReadCounts, b: ReadCounts): ReadCounts {
  return {
    bytes: a.bytes + b.bytes,
    documents: a.documents + b.documents,
    index_ranges: a.index_ranges + b.index_ranges,
  };
}

// the first budget dimension `counts` exceeds, or null when all are within
export function exceededDimension(counts: ReadCounts, budget: ReadCounts): keyof ReadCounts | null {
  if (counts.bytes > budget.bytes) return "bytes";
  if (counts.documents > budget.documents) return "documents";
  if (counts.index_ranges > budget.index_ranges) return "index_ranges";
  return null;
}

// thrown by a metered read once `limit` is exceeded, so measuring one
// oversized task stops at the limit instead of reading on to the
// transaction caps
export class ReadBudgetExceeded extends Error {
  readonly dimension: keyof ReadCounts;
  readonly counts: ReadCounts;
  constructor(dimension: keyof ReadCounts, counts: ReadCounts) {
    super(`read budget exceeded on ${dimension}`);
    this.dimension = dimension;
    this.counts = { ...counts };
  }
}

const TERMINAL_METHODS = new Set(["collect", "take", "first", "unique"]);

function documentBytes(doc: unknown): number {
  if (doc === null || doc === undefined) return 0;
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}

function record(counts: ReadCounts, result: unknown, limit: ReadCounts | undefined): void {
  counts.index_ranges += 1;
  if (Array.isArray(result)) {
    counts.documents += result.length;
    for (const doc of result) counts.bytes += documentBytes(doc);
  } else if (result !== null && result !== undefined) {
    counts.documents += 1;
    counts.bytes += documentBytes(result);
  }
  if (limit !== undefined) {
    const dimension = exceededDimension(counts, limit);
    if (dimension !== null) throw new ReadBudgetExceeded(dimension, counts);
  }
}

// wraps a query builder so every chained call returns a wrapped builder and
// every terminal call is counted; methods are applied to the real target so
// builders with private fields keep working
function meterQuery(builder: any, counts: ReadCounts, limit: ReadCounts | undefined): any {
  return new Proxy(builder, {
    get(target, property) {
      const value = target[property];
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        if (typeof property === "string" && TERMINAL_METHODS.has(property)) {
          return Promise.resolve(result).then((resolved) => {
            record(counts, resolved, limit);
            return resolved;
          });
        }
        if (result !== null && typeof result === "object" && typeof (result as { then?: unknown }).then !== "function") {
          return meterQuery(result, counts, limit);
        }
        return result;
      };
    },
  });
}

// a read-only ctx view whose db reads are counted into `counts`; writes are
// refused, since metering must never stand in for a real mutation. With a
// `limit`, the read that takes the counts past it throws ReadBudgetExceeded
export function meteredCtx(ctx: any, counts: ReadCounts, limit?: ReadCounts): any {
  const db = {
    query(table: string) {
      return meterQuery(ctx.db.query(table), counts, limit);
    },
    async get(id: unknown) {
      const doc = await ctx.db.get(id);
      record(counts, doc, limit);
      return doc;
    },
    insert() {
      throw new Error("A metered read context cannot write.");
    },
    patch() {
      throw new Error("A metered read context cannot write.");
    },
    replace() {
      throw new Error("A metered read context cannot write.");
    },
    delete() {
      throw new Error("A metered read context cannot write.");
    },
    system: ctx.db.system,
    normalizeId: ctx.db.normalizeId?.bind(ctx.db),
  };
  return { ...ctx, db };
}
