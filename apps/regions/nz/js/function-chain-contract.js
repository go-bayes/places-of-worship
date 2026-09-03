// function_chain_v1 client mirror of convex/lib/functionChain.ts (pr-f):
// what the place was and how that changed, as one starting label and an
// ordered list of changes. the server remains the authority; this mirror
// lets the form refuse a bad chain before the round trip and preview the
// denomination the server will propose for each census year.
// convex/lib/functionChainMirror.node-test.mjs holds the two equal.
(function () {
    const CONTRACT_VERSION = "function_chain_v1";
    const MAX_CHANGES = 20;
    const MIN_OTHER_NOTE = 12;
    const MIN_LABEL = 2;
    const MAX_LABEL = 256;
    function floorYear() {
        const value = Number(window.POW_DATE_FLOOR_YEAR);
        return Number.isInteger(value) && value > 0 ? value : 1600;
    }

    const CHANGES = ["denomination_changed", "shared_use_began", "shared_use_ended", "building_rebuilt", "use_became_intermittent", "desacralised", "other"];
    const STATE_CHANGES = new Set(["denomination_changed", "shared_use_began", "shared_use_ended", "desacralised"]);
    const USE_FREQUENCIES = ["regular", "monthly", "several_times_a_year", "annual", "occasional", "uncertain"];

    // mirrors CHAIN_CHANGE_TEXT in convex/lib/functionChain.ts
    const CHANGE_WORDS = {
        denomination_changed: "denomination changed",
        shared_use_began: "shared use began",
        shared_use_ended: "shared use ended",
        building_rebuilt: "building rebuilt",
        use_became_intermittent: "use became intermittent",
        desacralised: "desacralised",
        other: "other change",
    };

    // mirrors FUNCTION_RULE_TEXT in convex/lib/functionChain.ts, in the
    // preview's shorter register
    const FUNCTION_RULE_WORDS = {
        inside_state: "inside the recorded state",
        within_change_window: "inside a change window",
        within_start_window: "inside the start window",
    };

    const text = value => String(value === undefined || value === null ? "" : value).trim();

    function isValidPartialDate(value) {
        if (!value) return false;
        const floor = floorYear();
        if (/^\d{4}$/.test(value)) return Number(value) >= floor;
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return Number(value.slice(0, 4)) >= floor;
        const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
        if (!match || Number(match[1]) < floor) return false;
        const parsed = new Date(`${value}T00:00:00Z`);
        return parsed.getUTCFullYear() === Number(match[1])
            && parsed.getUTCMonth() + 1 === Number(match[2])
            && parsed.getUTCDate() === Number(match[3]);
    }
    function partialDateLower(value) {
        if (/^\d{4}$/.test(value)) return `${value}-01-01`;
        if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
        return value;
    }
    function partialDateUpper(value) {
        if (/^\d{4}$/.test(value)) return `${value}-12-31`;
        if (/^\d{4}-\d{2}$/.test(value)) {
            const [year, month] = value.split("-").map(Number);
            const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
            return `${value}-${String(day).padStart(2, "0")}`;
        }
        return value;
    }

    // a blank chain date as the form holds it; "around" on a four-digit
    // known year compiles to a between with one year's slack, as periods do
    function blankDate(overrides) {
        return { dateMode: "known", date: "", notEarlierThan: "", notLaterThan: "", around: false, ...(overrides || {}) };
    }

    function blankChain(overrides) {
        return {
            start: { label: "", labelBasis: "", ...blankDate() },
            changes: [],
            ...(overrides || {}),
        };
    }

    function blankChange(change, overrides) {
        return { change: change || "denomination_changed", label: "", note: "", frequency: "", ...blankDate(), ...(overrides || {}) };
    }

    // one canonical view of a chain date: around compiled, unused fields dropped
    function normaliseDate(values) {
        const v = values || {};
        const out = { dateMode: text(v.dateMode) || "known", date: text(v.date), notEarlierThan: text(v.notEarlierThan), notLaterThan: text(v.notLaterThan), aroundYear: "" };
        if (out.dateMode === "known" && v.around === true && /^\d{4}$/.test(out.date)) {
            const y = Number(out.date);
            out.aroundYear = out.date;
            out.dateMode = "between";
            out.notEarlierThan = String(y - 1);
            out.notLaterThan = String(y + 1);
            out.date = "";
        }
        if (out.dateMode !== "known") out.date = "";
        if (out.dateMode !== "between") out.notEarlierThan = "";
        if (out.dateMode !== "between" && out.dateMode !== "by") out.notLaterThan = "";
        return out;
    }

    function datePayload(values) {
        const d = normaliseDate(values);
        return {
            mode: d.dateMode,
            ...(d.date ? { date: d.date } : {}),
            ...(d.notEarlierThan ? { not_earlier_than: d.notEarlierThan } : {}),
            ...(d.notLaterThan ? { not_later_than: d.notLaterThan } : {}),
        };
    }

    // iso day bounds, exactly as the server's chainDateBounds
    function dateBounds(payloadDate) {
        const d = payloadDate || {};
        switch (d.mode) {
            case "known":
                return { lower: partialDateLower(text(d.date)), upper: partialDateUpper(text(d.date)) };
            case "between":
                return { lower: partialDateLower(text(d.not_earlier_than)), upper: partialDateUpper(text(d.not_later_than)) };
            case "by":
                return { upper: partialDateUpper(text(d.not_later_than)) };
            default:
                return {};
        }
    }

    function dateText(payloadDate) {
        const d = payloadDate || {};
        if (d.mode === "known") return text(d.date);
        if (d.mode === "between") return `${text(d.not_earlier_than)}–${text(d.not_later_than)}`;
        if (d.mode === "by") return `by ${text(d.not_later_than)}`;
        return "";
    }

    // the exact server payload of a chain
    function payload(chain) {
        const c = chain || blankChain();
        const start = {
            label: text(c.start.label),
            ...(text(c.start.labelBasis) ? { label_basis: text(c.start.labelBasis) } : {}),
            date: datePayload(c.start),
        };
        const changes = (c.changes || []).map(change => ({
            change: text(change.change),
            date: datePayload(change),
            ...(text(change.label) ? { label: text(change.label) } : {}),
            ...(text(change.note) ? { note: text(change.note) } : {}),
            ...(change.change === "use_became_intermittent" && text(change.frequency) ? { use_frequency: text(change.frequency) } : {}),
        }));
        return { contract_version: CONTRACT_VERSION, start, changes };
    }

    // whether the ra typed anything into the chain beyond the blank
    function chainTouched(chain) {
        if (!chain) return false;
        return Boolean(text(chain.start.label) || text(chain.start.date) || text(chain.start.notEarlierThan) || text(chain.start.notLaterThan) || (chain.changes || []).length);
    }

    function dateError(label, payloadDate, referenceDate) {
        const d = payloadDate;
        const check = (name, value) => {
            if (!isValidPartialDate(text(value))) return `${label}: ${name} must be YYYY, YYYY-MM, or YYYY-MM-DD from ${floorYear()} onward.`;
            if (referenceDate && partialDateLower(text(value)) > partialDateUpper(referenceDate)) return `${label}: ${name} cannot be later than ${referenceDate}.`;
            return "";
        };
        if (d.mode === "known") return check("the date", d.date);
        if (d.mode === "between") {
            const error = check("the earliest date", d.not_earlier_than) || check("the latest date", d.not_later_than);
            if (error) return error;
            if (partialDateLower(text(d.not_earlier_than)) > partialDateUpper(text(d.not_later_than))) return `${label}: the earliest date must not be after the latest date.`;
            return "";
        }
        if (d.mode === "by") return check("the latest date", d.not_later_than);
        return `${label}: choose how the date is known.`;
    }

    // mirrors assertFunctionChain; returns the first problem or ""
    function validateChain(chain, referenceDate) {
        const p = payload(chain);
        if (p.start.label.length < MIN_LABEL) return "Name the tradition or denomination at the start, as the source gives it.";
        if (p.start.label.length > MAX_LABEL) return `The starting label must be ${MAX_LABEL} characters or fewer.`;
        let error = dateError("The start of the chain", p.start.date, referenceDate);
        if (error) return error;
        if (p.changes.length > MAX_CHANGES) return `A chain carries at most ${MAX_CHANGES} changes.`;
        let previousLower = dateBounds(p.start.date).lower || "";
        let sharedInForce = false;
        let desacralised = false;
        for (let i = 0; i < p.changes.length; i += 1) {
            const change = p.changes[i];
            const label = `Change ${i + 1}`;
            if (!CHANGES.includes(change.change)) return `${label}: choose a listed change.`;
            error = dateError(label, change.date, referenceDate);
            if (error) return error;
            const bounds = dateBounds(change.date);
            const ordering = bounds.lower || bounds.upper || "";
            if (ordering < previousLower) return `${label} is dated before the change that precedes it; the chain runs in date order.`;
            previousLower = bounds.lower || previousLower;
            const changeLabel = text(change.label);
            if ((change.change === "denomination_changed" || change.change === "shared_use_began") && changeLabel.length < MIN_LABEL) {
                return `${label}: name the ${change.change === "shared_use_began" ? "group that shared the place" : "new denomination"}, as the source gives it.`;
            }
            if (changeLabel.length > MAX_LABEL) return `${label}: the label must be ${MAX_LABEL} characters or fewer.`;
            if (change.change === "shared_use_began") {
                if (sharedInForce) return `${label}: shared use is already in force; record that it ended before it begins again.`;
                sharedInForce = true;
            }
            if (change.change === "shared_use_ended") {
                if (!sharedInForce) return `${label}: no shared use is in force to end.`;
                sharedInForce = false;
            }
            if (change.change === "other" && text(change.note).length < MIN_OTHER_NOTE) return `${label}: say what the other change was (at least ${MIN_OTHER_NOTE} characters).`;
            if (change.change === "use_became_intermittent" && !USE_FREQUENCIES.includes(change.use_frequency || "")) {
                return `${label}: say how often the place was used after the change (annual, occasional, or uncertain).`;
            }
            if (desacralised && STATE_CHANGES.has(change.change)) return `${label}: after a desacralisation only intermittent use, a rebuild, or a note can follow.`;
            if (change.change === "desacralised") {
                if (desacralised) return `${label}: the chain already records a desacralisation.`;
                desacralised = true;
            }
        }
        return "";
    }

    function stateLabel(state) {
        return state.shared_with ? `${state.label}, shared with ${state.shared_with}` : state.label;
    }

    // mirrors compileChain: contiguous states and the events between them
    function compileChain(chain) {
        const p = payload(chain);
        const states = [{ index: 0, label: p.start.label, began_by: "start", from: p.start.date }];
        const events = [];
        p.changes.forEach((change, index) => {
            const current = states[states.length - 1];
            if (!STATE_CHANGES.has(change.change)) {
                events.push({ index: index + 1, change: change.change, date: change.date, label: change.label, note: change.note, use_frequency: change.use_frequency });
                return;
            }
            current.to = change.date;
            current.ended_by = change.change;
            if (change.change === "desacralised") {
                events.push({ index: index + 1, change: change.change, date: change.date, note: change.note });
                return;
            }
            const next = { index: states.length, label: change.change === "denomination_changed" ? change.label : current.label, began_by: change.change, from: change.date };
            if (change.change === "shared_use_began") next.shared_with = change.label;
            states.push(next);
        });
        return { states, events };
    }

    // mirrors deriveFunctions verbatim
    function deriveFunctions(chain, targetYears) {
        const { states } = compileChain(chain);
        const out = [];
        for (const year of targetYears || []) {
            const yStart = `${year}-01-01`;
            const yEnd = `${year}-12-31`;
            let row = null;
            for (let i = 0; i < states.length && row === null; i += 1) {
                const state = states[i];
                const from = dateBounds(state.from);
                const to = state.to ? dateBounds(state.to) : undefined;
                const afterStart = from.upper !== undefined && from.upper <= yStart;
                const beforeEnd = to === undefined || (to.lower !== undefined && yEnd <= to.lower);
                if (afterStart && beforeEnd) {
                    row = { target_year: Number(year), derived_status: "stated", label: stateLabel(state), candidate_labels: [stateLabel(state)], rule_id: "inside_state" };
                    break;
                }
                if (i === 0 && from.upper !== undefined && yStart < from.upper && (from.lower === undefined || yEnd >= from.lower)) {
                    row = { target_year: Number(year), derived_status: "uncertain", candidate_labels: [stateLabel(state)], rule_id: "within_start_window" };
                    break;
                }
                if (to !== undefined && to.lower !== undefined && to.upper !== undefined && yEnd >= to.lower && yStart <= to.upper && afterStart) {
                    const next = states[i + 1];
                    const candidates = next ? [stateLabel(state), stateLabel(next)] : [stateLabel(state)];
                    row = { target_year: Number(year), derived_status: "uncertain", candidate_labels: candidates, rule_id: "within_change_window" };
                    break;
                }
            }
            if (row !== null) out.push(row);
        }
        return out;
    }

    // "Denomination: 2013 Presbyterian (inside the recorded state); 2018 not
    // assessed; 2023 uncertain — Presbyterian or Anglican (inside a change window)."
    function describeFunctions(derived, targetYears) {
        const byYear = new Map((derived || []).map(d => [String(d.target_year), d]));
        const parts = [];
        for (const year of targetYears || []) {
            const d = byYear.get(String(year));
            if (!d) {
                parts.push(`${year} not assessed`);
                continue;
            }
            if (d.derived_status === "stated") parts.push(`${year} ${d.label} (${FUNCTION_RULE_WORDS[d.rule_id] || d.rule_id})`);
            else parts.push(`${year} uncertain — ${d.candidate_labels.join(" or ")} (${FUNCTION_RULE_WORDS[d.rule_id] || d.rule_id})`);
        }
        return parts.length ? `Denomination: ${parts.join("; ")}.` : "";
    }

    // a sentence per state and event for the card's restatement
    function describeChain(chain) {
        const { states, events } = compileChain(chain);
        const lines = states.map(state => `${stateLabel(state) || "(no label yet)"} from ${dateText(state.from) || "?"}${state.to ? ` until ${dateText(state.to)} (${CHANGE_WORDS[state.ended_by] || state.ended_by})` : ""}`);
        events.forEach(event => {
            if (event.change === "use_became_intermittent") lines.push(`use became intermittent (${event.use_frequency || "?"}) ${dateText(event.date)}`);
            else if (event.change === "desacralised") lines.push(`desacralised ${dateText(event.date)}`);
            else if (event.change === "building_rebuilt") lines.push(`building rebuilt ${dateText(event.date)}`);
            else lines.push(`${event.note || "other change"} (${dateText(event.date)})`);
        });
        return lines;
    }

    // the chain's effect on the period cards (brief section 2.2 and 2.3):
    // a desacralisation closes the enclosing period (the open period of
    // regular use, or the one already closed by it) with that reason;
    // intermittent use opens a new period at that date, same place, with
    // the frequency, ending the open period before it. idempotent: a change
    // already written to the cards is left alone. returns the patched
    // segments (a new array) and the words of what was done
    function applyToPeriods(chain, segments, referenceDate) {
        const cards = (segments || []).map(seg => ({ ...seg }));
        const notes = [];
        const p = payload(chain);
        const inUse = seg => !seg.useFrequency || ["regular", "monthly", "several_times_a_year"].includes(seg.useFrequency);
        const endAt = (seg, d, reason) => {
            if (d.dateMode === "known") { seg.endMode = "known"; seg.endDate = d.date; seg.endNotEarlierThan = ""; seg.endNotLaterThan = ""; }
            else if (d.dateMode === "between") { seg.endMode = "between"; seg.endDate = ""; seg.endNotEarlierThan = d.notEarlierThan; seg.endNotLaterThan = d.notLaterThan; }
            else { seg.endMode = "between"; seg.endDate = ""; seg.endNotEarlierThan = d.notLaterThan; seg.endNotLaterThan = d.notLaterThan; }
            seg.endAround = false;
            seg.stillActiveAsof = "";
            seg.endBasis = "closure_stated";
            seg.endReason = reason;
        };
        const endsAt = (seg, d) => (d.dateMode === "known" ? seg.endMode === "known" && seg.endDate === d.date : seg.endMode === "between" && seg.endNotLaterThan === d.notLaterThan);
        const startsAt = (seg, d) => (d.dateMode === "known" ? seg.startMode === "known" && seg.startDate === d.date : seg.startNotLaterThan === d.notLaterThan);
        (chain.changes || []).forEach((change, index) => {
            const d = normaliseDate(change);
            if (change.change === "desacralised" && cards.length) {
                const target = [...cards].reverse().find(seg => seg.endReason === "desacralised" || (seg.endMode === "still_active" && inUse(seg)));
                if (!target) return;
                if (target.endReason === "desacralised" && endsAt(target, d)) return;
                endAt(target, d, "desacralised");
                notes.push(`Period ${cards.indexOf(target) + 1} now ends ${dateText(p.changes[index].date)}, desacralised.`);
            }
            if (change.change === "use_became_intermittent" && cards.length && text(change.frequency)) {
                if (cards.some(seg => seg.useFrequency === change.frequency && startsAt(seg, d))) return;
                const seg = cards[cards.length - 1];
                const wasActive = seg.endMode === "still_active";
                const asof = seg.stillActiveAsof || referenceDate || "";
                if (wasActive) endAt(seg, d, "use_changed");
                const openAfter = wasActive || seg.endReason === "desacralised";
                cards.push({
                    ...seg,
                    startMode: d.dateMode === "known" ? "known" : d.dateMode === "between" ? "between" : "by",
                    startDate: d.dateMode === "known" ? d.date : "",
                    startNotEarlierThan: d.dateMode === "between" ? d.notEarlierThan : "",
                    startNotLaterThan: d.dateMode !== "known" ? d.notLaterThan : "",
                    startAround: false,
                    startBasis: "first_seen_only",
                    endMode: openAfter ? "still_active" : "unknown",
                    endDate: "",
                    endNotEarlierThan: "",
                    endNotLaterThan: "",
                    endAround: false,
                    endBasis: "",
                    endReason: "",
                    stillActiveAsof: openAfter ? asof : "",
                    useFrequency: change.frequency,
                });
                notes.push(`Period ${cards.length} added from ${dateText(p.changes[index].date)} at ${change.frequency.replaceAll("_", " ")} use, same place.`);
            }
        });
        return { segments: cards, notes };
    }

    // the inverse of payload for a stored chain: the form shape again
    function dateFromPayload(d) {
        const p = d || {};
        return { dateMode: p.mode || "known", date: text(p.date), notEarlierThan: text(p.not_earlier_than), notLaterThan: text(p.not_later_than), around: false };
    }
    function chainFromPayload(stored) {
        const c = stored || {};
        return {
            start: { label: text(c.start?.label), labelBasis: text(c.start?.label_basis), ...dateFromPayload(c.start?.date) },
            changes: (c.changes || []).map(change => ({
                change: text(change.change),
                label: text(change.label),
                note: text(change.note),
                frequency: text(change.use_frequency),
                ...dateFromPayload(change.date),
            })),
        };
    }

    window.PowFunctionChain = Object.freeze({
        chainFromPayload,
        CONTRACT_VERSION,
        CHANGES,
        CHANGE_WORDS,
        FUNCTION_RULE_WORDS,
        USE_FREQUENCIES,
        applyToPeriods,
        blankChain,
        blankChange,
        chainTouched,
        compileChain,
        dateBounds,
        dateText,
        deriveFunctions,
        describeChain,
        describeFunctions,
        normaliseDate,
        payload,
        stateLabel,
        validateChain,
    });
})();
