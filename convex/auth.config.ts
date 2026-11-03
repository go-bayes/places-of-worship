import type { AuthConfig } from "convex/server";

declare const process: {
  env: Record<string, string | undefined>;
};

// the workos authkit client id (not a secret). the deployment must carry
// WORKOS_CLIENT_ID before this file is pushed: convex refuses an auth
// config that reads an unset variable
const workosClientId = process.env.WORKOS_CLIENT_ID;

export default {
  providers: [
    // google id tokens: the portals' sign-in until the switch to workos
    // sessions (2026-11-03). kept during the switch so a signed-in ra is
    // not locked out mid-change; removing it is a later step
    {
      domain: "https://accounts.google.com",
      applicationID: "365609603908-modldahk3205acfdf1pshhckufho13v0.apps.googleusercontent.com",
    },
    // workos authkit access tokens, as convex documents the setup
    // (https://docs.convex.dev/auth/authkit/). the user row is found by the
    // email claim the dashboard's jwt template adds (convex/lib/auth.ts)
    {
      type: "customJwt",
      issuer: "https://api.workos.com/",
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${workosClientId}`,
      applicationID: workosClientId,
    },
    {
      type: "customJwt",
      issuer: `https://api.workos.com/user_management/${workosClientId}`,
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${workosClientId}`,
    },
  ],
} satisfies AuthConfig;
