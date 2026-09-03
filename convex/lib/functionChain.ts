// function_chain_v1 (pr-f, docs/development/function-chain-brief-2026-09-02.md,
// rulings r-f1 to r-f4): what a place of worship was, and how that changed.
// the ra records one label at the start and an ordered list of changes; a
// state ends when the next begins, so the chain is contiguous by
// construction. the chain compiles to ordered historical claims for the
// ledger and derives the denomination in force for each census year as a
// proposal; only a reviewer action writes it onto the parent draft.
import { partialDateLower, partialDateUpper } from "./historicalClaims.ts";
import { DEFAULT_DATE_FLOOR_YEAR } from "./countryYears.ts";
import { isValidPartialDate, SHORT_TEXT_MAX } from "./limits.ts";
import { canonicalJson, sha256 } from "./sha256.ts";
import { segmentBounds, USE_FREQUENCIES, type OccupancySegmentInput, type UseFrequency } from "./occupancies.ts";

export const FUNCTION_CHAIN_CONTRACT = "function_chain_v1";
export const FUNCTION_DERIVATION_VERSION = "function_derivation_v1";
export const MAX_CHAIN_CHANGES = 20;
const MIN_OTHER_NOTE = 12;
const MIN_LABEL = 2;

export type ChainChange =
  | "denomination_changed"
  | "shared_use_began"
  | "shared_use_ended"
  | "building_rebuilt"
  | "use_became_intermittent"
  | "desacralised"
  | "worship_resumed"
  | "other";

// eight changes: the seven of ruling r-f3 and worship_resumed (ruling r-f5,
// jb 2026-09-03, option 2): a deconsecrated building that returns to
// worship under another or the same denomination stays one chain
export const CHAIN_CHANGES: readonly ChainChange[] = [
  "denomination_changed", "shared_use_began", "shared_use_ended", "building_rebuilt",
  "use_became_intermittent", "desacralised", "worship_resumed", "other",
];

// the changes that end one function state and begin the next; a
// resumption begins a state after the gap a desacralisation left
const STATE_CHANGES = new Set<ChainChange>(["denomination_changed", "shared_use_began", "shared_use_ended", "desacralised", "worship_resumed"]);

export type ChainDateInput = {
  mode: "known" | "between" | "by";
  date?: string;
  not_earlier_than?: string;
  not_later_than?: string;
};

export type ChainChangeInput = {
  change: ChainChange;
  date: ChainDateInput;
  label?: string;
  note?: string;
  use_frequency?: UseFrequency;
};

export type FunctionChainInput = {
  contract_version: "function_chain_v1";
  start: {
    label: string;
    label_basis?: "named_documentary_source" | "displayed_sign_or_notice" | "current_self_description" | "local_investigator_account" | "unknown";
    date: ChainDateInput;
  };
  changes: ChainChangeInput[];
};

export type DateBounds = { lower?: string; upper?: string };

function t(value: string | undefined): string {
  return (value ?? "").trim();
}

// iso day bounds of a chain date; a by-date has no lower bound
export function chainDateBounds(date: ChainDateInput): DateBounds {
  switch (date.mode) {
    case "known":
      return { lower: partialDateLower(t(date.date)), upper: partialDateUpper(t(date.date)) };
    case "between":
      return { lower: partialDateLower(t(date.not_earlier_than)), upper: partialDateUpper(t(date.not_later_than)) };
    case "by":
      return { upper: partialDateUpper(t(date.not_later_than)) };
    default:
      return {};
  }
}

// the date as the source gives it, for the claim ledger
export function chainDateText(date: ChainDateInput): string {
  switch (date.mode) {
    case "known":
      return t(date.date);
    case "between":
      return `${t(date.not_earlier_than)}–${t(date.not_later_than)}`;
    case "by":
      return `by ${t(date.not_later_than)}`;
    default:
      return "";
  }
}

