import { useEffect, useState } from "react";
import type { CountryConfig } from "../config";
import type { WorkbenchProvider } from "../data/provider";
import type {
  Confidence,
  EvidenceDraft,
  EvidenceDraftState,
  ExistenceStatus,
  FieldProvenanceState,
  GeocodingBasis,
  LifecycleClaim,
  LifecycleEventType,
  SourceRecord,
  SourceType,
  TargetYearStatus,
  WorkTask,
  WorshipUseStatus,
} from "../data/types";

// Evidence intake for one task or provisional free contribution.
// Controlled vocabulary lives in dropdowns (style-guide rule); free
// text is for source-specific detail only.

const PARTIAL_DATE = /^\d{4}(-\d{2})?(-\d{2})?$/;
const NO_BUILDING = "no_building_present";

type WorshipUseChoice = WorshipUseStatus | typeof NO_BUILDING | "";

export const sourceTypes: { value: SourceType; label: string }[] = [
  { value: "osm_history", label: "OSM history" },
  { value: "osm_date_tags", label: "OSM date tags" },
  { value: "census_or_statistics", label: "Census or official statistics" },
  { value: "church_record", label: "Church or mission record" },
  { value: "denominational_directory", label: "Denominational directory" },
  { value: "denominational_yearbook", label: "Denominational yearbook" },
  { value: "newspaper_archive", label: "Newspaper archive" },
  { value: "heritage_list", label: "Heritage list" },
  { value: "charity_or_society_register", label: "Charity or society register" },
  { value: "charities_register", label: "Charities register" },
  { value: "incorporated_societies", label: "Incorporated societies" },
  { value: "linz_building_outlines", label: "LINZ building outlines" },
  { value: "linz_property", label: "LINZ property or address" },
  { value: "archived_website", label: "Archived website" },
  { value: "local_council", label: "Local council" },
  { value: "map_or_survey", label: "Map or survey" },
  { value: "street_imagery", label: "Street-level imagery" },
  { value: "aerial_imagery", label: "Aerial or satellite imagery" },
  { value: "field_observation", label: "Field observation" },
  { value: "academic_work", label: "Academic work or thesis" },
  { value: "oral_history", label: "Oral history" },
  { value: "other", label: "Other" },
];

const lifecycleTypes: { value: LifecycleEventType; label: string }[] = [
  { value: "founding", label: "Founding" },
  { value: "opening", label: "Opening" },
  { value: "first_seen", label: "First seen in a source" },
  { value: "last_seen", label: "Last seen in a source" },
  { value: "closure", label: "Closure" },
  { value: "demolition", label: "Demolition" },
  { value: "change_of_use", label: "Change of use" },
  { value: "rebuild", label: "Rebuild" },
];

const geocodingBases: { value: GeocodingBasis; label: string }[] = [
  { value: "exact_address", label: "Exact current address" },
  { value: "historical_address_matched", label: "Historical address matched to modern map" },
  { value: "described_locality", label: "Locality described by the source" },
  { value: "map_georeference", label: "Georeferenced from a historical map" },
  { value: "regional_only", label: "Region only, no precise placement" },
  { value: "unknown", label: "Unknown" },
];

const readOnlyStates = new Set<EvidenceDraftState>([
  "submitted",
  "accepted_for_export",
  "rejected",
  "rejected_by_human",
  "unresolved_note",
  "superseded",
]);

export function emptyDraft(task: WorkTask, patch: Partial<EvidenceDraft> = {}): EvidenceDraft {
  return {
    draftId: `${task.taskId}-${Date.now().toString(36)}`,
    taskId: task.taskId,
    countryCode: task.countryCode,
    targetYearStatuses: {},
    lifecycle: [],
    sources: [],
    updatedAt: new Date().toISOString(),
    state: "draft",
    ...patch,
  };
}

function draftWorshipChoice(draft: EvidenceDraft): WorshipUseChoice {
  if (draft.existenceStatus === "absent" && draft.worshipUseStatus === "not_worship") {
    return NO_BUILDING;
  }
  return draft.worshipUseStatus ?? "";
}

function stateLabel(state: EvidenceDraftState): string {
  if (state === "submitted") return "submitted for review";
  if (state === "accepted_for_export") return "accepted for export";
  if (state === "agent_draft") return "agent draft";
  if (state === "human_confirmed") return "human confirmed";
  if (state === "rejected_by_human") return "rejected by human";
  if (state === "unresolved_note") return "unresolved note";
  return state.replace(/_/g, " ");
}

