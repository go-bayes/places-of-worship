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
  MX: [2000, 2010, 2020],
  UK: [2001, 2011, 2021],
  US: [2000, 2010, 2020],
};

// resolve a country's default waves; callers should pass target years
// explicitly — this exists so an omitted argument never inherits another
// country's waves, and unknown countries fail loudly instead of silently
export function defaultTargetYears(countryCode: string): number[] {
  const years = DEFAULT_TARGET_YEARS[countryCode.toUpperCase()];
  if (!years) {
    throw new Error(
      `No default target years for country ${countryCode}; pass targetYears explicitly.`,
    );
  }
  return years;
}
