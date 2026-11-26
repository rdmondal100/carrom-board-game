import { useImperativeHandle, useRef, type Ref } from 'react';
import { useGameView } from '@/game3d/useGameView';
import { cn } from '@/lib/utils';
import { useRiverCanvas, type RiverApi, type RiverCallbacks } from '../useRiverCanvas';

interface Props extends RiverCallbacks {
  ref?: Ref<RiverApi>;
  className?: string;
  label: string;
  /** Always 2D (the how-to demo). */
  flat?: boolean;
}

/** NODI-4 the river in a square box, in the player's chosen view (T3D-1); the parent drives it through `ref`. */
export function RiverBoard({ ref, className, label, flat = false, ...callbacks }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const { view, failed } = useGameView('nodipar');
  const api = useRiverCanvas(host, { ...callbacks, onFail: failed }, flat ? '2d' : view);
  useImperativeHandle(ref, () => api.current, [api]);
  return <div ref={host} role="img" aria-label={label} className={cn('aspect-square w-full max-w-[min(100%,70vh)] touch-none select-none', className)} />;
}
