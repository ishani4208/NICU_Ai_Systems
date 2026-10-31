import { useEffect, useState } from "react";
import useCountUp from "../hooks/useCountUp.js";

export default function ProbabilityBars({ probabilities }) {
  const entries = Object.entries(probabilities || {}).sort((a, b) => b[1] - a[1]);
  const [grown, setGrown] = useState(false);

  // Start at zero width so the bars animate in on first render
  useEffect(() => {
    const timer = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      {entries.map(([label, value]) => (
        <ProbabilityRow key={label} label={label} value={value} grown={grown} />
      ))}
    </div>
  );
}

function ProbabilityRow({ label, value, grown }) {
  const shown = useCountUp(value * 100);
  return (
    <div className="prob-row">
      <div className="prob-label">
        <span>{label}</span>
        <span>{shown.toFixed(2)}%</span>
      </div>
      <div className="prob-track">
        <div className="prob-fill" style={{ width: grown ? `${Math.min(value * 100, 100)}%` : "0%" }} />
      </div>
    </div>
  );
}
