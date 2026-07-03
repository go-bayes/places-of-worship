// per-country configuration: everything country-specific in the workbench
// is declared here so a new country is a config file, not a fork.

export interface CountryConfig {
  countryCode: string;
  countryName: string;
  /** census-anchored years RAs assess by default */
  targetYears: number[];
  /** earliest year lifecycle evidence is accepted from */
  lifecycleFloorYear: number;
  mapCenter: [number, number];
  mapZoom: number;
  /** research-map page for cross-navigation */
  researchMapHref: string;
  /** country-specific guidance shown above the evidence form */
  raGuidance: string[];
  /** country-specific source suggestions shown in the source picker */
  suggestedSources: { label: string; url: string; note?: string }[];
  /** whether the country protocol expects customary/kastom-site
      sensitivity handling to be offered prominently */
  culturalSensitivityPrompt: boolean;
}
