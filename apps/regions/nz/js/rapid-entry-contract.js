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

    function validateObservation(values) {
        if (!values.currentStatus) return "Choose what you can confirm at the observation date.";
        if (!values.observationBasis) return "Choose how you know this.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(values.observedOn || "")) return "Enter the observation date.";
        if (values.observedOn > localIsoDate()) return "The observation date cannot be in the future.";
        if (!values.privacyFlag) return "Choose the sensitivity and privacy setting.";
        if (values.observationBasis === "named_public_source" && !values.sourceTitle?.trim()) {
            return "Enter the public source title.";
        }
        if (values.observationBasis === "named_public_source" && !values.sourceReference?.trim()) {
            return "Enter the public source URL or agreed file reference.";
        }
        if (values.observationBasis === "local_investigator_account" && (values.directObservation?.trim().length || 0) < 5) {
            return "Briefly record the local observation supporting this entry.";
        }
        if (values.currentStatus === "could_not_determine" && (values.uncertaintyNote?.trim().length || 0) < 12) {
            return "Explain what remains uncertain.";
        }
        if (values.denominationRaw?.trim() && (!values.denominationLabelBasis || values.denominationLabelBasis === "unknown")) {
            return "Choose where the denomination or tradition wording came from.";
        }
        return "";
    }

    function observationPayload(values) {
        return {
            current_status: values.currentStatus,
            observation_basis: values.observationBasis,
            observed_on: values.observedOn,
            source_title: values.sourceTitle?.trim() || undefined,
            source_reference: values.sourceReference?.trim() || undefined,
            denomination_or_tradition_raw: values.denominationRaw?.trim() || undefined,
            denomination_label_basis: values.denominationRaw?.trim()
                ? values.denominationLabelBasis
                : undefined,
            direct_observation: values.directObservation?.trim() || undefined,
            uncertainty_note: values.uncertaintyNote?.trim() || undefined,
            privacy_flag: values.privacyFlag,
        };
    }

    window.PowRapidEntry = {
        localIsoDate,
        secureSubmissionId,
        validateObservation,
        observationPayload,
    };
})();
