import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

// Bound invited-account misuse without impeding ordinary field entry.
export const intakeRateLimiter = new RateLimiter(components.rateLimiter, {
  submissionAttemptPerMember: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 20 },
  generalSubmissionPerUser: { kind: "fixed window", rate: 240, period: HOUR },
  generalSubmissionGlobal: { kind: "fixed window", rate: 1_000, period: HOUR },
  sourceCreationPerUser: { kind: "fixed window", rate: 240, period: HOUR },
  sourceCreationGlobal: { kind: "fixed window", rate: 1_000, period: HOUR },
  taskCreationPerUser: { kind: "fixed window", rate: 120, period: HOUR },
  taskCreationGlobal: { kind: "fixed window", rate: 500, period: HOUR },
  rapidEntryPerUser: {
    kind: "fixed window",
    rate: 120,
    period: HOUR,
  },
  rapidEntryGlobal: {
    kind: "fixed window",
    rate: 500,
    period: HOUR,
  },
  historicalClaimPerUser: {
    kind: "fixed window",
    rate: 240,
    period: HOUR,
  },
  historicalClaimGlobal: {
    kind: "fixed window",
    rate: 1_000,
    period: HOUR,
  },
  occupancyPerUser: {
    kind: "fixed window",
    rate: 240,
    period: HOUR,
  },
  occupancyGlobal: {
    kind: "fixed window",
    rate: 1_000,
    period: HOUR,
  },
  // an ra reopening a task from a decided status (reviewed, pi_accepted,
  // exported) is limited to 20 an hour; reviewers, curators and admins are
  // not charged. the cap bounds a compromised or careless invited account's
  // reach over decided work, and sits well above honest use (reserved
  // security review, 2026-10-15; jb ruling of the same day opened the route)
  decidedReopenPerUser: {
    kind: "fixed window",
    rate: 20,
    period: HOUR,
  },
});
