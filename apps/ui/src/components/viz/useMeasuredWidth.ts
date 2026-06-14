import { useEffect, useRef, useState } from 'react';

/** Tracks the rendered width of a container so SVG charts stay crisp. */
export function useMeasuredWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.abs(w - width) > 1) setWidth(w);
    });
    observer.observe(el);
    setWidth(el.clientWidth || initial);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, width };
}
