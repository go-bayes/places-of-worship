import type { EvidenceDraft } from "../data/types";

export function MyWork(props: { drafts: EvidenceDraft[] }) {
  if (props.drafts.length === 0) {
    return <p className="field-note">No saved drafts or submissions yet.</p>;
  }
  return (
    <div>
      {props.drafts.map((draft) => (
        <div key={draft.draftId} className="task-item">
          <div className="task-name">{draft.attributes?.name ?? draft.taskId}</div>
          <div className="task-meta">
            updated {draft.updatedAt.slice(0, 16).replace("T", " ")} ·{" "}
            {draft.sources.length} source{draft.sources.length === 1 ? "" : "s"}
          </div>
          <span
            className={`status-pill ${
              draft.state === "submitted" ? "status-present" : "status-uncertain"
            }`}
          >
            {draft.state === "submitted" ? "submitted for review" : draft.state}
          </span>
        </div>
      ))}
    </div>
  );
}
