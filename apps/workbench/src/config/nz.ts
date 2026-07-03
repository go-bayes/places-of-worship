import type { CountryConfig } from "./types";

// new zealand protocol: census target years 2013/2018/2023, lifecycle
// evidence accepted from the mission era onward
export const nz: CountryConfig = {
  countryCode: "NZ",
  countryName: "New Zealand",
  targetYears: [2013, 2018, 2023],
  lifecycleFloorYear: 1800,
  mapCenter: [174.0, -41.0],
  mapZoom: 5.2,
  researchMapHref: "https://www.placesmap.org/apps/regions/nz/",
  raGuidance: [
    "Record what the source states, not what you infer. Leave unknown dates blank and explain uncertainty in the evidence note.",
    "For historic sites, record the address as the source gives it and choose the geocoding basis that matches how you placed it on the modern map.",
    "Multiple rows for one place are fine when they carry different evidence.",
  ],
  suggestedSources: [
    { label: "Papers Past", url: "https://paperspast.natlib.govt.nz/", note: "digitised newspapers; openings, consecrations, closures" },
    { label: "NZ Heritage List / Rārangi Kōrero", url: "https://www.heritage.org.nz/the-list", note: "listed church buildings with histories" },
    { label: "Charities Register", url: "https://register.charities.govt.nz/", note: "current religious charities and addresses" },
    { label: "Retrolens historical imagery", url: "https://retrolens.co.nz/", note: "aerial photos for building presence by year" },
  ],
  culturalSensitivityPrompt: false,
};