export function draftStateClass(state: EvidenceDraftState): string {
  if (state === "submitted" || state === "accepted_for_export" || state === "human_confirmed") {
    return "status-present";
  }
  if (state === "rejected" || state === "rejected_by_human" || state === "superseded") {
    return "status-absent";
  }
  if (state === "draft" || state === "agent_draft" || state === "unresolved_note") {
    return "status-uncertain";
  }
  return "status-not-assessed";
}

export function FieldProvenanceBadge(props: { state: FieldProvenanceState | undefined }) {
  if (!props.state) return null;
  const label =
    props.state === "agent_suggested"
      ? "agent suggested"
      : props.state === "human_edited"
        ? "human edited"
        : "human added";
  return <span className={`status-pill provenance-${props.state}`}>{label}</span>;
}

function ConfidenceSelect(props: {
  value: Confidence | undefined;
  onChange: (value: Confidence | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <select
      disabled={props.disabled}
      value={props.value ?? ""}
      onChange={(event) => props.onChange((event.target.value || undefined) as Confidence | undefined)}
    >
      <option value="">not set</option>
      <option value="high">high</option>
      <option value="medium">medium</option>
      <option value="low">low</option>
    </select>
  );
}

export function EvidenceForm(props: {
  task: WorkTask;
  country: CountryConfig;
  provider: WorkbenchProvider;
  onChanged: () => Promise<void>;
}) {
  const { task, country, provider } = props;
  const [draft, setDraft] = useState<EvidenceDraft>(() => emptyDraft(task));

  useEffect(() => {
    let cancelled = false;
    void provider.getDraft(task.taskId).then((existing) => {
      if (cancelled) return;
      setDraft(existing ?? emptyDraft(task));
    });
    return () => {
      cancelled = true;
    };
  }, [provider, task]);

  return (
    <DraftEvidenceEditor
      task={task}
      country={country}
      provider={provider}
      draft={draft}
      onDraftChange={setDraft}
      onChanged={props.onChanged}
      allowSkip
      showTaskHeader
    />
  );
}

export function DraftEvidenceEditor(props: {
  task: WorkTask;
  country: CountryConfig;
  provider: WorkbenchProvider;
  draft: EvidenceDraft;
  onDraftChange: (draft: EvidenceDraft) => void;
  onChanged: () => Promise<void>;
  allowSkip?: boolean;
  lockSources?: boolean;
  showTaskHeader?: boolean;
}) {
  const { task, country, provider } = props;
  const [worshipChoice, setWorshipChoice] = useState<WorshipUseChoice>(() =>
    draftWorshipChoice(props.draft),
  );
  const [sensitivityAcknowledged, setSensitivityAcknowledged] = useState(
    props.draft.attributes?.culturallySensitive !== undefined,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    setWorshipChoice(draftWorshipChoice(props.draft));
    setSensitivityAcknowledged(props.draft.attributes?.culturallySensitive !== undefined);
  }, [props.draft.draftId, props.draft.attributes?.culturallySensitive, props.draft.worshipUseStatus, props.draft.existenceStatus]);

  const readOnly = readOnlyStates.has(props.draft.state);

  function update(patch: Partial<EvidenceDraft>): void {
    props.onDraftChange({ ...props.draft, ...patch });
  }

  function normalisedForSave(): EvidenceDraft {
    if (worshipChoice === NO_BUILDING) {
      return { ...props.draft, existenceStatus: "absent", worshipUseStatus: "not_worship" };
    }
    const worshipUseStatus = (worshipChoice || undefined) as WorshipUseStatus | undefined;
    if (worshipUseStatus === undefined) return { ...props.draft, worshipUseStatus: undefined };
    return { ...props.draft, worshipUseStatus };
  }

  function validateForSubmit(candidate: EvidenceDraft): string[] {
    const found: string[] = [];
    if (candidate.state === "agent_draft") {
      found.push("Agent draft claims need human confirmation before submission.");
    }
    if (candidate.state === "rejected_by_human") {
      found.push("Rejected agent drafts cannot be submitted.");
    }
    if (candidate.sources.length === 0) found.push("At least one source is required to submit.");
    for (const source of candidate.sources) {
      if (!source.title.trim() || /^n\/?a$/i.test(source.title.trim())) {
        found.push("Every source needs a real title (not NA).");
      }
      if (!source.url?.trim() && !source.archiveRef) {
        found.push("Every source needs either a URL or an archive reference.");
      }
      if (source.archiveRef && (!source.archiveRef.repositoryName.trim() || !source.archiveRef.collection.trim())) {
        found.push("Archive references need a repository and collection.");
      }
      if (source.archiveRef && !source.archiveRef.consultedDate.trim()) {
        found.push("Archive references need a consulted date.");
      }
      for (const [label, value] of [
        ["source date", source.sourceDate],
        ["consulted date", source.consultedDate],
        ["archive consulted date", source.archiveRef?.consultedDate],
      ] as const) {
        if (value && !PARTIAL_DATE.test(value)) {
          found.push(`Source ${label} must be YYYY, YYYY-MM, or YYYY-MM-DD.`);
        }
      }
    }
    for (const claim of candidate.lifecycle) {
      for (const value of [claim.date.value, claim.date.notEarlierThan, claim.date.notLaterThan]) {
        if (value && !PARTIAL_DATE.test(value)) {
          found.push("Lifecycle dates must be YYYY, YYYY-MM, or YYYY-MM-DD.");
        }
      }
    }
    if (candidate.attributes?.denominationCode && !candidate.attributes.taxonomyVersion) {
      found.push("A denomination code needs its taxonomy version.");
    }
    if (candidate.location) {
      const hasLat = candidate.location.lat !== undefined;
      const hasLng = candidate.location.lng !== undefined;
      if (hasLat !== hasLng) found.push("Coordinates need both latitude and longitude.");
      if (hasLat && candidate.location.geocodingBasis === "unknown") {
        found.push("Coordinates need a geocoding basis.");
      }
      if (
        candidate.location.geocodingBasis === "regional_only" &&
        !candidate.location.containingArea?.areaName.trim()
      ) {
        found.push("Regional-only claims need a containing area.");
      }
    }
    if (country.culturalSensitivityPrompt && !sensitivityAcknowledged) {
      found.push("Complete the cultural-sensitivity prompt before submitting.");
    }
    return found;
  }

  async function handleSave(): Promise<void> {
    const candidate = normalisedForSave();
    await provider.saveDraft(candidate);
    props.onDraftChange(candidate);
    setMessage("Draft saved.");
    setProblems([]);
    await props.onChanged();
  }

  async function handleSubmit(): Promise<void> {
    const candidate = normalisedForSave();
    const found = validateForSubmit(candidate);
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    try {
      await provider.saveDraft(candidate);
      await provider.submitForReview(candidate.draftId);
      props.onDraftChange({ ...candidate, state: "submitted", updatedAt: new Date().toISOString() });
      setMessage("Submitted for review.");
      setProblems([]);
      await props.onChanged();
    } catch (error) {
      setProblems([error instanceof Error ? error.message : "Submission failed."]);
    }
  }

  async function handleSkip(): Promise<void> {
    await provider.skipTask(task.taskId);
    setMessage("Task skipped.");
    await props.onChanged();
  }

  return (
    <div>
      {props.showTaskHeader && (
        <>
          <h1>{task.siteName ?? task.taskId}</h1>
          <p className="field-note">
            {task.taskKind.replace(/_/g, " ")} · batch {task.batchId}
            {task.siteId ? ` · site ${task.siteId}` : " · source-first (no site yet)"}
          </p>
          <p>{task.instructions}</p>
        </>
      )}

      <div className="state-line">
        <span className={`status-pill ${draftStateClass(props.draft.state)}`}>
          {stateLabel(props.draft.state)}
        </span>
        {props.draft.lane === "agent_assisted_ra" && (
          <span className="status-pill status-not-assessed">agent-assisted</span>
        )}
      </div>

      {readOnly && (
        <div className="demo-warning">
          This evidence is not editable in its current state. Revisions create
          a new evidence version rather than rewriting this one.
        </div>
      )}

      {props.draft.state === "agent_draft" && (
        <div className="demo-warning">
          Agent draft claims cannot be submitted until a human confirms the
          extracted claim.
        </div>
      )}

      {country.culturalSensitivityPrompt && (
        <fieldset>
          <legend>Cultural sensitivity</legend>
          <label htmlFor={`${props.draft.draftId}-sensitive`}>
            Is this a customary or kastom site, or otherwise culturally sensitive?
          </label>
          <select
            id={`${props.draft.draftId}-sensitive`}
            disabled={readOnly}
            value={
              sensitivityAcknowledged
                ? props.draft.attributes?.culturallySensitive
                  ? "yes"
                  : "no"
                : ""
            }
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              setSensitivityAcknowledged(true);
              update({
                attributes: { ...props.draft.attributes, culturallySensitive: value === "yes" },
              });
            }}
          >
            <option value="">choose before entering location detail</option>
            <option value="no">No</option>
            <option value="yes">Yes, handle location and detail as sensitive</option>
          </select>
          {props.draft.attributes?.culturallySensitive && (
            <>
              <label htmlFor={`${props.draft.draftId}-sensitivity-notes`}>Sensitivity notes</label>
              <textarea
                id={`${props.draft.draftId}-sensitivity-notes`}
                disabled={readOnly}
                value={props.draft.attributes?.sensitivityBasis ?? ""}
                onChange={(event) =>
                  update({
                    attributes: { ...props.draft.attributes, sensitivityBasis: event.target.value },
                  })
                }
              />
            </>
          )}
        </fieldset>
      )}

      <AssessmentFields
        draft={props.draft}
        country={country}
        readOnly={readOnly}
        worshipChoice={worshipChoice}
        setWorshipChoice={setWorshipChoice}
        update={update}
      />
      <LocationFields draft={props.draft} readOnly={readOnly} update={update} />
      <AttributeFields draft={props.draft} readOnly={readOnly} update={update} />
      <LifecycleFields
        draft={props.draft}
        readOnly={readOnly}
        update={update}
        floorYear={country.lifecycleFloorYear}
      />
      <SourceFields
        draft={props.draft}
        readOnly={readOnly || Boolean(props.lockSources)}
        update={update}
        country={country}
      />

      <fieldset>
        <legend>Notes</legend>
        <label htmlFor={`${props.draft.draftId}-evidence-notes`}>Evidence notes</label>
        <textarea
          id={`${props.draft.draftId}-evidence-notes`}
          disabled={readOnly}
          value={props.draft.evidenceNotes ?? ""}
          onChange={(event) => update({ evidenceNotes: event.target.value })}
        />
      </fieldset>

      {problems.length > 0 && (
        <div className="demo-warning">
          <strong>Before submitting:</strong>
          <ul className="compact-list">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {message && <p className="field-note">{message}</p>}

      <div className="action-row">
        <button disabled={readOnly} onClick={() => void handleSave()}>
          Save draft
        </button>
        <button disabled={readOnly || props.draft.state === "agent_draft"} onClick={() => void handleSubmit()}>
          Submit for review
        </button>
        {props.allowSkip && (
          <button className="secondary" disabled={readOnly} onClick={() => void handleSkip()}>
            Skip this task
          </button>
        )}
      </div>
      <UnresolvedNote
        draft={props.draft}
        provider={provider}
        readOnly={readOnly}
        onDraftChange={props.onDraftChange}
        onChanged={props.onChanged}
      />
    </div>
  );
}

