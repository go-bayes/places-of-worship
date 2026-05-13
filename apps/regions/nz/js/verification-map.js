const SEARCH_PARAMS = new URLSearchParams(window.location.search);
const DEMO_MODE = SEARCH_PARAMS.get("demo") !== "0";
const INTAKE_ENABLED = DEMO_MODE;
const COUNTRY_CONFIGS = {
    nz: {
        countryCode: "NZ",
        countryName: "New Zealand",
        targetYears: ["2013", "2018", "2023"],
        defaultTargetYear: "2023",
        dataPath: "apps/regions/nz/data/",
        mapCentre: [-41.235726, 172.5118422],
        mapZoom: 6,
        collectionBatch: "nz-map-workbench-demo",
        sourceDatasetId: "nz_static_verification_map",
        mapSource: "nz_verification_static_map_workbench",
        nominationSource: "nz_verification_static_map_nomination",
        temporalLossAction: {
            value: "present_2013_absent_2018",
            label: "Present in 2013, absent in 2018",
            statuses: {
                "2013": "present",
                "2018": "absent",
                "2023": "not_assessed",
            },
            note: "Evidence appears to support worship use in 2013 and absence by 2018; reviewer to confirm dates and status.",
        },
    },
    vu: {
        countryCode: "VU",
        countryName: "Vanuatu",
        targetYears: ["1989", "1999", "2009", "2020"],
        defaultTargetYear: "2020",
        dataPath: "",
        mapCentre: [-16.2902, 167.7019],
        mapZoom: 7,
        collectionBatch: "vu-map-workbench-demo",
        sourceDatasetId: "vu_static_verification_map",
        mapSource: "vu_verification_static_map_workbench",
        nominationSource: "vu_verification_static_map_nomination",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "1989": "present",
                "2020": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
};
const COUNTRY_KEY = SEARCH_PARAMS.get("country") === "vu" ? "vu" : "nz";
const COUNTRY_CONFIG = COUNTRY_CONFIGS[COUNTRY_KEY];
const TARGET_YEARS = COUNTRY_CONFIG.targetYears;
const DEFAULT_TARGET_YEAR = COUNTRY_CONFIG.defaultTargetYear || TARGET_YEARS[TARGET_YEARS.length - 1];
const ASSIGNMENT_BATCH_ID = (SEARCH_PARAMS.get("batch") || "").trim();
const ASSIGNMENT_MODE = ASSIGNMENT_BATCH_ID.length > 0;
const ASSIGNMENT_SESSION_SEGMENT = ASSIGNMENT_BATCH_ID
    ? `:${ASSIGNMENT_BATCH_ID.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 64)}`
    : "";
const LEGACY_SESSION_LOG_KEY = "pow_ra_session_v1";
const LEGACY_RA_INITIALS_KEY = "pow_ra_initials";
const COUNTRY_SESSION_LOG_KEY = `pow_ra_session_v1:${COUNTRY_CONFIG.countryCode.toLowerCase()}`;
const SESSION_LOG_KEY_PREFIX = `${COUNTRY_SESSION_LOG_KEY}${ASSIGNMENT_SESSION_SEGMENT}:`;
const RA_INITIALS_KEY = `pow_ra_initials:${COUNTRY_CONFIG.countryCode.toLowerCase()}`;
const SESSION_RECENT_LIMIT = 25;
const WIDE_EVIDENCE_FIELDS = [
    "evidence_row_id", "collection_batch", "country_code", "area_hint",
    "source_dataset_id", "source_type", "provider", "source_title",
    "source_url_or_file", "source_record_id", "retrieval_date", "retrieved_by",
    "licence", "access_limits", "redistribution_limits", "raw_file_location",
    "source_notes", "name_raw", "name_standardised",
    "denomination_or_tradition_raw", "site_type", "address_raw",
    "historical_address_raw", "historical_locality_raw",
    "modern_address_candidate", "address_standardised", "locality_raw",
    "territorial_authority_hint", "address_change_note", "geocoding_basis",
    "geocoding_confidence", "latitude", "longitude", "geometry_wkt_or_geojson",
    "matched_osm_id", "osm_object_type", "osm_version_timestamp",
    "osm_tags_raw", "osm_start_date", "osm_old_start_date", "osm_end_date",
    "osm_lifecycle_date_notes", "matched_current_site_id", "candidate_site_id",
    "match_method", "match_confidence", "candidate_match_notes",
    "visual_verification_source", "visual_verification_url_or_file",
    "visual_verification_capture_date", "visual_verification_summary",
    "organisation_founded_date", "organisation_founded_date_precision",
    "site_opened_date", "site_opened_date_precision",
    "building_opened_or_dedicated_date",
    "building_opened_or_dedicated_date_precision",
    "origin_not_earlier_than_date", "origin_not_earlier_than_date_precision",
    "origin_not_later_than_date", "origin_not_later_than_date_precision",
    "first_seen_date", "first_seen_date_precision", "last_seen_date",
    "last_seen_date_precision", "site_closed_date", "site_closed_date_precision",
    "closure_not_earlier_than_date", "closure_not_earlier_than_date_precision",
    "closure_not_later_than_date", "closure_not_later_than_date_precision",
    "building_demolished_date", "building_demolished_date_precision",
    "use_changed_date", "use_changed_date_precision", "relocated_date",
    "relocated_date_precision", "date_evidence_raw", "date_evidence_summary",
    "existence_status", "worship_use_status", "public_access_status",
    ...TARGET_YEARS.flatMap(year => [
        `target_year_${year}_status`,
        `target_year_${year}_probability`,
        `target_year_${year}_evidence`,
    ]),
    "quality_flag", "review_status",
    "privacy_flag", "licence_flag", "extracted_by", "extracted_at",
    "reviewed_by", "reviewed_at", "review_note", "exclusion_reason",
];
const EXISTENCE_STATUS_OPTIONS = [
    ["present", "Present"],
    ["absent", "Absent"],
    ["uncertain", "Uncertain"],
];
const WORSHIP_USE_STATUS_OPTIONS = [
    ["confirmed_worship", "Confirmed worship"],
    ["probable_worship", "Probable worship"],
    ["organisation_only", "Organisation only"],
    ["building_only", "Building only"],
    ["not_worship", "Not worship"],
    ["uncertain", "Uncertain"],
];
const CONFIDENCE_OPTIONS = [
    ["high", "High"],
    ["medium", "Medium"],
    ["low", "Low"],
    ["none", "None"],
];
const ASSESSMENT_CONFIDENCE_OPTIONS = [
    ["", "Not assessed"],
    ["0.9", "High (0.90)"],
    ["0.7", "Medium (0.70)"],
    ["0.5", "Low (0.50)"],
];
const SOURCE_TYPE_OPTIONS = [
    ["osm_history", "OSM history"],
    ["osm_date_tags", "OSM date tags"],
    ["street_imagery", "Street imagery / Street View"],
    ["aerial_imagery", "Aerial imagery"],
    ["field_observation", "Field observation"],
    ["denominational_directory", "Denominational directory"],
    ["charities_register", "Charities register"],
    ["incorporated_societies", "Incorporated societies"],
    ...(COUNTRY_CONFIG.countryCode === "NZ" ? [
        ["linz_building_outlines", "LINZ building outlines"],
        ["linz_property", "LINZ property/address"],
    ] : []),
    ["archived_website", "Archived website"],
    ["local_council", "Local council"],
    ["heritage_list", "Heritage list"],
    ["other", "Other"],
];
const DATE_PRECISION_OPTIONS = [
    ["day", "Day"],
    ["month", "Month"],
    ["year", "Year"],
    ["bounded", "Bounded / inferred"],
    ["unknown", "Unknown"],
];
const LIFECYCLE_EVENT_OPTIONS = [
    ["", "No extra opening/closure/change date"],
    ["organisation_founded", "Organisation/congregation founded"],
    ["site_opened", "Worship began at this site"],
    ["building_opened_or_dedicated", "Building opened or dedicated"],
    ["origin_not_earlier_than", "Origin not earlier than"],
    ["origin_not_later_than", "Origin not later than"],
    ["first_seen", "First seen in source"],
    ["last_seen", "Last seen in source"],
    ["site_closed", "Worship ended at this site"],
    ["closure_not_earlier_than", "Closure not earlier than"],
    ["closure_not_later_than", "Closure not later than"],
    ["building_demolished", "Building demolished"],
    ["use_changed", "Use changed / shared use began"],
    ["relocated", "Organisation relocated"],
];
const LIFECYCLE_FIELD_BY_EVENT = {
    organisation_founded: ["organisation_founded_date", "organisation_founded_date_precision"],
    site_opened: ["site_opened_date", "site_opened_date_precision"],
    building_opened_or_dedicated: [
        "building_opened_or_dedicated_date",
        "building_opened_or_dedicated_date_precision",
    ],
    origin_not_earlier_than: ["origin_not_earlier_than_date", "origin_not_earlier_than_date_precision"],
    origin_not_later_than: ["origin_not_later_than_date", "origin_not_later_than_date_precision"],
    first_seen: ["first_seen_date", "first_seen_date_precision"],
    last_seen: ["last_seen_date", "last_seen_date_precision"],
    site_closed: ["site_closed_date", "site_closed_date_precision"],
    closure_not_earlier_than: ["closure_not_earlier_than_date", "closure_not_earlier_than_date_precision"],
    closure_not_later_than: ["closure_not_later_than_date", "closure_not_later_than_date_precision"],
    building_demolished: ["building_demolished_date", "building_demolished_date_precision"],
    use_changed: ["use_changed_date", "use_changed_date_precision"],
    relocated: ["relocated_date", "relocated_date_precision"],
};

function dataUrl(path) {
    if (!COUNTRY_CONFIG.dataPath) {
        throw new Error(`${COUNTRY_CONFIG.countryName} task data is not configured yet.`);
    }
    const prefix = window.location.pathname.includes("/places-of-worship/") ? "/places-of-worship/" : "/";
    return new URL(`${prefix}${COUNTRY_CONFIG.dataPath}${path}`, window.location.origin).toString();
}

function demoUrl() {
    return window.location.pathname;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function cap(value) {
    return String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function targetYearListText(years = TARGET_YEARS) {
    if (years.length <= 1) return years[0] || "the target year";
    return `${years.slice(0, -1).join(", ")} or ${years[years.length - 1]}`;
}

function slug(value, maxLength = 44) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, maxLength);
}

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function nowIso() {
    return new Date().toISOString();
}

function cleanCell(value) {
    return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

function tsvRowFromObject(row) {
    return WIDE_EVIDENCE_FIELDS.map(field => cleanCell(row[field])).join("\t");
}

function isValidPartialDateText(value) {
    const text = String(value || "").trim();
    if (!text) return true;
    const year = Number(text.slice(0, 4));
    if (!Number.isInteger(year) || year < 1000 || year > 2100) return false;
    if (/^\d{4}$/.test(text)) return true;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return true;
    const fullDate = text.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
    if (!fullDate) return false;
    const date = new Date(`${text}T00:00:00Z`);
    return date.getUTCFullYear() === Number(fullDate[1])
        && date.getUTCMonth() + 1 === Number(fullDate[2])
        && date.getUTCDate() === Number(fullDate[3]);
}

function precisionForPartialDate(value) {
    const text = String(value || "").trim();
    if (/^\d{4}$/.test(text)) return "year";
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return "month";
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(text)) return "day";
    return "unknown";
}

function selectOptionsHtml(options, selectedValue) {
    return options.map(([value, label]) => `
        <option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(label)}</option>
    `).join("");
}

function optionLabel(options, selectedValue) {
    return options.find(([value]) => value === selectedValue)?.[1] || selectedValue;
}

function statusOptionsHtml() {
    return `
        <option value="not_assessed">Not assessed</option>
        <option value="present">Present</option>
        <option value="absent">Absent</option>
        <option value="uncertain">Uncertain</option>
    `;
}

function targetYearStatusControlsHtml() {
    return TARGET_YEARS.map(year => `
        <label>
            ${escapeHtml(year)} status
            <select id="status${escapeHtml(year)}">
                ${statusOptionsHtml()}
            </select>
        </label>
    `).join("");
}

function nominationTypeOptionsHtml() {
    return [
        `<option value="current_place_missing_from_project_map">Current place missing from project map</option>`,
        ...TARGET_YEARS.map(year => `<option value="lost_${escapeHtml(year)}_place_of_worship">Lost ${escapeHtml(year)} place of worship</option>`),
        `<option value="denomination_switch_or_reuse">Denomination switch or reuse</option>`,
        `<option value="shared_building_multiple_congregations">Shared building with multiple congregations</option>`,
        `<option value="split_or_merged_site_records">Split or merged site records</option>`,
        `<option value="charity_record_for_site_matching">Charity record for site matching</option>`,
    ].join("");
}

function priorityColor(priority) {
    if (priority === "high") return "#c0392b";
    if (priority === "medium") return "#d68910";
    return "#1e8449";
}

function statusLabel(status) {
    if (status === "present") return "Present";
    if (status === "absent") return "Absent";
    if (status === "uncertain") return "Uncertain";
    return "Not assessed";
}

function statusColor(status) {
    if (status === "present") return "#1e8449";
    if (status === "absent") return "#6b7280";
    if (status === "uncertain") return "#d68910";
    return "#2874a6";
}

function statusClass(status) {
    if (status === "present") return "status-present";
    if (status === "absent") return "status-absent";
    if (status === "uncertain") return "status-uncertain";
    return "status-not-assessed";
}

function parseLifecycleDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    const century = text.match(/\b[Cc](\d{1,2})\b/);
    if (century) {
        const centuryNumber = Number(century[1]);
        if (Number.isFinite(centuryNumber) && centuryNumber > 0) {
            return {
                year: (centuryNumber - 1) * 100,
                month: null,
                day: null,
                precision: "century",
                raw: text,
            };
        }
    }

    const fullDate = text.match(/\b(1[0-9]{3}|20[0-9]{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (fullDate) {
        return {
            year: Number(fullDate[1]),
            month: Number(fullDate[2]),
            day: Number(fullDate[3]),
            precision: "day",
            raw: text,
        };
    }

    const dayFirstDate = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](1[0-9]{3}|20[0-9]{2})\b/);
    if (dayFirstDate) {
        return {
            year: Number(dayFirstDate[3]),
            month: Number(dayFirstDate[2]),
            day: Number(dayFirstDate[1]),
            precision: "day",
            raw: text,
        };
    }

    const monthDate = text.match(/\b(1[0-9]{3}|20[0-9]{2})[-/.](\d{1,2})\b/);
    if (monthDate) {
        return {
            year: Number(monthDate[1]),
            month: Number(monthDate[2]),
            day: null,
            precision: "month",
            raw: text,
        };
    }

    const year = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    if (year) {
        return {
            year: Number(year[1]),
            month: null,
            day: null,
            precision: "year",
            raw: text,
        };
    }

    return null;
}

function compareLifecycleDateToTarget(parsed, targetYear) {
    const target = { year: Number(targetYear), month: 9, day: 1 };
    if (!parsed || !Number.isFinite(target.year)) return null;
    if (parsed.year < target.year) return -1;
    if (parsed.year > target.year) return 1;

    if (parsed.precision === "day") {
        if (parsed.month < target.month) return -1;
        if (parsed.month > target.month) return 1;
        if (parsed.day < target.day) return -1;
        if (parsed.day > target.day) return 1;
        return -1;
    }

    if (parsed.precision === "month") {
        if (parsed.month < target.month) return -1;
        if (parsed.month > target.month) return 1;
    }

    return 0;
}

function lifecycleDateSummary(props) {
    const start = props.osm_start_date || "";
    const oldStart = props.osm_old_start_date || "";
    const end = props.osm_end_date || "";
    return [
        start ? `start_date=${start}` : "",
        oldStart ? `old_start_date=${oldStart}` : "",
        end ? `end_date=${end}` : "",
    ].filter(Boolean).join("; ");
}

function normaliseSiteType(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("chapel")) return "chapel";
    if (text.includes("mosque")) return "mosque";
    if (text.includes("synagogue")) return "synagogue";
    if (text.includes("temple")) return "temple";
    if (text.includes("marae")) return "marae_church";
    if (text.includes("church") || text.includes("cathedral")) return "church";
    if (text.includes("multi")) return "multi_use";
    return "place_of_worship";
}

