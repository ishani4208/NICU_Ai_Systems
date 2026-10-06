import { useState } from "react";
import { Link } from "react-router-dom";
import { uploadAudio } from "../api.js";
import ResultView from "../components/ResultView.jsx";

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState("groq");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Please choose a .wav or .mp3 audio file first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const record = await uploadAudio({ file, provider, notes });
      setResult(record);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Upload a Respiratory Sound Recording</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div>
              <label htmlFor="audio-file">Audio file (.wav or .mp3)</label>
              <input
                id="audio-file"
                type="file"
                accept=".wav,.mp3"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />

              <label htmlFor="provider">Clinical report LLM provider</label>
              <select id="provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="groq">Groq (fast)</option>
                <option value="gemini">Gemini (fallback)</option>
              </select>
            </div>
            <div>
              <label htmlFor="notes">Optional clinical notes / patient context</label>
              <textarea
                id="notes"
                placeholder="e.g. 32-week preterm infant, 4 days old, mild tachypnea..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? "Analyzing recording..." : "🚀 Analyze & Generate Report"}
          </button>
        </form>
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <>
          <div className="info-box" style={{ marginBottom: "20px" }}>
            Analysis complete — record saved as <span className="id-pill">{result.id}</span>.{" "}
            <Link to={`/reports/${result.id}`}>View in history</Link>
          </div>
          <ResultView record={result} />
        </>
      )}

      {!result && !loading && !error && (
        <div className="empty-state">
          👈 Upload a recording above to run classification and generate a clinical report.
        </div>
      )}
    </div>
  );
}
