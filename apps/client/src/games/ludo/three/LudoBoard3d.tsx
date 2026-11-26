import { useEffect, useRef } from 'react';
import type { LudoBoardProps } from '@/games/ludo/components/LudoBoard';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/store';
import { createLudoScene, type LudoScene } from './ludoScene';

/** T3D-5 the Ludo board in WebGL 3D: same props as the 2D board, plus `onFail` (T3D-2 fall back to 2D). */
export function LudoBoard3d(p: LudoBoardProps & { onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<LudoScene | null>(null);
  const quality = useAppSelector((s) => s.settings.quality);
  const cb = useRef({ onPick: p.onPick, onFail: p.onFail });
  useEffect(() => { cb.current = { onPick: p.onPick, onFail: p.onFail }; });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    try {
      scene.current = createLudoScene(el, quality, (t) => cb.current.onPick?.(t), () => cb.current.onFail());
    } catch {
      cb.current.onFail();
      return;
    }
    return () => { scene.current?.dispose(); scene.current = null; };
  }, [quality]);

  // Every render: hand the scene the board as it is now (it animates the change itself).
  useEffect(() => {
    scene.current?.update({
      seats: p.seats, tokens: p.tokens, board: p.board, tokenSkinOf: p.tokenSkinOf, viewSeat: p.viewSeat, turnSeat: p.turnSeat, legal: p.legal,
    });
  });

  const legal = p.turnSeat !== null && p.onPick ? p.legal : [];
  return (
    <div className={cn('relative aspect-[25/21] w-full max-w-[min(100%,70vh)] select-none', p.className)}>
      <div ref={host} className="size-full" role="img" aria-label={p.label} data-testid="ludo-board-3d" />
      {/* Taps go to the canvas; these keep the legal tokens reachable by keyboard and screen readers. */}
      <div className="sr-only">
        {legal.map((token) => (
          <button key={token} type="button" onClick={() => p.onPick?.(token)}>{`token ${token + 1}`}</button>
        ))}
      </div>
    </div>
  );
}
