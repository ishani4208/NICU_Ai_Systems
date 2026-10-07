import { useMemo } from "react";
import { marked } from "marked";
import ClassificationBadge from "./ClassificationBadge.jsx";
import ProbabilityBars from "./ProbabilityBars.jsx";
import { ReportIcon } from "./Icons.jsx";

// Configure marked options for clean GFM table & list rendering
marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function ResultView({ record }) {
  const htmlContent = useMemo(() => {
    if (!record?.report) return "";
    try {
      return marked.parse(record.report);
    } catch {
      return record.report;
    }
  }, [record?.report]);

  return (
    <div className="grid-2">
      <div className="card">
        <h3>Audio &amp; Spectrogram</h3>
        <audio controls style={{ width: "100%", marginBottom: "16px" }} src={record.audioUrl} />
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "8px" }}>
          Generated Mel-Spectrogram (3-channel RGB, Butterworth filter 100Hz–2000Hz)
        </p>
        <img className="spectrogram-img" src={record.spectrogramUrl} alt="Mel spectrogram" />
      </div>

      <div className="card">
        <h3>Diagnostic Classification</h3>
        <ClassificationBadge predictedClass={record.predictedClass} confidence={record.confidence} />
        <div style={{ height: "18px" }} />
        <h4 style={{ marginBottom: "10px" }}>Class Probability Distribution</h4>
        <ProbabilityBars probabilities={record.probabilities} />
      </div>

      <div className="card report-card-full" style={{ gridColumn: "1 / -1" }}>
        <div className="report-card-header">
          <span className="report-header-icon">
            <ReportIcon size={22} />
          </span>
          <h3>AI Clinical Decision Support Report</h3>
        </div>

        <div
          className="report-markdown-body"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {record.notes && (
          <div className="notes-container">
            <h4>Clinical Context &amp; Notes</h4>
            <p>{record.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
