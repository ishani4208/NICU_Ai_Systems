import { useEffect, useState } from "react";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Eases a number from 0 up to `target` once; returns the target straight away if animation is off
export default function useCountUp(target, { duration = 900, enabled = true } = {}) {
  const animate = enabled && !prefersReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!animate) return undefined;
    let raf;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, animate]);

  return animate ? value : target;
}
