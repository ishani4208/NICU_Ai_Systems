export default function ProbabilityBars({ probabilities }) {
  const entries = Object.entries(probabilities || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      {entries.map(([label, value]) => (
        <div className="prob-row" key={label}>
          <div className="prob-label">
            <span>{label}</span>
            <span>{(value * 100).toFixed(2)}%</span>
          </div>
          <div className="prob-track">
            <div className="prob-fill" style={{ width: `${Math.min(value * 100, 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