function AssessmentFields(props: {
  draft: EvidenceDraft;
  country: CountryConfig;
  readOnly: boolean;
  worshipChoice: WorshipUseChoice;
  setWorshipChoice: (choice: WorshipUseChoice) => void;
  update: (patch: Partial<EvidenceDraft>) => void;
}) {
  return (
    <fieldset>
      <legend>Assessment</legend>
      <label htmlFor={`${props.draft.draftId}-worship-use`}>Worship use</label>
      <select
        id={`${props.draft.draftId}-worship-use`}
        disabled={props.readOnly}
        value={props.worshipChoice}
        onChange={(event) => props.setWorshipChoice(event.target.value as WorshipUseChoice)}
      >
        <option value="">not set</option>
        <option value="confirmed_worship">Confirmed worship use</option>
        <option value="probable_worship">Probable worship use</option>
        <option value="organisation_only">Organisation only</option>
        <option value="building_only">Building only</option>
        <option value="not_worship">Not in worship use</option>
        <option value={NO_BUILDING}>No building present</option>
        <option value="uncertain">Uncertain</option>
      </select>
      <div className="field-note">
        No building present records building absence, distinct from worship-use closure.
      </div>

      {props.worshipChoice !== NO_BUILDING && (
        <>
          <label htmlFor={`${props.draft.draftId}-existence`}>Building existence</label>
          <select
            id={`${props.draft.draftId}-existence`}
            disabled={props.readOnly}
            value={props.draft.existenceStatus ?? ""}
            onChange={(event) =>
              props.update({
                existenceStatus: (event.target.value || undefined) as ExistenceStatus | undefined,
              })
            }
          >
            <option value="">not set</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="uncertain">Uncertain</option>
          </select>
        </>
      )}

      <label>Target-year status ({props.country.countryName})</label>
      {props.country.targetYears.map((year) => (
        <div key={year} className="target-year-row">
          <span>{year}</span>
          <select
            disabled={props.readOnly}
            value={props.draft.targetYearStatuses[String(year)] ?? "not_assessed"}
            onChange={(event) =>
              props.update({
                targetYearStatuses: {
                  ...props.draft.targetYearStatuses,
                  [String(year)]: event.target.value as TargetYearStatus,
                },
              })
            }
          >
            <option value="not_assessed">not assessed</option>
            <option value="present">present</option>
            <option value="absent">absent</option>
            <option value="uncertain">uncertain</option>
          </select>
        </div>
      ))}

      <label>Assessment confidence</label>
      <ConfidenceSelect
        disabled={props.readOnly}
        value={props.draft.assessmentConfidence}
        onChange={(assessmentConfidence) => {
          const next = { ...props.draft };
          if (assessmentConfidence === undefined) delete next.assessmentConfidence;
          else next.assessmentConfidence = assessmentConfidence;
          props.update(next);
        }}
      />
      <label>Site-match confidence</label>
      <ConfidenceSelect
        disabled={props.readOnly}
        value={props.draft.siteMatchConfidence}
        onChange={(siteMatchConfidence) => {
          const next = { ...props.draft };
          if (siteMatchConfidence === undefined) delete next.siteMatchConfidence;
          else next.siteMatchConfidence = siteMatchConfidence;
          props.update(next);
        }}
      />
    </fieldset>
  );
}

