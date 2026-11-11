// A tiny toast store: call toast() from anywhere, <Toaster /> renders the queue.
// No context or provider needed (the same idea as Sonner's API).

export type ToastTone = 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function toast(message: string, tone: ToastTone = 'success'): void {
  // Keep the last three: a burst of actions never buries the screen.
  toasts = [...toasts, { id: nextId++, message, tone }].slice(-3);
  emit();
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}
