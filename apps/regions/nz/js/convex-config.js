(function () {
    window.POW_CONVEX_CONFIG = {
        enabled: true,
        url: "http://127.0.0.1:3240",
        // clerk development instance (contributor-access brief c1); the
        // production instance's pk_live_ key replaces it at the cutover
        clerkPublishableKey: "pk_test_c3VyZS1saXphcmQtNTAuY2xlcmsuYWNjb3VudHMuZGV2JA",
        // r-c18: while existing google members move to clerk, they confirm
        // their google account once (the public google client id); remove
        // when the move closes and the google provider is retired
        googleMigrationClientId: "365609603908-modldahk3205acfdf1pshhckufho13v0.apps.googleusercontent.com",
        countryCode: "NZ",
    };
})();
