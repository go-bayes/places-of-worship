const SEARCH_PARAMS = new URLSearchParams(window.location.search);
const DEMO_MODE = SEARCH_PARAMS.get("demo") !== "0";
const INTAKE_ENABLED = DEMO_MODE;
const PATH_COUNTRY_PARAM = window.location.pathname.match(/\/regions\/([a-z]{2})\//)?.[1] || "";
const CONFIG_COUNTRY_PARAM = String(window.POW_CONVEX_CONFIG?.countryCode || "").toLowerCase();
const REQUESTED_COUNTRY_PARAM = String(SEARCH_PARAMS.get("country") || "").toLowerCase();
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
        defaultAssignmentBatchId: "nz-temporal-ra-workpack-001",
        datedPlaces: "../nz/data/dated_places.geojson",
        assignmentHeading: "New Zealand source-first test",
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
        defaultAssignmentBatchId: "vu-source-first-test-001",
        assignmentHeading: "Vanuatu source-first test",
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
    // target years are the census waves each country's data map ships;
    // backend-only queues until task batches are seeded.
    al: {
        countryCode: "AL",
        countryName: "Albania",
        targetYears: ["2011", "2023"],
        defaultTargetYear: "2023",
        dataPath: "",
        mapCentre: [41.15, 20.05],
        mapZoom: 7,
        collectionBatch: "al-map-workbench-demo",
        sourceDatasetId: "al_static_verification_map",
        mapSource: "al_verification_static_map_workbench",
        nominationSource: "al_verification_static_map_nomination",
        defaultAssignmentBatchId: "al-source-first-test-001",
        datedPlaces: "../al/data/dated_places.geojson",
        assignmentHeading: "Albania verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2011": "present",
                "2023": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    au: {
        countryCode: "AU",
        countryName: "Australia",
        targetYears: ["2016", "2021"],
        defaultTargetYear: "2021",
        dataPath: "",
        mapCentre: [-25.5, 134.5],
        mapZoom: 3.2,
        collectionBatch: "au-map-workbench-demo",
        sourceDatasetId: "au_static_verification_map",
        mapSource: "au_verification_static_map_workbench",
        nominationSource: "au_verification_static_map_nomination",
        defaultAssignmentBatchId: "au-source-first-test-001",
        datedPlaces: "../au/data/dated_places.geojson",
        assignmentHeading: "Australia verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2016": "present",
                "2021": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    br: {
        countryCode: "BR",
        countryName: "Brazil",
        targetYears: ["2000", "2010", "2022"],
        defaultTargetYear: "2022",
        dataPath: "",
        mapCentre: [-14.2, -53.2],
        mapZoom: 4,
        collectionBatch: "br-map-workbench-demo",
        sourceDatasetId: "br_static_verification_map",
        mapSource: "br_verification_static_map_workbench",
        nominationSource: "br_verification_static_map_nomination",
        defaultAssignmentBatchId: "br-source-first-test-001",
        datedPlaces: "../br/data/dated_places.geojson",
        assignmentHeading: "Brazil verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2000": "present",
                "2022": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    bs: {
        countryCode: "BS",
        countryName: "Bahamas",
        targetYears: ["2010"],
        defaultTargetYear: "2010",
        dataPath: "",
        mapCentre: [24.7, -77.4],
        mapZoom: 6,
        collectionBatch: "bs-map-workbench-demo",
        sourceDatasetId: "bs_static_verification_map",
        mapSource: "bs_verification_static_map_workbench",
        nominationSource: "bs_verification_static_map_nomination",
        defaultAssignmentBatchId: "bs-source-first-test-001",
        datedPlaces: "../bs/data/dated_places.geojson",
        assignmentHeading: "Bahamas verification tasks",
        // single shipped wave: the loss action reads as closed/changed
        // use by the target year rather than a two-year contrast
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Closed or changed use by the target year",
            statuses: {
                "2010": "absent",
            },
            note: "Evidence appears to support closure or changed use by the target year; reviewer to confirm dates and status.",
        },
    },
    ca: {
        countryCode: "CA",
        countryName: "Canada",
        targetYears: ["2001", "2011", "2021"],
        defaultTargetYear: "2021",
        dataPath: "",
        mapCentre: [56.1, -96.8],
        mapZoom: 3,
        collectionBatch: "ca-map-workbench-demo",
        sourceDatasetId: "ca_static_verification_map",
        mapSource: "ca_verification_static_map_workbench",
        nominationSource: "ca_verification_static_map_nomination",
        defaultAssignmentBatchId: "ca-source-first-test-001",
        datedPlaces: "../ca/data/dated_places.geojson",
        assignmentHeading: "Canada verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2001": "present",
                "2021": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    cz: {
        countryCode: "CZ",
        countryName: "Czechia",
        targetYears: ["2021"],
        defaultTargetYear: "2021",
        dataPath: "",
        mapCentre: [49.82, 15.47],
        mapZoom: 7,
        collectionBatch: "cz-map-workbench-demo",
        sourceDatasetId: "cz_static_verification_map",
        mapSource: "cz_verification_static_map_workbench",
        nominationSource: "cz_verification_static_map_nomination",
        defaultAssignmentBatchId: "cz-source-first-test-001",
        datedPlaces: "../cz/data/dated_places.geojson",
        assignmentHeading: "Czechia verification tasks",
        // single shipped wave: the loss action reads as closed/changed
        // use by the target year rather than a two-year contrast
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Closed or changed use by the target year",
            statuses: {
                "2021": "absent",
            },
            note: "Evidence appears to support closure or changed use by the target year; reviewer to confirm dates and status.",
        },
    },
    gh: {
        countryCode: "GH",
        countryName: "Ghana",
        targetYears: ["2021"],
        defaultTargetYear: "2021",
        dataPath: "",
        mapCentre: [7.9, -1.2],
        mapZoom: 6,
        collectionBatch: "gh-map-workbench-demo",
        sourceDatasetId: "gh_static_verification_map",
        mapSource: "gh_verification_static_map_workbench",
        nominationSource: "gh_verification_static_map_nomination",
        defaultAssignmentBatchId: "gh-source-first-test-001",
        datedPlaces: "../gh/data/dated_places.geojson",
        assignmentHeading: "Ghana verification tasks",
        // single shipped wave: the loss action reads as closed/changed
        // use by the target year rather than a two-year contrast
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Closed or changed use by the target year",
            statuses: {
                "2021": "absent",
            },
            note: "Evidence appears to support closure or changed use by the target year; reviewer to confirm dates and status.",
        },
    },
    ie: {
        countryCode: "IE",
        countryName: "Ireland",
        targetYears: ["2011", "2016", "2022"],
        defaultTargetYear: "2022",
        dataPath: "",
        mapCentre: [53.35, -8.1],
        mapZoom: 6,
        collectionBatch: "ie-map-workbench-demo",
        sourceDatasetId: "ie_static_verification_map",
        mapSource: "ie_verification_static_map_workbench",
        nominationSource: "ie_verification_static_map_nomination",
        defaultAssignmentBatchId: "ie-source-first-test-001",
        datedPlaces: "../ie/data/dated_places.geojson",
        assignmentHeading: "Ireland verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2011": "present",
                "2022": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    in: {
        countryCode: "IN",
        countryName: "India",
        targetYears: ["2001", "2011"],
        defaultTargetYear: "2011",
        dataPath: "",
        mapCentre: [22.5, 79.0],
        mapZoom: 5,
        collectionBatch: "in-map-workbench-demo",
        sourceDatasetId: "in_static_verification_map",
        mapSource: "in_verification_static_map_workbench",
        nominationSource: "in_verification_static_map_nomination",
        defaultAssignmentBatchId: "in-source-first-test-001",
        datedPlaces: "../in/data/dated_places.geojson",
        assignmentHeading: "India verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2001": "present",
                "2011": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    ke: {
        countryCode: "KE",
        countryName: "Kenya",
        targetYears: ["2019"],
        defaultTargetYear: "2019",
        dataPath: "",
        mapCentre: [0.2, 37.9],
        mapZoom: 6,
        collectionBatch: "ke-map-workbench-demo",
        sourceDatasetId: "ke_static_verification_map",
        mapSource: "ke_verification_static_map_workbench",
        nominationSource: "ke_verification_static_map_nomination",
        defaultAssignmentBatchId: "ke-source-first-test-001",
        datedPlaces: "../ke/data/dated_places.geojson",
        assignmentHeading: "Kenya verification tasks",
        // single shipped wave: the loss action reads as closed/changed
        // use by the target year rather than a two-year contrast
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Closed or changed use by the target year",
            statuses: {
                "2019": "absent",
            },
            note: "Evidence appears to support closure or changed use by the target year; reviewer to confirm dates and status.",
        },
    },
    kr: {
        countryCode: "KR",
        countryName: "South Korea",
        targetYears: ["2005", "2015"],
        defaultTargetYear: "2015",
        dataPath: "",
        mapCentre: [36.3, 127.8],
        mapZoom: 7,
        collectionBatch: "kr-map-workbench-demo",
        sourceDatasetId: "kr_static_verification_map",
        mapSource: "kr_verification_static_map_workbench",
        nominationSource: "kr_verification_static_map_nomination",
        defaultAssignmentBatchId: "kr-source-first-test-001",
        datedPlaces: "../kr/data/dated_places.geojson",
        assignmentHeading: "South Korea verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2005": "present",
                "2015": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    mw: {
        countryCode: "MW",
        countryName: "Malawi",
        targetYears: ["2018"],
        defaultTargetYear: "2018",
        dataPath: "",
        mapCentre: [-13.4, 34.3],
        mapZoom: 6,
        collectionBatch: "mw-map-workbench-demo",
        sourceDatasetId: "mw_static_verification_map",
        mapSource: "mw_verification_static_map_workbench",
        nominationSource: "mw_verification_static_map_nomination",
        defaultAssignmentBatchId: "mw-source-first-test-001",
        assignmentHeading: "Malawi verification tasks",
        // single shipped wave: the loss action reads as closed/changed
        // use by the target year rather than a two-year contrast
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Closed or changed use by the target year",
            statuses: {
                "2018": "absent",
            },
            note: "Evidence appears to support closure or changed use by the target year; reviewer to confirm dates and status.",
        },
    },
    mx: {
        countryCode: "MX",
        countryName: "Mexico",
        targetYears: ["2000", "2010", "2020"],
        defaultTargetYear: "2020",
        dataPath: "",
        mapCentre: [23.6, -102.5],
        mapZoom: 4,
        collectionBatch: "mx-map-workbench-demo",
        sourceDatasetId: "mx_static_verification_map",
        mapSource: "mx_verification_static_map_workbench",
        nominationSource: "mx_verification_static_map_nomination",
        defaultAssignmentBatchId: "mx-source-first-test-001",
        datedPlaces: "../mx/data/dated_places.geojson",
        assignmentHeading: "Mexico verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2000": "present",
                "2020": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    pt: {
        countryCode: "PT",
        countryName: "Portugal",
        targetYears: ["2011", "2021"],
        defaultTargetYear: "2021",
        dataPath: "",
        mapCentre: [39.6, -8.0],
        mapZoom: 6,
        collectionBatch: "pt-map-workbench-demo",
        sourceDatasetId: "pt_static_verification_map",
        mapSource: "pt_verification_static_map_workbench",
        nominationSource: "pt_verification_static_map_nomination",
        defaultAssignmentBatchId: "pt-source-first-test-001",
        datedPlaces: "../pt/data/dated_places.geojson",
        assignmentHeading: "Portugal verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2011": "present",
                "2021": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    ro: {
        countryCode: "RO",
        countryName: "Romania",
        targetYears: ["2011", "2021"],
        defaultTargetYear: "2021",
        dataPath: "",
        mapCentre: [45.85, 24.97],
        mapZoom: 7,
        collectionBatch: "ro-map-workbench-demo",
        sourceDatasetId: "ro_static_verification_map",
        mapSource: "ro_verification_static_map_workbench",
        nominationSource: "ro_verification_static_map_nomination",
        defaultAssignmentBatchId: "ro-source-first-test-001",
        datedPlaces: "../ro/data/dated_places.geojson",
        assignmentHeading: "Romania verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2011": "present",
                "2021": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    rw: {
        countryCode: "RW",
        countryName: "Rwanda",
        targetYears: ["2012", "2022"],
        defaultTargetYear: "2022",
        dataPath: "",
        mapCentre: [-1.94, 29.9],
        mapZoom: 8,
        collectionBatch: "rw-map-workbench-demo",
        sourceDatasetId: "rw_static_verification_map",
        mapSource: "rw_verification_static_map_workbench",
        nominationSource: "rw_verification_static_map_nomination",
        defaultAssignmentBatchId: "rw-source-first-test-001",
        assignmentHeading: "Rwanda verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2012": "present",
                "2022": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    sk: {
        countryCode: "SK",
        countryName: "Slovakia",
        targetYears: ["2021"],
        defaultTargetYear: "2021",
        dataPath: "",
        mapCentre: [48.7, 19.7],
        mapZoom: 7,
        collectionBatch: "sk-map-workbench-demo",
        sourceDatasetId: "sk_static_verification_map",
        mapSource: "sk_verification_static_map_workbench",
        nominationSource: "sk_verification_static_map_nomination",
        defaultAssignmentBatchId: "sk-source-first-test-001",
        datedPlaces: "../sk/data/dated_places.geojson",
        assignmentHeading: "Slovakia verification tasks",
        // single shipped wave: the loss action reads as closed/changed
        // use by the target year rather than a two-year contrast
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Closed or changed use by the target year",
            statuses: {
                "2021": "absent",
            },
            note: "Evidence appears to support closure or changed use by the target year; reviewer to confirm dates and status.",
        },
    },
    uk: {
        countryCode: "UK",
        countryName: "United Kingdom",
        targetYears: ["2001", "2011", "2021"],
        defaultTargetYear: "2021",
        dataPath: "",
        mapCentre: [54.7, -3.4],
        mapZoom: 5,
        collectionBatch: "uk-map-workbench-demo",
        sourceDatasetId: "uk_static_verification_map",
        mapSource: "uk_verification_static_map_workbench",
        nominationSource: "uk_verification_static_map_nomination",
        defaultAssignmentBatchId: "uk-source-first-test-001",
        datedPlaces: "../uk/data/dated_places.geojson",
        assignmentHeading: "United Kingdom verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2001": "present",
                "2021": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    us: {
        countryCode: "US",
        countryName: "United States",
        targetYears: ["2000", "2010", "2020"],
        defaultTargetYear: "2020",
        dataPath: "",
        mapCentre: [39.8, -98.6],
        mapZoom: 4,
        collectionBatch: "us-map-workbench-demo",
        sourceDatasetId: "us_static_verification_map",
        mapSource: "us_verification_static_map_workbench",
        nominationSource: "us_verification_static_map_nomination",
        defaultAssignmentBatchId: "us-source-first-test-001",
        datedPlaces: "../us/data/dated_places.geojson",
        assignmentHeading: "United States verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2000": "present",
                "2020": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    za: {
        countryCode: "ZA",
        countryName: "South Africa",
        targetYears: ["1996", "2001", "2022"],
        defaultTargetYear: "2022",
        dataPath: "",
        mapCentre: [-29.0, 24.7],
        mapZoom: 5,
        collectionBatch: "za-map-workbench-demo",
        sourceDatasetId: "za_static_verification_map",
        mapSource: "za_verification_static_map_workbench",
        nominationSource: "za_verification_static_map_nomination",
        defaultAssignmentBatchId: "za-source-first-test-001",
        datedPlaces: "../za/data/dated_places.geojson",
        assignmentHeading: "South Africa verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "1996": "present",
                "2022": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
    zm: {
        countryCode: "ZM",
        countryName: "Zambia",
        targetYears: ["2010", "2022"],
        defaultTargetYear: "2022",
        dataPath: "",
        mapCentre: [-13.5, 27.8],
        mapZoom: 6,
        collectionBatch: "zm-map-workbench-demo",
        sourceDatasetId: "zm_static_verification_map",
        mapSource: "zm_verification_static_map_workbench",
        nominationSource: "zm_verification_static_map_nomination",
        defaultAssignmentBatchId: "zm-source-first-test-001",
        assignmentHeading: "Zambia verification tasks",
        temporalLossAction: {
            value: "target_year_loss_or_changed_use",
            label: "Present in one target year, absent in a later target year",
            statuses: {
                "2010": "present",
                "2022": "absent",
            },
            note: "Evidence appears to support worship use in one target year and absence or changed use in a later target year; reviewer to confirm dates and status.",
        },
    },
};
function countryConfigKey(value) {
    const key = String(value || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(COUNTRY_CONFIGS, key) ? key : "";
}

const PATH_COUNTRY_KEY = countryConfigKey(PATH_COUNTRY_PARAM);
const CONFIG_COUNTRY_KEY = countryConfigKey(CONFIG_COUNTRY_PARAM);
const REQUESTED_COUNTRY_KEY = countryConfigKey(REQUESTED_COUNTRY_PARAM);
const COUNTRY_KEY = REQUESTED_COUNTRY_KEY || PATH_COUNTRY_KEY || CONFIG_COUNTRY_KEY || "nz";
const COUNTRY_CONFIG = COUNTRY_CONFIGS[COUNTRY_KEY];
const TARGET_YEARS = COUNTRY_CONFIG.targetYears;
const DEFAULT_TARGET_YEAR = COUNTRY_CONFIG.defaultTargetYear || TARGET_YEARS[TARGET_YEARS.length - 1];
const BACKEND_CONFIG = window.POW_CONVEX_CONFIG || {};
const BACKEND_CONFIGURED = Boolean(BACKEND_CONFIG.enabled && BACKEND_CONFIG.url && BACKEND_CONFIG.googleClientId);
const FULL_MAP_MODE = SEARCH_PARAMS.get("full") === "1" || SEARCH_PARAMS.get("batch") === "all";
const REQUESTED_ASSIGNMENT_BATCH_ID = (SEARCH_PARAMS.get("batch") || "").trim();
const DEFAULT_ASSIGNMENT_BATCH_ID = COUNTRY_CONFIG.defaultAssignmentBatchId || "";
const ASSIGNMENT_BATCH_ID = FULL_MAP_MODE
    ? ""
    : (REQUESTED_ASSIGNMENT_BATCH_ID || (BACKEND_CONFIGURED ? DEFAULT_ASSIGNMENT_BATCH_ID : ""));
const ASSIGNMENT_MODE = ASSIGNMENT_BATCH_ID.length > 0;
// optional personalised hint: invitation links may include ?email=ra@example.com
// so the sign-in card can name the specific invited account
const INVITED_EMAIL_HINT = (SEARCH_PARAMS.get("email") || "").trim();
const ASSIGNMENT_SESSION_SEGMENT = ASSIGNMENT_BATCH_ID
    ? `:${ASSIGNMENT_BATCH_ID.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 64)}`
    : "";
const LEGACY_SESSION_LOG_KEY = "pow_ra_session_v1";
const LEGACY_RA_INITIALS_KEY = "pow_ra_initials";
const COUNTRY_SESSION_LOG_KEY = `pow_ra_session_v1:${COUNTRY_CONFIG.countryCode.toLowerCase()}`;
const SESSION_LOG_KEY_PREFIX = `${COUNTRY_SESSION_LOG_KEY}${ASSIGNMENT_SESSION_SEGMENT}:`;
const RA_INITIALS_KEY = `pow_ra_initials:${COUNTRY_CONFIG.countryCode.toLowerCase()}`;
const SESSION_RECENT_LIMIT = 25;
const ACTIVE_ASSIGNMENT_STATUSES = new Set(["open", "in_progress", "draft_saved", "changes_requested", "reopened"]);
const MY_WORK_STATUSES = [
    "in_progress",
    "draft_saved",
    "needs_review",
    "unresolved_note",
    "changes_requested",
    "skipped",
    "reviewed",
    "exported",
];
// statuses whose tasks may start a revision; must match the server's
// revisionTransitions table in convex/evidence.ts
const REVISION_ELIGIBLE_STATUSES = new Set(["needs_review", "unresolved_note", "changes_requested"]);
// statuses where a loaded editable draft can be re-attached as the active
// revision without a server call: the task keeps its queue status while the
// revision rides alongside. changes_requested is deliberately absent — its
// revision must start through the server so the transition to in_progress
// and the task event are recorded (reviews:feedbackLoopMetrics keys on them)
const REVISION_AUTO_ATTACH_STATUSES = new Set(["needs_review", "unresolved_note"]);
const READ_ONLY_ASSIGNMENT_STATUSES = new Set([
    "needs_review",
    "unresolved_note",
    "changes_requested",
    "skipped",
    "reviewed",
    "exported",
]);
// statuses where a matched context-dot task can be reopened for another
// pass: under review or closed pending review (never already open/active)
const REOPEN_ELIGIBLE_STATUSES = new Set([
    "needs_review",
    "unresolved_note",
    "provisionally_closed",
    "reviewed",
]);
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
    ["no_building_present", "No building present"],
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
// issue reports: portal labels for tasks:createIssueTask issue types
const ISSUE_TYPE_OPTIONS = [
    ["possible_duplicate", "Possible duplicate"],
    ["geometry_check", "Wrong location"],
    ["verify_existing_site", "Not / no longer a place of worship"],
    ["osm_identity_link", "OSM link wrong"],
    ["other", "Other"],
];
// quick skip reasons; the duplicate and data-error chips also point the ra
// at the issue pipeline so real data problems stay visible for review
const SKIP_REASON_CHIPS = [
    { reason: "Can't find a source" },
    { reason: "Ambiguous identity" },
    { reason: "Needs local knowledge" },
    { reason: "Looks like a duplicate", issueHint: true },
    { reason: "Data error on the map", issueHint: true },
];
// pin-drop nominations: placements must be building-accurate, so the
// confirm step gates on zoom, and nearby existing tasks are offered first
const PIN_MIN_PLACEMENT_ZOOM = 15;
const PIN_PROXIMITY_METRES = 150;
// six-state validation ring for task markers and list rows, per
// docs/portal-ra-issues-and-pin-drops.md. Status rides as a RING around the
// religion-coloured (or context-grey) fill, so it never competes with the
// religion encoding. Every state is derived at render time from data the
// portal already holds — the backend task status plus the target-year
// existence the review recorded — with no stored state and a 1:1 map onto
// task statuses already in Convex:
//   unvalidated       no human decision yet: open / in_progress / draft_saved
//                     / skipped, or no backend task. The default; never verified.
//   in_review         submitted, awaiting a first reviewer decision
//                     (needs_review / unresolved_note).
//   validated_present reviewer-accepted and existing at the target year
//                     (reviewed / exported, target-year status not absent).
//   validated_absent  reviewer-accepted evidence the site does NOT exist —
//                     closed, demolished, never existed (reviewed / exported,
//                     target-year status absent). A validation success.
//   disputed          a decided or reviewed point now carrying an open concern
//                     (changes_requested / reopened); trust drops to an
//                     intermediate ring until re-reviewed.
//   stale_validation  validated in a prior wave but not re-confirmed in the
//                     current September census wave. UNDERIVABLE today — see
//                     the guarded branch below — so this state never renders yet.
function validationState(backendStatus, temporalStatus) {
    if (backendStatus === "reviewed" || backendStatus === "exported") {
        // stale_validation is UNREACHABLE today: distinguishing a
        // current-wave confirmation from a prior-wave one needs per-wave
        // re-confirmation data (which September census wave last confirmed
        // this point) that no task field carries yet. When a
        // last_confirmed_wave field lands, add the prior-wave test here and
        // return "stale_validation" before the present/absent split.
        return temporalStatus === "absent" ? "validated_absent" : "validated_present";
    }
    if (backendStatus === "changes_requested" || backendStatus === "reopened") return "disputed";
    if (backendStatus === "needs_review" || backendStatus === "unresolved_note") return "in_review";
    return "unvalidated";
}
// human labels for task-event provenance in the history timeline
const EVENT_TYPE_LABELS = {
    imported: "Imported",
    opened: "Opened",
    claimed: "Claimed",
    unclaimed: "Unclaimed",
    draft_saved: "Draft saved",
    row_copied: "Row copied",
    skipped: "Skipped",
    submitted_for_review: "Submitted for review",
    submitted_unresolved_note: "Unresolved note submitted",
    provisionally_closed: "Provisionally closed",
    review_started: "Review started",
    review_decided: "Review decided",
    changes_requested: "Changes requested",
    reopened: "Reopened",
    exported: "Exported",
    note_added: "Note added",
};
// coarse relative date for zero-fetch hover provenance
function relativeTimeText(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "";
    const diff = Date.now() - ms;
    if (diff < 60000) return "just now";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? "" : "s"} ago`;
}
const DATE_PRECISION_OPTIONS = [
    ["day", "Day"],
    ["month", "Month"],
    ["year", "Year"],
    ["bounded", "Bounded / inferred"],
    ["unknown", "Unknown"],
];
// incidence vs ascertainment: the annual census counts genuine change and
// rewrites history for map corrections, so every claim is classed; the
// uncertain default means the select is always answered
const CHANGE_CLASS_OPTIONS = [
    ["uncertain", "Can't tell yet"],
    ["genuine_change", "Genuine change — this place actually opened, closed, or changed use around a date"],
    ["map_correction", "Map correction — the map record was wrong or incomplete; the world did not change"],
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
        throw new Error(`${COUNTRY_CONFIG.countryName} task data are not configured yet.`);
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

function targetYearAndListText(years = TARGET_YEARS) {
    if (years.length <= 1) return years[0] || "the target year";
    if (years.length === 2) return `${years[0]} and ${years[1]}`;
    return `${years.slice(0, -1).join(", ")}, and ${years[years.length - 1]}`;
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

function isPlaceholderText(value) {
    return /^(?:na|n\/a|not applicable)$/i.test(String(value || "").trim());
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
    } else if (action === "closed_or_changed_use" || action === "no_building_present") {
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
    const isNoBuilding = action === "no_building_present";
    const isClosed = action === "closed_or_changed_use" || action === COUNTRY_CONFIG.temporalLossAction.value;
    const needsReview = action === "needs_review";

    let worshipUseStatus = "uncertain";
    if (isNoBuilding) {
        worshipUseStatus = "no_building_present";
    } else if (isClosed) {
        worshipUseStatus = "not_worship";
    } else if (action === "missing_current_site") {
        worshipUseStatus = "probable_worship";
    } else if (anyPresent) {
        worshipUseStatus = "confirmed_worship";
    }

    return {
        existenceStatus: isNoBuilding ? "absent" : anyPresent || isMissing ? "present" : "uncertain",
        worshipUseStatus,
        assessmentConfidence: needsReview ? "0.5" : isDuplicate || isMissing || isClosed || isNoBuilding ? "0.7" : "0.9",
        matchConfidence: isMissing ? "none" : isDuplicate || isNoBuilding ? "medium" : needsReview ? "low" : "high",
        geocodingConfidence: isMissing || isDuplicate || isNoBuilding ? "medium" : needsReview ? "low" : "high",
    };
}

function actionLabelForRa(action) {
    if (action === "confirm_current_record") return "Confirm current site";
    if (action === "missing_current_site") return "Missing from project map";
    if (action === "possible_duplicate") return "Possible duplicate";
    if (action === COUNTRY_CONFIG.temporalLossAction.value) return COUNTRY_CONFIG.temporalLossAction.label;
    if (action === "closed_or_changed_use") return "Closed or changed use";
    if (action === "no_building_present") return "No building present";
    if (action === "denomination_or_shared_use") return "Denomination/shared use";
    return "Needs review";
}

function reviewNoteForAction(action) {
    if (action === "confirm_current_record") return "RA source check supports current worship-site record.";
    if (action === "missing_current_site") return "Possible current PoW missing from the project map; OSM may already have a candidate object. Reviewer to decide whether to create or link a site.";
    if (action === "possible_duplicate") return "Possible duplicate or merge candidate; reviewer to compare linked ids and site identity.";
    if (action === COUNTRY_CONFIG.temporalLossAction.value) return COUNTRY_CONFIG.temporalLossAction.note;
    if (action === "closed_or_changed_use") return "Evidence suggests worship use closed or changed; reviewer to distinguish building existence from worship function.";
    if (action === "no_building_present") return "Evidence suggests no building is present at the mapped location; reviewer to distinguish demolition, relocation, bad geometry, and worship-use closure.";
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

// osm "show this point" deep link, matching the public map's popup action
// row (region-map.js:916): lat/lng to 5 dp
function osmPointUrl(lat, lng) {
    const latFixed = Number(lat).toFixed(5);
    const lngFixed = Number(lng).toFixed(5);
    return `https://www.openstreetmap.org/?mlat=${latFixed}&mlon=${lngFixed}#map=18/${latFixed}/${lngFixed}`;
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

function assignmentQuickstartHtml() {
    if (COUNTRY_CONFIG.countryCode === "VU") {
        return `
            <ol>
                <li>Sign in with Google at the top of this panel.</li>
                <li>Use this as a Vanuatu source-first test, not as the final country task map.</li>
                <li>Work from source-backed leads. OSM is sparse in Vanuatu, so treat any OSM record as context rather than the main evidence.</li>
                <li>Record 1989, 1999, 2009, and 2020 status only where a source supports a target-year judgement.</li>
                <li>Use lifecycle fields for older historical evidence, including mission, church, building, relocation, closure, or changed-use dates back to 1600.</li>
                <li>Use <em>Save draft</em> while working, <em>Submit unresolved note</em> when useful evidence remains unclear, and <em>Submit for review</em> when the evidence is ready for JB or JW.</li>
            </ol>
        `;
    }
    if (COUNTRY_CONFIG.countryCode !== "NZ") {
        return `
            <ol>
                <li>Sign in with Google at the top of this panel.</li>
                <li>Work down the assigned ${COUNTRY_CONFIG.countryName} task list in order. Stop at a natural stopping point and tell JB where you stopped.</li>
                <li>Open Street View or Google Maps to look around the site, and use the OSM object only as context. Record the imagery capture date if Street View is your evidence.</li>
                <li>Record ${targetYearAndListText()} status, confidence, source title, source URL or file reference, and any useful lifecycle date.</li>
                <li>Use <em>Save draft</em> while working, <em>Submit unresolved note</em> when the case remains unclear after useful checking, and <em>Submit for review</em> when the evidence is ready for JB.</li>
            </ol>
        `;
    }
    return `
        <ol>
            <li>Sign in with Google at the top of this panel.</li>
            <li>Work down the assigned task list in order. Stop at a natural stopping point and tell JB where you stopped.</li>
            <li>How the list was made: <a href="https://github.com/go-bayes/places-of-worship/blob/main/scripts/build_nz_temporal_ra_workpack.R" target="_blank" rel="noopener">this R script</a> first selects every date-tag row whose <code>candidate_date_tag_windows</code> contains <code>candidate_gain</code>; then, after excluding used <code>osm_key</code>s, adds five OSM-present-then-absent rows with a nearby replacement object, five rows with parser warnings, uncertain target-year status, or <code>candidate_status_change</code>, and five present-present-present controls with no candidate window or parser warning. Treat OSM as the prompt to check, not as final evidence.</li>
            <li>Open Street View or Google Maps to look around the site, and use the OSM object only as context. Record the imagery capture date if Street View is your evidence.</li>
            <li>Record 2013, 2018, and 2023 status, confidence, source title, source URL or file reference, and any useful lifecycle date.</li>
            <li>Use <em>Save draft</em> while working, <em>Submit unresolved note</em> when the case remains unclear after useful checking, and <em>Submit for review</em> when the evidence is ready for JB.</li>
        </ol>
    `;
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
        this.latestDraftsByTaskId = new Map();
        this.myWorkItems = [];
        this.revisionDraftIdsByTaskId = new Map();
        this.backendLastError = "";
        // unsaved-entry protection: dirty flag for the evidence form plus
        // per-task snapshots reapplied after programmatic rebuilds
        this.formDirty = false;
        this.formDirtyTaskId = null;
        this.formSnapshotsByTaskId = new Map();
        // my work list: show every item or just the recent slice
        this.myWorkShowAll = false;
        // transient signed-in card status, e.g. refresh feedback
        this.backendTransientStatus = "";
        // which task's issue form should render expanded (survives re-renders)
        this.issueFormOpenTaskId = null;
        // pin-drop nomination state: mode flag, live marker, confirmed
        // position, and locally created manual tasks (the assignment-batch
        // refresh cannot see the manual batch, so we re-merge these)
        this.pinMode = false;
        this.pinMarker = null;
        this.pinConfirmed = null;
        this.pinNearbyCount = 0;
        this.manualTasksById = new Map();
        // context dots: lazily fetched dated places, keyed off the target
        // year in period mode; task history responses cached per task
        this.pointsMode = "off";
        this.contextDotLayer = null;
        this.datedFeatures = null;
        this.datedLoadPromise = null;
        this.taskHistoryByTaskId = new Map();
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
        let value = current;
        try {
            value = window.prompt(
                "Enter your initials so JB knows who recorded each row (max 8 characters). Stored only on this browser.",
                current || ""
            );
        } catch (error) {
            console.warn("Could not show RA initials prompt:", error);
            return current;
        }
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
                        ? `${INVITED_EMAIL_HINT
                            ? `Use ${escapeHtml(INVITED_EMAIL_HINT)}, the Google account JB invited.`
                            : "Use the Google account JB invited (check the invitation email if you're not sure which one)."} Your assigned tasks load after sign-in, and saved work goes straight to the shared review queue.`
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
                        // sign-in after an expired save must not wipe typed values
                        this.renderDetailPreservingForm(this.selectedTask);
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
        const assignmentStatusText = ASSIGNMENT_MODE
            ? `${this.tasks.length} available task${this.tasks.length === 1 ? "" : "s"}; ${this.myWorkItems.length} item${this.myWorkItems.length === 1 ? "" : "s"} in My work.`
            : "Saves and submissions go to Convex for reviewer follow-up.";
        panel.innerHTML = `
            <div class="backend-card signed-in">
                <strong>${ASSIGNMENT_MODE ? "Signed in. Choose a task below." : "Shared task backend"}</strong>
                ${assignmentLabel}
                <span>Signed in as ${escapeHtml(label)}. ${escapeHtml(assignmentStatusText)}</span>
                <span id="backendRefreshStatus" class="copy-status" aria-live="polite">${escapeHtml(this.backendTransientStatus || "")}</span>
                <div class="backend-actions">
                    <button type="button" class="secondary" id="refreshBackendTasksButton">Refresh task list</button>
                    <button type="button" class="tertiary" id="signOutButton">Sign out</button>
                </div>
            </div>
        `;
        document.getElementById("refreshBackendTasksButton")?.addEventListener("click", async event => {
            // lock the button for the flight; the refresh re-renders this
            // card, so the outcome reports through the fresh copy
            const button = event.currentTarget;
            button.disabled = true;
            await this.refreshBackendTasks();
            // if the refresh bailed early without re-rendering, unlock
            if (button.isConnected) button.disabled = false;
            this.applyFilters();
            if (this.selectedTask) {
                this.renderDetailPreservingForm(this.selectedTask);
            }
            this.setBackendTransientStatus(this.backendLastError
                ? this.backendLastError
                : `Task list refreshed — ${this.tasks.length} available, ${this.myWorkItems.length} in My work.`);
        });
        document.getElementById("signOutButton")?.addEventListener("click", () => this.signOutBackend());
    }

    // transient status line on the signed-in card; clears itself so stale
    // refresh feedback never lingers
    setBackendTransientStatus(text) {
        this.backendTransientStatus = text;
        const statusEl = document.getElementById("backendRefreshStatus");
        if (statusEl) statusEl.textContent = text;
        clearTimeout(this._backendStatusTimer);
        this._backendStatusTimer = setTimeout(() => {
            this.backendTransientStatus = "";
            const current = document.getElementById("backendRefreshStatus");
            if (current) current.textContent = "";
        }, 6000);
    }

    signOutBackend() {
        this.backend?.signOut();
        this.backendUser = null;
        this.backendTasksById.clear();
        this.latestDraftsByTaskId.clear();
        this.myWorkItems = [];
        this.revisionDraftIdsByTaskId.clear();
        // sign-out discards the form with the panel; a lingering dirty flag
        // would fire beforeunload against a page showing no form at all
        this.clearFormDirty();
        this.formSnapshotsByTaskId.clear();
        this.backendLastError = "Signed out here. On a shared computer, also sign out of Google in the browser.";
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
        // browser-level guard while typed evidence is unsaved
        window.addEventListener("beforeunload", event => {
            if (!this.formDirty) return;
            event.preventDefault();
            event.returnValue = "";
        });
        // keyboard starts: cmd/ctrl+enter submits, plain "n" opens the next task
        document.addEventListener("keydown", event => this.handleGlobalKeydown(event));
        this.renderBackendPanel();
        await this.loadTasks();
        await this.refreshBackendTasks();
        this.applyFilters();
        this.renderSessionPanel();
        this.maybeOpenIssueDeepLink();
        if (DEMO_MODE && !ASSIGNMENT_MODE) {
            this.renderRaInitialsBadge();
            // Defer the initials prompt so the map paints first.
            setTimeout(() => this.promptForRaInitials(false), 250);
        }
    }

    renderSessionPanel() {
        const panel = document.getElementById("sessionPanel");
        if (!panel) return;
        if (ASSIGNMENT_MODE) {
            this.renderMyWorkPanel(panel);
            return;
        }
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

    renderMyWorkPanel(panel) {
        if (!this.backend?.configured || !this.backendUser) {
            panel.innerHTML = "";
            this.renderChangesRequestedBadge(0);
            return;
        }
        const items = this.myWorkItems || [];
        const total = items.length;
        // a task awaiting review with an editable draft alongside is a
        // revision in progress; count it as a draft, not as submitted work
        const isRevisionItem = item =>
            (item.task?.status === "needs_review" || item.task?.status === "unresolved_note")
            && item.latestDraft?.draft_status === "draft";
        const revisionDrafts = items.filter(isRevisionItem).length;
        const submitted = items.filter(item => item.task?.status === "needs_review" && !isRevisionItem(item)).length;
        const unresolved = items.filter(item => item.task?.status === "unresolved_note" && !isRevisionItem(item)).length;
        const drafts = items.filter(item => item.task?.status === "draft_saved").length + revisionDrafts;
        const changesRequested = items.filter(item => item.task?.status === "changes_requested");
        const needsMore = changesRequested.length;
        const skipped = items.filter(item => item.task?.status === "skipped").length;
        const reviewed = items.filter(item => item.task?.status === "reviewed" || item.task?.status === "exported").length;
        panel.innerHTML = `
            ${this.changesRequestedPanelHtml(changesRequested)}
            <details ${total > 0 ? "open" : ""}>
                <summary>My work
                    <span class="ra-initials">${escapeHtml(`${total} item${total === 1 ? "" : "s"}: ${drafts} draft, ${submitted} submitted, ${unresolved} unresolved, ${needsMore} needs more evidence, ${skipped} skipped, ${reviewed} reviewed`)}</span>
                </summary>
                ${total === 0 ? `
                    <div class="session-empty">No saved, submitted, skipped, or reviewed tasks yet.</div>
                ` : `
                    <div class="session-entries" role="list">
                        ${(this.myWorkShowAll ? items : items.slice(0, SESSION_RECENT_LIMIT)).map(item => this.myWorkEntryHtml(item)).join("")}
                    </div>
                    ${total > SESSION_RECENT_LIMIT ? `
                        <button type="button" class="secondary" id="myWorkShowAllButton">${this.myWorkShowAll ? `Show recent ${SESSION_RECENT_LIMIT} only` : `Show all ${total}`}</button>
                    ` : ""}
                    <div class="session-empty">Submitted and reviewed work stays here so you do not repeat it. Revise only when you have new evidence or need to correct a mistake.</div>
                `}
            </details>
        `;
        document.getElementById("myWorkShowAllButton")?.addEventListener("click", () => {
            this.myWorkShowAll = !this.myWorkShowAll;
            this.renderMyWorkPanel(panel);
        });
        panel.querySelectorAll(".my-work-open").forEach(btn => {
            btn.addEventListener("click", () => this.selectTaskById(btn.dataset.taskId, { focusDetail: true }));
        });
        panel.querySelectorAll(".revise-now").forEach(btn => {
            btn.addEventListener("click", () => this.reviseNow(btn.dataset.taskId, btn.closest(".changes-entry")));
        });
        this.renderChangesRequestedBadge(needsMore);
    }

    // pinned panel above My work; shows the reviewer's verbatim decision note and
    // required follow-up for each changes_requested task, with a one-click path to
    // an editable revision. renders nothing when there are no such tasks.
    changesRequestedPanelHtml(items) {
        if (!items || items.length === 0) return "";
        return `
            <section class="changes-panel" role="alert" aria-label="Changes requested">
                <div class="changes-panel-head">Changes requested (${items.length})</div>
                <div class="changes-entries" role="list">
                    ${items.map(item => this.changesRequestedEntryHtml(item)).join("")}
                </div>
            </section>
        `;
    }

    changesRequestedEntryHtml(item) {
        const task = item.task || {};
        const review = item.latestReview || {};
        const taskId = task.task_id || "";
        const note = review.decision_note
            ? `<div class="changes-note"><span class="changes-label">Reviewer note</span>${escapeHtml(review.decision_note)}</div>`
            : "";
        const followUp = review.required_follow_up
            ? `<div class="changes-note"><span class="changes-label">Required follow-up</span>${escapeHtml(review.required_follow_up)}</div>`
            : "";
        return `
            <div class="changes-entry" role="listitem">
                <span class="entry-title">${escapeHtml(task.name || "Unnamed site")}</span>
                <span class="entry-meta">${escapeHtml(taskId)}</span>
                ${note}
                ${followUp}
                <div class="changes-error" role="alert"></div>
                <div class="entry-actions">
                    <button type="button" class="revise-now" data-task-id="${escapeHtml(taskId)}">Revise now</button>
                </div>
            </div>
        `;
    }

    // starts an editable revision for a changes_requested task via the server
    // mutation, then refreshes work state and opens the task for editing. the
    // returned draft id is tracked so the next save writes the clone, not the
    // immutable submitted draft.
    async reviseNow(taskId, entryEl) {
        if (!taskId || !this.backend?.signedIn) return;
        const button = entryEl?.querySelector(".revise-now");
        const errorEl = entryEl?.querySelector(".changes-error");
        if (errorEl) errorEl.textContent = "";
        if (button) {
            button.disabled = true;
            button.textContent = "Starting revision...";
        }
        try {
            const result = await this.backend.reviseEvidenceDraft({ taskId });
            this.revisionDraftIdsByTaskId.set(taskId, result.evidence_draft_id);
            this.latestDraftsByTaskId.delete(taskId);
            await this.refreshBackendTasks();
            this.selectTaskById(taskId, { focusDetail: true });
            const status = document.getElementById("copyStatus");
            if (status) {
                status.textContent = "Editable revision draft ready. Update the evidence, then submit the revision for review when ready.";
            }
        } catch (error) {
            if (button) {
                button.disabled = false;
                button.textContent = "Revise now";
            }
            if (errorEl) {
                errorEl.textContent = error.message || "Could not start a revision. Try again.";
            }
        }
    }

    // count badge near sign-in; hidden when no changes_requested items remain.
    renderChangesRequestedBadge(count) {
        const host = document.getElementById("modeNotice");
        if (!host) return;
        let badge = document.getElementById("changesRequestedBadge");
        if (!count) {
            if (badge) badge.remove();
            return;
        }
        if (!badge) {
            badge = document.createElement("span");
            badge.id = "changesRequestedBadge";
            badge.className = "changes-badge";
            host.appendChild(badge);
        }
        badge.textContent = `${count} change${count === 1 ? "" : "s"} requested`;
    }

    myWorkEntryHtml(item) {
        const task = item.task || {};
        const draft = item.latestDraft || {};
        const review = item.latestReview || {};
        const status = task.status || "unknown";
        const label = (status === "needs_review" || status === "unresolved_note") && draft.draft_status === "draft"
            ? "revision draft saved"
            : status === "needs_review"
            ? "submitted, waiting for review"
            : status === "unresolved_note"
                ? "unresolved note submitted"
            : status === "changes_requested"
                ? "needs more evidence"
                : status.replaceAll("_", " ");
        const reviewNote = review.decision_note
            ? `<div class="entry-meta">Review note: ${escapeHtml(review.decision_note)}</div>`
            : "";
        const draftAction = draft.action
            ? `<div class="entry-meta">Finding: ${escapeHtml(actionLabelForRa(draft.action))}${draft.source_title ? ` · ${escapeHtml(draft.source_title)}` : ""}</div>`
            : "";
        return `
            <div class="session-entry" role="listitem">
                <span class="entry-title">${escapeHtml(task.name || "Unnamed site")}</span>
                <span class="entry-meta">${escapeHtml(label)} · ${escapeHtml(task.task_id || "")}</span>
                ${draftAction}
                ${reviewNote}
                <div class="entry-actions">
                    <button type="button" class="tertiary my-work-open" data-task-id="${escapeHtml(task.task_id || "")}">View</button>
                </div>
            </div>
        `;
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
            // keep the zoom-out floor at 5 for compact countries, but let
            // continental configs (au/br/ca/mx/us open below 5) take effect
            minZoom: Math.min(5, Math.floor(COUNTRY_CONFIG.mapZoom)),
        }).addTo(this.map);

        // context dots ride the canvas (preferCanvas), so they always paint
        // beneath the dom-based task markers
        this.contextDotLayer = L.layerGroup();
        this.map.addLayer(this.contextDotLayer);
        this.markerLayer = L.layerGroup();
        this.map.addLayer(this.markerLayer);
        this.addPointsLegendControl();
    }

    // corner control: the points-mode select plus the always-visible
    // verification-state legend; period is offered only where the country
    // ships a dated context layer with real features (config-gated, like
    // the data maps)
    addPointsLegendControl() {
        const control = L.control({ position: "bottomleft" });
        control.onAdd = () => {
            const div = L.DomUtil.create("div", "points-legend-control");
            // uniform option order across surfaces (per the historical-points
            // standard): period first where a dated product is wired, then all,
            // then off; all/off only where no dated product exists
            const modes = COUNTRY_CONFIG.datedPlaces
                ? [["period", "Points: period"], ["all", "Points: all"], ["off", "Points: off"]]
                : [["all", "Points: all"], ["off", "Points: off"]];
            div.innerHTML = `
                <select id="portalPointsSelect" aria-label="Context dots">
                    ${modes.map(([value, label]) => `<option value="${value}"${value === this.pointsMode ? " selected" : ""}>${label}</option>`).join("")}
                </select>
                <div id="portalPointsNote" class="points-mode-note" hidden></div>
                <div class="map-legend">
                    <span class="legend-caption">Validation ring</span>
                    <span class="legend-row"><span class="legend-dot vm-validated-present-swatch"></span>validated present</span>
                    <span class="legend-row"><span class="legend-dot vm-validated-absent-swatch"></span>validated absent</span>
                    <span class="legend-row"><span class="legend-dot vm-in-review-swatch"></span>in review</span>
                    <span class="legend-row"><span class="legend-dot vm-disputed-swatch"></span>disputed</span>
                    <span class="legend-row"><span class="legend-dot vm-default-swatch"></span>unvalidated</span>
                    ${COUNTRY_CONFIG.datedPlaces ? `<span class="legend-row"><span class="legend-dot context-dot-swatch"></span>context dots</span>` : ""}
                </div>
            `;
            // keep map gestures away from the control
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            div.querySelector("#portalPointsSelect").addEventListener("change", (event) => {
                this.setPointsMode(event.target.value);
            });
            return div;
        };
        control.addTo(this.map);
        // seed the per-mode note for the initial (default off) state
        this.updatePointsNote();
    }

    // one-line note under the points select explaining the active mode, per
    // the historical-points standard: period names the date filter, all warns
    // the dots are today's snapshot, off hides the note. Updates on both mode
    // change and target-year change (the year appears in the copy).
    updatePointsNote() {
        const note = document.getElementById("portalPointsNote");
        if (!note) return;
        const year = this.targetYear;
        if (this.pointsMode === "period") {
            note.textContent = `showing places whose OpenStreetMap date tags say they existed in ${year}`;
            note.hidden = false;
        } else if (this.pointsMode === "all") {
            note.textContent = `dots show today's OpenStreetMap places, not ${year} places`;
            note.hidden = false;
        } else {
            note.textContent = "";
            note.hidden = true;
        }
    }

    setPointsMode(mode) {
        this.pointsMode = mode;
        this.updatePointsNote();
        if (mode === "off") {
            this.contextDotLayer.clearLayers();
            return;
        }
        // lazy, cached load on the first non-off selection
        this.ensureDatedPlaces().then(() => this.syncContextDots());
    }

    ensureDatedPlaces() {
        if (this.datedFeatures) return Promise.resolve(this.datedFeatures);
        if (!COUNTRY_CONFIG.datedPlaces) {
            this.datedFeatures = [];
            return Promise.resolve(this.datedFeatures);
        }
        if (!this.datedLoadPromise) {
            this.datedLoadPromise = fetch(COUNTRY_CONFIG.datedPlaces)
                .then(response => response.ok ? response.json() : { features: [] })
                .then(geo => {
                    this.datedFeatures = geo.features || [];
                    return this.datedFeatures;
                })
                .catch(() => {
                    this.datedFeatures = [];
                    return this.datedFeatures;
                });
        }
        return this.datedLoadPromise;
    }

    // context dots for the current mode; period mirrors the data maps'
    // DATED filter: start_year present and <= year, end_year absent, null,
    // or >= year (open-ended places carry an explicit null end_year)
    syncContextDots() {
        if (!this.contextDotLayer) return;
        this.contextDotLayer.clearLayers();
        if (this.pointsMode === "off" || !this.datedFeatures) return;
        const year = Number(this.targetYear);
        const show = this.pointsMode === "period"
            ? this.datedFeatures.filter(feature => {
                const props = feature.properties || {};
                if (props.start_year === undefined || props.start_year === null) return false;
                if (props.start_year > year) return false;
                return props.end_year === undefined || props.end_year === null || props.end_year >= year;
            })
            : this.datedFeatures;
        show.forEach(feature => {
            const coords = feature.geometry?.coordinates || [];
            if (coords.length < 2) return;
            // legible but subordinate to task markers: a touch larger and
            // darker than before, and now interactive so each dot opens the
            // shared action row plus an issue/reopen entry
            const dot = L.circleMarker([coords[1], coords[0]], {
                radius: 4,
                color: "#475569",
                weight: 1,
                fillColor: "#64748b",
                fillOpacity: 0.65,
                opacity: 0.85,
                interactive: true,
            });
            dot.bindPopup(() => this.contextDotPopupHtml(feature), { maxWidth: 320 });
            dot.on("popupopen", event => this.bindContextDotPopup(event.popup, feature));
            this.contextDotLayer.addLayer(dot);
        });
    }

    // matches a dated context feature to a loaded portal task: first by OSM
    // id (against loaded task features, then backend tasks), then by exact
    // 5 dp coordinate. Returns the task props (carrying task_id) or null.
    matchContextTask(feature) {
        const props = feature.properties || {};
        const osmId = props.osm_id !== undefined && props.osm_id !== null ? String(props.osm_id) : "";
        const osmType = props.osm_type ? String(props.osm_type) : "";
        const coords = feature.geometry?.coordinates || [];
        if (osmId) {
            // ids alone collide across osm object types (node/123 vs way/123),
            // so require the type to agree whenever both sides carry one
            const byFeature = this.tasks.find(f => {
                const p = f.properties || {};
                if (String(p.osm_id || "") !== osmId) return false;
                const t = p.osm_type ? String(p.osm_type) : "";
                return !osmType || !t || t === osmType;
            });
            if (byFeature) return byFeature.properties;
            for (const task of this.backendTasksById.values()) {
                if (String(task.matched_osm_id || "") === osmId) {
                    return featureFromBackendTask(task).properties;
                }
            }
        }
        if (coords.length >= 2) {
            const key = `${Number(coords[1]).toFixed(5)},${Number(coords[0]).toFixed(5)}`;
            const byCoord = this.tasks.find(f => {
                const c = f.geometry?.coordinates || [];
                return c.length >= 2 && `${Number(c[1]).toFixed(5)},${Number(c[0]).toFixed(5)}` === key;
            });
            if (byCoord) return byCoord.properties;
        }
        return null;
    }

    // popup for an interactive context dot: name, coords, the shared action
    // row (Street View / Open OSM / Copy coords), and an issue entry that
    // reopens a matched under-review task or files a fresh issue report
    contextDotPopupHtml(feature) {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        const lat = Number(coords[1]);
        const lng = Number(coords[0]);
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
        const name = props.name || "Unnamed place";
        const coordStr = hasCoords ? `${lat.toFixed(5)},${lng.toFixed(5)}` : "";
        const matched = this.matchContextTask(feature);
        const matchedTaskId = matched?.task_id || "";
        const backendTask = matchedTaskId ? this.backendTasksById.get(matchedTaskId) : null;
        const canReopen = Boolean(backendTask && REOPEN_ELIGIBLE_STATUSES.has(backendTask.status));
        let issueButton;
        if (matchedTaskId && canReopen) {
            issueButton = `<button class="popup-report-issue" type="button" data-reopen-task-id="${escapeHtml(matchedTaskId)}">Reopen issue</button>`;
        } else if (matchedTaskId) {
            // matched a task not in a reopenable state: route into its issue form
            issueButton = `<button class="popup-report-issue" type="button" data-open-task-id="${escapeHtml(matchedTaskId)}">Report an issue here</button>`;
        } else {
            issueButton = `<button class="popup-report-issue" type="button" data-report-issue="1">Report an issue here</button>`;
        }
        return `
            <strong>${escapeHtml(name)}</strong><br>
            <span>${escapeHtml(coordStr)}</span><br>
            <div class="popup-actions">
                ${hasCoords ? `
                ${this.linkHtml("Street View", streetViewUrlForCoordinates(coords), "popup-link")}
                <a class="popup-link" href="${escapeHtml(osmPointUrl(lat, lng))}" target="_blank" rel="noopener noreferrer">Open OSM</a>
                <button class="popup-link popup-copy-coords" type="button" data-copy="${escapeHtml(coordStr)}">Copy coords</button>` : ""}
                ${issueButton}
            </div>
        `;
    }

    bindContextDotPopup(popup, feature) {
        const el = popup.getElement();
        if (!el) return;
        this.bindCopyCoords(el);
        el.querySelector("[data-reopen-task-id]")?.addEventListener("click", (event) => {
            this.reopenIssueFromContext(event.currentTarget.dataset.reopenTaskId, feature);
        });
        el.querySelector("[data-open-task-id]")?.addEventListener("click", (event) => {
            const taskId = event.currentTarget.dataset.openTaskId;
            this.issueFormOpenTaskId = taskId;
            this.map.closePopup();
            this.selectTaskById(taskId, { focusDetail: true });
        });
        el.querySelector("[data-report-issue]")?.addEventListener("click", () => {
            this.openContextIssueForm(feature);
        });
    }

    // routes an unmatched (or non-reopenable) context dot into the existing
    // standalone issue form, pre-filled with the place name and coordinates.
    // Reuses issueFormHtml/bindIssueForm, so signed-out degrades the same way
    // (disabled submit plus a sign-in prompt).
    openContextIssueForm(feature) {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        const context = {
            taskId: "",
            name: props.name || "",
            latitude: Number(coords[1]),
            longitude: Number(coords[0]),
            siteId: undefined,
            osmId: props.osm_id !== undefined && props.osm_id !== null ? String(props.osm_id) : undefined,
        };
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        this.map.closePopup();
        const hasCoords = Number.isFinite(context.latitude) && Number.isFinite(context.longitude);
        panel.innerHTML = `
            <h2>Report an issue</h2>
            <div class="pilot-note" role="note">
                Reporting an issue for <strong>${escapeHtml(context.name || "an unnamed place")}</strong>${hasCoords ? ` at ${context.latitude.toFixed(5)}, ${context.longitude.toFixed(5)}` : ""}.
            </div>
            ${this.issueFormHtml(context, { open: true })}
        `;
        this.bindIssueForm(context);
        this.bindCopyCoords(panel);
        this.focusDetailPanel();
    }

    // reopens a matched under-review/closed task through the existing
    // reopenTask mutation, then refreshes the task list and lands on it.
    // Signed-out or misconfigured backends fall back to the issue form.
    async reopenIssueFromContext(taskId, feature) {
        if (!this.backend?.configured || !this.backend.signedIn) {
            this.openContextIssueForm(feature);
            return;
        }
        this.map.closePopup();
        try {
            await this.backend.reopenTask({
                taskId,
                reason: "Reopened from map context-dot inspection.",
            });
            // drop the cached history so the new reopened event shows
            this.taskHistoryByTaskId.delete(taskId);
            await this.refreshBackendTasks();
            this.applyFilters();
            this.selectTaskById(taskId, { focusDetail: true });
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            // land on the task so the reviewer sees its state and the error
            this.selectTaskById(taskId, { focusDetail: true });
            const status = document.getElementById("copyStatus");
            if (status) status.textContent = `${error.message || "Could not reopen the task."}`;
        }
    }

    setupPageMode() {
        document.body.classList.toggle("assignment-mode", ASSIGNMENT_MODE);
        document.title = `${COUNTRY_CONFIG.countryName} Verification Tasks`;
        const title = document.querySelector(".sidebar-header h1");
        if (title) {
            title.textContent = ASSIGNMENT_MODE
                ? (COUNTRY_CONFIG.assignmentHeading || `${COUNTRY_CONFIG.countryName} source-first test`)
                : `${COUNTRY_CONFIG.countryName} OSM Verification`;
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
            // closed by default and shrunk to a one-line pointer at the full
            // Guide; the detailed steps stay one click away for anyone who
            // wants them, and the dismiss/localStorage plumbing is unchanged
            quickstart.innerHTML = `
                <details class="quickstart" role="note">
                    <summary><strong>New here? Follow the step-by-step <a href="https://religionmap.org/apps/guides/ra.html" target="_blank" rel="noopener">Guide</a>.</strong></summary>
                    ${ASSIGNMENT_MODE ? `
                        ${assignmentQuickstartHtml()}
                    ` : `
                        <ol>
                            <li>Set <em>Target year</em> and <em>Priority</em> in the filters above.</li>
                            <li>Click a task in the list or on the map.</li>
                            <li>Open the source links in step 1 of the task panel.</li>
                            <li>In step 2, choose what your evidence shows and confirm year statuses.</li>
                            <li>In step 3, paste a short evidence note and the source URL or file reference.</li>
                            <li>In step 4, use <em>Save draft</em>, <em>Submit unresolved note</em>, or <em>Submit for review</em> when the shared backend is enabled. Use <em>Copy spreadsheet row</em> only as the fallback.</li>
                        </ol>
                    `}
                    <button type="button" class="quickstart-dismiss" id="quickstartDismiss">Hide this guide for this workpack</button>
                </details>
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
            // refit: assignment mode (previously an empty panel) hosts the
            // pin-drop missing-place flow; demo keeps its local json form
            nominationPanel.innerHTML = ASSIGNMENT_MODE ? this.pinNominationHtml() : DEMO_MODE ? this.nominationFormHtml() : `
                <div class="disabled-panel">
                    Nominations are disabled for this feedback pilot. Use the map for inspection and send notes separately.
                    To inspect mock entry fields, <a href="${escapeHtml(demoUrl())}">open demo mode</a>.
                </div>
            `;
            if (ASSIGNMENT_MODE) {
                // the single pin-drop entry point lives in the header now;
                // the transient cards render into #pinCardHost on demand
                document.getElementById("addPlaceButton")?.addEventListener("click", () => this.enterPinMode());
            }
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
            targetYearSelect.value = String(this.targetYear);
            targetYearSelect.addEventListener("change", () => {
                const selectedYear = TARGET_YEARS.find(year => String(year) === targetYearSelect.value);
                this.targetYear = selectedYear === undefined ? DEFAULT_TARGET_YEAR : selectedYear;
                this.applyFilters();
                // period-mode context dots key off the same year select
                this.syncContextDots();
                // the note copy carries the year, so refresh it too
                this.updatePointsNote();
                if (this.selectedTask) {
                    // same-task rebuild: carry typed values across the re-render
                    this.renderDetailPreservingForm(this.selectedTask);
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
            const allTasks = tasks || [];
            this.backendTasksById = new Map(allTasks.map(task => [task.task_id, task]));
            // pin-drop tasks live in the manual batch, which the
            // assignment-scoped query cannot return; re-merge the local
            // copies so the ra stays landed in a freshly created task
            for (const [taskId, manualTask] of this.manualTasksById) {
                if (!this.backendTasksById.has(taskId)) {
                    this.backendTasksById.set(taskId, manualTask);
                }
            }
            this.myWorkItems = ASSIGNMENT_MODE
                ? await this.backend.listMyTasks({
                    countryCode: COUNTRY_CONFIG.countryCode,
                    batchId: ASSIGNMENT_BATCH_ID,
                    statuses: MY_WORK_STATUSES,
                    limit: 200,
                })
                : [];
            if (ASSIGNMENT_MODE) {
                this.tasks = allTasks
                    .filter(task => this.assignmentTaskIsAvailable(task))
                    .map(featureFromBackendTask);
                const snapshotEl = document.getElementById("snapshotId");
                if (snapshotEl) {
                    const total = allTasks.length;
                    snapshotEl.textContent = `${ASSIGNMENT_BATCH_ID} | ${this.tasks.length} available of ${total}`;
                }
                const selectedId = this.selectedTask?.properties?.task_id;
                if (selectedId && !this.backendTasksById.has(selectedId)) {
                    this.selectedTask = null;
                    this.renderInitialDetail();
                } else if (selectedId) {
                    this.selectedTask = this.featureForTaskId(selectedId) || this.selectedTask;
                }
            }
            this.backendLastError = "";
            this.renderBackendPanel();
            this.renderSessionPanel();
        } catch (error) {
            this.backendLastError = error.message || "Could not refresh shared task state.";
            this.renderBackendPanel();
        }
    }

    assignmentTaskIsAvailable(task) {
        const status = task?.status || "";
        if (!ACTIVE_ASSIGNMENT_STATUSES.has(status)) return false;
        const assignedTo = task.assigned_to || "";
        if (!assignedTo) return true;
        return assignedTo === this.backendUser?._id;
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
            const props = { ...(feature.properties || {}) };
            props.google_maps_url = mapUrlForCoordinates(coordinates) || props.google_maps_url || "";
            props.street_view_url = streetViewUrlForCoordinates(coordinates) || props.street_view_url || "";
            const temporal = deriveTargetYearStatus(props, this.targetYear);
            const verifState = validationState(this.backendTasksById.get(props.task_id)?.status, temporal.status);
            const marker = L.marker([lat, lng], {
                icon: this.createIcon(props.verification_priority, temporal.status, verifState),
            });

            marker.on("click", () => this.selectTask(feature, true));
            marker.bindPopup(this.popupHtml(props, lat, lng), { maxWidth: 360 });
            marker.on("popupopen", event => this.bindPopupOpenTask(event.popup));
            // hover provenance from data already client-side; built lazily at
            // hover time so it reflects the current backend snapshot, and it
            // replaces the old native title (tooltip and click popup coexist)
            marker.bindTooltip(() => this.markerTooltipText(props), { direction: "top", offset: [0, -10], opacity: 0.95 });
            this.markerLayer.addLayer(marker);
            this.markersByTaskId.set(props.task_id, marker);
        });
    }

    // zero-fetch hover summary: name, backend status, last activity
    markerTooltipText(props) {
        const backendTask = this.backendTasksById.get(props.task_id);
        const statusText = (backendTask?.status || "not started").replaceAll("_", " ");
        const lastActivity = relativeTimeText(backendTask?.last_event_at || backendTask?.updated_at);
        return [
            props.name || "Unnamed site",
            statusText,
            lastActivity ? `last activity ${lastActivity}` : "",
        ].filter(Boolean).join(" · ");
    }

    createIcon(priority, status, verifState = "unvalidated") {
        const size = priority === "high" ? 15 : priority === "medium" ? 13 : 11;
        const color = statusColor(status);
        // the validation state is worn as a RING (box-shadow) or, for in_review,
        // a dashed hollow border — never as the fill hue, so it never competes
        // with the religion/context colour. Ring hues (blue, slate, amber,
        // violet) are chosen colourblind-distinct from each other and from the
        // religion palette. stale_validation is plumbed but unreachable today.
        const stateClass = {
            validated_present: " vm-validated-present",
            validated_absent: " vm-validated-absent",
            in_review: " vm-in-review",
            disputed: " vm-disputed",
            stale_validation: " vm-stale",
            unvalidated: "",
        }[verifState] || "";
        // in_review is the only hollow treatment: white fill with a dashed
        // validation-blue border (set in CSS), so the ring stays in the
        // validation palette and never borrows the status/religion hue. All
        // other states keep the status fill and add their ring via box-shadow.
        const style = verifState === "in_review"
            ? `width:${size}px;height:${size}px;`
            : `width:${size}px;height:${size}px;background:${color};`;
        return L.divIcon({
            className: "",
            html: `<div class="verification-marker${stateClass}" style="${style}"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }

    popupHtml(props, lat, lng) {
        const temporal = deriveTargetYearStatus(props, this.targetYear);
        // same action affordances as the public map popup row: Street View,
        // Open OSM, Copy coords (lat/lng to 5 dp)
        const coordStr = `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
        return `
            <strong>${escapeHtml(props.name || "Unnamed site")}</strong><br>
            <span>${escapeHtml(cap(props.religion))}${props.denomination ? ` | ${escapeHtml(cap(props.denomination))}` : ""}</span><br>
            <span>Priority: ${escapeHtml(props.verification_priority)}</span><br>
            <span>${escapeHtml(this.targetYear)}: ${escapeHtml(statusLabel(temporal.status))} (${escapeHtml(temporal.basis)})</span><br>
            <span>Action: ${escapeHtml(actionLabel(props.automated_suggested_action))}</span><br>
            <div class="popup-actions">
                <button class="popup-open-task" type="button" data-task-id="${escapeHtml(props.task_id)}">Open task</button>
                ${this.linkHtml("Street View", props.street_view_url, "popup-link")}
                <a class="popup-link" href="${escapeHtml(osmPointUrl(lat, lng))}" target="_blank" rel="noopener noreferrer">Open OSM</a>
                <button class="popup-link popup-copy-coords" type="button" data-copy="${escapeHtml(coordStr)}">Copy coords</button>
                <button class="popup-report-issue" type="button" data-task-id="${escapeHtml(props.task_id)}">Report an issue</button>
            </div>
        `;
    }

    bindPopupOpenTask(popup) {
        // mirror the public map's data-copy handler for the Copy coords button
        this.bindCopyCoords(popup.getElement());
        const button = popup.getElement()?.querySelector(".popup-open-task");
        if (button) {
            button.addEventListener("click", () => {
                this.selectTaskById(button.dataset.taskId, { focusDetail: true });
            });
        }
        // low-prominence issue entry: open the task with its issue form expanded
        const issueButton = popup.getElement()?.querySelector(".popup-report-issue");
        if (issueButton) {
            issueButton.addEventListener("click", () => {
                this.issueFormOpenTaskId = issueButton.dataset.taskId;
                this.selectTaskById(issueButton.dataset.taskId, { focusDetail: true });
            });
        }
    }

    // shared Copy coords binder mirroring the public map's data-copy handler
    // (region-map.js:1040): writes "lat,lng" and flashes brief "Copied"
    // feedback, restoring the original label after 1.2 s. Works in Leaflet
    // popup DOM (root from popup.getElement()) and in the detail panel.
    bindCopyCoords(rootEl) {
        if (!rootEl) return;
        rootEl.querySelectorAll("[data-copy]").forEach(button => {
            if (button.dataset.copyBound === "1") return;
            button.dataset.copyBound = "1";
            const original = button.textContent;
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                const value = button.getAttribute("data-copy");
                try {
                    await navigator.clipboard.writeText(value || "");
                    button.textContent = "Copied";
                } catch (error) {
                    button.textContent = "Copy failed";
                }
                window.setTimeout(() => { button.textContent = original; }, 1200);
            });
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
                            ? "No assigned tasks are currently visible. Refresh the task list or clear filters."
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
            // subtle state dot mirroring the map's validation ring
            const verifState = validationState(backendTask?.status, temporal.status);
            const stateSwatch = {
                validated_present: ["vm-validated-present-swatch", "validated present"],
                validated_absent: ["vm-validated-absent-swatch", "validated absent"],
                in_review: ["vm-in-review-swatch", "in review"],
                disputed: ["vm-disputed-swatch", "disputed"],
                stale_validation: ["vm-stale-swatch", "stale validation"],
            }[verifState];
            const stateDot = stateSwatch
                ? `<span class="legend-dot ${stateSwatch[0]}" title="${stateSwatch[1]}"></span>`
                : "";
            return `
                <button class="task-row${activeClass}" type="button" data-task-id="${escapeHtml(props.task_id)}">
                    <span class="task-row-title">
                        <span class="priority-dot priority-${escapeHtml(props.verification_priority)}"></span>
                        ${stateDot}${escapeHtml(props.name || "Unnamed site")}${outcomeBadge}
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

    featureForTaskId(taskId) {
        const activeFeature = this.tasks.find(feature => feature.properties?.task_id === taskId);
        if (activeFeature) return activeFeature;
        const backendTask = this.backendTasksById.get(taskId);
        return backendTask ? featureFromBackendTask(backendTask) : null;
    }

    selectTaskById(taskId, options = {}) {
        const task = this.featureForTaskId(taskId);
        if (task) {
            this.selectTask(task, false, options);
        }
    }

    selectTask(feature, fromMarker, options = {}) {
        // switching tasks rebuilds the form; confirm before typed work is lost
        const nextTaskId = feature?.properties?.task_id || "";
        if (this.formDirty && this.formDirtyTaskId && this.formDirtyTaskId !== nextTaskId) {
            if (!window.confirm("You have unsaved evidence on the current task. Discard it and open the other task?")) {
                return;
            }
            this.formSnapshotsByTaskId.delete(this.formDirtyTaskId);
            this.clearFormDirty();
        }
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
        this.renderDetailPreservingForm(feature);
        if (this.backend?.signedIn && props.task_id && !this.latestDraftsByTaskId.has(props.task_id)) {
            this.loadLatestDraftForTask(props.task_id).then(() => {
                if (this.selectedTask?.properties?.task_id === props.task_id) {
                    // async draft load re-renders; keep anything typed meanwhile
                    this.renderDetailPreservingForm(this.selectedTask);
                    if (options.focusDetail) {
                        this.focusDetailPanel();
                    }
                }
            });
        }
        if (options.focusDetail) {
            this.focusDetailPanel();
        }
    }

    async loadLatestDraftForTask(taskId) {
        if (!this.backend?.signedIn || !taskId) return null;
        try {
            const drafts = await this.backend.listTaskEvidence({ taskId, limit: 1 });
            const latestDraft = Array.isArray(drafts) && drafts.length ? drafts[0] : null;
            this.latestDraftsByTaskId.set(taskId, latestDraft);
            const backendTask = this.backendTasksById.get(taskId);
            if (
                latestDraft?.draft_status === "draft"
                && backendTask
                && REVISION_AUTO_ATTACH_STATUSES.has(backendTask.status)
                && latestDraft.evidence_draft_id
            ) {
                this.revisionDraftIdsByTaskId.set(taskId, latestDraft.evidence_draft_id);
            }
            return latestDraft;
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            console.warn("Could not load latest evidence draft:", error);
            return null;
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
                        ? `Sign in with Google at the top of this panel, then work through <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>. Use <em>Save draft</em> while working, <em>Submit unresolved note</em> when useful evidence remains incomplete, and <em>Submit for review</em> when a case is ready for JB.`
                        : `This link points to <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>, but this deployment does not yet have the shared backend enabled.`}
                </div>
                <div class="detail-section">
                    <h3>What to check</h3>
                    <div class="disabled-panel">
                        For each assigned case, answer the task question, seek non-OSM evidence where possible, record 2013, 2018, and 2023 status, preserve any useful opening or closure dates, and submit unresolved notes for cases that should stay visible but cannot yet be resolved.
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

    // post-submit (or post-skip) confirmation pane, mirroring the review
    // portal's "decision recorded" return-to-list. the finished task rightly
    // leaves the available list in assignment mode, so the prompt points at
    // the next task rather than the one just closed.
    renderSubmissionRecordedDetail(props, { unresolved = false, skipped = false } = {}) {
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        panel.innerHTML = `
            <h2>${skipped ? "Task skipped" : unresolved ? "Unresolved note submitted" : "Submitted for review"}</h2>
            <div class="copy-status" role="status">
                ${escapeHtml(props.name || "Unnamed site")} ${props.task_id ? `(${escapeHtml(props.task_id)})` : ""} —
                ${skipped
                    ? "skipped in the shared backend."
                    : unresolved
                        ? "saved as an unresolved note for review."
                        : "saved to the shared backend and submitted for review."}
            </div>
            <div class="button-row">
                <button id="openNextTaskButton" type="button">Open next task</button>
                ${skipped ? `<button id="undoSkipButton" class="secondary" type="button">Undo skip</button>` : ""}
            </div>
            <div id="confirmPaneStatus" class="copy-status" aria-live="polite"></div>
            <div class="pilot-note" role="note">
                Pick another task from the map or list.${this.filterActiveHint()}
            </div>
        `;
        document.getElementById("openNextTaskButton")?.addEventListener("click", () => this.openNextAvailableTask());
        document.getElementById("undoSkipButton")?.addEventListener("click", () => this.undoSkip(props.task_id));
    }

    // first task in the current filtered list order — the same
    // this.filteredTasks order the task list renders
    openNextAvailableTask() {
        const next = this.filteredTasks[0];
        if (!next) {
            const status = document.getElementById("confirmPaneStatus");
            if (status) status.textContent = "No more tasks match your filters.";
            return;
        }
        this.selectTaskById(next.properties?.task_id, { focusDetail: true });
    }

    async undoSkip(taskId) {
        const status = document.getElementById("confirmPaneStatus");
        if (!taskId) return;
        if (!this.backend?.configured || !this.backend.signedIn) {
            if (status) status.textContent = "Sign in to the shared backend before undoing the skip.";
            return;
        }
        const button = document.getElementById("undoSkipButton");
        if (button) button.disabled = true;
        if (status) status.textContent = "Undoing the skip...";
        try {
            const result = await this.backend.unskipTask({ taskId });
            this.taskHistoryByTaskId.delete(taskId);
            await this.refreshBackendTasks();
            this.applyFilters();
            // land the ra back in the reopened task's detail panel
            this.selectTaskById(result.task_id, { focusDetail: true });
            const copyStatus = document.getElementById("copyStatus");
            if (copyStatus) copyStatus.textContent = "Skip undone. The task is back in progress.";
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            if (button) button.disabled = false;
            if (status) status.textContent = `${error.message || "Could not undo the skip."} The task stays skipped.`;
        }
    }

    // low-prominence issue report: files map problems (duplicates, wrong
    // locations, non-places) as open tasks in the country's ra-issues batch
    issueFormHtml(context, { open = false } = {}) {
        const signedIn = Boolean(this.backend?.configured && this.backend.signedIn);
        return `
            <details id="issueReportDetails" class="skip-form issue-form"${open ? " open" : ""}>
                <summary>Report an issue with this place</summary>
                ${signedIn ? "" : `
                    <div class="demo-warning" role="alert">
                        Sign in with Google at the top of this panel to file an issue.
                    </div>
                `}
                <label>
                    What is wrong?
                    <select id="issueTypeSelect">
                        ${selectOptionsHtml(ISSUE_TYPE_OPTIONS, "other")}
                    </select>
                </label>
                <label>
                    Describe the issue (required)
                    <textarea id="issueNoteInput" rows="3" placeholder="What did you notice, and how could a reviewer confirm it?"></textarea>
                </label>
                <label>
                    Source title (optional)
                    <input id="issueSourceTitleInput" type="text">
                </label>
                <label>
                    Source URL (optional)
                    <input id="issueSourceUrlInput" type="url">
                </label>
                <div class="button-row">
                    <button id="issueSubmitButton" type="button"${signedIn ? "" : " disabled"}>File issue for review</button>
                    <button id="issueCancelButton" class="secondary" type="button">Cancel</button>
                </div>
                <div id="issueStatus" class="copy-status" aria-live="polite"></div>
            </details>
        `;
    }

    bindIssueForm(context) {
        const details = document.getElementById("issueReportDetails");
        if (!details) return;
        // remember the open state so async detail re-renders keep the form up
        details.addEventListener("toggle", () => {
            this.issueFormOpenTaskId = details.open ? (context.taskId || "__standalone__") : null;
        });
        document.getElementById("issueSubmitButton")?.addEventListener("click", () => this.submitIssueReport(context));
        document.getElementById("issueCancelButton")?.addEventListener("click", () => {
            details.open = false;
            const status = document.getElementById("issueStatus");
            if (status) status.textContent = "";
        });
    }

    async submitIssueReport(context) {
        const status = document.getElementById("issueStatus");
        const note = (document.getElementById("issueNoteInput")?.value || "").trim();
        if (!note) {
            if (status) status.textContent = "Describe the issue before filing it. Nothing was sent.";
            return;
        }
        if (!this.backend?.configured || !this.backend.signedIn) {
            if (status) status.textContent = "Sign in to the shared backend before filing an issue.";
            return;
        }
        if (!Number.isFinite(context.latitude) || !Number.isFinite(context.longitude)) {
            if (status) status.textContent = "This place has no usable coordinates, so the issue cannot be filed from here.";
            return;
        }
        const button = document.getElementById("issueSubmitButton");
        if (button) button.disabled = true;
        if (status) status.textContent = "Filing the issue...";
        try {
            const result = await this.backend.createIssueTask({
                countryCode: COUNTRY_CONFIG.countryCode,
                name: context.name || "Unnamed site",
                issueType: document.getElementById("issueTypeSelect")?.value || "other",
                note,
                latitude: context.latitude,
                longitude: context.longitude,
                siteId: context.siteId || undefined,
                osmId: context.osmId || undefined,
                sourceTitle: (document.getElementById("issueSourceTitleInput")?.value || "").trim() || undefined,
                sourceUrl: (document.getElementById("issueSourceUrlInput")?.value || "").trim() || undefined,
                targetYears: COUNTRY_CONFIG.targetYears.map(Number),
                clientContext: {
                    source: "portal_issue_report",
                    country_code: COUNTRY_CONFIG.countryCode,
                    page_path: window.location.pathname,
                },
            });
            if (status) {
                status.textContent = result.deduped
                    ? `An open issue for this place already exists — your note was added to it (task ${result.task_id}).`
                    : `Issue filed for review (task ${result.task_id}).`;
            }
            // clear the note so a stray second click cannot double-file
            const noteInput = document.getElementById("issueNoteInput");
            if (noteInput) noteInput.value = "";
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            // the form stays open with the error visible; nothing is cleared
            if (status) status.textContent = `${error.message || "Could not file the issue."} Nothing was filed — adjust and try again.`;
        } finally {
            if (button) button.disabled = false;
        }
    }

    // public-map hand-off: ?report_issue=1&name=..&lat=..&lng=..&site_id=..
    // &osm_id=.. opens a prefilled standalone issue form; tolerant of
    // missing params — submit validation names anything absent
    maybeOpenIssueDeepLink() {
        if (SEARCH_PARAMS.get("report_issue") !== "1") return;
        const context = {
            taskId: "",
            name: (SEARCH_PARAMS.get("name") || "").trim(),
            latitude: Number.parseFloat(SEARCH_PARAMS.get("lat") || ""),
            longitude: Number.parseFloat(SEARCH_PARAMS.get("lng") || ""),
            siteId: (SEARCH_PARAMS.get("site_id") || "").trim() || undefined,
            osmId: (SEARCH_PARAMS.get("osm_id") || "").trim() || undefined,
        };
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        const hasCoords = Number.isFinite(context.latitude) && Number.isFinite(context.longitude);
        panel.innerHTML = `
            <h2>Report an issue</h2>
            <div class="pilot-note" role="note">
                Reporting an issue for <strong>${escapeHtml(context.name || "an unnamed place")}</strong>${hasCoords ? ` at ${context.latitude.toFixed(5)}, ${context.longitude.toFixed(5)}` : ""}.
            </div>
            ${this.issueFormHtml(context, { open: true })}
        `;
        this.bindIssueForm(context);
        if (hasCoords) {
            this.map.setView([context.latitude, context.longitude], Math.max(this.map.getZoom(), 16));
        }
        this.focusDetailPanel();
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

    backendTaskForProps(props) {
        return props?.task_id ? this.backendTasksById.get(props.task_id) : null;
    }

    taskCanRevise(taskId) {
        const backendTask = this.backendTasksById.get(taskId);
        return Boolean(backendTask && REVISION_ELIGIBLE_STATUSES.has(backendTask.status));
    }

    taskIsRevisionMode(taskId) {
        return this.revisionDraftIdsByTaskId.has(taskId);
    }

    taskIsReadOnly(taskId) {
        const backendTask = this.backendTasksById.get(taskId);
        if (!ASSIGNMENT_MODE || !backendTask) return false;
        return READ_ONLY_ASSIGNMENT_STATUSES.has(backendTask.status) && !this.taskIsRevisionMode(taskId);
    }

    // starts a revision for the selected task through the same server
    // mutation as the changes-requested panel: the server clones the active
    // submission into an editable draft, applies the per-status transition,
    // and records a task event, so every revision start reaches
    // reviews:feedbackLoopMetrics rather than only the changes_requested ones.
    async startSubmissionRevision(props) {
        const taskId = props?.task_id || "";
        if (!taskId || !this.taskCanRevise(taskId) || !this.backend?.signedIn) return;
        const button = document.getElementById("reviseSubmissionButton");
        if (button) {
            button.disabled = true;
            button.textContent = "Starting revision...";
        }
        try {
            const result = await this.backend.reviseEvidenceDraft({ taskId });
            this.revisionDraftIdsByTaskId.set(taskId, result.evidence_draft_id);
            this.latestDraftsByTaskId.delete(taskId);
            await this.refreshBackendTasks();
            await this.loadLatestDraftForTask(taskId);
            this.renderDetail(this.featureForTaskId(taskId) || this.selectedTask);
            const status = document.getElementById("copyStatus");
            if (status) {
                status.textContent = "Revision started. Save a revision draft while working, then submit the revision for review when ready.";
            }
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            if (button) {
                button.disabled = false;
                button.textContent = "Revise submission";
            }
            const status = document.getElementById("copyStatus");
            if (status) {
                status.textContent = `${error.message || "Could not start a revision."} Nothing was changed.`;
            }
        }
    }

    backendStatusHtml(props) {
        if (!this.backend?.configured) return "";
        const backendTask = this.backendTaskForProps(props);
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
        const revisionText = this.taskIsRevisionMode(props.task_id)
            ? " Revision mode is active; saving creates a new evidence version."
            : "";
        return `
            <div class="pilot-note">
                Shared backend status: <strong>${escapeHtml(backendTask.status.replaceAll("_", " "))}</strong>.${escapeHtml(revisionText)}
            </div>
        `;
    }

    // mark the evidence form as carrying unsaved typed work for a task
    markFormDirty(taskId) {
        this.formDirty = true;
        this.formDirtyTaskId = taskId || this.selectedTask?.properties?.task_id || null;
    }

    clearFormDirty() {
        this.formDirty = false;
        this.formDirtyTaskId = null;
    }

    // snapshot the typed form as a draft-shaped object so applyDraftToForm
    // can reapply it after a programmatic rebuild
    snapshotFormForTask(taskId) {
        if (!taskId || !document.getElementById("raActionSelect")) return;
        const values = this.currentFormValues();
        this.formSnapshotsByTaskId.set(taskId, {
            action: values.action,
            target_year_statuses: values.targetYearStatuses,
            source_type: values.sourceType,
            existence_status: values.existenceStatus,
            worship_use_status: values.rawWorshipUseStatus,
            assessment_confidence: values.assessmentConfidence,
            match_confidence: values.matchConfidence,
            geocoding_confidence: values.geocodingConfidence,
            provider: values.sourceProvider,
            source_title: values.sourceTitle,
            source_date_or_capture_date: values.sourceDate,
            address_raw: values.addressRaw,
            locality_raw: values.localityRaw,
            address_change_note: values.addressNote,
            lifecycle_event: values.lifecycleEvent,
            lifecycle_date: values.lifecycleDate,
            lifecycle_date_precision: values.lifecycleDatePrecision,
            lifecycle_note: values.lifecycleNote,
            change_class: values.changeClass,
            source_url_or_file: values.sourceUrl,
            related_ids_or_note: values.relatedIds,
            evidence_note: values.note,
        });
    }

    // re-render the detail panel without losing typed-but-unsaved values;
    // use for same-task programmatic rebuilds (year change, refresh, sign-in)
    renderDetailPreservingForm(feature) {
        const taskId = feature?.properties?.task_id;
        if (taskId && this.formDirty && this.formDirtyTaskId === taskId) {
            this.snapshotFormForTask(taskId);
        }
        this.renderDetail(feature);
    }

    // cmd/ctrl+enter submits the open evidence form; plain "n" on the
    // confirmation pane opens the next task when no field has focus
    handleGlobalKeydown(event) {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            const withinForm = event.target?.closest?.(".review-form");
            if (!withinForm) return;
            // the shortcut always means submit, never newline: prevent the
            // textarea default even while the in-flight save has it locked
            event.preventDefault();
            const submitButton = document.getElementById("submitReviewButton");
            if (submitButton && !submitButton.disabled) {
                submitButton.click();
            }
            return;
        }
        if (event.key === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
            const tag = (document.activeElement?.tagName || "").toLowerCase();
            if (tag === "input" || tag === "select" || tag === "textarea") return;
            const nextButton = document.getElementById("openNextTaskButton");
            if (nextButton) {
                event.preventDefault();
                nextButton.click();
            }
        }
    }

    renderDetail(feature) {
        const props = { ...(feature.properties || {}) };
        const coordinates = feature.geometry?.coordinates || [];
        props.google_maps_url = mapUrlForCoordinates(coordinates) || props.google_maps_url || "";
        props.street_view_url = streetViewUrlForCoordinates(coordinates) || props.street_view_url || "";
        const checks = props.automated_checks || [];
        const searches = props.search_queries || {};
        // issue reports need the point itself, not the task state
        const issueContext = {
            taskId: props.task_id || "",
            name: props.name || "",
            latitude: Number(coordinates[1]),
            longitude: Number(coordinates[0]),
            siteId: props.master_site_id || undefined,
            osmId: props.osm_id || undefined,
        };
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
                <div class="copy-help">
                    Use OSM to identify why this case was flagged. Use Street View or other non-OSM sources to check what is visible, and record the imagery capture date when Google shows one.
                </div>
                <div class="link-grid">
                    ${this.linkHtml("Street View", props.street_view_url, "source-link-primary")}
                    ${this.linkHtml("Google Maps", props.google_maps_url, "source-link-primary")}
                    ${Number.isFinite(issueContext.latitude) && Number.isFinite(issueContext.longitude) ? `
                    ${this.linkHtml("Open OSM", osmPointUrl(issueContext.latitude, issueContext.longitude))}
                    <button class="coord-copy" type="button" data-copy="${escapeHtml(`${issueContext.latitude.toFixed(5)},${issueContext.longitude.toFixed(5)}`)}">Copy coords</button>` : ""}
                    ${this.linkHtml("OSM object", props.osm_object_url)}
                    ${this.linkHtml("OSM history", props.osm_history_url)}
                    ${this.linkHtml("OSM map", props.osm_map_url)}
                    ${this.linkHtml("Name search", searches.name_locality?.google_url)}
                </div>
            </div>

            <div class="detail-section">
                ${INTAKE_ENABLED ? this.reviewFormHtml(props) : this.disabledIntakeHtml()}
            </div>

            <div class="detail-section">
                ${this.issueFormHtml(issueContext, { open: this.issueFormOpenTaskId === props.task_id })}
            </div>

            <div class="detail-section">
                <details id="taskHistoryDetails" class="skip-form history-section">
                    <summary>History</summary>
                    <div id="taskHistoryBody" class="history-body">Loading history...</div>
                </details>
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
        this.bindIssueForm(issueContext);
        this.bindCopyCoords(panel);
        this.bindTaskHistory(props.task_id);
    }

    // history timeline: fetch-on-open with a per-task cache; write actions
    // invalidate the cache so reopening shows the fresh events
    bindTaskHistory(taskId) {
        const details = document.getElementById("taskHistoryDetails");
        if (!details) return;
        details.addEventListener("toggle", () => {
            if (details.open) this.loadTaskHistory(taskId);
        });
    }

    async loadTaskHistory(taskId) {
        const body = document.getElementById("taskHistoryBody");
        if (!body || !taskId) return;
        if (!this.backend?.configured || !this.backend.signedIn) {
            body.innerHTML = `
                <div class="demo-warning" role="alert">
                    Sign in with Google at the top of this panel to see task history.
                </div>
            `;
            return;
        }
        const cached = this.taskHistoryByTaskId.get(taskId);
        if (cached) {
            body.innerHTML = this.taskHistoryHtml(cached);
            return;
        }
        body.textContent = "Loading history...";
        try {
            const history = await this.backend.getTaskHistory({ taskId });
            this.taskHistoryByTaskId.set(taskId, history);
            body.innerHTML = this.taskHistoryHtml(history);
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            body.innerHTML = `<div class="copy-status">${escapeHtml(error.message || "Could not load task history.")}</div>`;
        }
    }

    taskHistoryHtml(history) {
        const events = history?.events || [];
        const draftCount = history?.draft_count ?? 0;
        const latestReview = history?.latest_review || null;
        const summary = `${draftCount} draft${draftCount === 1 ? "" : "s"} · latest review: ${latestReview ? escapeHtml(latestReview.decision_status.replaceAll("_", " ")) : "none"}`;
        if (!events.length) {
            return `
                <div class="history-summary">${summary}</div>
                <div class="copy-help">No recorded events for this task yet.</div>
            `;
        }
        return `
            <div class="history-summary">${summary}</div>
            <ul class="history-timeline">
                ${events.map(event => {
                    const label = EVENT_TYPE_LABELS[event.event_type] || cap(String(event.event_type || "").replaceAll("_", " "));
                    const when = new Date(event.occurred_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
                    const actor = `${escapeHtml(event.actor_role || "")}${event.is_self ? " (you)" : ""}`;
                    return `
                        <li>
                            <strong>${escapeHtml(label)}</strong> — ${escapeHtml(when)} · ${actor}
                            ${event.reason ? `<div class="history-reason">${escapeHtml(event.reason)}</div>` : ""}
                        </li>
                    `;
                }).join("")}
            </ul>
        `;
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
            { id: "copy", title: "4. Save", subtitle: this.backend?.configured ? "Save & submit" : "Fallback copy" },
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

    latestDraftForTask(taskId) {
        return this.latestDraftsByTaskId.get(taskId) || null;
    }

    // shows the lifecycle-date hint when the chosen action implies closure or
    // worship-function change; lets RAs see the prompt without forcing a value
    updateClosureLifecycleHint() {
        const hint = document.getElementById("closureLifecycleHint");
        if (!hint) return;
        const action = document.getElementById("raActionSelect")?.value || "";
        const closureActions = new Set([
            "closed_or_changed_use",
            "no_building_present",
            "denomination_or_shared_use",
            COUNTRY_CONFIG.temporalLossAction.value,
        ]);
        const implied = closureActions.has(action);
        hint.hidden = !implied;
        // a closure-implying action should surface the collapsed lifecycle block
        if (implied) {
            const block = document.getElementById("lifecycleBlockDetails");
            if (block) block.open = true;
        }
    }

    // returns " If your filters hide the next task, clear them above the list."
    // when any sidebar filter is non-default; otherwise empty string
    filterActiveHint() {
        const search = (document.getElementById("searchInput")?.value || "").trim();
        const priority = document.getElementById("priorityFilter")?.value || "all";
        const action = document.getElementById("actionFilter")?.value || "all";
        const statusFilter = document.getElementById("statusFilter")?.value || "all";
        const active = Boolean(search) || priority !== "all" || action !== "all" || statusFilter !== "all";
        return active ? " If your filters hide the next task, clear them above the list." : "";
    }

    formModeNoticeHtml(props) {
        const draft = props?.task_id ? this.latestDraftForTask(props.task_id) : null;
        const backendTask = this.backendTaskForProps(props);
        const status = backendTask?.status || "";
        const readOnly = props?.task_id ? this.taskIsReadOnly(props.task_id) : false;
        const revisionMode = props?.task_id ? this.taskIsRevisionMode(props.task_id) : false;
        if (this.backend?.configured && this.backendUser) {
            if (revisionMode) {
                return `
                    <div class="pilot-note">
                        Revision mode is active. Saving now creates a new draft version; submitting sends the revised evidence back to review.
                    </div>
                `;
            }
            if (readOnly && status === "needs_review") {
                return `
                    <div class="pilot-note">
                        This submission is waiting for review. View it here, or use <strong>Revise submission</strong> if you have new evidence or need to correct a mistake.
                    </div>
                `;
            }
            if (readOnly && status === "unresolved_note") {
                return `
                    <div class="pilot-note">
                        This unresolved note is waiting for review. View it here, or use <strong>Revise submission</strong> if you find better evidence.
                    </div>
                `;
            }
            if (readOnly && status === "changes_requested") {
                return `
                    <div class="pilot-note">
                        A reviewer asked for more evidence. Use <strong>Revise submission</strong> to respond with a new evidence version.
                    </div>
                `;
            }
            if (readOnly) {
                return `
                    <div class="pilot-note">
                        This task is closed for now. You can view the saved evidence, but it should not be changed unless JB reopens it.
                    </div>
                `;
            }
            return `
                <div class="pilot-note">
                    Shared backend enabled. Use <strong>Save draft</strong>, <strong>Submit unresolved note</strong>, or <strong>Submit for review</strong> to record this work.
                    ${draft ? `<br><strong>Draft loaded:</strong> showing the latest saved draft for this task. Change the action above if you want to recompute defaults.` : ""}
                </div>
            `;
        }
        if (ASSIGNMENT_MODE) {
            return `
                <div class="demo-warning" role="alert">
                    Sign in with Google at the top of this panel before recording this assignment.
                </div>
            `;
        }
        return `
            <div class="demo-warning" role="alert">
                Demo only. This generates local text to paste into the working sheet or send to JB; it does not save or submit data. Do not enter private or sensitive data.
            </div>
        `;
    }

    // skip control with quick-reason chips; free text stays allowed, and the
    // duplicate/data-error chips surface a pointer at the issue pipeline
    skipFormHtml() {
        return `
            <details class="skip-form">
                <summary>Nothing to record for this task — skip it</summary>
                <div class="skip-reason-chips">
                    ${SKIP_REASON_CHIPS.map(chip => `
                        <button type="button" class="tertiary skip-chip" data-reason="${escapeHtml(chip.reason)}"${chip.issueHint ? ` data-issue-hint="1"` : ""}>${escapeHtml(chip.reason)}</button>
                    `).join("")}
                </div>
                <label>
                    Reason (optional)
                    <input id="skipReasonInput" type="text" placeholder="e.g. evidence already covered by another task">
                </label>
                <div id="skipIssueHint" class="copy-help" hidden>
                    Consider filing this as an issue instead — <strong>Report an issue</strong> keeps it visible for review.
                </div>
                <button type="button" class="skip-confirm" id="skipTaskButton">Skip this task</button>
            </details>
        `;
    }

    reviewFormHtml(props) {
        const taskId = props?.task_id || "";
        if (ASSIGNMENT_MODE && !this.backendUser) {
            return `
                <h3>2. Sign in first</h3>
                <div class="demo-warning" role="alert">
                    Sign in with Google at the top of this panel before recording this assignment.
                </div>
            `;
        }
        const assignmentTaskAvailable = this.backend?.configured
            && this.backendUser
            && this.backendTasksById.has(taskId);
        if (ASSIGNMENT_MODE && this.backendUser && !assignmentTaskAvailable) {
            return `
                <h3>2. Recording disabled</h3>
                <div class="demo-warning" role="alert">
                    This task is not available in the shared assignment. Refresh the task list, then choose a task from the assigned list.
                </div>
            `;
        }
        const backendTask = this.backendTaskForProps(props);
        const readOnly = taskId ? this.taskIsReadOnly(taskId) : false;
        const revisionMode = taskId ? this.taskIsRevisionMode(taskId) : false;
        const canRevise = taskId ? this.taskCanRevise(taskId) : false;
        const skipControl = ASSIGNMENT_MODE
            ? (assignmentTaskAvailable && !readOnly && !revisionMode ? this.skipFormHtml() : "")
            : this.skipFormHtml();
        // collapsed optional blocks open when the saved draft or a pending
        // unsaved snapshot already carries values for them
        const prefill = this.formSnapshotsByTaskId.get(taskId) || this.latestDraftForTask(taskId) || {};
        const addressOpen = Boolean(prefill.address_raw || prefill.locality_raw || prefill.address_change_note);
        const lifecycleOpen = Boolean(prefill.lifecycle_event || prefill.lifecycle_date || prefill.lifecycle_note);
        const relatedOpen = Boolean(prefill.related_ids_or_note);
        return `
            <h3>2. Choose what your evidence shows</h3>
            <div class="review-form">
                ${this.formModeNoticeHtml(props)}
                <label>
                    What did you find?
                    <select id="raActionSelect">
                        <option value="needs_review">Needs review</option>
                        <option value="confirm_current_record">Confirm current site</option>
                        <option value="missing_current_site">Missing from project map</option>
                        <option value="possible_duplicate">Possible duplicate</option>
                        <option value="${escapeHtml(COUNTRY_CONFIG.temporalLossAction.value)}">${escapeHtml(COUNTRY_CONFIG.temporalLossAction.label)}</option>
                        <option value="closed_or_changed_use">Closed or changed use</option>
                        <option value="no_building_present">No building present</option>
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
                <details class="skip-form optional-block" id="addressBlockDetails"${addressOpen ? " open" : ""}>
                    <summary>Address or locality (optional)</summary>
                    <div class="copy-help">
                        Use these fields when the task says the street address is missing or a source gives a better address than the map record. Leave them blank if your evidence is about worship use only.
                    </div>
                    <div class="field-grid">
                        <label>
                            Street address found
                            <input id="addressRawInput" type="text" placeholder="${escapeHtml(props.address || "e.g. 12 Example Street")}">
                        </label>
                        <label>
                            Locality found
                            <input id="localityRawInput" type="text" placeholder="${escapeHtml(props.locality || "suburb, town, or city")}">
                        </label>
                    </div>
                    <label>
                        Address note
                        <input id="addressNoteInput" type="text" placeholder="e.g. source gives street address; map point remains approximate">
                    </label>
                </details>
                <details class="skip-form optional-block" id="lifecycleBlockDetails"${lifecycleOpen ? " open" : ""}>
                    <summary>Optional opening, closure, or later change</summary>
                    <div class="copy-help">
                        Use this when the source gives a dated opening, closure, first/last seen, relocation, demolition, or later worship-function change. For example, use <em>Use changed / shared use began</em> for evidence that a site became multi-denominational in 2024.
                    </div>
                    <div class="copy-help action-closure-hint" id="closureLifecycleHint" hidden>
                        <strong>Lifecycle date helps:</strong> for this action, please record an opening, closure, or changed-use date if the source gives one. If the date is bracketed, use <em>not earlier than</em> or <em>not later than</em> in the event note. If only a year is supported, set the precision to <em>Year</em> or <em>Bounded / inferred</em>.
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
                </details>
                <label>
                    What kind of claim is this?
                    <select id="changeClassSelect">
                        ${selectOptionsHtml(CHANGE_CLASS_OPTIONS, "uncertain")}
                    </select>
                </label>
                <div class="copy-help">
                    This distinction drives the annual census: real change is counted, map corrections rewrite history.
                </div>
                <div class="source-url-row">
                    <label>
                        Source URL or file reference
                        <input id="sourceUrlInput" type="text" placeholder="https:// link, Street View link, archive, or agreed storage path">
                    </label>
                    <div class="source-url-actions">
                        <button id="useStreetViewUrlButton" type="button" class="tertiary" title="Fill the URL field with the Google Street View link if street-level imagery is your evidence">Use Street View URL</button>
                        <button id="useOsmUrlButton" type="button" class="tertiary" title="Fill the URL field with the OSM record link if your evidence is the OSM record itself">Use OSM URL</button>
                    </div>
                </div>
                <details class="skip-form optional-block" id="relatedIdsBlockDetails"${relatedOpen ? " open" : ""}>
                    <summary>Related ids or duplicate note (optional)</summary>
                    <label>
                        Related ids or duplicate note
                        <input id="relatedIdsInput" type="text" placeholder="Other master/OSM ids, if relevant">
                    </label>
                </details>
                <label>
                    Evidence note
                    <textarea id="decisionNote" rows="3" placeholder="One or two sentences explaining what the source says about this site at the target year."></textarea>
                </label>
                <h3>4. Save or submit</h3>
                ${this.backend?.configured && this.backendUser ? `
                    <div class="copy-help">
                        ${readOnly
                            ? "This saved work is visible for reference. Revisions create a new evidence version; they do not rewrite the submitted record."
                            : revisionMode
                                ? "Save a revision draft while working. Submit the revision when the corrected or extended evidence is ready for review."
                                : "Save drafts while working. Use Submit unresolved note when you have checked sources but cannot resolve the case. Use Submit for review when the evidence is ready for a decision."}
                    </div>
                    ${readOnly ? `
                        ${canRevise ? `
                            <div class="button-row">
                                <button id="reviseSubmissionButton" type="button">Revise submission</button>
                            </div>
                        ` : `
                            <div class="disabled-panel">
                                Status: ${escapeHtml((backendTask?.status || "closed").replaceAll("_", " "))}. Ask JB to reopen this task if new evidence changes the answer.
                            </div>
                        `}
                    ` : `
                        <div class="button-row">
                            <button id="saveDraftButton" type="button">${revisionMode ? "Save revision draft" : "Save draft"}</button>
                            <button id="submitUnresolvedButton" class="secondary" type="button">${revisionMode ? "Submit revision as unresolved note" : "Submit unresolved note"}</button>
                            <button id="submitReviewButton" type="button">${revisionMode ? "Submit revision for review" : "Submit for review"}</button>
                        </div>
                    `}
                ` : ASSIGNMENT_MODE ? `
                    <div class="demo-warning" role="alert">
                        Sign in with Google at the top of this panel before recording this assignment.
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
                ${skipControl}
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
            this.updateClosureLifecycleHint();
            this.updateWorkflowSteps();
        };
        // any user edit marks the form dirty so rebuilds and unloads guard it
        const markDirty = () => this.markFormDirty(props.task_id);
        actionSelect?.addEventListener("change", () => {
            markDirty();
            applyDefaults();
        });
        applyDefaults();
        const latestDraft = this.latestDraftForTask(props.task_id);
        if (latestDraft) {
            this.applyDraftToForm(latestDraft);
        }
        // typed-but-unsaved values snapshotted before a programmatic rebuild
        // win over the saved draft and stay marked unsaved
        const snapshot = this.formSnapshotsByTaskId.get(props.task_id);
        if (snapshot) {
            this.formSnapshotsByTaskId.delete(props.task_id);
            this.applyDraftToForm(snapshot);
            this.markFormDirty(props.task_id);
        }
        this.updateClosureLifecycleHint();

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

        const useStreetViewButton = document.getElementById("useStreetViewUrlButton");
        if (useStreetViewButton) {
            useStreetViewButton.addEventListener("click", () => {
                if (sourceUrl) {
                    sourceUrl.value = props.street_view_url || "";
                    sourceUrl.dispatchEvent(new Event("input", { bubbles: true }));
                }
                if (sourceTitle && !sourceTitle.value) {
                    sourceTitle.value = "Google Street View imagery";
                    sourceTitle.dispatchEvent(new Event("input", { bubbles: true }));
                }
                const sourceProvider = document.getElementById("sourceProviderInput");
                if (sourceProvider && !sourceProvider.value) {
                    sourceProvider.value = "Google Street View";
                    sourceProvider.dispatchEvent(new Event("input", { bubbles: true }));
                }
                const sourceTypeSelect = document.getElementById("sourceTypeSelect");
                if (sourceTypeSelect) {
                    sourceTypeSelect.value = "street_imagery";
                }
                const sourceDate = document.getElementById("sourceDateInput");
                if (sourceDate && !sourceDate.value) {
                    sourceDate.placeholder = "Enter the capture date shown in Street View, e.g. 2023-10";
                }
                this.updateWorkflowSteps();
            });
        }

        // Track touch state on the note so action changes never silently
        // overwrite RA-typed text.
        if (note) {
            note.addEventListener("input", () => {
                note.dataset.touched = "1";
                markDirty();
                this.updateWorkflowSteps();
            });
        }

        [
            "sourceProviderInput",
            "sourceUrlInput",
            "sourceTitleInput",
            "sourceDateInput",
            "addressRawInput",
            "localityRawInput",
            "addressNoteInput",
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
            document.getElementById(id)?.addEventListener("input", () => {
                markDirty();
                this.updateWorkflowSteps();
            });
            document.getElementById(id)?.addEventListener("change", event => {
                if (id.endsWith("Select") && !id.startsWith("source")) {
                    event.target.dataset.touched = "1";
                }
                markDirty();
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
                markDirty();
                this.applyControlledAssessmentDefaults();
                this.updateWorkflowSteps();
            });
        });

        document.getElementById("copyEvidenceRowButton")?.addEventListener("click", () => this.copyEvidenceRow(props));
        document.getElementById("copyDecisionButton")?.addEventListener("click", () => this.copyDecision(props));
        document.getElementById("saveDraftButton")?.addEventListener("click", () => this.saveEvidenceToBackend(props, { submit: false }));
        document.getElementById("submitUnresolvedButton")?.addEventListener("click", () => this.saveEvidenceToBackend(props, { unresolved: true }));
        document.getElementById("submitReviewButton")?.addEventListener("click", () => this.saveEvidenceToBackend(props, { submit: true }));
        document.getElementById("reviseSubmissionButton")?.addEventListener("click", () => this.startSubmissionRevision(props));
        document.getElementById("skipTaskButton")?.addEventListener("click", () => {
            const reason = (document.getElementById("skipReasonInput")?.value || "").trim();
            this.skipCurrentTask(props, reason);
        });
        // quick-reason chips fill the input; the two data-quality chips also
        // reveal the pointer at the issue pipeline
        document.querySelectorAll(".skip-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                const input = document.getElementById("skipReasonInput");
                if (input) input.value = chip.dataset.reason || "";
                const hint = document.getElementById("skipIssueHint");
                if (hint) hint.hidden = chip.dataset.issueHint !== "1";
            });
        });

        if (this.taskIsReadOnly(props.task_id)) {
            this.setReviewFormReadOnly();
        }
        this.updateWorkflowSteps();
    }

    setReviewFormReadOnly() {
        document.querySelectorAll(".review-form select, .review-form input, .review-form textarea").forEach(element => {
            element.disabled = true;
        });
        document.querySelectorAll(".review-form button").forEach(element => {
            if (element.id !== "reviseSubmissionButton") {
                element.disabled = true;
            }
        });
    }

    applyDraftToForm(draft) {
        const setValue = (id, value, markTouched = true) => {
            const element = document.getElementById(id);
            if (!element || value === undefined || value === null) return;
            element.value = String(value);
            if (markTouched) element.dataset.touched = "1";
        };

        setValue("raActionSelect", draft.action, false);
        TARGET_YEARS.forEach(year => {
            setValue(`status${year}`, draft.target_year_statuses?.[year], false);
        });
        setValue("sourceTypeSelect", draft.source_type);
        setValue("existenceStatusSelect", draft.existence_status);
        setValue(
            "worshipUseStatusSelect",
            draft.action === "no_building_present" ? "no_building_present" : draft.worship_use_status,
        );
        setValue("assessmentConfidenceSelect", draft.assessment_confidence);
        setValue("matchConfidenceSelect", draft.match_confidence);
        setValue("geocodingConfidenceSelect", draft.geocoding_confidence);
        setValue("sourceProviderInput", draft.provider, false);
        setValue("sourceTitleInput", draft.source_title, false);
        setValue("sourceDateInput", draft.source_date_or_capture_date, false);
        setValue("addressRawInput", draft.address_raw, false);
        setValue("localityRawInput", draft.locality_raw, false);
        setValue("addressNoteInput", draft.address_change_note, false);
        setValue("lifecycleEventSelect", draft.lifecycle_event);
        setValue("lifecycleDateInput", draft.lifecycle_date, false);
        setValue("lifecycleDatePrecisionSelect", draft.lifecycle_date_precision);
        setValue("lifecycleNoteInput", draft.lifecycle_note, false);
        setValue("changeClassSelect", draft.change_class);
        setValue("sourceUrlInput", draft.source_url_or_file, false);
        setValue("relatedIdsInput", draft.related_ids_or_note, false);
        setValue("decisionNote", draft.evidence_note, true);
        // the form now mirrors a known baseline; snapshot reapply re-marks
        // it dirty afterwards because those values are still unsaved
        this.clearFormDirty();
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
        const action = document.getElementById("raActionSelect")?.value || "needs_review";
        const rawWorshipUseStatus = document.getElementById("worshipUseStatusSelect")?.value || "uncertain";
        const noBuilding = action === "no_building_present" || rawWorshipUseStatus === "no_building_present";
        return {
            action,
            targetYearStatuses,
            sourceType: document.getElementById("sourceTypeSelect")?.value || "other",
            existenceStatus: noBuilding ? "absent" : document.getElementById("existenceStatusSelect")?.value || "uncertain",
            worshipUseStatus: noBuilding ? "not_worship" : rawWorshipUseStatus,
            rawWorshipUseStatus,
            assessmentConfidence: document.getElementById("assessmentConfidenceSelect")?.value || "",
            matchConfidence: document.getElementById("matchConfidenceSelect")?.value || "medium",
            geocodingConfidence: document.getElementById("geocodingConfidenceSelect")?.value || "medium",
            sourceProvider: document.getElementById("sourceProviderInput")?.value || "",
            sourceTitle: document.getElementById("sourceTitleInput")?.value || "",
            sourceDate: document.getElementById("sourceDateInput")?.value || "",
            addressRaw: document.getElementById("addressRawInput")?.value || "",
            localityRaw: document.getElementById("localityRawInput")?.value || "",
            addressNote: document.getElementById("addressNoteInput")?.value || "",
            lifecycleEvent: document.getElementById("lifecycleEventSelect")?.value || "",
            lifecycleDate: document.getElementById("lifecycleDateInput")?.value || "",
            lifecycleDatePrecision: document.getElementById("lifecycleDatePrecisionSelect")?.value || "unknown",
            lifecycleNote: document.getElementById("lifecycleNoteInput")?.value || "",
            changeClass: document.getElementById("changeClassSelect")?.value || "uncertain",
            sourceUrl: document.getElementById("sourceUrlInput")?.value || "",
            relatedIds: document.getElementById("relatedIdsInput")?.value || "",
            note: document.getElementById("decisionNote")?.value || "",
        };
    }

    evidenceInputError(values, options = {}) {
        const unresolved = Boolean(options.unresolved);
        const submit = !unresolved && options.submit !== false;
        if (!submit && !unresolved) return "";
        if (unresolved) {
            if (values.sourceTitle.trim() && isPlaceholderText(values.sourceTitle)) {
                return "Do not use NA or N/A as a source title. Add the actual source title, or leave it blank and explain what you checked.";
            }
            if (values.note.trim().length < 12) {
                return "Add a short unresolved-note explanation: what you checked, what remains unclear, or why the case needs review.";
            }
            if (values.sourceDate.trim() && !isValidPartialDateText(values.sourceDate)) {
                return "Use YYYY, YYYY-MM, or YYYY-MM-DD for source and capture dates. Preserve prose dates in the note.";
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
            return "";
        }
        if (!values.sourceTitle.trim()) return "Add a source title.";
        if (isPlaceholderText(values.sourceTitle)) {
            return "Do not use NA or N/A as a source title. Add the actual source title, or save a draft until you have it.";
        }
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
        const addressRaw = values.addressRaw.trim() || props.address || "";
        const localityRaw = values.localityRaw.trim() || props.locality || "";

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
        row.address_raw = addressRaw;
        row.modern_address_candidate = addressRaw;
        row.address_standardised = addressRaw;
        row.locality_raw = localityRaw;
        row.address_change_note = values.addressNote
            || (values.addressRaw.trim() || values.localityRaw.trim() ? "RA supplied source-backed address or locality." : "");
        row.geocoding_basis = isMissing
            ? "manual_match"
            : values.addressRaw.trim() || values.localityRaw.trim()
                ? "source_address"
                : "existing_osm_site";
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

    buildEvidenceDraft(props, row, options = {}) {
        const values = this.currentFormValues();
        const targetEvidence = values.note || deriveTargetYearStatus(props, this.targetYear).note;
        const targetYearEvidence = Object.fromEntries(TARGET_YEARS.map(year => [
            year,
            (values.targetYearStatuses[year] || "not_assessed") === "not_assessed" ? "" : targetEvidence,
        ]));
        const submitError = this.evidenceInputError(values, { submit: true });
        const unresolved = Boolean(options.unresolved);
        const unresolvedError = unresolved ? this.evidenceInputError(values, { unresolved: true }) : "";
        const validationMessages = [];
        if (unresolvedError) {
            validationMessages.push(unresolvedError);
        } else if (unresolved && submitError) {
            validationMessages.push(`Full submission still needs: ${submitError}`);
        } else if (submitError) {
            validationMessages.push(submitError);
        }
        return {
            source_type: values.sourceType,
            provider: values.sourceProvider || undefined,
            source_title: values.sourceTitle,
            source_url_or_file: values.sourceUrl || undefined,
            source_date_or_capture_date: values.sourceDate || undefined,
            address_raw: values.addressRaw || undefined,
            locality_raw: values.localityRaw || undefined,
            address_change_note: values.addressNote || undefined,
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
            change_class: values.changeClass || "uncertain",
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
                status: unresolved ? "unresolved_note" : submitError ? "draft_needs_more_detail" : "client_checked",
                checked_at: nowIso(),
                messages: validationMessages,
            },
        };
    }

    async saveEvidenceToBackend(props, options = {}) {
        const status = document.getElementById("copyStatus");
        const values = this.currentFormValues();
        const unresolved = Boolean(options.unresolved);
        const submit = Boolean(options.submit);
        const inputError = this.evidenceInputError(values, unresolved ? { unresolved: true } : { submit });
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
        const draft = this.buildEvidenceDraft(props, row, { unresolved });
        // prefer the tracked revision draft; otherwise continue the latest
        // editable draft. the fallback covers a reload after a server-side
        // revision start (task in_progress, clone loaded), where the default
        // draft id would collide with the immutable submitted draft.
        const latestKnownDraft = this.latestDraftsByTaskId.get(props.task_id);
        const revisionDraftId = this.revisionDraftIdsByTaskId.get(props.task_id)
            || (latestKnownDraft?.draft_status === "draft" ? latestKnownDraft.evidence_draft_id : undefined);
        // lock the write buttons for the flight so a slow save cannot double-fire
        const writeButtons = ["saveDraftButton", "submitUnresolvedButton", "submitReviewButton"]
            .map(id => document.getElementById(id))
            .filter(Boolean);
        writeButtons.forEach(button => { button.disabled = true; });
        try {
            if (status) {
                status.textContent = unresolved
                    ? "Saving unresolved note..."
                    : submit
                        ? "Saving and submitting..."
                        : "Saving draft...";
            }
            const saved = await this.backend.saveEvidenceDraft({
                taskId: props.task_id,
                evidenceDraftId: revisionDraftId || undefined,
                draft,
                clientContext: {
                    source: "static_verification_map",
                    country_code: COUNTRY_CONFIG.countryCode,
                    batch_id: ASSIGNMENT_BATCH_ID || undefined,
                    selected_target_year: this.targetYear,
                    page_path: window.location.pathname,
                },
            });
            if (unresolved) {
                await this.backend.submitUnresolvedNote({
                    evidenceDraftId: saved.evidence_draft_id,
                    note: values.note || undefined,
                });
            } else if (submit) {
                await this.backend.submitEvidenceDraft({
                    evidenceDraftId: saved.evidence_draft_id,
                    note: values.note || undefined,
                });
            }
            this.latestDraftsByTaskId.set(props.task_id, {
                ...draft,
                task_id: props.task_id,
                evidence_draft_id: saved.evidence_draft_id,
                draft_status: unresolved ? "unresolved_note" : submit ? "submitted" : "draft",
            });
            // the typed values are persisted; drop the dirty guard and snapshot
            this.clearFormDirty();
            this.formSnapshotsByTaskId.delete(props.task_id);
            if ((unresolved || submit) && revisionDraftId) {
                this.revisionDraftIdsByTaskId.delete(props.task_id);
            }
            // the write added task events; drop the cached history
            this.taskHistoryByTaskId.delete(props.task_id);
            await this.refreshBackendTasks();
            if (unresolved || submit) {
                // a recorded submission closes the task for this ra: mirror
                // the review portal's return-to-list by clearing the
                // selection, re-rendering the queue, and replacing the detail
                // pane with a confirmation. drafts stay open below so the ra
                // can keep editing.
                this.selectedTask = null;
                this.applyFilters();
                this.renderSubmissionRecordedDetail(props, { unresolved });
                this.focusDetailPanel();
                return;
            }
            if (ASSIGNMENT_MODE) {
                const refreshed = this.featureForTaskId(props.task_id);
                if (refreshed) this.selectedTask = refreshed;
            }
            this.applyFilters();
            const stepsEl = document.getElementById("workflowSteps");
            if (stepsEl) stepsEl.dataset.copied = "1";
            this.updateWorkflowSteps();
            if (status) {
                const submitError = this.evidenceInputError(values, { submit: true });
                status.textContent = submitError
                    ? `Draft saved to the shared backend. It still needs more detail before submission: ${submitError}`
                    : "Draft saved to the shared backend. Submit for review when the row is ready.";
            }
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            if (status) status.textContent = `${error.message || "Backend save failed."} Nothing was saved.`;
        } finally {
            writeButtons.forEach(button => { button.disabled = false; });
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
            address_raw: values.addressRaw,
            locality_raw: values.localityRaw,
            address_change_note: values.addressNote,
            source_url_or_file: values.sourceUrl,
            related_ids_or_note: values.relatedIds,
            evidence_note: values.note,
            source: COUNTRY_CONFIG.mapSource,
            saved_or_submitted: false,
        };
    }

    // pin-drop nomination: the assignment-mode refit of the nomination
    // panel. drop a draggable pin, confirm at building-accurate zoom, offer
    // any existing task within 150 m first, then create the candidate task
    // through tasks:createManualCandidateTask and land in its detail panel
    // assignment-mode nomination panel: a single one-line helper. the
    // actionable entry point is the header "Add a place" button; the
    // transient cards render into #pinCardHost when pin mode is armed
    pinNominationHtml() {
        return `
            <div class="copy-help">
                Know a place of worship that is not on the map? Use <strong>Add a place that's missing</strong> at the top of this panel, drop a pin on the building, then describe how you know it. Local knowledge counts as evidence.
            </div>
        `;
    }

    // the transient pin-drop cards, rendered into #pinCardHost while pin
    // mode is active (kept here, near the map, rather than buried in the
    // nomination panel). ids are unchanged so all pin logic still binds
    pinCardsHtml() {
        return `
            <h2 class="pin-host-title">Add a place that's missing</h2>
            <div id="pinConfirmCard" class="pin-card" hidden>
                <div class="pin-coords">Pin: <span id="pinLat"></span>, <span id="pinLng"></span></div>
                <div id="pinZoomGate" class="pin-zoom-gate">
                    Zoom in further to place the pin precisely — the recorded location must be building-accurate.
                </div>
                <div class="button-row">
                    <button id="pinConfirmButton" type="button" disabled>Confirm location</button>
                    <button id="pinCancelButton" type="button" class="secondary">Cancel</button>
                </div>
            </div>
            <div id="pinProximityCard" class="pin-card" hidden></div>
            <div id="pinFormCard" class="pin-card" hidden>
                <label>
                    Name (optional)
                    <input id="pinNameInput" type="text" placeholder="Unknown place of worship">
                </label>
                <label>
                    Address (optional)
                    <input id="pinAddressInput" type="text">
                </label>
                <label>
                    Locality (optional)
                    <input id="pinLocalityInput" type="text">
                </label>
                <label>
                    Observed or source date (optional)
                    <input id="pinObservedDateInput" type="text" placeholder="e.g. 2026-07 or 'seen last month'">
                </label>
                <label>
                    How do you know this place? (source note)
                    <textarea id="pinSourceNoteInput" rows="3" placeholder="e.g. I attend services here; no URL exists."></textarea>
                </label>
                <label>
                    What kind of claim is this?
                    <select id="pinChangeClassSelect">
                        ${selectOptionsHtml(CHANGE_CLASS_OPTIONS, "uncertain")}
                    </select>
                </label>
                <div class="copy-help">
                    This distinction drives the annual census: real change is counted, map corrections rewrite history.
                </div>
                <div class="button-row">
                    <button id="pinSubmitButton" type="button">Create candidate task</button>
                    <button id="pinFormCancelButton" type="button" class="secondary">Cancel</button>
                </div>
            </div>
            <div id="pinStatus" class="copy-status" aria-live="polite"></div>
        `;
    }

    // renders the transient cards into the host and wires their buttons.
    // called each time pin mode is armed, since the host is cleared on exit
    mountPinCards() {
        const host = document.getElementById("pinCardHost");
        if (!host) return;
        host.innerHTML = this.pinCardsHtml();
        host.hidden = false;
        document.getElementById("pinConfirmButton")?.addEventListener("click", () => this.confirmPinLocation());
        document.getElementById("pinCancelButton")?.addEventListener("click", () => this.exitPinMode());
        document.getElementById("pinFormCancelButton")?.addEventListener("click", () => this.exitPinMode());
        document.getElementById("pinSubmitButton")?.addEventListener("click", () => this.submitPinNomination());
        this.revealPinHost();
    }

    // pull the pin-card host to the top of the sidebar scroll so the armed
    // flow is never left below the fold on a long signed-in sidebar.
    // instant (not smooth): a nested-scroll smooth animation was unreliable
    revealPinHost() {
        document.getElementById("pinCardHost")?.scrollIntoView({ block: "start" });
    }

    enterPinMode() {
        if (this.pinMode || !this.map) return;
        this.pinMode = true;
        this.pinConfirmed = null;
        this.pinNearbyCount = 0;
        this.mountPinCards();
        this.map.getContainer().classList.add("pin-placement");
        document.getElementById("addPlaceButton")?.setAttribute("disabled", "true");
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = "Click the building on the map to drop the pin. Press Escape to cancel.";
        this._pinClickHandler = (event) => this.placePin(event.latlng);
        this.map.once("click", this._pinClickHandler);
        this._pinKeyHandler = (event) => {
            if (event.key === "Escape") this.exitPinMode();
        };
        document.addEventListener("keydown", this._pinKeyHandler);
    }

    placePin(latlng) {
        if (!this.pinMode || this.pinMarker) return;
        this.pinMarker = L.marker(latlng, {
            draggable: true,
            zIndexOffset: 1000,
            icon: L.divIcon({
                className: "",
                html: `<div class="pin-drop-marker"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            }),
        }).addTo(this.map);
        this.pinMarker.on("drag", () => this.updatePinConfirmCard());
        this._pinZoomHandler = () => this.updatePinConfirmCard();
        this.map.on("zoomend", this._pinZoomHandler);
        const card = document.getElementById("pinConfirmCard");
        if (card) card.hidden = false;
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = "Drag the pin onto the building, zoom in, then confirm the location.";
        this.updatePinConfirmCard();
        this.revealPinHost();
    }

    updatePinConfirmCard() {
        if (!this.pinMarker) return;
        const position = this.pinMarker.getLatLng();
        const latEl = document.getElementById("pinLat");
        const lngEl = document.getElementById("pinLng");
        if (latEl) latEl.textContent = position.lat.toFixed(5);
        if (lngEl) lngEl.textContent = position.lng.toFixed(5);
        const zoomOk = this.map.getZoom() >= PIN_MIN_PLACEMENT_ZOOM;
        const confirmButton = document.getElementById("pinConfirmButton");
        if (confirmButton) confirmButton.disabled = !zoomOk;
        const gate = document.getElementById("pinZoomGate");
        if (gate) gate.hidden = zoomOk;
    }

    confirmPinLocation() {
        if (!this.pinMarker || this.map.getZoom() < PIN_MIN_PLACEMENT_ZOOM) return;
        const position = this.pinMarker.getLatLng();
        this.pinConfirmed = {
            latitude: position.lat,
            longitude: position.lng,
            zoom: this.map.getZoom(),
        };
        // the confirmed position is what gets recorded; freeze the pin
        this.pinMarker.dragging.disable();
        if (this._pinZoomHandler) {
            this.map.off("zoomend", this._pinZoomHandler);
            this._pinZoomHandler = null;
        }
        const confirmCard = document.getElementById("pinConfirmCard");
        if (confirmCard) confirmCard.hidden = true;
        const nearby = this.nearbyTaskRows(position);
        this.pinNearbyCount = nearby.length;
        if (nearby.length) {
            this.showPinProximity(nearby);
        } else {
            this.showPinForm();
        }
    }

    // existing task markers within the proximity radius, nearest first
    nearbyTaskRows(position) {
        const pin = L.latLng(position.lat, position.lng);
        return this.tasks
            .map(feature => {
                const coords = feature.geometry?.coordinates || [];
                if (coords.length < 2) return null;
                const distance = pin.distanceTo(L.latLng(coords[1], coords[0]));
                if (distance > PIN_PROXIMITY_METRES) return null;
                const props = feature.properties || {};
                const backendStatus = this.backendTasksById.get(props.task_id)?.status || "not started";
                return {
                    taskId: props.task_id,
                    name: props.name || "Unnamed site",
                    distance: Math.round(distance),
                    status: backendStatus.replaceAll("_", " "),
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.distance - b.distance);
    }

    showPinProximity(rows) {
        const card = document.getElementById("pinProximityCard");
        if (!card) return;
        card.hidden = false;
        card.innerHTML = `
            <div class="copy-help">
                Existing tasks near your pin — is one of these the same place?
            </div>
            ${rows.map(row => `
                <div class="pin-nearby-row">
                    <span>${escapeHtml(row.name)} — ${row.distance} m, ${escapeHtml(row.status)}</span>
                    <button type="button" class="tertiary pin-nearby-open" data-task-id="${escapeHtml(row.taskId)}">This is it — open that task instead</button>
                </div>
            `).join("")}
            <button id="pinProximityContinue" type="button" class="secondary">None of these — continue</button>
        `;
        card.querySelectorAll(".pin-nearby-open").forEach(button => {
            button.addEventListener("click", () => {
                const taskId = button.dataset.taskId;
                this.exitPinMode();
                this.selectTaskById(taskId, { focusDetail: true });
            });
        });
        document.getElementById("pinProximityContinue")?.addEventListener("click", () => {
            card.hidden = true;
            this.showPinForm();
        });
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = "";
        this.revealPinHost();
    }

    showPinForm() {
        const card = document.getElementById("pinFormCard");
        if (card) card.hidden = false;
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = "";
        this.revealPinHost();
        document.getElementById("pinNameInput")?.focus({ preventScroll: true });
    }

    async submitPinNomination() {
        const status = document.getElementById("pinStatus");
        if (!this.pinConfirmed) {
            if (status) status.textContent = "Confirm the pin location first.";
            return;
        }
        if (!this.backend?.configured || !this.backend.signedIn) {
            if (status) status.textContent = "Sign in to the shared backend before nominating a place.";
            return;
        }
        const name = (document.getElementById("pinNameInput")?.value || "").trim() || "Unknown place of worship";
        const address = (document.getElementById("pinAddressInput")?.value || "").trim();
        const locality = (document.getElementById("pinLocalityInput")?.value || "").trim();
        const observedDate = (document.getElementById("pinObservedDateInput")?.value || "").trim();
        const noteText = (document.getElementById("pinSourceNoteInput")?.value || "").trim();
        // the mutation has no separate observation-date field, so the date
        // travels at the head of the source note
        const sourceNote = [observedDate ? `Observed/source date: ${observedDate}.` : "", noteText]
            .filter(Boolean)
            .join(" ") || undefined;
        const submitButton = document.getElementById("pinSubmitButton");
        if (submitButton) submitButton.disabled = true;
        if (status) status.textContent = "Creating the candidate task...";
        try {
            const result = await this.backend.createManualCandidateTask({
                countryCode: COUNTRY_CONFIG.countryCode,
                name,
                address: address || undefined,
                locality: locality || undefined,
                latitude: this.pinConfirmed.latitude,
                longitude: this.pinConfirmed.longitude,
                targetYears: COUNTRY_CONFIG.targetYears.map(Number),
                sourceNote,
                clientContext: {
                    source: "portal_pin_drop",
                    country_code: COUNTRY_CONFIG.countryCode,
                    page_path: window.location.pathname,
                    placement_zoom: this.pinConfirmed.zoom,
                    proximity_checked: true,
                    nearby_count: this.pinNearbyCount,
                },
            });
            // synthesise the backend-task shape locally so the detail panel
            // can land on the new task before any batch-scoped refresh
            const manualTask = {
                task_id: result.task_id,
                batch_id: `manual-${COUNTRY_CONFIG.countryCode.toLowerCase()}`,
                country_code: COUNTRY_CONFIG.countryCode,
                task_type: "missing_from_project_map",
                priority: "high",
                status: "in_progress",
                target_years: COUNTRY_CONFIG.targetYears.map(Number),
                candidate_site_id: result.candidate_site_id,
                name,
                address,
                locality,
                geometry: {
                    type: "Point",
                    coordinates: [this.pinConfirmed.longitude, this.pinConfirmed.latitude],
                },
                automated_checks: [{
                    check_id: "user_nomination",
                    severity: "info",
                    message: sourceNote || "Candidate was nominated from the task map.",
                    suggested_action: "review_identity",
                }],
                task_brief: "Review this user-nominated place of worship candidate. Check whether it is already on the project map or in OSM before accepting it for export.",
            };
            this.manualTasksById.set(result.task_id, manualTask);
            this.backendTasksById.set(result.task_id, manualTask);
            // a fresh task has no drafts; recording that skips the async
            // draft fetch whose re-render would wipe the success message
            this.latestDraftsByTaskId.set(result.task_id, null);
            const pinChangeClass = document.getElementById("pinChangeClassSelect")?.value || "uncertain";
            await this.refreshBackendTasks();
            this.applyFilters();
            this.exitPinMode();
            this.selectTaskById(result.task_id, { focusDetail: true });
            // client-side carry only: the pin form's change class prefills
            // the evidence form and persists once the ra saves evidence
            const changeClassSelect = document.getElementById("changeClassSelect");
            if (changeClassSelect) changeClassSelect.value = pinChangeClass;
            const copyStatus = document.getElementById("copyStatus");
            if (copyStatus) copyStatus.textContent = "Candidate task created. Record your evidence, then submit for review.";
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            // stay in the form with the error visible; nothing is cleared
            if (submitButton) submitButton.disabled = false;
            if (status) status.textContent = `${error.message || "Could not create the candidate task."} Nothing was created — try again.`;
        }
    }

    exitPinMode() {
        this.pinMode = false;
        this.pinConfirmed = null;
        this.pinNearbyCount = 0;
        if (this._pinClickHandler) {
            this.map.off("click", this._pinClickHandler);
            this._pinClickHandler = null;
        }
        if (this._pinZoomHandler) {
            this.map.off("zoomend", this._pinZoomHandler);
            this._pinZoomHandler = null;
        }
        if (this._pinKeyHandler) {
            document.removeEventListener("keydown", this._pinKeyHandler);
            this._pinKeyHandler = null;
        }
        if (this.pinMarker) {
            this.map.removeLayer(this.pinMarker);
            this.pinMarker = null;
        }
        this.map?.getContainer().classList.remove("pin-placement");
        // tear down the transient cards entirely so the host leaves no
        // empty panel behind the working column
        const host = document.getElementById("pinCardHost");
        if (host) {
            host.innerHTML = "";
            host.hidden = true;
        }
        document.getElementById("addPlaceButton")?.removeAttribute("disabled");
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

    linkHtml(label, url, className = "") {
        if (!url) {
            return `<span></span>`;
        }
        return `<a${className ? ` class="${escapeHtml(className)}"` : ""} href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
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
                this.taskHistoryByTaskId.delete(props.task_id);
                // the skip intentionally discards any typed values for this task
                this.clearFormDirty();
                this.formSnapshotsByTaskId.delete(props.task_id);
                await this.refreshBackendTasks();
                // a recorded skip closes the task for this ra too: same
                // return-to-list as submit, with skip wording
                this.selectedTask = null;
                this.applyFilters();
                this.renderSubmissionRecordedDetail(props, { skipped: true });
                this.focusDetailPanel();
                return;
            } catch (error) {
                if (error.authExpired) {
                    this.backendUser = null;
                    this.backendLastError = error.message;
                    this.renderBackendPanel();
                }
                if (ASSIGNMENT_MODE) {
                    if (status) {
                        status.textContent = `${error.message || "Could not skip in the shared backend."} Nothing was saved. Tell JB which task you wanted to skip.`;
                    }
                    return;
                }
                if (status) {
                    status.textContent = `${error.message || "Could not skip in backend."} Falling back to local skip.`;
                }
            }
        }

        if (ASSIGNMENT_MODE) {
            if (status) {
                status.textContent = "Sign in to the shared backend before skipping this assignment.";
            }
            return;
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
            status.textContent = `Skipped in this browser. Pick another task from the map or list.${this.filterActiveHint()}`;
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
