import { useImperativeHandle, useRef, type Ref } from 'react';
import { cn } from '@/lib/utils';
import { useRiverCanvas, type RiverApi, type RiverCallbacks } from '../useRiverCanvas';

interface Props extends RiverCallbacks {
  ref?: Ref<RiverApi>;
  className?: string;
  label: string;
}

/** NODI-4 the Pixi river in a square box; the parent drives it through `ref`. */
export function RiverBoard({ ref, className, label, ...callbacks }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRiverCanvas(host, callbacks);
  useImperativeHandle(ref, () => api.current, [api]);
  return <div ref={host} role="img" aria-label={label} className={cn('aspect-square w-full max-w-[min(100%,70vh)] touch-none select-none', className)} />;
}
