import { useCallback, useState } from 'react';
import { BimViewer } from './BimViewer';

/**
 * Creates the viewer when its container div mounts and disposes it when it unmounts.
 * Uses a React 19 callback ref with cleanup instead of an effect, so the viewer exists
 * exactly as long as the DOM node it renders into.
 */
export function useBimViewer() {
  const [viewer, setViewer] = useState<BimViewer | null>(null);

  const containerRef = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const instance = new BimViewer(element);
    setViewer(instance);
    return () => {
      setViewer(null);
      instance.dispose();
    };
  }, []);

  return { viewer, containerRef };
}
