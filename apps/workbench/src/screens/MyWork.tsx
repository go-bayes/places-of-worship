import type { EvidenceDraft } from "../data/types";
import { draftStateClass, readOnlyStates, stateLabel } from "./EvidenceForm";

// the hint reuses the editor's own read-only rule so card and editor agree
function openHint(state: EvidenceDraft["state"]): string {
  return readOnlyStates.has(state) ? "Opens read-only" : "Opens for editing";
}

export function MyWork(props: {
  drafts: EvidenceDraft[];
  openDraftId?: string | null;
  onNominate: () => void;
  onOpen: (draft: EvidenceDraft) => void;
}) {
  if (props.drafts.length === 0) {
    return (
      <div>
        <p className="field-note">
          Nothing saved yet. Drafts and submissions you create will appear here,
          ready to reopen and continue.
        </p>
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
        <div
          key={draft.draftId}
          className={`task-item${draft.draftId === props.openDraftId ? " selected" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => props.onOpen(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              props.onOpen(draft);
            }
          }}
        >
          <div className="task-name">{draft.attributes?.name ?? draft.taskId}</div>
          <div className="task-meta">
            updated {draft.updatedAt.slice(0, 16).replace("T", " ")} ·{" "}
            {draft.sources.length} source{draft.sources.length === 1 ? "" : "s"}
            {draft.lane === "agent_assisted_ra" ? " · agent-assisted" : ""} ·{" "}
            {openHint(draft.state)}
          </div>
          <span className={`status-pill ${draftStateClass(draft.state)}`}>
            {stateLabel(draft.state)}
          </span>
        </div>
      ))}
    </div>
  );
}
