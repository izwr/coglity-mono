import { useEffect, useRef, useState } from 'react';

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates a numeral from its previous value to `target`. Renders the final
 * value immediately on first mount with reduced motion, and snaps (no tween)
 * when the user prefers reduced motion.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || fromRef.current === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = from + (target - from) * EASE_OUT(t);
      setValue(t >= 1 ? target : next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs]);

  return value;
}
