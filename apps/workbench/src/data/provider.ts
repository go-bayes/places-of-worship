import type { EvidenceDraft, WorkTask } from "./types";

// the workbench never talks to a backend directly: every screen goes
// through this interface. DemoProvider keeps work in localStorage;
// ConvexProvider (future) binds the same surface to the shared task
// backend. this keeps the app testable and keeps production Convex
// untouched until the deploy step is deliberately taken.

export interface WorkbenchProvider {
  readonly kind: "demo" | "convex";
  listTasks(countryCode: string): Promise<WorkTask[]>;
  getDraft(taskId: string): Promise<EvidenceDraft | null>;
  saveDraft(draft: EvidenceDraft): Promise<void>;
  /** submit for review; the draft becomes read-only until revised */
  submitForReview(draftId: string): Promise<void>;
  /** park useful-but-incomplete evidence without submitting */
  submitUnresolvedNote(draftId: string, note: string): Promise<void>;
  skipTask(taskId: string, reason?: string): Promise<void>;
  listMyWork(countryCode: string): Promise<EvidenceDraft[]>;
}
