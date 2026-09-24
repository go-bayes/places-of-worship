/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as acceptances from "../acceptances.js";
import type * as agentJudgments from "../agentJudgments.js";
import type * as attachments from "../attachments.js";
import type * as batchImport from "../batchImport.js";
import type * as claudeReviews from "../claudeReviews.js";
import type * as devSeed from "../devSeed.js";
import type * as evidence from "../evidence.js";
import type * as evidenceVersions from "../evidenceVersions.js";
import type * as exports from "../exports.js";
import type * as firstPassReceipts from "../firstPassReceipts.js";
import type * as historicalClaims from "../historicalClaims.js";
import type * as internalAgentIntake from "../internalAgentIntake.js";
import type * as lib_acceptance from "../lib/acceptance.js";
import type * as lib_agentIntake from "../lib/agentIntake.js";
import type * as lib_agentJudgments from "../lib/agentJudgments.js";
import type * as lib_agentServiceUser from "../lib/agentServiceUser.js";
import type * as lib_assignedTaskPeriods from "../lib/assignedTaskPeriods.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_canonicalJson from "../lib/canonicalJson.js";
import type * as lib_countryYears from "../lib/countryYears.js";
import type * as lib_evidenceVersions from "../lib/evidenceVersions.js";
import type * as lib_exportEligibility from "../lib/exportEligibility.js";
import type * as lib_firstPass from "../lib/firstPass.js";
import type * as lib_functionChain from "../lib/functionChain.js";
import type * as lib_historicalClaims from "../lib/historicalClaims.js";
import type * as lib_intakeGate from "../lib/intakeGate.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_locationAssertions from "../lib/locationAssertions.js";
import type * as lib_locationOutcome from "../lib/locationOutcome.js";
import type * as lib_objectReceipts from "../lib/objectReceipts.js";
import type * as lib_occupancies from "../lib/occupancies.js";
import type * as lib_occupancyImport from "../lib/occupancyImport.js";
import type * as lib_probableSameAs from "../lib/probableSameAs.js";
import type * as lib_probableSameAsRecords from "../lib/probableSameAsRecords.js";
import type * as lib_r2Presign from "../lib/r2Presign.js";
import type * as lib_rapidEntry from "../lib/rapidEntry.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_sensitivity from "../lib/sensitivity.js";
import type * as lib_sha256 from "../lib/sha256.js";
import type * as lib_sources from "../lib/sources.js";
import type * as lib_taskEvents from "../lib/taskEvents.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_wideEvidenceFields from "../lib/wideEvidenceFields.js";
import type * as lib_wireJson from "../lib/wireJson.js";
import type * as model from "../model.js";
import type * as occupancies from "../occupancies.js";
import type * as rapidEntry from "../rapidEntry.js";
import type * as reviews from "../reviews.js";
import type * as revisionSeed from "../revisionSeed.js";
import type * as sources from "../sources.js";
import type * as tasks from "../tasks.js";
import type * as trainingSeed from "../trainingSeed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  acceptances: typeof acceptances;
  agentJudgments: typeof agentJudgments;
  attachments: typeof attachments;
  batchImport: typeof batchImport;
  claudeReviews: typeof claudeReviews;
  devSeed: typeof devSeed;
  evidence: typeof evidence;
  evidenceVersions: typeof evidenceVersions;
  exports: typeof exports;
  firstPassReceipts: typeof firstPassReceipts;
  historicalClaims: typeof historicalClaims;
  internalAgentIntake: typeof internalAgentIntake;
  "lib/acceptance": typeof lib_acceptance;
  "lib/agentIntake": typeof lib_agentIntake;
  "lib/agentJudgments": typeof lib_agentJudgments;
  "lib/agentServiceUser": typeof lib_agentServiceUser;
  "lib/assignedTaskPeriods": typeof lib_assignedTaskPeriods;
  "lib/auth": typeof lib_auth;
  "lib/canonicalJson": typeof lib_canonicalJson;
  "lib/countryYears": typeof lib_countryYears;
  "lib/evidenceVersions": typeof lib_evidenceVersions;
  "lib/exportEligibility": typeof lib_exportEligibility;
  "lib/firstPass": typeof lib_firstPass;
  "lib/functionChain": typeof lib_functionChain;
  "lib/historicalClaims": typeof lib_historicalClaims;
  "lib/intakeGate": typeof lib_intakeGate;
  "lib/limits": typeof lib_limits;
  "lib/locationAssertions": typeof lib_locationAssertions;
  "lib/locationOutcome": typeof lib_locationOutcome;
  "lib/objectReceipts": typeof lib_objectReceipts;
  "lib/occupancies": typeof lib_occupancies;
  "lib/occupancyImport": typeof lib_occupancyImport;
  "lib/probableSameAs": typeof lib_probableSameAs;
  "lib/probableSameAsRecords": typeof lib_probableSameAsRecords;
  "lib/r2Presign": typeof lib_r2Presign;
  "lib/rapidEntry": typeof lib_rapidEntry;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/sensitivity": typeof lib_sensitivity;
  "lib/sha256": typeof lib_sha256;
  "lib/sources": typeof lib_sources;
  "lib/taskEvents": typeof lib_taskEvents;
  "lib/validators": typeof lib_validators;
  "lib/wideEvidenceFields": typeof lib_wideEvidenceFields;
  "lib/wireJson": typeof lib_wireJson;
  model: typeof model;
  occupancies: typeof occupancies;
  rapidEntry: typeof rapidEntry;
  reviews: typeof reviews;
  revisionSeed: typeof revisionSeed;
  sources: typeof sources;
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
