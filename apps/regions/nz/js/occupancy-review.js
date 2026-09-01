// pure helpers for the reviewer's occupancy panel: the plain-words rule
// tables mirrored from convex/lib/occupancies.ts, the interval geometry
// drawn from a segment's bounds, the pill mapping for review states, and
// the client-side mirror of the confirm-all eligibility rule. no dom, no
// network, so the same file loads in the browser and under node for tests.
(function (root) {
    // mirrors PRESENCE_RULE_TEXT in convex/lib/occupancies.ts; change both
    const PRESENCE_RULE_TEXT = {
        inside_interval: "the year falls inside the recorded period",
        before_stated_founding: "the year is before the stated founding",
        before_first_record: "the year is before the first record, which does not prove absence",
        after_stated_closure: "the year is after the stated closure",
        after_last_record: "the year is after the last record, which does not prove absence",
        within_start_window: "the year falls inside the start uncertainty window",
        within_end_window: "the year falls inside the end uncertainty window",
        beyond_active_anchor: "the year is after the still-active date; an observation cannot speak past itself",
        start_unknown: "the start is unknown",
        end_unknown: "the end is unknown",
    };

    // mirrors LOCATION_RULE_TEXT in convex/lib/occupancies.ts; change both
    const LOCATION_RULE_TEXT = {
        occupancy_covers_year: "one period certainly covers the year",
        transition_window: "the year falls between two periods' uncertainty windows",
        within_own_window: "the year falls inside this period's uncertainty window",
        imputed_from_nearest: "no dated period reaches the year; location carried from the nearest period",
    };

    const START_BASIS_TEXT = {
        founding_stated: "founding stated",
        organisation_founded: "organisation founded",
        building_dedication: "building dedication",
        first_seen_only: "first seen only",
        unknown: "basis unknown",
    };

    const END_BASIS_TEXT = {
        closure_stated: "closure stated",
        last_seen_only: "last seen only",
        unknown: "basis unknown",
    };

    const END_REASON_TEXT = {
        closed: "closed",
        relocated: "relocated",
        demolished: "demolished",
        use_changed: "use changed",
        unknown: "reason unknown",
    };

    // review-state pill: derived_unconfirmed amber, confirmed green,
    // overridden blue, rejected grey (jb brief 2026-09-02)
    const REVIEW_STATE_PILL = {
        derived_unconfirmed: { label: "awaiting review", cls: "amber" },
        reviewer_confirmed: { label: "confirmed", cls: "green" },
        reviewer_overridden: { label: "overridden", cls: "blue" },
        reviewer_rejected: { label: "rejected", cls: "grey" },
        superseded: { label: "superseded", cls: "grey" },
    };

    function reviewStatePill(reviewState) {
        return REVIEW_STATE_PILL[reviewState] || { label: String(reviewState || "unknown").replaceAll("_", " "), cls: "grey" };
    }

    // the effective status after review: an override replaces the derived
    // value, a rejection leaves nothing written
    function effectiveStatus(presence) {
        if (!presence) return null;
        if (presence.review_state === "reviewer_overridden" && presence.override_status) return presence.override_status;
        return presence.derived_status;
    }

    // present is green only once a reviewer has written it; before that the
    // proposal stays neutral, uncertain stays amber throughout
    function statusPillClass(status, reviewState) {
        if (status === "uncertain") return "amber";
        if (status === "present" && (reviewState === "reviewer_confirmed" || reviewState === "reviewer_overridden")) return "green";
        return "";
    }

    // partial-date bounds, mirroring convex/lib/historicalClaims.ts
    function partialDateLower(value) {
        const text = String(value ?? "").trim();
        if (/^\d{4}$/.test(text)) return `${text}-01-01`;
        if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
        return text;
    }

    function partialDateUpper(value) {
        const text = String(value ?? "").trim();
        if (/^\d{4}$/.test(text)) return `${text}-12-31`;
        if (/^\d{4}-\d{2}$/.test(text)) {
            const [year, month] = text.split("-").map(Number);
            const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
            return `${text}-${String(lastDay).padStart(2, "0")}`;
        }
        return text;
    }

    // iso day bounds of a segment's start and end, mirroring segmentBounds in
    // convex/lib/occupancies.ts: still_active anchors endLower at the as-of
    // date and leaves endUpper open
    function segmentBounds(s) {
        const bounds = { open: false };
        switch (s.start_mode) {
            case "known":
                bounds.startLower = partialDateLower(s.start_date);
                bounds.startUpper = partialDateUpper(s.start_date);
                break;
            case "between":
                bounds.startLower = partialDateLower(s.start_not_earlier_than);
                bounds.startUpper = partialDateUpper(s.start_not_later_than);
                break;
            case "by":
                bounds.startUpper = partialDateUpper(s.start_not_later_than);
                break;
            default:
                break;
        }
        switch (s.end_mode) {
            case "still_active":
                bounds.open = true;
                bounds.asof = partialDateUpper(s.still_active_asof);
                bounds.endLower = bounds.asof;
                break;
            case "known":
                bounds.endLower = partialDateLower(s.end_date);
                bounds.endUpper = partialDateUpper(s.end_date);
                break;
            case "between":
                bounds.endLower = partialDateLower(s.end_not_earlier_than);
                bounds.endUpper = partialDateUpper(s.end_not_later_than);
                break;
            case "after":
                bounds.endLower = partialDateLower(s.end_not_earlier_than);
                break;
            default:
                break;
        }
        return bounds;
    }

    // an iso day as a fractional year for the axis
    function yearFraction(iso) {
        if (!iso) return null;
        const [y, m, d] = String(iso).split("-").map(Number);
        if (!Number.isFinite(y)) return null;
        const month = Number.isFinite(m) ? m : 1;
        const day = Number.isFinite(d) ? d : 1;
        return y + (month - 1) / 12 + (day - 1) / 365;
    }

    // axis domain in fractional years: the census years and every dated bound,
    // padded a little at each end so the first and last labels have room
    function axisDomain(targetYears, segments) {
        const values = [];
        (targetYears || []).forEach((year) => {
            if (Number.isFinite(year)) values.push(year, year + 1);
        });
        (segments || []).forEach((segment) => {
            const b = segmentBounds(segment);
            [b.startLower, b.startUpper, b.endLower, b.endUpper, b.asof].forEach((iso) => {
                const f = yearFraction(iso);
                if (f !== null) values.push(f);
            });
        });
        if (values.length === 0) return { min: 1990, max: 2030 };
        let min = Math.min(...values);
        let max = Math.max(...values);
        if (max - min < 4) {
            const mid = (min + max) / 2;
            min = mid - 2;
            max = mid + 2;
        }
        const pad = Math.max(1.5, (max - min) * 0.06);
        return { min: min - pad, max: max + pad };
    }

    // one segment's drawable parts in fractional years: the certain core
    // [startUpper, endLower], the dashed start and end windows, the open
    // run past a still-active anchor, and the anchor itself. a missing
    // bound is drawn to the axis edge as a window, never as core.
    function segmentParts(segment, domain) {
        const b = segmentBounds(segment);
        const sl = yearFraction(b.startLower);
        const su = yearFraction(b.startUpper);
        const el = yearFraction(b.endLower);
        const eu = yearFraction(b.endUpper);
        const asof = b.open ? yearFraction(b.asof) : null;
        const parts = { core: null, startWindow: null, endWindow: null, open: null, asof };

        const coreStart = su;
        const coreEnd = el;
        if (coreStart !== null && coreEnd !== null && coreStart <= coreEnd) {
            parts.core = [coreStart, coreEnd];
        }
        // start window: between the bounds, or from the axis edge when only
        // a latest date (by) or nothing (unknown) is recorded
        if (su !== null) {
            const from = sl !== null ? sl : domain.min;
            if (from < su) parts.startWindow = [from, su];
        } else {
            const to = el !== null ? el : (eu !== null ? eu : domain.max);
            parts.startWindow = [domain.min, to];
        }
        // end window: between the bounds, to the axis edge for after or
        // unknown, none for still-active (the open run stands in for it)
        if (b.open) {
            if (asof !== null) parts.open = [asof, domain.max];
        } else if (el !== null) {
            const to = eu !== null ? eu : domain.max;
            if (el < to) parts.endWindow = [el, to];
        } else {
            const from = su !== null ? su : (sl !== null ? sl : domain.min);
            parts.endWindow = [from, domain.max];
        }
        return parts;
    }

    // pixel geometry for the inline svg: one row per segment, census ticks
    // along the top; width in viewbox units, row height fixed
    function barGeometry(segments, targetYears, options = {}) {
        const width = options.width || 640;
        const left = options.left || 8;
        const right = options.right || 8;
        const rowHeight = options.rowHeight || 22;
        const top = options.top || 18;
        const ordered = [...(segments || [])].sort((a, b) => a.segment_index - b.segment_index);
        const domain = axisDomain(targetYears, ordered);
        const span = domain.max - domain.min;
        const x = (f) => left + ((f - domain.min) / span) * (width - left - right);
        const ticks = [...new Set((targetYears || []).filter(Number.isFinite))]
            .sort((a, b) => a - b)
            .map((year) => ({ year, x: x(year), x1: x(year), x2: x(year + 1) }));
        const bars = ordered.map((segment, index) => {
            const parts = segmentParts(segment, domain);
            const y = top + index * rowHeight;
            const seg = (pair) => (pair ? { x1: x(pair[0]), x2: x(pair[1]) } : null);
            return {
                index,
                segment_index: segment.segment_index,
                occupancy_id: segment.occupancy_id,
                y,
                core: seg(parts.core),
                startWindow: seg(parts.startWindow),
                endWindow: seg(parts.endWindow),
                open: seg(parts.open),
                asof: parts.asof !== null ? x(parts.asof) : null,
            };
        });
        return {
            width,
            height: top + Math.max(1, ordered.length) * rowHeight + 6,
            rowHeight,
            top,
            domain,
            ticks,
            bars,
        };
    }

    // plain words for a segment's start, end, and location
    function describeStart(segment) {
        const basis = START_BASIS_TEXT[segment.start_basis] || segment.start_basis || "";
        switch (segment.start_mode) {
            case "known":
                return `began ${segment.start_date} (${basis})`;
            case "between":
                return `began between ${segment.start_not_earlier_than} and ${segment.start_not_later_than} (${basis})`;
            case "by":
                return `began by ${segment.start_not_later_than} (${basis})`;
            default:
                return "start unknown";
        }
    }

    function describeEnd(segment) {
        const basis = END_BASIS_TEXT[segment.end_basis] || segment.end_basis || "";
        const reason = segment.end_reason ? `; ${END_REASON_TEXT[segment.end_reason] || segment.end_reason}` : "";
        switch (segment.end_mode) {
            case "still_active":
                return `still active as of ${segment.still_active_asof}`;
            case "known":
                return `ended ${segment.end_date} (${basis}${reason})`;
            case "between":
                return `ended between ${segment.end_not_earlier_than} and ${segment.end_not_later_than} (${basis}${reason})`;
            case "after":
                return `ended after ${segment.end_not_earlier_than} (${basis}${reason})`;
            default:
                return `end unknown${reason ? ` (${reason.slice(2)})` : ""}`;
        }
    }

    // great-circle metres between two {latitude, longitude} points
    function distanceMetres(a, b) {
        const toRad = (value) => (Number(value) * Math.PI) / 180;
        const dLat = toRad(b.latitude - a.latitude);
        const dLng = toRad(b.longitude - a.longitude);
        const h = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
        return 2 * 6371000 * Math.asin(Math.sqrt(h));
    }

    function describeLocation(segment, taskPoint) {
        const radius = segment.uncertainty_radius_m !== undefined && segment.uncertainty_radius_m !== null
            ? `${Math.round(segment.uncertainty_radius_m)} m radius`
            : null;
        const area = segment.location_mode === "approximate_area";
        if (segment.location_relation === "same_as_task_point") {
            return area ? `area at the pin${radius ? `, ${radius}` : ""}` : "building at the pin";
        }
        const metres = taskPoint ? Math.round(distanceMetres(taskPoint, segment)) : null;
        const where = metres !== null ? `distinct point ${metres} m from the pin` : "distinct point";
        return area ? `${where}, area${radius ? ` ${radius}` : ""}` : `${where}, building identified`;
    }

    // local east/north metres of a point relative to the task point
    function localOffset(taskPoint, point) {
        const latRad = (Number(taskPoint.latitude) * Math.PI) / 180;
        return {
            east: (Number(point.longitude) - Number(taskPoint.longitude)) * 111320 * Math.cos(latRad),
            north: (Number(point.latitude) - Number(taskPoint.latitude)) * 110540,
        };
    }

    // the tiny scatter: task point at the centre, each period offset by its
    // metre delta scaled to fit, circles sized by radius when approximate
    function scatterGeometry(segments, taskPoint, options = {}) {
        const size = options.size || 120;
        const margin = options.margin || 14;
        const centre = size / 2;
        const ordered = [...(segments || [])].sort((a, b) => a.segment_index - b.segment_index);
        const offsets = ordered.map((segment) => {
            const o = localOffset(taskPoint, segment);
            const radius = segment.location_mode === "approximate_area" && Number.isFinite(segment.uncertainty_radius_m)
                ? Number(segment.uncertainty_radius_m)
                : 0;
            return { ...o, radius, distance: distanceMetres(taskPoint, segment) };
        });
        let extent = 0;
        offsets.forEach((o) => {
            extent = Math.max(extent, Math.abs(o.east) + o.radius, Math.abs(o.north) + o.radius);
        });
        const scale = extent > 0 ? (centre - margin) / extent : 0;
        const points = ordered.map((segment, index) => {
            const o = offsets[index];
            return {
                index,
                segment_index: segment.segment_index,
                cx: centre + o.east * scale,
                cy: centre - o.north * scale,
                r: o.radius > 0 ? Math.max(4, o.radius * scale) : 4,
                approximate: o.radius > 0,
                distance_m: Math.round(o.distance),
            };
        });
        return { size, centre, scale, extent_m: Math.round(extent), points };
    }

    // groups active occupancy rows by parent draft, latest submission first
    function groupByParent(occupancies) {
        const groups = new Map();
        (occupancies || [])
            .filter((row) => row.claim_status === "submitted")
            .forEach((row) => {
                const key = row.parent_evidence_draft_id;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(row);
            });
        return [...groups.entries()]
            .map(([parentId, rows]) => ({
                parent_evidence_draft_id: parentId,
                created_by: rows[0].created_by,
                latest_created_at: Math.max(...rows.map((row) => row.created_at || 0)),
                segments: rows.sort((a, b) => a.segment_index - b.segment_index),
            }))
            .sort((a, b) => b.latest_created_at - a.latest_created_at);
    }

    // mirrors the confirm-all rule in convex/occupancies.ts: unconfirmed,
    // rule 1, 2, or 4, no conflict, and every location row l1
    const CONFIRMABLE_RULES = new Set(["inside_interval", "before_stated_founding", "after_stated_closure"]);

    function confirmAllEligibleYears(presenceRows, locationRows) {
        const live = (locationRows || []).filter((row) => row.review_state !== "superseded");
        return (presenceRows || [])
            .filter((row) => row.review_state === "derived_unconfirmed")
            .filter((row) => CONFIRMABLE_RULES.has(row.rule_id))
            .filter((row) => !row.conflicts_observation)
            .filter((row) => live
                .filter((l) => l.target_year === row.target_year)
                .every((l) => l.rule_id === "occupancy_covers_year"))
            .map((row) => row.target_year)
            .sort((a, b) => a - b);
    }

    function confirmAllSummary(result) {
        const confirmed = result?.confirmed || [];
        const skipped = result?.skipped || [];
        const parts = [];
        parts.push(confirmed.length === 0 ? "No years confirmed." : `Confirmed ${confirmed.join(", ")}.`);
        if (skipped.length > 0) {
            parts.push(`Skipped ${skipped.map((s) => `${s.target_year} (${s.reason})`).join("; ")}.`);
        }
        return parts.join(" ");
    }

    const api = {
        PRESENCE_RULE_TEXT,
        LOCATION_RULE_TEXT,
        START_BASIS_TEXT,
        END_BASIS_TEXT,
        END_REASON_TEXT,
        reviewStatePill,
        effectiveStatus,
        statusPillClass,
        partialDateLower,
        partialDateUpper,
        segmentBounds,
        yearFraction,
        axisDomain,
        segmentParts,
        barGeometry,
        describeStart,
        describeEnd,
        describeLocation,
        distanceMetres,
        localOffset,
        scatterGeometry,
        groupByParent,
        confirmAllEligibleYears,
        confirmAllSummary,
    };
    root.PowOccupancyReview = api;
})(typeof window !== "undefined" ? window : globalThis);
