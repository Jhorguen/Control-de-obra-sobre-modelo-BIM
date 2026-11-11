import { useEffect, useRef, useState } from 'react';
import { dismissToast, subscribeToasts, type ToastItem } from '../toast';
import { CheckIcon, CloseIcon } from './Icon';

const VISIBLE_MS = 4500;
const EXIT_MS = 180;

/** One toast: enters from the bottom, waits, leaves faster than it came. Hover pauses it. */
function Toast({ item }: { item: ToastItem }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(VISIBLE_MS);

  useEffect(() => {
    if (paused || leaving) return;
    const started = Date.now();
    const timer = setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => dismissToast(item.id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, item.id]);

  return (
    <li
      className="toast"
      data-tone={item.tone}
      data-leaving={leaving}
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="toast-icon" aria-hidden="true">
        {item.tone === 'error' ? <CloseIcon size={12} /> : <CheckIcon size={12} />}
      </span>
      <span>{item.message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={() => setLeaving(true)}
        aria-label="Cerrar aviso"
      >
        <CloseIcon size={14} />
      </button>
    </li>
  );
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  return (
    <ol className="toaster" aria-live="polite">
      {items.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </ol>
  );
}
