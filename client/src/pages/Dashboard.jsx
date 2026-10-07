import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { uploadAudio } from "../api.js";
import ResultView from "../components/ResultView.jsx";
import { AudioIcon, FolderIcon, CloseIcon, StethoscopeIcon } from "../components/Icons.jsx";

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState("groq");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  function handleFileSelect(selectedFile) {
    if (!selectedFile) return;
    const validTypes = [".wav", ".mp3", "audio/wav", "audio/mp3", "audio/mpeg", "audio/x-wav"];
    const isWavOrMp3 = validTypes.some(
      (type) => selectedFile.name.toLowerCase().endsWith(".wav") || selectedFile.name.toLowerCase().endsWith(".mp3")
    );

    if (!isWavOrMp3) {
      setError("Please select a valid .wav or .mp3 audio file.");
      return;
    }

    setError("");
    setFile(selectedFile);
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

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
      setError(err.message || "Failed to analyze audio file.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-layout">
      <aside className="control-panel">
        <div className="panel-section">
          <h3>Audio Input &amp; Controls</h3>

          <form onSubmit={handleSubmit} className="control-form">
            <label>Select Respiratory Audio Recording:</label>

            <div
              className={`file-dropzone ${dragActive ? "drag-active" : ""} ${file ? "has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                id="audio-file"
                type="file"
                accept=".wav,.mp3,audio/wav,audio/mp3,audio/mpeg"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              {file ? (
                <div className="file-selected-card">
                  <span className="file-icon">
                    <AudioIcon size={22} />
                  </span>
                  <div className="file-info-text">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <button
                    type="button"
                    className="remove-file-btn"
                    title="Remove file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              ) : (
                <div className="file-prompt">
                  <div className="upload-icon-circle">
                    <FolderIcon size={22} />
                  </div>
                  <div className="upload-text-group">
                    <span className="upload-title">Choose File</span>
                    <span className="upload-subtitle">or drag &amp; drop .wav / .mp3</span>
                  </div>
                </div>
              )}
            </div>

            <label htmlFor="provider">LLM Report Provider:</label>
            <select id="provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="groq">Groq (Llama-3.3 70B)</option>
              <option value="gemini">Gemini (Gemini-2.5 Flash)</option>
            </select>

            <label htmlFor="notes">Optional RAG Clinical Context:</label>
            <textarea
              id="notes"
              placeholder="Enter patient history or clinical notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <button type="submit" className="submit-button" disabled={loading || !file}>
              {loading && <span className="spinner" />}
              {loading ? "Analyzing recording..." : "Analyze & Generate Report"}
            </button>
          </form>
        </div>
      </aside>

      <main className="results-panel">
        <div className="hero-card">
          <div>
            <h1>NeoListen AI System</h1>
            <p>Neonatal Intensive Care Unit (NICU) Respiratory Sound Classifier &amp; Decision Support Engine</p>
          </div>
        </div>

        <div className="result-stage">
          {error && <div className="error-box">{error}</div>}

          {result && (
            <>
              <div className="info-box">
                Analysis complete — record saved as <span className="id-pill">{result.id}</span>.{" "}
                <Link to={`/reports/${result.id}`}>View in history</Link>
              </div>
              <ResultView record={result} />
            </>
          )}

          {!result && !loading && !error && (
            <div className="empty-state">
              <div className="empty-icon">
                <StethoscopeIcon size={26} />
              </div>
              <div>Upload a recording to run classification and generate a clinical decision-support report.</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
