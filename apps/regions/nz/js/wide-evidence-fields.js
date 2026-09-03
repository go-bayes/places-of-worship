// portal mirror of convex/lib/wideEvidenceFields.ts — the single source of
// truth for the site_evidence_wide column list. the portal loads via a
// plain <script> tag and cannot import the convex module, so this file
// repeats the list verbatim; convex/lib/wideEvidenceFields.node-test.mjs
// fails when the two disagree. the server refuses a draft whose field
// list differs from its own, so an out-of-date copy here cannot lose
// columns silently — it only blocks saving until the portal is reloaded.
(function () {
    const LEADING = Object.freeze([
        "evidence_row_id", "collection_batch", "country_code", "area_hint",
        "source_dataset_id", "source_type", "provider", "source_title",
        "source_url_or_file", "source_record_id", "retrieval_date", "retrieved_by",
        "licence", "access_limits", "redistribution_limits", "raw_file_location",
        "source_notes", "name_raw", "name_standardised",
        "denomination_or_tradition_raw", "site_type", "address_raw",
        "historical_address_raw", "historical_locality_raw",
        "modern_address_candidate", "address_standardised", "locality_raw",
        "territorial_authority_hint", "address_change_note", "geocoding_basis",
        "geocoding_confidence", "latitude", "longitude", "geometry_wkt_or_geojson",
        "matched_osm_id", "osm_object_type", "osm_version_timestamp",
        "osm_tags_raw", "osm_start_date", "osm_old_start_date", "osm_end_date",
        "osm_lifecycle_date_notes", "matched_current_site_id", "candidate_site_id",
        "match_method", "match_confidence", "candidate_match_notes",
        "visual_verification_source", "visual_verification_url_or_file",
        "visual_verification_capture_date", "visual_verification_summary",
        "organisation_founded_date", "organisation_founded_date_precision",
        "site_opened_date", "site_opened_date_precision",
        "building_opened_or_dedicated_date",
        "building_opened_or_dedicated_date_precision",
        "origin_not_earlier_than_date", "origin_not_earlier_than_date_precision",
        "origin_not_later_than_date", "origin_not_later_than_date_precision",
        "first_seen_date", "first_seen_date_precision", "last_seen_date",
        "last_seen_date_precision", "site_closed_date", "site_closed_date_precision",
        "closure_not_earlier_than_date", "closure_not_earlier_than_date_precision",
        "closure_not_later_than_date", "closure_not_later_than_date_precision",
        "building_demolished_date", "building_demolished_date_precision",
        "use_changed_date", "use_changed_date_precision", "relocated_date",
        "relocated_date_precision", "date_evidence_raw", "date_evidence_summary",
        "existence_status", "worship_use_status", "public_access_status",
    ]);
    const TARGET_YEAR_SUFFIXES = Object.freeze([
        "status", "probability", "evidence",
        "basis", "latitude", "longitude", "uncertainty_radius_m", "location_basis",
        "denomination", "denomination_basis",
    ]);
    const TRAILING = Object.freeze([
        "quality_flag", "review_status",
        "privacy_flag", "licence_flag", "extracted_by", "extracted_at",
        "reviewed_by", "reviewed_at", "review_note", "exclusion_reason",
    ]);

    function targetYearFields(targetYears) {
        return (targetYears || []).flatMap(year => TARGET_YEAR_SUFFIXES.map(suffix => `target_year_${year}_${suffix}`));
    }

    function fields(targetYears) {
        return [...LEADING, ...targetYearFields(targetYears), ...TRAILING];
    }

    window.PowWideEvidenceFields = Object.freeze({ fields, targetYearFields, LEADING, TRAILING, TARGET_YEAR_SUFFIXES });
})();
