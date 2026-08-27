(function () {
    const MODES = new Set(["building_identified", "approximate_area"]);
    const BASES = new Set([
        "map_placement",
        "address_or_locality",
        "named_source_description",
        "local_investigator_account",
        "other",
    ]);
    const CONFIDENCE = new Set(["high", "moderate", "low", "uncertain"]);
    const MIN_RADIUS_M = 25;
    const MAX_RADIUS_M = 100000;

    function normalise(values) {
        return {
            mode: String(values?.mode || ""),
            basis: String(values?.basis || ""),
            latitude: Number(values?.latitude),
            longitude: Number(values?.longitude),
            uncertaintyRadiusM: values?.uncertaintyRadiusM === "" || values?.uncertaintyRadiusM === undefined
                ? undefined
                : Number(values.uncertaintyRadiusM),
            sourceWording: String(values?.sourceWording || "").trim(),
            confidence: String(values?.confidence || ""),
            contributorConfirmed: values?.contributorConfirmed === true,
        };
    }

    function validate(values) {
        const candidate = normalise(values);
        if (!MODES.has(candidate.mode)) return "Choose what the pin represents.";
        if (!BASES.has(candidate.basis)) return "Choose how the location was established.";
        if (!CONFIDENCE.has(candidate.confidence)) return "Choose a location confidence.";
        if (!Number.isFinite(candidate.latitude) || candidate.latitude < -90 || candidate.latitude > 90) {
            return "The confirmed latitude is invalid.";
        }
        if (!Number.isFinite(candidate.longitude) || candidate.longitude < -180 || candidate.longitude > 180) {
            return "The confirmed longitude is invalid.";
        }
        if (candidate.mode === "building_identified" && candidate.uncertaintyRadiusM !== undefined) {
            return "A building-level location cannot include an uncertainty radius.";
        }
        if (candidate.mode === "approximate_area") {
            if (
                !Number.isInteger(candidate.uncertaintyRadiusM)
                || candidate.uncertaintyRadiusM < MIN_RADIUS_M
                || candidate.uncertaintyRadiusM > MAX_RADIUS_M
            ) {
                return `Choose an uncertainty radius from ${MIN_RADIUS_M} to ${MAX_RADIUS_M} metres.`;
            }
            if (!candidate.sourceWording) {
                return "Record what the source or informant establishes about the approximate location.";
            }
        }
        if (candidate.sourceWording.length > 2000) return "Location wording must be 2000 characters or fewer.";
        if (!candidate.contributorConfirmed) {
            return "Confirm that the location description matches your evidence.";
        }
        return "";
    }

    function payload(values) {
        const candidate = normalise(values);
        const error = validate(candidate);
        if (error) throw new Error(error);
        return {
            contract_version: "location_assertion_v1",
            mode: candidate.mode,
            basis: candidate.basis,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
            ...(candidate.mode === "approximate_area"
                ? { uncertainty_radius_m: candidate.uncertaintyRadiusM }
                : {}),
            ...(candidate.sourceWording ? { source_wording: candidate.sourceWording } : {}),
            confidence: candidate.confidence,
            contributor_confirmed: true,
        };
    }

    window.PowLocationAssertion = Object.freeze({ validate, payload });
})();
