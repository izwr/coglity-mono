import { useState, useEffect, useRef } from 'react';

export function useElapsed(startedAt: number | null, done: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!startedAt || done) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setElapsed(Date.now() - startedAt);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startedAt, done]);

  return elapsed;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}
