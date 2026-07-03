import { useEffect, useState } from "react";
import type { CountryConfig } from "../config";
import type { WorkbenchProvider } from "../data/provider";
import type {
  Confidence,
  EvidenceDraft,
  ExistenceStatus,
  GeocodingBasis,
  LifecycleClaim,
  LifecycleEventType,
  SourceRecord,
  SourceType,
  TargetYearStatus,
  WorkTask,
  WorshipUseStatus,
} from "../data/types";

// evidence intake for one task. controlled vocabulary lives in dropdowns
// (style-guide rule); free text is for source-specific detail only.
// "No building present" is a visible worship-use option that normalises
// to existence_status=absent + worship_use_status=not_worship on save.

const PARTIAL_DATE = /^\d{4}(-\d{2})?(-\d{2})?$/;

const NO_BUILDING = "no_building_present";

type WorshipUseChoice = WorshipUseStatus | typeof NO_BUILDING | "";

const sourceTypes: { value: SourceType; label: string }[] = [
  { value: "census_or_statistics", label: "Census or official statistics" },
  { value: "church_record", label: "Church or mission record" },
  { value: "denominational_yearbook", label: "Denominational yearbook" },
  { value: "newspaper_archive", label: "Newspaper archive" },
  { value: "heritage_register", label: "Heritage register" },
  { value: "charity_or_society_register", label: "Charity or society register" },
  { value: "map_or_survey", label: "Map or survey" },
  { value: "street_imagery", label: "Street-level imagery" },
  { value: "aerial_imagery", label: "Aerial or satellite imagery" },
  { value: "field_observation", label: "Field observation" },
  { value: "osm_date_tags", label: "OSM date tags" },
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
  { value: "relocation", label: "Relocation" },
  { value: "rebuild", label: "Rebuild" },
  { value: "renaming", label: "Renaming" },
  { value: "denomination_change", label: "Denomination change" },
];

const geocodingBases: { value: GeocodingBasis; label: string }[] = [
  { value: "exact_address", label: "Exact current address" },
  { value: "historical_address_matched", label: "Historical address matched to modern map" },
  { value: "described_locality", label: "Locality described by the source" },
  { value: "map_georeference", label: "Georeferenced from a historical map" },
  { value: "regional_only", label: "Region only — no precise placement" },
  { value: "unknown", label: "Unknown" },
];

function emptyDraft(task: WorkTask): EvidenceDraft {
  return {
    draftId: `${task.taskId}-${Date.now().toString(36)}`,
    taskId: task.taskId,
    countryCode: task.countryCode,
    targetYearStatuses: {},
    lifecycle: [],
    sources: [],
    updatedAt: new Date().toISOString(),
    state: "draft",
  };
}

