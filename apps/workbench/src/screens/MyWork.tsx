import type { EvidenceDraft } from "../data/types";
import { draftStateClass } from "./EvidenceForm";

function draftLabel(state: EvidenceDraft["state"]): string {
  if (state === "submitted") return "submitted for review";
  if (state === "accepted_for_export") return "accepted for export";
  if (state === "agent_draft") return "agent draft";
  if (state === "human_confirmed") return "human confirmed";
  if (state === "rejected_by_human") return "rejected by human";
  if (state === "unresolved_note") return "unresolved note";
  return state.replace(/_/g, " ");
}

export function MyWork(props: { drafts: EvidenceDraft[]; onNominate: () => void }) {
  if (props.drafts.length === 0) {
    return (
      <div>
        <p className="field-note">No saved drafts or submissions yet.</p>
        <button className="secondary" onClick={props.onNominate}>
          Nominate missing PoW
        </button>
      </div>
    );
  }
  return (
    <div>
      <button className="secondary my-work-action" onClick={props.onNominate}>
        Nominate missing PoW
      </button>
      {props.drafts.map((draft) => (
        <div key={draft.draftId} className="task-item">
          <div className="task-name">{draft.attributes?.name ?? draft.taskId}</div>
          <div className="task-meta">
            updated {draft.updatedAt.slice(0, 16).replace("T", " ")} ·{" "}
            {draft.sources.length} source{draft.sources.length === 1 ? "" : "s"}
            {draft.lane === "agent_assisted_ra" ? " · agent-assisted" : ""}
          </div>
          <span className={`status-pill ${draftStateClass(draft.state)}`}>
            {draftLabel(draft.state)}
          </span>
        </div>
      ))}
    </div>
  );
}
