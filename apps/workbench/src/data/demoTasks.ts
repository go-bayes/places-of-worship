import type { WorkTask } from "./types";

// demo seed: representative task shapes only. these are illustrative
// records for exercising the workflow, not project data, and never
// leave the browser.
export const demoTasks: WorkTask[] = [
  {
    taskId: "demo-nz-001",
    countryCode: "NZ",
    batchId: "demo-batch-nz",
    siteId: "demo-site-nz-001",
    siteName: "St Andrew's on The Terrace, Wellington",
    taskKind: "deep_history",
    instructions:
      "Establish opening date and any rebuilds from Papers Past and the Heritage NZ listing. Record name history if the source shows earlier names.",
    targetYears: [2013, 2018, 2023],
    status: "open",
    lat: -41.2827,
    lng: 174.7766,
  },
  {
    taskId: "demo-nz-002",
    countryCode: "NZ",
    batchId: "demo-batch-nz",
    siteName: "Former Methodist chapel, described near Cuba Street (source-first)",
    taskKind: "source_extraction",
    instructions:
      "An 1885 newspaper notice describes a chapel opening near Cuba Street. Extract what the source states: name, denomination, street description, opening date. Place it only as confidently as the source allows.",
    targetYears: [2013, 2018, 2023],
    status: "open",
  },
  {
    taskId: "demo-vu-001",
    countryCode: "VU",
    batchId: "demo-batch-vu",
    siteId: "demo-site-vu-001",
    siteName: "Presbyterian church, Erakor village, Efate",
    taskKind: "verify_site",
    instructions:
      "Confirm current worship use and building presence from imagery and any dated source. Record the earliest mission-era evidence you can find for this congregation's site history.",
    targetYears: [1989, 1999, 2009, 2020],
    status: "open",
    lat: -17.7833,
    lng: 168.3833,
  },
  {
    taskId: "demo-vu-002",
    countryCode: "VU",
    batchId: "demo-batch-vu",
    siteName: "Mission station site, Aneityum (source-first)",
    taskKind: "deep_history",
    instructions:
      "From mission records, document the station's church buildings: construction dates, materials, rebuilds after cyclones, and any relocation. Use bounded dates where the source only brackets an event.",
    targetYears: [1989, 1999, 2009, 2020],
    status: "open",
  },
];