function LocationFields(props: {
  draft: EvidenceDraft;
  readOnly: boolean;
  update: (patch: Partial<EvidenceDraft>) => void;
}) {
  const location = props.draft.location ?? {
    geocodingBasis: "unknown" as GeocodingBasis,
    locationConfidence: "low" as Confidence,
  };
  function patch(next: Partial<typeof location>): void {
    props.update({ location: { ...location, ...next } });
  }
  return (
    <fieldset>
      <legend>Location evidence</legend>
      <label htmlFor={`${props.draft.draftId}-street-address`}>Source-backed street address</label>
      <input
        id={`${props.draft.draftId}-street-address`}
        disabled={props.readOnly}
        value={location.streetAddress ?? ""}
        onChange={(event) => patch({ streetAddress: event.target.value })}
      />
      <label htmlFor={`${props.draft.draftId}-locality`}>Locality</label>
      <input
        id={`${props.draft.draftId}-locality`}
        disabled={props.readOnly}
        value={location.locality ?? ""}
        onChange={(event) => patch({ locality: event.target.value })}
      />
      <label htmlFor={`${props.draft.draftId}-address-notes`}>Address notes</label>
      <input
        id={`${props.draft.draftId}-address-notes`}
        disabled={props.readOnly}
        value={location.addressNotes ?? ""}
        onChange={(event) => patch({ addressNotes: event.target.value })}
        placeholder="renamed street, demolished block, changed numbering"
      />
      <div className="form-grid two">
        <div>
          <label htmlFor={`${props.draft.draftId}-lat`}>Latitude</label>
          <input
            id={`${props.draft.draftId}-lat`}
            disabled={props.readOnly}
            inputMode="decimal"
            value={location.lat ?? ""}
            onChange={(event) => {
              const next = { ...location };
              if (event.target.value === "" || Number.isNaN(Number(event.target.value))) delete next.lat;
              else next.lat = Number(event.target.value);
              props.update({ location: next });
            }}
          />
        </div>
        <div>
          <label htmlFor={`${props.draft.draftId}-lng`}>Longitude</label>
          <input
            id={`${props.draft.draftId}-lng`}
            disabled={props.readOnly}
            inputMode="decimal"
            value={location.lng ?? ""}
            onChange={(event) => {
              const next = { ...location };
              if (event.target.value === "" || Number.isNaN(Number(event.target.value))) delete next.lng;
              else next.lng = Number(event.target.value);
              props.update({ location: next });
            }}
          />
        </div>
      </div>
      <label htmlFor={`${props.draft.draftId}-geocoding-basis`}>Geocoding basis</label>
      <select
        id={`${props.draft.draftId}-geocoding-basis`}
        disabled={props.readOnly}
        value={location.geocodingBasis}
        onChange={(event) => patch({ geocodingBasis: event.target.value as GeocodingBasis })}
      >
        {geocodingBases.map((basis) => (
          <option key={basis.value} value={basis.value}>
            {basis.label}
          </option>
        ))}
      </select>

      <div className="form-grid three">
        <div>
          <label htmlFor={`${props.draft.draftId}-area-name`}>Containing area</label>
          <input
            id={`${props.draft.draftId}-area-name`}
            disabled={props.readOnly}
            value={location.containingArea?.areaName ?? ""}
            onChange={(event) =>
              patch({
                containingArea: {
                  ...location.containingArea,
                  areaName: event.target.value,
                },
              })
            }
          />
        </div>
        <div>
          <label htmlFor={`${props.draft.draftId}-area-type`}>Area type</label>
          <input
            id={`${props.draft.draftId}-area-type`}
            disabled={props.readOnly}
            value={location.containingArea?.areaType ?? ""}
            onChange={(event) =>
              patch({
                containingArea: {
                  ...location.containingArea,
                  areaName: location.containingArea?.areaName ?? "",
                  areaType: event.target.value || undefined,
                },
              })
            }
          />
        </div>
        <div>
          <label htmlFor={`${props.draft.draftId}-area-country`}>Area country</label>
          <input
            id={`${props.draft.draftId}-area-country`}
            disabled={props.readOnly}
            value={location.containingArea?.countryCode ?? props.draft.countryCode}
            onChange={(event) =>
              patch({
                containingArea: {
                  ...location.containingArea,
                  areaName: location.containingArea?.areaName ?? "",
                  countryCode: event.target.value || undefined,
                },
              })
            }
          />
        </div>
      </div>

      <label>Location confidence</label>
      <ConfidenceSelect
        disabled={props.readOnly}
        value={location.locationConfidence}
        onChange={(confidence) => patch({ locationConfidence: confidence ?? "low" })}
      />
    </fieldset>
  );
}

