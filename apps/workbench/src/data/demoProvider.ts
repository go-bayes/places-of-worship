import type { WorkbenchProvider } from "./provider";
import type {
  AgentDraftInput,
  AgentExtractionRun,
  Confidence,
  DedupCandidate,
  DedupCandidateQuery,
  EvidenceDraft,
  FreeContributionHandle,
  FreeContributionInput,
  HumanConfirmationInput,
  HumanRejectionInput,
  LocationEvidence,
  SourceRecord,
  SourceRecordHandle,
  SourceRecordInput,
  WorkTask,
} from "./types";
import { demoTasks } from "./demoTasks";

const DRAFTS_KEY = "pow_workbench_demo_drafts_v1";
const TASKS_KEY = "pow_workbench_demo_task_state_v1";
const FREE_TASKS_KEY = "pow_workbench_demo_free_tasks_v1";
const SOURCES_KEY = "pow_workbench_demo_source_records_v1";
const AGENT_RUNS_KEY = "pow_workbench_demo_agent_runs_v1";
const AGENT_SEED_KEY = "pow_workbench_demo_agent_seed_v1";
const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// localStorage-backed provider: real workflow, disposable storage.
// nothing here reaches the shared backend or the master data.

function loadMap<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    return {};
  }
}

function saveMap<T>(key: string, map: Record<string, T>): void {
  localStorage.setItem(key, JSON.stringify(map));
}

function encodeBase32(value: number, length: number): string {
  let remaining = Math.max(0, Math.floor(value));
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text = BASE32[remaining % 32] + text;
    remaining = Math.floor(remaining / 32);
  }
  return text;
}

function randomBase32(length: number): string {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += BASE32[Math.floor(Math.random() * BASE32.length)];
  }
  return text;
}

function demoUlid(): string {
  return `${encodeBase32(Date.now(), 10)}${randomBase32(16)}`.toLowerCase();
}

function candidateSiteId(countryCode: string): string {
  return `candidate:${countryCode.toLowerCase()}:${demoUlid()}`;
}

function freeTaskId(countryCode: string, prefix: string): string {
  return `${prefix}:${countryCode.toLowerCase()}:${demoUlid()}`;
}

function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(2 * radius * Math.asin(Math.sqrt(h)));
}

