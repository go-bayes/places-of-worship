(function () {
    function isValidPartialDate(value) {
        if (!value) return true;
        if (/^\d{4}$/.test(value)) return Number(value) >= 1600;
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return Number(value.slice(0, 4)) >= 1600;
        const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
        if (!match || Number(match[1]) < 1600) return false;
        const parsed = new Date(`${value}T00:00:00Z`);
        return parsed.getUTCFullYear() === Number(match[1])
            && parsed.getUTCMonth() + 1 === Number(match[2])
            && parsed.getUTCDate() === Number(match[3]);
    }

    function partialDateLower(value) {
        if (/^\d{4}$/.test(value)) return `${value}-01-01`;
        if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
        return value;
    }

    function partialDateUpper(value) {
        if (/^\d{4}$/.test(value)) return `${value}-12-31`;
        if (/^\d{4}-\d{2}$/.test(value)) {
            const [year, month] = value.split("-").map(Number);
            const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
            return `${value}-${String(day).padStart(2, "0")}`;
        }
        return value;
    }

    function validateHistoricalClaim(values, observationDate) {
        const earliest = values.earliestSupportedDate?.trim() || "";
        const latest = values.latestSupportedDate?.trim() || "";
        if (!values.claimKind) return "Choose what the historical claim concerns.";
        if (!values.claimTiming) return "Choose whether this is an event or a state.";
        if ((values.claimText?.trim().length || 0) < 3) return "Describe the historical event or state.";
        if (!earliest && !latest && (values.uncertaintyNote?.trim().length || 0) < 12) {
            return "Add supported date bounds or explain why the dates remain unresolved.";
        }
        if (earliest && !isValidPartialDate(earliest)) return "Use YYYY, YYYY-MM, or YYYY-MM-DD from 1600 onward for the earliest supported date.";
        if (latest && !isValidPartialDate(latest)) return "Use YYYY, YYYY-MM, or YYYY-MM-DD from 1600 onward for the latest supported date.";
        if (earliest && partialDateLower(earliest) > observationDate) return "The earliest supported date cannot be after the current observation date.";
        if (latest && partialDateLower(latest) > observationDate) return "The latest supported date cannot be after the current observation date.";
        if (earliest && latest && partialDateLower(earliest) > partialDateUpper(latest)) return "The earliest supported date cannot be after the latest supported date.";
        if (values.continuesThroughObservation && values.claimTiming !== "state") return "Only a historical state can remain open through the observation date.";
        if (values.continuesThroughObservation && latest) return "Leave the latest supported date blank when the state remains open through the observation date.";
        if (!values.confidence) return "Choose a confidence category.";
        if ((values.confidenceBasis?.trim().length || 0) < 5) return "Briefly explain the confidence category.";
        if (!values.sourceBasis) return "Choose the source or informant basis.";
        if ((values.sourceTitle?.trim().length || 0) < 3) return "Name or briefly describe the source or informant basis.";
        if (values.sourceBasis === "named_public_source" && !values.sourceReference?.trim()) return "Add the public source URL, archive reference, or agreed file reference.";
        if ((values.sourceAccount?.trim().length || 0) < 5) return "Retain the source wording or a short dictated account.";
        if (!values.privacyFlag) return "Choose the sensitivity and privacy setting.";
        return "";
    }

    function historicalClaimPayload(values) {
        return {
            claim_kind: values.claimKind,
            claim_timing: values.claimTiming,
            claim_text: values.claimText.trim(),
            earliest_supported_date: values.earliestSupportedDate?.trim() || undefined,
            latest_supported_date: values.latestSupportedDate?.trim() || undefined,
            continues_through_observation: Boolean(values.continuesThroughObservation),
            confidence: values.confidence,
            confidence_basis: values.confidenceBasis.trim(),
            source_basis: values.sourceBasis,
            source_title: values.sourceTitle.trim(),
            source_reference: values.sourceReference?.trim() || undefined,
            source_account: values.sourceAccount.trim(),
            uncertainty_note: values.uncertaintyNote?.trim() || undefined,
            privacy_flag: values.privacyFlag,
        };
    }

    window.PowHistoricalClaim = {
        historicalClaimPayload,
        isValidPartialDate,
        validateHistoricalClaim,
    };
})();
