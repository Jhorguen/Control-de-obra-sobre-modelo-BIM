import { useEffect, useRef, useState } from 'react';
import type { BimViewer } from '../viewer/BimViewer';
import { toElementProperties, type ElementProperties } from '../viewer/itemProperties';

export interface ModelSelection {
  /** GlobalIds of the selected elements, in selection order. */
  guids: string[];
  /** Properties of the first selected element. */
  properties: ElementProperties | null;
  loadingProperties: boolean;
}

/** Follows what is selected in the 3D model (by click or by selectByGuids). */
export function useModelSelection(viewer: BimViewer | null): ModelSelection {
  const [guids, setGuids] = useState<string[]>([]);
  const [properties, setProperties] = useState<ElementProperties | null>(null);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!viewer) return;
    viewer.onSelectionChange(async (localIds) => {
      const current = ++requestId.current;
      const first = localIds[0];
      if (first === undefined) {
        setGuids([]);
        setProperties(null);
        return;
      }
      setLoadingProperties(true);
      const [selectedGuids, data] = await Promise.all([
        viewer.getGuids(localIds),
        viewer.getItemData(first),
      ]);
      // Ignore the answer if the user already selected something else.
      if (current !== requestId.current) return;
      setGuids(selectedGuids);
      setProperties(data ? toElementProperties(first, data) : null);
      setLoadingProperties(false);
    });
    return () => viewer.onSelectionChange(null);
  }, [viewer]);

  return { guids, properties, loadingProperties };
}