function ConfidenceSelect(props: {
  value: Confidence | undefined;
  onChange: (value: Confidence | undefined) => void;
}) {
  return (
    <select
      value={props.value ?? ""}
      onChange={(e) => props.onChange((e.target.value || undefined) as Confidence | undefined)}
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
  const [worshipChoice, setWorshipChoice] = useState<WorshipUseChoice>("");
  const [sensitivityAcknowledged, setSensitivityAcknowledged] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void provider.getDraft(task.taskId).then((existing) => {
      if (cancelled || !existing) return;
      setDraft(existing);
      if (existing.existenceStatus === "absent" && existing.worshipUseStatus === "not_worship") {
        setWorshipChoice(NO_BUILDING);
      } else {
        setWorshipChoice(existing.worshipUseStatus ?? "");
      }
      if (existing.attributes?.culturallySensitive !== undefined) {
        setSensitivityAcknowledged(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, task.taskId]);

  const readOnly = draft.state === "submitted";

  function update(patch: Partial<EvidenceDraft>): void {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function normalisedForSave(): EvidenceDraft {
    if (worshipChoice === NO_BUILDING) {
      return { ...draft, existenceStatus: "absent", worshipUseStatus: "not_worship" };
    }
    const worshipUseStatus = (worshipChoice || undefined) as WorshipUseStatus | undefined;
    return worshipUseStatus === undefined
      ? { ...draft, worshipUseStatus: undefined } as EvidenceDraft
      : { ...draft, worshipUseStatus };
  }

  function validateForSubmit(candidate: EvidenceDraft): string[] {
    const found: string[] = [];
    if (candidate.sources.length === 0) found.push("At least one source is required to submit.");
    for (const s of candidate.sources) {
      if (!s.title.trim() || /^n\/?a$/i.test(s.title.trim()))
        found.push("Every source needs a real title (not NA).");
      for (const [label, value] of [
        ["source date", s.sourceDate],
        ["capture date", s.captureDate],
      ] as const) {
        if (value && !PARTIAL_DATE.test(value))
          found.push(`Source ${label} must be YYYY, YYYY-MM, or YYYY-MM-DD.`);
      }
    }
    for (const claim of candidate.lifecycle) {
      for (const value of [claim.date.value, claim.date.notEarlierThan, claim.date.notLaterThan]) {
        if (value && !PARTIAL_DATE.test(value))
          found.push("Lifecycle dates must be YYYY, YYYY-MM, or YYYY-MM-DD.");
      }
    }
    if (candidate.attributes?.denominationCode && !candidate.attributes.taxonomyVersion)
      found.push("A denomination code needs its taxonomy version.");
    if (country.culturalSensitivityPrompt && !sensitivityAcknowledged)
      found.push("Complete the cultural-sensitivity prompt before submitting.");
    return found;
  }

  async function handleSave(): Promise<void> {
    await provider.saveDraft(normalisedForSave());
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
    await provider.saveDraft(candidate);
    await provider.submitForReview(candidate.draftId);
    setDraft((d) => ({ ...d, state: "submitted" }));
    setMessage("Submitted for review.");
    setProblems([]);
    await props.onChanged();
  }

  async function handleSkip(): Promise<void> {
    await provider.skipTask(task.taskId);
    setMessage("Task skipped.");
    await props.onChanged();
  }

  return (
    <div>
      <h1>{task.siteName ?? task.taskId}</h1>
      <p className="field-note">
        {task.taskKind.replace(/_/g, " ")} · batch {task.batchId}
        {task.siteId ? ` · site ${task.siteId}` : " · source-first (no site yet)"}
      </p>
      <p>{task.instructions}</p>

      {readOnly && (
        <div className="demo-warning">
          This evidence is submitted and read-only. Revising it will create a
          new draft version; the submitted one is kept and marked superseded.
        </div>
      )}

      {country.culturalSensitivityPrompt && (
        <fieldset>
          <legend>Cultural sensitivity</legend>
          <label htmlFor="sensitive">Is this a customary or kastom site, or otherwise culturally sensitive?</label>
          <select
            id="sensitive"
            disabled={readOnly}
            value={
              sensitivityAcknowledged
                ? draft.attributes?.culturallySensitive
                  ? "yes"
                  : "no"
                : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setSensitivityAcknowledged(true);
              update({
                attributes: { ...draft.attributes, culturallySensitive: v === "yes" },
              });
            }}
          >
            <option value="">choose before entering location detail</option>
            <option value="no">No</option>
            <option value="yes">Yes — handle location and detail as sensitive</option>
          </select>
          {draft.attributes?.culturallySensitive && (
            <>
              <label htmlFor="sensitivity-notes">Sensitivity notes</label>
              <textarea
                id="sensitivity-notes"
                disabled={readOnly}
                value={draft.attributes?.sensitivityNotes ?? ""}
                onChange={(e) =>
                  update({
                    attributes: { ...draft.attributes, sensitivityNotes: e.target.value },
                  })
                }
              />
            </>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>Assessment</legend>
        <label htmlFor="worship-use">Worship use</label>
        <select
          id="worship-use"
          disabled={readOnly}
          value={worshipChoice}
          onChange={(e) => setWorshipChoice(e.target.value as WorshipUseChoice)}
        >
          <option value="">not set</option>
          <option value="worship">In worship use</option>
          <option value="shared_use">Shared or multi-purpose use</option>
          <option value="not_worship">Not in worship use</option>
          <option value={NO_BUILDING}>No building present</option>
          <option value="uncertain">Uncertain</option>
        </select>
        <div className="field-note">
          No building present records building absence, distinct from
          worship-use closure.
        </div>

        {worshipChoice !== NO_BUILDING && (
          <>
            <label htmlFor="existence">Building existence</label>
            <select
              id="existence"
              disabled={readOnly}
              value={draft.existenceStatus ?? ""}
              onChange={(e) =>
                update({
                  existenceStatus: (e.target.value || undefined) as ExistenceStatus | undefined,
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

        <label>Target-year status ({country.countryName})</label>
        {country.targetYears.map((year) => (
          <div key={year} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 48 }}>{year}</span>
            <select
              disabled={readOnly}
              value={draft.targetYearStatuses[String(year)] ?? "not_assessed"}
              onChange={(e) =>
                update({
                  targetYearStatuses: {
                    ...draft.targetYearStatuses,
                    [String(year)]: e.target.value as TargetYearStatus,
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
          value={draft.assessmentConfidence}
          onChange={(assessmentConfidence) =>
            setDraft((d) => {
              const next = { ...d };
              if (assessmentConfidence === undefined) delete next.assessmentConfidence;
              else next.assessmentConfidence = assessmentConfidence;
              return next;
            })
          }
        />
        <label>Site-match confidence</label>
        <ConfidenceSelect
          value={draft.siteMatchConfidence}
          onChange={(siteMatchConfidence) =>
            setDraft((d) => {
              const next = { ...d };
              if (siteMatchConfidence === undefined) delete next.siteMatchConfidence;
              else next.siteMatchConfidence = siteMatchConfidence;
              return next;
            })
          }
        />
      </fieldset>

      <LocationFields draft={draft} readOnly={readOnly} update={update} />
      <AttributeFields draft={draft} readOnly={readOnly} update={update} country={country} />
      <LifecycleFields
        draft={draft}
        readOnly={readOnly}
        update={update}
        floorYear={country.lifecycleFloorYear}
      />
      <SourceFields draft={draft} readOnly={readOnly} update={update} country={country} />

      <fieldset>
        <legend>Notes</legend>
        <label htmlFor="evidence-notes">Evidence notes</label>
        <textarea
          id="evidence-notes"
          disabled={readOnly}
          value={draft.evidenceNotes ?? ""}
          onChange={(e) => update({ evidenceNotes: e.target.value })}
        />
      </fieldset>

      {problems.length > 0 && (
        <div className="demo-warning">
          <strong>Before submitting:</strong>
          <ul style={{ margin: "4px 0 0 16px" }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {message && <p className="field-note">{message}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
        <button disabled={readOnly} onClick={() => void handleSave()}>
          Save draft
        </button>
        <button disabled={readOnly} onClick={() => void handleSubmit()}>
          Submit for review
        </button>
        <button className="secondary" disabled={readOnly} onClick={() => void handleSkip()}>
          Skip this task
        </button>
      </div>
      <UnresolvedNote draft={draft} provider={provider} onChanged={props.onChanged} />
    </div>
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
      <label htmlFor="street-address">Source-backed street address</label>
      <input
        id="street-address"
        disabled={props.readOnly}
        value={location.streetAddress ?? ""}
        onChange={(e) => patch({ streetAddress: e.target.value })}
      />
      <label htmlFor="locality">Locality</label>
      <input
        id="locality"
        disabled={props.readOnly}
        value={location.locality ?? ""}
        onChange={(e) => patch({ locality: e.target.value })}
      />
      <label htmlFor="address-notes">Address notes</label>
      <input
        id="address-notes"
        disabled={props.readOnly}
        value={location.addressNotes ?? ""}
        onChange={(e) => patch({ addressNotes: e.target.value })}
        placeholder="renamed street, demolished block, changed numbering…"
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label htmlFor="lat">Latitude</label>
          <input
            id="lat"
            disabled={props.readOnly}
            inputMode="decimal"
            value={location.lat ?? ""}
            onChange={(e) => {
              const next = { ...location };
              if (e.target.value === "" || Number.isNaN(Number(e.target.value))) delete next.lat;
              else next.lat = Number(e.target.value);
              props.update({ location: next });
            }}
          />
        </div>
        <div>
          <label htmlFor="lng">Longitude</label>
          <input
            id="lng"
            disabled={props.readOnly}
            inputMode="decimal"
            value={location.lng ?? ""}
            onChange={(e) => {
              const next = { ...location };
              if (e.target.value === "" || Number.isNaN(Number(e.target.value))) delete next.lng;
              else next.lng = Number(e.target.value);
              props.update({ location: next });
            }}
          />
        </div>
      </div>
      <label htmlFor="geocoding-basis">Geocoding basis</label>
      <select
        id="geocoding-basis"
        disabled={props.readOnly}
        value={location.geocodingBasis}
        onChange={(e) => patch({ geocodingBasis: e.target.value as GeocodingBasis })}
      >
        {geocodingBases.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
      <label>Location confidence</label>
      <ConfidenceSelect
        value={location.locationConfidence}
        onChange={(c) => patch({ locationConfidence: c ?? "low" })}
      />
    </fieldset>
  );
}

function AttributeFields(props: {
  draft: EvidenceDraft;
  readOnly: boolean;
  update: (patch: Partial<EvidenceDraft>) => void;
  country: CountryConfig;
}) {
  const attributes = props.draft.attributes ?? {};
  function patch(next: Partial<typeof attributes>): void {
    props.update({ attributes: { ...attributes, ...next } });
  }
  return (
    <fieldset>
      <legend>Place attributes (as the source states them)</legend>
      <label htmlFor="site-name">Name in the source</label>
      <input
        id="site-name"
        disabled={props.readOnly}
        value={attributes.name ?? ""}
        onChange={(e) => patch({ name: e.target.value })}
      />
      <label htmlFor="religion">Religion</label>
      <input
        id="religion"
        disabled={props.readOnly}
        value={attributes.religion ?? ""}
        onChange={(e) => patch({ religion: e.target.value })}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label htmlFor="denomination-code">Denomination code</label>
          <input
            id="denomination-code"
            disabled={props.readOnly}
            value={attributes.denominationCode ?? ""}
            onChange={(e) => patch({ denominationCode: e.target.value })}
            placeholder="dotted code from the taxonomy"
          />
        </div>
        <div>
          <label htmlFor="taxonomy-version">Taxonomy version</label>
          <input
            id="taxonomy-version"
            disabled={props.readOnly}
            value={attributes.taxonomyVersion ?? ""}
            onChange={(e) => patch({ taxonomyVersion: e.target.value })}
            placeholder="e.g. 2026-06-12.1"
          />
        </div>
      </div>
      <label htmlFor="material">Building material</label>
      <input
        id="material"
        disabled={props.readOnly}
        value={attributes.buildingMaterial ?? ""}
        onChange={(e) => patch({ buildingMaterial: e.target.value })}
        placeholder="timber, coral lime, concrete…"
      />
      <label htmlFor="architecture-notes">Architecture and fabric notes</label>
      <textarea
        id="architecture-notes"
        disabled={props.readOnly}
        value={attributes.architectureNotes ?? ""}
        onChange={(e) => patch({ architectureNotes: e.target.value })}
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
        <div
          key={index}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <label>Event</label>
          <select
            disabled={props.readOnly}
            value={claim.eventType}
            onChange={(e) => setClaim(index, { ...claim, eventType: e.target.value as LifecycleEventType })}
          >
            {lifecycleTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label>Date</label>
              <input
                disabled={props.readOnly}
                value={claim.date.value ?? ""}
                placeholder="YYYY[-MM[-DD]]"
                onChange={(e) => {
                  const date = { ...claim.date };
                  if (e.target.value) date.value = e.target.value;
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
                onChange={(e) => {
                  const date = { ...claim.date };
                  if (e.target.value) date.notEarlierThan = e.target.value;
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
                onChange={(e) => {
                  const date = { ...claim.date };
                  if (e.target.value) date.notLaterThan = e.target.value;
                  else delete date.notLaterThan;
                  setClaim(index, { ...claim, date });
                }}
              />
            </div>
          </div>
          <label>Confidence</label>
          <ConfidenceSelect
            value={claim.confidence}
            onChange={(c) => setClaim(index, { ...claim, confidence: c ?? "low" })}
          />
          {!props.readOnly && (
            <button
              className="tertiary"
              style={{ marginTop: 6 }}
              onClick={() =>
                props.update({ lifecycle: props.draft.lifecycle.filter((_, i) => i !== index) })
              }
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
                { eventType: "opening", date: {}, confidence: "low" },
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
      <div className="field-note" style={{ marginBottom: 6 }}>
        Suggested for {props.country.countryName}:{" "}
        {props.country.suggestedSources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </span>
        ))}
      </div>
      {props.draft.sources.map((source, index) => (
        <div
          key={index}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <label>Source type</label>
          <select
            disabled={props.readOnly}
            value={source.sourceType}
            onChange={(e) => setSource(index, { ...source, sourceType: e.target.value as SourceType })}
          >
            {sourceTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label>Title</label>
          <input
            disabled={props.readOnly}
            value={source.title}
            onChange={(e) => setSource(index, { ...source, title: e.target.value })}
          />
          <label>URL</label>
          <input
            disabled={props.readOnly}
            value={source.url ?? ""}
            onChange={(e) => setSource(index, { ...source, url: e.target.value })}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label>Source date</label>
              <input
                disabled={props.readOnly}
                value={source.sourceDate ?? ""}
                placeholder="YYYY[-MM[-DD]]"
                onChange={(e) => {
                  const next = { ...source };
                  if (e.target.value) next.sourceDate = e.target.value;
                  else delete next.sourceDate;
                  setSource(index, next);
                }}
              />
            </div>
            <div>
              <label>Capture date</label>
              <input
                disabled={props.readOnly}
                value={source.captureDate ?? ""}
                placeholder="when you accessed it"
                onChange={(e) => {
                  const next = { ...source };
                  if (e.target.value) next.captureDate = e.target.value;
                  else delete next.captureDate;
                  setSource(index, next);
                }}
              />
            </div>
          </div>
          <label>Notes</label>
          <input
            disabled={props.readOnly}
            value={source.notes ?? ""}
            onChange={(e) => setSource(index, { ...source, notes: e.target.value })}
          />
          {!props.readOnly && (
            <button
              className="tertiary"
              style={{ marginTop: 6 }}
              onClick={() =>
                props.update({ sources: props.draft.sources.filter((_, i) => i !== index) })
              }
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
  onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState(props.draft.unresolvedNote ?? "");
  const [sent, setSent] = useState(false);
  return (
    <fieldset>
      <legend>Unresolved note</legend>
      <div className="field-note">
        Useful but incomplete evidence: park it here for a reviewer instead of
        forcing a submission.
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        className="secondary"
        style={{ marginTop: 8 }}
        disabled={!note.trim() || sent}
        onClick={() =>
          void (async () => {
            await props.provider.saveDraft(props.draft);
            await props.provider.submitUnresolvedNote(props.draft.draftId, note.trim());
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
