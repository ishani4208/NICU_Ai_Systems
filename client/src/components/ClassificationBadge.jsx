const BADGE_CLASS = {
  Normal: "badge-normal",
  Wheeze: "badge-wheeze",
  Crackle: "badge-crackle",
};

const BADGE_ICON = {
  Normal: "✅",
  Wheeze: "⚠️",
  Crackle: "⚡",
};

export default function ClassificationBadge({ predictedClass, confidence }) {
  const cls = BADGE_CLASS[predictedClass] || "badge-normal";
  const icon = BADGE_ICON[predictedClass] || "🔍";
  const pct = (confidence * 100).toFixed(1);
  return (
    <div className={`badge ${cls}`}>
      {icon} {predictedClass} ({pct}%)
    </div>
  );
}
