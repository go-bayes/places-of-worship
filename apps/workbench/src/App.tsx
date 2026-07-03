import { useCallback, useEffect, useMemo, useState } from "react";
import { countries, defaultCountryCode, getCountry } from "./config";
import { DemoProvider } from "./data/demoProvider";
import type { EvidenceDraft, WorkTask } from "./data/types";
import { EvidenceForm } from "./screens/EvidenceForm";
import { MyWork } from "./screens/MyWork";
import { TaskList } from "./screens/TaskList";

const provider = new DemoProvider();

type View = "tasks" | "my_work";

export function App() {
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [view, setView] = useState<View>("tasks");
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [myWork, setMyWork] = useState<EvidenceDraft[]>([]);

  const country = useMemo(() => getCountry(countryCode), [countryCode]);

  const refresh = useCallback(async () => {
    setTasks(await provider.listTasks(countryCode));
    setMyWork(await provider.listMyWork(countryCode));
  }, [countryCode]);

  useEffect(() => {
    setSelectedTaskId(null);
    void refresh();
  }, [refresh]);

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
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              className={view === "tasks" ? undefined : "secondary"}
              onClick={() => setView("tasks")}
            >
              Assigned tasks
            </button>
            <button
              className={view === "my_work" ? undefined : "secondary"}
              onClick={() => setView("my_work")}
            >
              My work
            </button>
          </div>
          {view === "tasks" ? (
            <TaskList
              tasks={activeTasks}
              selectedTaskId={selectedTaskId}
              onSelect={setSelectedTaskId}
            />
          ) : (
            <MyWork drafts={myWork} />
          )}
        </aside>
        <main className="main">
          {selectedTask ? (
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
