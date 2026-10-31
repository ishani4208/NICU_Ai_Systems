import { useEffect, useRef, useState } from "react";

// The backend pads or cuts every recording to 15 s before drawing the spectrogram
const SPEC_SECONDS = 15;

export default function SpectrogramPlayer({ audioUrl, spectrogramUrl }) {
  const audioRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    const loop = () => {
      const audio = audioRef.current;
      if (audio) setProgress(Math.min(audio.currentTime / SPEC_SECONDS, 1));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  function seek(e) {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = Math.min(fraction * SPEC_SECONDS, audio.duration || SPEC_SECONDS);
    setProgress(fraction);
  }

  return (
    <>
      <audio
        ref={audioRef}
        controls
        className="audio-player"
        src={audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setProgress(Math.min(e.currentTarget.currentTime / SPEC_SECONDS, 1))}
      />
      <p className="caption">
        Time runs left to right and pitch from bottom (low) to top (high), with brighter colours for louder
        sound. Frequencies outside 100&ndash;2000 Hz are filtered out. Click the spectrogram to jump to that
        moment.
      </p>
      <div className="spectrogram-wrap" onClick={seek}>
        <img className="spectrogram-img" src={spectrogramUrl} alt="Spectrogram of the recording" />
        {progress > 0 && <div className="playhead" style={{ left: `${progress * 100}%` }} />}
      </div>
    </>
  );
}
