import { useEffect } from 'react';
import { TOAST_MS } from '@/constants/view';

export interface ToastItem { id: number; text: string }

function ToastLine({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(item.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [item.id, onDone]);
  return (
    <li
      role="status"
      onClick={() => onDone(item.id)}
      className="pointer-events-auto rounded-lg bg-black/80 text-amber-50 px-4 py-2 text-sm shadow-lg"
    >
      {item.text}
    </li>
  );
}

/** LOC-4: short messages stacked at the top of the screen; each fades after TOAST_MS. */
export function Toast({ items, onDone }: { items: ToastItem[]; onDone: (id: number) => void }) {
  return (
    <ol className="pointer-events-none fixed top-3 inset-x-0 z-40 flex flex-col items-center gap-2 px-4">
      {items.map((item) => <ToastLine key={item.id} item={item} onDone={onDone} />)}
    </ol>
  );
}
