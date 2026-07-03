import type { CountryConfig } from "./types";
import { nz } from "./nz";
import { vu } from "./vu";

export const countries: Record<string, CountryConfig> = { NZ: nz, VU: vu };

export const defaultCountryCode = "NZ";

export function getCountry(code: string): CountryConfig {
  const config = countries[code];
  if (!config) throw new Error(`no country config for ${code}`);
  return config;
}

export type { CountryConfig } from "./types";
