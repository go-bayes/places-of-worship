// domain types for RA ingestion of places-of-faith evidence.
// vocabulary follows the project contracts (schemas/, docs/ui-style-guide.md,
// docs/templates/ra-historical-site-evidence/): controlled values are string
// unions, dates are partial ISO strings (YYYY, YYYY-MM, or YYYY-MM-DD), and
// unknown dates stay absent rather than becoming placeholders.

/** partial ISO date: YYYY, YYYY-MM, or YYYY-MM-DD */
export type PartialIsoDate = string;

/** a date that a source may only bound, never state exactly */
export interface BoundedDate {
  value?: PartialIsoDate;
  notEarlierThan?: PartialIsoDate;
  notLaterThan?: PartialIsoDate;
}

export type TargetYearStatus = "present" | "absent" | "uncertain" | "not_assessed";

export type ExistenceStatus = "present" | "absent" | "uncertain";

export type WorshipUseStatus =
  | "confirmed_worship"
  | "probable_worship"
  | "organisation_only"
  | "building_only"
  | "not_worship"
  | "uncertain";

export type Confidence = "high" | "medium" | "low";

export type SourceType =
  | "osm_history"
  | "osm_date_tags"
  | "street_imagery"
  | "aerial_imagery"
  | "field_observation"
  | "charities_register"
  | "incorporated_societies"
  | "linz_building_outlines"
  | "linz_property"
  | "denominational_directory"
  | "archived_website"
  | "local_council"
  | "heritage_list"
  | "census_or_statistics"
  | "church_record"
  | "denominational_yearbook"
  | "newspaper_archive"
  | "charity_or_society_register"
  | "map_or_survey"
  | "academic_work"
  | "oral_history"
  | "other";

export type LifecycleEventType =
  | "founding"
  | "opening"
  | "first_seen"
  | "last_seen"
  | "closure"
  | "demolition"
  | "change_of_use"
  | "rebuild";

export interface ArchiveRef {
  repositoryName: string;
  collection: string;
  itemRef?: string;
  consultedDate: PartialIsoDate;
  location?: string;
}

/** one source consulted, with the provenance the storage policy requires */
export interface SourceReference {
  sourceType: SourceType;
  title: string;
  url?: string;
  archiveRef?: ArchiveRef;
  provider?: string;
  /** date the source itself carries (publication, survey, imagery capture) */
  sourceDate?: PartialIsoDate;
  /** date the RA accessed or captured the source */
  consultedDate?: PartialIsoDate;
  licence?: string;
  accessLimits?: string;
  notes?: string;
}

export type SourceRecord = SourceReference;

/** a dated lifecycle claim backed by at least one source */
export interface LifecycleClaim {
  eventKind: LifecycleEventType;
  date: BoundedDate;
  confidence: Confidence;
  sourceReferences?: SourceReference[];
  notes?: string;
}

/** how a historic location was placed on the modern map */
export type GeocodingBasis =
  | "exact_address"
  | "historical_address_matched"
  | "described_locality"
  | "map_georeference"
  | "regional_only"
  | "unknown";

export interface LocationEvidence {
  lat?: number;
  lng?: number;
  /** source-backed street address, if the source states one */
  streetAddress?: string;
  locality?: string;
  addressNotes?: string;
  geocodingBasis: GeocodingBasis;
  containingArea?: { areaId?: string; areaName: string; areaType?: string; countryCode?: string };
  locationConfidence: Confidence;
}

/** attributes of the place of faith as a source describes them */
export interface SiteAttributes {
  /** name as the source gives it; later names go in nameHistory */
  name?: string;
  nameHistory?: { name: string; from?: BoundedDate; to?: BoundedDate }[];
  religion?: string;
  /** dotted code from schemas/denomination-taxonomy.json */
  denominationCode?: string;
  /** required whenever denominationCode is set */
  taxonomyVersion?: string;
  buildingMaterial?: string;
  capacity?: number;
  architectureNotes?: string;
  /** customary/kastom or otherwise culturally sensitive site: when true the
      record carries restricted-display expectations through review */
  culturallySensitive?: boolean;
  sensitivityBasis?: string;
}

export type TaskStatus =
  | "open"
  | "in_progress"
  | "draft_saved"
  | "needs_review"
  | "changes_requested"
  | "reviewed"
  | "exported"
  | "skipped"
  | "reopened";

/** an assigned unit of RA work over one site or one source */
export interface WorkTask {
  taskId: string;
  countryCode: string;
  batchId: string;
  /** existing project site, when the task starts from one */
  siteId?: string;
  siteName?: string;
  taskKind: "verify_site" | "source_extraction" | "deep_history";
  instructions: string;
  targetYears: number[];
  status: TaskStatus;
  lat?: number;
  lng?: number;
}

/** the evidence an RA drafts against a task; superset of the pilot's
    site_evidence_wide row, extended with deep-history fields */
export interface EvidenceDraft {
  draftId: string;
  taskId: string;
  countryCode: string;
  existenceStatus?: ExistenceStatus;
  worshipUseStatus?: WorshipUseStatus;
  targetYearStatuses: Record<string, TargetYearStatus>;
  assessmentConfidence?: Confidence;
  siteMatchConfidence?: Confidence;
  location?: LocationEvidence;
  attributes?: SiteAttributes;
  lifecycle: LifecycleClaim[];
  sources: SourceRecord[];
  evidenceNotes?: string;
  /** useful-but-incomplete evidence: parked for review, not submitted */
  unresolvedNote?: string;
  updatedAt: string;
  state: "draft" | "submitted" | "superseded";
}
