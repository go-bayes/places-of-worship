import type { CountryConfig } from "./types";

// vanuatu protocol (research/vanuatu-case-analysis.md): census target years
// 1989/1999/2009/2020, lifecycle evidence accepted from 1600 onward,
// kastom-site sensitivity handled as a first-class prompt
export const vu: CountryConfig = {
  countryCode: "VU",
  countryName: "Vanuatu",
  targetYears: [1989, 1999, 2009, 2020],
  lifecycleFloorYear: 1600,
  mapCenter: [167.2, -16.0],
  mapZoom: 6.0,
  researchMapHref: "https://www.placesmap.org/apps/regions/vu/",
  raGuidance: [
    "Source-first: start from the document, then place the site. A record without modern coordinates is still valuable — choose the geocoding basis honestly.",
    "Mission-era sources use older place names; record the name as written and add the modern locality where known.",
    "For customary or kastom sites, complete the sensitivity prompt before any location detail is entered.",
  ],
  suggestedSources: [
    { label: "VNSO census reports", url: "https://vnso.gov.vu/", note: "religion tables 1989–2020; province level" },
    { label: "Pacific Data Hub", url: "https://pacificdata.org/", note: "SPC-held census and survey holdings" },
    { label: "PAMBU (Pacific Manuscripts Bureau)", url: "https://asiapacific.anu.edu.au/pambu/", note: "microfilmed mission records" },
  ],
  culturalSensitivityPrompt: true,
};
