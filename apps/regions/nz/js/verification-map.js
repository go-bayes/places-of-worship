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
        // pure entry only: nz assigned tasks keep the guided form
        rapidNominationEntry: true,
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
        rapidCurrentEntry: true,
        rapidNominationEntry: true,
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
// F1: the contracts validate dates against this country's floor (date-floor.js)
window.POW_DATE_FLOOR_YEAR = window.PowDateFloor ? window.PowDateFloor.yearFor(COUNTRY_CONFIG.countryCode) : 1600;
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
// two gates where one used to conflate assigned work with pure entry
// (jb 2026-08-31): rapidCurrentEntry keeps a country's ASSIGNED batch on
// the rapid form (vu's source-first design); rapidNominationEntry puts
// PURE ENTRY (add places) on the same rapid form wherever the server's
// country intake registry has bounds (vu and nz today)
const RAPID_ASSIGNED_ENTRY = Boolean(
    COUNTRY_CONFIG.rapidCurrentEntry
    && ASSIGNMENT_MODE
    && SEARCH_PARAMS.get("detailed") !== "1"
);
const RAPID_NOMINATION_ENTRY = Boolean(
    COUNTRY_CONFIG.rapidNominationEntry
    && ASSIGNMENT_MODE
    && SEARCH_PARAMS.get("detailed") !== "1"
);
const RAPID_ANY_ENTRY = RAPID_ASSIGNED_ENTRY || RAPID_NOMINATION_ENTRY;
const HISTORICAL_CLAIM_ENTRY = ASSIGNMENT_MODE;
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
// human labels for the rapid current-observation vocabulary; the values
// are the server contract in convex/model.ts
const RAPID_STATUS_LABELS = {
    currently_used_for_worship: "Used for worship",
    place_exists_worship_uncertain: "Exists; worship use uncertain",
    place_exists_not_used_for_worship: "Exists; not used for worship",
    could_not_determine: "Could not determine",
};
const RAPID_BASIS_LABELS = {
    direct_field_observation: "I observed it in person",
    local_investigator_account: "I know it through local fieldwork",
    named_public_source: "I checked a named public source",
    other: "Other evidence",
};
const HISTORICAL_CLAIM_KIND_LABELS = {
    structure: "Structure or building",
    worship_function: "Worship function",
    denomination_or_affiliation: "Denomination or affiliation",
    leadership: "Leadership",
    shared_use: "Shared or concurrent worship use",
    other: "Other history",
};
const HISTORICAL_CLAIM_TIMING_LABELS = {
    event: "Event",
    state: "State over an interval",
};
const HISTORICAL_CONFIDENCE_LABELS = {
    high: "High",
    moderate: "Moderate",
    low: "Low",
    uncertain: "Uncertain",
};
const HISTORICAL_SOURCE_BASIS_LABELS = {
    inscription_or_document_observed: "Inscription or document I observed",
    local_investigator_account: "Local investigator account",
    named_public_source: "Named public source",
    other: "Other source or informant basis",
};
// occupancy_v1 vocab (docs/development/occupancy-build-brief-2026-09-02.md);
// the client mirror in occupancy-contract.js validates against the same sets
const OCCUPANCY_START_MODE_OPTIONS = [
    ["known", "Known date"],
    ["between", "Between two dates"],
    ["by", "By a date (no earlier bound)"],
    ["unknown", "Unknown"],
];
const OCCUPANCY_START_BASIS_OPTIONS = [
    ["founding_stated", "Founding stated by the source"],
    ["reopening_stated", "Reopening stated by the source"],
    ["organisation_founded", "Organisation or congregation founded"],
    ["building_dedication", "Building dedicated"],
    ["first_seen_only", "First seen in a record only"],
];
const OCCUPANCY_END_MODE_OPTIONS = [
    ["still_active", "Still in use"],
    ["known", "Known date"],
    ["between", "Between two dates"],
    ["after", "After a date (no later bound)"],
    ["unknown", "Unknown"],
];
const OCCUPANCY_END_BASIS_OPTIONS = [
    ["closure_stated", "Closure stated by the source"],
    ["last_seen_only", "Last seen in a record only"],
];
const OCCUPANCY_END_REASON_OPTIONS = [
    ["closed", "Closed"],
    ["relocated", "Relocated to another place"],
    ["demolished", "Demolished"],
    ["use_changed", "Use changed"],
    ["unknown", "Unknown"],
];
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
// the export column list comes from the shared mirror
// (js/wide-evidence-fields.js of convex/lib/wideEvidenceFields.ts); the
// server refuses a draft whose list disagrees with its own (pr-b0)
const WIDE_EVIDENCE_FIELDS = window.PowWideEvidenceFields
    ? window.PowWideEvidenceFields.fields(TARGET_YEARS.map(Number))
    : [];
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
    ["submitted_in_error", "Submitted in error — this entry should not be on the record"],
    ["osm_identity_link", "OSM link wrong"],
    ["other", "Other"],
];
// the revise-with-evidence lane: same server vocabulary, worded for an ra
// who is adding evidence rather than only flagging; the withdrawal stays
// on the flag-only path
const REVISE_ISSUE_OPTIONS = [
    ["verify_existing_site", "Confirming or updating this record"],
    ["geometry_check", "Wrong location — I moved the pin"],
    ["possible_duplicate", "Possible duplicate of another record"],
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
// pin-drop nominations: rapid-current Vanuatu entry remains building-level;
// ordinary nominations may instead preserve an explicitly approximate area
const PIN_MIN_PLACEMENT_ZOOM = 15;
const PIN_MIN_APPROXIMATE_ZOOM = 8;
const PIN_PROXIMITY_METRES = 150;
// satellite basemap: maptiler's paid plan (ruled 2026-08-29) so contributors
// can steer the pin onto the actual building; absent key hides the option
const MAPTILER_API_KEY = String(window.MAPTILER_API_KEY || "").trim();
const SATELLITE_TILE_URL = MAPTILER_API_KEY
    ? `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encodeURIComponent(MAPTILER_API_KEY)}`
    : "";
// hybrid = the same imagery with street and place labels drawn over it, so
// the contributor keeps orientation while steering the pin (JB 2026-08-31)
const HYBRID_TILE_URL = MAPTILER_API_KEY
    ? `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${encodeURIComponent(MAPTILER_API_KEY)}`
    : "";
// add mode prefers imagery once streets stop showing individual buildings
const PORTAL_AUTO_SATELLITE_ZOOM = 15;
// signed-in portal activity, kept per country and batch for the tab's life
const PORTAL_MODES = new Set(["assigned", "add"]);
const PORTAL_MODE_KEY = `pow_portal_mode_v1:${COUNTRY_CONFIG.countryCode.toLowerCase()}${ASSIGNMENT_SESSION_SEGMENT}`;
// place-name search: one nominatim request per submit, spaced out, so the
// portal stays well inside the osmf usage policy
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_MIN_INTERVAL_MS = 1500;
// both location modes are offered in every country and every flow (jb
// ruling r1, 2026-09-02; the server mirrors it in
// convex/lib/locationAssertions.ts). approximate area: use when the place
// is known only to a vicinity, as historical places often are; the radius
// states the uncertainty and the master-data grade derives from it
const LOCATION_MODE_OPTIONS = [
    ["building_identified", "I can pinpoint the building"],
    ["approximate_area", "I can only place an area"],
];
const LOCATION_RADIUS_OPTIONS = [
    ["50", "Within about 50 m"],
    ["100", "Within about 100 m"],
    ["250", "Within about 250 m"],
    ["500", "Within about 500 m"],
    ["1000", "Within about 1 km"],
    ["2000", "Within about 2 km"],
    ["5000", "Within about 5 km"],
    ["10000", "Within about 10 km"],
    ["25000", "Within about 25 km"],
    ["50000", "Within about 50 km"],
    ["100000", "Within about 100 km"],
    ["custom", "Other radius (metres)"],
];
const LOCATION_BASIS_OPTIONS = [
    ["map_placement", "I identified it on the map"],
    ["address_or_locality", "Address or named locality"],
    ["named_source_description", "Named source description"],
    ["local_investigator_account", "Local investigator account"],
    ["other", "Other location evidence"],
];
const LOCATION_CONFIDENCE_OPTIONS = [
    ["high", "High"],
    ["moderate", "Moderate"],
    ["low", "Low"],
    ["uncertain", "Uncertain"],
];
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
const DENOMINATION_LABEL_BASIS_OPTIONS = [
    ["unknown", "Unknown or unclear"],
    ["named_documentary_source", "Named documentary or web source"],
    ["displayed_sign_or_notice", "Displayed sign or public notice"],
    ["current_self_description", "Named public community self-description"],
    ["local_investigator_account", "Local investigator account"],
];
const DENOMINATION_RELATION_OPTIONS = [
    ["uncertain", "Uncertain — the relation to the project record is not yet clear"],
    ["label_only", "Record the label only; no correction or change claim"],
    ["record_correction", "Correction to the project record"],
    ["historical_change", "Possible historical change; further event evidence required"],
    ["shared_or_concurrent_use", "Possible shared or concurrent use; record each group separately later"],
];
const PRIVACY_FLAG_OPTIONS = [
    ["clear", "Clear — no sensitive or private details known"],
    ["needs_review", "Needs sensitivity or privacy review"],
    ["restricted", "Restricted — authorised reviewers only"],
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

// one year per row with the selects in aligned columns, so the eye can
// run down the years and compare states and confidence at a glance
function targetYearStatusControlsHtml() {
    return `
        <div class="year-status-grid" role="group" aria-label="Status and confidence for each target year">
            <div class="year-status-row year-status-head" aria-hidden="true">
                <span class="year-status-year"></span>
                <span>Status</span>
                <span>Confidence</span>
            </div>
            ${TARGET_YEARS.map(year => `
                <div class="year-status-row">
                    <label class="year-status-year" for="status${escapeHtml(year)}">${escapeHtml(year)}</label>
                    <select id="status${escapeHtml(year)}" aria-label="${escapeHtml(year)} status">
                        ${statusOptionsHtml()}
                    </select>
                    <select id="confidence${escapeHtml(year)}" aria-label="${escapeHtml(year)} confidence">
                        <option value="">Confidence…</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
            `).join("")}
        </div>
    `;
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

    if (action === "confirm_current_record") {
        statuses[targetYear] = "present";
    } else if (action === "denomination_or_shared_use") {
        // raw-label evidence does not set a worship-state target year
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
    if (action === "denomination_or_shared_use") return "Evidence concerns a denomination or shared-use question. Treat the exact label and relation as provisional evidence for reviewer follow-up.";
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

// a nomination lives in the country's manual batch: it is the ra's own
// pure-entry work, ruled separate from the assignment sheet (jb 2026-08-31)
// the ra's own entries: nominations in the manual batch and, since the
// revise-with-evidence lane (jb 2026-09-02), revisions in the issue batch
function isNominationProps(props) {
    const batchId = props?.batch_id || "";
    return batchId.startsWith("manual-") || batchId.startsWith("ra-issues-");
}

function featureFromBackendTask(task) {
    const context = task.source_context || {};
    const survey = context.survey || {};
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
        religion: context.religion || survey.religion_as_given || "",
        denomination: context.denomination || survey.denomination_or_tradition_raw || "",
        source_denomination_label: survey.religion_as_given || context.denomination || "",
        denomination_code: context.denomination_code || survey.denomination_code || "",
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
        initial_location_assertion: task.initial_location_assertion,
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
            </ol>
        `;
    }
    return `
        <ol>
            <li>Sign in with Google at the top of this panel.</li>
            <li>Work down the assigned task list in order. Stop at a natural stopping point and tell JB where you stopped.</li>
            <li>Open Street View or Google Maps to look around the site, and use the OSM object only as context. Record the imagery capture date if Street View is your evidence.</li>
            <li>Record 2013, 2018, and 2023 status, confidence, source title, source URL or file reference, and any useful lifecycle date.</li>
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
        this.myNominationItems = [];
        this.nominationFeatures = [];
        this.revisionDraftIdsByTaskId = new Map();
        // rapid tasks awaiting review that the observer has chosen to correct;
        // a correction is a new observation, so no server draft exists until
        // it is submitted and the set is cleared
        this.rapidCorrectionTaskIds = new Set();
        this.backendLastError = "";
        // unsaved-entry protection: dirty flag for the evidence form plus
        // per-task snapshots reapplied after programmatic rebuilds
        this.formDirty = false;
        this.formDirtyTaskId = null;
        this.formSnapshotsByTaskId = new Map();
        // pr-e: the period cards typed inside the guided form, by task id
        this.guidedPeriodsByTaskId = new Map();
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
        this.reviseContext = null;
        this.pinMarker = null;
        this.pinUncertaintyCircle = null;
        this.pinConfirmed = null;
        this.pinNearbyCount = 0;
        this.pinSubmissionId = null;
        // occupancy lane: the period cards under entry, and the card whose
        // location the pin flow is currently placing
        this.occupancyDraft = null;
        this.occupancyPinContext = null;
        this.pinHistory = [];
        this.manualTasksById = new Map();
        // signed-in portal activity: null while signed out or choosing,
        // otherwise "assigned" or "add" (see setPortalMode)
        this.portalMode = null;
        // basemap: streets by default; auto switches (add mode, pin
        // placement) yield to a manual choice for the rest of the session
        this.basemap = "streets";
        this.basemapUserChosen = false;
        this.streetsLayer = null;
        this.satelliteLayer = null;
        this.hybridLayer = null;
        this.imageryBroken = false;
        this.lastNominatimRequestAt = 0;
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
            this.syncPortalChrome();
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
                            : "Use the Google account JB invited (check the invitation email if you're not sure which one)."} After sign-in, choose between your assigned tasks and adding missing places; saved work goes straight to the shared review queue.`
                        : "Sign in with Google to load assigned tasks and save evidence directly for review."}</span>
                    <div id="googleSignInButton" class="google-sign-in-host"></div>
                    <details class="backend-help"><summary>Wrong account showing?</summary>The Google button shows accounts already signed into this browser. If the wrong name appears, choose another Google account or use a browser profile signed into the invited account.</details>
                    ${this.backendLastError ? `<span class="copy-status">${escapeHtml(this.backendLastError)}</span>` : ""}
                </div>
            `;
            this.backend.renderSignInButton(document.getElementById("googleSignInButton"), {
                initials: this.getRaInitials(),
                onSignedIn: async user => {
                    this.backendUser = user;
                    await this.refreshBackendTasks();
                    // a reload or an expired session lands back in the
                    // activity the contributor had chosen, else the chooser
                    this.restorePortalMode();
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
            this.syncPortalChrome();
            return;
        }

        const label = this.backendUser.initials || this.backendUser.email || "signed in";
        const assignedAvailable = this.tasks.filter(feature => !isNominationProps(feature.properties)).length;
        const assignmentStatusText = ASSIGNMENT_MODE
            ? `${assignedAvailable} available task${assignedAvailable === 1 ? "" : "s"}; ${this.myWorkItems.length} item${this.myWorkItems.length === 1 ? "" : "s"} in My work.`
            : "Saves and submissions go to Convex for reviewer follow-up.";
        const signedInHeading = !ASSIGNMENT_MODE
            ? "Shared task backend"
            : this.portalMode === "assigned"
                ? "Signed in. Choose a task below."
                : this.portalMode === "add"
                    ? "Signed in. Add missing places."
                    : "Signed in. Choose an activity below.";
        panel.innerHTML = `
            <div class="backend-card signed-in">
                <strong>${signedInHeading}</strong>
                ${assignmentLabel}
                <span>Signed in as ${escapeHtml(label)}. ${escapeHtml(assignmentStatusText)}</span>
                <span id="backendRefreshStatus" class="copy-status" aria-live="polite">${escapeHtml(this.backendTransientStatus || "")}</span>
                <div class="backend-actions">
                    <button type="button" class="secondary" id="refreshBackendTasksButton">Refresh task list</button>
                    <button type="button" class="tertiary" id="signOutButton">Sign out</button>
                </div>
            </div>
        `;
        this.syncPortalChrome();
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
                : `Task list refreshed — ${this.tasks.filter(feature => !isNominationProps(feature.properties)).length} available, ${this.myWorkItems.length} in My work.`);
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
        // a deliberate sign-out forgets the chosen activity; an expired
        // session (backendUser cleared elsewhere) keeps it for the return
        if (this.pinMode) this.exitPinMode();
        this.portalMode = null;
        try {
            sessionStorage.removeItem(PORTAL_MODE_KEY);
        } catch (error) {
            // storage unavailable: nothing to forget
        }
        this.backendTasksById.clear();
        this.latestDraftsByTaskId.clear();
        this.myWorkItems = [];
        this.myNominationItems = [];
        this.revisionDraftIdsByTaskId.clear();
        // sign-out discards the form with the panel; a lingering dirty flag
        // would fire beforeunload against a page showing no form at all
        this.clearFormDirty();
        this.formSnapshotsByTaskId.clear();
        // pr-e: period cards leave with the session; on a shared computer
        // the next user must not find them
        this.clearAllGuidedPeriods();
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
        // a bounced nomination must reach the ra with the reviewer's note
        // wherever they are working, so the alert panel and badge cover
        // nominations too even though the my-work list itself is batch-only
        const nominationChangesRequested = (this.myNominationItems || [])
            .filter(item => item.task?.status === "changes_requested");
        // a task awaiting review with an editable draft alongside is a
        // revision in progress; count it as a draft, not as submitted work
        const isRevisionItem = item =>
            (item.task?.status === "needs_review" || item.task?.status === "unresolved_note")
            && item.latestDraft?.draft_status === "draft";
        const revisionDrafts = items.filter(isRevisionItem).length;
        const submitted = items.filter(item => item.task?.status === "needs_review" && !isRevisionItem(item)).length;
        const unresolved = items.filter(item => item.task?.status === "unresolved_note" && !isRevisionItem(item)).length;
        const drafts = items.filter(item => item.task?.status === "draft_saved").length + revisionDrafts;
        const changesRequested = items
            .filter(item => item.task?.status === "changes_requested")
            .concat(nominationChangesRequested);
        const needsMore = changesRequested.length;
        const skipped = items.filter(item => item.task?.status === "skipped").length;
        const reviewed = items.filter(item => item.task?.status === "reviewed" || item.task?.status === "exported").length;
        panel.innerHTML = `
            ${this.changesRequestedPanelHtml(changesRequested)}
            <details ${total > 0 ? "open" : ""}>
                <summary>My work
                    <span class="ra-initials">${escapeHtml(`${total} item${total === 1 ? "" : "s"} · ${needsMore + unresolved} need${needsMore + unresolved === 1 ? "s" : ""} attention`)}</span>
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
        panel.querySelectorAll(".comment-reply-send").forEach(btn => {
            btn.addEventListener("click", () => this.sendCommentReply(btn.dataset.taskId, btn.closest(".changes-entry")));
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
        const question = task.pending_reviewer_comment || "";
        const note = review.decision_note
            ? `<div class="changes-note"><span class="changes-label">Reviewer note</span>${escapeHtml(review.decision_note)}</div>`
            : "";
        const followUp = review.required_follow_up
            ? `<div class="changes-note"><span class="changes-label">Required follow-up</span>${escapeHtml(review.required_follow_up)}</div>`
            : "";
        // a pending question offers a reply box beside the revision path:
        // answering returns the task to the review queue without a new draft
        const commentBlock = question ? `
            <div class="changes-note"><span class="changes-label">Reviewer question</span>${escapeHtml(question)}</div>
            <textarea class="comment-reply-input" rows="2" maxlength="2000" placeholder="Answer the reviewer (at least 8 characters)"></textarea>
        ` : "";
        return `
            <div class="changes-entry" role="listitem">
                <span class="entry-title">${escapeHtml(task.name || "Unnamed site")}</span>
                <span class="entry-meta">${escapeHtml(taskId)}</span>
                ${note}
                ${followUp}
                ${commentBlock}
                <div class="changes-error" role="alert"></div>
                <div class="entry-actions">
                    ${question ? `<button type="button" class="comment-reply-send" data-task-id="${escapeHtml(taskId)}">Send answer</button>` : ""}
                    <button type="button" class="revise-now${question ? " secondary" : ""}" data-task-id="${escapeHtml(taskId)}">Revise now</button>
                </div>
            </div>
        `;
    }

    // answers a reviewer's return-for-comment question from the panel; the
    // reply lands in the audit trail and the task rejoins the review queue
    async sendCommentReply(taskId, entryEl) {
        const input = entryEl?.querySelector(".comment-reply-input");
        const errorEl = entryEl?.querySelector(".changes-error");
        const button = entryEl?.querySelector(".comment-reply-send");
        const response = (input?.value || "").trim();
        if (response.length < 8) {
            if (errorEl) errorEl.textContent = "Write a short answer (at least 8 characters).";
            return;
        }
        if (button) button.disabled = true;
        try {
            await this.backend.respondToReviewerComment({ taskId, response });
            this.taskHistoryByTaskId.delete(taskId);
            await this.refreshBackendTasks();
            this.applyFilters();
        } catch (error) {
            if (button) button.disabled = false;
            if (errorEl) errorEl.textContent = error.message || "Could not send the answer.";
        }
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
        // openstreetmap standard tiles: no key to ship, and building
        // footprints render unwatermarked at the zooms pin placement needs
        // keep the zoom-out floor at 5 for compact countries, but let
        // continental configs (au/br/ca/mx/us open below 5) take effect
        const minZoom = Math.min(5, Math.floor(COUNTRY_CONFIG.mapZoom));
        this.streetsLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            minZoom,
        }).addTo(this.map);
        if (SATELLITE_TILE_URL) {
            // imagery so the pin can be steered onto the real building;
            // maptiler serves z20 (upsampled where no aerial exists)
            const imageryAttribution = '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
            this.satelliteLayer = L.tileLayer(SATELLITE_TILE_URL, {
                attribution: imageryAttribution,
                maxZoom: 20,
                minZoom,
            });
            this.hybridLayer = L.tileLayer(HYBRID_TILE_URL, {
                attribution: imageryAttribution,
                maxZoom: 20,
                minZoom,
            });
            this.watchImageryLayer(this.satelliteLayer);
            this.watchImageryLayer(this.hybridLayer);
            this.addBasemapControl();
            // add mode: imagery takes over once buildings are resolvable,
            // unless the contributor has picked a basemap by hand
            this.map.on("zoomend", () => {
                if (this.portalMode !== "add" || this.basemapUserChosen) return;
                if (this.map.getZoom() >= PORTAL_AUTO_SATELLITE_ZOOM) this.setBasemap("hybrid");
            });
        }

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
            // without a dated context layer the select would load nothing,
            // so it does not render: an inert control reads as broken
            const modes = [["period", "Points: period"], ["all", "Points: all"], ["off", "Points: off"]];
            div.innerHTML = `
                ${COUNTRY_CONFIG.datedPlaces ? `
                <select id="portalPointsSelect" aria-label="Context dots">
                    ${modes.map(([value, label]) => `<option value="${value}"${value === this.pointsMode ? " selected" : ""}>${label}</option>`).join("")}
                </select>
                <div id="portalPointsNote" class="points-mode-note" hidden></div>` : ""}
                <div class="map-legend">
                    <span class="legend-caption">Validation ring</span>
                    <span class="legend-row"><span class="legend-dot vm-validated-present-swatch"></span>validated present</span>
                    <span class="legend-row"><span class="legend-dot vm-validated-absent-swatch"></span>validated absent</span>
                    <span class="legend-row"><span class="legend-dot vm-in-review-swatch"></span>in review</span>
                    <span class="legend-row"><span class="legend-dot vm-disputed-swatch"></span>disputed</span>
                    <span class="legend-row"><span class="legend-dot vm-default-swatch"></span>unvalidated</span>
                    <span class="legend-row"><span class="legend-dot vm-nomination-swatch"></span>nomination</span>
                    ${COUNTRY_CONFIG.datedPlaces ? `<span class="legend-row"><span class="legend-dot context-dot-swatch"></span>context dots</span>` : ""}
                </div>
            `;
            // keep map gestures away from the control
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            div.querySelector("#portalPointsSelect")?.addEventListener("change", (event) => {
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
        // on imagery a slate dot vanishes against canopy and roofs, so the
        // context dot becomes a pale disc with a dark edge over a white halo
        // (jb 2026-09-02); on streets it keeps its subordinate slate
        const imagery = this.basemap !== undefined && this.basemap !== "streets";
        show.forEach(feature => {
            const coords = feature.geometry?.coordinates || [];
            if (coords.length < 2) return;
            const latlng = [coords[1], coords[0]];
            if (imagery) {
                this.contextDotLayer.addLayer(L.circleMarker(latlng, {
                    radius: 6,
                    stroke: false,
                    fillColor: "#ffffff",
                    fillOpacity: 0.9,
                    interactive: false,
                }));
            }
            // legible but subordinate to task markers: a touch larger and
            // darker than before, and now interactive so each dot opens the
            // shared action row plus an issue/reopen entry
            const dot = L.circleMarker(latlng, imagery
                ? {
                    radius: 4,
                    color: "#0f172a",
                    weight: 1.5,
                    fillColor: "#e2e8f0",
                    fillOpacity: 1,
                    opacity: 1,
                    interactive: true,
                }
                : {
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
            // a single click opens the case, matching task markers: a
            // matched task's detail, or the revise/issue card for a place
            // with no task yet. the popup stays open beside it for the
            // street view / osm links and the explicit reopen entry
            dot.on("click", () => {
                const matched = this.matchContextTask(feature);
                if (matched?.task_id) {
                    this.selectTaskById(matched.task_id, { focusDetail: true });
                } else {
                    this.openContextIssueForm(feature, { keepPopup: true });
                }
            });
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
        const osmType = window.PowOsmHistory ? window.PowOsmHistory.normaliseType(props.osm_type) : "";
        const osmId = props.osm_id !== undefined && props.osm_id !== null ? String(props.osm_id) : "";
        const matched = this.matchContextTask(feature);
        const matchedTaskId = matched?.task_id || "";
        const backendTask = matchedTaskId ? this.backendTasksById.get(matchedTaskId) : null;
        const canReopen = Boolean(backendTask && REOPEN_ELIGIBLE_STATUSES.has(backendTask.status));
        let issueButton;
        if (matchedTaskId && canReopen) {
            issueButton = `<button class="popup-report-issue" type="button" data-reopen-task-id="${escapeHtml(matchedTaskId)}">Reopen issue</button>`;
        } else if (matchedTaskId) {
            // matched a task not in a reopenable state: route into its issue form
            issueButton = `<button class="popup-report-issue" type="button" data-open-task-id="${escapeHtml(matchedTaskId)}">Revise or report an issue</button>`;
        } else {
            issueButton = `<button class="popup-report-issue" type="button" data-report-issue="1">Revise or report an issue</button>`;
        }
        return `
            <strong>${escapeHtml(name)}</strong><br>
            <span>${escapeHtml(coordStr)}</span><br>
            <div class="popup-actions">
                ${hasCoords ? `
                ${this.linkHtml("Street View", streetViewUrlForCoordinates(coords), "popup-link")}
                <a class="popup-link" href="${escapeHtml(osmPointUrl(lat, lng))}" target="_blank" rel="noopener noreferrer">Open OSM</a>
                <button class="popup-link popup-copy-coords" type="button" data-copy="${escapeHtml(coordStr)}">Copy coords</button>` : ""}
                ${osmType && osmId ? `<button class="popup-link popup-osm-history" type="button" data-osm-history="${escapeHtml(`${osmType}/${osmId}`)}">OSM history</button>` : ""}
                ${matchedTaskId && this.taskCanAddOccupancy(matchedTaskId) ? `<button class="popup-link popup-add-occupancy" type="button" data-occupancy-task-id="${escapeHtml(matchedTaskId)}">Add where and when</button>` : ""}
                ${issueButton}
            </div>
            <div class="popup-osm-history-body" hidden></div>
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
        el.querySelector("[data-occupancy-task-id]")?.addEventListener("click", (event) => {
            const taskId = event.currentTarget.dataset.occupancyTaskId;
            const task = this.featureForTaskId(taskId)?.properties || this.matchContextTask(feature) || { task_id: taskId };
            this.openOccupancyFromRecord(task);
        });
        // osm edit history on demand (jb 2026-09-02): one fetch per object
        // per session; the popup grows in place
        el.querySelector("[data-osm-history]")?.addEventListener("click", async (event) => {
            const [type, id] = String(event.currentTarget.dataset.osmHistory || "").split("/");
            const body = el.querySelector(".popup-osm-history-body");
            if (!body || !window.PowOsmHistory) return;
            body.hidden = false;
            event.currentTarget.disabled = true;
            // no popup.update() afterwards: leaflet would re-render the
            // stored content string and wipe the loaded timeline
            await window.PowOsmHistory.loadInto(body, type, id);
        });
    }

    // routes an unmatched (or non-reopenable) context dot into the existing
    // standalone issue form, pre-filled with the place name and coordinates.
    // Reuses issueFormHtml/bindIssueForm, so signed-out degrades the same way
    // (disabled submit plus a sign-in prompt).
    openContextIssueForm(feature, options = {}) {
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
        if (!options.keepPopup) this.map.closePopup();
        const hasCoords = Number.isFinite(context.latitude) && Number.isFinite(context.longitude);
        // the evidence lane mirrors a nomination (location, current use,
        // how you know, photos) with the record as prefill; flag-only stays
        // for an ra who noticed something but has nothing to add
        const canRevise = RAPID_NOMINATION_ENTRY && hasCoords
            && Boolean(this.backend?.configured && this.backend.signedIn);
        panel.innerHTML = `
            <h2 class="revise-heading">Revise this place or report an issue</h2>
            <div class="pilot-note" role="note">
                <strong>${escapeHtml(context.name || "An unnamed place")}</strong>${hasCoords ? ` at ${context.latitude.toFixed(5)}, ${context.longitude.toFixed(5)}` : ""}.
            </div>
            ${(() => {
                const t = window.PowOsmHistory ? window.PowOsmHistory.normaliseType(props.osm_type) : "";
                return t && context.osmId ? `<div id="reviseOsmHistory" class="osm-history-host" data-osm-type="${escapeHtml(t)}" data-osm-id="${escapeHtml(context.osmId)}"></div>` : "";
            })()}
            ${canRevise ? `
                <div class="copy-help">Record what you can establish about this place today — its location, current worship use, how you know, and photos — exactly as for a new place. Your evidence goes to human review; the record is not edited directly.</div>
                <div class="button-row">
                    <button id="reviseWithEvidenceButton" type="button">Record evidence for this place</button>
                    <button id="reviseReturnButton" type="button" class="secondary">Cancel and return to the map</button>
                </div>
            ` : ""}
            ${this.issueFormHtml(context, { open: !canRevise, flagOnly: canRevise })}
            ${canRevise ? "" : `
            <div class="button-row">
                <button id="reviseReturnButton" type="button" class="secondary">Cancel and return to the map</button>
            </div>
            `}
        `;
        document.getElementById("reviseWithEvidenceButton")?.addEventListener("click", () => this.enterReviseMode(context));
        document.getElementById("reviseReturnButton")?.addEventListener("click", () => this.discardEntryAttempt());
        const historyHost = document.getElementById("reviseOsmHistory");
        if (historyHost && window.PowOsmHistory) {
            window.PowOsmHistory.loadInto(historyHost, historyHost.dataset.osmType, historyHost.dataset.osmId);
        }
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

        this.renderModeNotice();

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
                            <li>In step 4, save or submit; use <em>Copy spreadsheet row</em> only as the fallback.</li>
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
                // one label serves every country (rapid entry included);
                // the transient cards render into #pinCardHost on demand
                document.getElementById("addPlaceButton")?.addEventListener("click", () => this.enterPinMode());
            }
        }

        this.renderPortalChooser();
        this.renderPortalModeBar();
        this.syncPortalChrome();
        this.renderInitialDetail();
    }

    // header notice; re-rendered when sign-in state changes so a signed-in
    // sidebar never keeps a stale "sign in to load tasks" instruction
    renderModeNotice() {
        const notice = document.getElementById("modeNotice");
        if (!notice) return;
        notice.classList.toggle("demo-warning", DEMO_MODE);
        notice.innerHTML = DEMO_MODE
            ? (ASSIGNMENT_MODE
                ? (this.backend?.configured
                    // one line, load-bearing: the blanket rule must appear on
                    // the live signed-in flow, not only inside the forms
                    ? "Do not enter private or sensitive data."
                    : `Assigned web workpack: <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>. The shared backend is not configured here, so the assignment cannot be used on this deployment yet.`)
                : this.backend?.configured
                ? "Draft controls enabled. Sign in through the shared backend panel to save or submit evidence."
                : "Draft controls enabled. The shared backend is not configured here, so nothing is uploaded or saved until you use the spreadsheet fallback.")
            : `Inspection only: form controls live in <a href="${escapeHtml(demoUrl())}">demo mode</a>. Nothing is uploaded either way.`;
        notice.setAttribute("role", DEMO_MODE ? "alert" : "note");
    }

    // --- signed-in portal activity: chooser, assigned sheet, add flow ---

    // body classes drive which sidebar sections show (see the css gating
    // block); derived from the user and the chosen activity, never set by
    // hand elsewhere
    syncPortalChrome() {
        if (!ASSIGNMENT_MODE) {
            document.body.classList.remove("portal-signed-out", "portal-chooser", "portal-assigned", "portal-add");
            return;
        }
        const signedOut = !this.backendUser;
        const mode = signedOut ? null : (PORTAL_MODES.has(this.portalMode) ? this.portalMode : "chooser");
        this.renderModeNotice();
        document.body.classList.toggle("portal-signed-out", signedOut);
        document.body.classList.toggle("portal-chooser", mode === "chooser");
        document.body.classList.toggle("portal-assigned", mode === "assigned");
        document.body.classList.toggle("portal-add", mode === "add");
        const chooser = document.getElementById("portalChooser");
        if (chooser) chooser.hidden = mode !== "chooser";
        const bar = document.getElementById("portalModeBar");
        if (bar) bar.hidden = !(mode === "assigned" || mode === "add");
        if (mode === "chooser") this.renderPortalChooser();
        if (mode === "assigned" || mode === "add") this.renderPortalModeBar();
    }

    renderPortalChooser() {
        const chooser = document.getElementById("portalChooser");
        if (!chooser || !ASSIGNMENT_MODE) return;
        const available = this.tasks.filter(feature => (feature.properties?.batch_id || ASSIGNMENT_BATCH_ID) === ASSIGNMENT_BATCH_ID).length;
        const assignedSummary = available
            ? `${available} task${available === 1 ? "" : "s"} available in ${ASSIGNMENT_BATCH_ID}${this.myWorkItems.length ? `; ${this.myWorkItems.length} in My work` : ""}.`
            : `No tasks are assigned to you in ${ASSIGNMENT_BATCH_ID} right now. You can still add or revise places.`;
        chooser.innerHTML = `
            <h2>What would you like to do?</h2>
            <button type="button" class="chooser-option" id="chooseAssignedButton">
                <strong>Assigned tasks</strong>
                <span>${escapeHtml(assignedSummary)}</span>
            </button>
            <button type="button" class="chooser-option" id="chooseAddButton">
                <strong>Add or revise places</strong>
                <span>Nominate a missing place, or click a grey dot on the map to revise a place already recorded.${(this.myNominationItems || []).length ? ` You have ${this.myNominationItems.length} under review.` : ""}</span>
            </button>
        `;
        document.getElementById("chooseAssignedButton")?.addEventListener("click", () => this.setPortalMode("assigned"));
        document.getElementById("chooseAddButton")?.addEventListener("click", () => this.setPortalMode("add"));
    }

    renderPortalModeBar() {
        const bar = document.getElementById("portalModeBar");
        if (!bar || !ASSIGNMENT_MODE) return;
        const label = this.portalMode === "add" ? "Add or revise places" : "Assigned tasks";
        bar.classList.toggle("mode-add", this.portalMode === "add");
        bar.innerHTML = `
            <span>${label}</span>
            <button type="button" class="link-button" id="changeActivityButton">← Change activity</button>
        `;
        document.getElementById("changeActivityButton")?.addEventListener("click", () => this.setPortalMode(null));
    }

    // switches activity in place (no reload); null returns to the chooser.
    // the choice persists for the tab so a reload lands where the
    // contributor was
    setPortalMode(mode) {
        if (!ASSIGNMENT_MODE || !this.backendUser) return;
        const next = PORTAL_MODES.has(mode) ? mode : null;
        if (next === this.portalMode) return;
        if (this.formDirty && !window.confirm("You have unsaved entries. Change activity and discard them?")) return;
        if (this.pinMode) this.exitPinMode();
        this.clearFormDirty();
        this.portalMode = next;
        try {
            if (next) {
                sessionStorage.setItem(PORTAL_MODE_KEY, next);
            } else {
                sessionStorage.removeItem(PORTAL_MODE_KEY);
            }
        } catch (error) {
            // storage unavailable: the choice lives in memory only
        }
        if (next === "add") {
            // imagery is the working surface for placing a pin, once close
            // enough for buildings to show
            if (this.map && this.map.getZoom() >= PORTAL_AUTO_SATELLITE_ZOOM && !this.basemapUserChosen) {
                this.setBasemap("hybrid");
            }
            // "revise" in the mode's name must be visible on arrival: show
            // the mapped places so their revise entry point exists on screen
            if (this.pointsMode === "off" && COUNTRY_CONFIG.datedPlaces) {
                this.setPointsMode("period");
                const pointsSelect = document.getElementById("portalPointsSelect");
                if (pointsSelect) pointsSelect.value = "period";
            }
        } else if (this.basemap !== "streets" && !this.basemapUserChosen) {
            this.setBasemap("streets");
        }
        this.selectedTask = null;
        this.renderInitialDetail();
        this.renderBackendPanel();
        document.querySelector(".sidebar")?.scrollTo({ top: 0 });
    }

    restorePortalMode() {
        if (!ASSIGNMENT_MODE) return;
        if (PORTAL_MODES.has(this.portalMode)) return;
        let stored = "";
        try {
            stored = sessionStorage.getItem(PORTAL_MODE_KEY) || "";
        } catch (error) {
            stored = "";
        }
        this.portalMode = PORTAL_MODES.has(stored) ? stored : null;
        if (this.portalMode === "add" && this.map && this.map.getZoom() >= PORTAL_AUTO_SATELLITE_ZOOM) {
            this.setBasemap("hybrid");
        }
    }

    // --- basemap: streets (osm) or satellite (maptiler) ---

    addBasemapControl() {
        const control = L.control({ position: "topright" });
        control.onAdd = () => {
            const div = L.DomUtil.create("div", "basemap-toggle");
            div.setAttribute("role", "group");
            div.setAttribute("aria-label", "Basemap");
            div.innerHTML = `
                <button type="button" data-basemap="streets" aria-pressed="true">Streets</button>
                <button type="button" data-basemap="hybrid" aria-pressed="false">Hybrid</button>
                <button type="button" data-basemap="satellite" aria-pressed="false">Satellite</button>
            `;
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            div.querySelectorAll("button").forEach(button => {
                button.addEventListener("click", () => {
                    this.basemapUserChosen = true;
                    this.setBasemap(button.dataset.basemap);
                });
            });
            return div;
        };
        control.addTo(this.map);
    }

    // a referrer-blocked or exhausted key must not leave the contributor on
    // a blank map: repeated tile errors with no successful load drop the map
    // to streets and retire the imagery options for the session
    watchImageryLayer(layer) {
        let errors = 0;
        let loaded = false;
        layer.on("tileload", () => { loaded = true; });
        layer.on("tileerror", () => {
            errors += 1;
            if (loaded || errors < 3) return;
            this.markImageryBroken();
        });
    }

    // img tiles render even on http 403 — maptiler ships a blocked-notice
    // image — so tileerror alone cannot detect a refused key. one fetch
    // probe per session sees the real status the first time imagery is used
    probeImagery() {
        if (this._imageryProbe) return this._imageryProbe;
        const url = (HYBRID_TILE_URL || SATELLITE_TILE_URL).replace("{z}/{x}/{y}", "1/1/1");
        this._imageryProbe = fetch(url)
            .then(response => {
                if (!response.ok) this.markImageryBroken();
            })
            .catch(() => this.markImageryBroken());
        return this._imageryProbe;
    }

    markImageryBroken() {
        if (this.imageryBroken) return;
        this.imageryBroken = true;
        this.setBasemap("streets");
        document.querySelectorAll(".basemap-toggle button").forEach(button => {
            if (button.dataset.basemap !== "streets") {
                button.setAttribute("disabled", "true");
                button.title = "Imagery is unavailable right now";
            }
        });
    }

    setBasemap(name) {
        if (!this.map || !this.streetsLayer) return;
        const layers = { streets: this.streetsLayer, hybrid: this.hybridLayer, satellite: this.satelliteLayer };
        const next = layers[name] && !(this.imageryBroken && name !== "streets") ? name : "streets";
        if (next !== "streets") this.probeImagery();
        if (next !== this.basemap) {
            const incoming = layers[next];
            Object.entries(layers).forEach(([key, layer]) => {
                if (layer && key !== next && this.map.hasLayer(layer)) this.map.removeLayer(layer);
            });
            if (!this.map.hasLayer(incoming)) incoming.addTo(this.map);
            // tiles sit beneath the canvas dots and dom markers
            incoming.bringToBack();
            this.basemap = next;
            // imagery needs haloed markers: the css rings and the canvas
            // context dots switch treatment on this class (jb 2026-09-02)
            this.map.getContainer().classList.toggle("basemap-imagery", next !== "streets");
            this.syncContextDots();
        }
        document.querySelectorAll(".basemap-toggle button").forEach(button => {
            button.setAttribute("aria-pressed", button.dataset.basemap === this.basemap ? "true" : "false");
        });
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
            // nominated candidates live in the manual batch, which the
            // assignment-scoped query cannot return; fetch it as well so
            // nominations stay reachable and visible to the duplicate
            // check after a reload, not only in this page's memory
            let manualBatchTasks = [];
            if (ASSIGNMENT_MODE) {
                const manualBatchId = `manual-${COUNTRY_CONFIG.countryCode.toLowerCase()}`;
                manualBatchTasks = (await this.backend.listTasks({
                    countryCode: COUNTRY_CONFIG.countryCode,
                    batchId: manualBatchId,
                    limit: 1000,
                })) || [];
            }
            this.backendTasksById = new Map(allTasks.map(task => [task.task_id, task]));
            for (const task of manualBatchTasks) {
                this.backendTasksById.set(task.task_id, task);
            }
            // re-merge local copies so the ra stays landed in a task
            // created moments ago that the queries have not indexed yet
            for (const [taskId, manualTask] of this.manualTasksById) {
                if (!this.backendTasksById.has(taskId)) {
                    this.backendTasksById.set(taskId, manualTask);
                }
            }
            // no batch scope: my work covers the assignment batch and the
            // ra's own nominated candidates in the manual batch
            const myItems = ASSIGNMENT_MODE
                ? ((await this.backend.listMyTasks({
                    countryCode: COUNTRY_CONFIG.countryCode,
                    statuses: MY_WORK_STATUSES,
                    limit: 200,
                })) || []).filter(item => {
                    const batchId = item?.task?.batch_id || "";
                    return batchId === ASSIGNMENT_BATCH_ID
                        || batchId === `manual-${COUNTRY_CONFIG.countryCode.toLowerCase()}`
                        || batchId === `ra-issues-${COUNTRY_CONFIG.countryCode.toLowerCase()}`;
                })
                : [];
            // assignment work and the ra's own nominations are separate
            // lists (jb 2026-08-31): my work covers the batch; nominations
            // live in their own panel in add mode
            this.myWorkItems = myItems.filter(item => !isNominationProps(item?.task));
            this.myNominationItems = myItems.filter(item => isNominationProps(item?.task));
            // the nominations panel depends on this list and the selection
            // only, so it renders here and on selectTask, not per keystroke
            this.renderNominationList();
            if (ASSIGNMENT_MODE) {
                // nominated candidates join the map and list whatever their
                // status: their author needs a route back to them, and the
                // pin-drop proximity check needs to see them
                const nominatedTasks = [...manualBatchTasks];
                for (const [taskId, manualTask] of this.manualTasksById) {
                    if (!nominatedTasks.some(task => task.task_id === taskId)) {
                        nominatedTasks.push(manualTask);
                    }
                }
                const availableTasks = allTasks.filter(task => this.assignmentTaskIsAvailable(task));
                this.tasks = availableTasks
                    .concat(nominatedTasks)
                    .map(featureFromBackendTask);
                const snapshotEl = document.getElementById("snapshotId");
                if (snapshotEl) {
                    // batch numbers only: nominations are separate work and
                    // count in their own panel, not the assignment header
                    snapshotEl.textContent = `${ASSIGNMENT_BATCH_ID} | ${availableTasks.length} available of ${allTasks.length}`;
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

        const matchesFilters = feature => {
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
        };
        // one partition pass: nominations stay off the assignment sheet and
        // its filters, but always stay on the map for the duplicate check
        // and the route back to them
        this.nominationFeatures = [];
        this.filteredTasks = [];
        for (const feature of this.tasks) {
            if (isNominationProps(feature.properties)) {
                this.nominationFeatures.push(feature);
            } else if (matchesFilters(feature)) {
                this.filteredTasks.push(feature);
            }
        }

        this.renderMarkers();
        this.renderTaskList();
        this.updateStats();
    }

    // the ra's own nominations, listed apart from the assignment sheet in
    // add mode: name, status, and the route back — nothing else
    renderNominationList() {
        const panel = document.getElementById("nominationsPanel");
        if (!panel) return;
        // author-scoped: listMyTasks returns only the signed-in ra's work,
        // so this list never presents another contributor's nominations as
        // "my nominations" (the country-wide manual batch stays map-only)
        const rows = this.myNominationItems || [];
        panel.innerHTML = `
            <h2>My nominations${rows.length ? ` (${rows.length})` : ""}</h2>
            ${rows.length ? rows.map(item => {
                const task = item.task || {};
                const statusText = (task.status || "in review").replaceAll("_", " ");
                const activeClass = this.selectedTask?.properties?.task_id === task.task_id ? " active" : "";
                return `
                    <button class="task-row entry-card${activeClass}" type="button" data-task-id="${escapeHtml(task.task_id || "")}">
                        <span class="task-row-title">${escapeHtml(task.name || "Unnamed place")}<span class="entry-badge">${escapeHtml(statusText)}</span></span>
                        <span class="task-row-meta">${escapeHtml(task.locality || task.address || "")}</span>
                    </button>
                `;
            }).join("") : `<div class="task-row-meta">None yet.</div>`}
        `;
        panel.querySelectorAll(".task-row").forEach(row => {
            row.addEventListener("click", () => this.selectTaskById(row.dataset.taskId));
        });
    }

    renderMarkers() {
        this.markerLayer.clearLayers();
        this.markersByTaskId.clear();

        this.filteredTasks.concat(this.nominationFeatures || []).forEach(feature => {
            const coordinates = feature.geometry?.coordinates || [];
            if (coordinates.length < 2) return;
            const [lng, lat] = coordinates;
            const props = { ...(feature.properties || {}) };
            props.google_maps_url = mapUrlForCoordinates(coordinates) || props.google_maps_url || "";
            props.street_view_url = streetViewUrlForCoordinates(coordinates) || props.street_view_url || "";
            const temporal = deriveTargetYearStatus(props, this.targetYear);
            const verifState = validationState(this.backendTasksById.get(props.task_id)?.status, temporal.status);
            const locationAssertion = props.initial_location_assertion
                || this.backendTasksById.get(props.task_id)?.initial_location_assertion;
            if (
                locationAssertion?.mode === "approximate_area"
                && Number.isFinite(locationAssertion.uncertainty_radius_m)
            ) {
                const area = L.circle([lat, lng], {
                    radius: locationAssertion.uncertainty_radius_m,
                    color: "#a15c07",
                    weight: 2,
                    opacity: 0.85,
                    fillColor: "#f4c46b",
                    fillOpacity: 0.14,
                    interactive: false,
                });
                this.markerLayer.addLayer(area);
            }
            const marker = L.marker([lat, lng], {
                icon: this.createIcon(props.verification_priority, temporal.status, verifState, isNominationProps(props)),
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

    createIcon(priority, status, verifState = "unvalidated", isNomination = false) {
        const size = priority === "high" ? 15 : priority === "medium" ? 13 : 11;
        const color = statusColor(status);
        // a nomination is pure-entry work, worn as a dashed teal ring on a
        // hollow marker (state = ring, never fill), apart from every
        // validation-state ring hue. only the healthy states take the teal:
        // disputed and validated nominations keep their state ring so a
        // stalled nomination stays visible on the map
        if (isNomination && (verifState === "unvalidated" || verifState === "in_review")) {
            return L.divIcon({
                className: "",
                html: `<div class="verification-marker vm-nomination" style="width:${size}px;height:${size}px;"></div>`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
            });
        }
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
                ${this.taskCanAddOccupancy(props.task_id) ? `<button class="popup-link popup-add-occupancy" type="button" data-task-id="${escapeHtml(props.task_id)}">Add where and when</button>` : ""}
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
        // periods for a place this ra has already recorded (site-card route)
        const occupancyButton = popup.getElement()?.querySelector(".popup-add-occupancy");
        if (occupancyButton) {
            occupancyButton.addEventListener("click", () => {
                const feature = this.featureForTaskId(occupancyButton.dataset.taskId);
                this.openOccupancyFromRecord(feature?.properties || { task_id: occupancyButton.dataset.taskId });
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
            this.clearGuidedPeriods(this.formDirtyTaskId);
            this.clearFormDirty();
        }
        this.selectedTask = feature;
        const props = feature.properties || {};
        const coordinates = feature.geometry?.coordinates || [];
        const locationAssertion = props.initial_location_assertion
            || this.backendTasksById.get(props.task_id)?.initial_location_assertion;
        const [lng, lat] = coordinates;

        if (!fromMarker && coordinates.length >= 2) {
            if (
                locationAssertion?.mode === "approximate_area"
                && Number.isFinite(locationAssertion.uncertainty_radius_m)
            ) {
                const bounds = L.circle([lat, lng], { radius: locationAssertion.uncertainty_radius_m }).getBounds();
                this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
            } else {
                this.map.setView([lat, lng], Math.max(this.map.getZoom(), 16));
            }
            const marker = this.markersByTaskId.get(props.task_id);
            if (marker) {
                marker.openPopup();
            }
        }

        this.renderTaskList();
        this.renderNominationList();
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
        // "start" rather than "nearest": when the sidebar is the scroll
        // container (desktop, and phone assignment mode) "nearest" leaves the
        // panel bottom-aligned with only its heading visible
        panel.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    renderInitialDetail() {
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        if (ASSIGNMENT_MODE) {
            panel.innerHTML = `
                <h2>${this.portalMode === "add" ? "Add places" : "Assigned web workpack"}</h2>
                <div class="${this.backend?.configured ? "pilot-note" : "demo-warning"}" role="${this.backend?.configured ? "note" : "alert"}">
                    ${this.backend?.configured
                        ? this.portalMode === "add"
                            ? `Use <strong>＋ Add a missing place</strong> above, then find the building by searching a name or address, typing coordinates, or clicking the map. Drag the pin onto the building before confirming. To revise a place already recorded, click its grey dot and choose "Revise or report an issue".`
                            : RAPID_ASSIGNED_ENTRY
                                ? `Work through <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>. For each place, choose one current-status answer, record how you know it, and use <em>Submit for review</em>.`
                                : `Work through <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>. Use <em>Save draft</em> while working, <em>Submit unresolved note</em> when useful evidence remains incomplete, and <em>Submit for review</em> when a case is ready for JB.`
                        : `This link points to <strong>${escapeHtml(ASSIGNMENT_BATCH_ID)}</strong>, but this deployment does not yet have the shared backend enabled.`}
                </div>
                <div class="detail-section">
                    <h3>What to check</h3>
                    <div class="disabled-panel">
                        ${this.portalMode === "add"
                            ? `Before nominating, check whether the place is already on the map. Nearby existing records are listed automatically after you confirm a pin location.`
                            : RAPID_ASSIGNED_ENTRY
                            ? `For each assigned place, record what you can confirm at the observation date: whether the place exists and whether it is used for worship. Do not infer worship use from the building alone. Historical target years (${escapeHtml(COUNTRY_CONFIG.targetYears.join(", "))}) stay unassessed here; use the detailed form for historical or complicated cases.`
                            : `For each assigned case, answer the task question, seek non-OSM evidence where possible, record ${escapeHtml(COUNTRY_CONFIG.targetYears.join(", "))} status, preserve any useful opening or closure dates, and submit unresolved notes for cases that should stay visible but cannot yet be resolved.`}
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
    renderSubmissionRecordedDetail(props, {
        unresolved = false,
        skipped = false,
        corrected = false,
        deduped = false,
        knownHistory = null,
        nomination = false,
        revision = false,
        hasEvidenceFiles = false,
        periodsRecorded = null,
    } = {}) {
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        const periodYears = Array.isArray(periodsRecorded?.result?.derived_years) ? periodsRecorded.result.derived_years : [];
        const periodsLine = periodsRecorded
            ? `Recorded ${periodsRecorded.count} period${periodsRecorded.count === 1 ? "" : "s"}; ${periodYears.length} census-year proposal${periodYears.length === 1 ? "" : "s"}${periodYears.length ? ` (${periodYears.join(", ")})` : ""} await${periodYears.length === 1 ? "s" : ""} reviewer confirmation.`
            : "";
        panel.innerHTML = `
            <h2>${skipped ? "Task skipped" : unresolved ? "Unresolved note submitted" : corrected ? "Correction submitted" : revision ? "Revision submitted for review" : "Submitted for review"}</h2>
            <div class="copy-status" role="status">
                ${escapeHtml(props.name || "Unnamed site")} ${props.task_id ? `(${escapeHtml(props.task_id)})` : ""} —
                ${skipped
                    ? "skipped in the shared backend."
                    : unresolved
                        ? "saved as an unresolved note for review."
                        : deduped
                            ? "this observation was already recorded; nothing was duplicated."
                            : corrected
                                ? "corrected observation submitted for review; the earlier record is kept as superseded."
                                : "saved to the shared backend and submitted for review."}
            </div>
            ${periodsLine ? `<div class="copy-status" role="status">${escapeHtml(periodsLine)}</div>` : ""}
            ${!skipped && props.task_id ? `<div id="confirmAttachmentsBlock" class="attachments-block" hidden></div>` : ""}
            <div class="button-row">
                ${knownHistory ? `<button id="addKnownHistoryButton" type="button">Add known history</button>` : ""}
                ${knownHistory && window.PowOccupancy ? `<button id="addOccupancyButton" class="secondary" type="button">Add where and when</button>` : ""}
                ${nomination
                    ? `<button id="nominateAnotherButton"${knownHistory ? ` class="secondary"` : ""} type="button">Add another place</button>`
                    : `<button id="openNextTaskButton"${knownHistory ? ` class="secondary"` : ""} type="button">Open next task</button>`}
                ${skipped ? `<button id="undoSkipButton" class="secondary" type="button">Undo skip</button>` : ""}
                ${!skipped && props.task_id ? `<button id="requestOpinionButton" class="secondary" type="button">Request a second opinion</button>` : ""}
            </div>
            <div id="confirmPaneStatus" class="copy-status" aria-live="polite"></div>
            <div class="pilot-note" role="note">
                Pick another task from the map or list.${this.filterActiveHint()}
            </div>
        `;
        // leaving this pane forfeits the promised attach step, so each exit
        // button asks first when files were promised or an upload is running
        const guarded = handler => () => {
            if (!this.confirmLeavePendingAttachments()) return;
            handler();
        };
        document.getElementById("openNextTaskButton")?.addEventListener("click", guarded(() => this.openNextAvailableTask()));
        document.getElementById("nominateAnotherButton")?.addEventListener("click", guarded(() => this.enterPinMode()));
        document.getElementById("addKnownHistoryButton")?.addEventListener("click", guarded(() => this.renderHistoricalClaimEntry(knownHistory)));
        document.getElementById("addOccupancyButton")?.addEventListener("click", guarded(() => this.renderOccupancyEntry(knownHistory)));
        document.getElementById("undoSkipButton")?.addEventListener("click", () => this.undoSkip(props.task_id));
        // submission-side second-opinion call (jb 2026-09-01): the entry
        // then needs an extra independent reviewer before acceptance
        document.getElementById("requestOpinionButton")?.addEventListener("click", async () => {
            const note = window.prompt("Why should a second reviewer look at this entry? (at least 8 characters)") || "";
            if (!note.trim()) return;
            const statusEl = document.getElementById("confirmPaneStatus");
            try {
                const result = await this.backend.requestAdditionalOpinion({ taskId: props.task_id, note: note.trim() });
                if (statusEl) statusEl.textContent = `Second opinion requested: acceptance now needs ${result.extra_opinions_required} extra independent reviewer decision${result.extra_opinions_required === 1 ? "" : "s"}.`;
            } catch (error) {
                if (statusEl) statusEl.textContent = error.message || "Could not request a second opinion.";
            }
        });
        // photos and documents attach to the task record just created, so a
        // nomination can carry its site photo immediately after submission
        this.pendingEvidenceAttachTaskId = !skipped && nomination && hasEvidenceFiles && props.task_id
            ? props.task_id
            : null;
        if (!skipped && props.task_id) {
            this.initAttachmentsBlock(props, document.getElementById("confirmAttachmentsBlock"), { prominent: nomination });
        }
    }

    // a nominator who said they had photos gets one chance to reconsider
    // before leaving the confirmation pane with nothing attached
    confirmLeavePendingAttachments() {
        if (!this.pendingEvidenceAttachTaskId && !this.attachmentUploadInFlight) return true;
        const message = this.attachmentUploadInFlight
            ? "An upload is still in progress. Leave anyway?"
            : "You said you had photos or documents for this place and none are attached yet. Leave anyway?";
        const leave = window.confirm(message);
        if (leave) this.pendingEvidenceAttachTaskId = null;
        return leave;
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
    issueFormHtml(context, { open = false, flagOnly = false } = {}) {
        const signedIn = Boolean(this.backend?.configured && this.backend.signedIn);
        return `
            <details id="issueReportDetails" class="skip-form issue-form"${open ? " open" : ""}>
                <summary${flagOnly ? "" : ` class="revise-heading"`}>${flagOnly ? "Just flag it — nothing to add" : "Revise this place or report an issue"}</summary>
                <div class="copy-help">
                    Nothing is edited or removed directly: your report opens a review task, and a reviewer decides against sources.
                </div>
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

    // which form a task's detail shows: assigned tasks follow the country's
    // batch design; nominations use the rapid pure-entry form wherever the
    // server's intake registry allows it (jb 2026-08-31)
    taskUsesRapidForm(props) {
        if (RAPID_ASSIGNED_ENTRY) return true;
        if (!(RAPID_NOMINATION_ENTRY && isNominationProps(props))) return false;
        // a nomination already holding guided evidence stays on the guided
        // form: the rapid form must never hide or overwrite a guided draft
        // (mirrors the read-only branch's contract check)
        const taskId = props?.task_id;
        const latest = taskId ? this.latestDraftForTask(taskId) : null;
        const draftLoaded = taskId ? this.latestDraftsByTaskId.has(taskId) : false;
        return !draftLoaded || !latest || latest.observation_contract_version === "rapid_current_v1";
    }

    taskIsReadOnly(taskId) {
        const backendTask = this.backendTasksById.get(taskId);
        if (!ASSIGNMENT_MODE || !backendTask) return false;
        if (RAPID_ANY_ENTRY && this.rapidCorrectionTaskIds.has(taskId)) return false;
        return READ_ONLY_ASSIGNMENT_STATUSES.has(backendTask.status) && !this.taskIsRevisionMode(taskId);
    }

    // a task whose latest evidence is a rapid observation by the signed-in
    // observer: the server accepts a correction only from that author while
    // the task awaits review (needs_review, unresolved_note, changes_requested)
    taskCanCorrectRapid(taskId) {
        const backendTask = this.backendTasksById.get(taskId);
        const draft = this.latestDraftForTask(taskId);
        return Boolean(
            RAPID_ANY_ENTRY
            && backendTask
            && REVISION_ELIGIBLE_STATUSES.has(backendTask.status)
            && draft?.observation_contract_version === "rapid_current_v1"
            && draft.created_by === this.backendUser?._id
        );
    }

    // historical claims may follow either supported evidence contract, but
    // only while the parent submission remains active and only for its author.
    taskCanAddHistory(taskId) {
        const backendTask = this.backendTasksById.get(taskId);
        const draft = this.latestDraftForTask(taskId);
        const supportedParent = draft?.observation_contract_version === "rapid_current_v1"
            || draft?.observation_contract_version === "guided_observation_v1";
        return Boolean(
            HISTORICAL_CLAIM_ENTRY
            && backendTask
            && REVISION_ELIGIBLE_STATUSES.has(backendTask.status)
            && supportedParent
            && ["submitted", "unresolved_note"].includes(draft?.draft_status)
            && draft.created_by === this.backendUser?._id
        );
    }

    historicalClaimContext(props, draft, nomination = false) {
        const parentDate = (draft?.source_date_or_capture_date || "").trim();
        return {
            taskId: props.task_id,
            parentEvidenceDraftId: draft.evidence_draft_id,
            taskName: props.name || "Unnamed site",
            referenceDate: parentDate || window.PowRapidEntry.localIsoDate(),
            referenceDateFromParent: Boolean(parentDate),
            nomination,
        };
    }

    // periods attach to the same parent as known history, under the same
    // author-and-status rule; the site card offers them wherever it offers
    // history (brief section 5, second route)
    taskCanAddOccupancy(taskId) {
        return Boolean(window.PowOccupancy) && this.taskCanAddHistory(taskId);
    }

    // the second route into the periods pane: from a recorded place's site
    // card (popup or detail) rather than the post-submission pane. the ra's
    // periods already recorded for this parent load into the cards, because
    // a new submission replaces the earlier set rather than adding to it
    async openOccupancyFromRecord(props) {
        const taskId = props?.task_id || "";
        if (!taskId || !window.PowOccupancy) return;
        this.map?.closePopup();
        if (!this.latestDraftsByTaskId.has(taskId)) await this.loadLatestDraftForTask(taskId);
        if (!this.taskCanAddOccupancy(taskId)) {
            const status = document.getElementById("copyStatus");
            if (status) status.textContent = "Periods can be recorded only by the author of this place's submitted evidence while it awaits review.";
            return;
        }
        const draft = this.latestDraftForTask(taskId);
        const context = { ...this.historicalClaimContext(props, draft, isNominationProps(props)), fromRecord: true };
        let rows = [];
        let loadNote = "";
        try {
            rows = (await this.backend.listTaskOccupancies({ taskId })) || [];
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
                return;
            }
            loadNote = "Your earlier periods could not be loaded; saving now would replace them. Reload the portal before recording.";
        }
        const mine = rows
            .filter(row => row.claim_status === "submitted"
                && row.parent_evidence_draft_id === draft.evidence_draft_id
                && row.created_by === this.backendUser?._id)
            .sort((a, b) => a.segment_index - b.segment_index);
        if (!mine.length) {
            this.occupancyDraft = null;
            this.renderOccupancyEntry(context, loadNote ? { statusMessage: loadNote } : {});
            return;
        }
        this.occupancyDraft = {
            taskId,
            context,
            submissionId: window.PowRapidEntry.secureSubmissionId(),
            segments: mine.map(row => {
                const segment = window.PowOccupancy.segmentFromRow(row);
                segment.locationSummary = segment.location ? this.occupancyLocationSummary(segment.location) : "";
                return segment;
            }),
            provenance: window.PowOccupancy.provenanceFromRow(mine[0]),
        };
        this.renderOccupancyEntry(context, {
            restore: true,
            statusMessage: `Your ${mine.length} recorded period${mine.length === 1 ? "" : "s"} ${mine.length === 1 ? "is" : "are"} loaded. Saving records the whole set again and replaces the earlier set for review.`,
        });
    }

    // one line naming a card's distinct location, from its assertion
    occupancyLocationSummary(assertion) {
        const at = `${Number(assertion.latitude).toFixed(5)}, ${Number(assertion.longitude).toFixed(5)}`;
        if (assertion.mode !== "approximate_area") return `Building at ${at}.`;
        const radius = Number(assertion.uncertainty_radius_m);
        const grade = window.PowLocationAssertion
            ? window.PowLocationAssertion.gradeLabel({ mode: "approximate_area", uncertaintyRadiusM: radius })
            : "approximate";
        return `${grade.charAt(0).toUpperCase()}${grade.slice(1)} area within ${radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} of ${at}.`;
    }

    startRapidCorrection(props) {
        const taskId = props?.task_id || "";
        if (!taskId || !this.taskCanCorrectRapid(taskId)) return;
        this.rapidCorrectionTaskIds.add(taskId);
        this.renderDetail(this.featureForTaskId(taskId) || this.selectedTask);
        this.focusDetailPanel();
    }

    cancelRapidCorrection(props) {
        const taskId = props?.task_id || "";
        this.rapidCorrectionTaskIds.delete(taskId);
        this.clearFormDirty();
        this.renderDetail(this.featureForTaskId(taskId) || this.selectedTask);
    }

    // the audited "delete": withdraws the recorded draft from review while
    // the row stays in the task history, and the task returns to the ra
    async withdrawRapidDraft(props) {
        const taskId = props?.task_id || "";
        const draft = taskId ? this.latestDraftForTask(taskId) : null;
        const status = document.getElementById("copyStatus");
        if (!draft?.evidence_draft_id || !this.backend?.configured || !this.backend.signedIn) return;
        if (!window.confirm("Delete this draft? It is withdrawn from review but stays in the audit history.")) return;
        const button = document.getElementById("withdrawDraftButton");
        if (button) button.disabled = true;
        try {
            await this.backend.withdrawEvidenceDraft({ evidenceDraftId: draft.evidence_draft_id });
            this.rapidCorrectionTaskIds.delete(taskId);
            this.latestDraftsByTaskId.delete(taskId);
            this.taskHistoryByTaskId.delete(taskId);
            this.clearFormDirty();
            await this.refreshBackendTasks();
            this.applyFilters();
            this.renderDetail(this.featureForTaskId(taskId) || this.selectedTask);
            this.focusDetailPanel();
        } catch (error) {
            if (button) button.disabled = false;
            if (status) status.textContent = error.message || "Could not delete the draft.";
        }
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
        return "";
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
            observation_contract_version: this.observationContractVersionFor(values),
            action: values.action,
            target_year_statuses: values.targetYearStatuses,
            target_year_confidence: values.targetYearConfidence,
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
            denomination_or_tradition_raw: values.denominationRaw,
            denomination_label_basis: values.denominationLabelBasis,
            denomination_relation: values.denominationRelation,
            privacy_flag: values.privacyFlag,
            evidence_note: values.note,
            interpretation_note: values.interpretationNote,
            uncertainty_note: values.uncertaintyNote,
            target_year_entry_reason: values.yearGridReason,
            pending_occupancy_cards: this.guidedPeriodsSnapshot(taskId),
        });
    }

    // re-render the detail panel without losing typed-but-unsaved values;
    // use for same-task programmatic rebuilds (year change, refresh, sign-in)
    renderDetailPreservingForm(feature) {
        const taskId = feature?.properties?.task_id;
        if (
            RAPID_ANY_ENTRY
            && taskId
            && this.formDirty
            && this.formDirtyTaskId === taskId
            && document.getElementById("taskRapidCurrentForm")
        ) {
            return;
        }
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
        const locationAssertion = props.initial_location_assertion
            || this.backendTasksById.get(props.task_id)?.initial_location_assertion;
        const locationIsApproximate = locationAssertion?.mode === "approximate_area";
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

            ${locationAssertion ? `
                <div class="detail-section">
                    <h3>Location evidence</h3>
                    <dl class="recorded-observation-grid">
                        <dt>Representation</dt><dd>${escapeHtml(locationIsApproximate ? "Approximate area" : "Identified building")}</dd>
                        ${locationIsApproximate ? `<dt>Uncertainty radius</dt><dd>${escapeHtml(`${locationAssertion.uncertainty_radius_m} m`)}</dd>` : ""}
                        <dt>Basis</dt><dd>${escapeHtml(cap(String(locationAssertion.basis || "").replaceAll("_", " ")))}</dd>
                        <dt>Confidence</dt><dd>${escapeHtml(cap(locationAssertion.confidence || ""))}</dd>
                        ${locationAssertion.source_wording ? `<dt>Source wording</dt><dd>${escapeHtml(locationAssertion.source_wording)}</dd>` : ""}
                        <dt>Human confirmation</dt><dd>${locationAssertion.contributor_confirmed ? "Confirmed by contributor" : "Not recorded"}</dd>
                    </dl>
                    ${locationIsApproximate ? `<div class="pilot-note">The marker is the centre of a supported area, not an accepted site point. The shaded radius and retained wording remain evidence for human review.</div>` : ""}
                </div>
            ` : ""}

            <div class="detail-section">
                <h3>1. Open source links</h3>
                <div class="copy-help">
                    Use OSM to identify why this case was flagged. Use Street View or other non-OSM sources to check what is visible, and record the imagery capture date when Google shows one.
                </div>
                <div class="link-grid">
                    ${this.linkHtml("Street View", props.street_view_url, "source-link-primary")}
                    ${this.linkHtml(locationIsApproximate ? "Approximate centre in Google Maps" : "Google Maps", props.google_maps_url, "source-link-primary")}
                    ${Number.isFinite(issueContext.latitude) && Number.isFinite(issueContext.longitude) ? `
                    ${this.linkHtml("Open OSM", osmPointUrl(issueContext.latitude, issueContext.longitude))}
                    <button class="coord-copy" type="button" data-copy="${escapeHtml(`${issueContext.latitude.toFixed(5)},${issueContext.longitude.toFixed(5)}`)}">${locationIsApproximate ? "Copy area centre" : "Copy coords"}</button>` : ""}
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
                ${this.taskSkipControlHtml(props)}
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

    // the diagnosis behind the assignment: which flags fired, where the task
    // came from, and what set its priority — the checklist tells the ra what
    // to do, this says why the task exists at all
    taskWhyHtml(props) {
        const checks = props.automated_checks || [];
        const flagged = checks
            .filter(check => check?.message)
            .map(check => `${check.message}${check.severity && check.severity !== "info" ? ` — ${check.severity}` : ""}`);
        const origin = props.batch_id
            ? `From batch ${props.batch_id}${props.case_type ? ` (${String(props.case_type).replaceAll("_", " ")})` : ""}.`
            : "";
        const priorityWhy = props.verification_priority === "high"
            ? "Priority high: flagged checks block export until a person resolves them."
            : props.verification_priority === "low"
                ? "Priority low: background check; no flag demands urgency."
                : "Priority medium: standard verification.";
        const items = uniqueItems([
            props.selection_reason || "",
            origin,
            ...flagged,
            priorityWhy,
        ]);
        if (!items.length) return "";
        return `
            <div class="task-why">
                <strong>Why you have this task</strong>
                <ul>
                    ${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
                </ul>
            </div>
        `;
    }

    siteTaskBriefHtml(props) {
        if (this.taskUsesRapidForm(props) && !this.taskIsReadOnly(props.task_id)) {
            return `
                <h3>Record current information</h3>
                ${this.taskWhyHtml(props)}
            `;
        }
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
                ${this.taskWhyHtml(props)}
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
            if (this.taskUsesRapidForm(props) && !readOnly) {
                return `
                    <div class="pilot-note">
                        Record only what you can confirm now. The server keeps every historical target year unassessed, derives the provisional review fields, and sends the observation to human review without changing the public map.
                    </div>
                `;
            }
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
                        Waiting for review — use <strong>Revise submission</strong> if you have new evidence.
                    </div>
                `;
            }
            if (readOnly && status === "unresolved_note") {
                return `
                    <div class="pilot-note">
                        Unresolved note waiting for review — use <strong>Revise submission</strong> if you have new evidence.
                    </div>
                `;
            }
            if (readOnly && status === "changes_requested") {
                return `
                    <div class="pilot-note">
                        Changes requested — use <strong>Revise submission</strong> to respond.
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

    detailedEntryUrl() {
        const url = new URL(window.location.href);
        url.searchParams.set("detailed", "1");
        return url.toString();
    }

    rapidObservationFieldsHtml(prefix, options = {}) {
        const submitLabel = options.submitLabel || "Submit for review";
        const submissionId = options.submissionId || window.PowRapidEntry.secureSubmissionId();
        const pre = options.prefill || {};
        const checked = value => pre.current_observation_status === value ? " checked" : "";
        const preBasis = pre.current_observation_basis || "direct_field_observation";
        const preNamed = preBasis === "named_public_source" || preBasis === "other";
        const optionalOpen = Boolean(pre.denomination_or_tradition_raw || pre.evidence_note || pre.uncertainty_note
            || pre.current_observation_status === "could_not_determine");
        return `
            <form id="${prefix}RapidCurrentForm" class="rapid-current-form" data-submission-id="${escapeHtml(submissionId)}">
                <fieldset class="rapid-choice-group" id="${prefix}CurrentStatusGroup">
                    <legend>What can you confirm at the observation date? <span class="req-chip">required</span></legend>
                    <label class="rapid-choice">
                        <input type="radio" name="${prefix}CurrentStatus" value="currently_used_for_worship"${checked("currently_used_for_worship")}>
                        <span><strong>This site is used for worship</strong><small>At the observation date, the place exists and worship use is confirmed.</small></span>
                    </label>
                    <label class="rapid-choice">
                        <input type="radio" name="${prefix}CurrentStatus" value="place_exists_worship_uncertain"${checked("place_exists_worship_uncertain")}>
                        <span><strong>The place exists, but worship use is uncertain</strong><small>At the observation date, do not infer worship use from the building alone.</small></span>
                    </label>
                    <label class="rapid-choice">
                        <input type="radio" name="${prefix}CurrentStatus" value="place_exists_not_used_for_worship"${checked("place_exists_not_used_for_worship")}>
                        <span><strong>The place exists but is not used for worship</strong><small>This records non-use at the observation date; a reviewer will assess any past use, closure, relocation, or changed use.</small></span>
                    </label>
                    <label class="rapid-choice">
                        <input type="radio" name="${prefix}CurrentStatus" value="could_not_determine"${checked("could_not_determine")}>
                        <span><strong>I could not determine its status</strong><small>Record what remained uncertain at the observation date.</small></span>
                    </label>
                </fieldset>
                <div class="field-grid">
                    <label>
                        Observation date <span class="req-chip">required</span>
                        <input id="${prefix}ObservedOn" type="date" max="${escapeHtml(window.PowRapidEntry.localIsoDate())}" value="${escapeHtml(pre.source_date_or_capture_date || window.PowRapidEntry.localIsoDate())}">
                        <small class="label-help">This is also the source or capture date: the date of your visit, or of the imagery or source you used.</small>
                    </label>
                    <label>
                        How do you know this? <span class="req-chip">required</span>
                        <select id="${prefix}ObservationBasis">
                            ${Object.entries(RAPID_BASIS_LABELS).map(([value, label]) => `<option value="${escapeHtml(value)}"${value === preBasis ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
                        </select>
                    </label>
                </div>
                <div class="source-quick-fill" id="${prefix}SourceQuickFill">
                    <span class="label-help">Checked a usual source? Fill it in one click:</span>
                    <button type="button" class="tertiary" id="${prefix}QuickFillOsm" title="Cite the OpenStreetMap record (or the map at this point) as your named source">OpenStreetMap record</button>
                    <button type="button" class="tertiary" id="${prefix}QuickFillStreetView" title="Cite Google Street View imagery at this point as your named source">Google Street View</button>
                </div>
                <div id="${prefix}NamedSourceFields" class="rapid-conditional"${preNamed ? "" : " hidden"}>
                    <label>
                        Source title or brief description <span class="req-chip">required for a named source</span>
                        <input id="${prefix}SourceTitle" type="text" maxlength="2048" autocomplete="off" value="${escapeHtml(preNamed ? pre.source_title || "" : "")}">
                        <small class="label-help">Start typing to pick a source the team has already registered.</small>
                    </label>
                    <div id="${prefix}SourcePickList" class="source-pick-list" hidden></div>
                    <input id="${prefix}SourceId" type="hidden" value="${escapeHtml(preNamed ? pre.source_id || "" : "")}">
                    <label>
                        Source URL or agreed file reference (if one exists) <span class="req-chip">required for a named source</span>
                        <input id="${prefix}SourceReference" type="text" maxlength="4096" value="${escapeHtml(preNamed ? pre.source_url_or_file || "" : "")}">
                    </label>
                    <label id="${prefix}SourceLocatorField"${preNamed && pre.source_id ? "" : " hidden"}>
                        Page or entry number in this source (optional)
                        <input id="${prefix}SourceLocator" type="text" maxlength="256" placeholder="e.g. p. 214 or entry 1187" value="${escapeHtml(preNamed ? pre.source_locator || "" : "")}">
                    </label>
                    <label class="flag-discussion" id="${prefix}SaveSourceField">
                        <input type="checkbox" id="${prefix}SaveSourceToRegister">
                        <span><strong>Add this source to the shared register</strong><small>Lets the whole team pick and cite it; your name is recorded as its creator.</small></span>
                    </label>
                </div>
                <details id="${prefix}OptionalBlock" class="optional-block"${optionalOpen ? " open" : ""}>
                    <summary>Denomination or notes</summary>
                    <div class="rapid-optional-fields">
                        <label>
                            Exact denomination or tradition wording (optional)
                            <input id="${prefix}DenominationRaw" type="text" maxlength="2048" placeholder="Copy the wording exactly" value="${escapeHtml(pre.denomination_or_tradition_raw || "")}">
                        </label>
                        <label>
                            Where did that wording come from? (if known)
                            <select id="${prefix}DenominationBasis">
                                ${selectOptionsHtml(DENOMINATION_LABEL_BASIS_OPTIONS, pre.denomination_label_basis || "unknown")}
                            </select>
                        </label>
                        <label>
                            What did you directly observe? (optional for an in-person observation)
                            <textarea id="${prefix}DirectObservation" rows="2" maxlength="2000">${escapeHtml(pre.evidence_note || "")}</textarea>
                        </label>
                        <label>
                            What remains uncertain? <span id="${prefix}UncertaintyChip" class="req-chip" hidden>required</span>
                            <textarea id="${prefix}UncertaintyNote" rows="2" maxlength="2000">${escapeHtml(pre.uncertainty_note || "")}</textarea>
                            <small class="label-help">Optional — unless you could not determine the status; then explain in at least 12 characters.</small>
                        </label>
                    </div>
                </details>
                <label>
                    Sensitivity and privacy <span class="req-chip">required</span>
                    <select id="${prefix}PrivacyFlag">
                        ${selectOptionsHtml(PRIVACY_FLAG_OPTIONS, pre.privacy_flag || "needs_review")}
                    </select>
                </label>
                <div class="copy-help">
                    No contact details or private conversations. Choose restricted for culturally restricted places or identifiable people.
                </div>
                <label class="flag-discussion">
                    <input type="checkbox" id="${prefix}FlagForDiscussion">
                    <span><strong>Flag for discussion</strong><small>Record a partial entry — for example a duplicate on the map, shared denominations, or a case the form does not fit — and bring it to the team.</small></span>
                </label>
                <label id="${prefix}DiscussionField" hidden>
                    What needs discussion? <span class="req-chip">required when flagged</span>
                    <textarea id="${prefix}DiscussionNote" rows="2" maxlength="2000" placeholder="e.g. this place is recorded twice on the map; two denominations share the building"></textarea>
                </label>
                ${options.attachmentsHint ? `
                    <label class="flag-discussion">
                        <input type="checkbox" id="${prefix}HasEvidenceFiles"${pre.hasEvidenceFiles ? " checked" : ""}>
                        <span><strong>I have photos or documents for this place</strong><small>You attach them right after saving, on the confirmation screen.</small></span>
                    </label>
                ` : ""}
                <div class="button-row">
                    <button id="${prefix}RapidSubmit" type="submit" data-submit-label="${escapeHtml(submitLabel)}">${escapeHtml(submitLabel)}</button>
                    ${options.showCancel ? `<button id="${prefix}FormCancelButton" type="button" class="secondary">Cancel</button>` : ""}
                </div>
                <div id="${prefix}RapidStatus" class="copy-status" aria-live="polite"></div>
            </form>
        `;
    }

    rapidCurrentReviewFormHtml(props) {
        const taskId = props?.task_id || "";
        const correcting = Boolean(taskId && this.rapidCorrectionTaskIds.has(taskId));
        const previous = correcting ? this.latestDraftForTask(taskId) : null;
        return `
            <h3>${correcting ? "Correct your observation" : "Current observation"}</h3>
            ${correcting ? `
                <div class="pilot-note">
                    Your earlier observation stays on record, marked superseded.
                </div>
            ` : this.formModeNoticeHtml(props)}
            <div id="taskAttachmentsBlock" class="attachments-block" hidden></div>
            ${this.rapidObservationFieldsHtml("task", {
                submitLabel: correcting ? "Submit correction for review" : "Submit for review",
                showCancel: correcting,
                prefill: previous,
            })}
            ${correcting ? "" : `
                <div class="rapid-detailed-link">
                    <a href="${escapeHtml(this.detailedEntryUrl())}">Use the detailed historical or complicated-case form</a>
                </div>
            `}
        `;
    }

    // read-only view of a submitted rapid observation with the single
    // correction action the server supports for its author
    rapidReadOnlyHtml(props, draft, draftLoaded) {
        const taskId = props?.task_id || "";
        const backendTask = this.backendTaskForProps(props);
        const status = backendTask?.status || "";
        const canCorrect = this.taskCanCorrectRapid(taskId);
        const canAddHistory = this.taskCanAddHistory(taskId);
        const canAddOccupancy = this.taskCanAddOccupancy(taskId);
        const statusNote = status === "changes_requested"
            ? "A reviewer asked for more evidence. Submit a corrected observation to respond."
            : status === "needs_review" || status === "unresolved_note"
                ? "This observation is waiting for review."
                : "This task is closed for now. Ask JB to reopen it if new evidence changes the answer.";
        const statusLabelText = RAPID_STATUS_LABELS[draft?.current_observation_status] || draft?.current_observation_status || "";
        const basisLabelText = RAPID_BASIS_LABELS[draft?.current_observation_basis] || draft?.current_observation_basis || "";
        const summary = !draftLoaded
            ? `<div class="copy-status">Loading the recorded observation...</div>`
            : draft
                ? `
                    <dl class="meta-grid rapid-summary">
                        <dt>Confirmed</dt><dd>${escapeHtml(statusLabelText)}</dd>
                        <dt>Observed on</dt><dd>${escapeHtml(draft.source_date_or_capture_date || "")}</dd>
                        <dt>Basis</dt><dd>${escapeHtml(basisLabelText)}</dd>
                        ${draft.source_title && draft.current_observation_basis !== "direct_field_observation" && draft.current_observation_basis !== "local_investigator_account" ? `<dt>Source</dt><dd>${escapeHtml(draft.source_title)}${draft.source_url_or_file ? ` — ${escapeHtml(draft.source_url_or_file)}` : ""}</dd>` : ""}
                        ${draft.denomination_or_tradition_raw ? `<dt>Denomination</dt><dd>${escapeHtml(draft.denomination_or_tradition_raw)}</dd>` : ""}
                        ${draft.evidence_note ? `<dt>Observed</dt><dd>${escapeHtml(draft.evidence_note)}</dd>` : ""}
                        ${draft.uncertainty_note ? `<dt>Uncertain</dt><dd>${escapeHtml(draft.uncertainty_note)}</dd>` : ""}
                        <dt>Privacy</dt><dd>${escapeHtml(String(draft.privacy_flag || "").replaceAll("_", " "))}</dd>
                    </dl>
                `
                : `<div class="copy-status">No observation is attached to this task yet.</div>`;
        return `
            <h3>Recorded observation</h3>
            <div class="pilot-note">${escapeHtml(statusNote)}</div>
            ${summary}
            ${canCorrect || canAddHistory ? `
                <div class="button-row">
                    ${canAddHistory ? `<button id="addKnownHistoryFromRecordedButton" type="button">Add known history</button>` : ""}
                    ${canAddOccupancy ? `<button id="addOccupancyFromRecordedButton" class="secondary" type="button">Add where and when</button>` : ""}
                    ${canCorrect ? `<button id="correctObservationButton"${canAddHistory ? ` class="secondary"` : ""} type="button">Correct this observation</button>` : ""}
                    ${canCorrect ? `<button id="withdrawDraftButton" class="secondary" type="button">Delete this draft</button>` : ""}
                </div>
                ${canCorrect ? `<div class="copy-help">Correct only for a mistake or new information. Delete withdraws the draft from review; it stays in the audit history.</div>` : ""}
            ` : ""}
            <div id="copyStatus" class="copy-status" aria-live="polite"></div>
        `;
    }

    rapidObservationValues(prefix) {
        return {
            currentStatus: document.querySelector(`input[name="${prefix}CurrentStatus"]:checked`)?.value || "",
            observationBasis: document.getElementById(`${prefix}ObservationBasis`)?.value || "",
            observedOn: document.getElementById(`${prefix}ObservedOn`)?.value || "",
            sourceTitle: document.getElementById(`${prefix}SourceTitle`)?.value || "",
            sourceReference: document.getElementById(`${prefix}SourceReference`)?.value || "",
            sourceId: document.getElementById(`${prefix}SourceId`)?.value || "",
            sourceLocator: document.getElementById(`${prefix}SourceLocator`)?.value || "",
            saveSourceToRegister: Boolean(document.getElementById(`${prefix}SaveSourceToRegister`)?.checked),
            denominationRaw: document.getElementById(`${prefix}DenominationRaw`)?.value || "",
            denominationLabelBasis: document.getElementById(`${prefix}DenominationBasis`)?.value || "unknown",
            directObservation: document.getElementById(`${prefix}DirectObservation`)?.value || "",
            uncertaintyNote: document.getElementById(`${prefix}UncertaintyNote`)?.value || "",
            privacyFlag: document.getElementById(`${prefix}PrivacyFlag`)?.value || "",
            flagForDiscussion: Boolean(document.getElementById(`${prefix}FlagForDiscussion`)?.checked),
            discussionNote: document.getElementById(`${prefix}DiscussionNote`)?.value || "",
            hasEvidenceFiles: Boolean(document.getElementById(`${prefix}HasEvidenceFiles`)?.checked),
        };
    }

    // ---- unsubmitted rapid drafts, kept on this device only ----

    rapidDraftStorageKey(key) {
        return `powRapidDraft:${COUNTRY_CONFIG.countryCode}:${key}`;
    }

    persistRapidDraft(prefix, key, extraValues = {}) {
        try {
            const record = {
                saved_at: Date.now(),
                values: this.rapidObservationValues(prefix),
                extra: extraValues,
            };
            window.localStorage.setItem(this.rapidDraftStorageKey(key), JSON.stringify(record));
        } catch (error) {
            // private windows or blocked storage lose autosave only
        }
    }

    readRapidDraft(key) {
        try {
            const raw = window.localStorage.getItem(this.rapidDraftStorageKey(key));
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    clearRapidDraft(key) {
        try {
            window.localStorage.removeItem(this.rapidDraftStorageKey(key));
        } catch (error) {
            // nothing to clear when storage is unavailable
        }
    }

    restoreRapidDraft(prefix, key) {
        const record = this.readRapidDraft(key);
        if (!record?.values) return null;
        const values = record.values;
        const setValue = (id, value) => {
            const el = document.getElementById(`${prefix}${id}`);
            if (el && value !== undefined && value !== "") el.value = value;
        };
        if (values.currentStatus) {
            const radio = document.querySelector(`input[name="${prefix}CurrentStatus"][value="${values.currentStatus}"]`);
            if (radio) radio.checked = true;
        }
        setValue("ObservationBasis", values.observationBasis);
        setValue("ObservedOn", values.observedOn);
        setValue("SourceTitle", values.sourceTitle);
        setValue("SourceReference", values.sourceReference);
        setValue("SourceId", values.sourceId);
        setValue("SourceLocator", values.sourceLocator);
        setValue("DenominationRaw", values.denominationRaw);
        setValue("DenominationBasis", values.denominationLabelBasis);
        setValue("DirectObservation", values.directObservation);
        setValue("UncertaintyNote", values.uncertaintyNote);
        setValue("PrivacyFlag", values.privacyFlag);
        setValue("DiscussionNote", values.discussionNote);
        const flag = document.getElementById(`${prefix}FlagForDiscussion`);
        if (flag && values.flagForDiscussion) flag.checked = true;
        const evidenceFlag = document.getElementById(`${prefix}HasEvidenceFiles`);
        if (evidenceFlag && values.hasEvidenceFiles) evidenceFlag.checked = true;
        this.updateRapidSourceFields(prefix);
        this.updateRapidDiscussionFields(prefix);
        this.updateRapidUncertaintyField(prefix);
        this.updateSourceLocatorField(prefix);
        if (values.denominationRaw || values.directObservation || values.uncertaintyNote) {
            const optional = document.querySelector(`#${prefix}RapidCurrentForm .optional-block`);
            if (optional) optional.open = true;
        }
        return record;
    }

    // highlights the field named by validation and scrolls it into view
    showRapidFieldError(prefix, error) {
        document.querySelectorAll(".field-invalid").forEach(el => el.classList.remove("field-invalid"));
        if (!error?.field) return;
        const target = error.field === "CurrentStatus"
            ? document.getElementById(`${prefix}CurrentStatusGroup`)
            : document.getElementById(`${prefix}${error.field}`);
        if (!target) return;
        // a field inside a collapsed <details> cannot be scrolled to or
        // focused; open every enclosing block before pointing at it
        for (let block = target.closest("details"); block; block = block.parentElement?.closest("details")) {
            block.open = true;
        }
        const holder = target.closest("label") || target;
        holder.classList.add("field-invalid");
        holder.scrollIntoView({ behavior: "smooth", block: "center" });
        if (typeof target.focus === "function") target.focus({ preventScroll: true });
    }

    updateRapidDiscussionFields(prefix) {
        const flagged = Boolean(document.getElementById(`${prefix}FlagForDiscussion`)?.checked);
        const field = document.getElementById(`${prefix}DiscussionField`);
        if (field) field.hidden = !flagged;
        const submit = document.getElementById(`${prefix}RapidSubmit`);
        if (submit) {
            submit.textContent = flagged
                ? "Flag for discussion"
                : submit.dataset.submitLabel || "Submit for review";
        }
    }

    // the usual sources an ra checks (jb 2026-09-02): one click cites the
    // osm record or street view at this point as the named public source,
    // switching the basis and filling title and reference. the ra still
    // owns the observation date (also the capture date) and the status
    rapidQuickSources(prefix, options = {}) {
        const props = options.props || {};
        let coordinates = null;
        const taskPoint = props.geometry?.coordinates;
        if (Array.isArray(taskPoint) && taskPoint.length >= 2) {
            coordinates = taskPoint;
        } else if (prefix === "pin" && this.pinConfirmed) {
            coordinates = [this.pinConfirmed.longitude, this.pinConfirmed.latitude];
        } else if (this.pinMarker?.getLatLng) {
            const at = this.pinMarker.getLatLng();
            coordinates = [at.lng, at.lat];
        }
        const osmObject = props.osm_object_url || (props.osm_type && props.osm_id ? osmObjectUrl(props.osm_type, props.osm_id) : "");
        const osmPoint = coordinates ? osmPointUrl(coordinates[1], coordinates[0]) : "";
        const streetView = props.street_view_url || (coordinates ? streetViewUrlForCoordinates(coordinates) : "");
        return {
            osm: {
                title: osmObject ? `OpenStreetMap ${props.osm_type || ""} ${props.osm_id || ""}`.replace(/\s+/g, " ").trim() : "OpenStreetMap map view at this point",
                reference: osmObject || osmPoint,
                missing: "Confirm the pin first so the OpenStreetMap link can point at it.",
            },
            street_view: {
                title: "Google Street View imagery at this point",
                reference: streetView,
                missing: "Confirm the pin first so the Street View link can point at it.",
            },
        };
    }

    rapidQuickFill(prefix, options, kind) {
        const source = this.rapidQuickSources(prefix, options)[kind];
        const status = document.getElementById(`${prefix}RapidStatus`);
        if (!source || !source.reference) {
            if (status) status.textContent = source?.missing || "No link is available for this source yet.";
            return;
        }
        const basis = document.getElementById(`${prefix}ObservationBasis`);
        if (basis) {
            basis.value = "named_public_source";
            basis.dispatchEvent(new Event("change", { bubbles: true }));
        }
        this.updateRapidSourceFields(prefix);
        const title = document.getElementById(`${prefix}SourceTitle`);
        const reference = document.getElementById(`${prefix}SourceReference`);
        const sourceId = document.getElementById(`${prefix}SourceId`);
        if (sourceId) sourceId.value = "";
        if (title) {
            title.value = source.title;
            title.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (reference) {
            reference.value = source.reference;
            reference.dispatchEvent(new Event("input", { bubbles: true }));
        }
        this.updateSourceLocatorField(prefix);
        if (status) {
            status.classList.remove("copy-status-error");
            status.textContent = kind === "street_view"
                ? "Street View cited. Set the observation date to the capture date Google shows."
                : "OpenStreetMap cited. The OSM record is context for identity; say in the note what you saw there.";
        }
        reference?.focus();
    }

    updateRapidSourceFields(prefix) {
        const basis = document.getElementById(`${prefix}ObservationBasis`)?.value || "";
        const fields = document.getElementById(`${prefix}NamedSourceFields`);
        if (fields) fields.hidden = basis !== "named_public_source" && basis !== "other";
    }

    // the locator only means something inside a picked register source
    updateSourceLocatorField(prefix) {
        const picked = Boolean(document.getElementById(`${prefix}SourceId`)?.value);
        const field = document.getElementById(`${prefix}SourceLocatorField`);
        if (field) field.hidden = !picked;
        if (!picked) {
            const locator = document.getElementById(`${prefix}SourceLocator`);
            if (locator) locator.value = "";
        }
        const save = document.getElementById(`${prefix}SaveSourceField`);
        if (save) save.hidden = picked;
    }

    // typeahead over the shared source register: picking a row fills the
    // citation snapshot and stamps the register id on the entry. a
    // deployment without the register simply offers no picker
    bindSourceTypeahead(prefix) {
        const title = document.getElementById(`${prefix}SourceTitle`);
        const list = document.getElementById(`${prefix}SourcePickList`);
        if (!title || !list || !this.backend?.configured) return;
        let searchTimer = 0;
        const hideList = () => {
            list.hidden = true;
            list.innerHTML = "";
        };
        title.addEventListener("input", () => {
            // editing the title breaks the pick: the stored snapshot must
            // match the register row it cites
            const idEl = document.getElementById(`${prefix}SourceId`);
            if (idEl && idEl.value) {
                idEl.value = "";
                this.updateSourceLocatorField(prefix);
            }
            window.clearTimeout(searchTimer);
            const search = title.value.trim();
            if (search.length < 2 || !this.backend.signedIn) {
                hideList();
                return;
            }
            searchTimer = window.setTimeout(async () => {
                let rows = [];
                try {
                    rows = await this.backend.searchSources({ search, countryCode: COUNTRY_CONFIG.countryCode });
                } catch (error) {
                    hideList();
                    return;
                }
                if (!rows.length || (document.getElementById(`${prefix}SourceTitle`)?.value.trim() ?? "") !== search) {
                    hideList();
                    return;
                }
                list.innerHTML = rows.map(row => `
                    <button type="button" class="source-pick-row"
                        data-source-id="${escapeHtml(row.source_id)}"
                        data-title="${escapeHtml(row.title)}"
                        data-reference="${escapeHtml(row.url || row.archive_ref || "")}">
                        ${escapeHtml(row.title)}${row.provider ? ` — ${escapeHtml(row.provider)}` : ""}${row.created_by_initials ? ` <small>(added by ${escapeHtml(row.created_by_initials)})</small>` : ""}
                    </button>
                `).join("");
                list.hidden = false;
                list.querySelectorAll(".source-pick-row").forEach(rowEl => {
                    rowEl.addEventListener("click", () => {
                        title.value = rowEl.dataset.title;
                        const reference = document.getElementById(`${prefix}SourceReference`);
                        if (reference && !reference.value.trim()) reference.value = rowEl.dataset.reference || "";
                        if (idEl) idEl.value = rowEl.dataset.sourceId;
                        hideList();
                        this.updateSourceLocatorField(prefix);
                    });
                });
            }, 300);
        });
        // a click on a pick row fires before this delayed hide
        title.addEventListener("blur", () => window.setTimeout(hideList, 250));
    }

    // the uncertainty note becomes required when the status could not be
    // determined, so the collapsed optional block must open and say so
    updateRapidUncertaintyField(prefix) {
        const selected = document.querySelector(`input[name="${prefix}CurrentStatus"]:checked`)?.value;
        const required = selected === "could_not_determine";
        const chip = document.getElementById(`${prefix}UncertaintyChip`);
        if (chip) chip.hidden = !required;
        if (required) {
            const block = document.getElementById(`${prefix}OptionalBlock`);
            if (block) block.open = true;
        }
    }

    bindRapidObservationForm(prefix, options = {}) {
        const form = document.getElementById(`${prefix}RapidCurrentForm`);
        if (!form || !window.PowRapidEntry) return;
        const draftKey = options.props?.task_id || `rapid-${prefix}`;
        const extraIds = options.draftExtraIds || [];
        const persist = () => {
            const extra = Object.fromEntries(
                extraIds.map(id => [id, document.getElementById(id)?.value || ""]).filter(([, value]) => value),
            );
            this.persistRapidDraft(prefix, draftKey, extra);
            const status = document.getElementById(`${prefix}RapidStatus`);
            // never overwrite a visible validation error with the draft notice
            if (status && !status.classList.contains("copy-status-error")
                && !status.textContent.startsWith("Draft kept")) {
                status.textContent = "Draft kept on this device until you submit.";
            }
        };
        let persistTimer = 0;
        const markDirty = () => {
            this.markFormDirty(options.props?.task_id || `rapid-${prefix}`);
            window.clearTimeout(persistTimer);
            persistTimer = window.setTimeout(persist, 400);
        };
        form.addEventListener("input", markDirty);
        form.addEventListener("change", markDirty);
        form.addEventListener("input", event => {
            event.target?.closest?.("label, fieldset")?.classList?.remove("field-invalid");
        });
        document.getElementById(`${prefix}ObservationBasis`)?.addEventListener("change", () => {
            this.updateRapidSourceFields(prefix);
        });
        document.getElementById(`${prefix}FlagForDiscussion`)?.addEventListener("change", () => {
            this.updateRapidDiscussionFields(prefix);
        });
        form.querySelectorAll(`input[name="${prefix}CurrentStatus"]`).forEach(radio => {
            radio.addEventListener("change", () => this.updateRapidUncertaintyField(prefix));
        });
        this.bindSourceTypeahead(prefix);
        document.getElementById(`${prefix}QuickFillOsm`)?.addEventListener("click", () => {
            this.rapidQuickFill(prefix, options, "osm");
        });
        document.getElementById(`${prefix}QuickFillStreetView`)?.addEventListener("click", () => {
            this.rapidQuickFill(prefix, options, "street_view");
        });
        this.updateRapidSourceFields(prefix);
        this.updateRapidDiscussionFields(prefix);
        this.updateRapidUncertaintyField(prefix);
        this.updateSourceLocatorField(prefix);
        // a correction prefill outranks the device draft; otherwise restore
        // unsubmitted work so a lost session costs nothing
        if (!options.prefill) {
            const restored = this.restoreRapidDraft(prefix, draftKey);
            if (restored) {
                extraIds.forEach(id => {
                    const value = restored.extra?.[id];
                    const el = document.getElementById(id);
                    if (el && value) el.value = value;
                });
                const status = document.getElementById(`${prefix}RapidStatus`);
                if (status) {
                    const savedAt = restored.saved_at ? new Date(restored.saved_at).toLocaleString() : "";
                    status.textContent = `Restored your unsubmitted draft from this device${savedAt ? ` (saved ${savedAt})` : ""}.`;
                }
            }
        }
        form.addEventListener("submit", event => {
            event.preventDefault();
            this.submitRapidObservation(prefix, { ...options, draftKey });
        });
    }

    async submitRapidObservation(prefix, options = {}) {
        const form = document.getElementById(`${prefix}RapidCurrentForm`);
        const status = document.getElementById(`${prefix}RapidStatus`);
        const submitButton = document.getElementById(`${prefix}RapidSubmit`);
        if (!form || !window.PowRapidEntry) return;
        if (!this.backend?.configured || !this.backend.signedIn) {
            if (status) status.textContent = "Sign in before recording this observation.";
            return;
        }
        const values = this.rapidObservationValues(prefix);
        const flagOptions = { flagForDiscussion: values.flagForDiscussion };
        const inputError = window.PowRapidEntry.validateObservationDetailed(values, flagOptions);
        if (inputError) {
            if (status) {
                status.textContent = inputError.message;
                status.classList.add("copy-status-error");
            }
            this.showRapidFieldError(prefix, inputError);
            return;
        }
        if (status) status.classList.remove("copy-status-error");
        this.showRapidFieldError(prefix, null);
        const candidate = options.getCandidate?.();
        if ((options.getCandidate && !candidate) || (options.createTask && !this.pinConfirmed)) {
            if (status) status.textContent = "Confirm the map location before recording this observation.";
            return;
        }
        submitButton.disabled = true;
        if (status) status.textContent = values.flagForDiscussion ? "Flagging securely for discussion..." : "Submitting securely for review...";
        try {
            // an opted-in new source is registered first so this entry can
            // cite it; register failure falls back to the snapshot strings
            if (!values.sourceId && values.saveSourceToRegister
                && values.sourceTitle?.trim() && values.sourceReference?.trim()) {
                try {
                    const created = await this.backend.createSource({
                        countryCode: COUNTRY_CONFIG.countryCode,
                        sourceType: "other",
                        title: values.sourceTitle.trim(),
                        url: values.sourceReference.trim(),
                    });
                    values.sourceId = created.source_id;
                } catch (error) {
                    // the register is optional; the citation strings still land
                }
            }
            // a revision first opens (or claims) its task in the issue
            // batch, then submits the observation against that task
            const revision = options.createTask ? await options.createTask() : null;
            const result = await this.backend.submitCurrentObservation({
                clientSubmissionId: form.dataset.submissionId,
                countryCode: COUNTRY_CONFIG.countryCode,
                ...(options.props?.task_id
                    ? { taskId: options.props.task_id }
                    : revision
                        ? { taskId: revision.task_id }
                        : { candidate }),
                observation: window.PowRapidEntry.observationPayload(values, flagOptions),
                ...(values.flagForDiscussion ? { flagForDiscussion: true } : {}),
                clientContext: {
                    ...(this.pinConfirmed?.zoom !== undefined ? { placement_zoom: this.pinConfirmed.zoom } : {}),
                    ...(options.getCandidate ? {
                        proximity_checked: true,
                        nearby_count: this.pinNearbyCount,
                    } : {}),
                    portal_version: "rapid-current-v1-multicountry",
                },
            });
            this.clearFormDirty();
            if (options.draftKey) this.clearRapidDraft(options.draftKey);
            if (options.props?.task_id) {
                const taskId = options.props.task_id;
                this.rapidCorrectionTaskIds.delete(taskId);
                this.formSnapshotsByTaskId.delete(taskId);
                this.latestDraftsByTaskId.delete(taskId);
                this.taskHistoryByTaskId.delete(taskId);
                await this.refreshBackendTasks();
                this.selectedTask = null;
                this.applyFilters();
                this.renderSubmissionRecordedDetail(options.props, {
                    corrected: Boolean(result.corrected),
                    deduped: Boolean(result.deduped),
                    knownHistory: {
                        taskId: result.task_id,
                        parentEvidenceDraftId: result.evidence_draft_id,
                        taskName: options.props.name || "Unnamed site",
                        referenceDate: values.observedOn,
                        referenceDateFromParent: true,
                        nomination: false,
                    },
                });
                this.focusDetailPanel();
                return;
            }
            if (revision) {
                await this.refreshBackendTasks();
                this.applyFilters();
                this.exitPinMode();
                const revisedProps = { task_id: revision.task_id, name: revision.name };
                this.renderSubmissionRecordedDetail(revisedProps, {
                    deduped: Boolean(result.deduped),
                    nomination: true,
                    revision: true,
                    hasEvidenceFiles: Boolean(values.hasEvidenceFiles),
                    knownHistory: {
                        taskId: revision.task_id,
                        parentEvidenceDraftId: result.evidence_draft_id,
                        taskName: revision.name,
                        referenceDate: values.observedOn,
                        referenceDateFromParent: true,
                        nomination: true,
                    },
                });
                this.focusDetailPanel();
                return;
            }
            // synthesise the backend-task shape locally so the nomination
            // stays on the map, in the list, in my work, and visible to
            // the proximity check before the batch queries catch up
            const manualTask = {
                task_id: result.task_id,
                batch_id: `manual-${COUNTRY_CONFIG.countryCode.toLowerCase()}`,
                country_code: COUNTRY_CONFIG.countryCode,
                task_type: "missing_from_project_map",
                priority: "high",
                status: result.task_status,
                assigned_to: this.backendUser?._id,
                target_years: COUNTRY_CONFIG.targetYears.map(Number),
                candidate_site_id: result.candidate_site_id,
                name: candidate.name,
                address: candidate.address,
                locality: candidate.locality,
                geometry: {
                    type: "Point",
                    coordinates: [candidate.longitude, candidate.latitude],
                },
                automated_checks: [{
                    check_id: "rapid_current_nomination",
                    severity: "info",
                    message: "An invited RA submitted a current-place observation through the rapid-entry path.",
                    suggested_action: "review_identity_and_current_use",
                }],
                task_brief: "Review this current-place observation. Confirm site identity, present worship use, sensitivity, and whether an existing project or OSM record already represents the place before export.",
            };
            this.manualTasksById.set(result.task_id, manualTask);
            this.backendTasksById.set(result.task_id, manualTask);
            await this.refreshBackendTasks();
            this.applyFilters();
            this.exitPinMode();
            const submittedProps = {
                task_id: result.task_id,
                name: candidate.name || "Unknown place of worship",
            };
            this.renderSubmissionRecordedDetail(submittedProps, {
                deduped: Boolean(result.deduped),
                nomination: true,
                hasEvidenceFiles: Boolean(values.hasEvidenceFiles),
                knownHistory: {
                    taskId: result.task_id,
                    parentEvidenceDraftId: result.evidence_draft_id,
                    taskName: submittedProps.name,
                    referenceDate: values.observedOn,
                    referenceDateFromParent: true,
                    nomination: true,
                },
            });
            this.focusDetailPanel();
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            submitButton.disabled = false;
            if (status) status.textContent = `${error.message || "Could not submit the observation."} Your entries remain here; try again.`;
        }
    }

    // renders one repeatable claim form linked to submitted rapid or guided evidence.
    historicalClaimFormHtml(context, { recordedCount = 0, statusMessage = "" } = {}) {
        const submissionId = window.PowRapidEntry.secureSubmissionId();
        const referenceDateLabel = context.referenceDateFromParent
            ? context.referenceDate
            : `the claim-recording date (${context.referenceDate})`;
        return `
            <h2>${recordedCount ? "Historical claim recorded" : "Add known history"}</h2>
            <div class="pilot-note">
                Record one historical event or state at a time. Structure history, worship function, affiliation, leadership, and shared use remain separate claims. This evidence enters review and does not fill a target-year state automatically.
            </div>
            ${statusMessage ? `<div class="copy-status" role="status">${escapeHtml(statusMessage)}</div>` : ""}
            ${recordedCount ? `<div class="history-count">${recordedCount} historical claim${recordedCount === 1 ? "" : "s"} recorded in this entry sequence.</div>` : ""}
            <form id="historicalClaimForm" class="rapid-current-form historical-claim-form" data-submission-id="${escapeHtml(submissionId)}">
                <div class="field-grid">
                    <label>
                        What does this claim concern?
                        <select id="historicalClaimKind">
                            <option value="">Choose one...</option>
                            ${Object.entries(HISTORICAL_CLAIM_KIND_LABELS).map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}
                        </select>
                    </label>
                    <label>
                        Is this an event or a state?
                        <select id="historicalClaimTiming">
                            <option value="">Choose one...</option>
                            ${Object.entries(HISTORICAL_CLAIM_TIMING_LABELS).map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}
                        </select>
                    </label>
                </div>
                <label>
                    What event or state does the source support?
                    <input id="historicalClaimText" type="text" maxlength="2048" placeholder="e.g. Anglican leadership or shared Methodist services">
                </label>
                <fieldset class="historical-date-block">
                    <legend>Supported date bounds</legend>
                    <div class="field-grid">
                        <label>
                            Earliest supported date (optional)
                            <input id="historicalEarliestDate" type="text" inputmode="numeric" placeholder="1880" maxlength="10">
                        </label>
                        <label>
                            Latest supported date (optional)
                            <input id="historicalLatestDate" type="text" inputmode="numeric" placeholder="1890" maxlength="10">
                        </label>
                    </div>
                    <label class="historical-open-state">
                        <input id="historicalContinues" type="checkbox">
                        <span>This state remains open through ${escapeHtml(referenceDateLabel)}.</span>
                    </label>
                </fieldset>
                <div class="field-grid">
                    <label>
                        Confidence
                        <select id="historicalConfidence">
                            <option value="">Choose one...</option>
                            ${Object.entries(HISTORICAL_CONFIDENCE_LABELS).map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}
                        </select>
                    </label>
                    <label>
                        Why this confidence?
                        <input id="historicalConfidenceBasis" type="text" maxlength="2048">
                    </label>
                </div>
                <div class="field-grid">
                    <label>
                        Source or informant basis
                        <select id="historicalSourceBasis">
                            <option value="">Choose one...</option>
                            ${Object.entries(HISTORICAL_SOURCE_BASIS_LABELS).map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}
                        </select>
                    </label>
                    <label>
                        Source title or brief description
                        <input id="historicalSourceTitle" type="text" maxlength="2048" placeholder="e.g. foundation plaque at west entrance">
                    </label>
                </div>
                <label>
                    Source URL, archive reference, or agreed file reference (required for a named public source)
                    <input id="historicalSourceReference" type="text" maxlength="4096">
                </label>
                <label>
                    Source wording or short dictated account
                    <textarea id="historicalSourceAccount" rows="4" maxlength="8000" placeholder="Retain what the source says. Do not translate phrases such as ‘during the war’ into calendar years unless the source supports them."></textarea>
                </label>
                <div class="copy-help">You may use your device’s dictation. Check the resulting text before submitting. The portal stores the confirmed text, not audio.</div>
                <label>
                    What remains uncertain about the dates or claim? (required when both date bounds are blank)
                    <textarea id="historicalUncertainty" rows="3" maxlength="8000"></textarea>
                </label>
                <label>
                    Sensitivity and privacy
                    <select id="historicalPrivacyFlag">
                        ${selectOptionsHtml(PRIVACY_FLAG_OPTIONS, "needs_review")}
                    </select>
                </label>
                <div class="copy-help">Do not enter personal contact details or private conversations. Choose restricted when the claim could expose a culturally restricted place or identifiable person.</div>
                <div class="button-row">
                    <button id="submitHistoricalClaimButton" type="submit">Record this claim for review</button>
                    <button id="finishHistoricalClaimsButton" class="secondary" type="button">${context.nomination ? "Done — nominate another PoW" : "Done — open next task"}</button>
                    ${window.PowOccupancy ? `<button id="historyToOccupancyButton" class="secondary" type="button">Add where and when</button>` : ""}
                </div>
                <div id="historicalClaimStatus" class="copy-status" aria-live="polite"></div>
            </form>
        `;
    }

    // reads the compact historical form without deriving scientific values.
    historicalClaimValues() {
        return {
            claimKind: document.getElementById("historicalClaimKind")?.value || "",
            claimTiming: document.getElementById("historicalClaimTiming")?.value || "",
            claimText: document.getElementById("historicalClaimText")?.value || "",
            earliestSupportedDate: document.getElementById("historicalEarliestDate")?.value || "",
            latestSupportedDate: document.getElementById("historicalLatestDate")?.value || "",
            continuesThroughObservation: Boolean(document.getElementById("historicalContinues")?.checked),
            confidence: document.getElementById("historicalConfidence")?.value || "",
            confidenceBasis: document.getElementById("historicalConfidenceBasis")?.value || "",
            sourceBasis: document.getElementById("historicalSourceBasis")?.value || "",
            sourceTitle: document.getElementById("historicalSourceTitle")?.value || "",
            sourceReference: document.getElementById("historicalSourceReference")?.value || "",
            sourceAccount: document.getElementById("historicalSourceAccount")?.value || "",
            uncertaintyNote: document.getElementById("historicalUncertainty")?.value || "",
            privacyFlag: document.getElementById("historicalPrivacyFlag")?.value || "",
        };
    }

    // keeps open-state controls consistent with the selected temporal object.
    updateHistoricalTimingControls() {
        const timing = document.getElementById("historicalClaimTiming")?.value || "";
        const continues = document.getElementById("historicalContinues");
        const latest = document.getElementById("historicalLatestDate");
        if (continues) {
            continues.disabled = timing !== "state";
            if (timing !== "state") continues.checked = false;
        }
        if (latest) {
            latest.disabled = Boolean(continues?.checked);
            // a disabled field must not hold a value the validator will
            // reject and the ra can no longer edit
            if (latest.disabled) latest.value = "";
        }
    }

    // mounts and wires a fresh repeatable historical-claim form.
    renderHistoricalClaimEntry(context, options = {}) {
        const panel = document.getElementById("detailPanel");
        if (!panel || !context || !window.PowHistoricalClaim) return;
        panel.innerHTML = this.historicalClaimFormHtml(context, options);
        const form = document.getElementById("historicalClaimForm");
        const markDirty = () => this.markFormDirty(`history-${context.taskId}`);
        form?.addEventListener("input", markDirty);
        form?.addEventListener("change", markDirty);
        document.getElementById("historicalClaimTiming")?.addEventListener("change", () => this.updateHistoricalTimingControls());
        document.getElementById("historicalContinues")?.addEventListener("change", () => this.updateHistoricalTimingControls());
        this.updateHistoricalTimingControls();
        form?.addEventListener("submit", event => {
            event.preventDefault();
            this.submitHistoricalClaim(context, options.recordedCount || 0);
        });
        document.getElementById("finishHistoricalClaimsButton")?.addEventListener("click", () => {
            if (this.formDirty && !window.confirm("Discard this unfinished historical claim?")) return;
            this.clearFormDirty();
            if (context.nomination) {
                this.enterPinMode();
            } else {
                this.openNextAvailableTask();
            }
        });
        // the periods pane attaches to the same parent evidence record
        document.getElementById("historyToOccupancyButton")?.addEventListener("click", () => {
            if (this.formDirty && !window.confirm("Discard this unfinished historical claim?")) return;
            this.clearFormDirty();
            this.renderOccupancyEntry(context);
        });
        this.focusDetailPanel();
    }

    // submits one claim and returns a clean form for another distinct claim.
    async submitHistoricalClaim(context, recordedCount) {
        const form = document.getElementById("historicalClaimForm");
        const status = document.getElementById("historicalClaimStatus");
        const submitButton = document.getElementById("submitHistoricalClaimButton");
        if (!form || !window.PowHistoricalClaim) return;
        if (!this.backend?.configured || !this.backend.signedIn) {
            if (status) status.textContent = "Sign in before recording known history.";
            return;
        }
        const values = this.historicalClaimValues();
        const inputError = window.PowHistoricalClaim.validateHistoricalClaim(values, context.referenceDate);
        if (inputError) {
            if (status) status.textContent = inputError;
            return;
        }
        submitButton.disabled = true;
        if (status) status.textContent = "Recording this historical claim for review...";
        try {
            const result = await this.backend.submitHistoricalClaim({
                clientSubmissionId: form.dataset.submissionId,
                taskId: context.taskId,
                parentEvidenceDraftId: context.parentEvidenceDraftId,
                claim: window.PowHistoricalClaim.historicalClaimPayload(values),
                clientContext: {
                    portal_version: "historical-claim-v1",
                },
            });
            this.clearFormDirty();
            this.taskHistoryByTaskId.delete(context.taskId);
            this.renderHistoricalClaimEntry(context, {
                recordedCount: recordedCount + 1,
                statusMessage: result.deduped
                    ? "That historical claim was already recorded; nothing was duplicated."
                    : "Historical claim recorded for human review. Add another claim only when it concerns a distinct event or state.",
            });
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            submitButton.disabled = false;
            if (status) status.textContent = `${error.message || "Could not record the historical claim."} Your entries remain here; try again.`;
        }
    }

    // ---- occupancy lane: where and when the place was used for worship ----
    // (docs/development/occupancy-build-brief-2026-09-02.md section 5). one
    // submission is a set of period cards plus one shared provenance block,
    // attached to the same parent evidence record as known history. the
    // cards live in this.occupancyDraft so a detour through the pin flow for
    // one card's location returns to the pane with every card intact.

    occupancyBlankSegment(context, overrides = {}) {
        const fromParent = Boolean(context?.referenceDateFromParent);
        return {
            startMode: "known",
            startDate: "",
            startNotEarlierThan: "",
            startNotLaterThan: "",
            startAround: false,
            startBasis: "",
            endMode: fromParent ? "still_active" : "known",
            endDate: "",
            endNotEarlierThan: "",
            endNotLaterThan: "",
            endAround: false,
            endBasis: "",
            endReason: "",
            stillActiveAsof: fromParent ? context.referenceDate : "",
            sameAsPin: true,
            location: null,
            locationSummary: "",
            ...overrides,
        };
    }

    occupancyBlankProvenance() {
        return {
            confidence: "",
            confidenceBasis: "",
            sourceBasis: "",
            sourceTitle: "",
            sourceReference: "",
            sourceAccount: "",
            uncertaintyNote: "",
            privacyFlag: "needs_review",
        };
    }

    // the task's point, when the map knows it; the server resolves
    // "same place as the pin" against it either way
    occupancyTaskPoint(taskId) {
        const coords = this.featureForTaskId(taskId)?.geometry?.coordinates || [];
        if (coords.length < 2) return null;
        return { latitude: Number(coords[1]), longitude: Number(coords[0]) };
    }

    occupancyCardHtml(segment, index, count) {
        const s = segment;
        const dateInput = (name, placeholder) => `<input data-field="${name}" type="text" inputmode="numeric" maxlength="10" placeholder="${placeholder}" value="${escapeHtml(s[name] || "")}">`;
        return `
            <fieldset class="occupancy-card" data-index="${index}">
                <legend>Period ${index + 1}${count > 1 ? ` of ${count}` : ""}</legend>
                <div class="occupancy-block" data-block="start">
                    <div class="occupancy-block-title">Began</div>
                    <div class="field-grid">
                        <label>
                            How is the start known?
                            <select data-field="startMode">${selectOptionsHtml(OCCUPANCY_START_MODE_OPTIONS, s.startMode || "known")}</select>
                        </label>
                        <label data-show="known">
                            Date
                            ${dateInput("startDate", "1954 or 1954-03-01")}
                        </label>
                        <label data-show="between">
                            Not earlier than
                            ${dateInput("startNotEarlierThan", "1950")}
                        </label>
                        <label data-show="between by">
                            Not later than
                            ${dateInput("startNotLaterThan", "1956")}
                        </label>
                    </div>
                    <label class="checkbox-label" data-show="known">
                        <input data-field="startAround" type="checkbox"${s.startAround ? " checked" : ""}>
                        <span>Around this year (records the year before to the year after)</span>
                    </label>
                    <label data-show="dated">
                        How is the start date known?
                        <select data-field="startBasis"><option value="">Choose one...</option>${selectOptionsHtml(OCCUPANCY_START_BASIS_OPTIONS, s.startBasis || "")}</select>
                    </label>
                </div>
                <div class="occupancy-block" data-block="end">
                    <div class="occupancy-block-title">Ended</div>
                    <div class="field-grid">
                        <label>
                            How is the end known?
                            <select data-field="endMode">${selectOptionsHtml(OCCUPANCY_END_MODE_OPTIONS, s.endMode || "known")}</select>
                        </label>
                        <label data-show="still_active">
                            Still in use as of
                            ${dateInput("stillActiveAsof", "2010-06-01")}
                        </label>
                        <label data-show="known">
                            Date
                            ${dateInput("endDate", "1980 or 1980-11")}
                        </label>
                        <label data-show="between after">
                            Not earlier than
                            ${dateInput("endNotEarlierThan", "1978")}
                        </label>
                        <label data-show="between">
                            Not later than
                            ${dateInput("endNotLaterThan", "1982")}
                        </label>
                    </div>
                    <label class="checkbox-label" data-show="known">
                        <input data-field="endAround" type="checkbox"${s.endAround ? " checked" : ""}>
                        <span>Around this year (records the year before to the year after)</span>
                    </label>
                    <div class="field-grid" data-show="dated">
                        <label>
                            How is the end date known?
                            <select data-field="endBasis"><option value="">Choose one...</option>${selectOptionsHtml(OCCUPANCY_END_BASIS_OPTIONS, s.endBasis || "")}</select>
                        </label>
                        <label>
                            Why did it end?
                            <select data-field="endReason"><option value="">Choose one...</option>${selectOptionsHtml(OCCUPANCY_END_REASON_OPTIONS, s.endReason || "")}</select>
                        </label>
                    </div>
                </div>
                <div class="occupancy-block" data-block="location">
                    <div class="occupancy-block-title">Location</div>
                    <label class="checkbox-label">
                        <input data-field="sameAsPin" type="checkbox"${s.sameAsPin !== false ? " checked" : ""}>
                        <span>Same place as the pin</span>
                    </label>
                    <div class="occupancy-distinct" data-role="distinct"${s.sameAsPin === false ? "" : " hidden"}>
                        <div class="copy-status" data-role="locationSummary">${escapeHtml(s.locationSummary || "No location placed yet.")}</div>
                        <button type="button" class="secondary" data-action="place">${s.location ? "Move this period on the map" : "Place this period on the map"}</button>
                    </div>
                </div>
                <div class="occupancy-bounds" data-role="bounds" aria-live="polite"></div>
                ${count > 1 ? `<button type="button" class="tertiary" data-action="remove">Remove period ${index + 1}</button>` : ""}
            </fieldset>
        `;
    }

    occupancyEntryHtml(context, draft, { statusMessage = "" } = {}) {
        const p = draft.provenance;
        const labelledOptions = (labels, selected) => Object.entries(labels)
            .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
            .join("");
        return `
            <h2>Where and when was this place used for worship?</h2>
            <div class="pilot-note">
                One card per period at one location. Bounds are fine. The portal derives a proposal for each census year; a reviewer confirms it.
            </div>
            ${statusMessage ? `<div class="copy-status" role="status">${escapeHtml(statusMessage)}</div>` : ""}
            <form id="occupancyForm" class="rapid-current-form occupancy-form" data-submission-id="${escapeHtml(draft.submissionId)}">
                <div id="occupancyCards" class="occupancy-cards">
                    ${draft.segments.map((segment, index) => this.occupancyCardHtml(segment, index, draft.segments.length)).join("")}
                </div>
                <div class="button-row">
                    <button id="occupancyAddPeriodButton" type="button" class="secondary">Add another period</button>
                </div>
                ${this.periodsGapPromptHtml("pane")}
                ${this.periodsPreviewHtml("pane")}
                ${this.occupancyProvenanceHtml(p)}
                <div class="button-row">
                    <button id="occupancySubmitButton" type="submit">Record these periods for review</button>
                    <button id="occupancyDoneButton" class="secondary" type="button">${this.occupancyDoneLabel(context)}</button>
                </div>
                <div id="occupancyStatus" class="copy-status" aria-live="polite"></div>
            </form>
        `;
    }

    // the shared provenance block of a periods submission (pane and guided form)
    occupancyProvenanceHtml(p) {
        const labelledOptions = (labels, selected) => Object.entries(labels)
            .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
            .join("");
        return `
                <fieldset class="historical-date-block occupancy-provenance">
                    <legend>Source for these periods</legend>
                    <div class="field-grid">
                        <label>
                            Confidence
                            <select id="occConfidence"><option value="">Choose one...</option>${labelledOptions(HISTORICAL_CONFIDENCE_LABELS, p.confidence)}</select>
                        </label>
                        <label>
                            Why this confidence?
                            <input id="occConfidenceBasis" type="text" maxlength="2000" value="${escapeHtml(p.confidenceBasis)}">
                        </label>
                    </div>
                    <div class="field-grid">
                        <label>
                            Source or informant basis
                            <select id="occSourceBasis"><option value="">Choose one...</option>${labelledOptions(HISTORICAL_SOURCE_BASIS_LABELS, p.sourceBasis)}</select>
                        </label>
                        <label>
                            Source title or brief description
                            <input id="occSourceTitle" type="text" maxlength="2000" placeholder="e.g. foundation plaque at west entrance" value="${escapeHtml(p.sourceTitle)}">
                        </label>
                    </div>
                    <label>
                        Source URL, archive reference, or agreed file reference (required for a named public source)
                        <input id="occSourceReference" type="text" maxlength="2000" value="${escapeHtml(p.sourceReference)}">
                    </label>
                    <label>
                        What the source says about these periods
                        <textarea id="occSourceAccount" rows="3" maxlength="2000" placeholder="Retain the source wording. Do not turn ‘after the war’ into years unless the source does.">${escapeHtml(p.sourceAccount)}</textarea>
                    </label>
                    <label>
                        What remains uncertain? (required when a period has no dated start or end)
                        <textarea id="occUncertainty" rows="2" maxlength="2000">${escapeHtml(p.uncertaintyNote)}</textarea>
                    </label>
                    <label>
                        Sensitivity and privacy
                        <select id="occPrivacyFlag">${selectOptionsHtml(PRIVACY_FLAG_OPTIONS, p.privacyFlag || "needs_review")}</select>
                    </label>
                </fieldset>
        `;
    }

    // ---- pr-e: periods inside the guided form (assigned tasks) ----
    // the ruled route for census-year states on assigned tasks: the ra
    // records periods, the preview states what the server will propose, a
    // reviewer confirms. state lives per task so a rebuild of the detail
    // panel (pin flow, year change, sign-in) keeps the cards

    currentTaskIdForForm() {
        return this.selectedTask?.properties?.task_id || "";
    }

    // the evidence date anchors a still-in-use card (finding 7): the source
    // date typed in the form, else nothing until the ra supplies it
    guidedReferenceDate() {
        return document.getElementById("sourceDateInput")?.value?.trim() || "";
    }

    // device persistence, keyed by country, user, and task, so a shared
    // browser never shows one user's cards to another
    guidedPeriodsStorageKey(taskId) {
        const user = this.backendUser?._id || this.backend?.user?._id || "anon";
        return `powGuidedPeriods:${COUNTRY_CONFIG.countryCode}:${user}:${taskId}`;
    }

    persistGuidedPeriods(taskId) {
        const state = this.guidedPeriodsByTaskId.get(taskId);
        if (!state) return;
        try {
            window.localStorage.setItem(this.guidedPeriodsStorageKey(taskId), JSON.stringify({
                saved_at: Date.now(),
                segments: state.segments,
                gapAnswer: state.gapAnswer,
                gapNote: state.gapNote,
                sameSource: state.sameSource,
                provenance: state.provenance,
            }));
        } catch (error) {
            // private windows or blocked storage lose autosave only
        }
    }

    readGuidedPeriodsStorage(taskId) {
        try {
            const raw = window.localStorage.getItem(this.guidedPeriodsStorageKey(taskId));
            const record = raw ? JSON.parse(raw) : null;
            return record && Array.isArray(record.segments) && record.segments.length ? record : null;
        } catch (error) {
            return null;
        }
    }

    clearGuidedPeriods(taskId) {
        if (!taskId) return;
        this.guidedPeriodsByTaskId.delete(taskId);
        try {
            window.localStorage.removeItem(this.guidedPeriodsStorageKey(taskId));
        } catch (error) {
            // nothing to clear when storage is unavailable
        }
    }

    clearAllGuidedPeriods() {
        this.guidedPeriodsByTaskId.clear();
        try {
            const prefix = `powGuidedPeriods:${COUNTRY_CONFIG.countryCode}:`;
            const keys = [];
            for (let i = 0; i < window.localStorage.length; i += 1) {
                const key = window.localStorage.key(i);
                if (key && key.startsWith(prefix)) keys.push(key);
            }
            keys.forEach(key => window.localStorage.removeItem(key));
        } catch (error) {
            // storage unavailable: nothing persisted to clear
        }
    }

    guidedPeriodsState(taskId) {
        let state = this.guidedPeriodsByTaskId.get(taskId);
        if (!state) {
            const stored = this.readGuidedPeriodsStorage(taskId);
            const referenceDate = this.guidedReferenceDate();
            state = stored
                ? { segments: stored.segments, gapAnswer: stored.gapAnswer || "", sameSource: stored.sameSource !== false, provenance: stored.provenance || this.occupancyBlankProvenance(), gapNote: stored.gapNote || "", referenceDate, loadedFrom: "" }
                : { segments: [this.occupancyBlankSegment({ referenceDate, referenceDateFromParent: true })], gapAnswer: "", sameSource: true, provenance: this.occupancyBlankProvenance(), gapNote: "", referenceDate, loadedFrom: "" };
            this.guidedPeriodsByTaskId.set(taskId, state);
        }
        return state;
    }

    // the cards as saved with the draft (finding 2): plain card values, the
    // shared provenance, and the gap answer, so a later open restores them
    guidedPeriodsSnapshot(taskId) {
        const state = this.guidedPeriodsByTaskId.get(taskId);
        if (!state || !window.PowOccupancy?.cardsTouched(state.segments)) return undefined;
        return state.segments.map(seg => ({ ...seg, _gapAnswer: state.gapAnswer, _gapNote: state.gapNote, _sameSource: state.sameSource, _provenance: state.provenance }));
    }

    adoptGuidedPeriods(taskId, cards, provenance, reason) {
        const state = this.guidedPeriodsState(taskId);
        const first = cards[0] || {};
        state.segments = cards.map(card => {
            const { _gapAnswer, _gapNote, _sameSource, _provenance, ...values } = card;
            return values;
        });
        state.gapAnswer = first._gapAnswer || state.gapAnswer;
        state.gapNote = first._gapNote || state.gapNote;
        state.sameSource = first._sameSource !== false;
        state.provenance = first._provenance || provenance || state.provenance;
        return state;
    }

    // true when the ra has typed anything into the cards beyond the blank
    guidedPeriodsTouched(taskId) {
        const state = this.guidedPeriodsByTaskId.get(taskId);
        return Boolean(state && window.PowOccupancy?.cardsTouched(state.segments));
    }

    guidedPeriodsHtml(taskId) {
        if (!window.PowOccupancy || !taskId) return "";
        const state = this.guidedPeriodsState(taskId);
        return `
            <div class="guided-periods" id="guidedPeriods">
                <div class="occupancy-block-title">When was this place used for worship?</div>
                <div class="copy-help">One card per period at one location; bounds are fine. The census-year states are derived from these and a reviewer confirms them. Never let one period span a spell when no worship happened here.</div>
                <div id="guidedPeriodsCards" class="occupancy-cards">
                    ${state.segments.map((segment, index) => this.occupancyCardHtml(segment, index, state.segments.length)).join("")}
                </div>
                <div class="button-row">
                    <button id="guidedAddPeriodButton" class="secondary" type="button">Add another period</button>
                </div>
                ${this.periodsGapPromptHtml("guided")}
                ${this.periodsPreviewHtml("guided")}
                <label class="checkbox-label">
                    <input id="guidedPeriodsSameSource" type="checkbox"${state.sameSource ? " checked" : ""}>
                    <span>These periods rest on the same source and confidence as the evidence below</span>
                </label>
                <div id="guidedPeriodsProvenance"${state.sameSource ? " hidden" : ""}>
                    ${this.occupancyProvenanceHtml(state.provenance)}
                </div>
            </div>
        `;
    }

    // the gap question and the derived preview, shared by the guided form
    // (prefix "guided") and the periods pane (prefix "pane")
    periodsGapPromptHtml(prefix) {
        return `
                <div id="${prefix}GapPrompt" class="gap-prompt" role="group" aria-label="Gap question" hidden>
                    <p><strong>Was there any spell when no worship happened here</strong> — a closure, a demolition, a rebuild?</p>
                    <div class="button-row">
                        <button type="button" class="secondary" data-gap="yes">Yes — add the later period</button>
                        <button type="button" class="secondary" data-gap="no">No</button>
                        <button type="button" class="secondary" data-gap="unsure">Not sure</button>
                    </div>
                    <div id="${prefix}GapUnsure" class="gap-unsure" hidden>
                        <p>Give what you know; leave the rest blank. Bounds are recorded, never an invented date. For the stop, give the date, or both the earliest and latest it could have been.</p>
                        <div class="field-grid">
                            <label>It stopped in (date)<input id="${prefix}GapStopDate" type="text" inputmode="numeric" maxlength="10" placeholder="2011 or 2011-02"></label>
                            <label>…or between<input id="${prefix}GapStopEarliest" type="text" inputmode="numeric" maxlength="10" placeholder="earliest, e.g. 2011"></label>
                            <label>and<input id="${prefix}GapStopLatest" type="text" inputmode="numeric" maxlength="10" placeholder="latest, e.g. 2012"></label>
                        </div>
                        <div class="field-grid">
                            <label>In use again from (date)<input id="${prefix}GapAgainDate" type="text" inputmode="numeric" maxlength="10" placeholder="2019"></label>
                            <label>…or by<input id="${prefix}GapAgainBy" type="text" inputmode="numeric" maxlength="10" placeholder="2016"></label>
                        </div>
                        <div class="button-row">
                            <button type="button" data-gap="apply">Record as two periods with these bounds</button>
                        </div>
                        <div id="${prefix}GapProblem" class="copy-status copy-status-error" aria-live="polite"></div>
                    </div>
                </div>`;
    }

    periodsPreviewHtml(prefix) {
        return `<div id="${prefix}PeriodsPreview" class="periods-preview" aria-live="polite"></div>`;
    }

    // shows the prompt while the state has one complete card and no answer
    updateGapPrompt(prefix, state) {
        const prompt = document.getElementById(`${prefix}GapPrompt`);
        if (!state || !prompt) return;
        const show = state.segments.length === 1 && !state.gapAnswer && this.guidedPeriodDatesComplete(state.segments[0]);
        prompt.hidden = !show;
        if (!show) {
            const unsure = document.getElementById(`${prefix}GapUnsure`);
            if (unsure) unsure.hidden = true;
        }
    }

    updatePeriodsPreview(prefix, state, observed) {
        const preview = document.getElementById(`${prefix}PeriodsPreview`);
        if (!state || !preview || !window.PowOccupancy) return;
        const incomplete = state.segments.map((segment, index) => (this.guidedPeriodDatesComplete(segment) ? null : index + 1)).filter(Boolean);
        if (!window.PowOccupancy.cardsTouched(state.segments)) {
            preview.textContent = state.loadedFrom ? state.loadedFrom : "";
            preview.classList.remove("periods-preview-conflict");
            return;
        }
        if (incomplete.length) {
            preview.textContent = `Complete period ${incomplete.join(", ")} to preview the census-year states.`;
            preview.classList.remove("periods-preview-conflict");
            return;
        }
        const derived = window.PowOccupancy.derivePresence(state.segments, TARGET_YEARS.map(Number));
        const described = window.PowOccupancy.describePresence(derived, TARGET_YEARS, observed || {});
        preview.textContent = described.conflicts.length
            ? `${described.sentence} Conflict — ${described.conflicts.join("; ")}. Fix one of them before submitting.`
            : `${described.sentence} A reviewer confirms each year.`;
        preview.classList.toggle("periods-preview-conflict", described.conflicts.length > 0);
    }

    // answers the gap question on any state: "yes" adds the later period,
    // "unsure" takes bounds (finding 9: a latest-only stop is refused with a
    // message rather than forged into a between). rerender(focusIndex)
    // repaints the owner's cards
    answerGap(prefix, state, answer, appendPeriod, rerender) {
        if (answer === "yes") {
            state.gapAnswer = "yes";
            appendPeriod();
            rerender(state.segments.length - 1);
            return;
        }
        if (answer === "no") {
            state.gapAnswer = "no";
            this.updateGapPrompt(prefix, state);
            return;
        }
        if (answer === "unsure") {
            const unsure = document.getElementById(`${prefix}GapUnsure`);
            if (unsure) unsure.hidden = false;
            return;
        }
        if (answer === "apply") {
            const value = id => document.getElementById(`${prefix}${id}`)?.value || "";
            const bounds = window.PowOccupancy.gapBounds(
                { date: value("GapStopDate"), earliest: value("GapStopEarliest"), latest: value("GapStopLatest") },
                { date: value("GapAgainDate"), by: value("GapAgainBy") },
            );
            const problem = document.getElementById(`${prefix}GapProblem`);
            if (bounds.problem) {
                if (problem) problem.textContent = bounds.problem;
                return;
            }
            if (problem) problem.textContent = "";
            const first = state.segments[0];
            const wasActive = first.endMode === "still_active";
            const asof = first.stillActiveAsof;
            Object.assign(first, bounds.first);
            const second = appendPeriod(bounds.second);
            if (wasActive) {
                second.endMode = "still_active";
                second.stillActiveAsof = asof;
            }
            const stopWords = value("GapStopDate") || [value("GapStopEarliest"), value("GapStopLatest")].filter(Boolean).join("–") || "an unknown date";
            const againWords = value("GapAgainDate") || (value("GapAgainBy") ? `by ${value("GapAgainBy")}` : "an unknown date");
            state.gapNote = `Gap possible, not established: worship may have stopped ${stopWords} and was in use again ${againWords}; the bounds record what is known.`;
            state.gapAnswer = "unsure";
            rerender(1);
        }
    }

    readGuidedPeriods(taskId) {
        const state = this.guidedPeriodsByTaskId.get(taskId);
        const host = document.getElementById("guidedPeriodsCards");
        if (!state || !host) return;
        host.querySelectorAll(".occupancy-card").forEach(card => {
            const segment = state.segments[Number(card.dataset.index)];
            if (!segment) return;
            card.querySelectorAll("[data-field]").forEach(field => {
                segment[field.dataset.field] = field.type === "checkbox" ? field.checked : field.value;
            });
        });
        state.sameSource = document.getElementById("guidedPeriodsSameSource")?.checked !== false;
        const value = id => document.getElementById(id)?.value || "";
        if (document.getElementById("occConfidence")) {
            state.provenance = {
                confidence: value("occConfidence"),
                confidenceBasis: value("occConfidenceBasis"),
                sourceBasis: value("occSourceBasis"),
                sourceTitle: value("occSourceTitle"),
                sourceReference: value("occSourceReference"),
                sourceAccount: value("occSourceAccount"),
                uncertaintyNote: value("occUncertainty"),
                privacyFlag: value("occPrivacyFlag"),
            };
        }
    }

    // rebuilds only the cards, keeping the rest of the form as typed
    rerenderGuidedPeriods(taskId, { focusIndex } = {}) {
        const state = this.guidedPeriodsState(taskId);
        const host = document.getElementById("guidedPeriodsCards");
        if (!host) return;
        host.innerHTML = state.segments.map((segment, index) => this.occupancyCardHtml(segment, index, state.segments.length)).join("");
        host.querySelectorAll(".occupancy-card").forEach(card => this.updateOccupancyCard(card, state.segments[Number(card.dataset.index)]));
        this.updateGuidedGapPrompt(taskId);
        this.updateGuidedPeriodsPreview(taskId);
        if (Number.isInteger(focusIndex)) {
            const card = host.querySelector(`.occupancy-card[data-index="${focusIndex}"]`);
            card?.scrollIntoView?.({ block: "start", behavior: "smooth" });
            card?.querySelector("select, input")?.focus({ preventScroll: true });
        }
    }

    // a card's dates and bases are complete enough to derive from
    guidedPeriodDatesComplete(segment) {
        const occ = window.PowOccupancy;
        if (!occ) return false;
        const s = occ.normalise(segment);
        const ok = value => occ.isValidPartialDate(value);
        if (s.startMode === "known" && !ok(s.startDate)) return false;
        if (s.startMode === "between" && !(ok(s.startNotEarlierThan) && ok(s.startNotLaterThan))) return false;
        if (s.startMode === "by" && !ok(s.startNotLaterThan)) return false;
        if (s.startMode !== "unknown" && !s.startBasis) return false;
        if (s.endMode === "still_active" && !ok(s.stillActiveAsof)) return false;
        if (s.endMode === "known" && !ok(s.endDate)) return false;
        if (s.endMode === "between" && !(ok(s.endNotEarlierThan) && ok(s.endNotLaterThan))) return false;
        if (s.endMode === "after" && !ok(s.endNotEarlierThan)) return false;
        if (["known", "between", "after"].includes(s.endMode) && !s.endBasis) return false;
        return true;
    }

    updateGuidedGapPrompt(taskId) {
        this.updateGapPrompt("guided", this.guidedPeriodsByTaskId.get(taskId));
    }

    updateGuidedPeriodsPreview(taskId) {
        const observed = Object.fromEntries(TARGET_YEARS.map(year => [year, document.getElementById(`status${year}`)?.value || "not_assessed"]));
        this.updatePeriodsPreview("guided", this.guidedPeriodsByTaskId.get(taskId), observed);
    }

    bindGuidedPeriods(props) {
        const taskId = props?.task_id;
        const block = document.getElementById("guidedPeriods");
        if (!taskId || !block || !window.PowOccupancy) return;
        const state = this.guidedPeriodsState(taskId);
        const sync = event => {
            this.readGuidedPeriods(taskId);
            this.markFormDirty(taskId);
            this.persistGuidedPeriods(taskId);
            const card = event?.target?.closest?.(".occupancy-card");
            if (card) this.updateOccupancyCard(card, state.segments[Number(card.dataset.index)]);
            this.updateGuidedGapPrompt(taskId);
            this.updateGuidedPeriodsPreview(taskId);
        };
        // finding 7: a still-in-use card is anchored to the evidence date
        const sourceDate = document.getElementById("sourceDateInput");
        sourceDate?.addEventListener("input", () => {
            const next = sourceDate.value.trim();
            const changed = window.PowOccupancy.syncStillActive(state.segments, state.referenceDate, next);
            state.referenceDate = next;
            if (changed) {
                this.persistGuidedPeriods(taskId);
                this.rerenderGuidedPeriods(taskId);
            }
        });
        // finding 4: a revision (or any reopened guided form) starts from the
        // periods this ra already recorded for the task, so a resubmission
        // re-records the whole set against the new parent instead of losing it
        if (!window.PowOccupancy.cardsTouched(state.segments) && this.backend?.configured && this.backend.signedIn && !state.loadedFrom) {
            this.loadGuidedPeriodsFromRows(taskId).catch(() => {});
        }
        block.addEventListener("input", sync);
        block.addEventListener("change", event => {
            sync(event);
            const target = event.target;
            if (target?.id === "guidedPeriodsSameSource") {
                const provenance = document.getElementById("guidedPeriodsProvenance");
                if (provenance) provenance.hidden = target.checked;
                return;
            }
            const card = target?.closest?.(".occupancy-card");
            if (!card) return;
            const index = Number(card.dataset.index);
            if (target.dataset?.field === "endReason" && target.value === "relocated" && index === state.segments.length - 1) {
                state.segments.push(this.occupancyBlankSegment({ referenceDate: state.segments[0].stillActiveAsof, referenceDateFromParent: false }, { sameAsPin: false }));
                state.gapAnswer = state.gapAnswer || "yes";
                this.rerenderGuidedPeriods(taskId, { focusIndex: index + 1 });
            }
        });
        // the grid's own selects also feed the conflict check
        TARGET_YEARS.forEach(year => {
            document.getElementById(`status${year}`)?.addEventListener("change", () => this.updateGuidedPeriodsPreview(taskId));
        });
        block.addEventListener("click", event => {
            const gap = event.target?.closest?.("button[data-gap]");
            if (gap) {
                this.readGuidedPeriods(taskId);
                this.answerGap("guided", state, gap.dataset.gap,
                    overrides => this.guidedAppendPeriod(taskId, overrides),
                    focusIndex => {
                        this.markFormDirty(taskId);
                        this.persistGuidedPeriods(taskId);
                        this.rerenderGuidedPeriods(taskId, { focusIndex });
                    });
                return;
            }
            const button = event.target?.closest?.("button[data-action]");
            if (!button) return;
            const card = button.closest(".occupancy-card");
            const index = Number(card?.dataset.index);
            if (!Number.isInteger(index)) return;
            this.readGuidedPeriods(taskId);
            if (button.dataset.action === "place") {
                // the shared pin flow needs a draft to write into; the guided
                // state's segment array is handed over by reference
                this.snapshotFormForTask(taskId);
                this.occupancyDraft = {
                    taskId,
                    context: { inline: true, taskId, referenceDate: state.segments[0].stillActiveAsof || "" },
                    submissionId: "",
                    segments: state.segments,
                    provenance: state.provenance,
                };
                this.enterOccupancyPin(this.occupancyDraft.context, index);
            } else if (button.dataset.action === "remove" && state.segments.length > 1) {
                state.segments.splice(index, 1);
                this.markFormDirty(taskId);
                this.rerenderGuidedPeriods(taskId);
            }
        });
        document.getElementById("guidedAddPeriodButton")?.addEventListener("click", () => {
            this.readGuidedPeriods(taskId);
            this.guidedAppendPeriod(taskId);
            state.gapAnswer = state.gapAnswer || "yes";
            this.markFormDirty(taskId);
            this.rerenderGuidedPeriods(taskId, { focusIndex: state.segments.length - 1 });
        });
        block.querySelectorAll(".occupancy-card").forEach(card => this.updateOccupancyCard(card, state.segments[Number(card.dataset.index)]));
        this.updateGuidedGapPrompt(taskId);
        this.updateGuidedPeriodsPreview(taskId);
    }

    async loadGuidedPeriodsFromRows(taskId) {
        const rows = await this.backend.listTaskOccupancies({ taskId });
        const state = this.guidedPeriodsState(taskId);
        if (!Array.isArray(rows) || rows.length === 0 || window.PowOccupancy.cardsTouched(state.segments)) return;
        const mine = rows.filter(row => row.claim_status === "submitted" && (!this.backendUser?._id || row.created_by === this.backendUser._id));
        if (mine.length === 0) return;
        // the latest parent's set is the active one
        const latestParent = mine.reduce((best, row) => (best === null || row.created_at > best.created_at ? row : best), null).parent_evidence_draft_id;
        const set = mine.filter(row => row.parent_evidence_draft_id === latestParent).sort((a, b) => a.segment_index - b.segment_index);
        state.segments = set.map(row => window.PowOccupancy.segmentFromRow(row));
        state.provenance = window.PowOccupancy.provenanceFromRow(set[0]);
        state.sameSource = false;
        state.gapAnswer = state.segments.length > 1 ? "yes" : "no";
        state.loadedFrom = `Loaded the ${set.length} period${set.length === 1 ? "" : "s"} you recorded earlier for this place; submitting records them again against this evidence and replaces the earlier set.`;
        const sameSource = document.getElementById("guidedPeriodsSameSource");
        if (sameSource) sameSource.checked = false;
        const provenanceBlock = document.getElementById("guidedPeriodsProvenance");
        if (provenanceBlock) {
            provenanceBlock.hidden = false;
            provenanceBlock.innerHTML = this.occupancyProvenanceHtml(state.provenance);
        }
        this.rerenderGuidedPeriods(taskId);
        const preview = document.getElementById("guidedPeriodsPreview");
        if (preview && !preview.textContent) preview.textContent = state.loadedFrom;
    }

    // the newest period is the one still in use; the earlier card needs an end
    guidedAppendPeriod(taskId, overrides = {}) {
        const state = this.guidedPeriodsState(taskId);
        const last = state.segments[state.segments.length - 1];
        const reference = last?.stillActiveAsof || state.referenceDate || this.guidedReferenceDate();
        if (last?.endMode === "still_active") {
            state.segments.push(this.occupancyBlankSegment({ referenceDate: reference, referenceDateFromParent: Boolean(reference) }, { endMode: "still_active", stillActiveAsof: reference, ...overrides }));
            last.endMode = "known";
            last.stillActiveAsof = "";
        } else {
            state.segments.push(this.occupancyBlankSegment({ referenceDate: reference, referenceDateFromParent: false }, { endMode: "known", stillActiveAsof: "", ...overrides }));
        }
        return state.segments[state.segments.length - 1];
    }

    // {provenance, problem}: the guided form's own source and assessment
    // when the ra ticked "same source" (mapped through the contract mirror,
    // finding 6), else the typed block
    guidedPeriodsProvenance(taskId, values) {
        const state = this.guidedPeriodsState(taskId);
        const gapNote = state.gapNote ? ` ${state.gapNote}` : "";
        if (!state.sameSource) {
            return { provenance: { ...state.provenance, uncertaintyNote: `${state.provenance.uncertaintyNote}${gapNote}`.trim() }, problem: "" };
        }
        return window.PowOccupancy.provenanceFromParent(values, state.gapNote);
    }

    // the periods' own validation, run before the parent is submitted so a
    // bad set never leaves half a submission behind (finding 3: an ordinary
    // submission needs a period unless the hand grid, with its reason, or
    // a duplicate claim stands in)
    guidedPeriodsError(taskId, values) {
        if (!window.PowOccupancy) return "";
        this.readGuidedPeriods(taskId);
        const state = this.guidedPeriodsState(taskId);
        const gridAssessed = Object.values(values.targetYearStatuses || {}).some(status => status && status !== "not_assessed");
        const requirement = window.PowOccupancy.periodsRequirement({
            action: values.action,
            touched: this.guidedPeriodsTouched(taskId),
            gridAssessed,
            reason: values.yearGridReason,
        });
        if (requirement) return requirement;
        if (!this.guidedPeriodsTouched(taskId)) return "";
        const read = this.guidedPeriodsProvenance(taskId, values);
        if (read.problem) return `Periods: ${read.problem}`;
        const provenance = read.provenance;
        const segments = state.segments.map((segment, index) => ({ ...segment, ...provenance, segmentIndex: index }));
        const reference = values.sourceDate || "";
        if (!reference) return "Add the source or capture date: the periods are anchored to it.";
        const error = window.PowOccupancy.validateSet(segments, reference, this.occupancyTaskPoint(taskId));
        if (error && state.sameSource && /source|confidence/i.test(error)) {
            return `Periods rest on this evidence's source: ${error.replace(/^Period \d+: /, "").replace(/\.$/, "")} in the source fields below, or untick "same source" and fill the periods' own source block.`;
        }
        if (error) return `Periods: ${error}`;
        const observed = values.targetYearStatuses || {};
        const described = window.PowOccupancy.describePresence(window.PowOccupancy.derivePresence(state.segments, TARGET_YEARS.map(Number)), TARGET_YEARS, observed);
        if (described.conflicts.length) return `Periods: ${described.conflicts[0]}. Fix one of them before submitting.`;
        if (gridAssessed && !(values.yearGridReason || "").trim()) {
            return "Say why the periods cannot express this case, or clear the hand-set census-year statuses.";
        }
        return "";
    }

    // after the parent evidence is submitted: record the periods against it
    async submitGuidedPeriods(props, values, parentEvidenceDraftId) {
        const taskId = props.task_id;
        if (!this.guidedPeriodsTouched(taskId) || !window.PowOccupancy) return null;
        const state = this.guidedPeriodsState(taskId);
        const provenance = this.guidedPeriodsProvenance(taskId, values).provenance;
        const segments = state.segments.map((segment, index) => ({ ...segment, ...provenance, segmentIndex: index }));
        const submissionId = state.submissionId || window.PowRapidEntry.secureSubmissionId();
        state.submissionId = submissionId;
        const context = {
            taskId,
            parentEvidenceDraftId,
            taskName: props.name || "Unnamed site",
            referenceDate: values.sourceDate || window.PowRapidEntry.localIsoDate(),
            referenceDateFromParent: Boolean(values.sourceDate),
            nomination: false,
        };
        try {
            const result = await this.backend.submitOccupancies({
                clientSubmissionId: submissionId,
                taskId,
                parentEvidenceDraftId,
                segments: segments.map(v => window.PowOccupancy.payload(v)),
                clientContext: { portal_version: "occupancy-v1-inline" },
            });
            this.clearGuidedPeriods(taskId);
            this.taskHistoryByTaskId.delete(taskId);
            return { ok: true, result, count: segments.length };
        } catch (error) {
            // the parent stands; the cards reopen in the periods pane so
            // nothing typed is lost, and the pane is marked dirty so leaving
            // it asks first (finding 2)
            this.occupancyDraft = { taskId, context, submissionId, segments: state.segments, provenance, gapAnswer: state.gapAnswer || "no", gapNote: "" };
            this.clearGuidedPeriods(taskId);
            return { ok: false, error, context };
        }
    }

    // mounts the pane; a fresh draft unless restoring after the pin flow
    renderOccupancyEntry(context, options = {}) {
        const panel = document.getElementById("detailPanel");
        if (!panel || !context || !window.PowOccupancy) return;
        const restoring = Boolean(options.restore) && this.occupancyDraft?.taskId === context.taskId;
        if (!restoring) {
            this.occupancyDraft = {
                taskId: context.taskId,
                context,
                submissionId: window.PowRapidEntry.secureSubmissionId(),
                segments: [this.occupancyBlankSegment(context)],
                provenance: this.occupancyBlankProvenance(),
                gapAnswer: "",
                gapNote: "",
            };
        }
        const draft = this.occupancyDraft;
        const paneObserved = () => this.latestDraftForTask(context.taskId)?.target_year_statuses || {};
        const paneRefresh = () => {
            this.updateGapPrompt("pane", draft);
            this.updatePeriodsPreview("pane", draft, paneObserved());
        };
        const paneAppend = overrides => {
            const last = draft.segments[draft.segments.length - 1];
            if (last?.endMode === "still_active") {
                draft.segments.push(this.occupancyBlankSegment(context, { endMode: "still_active", stillActiveAsof: last.stillActiveAsof, ...overrides }));
                last.endMode = "known";
                last.stillActiveAsof = "";
            } else {
                draft.segments.push(this.occupancyBlankSegment(context, { endMode: "known", stillActiveAsof: "", ...overrides }));
            }
            return draft.segments[draft.segments.length - 1];
        };
        panel.innerHTML = this.occupancyEntryHtml(context, draft, options);
        const form = document.getElementById("occupancyForm");
        const dirtyKey = `occupancy-${context.taskId}`;
        const syncFrom = event => {
            this.markFormDirty(dirtyKey);
            this.readOccupancyForm();
            const card = event.target?.closest?.(".occupancy-card");
            if (card) this.updateOccupancyCard(card);
            paneRefresh();
        };
        form?.addEventListener("input", syncFrom);
        form?.addEventListener("change", event => {
            syncFrom(event);
            const target = event.target;
            const card = target?.closest?.(".occupancy-card");
            if (!card) return;
            const index = Number(card.dataset.index);
            // a relocation opens the next card at a new place
            if (target.dataset?.field === "endReason" && target.value === "relocated" && index === draft.segments.length - 1) {
                draft.segments.push(this.occupancyBlankSegment(context, { sameAsPin: false }));
                this.renderOccupancyEntry(context, { restore: true, focusIndex: index + 1, markDirty: true });
            }
        });
        form?.addEventListener("click", event => {
            const gap = event.target?.closest?.("button[data-gap]");
            if (gap) {
                this.readOccupancyForm();
                this.answerGap("pane", draft, gap.dataset.gap, paneAppend, focusIndex => {
                    this.renderOccupancyEntry(context, { restore: true, focusIndex, markDirty: true });
                });
                return;
            }
            const button = event.target?.closest?.("button[data-action]");
            if (!button) return;
            const card = button.closest(".occupancy-card");
            const index = Number(card?.dataset.index);
            if (!Number.isInteger(index)) return;
            this.readOccupancyForm();
            if (button.dataset.action === "place") {
                this.enterOccupancyPin(context, index);
            } else if (button.dataset.action === "remove" && draft.segments.length > 1) {
                draft.segments.splice(index, 1);
                this.renderOccupancyEntry(context, { restore: true, markDirty: true });
            }
        });
        document.getElementById("occupancyAddPeriodButton")?.addEventListener("click", () => {
            this.readOccupancyForm();
            const last = draft.segments[draft.segments.length - 1];
            let statusMessage = "";
            if (last?.endMode === "still_active") {
                // the newest period is the one still in use; the earlier
                // card now needs an end
                draft.segments.push(this.occupancyBlankSegment(context, { endMode: "still_active", stillActiveAsof: last.stillActiveAsof }));
                last.endMode = "known";
                last.stillActiveAsof = "";
                statusMessage = `Period ${draft.segments.length} is now the one still in use; say how period ${draft.segments.length - 1} ended.`;
            } else {
                draft.segments.push(this.occupancyBlankSegment(context, { endMode: "known", stillActiveAsof: "" }));
            }
            draft.gapAnswer = draft.gapAnswer || "yes";
            this.renderOccupancyEntry(context, { restore: true, focusIndex: draft.segments.length - 1, markDirty: true, statusMessage });
        });
        form?.addEventListener("submit", event => {
            event.preventDefault();
            this.submitOccupancies(context);
        });
        document.getElementById("occupancyDoneButton")?.addEventListener("click", () => this.finishOccupancyEntry(context));
        form?.querySelectorAll(".occupancy-card").forEach(card => this.updateOccupancyCard(card));
        paneRefresh();
        if (options.markDirty) this.markFormDirty(dirtyKey);
        if (Number.isInteger(options.focusIndex)) {
            const card = form?.querySelector(`.occupancy-card[data-index="${options.focusIndex}"]`);
            card?.scrollIntoView?.({ block: "start", behavior: "smooth" });
            card?.querySelector("select, input")?.focus({ preventScroll: true });
        } else {
            this.focusDetailPanel();
        }
    }

    // copies every card and the shared provenance block into the draft
    readOccupancyForm() {
        const draft = this.occupancyDraft;
        const form = document.getElementById("occupancyForm");
        if (!draft || !form) return;
        form.querySelectorAll(".occupancy-card").forEach(card => {
            const segment = draft.segments[Number(card.dataset.index)];
            if (!segment) return;
            card.querySelectorAll("[data-field]").forEach(field => {
                segment[field.dataset.field] = field.type === "checkbox" ? field.checked : field.value;
            });
        });
        const value = id => document.getElementById(id)?.value || "";
        draft.provenance = {
            confidence: value("occConfidence"),
            confidenceBasis: value("occConfidenceBasis"),
            sourceBasis: value("occSourceBasis"),
            sourceTitle: value("occSourceTitle"),
            sourceReference: value("occSourceReference"),
            sourceAccount: value("occSourceAccount"),
            uncertaintyNote: value("occUncertainty"),
            privacyFlag: value("occPrivacyFlag"),
        };
    }

    // shows only the fields the chosen modes use and restates the bounds
    // the card will record
    updateOccupancyCard(card, segmentOverride) {
        const segment = segmentOverride || this.occupancyDraft?.segments[Number(card.dataset.index)];
        if (!segment || !window.PowOccupancy) return;
        const startMode = segment.startMode || "known";
        const endMode = segment.endMode || "known";
        const startTokens = new Set([startMode, ...(startMode !== "unknown" ? ["dated"] : [])]);
        const endTokens = new Set([endMode, ...(["known", "between", "after"].includes(endMode) ? ["dated"] : [])]);
        const apply = (block, tokens) => {
            card.querySelectorAll(`[data-block="${block}"] [data-show]`).forEach(element => {
                element.hidden = !element.dataset.show.split(" ").some(token => tokens.has(token));
            });
        };
        apply("start", startTokens);
        apply("end", endTokens);
        const distinct = card.querySelector('[data-role="distinct"]');
        if (distinct) distinct.hidden = segment.sameAsPin !== false;
        const bounds = card.querySelector('[data-role="bounds"]');
        if (bounds) bounds.textContent = window.PowOccupancy.describeBounds(segment);
    }

    // re-arms the pin flow for one card; confirmPinLocation hands the
    // confirmed assertion back through completeOccupancyPin
    enterOccupancyPin(context, index) {
        if (!this.map || !this.occupancyDraft?.segments[index]) return;
        this.readOccupancyForm();
        if (this.pinMode) this.exitPinMode();
        this.occupancyPinContext = { context, index };
        this.enterPinMode();
        if (!this.pinMode) {
            this.occupancyPinContext = null;
            return;
        }
        const point = this.occupancyTaskPoint(context.taskId);
        if (point) {
            const latlng = L.latLng(point.latitude, point.longitude);
            this.map.setView(latlng, Math.max(this.map.getZoom(), 17));
            this.placePin(latlng);
        }
        const status = document.getElementById("pinStatus");
        if (status) {
            status.textContent = `Period ${index + 1}: drag the pin, or click the map, to where the place stood then; choose an area if you only know the vicinity; then confirm. Escape returns to the periods.`;
        }
    }

    completeOccupancyPin() {
        const pin = this.occupancyPinContext;
        const confirmed = this.pinConfirmed;
        const segment = pin ? this.occupancyDraft?.segments[pin.index] : null;
        const status = document.getElementById("pinStatus");
        if (!pin || !confirmed || !segment || !window.PowLocationAssertion) {
            this.exitPinMode();
            return;
        }
        const approximate = confirmed.locationMode === "approximate_area";
        let assertion;
        try {
            assertion = window.PowLocationAssertion.payload({
                mode: confirmed.locationMode,
                basis: approximate ? (confirmed.basis || "address_or_locality") : "map_placement",
                latitude: confirmed.latitude,
                longitude: confirmed.longitude,
                uncertaintyRadiusM: approximate ? confirmed.uncertaintyRadiusM : undefined,
                sourceWording: approximate ? confirmed.sourceWording : "",
                confidence: approximate ? "moderate" : "high",
                contributorConfirmed: true,
            });
        } catch (error) {
            // reopen the confirm card so the ra can fix the assertion
            if (status) status.textContent = error.message || "Could not record this location.";
            this.pinConfirmed = null;
            this.pinMarker?.dragging.enable();
            this._pinZoomHandler = () => this.updatePinConfirmCard();
            this.map.on("zoomend", this._pinZoomHandler);
            ["pinConfirmCard", "pinLocateCard"].forEach(id => {
                const card = document.getElementById(id);
                if (card) card.hidden = false;
            });
            return;
        }
        segment.sameAsPin = false;
        segment.location = assertion;
        segment.locationSummary = this.occupancyLocationSummary(assertion);
        this.occupancyPinContext = null;
        this.exitPinMode();
        if (pin.context.inline) {
            // the card belongs to the guided form: rebuild the task detail,
            // which restores the typed values from the snapshot
            this.occupancyDraft = null;
            this.selectTaskById(pin.context.taskId, { focusDetail: true });
            window.setTimeout(() => {
                document.getElementById("guidedPeriods")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
            }, 0);
            return;
        }
        this.renderOccupancyEntry(pin.context, { restore: true, focusIndex: pin.index, markDirty: true });
    }

    occupancyDoneLabel(context) {
        if (context.fromRecord) return "Done — back to this place";
        return context.nomination ? "Done — nominate another PoW" : "Done — open next task";
    }

    finishOccupancyEntry(context) {
        if (this.formDirty && !window.confirm("Discard these unfinished periods?")) return;
        this.clearFormDirty();
        this.occupancyDraft = null;
        if (context.fromRecord) {
            // the site-card route returns to the record it came from
            this.latestDraftsByTaskId.delete(context.taskId);
            this.selectTaskById(context.taskId, { focusDetail: true });
        } else if (context.nomination) {
            this.enterPinMode();
        } else {
            this.openNextAvailableTask();
        }
    }

    async submitOccupancies(context) {
        const form = document.getElementById("occupancyForm");
        const status = document.getElementById("occupancyStatus");
        const submitButton = document.getElementById("occupancySubmitButton");
        const draft = this.occupancyDraft;
        if (!form || !draft || !window.PowOccupancy) return;
        if (!this.backend?.configured || !this.backend.signedIn) {
            if (status) status.textContent = "Sign in before recording periods.";
            return;
        }
        this.readOccupancyForm();
        // the shared provenance is copied into every period; a gap answered
        // "not sure" adds its note to the uncertainty
        const provenance = draft.gapNote
            ? { ...draft.provenance, uncertaintyNote: `${draft.provenance.uncertaintyNote || ""} ${draft.gapNote}`.trim() }
            : draft.provenance;
        const segments = draft.segments.map((segment, index) => ({ ...segment, ...provenance, segmentIndex: index }));
        const inputError = window.PowOccupancy.validateSet(segments, context.referenceDate, this.occupancyTaskPoint(context.taskId));
        if (inputError) {
            if (status) status.textContent = inputError;
            return;
        }
        submitButton.disabled = true;
        if (status) status.textContent = "Recording these periods for review...";
        try {
            const result = await this.backend.submitOccupancies({
                clientSubmissionId: draft.submissionId,
                taskId: context.taskId,
                parentEvidenceDraftId: context.parentEvidenceDraftId,
                segments: segments.map(values => window.PowOccupancy.payload(values)),
                clientContext: { portal_version: "occupancy-v1" },
            });
            this.clearFormDirty();
            this.taskHistoryByTaskId.delete(context.taskId);
            this.occupancyDraft = null;
            this.renderOccupancyRecorded(context, result, segments.length);
        } catch (error) {
            if (error.authExpired) {
                this.backendUser = null;
                this.backendLastError = error.message;
                this.renderBackendPanel();
            }
            submitButton.disabled = false;
            if (status) status.textContent = `${error.message || "Could not record the periods."} Your entries remain here; try again.`;
        }
    }

    renderOccupancyRecorded(context, result, count) {
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        const years = Array.isArray(result?.derived_years) ? result.derived_years : [];
        const conflicts = Array.isArray(result?.conflict_years) ? result.conflict_years : [];
        const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
        const recorded = result?.deduped
            ? "These periods were already recorded; nothing was duplicated."
            : `Recorded ${plural(count, "period")}; ${plural(years.length, "census-year proposal")}${years.length ? ` (${years.join(", ")})` : ""} await${years.length === 1 ? "s" : ""} reviewer confirmation.`;
        panel.innerHTML = `
            <h2>Periods recorded</h2>
            <div class="copy-status" role="status">${escapeHtml(recorded)}</div>
            ${conflicts.length ? `<div class="pilot-note" role="note">${escapeHtml(`${plural(conflicts.length, "year")} (${conflicts.join(", ")}) conflict${conflicts.length === 1 ? "s" : ""} with the observed status; a reviewer must settle ${conflicts.length === 1 ? "it" : "them"}.`)}</div>` : ""}
            <div class="button-row">
                <button id="occupancyDoneButton" type="button">${this.occupancyDoneLabel(context)}</button>
                <button id="occupancyHistoryButton" class="secondary" type="button">Add known history</button>
            </div>
        `;
        document.getElementById("occupancyDoneButton")?.addEventListener("click", () => this.finishOccupancyEntry(context));
        document.getElementById("occupancyHistoryButton")?.addEventListener("click", () => this.renderHistoricalClaimEntry(context));
        this.focusDetailPanel();
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
        const canAddHistory = taskId ? this.taskCanAddHistory(taskId) : false;
        if (this.taskUsesRapidForm(props) && !readOnly) {
            // the rapid form must not render (and accept a submission) while
            // the latest draft is still loading: a nomination that already
            // holds guided evidence belongs on the guided form
            if (
                !RAPID_ASSIGNED_ENTRY
                && taskId
                && this.backend?.signedIn
                && this.backendTasksById.has(taskId)
                && !this.latestDraftsByTaskId.has(taskId)
            ) {
                return `<div class="copy-status">Loading the recorded evidence...</div>`;
            }
            return this.rapidCurrentReviewFormHtml(props);
        }
        if (this.taskUsesRapidForm(props) && readOnly) {
            const latest = this.latestDraftForTask(taskId);
            const draftLoaded = this.latestDraftsByTaskId.has(taskId);
            // a guided (detailed) submission keeps its own revision route; the
            // generic form below handles it, but a rapid record never enters
            // the generic revise path because the server refuses to clone it
            if (!draftLoaded || !latest || latest.observation_contract_version === "rapid_current_v1") {
                return this.rapidReadOnlyHtml(props, latest, draftLoaded);
            }
        }
        // collapsed optional blocks open when the saved draft or a pending
        // unsaved snapshot already carries values for them
        const prefill = this.formSnapshotsByTaskId.get(taskId) || this.latestDraftForTask(taskId) || {};
        const addressOpen = Boolean(prefill.address_raw || prefill.locality_raw || prefill.address_change_note);
        const lifecycleOpen = Boolean(prefill.lifecycle_event || prefill.lifecycle_date || prefill.lifecycle_note);
        const relatedOpen = Boolean(prefill.related_ids_or_note);
        // pr-e: the grid opens only when a saved draft already assessed a year
        const gridOpen = Object.values(prefill.target_year_statuses || {}).some(status => status && status !== "not_assessed");
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
                ${this.guidedPeriodsHtml(taskId)}
                <details class="skip-form optional-block" id="yearGridDetails"${gridOpen ? " open" : ""}>
                    <summary>Set census-year statuses by hand (only if the periods cannot express the case)</summary>
                    ${targetYearStatusControlsHtml()}
                    <label>
                        Why the periods cannot express this case
                        <input id="yearGridReason" type="text" maxlength="500" placeholder="e.g. worship continued in a hall with no fixed site">
                    </label>
                </details>
                <div class="field-grid">
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
                    Source title <span class="req-chip">required to submit</span>
                    <input id="sourceTitleInput" type="text" placeholder="e.g. Anglican Diocese of Wellington directory 2018, Google Street View imagery">
                </label>
                <label>
                    Source date or imagery capture date <span class="req-chip">required for a field observation</span>
                    <input id="sourceDateInput" type="text" placeholder="e.g. 2018-09, 2023, or 2026-05-03 for a field visit">
                </label>
                <div class="copy-help">
                    The date belongs to the source, not to today. If the source gives no date, leave this blank and say so in “What did you directly observe or read in the source?” below.
                </div>
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
                <fieldset>
                    <legend>Denomination or tradition evidence</legend>
                    <div class="copy-help">
                        Starting source wording: <strong>${escapeHtml(props.source_denomination_label || props.denomination || "none recorded")}</strong>. Starting project taxonomy code: <strong>${escapeHtml(props.denomination_code || "none recorded")}</strong>. Preserve the exact wording you found; this proposal will not silently replace either starting value or enter the master database.
                    </div>
                    <label>
                        Exact label observed or reported (optional)
                        <input id="denominationRawInput" type="text" placeholder="Copy the wording exactly, including local language">
                    </label>
                    <label>
                        Who supplied this label?
                        <select id="denominationLabelBasisSelect">
                            ${selectOptionsHtml(DENOMINATION_LABEL_BASIS_OPTIONS, "unknown")}
                        </select>
                    </label>
                    <label>
                        How does it relate to the project record?
                        <select id="denominationRelationSelect">
                            ${selectOptionsHtml(DENOMINATION_RELATION_OPTIONS, "uncertain")}
                        </select>
                    </label>
                </fieldset>
                <label>
                    What did you directly observe or read in the source? <span class="req-chip">required to submit</span>
                    <textarea id="decisionNote" data-question-id="direct_observation_v1" rows="3" maxlength="2000" placeholder="Record the direct observation. Copy names, denomination wording, dates, or notices exactly where relevant."></textarea>
                </label>
                <div class="copy-help" id="legacyNoteUpgradeHelp" hidden>
                    This draft contains an older generic evidence note. It remains a legacy note unless you review and rewrite this field as a direct observation; adding the new guided fields also requires that review.
                </div>
                <label>
                    What might this observation support? (optional)
                    <textarea id="interpretationNote" data-question-id="interpretation_v1" rows="2" maxlength="1000" placeholder="Keep your interpretation separate from what you directly observed."></textarea>
                </label>
                <label>
                    What remains uncertain or needs follow-up? (optional)
                    <textarea id="uncertaintyNote" data-question-id="uncertainty_v1" rows="2" maxlength="2000" placeholder="Record what this evidence cannot establish or what another source should check."></textarea>
                </label>
                <label>
                    Sensitivity and privacy
                    <select id="privacyFlagSelect">
                        ${selectOptionsHtml(PRIVACY_FLAG_OPTIONS, COUNTRY_CONFIG.countryCode === "VU" ? "needs_review" : "clear")}
                    </select>
                </label>
                <div class="copy-help">
                    Mark review or restricted if the account could identify a person or a restricted place; such evidence is withheld from external AI services.
                </div>
                <h3>4. Save or submit</h3>
                ${this.backend?.configured && this.backendUser ? `
                    ${readOnly
                        ? `<div class="copy-help">This saved work is visible for reference. Revisions create a new evidence version; they do not rewrite the submitted record.</div>`
                        : revisionMode
                            ? `<div class="copy-help">Save a revision draft while working. Submit the revision when the corrected or extended evidence is ready for review.</div>`
                            : ""}
                    <div id="guidedAttachmentsBlock" class="attachments-block" hidden></div>
                    ${readOnly ? `
                        ${canRevise ? `
                            <div class="button-row">
                                ${canAddHistory ? `<button id="addKnownHistoryFromRecordedButton" type="button">Add known history</button>` : ""}
                                ${canAddHistory && this.taskCanAddOccupancy(taskId) ? `<button id="addOccupancyFromRecordedButton" class="secondary" type="button">Add where and when</button>` : ""}
                                <button id="reviseSubmissionButton"${canAddHistory ? ` class="secondary"` : ""} type="button">Revise submission</button>
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
                        <strong>Fallback:</strong> Copies one tab-separated row to your clipboard. Nothing is uploaded.
                        <details><summary>How to paste</summary>Switch to the working evidence spreadsheet, click column A in the next empty row under the unchanged header, and paste with <kbd>Cmd</kbd>+<kbd>V</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>V</kbd> (Windows).</details>
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
            </div>
        `;
    }

    // skip sits after the issue form in the panel: report a problem with the
    // place first, give up on the task last
    taskSkipControlHtml(props) {
        const taskId = props?.task_id || "";
        if (!INTAKE_ENABLED) return "";
        if (this.taskUsesRapidForm(props)) return "";
        if (!ASSIGNMENT_MODE) return this.skipFormHtml();
        const assignmentTaskAvailable = this.backend?.configured
            && this.backendUser
            && this.backendTasksById.has(taskId);
        const readOnly = taskId ? this.taskIsReadOnly(taskId) : false;
        const revisionMode = taskId ? this.taskIsRevisionMode(taskId) : false;
        return assignmentTaskAvailable && !readOnly && !revisionMode ? this.skipFormHtml() : "";
    }

    bindRaActionForm(props) {
        document.getElementById("correctObservationButton")?.addEventListener("click", () => this.startRapidCorrection(props));
        document.getElementById("withdrawDraftButton")?.addEventListener("click", () => this.withdrawRapidDraft(props));
        document.getElementById("addKnownHistoryFromRecordedButton")?.addEventListener("click", () => {
            const draft = this.latestDraftForTask(props.task_id);
            if (!draft) return;
            this.renderHistoricalClaimEntry(this.historicalClaimContext(props, draft));
        });
        document.getElementById("addOccupancyFromRecordedButton")?.addEventListener("click", () => this.openOccupancyFromRecord(props));
        if (document.getElementById("taskRapidCurrentForm")) {
            // a correction renders with the previous draft prefilled; pass that
            // prefill through so the device-draft restore cannot overwrite it
            const previousDraft = this.rapidCorrectionTaskIds.has(props?.task_id)
                ? this.latestDraftForTask(props.task_id)
                : null;
            this.bindRapidObservationForm("task", { props, prefill: previousDraft });
            document.getElementById("taskFormCancelButton")?.addEventListener("click", () => this.cancelRapidCorrection(props));
            // the rapid form renders its own attachments block; initialise it
            // here so photos can be added before submitting, as on the guided form
            this.initAttachmentsBlock(props, document.getElementById("taskAttachmentsBlock"));
            return;
        }
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
            // a duplicate claim needs its counterpart on record, so the
            // related-ids block opens the moment the action names one
            if (actionSelect.value === "possible_duplicate") {
                const related = document.getElementById("relatedIdsBlockDetails");
                if (related) related.open = true;
            }
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

        this.bindGuidedPeriods(props);

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
            "denominationRawInput",
            "denominationLabelBasisSelect",
            "denominationRelationSelect",
            "interpretationNote",
            "uncertaintyNote",
            "privacyFlagSelect",
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
            document.getElementById(`confidence${year}`)?.addEventListener("change", () => {
                markDirty();
            });
        });

        document.getElementById("copyEvidenceRowButton")?.addEventListener("click", () => this.copyEvidenceRow(props));
        document.getElementById("copyDecisionButton")?.addEventListener("click", () => this.copyDecision(props));
        this.initAttachmentsBlock(props, document.getElementById("guidedAttachmentsBlock"));
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
        // pr-e: the hand grid's reason, and the grid opens when a saved
        // draft assessed a year by hand
        setValue("yearGridReason", draft.target_year_entry_reason, false);
        const gridDetails = document.getElementById("yearGridDetails");
        if (gridDetails && (draft.target_year_entry_reason || Object.values(draft.target_year_statuses || {}).some(status => status && status !== "not_assessed"))) {
            gridDetails.open = true;
        }
        // pr-e: period cards saved with the draft come back with it, unless
        // the ra has already typed new ones here
        if (Array.isArray(draft.pending_occupancy_cards) && draft.pending_occupancy_cards.length && this.currentTaskIdForForm()) {
            const taskId = this.currentTaskIdForForm();
            const state = this.guidedPeriodsState(taskId);
            if (!window.PowOccupancy?.cardsTouched(state.segments)) {
                this.adoptGuidedPeriods(taskId, draft.pending_occupancy_cards, draft.pending_occupancy_provenance || null, draft.target_year_entry_reason);
                this.rerenderGuidedPeriods(taskId);
            }
        }
        TARGET_YEARS.forEach(year => {
            setValue(`status${year}`, draft.target_year_statuses?.[year], false);
            setValue(`confidence${year}`, draft.target_year_confidence?.[year], false);
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
        setValue("denominationRawInput", draft.denomination_or_tradition_raw, false);
        setValue("denominationLabelBasisSelect", draft.denomination_label_basis);
        setValue("denominationRelationSelect", draft.denomination_relation);
        setValue("decisionNote", draft.evidence_note, true);
        const note = document.getElementById("decisionNote");
        if (note) {
            note.dataset.loadedObservationContract = draft.observation_contract_version || (draft.evidence_note ? "legacy" : "guided_observation_v1");
            note.dataset.loadedEvidenceNote = draft.evidence_note || "";
        }
        const legacyHelp = document.getElementById("legacyNoteUpgradeHelp");
        if (legacyHelp) legacyHelp.hidden = note?.dataset.loadedObservationContract !== "legacy";
        setValue("interpretationNote", draft.interpretation_note, false);
        setValue("uncertaintyNote", draft.uncertainty_note, false);
        setValue("privacyFlagSelect", draft.privacy_flag);
        // the form now mirrors a known baseline; snapshot reapply re-marks
        // it dirty afterwards because those values are still unsaved
        this.clearFormDirty();
        this.updateWorkflowSteps();
    }

    applyRaActionDefaults(props) {
        const action = document.getElementById("raActionSelect")?.value || "needs_review";
        // pr-e (ruling r-e1): census-year states come from the periods; the
        // action prefills the hand grid only while the ra has it open, but
        // the current-observation defaults still follow the action's
        // implied statuses whether or not the grid is visible
        const impliedStatuses = statusDefaultsForAction(action, this.targetYear, props);
        if (document.getElementById("yearGridDetails")?.open) {
            TARGET_YEARS.forEach(year => {
                const select = document.getElementById(`status${year}`);
                if (select) select.value = impliedStatuses[year] || "not_assessed";
            });
        }

        // Only suggest a note if the RA has not typed anything. Touching the
        // textarea sets dataset.touched and locks it from auto-rewrite, so
        // RA-typed text is never silently overwritten by action changes.
        const note = document.getElementById("decisionNote");
        if (note && note.dataset.touched !== "1" && !note.value.trim()) {
            note.placeholder = reviewNoteForAction(action);
        }

        this.applyControlledAssessmentDefaults(document.getElementById("yearGridDetails")?.open ? undefined : impliedStatuses);
    }

    // statusesOverride: the action's implied statuses when the hand grid is
    // closed (pr-e), else the grid's own values
    applyControlledAssessmentDefaults(statusesOverride) {
        const action = document.getElementById("raActionSelect")?.value || "needs_review";
        const statuses = statusesOverride || Object.fromEntries(TARGET_YEARS.map(year => [
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
        // per-year confidence rides beside each assessed status; unset
        // years are simply omitted from the map
        const targetYearConfidence = Object.fromEntries(TARGET_YEARS
            .map(year => [year, document.getElementById(`confidence${year}`)?.value || ""])
            .filter(([, confidence]) => confidence));
        const action = document.getElementById("raActionSelect")?.value || "needs_review";
        const rawWorshipUseStatus = document.getElementById("worshipUseStatusSelect")?.value || "uncertain";
        const noBuilding = action === "no_building_present" || rawWorshipUseStatus === "no_building_present";
        return {
            action,
            targetYearStatuses,
            targetYearConfidence,
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
            denominationRaw: document.getElementById("denominationRawInput")?.value || "",
            denominationLabelBasis: document.getElementById("denominationLabelBasisSelect")?.value || "unknown",
            denominationRelation: document.getElementById("denominationRelationSelect")?.value || "uncertain",
            note: document.getElementById("decisionNote")?.value || "",
            yearGridReason: document.getElementById("yearGridReason")?.value || "",
            interpretationNote: document.getElementById("interpretationNote")?.value || "",
            uncertaintyNote: document.getElementById("uncertaintyNote")?.value || "",
            privacyFlag: document.getElementById("privacyFlagSelect")?.value || (COUNTRY_CONFIG.countryCode === "VU" ? "needs_review" : "clear"),
        };
    }

    evidenceInputError(values, options = {}) {
        const unresolved = Boolean(options.unresolved);
        const submit = !unresolved && options.submit !== false;
        if (!submit && !unresolved) return "";
        const hasNewGuidedContent = values.denominationRaw.trim()
            || values.denominationLabelBasis !== "unknown"
            || values.denominationRelation !== "uncertain"
            || values.interpretationNote.trim()
            || values.uncertaintyNote.trim();
        if (!this.observationContractVersionFor(values) && hasNewGuidedContent) {
            return "Review and rewrite the legacy evidence note as a direct observation before adding the new guided fields.";
        }
        for (const [year, confidence] of Object.entries(values.targetYearConfidence || {})) {
            if (confidence && (values.targetYearStatuses[year] || "not_assessed") === "not_assessed") {
                return `Set the ${year} status, or clear its confidence: confidence describes an assessed year.`;
            }
        }
        if (unresolved) {
            if (values.sourceTitle.trim() && isPlaceholderText(values.sourceTitle)) {
                return "Do not use NA or N/A as a source title. Add the actual source title, or leave it blank and explain what you checked in “What did you directly observe or read in the source?”.";
            }
            if (`${values.note} ${values.uncertaintyNote}`.trim().length < 12) {
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
            if (values.sourceType === "field_observation") {
                const observationYear = values.sourceDate.slice(0, 4);
                const unsupportedYears = Object.entries(values.targetYearStatuses)
                    .filter(([, status]) => status !== "not_assessed")
                    .map(([year]) => year)
                    .filter(year => year !== observationYear);
                if (unsupportedYears.length) {
                    return `A field observation supports its observation year only. Mark ${unsupportedYears.join(", ")} not assessed, or add a separate historical source.`;
                }
            }
            return "";
        }
        if (!values.sourceTitle.trim()) return "Add a source title.";
        if (isPlaceholderText(values.sourceTitle)) {
            return "Do not use NA or N/A as a source title. Add the actual source title, or save a draft until you have it.";
        }
        if (values.note.trim().length < 5) return "Add a short evidence note.";
        if (values.denominationLabelBasis !== "unknown" && !values.denominationRaw.trim()) {
            return "Copy the exact denomination or tradition label, or choose unknown when the wording is not available.";
        }
        if (values.denominationRelation !== "uncertain" && !values.denominationRaw.trim()) {
            return "Copy the exact denomination or tradition label before describing how it relates to the project record.";
        }
        if (values.action === "denomination_or_shared_use" && !values.denominationRaw.trim() && !values.uncertaintyNote.trim()) {
            return "Add the exact denomination or tradition label, or explain what remains uncertain.";
        }
        if (values.action === "possible_duplicate" && !values.relatedIds.trim()) {
            return "Name the duplicate: put the other record's id or a short note in “Related ids or duplicate note”.";
        }
        if (values.denominationRelation === "record_correction" && values.changeClass === "genuine_change") {
            return "Choose map correction or can't tell yet: a denomination record correction is not a genuine change.";
        }
        if (values.denominationRelation === "historical_change" && values.changeClass === "map_correction") {
            return "Choose genuine change or can't tell yet: a possible historical denomination change is not a map correction.";
        }
        if (
            hasNewGuidedContent
            && ["label_only", "shared_or_concurrent_use", "uncertain"].includes(values.denominationRelation)
            && values.changeClass !== "uncertain"
        ) {
            return "Choose can't tell yet for change class: this denomination relation is provisional rather than a classified change.";
        }
        if (values.sourceDate.trim() && !isValidPartialDateText(values.sourceDate)) {
            return "Use YYYY, YYYY-MM, or YYYY-MM-DD for source and capture dates. If the date is unknown, leave it blank and explain in “What did you directly observe or read in the source?”.";
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
        if (values.sourceType === "field_observation") {
            const observationYear = values.sourceDate.slice(0, 4);
            const unsupportedYears = Object.entries(values.targetYearStatuses)
                .filter(([, status]) => status !== "not_assessed")
                .map(([year]) => year)
                .filter(year => year !== observationYear);
            if (unsupportedYears.length) {
                return `A field observation supports its observation year only. Mark ${unsupportedYears.join(", ")} not assessed, or add a separate historical source.`;
            }
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
        row.denomination_or_tradition_raw = values.denominationRaw.trim();
        row.site_type = normaliseSiteType(props.site_type || props.name || "");
        row.address_raw = addressRaw;
        row.modern_address_candidate = addressRaw;
        row.address_standardised = addressRaw;
        row.locality_raw = localityRaw;
        row.address_change_note = values.addressNote
            || (values.addressRaw.trim() || values.localityRaw.trim() ? "RA supplied source-backed address or locality." : "");
        // an approximate-area nomination must not export as an exact,
        // manually matched point: carry the honest basis and radius
        const wideAssertion = props.initial_location_assertion
            || this.backendTasksById.get(props.task_id)?.initial_location_assertion;
        const wideApproximate = wideAssertion?.mode === "approximate_area"
            && Number.isFinite(wideAssertion.uncertainty_radius_m);
        row.geocoding_basis = isMissing
            ? (wideApproximate
                ? (wideAssertion.uncertainty_radius_m > 2000 ? "regional_only" : "described_locality")
                : "manual_match")
            : values.addressRaw.trim() || values.localityRaw.trim()
                ? "source_address"
                : "existing_osm_site";
        row.geocoding_confidence = values.geocodingConfidence;
        if (wideApproximate) {
            row.source_notes += ` Location is an approximate-area centre with an uncertainty radius of ${wideAssertion.uncertainty_radius_m} m${wideAssertion.source_wording ? `; source wording: ${wideAssertion.source_wording}` : ""}.`;
        }
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
        row.privacy_flag = values.privacyFlag;
        row.licence_flag = "needs_review";
        row.retrieved_by = raInitials || "ra";
        row.extracted_by = raInitials || "ra";
        row.extracted_at = nowIso();
        row.review_note = [
            reviewNoteForAction(values.action),
            values.denominationRaw ? `Denomination label (${values.denominationLabelBasis}; ${values.denominationRelation}): ${values.denominationRaw}.` : "",
            values.interpretationNote ? `Interpretation: ${values.interpretationNote}` : "",
            values.uncertaintyNote ? `Uncertainty or follow-up: ${values.uncertaintyNote}` : "",
            values.relatedIds ? `Related ids: ${values.relatedIds}.` : "",
        ].filter(Boolean).join(" ").trim();

        return row;
    }

    observationContractVersionFor(values) {
        const note = document.getElementById("decisionNote");
        const loadedLegacy = note?.dataset.loadedObservationContract === "legacy";
        const legacyNoteUnchanged = loadedLegacy && values.note === (note?.dataset.loadedEvidenceNote || "");
        return legacyNoteUnchanged ? undefined : "guided_observation_v1";
    }

    buildEvidenceDraft(props, row, options = {}) {
        const values = this.currentFormValues();
        const observationContractVersion = this.observationContractVersionFor(values);
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
            observation_contract_version: observationContractVersion,
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
            // always sent, so clearing every confidence select overwrites a
            // previously stored map instead of leaving it behind on the draft
            target_year_confidence: values.targetYearConfidence || {},
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
            denomination_or_tradition_raw: values.denominationRaw,
            denomination_label_basis: values.denominationLabelBasis,
            denomination_relation: values.denominationRelation,
            evidence_note: values.note,
            interpretation_note: values.interpretationNote,
            uncertainty_note: values.uncertaintyNote,
            generated_wide_row: {
                fields: WIDE_EVIDENCE_FIELDS,
                row,
                tsv: tsvRowFromObject(row),
                guided_evidence: observationContractVersion ? {
                    direct_observation: values.note,
                    interpretation: values.interpretationNote,
                    uncertainty_or_follow_up: values.uncertaintyNote,
                    denomination_or_tradition_raw: values.denominationRaw,
                    denomination_label_basis: values.denominationLabelBasis,
                    denomination_relation: values.denominationRelation,
                } : undefined,
            },
            privacy_flag: values.privacyFlag,
            licence_flag: "needs_review",
            validation_summary: {
                status: unresolved ? "unresolved_note" : submitError ? "draft_needs_more_detail" : "client_checked",
                checked_at: nowIso(),
                messages: validationMessages,
            },
        };
    }

    // --- evidence attachments: photo/document citations on the task.
    // review-tier by ruling (2026-08-31): visible only through the signed-in
    // portal; every view uses a fresh short-lived url minted by the backend

    async initAttachmentsBlock(props, block, { prominent = false } = {}) {
        if (!block || !this.backend?.configured || !this.backendUser) return;
        if (prominent) {
            // show the step immediately rather than popping in after the
            // enablement round-trip; collapse again only if storage is off
            block.hidden = false;
            block.textContent = "Checking attachment storage...";
        }
        if (this.attachmentsEnabledCache === undefined) {
            try {
                this.attachmentsEnabledCache = await this.backend.attachmentsEnabled();
            } catch (error) {
                this.attachmentsEnabledCache = false;
            }
        }
        if (!this.attachmentsEnabledCache) {
            block.hidden = true;
            block.textContent = "";
            return;
        }
        block.hidden = false;
        block.innerHTML = `
            ${prominent
                ? `<h3>Step 2 of 2 — attach photos &amp; documents</h3>`
                : `<strong>Photos &amp; documents (optional)</strong>`}
            <div class="copy-help">JPEG, PNG, WebP or PDF, under 10&nbsp;MB each. Choose several at once if useful. Review-only — never public.</div>
            <input class="attachment-file-input" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf">
            <input class="attachment-caption-input" type="text" maxlength="500" placeholder="Caption — what do these show? (optional)">
            <div class="button-row">
                <button class="attachment-upload-button secondary" type="button">Add file(s)</button>
            </div>
            <div class="attachment-status copy-status"></div>
            <div class="attachment-list"></div>
        `;
        block.querySelector(".attachment-upload-button")?.addEventListener("click", () => this.uploadAttachment(props.task_id, block));
        this.refreshAttachmentList(props.task_id, block);
    }

    async refreshAttachmentList(taskId, block) {
        const list = block?.querySelector(".attachment-list");
        if (!list) return;
        let rows = [];
        try {
            rows = await this.backend.listTaskAttachments({ taskId });
        } catch (error) {
            list.textContent = "";
            return;
        }
        if (!rows.length) {
            list.textContent = "";
            return;
        }
        list.innerHTML = rows.map(row => {
            const sizeKb = Math.max(1, Math.round(row.byte_size / 1024));
            const kind = row.content_type === "application/pdf" ? "PDF" : "Photo";
            return `
                <div class="attachment-row" data-attachment-id="${escapeHtml(row.attachment_id)}">
                    <span class="attachment-label">${kind} · ${sizeKb} KB${row.caption ? ` — ${escapeHtml(row.caption)}` : ""}</span>
                    <span class="attachment-actions">
                        <button type="button" class="secondary attachment-view">View</button>
                        ${row.author_is_me ? `<button type="button" class="secondary attachment-remove">Remove</button>` : ""}
                    </span>
                </div>
            `;
        }).join("");
        list.querySelectorAll(".attachment-row").forEach(rowEl => {
            const attachmentId = rowEl.dataset.attachmentId;
            rowEl.querySelector(".attachment-view")?.addEventListener("click", async () => {
                try {
                    const grant = await this.backend.requestAttachmentView({ attachmentId });
                    window.open(grant.view_url, "_blank", "noopener");
                } catch (error) {
                    const status = block.querySelector(".attachment-status");
                    if (status) status.textContent = error.message || "Could not open the file.";
                }
            });
            rowEl.querySelector(".attachment-remove")?.addEventListener("click", async () => {
                try {
                    await this.backend.removeAttachment({ attachmentId });
                    this.refreshAttachmentList(taskId, block);
                } catch (error) {
                    const status = block.querySelector(".attachment-status");
                    if (status) status.textContent = error.message || "Could not remove the file.";
                }
            });
        });
    }

    async uploadAttachment(taskId, block) {
        const input = block?.querySelector(".attachment-file-input");
        const status = block?.querySelector(".attachment-status");
        const button = block?.querySelector(".attachment-upload-button");
        const files = [...(input?.files || [])];
        if (!files.length) {
            if (status) status.textContent = "Choose a file first.";
            return;
        }
        const caption = (block?.querySelector(".attachment-caption-input")?.value || "").trim();
        if (button) button.disabled = true;
        this.attachmentUploadInFlight = true;
        let added = 0;
        try {
            for (const file of files) {
                if (status) {
                    status.textContent = files.length > 1
                        ? `Uploading ${file.name} (${added + 1} of ${files.length})...`
                        : "Uploading...";
                }
                const grant = await this.backend.requestAttachmentUpload({
                    taskId,
                    contentType: file.type,
                    byteSize: file.size,
                    caption: caption || undefined,
                });
                const put = await fetch(grant.upload_url, { method: "PUT", body: file });
                if (!put.ok) throw new Error(`Upload of ${file.name} failed (${put.status}). Try again.`);
                await this.backend.confirmAttachmentUpload({ attachmentId: grant.attachment_id });
                added += 1;
            }
            if (status) status.textContent = added === 1 ? "File added." : `${added} files added.`;
            if (input) input.value = "";
            const captionInput = block?.querySelector(".attachment-caption-input");
            if (captionInput) captionInput.value = "";
        } catch (error) {
            const base = error.message || "Upload failed.";
            if (status) status.textContent = added > 0 ? `${base} ${added} file(s) were added before the failure.` : base;
        } finally {
            this.attachmentUploadInFlight = false;
            // a successful upload settles the promised-files reminder
            if (added > 0 && this.pendingEvidenceAttachTaskId === taskId) {
                this.pendingEvidenceAttachTaskId = null;
            }
            if (button) button.disabled = false;
            this.refreshAttachmentList(taskId, block);
        }
    }

    async saveEvidenceToBackend(props, options = {}) {
        const status = document.getElementById("copyStatus");
        const values = this.currentFormValues();
        const unresolved = Boolean(options.unresolved);
        const submit = Boolean(options.submit);
        const inputError = this.evidenceInputError(values, unresolved ? { unresolved: true } : { submit })
            || (submit && !unresolved ? this.guidedPeriodsError(props.task_id, values) : "");
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
                // pr-e: the periods typed in the form follow the parent
                const periods = submit && !unresolved ? await this.submitGuidedPeriods(props, values, saved.evidence_draft_id) : null;
                if (periods && !periods.ok) {
                    this.selectedTask = null;
                    this.applyFilters();
                    this.renderOccupancyEntry(periods.context, {
                        restore: true,
                        markDirty: true,
                        statusMessage: `Your evidence was submitted, but the periods were not recorded: ${periods.error?.message || "unknown error"}. They are loaded here; try again.`,
                    });
                    if (periods.error?.authExpired) {
                        this.backendUser = null;
                        this.backendLastError = periods.error.message;
                        this.renderBackendPanel();
                    }
                    return;
                }
                // a recorded submission closes the task for this ra: mirror
                // the review portal's return-to-list by clearing the
                // selection, re-rendering the queue, and replacing the detail
                // pane with a confirmation. drafts stay open below so the ra
                // can keep editing.
                this.selectedTask = null;
                this.applyFilters();
                this.renderSubmissionRecordedDetail(props, {
                    unresolved,
                    periodsRecorded: periods?.ok ? periods : null,
                    knownHistory: HISTORICAL_CLAIM_ENTRY ? {
                        taskId: props.task_id,
                        parentEvidenceDraftId: saved.evidence_draft_id,
                        taskName: props.name || "Unnamed site",
                        referenceDate: values.sourceDate || window.PowRapidEntry.localIsoDate(),
                        referenceDateFromParent: Boolean(values.sourceDate),
                        nomination: false,
                    } : null,
                });
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
            observation_contract_version: this.observationContractVersionFor(values),
            master_snapshot_id: props.master_snapshot_id,
            master_site_id: props.master_site_id,
            osm_id: props.osm_id,
            selected_target_year: this.targetYear,
            action: values.action,
            action_label: actionLabelForRa(values.action),
            target_year_statuses: values.targetYearStatuses,
            target_year_confidence: values.targetYearConfidence,
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
            denomination_or_tradition_raw: values.denominationRaw,
            denomination_label_basis: values.denominationLabelBasis,
            denomination_relation: values.denominationRelation,
            evidence_note: values.note,
            interpretation_note: values.interpretationNote,
            uncertainty_note: values.uncertaintyNote,
            target_year_entry_reason: values.yearGridReason || undefined,
            pending_occupancy_cards: this.guidedPeriodsSnapshot(props.task_id),
            privacy_flag: values.privacyFlag,
            source: COUNTRY_CONFIG.mapSource,
            saved_or_submitted: false,
        };
    }

    // pin-drop nomination: the assignment-mode refit of the nomination
    // panel. ordinary nominations preserve either a confirmed building point
    // or an approximate area; rapid Vanuatu nominations retain their stricter
    // building-level contract
    // through tasks:createManualCandidateTask and land in its detail panel
    // assignment-mode nomination panel: a single one-line helper. the
    // actionable entry point is the header "Add a place" button; the
    // transient cards render into #pinCardHost when pin mode is armed
    pinNominationHtml() {
        if (RAPID_NOMINATION_ENTRY) {
            return `
                <div class="copy-help">
                    Record a place by confirming its building location and what you can establish about its current worship use. Each observation is time-stamped and sent to human review; it does not update the public map directly.
                </div>
            `;
        }
        return "";
    }

    // the transient pin-drop cards, rendered into #pinCardHost while pin
    // mode is active (kept here, near the map, rather than buried in the
    // nomination panel). ids are unchanged so all pin logic still binds
    pinCardsHtml() {
        const formFields = RAPID_NOMINATION_ENTRY
            ? this.rapidObservationFieldsHtml("pin", {
                submitLabel: "Save and add another",
                submissionId: this.pinSubmissionId,
                showCancel: true,
                attachmentsHint: true,
            })
            : `
                <fieldset>
                    <legend>Location evidence</legend>
                    <label>
                        How was the location established?
                        <select id="pinLocationBasis">
                            ${selectOptionsHtml(LOCATION_BASIS_OPTIONS, "map_placement")}
                        </select>
                    </label>
                    <label>
                        Location confidence
                        <select id="pinLocationConfidence">
                            ${selectOptionsHtml(LOCATION_CONFIDENCE_OPTIONS, "moderate")}
                        </select>
                    </label>
                    <label id="pinLocationWordingField">
                        What does the source or informant establish about the location? (optional for an identified building; required for an approximate area)
                        <textarea id="pinLocationWording" rows="2" maxlength="2000" placeholder="Preserve the wording, for example: somewhere in the northern part of the settlement."></textarea>
                    </label>
                    <div class="copy-help">If the evidence gives only a distance from an anchor, such as “roughly two kilometres from the town centre”, without enough direction to locate an area, do not invent a centre. Retain it as unresolved location evidence until the relative-location contract is available.</div>
                    <label class="checkbox-label">
                        <input id="pinLocationConfirmed" type="checkbox">
                        I confirm that this location description matches my evidence.
                    </label>
                    <div class="copy-help">This confirmation creates a provisional location claim for human review. It does not add a site to the public map.</div>
                </fieldset>
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
                    <select id="pinChangeClassSelect" title="This distinction drives the annual census: real change is counted, map corrections rewrite history.">
                        ${selectOptionsHtml(CHANGE_CLASS_OPTIONS, "uncertain")}
                    </select>
                </label>
                <div class="button-row">
                    <button id="pinSubmitButton" type="button">Create candidate task</button>
                    <button id="pinFormCancelButton" type="button" class="secondary">Cancel</button>
                </div>
            `;
        const revise = this.reviseContext;
        const occupancyPin = this.occupancyPinContext;
        const hostTitle = occupancyPin
            ? `Place period ${occupancyPin.index + 1} on the map`
            : revise ? `Revise ${escapeHtml(revise.name || "this place")}` : "Add a missing place";
        const locateHelp = occupancyPin
            ? "The pin starts on the task's point. Drag it, or click the map, to where the place stood in this period; choose an area if you only know the vicinity."
            : revise
                ? "The pin marks the current record. Drag it onto the right building if the record is misplaced, or confirm it as it stands."
                : "Search, type coordinates, or click the map. Drag the pin onto the building.";
        return `
            <h2 class="pin-host-title">${hostTitle}</h2>
            <div id="pinLocateCard" class="pin-card">
                <div class="copy-help">
                    ${locateHelp}
                </div>
                <div class="pin-locate-row">
                    <label>
                        Address or place name
                        <input id="pinSearchInput" type="search" placeholder="e.g. Mele, Efate" autocomplete="off">
                    </label>
                    <button id="pinSearchButton" type="button" class="secondary">Search</button>
                </div>
                <ul id="pinSearchResults" class="pin-search-results" hidden></ul>
                <div id="pinSearchStatus" class="copy-status" aria-live="polite"></div>
                <div class="pin-coord-row">
                    <label>
                        Latitude
                        <input id="pinLatInput" type="text" inputmode="decimal" placeholder="-17.74043" autocomplete="off">
                    </label>
                    <label>
                        Longitude
                        <input id="pinLngInput" type="text" inputmode="decimal" placeholder="168.32100" autocomplete="off">
                    </label>
                    <button id="pinCoordButton" type="button" class="secondary">Move pin</button>
                </div>
                <div class="copy-help">Search results by Nominatim &copy; OpenStreetMap contributors.</div>
            </div>
            <div id="pinConfirmCard" class="pin-card" hidden>
                <div class="pin-coords">Pin: <span id="pinLat"></span>, <span id="pinLng"></span></div>
                <label>
                    How sure are you of this location?
                    <select id="pinLocationMode">
                        ${selectOptionsHtml(LOCATION_MODE_OPTIONS, "building_identified")}
                    </select>
                </label>
                <div id="pinLocationRadiusField" hidden>
                    <label>
                        How far could it be from the pin?
                        <select id="pinLocationRadius">
                            ${selectOptionsHtml(LOCATION_RADIUS_OPTIONS, "500")}
                        </select>
                    </label>
                    <label id="pinLocationRadiusCustomField" hidden>
                        Radius in metres (25 to 100000)
                        <input id="pinLocationRadiusCustom" type="number" inputmode="numeric" min="25" max="100000" step="1" placeholder="e.g. 750">
                    </label>
                    <div id="pinLocationGrade" class="copy-help" aria-live="polite"></div>
                    ${this.pinCardCarriesBasis() ? `
                        <label>
                            How was the area established?
                            <select id="pinLocationBasis">
                                ${selectOptionsHtml(LOCATION_BASIS_OPTIONS, "address_or_locality")}
                            </select>
                        </label>
                        <label>
                            What places it here? (required for an area)
                            <textarea id="pinLocationWording" rows="2" maxlength="2000" placeholder="e.g. the 1989 list gives only the village name; elders say it stood near the old wharf."></textarea>
                        </label>
                    ` : ""}
                </div>
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
                ${revise ? `
                    <label>
                        What is wrong or new about this record?
                        <select id="pinIssueType">
                            ${selectOptionsHtml(REVISE_ISSUE_OPTIONS, "verify_existing_site")}
                        </select>
                    </label>
                ` : ""}
                <label>
                    Name (optional)
                    <input id="pinNameInput" type="text" placeholder="Unknown place of worship"${revise?.name ? ` value="${escapeHtml(revise.name)}"` : ""}>
                </label>
                <label>
                    Address (optional)
                    <input id="pinAddressInput" type="text">
                </label>
                <label>
                    Locality (optional)
                    <input id="pinLocalityInput" type="text">
                </label>
                ${formFields}
                <div class="button-row pin-discard-row">
                    <button id="pinDiscardButton" type="button" class="secondary">Discard entry</button>
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
        // cancel keeps the device draft to resume; discard wipes it and
        // returns the panel to rest (jb 2026-09-02)
        document.getElementById("pinDiscardButton")?.addEventListener("click", () => this.discardEntryAttempt());
        document.getElementById("pinSubmitButton")?.addEventListener("click", () => this.submitPinNomination());
        document.getElementById("pinLocationMode")?.addEventListener("change", () => this.updatePinConfirmCard());
        document.getElementById("pinLocationRadius")?.addEventListener("change", () => this.updatePinConfirmCard());
        document.getElementById("pinLocationRadiusCustom")?.addEventListener("input", () => this.updatePinConfirmCard());
        // locate card: search and typed coordinates feed the same pending pin
        document.getElementById("pinSearchButton")?.addEventListener("click", () => this.submitPinSearch());
        document.getElementById("pinSearchInput")?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                this.submitPinSearch();
            }
        });
        document.getElementById("pinCoordButton")?.addEventListener("click", () => this.applyTypedCoordinates());
        ["pinLatInput", "pinLngInput"].forEach(id => {
            document.getElementById(id)?.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    this.applyTypedCoordinates();
                }
            });
        });
        if (RAPID_NOMINATION_ENTRY) {
            ["pinNameInput", "pinAddressInput", "pinLocalityInput"].forEach(id => {
                document.getElementById(id)?.addEventListener("input", () => this.markFormDirty("rapid-pin"));
            });
            const reviseTarget = this.reviseContext;
            this.bindRapidObservationForm("pin", {
                draftExtraIds: ["pinNameInput", "pinAddressInput", "pinLocalityInput"],
                ...(reviseTarget ? { createTask: () => this.createRevisionTask(reviseTarget) } : {}),
                getCandidate: reviseTarget ? undefined : () => {
                    if (!this.pinConfirmed) return null;
                    const approximate = this.pinConfirmed.locationMode === "approximate_area";
                    // the location assertion rides on the task, outside the
                    // rapid draft contract; confirming the pin is the
                    // contributor's confirmation of the location description
                    const locationAssertion = window.PowLocationAssertion
                        ? window.PowLocationAssertion.payload({
                            mode: this.pinConfirmed.locationMode,
                            basis: approximate ? (this.pinConfirmed.basis || "address_or_locality") : "map_placement",
                            latitude: this.pinConfirmed.latitude,
                            longitude: this.pinConfirmed.longitude,
                            uncertaintyRadiusM: approximate ? this.pinConfirmed.uncertaintyRadiusM : undefined,
                            sourceWording: approximate ? this.pinConfirmed.sourceWording : "",
                            confidence: approximate ? "moderate" : "high",
                            contributorConfirmed: true,
                        })
                        : undefined;
                    return {
                        name: (document.getElementById("pinNameInput")?.value || "").trim() || "Unknown place of worship",
                        address: (document.getElementById("pinAddressInput")?.value || "").trim() || undefined,
                        locality: (document.getElementById("pinLocalityInput")?.value || "").trim() || undefined,
                        latitude: this.pinConfirmed.latitude,
                        longitude: this.pinConfirmed.longitude,
                        ...(locationAssertion ? { locationAssertion } : {}),
                    };
                },
            });
        } else {
            [
                "pinNameInput",
                "pinAddressInput",
                "pinLocalityInput",
                "pinLocationBasis",
                "pinLocationConfidence",
                "pinLocationWording",
                "pinLocationConfirmed",
                "pinObservedDateInput",
                "pinSourceNoteInput",
                "pinChangeClassSelect",
            ].forEach(id => {
                document.getElementById(id)?.addEventListener("input", () => this.markFormDirty("location-pin"));
                document.getElementById(id)?.addEventListener("change", () => this.markFormDirty("location-pin"));
            });
        }
        // no scroll on entry: the armed button carries the instruction, and
        // the transient cards already sit at the top of the working column
    }

    // pull the pin-card host to the top of the sidebar scroll so the armed
    // flow is never left below the fold on a long signed-in sidebar.
    // instant (not smooth): a nested-scroll smooth animation was unreliable
    revealPinHost() {
        document.getElementById("pinCardHost")?.scrollIntoView({ block: "start" });
    }

    // wipes an unfinished entry attempt and returns the panel to its resting
    // state (jb 2026-09-02): the device draft is discarded, pin mode torn
    // down, and nothing is left behind to resume. asks first only when
    // there is something to lose
    discardEntryAttempt({ confirmFirst = true } = {}) {
        const somethingToLose = Boolean(this.formDirty || this.pinConfirmed);
        if (confirmFirst && somethingToLose && !window.confirm("Discard this entry? Nothing has been saved.")) return false;
        this.clearRapidDraft("rapid-pin");
        this.clearFormDirty();
        if (this.pinMode) this.exitPinMode();
        this.reviseContext = null;
        this.issueFormOpenTaskId = null;
        this.selectedTask = null;
        this.map?.closePopup();
        this.renderInitialDetail();
        const status = document.getElementById("copyStatus");
        if (status) status.textContent = "Entry discarded. Nothing was saved.";
        return true;
    }

    // revise-with-evidence (jb 2026-09-02): the pin flow with the existing
    // record as prefill. the pin starts on the record's point; confirming
    // it (moved or not) records a location assertion, and the observation
    // form, attachments step, and known-history entry follow as for a
    // nomination. the task lands in the country's issue batch, claimed by
    // the ra, so the observation submits against it immediately
    enterReviseMode(context) {
        if (!this.map || !RAPID_NOMINATION_ENTRY) return;
        if (!Number.isFinite(context?.latitude) || !Number.isFinite(context?.longitude)) return;
        if (this.pinMode) this.exitPinMode();
        this.reviseContext = { ...context };
        this.enterPinMode();
        if (!this.pinMode) {
            this.reviseContext = null;
            return;
        }
        const latlng = L.latLng(context.latitude, context.longitude);
        this.map.setView(latlng, Math.max(this.map.getZoom(), 17));
        this.placePin(latlng);
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = "The pin sits on the current record. Drag it, or click the map, if the place is really elsewhere; then confirm the location.";
    }

    // opens (or claims) the revision task for the record, carrying the
    // confirmed location; returns the task id the observation submits to
    async createRevisionTask(target) {
        const confirmed = this.pinConfirmed;
        if (!confirmed) throw new Error("Confirm the map location before recording this observation.");
        const approximate = confirmed.locationMode === "approximate_area";
        const locationAssertion = window.PowLocationAssertion
            ? window.PowLocationAssertion.payload({
                mode: confirmed.locationMode,
                basis: approximate ? (confirmed.basis || "address_or_locality") : "map_placement",
                latitude: confirmed.latitude,
                longitude: confirmed.longitude,
                uncertaintyRadiusM: approximate ? confirmed.uncertaintyRadiusM : undefined,
                sourceWording: approximate ? confirmed.sourceWording : "",
                confidence: approximate ? "moderate" : "high",
                contributorConfirmed: true,
            })
            : undefined;
        const name = (document.getElementById("pinNameInput")?.value || "").trim() || target.name || "Unnamed site";
        const moved = Math.abs(confirmed.latitude - target.latitude) > 1e-7
            || Math.abs(confirmed.longitude - target.longitude) > 1e-7;
        const note = moved
            ? `Revision with evidence: the pin was moved from the record's point ${target.latitude.toFixed(5)}, ${target.longitude.toFixed(5)}.`
            : "Revision with evidence recorded against the existing record.";
        const result = await this.backend.createIssueTask({
            countryCode: COUNTRY_CONFIG.countryCode,
            name,
            issueType: document.getElementById("pinIssueType")?.value || "verify_existing_site",
            note,
            latitude: confirmed.latitude,
            longitude: confirmed.longitude,
            siteId: target.siteId || undefined,
            osmId: target.osmId || undefined,
            originalLatitude: target.latitude,
            originalLongitude: target.longitude,
            ...(locationAssertion ? { locationAssertion } : {}),
            assignToReporter: true,
            targetYears: COUNTRY_CONFIG.targetYears.map(Number),
            clientContext: {
                source: "portal_revise_place",
                country_code: COUNTRY_CONFIG.countryCode,
                page_path: window.location.pathname,
                placement_zoom: confirmed.zoom,
                location_mode: confirmed.locationMode,
            },
        });
        return { task_id: result.task_id, name, deduped: Boolean(result.deduped) };
    }

    enterPinMode() {
        if (this.pinMode || !this.map) return;
        this.pinMode = true;
        this.pinConfirmed = null;
        this.pinNearbyCount = 0;
        this.pinSubmissionId = RAPID_NOMINATION_ENTRY ? window.PowRapidEntry.secureSubmissionId() : null;
        this.mountPinCards();
        this.map.getContainer().classList.add("pin-placement");
        // the button itself carries the in-progress instruction, so the
        // click never reads as a dead control
        const addPlaceButton = document.getElementById("addPlaceButton");
        if (addPlaceButton) {
            addPlaceButton.setAttribute("disabled", "true");
            addPlaceButton.classList.add("placing");
            addPlaceButton.textContent = "Placing pin — click the building on the map · Esc cancels";
        }
        // structures must be visible so the pin lands on the actual building
        this.setBasemap("hybrid");
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = "Click the building on the map to drop the pin, or use search or coordinates above. Press Escape to cancel.";
        // every map click while armed lands the same pending pin: the first
        // click places it and later clicks move it, exactly as the sidebar
        // promises; the handler stays bound until exitPinMode
        this._pinClickHandler = (event) => {
            if (this.pinConfirmed) return;
            if (this.pinMarker) {
                this.setPendingPin(event.latlng.lat, event.latlng.lng, { zoom: this.map.getZoom() });
            } else {
                this.placePin(event.latlng);
            }
        };
        this.map.on("click", this._pinClickHandler);
        this._pinKeyHandler = (event) => {
            if (event.key === "Escape") {
                this.exitPinMode();
                return;
            }
            // cmd/ctrl+z steps the pin back through its placements; text
            // fields keep their own undo
            const undoCombo = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z";
            if (!undoCombo) return;
            const target = event.target;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
            event.preventDefault();
            this.undoPinMove();
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
        this.pinHistory = [L.latLng(latlng)];
        this.pinMarker.on("drag", () => this.updatePinConfirmCard());
        this.pinMarker.on("dragend", () => this.recordPinPosition());
        this._pinZoomHandler = () => this.updatePinConfirmCard();
        this.map.on("zoomend", this._pinZoomHandler);
        const card = document.getElementById("pinConfirmCard");
        if (card) card.hidden = false;
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = RAPID_NOMINATION_ENTRY
            ? "Drag the pin onto the building, zoom in, then confirm the location."
            : "Choose what the pin represents, place it on the building or at the centre of the supported area, then confirm.";
        this.updatePinConfirmCard();
        this.revealPinHost();
    }

    // undo history for the pending pin: every placement, click-move, typed
    // move, and drag lands here so cmd/ctrl+z can step back through them
    recordPinPosition() {
        if (!this.pinMarker) return;
        const position = this.pinMarker.getLatLng();
        const last = this.pinHistory[this.pinHistory.length - 1];
        if (last && last.equals(position)) return;
        this.pinHistory.push(L.latLng(position.lat, position.lng));
    }

    undoPinMove() {
        if (!this.pinMode || this.pinConfirmed || !this.pinMarker) return;
        this.pinHistory.pop();
        const previous = this.pinHistory[this.pinHistory.length - 1];
        if (previous) {
            this.pinMarker.setLatLng(previous);
            if (!this.map.getBounds().contains(previous)) this.map.panTo(previous);
            this.updatePinConfirmCard();
            return;
        }
        // undoing the first drop removes the pin; placement stays armed
        this.map.removeLayer(this.pinMarker);
        this.pinMarker = null;
        if (this.pinUncertaintyCircle) {
            this.map.removeLayer(this.pinUncertaintyCircle);
            this.pinUncertaintyCircle = null;
        }
        if (this._pinZoomHandler) {
            this.map.off("zoomend", this._pinZoomHandler);
            this._pinZoomHandler = null;
        }
        const card = document.getElementById("pinConfirmCard");
        if (card) card.hidden = true;
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = "Pin removed. Click the building on the map to drop it again.";
    }

    // search, typed coordinates, and the map click all land here: one
    // pending location, one draggable pin
    setPendingPin(lat, lng, { zoom = 18 } = {}) {
        if (!this.pinMode || this.pinConfirmed || !this.map) return;
        const latlng = L.latLng(lat, lng);
        const maxZoom = this.basemap !== "streets" ? 20 : 19;
        this.map.setView(latlng, Math.min(Math.max(this.map.getZoom(), zoom), maxZoom));
        if (this.pinMarker) {
            this.pinMarker.setLatLng(latlng);
            this.recordPinPosition();
            this.updatePinConfirmCard();
        } else {
            this.placePin(latlng);
        }
        const status = document.getElementById("pinStatus");
        if (status) status.textContent = "Drag the pin onto the building before confirming — searches and typed coordinates are rarely building-exact. If you know only the vicinity, choose \"I can only place an area\" instead.";
    }

    // one nominatim request per explicit submit, spaced out and biased to
    // this portal's country, per the osmf usage policy
    async submitPinSearch() {
        const status = document.getElementById("pinSearchStatus");
        const resultsEl = document.getElementById("pinSearchResults");
        const button = document.getElementById("pinSearchButton");
        const query = (document.getElementById("pinSearchInput")?.value || "").trim();
        if (!query) {
            if (status) status.textContent = "Type an address or place name first.";
            return;
        }
        if (Date.now() - this.lastNominatimRequestAt < NOMINATIM_MIN_INTERVAL_MS) {
            if (status) status.textContent = "One search at a time — try again in a moment.";
            return;
        }
        this.lastNominatimRequestAt = Date.now();
        if (button) button.disabled = true;
        if (status) status.textContent = "Searching…";
        if (resultsEl) {
            resultsEl.hidden = true;
            resultsEl.innerHTML = "";
        }
        try {
            const params = new URLSearchParams({
                format: "jsonv2",
                q: query,
                limit: "5",
                countrycodes: COUNTRY_CONFIG.countryCode.toLowerCase(),
            });
            const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
                headers: { Accept: "application/json" },
            });
            if (!response.ok) throw new Error(`Search failed (${response.status}). Try again shortly or click the map instead.`);
            const rows = await response.json();
            if (!Array.isArray(rows) || rows.length === 0) {
                if (status) status.textContent = "No match found. Add the town or island to the search, or click the map instead.";
                return;
            }
            if (status) status.textContent = "";
            if (resultsEl) {
                resultsEl.hidden = false;
                resultsEl.innerHTML = rows.map((row, index) => `
                    <li><button type="button" data-result-index="${index}">${escapeHtml(row.display_name || "Unnamed result")}</button></li>
                `).join("");
                resultsEl.querySelectorAll("button").forEach(resultButton => {
                    resultButton.addEventListener("click", () => {
                        const row = rows[Number(resultButton.dataset.resultIndex)];
                        const lat = Number(row?.lat);
                        const lng = Number(row?.lon);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                        resultsEl.hidden = true;
                        this.setPendingPin(lat, lng);
                    });
                });
            }
        } catch (error) {
            if (status) status.textContent = error.message || "Search failed — check the connection or click the map instead.";
        } finally {
            if (button) button.disabled = false;
        }
    }

    applyTypedCoordinates() {
        const status = document.getElementById("pinSearchStatus");
        const lat = Number.parseFloat(document.getElementById("pinLatInput")?.value || "");
        const lng = Number.parseFloat(document.getElementById("pinLngInput")?.value || "");
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            if (status) status.textContent = "Enter decimal degrees: latitude between -90 and 90, longitude between -180 and 180.";
            return;
        }
        if (status) status.textContent = "";
        this.setPendingPin(lat, lng);
    }

    pinLocationMode() {
        return document.getElementById("pinLocationMode")?.value || "building_identified";
    }

    pinLocationRadius() {
        if (this.pinLocationMode() !== "approximate_area") return undefined;
        const preset = document.getElementById("pinLocationRadius")?.value || "500";
        if (preset !== "custom") return Number(preset);
        const custom = Number(document.getElementById("pinLocationRadiusCustom")?.value);
        return Number.isFinite(custom) && custom > 0 ? Math.round(custom) : NaN;
    }

    updatePinUncertaintyCircle(position) {
        if (this.pinUncertaintyCircle) {
            this.map.removeLayer(this.pinUncertaintyCircle);
            this.pinUncertaintyCircle = null;
        }
        const radius = this.pinLocationRadius();
        if (!position || !Number.isFinite(radius)) return;
        this.pinUncertaintyCircle = L.circle(position, {
            radius,
            color: "#a15c07",
            weight: 2,
            opacity: 0.9,
            fillColor: "#f4c46b",
            fillOpacity: 0.18,
            interactive: false,
        }).addTo(this.map);
    }

    updatePinConfirmCard() {
        if (!this.pinMarker) return;
        const position = this.pinMarker.getLatLng();
        const latEl = document.getElementById("pinLat");
        const lngEl = document.getElementById("pinLng");
        if (latEl) latEl.textContent = position.lat.toFixed(5);
        if (lngEl) lngEl.textContent = position.lng.toFixed(5);
        // the typed-coordinate fields track the pin, unless being edited
        [["pinLatInput", position.lat], ["pinLngInput", position.lng]].forEach(([id, value]) => {
            const field = document.getElementById(id);
            if (field && document.activeElement !== field) field.value = value.toFixed(5);
        });
        const mode = this.pinLocationMode();
        const requiredZoom = mode === "approximate_area" ? PIN_MIN_APPROXIMATE_ZOOM : PIN_MIN_PLACEMENT_ZOOM;
        const zoomOk = this.map.getZoom() >= requiredZoom;
        // a pin the contributor cannot see must not be confirmable: a stray
        // early click can leave it far off-screen (even at sea)
        const inView = this.map.getBounds().contains(position);
        const confirmButton = document.getElementById("pinConfirmButton");
        if (confirmButton) confirmButton.disabled = !zoomOk || !inView;
        if (confirmButton) confirmButton.textContent = mode === "approximate_area"
            ? "Confirm approximate area"
            : "Confirm building location";
        const gate = document.getElementById("pinZoomGate");
        if (gate) {
            gate.hidden = false;
            gate.textContent = !inView
                ? "The pin is off screen — pan back to it, or click the map here to move it, before confirming."
                : zoomOk
                    ? (mode === "approximate_area"
                        ? "The shaded circle is an uncertainty area, not an accepted site boundary."
                        : "The pin will be recorded as the building location you identified.")
                    : (mode === "approximate_area"
                        ? "Zoom in far enough to place the centre of the supported area."
                        : "Zoom in further — a building-level point requires building-level placement.");
        }
        const radiusField = document.getElementById("pinLocationRadiusField");
        if (radiusField) radiusField.hidden = mode !== "approximate_area";
        const customField = document.getElementById("pinLocationRadiusCustomField");
        if (customField) customField.hidden = document.getElementById("pinLocationRadius")?.value !== "custom";
        const gradeEl = document.getElementById("pinLocationGrade");
        if (gradeEl) {
            const radius = this.pinLocationRadius();
            // the ra sees the grade the master data will carry, derived from
            // the radius exactly as the server derives it
            gradeEl.textContent = mode === "approximate_area" && Number.isFinite(radius) && window.PowLocationAssertion
                ? `Recorded as ${window.PowLocationAssertion.gradeLabel({ mode, uncertaintyRadiusM: radius })}, within ${radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} of the pin.`
                : "";
        }
        this.updatePinUncertaintyCircle(position);
    }

    confirmPinLocation() {
        const mode = this.pinLocationMode();
        const requiredZoom = mode === "approximate_area" ? PIN_MIN_APPROXIMATE_ZOOM : PIN_MIN_PLACEMENT_ZOOM;
        if (!this.pinMarker || this.map.getZoom() < requiredZoom) return;
        if (!this.map.getBounds().contains(this.pinMarker.getLatLng())) return;
        const status = document.getElementById("pinStatus");
        const radius = this.pinLocationRadius();
        if (mode === "approximate_area" && (!Number.isInteger(radius) || radius < 25 || radius > 100000)) {
            if (status) status.textContent = "Enter a whole-metre radius from 25 to 100000 before confirming.";
            return;
        }
        // the rapid flow carries the area's basis and wording on the confirm
        // card (the detailed form asks for them later); the server refuses
        // an approximate area with no retained wording
        const rapidWording = (document.getElementById("pinLocationWording")?.value || "").trim();
        if (this.pinCardCarriesBasis() && mode === "approximate_area" && !rapidWording) {
            if (status) status.textContent = "Say what places this area here before confirming.";
            return;
        }
        if (status) status.textContent = "";
        const position = this.pinMarker.getLatLng();
        this.pinConfirmed = {
            latitude: position.lat,
            longitude: position.lng,
            zoom: this.map.getZoom(),
            locationMode: mode,
            uncertaintyRadiusM: radius,
            ...(this.pinCardCarriesBasis() ? {
                basis: document.getElementById("pinLocationBasis")?.value || "map_placement",
                sourceWording: rapidWording,
            } : {}),
        };
        // the confirmed position is what gets recorded; freeze the pin
        this.pinMarker.dragging.disable();
        if (this._pinZoomHandler) {
            this.map.off("zoomend", this._pinZoomHandler);
            this._pinZoomHandler = null;
        }
        const confirmCard = document.getElementById("pinConfirmCard");
        if (confirmCard) confirmCard.hidden = true;
        // the location is settled; the locate tools would now be misleading
        const locateCard = document.getElementById("pinLocateCard");
        if (locateCard) locateCard.hidden = true;
        if (this.occupancyPinContext) {
            // a period's location: freeze the assertion into its card and
            // return to the periods pane
            this.completeOccupancyPin();
            return;
        }
        if (this.reviseContext) {
            // the record itself would be the nearest match; the form opens directly
            this.pinNearbyCount = 0;
            this.showPinForm();
            return;
        }
        const nearby = this.nearbyTaskRows(position, this.pinConfirmed.uncertaintyRadiusM);
        this.pinNearbyCount = nearby.length;
        if (nearby.length) {
            this.showPinProximity(nearby);
        } else {
            this.showPinForm();
        }
    }

    // existing task markers within the proximity radius, nearest first
    nearbyTaskRows(position, uncertaintyRadiusM) {
        const pin = L.latLng(position.lat, position.lng);
        const proximityMetres = Math.max(PIN_PROXIMITY_METRES, Number(uncertaintyRadiusM) || 0);
        return this.tasks
            .map(feature => {
                const coords = feature.geometry?.coordinates || [];
                if (coords.length < 2) return null;
                const distance = pin.distanceTo(L.latLng(coords[1], coords[0]));
                if (distance > proximityMetres) return null;
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
        const shownRows = rows.slice(0, 20);
        card.hidden = false;
        card.innerHTML = `
            <div class="copy-help">
                Existing tasks in or near the supported location — is one of these the same place?
            </div>
            ${rows.length > shownRows.length ? `<div class="pilot-note">Showing the nearest ${shownRows.length} of ${rows.length} tasks in this broad area. A reviewer must still assess duplicate risk.</div>` : ""}
            ${shownRows.map(row => `
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

    locationAssertionValues() {
        return {
            mode: this.pinConfirmed?.locationMode || "building_identified",
            basis: document.getElementById("pinLocationBasis")?.value || "map_placement",
            latitude: this.pinConfirmed?.latitude,
            longitude: this.pinConfirmed?.longitude,
            uncertaintyRadiusM: this.pinConfirmed?.uncertaintyRadiusM,
            sourceWording: document.getElementById("pinLocationWording")?.value || "",
            confidence: document.getElementById("pinLocationConfidence")?.value || "moderate",
            contributorConfirmed: document.getElementById("pinLocationConfirmed")?.checked === true,
        };
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
        if (!window.PowLocationAssertion) {
            if (status) status.textContent = "The location contract did not load. Reload the portal before submitting.";
            return;
        }
        const locationValues = this.locationAssertionValues();
        const locationError = window.PowLocationAssertion.validate(locationValues);
        if (locationError) {
            if (status) status.textContent = locationError;
            return;
        }
        const locationAssertion = window.PowLocationAssertion.payload(locationValues);
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
                locationAssertion,
                clientContext: {
                    source: "portal_pin_drop",
                    country_code: COUNTRY_CONFIG.countryCode,
                    page_path: window.location.pathname,
                    placement_zoom: this.pinConfirmed.zoom,
                    proximity_checked: true,
                    nearby_count: this.pinNearbyCount,
                    location_assertion_contract: "location_assertion_v1",
                    location_mode: locationAssertion.mode,
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
                initial_location_assertion: locationAssertion,
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
        if (this.formDirtyTaskId === "rapid-pin" || this.formDirtyTaskId === "location-pin") {
            this.clearFormDirty();
        }
        // a cancelled period placement returns to the pane with its cards
        const occupancyPin = this.occupancyPinContext;
        this.occupancyPinContext = null;
        const wasRevision = Boolean(this.reviseContext);
        this.pinMode = false;
        this.reviseContext = null;
        this.pinConfirmed = null;
        this.pinNearbyCount = 0;
        this.pinSubmissionId = null;
        this.pinHistory = [];
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
        if (this.pinUncertaintyCircle) {
            this.map.removeLayer(this.pinUncertaintyCircle);
            this.pinUncertaintyCircle = null;
        }
        this.map?.getContainer().classList.remove("pin-placement");
        // tear down the transient cards entirely so the host leaves no
        // empty panel behind the working column
        const host = document.getElementById("pinCardHost");
        if (host) {
            host.innerHTML = "";
            host.hidden = true;
        }
        const addPlaceButton = document.getElementById("addPlaceButton");
        if (addPlaceButton) {
            addPlaceButton.removeAttribute("disabled");
            addPlaceButton.classList.remove("placing");
            addPlaceButton.textContent = "＋ Add a missing place";
        }
        if (occupancyPin && this.occupancyDraft) {
            this.renderOccupancyEntry(occupancyPin.context, { restore: true, focusIndex: occupancyPin.index, markDirty: true });
        } else if (wasRevision) {
            // the revise pane would otherwise sit in the detail panel with
            // its two options as a dead end
            this.renderInitialDetail();
        }
    }

    // the confirm card carries the area's basis and wording when the rapid
    // flow or a period placement needs them (the detailed form asks later)
    pinCardCarriesBasis() {
        return RAPID_NOMINATION_ENTRY || Boolean(this.occupancyPinContext);
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
        const hasAssessedTargetYear = Object.values(values.targetYearStatuses).some((value) => value !== "not_assessed");
        if (!hasAssessedTargetYear) {
            if (status) {
                status.textContent = "No target year has been assessed. Use Copy review JSON instead; nothing was copied.";
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
                target_year_confidence: values.targetYearConfidence,
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
                this.clearGuidedPeriods(props.task_id);
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
