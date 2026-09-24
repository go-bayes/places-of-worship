// a read meter for export batch composition (lean-storage brief section
// 3.1): the batch budget is not only bundle bytes, because Convex bounds a
// transaction separately by bytes read, documents scanned, and index ranges
// read, and many small rows can exhaust the document or range counts below
// the byte target. The composer therefore runs the same reads prepareFreeze
// will run (the authority recheck and collectBundleRows) through a metered
// view of ctx.db and sums what they touched.
//
// The counts are estimates of Convex's own accounting, deliberately on the
// high side: every query read (collect, take, first, unique, paginate, or an
// async iteration) counts as one index range, and every db.get as one range
// and one document; documents are counted as returned (an index range
// without a filter scans what it returns); bytes are the utf-8 length of
// each returned document's JSON. Reads are charged document by document as
// they stream, so a limit stops a read within one document of it. Measured figures from a real backend are recorded in
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

// one budget a read is charged to: a task's own measurement, or a whole
// transaction's reads. `limit` is optional; without one the meter only counts
export type Meter = { name: string; counts: ReadCounts; limit?: ReadCounts };

export function newMeter(name: string, limit?: ReadCounts): Meter {
  return { name, counts: emptyReadCounts(), limit };
}

// thrown by a metered read as soon as a meter passes its limit, so measuring
// an oversized task stops within one document of the limit instead of
// materialising a whole index range first; `meter` names the budget broken
export class ReadBudgetExceeded extends Error {
  readonly meter: string;
  readonly dimension: keyof ReadCounts;
  readonly counts: ReadCounts;
  constructor(meter: string, dimension: keyof ReadCounts, counts: ReadCounts) {
    super(`${meter} read budget exceeded on ${dimension}`);
    this.meter = meter;
    this.dimension = dimension;
    this.counts = { ...counts };
  }
}

function documentBytes(doc: unknown): number {
  if (doc === null || doc === undefined) return 0;
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}

function charge(meters: readonly Meter[], delta: ReadCounts): void {
  for (const meter of meters) {
    meter.counts.bytes += delta.bytes;
    meter.counts.documents += delta.documents;
    meter.counts.index_ranges += delta.index_ranges;
  }
  for (const meter of meters) {
    if (meter.limit === undefined) continue;
    const dimension = exceededDimension(meter.counts, meter.limit);
    if (dimension !== null) throw new ReadBudgetExceeded(meter.name, dimension, meter.counts);
  }
}

function chargeRange(meters: readonly Meter[]): void {
  charge(meters, { bytes: 0, documents: 0, index_ranges: 1 });
}

function chargeDocument(meters: readonly Meter[], doc: unknown): void {
  if (doc === null || doc === undefined) return;
  charge(meters, { bytes: documentBytes(doc), documents: 1, index_ranges: 0 });
}

// streams a query one document at a time (Convex's own collect() fetches one
// document per syscall), charging each document as it arrives and stopping
// after `max` documents; a broken budget closes the underlying query
async function streamDocuments(target: any, meters: readonly Meter[], max: number): Promise<unknown[]> {
  chargeRange(meters);
  const out: unknown[] = [];
  if (max <= 0) return out;
  const iterator = target[Symbol.asyncIterator]();
  let finished = false;
  try {
    for (;;) {
      const step = await iterator.next();
      if (step.done) {
        finished = true;
        break;
      }
      chargeDocument(meters, step.value);
      out.push(step.value);
      if (out.length >= max) break;
    }
  } finally {
    if (!finished && typeof iterator.return === "function") await iterator.return();
  }
  return out;
}

// wraps a query builder so every chained call returns a wrapped builder and
// every read is charged per document; methods are applied to the real
// target so builders with private fields keep working
function meterQuery(builder: any, meters: readonly Meter[]): any {
  return new Proxy(builder, {
    get(target, property) {
      if (property === Symbol.asyncIterator) {
        return () => {
          const iterator = target[Symbol.asyncIterator]();
          let started = false;
          return {
            async next() {
              if (!started) {
                started = true;
                chargeRange(meters);
              }
              const step = await iterator.next();
              if (!step.done) chargeDocument(meters, step.value);
              return step;
            },
            async return(value?: unknown) {
              if (typeof iterator.return === "function") return await iterator.return(value);
              return { done: true, value };
            },
          };
        };
      }
      const value = target[property];
      if (typeof value !== "function") return value;
      switch (property) {
        case "collect":
          return () => streamDocuments(target, meters, Number.POSITIVE_INFINITY);
        case "take":
          return (count: number) => streamDocuments(target, meters, count);
        case "first":
          return async () => (await streamDocuments(target, meters, 1))[0] ?? null;
        case "unique":
          return async () => {
            const found = await streamDocuments(target, meters, 2);
            if (found.length > 1) throw new Error("unique() query returned more than one result.");
            return found[0] ?? null;
          };
        case "paginate":
          return async (options: unknown) => {
            chargeRange(meters);
            const result = await value.apply(target, [options]);
            for (const doc of result.page) chargeDocument(meters, doc);
            return result;
          };
        default:
          return (...args: unknown[]) => {
            const result = value.apply(target, args);
            if (result !== null && typeof result === "object" && typeof (result as { then?: unknown }).then !== "function") {
              return meterQuery(result, meters);
            }
            return result;
          };
      }
    },
  });
}

// a read-only ctx view whose db reads are charged to every meter given (a
// task's own and the transaction's, say); writes are refused, since metering
// must never stand in for a real mutation
export function meteredCtx(ctx: any, ...meters: Meter[]): any {
  const db = {
    query(table: string) {
      return meterQuery(ctx.db.query(table), meters);
    },
    async get(id: unknown) {
      chargeRange(meters);
      const doc = await ctx.db.get(id);
      chargeDocument(meters, doc);
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