function assertChainDate(label: string, date: ChainDateInput, referenceDate: string, floorYear: number): void {
  const check = (name: string, value: string | undefined) => {
    const text = t(value);
    if (!isValidPartialDate(text) || Number(text.slice(0, 4)) < floorYear) {
      throw new Error(`${label}: ${name} must be a real date as YYYY, YYYY-MM, or YYYY-MM-DD from ${floorYear} onward.`);
    }
    if (partialDateLower(text) > partialDateUpper(referenceDate)) {
      throw new Error(`${label}: ${name} cannot be later than the evidence reference date (${referenceDate}).`);
    }
  };
  switch (date.mode) {
    case "known":
      check("the date", date.date);
      break;
    case "between":
      check("the earliest date", date.not_earlier_than);
      check("the latest date", date.not_later_than);
      if (partialDateLower(t(date.not_earlier_than)) > partialDateUpper(t(date.not_later_than))) {
        throw new Error(`${label}: the earliest date must not be after the latest date.`);
      }
      break;
    case "by":
      check("the latest date", date.not_later_than);
      break;
    default:
      throw new Error(`${label}: choose how the date is known (known, between, or by).`);
  }
}

// a desacralisation closes a period, and a period's end has no latest-only
// mode; the same wording refuses it on the client
export const DESACRALISED_BY_DATE_MESSAGE = "A desacralisation needs its date, or the earliest and latest dates it could have been; a latest date alone cannot close the period.";
// a resumption only makes sense after the chain records the desacralisation
// it follows; the same wording refuses it on the client
export const RESUMED_NEEDS_DESACRALISATION_MESSAGE = "Worship can resume only after a recorded desacralisation; add the desacralisation first.";

export const CHAIN_CHANGE_TEXT: Record<ChainChange, string> = {
  denomination_changed: "denomination changed",
  shared_use_began: "shared use began",
  shared_use_ended: "shared use ended",
  building_rebuilt: "building rebuilt",
  use_became_intermittent: "use became intermittent",
  desacralised: "desacralised",
  worship_resumed: "worship resumed",
  other: "other change",
};

// validates the chain on its own terms: labels where a change needs one, a
// note for "other", a frequency for intermittent use, dates in order, and
// a desacralisation that nothing but intermittent use or a note follows
export function assertFunctionChain(
  chain: FunctionChainInput,
  referenceDate: string,
  floorYear: number = DEFAULT_DATE_FLOOR_YEAR,
): void {
  if (chain.contract_version !== FUNCTION_CHAIN_CONTRACT) {
    throw new Error("Unsupported function chain contract version.");
  }
  const startLabel = t(chain.start.label);
  if (startLabel.length < MIN_LABEL) {
    throw new Error("Name the tradition or denomination at the start, as the source gives it.");
  }
  if (startLabel.length > SHORT_TEXT_MAX) {
    throw new Error(`The starting label must be ${SHORT_TEXT_MAX} characters or fewer.`);
  }
  assertChainDate("The start of the chain", chain.start.date, referenceDate, floorYear);
  if (!Array.isArray(chain.changes)) {
    throw new Error("The chain's changes must be a list.");
  }
  if (chain.changes.length > MAX_CHAIN_CHANGES) {
    throw new Error(`A chain carries at most ${MAX_CHAIN_CHANGES} changes.`);
  }
  let previousLower = chainDateBounds(chain.start.date).lower ?? "";
  let sharedInForce = false;
  let desacralisedAt = -1;
  chain.changes.forEach((change, index) => {
    const label = `Change ${index + 1}`;
    if (!CHAIN_CHANGES.includes(change.change)) {
      throw new Error(`${label}: choose a listed change.`);
    }
    assertChainDate(label, change.date, referenceDate, floorYear);
    const bounds = chainDateBounds(change.date);
    const ordering = bounds.lower ?? bounds.upper ?? "";
    if (ordering < previousLower) {
      throw new Error(`${label} is dated before the change that precedes it; the chain runs in date order.`);
    }
    previousLower = bounds.lower ?? previousLower;
    const changeLabel = t(change.label);
    if (change.change === "denomination_changed" || change.change === "shared_use_began" || change.change === "worship_resumed") {
      if (changeLabel.length < MIN_LABEL) {
        const what = change.change === "shared_use_began" ? "group that shared the place" : change.change === "worship_resumed" ? "denomination that resumed worship" : "new denomination";
        throw new Error(`${label}: name the ${what}, as the source gives it.`);
      }
    }
    if (changeLabel.length > SHORT_TEXT_MAX) {
      throw new Error(`${label}: the label must be ${SHORT_TEXT_MAX} characters or fewer.`);
    }
    if (change.change === "shared_use_began") {
      if (sharedInForce) throw new Error(`${label}: shared use is already in force; record that it ended before it begins again.`);
      sharedInForce = true;
    }
    if (change.change === "shared_use_ended") {
      if (!sharedInForce) throw new Error(`${label}: no shared use is in force to end.`);
      sharedInForce = false;
    }
    if (change.change === "other" && t(change.note).length < MIN_OTHER_NOTE) {
      throw new Error(`${label}: say what the other change was (at least ${MIN_OTHER_NOTE} characters).`);
    }
    if (t(change.note).length > 2_000) {
      throw new Error(`${label}: the note must be 2000 characters or fewer.`);
    }
    if (change.change === "use_became_intermittent") {
      if (change.use_frequency === undefined || !USE_FREQUENCIES.includes(change.use_frequency)) {
        throw new Error(`${label}: say how often the place was used after the change (annual, occasional, or uncertain).`);
      }
    } else if (change.use_frequency !== undefined) {
      throw new Error(`${label}: only "use became intermittent" carries a frequency.`);
    }
    if (change.change === "worship_resumed") {
      if (desacralisedAt < 0) throw new Error(`${label}: ${RESUMED_NEEDS_DESACRALISATION_MESSAGE}`);
      // the chain is open again: ordinary changes may follow
      desacralisedAt = -1;
      sharedInForce = false;
    } else if (desacralisedAt >= 0 && STATE_CHANGES.has(change.change)) {
      throw new Error(`${label}: after a desacralisation only worship resuming, intermittent use, a rebuild, or a note can follow.`);
    }
    if (change.change === "desacralised") {
      if (desacralisedAt >= 0) throw new Error(`${label}: the chain already records a desacralisation.`);
      if (change.date.mode === "by") throw new Error(DESACRALISED_BY_DATE_MESSAGE);
      desacralisedAt = index;
    }
  });
}

