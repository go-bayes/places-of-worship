import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

// Bound invited-account misuse without impeding ordinary field entry.
export const intakeRateLimiter = new RateLimiter(components.rateLimiter, {
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
});
