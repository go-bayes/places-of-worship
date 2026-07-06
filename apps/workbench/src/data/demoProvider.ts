import type { WorkbenchProvider } from "./provider";
import type { EvidenceDraft, WorkTask } from "./types";
import { demoTasks } from "./demoTasks";

const DRAFTS_KEY = "pow_workbench_demo_drafts_v1";
const TASKS_KEY = "pow_workbench_demo_task_state_v1";

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

export class DemoProvider implements WorkbenchProvider {
  readonly kind = "demo" as const;

  async listTasks(countryCode: string): Promise<WorkTask[]> {
    const overrides = loadMap<WorkTask["status"]>(TASKS_KEY);
    return demoTasks
      .filter((t) => t.countryCode === countryCode)
      .map((t) => ({ ...t, status: overrides[t.taskId] ?? t.status }));
  }

  async getDraft(taskId: string): Promise<EvidenceDraft | null> {
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const forTask = Object.values(drafts)
      .filter((d) => d.taskId === taskId && d.state !== "superseded")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return forTask[0] ?? null;
  }

  async saveDraft(draft: EvidenceDraft): Promise<void> {
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    drafts[draft.draftId] = { ...draft, updatedAt: new Date().toISOString() };
    saveMap(DRAFTS_KEY, drafts);
    this.setTaskStatus(draft.taskId, "draft_saved");
  }

  async submitForReview(draftId: string): Promise<void> {
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const draft = drafts[draftId];
    if (!draft) throw new Error("draft not found");
    drafts[draftId] = { ...draft, state: "submitted", updatedAt: new Date().toISOString() };
    saveMap(DRAFTS_KEY, drafts);
    this.setTaskStatus(draft.taskId, "needs_review");
  }

  async submitUnresolvedNote(draftId: string, note: string): Promise<void> {
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    const draft = drafts[draftId];
    if (!draft) throw new Error("draft not found");
    drafts[draftId] = { ...draft, unresolvedNote: note, updatedAt: new Date().toISOString() };
    saveMap(DRAFTS_KEY, drafts);
  }

  async skipTask(taskId: string): Promise<void> {
    this.setTaskStatus(taskId, "skipped");
  }

  async listMyWork(countryCode: string): Promise<EvidenceDraft[]> {
    const drafts = loadMap<EvidenceDraft>(DRAFTS_KEY);
    return Object.values(drafts)
      .filter((d) => d.countryCode === countryCode)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private setTaskStatus(taskId: string, status: WorkTask["status"]): void {
    const overrides = loadMap<WorkTask["status"]>(TASKS_KEY);
    overrides[taskId] = status;
    saveMap(TASKS_KEY, overrides);
  }
}
