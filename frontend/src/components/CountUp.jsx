import { useEffect, useRef, useState } from 'react';

/**
 * Count-up animation for dashboard statistics.
 * - Animates once on mount and again whenever the value changes
 * - Uses requestAnimationFrame + ease-out cubic, no interval churn
 * - Non-numeric values (currency strings, city names) pass through unchanged
 */
export default function CountUp({ value, duration = 900, format }) {
  const numeric = Number(value);
  const isNumeric = value !== '' && value != null && Number.isFinite(numeric);
  const [display, setDisplay] = useState(isNumeric ? 0 : value);
  const prevRef = useRef(isNumeric ? 0 : value);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value);
      return undefined;
    }
    const from = prevRef.current;
    const to = numeric;
    if (from === to) {
      setDisplay(to);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  if (!isNumeric) return <>{display}</>;
  return <>{format ? format(display) : display.toLocaleString('en-IN')}</>;
}
