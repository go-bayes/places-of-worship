import type { WorkTask } from "../data/types";
import { taskKindLabel } from "./EvidenceForm";

const statusClass: Record<string, string> = {
  open: "status-not-assessed",
  in_progress: "status-not-assessed",
  draft_saved: "status-uncertain",
  needs_review: "status-present",
  changes_requested: "status-uncertain",
  reviewed: "status-present",
  exported: "status-present",
  skipped: "status-absent",
  reopened: "status-uncertain",
};

export function TaskList(props: {
  tasks: WorkTask[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
}) {
  if (props.tasks.length === 0) {
    return (
      <p className="field-note">
        No active tasks right now. New assignments appear here; you can still
        nominate a missing place of worship above.
      </p>
    );
  }
  return (
    <div>
      {props.tasks.map((task) => (
        <div
          key={task.taskId}
          className={`task-item${task.taskId === props.selectedTaskId ? " selected" : ""}`}
          onClick={() => props.onSelect(task.taskId)}
        >
          <div className="task-name">{task.siteName ?? task.taskId}</div>
          <div className="task-meta">
            {taskKindLabel(task.taskKind)}
            <span className="batch-tag">batch {task.batchId}</span>
          </div>
          <span className={`status-pill ${statusClass[task.status] ?? "status-not-assessed"}`}>
            {task.status.replace(/_/g, " ")}
          </span>
        </div>
      ))}
    </div>
  );
}
