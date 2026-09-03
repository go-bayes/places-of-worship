// single convex-side source of truth for each country's shipped census
// waves. Mirrors the portal's COUNTRY_CONFIGS targetYears in
// apps/regions/nz/js/verification-map.js — the portal loads via a plain
// <script> tag and cannot import this module, so when a country's waves
// change BOTH files must move in the same commit.
export const DEFAULT_TARGET_YEARS: Record<string, number[]> = {
  NZ: [2013, 2018, 2023],
  VU: [1989, 1999, 2009, 2020],
  AU: [2016, 2021],
  BR: [2000, 2010, 2022],
  CA: [2001, 2011, 2021],
  IE: [2011, 2016, 2022],
  IN: [2001, 2011],
  KR: [2005, 2015],
  MX: [2000, 2010, 2020],
  PT: [2011, 2021],
  RO: [2011, 2021],
  SK: [2021],
  UK: [2001, 2011, 2021],
  US: [2000, 2010, 2020],
};

// F1 (jb 2026-08-31, ruled in docs/portal-location-and-occupancy-plan.md):
// the earliest year a dated claim or period may name, per country. it is a
// typo guard, not a historical statement: countries whose documented places
// of worship predate 1600 get a lower floor so deep history stays reachable.
// Mirrors apps/regions/nz/js/date-floor.js; both files move together
// (the test in countryYears.node-test.mjs ties them).
export const DEFAULT_DATE_FLOOR_YEAR = 1600;
export const DATE_FLOOR_YEARS: Record<string, number> = {
  NZ: 1600,
  VU: 1600,
  AU: 1600,
  BR: 1500,
  CA: 1500,
  IE: 1000,
  IN: 1000,
  KR: 1000,
  MX: 1500,
  PT: 1000,
  RO: 1000,
  SK: 1000,
  UK: 1000,
  US: 1500,
};

// the floor for a country; unknown or absent countries keep the default so
// validation never opens wider than the ruled guard by accident
export function dateFloorYear(countryCode?: string): number {
  const floor = countryCode ? DATE_FLOOR_YEARS[countryCode.toUpperCase()] : undefined;
  return Number.isInteger(floor) ? (floor as number) : DEFAULT_DATE_FLOOR_YEAR;
}

// resolve a country's default waves; callers should pass target years
// explicitly — this exists so an omitted argument never inherits another
// country's waves, and unknown countries fail loudly instead of silently
// the census years a registry country carries until one is ruled: none.
// every write path that used to demand a wave list reads this instead
// (jb ruling r-h1, 2026-09-03); the throwing form below stays for batch
// imports and seeds, where a wave list is genuinely required
export function targetYearsOrEmpty(countryCode: string): number[] {
  return DEFAULT_TARGET_YEARS[countryCode.toUpperCase()] ?? [];
}

export function defaultTargetYears(countryCode: string): number[] {
  const years = DEFAULT_TARGET_YEARS[countryCode.toUpperCase()];
  if (!years) {
    throw new Error(
      `No default target years for country ${countryCode}; pass targetYears explicitly.`,
    );
  }
  return years;
}