// the chain's stated effects on the periods must be present in the
// periods: a desacralisation closes the enclosing period with that reason,
// and intermittent use begins a period at that date with that frequency
export function assertChainAgreesWithPeriods(chain: FunctionChainInput, segments: OccupancySegmentInput[]): void {
  const overlaps = (a: DateBounds, b: { lower?: string; upper?: string }) =>
    (a.lower === undefined || b.upper === undefined || a.lower <= b.upper)
    && (a.upper === undefined || b.lower === undefined || b.lower <= a.upper);
  for (const change of chain.changes) {
    const at = chainDateBounds(change.date);
    if (change.change === "desacralised") {
      const closing = segments.some((s) => {
        const b = segmentBounds(s);
        return s.end_reason === "desacralised" && overlaps(at, { lower: b.endLower, upper: b.endUpper });
      });
      if (!closing) {
        throw new Error("The desacralisation in the chain needs the period it closes: end that period at the same date with the reason desacralised.");
      }
    }
    if (change.change === "use_became_intermittent") {
      const begun = segments.some((s) => {
        const b = segmentBounds(s);
        return s.use_frequency === change.use_frequency && overlaps(at, { lower: b.startLower, upper: b.startUpper });
      });
      if (!begun) {
        throw new Error("Intermittent use in the chain needs its period: begin a period at that date with the same frequency.");
      }
    }
    // a resumption opens a period whose start is the stated reopening (pr-e rule 2b)
    if (change.change === "worship_resumed") {
      const reopened = segments.some((s) => {
        const b = segmentBounds(s);
        return s.start_basis === "reopening_stated" && overlaps(at, { lower: b.startLower, upper: b.startUpper });
      });
      if (!reopened) {
        throw new Error("Worship resumed in the chain needs its period: begin a period at that date with the basis reopening stated.");
      }
    }
  }
}

export type FunctionState = {
  index: number;
  label: string;
  shared_with?: string;
  began_by: "start" | ChainChange;
  from: ChainDateInput;
  to?: ChainDateInput;
  ended_by?: ChainChange;
};

export type ChainEvent = {
  index: number;
  change: ChainChange;
  date: ChainDateInput;
  label?: string;
  note?: string;
  use_frequency?: UseFrequency;
};

// the label the derivation names for a state
export function stateLabel(state: Pick<FunctionState, "label" | "shared_with">): string {
  return state.shared_with ? `${state.label}, shared with ${state.shared_with}` : state.label;
}

