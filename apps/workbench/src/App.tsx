import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countries, defaultCountryCode, getCountry } from "./config";
import { DemoProvider } from "./data/demoProvider";
import type { EvidenceDraft, WorkTask } from "./data/types";
import { BatchImport } from "./screens/BatchImport";
import { DraftEvidenceEditor, EvidenceForm } from "./screens/EvidenceForm";
import { FreeContributionPortal } from "./screens/FreeContributionPortal";
import { MyWork } from "./screens/MyWork";
import { TaskList } from "./screens/TaskList";

const provider = new DemoProvider();

type View = "tasks" | "my_work" | "nominate" | "import";

// map-route entry (docs/portal-batch-import-and-corrections.md): the
// workbench accepts country/site/name/lat/lng/zoom parameters. with
// `site`, the flow is a correction bound to that existing site;
// without it, plain workbench. invalid parameters degrade silently.
interface MapRouteParams {
  countryCode?: string;
  siteId?: string;
  siteName?: string;
  lat?: number;
  lng?: number;
}

function readMapRouteParams(): MapRouteParams | null {
  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length === 0) return null;
  const number = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "" || Number.isNaN(Number(raw))) return undefined;
    return Number(raw);
  };
  const countryRaw = params.get("country")?.toUpperCase();
  return {
    countryCode: countryRaw && countries[countryRaw] ? countryRaw : undefined,
    siteId: params.get("site")?.trim() || undefined,
    siteName: params.get("name")?.trim() || undefined,
    lat: number("lat"),
    lng: number("lng"),
  };
}

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

  // dirty draft guard (finding 6): the editors are keyed, so task and view
  // switches unmount them and discard in-memory edits. a ref rather than
  // state lets navigation handlers consult the current value without
  // re-rendering on every keystroke
  const dirtyRef = useRef(false);
  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  // ask before any navigation that would unmount an editor with unsaved
  // edits; a confirmed leave clears the flag so it cannot linger
  const confirmDiscard = useCallback(() => {
    if (!dirtyRef.current) return true;
    const leave = window.confirm(
      "You have unsaved edits. Leave without saving? Your changes will be discarded.",
    );
    if (leave) dirtyRef.current = false;
    return leave;
  }, []);

  // warn on tab close or reload while an editor holds unsaved edits
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      // legacy path for browsers that ignore preventDefault
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const refresh = useCallback(async () => {
    setTasks(await provider.listTasks(countryCode));
    const work = await provider.listMyWork(countryCode);
    setMyWork(work);
    // keep an open My-work record in step with its persisted version, so a
    // later save cannot write back a stale snapshot; a draft that has
    // disappeared from the provider closes rather than lingering stale
    // (matters once ConvexProvider can drop drafts between refreshes)
    setOpenRecord((prev) => {
      if (!prev) return prev;
      const fresh = work.find((d) => d.draftId === prev.draft.draftId);
      return fresh ? { task: prev.task, draft: fresh } : null;
    });
  }, [countryCode]);

  useEffect(() => {
    setSelectedTaskId(null);
    setOpenRecord(null);
    void refresh();
  }, [refresh]);

  const [mapContext, setMapContext] = useState<{ lat?: number; lng?: number; name?: string } | null>(null);

  // consume map-route parameters exactly once, then strip them from the
  // URL so a refresh cannot mint a duplicate correction task
  const routeHandled = useRef(false);
  useEffect(() => {
    if (routeHandled.current) return;
    routeHandled.current = true;
    const route = readMapRouteParams();
    if (!route) return;
    window.history.replaceState(null, "", window.location.pathname);
    const routeCountry = route.countryCode ?? defaultCountryCode;
    if (route.countryCode) setCountryCode(route.countryCode);
    if (route.siteId) {
      void (async () => {
        const handle = await provider.createCorrection({
          countryCode: routeCountry,
          siteId: route.siteId!,
          siteName: route.siteName,
          mapContext: { lat: route.lat, lng: route.lng },
        });
        await refresh();
        setView("tasks");
        setSelectedTaskId(handle.task.taskId);
      })();
    } else if (route.lat !== undefined || route.lng !== undefined || route.siteName) {
      // a nomination started from the map opens the nominate flow; the
      // map context prefills the place-first identity fields
      setMapContext({ lat: route.lat, lng: route.lng, name: route.siteName });
      setView("nominate");
    }
    // refresh is stable per country; run-once semantics are the point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <a href="https://religionmap.org/">Places of Worship</a>
        </span>
        <span className="context">Research Workbench</span>
        <span className="spacer" />
        <select
          aria-label="Country"
          value={countryCode}
          onChange={(e) => {
            // a country change resets selection and unmounts any open editor
            if (!confirmDiscard()) return;
            setCountryCode(e.target.value);
          }}
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
              if (!confirmDiscard()) return;
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
                // only an open My-work record unmounts here; a selected
                // task's editor survives the view switch
                if (openRecord && !confirmDiscard()) return;
                setView("tasks");
                setOpenRecord(null);
              }}
            >
              Assigned tasks
            </button>
            <button
              className={view === "my_work" ? undefined : "secondary"}
              onClick={() => {
                if (openRecord && !confirmDiscard()) return;
                setView("my_work");
                setOpenRecord(null);
              }}
            >
              My work
            </button>
          </div>
          <button
            className={view === "import" ? undefined : "secondary"}
            style={{ width: "100%", marginBottom: 10 }}
            onClick={() => {
              if (!confirmDiscard()) return;
              setView("import");
              setSelectedTaskId(null);
              setOpenRecord(null);
            }}
          >
            Import batch (curator)
          </button>
          {view === "tasks" ? (
            <TaskList
              tasks={activeTasks}
              selectedTaskId={selectedTaskId}
              onSelect={(taskId) => {
                // reselecting the open task keeps the editor mounted, so it
                // needs no guard
                if (taskId === selectedTaskId) return;
                if (!confirmDiscard()) return;
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
                  // nominate unmounts whichever editor is open, like its siblings
                  if (!confirmDiscard()) return;
                  setView("nominate");
                  setOpenRecord(null);
                }}
                onOpen={(draft) => {
                  // reopening the open record keeps the editor mounted
                  if (draft.draftId === openRecord?.draft.draftId) return;
                  if (!confirmDiscard()) return;
                  void openMyWorkRecord(draft);
                }}
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
                onClick={() => {
                  if (!confirmDiscard()) return;
                  setOpenRecord(null);
                }}
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
                onDirtyChange={setDirty}
                onChanged={refresh}
                allowSkip={false}
                showTaskHeader={false}
              />
            </div>
          ) : view === "nominate" ? (
            <FreeContributionPortal
              country={country}
              provider={provider}
              onChanged={refresh}
              initialMapContext={mapContext ?? undefined}
            />
          ) : view === "import" ? (
            <BatchImport country={country} provider={provider} onChanged={refresh} />
          ) : selectedTask ? (
            <EvidenceForm
              key={selectedTask.taskId}
              task={selectedTask}
              country={country}
              provider={provider}
              onDirtyChange={setDirty}
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
