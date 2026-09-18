import { useEffect, useRef, useState } from "react";
import "./agent-intake.css";

type View = "nominate" | "assist" | "record";
type Lead = { name: string; location: string; note: string; link: string; approximate: boolean };
type Request = { id: string; kind: "nomination" | "assistance"; label: string; question: string; context: string; createdAt: string };
type Saved = { lead: Lead; question: string; requests: Request[] };
const emptyLead: Lead = { name: "", location: "", note: "", link: "", approximate: false };
const storageKey = "pow-agent-concept.v1";
const exampleContext = "Example Chapel · demo:place-1 · evidence version demo:v3";

function load(): Saved {
  const fallback: Saved = { lead: { ...emptyLead }, question: "", requests: [] };
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (!raw || typeof raw !== "object") return fallback;
    const saved = raw as Partial<Saved>;
    if (!saved.lead || [saved.lead.name, saved.lead.location, saved.lead.note, saved.lead.link, saved.question].some(v => typeof v !== "string") || typeof saved.lead.approximate !== "boolean" || !Array.isArray(saved.requests)) return fallback;
    if (saved.requests.length > 100 || saved.requests.some(r => !r || typeof r !== "object" || !["nomination", "assistance"].includes(r.kind) || [r.id, r.label, r.question, r.context, r.createdAt].some(v => typeof v !== "string"))) return fallback;
    return saved as Saved;
  } catch { return fallback; }
}

function leadContext(context: string): string {
  try {
    const value: unknown = JSON.parse(context);
    if (value && typeof value === "object" && "location" in value && typeof value.location === "string") {
      return `${value.location}${"approximate" in value && value.approximate ? " · approximate location" : ""}`;
    }
  } catch { /* a damaged preview should remain readable */ }
  return "Location unavailable in this preview.";
}

function validLink(value: string): boolean {
  if (!value.trim()) return true;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}