// splits the chain into contiguous states and the events that do not
// change the state (a rebuild, intermittent use, a note)
export function compileChain(chain: FunctionChainInput): { states: FunctionState[]; events: ChainEvent[] } {
  const states: FunctionState[] = [{ index: 0, label: t(chain.start.label), began_by: "start", from: chain.start.date }];
  const events: ChainEvent[] = [];
  chain.changes.forEach((change, index) => {
    const current = states[states.length - 1];
    if (!STATE_CHANGES.has(change.change)) {
      events.push({ index: index + 1, change: change.change, date: change.date, label: t(change.label) || undefined, note: t(change.note) || undefined, use_frequency: change.use_frequency });
      return;
    }
    if (change.change === "worship_resumed") {
      // the previous state ended at the desacralisation; the resumed state
      // begins after the gap
      states.push({ index: states.length, label: t(change.label), began_by: change.change, from: change.date });
      return;
    }
    current.to = change.date;
    current.ended_by = change.change;
    if (change.change === "desacralised") {
      events.push({ index: index + 1, change: change.change, date: change.date, note: t(change.note) || undefined });
      return;
    }
    const next: FunctionState = {
      index: states.length,
      label: change.change === "denomination_changed" ? t(change.label) : current.label,
      began_by: change.change,
      from: change.date,
    };
    if (change.change === "shared_use_began") next.shared_with = t(change.label);
    states.push(next);
  });
  return { states, events };
}

export type FunctionRuleId = "inside_state" | "within_change_window" | "within_start_window";
export type DerivedFunction = {
  target_year: number;
  derived_status: "stated" | "uncertain";
  label?: string;
  candidate_labels: string[];
  rule_id: FunctionRuleId;
};

// the denomination in force for each census year: inside one state's
// certain core → that label; inside a change window between two states
// (or the start window of the first) → uncertain with the candidates
// named; before the first state or after a desacralisation → no row
export function deriveFunctions(chain: FunctionChainInput, targetYears: readonly number[]): DerivedFunction[] {
  const { states } = compileChain(chain);
  const out: DerivedFunction[] = [];
  for (const year of targetYears) {
    const yStart = `${year}-01-01`;
    const yEnd = `${year}-12-31`;
    let row: DerivedFunction | null = null;
    for (let i = 0; i < states.length && row === null; i += 1) {
      const state = states[i];
      const from = chainDateBounds(state.from);
      const to = state.to ? chainDateBounds(state.to) : undefined;
      const afterStart = from.upper !== undefined && from.upper <= yStart;
      const beforeEnd = to === undefined || (to.lower !== undefined && yEnd <= to.lower);
      if (afterStart && beforeEnd) {
        row = { target_year: year, derived_status: "stated", label: stateLabel(state), candidate_labels: [stateLabel(state)], rule_id: "inside_state" };
        break;
      }
      // the start window of the first state, or of a state that resumed
      // worship after a gap: the year may precede the label
      if ((i === 0 || state.began_by === "worship_resumed") && from.upper !== undefined && yStart < from.upper && (from.lower === undefined || yEnd >= from.lower)) {
        row = { target_year: year, derived_status: "uncertain", candidate_labels: [stateLabel(state)], rule_id: "within_start_window" };
        break;
      }
      // the change window that ends this state; a by-dated change has no
      // earliest bound, so its window runs from the state's certain start
      const windowLower = to === undefined ? undefined : (to.lower ?? from.upper);
      if (to !== undefined && to.upper !== undefined && windowLower !== undefined && yEnd >= windowLower && yStart <= to.upper && afterStart) {
        const next = states[i + 1];
        const candidates = next ? [stateLabel(state), stateLabel(next)] : [stateLabel(state)];
        row = { target_year: year, derived_status: "uncertain", candidate_labels: candidates, rule_id: "within_change_window" };
        break;
      }
    }
    if (row !== null) out.push(row);
  }
  return out;
}

// hash over the fields the derivation consumes, so an edit resets the
// derived rows to unconfirmed
export function functionChainInputsHash(chain: FunctionChainInput): string {
  return sha256(canonicalJson({
    version: FUNCTION_DERIVATION_VERSION,
    start: { label: t(chain.start.label), date: chain.start.date },
    changes: chain.changes.map((c) => ({ change: c.change, date: c.date, label: t(c.label) || null })),
  }));
}

export const FUNCTION_RULE_TEXT: Record<FunctionRuleId, string> = {
  inside_state: "the year falls inside one recorded function state",
  within_change_window: "the year falls inside the window of a change, so both labels are candidates",
  within_start_window: "the year falls inside the start window of the first recorded state, or of the state that resumed worship after a gap",
};
