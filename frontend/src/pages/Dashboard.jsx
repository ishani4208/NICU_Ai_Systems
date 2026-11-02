import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { uploadAudio } from "../api.js";
import ResultView from "../components/ResultView.jsx";
import AnalysisProgress from "../components/AnalysisProgress.jsx";
import IdleWaveform from "../components/IdleWaveform.jsx";
import usePendingReport from "../hooks/usePendingReport.js";
import { AudioIcon, FolderIcon, CloseIcon } from "../components/Icons.jsx";

// The first three steps run inside one request, so they are paced on a timer
const STEP_MS = 1100;
const LAST_TIMED_STEP = 2;

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState("auto");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  usePendingReport(result, setResult);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, LAST_TIMED_STEP)), STEP_MS);
    return () => clearInterval(timer);
  }, [loading]);

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
    setStep(0);
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
            <label>Respiratory audio recording</label>

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

            <label htmlFor="provider">Report provider</label>
            <select id="provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="auto">Auto (Gemini, Groq, OpenRouter)</option>
              <option value="gemini">Gemini</option>
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
              <option value="template">Template only (no AI)</option>
            </select>

            <label htmlFor="notes">Clinical notes (optional)</label>
            <textarea
              id="notes"
              maxLength={2000}
              placeholder="e.g. gestational age, symptoms, history"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="field-hint">Included in the AI report. It does not change the sound classification.</p>

            <button type="submit" className="submit-button" disabled={loading || !file}>
              {loading ? "Analyzing recording..." : "Analyze & Generate Report"}
            </button>
          </form>
        </div>
      </aside>

      <main className="results-panel">
        <div className="hero-card">
          <div>
            <h1>NICU AI</h1>
            <p>Respiratory sound classifier (Normal, Crackle, Wheeze) with a clinical decision-support report.</p>
          </div>
        </div>

        <div className="notice" role="note">
          <strong>Research demo.</strong> The model was trained on recordings from an adult chest simulator
          (HLS-CMDS), not on neonatal patients. Results are decision support only and need clinician confirmation.
        </div>

        <div className="result-stage">
          {error && <div className="error-box">{error}</div>}

          {loading && (
            <div className="analysis-stage">
              <IdleWaveform active />
              <AnalysisProgress step={step} />
            </div>
          )}

          {result && (
            <>
              <div className="info-box">
                Saved as report <span className="id-pill">{result.displayId}</span>.{" "}
                <Link to={`/reports/${result.id}`}>View in history</Link>
              </div>
              <ResultView record={result} />
            </>
          )}

          {!result && !loading && !error && (
            <div className="empty-state">
              <IdleWaveform />
              <div>Upload a recording to run classification and generate a clinical decision-support report.</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
