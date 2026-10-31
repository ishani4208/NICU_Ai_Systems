const BARS = 28;

// Decorative waveform; `active` speeds it up while an analysis is running
export default function IdleWaveform({ active = false }) {
  return (
    <div className={`waveform ${active ? "active" : ""}`} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} style={{ "--i": i, "--h": ((i * 37) % 100) / 100 }} />
      ))}
    </div>
  );
}
