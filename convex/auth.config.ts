import type { AuthConfig } from "convex/server";

declare const process: { env: Record<string, string | undefined> };

// two providers for the rollback week (contributor-access brief 4.2, r-c3):
// clerk sessions are the new sign-in, and the google provider stays so a
// rolled-back client, or a re-keyed member's linked google identifier, still
// verifies. removing google is a separate, non-additive deployment.
// CLERK_JWT_ISSUER_DOMAIN is the clerk instance's frontend api url, set per
// deployment; the "convex" jwt template sets aud to "convex"
export default {
  providers: [
    {
      // unset, the push fails loudly rather than dropping clerk silently
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
    {
      domain: "https://accounts.google.com",
      applicationID: "365609603908-modldahk3205acfdf1pshhckufho13v0.apps.googleusercontent.com",
    },
  ],
} satisfies AuthConfig;
