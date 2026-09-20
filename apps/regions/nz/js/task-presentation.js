// task presentation (jb ruling 2026-09-19, after the t3 code survey): one
// pure function from a task's recorded fields to what a viewer sees, so the
// ra portal, the review portal and any batch rollup agree on the label, the
// colour, the precedence and the next action. the status values are the
// server contract in convex/model.ts (taskStatus, reviewDecisionStatus);
// nothing here changes them.
//
// tones carry the colour rule. colour is reserved for three meanings:
//   act    - the viewer must do something (amber, the open-case colour)
//   motion - the viewer's own work is in hand (blue, the action colour)
//   broken - something was refused or failed (red)
// the other two tones are uncoloured resting states:
//   rest   - nothing for this viewer to do now
//   done   - a terminal state; pi_accepted and exported are absorbing, so a
//            later stale read never moves a task back out of them
// pure: no dom, no network.
(function () {
    const TONES = ["act", "motion", "broken", "rest", "done"];
    const TERMINAL = new Set(["pi_accepted", "exported"]);

    function human(value) {
        return String(value ?? "")
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase());
    }

    // the review decision recorded on a reviewed task colours what the ra
    // sees; a reviewer sees the same fact as history, not as a call to act
    function decidedRow(decision, viewer) {
        switch (decision) {
            case "rejected":
                return viewer === "ra"
                    ? { label: "Rejected", tone: "broken", priority: 2, hint: "The reviewer rejected this submission." }
                    : { label: "Rejected", tone: "rest", priority: 1 };
            case "duplicate_task":
                return { label: "Duplicate", tone: "rest", priority: 1, hint: "Recorded as a duplicate of another task." };
            case "deferred":
                return { label: "Deferred", tone: "rest", priority: 1, hint: "The reviewer deferred a decision." };
            case "accepted_for_export":
                return viewer === "pi"
                    ? { label: "Awaiting your acceptance", tone: "act", priority: 6, action: { id: "accept", label: "Accept" } }
                    : viewer === "ra"
                        ? { label: "Accepted by reviewer", tone: "done", priority: 1, hint: "Awaiting the principal investigator." }
                        : { label: "Awaiting PI", tone: "rest", priority: 3 };
            default:
                return viewer === "pi"
                    ? { label: "Awaiting your acceptance", tone: "act", priority: 6, action: { id: "accept", label: "Accept" } }
                    : { label: "Reviewed", tone: "done", priority: 1 };
        }
    }

    function raRow(task) {
        // a revision the contributor is still writing outranks the queue
        // status the task keeps while the revision rides alongside
        if (task.revision_draft_saved) {
            return { label: "Revision draft saved", tone: "motion", priority: 4, action: { id: "continue", label: "Continue revision" } };
        }
        switch (task.status) {
            case "changes_requested":
                return { label: "Changes requested", tone: "act", priority: 6, action: { id: "revise", label: "Revise" }, hint: "The reviewer asked for more evidence." };
            case "reopened":
                return { label: "Reopened", tone: "act", priority: 5, action: { id: "continue", label: "Continue" } };
            case "in_progress":
                return { label: "In progress", tone: "motion", priority: 4, action: { id: "continue", label: "Continue" } };
            case "draft_saved":
                return { label: "Draft saved", tone: "motion", priority: 4, action: { id: "continue", label: "Continue draft" } };
            case "open":
                return { label: "Open", tone: "rest", priority: 3, action: { id: "start", label: "Start" } };
            case "needs_review":
                return { label: "Awaiting review", tone: "rest", priority: 2, secondary: [{ id: "revise", label: "Revise" }] };
            case "unresolved_note":
                return { label: "Note awaiting review", tone: "rest", priority: 2, secondary: [{ id: "revise", label: "Revise" }] };
            case "provisionally_closed":
                return { label: "Provisionally closed", tone: "rest", priority: 1, action: { id: "reopen", label: "Reopen" } };
            case "skipped":
                return { label: "Skipped", tone: "rest", priority: 1, hint: "A reviewer can reopen a skipped task." };
            case "reviewed":
                return Object.assign({ secondary: [{ id: "reopen", label: "Reopen" }] }, decidedRow(task.latest_decision_status, "ra"));
            case "pi_accepted":
                return { label: "Accepted", tone: "done", priority: 0 };
            case "exported":
                return { label: "Exported", tone: "done", priority: 0 };
            default:
                return { label: human(task.status), tone: "rest", priority: 1 };
        }
    }

    function reviewerRow(task, viewer) {
        switch (task.status) {
            case "needs_review":
                return { label: "Needs review", tone: "act", priority: 6, action: { id: "review", label: "Review" } };
            case "unresolved_note":
                return { label: "Note to resolve", tone: "act", priority: 6, action: { id: "review", label: "Review" } };
            case "provisionally_closed":
                return { label: "Provisionally closed", tone: "act", priority: 5, action: { id: "review", label: "Review" } };
            case "changes_requested":
                return { label: "With the contributor", tone: "rest", priority: 2, hint: "Changes were requested; waiting on a revision." };
            case "in_progress":
            case "draft_saved":
            case "reopened":
            case "open":
                return { label: "In hand", tone: "rest", priority: 2, hint: "The contributor has not submitted yet." };
            case "skipped":
                return { label: "Skipped", tone: "rest", priority: 1, action: { id: "reopen", label: "Reopen" } };
            case "reviewed":
                return decidedRow(task.latest_decision_status, viewer);
            case "pi_accepted":
                return { label: "Accepted", tone: "done", priority: 0 };
            case "exported":
                return { label: "Exported", tone: "done", priority: 0 };
            default:
                return { label: human(task.status), tone: "rest", priority: 1 };
        }
    }

    // present(task, { viewer }) -> { status, label, tone, priority, action, secondary, hint }
    // task: { status, latest_decision_status?, revision_draft_saved? }
    // viewer: "ra" (default) | "reviewer" | "pi"
    function present(task, options) {
        const viewer = options?.viewer === "reviewer" || options?.viewer === "pi" ? options.viewer : "ra";
        const source = task || {};
        const row = viewer === "ra" ? raRow(source) : reviewerRow(source, viewer);
        return {
            status: source.status ?? null,
            viewer,
            label: row.label,
            tone: TONES.includes(row.tone) ? row.tone : "rest",
            priority: row.priority ?? 1,
            terminal: TERMINAL.has(source.status),
            action: row.action ?? null,
            secondary: row.secondary ?? [],
            hint: row.hint ?? "",
        };
    }

    // a later read of a task never regresses a terminal status; the
    // caller keeps `previous` when the incoming row would move it back.
    // callers with `updated_at` on both rows compare stamps first (the ra
    // portal's mergeTaskRead), since a curator may reopen an exported
    // task and that newer row must land; absorb is the rule when there
    // is nothing to compare
    function absorb(previous, incoming) {
        if (previous && TERMINAL.has(previous.status) && incoming && !TERMINAL.has(incoming.status)) {
            return previous;
        }
        return incoming;
    }

    // sort helper: the most urgent row first, then by name
    function compare(a, b, options) {
        const pa = present(a, options).priority;
        const pb = present(b, options).priority;
        if (pa !== pb) return pb - pa;
        return String(a?.task_name ?? a?.name ?? "").localeCompare(String(b?.task_name ?? b?.name ?? ""));
    }

    // rollup(tasks, { viewer }) -> one line for a batch or a queue: the most
    // urgent tone wins, and the label counts only the rows in that tone
    function rollup(tasks, options) {
        const rows = (tasks || []).map((t) => present(t, options));
        const viewer = rows[0]?.viewer ?? (options?.viewer || "ra");
        const counts = { act: 0, motion: 0, broken: 0, rest: 0, done: 0 };
        for (const r of rows) counts[r.tone] += 1;
        const total = rows.length;
        if (total === 0) return { label: "Nothing here", tone: "rest", priority: 0, counts, total };
        if (counts.act > 0) {
            const verb = viewer === "ra" ? "need your action" : "to review";
            return { label: `${counts.act} ${verb}`, tone: "act", priority: 6, counts, total };
        }
        if (counts.broken > 0) return { label: `${counts.broken} rejected`, tone: "broken", priority: 5, counts, total };
        if (counts.motion > 0) return { label: `${counts.motion} in hand`, tone: "motion", priority: 4, counts, total };
        if (counts.rest > 0) {
            const waiting = viewer === "ra" ? "awaiting review" : "waiting on others";
            return { label: `${counts.rest} ${waiting}`, tone: "rest", priority: 2, counts, total };
        }
        return { label: "All done", tone: "done", priority: 0, counts, total };
    }

    // transport state is the other axis: it says whether the page can talk
    // to the backend, never what a task is doing. shown as a dot by the
    // account name, never as a task pill.
    const TRANSPORT = {
        unconfigured: { label: "Backend not configured", tone: "broken" },
        signed_out: { label: "Signed out", tone: "rest" },
        signing_in: { label: "Signing in", tone: "motion", pulse: true },
        loading: { label: "Loading", tone: "motion", pulse: true },
        saving: { label: "Saving", tone: "motion", pulse: true },
        ready: { label: "Connected", tone: "done" },
        saved: { label: "Saved", tone: "done" },
        offline: { label: "Offline", tone: "broken" },
        error: { label: "Connection problem", tone: "broken" },
    };

    function transport(state) {
        const row = TRANSPORT[state] || TRANSPORT.error;
        return { state: TRANSPORT[state] ? state : "error", label: row.label, tone: row.tone, pulse: Boolean(row.pulse) };
    }

    const api = { present, rollup, compare, absorb, transport, human, TONES, TERMINAL };
    if (typeof window !== "undefined") window.PowTaskPresentation = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
