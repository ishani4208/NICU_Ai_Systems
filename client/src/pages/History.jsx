import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRecords } from "../api.js";
import ClassificationBadge from "../components/ClassificationBadge.jsx";

export default function History() {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function load(q) {
    setLoading(true);
    setError("");
    try {
      const data = await fetchRecords(q);
      setRecords(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    load(query);
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Previous Uploads</h2>
        <form className="search-bar" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Search by ID, filename, classification, or notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="secondary">
            Search
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}
        {loading && <p style={{ color: "var(--muted)" }}>Loading records...</p>}

        {!loading && records.length === 0 && (
          <div className="empty-state">No records found. Upload a sample to get started.</div>
        )}

        {!loading && records.length > 0 && (
          <table className="records-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Filename</th>
                <th>Classification</th>
                <th>Confidence</th>
                <th>Provider</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/reports/${r.id}`)}>
                  <td className="id-pill">{r.id.slice(0, 8)}</td>
                  <td>{r.filename}</td>
                  <td>
                    <ClassificationBadge predictedClass={r.predictedClass} confidence={r.confidence} />
                  </td>
                  <td>{(r.confidence * 100).toFixed(1)}%</td>
                  <td>{r.provider}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
