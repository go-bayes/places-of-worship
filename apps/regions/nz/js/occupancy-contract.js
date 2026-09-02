// occupancy_v1 client mirror of convex/lib/occupancies.ts (assertOccupancySegment
// and assertOccupancySet): one period of a place of worship's history at one
// location, with uncertainty at both ends. the server remains the authority;
// this mirror lets the entry pane refuse a bad card before the round trip.
// contract per docs/development/occupancy-build-brief-2026-09-02.md.
(function () {
    const CONTRACT_VERSION = "occupancy_v1";
    // F1: the floor is per country (date-floor.js); 1600 when the page sets none
    function floorYear() {
        const value = Number(window.POW_DATE_FLOOR_YEAR);
        return Number.isInteger(value) && value > 0 ? value : 1600;
    }
    const MAX_TEXT = 2000;
    const MAX_SEGMENTS = 20;
    const MIN_UNCERTAINTY_NOTE = 12;
    const MIN_SOURCE_ACCOUNT = 12;

    const START_MODES = new Set(["known", "between", "by", "unknown"]);
    const END_MODES = new Set(["still_active", "known", "between", "after", "unknown"]);
    const START_BASES = new Set(["founding_stated", "reopening_stated", "organisation_founded", "building_dedication", "first_seen_only", "unknown"]);
    const END_BASES = new Set(["closure_stated", "last_seen_only", "unknown"]);
    const END_REASONS = new Set(["closed", "relocated", "demolished", "use_changed", "unknown"]);
    const CONFIDENCE = new Set(["high", "moderate", "low", "uncertain"]);
    const SOURCE_BASES = new Set(["inscription_or_document_observed", "local_investigator_account", "named_public_source", "other"]);
    const PRIVACY_FLAGS = new Set(["clear", "needs_review", "restricted"]);

    const START_BASIS_WORDS = {
        founding_stated: "founding stated",
        reopening_stated: "reopening stated",
        organisation_founded: "organisation founded",
        building_dedication: "building dedicated",
        first_seen_only: "first seen only",
    };
    const END_BASIS_WORDS = {
        closure_stated: "closure stated",
        last_seen_only: "last seen only",
    };
    const END_REASON_WORDS = {
        closed: "closed",
        relocated: "relocated",
        demolished: "demolished",
        use_changed: "use changed",
        unknown: "reason unknown",
    };

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

    const text = value => String(value === undefined || value === null ? "" : value).trim();

    // the "around Y" affordance: a year with one year's slack either side
    function expandAround(year) {
        const y = Number(year);
        return { not_earlier_than: String(y - 1), not_later_than: String(y + 1) };
    }

    // one canonical, trimmed view of a card. "around" on a known four-digit
    // year compiles to a between with the expanded bounds; the original year
    // is kept for describeBounds only
    function normalise(values) {
        const v = values || {};
        const out = {
            segmentIndex: Number.isInteger(v.segmentIndex) ? v.segmentIndex : 0,
            startMode: text(v.startMode),
            startDate: text(v.startDate),
            startNotEarlierThan: text(v.startNotEarlierThan),
            startNotLaterThan: text(v.startNotLaterThan),
            startBasis: text(v.startBasis),
            startAroundYear: "",
            endMode: text(v.endMode),
            endDate: text(v.endDate),
            endNotEarlierThan: text(v.endNotEarlierThan),
            endNotLaterThan: text(v.endNotLaterThan),
            endBasis: text(v.endBasis),
            endReason: text(v.endReason),
            endAroundYear: "",
            stillActiveAsof: text(v.stillActiveAsof),
            successorSiteId: text(v.successorSiteId),
            sameAsPin: v.sameAsPin !== false,
            location: v.location && typeof v.location === "object" ? v.location : null,
            confidence: text(v.confidence),
            confidenceBasis: text(v.confidenceBasis),
            sourceBasis: text(v.sourceBasis),
            sourceTitle: text(v.sourceTitle),
            sourceReference: text(v.sourceReference),
            sourceAccount: text(v.sourceAccount),
            uncertaintyNote: text(v.uncertaintyNote),
            privacyFlag: text(v.privacyFlag),
        };
        if (out.startMode === "known" && v.startAround === true && /^\d{4}$/.test(out.startDate)) {
            const bounds = expandAround(out.startDate);
            out.startAroundYear = out.startDate;
            out.startMode = "between";
            out.startDate = "";
            out.startNotEarlierThan = bounds.not_earlier_than;
            out.startNotLaterThan = bounds.not_later_than;
        }
        if (out.endMode === "known" && v.endAround === true && /^\d{4}$/.test(out.endDate)) {
            const bounds = expandAround(out.endDate);
            out.endAroundYear = out.endDate;
            out.endMode = "between";
            out.endDate = "";
            out.endNotEarlierThan = bounds.not_earlier_than;
            out.endNotLaterThan = bounds.not_later_than;
        }
        // the start's date fields that the mode does not use are dropped, so
        // a stale value from an earlier mode never reaches the server
        if (out.startMode !== "known") out.startDate = "";
        if (out.startMode !== "between") out.startNotEarlierThan = "";
        if (out.startMode !== "between" && out.startMode !== "by") out.startNotLaterThan = "";
        if (out.startMode === "unknown") out.startBasis = "unknown";
        if (out.endMode !== "known") out.endDate = "";
        if (out.endMode !== "between" && out.endMode !== "after") out.endNotEarlierThan = "";
        if (out.endMode !== "between") out.endNotLaterThan = "";
        if (out.endMode !== "still_active") out.stillActiveAsof = "";
        if (out.endMode === "still_active" || out.endMode === "unknown") {
            out.endBasis = "unknown";
        }
        if (out.endMode === "still_active") out.endReason = "";
        return out;
    }

    // iso day bounds exactly as the server's segmentBounds
    function segmentBounds(values) {
        const s = normalise(values);
        const bounds = { open: false };
        if (s.startMode === "known" && s.startDate) {
            bounds.startLower = partialDateLower(s.startDate);
            bounds.startUpper = partialDateUpper(s.startDate);
        } else if (s.startMode === "between") {
            if (s.startNotEarlierThan) bounds.startLower = partialDateLower(s.startNotEarlierThan);
            if (s.startNotLaterThan) bounds.startUpper = partialDateUpper(s.startNotLaterThan);
        } else if (s.startMode === "by" && s.startNotLaterThan) {
            bounds.startUpper = partialDateUpper(s.startNotLaterThan);
        }
        if (s.endMode === "still_active" && s.stillActiveAsof) {
            bounds.open = true;
            bounds.asof = partialDateUpper(s.stillActiveAsof);
            bounds.endLower = bounds.asof;
        } else if (s.endMode === "known" && s.endDate) {
            bounds.endLower = partialDateLower(s.endDate);
            bounds.endUpper = partialDateUpper(s.endDate);
        } else if (s.endMode === "between") {
            if (s.endNotEarlierThan) bounds.endLower = partialDateLower(s.endNotEarlierThan);
            if (s.endNotLaterThan) bounds.endUpper = partialDateUpper(s.endNotLaterThan);
        } else if (s.endMode === "after" && s.endNotEarlierThan) {
            bounds.endLower = partialDateLower(s.endNotEarlierThan);
        }
        return bounds;
    }

    function dateError(label, value, referenceDate) {
        if (!isValidPartialDate(value)) {
            return `${label}: use YYYY, YYYY-MM, or YYYY-MM-DD from ${floorYear()} onward.`;
        }
        if (referenceDate && partialDateLower(value) > partialDateUpper(referenceDate)) {
            return `${label} cannot be later than ${referenceDate}.`;
        }
        return "";
    }

    function validateSegment(values, referenceDate) {
        const s = normalise(values);
        const reference = text(referenceDate);
        let error = "";
        // start
        if (!START_MODES.has(s.startMode)) return "Choose how the start is known.";
        if (s.startMode === "known") {
            error = dateError("The start date", s.startDate, reference);
            if (error) return error;
        } else if (s.startMode === "between") {
            error = dateError("The earliest possible start", s.startNotEarlierThan, reference)
                || dateError("The latest possible start", s.startNotLaterThan, reference);
            if (error) return error;
            if (partialDateLower(s.startNotEarlierThan) > partialDateUpper(s.startNotLaterThan)) {
                return "The earliest possible start must not be after the latest possible start.";
            }
        } else if (s.startMode === "by") {
            error = dateError("The latest possible start", s.startNotLaterThan, reference);
            if (error) return error;
        }
        if (s.startMode !== "unknown" && (!START_BASES.has(s.startBasis) || s.startBasis === "unknown")) {
            return "Say how the start is known: founding stated, reopening stated, organisation founded, building dedicated, or first seen only.";
        }
        // end
        if (!END_MODES.has(s.endMode)) return "Choose how the end is known.";
        if (s.endMode === "still_active") {
            error = dateError("The still-in-use date", s.stillActiveAsof, reference);
            if (error) return error;
        } else if (s.endMode === "known") {
            error = dateError("The end date", s.endDate, reference);
            if (error) return error;
        } else if (s.endMode === "between") {
            error = dateError("The earliest possible end", s.endNotEarlierThan, reference)
                || dateError("The latest possible end", s.endNotLaterThan, reference);
            if (error) return error;
            if (partialDateLower(s.endNotEarlierThan) > partialDateUpper(s.endNotLaterThan)) {
                return "The earliest possible end must not be after the latest possible end.";
            }
        } else if (s.endMode === "after") {
            error = dateError("The earliest possible end", s.endNotEarlierThan, reference);
            if (error) return error;
        }
        const endDated = s.endMode === "known" || s.endMode === "between" || s.endMode === "after";
        if (endDated && (!END_BASES.has(s.endBasis) || s.endBasis === "unknown")) {
            return "Say how the end is known: closure stated or last seen only.";
        }
        if (endDated && !END_REASONS.has(s.endReason)) {
            return "Say why the period ended: closed, relocated, demolished, use changed, or unknown.";
        }
        if (s.endMode === "unknown" && s.endReason && !END_REASONS.has(s.endReason)) {
            return "Choose a listed end reason.";
        }
        if (s.successorSiteId && s.endReason === "relocated") {
            return "A relocation keeps the same place of worship; a successor identifier is only for a split.";
        }
        // ordering within the period
        const b = segmentBounds(s);
        if (b.startLower !== undefined && b.endUpper !== undefined && b.startLower > b.endUpper) {
            return "The period cannot end before it begins.";
        }
        if (b.startUpper !== undefined && b.endLower !== undefined && b.startUpper > b.endLower && s.endMode !== "still_active"
            && b.startLower !== undefined && b.startLower > b.endLower) {
            return "The period cannot end before it begins.";
        }
        if (s.startMode === "unknown" && s.endMode === "unknown" && s.uncertaintyNote.length < MIN_UNCERTAINTY_NOTE) {
            return `A period with no dated start or end needs an uncertainty note of at least ${MIN_UNCERTAINTY_NOTE} characters.`;
        }
        // location
        if (!s.sameAsPin) {
            if (!s.location || !Number.isFinite(Number(s.location.latitude)) || !Number.isFinite(Number(s.location.longitude))) {
                return "Place this period on the map.";
            }
        }
        // provenance
        if (!CONFIDENCE.has(s.confidence)) return "Choose a confidence.";
        if (!s.confidenceBasis) return "Say what the confidence rests on.";
        if (!SOURCE_BASES.has(s.sourceBasis)) return "Choose the source basis.";
        if (!s.sourceTitle) return "Name the source.";
        if (s.sourceBasis === "named_public_source" && !s.sourceReference) {
            return "Add the public source URL, archive reference, or agreed file reference.";
        }
        if (s.sourceAccount.length < MIN_SOURCE_ACCOUNT) {
            return `Record what the source says about this period (at least ${MIN_SOURCE_ACCOUNT} characters).`;
        }
        if (!PRIVACY_FLAGS.has(s.privacyFlag)) return "Choose the sensitivity and privacy setting.";
        const longField = [
            ["source title", s.sourceTitle],
            ["source reference", s.sourceReference],
            ["source account", s.sourceAccount],
            ["confidence basis", s.confidenceBasis],
            ["uncertainty note", s.uncertaintyNote],
        ].find(([, value]) => value.length > MAX_TEXT);
        if (longField) return `The ${longField[0]} must be ${MAX_TEXT} characters or fewer.`;
        return "";
    }

    // the point a card resolves to; null when it sits on a task point the
    // client does not know, in which case the server settles the comparison
    function resolvePoint(values, taskPoint) {
        const s = normalise(values);
        if (!s.sameAsPin && s.location) {
            return { latitude: Number(s.location.latitude), longitude: Number(s.location.longitude) };
        }
        if (taskPoint && Number.isFinite(Number(taskPoint.latitude)) && Number.isFinite(Number(taskPoint.longitude))) {
            return { latitude: Number(taskPoint.latitude), longitude: Number(taskPoint.longitude) };
        }
        return null;
    }

    function samePoint(a, b) {
        if (a === null && b === null) return true;
        if (a === null || b === null) return false;
        return Math.abs(a.latitude - b.latitude) < 1e-7 && Math.abs(a.longitude - b.longitude) < 1e-7;
    }

    // whole-submission rules: contiguous indices in card order, still active
    // only last, one place at a time, relocation followed by a new place
    function validateSet(segments, referenceDate, taskPoint) {
        if (!Array.isArray(segments) || segments.length === 0) return "Record at least one period.";
        if (segments.length > MAX_SEGMENTS) return `A submission carries at most ${MAX_SEGMENTS} periods.`;
        const ordered = segments.map((values, index) => ({ ...normalise(values), segmentIndex: index }));
        for (let i = 0; i < ordered.length; i += 1) {
            const error = validateSegment(ordered[i], referenceDate);
            if (error) return `Period ${i + 1}: ${error}`;
        }
        for (let i = 0; i < ordered.length - 1; i += 1) {
            const here = segmentBounds(ordered[i]);
            const next = segmentBounds(ordered[i + 1]);
            if (ordered[i].endMode === "still_active") {
                return `Period ${i + 1}: a still-in-use period must be the last period.`;
            }
            if (here.endLower !== undefined && next.startUpper !== undefined && here.endLower > next.startUpper) {
                return `Periods ${i + 1} and ${i + 2} overlap: a place of worship occupies one place at a time.`;
            }
            if (ordered[i].endReason === "relocated"
                && samePoint(resolvePoint(ordered[i], taskPoint), resolvePoint(ordered[i + 1], taskPoint))) {
                return `Period ${i + 2}: a relocation must be followed by a period at a different place.`;
            }
        }
        if (ordered[ordered.length - 1].endReason === "relocated") {
            return `Period ${ordered.length}: a relocated period needs the following period at the new place.`;
        }
        return "";
    }

    // exactly one occupancySegmentInput; blanks omitted, text trimmed
    function payload(values) {
        const s = normalise(values);
        const endDated = s.endMode === "known" || s.endMode === "between" || s.endMode === "after";
        const out = {
            contract_version: CONTRACT_VERSION,
            segment_index: s.segmentIndex,
            start_mode: s.startMode,
            ...(s.startDate ? { start_date: s.startDate } : {}),
            ...(s.startNotEarlierThan ? { start_not_earlier_than: s.startNotEarlierThan } : {}),
            ...(s.startNotLaterThan ? { start_not_later_than: s.startNotLaterThan } : {}),
            start_basis: s.startMode === "unknown" ? "unknown" : s.startBasis,
            end_mode: s.endMode,
            ...(s.endDate ? { end_date: s.endDate } : {}),
            ...(s.endNotEarlierThan ? { end_not_earlier_than: s.endNotEarlierThan } : {}),
            ...(s.endNotLaterThan ? { end_not_later_than: s.endNotLaterThan } : {}),
            end_basis: endDated ? s.endBasis : "unknown",
            ...(s.endMode !== "still_active" && s.endReason ? { end_reason: s.endReason } : {}),
            ...(s.endMode === "still_active" && s.stillActiveAsof ? { still_active_asof: s.stillActiveAsof } : {}),
            ...(s.successorSiteId ? { successor_site_id: s.successorSiteId } : {}),
            location_relation: s.sameAsPin ? "same_as_task_point" : "distinct",
            ...(!s.sameAsPin && s.location ? { location: s.location } : {}),
            confidence: s.confidence,
            confidence_basis: s.confidenceBasis,
            source_basis: s.sourceBasis,
            source_title: s.sourceTitle,
            ...(s.sourceReference ? { source_reference: s.sourceReference } : {}),
            source_account: s.sourceAccount,
            ...(s.uncertaintyNote ? { uncertainty_note: s.uncertaintyNote } : {}),
            privacy_flag: s.privacyFlag,
        };
        return out;
    }

    // a short sentence of what the card will record, e.g. "Began 1953–1955
    // (around 1954, founding stated); still in use as of 2010-06-01."
    function describeBounds(values) {
        const s = normalise(values);
        const startWords = START_BASIS_WORDS[s.startBasis];
        let start;
        if (s.startMode === "known" && s.startDate) {
            start = `Began ${s.startDate}`;
        } else if (s.startMode === "between" && (s.startNotEarlierThan || s.startNotLaterThan)) {
            start = `Began ${s.startNotEarlierThan || "?"}–${s.startNotLaterThan || "?"}`;
        } else if (s.startMode === "by" && s.startNotLaterThan) {
            start = `Began by ${s.startNotLaterThan}`;
        } else if (s.startMode === "unknown") {
            start = "Start unknown";
        } else {
            start = "Start not yet entered";
        }
        const startNotes = [];
        if (s.startAroundYear) startNotes.push(`around ${s.startAroundYear}`);
        if (s.startMode !== "unknown" && startWords) startNotes.push(startWords);
        if (startNotes.length) start += ` (${startNotes.join(", ")})`;

        const endWords = END_BASIS_WORDS[s.endBasis];
        let end;
        if (s.endMode === "still_active") {
            end = s.stillActiveAsof ? `still in use as of ${s.stillActiveAsof}` : "still in use (date not yet entered)";
        } else if (s.endMode === "known" && s.endDate) {
            end = `ended ${s.endDate}`;
        } else if (s.endMode === "between" && (s.endNotEarlierThan || s.endNotLaterThan)) {
            end = `ended ${s.endNotEarlierThan || "?"}–${s.endNotLaterThan || "?"}`;
        } else if (s.endMode === "after" && s.endNotEarlierThan) {
            end = `ended after ${s.endNotEarlierThan}`;
        } else if (s.endMode === "unknown") {
            end = "end unknown";
        } else {
            end = "end not yet entered";
        }
        const endNotes = [];
        if (s.endAroundYear) endNotes.push(`around ${s.endAroundYear}`);
        if (s.endMode !== "still_active" && s.endMode !== "unknown" && endWords) endNotes.push(endWords);
        if (s.endMode !== "still_active" && END_REASON_WORDS[s.endReason]) endNotes.push(END_REASON_WORDS[s.endReason]);
        if (endNotes.length) end += ` (${endNotes.join(", ")})`;

        const where = s.sameAsPin ? "" : "; at a different place";
        return `${start}; ${end}${where}.`;
    }

    // the ruled presence rules, ported verbatim from convex/lib/occupancies.ts
    // (presenceForSegment, combinePresence, derivePresence) so the entry
    // form can preview what the server will propose for each census year.
    // the server remains the authority; occupancyDerivationMirror.node-test
    // holds the two equal. card values are accepted directly (normalise
    // runs inside segmentBounds)
    const PRESENCE_RULE_WORDS = {
        inside_interval: "inside the period",
        before_stated_founding: "before the stated founding",
        before_stated_reopening: "before the stated reopening",
        before_first_record: "before the first record",
        after_stated_closure: "after the stated closure",
        after_last_record: "after the last record",
        within_start_window: "inside the start window",
        within_end_window: "inside the end window",
        beyond_active_anchor: "after the still-in-use date",
        start_unknown: "start unknown",
        end_unknown: "end unknown",
    };

    function presenceForSegment(values, year) {
        const s = normalise(values);
        const yStart = `${year}-01-01`;
        const yEnd = `${year}-12-31`;
        const b = segmentBounds(s);
        const fire = (rule_id, status) => ({ segment_index: s.segmentIndex, rule_id, status });
        if (b.startUpper !== undefined && b.startUpper <= yStart && b.endLower !== undefined && yEnd <= b.endLower) {
            return fire("inside_interval", "present");
        }
        if (b.startLower !== undefined && yEnd < b.startLower) {
            if (s.startBasis === "founding_stated") return fire("before_stated_founding", "absent");
            if (s.startBasis === "reopening_stated") return fire("before_stated_reopening", "absent");
            return fire("before_first_record", "uncertain");
        }
        if (b.endUpper !== undefined && yStart > b.endUpper) {
            return s.endBasis === "closure_stated"
                ? fire("after_stated_closure", "absent")
                : fire("after_last_record", "uncertain");
        }
        if (b.startUpper !== undefined && yStart < b.startUpper && (b.startLower === undefined || yEnd >= b.startLower)) {
            return fire("within_start_window", "uncertain");
        }
        if (b.open && b.asof !== undefined && yEnd > b.asof) {
            return fire("beyond_active_anchor", "uncertain");
        }
        if (!b.open && b.endLower !== undefined && yEnd > b.endLower && (b.endUpper === undefined || yStart <= b.endUpper)) {
            return fire("within_end_window", "uncertain");
        }
        if (b.startUpper === undefined && b.startLower === undefined && (b.endLower === undefined || yEnd <= b.endLower)) {
            return fire("start_unknown", "uncertain");
        }
        if (b.startUpper !== undefined && b.startUpper <= yStart && b.endLower === undefined && !b.open) {
            return fire("end_unknown", "uncertain");
        }
        return null;
    }

    function combinePresence(year, firings) {
        if (firings.length === 0) return null;
        const pick = status => firings.find(f => f.status === status);
        const present = pick("present");
        if (present) return { target_year: year, derived_status: "present", rule_id: present.rule_id, segment_rules: firings };
        const uncertain = pick("uncertain");
        if (uncertain) return { target_year: year, derived_status: "uncertain", rule_id: uncertain.rule_id, segment_rules: firings };
        return { target_year: year, derived_status: "absent", rule_id: firings[0].rule_id, segment_rules: firings };
    }

    function derivePresence(segments, targetYears) {
        const out = [];
        const indexed = (segments || []).map((values, index) => ({ ...values, segmentIndex: index }));
        for (const year of targetYears || []) {
            const firings = indexed.map(values => presenceForSegment(values, Number(year))).filter(Boolean);
            const combined = combinePresence(Number(year), firings);
            if (combined !== null) out.push(combined);
        }
        return out;
    }

    // the preview strip's sentence: "From your periods: 2013 present (inside
    // the period); 2018 absent (after the stated closure)." years no rule
    // reaches are named as not assessed; observed statuses that differ are
    // returned as conflicts so the form can show them before submission
    function describePresence(derived, targetYears, observed) {
        const byYear = new Map((derived || []).map(d => [String(d.target_year), d]));
        const parts = [];
        const conflicts = [];
        for (const year of targetYears || []) {
            const d = byYear.get(String(year));
            if (!d) {
                parts.push(`${year} not assessed`);
                continue;
            }
            parts.push(`${year} ${d.derived_status} (${PRESENCE_RULE_WORDS[d.rule_id] || d.rule_id})`);
            const seen = observed ? observed[String(year)] : undefined;
            if (seen && seen !== "not_assessed" && seen !== d.derived_status) {
                conflicts.push(`${year}: your status ${seen} differs from the periods (${d.derived_status})`);
            }
        }
        return { sentence: parts.length ? `From your periods: ${parts.join("; ")}.` : "", conflicts };
    }

    // the gap prompt's "not sure" branch (ruling r-e4): the doubt about a
    // spell out of use goes into the bounds of the two periods, never into
    // an invented date. stop: {date} | {earliest, latest} | {} ; again:
    // {date} | {by} | {}. returns the two card patches to apply
    function gapBounds(stop, again) {
        const st = stop || {};
        const ag = again || {};
        const first = {};
        if (text(st.date)) {
            first.endMode = "known";
            first.endDate = text(st.date);
        } else if (text(st.earliest) || text(st.latest)) {
            if (text(st.earliest) && text(st.latest)) {
                first.endMode = "between";
                first.endNotEarlierThan = text(st.earliest);
                first.endNotLaterThan = text(st.latest);
            } else if (text(st.earliest)) {
                first.endMode = "after";
                first.endNotEarlierThan = text(st.earliest);
            } else {
                // a latest-only end has no supported mode (there is no "by"
                // for ends), so the prompt asks for both bounds or the date
                return { problem: "Give both the earliest and latest dates it could have stopped, or the date itself; a latest date alone cannot be recorded." };
            }
        } else {
            first.endMode = "unknown";
        }
        first.stillActiveAsof = "";
        first.endAround = false;
        if (first.endMode !== "unknown") {
            first.endBasis = "last_seen_only";
            first.endReason = "unknown";
        } else {
            first.endBasis = "";
            first.endReason = "";
        }
        const second = {};
        if (text(ag.date)) {
            second.startMode = "known";
            second.startDate = text(ag.date);
        } else if (text(ag.by)) {
            second.startMode = "by";
            second.startNotLaterThan = text(ag.by);
        } else {
            second.startMode = "unknown";
        }
        second.startAround = false;
        second.startBasis = second.startMode === "unknown" ? "" : "first_seen_only";
        return { first, second };
    }

    // the guided form's assessment confidence is numeric (0.9 / 0.7 / 0.5);
    // the occupancy vocabulary is high / moderate / low / uncertain. a blank
    // assessment cannot stand in for the periods' confidence (ruling r-e4:
    // the reviewer's confirmation is the confidence of record, but the ra
    // still states one)
    const PARENT_CONFIDENCE = { "0.9": "high", "0.7": "moderate", "0.5": "low", high: "high", medium: "moderate", moderate: "moderate", low: "low" };

    function provenanceFromParent(values, gapNote) {
        const v = values || {};
        const confidence = PARENT_CONFIDENCE[text(v.assessmentConfidence)] || "";
        if (!confidence) {
            return { provenance: null, problem: "Choose an assessment confidence for this evidence, or untick \"same source\" and give the periods their own confidence." };
        }
        const account = text(v.note);
        if (account.length < MIN_SOURCE_ACCOUNT) {
            return { provenance: null, problem: `Record what the source says about these periods (at least ${MIN_SOURCE_ACCOUNT} characters). The portal will not invent or pad a source account.` };
        }
        const uncertainty = [text(v.uncertaintyNote), text(gapNote)].filter(Boolean).join(" ");
        return {
            provenance: {
                confidence,
                confidenceBasis: "Same source and assessment as the evidence record submitted with these periods.",
                sourceBasis: text(v.sourceType) === "field_observation" ? "local_investigator_account" : "named_public_source",
                sourceTitle: text(v.sourceTitle) || text(v.sourceProvider),
                sourceReference: text(v.sourceUrl),
                sourceAccount: account,
                uncertaintyNote: uncertainty,
                privacyFlag: text(v.privacyFlag) || "clear",
            },
            problem: "",
        };
    }

    // whether a card has been touched beyond the blank the form opens with
    function cardsTouched(segments) {
        return (segments || []).some(seg => text(seg.startDate) || text(seg.startNotEarlierThan) || text(seg.startNotLaterThan) || text(seg.startBasis)
            || text(seg.endDate) || text(seg.endNotEarlierThan) || text(seg.endNotLaterThan) || text(seg.endBasis) || text(seg.endReason) || seg.location
            || seg.startMode === "unknown" || seg.endMode === "unknown" || seg.startMode === "between" || seg.startMode === "by");
    }

    function guidedPeriodsStoragePrefix(countryCode, userId) {
        const country = text(countryCode);
        const user = text(userId);
        return country && user ? `powGuidedPeriods:${country}:${user}:` : "";
    }

    // ruling r-e1: on an ordinary guided submission the periods are the
    // temporal record. a place can go without them only when the hand grid
    // carries a status with its reason, or when the record is a duplicate
    // of another place, whose history lives there
    function periodsRequirement({ action, touched, gridAssessed, reason }) {
        if (touched) return "";
        if (action === "possible_duplicate") return "";
        if (gridAssessed) {
            return text(reason) ? "" : "Give the reason the periods cannot express this case, or record at least one period.";
        }
        return "Record at least one period for this place: when it was in use for worship. If you cannot, set the census-year statuses by hand with a reason, or submit an unresolved note.";
    }

    // a still-in-use card is anchored to the evidence date, not to the day
    // the page was opened: when the source date changes, cards that still
    // carry the old anchor (or none) follow it
    function syncStillActive(segments, previousReference, nextReference) {
        const prev = text(previousReference);
        const next = text(nextReference);
        let changed = 0;
        for (const seg of segments || []) {
            if (seg.endMode !== "still_active") continue;
            const asof = text(seg.stillActiveAsof);
            if (asof === "" || asof === prev) {
                seg.stillActiveAsof = next;
                changed += 1;
            }
        }
        return changed;
    }

    // the inverse of payload for a stored row: a card the entry pane can show
    // again. a between whose bounds are Y-1 and Y+1 collapses back to
    // "around Y" (the compile is idempotent, so the round trip is exact)
    function collapseAround(lower, upper) {
        if (!/^\d{4}$/.test(lower || "") || !/^\d{4}$/.test(upper || "")) return "";
        const lo = Number(lower);
        const hi = Number(upper);
        return hi - lo === 2 ? String(lo + 1) : "";
    }

    function segmentFromRow(row) {
        const r = row || {};
        const distinct = r.location_relation === "distinct";
        const segment = {
            startMode: text(r.start_mode) || "known",
            startDate: text(r.start_date),
            startNotEarlierThan: text(r.start_not_earlier_than),
            startNotLaterThan: text(r.start_not_later_than),
            startAround: false,
            startBasis: r.start_basis === "unknown" ? "" : text(r.start_basis),
            endMode: text(r.end_mode) || "known",
            endDate: text(r.end_date),
            endNotEarlierThan: text(r.end_not_earlier_than),
            endNotLaterThan: text(r.end_not_later_than),
            endAround: false,
            endBasis: r.end_basis === "unknown" ? "" : text(r.end_basis),
            endReason: text(r.end_reason),
            stillActiveAsof: text(r.still_active_asof),
            successorSiteId: text(r.successor_site_id),
            sameAsPin: !distinct,
            location: distinct ? {
                contract_version: "location_assertion_v1",
                mode: text(r.location_mode) || "building_identified",
                basis: text(r.location_basis) || "map_placement",
                latitude: Number(r.latitude),
                longitude: Number(r.longitude),
                ...(r.uncertainty_radius_m !== undefined && r.uncertainty_radius_m !== null ? { uncertainty_radius_m: Number(r.uncertainty_radius_m) } : {}),
                ...(text(r.location_wording) ? { source_wording: text(r.location_wording) } : {}),
                confidence: text(r.location_confidence) || "high",
                contributor_confirmed: true,
            } : null,
            locationSummary: "",
        };
        const startAround = segment.startMode === "between" ? collapseAround(segment.startNotEarlierThan, segment.startNotLaterThan) : "";
        if (startAround) {
            segment.startMode = "known";
            segment.startDate = startAround;
            segment.startAround = true;
            segment.startNotEarlierThan = "";
            segment.startNotLaterThan = "";
        }
        const endAround = segment.endMode === "between" ? collapseAround(segment.endNotEarlierThan, segment.endNotLaterThan) : "";
        if (endAround) {
            segment.endMode = "known";
            segment.endDate = endAround;
            segment.endAround = true;
            segment.endNotEarlierThan = "";
            segment.endNotLaterThan = "";
        }
        return segment;
    }

    // the shared provenance block of a submission, read from any of its rows
    function provenanceFromRow(row) {
        const r = row || {};
        return {
            confidence: text(r.confidence),
            confidenceBasis: text(r.confidence_basis),
            sourceBasis: text(r.source_basis),
            sourceTitle: text(r.source_title),
            sourceReference: text(r.source_reference),
            sourceAccount: text(r.source_account),
            uncertaintyNote: text(r.uncertainty_note),
            privacyFlag: text(r.privacy_flag) || "needs_review",
        };
    }

    window.PowOccupancy = Object.freeze({
        CONTRACT_VERSION,
        PRESENCE_RULE_WORDS,
        cardsTouched,
        combinePresence,
        derivePresence,
        describeBounds,
        describePresence,
        gapBounds,
        guidedPeriodsStoragePrefix,
        presenceForSegment,
        expandAround,
        isValidPartialDate,
        normalise,
        partialDateLower,
        partialDateUpper,
        payload,
        periodsRequirement,
        provenanceFromParent,
        provenanceFromRow,
        segmentBounds,
        segmentFromRow,
        syncStillActive,
        validateSegment,
        validateSet,
    });
})();
