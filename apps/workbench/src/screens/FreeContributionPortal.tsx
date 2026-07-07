import { useEffect, useMemo, useState } from "react";
import type { CountryConfig } from "../config";
import type { WorkbenchProvider } from "../data/provider";
import type {
  DedupCandidate,
  EvidenceDraft,
  FreeContributionHandle,
  SourceRecord,
  SourceRecordInput,
  SourceType,
  WorkTask,
} from "../data/types";
import {
  DraftEvidenceEditor,
  FieldProvenanceBadge,
  draftStateClass,
  sourceTypes,
  stateLabel,
} from "./EvidenceForm";

type PortalMode = "chooser" | "place_first" | "source_first";

interface IdentityFields {
  name: string;
  locality: string;
  lat: string;
  lng: string;
  religion: string;
  denominationCode: string;
  sourceTitle: string;
  sourceNotes: string;
}

const emptyIdentity: IdentityFields = {
  name: "",
  locality: "",
  lat: "",
  lng: "",
  religion: "",
  denominationCode: "",
  sourceTitle: "",
  sourceNotes: "",
};

// identity fields seeded from the map-route context, when there is one
function identityWithContext(context?: { lat?: number; lng?: number; name?: string }): IdentityFields {
  return {
    ...emptyIdentity,
    name: context?.name ?? "",
    lat: context?.lat !== undefined ? String(context.lat) : "",
    lng: context?.lng !== undefined ? String(context.lng) : "",
  };
}

// one dense line telling the RA which stage they are on and what remains
function StepCue(props: { steps: string[]; current: number }) {
  const label = props.steps[props.current] ?? "";
  return (
    <p className="step-cue">
      Step {props.current + 1} of {props.steps.length} —{" "}
      <span className="step-current">{label}</span>
      {props.current + 1 < props.steps.length ? ` · next: ${props.steps[props.current + 1]}` : ""}
    </p>
  );
}

function sourceSummary(source: SourceRecord | undefined): string {
  if (!source) return "No source selected.";
  if (source.archiveRef) {
    const item = source.archiveRef.itemRef ? `, ${source.archiveRef.itemRef}` : "";
    return `${source.archiveRef.repositoryName}, ${source.archiveRef.collection}${item}`;
  }
  return source.url ?? "No URL recorded.";
}

function firstLifecycleDate(draft: EvidenceDraft): string {
  const claim = draft.lifecycle[0];
  if (!claim) return "no lifecycle claim";
  return claim.date.value ?? claim.date.notEarlierThan ?? claim.date.notLaterThan ?? "date unresolved";
}

function numericValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function sourceInput(countryCode: string): SourceRecordInput {
  return {
    countryCode,
    sourceType: "newspaper_archive",
    title: "",
    archiveRef: {
      repositoryName: "",
      collection: "",
      consultedDate: "",
    },
  };
}

function mergeDraft(list: EvidenceDraft[], draft: EvidenceDraft): EvidenceDraft[] {
  const found = list.some((item) => item.draftId === draft.draftId);
  if (found) return list.map((item) => (item.draftId === draft.draftId ? draft : item));
  return [draft, ...list];
}

export function FreeContributionPortal(props: {
  country: CountryConfig;
  provider: WorkbenchProvider;
  onChanged: () => Promise<void>;
  /** map-route context: prefills the place-first identity fields and
      skips the mode chooser, since the contributor arrived from a dot */
  initialMapContext?: { lat?: number; lng?: number; name?: string };
}) {
  const [mode, setMode] = useState<PortalMode>(props.initialMapContext ? "place_first" : "chooser");

  return (
    <div>
      <h1>Nominate missing PoW</h1>
      <p className="field-note">
        Demo mode only. Nominations and source claims stay in this browser until
        a reviewer export path is connected.
      </p>
      {mode === "chooser" && (
        <div className="mode-grid">
          <button onClick={() => setMode("place_first")}>Place-first</button>
          <button className="secondary" onClick={() => setMode("source_first")}>
            Source-first
          </button>
        </div>
      )}
      {mode !== "chooser" && (
        <button className="tertiary" onClick={() => setMode("chooser")}>
          Change mode
        </button>
      )}
      {mode === "place_first" && (
        <PlaceFirstFlow
          country={props.country}
          provider={props.provider}
          onChanged={props.onChanged}
          initialMapContext={props.initialMapContext}
        />
      )}
      {mode === "source_first" && (
        <SourceFirstFlow country={props.country} provider={props.provider} onChanged={props.onChanged} />
      )}
    </div>
  );
}

