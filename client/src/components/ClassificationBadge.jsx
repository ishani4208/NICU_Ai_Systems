import normalIcon from "../assets/icons/normal.svg";
import wheezeIcon from "../assets/icons/wheeze.svg";
import crackleIcon from "../assets/icons/crackle.svg";

const BADGE_CLASS = {
  Normal: "badge-normal",
  Wheeze: "badge-wheeze",
  Crackle: "badge-crackle",
};

const BADGE_ICON = {
  Normal: normalIcon,
  Wheeze: wheezeIcon,
  Crackle: crackleIcon,
};

export default function ClassificationBadge({ predictedClass, confidence }) {
  const cls = BADGE_CLASS[predictedClass] || "badge-normal";
  const icon = BADGE_ICON[predictedClass] || normalIcon;
  const pct = (confidence * 100).toFixed(1);

  return (
    <div className={`badge ${cls}`}>
      <img src={icon} alt="" className="badge-icon" />
      <span>{predictedClass} ({pct}%)</span>
    </div>
  );
}
