import { useEffect, useRef, useState } from 'react';

import { motion } from '../theme/tokens';
import { useReducedMotion } from './useReducedMotion';

/**
 * Counts a metric from its previous value up to `target` over `duration`
 * (default 220 ms). Reduced motion, or a zero target, sets the value at once.
 */
export function useCountUp(target: number, duration = motion.slow): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const from = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || target === 0) {
      setValue(target);
      from.current = target;
      return;
    }

    const startValue = from.current;
    const startedAt = Date.now();

    function tick() {
      const progress = Math.min((Date.now() - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(startValue + (target - startValue) * eased);
      setValue(next);
      from.current = next;
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    }

    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [duration, reduced, target]);

  return value;
}
