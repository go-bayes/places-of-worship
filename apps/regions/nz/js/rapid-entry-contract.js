(function () {
    function localIsoDate(date = new Date()) {
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function secureSubmissionId(cryptoApi = window.crypto) {
        if (!cryptoApi?.getRandomValues) {
            throw new Error("Secure browser randomness is unavailable. Use a current browser before recording data.");
        }
        if (typeof cryptoApi.randomUUID === "function") {
            return cryptoApi.randomUUID();
        }
        const bytes = new Uint8Array(16);
        cryptoApi.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map(value => value.toString(16).padStart(2, "0"));
        return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    }

    // detailed validation names the offending field so the form can
    // highlight it; a flagged partial entry keeps only the checks that
    // protect dates, privacy, and the discussion explanation
    function validateObservationDetailed(values, options = {}) {
        const flagged = Boolean(options.flagForDiscussion);
        const fail = (message, field) => ({ message, field });
        if (!flagged && !values.currentStatus) {
            return fail("Choose what you can confirm at the observation date.", "CurrentStatus");
        }
        if (!flagged && !values.observationBasis) {
            return fail("Choose how you know this.", "ObservationBasis");
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(values.observedOn || "")) {
            return fail("Enter the observation date.", "ObservedOn");
        }
        if (values.observedOn > localIsoDate()) {
            return fail("The observation date cannot be in the future.", "ObservedOn");
        }
        if (!values.privacyFlag) {
            return fail("Choose the sensitivity and privacy setting.", "PrivacyFlag");
        }
        if (flagged && (values.discussionNote?.trim().length || 0) < 12) {
            return fail("Briefly explain what needs discussion before flagging this entry.", "DiscussionNote");
        }
        if (!flagged && values.observationBasis === "named_public_source" && !values.sourceTitle?.trim()) {
            return fail("Enter the public source title.", "SourceTitle");
        }
        if (!flagged && values.observationBasis === "named_public_source" && !values.sourceReference?.trim()) {
            return fail("Enter the public source URL or agreed file reference.", "SourceReference");
        }
        if (!flagged && values.observationBasis === "local_investigator_account" && (values.directObservation?.trim().length || 0) < 5) {
            return fail("Briefly record the local observation supporting this entry.", "DirectObservation");
        }
        if (!flagged && values.currentStatus === "could_not_determine" && (values.uncertaintyNote?.trim().length || 0) < 12) {
            return fail("Explain what remains uncertain.", "UncertaintyNote");
        }
        // denomination wording stays genuinely optional: an unknown
        // provenance is recorded as unknown rather than blocking the entry
        return null;
    }

    function validateObservation(values, options = {}) {
        return validateObservationDetailed(values, options)?.message || "";
    }

    function observationPayload(values, options = {}) {
        const flagged = Boolean(options.flagForDiscussion);
        // a flagged partial entry may omit the controlled answers; it lands
        // as could-not-determine with the discussion text preserved in the
        // uncertainty note so the reviewer sees exactly what to settle
        const discussion = flagged && values.discussionNote?.trim()
            ? `For discussion: ${values.discussionNote.trim()}`
            : "";
        const uncertainty = [values.uncertaintyNote?.trim(), discussion]
            .filter(Boolean)
            .join("\n") || undefined;
        // a flagged named-public-source entry without its title cannot
        // satisfy that basis; it falls back to the catch-all basis
        const basis = flagged && values.observationBasis === "named_public_source" && !values.sourceTitle?.trim()
            ? "other"
            : values.observationBasis;
        return {
            current_status: values.currentStatus || (flagged ? "could_not_determine" : values.currentStatus),
            observation_basis: basis || (flagged ? "other" : basis),
            observed_on: values.observedOn,
            source_title: values.sourceTitle?.trim() || undefined,
            source_reference: values.sourceReference?.trim() || undefined,
            denomination_or_tradition_raw: values.denominationRaw?.trim() || undefined,
            denomination_label_basis: values.denominationRaw?.trim()
                ? values.denominationLabelBasis
                : undefined,
            direct_observation: values.directObservation?.trim() || undefined,
            uncertainty_note: uncertainty,
            privacy_flag: values.privacyFlag,
        };
    }

    window.PowRapidEntry = {
        localIsoDate,
        secureSubmissionId,
        validateObservation,
        validateObservationDetailed,
        observationPayload,
    };
})();
