import { CheckIcon } from "./Icons.jsx";

const STEPS = ["Filtering", "Spectrogram", "Classifying", "Writing report"];

// `step` is the index of the active step; 4 or more means everything is done
export default function AnalysisProgress({ step }) {
  return (
    <ol className="progress-steps" aria-live="polite">
      {STEPS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "active" : "pending";
        return (
          <li key={label} className={state}>
            <span className="step-dot">{state === "done" && <CheckIcon size={11} />}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
