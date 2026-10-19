import { useEffect, useState } from 'react';
import { paceValue } from '../../lib/wall';

/*
 * A day's total replayed against today's clock: how far it had got by this
 * time of day, at that day's average pace (lib/wall.js paceValue). It ticks
 * once per whole unit, so a 38,500-novel day moves on about every 2.2 s; with
 * reduced motion it moves once a minute instead.
 */
export function usePace(total, reducedMotion) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!(total > 0)) return undefined;
    const period = reducedMotion ? 60000 : Math.max(1000, 86400000 / total);
    const timer = setInterval(() => setNow(new Date()), period);
    return () => clearInterval(timer);
  }, [total, reducedMotion]);

  return { value: total > 0 ? paceValue(total, now) : 0, now };
}
