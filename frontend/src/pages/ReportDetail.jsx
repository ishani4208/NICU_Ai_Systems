import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { deleteRecord, fetchRecordById } from "../api.js";
import ResultView from "../components/ResultView.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import usePendingReport from "../hooks/usePendingReport.js";
import { DownloadIcon, TrashIcon } from "../components/Icons.jsx";

function waitForImages(timeoutMs = 4000) {
  const pending = Array.from(document.images).filter((img) => !img.complete);
  const loaded = Promise.all(
    pending.map((img) => new Promise((resolve) => { img.onload = img.onerror = resolve; }))
  );
  return Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRecordById(id)
      .then((data) => !cancelled && setRecord(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const updateRecord = useCallback((next) => setRecord(next), []);
  usePendingReport(record, updateRecord);

  // The browser uses the page title as the default PDF file name
  useEffect(() => {
    if (!record) return undefined;
    const previous = document.title;
    document.title = `NICU-Report-${record.displayId}`;
    return () => {
      document.title = previous;
    };
  }, [record]);

  const reportReady = record && record.reportStatus !== "pending";
  useEffect(() => {
    if (!autoPrint || !reportReady) return undefined;
    // Let the report render, wait for the spectrogram, then open the print dialog
    const timer = setTimeout(() => waitForImages().then(() => window.print()), 300);
    return () => clearTimeout(timer);
  }, [autoPrint, reportReady]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteRecord(record.id);
      navigate("/history");
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div>
      <div className="page-toolbar no-print">
        <Link to="/history" className="back-link">
          ← Back to history
        </Link>
        {record && (
          <div className="toolbar-actions">
            <button type="button" className="secondary" onClick={() => window.print()} disabled={!reportReady}>
              <DownloadIcon size={16} />
              Download PDF
            </button>
            <button type="button" className="ghost danger-outline" onClick={() => setConfirmOpen(true)}>
              <TrashIcon size={16} />
              Delete
            </button>
          </div>
        )}
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Loading report...</p>}
      {error && <div className="error-box">{error}</div>}

      {record && (
        <>
          <div className="info-box report-meta">
            <strong>Report {record.displayId}</strong> &mdash; {record.filename} &mdash;{" "}
            {new Date(record.createdAt).toLocaleString()}
          </div>
          <ResultView record={record} />
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={record ? `Delete report ${record.displayId}?` : "Delete report?"}
        message="This removes the audio, spectrogram and report. This cannot be undone."
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setConfirmOpen(false)}
      />
    </div>
  );
}
