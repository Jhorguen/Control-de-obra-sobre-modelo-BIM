import { useEffect, useState } from 'react';

/** True once `ms` milliseconds have passed since the component mounted. */
export function useDelayedFlag(ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return elapsed;
}
