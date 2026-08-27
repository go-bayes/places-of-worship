/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as batchImport from "../batchImport.js";
import type * as claudeReviews from "../claudeReviews.js";
import type * as devSeed from "../devSeed.js";
import type * as evidence from "../evidence.js";
import type * as exports from "../exports.js";
import type * as historicalClaims from "../historicalClaims.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_countryYears from "../lib/countryYears.js";
import type * as lib_exportEligibility from "../lib/exportEligibility.js";
import type * as lib_historicalClaims from "../lib/historicalClaims.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_locationAssertions from "../lib/locationAssertions.js";
import type * as lib_rapidEntry from "../lib/rapidEntry.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_sensitivity from "../lib/sensitivity.js";
import type * as lib_sha256 from "../lib/sha256.js";
import type * as lib_taskEvents from "../lib/taskEvents.js";
import type * as lib_validators from "../lib/validators.js";
import type * as model from "../model.js";
import type * as rapidEntry from "../rapidEntry.js";
import type * as reviews from "../reviews.js";
import type * as revisionSeed from "../revisionSeed.js";
import type * as tasks from "../tasks.js";
import type * as trainingSeed from "../trainingSeed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  batchImport: typeof batchImport;
  claudeReviews: typeof claudeReviews;
  devSeed: typeof devSeed;
  evidence: typeof evidence;
  exports: typeof exports;
  historicalClaims: typeof historicalClaims;
  "lib/auth": typeof lib_auth;
  "lib/countryYears": typeof lib_countryYears;
  "lib/exportEligibility": typeof lib_exportEligibility;
  "lib/historicalClaims": typeof lib_historicalClaims;
  "lib/limits": typeof lib_limits;
  "lib/locationAssertions": typeof lib_locationAssertions;
  "lib/rapidEntry": typeof lib_rapidEntry;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/sensitivity": typeof lib_sensitivity;
  "lib/sha256": typeof lib_sha256;
  "lib/taskEvents": typeof lib_taskEvents;
  "lib/validators": typeof lib_validators;
  model: typeof model;
  rapidEntry: typeof rapidEntry;
  reviews: typeof reviews;
  revisionSeed: typeof revisionSeed;
  tasks: typeof tasks;
  trainingSeed: typeof trainingSeed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
