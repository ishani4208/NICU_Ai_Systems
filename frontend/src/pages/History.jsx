import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteRecord, fetchRecords } from "../api.js";
import ClassificationBadge from "../components/ClassificationBadge.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { DownloadIcon, TrashIcon } from "../components/Icons.jsx";

export default function History() {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  // Search as you type; the short delay avoids a request per keystroke
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await fetchRecords(query.trim());
        if (!cancelled) {
          setRecords(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 150 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Press "/" anywhere on the page to jump to the search box
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      const typing = el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteRecord(toDelete.id);
      setRecords((prev) => prev.filter((r) => r.id !== toDelete.id));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="page-toolbar">
          <h2>Previous uploads</h2>
          <Link to="/" className="button-link">
            New analysis
          </Link>
        </div>
        <form className="search-bar" onSubmit={(e) => e.preventDefault()}>
          <div className={`search-field ${query ? "has-value" : ""}`}>
            <input
              ref={searchRef}
              type="text"
              aria-label="Search reports"
              placeholder="Search by number (e.g. 1), filename, class or notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  e.currentTarget.blur();
                }
              }}
            />
            <kbd className="kbd" aria-hidden="true">/</kbd>
          </div>
        </form>

        {error && <div className="error-box">{error}</div>}
        {loading && <p style={{ color: "var(--muted)" }}>Loading records...</p>}

        {!loading && records.length === 0 && (
          <div className="empty-state">
            {query.trim() ? `No reports match "${query.trim()}".` : "No records found. Upload a sample to get started."}
          </div>
        )}

        {!loading && records.length > 0 && (
          <table className="records-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Filename</th>
                <th>Classification</th>
                <th>Uploaded</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/reports/${r.id}`)}>
                  <td className="id-pill">{r.displayId}</td>
                  <td>{r.filename}</td>
                  <td>
                    <ClassificationBadge predictedClass={r.predictedClass} confidence={r.confidence} />
                  </td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="row-actions">
                      <a
                        className="icon-button"
                        href={`/reports/${r.id}?print=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Download report ${r.displayId} as PDF`}
                        aria-label={`Download report ${r.displayId} as PDF`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DownloadIcon size={16} />
                      </a>
                      <button
                        type="button"
                        className="icon-button destructive"
                        title={`Delete report ${r.displayId}`}
                        aria-label={`Delete report ${r.displayId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDelete(r);
                        }}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={toDelete ? `Delete report ${toDelete.displayId}?` : "Delete report?"}
        message="This removes the audio, spectrogram and report. This cannot be undone."
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </div>
  );
}
