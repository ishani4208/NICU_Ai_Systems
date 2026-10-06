import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchRecordById } from "../api.js";
import ResultView from "../components/ResultView.jsx";

export default function ReportDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRecordById(id)
      .then((data) => !cancelled && setRecord(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div>
      <Link to="/history" className="back-link">
        ← Back to history
      </Link>

      {loading && <p style={{ color: "var(--muted)" }}>Loading report...</p>}
      {error && <div className="error-box">{error}</div>}

      {record && (
        <>
          <div className="info-box" style={{ marginBottom: "20px" }}>
            Record <span className="id-pill">{record.id}</span> &mdash; {record.filename} &mdash; uploaded{" "}
            {new Date(record.createdAt).toLocaleString()}
          </div>
          <ResultView record={record} />
        </>
      )}
    </div>
  );
}
