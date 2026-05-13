import type { AuthConfig } from "convex/server";

declare const process: {
  env: Record<string, string | undefined>;
};

export default {
  providers: [
    {
      domain: "https://accounts.google.com",
      applicationID: process.env.GOOGLE_CLIENT_ID!,
    },
  ],
} satisfies AuthConfig;
