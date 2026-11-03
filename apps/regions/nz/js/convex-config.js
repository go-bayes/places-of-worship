(function () {
    window.POW_CONVEX_CONFIG = {
        enabled: true,
        url: "https://pastel-goshawk-398.convex.cloud",
        googleClientId: "365609603908-modldahk3205acfdf1pshhckufho13v0.apps.googleusercontent.com",
        // the workos authkit client id (not a secret). empty: both portals
        // sign in with google id tokens, as before. set (client_01...):
        // both sign in through workos and the session renews silently.
        // set it only after the backend carries the workos providers; see
        // docs/development/workos-sessions.md
        workosClientId: "",
        countryCode: "NZ",
    };
})();
