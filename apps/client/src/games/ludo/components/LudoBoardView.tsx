import { lazy, Suspense } from 'react';
import { useGameView } from '@/game3d/useGameView';
import { LudoBoard, type LudoBoardProps } from './LudoBoard';

/** T3D-2 three.js loads only when a 3D board is first shown. */
const LudoBoard3d = lazy(() => import('@/games/ludo/three/LudoBoard3d').then((m) => ({ default: m.LudoBoard3d })));

/** T3D-1 the Ludo board in the player's chosen view (2D while 3D loads, and if it fails). */
export function LudoBoardView(p: LudoBoardProps) {
  const { view, failed } = useGameView('ludo');
  if (view === '2d') return <LudoBoard {...p} />;
  return (
    <Suspense fallback={<LudoBoard {...p} />}>
      <LudoBoard3d {...p} onFail={failed} />
    </Suspense>
  );
}