function confidenceFromScore(score: number): Confidence {
  if (score >= 80) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function normaliseText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function hasValidArchiveRef(source: Pick<SourceRecordInput, "archiveRef">): boolean {
  const archiveRef = source.archiveRef;
  return Boolean(
    archiveRef?.repositoryName.trim() &&
      archiveRef.collection.trim() &&
      archiveRef.consultedDate.trim(),
  );
}

function validateSourceInput(input: SourceRecordInput): void {
  if (!input.title.trim() || /^n\/?a$/i.test(input.title.trim())) {
    throw new Error("Every source needs a real title.");
  }
  if (!input.url?.trim() && !hasValidArchiveRef(input)) {
    throw new Error("Every source needs either a URL or an archive reference.");
  }
}

function sourceTitle(source: SourceRecord | undefined): string {
  return source?.title.trim() || "Untitled source";
}

export class DemoProvider implements WorkbenchProvider {
  readonly kind = "demo" as const;

  async listTasks(countryCode: string): Promise<WorkTask[]> {
    this.ensureDemoAgentSeed();
    const overrides = loadMap<WorkTask["status"]>(TASKS_KEY);
    const freeTasks = Object.values(loadMap<WorkTask>(FREE_TASKS_KEY));
    return [...demoTasks, ...freeTasks]
      .filter((task) => task.countryCode === countryCode)
      .map((task) => ({ ...task, status: overrides[task.taskId] ?? task.status }));
  }

  async getTask(taskId: string): Promise<WorkTask | null> {
    this.ensureDemoAgentSeed();
    const overrides = loadMap<WorkTask["status"]>(TASKS_KEY);
    const freeTasks = loadMap<WorkTask>(FREE_TASKS_KEY);
    const found = freeTasks[taskId] ?? demoTasks.find((task) => task.taskId === taskId);
    if (!found) return null;
    return { ...found, status: overrides[taskId] ?? found.status };
  }

  async getDraft(taskId: string): Promise<EvidenceDraft | null> {
    this.ensureDemoAgentSeed();
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const forTask = Object.values(drafts)
      .filter((draft) => draft.taskId === taskId && draft.state !== "superseded")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return forTask[0] ?? null;
  }

  async saveDraft(draft: EvidenceDraft): Promise<void> {
    this.ensureDemoAgentSeed();
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const updated = { ...draft, updatedAt: new Date().toISOString() };
    drafts[draft.draftId] = updated;
    saveMap(DRAFTS_KEY, drafts);
    if (updated.state === "submitted") this.setTaskStatus(updated.taskId, "needs_review");
    else if (updated.state === "unresolved_note") this.setTaskStatus(updated.taskId, "needs_review");
    else if (updated.state === "rejected_by_human") this.setTaskStatus(updated.taskId, "skipped");
    else this.setTaskStatus(updated.taskId, "draft_saved");
  }

  async submitForReview(draftId: string): Promise<void> {
    this.ensureDemoAgentSeed();
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const draft = drafts[draftId];
    if (!draft) throw new Error("Draft not found.");
    if (draft.state === "agent_draft") {
      throw new Error("Agent drafts must be human confirmed before submission.");
    }
    if (draft.state === "rejected_by_human") {
      throw new Error("Rejected agent drafts cannot be submitted.");
    }
    drafts[draftId] = { ...draft, state: "submitted", updatedAt: new Date().toISOString() };
    saveMap(DRAFTS_KEY, drafts);
    this.setTaskStatus(draft.taskId, "needs_review");
  }

  async submitUnresolvedNote(draftId: string, note: string): Promise<void> {
    this.ensureDemoAgentSeed();
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const draft = drafts[draftId];
    if (!draft) throw new Error("Draft not found.");
    drafts[draftId] = {
      ...draft,
      state: "unresolved_note",
      unresolvedNote: note,
      updatedAt: new Date().toISOString(),
    };
    saveMap(DRAFTS_KEY, drafts);
    this.setTaskStatus(draft.taskId, "needs_review");
  }

  async skipTask(taskId: string): Promise<void> {
    this.setTaskStatus(taskId, "skipped");
  }

  async listMyWork(countryCode: string): Promise<EvidenceDraft[]> {
    this.ensureDemoAgentSeed();
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    return Object.values(drafts)
      .filter((draft) => draft.countryCode === countryCode)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createFreeContribution(input: FreeContributionInput): Promise<FreeContributionHandle> {
    this.ensureDemoAgentSeed();
    const now = new Date().toISOString();
    const chosenCandidate = input.selectedDedupCandidate;
    const nextCandidateSiteId =
      input.candidateSiteId ?? chosenCandidate?.candidateSiteId ?? candidateSiteId(input.countryCode);
    const taskId = freeTaskId(input.countryCode, input.mode === "place_first" ? "nomination" : "source-claim");
    const sourceRecords = loadMap<SourceRecord>(SOURCES_KEY);
    const linkedSource = input.sourceRecordId ? sourceRecords[input.sourceRecordId] : undefined;
    const task: WorkTask = {
      taskId,
      countryCode: input.countryCode,
      batchId: "demo-free-contribution",
      siteId: chosenCandidate?.siteId,
      siteName: input.name ?? chosenCandidate?.name ?? "Unnamed nomination",
      taskKind: input.mode === "place_first" ? "deep_history" : "source_extraction",
      instructions:
        input.mode === "place_first"
          ? "Record source-backed evidence for this nominated place of worship."
          : `Extract one claim from ${sourceTitle(linkedSource)}.`,
      targetYears: input.countryCode === "VU" ? [1989, 1999, 2009, 2020] : [2013, 2018, 2023],
      status: "draft_saved",
      lat: input.mapContext?.lat,
      lng: input.mapContext?.lng,
    };
    const location: LocationEvidence | undefined =
      input.mapContext?.lat !== undefined || input.mapContext?.lng !== undefined || input.locality || input.containingArea
        ? {
            lat: input.mapContext?.lat,
            lng: input.mapContext?.lng,
            locality: input.locality,
            geocodingBasis: input.containingArea ? "regional_only" : "described_locality",
            containingArea: input.containingArea,
            locationConfidence: input.containingArea ? "medium" : "low",
          }
        : undefined;
    const sources =
      linkedSource !== undefined
        ? [linkedSource]
        : input.sourceTitle || input.sourceNotes
          ? [{ sourceType: "other" as const, title: input.sourceTitle ?? "", notes: input.sourceNotes }]
          : [];
    const draft: EvidenceDraft = {
      draftId: `${taskId}:draft`,
      taskId,
      countryCode: input.countryCode,
      targetYearStatuses: {},
      location,
      attributes: {
        name: input.name,
        religion: input.religion,
        denominationCode: input.denominationCode,
        culturallySensitive: input.sensitivity?.culturallySensitive,
        sensitivityBasis: input.sensitivity?.basis,
      },
      lifecycle: [],
      sources,
      evidenceNotes: input.sourceNotes,
      updatedAt: now,
      state: "draft",
      candidateSiteId: nextCandidateSiteId,
      sourceRecordId: input.sourceRecordId,
      sourceFirstId: input.mode === "source_first" ? taskId : undefined,
      contributionMode: input.mode,
      lane: "fixed",
      origin: input.mode === "place_first" ? "free_place_first" : "source_first",
      providerKind: "demo",
      claimProvenance: {
        lane: "fixed",
        origin: input.mode === "place_first" ? "free_place_first" : "source_first",
        sourceRecordId: input.sourceRecordId,
      },
      dedupCandidates: chosenCandidate ? [chosenCandidate] : [],
      selectedDedupCandidate: chosenCandidate,
      continueAsNewReason: input.continueAsNewReason,
    };
    const tasks = loadMap<WorkTask>(FREE_TASKS_KEY);
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    tasks[task.taskId] = task;
    drafts[draft.draftId] = draft;
    saveMap(FREE_TASKS_KEY, tasks);
    saveMap(DRAFTS_KEY, drafts);
    this.setTaskStatus(task.taskId, "draft_saved");
    return { task, draft, candidateSiteId: nextCandidateSiteId };
  }

  async listDedupCandidates(input: DedupCandidateQuery): Promise<DedupCandidate[]> {
    this.ensureDemoAgentSeed();
    const candidates: DedupCandidate[] = [];
    const inputName = normaliseText(input.name);
    const inputLocality = normaliseText(input.locality ?? input.addressText);
    const maybePoint =
      input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : undefined;

    for (const task of demoTasks.filter((candidate) => candidate.countryCode === input.countryCode)) {
      const taskName = normaliseText(task.siteName);
      const localityHit = inputLocality && taskName.includes(inputLocality);
      const nameHit = inputName && taskName.includes(inputName);
      const maybeDistance =
        maybePoint && task.lat !== undefined && task.lng !== undefined
          ? distanceMetres(maybePoint, { lat: task.lat, lng: task.lng })
          : undefined;
      let score = 0;
      if (nameHit) score += 70;
      if (localityHit) score += 30;
      if (maybeDistance !== undefined && maybeDistance <= 250) score += 80;
      else if (maybeDistance !== undefined && maybeDistance <= 2_000) score += 45;
      if (score > 0) {
        candidates.push({
          siteId: task.siteId,
          taskId: task.taskId,
          name: task.siteName ?? task.taskId,
          locality: task.siteName,
          distanceMetres: maybeDistance,
          sourceIds: [],
          confidence: confidenceFromScore(score),
          reason: nameHit
            ? "Name matches an existing demo task."
            : "Location or locality is close to an existing demo task.",
        });
      }
    }

    for (const draft of Object.values(loadMap<EvidenceDraft>(DRAFTS_KEY))) {
      if (draft.countryCode !== input.countryCode || !draft.candidateSiteId) continue;
      const draftName = normaliseText(draft.attributes?.name);
      const draftLocality = normaliseText(draft.location?.locality);
      const nameHit = Boolean(inputName && draftName.includes(inputName));
      const localityHit = Boolean(inputLocality && draftLocality.includes(inputLocality));
      const sourceHit = Boolean(input.sourceRecordId && input.sourceRecordId === draft.sourceRecordId);
      const maybeDistance =
        maybePoint && draft.location?.lat !== undefined && draft.location.lng !== undefined
          ? distanceMetres(maybePoint, { lat: draft.location.lat, lng: draft.location.lng })
          : undefined;
      let score = 0;
      if (nameHit) score += 70;
      if (localityHit) score += 25;
      if (sourceHit) score += 60;
      if (maybeDistance !== undefined && maybeDistance <= 250) score += 80;
      if (score === 0) continue;
      candidates.push({
        candidateSiteId: draft.candidateSiteId,
        taskId: draft.taskId,
        name: draft.attributes?.name ?? draft.taskId,
        locality: draft.location?.locality,
        distanceMetres: maybeDistance,
        sourceIds: draft.sourceRecordId ? [draft.sourceRecordId] : [],
        confidence: confidenceFromScore(score),
        reason: sourceHit ? "This source is already linked to a pending candidate." : "Matches a saved demo nomination.",
      });
    }

    if (candidates.length === 0) {
      for (const task of demoTasks.filter((candidate) => candidate.countryCode === input.countryCode).slice(0, 2)) {
        candidates.push({
          siteId: task.siteId,
          taskId: task.taskId,
          name: task.siteName ?? task.taskId,
          locality: task.siteName,
          sourceIds: [],
          confidence: "low",
          reason: "Demo comparison from the current country task list.",
        });
      }
    }

    return candidates.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } satisfies Record<Confidence, number>;
      return rank[a.confidence] - rank[b.confidence];
    });
  }

  async createSourceRecord(input: SourceRecordInput): Promise<SourceRecordHandle> {
    this.ensureDemoAgentSeed();
    validateSourceInput(input);
    const sourceRecordId = `source:${input.countryCode.toLowerCase()}:${demoUlid()}`;
    const sourceRecord: SourceRecord = {
      ...input,
      sourceRecordId,
      providerKind: "demo",
      createdAt: new Date().toISOString(),
    };
    const sources = loadMap<SourceRecord>(SOURCES_KEY);
    sources[sourceRecordId] = sourceRecord;
    saveMap(SOURCES_KEY, sources);
    return { sourceRecordId, sourceRecord };
  }

  async listClaimsForSource(sourceRecordId: string): Promise<EvidenceDraft[]> {
    this.ensureDemoAgentSeed();
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    return Object.values(drafts)
      .filter(
        (draft) =>
          draft.sourceRecordId === sourceRecordId ||
          draft.sources.some((source) => source.sourceRecordId === sourceRecordId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveAgentDraft(input: AgentDraftInput): Promise<EvidenceDraft> {
    this.ensureDemoAgentSeed();
    const sourceRecords = loadMap<SourceRecord>(SOURCES_KEY);
    const sourceRecord = sourceRecords[input.sourceRecordId];
    if (!sourceRecord) throw new Error("Source record not found.");
    const taskId = input.draft.taskId ?? freeTaskId(input.countryCode, "agent-claim");
    const draftId = input.draft.draftId ?? `${taskId}:draft`;
    const now = new Date().toISOString();
    const draft: EvidenceDraft = {
      ...input.draft,
      draftId,
      taskId,
      countryCode: input.countryCode,
      sources: input.draft.sources.length > 0 ? input.draft.sources : [sourceRecord],
      updatedAt: now,
      state: "agent_draft",
      candidateSiteId: input.draft.candidateSiteId ?? candidateSiteId(input.countryCode),
      sourceRecordId: input.sourceRecordId,
      sourceFirstId: taskId,
      contributionMode: "source_first",
      lane: "agent_assisted_ra",
      origin: "agent_assisted",
      providerKind: "demo",
      claimProvenance: {
        lane: "agent_assisted_ra",
        origin: "agent_assisted",
        agentGenerated: true,
        agentRunId: input.agentRun.agentRunId,
        sourceRecordId: input.sourceRecordId,
        sourceLocator: input.agentRun.sourceLocator,
        extractionConfidence: input.agentRun.extractionConfidence,
        fieldProvenance: input.draft.claimProvenance?.fieldProvenance ?? {},
      },
    };
    const tasks = loadMap<WorkTask>(FREE_TASKS_KEY);
    tasks[taskId] = {
      taskId,
      countryCode: input.countryCode,
      batchId: "demo-agent-assisted",
      siteName: draft.attributes?.name ?? "Agent-assisted source claim",
      taskKind: "source_extraction",
      instructions: `Human confirmation required before submission. Source: ${sourceTitle(sourceRecord)}.`,
      targetYears: input.countryCode === "VU" ? [1989, 1999, 2009, 2020] : [2013, 2018, 2023],
      status: "draft_saved",
      lat: draft.location?.lat,
      lng: draft.location?.lng,
    };
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const runs = loadMap<AgentExtractionRun>(AGENT_RUNS_KEY);
    drafts[draftId] = draft;
    runs[input.agentRun.agentRunId] = { ...input.agentRun, providerKind: "demo" };
    saveMap(FREE_TASKS_KEY, tasks);
    saveMap(DRAFTS_KEY, drafts);
    saveMap(AGENT_RUNS_KEY, runs);
    this.setTaskStatus(taskId, "draft_saved");
    return draft;
  }

  async confirmAgentDraft(input: HumanConfirmationInput): Promise<EvidenceDraft> {
    this.ensureDemoAgentSeed();
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const draft = drafts[input.draftId];
    if (!draft) throw new Error("Draft not found.");
    if (draft.state === "rejected_by_human") throw new Error("Rejected drafts cannot be confirmed.");
    const confirmed: EvidenceDraft = {
      ...draft,
      state: "human_confirmed",
      updatedAt: new Date().toISOString(),
      claimProvenance: {
        lane: draft.claimProvenance?.lane ?? "agent_assisted_ra",
        origin: draft.claimProvenance?.origin ?? "agent_assisted",
        ...draft.claimProvenance,
        fieldProvenance: {
          ...draft.claimProvenance?.fieldProvenance,
          ...input.fieldProvenance,
        },
        confirmedBy: input.confirmedBy,
        confirmedAt: new Date().toISOString(),
      },
    };
    drafts[input.draftId] = confirmed;
    saveMap(DRAFTS_KEY, drafts);
    this.setTaskStatus(confirmed.taskId, "draft_saved");
    return confirmed;
  }

  async rejectAgentDraft(input: HumanRejectionInput): Promise<void> {
    this.ensureDemoAgentSeed();
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const draft = drafts[input.draftId];
    if (!draft) throw new Error("Draft not found.");
    drafts[input.draftId] = {
      ...draft,
      state: "rejected_by_human",
      updatedAt: new Date().toISOString(),
      claimProvenance: {
        lane: draft.claimProvenance?.lane ?? "agent_assisted_ra",
        origin: draft.claimProvenance?.origin ?? "agent_assisted",
        ...draft.claimProvenance,
        rejectedBy: input.rejectedBy,
        rejectedAt: new Date().toISOString(),
        rejectionReason: input.reason,
      },
    };
    saveMap(DRAFTS_KEY, drafts);
    this.setTaskStatus(draft.taskId, "skipped");
  }

  private setTaskStatus(taskId: string, status: WorkTask["status"]): void {
    const overrides = loadMap<WorkTask["status"]>(TASKS_KEY);
    overrides[taskId] = status;
    saveMap(TASKS_KEY, overrides);
  }

  private ensureDemoAgentSeed(): void {
    if (localStorage.getItem(AGENT_SEED_KEY) === "done") return;
    const sourceRecordId = "source:nz:demo-archive-ledger";
    const agentRunId = "agent-run:nz:demo-archive-ledger";
    const sourceRecord: SourceRecord = {
      sourceRecordId,
      countryCode: "NZ",
      providerKind: "demo",
      createdAt: "2026-07-07T00:00:00.000Z",
      sourceType: "newspaper_archive",
      title: "Demo archive ledger: Wellington chapel notices, 1884-1886",
      archiveRef: {
        repositoryName: "Demo Archive",
        collection: "Free Contribution Portal Test Sources",
        itemRef: "Box 3, ledger 12",
        consultedDate: "2026-07-07",
        location: "Reading room copy",
      },
      sourceDate: "1885",
      consultedDate: "2026-07-07",
      licence: "Demo fixture only",
      accessLimits: "No public source; created for demo mode.",
      notes: "Fake archive source for exercising agent-assisted extraction.",
    };
    const run: AgentExtractionRun = {
      agentRunId,
      agentName: "demo archive extractor",
      modelProvider: "demo",
      modelName: "fixture",
      modelVersion: "2026-07-07",
      promptOrPipelineVersion: "free-contribution-demo-v1",
      sourceRecordId,
      sourceLocator: "ledger pages 4-5",
      runStartedAt: "2026-07-07T00:10:00.000Z",
      runCompletedAt: "2026-07-07T00:10:30.000Z",
      extractionConfidence: "medium",
      confidencePolicy: "Medium confidence because the locality is described but not geocoded.",
      expectedCount: 2,
      extractedCount: 2,
      confirmedCount: 0,
      rejectedCount: 0,
      status: "completed",
      providerKind: "demo",
    };
    const firstTaskId = "agent-claim:nz:demo-001";
    const secondTaskId = "agent-claim:nz:demo-002";
    const tasks: Record<string, WorkTask> = {
      [firstTaskId]: {
        taskId: firstTaskId,
        countryCode: "NZ",
        batchId: "demo-agent-assisted",
        siteName: "Taranaki Street Gospel Hall",
        taskKind: "source_extraction",
        instructions: "Human confirmation required before submission. Source: demo archive ledger.",
        targetYears: [2013, 2018, 2023],
        status: "draft_saved",
      },
      [secondTaskId]: {
        taskId: secondTaskId,
        countryCode: "NZ",
        batchId: "demo-agent-assisted",
        siteName: "Cuba Street Methodist Chapel",
        taskKind: "source_extraction",
        instructions: "Human confirmation required before submission. Source: demo archive ledger.",
        targetYears: [2013, 2018, 2023],
        status: "draft_saved",
      },
    };
    const commonProvenance = {
      lane: "agent_assisted_ra" as const,
      origin: "agent_assisted" as const,
      agentGenerated: true,
      agentRunId,
      sourceRecordId,
      sourceLocator: run.sourceLocator,
      extractionConfidence: "medium" as const,
    };
    const drafts: Record<string, EvidenceDraft> = {
      [`${firstTaskId}:draft`]: {
        draftId: `${firstTaskId}:draft`,
        taskId: firstTaskId,
        countryCode: "NZ",
        targetYearStatuses: { "2013": "not_assessed", "2018": "not_assessed", "2023": "not_assessed" },
        location: {
          locality: "Taranaki Street, Wellington",
          geocodingBasis: "described_locality",
          locationConfidence: "medium",
        },
        attributes: {
          name: "Taranaki Street Gospel Hall",
          religion: "Christian",
          denominationCode: "christian.other",
          taxonomyVersion: "demo",
        },
        lifecycle: [{ eventKind: "opening", date: { value: "1885" }, confidence: "medium" }],
        sources: [sourceRecord],
        evidenceNotes: "Agent extracted a chapel opening notice from the demo ledger.",
        updatedAt: "2026-07-07T00:11:00.000Z",
        state: "agent_draft",
        candidateSiteId: "candidate:nz:01jz0000000000000000000001",
        sourceRecordId,
        sourceFirstId: firstTaskId,
        contributionMode: "source_first",
        lane: "agent_assisted_ra",
        origin: "agent_assisted",
        providerKind: "demo",
        claimProvenance: {
          ...commonProvenance,
          fieldProvenance: {
            "attributes.name": "agent_suggested",
            "attributes.religion": "agent_suggested",
            "location.locality": "agent_suggested",
            "lifecycle[0].date.value": "agent_suggested",
          },
        },
      },
      [`${secondTaskId}:draft`]: {
        draftId: `${secondTaskId}:draft`,
        taskId: secondTaskId,
        countryCode: "NZ",
        targetYearStatuses: { "2013": "not_assessed", "2018": "not_assessed", "2023": "not_assessed" },
        location: {
          geocodingBasis: "regional_only",
          containingArea: { areaName: "Wellington", areaType: "city", countryCode: "NZ" },
          locationConfidence: "low",
        },
        attributes: {
          name: "Cuba Street Methodist Chapel",
          religion: "Christian",
          denominationCode: "christian.methodist",
          taxonomyVersion: "demo",
        },
        lifecycle: [{ eventKind: "opening", date: { notEarlierThan: "1884", notLaterThan: "1886" }, confidence: "low" }],
        sources: [sourceRecord],
        evidenceNotes: "Agent extracted an area-only claim. No coordinates are implied.",
        updatedAt: "2026-07-07T00:11:10.000Z",
        state: "agent_draft",
        candidateSiteId: "candidate:nz:01jz0000000000000000000002",
        sourceRecordId,
        sourceFirstId: secondTaskId,
        contributionMode: "source_first",
        lane: "agent_assisted_ra",
        origin: "agent_assisted",
        providerKind: "demo",
        claimProvenance: {
          ...commonProvenance,
          sourceLocator: "ledger page 5",
          extractionConfidence: "low",
          fieldProvenance: {
            "attributes.name": "agent_suggested",
            "location.containingArea": "agent_suggested",
            "lifecycle[0].date.bounds": "agent_suggested",
          },
        },
      },
    };
    saveMap(SOURCES_KEY, { ...loadMap<SourceRecord>(SOURCES_KEY), [sourceRecordId]: sourceRecord });
    saveMap(AGENT_RUNS_KEY, { ...loadMap<AgentExtractionRun>(AGENT_RUNS_KEY), [agentRunId]: run });
    saveMap(FREE_TASKS_KEY, { ...loadMap<WorkTask>(FREE_TASKS_KEY), ...tasks });
    saveMap(DRAFTS_KEY, { ...loadMap<EvidenceDraft>(DRAFTS_KEY), ...drafts });
    localStorage.setItem(AGENT_SEED_KEY, "done");
  }
}
