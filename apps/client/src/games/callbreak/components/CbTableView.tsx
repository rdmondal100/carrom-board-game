import { lazy, Suspense } from 'react';
import { useGameView } from '@/game3d/useGameView';
import { CbTable, type TableProps } from './CbTable';

/** T3D-2 three.js loads only when a 3D table is first shown. */
const CbTable3d = lazy(() => import('@/games/callbreak/three/CbTable3d').then((m) => ({ default: m.CbTable3d })));

/** T3D-1 the Callbreak table in the player's chosen view (2D while 3D loads, and if it fails). */
export function CbTableView(p: TableProps) {
  const { view, failed } = useGameView('callbreak');
  if (view === '2d') return <CbTable {...p} />;
  return (
    <Suspense fallback={<CbTable {...p} />}>
      <CbTable3d {...p} onFail={failed} />
    </Suspense>
  );
}