function statusDefaultsForAction(action, targetYear, props) {
    const statuses = Object.fromEntries(TARGET_YEARS.map(year => [year, "not_assessed"]));
    const latestYear = TARGET_YEARS[TARGET_YEARS.length - 1];
    const lossAction = COUNTRY_CONFIG.temporalLossAction;

    if (action === "confirm_current_record" || action === "denomination_or_shared_use") {
        statuses[targetYear] = "present";
    } else if (action === "missing_current_site") {
        statuses[latestYear] = "present";
    } else if (action === lossAction.value) {
        Object.entries(lossAction.statuses || {}).forEach(([year, status]) => {
            if (year in statuses) statuses[year] = status;
        });
    } else if (action === "closed_or_changed_use") {
        statuses[targetYear] = "absent";
    } else if (action === "needs_review" || action === "possible_duplicate") {
        statuses[targetYear] = "uncertain";
    } else {
        statuses[targetYear] = deriveTargetYearStatus(props, targetYear).status;
    }

    return statuses;
}

function assessmentDefaultsForAction(action, statuses = {}) {
    const statusValues = TARGET_YEARS.map(year => statuses[year]);
    const anyPresent = statusValues.includes("present");
    const anyAbsent = statusValues.includes("absent");
    const isMissing = action === "missing_current_site";
    const isDuplicate = action === "possible_duplicate";
    const isClosed = action === "closed_or_changed_use" || action === COUNTRY_CONFIG.temporalLossAction.value;
    const needsReview = action === "needs_review";

    let worshipUseStatus = "uncertain";
    if (isClosed) {
        worshipUseStatus = "not_worship";
    } else if (action === "missing_current_site") {
        worshipUseStatus = "probable_worship";
    } else if (anyPresent) {
        worshipUseStatus = "confirmed_worship";
    }

    return {
        existenceStatus: anyPresent ? "present" : anyAbsent ? "absent" : "uncertain",
        worshipUseStatus,
        assessmentConfidence: needsReview ? "0.5" : isDuplicate || isMissing || isClosed ? "0.7" : "0.9",
        matchConfidence: isMissing ? "none" : isDuplicate ? "medium" : needsReview ? "low" : "high",
        geocodingConfidence: isMissing || isDuplicate ? "medium" : needsReview ? "low" : "high",
    };
}

function actionLabelForRa(action) {
    if (action === "confirm_current_record") return "Confirm current site";
    if (action === "missing_current_site") return "Missing from project map";
    if (action === "possible_duplicate") return "Possible duplicate";
    if (action === COUNTRY_CONFIG.temporalLossAction.value) return COUNTRY_CONFIG.temporalLossAction.label;
    if (action === "closed_or_changed_use") return "Closed or changed use";
    if (action === "denomination_or_shared_use") return "Denomination/shared use";
    return "Needs review";
}

function reviewNoteForAction(action) {
    if (action === "confirm_current_record") return "RA source check supports current worship-site record.";
    if (action === "missing_current_site") return "Possible current PoW missing from the project map; OSM may already have a candidate object. Reviewer to decide whether to create or link a site.";
    if (action === "possible_duplicate") return "Possible duplicate or merge candidate; reviewer to compare linked ids and site identity.";
    if (action === COUNTRY_CONFIG.temporalLossAction.value) return COUNTRY_CONFIG.temporalLossAction.note;
    if (action === "closed_or_changed_use") return "Evidence suggests worship use closed or changed; reviewer to distinguish building existence from worship function.";
    if (action === "denomination_or_shared_use") return "Evidence suggests denomination change, shared use, or multi-use building; reviewer to preserve concurrent uses if present.";
    return "Needs reviewer decision.";
}

function taskFocusForAction(action, priority) {
    if (action === "needs_human_review") {
        return {
            label: priority === "high" ? "High-priority review" : "Human review",
            text: "Resolve whether this record is a source-backed place of worship at this location and whether its target-year status can be assessed.",
        };
    }
    if (action === "review_when_sampling") {
        return {
            label: "Spot-check sample",
            text: "Check the record against independent source evidence and capture any opening/closure/change, address, denomination, duplicate, or uncertainty finding.",
        };
    }
    if (action === "candidate_no_action") {
        return {
            label: "Control check",
            text: "Confirm the record looks plausible. Record a row only if you find a correction, date evidence, duplicate, changed use, or uncertainty worth review.",
        };
    }
    return {
        label: "Review task",
        text: "Check the record against source evidence and record the strongest finding supported by that evidence.",
    };
}

function checklistItemForCheck(check) {
    const id = check?.check_id || "";
    if (id === "missing_osm_lifecycle_date") {
        return `Look for opening, first-seen, closure, or changed-use evidence that helps assess ${targetYearListText()} worship use.`;
    }
    if (id === "missing_address") {
        return "Find a source-backed street address or locality, and note if the location remains approximate.";
    }
    if (id === "missing_denomination") {
        return "Find the denomination, tradition, or religion-specific affiliation if a reliable source states it.";
    }
    if (id === "generic_name") {
        return "Find the real site name or evidence that the generic name is all the source supports.";
    }
    if (id === "weak_worship_tags") {
        return "Check that this is active worship use, not only a building, office, school, hall, or organisation record.";
    }
    if (id === "low_confidence") {
        return "Confirm the map point, name, and source record refer to the same site; mark uncertainty if the match is weak.";
    }
    if (id === "near_duplicate_name" || id === "same_coordinate_cluster") {
        return "Compare nearby or similarly named records and record related ids if this may be a duplicate, shared building, or separate congregation.";
    }
    if (id === "coordinate_outside_nz_bounds" || id === "coordinate_outside_country_bounds") {
        return `Check the coordinates and record a location problem if the point is outside ${COUNTRY_CONFIG.countryName} or clearly misplaced.`;
    }
    return check?.message || "Review the automated flag and record source-backed evidence if it changes the site assessment.";
}