export function AgentIntake() {
  const [view, setView] = useState<View>("nominate");
  const [saved, setSaved] = useState<Saved>(load);
  const [receipt, setReceipt] = useState<Request | null>(null);
  const [problem, setProblem] = useState("");
  const [storageProblem, setStorageProblem] = useState(false);
  const [exampleAnswer, setExampleAnswer] = useState(false);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); setStorageProblem(false); }
    catch { setStorageProblem(true); }
  }, [saved]);
  useEffect(() => { if (receipt) receiptHeading.current?.focus(); }, [receipt]);

  const setLead = <K extends keyof Lead>(key: K, value: Lead[K]) => {
    setSaved(current => ({ ...current, lead: { ...current.lead, [key]: value } }));
    setProblem("");
  };
  const changeView = (next: View) => { setView(next); setReceipt(null); setProblem(""); };
  const saveRequest = (kind: Request["kind"], label: string, question: string, context: string) => {
    if (saved.requests.length >= 100) { setProblem("This demo has reached its local request limit. Start a new tab to continue."); return; }
    const prior = saved.requests.find(r => r.kind === kind && r.label === label && r.question === question && r.context === context);
    const request: Request = prior ?? { id: crypto.randomUUID(), kind, label, question, context, createdAt: new Date().toISOString() };
    if (!prior) setSaved(current => ({ ...current, requests: [request, ...current.requests] }));
    setReceipt(request);
  };
  const nominate = (event: React.FormEvent) => {
    event.preventDefault();
    const lead = saved.lead;
    if (!lead.name.trim() || !lead.location.trim()) { setProblem("Add a place name or description and a location we could investigate."); return; }
    if (!validLink(lead.link)) { setProblem("Use a public link beginning with https:// or http://, without sign-in details."); return; }
    saveRequest("nomination", lead.name.trim(), lead.note.trim() || "Investigate whether this is a place of worship.", JSON.stringify({ location: lead.location.trim(), approximate: lead.approximate, source: lead.link.trim() || null }));
  };
  const ask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!saved.question.replace(/@research\b/g, "").trim()) { setProblem("Add the question you would like the agent to investigate."); return; }
    saveRequest("assistance", "Example Chapel", saved.question.trim(), exampleContext);
  };
  const chooseQuestion = (question: string) => { setSaved(current => ({ ...current, question: `@research ${question}` })); setProblem(""); questionInput.current?.focus(); };

  return <div className="ai-concept">
    <header className="ai-header"><a className="ai-brand" href="?concept=agent"><span className="ai-brand-icon" aria-hidden="true">⌖</span> Places of Worship</a><span className="ai-prototype">INTERACTION PROTOTYPE</span></header>
    <div className="ai-demo" role="note">Try the proposed flow. Everything stays in this tab; requests are not sent and agents are not running.</div>
    <nav className="ai-nav" aria-label="Prototype views">{([['nominate', 'Public contribution'], ['assist', 'RA workspace'], ['record', 'Research record']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => changeView(key)}>{label}</button>)}</nav>
    <main className="ai-layout">
      <section className="ai-work" aria-label="Contribution workspace">
        {storageProblem && <p className="ai-error" role="alert">Browser storage is unavailable. Your work is held in memory and will be lost when this page closes or reloads.</p>}
        {receipt ? <div className="ai-receipt">
          <span className="ai-check" aria-hidden="true">✓</span><p className="ai-eyebrow">LOCAL PREVIEW</p>
          <h1 ref={receiptHeading} tabIndex={-1}>Your {receipt.kind === 'nomination' ? 'lead' : 'question'} is ready.</h1>
          <p>{storageProblem ? 'Held in memory for this preview.' : 'Saved in this tab for this preview.'} A connected service would acknowledge receipt before showing a research status.</p>
          <div className="ai-context"><strong>{receipt.label}</strong><p>{receipt.question}</p><small>{receipt.kind === 'assistance' ? receipt.context : leadContext(receipt.context)}</small></div>
          <h2>What would happen next?</h2><ol className="ai-next"><li><strong>Triage the lead</strong><span>Check the location, nearby records, and whether the material can be researched.</span></li><li><strong>Investigate the question</strong><span>Keep source links, uncertainty, and useful questions for a later pass.</span></li><li><strong>Return the findings</strong><span>A person reviews proposed evidence before it can affect the map.</span></li></ol>
          <button className="ai-primary" onClick={() => { setReceipt(null); setView('record'); }}>Explore an example research record</button>
          <button className="ai-text" onClick={() => setReceipt(null)}>Back to my {receipt.kind === 'nomination' ? 'lead' : 'question'}</button>
        </div> : view === 'nominate' ? <>
          <p className="ai-eyebrow">A PLACE YOU KNOW. A HISTORY TO DISCOVER.</p><h1>Know a place<br />we might be missing?</h1>
          <p className="ai-intro">Point us towards it. A name and a location are enough to start; share whatever else you know.</p>
          <form onSubmit={nominate} noValidate>
            <label htmlFor="lead-name">What is the place called?<span>A description is fine if you do not know the name.</span></label>
            <input id="lead-name" value={saved.lead.name} maxLength={200} onChange={e => setLead('name', e.target.value)} placeholder="e.g. the old chapel beside the school" required aria-describedby={problem ? 'request-error' : undefined} />
            <label htmlFor="lead-location">Where is it?<span>A town, address, landmark, or map link.</span></label>
            <input id="lead-location" value={saved.lead.location} maxLength={500} onChange={e => setLead('location', e.target.value)} placeholder="e.g. Church Road, near the school, Exampletown" required />
            <label className="ai-checklabel"><input type="checkbox" checked={saved.lead.approximate} onChange={e => setLead('approximate', e.target.checked)} /> I only know the approximate location</label>
            <details className="ai-optional"><summary>Add a note or a source <span>optional</span></summary><label htmlFor="lead-note">What do you know?<span>An observation, a memory, or a question is useful.</span></label><textarea id="lead-note" value={saved.lead.note} maxLength={4000} onChange={e => setLead('note', e.target.value)} rows={4} placeholder="I remember services here, but I am unsure when they stopped." /><label htmlFor="lead-link">A public source link</label><input id="lead-link" type="url" value={saved.lead.link} maxLength={2048} onChange={e => setLead('link', e.target.value)} placeholder="https://…" /><p className="ai-small">Share information about the place. Leave personal contact details and restricted material out of this form.</p></details>
            {problem && <p id="request-error" className="ai-error" role="alert">{problem}</p>}
            <button className="ai-primary" type="submit">Nominate missing PoW <span aria-hidden="true">↗</span></button><p className="ai-small">Demo: saves in this tab. A nomination remains provisional until reviewed.</p>
          </form>
        </> : view === 'assist' ? <>
          <p className="ai-eyebrow">YOUR RESEARCH WORKSPACE</p><h1>A little help,<br />right where you need it.</h1><p className="ai-intro">Ask about the place you are working on. The task and evidence version go with your question.</p>
          <div className="ai-place"><div className="ai-place-icon" aria-hidden="true">⌂</div><div><strong>Example Chapel</strong><span>Invented place · demonstration only</span></div><span className="ai-status">First pass</span></div>
          <div className="ai-observation"><p className="ai-eyebrow">YOUR CURRENT EVIDENCE</p><p>“The building was opened in 1891.”</p><span>The date of the first worship service is unresolved.</span></div>
          <form onSubmit={ask} noValidate><label htmlFor="agent-question">What would you like help with?</label><div className="ai-suggestions">{['Find a source for the first service.', 'Help resolve the date uncertainty.', 'Check for a possible duplicate.'].map(q => <button type="button" key={q} onClick={() => chooseQuestion(q)}>{q}</button>)}</div><textarea ref={questionInput} id="agent-question" value={saved.question} onChange={e => { setSaved(current => ({ ...current, question: e.target.value })); setProblem(''); }} maxLength={4000} rows={4} placeholder="@research Can you find when worship began here?" /><p className="ai-attached"><span aria-hidden="true">↳</span> Example Chapel and evidence version demo:v3 attached</p>{problem && <p className="ai-error" role="alert">{problem}</p>}<button type="submit" className="ai-primary">Ask an agent <span aria-hidden="true">↗</span></button><p className="ai-small">Demo: saves your question locally. Your evidence remains unchanged.</p></form>
          {saved.requests.filter(r => r.kind === 'assistance').length > 0 && <section className="ai-history"><h2>Your saved questions</h2>{saved.requests.filter(r => r.kind === 'assistance').map(r => <button key={r.id} className="ai-saved" onClick={() => setReceipt(r)}><span>{r.question}</span><small>Local preview · not sent</small></button>)}</section>}
        </> : <>
          <p className="ai-eyebrow">A RECORD YOU CAN RETURN TO</p><h1>Keep what we know.<br />Keep the questions, too.</h1><p className="ai-intro">An invented example shows how a first pass could look. Sources and annotations stay beside each claim.</p>
          <div className="ai-place"><div className="ai-place-icon" aria-hidden="true">⌂</div><div><strong>Example Chapel</strong><span>Demonstration · evidence version demo:v3</span></div><span className="ai-status">Provisional</span></div>
          <article className="ai-claim"><div className="ai-claim-top"><h2>Building opened in 1891</h2><span className="ai-status">Example claim</span></div><p className="ai-quote">“The new chapel building was opened in 1891.”</p><details><summary>Inspect the source and annotation</summary><dl><dt>Source</dt><dd>Invented local history, page 12. This is sample text, not historical evidence.</dd><dt>Scope</dt><dd>Building opening; first worship use remains unresolved.</dd><dt>Annotation</dt><dd>A building date alone does not establish the start of worship at the site.</dd><dt>Attribution</dt><dd>Example agent attempt · human review pending</dd></dl></details></article>
          <article className="ai-question"><span className="ai-eyebrow">STILL TO INVESTIGATE</span><h2>When did worship begin here?</h2><p>Find a dated account of the first service. Keep the building date separate.</p><button className="ai-secondary" onClick={() => { changeView('assist'); chooseQuestion('Find a dated account of the first worship service.'); }}>Ask an agent about this</button></article>
          <details className="ai-history"><summary>Research history</summary><p><strong>Pass 1 · partial</strong><br />Building date recorded; worship commencement unresolved.</p><p><strong>Next pass</strong><br />Add evidence and link to the earlier pass. Earlier sources and annotations remain available.</p></details>
          <button className="ai-text" onClick={() => setExampleAnswer(!exampleAnswer)}>{exampleAnswer ? 'Hide example agent response' : 'Show example agent response'}</button>
          {exampleAnswer && <div className="ai-answer" role="status"><p className="ai-eyebrow">ILLUSTRATIVE RESPONSE · NOT AGENT OUTPUT</p><h2>The first-service date is still uncertain.</h2><p>The example source supports a building date. A later investigation would need a dated service notice or another source that identifies worship at this site.</p><p><strong>Suggested next step:</strong> search contemporary notices, then retain the result even if access is blocked.</p></div>}
        </>}
      </section>
      <aside className="ai-side" aria-label="How contributions become evidence"><div className="ai-side-art" aria-hidden="true"><svg viewBox="0 0 320 220"><path d="M0 170 Q80 105 140 155 T320 115 M0 195 Q90 120 170 185 T320 160" fill="none" stroke="#c9d9cf" strokeWidth="2"/><path d="M30 0 L110 220 M210 0 L150 220 M0 85 L320 110" stroke="#fff" strokeWidth="13"/><path d="M30 0 L110 220 M210 0 L150 220 M0 85 L320 110" stroke="#d7dfd8" strokeWidth="1"/><circle cx="180" cy="106" r="36" fill="#246650" opacity=".10"/><circle cx="180" cy="106" r="8" fill="#246650" stroke="white" strokeWidth="4"/><circle cx="88" cy="156" r="6" fill="#d4a344" stroke="white" strokeWidth="3"/><circle cx="245" cy="45" r="6" fill="#d4a344" stroke="white" strokeWidth="3"/></svg><span>Every place starts with a lead.</span></div><div className="ai-side-copy"><p className="ai-eyebrow">SMALL CONTRIBUTIONS, RICHER HISTORIES</p><h2>You bring the clue.<br />We build the evidence.</h2><p>The proposed research service follows useful leads, records sources, and asks for help where evidence runs out.</p><ul><li>Uncertainty is welcome.</li><li>Earlier research stays available.</li><li>People review proposed evidence.</li></ul><p className="ai-side-note">This drawing is illustrative. The live map and portal are unchanged.</p></div></aside>
    </main><footer className="ai-footer">Places of Worship <span>Proposed contribution experience · September 2026</span><a href="?">Open the existing workbench demo</a></footer>
  </div>;
}
