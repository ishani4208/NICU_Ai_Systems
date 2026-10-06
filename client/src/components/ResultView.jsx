import ClassificationBadge from "./ClassificationBadge.jsx";
import ProbabilityBars from "./ProbabilityBars.jsx";

export default function ResultView({ record }) {
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Audio &amp; Spectrogram</h3>
        <audio controls style={{ width: "100%", marginBottom: "16px" }} src={record.audioUrl} />
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Generated Mel-Spectrogram (3-channel, Butterworth bandpass filtered 100Hz&ndash;2000Hz)
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

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3>AI Clinical Decision Support Report</h3>
        <div className="report-box">{record.report}</div>
        {record.notes && (
          <>
            <h4 style={{ marginTop: "16px" }}>Notes</h4>
            <p style={{ color: "var(--muted)" }}>{record.notes}</p>
          </>
        )}
      </div>
    </div>
  );
}