function uniqueItems(items) {
    const seen = new Set();
    return items.filter(item => {
        const key = String(item || "").trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function hasMissingLifecycleCheck(props) {
    return (props.automated_checks || []).some(check => check.check_id === "missing_osm_lifecycle_date");
}

function deriveTargetYearStatus(props, targetYear) {
    const explicitStatus = props[`target_year_${targetYear}_status`];
    if (explicitStatus && explicitStatus !== "not_assessed") {
        return {
            status: explicitStatus,
            basis: "review target-year field",
            note: props[`target_year_${targetYear}_evidence`] || "Target-year status has been recorded in the task data.",
        };
    }

    const startCandidates = [
        parseLifecycleDate(props.osm_start_date),
        parseLifecycleDate(props.osm_old_start_date),
    ].filter(Boolean).sort((left, right) => left.year - right.year);
    const start = startCandidates[0] || null;
    const end = parseLifecycleDate(props.osm_end_date);
    const lifecycleSummary = lifecycleDateSummary(props);

    if (!start && !end) {
        return {
            status: "not_assessed",
            basis: "missing opening/closure/change-date evidence",
            note: "No OSM start_date, old_start_date, or end_date is recorded. Seek source-backed opening, closure, or changed-use evidence.",
        };
    }

    if (end) {
        const endCompare = compareLifecycleDateToTarget(end, targetYear);
        if (endCompare < 0) {
            return {
                status: "absent",
                basis: "OSM date tag",
                note: `${lifecycleSummary}. OSM end_date falls before ${targetYear}-09-01.`,
            };
        }
        if (endCompare === 0) {
            return {
                status: "uncertain",
                basis: "OSM date tag",
                note: `${lifecycleSummary}. OSM end_date is not precise enough to settle status on ${targetYear}-09-01.`,
            };
        }
    }

    if (start) {
        const startCompare = compareLifecycleDateToTarget(start, targetYear);
        if (startCompare < 0) {
            return {
                status: "present",
                basis: "OSM date tag",
                note: `${lifecycleSummary}. OSM start evidence falls before ${targetYear}-09-01.`,
            };
        }
        if (startCompare > 0) {
            return {
                status: "absent",
                basis: "OSM date tag",
                note: `${lifecycleSummary}. OSM start evidence falls after ${targetYear}-09-01.`,
            };
        }
        return {
            status: "uncertain",
            basis: "OSM date tag",
            note: `${lifecycleSummary}. OSM start evidence falls in ${targetYear} but is not precise enough to settle status on ${targetYear}-09-01.`,
        };
    }

    return {
        status: "uncertain",
        basis: "OSM date tag",
        note: `${lifecycleSummary}. OSM end evidence exists but no start evidence is recorded.`,
    };
}

function osmObjectUrl(osmType, osmId) {
    if (!osmType || !osmId) return "";
    return `https://www.openstreetmap.org/${encodeURIComponent(osmType)}/${encodeURIComponent(osmId)}`;
}

function backendTaskAction(task, context) {
    if (context.case_type === "control_confirmation") return "review_when_sampling";
    if (task.task_type === "possible_duplicate") return "possible_duplicate";
    if (task.task_type === "missing_from_project_map") return "missing_current_site";
    return "needs_human_review";
}

function backendTargetYearFields(context) {
    const statuses = context.target_year_statuses || {};
    return Object.fromEntries(TARGET_YEARS.flatMap(year => {
        const entry = statuses[year] || {};
        return [
            [`target_year_${year}_status`, entry.status || "not_assessed"],
            [`target_year_${year}_basis`, entry.basis || ""],
            [`target_year_${year}_evidence`, entry.evidence || ""],
        ];
    }));
}

function searchUrlForTask(name, locality) {
    const query = [name, locality, COUNTRY_CONFIG.countryName, "place of worship"].filter(Boolean).join(" ");
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function mapUrlForCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return "";
    const [lng, lat] = coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function streetViewUrlForCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return "";
    const [lng, lat] = coordinates;
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${lat},${lng}`)}`;
}

function featureFromBackendTask(task) {
    const context = task.source_context || {};
    const coordinates = task.geometry?.coordinates || [];
    const osmUrl = context.osm_object_url || osmObjectUrl(task.osm_object_type, task.matched_osm_id);
    const osmHistoryUrl = task.osm_object_type && task.matched_osm_id ? `${osmUrl}/history` : "";
    const originTag = context.origin_tag || "";
    const originRaw = context.origin_raw || "";
    const closureRaw = context.closure_raw || "";
    const properties = {
        task_id: task.task_id,
        master_snapshot_id: ASSIGNMENT_BATCH_ID || task.batch_id || "",
        master_site_id: task.matched_current_site_id || context.matched_current_project_id || "",
        source_record_id: task.source_record_id || context.source_record_id || "",
        batch_id: task.batch_id || "",
        country_code: task.country_code || COUNTRY_CONFIG.countryCode,
        name: task.name || context.latest_name || context.matched_current_name || "Unnamed place of worship",
        address: task.address || "",
        locality: task.locality || "",
        religion: context.religion || "",
        denomination: context.denomination || "",
        verification_priority: task.priority || "medium",
        automated_suggested_action: backendTaskAction(task, context),
        automated_check_count: (task.automated_checks || []).length,
        automated_checks: task.automated_checks || [],
        task_brief: task.task_brief || context.main_question || "",
        source_hints: context.source_hints || "",
        selection_reason: context.selection_reason || "",
        case_type: context.case_type || task.task_type || "",
        osm_object_url: osmUrl,
        osm_history_url: osmHistoryUrl,
        osm_map_url: osmUrl,
        google_maps_url: mapUrlForCoordinates(coordinates),
        street_view_url: streetViewUrlForCoordinates(coordinates),
        search_queries: {
            name_locality: {
                google_url: searchUrlForTask(task.name || context.latest_name || "", task.locality || ""),
            },
        },
        osm_type: task.osm_object_type || "",
        osm_id: task.matched_osm_id || "",
        osm_start_date: originTag === "start_date" ? originRaw : "",
        osm_old_start_date: originTag === "old_start_date" ? originRaw : "",
        osm_end_date: closureRaw,
        osm_lifecycle_date_notes: context.osm_date_tags_by_year || "",
        source_context: context,
        ...backendTargetYearFields(context),
    };
    return {
        type: "Feature",
        geometry: task.geometry || { type: "Point", coordinates: [] },
        properties,
    };
}

function actionLabel(action) {
    if (action === "needs_human_review") return "Needs human review";
    if (action === "review_when_sampling") return "Spot-check in sample";
    if (action === "candidate_no_action") return "Candidate no action";
    return cap(action);
}

class NzVerificationMap {
    constructor() {
        this.map = null;
        this.markerLayer = null;
        this.tasks = [];
        this.filteredTasks = [];
        this.markersByTaskId = new Map();
        this.selectedTask = null;
        this.visibleLimit = 80;
        this.targetYear = DEFAULT_TARGET_YEAR;
        this.sessionEntries = this.readSessionLog();
        this.backend = window.PowConvexTaskClient
            ? new window.PowConvexTaskClient({
                ...(window.POW_CONVEX_CONFIG || {}),
                countryCode: COUNTRY_CONFIG.countryCode,
            })
            : null;
        this.backendUser = null;
        this.backendTasksById = new Map();
        this.backendLastError = "";
        this.init();
    }

    readSessionLog() {
        try {
            const currentKey = this.sessionLogKey();
            const raw = localStorage.getItem(currentKey)
                || localStorage.getItem(COUNTRY_SESSION_LOG_KEY)
                || (COUNTRY_CONFIG.countryCode === "NZ" ? localStorage.getItem(LEGACY_SESSION_LOG_KEY) : "");
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const entries = Array.isArray(parsed) ? parsed : [];
            if (entries.length && !localStorage.getItem(currentKey)) {
                localStorage.setItem(currentKey, JSON.stringify(entries));
            }
            return entries;
        } catch (error) {
            console.warn("Could not read session log:", error);
            return [];
        }
    }

    writeSessionLog() {
        try {
            localStorage.setItem(this.sessionLogKey(), JSON.stringify(this.sessionEntries));
        } catch (error) {
            console.warn("Could not save session log:", error);
        }
    }

    appendSessionEntry(entry) {
        this.sessionEntries.push(entry);
        this.writeSessionLog();
        this.renderSessionPanel();
        this.renderTaskList();
    }

    clearSessionLog() {
        const ok = window.confirm(
            "Clear your session log? This removes the local record of copied or skipped demo rows."
        );
        if (!ok) return;
        this.sessionEntries = [];
        this.writeSessionLog();
        this.renderSessionPanel();
        this.renderTaskList();
    }

    sessionTaskOutcome(taskId) {
        if (!taskId) return null;
        for (let i = this.sessionEntries.length - 1; i >= 0; i -= 1) {
            const entry = this.sessionEntries[i];
            if (entry?.task_id === taskId) return entry;
        }
        return null;
    }

    getRaInitials() {
        try {
            return localStorage.getItem(RA_INITIALS_KEY)
                || (COUNTRY_CONFIG.countryCode === "NZ" ? localStorage.getItem(LEGACY_RA_INITIALS_KEY) : "")
                || "";
        } catch (error) {
            return "";
        }
    }

    sessionLogKey(initials = this.getRaInitials()) {
        const suffix = String(initials || "anon")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-|-$/g, "")
            || "anon";
        return `${SESSION_LOG_KEY_PREFIX}${suffix}`;
    }

    setRaInitials(value) {
        const previousKey = this.sessionLogKey();
        const trimmed = String(value || "").trim().slice(0, 8);
        try {
            if (trimmed) {
                localStorage.setItem(RA_INITIALS_KEY, trimmed);
            } else {
                localStorage.removeItem(RA_INITIALS_KEY);
            }
            const nextKey = this.sessionLogKey(trimmed);
            if (previousKey !== nextKey && this.sessionEntries?.length) {
                const existing = localStorage.getItem(nextKey);
                if (existing) {
                    const parsed = JSON.parse(existing);
                    this.sessionEntries = Array.isArray(parsed) ? parsed : this.sessionEntries;
                } else {
                    localStorage.setItem(nextKey, JSON.stringify(this.sessionEntries));
                }
            }
        } catch (error) {
            console.warn("Could not save RA initials:", error);
        }
        this.renderRaInitialsBadge();
        this.renderSessionPanel();
        this.renderTaskList();
    }

    promptForRaInitials(force) {
        const current = this.getRaInitials();
        if (!force && current) return current;
        const value = window.prompt(
            "Enter your initials so JB knows who recorded each row (max 8 characters). Stored only on this browser.",
            current || ""
        );
        if (value === null) return current;
        this.setRaInitials(value);
        return this.getRaInitials();
    }

    renderRaInitialsBadge() {
        const host = document.getElementById("modeNotice");
        if (!host) return;
        let badge = document.getElementById("raInitialsBadge");
        if (!DEMO_MODE) {
            if (badge) badge.remove();
            return;
        }
        const initials = this.getRaInitials();
        const text = initials ? `RA: ${initials}` : "RA: not set";
        if (!badge) {
            badge = document.createElement("span");
            badge.id = "raInitialsBadge";
            badge.className = "ra-initials";
            host.appendChild(badge);
        }
        badge.innerHTML = `${escapeHtml(text)}<button type="button" id="raInitialsEdit" title="Change RA initials stored on this browser">Change</button>`;
        document.getElementById("raInitialsEdit")?.addEventListener("click", () => {
            this.promptForRaInitials(true);
        });
    }

    renderBackendPanel() {
        const panel = document.getElementById("backendPanel");
        if (!panel) return;
        const assignmentLabel = ASSIGNMENT_MODE
            ? `<span>Assigned batch: <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong></span>`
            : "";
        if (!this.backend?.configured) {
            panel.innerHTML = `
                <div class="backend-card disabled">
                    <strong>${ASSIGNMENT_MODE ? "Sign-in required" : "Shared task backend"}</strong>
                    ${assignmentLabel}
                    <span>${ASSIGNMENT_MODE
                        ? "This assignment needs the shared backend. Ask JB for the backend-enabled link before starting."
                        : "Not configured on this deployment. The page is using the local demo and spreadsheet fallback."}</span>
                </div>
            `;
            return;
        }

        if (!this.backendUser) {
            panel.innerHTML = `
                <div class="backend-card auth-required">
                    <strong>${ASSIGNMENT_MODE ? "1. Sign in to start" : "Shared task backend"}</strong>
                    ${assignmentLabel}
                    <span>${ASSIGNMENT_MODE
                        ? "Use the Google account JB invited. Your assigned tasks load after sign-in, and saved work goes straight to the shared review queue."
                        : "Sign in with Google to load assigned tasks and save evidence directly for review."}</span>
                    <div id="googleSignInButton" class="google-sign-in-host"></div>
                    <span class="backend-help">The Google button shows accounts already signed into this browser. If the wrong name appears, choose another Google account or use a browser profile signed into the invited account.</span>
                    ${this.backendLastError ? `<span class="copy-status">${escapeHtml(this.backendLastError)}</span>` : ""}
                </div>
            `;
            this.backend.renderSignInButton(document.getElementById("googleSignInButton"), {
                initials: this.getRaInitials(),
                onSignedIn: async user => {
                    this.backendUser = user;
                    await this.refreshBackendTasks();
                    this.renderBackendPanel();
                    this.applyFilters();
                    if (this.selectedTask) {
                        this.renderDetail(this.selectedTask);
                    }
                },
                onError: error => {
                    this.backendLastError = error.message || "Could not sign in to the shared backend.";
                    this.renderBackendPanel();
                },
            }).catch(error => {
                this.backendLastError = error.message || "Could not initialise sign-in.";
                this.renderBackendPanel();
            });
            return;
        }

        const label = this.backendUser.initials || this.backendUser.email || "signed in";
        panel.innerHTML = `
            <div class="backend-card signed-in">
                <strong>${ASSIGNMENT_MODE ? "Signed in. Choose a task below." : "Shared task backend"}</strong>
                ${assignmentLabel}
                <span>Signed in as ${escapeHtml(label)}. ${ASSIGNMENT_MODE ? `${this.backendTasksById.size} assigned task${this.backendTasksById.size === 1 ? "" : "s"} loaded.` : "Saves and submissions go to Convex for reviewer follow-up."}</span>
                <div class="backend-actions">
                    <button type="button" class="secondary" id="refreshBackendTasksButton">Refresh task state</button>
                    <button type="button" class="tertiary" id="signOutButton">Sign out</button>
                </div>
            </div>
        `;
        document.getElementById("refreshBackendTasksButton")?.addEventListener("click", async () => {
            await this.refreshBackendTasks();
            this.applyFilters();
            if (this.selectedTask) {
                this.renderDetail(this.selectedTask);
            }
        });
        document.getElementById("signOutButton")?.addEventListener("click", () => this.signOutBackend());
    }

    signOutBackend() {
        this.backend?.signOut();
        this.backendUser = null;
        this.backendTasksById.clear();
        this.backendLastError = "";
        if (ASSIGNMENT_MODE) {
            this.tasks = [];
            this.filteredTasks = [];
            this.selectedTask = null;
            this.markerLayer?.clearLayers();
            const snapshotEl = document.getElementById("snapshotId");
            if (snapshotEl) {
                snapshotEl.textContent = `${ASSIGNMENT_BATCH_ID} | sign in to load assigned tasks`;
            }
            this.renderInitialDetail();
        }
        this.renderBackendPanel();
        this.applyFilters();
    }

    async init() {
        this.setupMap();
        this.setupPageMode();
        this.setupFilters();
        this.renderBackendPanel();
        await this.loadTasks();
        await this.refreshBackendTasks();
        this.applyFilters();
        this.renderSessionPanel();
        if (DEMO_MODE) {
            this.renderRaInitialsBadge();
            // Defer the initials prompt so the map paints first.
            setTimeout(() => this.promptForRaInitials(false), 250);
        }
    }

    renderSessionPanel() {
        const panel = document.getElementById("sessionPanel");
        if (!panel) return;
        if (!DEMO_MODE || ASSIGNMENT_MODE) {
            panel.innerHTML = "";
            return;
        }
        const entries = this.sessionEntries.slice().reverse();
        const recent = entries.slice(0, SESSION_RECENT_LIMIT);
        const total = entries.length;
        const copied = entries.filter(e => e?.type === "copied").length;
        const skipped = entries.filter(e => e?.type === "skipped").length;

        panel.innerHTML = `
            <details ${total > 0 ? "open" : ""}>
                <summary>My session
                    <span class="ra-initials">${escapeHtml(`${total} entr${total === 1 ? "y" : "ies"}: ${copied} tentatively closed, ${skipped} skipped`)}</span>
                </summary>
                ${total === 0 ? `
                    <div class="session-empty">No rows copied or skipped yet on this browser.</div>
                ` : `
                    <div class="session-entries" role="list">
                        ${recent.map((entry, idx) => this.sessionEntryHtml(entry, idx)).join("")}
                    </div>
                    <div class="session-buttons">
                        <button type="button" id="sessionExportButton">Export session JSON</button>
                        <button type="button" class="danger" id="sessionClearButton">Clear session</button>
                    </div>
                    <div class="session-empty">The JSON export is a local demo log. It does not upload or submit data.</div>
                `}
            </details>
        `;

        document.getElementById("sessionExportButton")?.addEventListener("click", () => this.exportSession());
        document.getElementById("sessionClearButton")?.addEventListener("click", () => this.clearSessionLog());
        panel.querySelectorAll(".session-recopy").forEach(btn => {
            btn.addEventListener("click", () => this.recopyEntry(Number(btn.dataset.entryIndex)));
        });
        panel.querySelectorAll(".session-open").forEach(btn => {
            btn.addEventListener("click", () => this.selectTaskById(btn.dataset.taskId));
        });
    }

    sessionEntryHtml(entry, displayIndex) {
        const when = (entry.copied_at || entry.skipped_at || "").slice(11, 19);
        const isSkipped = entry.type === "skipped";
        const cls = isSkipped ? "session-entry skipped" : "session-entry";
        const label = isSkipped ? "skipped" : (entry.action_label || entry.action || "copied");
        const initials = entry.ra_initials ? ` · ${escapeHtml(entry.ra_initials)}` : "";
        const reason = isSkipped && entry.reason ? `<div class="entry-meta">Reason: ${escapeHtml(entry.reason)}</div>` : "";
        const reissue = isSkipped ? "" : `
            <button type="button" class="secondary session-recopy" data-entry-index="${displayIndex}">Re-copy row</button>
        `;
        const open = entry.task_id ? `
            <button type="button" class="tertiary session-open" data-task-id="${escapeHtml(entry.task_id)}">Open task</button>
        ` : "";
        return `
            <div class="${cls}" role="listitem">
                <span class="entry-title">${escapeHtml(entry.name || "Unnamed site")}</span>
                <span class="entry-meta">${escapeHtml(when)} · ${escapeHtml(label)}${initials}</span>
                ${reason}
                <div class="entry-actions">${reissue}${open}</div>
            </div>
        `;
    }

    async recopyEntry(displayIndex) {
        // Reverse-display index back into the absolute index.
        const reversed = this.sessionEntries.slice().reverse();
        const entry = reversed[displayIndex];
        if (!entry || entry.type !== "copied" || !entry.tsv) {
            window.alert("This session entry has no copyable row.");
            return;
        }
        try {
            await navigator.clipboard.writeText(entry.tsv);
            window.alert("Copied the previous row again.");
        } catch (error) {
            window.prompt("Could not auto-copy. Select and copy manually:", entry.tsv);
        }
    }

    exportSession() {
        const blob = new Blob([JSON.stringify(this.sessionEntries, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const initials = this.getRaInitials() || "anon";
        link.download = `pow-${COUNTRY_CONFIG.countryCode.toLowerCase()}-ra-session-${slug(initials, 16)}-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    setupMap() {
        this.map = L.map("map", { preferCanvas: true }).setView(COUNTRY_CONFIG.mapCentre, COUNTRY_CONFIG.mapZoom);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            minZoom: 5,
        }).addTo(this.map);

        this.markerLayer = L.layerGroup();
        this.map.addLayer(this.markerLayer);
    }

    setupPageMode() {
        document.title = `${COUNTRY_CONFIG.countryName} OSM Verification Tasks`;
        const title = document.querySelector(".sidebar-header h1");
        if (title) {
            title.textContent = `${COUNTRY_CONFIG.countryName} OSM Verification`;
        }

        const notice = document.getElementById("modeNotice");
        if (notice) {
            notice.classList.toggle("demo-warning", DEMO_MODE);
            notice.innerHTML = DEMO_MODE
                ? (ASSIGNMENT_MODE
                    ? (this.backend?.configured
                        ? `Assigned web workpack: <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>. Sign in to load tasks and save evidence. Do not enter private or sensitive data.`
                        : `Assigned web workpack: <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>. The shared backend is not configured here, so the assignment cannot be used on this deployment yet.`)
                    : this.backend?.configured
                    ? "Draft controls enabled. Sign in through the shared backend panel to save or submit evidence. Do not enter private or sensitive data."
                    : "Draft controls enabled. The shared backend is not configured here, so nothing is uploaded or saved until you use the spreadsheet fallback. Do not enter private or sensitive data.")
                : `Inspection only: form controls live in <a href="${escapeHtml(demoUrl())}">demo mode</a>. Nothing is uploaded either way.`;
            notice.setAttribute("role", DEMO_MODE ? "alert" : "note");
        }

        const quickstart = document.getElementById("quickstartBanner");
        const quickstartKey = ASSIGNMENT_MODE
            ? `pow_ra_quickstart_dismissed_v1:${ASSIGNMENT_BATCH_ID}`
            : "pow_ra_quickstart_dismissed_v1";
        if (quickstart && DEMO_MODE && localStorage.getItem(quickstartKey) !== "1") {
            quickstart.innerHTML = `
                <div class="quickstart" role="note">
                    <strong>${ASSIGNMENT_MODE ? "How this assignment works" : "How this pilot works"}</strong>
                    ${ASSIGNMENT_MODE ? `
                        <ol>
                            <li>Sign in with Google at the top of the sidebar.</li>
                            <li>Work down the assigned task list. Start with the first 15 rows or about 90 minutes.</li>
                            <li>Open the source links, especially the OSM object as context, then look for non-OSM evidence where possible.</li>
                            <li>Record 2013, 2018, and 2023 status, confidence, source title, source URL or file reference, and any useful lifecycle date.</li>
                            <li>Use <em>Save draft</em> while working. Use <em>Submit for review</em> when the case is ready for JB.</li>
                        </ol>
                    ` : `
                        <ol>
                            <li>Set <em>Target year</em> and <em>Priority</em> in the filters above.</li>
                            <li>Click a task in the list or on the map.</li>
                            <li>Open the source links in step 1 of the task panel.</li>
                            <li>In step 2, choose what your evidence shows and confirm year statuses.</li>
                            <li>In step 3, paste a short evidence note and the source URL or file reference.</li>
                            <li>In step 4, use <em>Save draft</em> or <em>Submit for review</em> when the shared backend is enabled. Use <em>Copy spreadsheet row</em> only as the fallback.</li>
                        </ol>
                    `}
                    <button type="button" class="quickstart-dismiss" id="quickstartDismiss">Hide this guide</button>
                </div>
            `;
            document.getElementById("quickstartDismiss")?.addEventListener("click", () => {
                quickstart.innerHTML = "";
                localStorage.setItem(quickstartKey, "1");
            });
        } else if (quickstart) {
            quickstart.innerHTML = "";
        }

        const nominationPanel = document.getElementById("nominationPanel");
        if (nominationPanel) {
            nominationPanel.innerHTML = ASSIGNMENT_MODE ? "" : DEMO_MODE ? this.nominationFormHtml() : `
                <div class="disabled-panel">
                    Nominations are disabled for this feedback pilot. Use the map for inspection and send notes separately.
                    To inspect mock entry fields, <a href="${escapeHtml(demoUrl())}">open demo mode</a>.
                </div>
            `;
        }

        this.renderInitialDetail();
    }

    setupFilters() {
        ["searchInput", "priorityFilter", "actionFilter", "statusFilter"].forEach(id => {
            const element = document.getElementById(id);
            element?.addEventListener("input", () => this.applyFilters());
            element?.addEventListener("change", () => this.applyFilters());
        });

        const targetYearSelect = document.getElementById("targetYearSelect");
        if (targetYearSelect) {
            targetYearSelect.innerHTML = TARGET_YEARS.slice().reverse().map(year => `
                <option value="${escapeHtml(year)}">${escapeHtml(year)}</option>
            `).join("");
            targetYearSelect.value = this.targetYear;
            targetYearSelect.addEventListener("change", () => {
                this.targetYear = TARGET_YEARS.includes(targetYearSelect.value)
                    ? targetYearSelect.value
                    : DEFAULT_TARGET_YEAR;
                this.applyFilters();
                if (this.selectedTask) {
                    this.renderDetail(this.selectedTask);
                }
            });
        }

        if (INTAKE_ENABLED) {
            document.getElementById("copyNominationButton")?.addEventListener("click", () => this.copyNomination());
        }
    }

    async loadTasks() {
        if (ASSIGNMENT_MODE) {
            this.tasks = [];
            const snapshotEl = document.getElementById("snapshotId");
            if (snapshotEl) {
                snapshotEl.textContent = this.backend?.configured
                    ? `${ASSIGNMENT_BATCH_ID} | sign in to load assigned tasks`
                    : `${ASSIGNMENT_BATCH_ID} | shared backend not configured`;
            }
            return;
        }
        if (!COUNTRY_CONFIG.dataPath) {
            this.tasks = [];
            const snapshotEl = document.getElementById("snapshotId");
            if (snapshotEl) {
                snapshotEl.textContent = `${COUNTRY_CONFIG.countryName} task data not configured`;
            }
            return;
        }
        const response = await fetch(dataUrl("verification_tasks.geojson"));
        if (!response.ok) {
            throw new Error(`Failed to load verification tasks: ${response.status}`);
        }
        const geojson = await response.json();
        this.tasks = geojson.features || [];

        const snapshotEl = document.getElementById("snapshotId");
        if (snapshotEl) {
            const meta = geojson.metadata || {};
            snapshotEl.textContent = `${meta.master_snapshot_id || "unknown snapshot"} | ${meta.feature_count || this.tasks.length} tasks`;
        }
    }

    async refreshBackendTasks() {
        if (!this.backend?.configured || !this.backend.signedIn) return;
        try {
            const query = {
                countryCode: COUNTRY_CONFIG.countryCode,
                limit: 1000,
            };
            if (ASSIGNMENT_MODE) {
                query.batchId = ASSIGNMENT_BATCH_ID;
            }
            const tasks = await this.backend.listTasks(query);
            this.backendTasksById = new Map((tasks || []).map(task => [task.task_id, task]));
            if (ASSIGNMENT_MODE) {
                this.tasks = (tasks || []).map(featureFromBackendTask);
                const snapshotEl = document.getElementById("snapshotId");
                if (snapshotEl) {
                    snapshotEl.textContent = `${ASSIGNMENT_BATCH_ID} | ${this.tasks.length} assigned task${this.tasks.length === 1 ? "" : "s"}`;
                }
                if (this.selectedTask && !this.backendTasksById.has(this.selectedTask.properties?.task_id)) {
                    this.selectedTask = null;
                    this.renderInitialDetail();
                }
            }
            this.backendLastError = "";
            this.renderBackendPanel();
        } catch (error) {
            this.backendLastError = error.message || "Could not refresh shared task state.";
            this.renderBackendPanel();
        }
    }

    applyFilters() {
        const search = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
        const priority = document.getElementById("priorityFilter")?.value || "all";
        const action = document.getElementById("actionFilter")?.value || "all";
        const status = document.getElementById("statusFilter")?.value || "all";

        this.filteredTasks = this.tasks.filter(feature => {
            const props = feature.properties || {};
            const temporal = deriveTargetYearStatus(props, this.targetYear);
            const searchText = [
                props.name,
                props.address,
                props.master_site_id,
                props.source_record_id,
                props.osm_id,
                props.religion,
                props.denomination,
                props.case_type,
                props.task_brief,
            ].join(" ").toLowerCase();

            if (search && !searchText.includes(search)) return false;
            if (priority !== "all" && props.verification_priority !== priority) return false;
            if (action !== "all" && props.automated_suggested_action !== action) return false;
            if (status !== "all" && temporal.status !== status) return false;
            return true;
        });

        this.renderMarkers();
        this.renderTaskList();
        this.updateStats();
    }

    renderMarkers() {
        this.markerLayer.clearLayers();
        this.markersByTaskId.clear();

        this.filteredTasks.forEach(feature => {
            const coordinates = feature.geometry?.coordinates || [];
            if (coordinates.length < 2) return;
            const [lng, lat] = coordinates;
            const props = feature.properties || {};
            const temporal = deriveTargetYearStatus(props, this.targetYear);
            const marker = L.marker([lat, lng], {
                icon: this.createIcon(props.verification_priority, temporal.status),
                title: props.name || props.master_site_id,
            });

            marker.on("click", () => this.selectTask(feature, true));
            marker.bindPopup(this.popupHtml(props), { maxWidth: 360 });
            marker.on("popupopen", event => this.bindPopupOpenTask(event.popup));
            this.markerLayer.addLayer(marker);
            this.markersByTaskId.set(props.task_id, marker);
        });
    }

    createIcon(priority, status) {
        const size = priority === "high" ? 15 : priority === "medium" ? 13 : 11;
        const color = statusColor(status);
        return L.divIcon({
            className: "",
            html: `<div class="verification-marker" style="width:${size}px;height:${size}px;background:${color};"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }

    popupHtml(props) {
        const temporal = deriveTargetYearStatus(props, this.targetYear);
        return `
            <strong>${escapeHtml(props.name || "Unnamed site")}</strong><br>
            <span>${escapeHtml(cap(props.religion))}${props.denomination ? ` | ${escapeHtml(cap(props.denomination))}` : ""}</span><br>
            <span>Priority: ${escapeHtml(props.verification_priority)}</span><br>
            <span>${escapeHtml(this.targetYear)}: ${escapeHtml(statusLabel(temporal.status))} (${escapeHtml(temporal.basis)})</span><br>
            <span>Action: ${escapeHtml(actionLabel(props.automated_suggested_action))}</span><br>
            <button class="popup-open-task" type="button" data-task-id="${escapeHtml(props.task_id)}">Open task</button>
        `;
    }

    bindPopupOpenTask(popup) {
        const button = popup.getElement()?.querySelector(".popup-open-task");
        if (!button) return;
        button.addEventListener("click", () => {
            this.selectTaskById(button.dataset.taskId, { focusDetail: true });
        });
    }

    renderTaskList() {
        const taskList = document.getElementById("taskList");
        if (!taskList) return;

        const visible = this.filteredTasks.slice(0, this.visibleLimit);
        if (visible.length === 0) {
            taskList.innerHTML = `
                <div class="disabled-panel">
                    ${ASSIGNMENT_MODE
                        ? (this.backend?.configured && this.backendUser
                            ? "No assigned tasks are currently visible. Refresh task state or clear filters."
                            : "Sign in with Google to load this assigned workpack.")
                        : "No tasks match the current filters."}
                </div>
            `;
            return;
        }
        taskList.innerHTML = visible.map(feature => {
            const props = feature.properties || {};
            const temporal = deriveTargetYearStatus(props, this.targetYear);
            const activeClass = this.selectedTask?.properties?.task_id === props.task_id ? " active" : "";
            const backendTask = this.backendTasksById.get(props.task_id);
            const backendBadge = backendTask
                ? `<span class="backend-badge">${escapeHtml(backendTask.status.replaceAll("_", " "))}</span>`
                : "";
            const outcome = this.sessionTaskOutcome(props.task_id);
            const outcomeBadge = backendBadge || (outcome
                ? (outcome.type === "skipped"
                    ? `<span class="skip-badge">skipped</span>`
                    : `<span class="closed-badge">tentatively closed</span>`)
                : "");
            return `
                <button class="task-row${activeClass}" type="button" data-task-id="${escapeHtml(props.task_id)}">
                    <span class="task-row-title">
                        <span class="priority-dot priority-${escapeHtml(props.verification_priority)}"></span>
                        ${escapeHtml(props.name || "Unnamed site")}${outcomeBadge}
                    </span>
                    <span class="status-pill ${statusClass(temporal.status)}">${escapeHtml(this.targetYear)}: ${escapeHtml(statusLabel(temporal.status))}</span>
                    <span class="task-row-meta">${escapeHtml(cap(props.religion)) || "Unknown"} | ${escapeHtml(props.master_site_id || props.source_record_id || "")}</span>
                    <span class="task-row-meta">${escapeHtml(actionLabel(props.automated_suggested_action))} | ${props.automated_check_count} checks</span>
                </button>
            `;
        }).join("");

        taskList.querySelectorAll(".task-row").forEach(row => {
            row.addEventListener("click", () => this.selectTaskById(row.dataset.taskId));
        });

        if (this.filteredTasks.length > this.visibleLimit) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "secondary";
            more.textContent = `Show ${Math.min(80, this.filteredTasks.length - this.visibleLimit)} more`;
            more.addEventListener("click", () => {
                this.visibleLimit += 80;
                this.renderTaskList();
            });
            taskList.appendChild(more);
        }
    }

    updateStats() {
        const shown = this.filteredTasks.length;
        const high = this.filteredTasks.filter(feature => feature.properties?.verification_priority === "high").length;
        const present = this.filteredTasks.filter(feature => deriveTargetYearStatus(feature.properties || {}, this.targetYear).status === "present").length;
        const missingLifecycle = this.filteredTasks.filter(feature => hasMissingLifecycleCheck(feature.properties || {})).length;
        document.getElementById("shownCount").textContent = shown.toLocaleString();
        document.getElementById("highCount").textContent = high.toLocaleString();
        document.getElementById("presentCount").textContent = present.toLocaleString();
        document.getElementById("lifecycleNeededCount").textContent = missingLifecycle.toLocaleString();
    }

    selectTaskById(taskId, options = {}) {
        const task = this.tasks.find(feature => feature.properties?.task_id === taskId);
        if (task) {
            this.selectTask(task, false, options);
        }
    }

    selectTask(feature, fromMarker, options = {}) {
        this.selectedTask = feature;
        const props = feature.properties || {};
        const coordinates = feature.geometry?.coordinates || [];
        const [lng, lat] = coordinates;

        if (!fromMarker && coordinates.length >= 2) {
            this.map.setView([lat, lng], Math.max(this.map.getZoom(), 16));
            const marker = this.markersByTaskId.get(props.task_id);
            if (marker) {
                marker.openPopup();
            }
        }

        this.renderTaskList();
        this.renderDetail(feature);
        if (options.focusDetail) {
            this.focusDetailPanel();
        }
    }

    focusDetailPanel() {
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        panel.scrollTop = 0;
        panel.focus({ preventScroll: true });
        panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    renderInitialDetail() {
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        if (ASSIGNMENT_MODE) {
            panel.innerHTML = `
                <h2>Assigned web workpack</h2>
                <div class="${this.backend?.configured ? "pilot-note" : "demo-warning"}" role="${this.backend?.configured ? "note" : "alert"}">
                    ${this.backend?.configured
                        ? `Sign in with Google at the top of the sidebar, then work through <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>. Use <em>Save draft</em> while working and <em>Submit for review</em> when a case is ready for JB.`
                        : `This link points to <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>, but this deployment does not yet have the shared backend enabled.`}
                </div>
                <div class="detail-section">
                    <h3>What to check</h3>
                    <div class="disabled-panel">
                        For each assigned case, answer the task question, seek non-OSM evidence where possible, record 2013, 2018, and 2023 status, preserve any useful opening or closure dates, and mark difficult cases as needing review.
                    </div>
                </div>
            `;
            return;
        }
        panel.innerHTML = DEMO_MODE ? `
            <h2>Mock entry preview</h2>
            <div class="demo-warning" role="alert">
                Nothing entered here is saved or submitted. Do not enter private or sensitive data.
            </div>
            <div class="detail-section">
                <h3>RA action builder</h3>
                <div class="disabled-panel">
                    Select any task from the list or map to generate a spreadsheet-ready evidence row and review JSON.
                </div>
            </div>
            <div class="detail-section">
                <h3>New or missing sites</h3>
                <div class="disabled-panel">
                    Use the draft nomination form in the sidebar to inspect fields for a site missing from the project map, a lost site, or a shared or changed site. OSM may already have a candidate object; record that id as evidence rather than as the project site id.
                </div>
                <button type="button" class="secondary" id="openNominationPanelButton">Open draft nomination form</button>
            </div>
        ` : `
            <h2>Read-only pilot</h2>
            <div class="disabled-panel">
                Select a task to inspect the current record. Entry controls are available only in
                <a href="${escapeHtml(demoUrl())}">demo mode</a>, where nothing is saved or submitted.
            </div>
        `;
        document.getElementById("openNominationPanelButton")?.addEventListener("click", () => {
            this.focusNominationPanel();
        });
    }

    focusNominationPanel() {
        const panel = document.getElementById("nominationPanel");
        const details = document.getElementById("nominationDetails");
        if (!panel) return;
        if (details) details.open = true;
        panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
        const firstInput = panel.querySelector("select, input, textarea, button");
        firstInput?.focus({ preventScroll: true });
    }

    backendStatusHtml(props) {
        if (!this.backend?.configured) return "";
        const backendTask = this.backendTasksById.get(props.task_id);
        if (!this.backendUser) {
            return `
                <div class="pilot-note">
                    Sign in from the sidebar to save this task directly to the shared review backend.
                </div>
            `;
        }
        if (!backendTask) {
            return `
                <div class="demo-warning" role="alert">
                    This task is not in Convex yet. Ask JB to seed the current task batch before saving evidence here.
                </div>
            `;
        }
        return `
            <div class="pilot-note">
                Shared backend status: <strong>${escapeHtml(backendTask.status.replaceAll("_", " "))}</strong>.
            </div>
        `;
    }

    renderDetail(feature) {
        const props = feature.properties || {};
        const checks = props.automated_checks || [];
        const searches = props.search_queries || {};
        const panel = document.getElementById("detailPanel");
        if (!panel) return;

        panel.innerHTML = `
            <h2>${escapeHtml(props.name || "Unnamed site")}</h2>
            ${this.backendStatusHtml(props)}
            ${INTAKE_ENABLED ? this.workflowStepsHtml("inspect") : ""}

            <div class="detail-section">
                ${this.siteTaskBriefHtml(props)}
            </div>

            <div class="detail-section">
                <h3>1. Open source links</h3>
                <div class="link-grid">
                    ${this.linkHtml("OSM object", props.osm_object_url)}
                    ${this.linkHtml("OSM history", props.osm_history_url)}
                    ${this.linkHtml("OSM map", props.osm_map_url)}
                    ${this.linkHtml("Google Maps", props.google_maps_url)}
                    ${this.linkHtml("Street View", props.street_view_url)}
                    ${this.linkHtml("Name search", searches.name_locality?.google_url)}
                </div>
            </div>

            <div class="detail-section">
                ${INTAKE_ENABLED ? this.reviewFormHtml() : this.disabledIntakeHtml()}
            </div>

            <div class="detail-section">
                ${this.temporalSummaryHtml(props)}
            </div>

            <div class="detail-section">
                <h3>Reference</h3>
                <dl class="kv">
                    <dt>Priority</dt><dd>${escapeHtml(props.verification_priority)}</dd>
                    <dt>Map suggestion</dt><dd>${escapeHtml(actionLabel(props.automated_suggested_action))}</dd>
                    <dt>Master id</dt><dd>${escapeHtml(props.master_site_id)}</dd>
                    <dt>OSM</dt><dd>${escapeHtml(props.osm_type || "")} ${escapeHtml(props.osm_id || "")}</dd>
                    <dt>Religion</dt><dd>${escapeHtml(cap(props.religion)) || "Unknown"}</dd>
                    <dt>Denom.</dt><dd>${escapeHtml(cap(props.denomination)) || "Unknown"}</dd>
                    <dt>Address</dt><dd>${escapeHtml(props.address || "Missing")}</dd>
                    <dt>Start date</dt><dd>${escapeHtml(props.osm_start_date || "Missing")}</dd>
                    <dt>Old start</dt><dd>${escapeHtml(props.osm_old_start_date || "Missing")}</dd>
                    <dt>End date</dt><dd>${escapeHtml(props.osm_end_date || "Missing")}</dd>
                </dl>
            </div>

            <div class="detail-section">
                <h3>Automated checks</h3>
                <ul class="check-list">
                    ${checks.length ? checks.map(check => `
                        <li>
                            <strong>${escapeHtml(check.severity)} | ${escapeHtml(check.check_id)}</strong><br>
                            ${escapeHtml(check.message)}<br>
                            <span>${escapeHtml(check.suggested_action)}</span>
                        </li>
                    `).join("") : "<li><strong>info | no_flags</strong><br>No automated checks flagged this record.</li>"}
                </ul>
            </div>
        `;

        if (INTAKE_ENABLED) {
            this.bindRaActionForm(props);
        }
    }

    siteTaskBriefHtml(props) {
        const checks = props.automated_checks || [];
        const focus = taskFocusForAction(props.automated_suggested_action, props.verification_priority);
        const temporal = deriveTargetYearStatus(props, this.targetYear);
        const context = props.source_context || {};
        const briefText = props.task_brief || focus.text;
        const checklist = uniqueItems([
            "Confirm that the source evidence refers to this site, not only a similarly named organisation or nearby building.",
            `Assess worship-use status for ${this.targetYear}. The current map aid says ${statusLabel(temporal.status).toLowerCase()}; verify with sources.`,
            context.andre_check || "",
            ...checks.map(checklistItemForCheck),
            "Record the closest supported action, target-year statuses, source title, URL or file reference, and a short evidence note.",
        ]);
        const actionHint = actionLabel(props.automated_suggested_action);
        return `
            <h3>Your task for this site</h3>
            <div class="task-brief">
                <div class="task-brief-header">
                    <span class="task-focus">${escapeHtml(focus.label)}</span>
                    <span class="status-pill ${statusClass(temporal.status)}">${escapeHtml(this.targetYear)}: ${escapeHtml(statusLabel(temporal.status))}</span>
                </div>
                <p>${escapeHtml(briefText)}</p>
                ${props.source_hints ? `<p><strong>Source hints:</strong> ${escapeHtml(props.source_hints)}</p>` : ""}
                <ol>
                    ${checklist.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
                </ol>
                <div class="task-brief-footer">
                    Suggested queue: ${escapeHtml(actionHint)} | Priority: ${escapeHtml(props.verification_priority || "unknown")}
                </div>
            </div>
        `;
    }

    workflowStepsHtml(currentStep, doneSteps = []) {
        const steps = [
            { id: "inspect", title: "1. Inspect", subtitle: "Open links" },
            { id: "decide", title: "2. Decide", subtitle: "Choose action" },
            { id: "evidence", title: "3. Evidence", subtitle: "Source + note" },
            { id: "copy", title: "4. Save", subtitle: this.backend?.configured ? "Backend review" : "Fallback copy" },
        ];
        return `
            <div class="workflow-steps" id="workflowSteps">
                ${steps.map(step => {
                    const isDone = doneSteps.includes(step.id);
                    const isActive = step.id === currentStep && !isDone;
                    const cls = isDone ? "done" : isActive ? "active" : "";
                    return `
                        <div class="workflow-step ${cls}" data-step="${step.id}">
                            <strong>${step.title}</strong>
                            <span>${step.subtitle}</span>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }

    updateWorkflowSteps() {
        const stepsEl = document.getElementById("workflowSteps");
        if (!stepsEl) return;
        const action = document.getElementById("raActionSelect")?.value || "needs_review";
        const values = this.currentFormValues();
        const noteTouched = document.getElementById("decisionNote")?.dataset.touched === "1";
        const copied = stepsEl.dataset.copied === "1";

        const decided = action !== "needs_review";
        const evidenced = !this.evidenceInputError(values) && noteTouched;

        const order = ["inspect", "decide", "evidence", "copy"];
        const done = [];
        if (true) done.push("inspect");
        if (decided) done.push("decide");
        if (evidenced) done.push("evidence");
        if (copied) done.push("copy");

        let active = "inspect";
        for (const id of order) {
            if (!done.includes(id)) { active = id; break; }
            active = "copy";
        }

        stepsEl.querySelectorAll(".workflow-step").forEach(el => {
            const id = el.dataset.step;
            el.classList.toggle("done", done.includes(id) && id !== active);
            el.classList.toggle("active", id === active && !done.includes(id) || (id === "copy" && copied));
        });
    }

    temporalSummaryHtml(props) {
        const temporal = deriveTargetYearStatus(props, this.targetYear);
        const lifecycle = lifecycleDateSummary(props) || "No OSM date tag recorded.";
        const missingLifecycle = hasMissingLifecycleCheck(props);
        const status = statusLabel(temporal.status);
        return `
            <h3>Target-year status</h3>
            <div class="temporal-summary">
                <div><span class="status-pill ${statusClass(temporal.status)}">${escapeHtml(this.targetYear)}: ${escapeHtml(status)}</span></div>
                <div><strong>Basis:</strong> ${escapeHtml(temporal.basis)}</div>
                <div><strong>OSM date tags:</strong> ${escapeHtml(lifecycle)}</div>
                <div><strong>Interpretation:</strong> ${escapeHtml(temporal.note)}</div>
                ${missingLifecycle ? "<div><strong>RA task:</strong> seek source-backed opening, first seen, closure, or changed-use evidence.</div>" : ""}
                <div><strong>Status:</strong> provisional map aid only; reviewer decisions must be source-backed.</div>
            </div>
        `;
    }

    formModeNoticeHtml() {
        if (this.backend?.configured && this.backendUser) {
            return `
                <div class="pilot-note">
                    Shared backend enabled. Use <strong>Save draft</strong> or <strong>Submit for review</strong> to record this evidence for review.
                </div>
            `;
        }
        return `
            <div class="demo-warning" role="alert">
                Demo only. This generates local text to paste into the working sheet or send to JB; it does not save or submit data. Do not enter private or sensitive data.
            </div>
        `;
    }

    reviewFormHtml() {
        return `
            <h3>2. Choose what your evidence shows</h3>
            <div class="review-form">
                ${this.formModeNoticeHtml()}
                <label>
                    What did you find?
                    <select id="raActionSelect">
                        <option value="needs_review">Needs review</option>
                        <option value="confirm_current_record">Confirm current site</option>
                        <option value="missing_current_site">Missing from project map</option>
                        <option value="possible_duplicate">Possible duplicate</option>
                        <option value="${escapeHtml(COUNTRY_CONFIG.temporalLossAction.value)}">${escapeHtml(COUNTRY_CONFIG.temporalLossAction.label)}</option>
                        <option value="closed_or_changed_use">Closed or changed use</option>
                        <option value="denomination_or_shared_use">Denomination/shared use</option>
                    </select>
                </label>
                <div class="field-grid">
                    ${targetYearStatusControlsHtml()}
                    <label>
                        Source type
                        <select id="sourceTypeSelect">
                            ${selectOptionsHtml(SOURCE_TYPE_OPTIONS, "osm_history")}
                        </select>
                    </label>
                    <label>
                        Existence status
                        <select id="existenceStatusSelect">
                            ${selectOptionsHtml(EXISTENCE_STATUS_OPTIONS, "uncertain")}
                        </select>
                    </label>
                    <label>
                        Worship-use status
                        <select id="worshipUseStatusSelect">
                            ${selectOptionsHtml(WORSHIP_USE_STATUS_OPTIONS, "uncertain")}
                        </select>
                    </label>
                    <label>
                        Assessment confidence
                        <select id="assessmentConfidenceSelect">
                            ${selectOptionsHtml(ASSESSMENT_CONFIDENCE_OPTIONS, "0.7")}
                        </select>
                    </label>
                    <label>
                        Site-match confidence
                        <select id="matchConfidenceSelect">
                            ${selectOptionsHtml(CONFIDENCE_OPTIONS, "medium")}
                        </select>
                    </label>
                    <label>
                        Location confidence
                        <select id="geocodingConfidenceSelect">
                            ${selectOptionsHtml(CONFIDENCE_OPTIONS, "medium")}
                        </select>
                    </label>
                </div>
                <h3>3. Evidence: where did the answer come from?</h3>
                <label>
                    Provider or observer
                    <input id="sourceProviderInput" type="text" placeholder="e.g. Google Street View, Apple Look Around, Mapillary, RA field observation">
                </label>
                <label>
                    Source title
                    <input id="sourceTitleInput" type="text" placeholder="e.g. Anglican Diocese of Wellington directory 2018, Google Street View imagery">
                </label>
                <label>
                    Source date or imagery capture date
                    <input id="sourceDateInput" type="text" placeholder="e.g. 2018-09, 2023, or 2026-05-03 for a field visit">
                </label>
                <h3>Optional opening, closure, or later change</h3>
                <div class="copy-help">
                    Use this when the source gives a dated opening, closure, first/last seen, relocation, demolition, or later worship-function change. For example, use <em>Use changed / shared use began</em> for evidence that a site became multi-denominational in 2024.
                </div>
                <div class="field-grid">
                    <label>
                        Event type
                        <select id="lifecycleEventSelect">
                            ${selectOptionsHtml(LIFECYCLE_EVENT_OPTIONS, "")}
                        </select>
                    </label>
                    <label>
                        Event date
                        <input id="lifecycleDateInput" type="text" placeholder="YYYY, YYYY-MM, or YYYY-MM-DD">
                    </label>
                    <label>
                        Date precision
                        <select id="lifecycleDatePrecisionSelect">
                            ${selectOptionsHtml(DATE_PRECISION_OPTIONS, "year")}
                        </select>
                    </label>
                    <label>
                        Opening/closure/change note
                        <input id="lifecycleNoteInput" type="text" placeholder="e.g. source says shared Anglican/Methodist use began in 2024">
                    </label>
                </div>
                <div class="source-url-row">
                    <label>
                        Source URL or file reference
                        <input id="sourceUrlInput" type="text" placeholder="https:// link, Street View link, archive, or agreed storage path">
                    </label>
                    <button id="useOsmUrlButton" type="button" class="tertiary" title="Fill the URL field with the OSM record link if your evidence is the OSM record itself">Use OSM URL</button>
                </div>
                <label>
                    Related ids or duplicate note
                    <input id="relatedIdsInput" type="text" placeholder="Other master/OSM ids, if relevant">
                </label>
                <label>
                    Evidence note
                    <textarea id="decisionNote" rows="3" placeholder="One or two sentences explaining what the source says about this site at the target year."></textarea>
                </label>
                <h3>4. Save for review</h3>
                ${this.backend?.configured && this.backendUser ? `
                    <div class="copy-help">
                        Save the evidence to the shared backend. Submitted cases move into JB's review queue.
                    </div>
                    <div class="button-row">
                        <button id="saveDraftButton" type="button">Save draft</button>
                        <button id="submitReviewButton" type="button">Submit for review</button>
                    </div>
                ` : ASSIGNMENT_MODE ? `
                    <div class="demo-warning" role="alert">
                        Sign in with Google at the top of the sidebar before recording this assignment.
                    </div>
                ` : `
                    <div class="copy-help">
                        <strong>Fallback:</strong> Copies one tab-separated row to your clipboard. Switch to the working evidence spreadsheet, click column A in the next empty row under the unchanged header, and paste with <kbd>Cmd</kbd>+<kbd>V</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>V</kbd> (Windows). Nothing is uploaded.
                    </div>
                `}
                ${ASSIGNMENT_MODE ? "" : `
                    <div class="button-row">
                        <button id="copyEvidenceRowButton" class="secondary" type="button">Copy spreadsheet row</button>
                        <button id="copyDecisionButton" type="button">Copy review JSON</button>
                    </div>
                    <textarea id="evidenceRowOutput" class="json-output wide-output" rows="4" readonly></textarea>
                    <textarea id="decisionJsonOutput" class="json-output" rows="5" readonly></textarea>
                `}
                <div id="copyStatus" class="copy-status" aria-live="polite"></div>
                <details class="skip-form">
                    <summary>Nothing to record for this task — skip it</summary>
                    <label>
                        Reason (optional)
                        <input id="skipReasonInput" type="text" placeholder="e.g. evidence already covered by another task">
                    </label>
                    <button type="button" class="skip-confirm" id="skipTaskButton">Skip this task</button>
                </details>
            </div>
        `;
    }

    bindRaActionForm(props) {
        const actionSelect = document.getElementById("raActionSelect");
        const sourceUrl = document.getElementById("sourceUrlInput");
        const sourceTitle = document.getElementById("sourceTitleInput");
        const note = document.getElementById("decisionNote");

        // Source URL and title are intentionally NOT pre-filled. The OSM
        // record is the verification subject, not evidence; pre-filling it
        // produces tautological rows. The "Use OSM URL" button below lets
        // the RA explicitly opt in when their evidence really is OSM itself.

        const applyDefaults = () => {
            this.applyRaActionDefaults(props);
            this.updateWorkflowSteps();
        };
        actionSelect?.addEventListener("change", applyDefaults);
        applyDefaults();

        const useOsmButton = document.getElementById("useOsmUrlButton");
        if (useOsmButton) {
            useOsmButton.addEventListener("click", () => {
                if (sourceUrl) {
                    sourceUrl.value = props.osm_object_url || props.osm_map_url || "";
                    sourceUrl.dispatchEvent(new Event("input", { bubbles: true }));
                }
                if (sourceTitle && !sourceTitle.value) {
                    sourceTitle.value = `OSM ${props.osm_type || ""} ${props.osm_id || ""}`.trim();
                    sourceTitle.dispatchEvent(new Event("input", { bubbles: true }));
                }
                const sourceProvider = document.getElementById("sourceProviderInput");
                if (sourceProvider && !sourceProvider.value) {
                    sourceProvider.value = "OpenStreetMap";
                    sourceProvider.dispatchEvent(new Event("input", { bubbles: true }));
                }
                const sourceTypeSelect = document.getElementById("sourceTypeSelect");
                if (sourceTypeSelect && !String(sourceTypeSelect.value || "").startsWith("osm_")) {
                    sourceTypeSelect.value = "osm_history";
                }
                this.updateWorkflowSteps();
            });
        }

        // Track touch state on the note so action changes never silently
        // overwrite RA-typed text.
        if (note) {
            note.addEventListener("input", () => {
                note.dataset.touched = "1";
                this.updateWorkflowSteps();
            });
        }

        [
            "sourceProviderInput",
            "sourceUrlInput",
            "sourceTitleInput",
            "sourceDateInput",
            "lifecycleEventSelect",
            "lifecycleDateInput",
            "lifecycleDatePrecisionSelect",
            "lifecycleNoteInput",
            "relatedIdsInput",
            "sourceTypeSelect",
            "existenceStatusSelect",
            "worshipUseStatusSelect",
            "assessmentConfidenceSelect",
            "matchConfidenceSelect",
            "geocodingConfidenceSelect",
        ].forEach(id => {
            document.getElementById(id)?.addEventListener("input", () => this.updateWorkflowSteps());
            document.getElementById(id)?.addEventListener("change", event => {
                if (id.endsWith("Select") && !id.startsWith("source")) {
                    event.target.dataset.touched = "1";
                }
                this.updateWorkflowSteps();
            });
        });
        const lifecycleDate = document.getElementById("lifecycleDateInput");
        const lifecyclePrecision = document.getElementById("lifecycleDatePrecisionSelect");
        lifecycleDate?.addEventListener("input", () => {
            if (lifecyclePrecision && lifecyclePrecision.dataset.touched !== "1") {
                lifecyclePrecision.value = precisionForPartialDate(lifecycleDate.value);
            }
        });
        lifecyclePrecision?.addEventListener("change", () => {
            lifecyclePrecision.dataset.touched = "1";
        });
        TARGET_YEARS.forEach(year => {
            document.getElementById(`status${year}`)?.addEventListener("change", () => {
                this.applyControlledAssessmentDefaults();
                this.updateWorkflowSteps();
            });
        });

        document.getElementById("copyEvidenceRowButton")?.addEventListener("click", () => this.copyEvidenceRow(props));
        document.getElementById("copyDecisionButton")?.addEventListener("click", () => this.copyDecision(props));
        document.getElementById("saveDraftButton")?.addEventListener("click", () => this.saveEvidenceToBackend(props, { submit: false }));
        document.getElementById("submitReviewButton")?.addEventListener("click", () => this.saveEvidenceToBackend(props, { submit: true }));
        document.getElementById("skipTaskButton")?.addEventListener("click", () => {
            const reason = (document.getElementById("skipReasonInput")?.value || "").trim();
            this.skipCurrentTask(props, reason);
        });

        this.updateWorkflowSteps();
    }

    applyRaActionDefaults(props) {
        const action = document.getElementById("raActionSelect")?.value || "needs_review";
        const statuses = statusDefaultsForAction(action, this.targetYear, props);
        TARGET_YEARS.forEach(year => {
            const select = document.getElementById(`status${year}`);
            if (select) select.value = statuses[year] || "not_assessed";
        });

        // Only suggest a note if the RA has not typed anything. Touching the
        // textarea sets dataset.touched and locks it from auto-rewrite, so
        // RA-typed text is never silently overwritten by action changes.
        const note = document.getElementById("decisionNote");
        if (note && note.dataset.touched !== "1" && !note.value.trim()) {
            note.placeholder = reviewNoteForAction(action);
        }

        this.applyControlledAssessmentDefaults();
    }

    applyControlledAssessmentDefaults() {
        const action = document.getElementById("raActionSelect")?.value || "needs_review";
        const statuses = Object.fromEntries(TARGET_YEARS.map(year => [
            year,
            document.getElementById(`status${year}`)?.value || "not_assessed",
        ]));
        const defaults = assessmentDefaultsForAction(action, statuses);
        [
            ["existenceStatusSelect", defaults.existenceStatus],
            ["worshipUseStatusSelect", defaults.worshipUseStatus],
            ["assessmentConfidenceSelect", defaults.assessmentConfidence],
            ["matchConfidenceSelect", defaults.matchConfidence],
            ["geocodingConfidenceSelect", defaults.geocodingConfidence],
        ].forEach(([id, value]) => {
            const select = document.getElementById(id);
            if (select && select.dataset.touched !== "1") {
                select.value = value;
            }
        });
    }

    currentFormValues() {
        const targetYearStatuses = Object.fromEntries(TARGET_YEARS.map(year => [
            year,
            document.getElementById(`status${year}`)?.value || "not_assessed",
        ]));
        return {
            action: document.getElementById("raActionSelect")?.value || "needs_review",
            targetYearStatuses,
            sourceType: document.getElementById("sourceTypeSelect")?.value || "other",
            existenceStatus: document.getElementById("existenceStatusSelect")?.value || "uncertain",
            worshipUseStatus: document.getElementById("worshipUseStatusSelect")?.value || "uncertain",
            assessmentConfidence: document.getElementById("assessmentConfidenceSelect")?.value || "",
            matchConfidence: document.getElementById("matchConfidenceSelect")?.value || "medium",
            geocodingConfidence: document.getElementById("geocodingConfidenceSelect")?.value || "medium",
            sourceProvider: document.getElementById("sourceProviderInput")?.value || "",
            sourceTitle: document.getElementById("sourceTitleInput")?.value || "",
            sourceDate: document.getElementById("sourceDateInput")?.value || "",
            lifecycleEvent: document.getElementById("lifecycleEventSelect")?.value || "",
            lifecycleDate: document.getElementById("lifecycleDateInput")?.value || "",
            lifecycleDatePrecision: document.getElementById("lifecycleDatePrecisionSelect")?.value || "unknown",
            lifecycleNote: document.getElementById("lifecycleNoteInput")?.value || "",
            sourceUrl: document.getElementById("sourceUrlInput")?.value || "",
            relatedIds: document.getElementById("relatedIdsInput")?.value || "",
            note: document.getElementById("decisionNote")?.value || "",
        };
    }

    evidenceInputError(values) {
        if (!values.sourceTitle.trim()) return "Add a source title.";
        if (values.note.trim().length < 5) return "Add a short evidence note.";
        if (values.sourceDate.trim() && !isValidPartialDateText(values.sourceDate)) {
            return "Use YYYY, YYYY-MM, or YYYY-MM-DD for source and capture dates. If the date is unknown, leave it blank and explain in the note.";
        }
        const hasLifecycleDetail = values.lifecycleEvent || values.lifecycleDate.trim() || values.lifecycleNote.trim();
        if (hasLifecycleDetail && !values.lifecycleEvent) {
            return "Choose an opening/closure/change event type, or leave the optional date fields blank.";
        }
        if (values.lifecycleEvent && !values.lifecycleDate.trim()) {
            return "Add an opening/closure/change date, or leave the optional date fields blank.";
        }
        if (values.lifecycleDate.trim() && !isValidPartialDateText(values.lifecycleDate)) {
            return "Use YYYY, YYYY-MM, or YYYY-MM-DD for opening/closure/change dates. Preserve prose dates in the note.";
        }
        if (values.sourceType === "field_observation" && !values.sourceDate.trim()) {
            return "Add the field observation date.";
        }
        if (values.sourceType !== "field_observation" && !values.sourceUrl.trim()) {
            return "Add a source URL or agreed file reference. Use the OSM button only when OSM itself is the evidence.";
        }
        return "";
    }

    visualVerificationSource(sourceType) {
        if (sourceType === "street_imagery") return "street_imagery";
        if (sourceType === "aerial_imagery") return "aerial_imagery";
        if (sourceType === "field_observation") return "field_observation";
        if (sourceType === "osm_date_tags" || sourceType === "osm_history") return "osm_cartography";
        return "none";
    }

    buildWideEvidenceRow(props) {
        const values = this.currentFormValues();
        const row = Object.fromEntries(WIDE_EVIDENCE_FIELDS.map(field => [field, ""]));
        const coordinates = this.selectedTask?.geometry?.coordinates || [];
        const [lng, lat] = coordinates;
        const sourceSlug = slug(values.sourceUrl || values.sourceTitle || values.note || "source", 32);
        const statusSlug = TARGET_YEARS.map(year => values.targetYearStatuses[year] || "not_assessed").join("-");
        const evidenceSlug = slug([
            props.task_id || props.master_site_id || "candidate",
            values.action,
            statusSlug,
            sourceSlug,
        ].join("-"), 96);
        const sourceRecordId = props.task_id || props.master_site_id || props.osm_id || "";
        const lifecycle = lifecycleDateSummary(props);
        const targetEvidence = values.note || deriveTargetYearStatus(props, this.targetYear).note;
        const isMissing = values.action === "missing_current_site";
        const isDuplicate = values.action === "possible_duplicate";
        const isShared = values.action === "denomination_or_shared_use";

        row.evidence_row_id = `map-${evidenceSlug || slug(`${values.action}-${todayIsoDate()}`)}`;
        row.collection_batch = ASSIGNMENT_BATCH_ID || COUNTRY_CONFIG.collectionBatch;
        row.country_code = COUNTRY_CONFIG.countryCode;
        row.source_dataset_id = COUNTRY_CONFIG.sourceDatasetId;
        row.source_type = values.sourceType;
        row.provider = values.sourceProvider || "unspecified";
        row.source_title = values.sourceTitle || `${COUNTRY_CONFIG.countryName} map verification task`;
        row.source_url_or_file = values.sourceUrl;
        row.source_record_id = sourceRecordId;
        row.retrieval_date = todayIsoDate();
        row.licence = "needs_review";
        row.access_limits = "public_or_project_review";
        row.redistribution_limits = "needs_review";
        const raInitials = this.getRaInitials();
        row.source_notes = `Generated from the ${ASSIGNMENT_MODE ? "assigned web workpack" : "static RA workbench"}${raInitials ? ` by ${raInitials}` : ""}. Action: ${actionLabelForRa(values.action)}.${values.sourceDate ? ` Source/capture date: ${values.sourceDate}.` : ""}`;
        row.name_raw = props.name || "";
        row.name_standardised = props.name || "";
        row.denomination_or_tradition_raw = props.denomination || "";
        row.site_type = isShared ? "multi_use" : normaliseSiteType(props.site_type || props.name || "");
        row.address_raw = props.address || "";
        row.modern_address_candidate = props.address || "";
        row.address_standardised = props.address || "";
        row.geocoding_basis = isMissing ? "manual_match" : "existing_osm_site";
        row.geocoding_confidence = values.geocodingConfidence;
        row.latitude = lat ?? "";
        row.longitude = lng ?? "";
        row.matched_osm_id = props.osm_id || "";
        row.osm_object_type = props.osm_type || "";
        row.osm_tags_raw = props.osm_tags_summary || (props.osm_tags_raw ? JSON.stringify(props.osm_tags_raw) : "");
        row.osm_start_date = props.osm_start_date || "";
        row.osm_old_start_date = props.osm_old_start_date || "";
        row.osm_end_date = props.osm_end_date || "";
        row.osm_lifecycle_date_notes = lifecycle
            ? `${lifecycle}. Treat OSM date tags as evidence to check, not final truth.`
            : "No OSM date tags visible in the verification task.";
        row.matched_current_site_id = isMissing ? "" : (props.master_site_id || "");
        row.candidate_site_id = isMissing ? `candidate-${evidenceSlug || slug(`${values.action}-${todayIsoDate()}`)}` : "";
        row.match_method = isMissing ? "unmatched" : isDuplicate ? "manual_review" : "osm_id";
        row.match_confidence = values.matchConfidence;
        row.candidate_match_notes = values.relatedIds || "";
        row.visual_verification_source = this.visualVerificationSource(values.sourceType);
        row.visual_verification_url_or_file = ["street_imagery", "aerial_imagery"].includes(values.sourceType)
            ? values.sourceUrl
            : values.sourceType === "osm_date_tags"
                ? values.sourceUrl
                : "";
        row.visual_verification_capture_date = ["street_imagery", "aerial_imagery", "field_observation"].includes(values.sourceType)
            ? values.sourceDate
            : "";
        row.visual_verification_summary = ["street_imagery", "aerial_imagery", "field_observation"].includes(values.sourceType)
            ? values.note
            : "Static map task selected by RA; source evidence still requires review.";
        const lifecycleLabel = optionLabel(LIFECYCLE_EVENT_OPTIONS, values.lifecycleEvent);
        const lifecycleEvidence = values.lifecycleEvent
            ? [
                `opening/closure/change event: ${lifecycleLabel}`,
                `date: ${values.lifecycleDate}`,
                `precision: ${values.lifecycleDatePrecision}`,
                values.lifecycleNote ? `note: ${values.lifecycleNote}` : "",
            ].filter(Boolean).join("; ")
            : "";
        if (values.lifecycleEvent) {
            const lifecycleFields = LIFECYCLE_FIELD_BY_EVENT[values.lifecycleEvent];
            if (lifecycleFields) {
                row[lifecycleFields[0]] = values.lifecycleDate;
                row[lifecycleFields[1]] = values.lifecycleDatePrecision;
            }
        }
        row.date_evidence_raw = [
            values.sourceDate ? `source/capture date: ${values.sourceDate}` : "",
            lifecycle,
            lifecycleEvidence,
        ].filter(Boolean).join("; ");
        row.date_evidence_summary = [targetEvidence, values.lifecycleNote].filter(Boolean).join(" ");
        row.existence_status = values.existenceStatus;
        row.worship_use_status = values.worshipUseStatus;
        row.public_access_status = "unknown";
        TARGET_YEARS.forEach(year => {
            const status = values.targetYearStatuses[year] || "not_assessed";
            row[`target_year_${year}_status`] = status;
            row[`target_year_${year}_probability`] = status === "not_assessed" ? "" : values.assessmentConfidence;
            row[`target_year_${year}_evidence`] = status === "not_assessed" ? "" : targetEvidence;
        });
        row.quality_flag = ["street_imagery", "aerial_imagery", "field_observation"].includes(values.sourceType)
            ? "visual_confirmation"
            : values.action === "confirm_current_record"
                ? "directory_confirmed"
                : "needs_review";
        row.review_status = values.action === "confirm_current_record" ? "unreviewed" : "needs_review";
        row.privacy_flag = "clear";
        row.licence_flag = "needs_review";
        row.retrieved_by = raInitials || "ra";
        row.extracted_by = raInitials || "ra";
        row.extracted_at = nowIso();
        row.review_note = `${reviewNoteForAction(values.action)} ${values.relatedIds ? `Related ids: ${values.relatedIds}.` : ""}`.trim();

        return row;
    }

    buildEvidenceDraft(props, row) {
        const values = this.currentFormValues();
        const targetEvidence = values.note || deriveTargetYearStatus(props, this.targetYear).note;
        const targetYearEvidence = Object.fromEntries(TARGET_YEARS.map(year => [
            year,
            (values.targetYearStatuses[year] || "not_assessed") === "not_assessed" ? "" : targetEvidence,
        ]));
        return {
            source_type: values.sourceType,
            provider: values.sourceProvider || undefined,
            source_title: values.sourceTitle,
            source_url_or_file: values.sourceUrl || undefined,
            source_date_or_capture_date: values.sourceDate || undefined,
            source_notes: row.source_notes || undefined,
            action: values.action,
            target_year_statuses: values.targetYearStatuses,
            target_year_evidence: targetYearEvidence,
            existence_status: values.existenceStatus,
            worship_use_status: values.worshipUseStatus,
            assessment_confidence: values.assessmentConfidence || undefined,
            match_confidence: values.matchConfidence,
            geocoding_confidence: values.geocodingConfidence,
            lifecycle_event: values.lifecycleEvent || undefined,
            lifecycle_date: values.lifecycleDate || undefined,
            lifecycle_date_precision: values.lifecycleEvent ? values.lifecycleDatePrecision : undefined,
            lifecycle_note: values.lifecycleNote || undefined,
            related_ids_or_note: values.relatedIds || undefined,
            evidence_note: values.note,
            generated_wide_row: {
                fields: WIDE_EVIDENCE_FIELDS,
                row,
                tsv: tsvRowFromObject(row),
            },
            privacy_flag: "clear",
            licence_flag: "needs_review",
            validation_summary: {
                status: "client_checked",
                checked_at: nowIso(),
            },
        };
    }

    async saveEvidenceToBackend(props, options = {}) {
        const status = document.getElementById("copyStatus");
        const values = this.currentFormValues();
        const inputError = this.evidenceInputError(values);
        if (inputError) {
            if (status) status.textContent = `${inputError} Nothing was saved.`;
            return;
        }
        if (!this.backend?.configured || !this.backend.signedIn) {
            if (status) status.textContent = "Sign in to the shared backend before saving evidence.";
            return;
        }
        if (!this.backendTasksById.has(props.task_id)) {
            if (status) status.textContent = "This task is not seeded in Convex yet. Ask JB to seed the current batch.";
            return;
        }

        const row = this.buildWideEvidenceRow(props);
        const draft = this.buildEvidenceDraft(props, row);
        try {
            if (status) status.textContent = options.submit ? "Saving and submitting..." : "Saving draft...";
            const saved = await this.backend.saveEvidenceDraft({
                taskId: props.task_id,
                draft,
                clientContext: {
                    source: "static_verification_map",
                    country_code: COUNTRY_CONFIG.countryCode,
                    batch_id: ASSIGNMENT_BATCH_ID || undefined,
                    selected_target_year: this.targetYear,
                    page_path: window.location.pathname,
                },
            });
            if (options.submit) {
                await this.backend.submitEvidenceDraft({
                    evidenceDraftId: saved.evidence_draft_id,
                    note: values.note || undefined,
                });
            }
            await this.refreshBackendTasks();
            if (ASSIGNMENT_MODE) {
                const refreshed = this.tasks.find(feature => feature.properties?.task_id === props.task_id);
                if (refreshed) this.selectedTask = refreshed;
            }
            this.applyFilters();
            const stepsEl = document.getElementById("workflowSteps");
            if (stepsEl) stepsEl.dataset.copied = "1";
            this.updateWorkflowSteps();
            if (status) {
                status.textContent = options.submit
                    ? "Saved to the shared backend and submitted for review. Pick another task from the map or list."
                    : "Draft saved to the shared backend. Submit for review when the row is ready.";
            }
        } catch (error) {
            if (status) status.textContent = `${error.message || "Backend save failed."} Nothing was saved.`;
        }
    }

    buildDecisionPayload(props) {
        const values = this.currentFormValues();
        return {
            task_id: props.task_id,
            master_snapshot_id: props.master_snapshot_id,
            master_site_id: props.master_site_id,
            osm_id: props.osm_id,
            selected_target_year: this.targetYear,
            action: values.action,
            action_label: actionLabelForRa(values.action),
            target_year_statuses: values.targetYearStatuses,
            lifecycle_event: values.lifecycleEvent,
            lifecycle_event_label: values.lifecycleEvent ? optionLabel(LIFECYCLE_EVENT_OPTIONS, values.lifecycleEvent) : "",
            lifecycle_date: values.lifecycleDate,
            lifecycle_date_precision: values.lifecycleEvent ? values.lifecycleDatePrecision : "",
            lifecycle_note: values.lifecycleNote,
            existence_status: values.existenceStatus,
            worship_use_status: values.worshipUseStatus,
            assessment_confidence: values.assessmentConfidence,
            match_confidence: values.matchConfidence,
            geocoding_confidence: values.geocodingConfidence,
            source_type: values.sourceType,
            source_provider: values.sourceProvider,
            source_title: values.sourceTitle,
            source_date_or_capture_date: values.sourceDate,
            source_url_or_file: values.sourceUrl,
            related_ids_or_note: values.relatedIds,
            evidence_note: values.note,
            source: COUNTRY_CONFIG.mapSource,
            saved_or_submitted: false,
        };
    }

    nominationFormHtml() {
        return `
            <div class="demo-warning" role="alert">
                Demo only. These fields are not saved, submitted, or linked to the master database. Do not enter private or sensitive data.
            </div>
            <details id="nominationDetails" open>
                <summary>Draft nomination form: new, missing, or complicated site</summary>
                <div class="nomination-form">
                    <label>
                        Type
                        <select id="nominationType">
                            ${nominationTypeOptionsHtml()}
                        </select>
                    </label>
                    <label>
                        Name
                        <input id="nominationName" type="text" value="Demo missing worship site">
                    </label>
                    <label>
                        Address or locality
                        <input id="nominationAddress" type="text" value="Example locality only">
                    </label>
                    <label>
                        Location note
                        <input id="nominationLocation" type="text" value="Demo: nearest known site or approximate area">
                    </label>
                    <label>
                        Target years
                        <input id="nominationYears" type="text" value="${escapeHtml(targetYearListText())}">
                    </label>
                    <label>
                        Source URL
                        <input id="nominationSourceUrl" type="url" placeholder="Evidence link">
                    </label>
                    <label>
                        Evidence note
                        <textarea id="nominationNote" rows="3">Demo only: describe what source-backed evidence would go here.</textarea>
                    </label>
                    <button id="copyNominationButton" type="button">Generate demo nomination JSON</button>
                    <div id="nominationCopyStatus" class="copy-status"></div>
                    <textarea id="nominationJsonOutput" class="json-output" rows="5" readonly></textarea>
                </div>
            </details>
        `;
    }

    disabledIntakeHtml() {
        return `
            <h3>Audit intake disabled</h3>
            <div class="disabled-panel">
                This pilot is read-only. Record the site name or master id when sending feedback.
            </div>
        `;
    }

    linkHtml(label, url) {
        if (!url) {
            return `<span></span>`;
        }
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    }

    async copyEvidenceRow(props) {
        const values = this.currentFormValues();
        const status = document.getElementById("copyStatus");
        const inputError = this.evidenceInputError(values);
        if (inputError) {
            if (status) {
                status.textContent = `${inputError} Nothing was copied.`;
            }
            return;
        }
        const row = this.buildWideEvidenceRow(props);
        const tsv = tsvRowFromObject(row);
        const output = document.getElementById("evidenceRowOutput");
        if (output) {
            output.value = tsv;
            output.textContent = tsv;
        }
        const stepsEl = document.getElementById("workflowSteps");
        try {
            await navigator.clipboard.writeText(tsv);
            if (stepsEl) stepsEl.dataset.copied = "1";
            if (status) {
                status.textContent =
                    "✓ Copied. This task is marked tentatively closed in this browser. Paste the row into the spreadsheet, then pick another task from the map or list.";
            }
            this.appendSessionEntry({
                type: "copied",
                copied_at: nowIso(),
                task_id: props.task_id || "",
                master_site_id: props.master_site_id || "",
                name: props.name || "Unnamed site",
                ra_initials: this.getRaInitials(),
                action: values.action,
                action_label: actionLabelForRa(values.action),
                target_year_statuses: values.targetYearStatuses,
                lifecycle_event: values.lifecycleEvent,
                lifecycle_event_label: values.lifecycleEvent ? optionLabel(LIFECYCLE_EVENT_OPTIONS, values.lifecycleEvent) : "",
                lifecycle_date: values.lifecycleDate,
                lifecycle_date_precision: values.lifecycleEvent ? values.lifecycleDatePrecision : "",
                lifecycle_note: values.lifecycleNote,
                existence_status: values.existenceStatus,
                worship_use_status: values.worshipUseStatus,
                assessment_confidence: values.assessmentConfidence,
                match_confidence: values.matchConfidence,
                geocoding_confidence: values.geocodingConfidence,
                source_provider: values.sourceProvider,
                source_title: values.sourceTitle,
                source_date_or_capture_date: values.sourceDate,
                source_url_or_file: values.sourceUrl,
                tsv,
            });
        } catch (error) {
            if (status) {
                status.textContent =
                    "Could not access the clipboard. Select all text in the box below, copy it manually, and paste into your spreadsheet. This task has not been marked tentatively closed.";
            }
        }
        this.updateWorkflowSteps();
    }

    async skipCurrentTask(props, reason) {
        const status = document.getElementById("copyStatus");
        if (this.backend?.configured && this.backend.signedIn && this.backendTasksById.has(props.task_id)) {
            try {
                await this.backend.skipTask({
                    taskId: props.task_id,
                    reason: reason || undefined,
                });
                await this.refreshBackendTasks();
                this.applyFilters();
                if (status) {
                    status.textContent = "Skipped in the shared backend. Pick another task from the map or list.";
                }
                return;
            } catch (error) {
                if (status) {
                    status.textContent = `${error.message || "Could not skip in backend."} Falling back to local skip.`;
                }
            }
        }

        this.appendSessionEntry({
            type: "skipped",
            skipped_at: nowIso(),
            task_id: props.task_id || "",
            master_site_id: props.master_site_id || "",
            name: props.name || "Unnamed site",
            ra_initials: this.getRaInitials(),
            reason: String(reason || "").slice(0, 240),
        });
        if (status) {
            status.textContent = "Skipped in this browser. Pick another task from the map or list.";
        }
    }

    async copyDecision(props) {
        const payload = this.buildDecisionPayload(props);
        const status = document.getElementById("copyStatus");
        this.writeJsonOutput("decisionJsonOutput", payload);
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            if (status) status.textContent = "Copied review JSON. Nothing was saved or submitted.";
        } catch (error) {
            if (status) status.textContent = "Review JSON is shown below. Nothing was saved or submitted.";
        }
    }

    async copyNomination() {
        const payload = {
            nomination_type: document.getElementById("nominationType")?.value || "",
            candidate_site_name: document.getElementById("nominationName")?.value || "",
            address_or_locality: document.getElementById("nominationAddress")?.value || "",
            coordinates_or_map_note: document.getElementById("nominationLocation")?.value || "",
            target_years: document.getElementById("nominationYears")?.value || "",
            evidence_source_url: document.getElementById("nominationSourceUrl")?.value || "",
            evidence_note: document.getElementById("nominationNote")?.value || "",
            linked_master_site_id: this.selectedTask?.properties?.master_site_id || "",
            linked_task_id: this.selectedTask?.properties?.task_id || "",
            source: COUNTRY_CONFIG.nominationSource,
        };

        const status = document.getElementById("nominationCopyStatus");
        this.writeJsonOutput("nominationJsonOutput", payload);
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            if (status) status.textContent = "Copied demo JSON. Nothing was saved or submitted.";
        } catch (error) {
            if (status) status.textContent = "Demo JSON is shown below. Nothing was saved or submitted.";
        }
    }

    writeJsonOutput(elementId, payload) {
        const output = document.getElementById(elementId);
        if (output) {
            const json = JSON.stringify(payload, null, 2);
            output.value = json;
            output.textContent = json;
        }
    }
}

window.nzVerificationMap = new NzVerificationMap();
