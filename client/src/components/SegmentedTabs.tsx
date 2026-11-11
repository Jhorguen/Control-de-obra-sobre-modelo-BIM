import { useLayoutEffect, useRef } from 'react';

interface Props<T extends string> {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}

/**
 * Segmented tabs whose white pill slides to the active tab. The pill takes the new width
 * at once and travels by transform only (no layout animation), written straight to the
 * element's style instead of React state, so switching never re-renders twice.
 */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, label }: Props<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !indicator || !active) return;
    const place = () => {
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    if (!placed.current) {
      // First paint: put the pill in place without a slide.
      indicator.style.transition = 'none';
      place();
      void indicator.offsetWidth;
      indicator.style.transition = '';
      placed.current = true;
    } else {
      place();
    }
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={listRef} className="segmented" role="tablist" aria-label={label}>
      <span ref={indicatorRef} className="segmented-indicator" aria-hidden="true" />
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