function AttributeFields(props: {
  draft: EvidenceDraft;
  readOnly: boolean;
  update: (patch: Partial<EvidenceDraft>) => void;
}) {
  const attributes = props.draft.attributes ?? {};
  function patch(next: Partial<typeof attributes>): void {
    props.update({ attributes: { ...attributes, ...next } });
  }
  return (
    <fieldset>
      <legend>Place attributes (as the source states them)</legend>
      <label htmlFor={`${props.draft.draftId}-site-name`}>Name in the source</label>
      <input
        id={`${props.draft.draftId}-site-name`}
        disabled={props.readOnly}
        value={attributes.name ?? ""}
        onChange={(event) => patch({ name: event.target.value })}
      />
      <label htmlFor={`${props.draft.draftId}-religion`}>Religion</label>
      <input
        id={`${props.draft.draftId}-religion`}
        disabled={props.readOnly}
        value={attributes.religion ?? ""}
        onChange={(event) => patch({ religion: event.target.value })}
      />
      <div className="form-grid two">
        <div>
          <label htmlFor={`${props.draft.draftId}-denomination-code`}>Denomination code</label>
          <input
            id={`${props.draft.draftId}-denomination-code`}
            disabled={props.readOnly}
            value={attributes.denominationCode ?? ""}
            onChange={(event) => patch({ denominationCode: event.target.value })}
            placeholder="dotted code from the taxonomy"
          />
        </div>
        <div>
          <label htmlFor={`${props.draft.draftId}-taxonomy-version`}>Taxonomy version</label>
          <input
            id={`${props.draft.draftId}-taxonomy-version`}
            disabled={props.readOnly}
            value={attributes.taxonomyVersion ?? ""}
            onChange={(event) => patch({ taxonomyVersion: event.target.value })}
            placeholder="e.g. 2026-06-12.1"
          />
        </div>
      </div>
      <label htmlFor={`${props.draft.draftId}-material`}>Building material</label>
      <input
        id={`${props.draft.draftId}-material`}
        disabled={props.readOnly}
        value={attributes.buildingMaterial ?? ""}
        onChange={(event) => patch({ buildingMaterial: event.target.value })}
        placeholder="timber, coral lime, concrete"
      />
      <label htmlFor={`${props.draft.draftId}-architecture-notes`}>Architecture and fabric notes</label>
      <textarea
        id={`${props.draft.draftId}-architecture-notes`}
        disabled={props.readOnly}
        value={attributes.architectureNotes ?? ""}
        onChange={(event) => patch({ architectureNotes: event.target.value })}
      />
    </fieldset>
  );
}

