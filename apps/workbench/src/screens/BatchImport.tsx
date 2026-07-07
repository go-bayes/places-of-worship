import { useRef, useState } from "react";
import type { CountryConfig } from "../config";
import { IMPORT_MAX_ROWS } from "../data/batchImport";
import type { WorkbenchProvider } from "../data/provider";
import type { BatchImportReport, SourceRecordInput, SourceType } from "../data/types";
import { sourceTypes } from "./EvidenceForm";

// curator batch import (docs/portal-batch-import-and-corrections.md):
// one file, one source record, many source-first claims arriving as
// drafts. the RA path stays one-by-one; this screen is the curator's.

const TEMPLATE_HEADER =
  "name,country_code,religion,denomination_code,taxonomy_version,lat,lng,locality,containing_area,geocoding_basis,location_confidence,source_locator,source_url,first_date,last_date,date_confidence,culturally_sensitive,notes";

function emptySource(countryCode: string): SourceRecordInput {
  return {
    countryCode,
    sourceType: "denominational_directory",
    title: "",
  };
}

function statusPillClass(status: string): string {
  if (status === "imported") return "status-present";
  if (status === "rejected") return "status-absent";
  return "status-uncertain";
}

export function BatchImport(props: {
  country: CountryConfig;
  provider: WorkbenchProvider;
  onChanged: () => Promise<void>;
}) {
  const { country, provider } = props;
  const [source, setSource] = useState<SourceRecordInput>(() => emptySource(country.countryCode));
  const [csvText, setCsvText] = useState("");
  const [report, setReport] = useState<BatchImportReport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  function update(patch: Partial<SourceRecordInput>): void {
    setSource({ ...source, ...patch });
  }

  async function readFile(file: File): Promise<void> {
    setCsvText(await file.text());
  }

  async function runImport(): Promise<void> {
    setBusy(true);
    setProblem(null);
    try {
      const result = await props.provider.importNominationBatch({
        countryCode: country.countryCode,
        source: { ...source, countryCode: country.countryCode },
        csvText,
      });
      setReport(result);
      await props.onChanged();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Import a nomination batch</h1>
      <p className="task-meta">Curator tool · {country.countryName}</p>
      <div className="demo-warning">
        Curator lane: imported rows arrive as drafts owned by you — nothing
        is auto-submitted, and every claim faces the same review as a
        one-by-one nomination. Fix rejected rows in place and re-upload the
        whole file; already-imported rows are skipped, never duplicated.
      </div>

      <fieldset>
        <legend>Source record (one per file)</legend>
        <div className="field-note">
          The file itself is the source you consulted. Rows point into it via
          their <code>source_locator</code>.
        </div>
        <label htmlFor="import-source-type">Source type</label>
        <select
          id="import-source-type"
          value={source.sourceType}
          onChange={(event) => update({ sourceType: event.target.value as SourceType })}
        >
          {sourceTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <label htmlFor="import-source-title">Title</label>
        <input
          id="import-source-title"
          value={source.title}
          onChange={(event) => update({ title: event.target.value })}
        />
        <label htmlFor="import-source-url">URL</label>
        <input
          id="import-source-url"
          value={source.url ?? ""}
          onChange={(event) => update({ url: event.target.value || undefined })}
        />
        <div className="form-grid three">
          <div>
            <label htmlFor="import-archive-repo">Archive repository</label>
            <input
              id="import-archive-repo"
              value={source.archiveRef?.repositoryName ?? ""}
              onChange={(event) =>
                update({
                  archiveRef: {
                    repositoryName: event.target.value,
                    collection: source.archiveRef?.collection ?? "",
                    consultedDate: source.archiveRef?.consultedDate ?? "",
                  },
                })
              }
            />
          </div>
          <div>
            <label htmlFor="import-archive-collection">Archive collection</label>
            <input
              id="import-archive-collection"
              value={source.archiveRef?.collection ?? ""}
              onChange={(event) =>
                update({
                  archiveRef: {
                    repositoryName: source.archiveRef?.repositoryName ?? "",
                    collection: event.target.value,
                    consultedDate: source.archiveRef?.consultedDate ?? "",
                  },
                })
              }
            />
          </div>
          <div>
            <label htmlFor="import-archive-consulted">Archive consulted date</label>
            <input
              id="import-archive-consulted"
              placeholder="YYYY[-MM[-DD]]"
              value={source.archiveRef?.consultedDate ?? ""}
              onChange={(event) =>
                update({
                  archiveRef: {
                    repositoryName: source.archiveRef?.repositoryName ?? "",
                    collection: source.archiveRef?.collection ?? "",
                    consultedDate: event.target.value,
                  },
                })
              }
            />
          </div>
        </div>
        <div className="form-grid two">
          <div>
            <label htmlFor="import-source-licence">Licence</label>
            <input
              id="import-source-licence"
              value={source.licence ?? ""}
              onChange={(event) => update({ licence: event.target.value || undefined })}
            />
          </div>
          <div>
            <label htmlFor="import-source-consulted">Consulted date</label>
            <input
              id="import-source-consulted"
              placeholder="YYYY[-MM[-DD]]"
              value={source.consultedDate ?? ""}
              onChange={(event) => update({ consultedDate: event.target.value || undefined })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Rows (CSV, up to {IMPORT_MAX_ROWS} per run)</legend>
        <div className="field-note">
          Required columns: <code>name</code>, <code>country_code</code>,{" "}
          <code>source_locator</code>
          {country.culturalSensitivityPrompt ? (
            <>
              , and <code>culturally_sensitive</code> (yes/no) for{" "}
              {country.countryName}
            </>
          ) : null}
          . Unknown columns are preserved as notes. Full contract:
          docs/portal-batch-import-and-corrections.md.
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        <label htmlFor="import-csv-text">Or paste CSV</label>
        <textarea
          id="import-csv-text"
          rows={8}
          placeholder={TEMPLATE_HEADER}
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
        />
        {problem && <div className="demo-warning">{problem}</div>}
        <div className="action-row">
          <button disabled={busy || !csvText.trim()} onClick={() => void runImport()}>
            Validate and import
          </button>
          <button
            className="secondary"
            onClick={() => {
              setCsvText("");
              setReport(null);
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            Clear
          </button>
        </div>
      </fieldset>

      {report && (
        <fieldset>
          <legend>Import report</legend>
          {report.fileProblems.length > 0 ? (
            <div className="demo-warning">
              <strong>The file could not be imported:</strong>
              <ul className="compact-list">
                {report.fileProblems.map((fileProblem) => (
                  <li key={fileProblem}>{fileProblem}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className="field-note">
                Batch <code>{report.batchId}</code> · {report.totalRows} rows:{" "}
                {report.imported} imported, {report.rejected} rejected,{" "}
                {report.parkedSensitive} parked for the kastom answer,{" "}
                {report.skippedExisting} already imported. Imported drafts are
                under My work; submit them after checking the report.
              </p>
              <div className="table-wrap">
                <table className="claim-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Locator</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>
                        <td>{row.name ?? ""}</td>
                        <td>{row.sourceLocator ?? ""}</td>
                        <td>
                          <span className={`status-pill ${statusPillClass(row.status)}`}>
                            {row.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          {row.problems.length > 0 ? (
                            <ul className="compact-list">
                              {row.problems.map((rowProblem) => (
                                <li key={rowProblem}>{rowProblem}</li>
                              ))}
                            </ul>
                          ) : (
                            ""
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </fieldset>
      )}
    </div>
  );
}
