import { useCallback, useEffect, useMemo, useState } from "react";
import { countries, defaultCountryCode, getCountry } from "./config";
import { DemoProvider } from "./data/demoProvider";
import type { EvidenceDraft, WorkTask } from "./data/types";
import { DraftEvidenceEditor, EvidenceForm } from "./screens/EvidenceForm";
import { FreeContributionPortal } from "./screens/FreeContributionPortal";
import { MyWork } from "./screens/MyWork";
import { TaskList } from "./screens/TaskList";

const provider = new DemoProvider();

type View = "tasks" | "my_work" | "nominate";

// an open My-work record: the draft plus the task record it belongs to,
// so the editor has its site name, batch, and target years
interface OpenRecord {
  task: WorkTask;
  draft: EvidenceDraft;
}

export function App() {
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [view, setView] = useState<View>("tasks");
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [myWork, setMyWork] = useState<EvidenceDraft[]>([]);
  const [openRecord, setOpenRecord] = useState<OpenRecord | null>(null);

  const country = useMemo(() => getCountry(countryCode), [countryCode]);

  const refresh = useCallback(async () => {
    setTasks(await provider.listTasks(countryCode));
    const work = await provider.listMyWork(countryCode);
    setMyWork(work);
    // keep an open My-work record in step with its persisted version, so a
    // later save cannot write back a stale snapshot
    setOpenRecord((prev) => {
      if (!prev) return prev;
      const fresh = work.find((d) => d.draftId === prev.draft.draftId);
      return fresh ? { task: prev.task, draft: fresh } : prev;
    });
  }, [countryCode]);

  useEffect(() => {
    setSelectedTaskId(null);
    setOpenRecord(null);
    void refresh();
  }, [refresh]);

  // open a My-work item in its editor: resolve its task record, then show
  // the record view. a draft opens editable; a submitted record opens
  // read-only via the draft state the editor already respects
  const [openProblem, setOpenProblem] = useState<string | null>(null);

  const openMyWorkRecord = useCallback(async (draft: EvidenceDraft) => {
    const task = await provider.getTask(draft.taskId);
    if (!task) {
      setOpenProblem(
        "This record could not be opened: its task is missing from this browser's saved data.",
      );
      return;
    }
    setOpenProblem(null);
    setOpenRecord({ task, draft });
    setView("my_work");
  }, []);

  const selectedTask = tasks.find((t) => t.taskId === selectedTaskId) ?? null;
  const activeTasks = tasks.filter(
    (t) => t.status !== "skipped" && t.status !== "needs_review" && t.status !== "exported",
  );

  return (
    <>
      <header className="masthead">
        <span className="wordmark">
          <a href="https://www.placesmap.org/">Places of Worship</a>
        </span>
        <span className="context">Research Workbench</span>
        <span className="spacer" />
        <select
          aria-label="Country"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
        >
          {Object.values(countries).map((c) => (
            <option key={c.countryCode} value={c.countryCode}>
              {c.countryName}
            </option>
          ))}
        </select>
      </header>
      <div className="frame">
        <aside className="sidebar">
          <div className="demo-warning">
            Demo mode: work saves to this browser only. The shared backend is
            not connected on this surface yet.
          </div>
          <button
            className={view === "nominate" ? undefined : "secondary"}
            style={{ width: "100%", marginBottom: 10 }}
            onClick={() => {
              setView("nominate");
              setSelectedTaskId(null);
              setOpenRecord(null);
            }}
          >
            Nominate missing PoW
          </button>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              className={view === "tasks" ? undefined : "secondary"}
              onClick={() => {
                setView("tasks");
                setOpenRecord(null);
              }}
            >
              Assigned tasks
            </button>
            <button
              className={view === "my_work" ? undefined : "secondary"}
              onClick={() => {
                setView("my_work");
                setOpenRecord(null);
              }}
            >
              My work
            </button>
          </div>
          {view === "tasks" ? (
            <TaskList
              tasks={activeTasks}
              selectedTaskId={selectedTaskId}
              onSelect={(taskId) => {
                setSelectedTaskId(taskId);
                setOpenRecord(null);
              }}
            />
          ) : (
            <>
              {openProblem && <div className="demo-warning">{openProblem}</div>}
              <MyWork
                drafts={myWork}
                openDraftId={openRecord?.draft.draftId ?? null}
                onNominate={() => {
                  setView("nominate");
                  setOpenRecord(null);
                }}
                onOpen={(draft) => void openMyWorkRecord(draft)}
              />
            </>
          )}
        </aside>
        <main className="main">
          {view === "my_work" && openRecord ? (
            <div>
              <button
                className="tertiary"
                style={{ marginBottom: 10 }}
                onClick={() => setOpenRecord(null)}
              >
                Back to My work
              </button>
              <h1>
                {openRecord.draft.attributes?.name ??
                  openRecord.task.siteName ??
                  openRecord.task.taskId}
              </h1>
              <DraftEvidenceEditor
                key={openRecord.draft.draftId}
                task={openRecord.task}
                country={country}
                provider={provider}
                draft={openRecord.draft}
                onDraftChange={(draft) => setOpenRecord({ task: openRecord.task, draft })}
                onChanged={refresh}
                allowSkip={false}
                showTaskHeader={false}
              />
            </div>
          ) : view === "nominate" ? (
            <FreeContributionPortal country={country} provider={provider} onChanged={refresh} />
          ) : selectedTask ? (
            <EvidenceForm
              key={selectedTask.taskId}
              task={selectedTask}
              country={country}
              provider={provider}
              onChanged={refresh}
            />
          ) : (
            <div>
              <h1>{country.countryName} evidence intake</h1>
              <p>
                Select a task from the list to record source-backed evidence
                about a place of faith. Target years for {country.countryName}:{" "}
                {country.targetYears.join(", ")}. Lifecycle evidence is accepted
                from {country.lifecycleFloorYear} onward.
              </p>
              <h2>Working rules</h2>
              <ul>
                {country.raGuidance.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