function LifecycleFields(props: {
  draft: EvidenceDraft;
  readOnly: boolean;
  update: (patch: Partial<EvidenceDraft>) => void;
  floorYear: number;
}) {
  function setClaim(index: number, claim: LifecycleClaim): void {
    const lifecycle = props.draft.lifecycle.slice();
    lifecycle[index] = claim;
    props.update({ lifecycle });
  }
  return (
    <fieldset>
      <legend>Lifecycle claims (accepted from {props.floorYear})</legend>
      {props.draft.lifecycle.map((claim, index) => (
        <div key={`${claim.eventKind}-${index}`} className="subsection">
          <label>Event</label>
          <select
            disabled={props.readOnly}
            value={claim.eventKind}
            onChange={(event) =>
              setClaim(index, { ...claim, eventKind: event.target.value as LifecycleEventType })
            }
          >
            {lifecycleTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <div className="form-grid three">
            <div>
              <label>Date</label>
              <input
                disabled={props.readOnly}
                value={claim.date.value ?? ""}
                placeholder="YYYY[-MM[-DD]]"
                onChange={(event) => {
                  const date = { ...claim.date };
                  if (event.target.value) date.value = event.target.value;
                  else delete date.value;
                  setClaim(index, { ...claim, date });
                }}
              />
            </div>
            <div>
              <label>Not earlier than</label>
              <input
                disabled={props.readOnly}
                value={claim.date.notEarlierThan ?? ""}
                placeholder="YYYY"
                onChange={(event) => {
                  const date = { ...claim.date };
                  if (event.target.value) date.notEarlierThan = event.target.value;
                  else delete date.notEarlierThan;
                  setClaim(index, { ...claim, date });
                }}
              />
            </div>
            <div>
              <label>Not later than</label>
              <input
                disabled={props.readOnly}
                value={claim.date.notLaterThan ?? ""}
                placeholder="YYYY"
                onChange={(event) => {
                  const date = { ...claim.date };
                  if (event.target.value) date.notLaterThan = event.target.value;
                  else delete date.notLaterThan;
                  setClaim(index, { ...claim, date });
                }}
              />
            </div>
          </div>
          <label>Confidence</label>
          <ConfidenceSelect
            disabled={props.readOnly}
            value={claim.confidence}
            onChange={(confidence) => setClaim(index, { ...claim, confidence: confidence ?? "low" })}
          />
          {!props.readOnly && (
            <button
              className="tertiary"
              onClick={() => props.update({ lifecycle: props.draft.lifecycle.filter((_, i) => i !== index) })}
            >
              Remove claim
            </button>
          )}
        </div>
      ))}
      {!props.readOnly && (
        <button
          className="secondary"
          onClick={() =>
            props.update({
              lifecycle: [
                ...props.draft.lifecycle,
                { eventKind: "opening", date: {}, confidence: "low" },
              ],
            })
          }
        >
          Add lifecycle claim
        </button>
      )}
    </fieldset>
  );
}

function SourceFields(props: {
  draft: EvidenceDraft;
  readOnly: boolean;
  update: (patch: Partial<EvidenceDraft>) => void;
  country: CountryConfig;
}) {
  function setSource(index: number, source: SourceRecord): void {
    const sources = props.draft.sources.slice();
    sources[index] = source;
    props.update({ sources });
  }
  return (
    <fieldset>
      <legend>Sources</legend>
      <div className="field-note">
        Suggested for {props.country.countryName}:{" "}
        {props.country.suggestedSources.map((source, index) => (
          <span key={source.url}>
            {index > 0 && " · "}
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
          </span>
        ))}
      </div>
      {props.draft.sources.map((source, index) => (
        <div key={source.sourceRecordId ?? index} className="subsection">
          <label>Source type</label>
          <select
            disabled={props.readOnly}
            value={source.sourceType}
            onChange={(event) => setSource(index, { ...source, sourceType: event.target.value as SourceType })}
          >
            {sourceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <label>Title</label>
          <input
            disabled={props.readOnly}
            value={source.title}
            onChange={(event) => setSource(index, { ...source, title: event.target.value })}
          />
          <label>URL</label>
          <input
            disabled={props.readOnly}
            value={source.url ?? ""}
            onChange={(event) => {
              const next = { ...source };
              if (event.target.value) next.url = event.target.value;
              else delete next.url;
              setSource(index, next);
            }}
          />
          <div className="form-grid two">
            <div>
              <label>Archive repository</label>
              <input
                disabled={props.readOnly}
                value={source.archiveRef?.repositoryName ?? ""}
                onChange={(event) => {
                  const archiveRef = {
                    repositoryName: event.target.value,
                    collection: source.archiveRef?.collection ?? "",
                    consultedDate: source.archiveRef?.consultedDate ?? "",
                    itemRef: source.archiveRef?.itemRef,
                    location: source.archiveRef?.location,
                  };
                  setSource(index, { ...source, archiveRef });
                }}
              />
            </div>
            <div>
              <label>Archive collection</label>
              <input
                disabled={props.readOnly}
                value={source.archiveRef?.collection ?? ""}
                onChange={(event) => {
                  const archiveRef = {
                    repositoryName: source.archiveRef?.repositoryName ?? "",
                    collection: event.target.value,
                    consultedDate: source.archiveRef?.consultedDate ?? "",
                    itemRef: source.archiveRef?.itemRef,
                    location: source.archiveRef?.location,
                  };
                  setSource(index, { ...source, archiveRef });
                }}
              />
            </div>
          </div>
          <div className="form-grid three">
            <div>
              <label>Archive item</label>
              <input
                disabled={props.readOnly}
                value={source.archiveRef?.itemRef ?? ""}
                onChange={(event) => {
                  const archiveRef = {
                    repositoryName: source.archiveRef?.repositoryName ?? "",
                    collection: source.archiveRef?.collection ?? "",
                    consultedDate: source.archiveRef?.consultedDate ?? "",
                    itemRef: event.target.value || undefined,
                    location: source.archiveRef?.location,
                  };
                  setSource(index, { ...source, archiveRef });
                }}
              />
            </div>
            <div>
              <label>Archive consulted date</label>
              <input
                disabled={props.readOnly}
                value={source.archiveRef?.consultedDate ?? ""}
                placeholder="YYYY[-MM[-DD]]"
                onChange={(event) => {
                  const archiveRef = {
                    repositoryName: source.archiveRef?.repositoryName ?? "",
                    collection: source.archiveRef?.collection ?? "",
                    consultedDate: event.target.value,
                    itemRef: source.archiveRef?.itemRef,
                    location: source.archiveRef?.location,
                  };
                  setSource(index, { ...source, archiveRef });
                }}
              />
            </div>
            <div>
              <label>Archive location</label>
              <input
                disabled={props.readOnly}
                value={source.archiveRef?.location ?? ""}
                onChange={(event) => {
                  const archiveRef = {
                    repositoryName: source.archiveRef?.repositoryName ?? "",
                    collection: source.archiveRef?.collection ?? "",
                    consultedDate: source.archiveRef?.consultedDate ?? "",
                    itemRef: source.archiveRef?.itemRef,
                    location: event.target.value || undefined,
                  };
                  setSource(index, { ...source, archiveRef });
                }}
              />
            </div>
          </div>
          <div className="form-grid two">
            <div>
              <label>Source date</label>
              <input
                disabled={props.readOnly}
                value={source.sourceDate ?? ""}
                placeholder="YYYY[-MM[-DD]]"
                onChange={(event) => {
                  const next = { ...source };
                  if (event.target.value) next.sourceDate = event.target.value;
                  else delete next.sourceDate;
                  setSource(index, next);
                }}
              />
            </div>
            <div>
              <label>Consulted date</label>
              <input
                disabled={props.readOnly}
                value={source.consultedDate ?? ""}
                placeholder="when you accessed it"
                onChange={(event) => {
                  const next = { ...source };
                  if (event.target.value) next.consultedDate = event.target.value;
                  else delete next.consultedDate;
                  setSource(index, next);
                }}
              />
            </div>
          </div>
          <label>Notes</label>
          <input
            disabled={props.readOnly}
            value={source.notes ?? ""}
            onChange={(event) => setSource(index, { ...source, notes: event.target.value })}
          />
          {!props.readOnly && (
            <button
              className="tertiary"
              onClick={() => props.update({ sources: props.draft.sources.filter((_, i) => i !== index) })}
            >
              Remove source
            </button>
          )}
        </div>
      ))}
      {!props.readOnly && (
        <button
          className="secondary"
          onClick={() =>
            props.update({
              sources: [...props.draft.sources, { sourceType: "other", title: "" }],
            })
          }
        >
          Add source
        </button>
      )}
    </fieldset>
  );
}

function UnresolvedNote(props: {
  draft: EvidenceDraft;
  provider: WorkbenchProvider;
  readOnly: boolean;
  onDraftChange: (draft: EvidenceDraft) => void;
  onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState(props.draft.unresolvedNote ?? "");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setNote(props.draft.unresolvedNote ?? "");
    setSent(false);
  }, [props.draft.draftId, props.draft.unresolvedNote]);

  return (
    <fieldset>
      <legend>Unresolved note</legend>
      <div className="field-note">
        Useful but incomplete evidence: park it here for a reviewer instead of
        forcing a submission.
      </div>
      <textarea disabled={props.readOnly} value={note} onChange={(event) => setNote(event.target.value)} />
      <button
        className="secondary"
        disabled={props.readOnly || !note.trim() || sent}
        onClick={() =>
          void (async () => {
            await props.provider.saveDraft(props.draft);
            await props.provider.submitUnresolvedNote(props.draft.draftId, note.trim());
            props.onDraftChange({
              ...props.draft,
              state: "unresolved_note",
              unresolvedNote: note.trim(),
              updatedAt: new Date().toISOString(),
            });
            setSent(true);
            await props.onChanged();
          })()
        }
      >
        Submit unresolved note
      </button>
    </fieldset>
  );
}
