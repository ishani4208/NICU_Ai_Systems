import useCountUp from "../hooks/useCountUp.js";

const BADGE_CLASS = {
  Normal: "badge-normal",
  Wheeze: "badge-wheeze",
  Crackle: "badge-crackle",
};

export default function ClassificationBadge({ predictedClass, confidence, animate = false }) {
  const cls = BADGE_CLASS[predictedClass] || "badge-normal";
  const pct = useCountUp(confidence * 100, { enabled: animate });

  return (
    <div className={`badge ${cls}`}>
      <span className="badge-dot" />
      <span>{predictedClass} ({pct.toFixed(1)}%)</span>
    </div>
  );
}
