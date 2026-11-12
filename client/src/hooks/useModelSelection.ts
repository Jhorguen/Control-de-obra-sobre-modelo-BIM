import type { ItemData } from '@thatopen/fragments';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
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
  const { language } = useI18n();
  const [guids, setGuids] = useState<string[]>([]);
  // The raw item, not its formatted properties: values are formatted per language below.
  const [item, setItem] = useState<{ localId: number; data: ItemData } | null>(null);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!viewer) return;
    viewer.onSelectionChange(async (localIds) => {
      const current = ++requestId.current;
      const first = localIds[0];
      if (first === undefined) {
        setGuids([]);
        setItem(null);
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
      setItem(data ? { localId: first, data } : null);
      setLoadingProperties(false);
    });
    return () => viewer.onSelectionChange(null);
  }, [viewer]);

  // toElementProperties formats numbers and yes/no in the current language.
  const properties = useMemo(
    () => (item ? toElementProperties(item.localId, item.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-format when the language changes
    [item, language],
  );

  return { guids, properties, loadingProperties };
}