function PlaceFirstFlow(props: {
  country: CountryConfig;
  provider: WorkbenchProvider;
  onChanged: () => Promise<void>;
  initialMapContext?: { lat?: number; lng?: number; name?: string };
}) {
  const [identity, setIdentity] = useState<IdentityFields>(() =>
    identityWithContext(props.initialMapContext),
  );
  const [sensitivityAnswered, setSensitivityAnswered] = useState(!props.country.culturalSensitivityPrompt);
  const [culturallySensitive, setCulturallySensitive] = useState(false);
  const [sensitivityBasis, setSensitivityBasis] = useState("");
  const [candidates, setCandidates] = useState<DedupCandidate[] | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<DedupCandidate | undefined>();
  const [continueReason, setContinueReason] = useState("");
  const [handle, setHandle] = useState<FreeContributionHandle | null>(null);
  const [draft, setDraft] = useState<EvidenceDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // the reset must be idempotent under StrictMode's doubled effects, so
  // it resets TO the map-route prefill rather than skipping a first run
  useEffect(() => {
    setIdentity(identityWithContext(props.initialMapContext));
    setSensitivityAnswered(!props.country.culturalSensitivityPrompt);
    setCulturallySensitive(false);
    setSensitivityBasis("");
    setCandidates(null);
    setSelectedCandidate(undefined);
    setContinueReason("");
    setHandle(null);
    setDraft(null);
  }, [props.country.countryCode, props.country.culturalSensitivityPrompt]);

  const highConfidenceCandidate = candidates?.some((candidate) => candidate.confidence === "high") ?? false;

  // stages the RA moves through; the sensitivity stage only exists where the
  // country protocol asks for it (Vanuatu)
  const steps = props.country.culturalSensitivityPrompt
    ? ["Choose mode", "Cultural sensitivity", "Identity", "Evidence"]
    : ["Choose mode", "Identity", "Evidence"];

  async function checkCandidates(): Promise<void> {
    const found = await props.provider.listDedupCandidates({
      countryCode: props.country.countryCode,
      name: identity.name,
      locality: identity.locality,
      lat: numericValue(identity.lat),
      lng: numericValue(identity.lng),
      addressText: identity.locality,
    });
    setCandidates(found);
    setSelectedCandidate(undefined);
    setMessage(null);
  }

  async function createContribution(candidate: DedupCandidate | undefined): Promise<void> {
    if (!candidate && highConfidenceCandidate && !continueReason.trim()) {
      setMessage("Add a reason before continuing as a new nomination.");
      return;
    }
    const created = await props.provider.createFreeContribution({
      countryCode: props.country.countryCode,
      mode: "place_first",
      name: identity.name.trim() || undefined,
      locality: identity.locality.trim() || undefined,
      religion: identity.religion.trim() || undefined,
      denominationCode: identity.denominationCode.trim() || undefined,
      sourceTitle: identity.sourceTitle.trim() || undefined,
      sourceNotes: identity.sourceNotes.trim() || undefined,
      mapContext: {
        lat: numericValue(identity.lat),
        lng: numericValue(identity.lng),
      },
      sensitivity: props.country.culturalSensitivityPrompt
        ? { culturallySensitive, basis: sensitivityBasis.trim() || undefined }
        : undefined,
      selectedDedupCandidate: candidate,
      continueAsNewReason: candidate ? undefined : continueReason.trim() || undefined,
    });
    setHandle(created);
    setDraft(created.draft);
    setMessage(null);
    await props.onChanged();
  }

  if (handle && draft) {
    return (
      <div>
        <h2>Place-first nomination</h2>
        <StepCue steps={steps} current={steps.length - 1} />
        <p className="field-note">
          Record what your sources state, then save a draft or submit for review.
          Candidate id: <code>{handle.candidateSiteId}</code>
        </p>
        <DraftEvidenceEditor
          task={handle.task}
          country={props.country}
          provider={props.provider}
          draft={draft}
          onDraftChange={setDraft}
          onChanged={props.onChanged}
          allowSkip={false}
          showTaskHeader={false}
        />
      </div>
    );
  }

  if (!sensitivityAnswered) {
    return (
      <div>
        <StepCue steps={steps} current={1} />
        <fieldset>
          <legend>Cultural sensitivity</legend>
          <label htmlFor="place-first-sensitive">
            Is this a customary or kastom site, or otherwise culturally sensitive?
          </label>
          <select
            id="place-first-sensitive"
            value=""
            onChange={(event) => {
              // the empty placeholder is not an answer; the gate stays closed
              if (event.target.value === "") return;
              setCulturallySensitive(event.target.value === "yes");
              setSensitivityAnswered(true);
            }}
          >
            <option value="">choose before entering location detail</option>
            <option value="no">No</option>
            <option value="yes">Yes, handle location and detail as sensitive</option>
          </select>
          <div className="field-note">
            Answer this first. It sets how location detail is handled through
            review, so the identity fields stay locked until you choose.
          </div>
        </fieldset>
      </div>
    );
  }

  return (
    <div>
      <StepCue steps={steps} current={steps.length - 2} />
      <fieldset>
        <legend>Minimal identity</legend>
        <div className="field-note">
          Enough to find and de-duplicate the place. You will add full evidence
          in the next step.
        </div>
        {props.country.culturalSensitivityPrompt && culturallySensitive && (
          <>
            <label htmlFor="place-first-sensitivity-basis">Sensitivity notes</label>
            <textarea
              id="place-first-sensitivity-basis"
              value={sensitivityBasis}
              onChange={(event) => setSensitivityBasis(event.target.value)}
            />
            <div className="field-note">
              Note why this site is sensitive, so reviewers apply the right
              display limits.
            </div>
          </>
        )}
        <label htmlFor="place-first-name">Name in the source</label>
        <input
          id="place-first-name"
          value={identity.name}
          onChange={(event) => setIdentity({ ...identity, name: event.target.value })}
        />
        <div className="field-note">
          Record the name as the source gives it, even if it differs from the
          modern name.
        </div>
        <label htmlFor="place-first-locality">Locality or described place</label>
        <input
          id="place-first-locality"
          value={identity.locality}
          onChange={(event) => setIdentity({ ...identity, locality: event.target.value })}
        />
        <div className="form-grid two">
          <div>
            <label htmlFor="place-first-lat">Latitude</label>
            <input
              id="place-first-lat"
              inputMode="decimal"
              value={identity.lat}
              onChange={(event) => setIdentity({ ...identity, lat: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="place-first-lng">Longitude</label>
            <input
              id="place-first-lng"
              inputMode="decimal"
              value={identity.lng}
              onChange={(event) => setIdentity({ ...identity, lng: event.target.value })}
            />
          </div>
        </div>
        <div className="form-grid two">
          <div>
            <label htmlFor="place-first-religion">Religion</label>
            <input
              id="place-first-religion"
              value={identity.religion}
              onChange={(event) => setIdentity({ ...identity, religion: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="place-first-denomination">Denomination guess</label>
            <input
              id="place-first-denomination"
              value={identity.denominationCode}
              onChange={(event) => setIdentity({ ...identity, denominationCode: event.target.value })}
            />
          </div>
        </div>
        <label htmlFor="place-first-source-title">Source title</label>
        <input
          id="place-first-source-title"
          value={identity.sourceTitle}
          onChange={(event) => setIdentity({ ...identity, sourceTitle: event.target.value })}
        />
        <div className="field-note">
          A short title reviewers can use to find the document.
        </div>
        <label htmlFor="place-first-source-notes">Source notes</label>
        <textarea
          id="place-first-source-notes"
          value={identity.sourceNotes}
          onChange={(event) => setIdentity({ ...identity, sourceNotes: event.target.value })}
        />
        <button onClick={() => void checkCandidates()}>Check for existing places</button>
        <div className="field-note">
          We compare your entry against known places so you do not create a
          duplicate.
        </div>
      </fieldset>

      {candidates && (
        <DedupPanel
          candidates={candidates}
          selected={selectedCandidate}
          highConfidenceCandidate={highConfidenceCandidate}
          continueReason={continueReason}
          message={message}
          onSelect={(candidate) => {
            setSelectedCandidate(candidate);
            void createContribution(candidate);
          }}
          onReasonChange={setContinueReason}
          onContinue={() => void createContribution(undefined)}
        />
      )}
    </div>
  );
}

function DedupPanel(props: {
  candidates: DedupCandidate[];
  selected: DedupCandidate | undefined;
  highConfidenceCandidate: boolean;
  continueReason: string;
  message: string | null;
  onSelect: (candidate: DedupCandidate) => void;
  onReasonChange: (reason: string) => void;
  onContinue: () => void;
}) {
  if (props.candidates.length === 0) {
    return (
      <fieldset>
        <legend>Is it one of these?</legend>
        <p className="field-note">
          No existing places matched. Continue below to nominate this as a new
          place of worship.
        </p>
        <button className="secondary" onClick={props.onContinue}>
          Continue as new nomination
        </button>
        {props.message && <p className="field-note">{props.message}</p>}
      </fieldset>
    );
  }
  return (
    <fieldset>
      <legend>Is it one of these?</legend>
      <div className="field-note">
        Use a match to add evidence to a place already on the map, or continue
        as a new nomination if none is the same place.
      </div>
      {props.candidates.map((candidate) => (
        <div key={`${candidate.siteId ?? candidate.candidateSiteId ?? candidate.taskId}`} className="dedup-item">
          <div>
            <strong>{candidate.name}</strong>
            <div className="field-note">
              {candidate.reason}
              {candidate.distanceMetres !== undefined ? ` · ${candidate.distanceMetres} m away` : ""}
            </div>
          </div>
          <span className={`status-pill ${candidate.confidence === "high" ? "status-present" : "status-uncertain"}`}>
            {candidate.confidence}
          </span>
          <button className="secondary" onClick={() => props.onSelect(candidate)}>
            Use this match
          </button>
        </div>
      ))}
      {props.highConfidenceCandidate && (
        <>
          <label htmlFor="continue-new-reason">Reason to continue as new nomination</label>
          <textarea
            id="continue-new-reason"
            value={props.continueReason}
            onChange={(event) => props.onReasonChange(event.target.value)}
          />
          <div className="field-note">
            A close match was found. Say why this is a different place, so a
            reviewer can tell them apart.
          </div>
        </>
      )}
      {props.message && <p className="field-note">{props.message}</p>}
      <button
        className="secondary"
        disabled={props.highConfidenceCandidate && !props.continueReason.trim()}
        onClick={props.onContinue}
      >
        Continue as new nomination
      </button>
      {props.selected && <p className="field-note">Selected: {props.selected.name}</p>}
    </fieldset>
  );
}

function SourceFirstFlow(props: {
  country: CountryConfig;
  provider: WorkbenchProvider;
  onChanged: () => Promise<void>;
}) {
  const [source, setSource] = useState<SourceRecordInput>(() => sourceInput(props.country.countryCode));
  const [sourceRecord, setSourceRecord] = useState<SourceRecord | null>(null);
  const [claims, setClaims] = useState<EvidenceDraft[]>([]);
  const [activeTask, setActiveTask] = useState<WorkTask | null>(null);
  const [activeDraft, setActiveDraft] = useState<EvidenceDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSource(sourceInput(props.country.countryCode));
    setSourceRecord(null);
    setClaims([]);
    setActiveTask(null);
    setActiveDraft(null);
    setMessage(null);
  }, [props.country.countryCode]);

  async function refreshClaims(record: SourceRecord): Promise<void> {
    if (!record.sourceRecordId) return;
    setClaims(await props.provider.listClaimsForSource(record.sourceRecordId));
    await props.onChanged();
  }

  async function createSource(): Promise<void> {
    try {
      const created = await props.provider.createSourceRecord(source);
      setSourceRecord(created.sourceRecord);
      await refreshClaims(created.sourceRecord);
      setMessage("Source record saved. Next, create a claim from it below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Source record could not be saved.");
    }
  }

  async function createClaim(): Promise<void> {
    if (!sourceRecord?.sourceRecordId) return;
    const created = await props.provider.createFreeContribution({
      countryCode: props.country.countryCode,
      mode: "source_first",
      sourceRecordId: sourceRecord.sourceRecordId,
      // name the claim after its source so My work shows something real
      // until the RA names the place itself
      name: sourceRecord.title ? `Claim from: ${sourceRecord.title}` : undefined,
      containingArea: { areaName: props.country.countryName, areaType: "country", countryCode: props.country.countryCode },
    });
    setActiveTask(created.task);
    setActiveDraft(created.draft);
    await refreshClaims(sourceRecord);
  }

  function updateSource(patch: Partial<SourceRecordInput>): void {
    setSource({ ...source, ...patch });
  }

  // stages the RA moves through in source-first: mode, the source record,
  // then the claims extracted from it
  const sourceSteps = ["Choose mode", "Source record", "Claims"];

  return (
    <div>
      <h2>Source-first</h2>
      <StepCue steps={sourceSteps} current={sourceRecord ? 2 : 1} />
      {!sourceRecord ? (
        <fieldset>
          <legend>Source record</legend>
          <div className="field-note">
            Describe the document first. You will extract one claim at a time
            from it in the next step.
          </div>
          <label htmlFor="source-first-type">Source type</label>
          <select
            id="source-first-type"
            value={source.sourceType}
            onChange={(event) => updateSource({ sourceType: event.target.value as SourceType })}
          >
            {sourceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <label htmlFor="source-first-title">Title</label>
          <input
            id="source-first-title"
            value={source.title}
            onChange={(event) => updateSource({ title: event.target.value })}
          />
          <div className="field-note">
            A short title reviewers can use to find the document (avoid "NA").
          </div>
          <label htmlFor="source-first-url">URL</label>
          <input
            id="source-first-url"
            value={source.url ?? ""}
            onChange={(event) => updateSource({ url: event.target.value || undefined })}
          />
          <div className="form-grid two">
            <div>
              <label htmlFor="source-first-repository">Archive repository</label>
              <input
                id="source-first-repository"
                value={source.archiveRef?.repositoryName ?? ""}
                onChange={(event) =>
                  updateSource({
                    archiveRef: {
                      repositoryName: event.target.value,
                      collection: source.archiveRef?.collection ?? "",
                      consultedDate: source.archiveRef?.consultedDate ?? "",
                      itemRef: source.archiveRef?.itemRef,
                      location: source.archiveRef?.location,
                    },
                  })
                }
              />
            </div>
            <div>
              <label htmlFor="source-first-collection">Archive collection</label>
              <input
                id="source-first-collection"
                value={source.archiveRef?.collection ?? ""}
                onChange={(event) =>
                  updateSource({
                    archiveRef: {
                      repositoryName: source.archiveRef?.repositoryName ?? "",
                      collection: event.target.value,
                      consultedDate: source.archiveRef?.consultedDate ?? "",
                      itemRef: source.archiveRef?.itemRef,
                      location: source.archiveRef?.location,
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="form-grid three">
            <div>
              <label htmlFor="source-first-item">Archive item</label>
              <input
                id="source-first-item"
                value={source.archiveRef?.itemRef ?? ""}
                onChange={(event) =>
                  updateSource({
                    archiveRef: {
                      repositoryName: source.archiveRef?.repositoryName ?? "",
                      collection: source.archiveRef?.collection ?? "",
                      consultedDate: source.archiveRef?.consultedDate ?? "",
                      itemRef: event.target.value || undefined,
                      location: source.archiveRef?.location,
                    },
                  })
                }
              />
            </div>
            <div>
              <label htmlFor="source-first-consulted">Archive consulted date</label>
              <input
                id="source-first-consulted"
                value={source.archiveRef?.consultedDate ?? ""}
                placeholder="YYYY[-MM[-DD]]"
                onChange={(event) =>
                  updateSource({
                    archiveRef: {
                      repositoryName: source.archiveRef?.repositoryName ?? "",
                      collection: source.archiveRef?.collection ?? "",
                      consultedDate: event.target.value,
                      itemRef: source.archiveRef?.itemRef,
                      location: source.archiveRef?.location,
                    },
                  })
                }
              />
              <div className="field-note">Use YYYY, YYYY-MM, or YYYY-MM-DD.</div>
            </div>
            <div>
              <label htmlFor="source-first-location">Archive location</label>
              <input
                id="source-first-location"
                value={source.archiveRef?.location ?? ""}
                onChange={(event) =>
                  updateSource({
                    archiveRef: {
                      repositoryName: source.archiveRef?.repositoryName ?? "",
                      collection: source.archiveRef?.collection ?? "",
                      consultedDate: source.archiveRef?.consultedDate ?? "",
                      itemRef: source.archiveRef?.itemRef,
                      location: event.target.value || undefined,
                    },
                  })
                }
              />
            </div>
          </div>
          <label htmlFor="source-first-notes">Source notes</label>
          <textarea
            id="source-first-notes"
            value={source.notes ?? ""}
            onChange={(event) => updateSource({ notes: event.target.value })}
          />
          {message && <p className="field-note">{message}</p>}
          <button onClick={() => void createSource()}>Save source record</button>
        </fieldset>
      ) : (
        <>
          <SourcePanel source={sourceRecord} />
          <ClaimList
            claims={claims}
            onCreateClaim={() => void createClaim()}
            onSelect={(selected) => {
              setActiveDraft(selected);
              setActiveTask({
                taskId: selected.taskId,
                countryCode: selected.countryCode,
                batchId: "demo-free-contribution",
                siteName: selected.attributes?.name ?? "Source-first claim",
                taskKind: "source_extraction",
                instructions: `Extract one claim from ${sourceRecord.title}.`,
                targetYears: props.country.targetYears,
                status: selected.state === "submitted" ? "needs_review" : "draft_saved",
                lat: selected.location?.lat,
                lng: selected.location?.lng,
              });
            }}
          />
          {activeDraft && activeTask && (
            <DraftEvidenceEditor
              task={activeTask}
              country={props.country}
              provider={props.provider}
              draft={activeDraft}
              onDraftChange={(draft) => {
                setActiveDraft(draft);
                setClaims((current) => mergeDraft(current, draft));
              }}
              onChanged={async () => {
                await refreshClaims(sourceRecord);
              }}
              allowSkip={false}
              lockSources
            />
          )}
        </>
      )}

      <AgentExtractionWorkspace country={props.country} provider={props.provider} onChanged={props.onChanged} />
    </div>
  );
}

function SourcePanel(props: { source: SourceRecord | undefined }) {
  return (
    <fieldset className="sticky-source">
      <legend>Fixed source</legend>
      <strong>{props.source?.title ?? "Source record"}</strong>
      <div className="field-note">{sourceSummary(props.source)}</div>
      {props.source?.notes && <p>{props.source.notes}</p>}
    </fieldset>
  );
}

function ClaimList(props: {
  claims: EvidenceDraft[];
  onCreateClaim: () => void;
  onSelect: (draft: EvidenceDraft) => void;
}) {
  return (
    <fieldset>
      <legend>Claim list</legend>
      <div className="field-note">
        Each claim is one place the source describes. Add one per place, then
        open it to record full evidence.
      </div>
      <button onClick={props.onCreateClaim}>Create claim from this source</button>
      {props.claims.length === 0 ? (
        <p className="field-note">
          No claims yet. Create your first claim from this source to start
          recording evidence.
        </p>
      ) : (
        props.claims.map((draft) => (
          <div
            key={draft.draftId}
            className="task-item"
            role="button"
            tabIndex={0}
            onClick={() => props.onSelect(draft)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                props.onSelect(draft);
              }
            }}
          >
            <div className="task-name">{draft.attributes?.name ?? draft.taskId}</div>
            <div className="task-meta">
              {draft.location?.locality ??
                draft.location?.containingArea?.areaName ??
                "regional placement not entered"}
            </div>
            <span className={`status-pill ${draftStateClass(draft.state)}`}>{stateLabel(draft.state)}</span>
          </div>
        ))
      )}
    </fieldset>
  );
}

function AgentExtractionWorkspace(props: {
  country: CountryConfig;
  provider: WorkbenchProvider;
  onChanged: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<EvidenceDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const agentDrafts = useMemo(
    () => drafts.filter((draft) => draft.lane === "agent_assisted_ra"),
    [drafts],
  );
  const activeDraft = agentDrafts.find((draft) => draft.draftId === activeDraftId) ?? agentDrafts[0] ?? null;
  const activeTask: WorkTask | null = activeDraft
    ? {
        taskId: activeDraft.taskId,
        countryCode: activeDraft.countryCode,
        batchId: "demo-agent-assisted",
        siteName: activeDraft.attributes?.name ?? "Agent-assisted source claim",
        taskKind: "source_extraction",
        instructions: "Human confirmation required before submission.",
        targetYears: props.country.targetYears,
        status: activeDraft.state === "submitted" ? "needs_review" : "draft_saved",
        lat: activeDraft.location?.lat,
        lng: activeDraft.location?.lng,
      }
    : null;

  async function refresh(): Promise<void> {
    const work = await props.provider.listMyWork(props.country.countryCode);
    setDrafts(work);
  }

  useEffect(() => {
    void refresh();
  }, [props.country.countryCode]);

  async function confirmDraft(draft: EvidenceDraft): Promise<void> {
    await props.provider.saveDraft(draft);
    const confirmed = await props.provider.confirmAgentDraft({
      draftId: draft.draftId,
      confirmedBy: "demo human",
      fieldProvenance: draft.claimProvenance?.fieldProvenance,
    });
    setDrafts((current) => mergeDraft(current, confirmed));
    setActiveDraftId(confirmed.draftId);
    setMessage("Agent draft human confirmed.");
    await props.onChanged();
  }

  async function rejectDraft(draft: EvidenceDraft): Promise<void> {
    await props.provider.rejectAgentDraft({
      draftId: draft.draftId,
      rejectedBy: "demo human",
      reason: rejectionReason.trim() || "Human rejected demo extraction.",
    });
    setMessage("Agent draft rejected by human.");
    await refresh();
    await props.onChanged();
  }

  async function submitConfirmed(draft: EvidenceDraft): Promise<void> {
    await props.provider.submitForReview(draft.draftId);
    const submitted = { ...draft, state: "submitted" as const, updatedAt: new Date().toISOString() };
    setDrafts((current) => mergeDraft(current, submitted));
    setActiveDraftId(submitted.draftId);
    setMessage("Submitted for review. A reviewer will look at this; you can track it under My work.");
    await props.onChanged();
  }

  return (
    <fieldset>
      <legend>Agent-assisted extraction</legend>
      {agentDrafts.length === 0 ? (
        <p className="field-note">
          No agent-assisted claims for this country yet. When an agent extracts
          claims from a source, they appear here for you to confirm or reject.
        </p>
      ) : (
        <>
          <SourcePanel source={agentDrafts[0]?.sources[0]} />
          <div className="table-wrap">
            <table className="claim-table">
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Placement</th>
                  <th>Date</th>
                  <th>State</th>
                  <th>Provenance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {agentDrafts.map((draft) => (
                  <tr key={draft.draftId}>
                    <td>{draft.attributes?.name ?? draft.taskId}</td>
                    <td>{draft.location?.locality ?? draft.location?.containingArea?.areaName ?? "not placed"}</td>
                    <td>{firstLifecycleDate(draft)}</td>
                    <td>
                      <span className={`status-pill ${draftStateClass(draft.state)}`}>{stateLabel(draft.state)}</span>
                    </td>
                    <td>
                      <FieldProvenanceBadge state={draft.claimProvenance?.fieldProvenance?.["attributes.name"]} />{" "}
                      <FieldProvenanceBadge state={draft.claimProvenance?.fieldProvenance?.["location.locality"]} />{" "}
                      <FieldProvenanceBadge state={draft.claimProvenance?.fieldProvenance?.["location.containingArea"]} />
                    </td>
                    <td>
                      <button className="tertiary" onClick={() => setActiveDraftId(draft.draftId)}>
                        Review
                      </button>
                      <button
                        className="tertiary"
                        disabled={draft.state !== "human_confirmed"}
                        onClick={() => void submitConfirmed(draft)}
                      >
                        Submit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {activeDraft && activeTask && (
            <div>
              <div className="action-row">
                <button
                  disabled={activeDraft.state !== "agent_draft"}
                  onClick={() => void confirmDraft(activeDraft)}
                >
                  Confirm extracted claim
                </button>
                <input
                  aria-label="Human rejection reason"
                  placeholder="reason if rejecting"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
                <button
                  className="danger"
                  disabled={activeDraft.state !== "agent_draft"}
                  onClick={() => void rejectDraft(activeDraft)}
                >
                  Reject extracted claim
                </button>
              </div>
              {message && <p className="field-note">{message}</p>}
              <DraftEvidenceEditor
                task={activeTask}
                country={props.country}
                provider={props.provider}
                draft={activeDraft}
                onDraftChange={(next) => {
                  // the editor's update() already maintains field provenance
                  // via the shared markHumanEdits (data/provenance.ts)
                  setDrafts((current) => mergeDraft(current, next));
                  setActiveDraftId(next.draftId);
                }}
                onChanged={async () => {
                  await refresh();
                  await props.onChanged();
                }}
                allowSkip={false}
                lockSources
              />
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
