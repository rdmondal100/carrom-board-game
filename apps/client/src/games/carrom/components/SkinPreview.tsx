import { useId } from 'react';
import { boardPalette, coinSkin, hex, strikerStyle } from '@/games/carrom/skins';
import type { PieceStyle } from '@/constants/view';
import { cn } from '@/lib/utils';
import type { CosmeticPreviewProps } from '../../types';

// COS-7: a small SVG board (100 × 100 units) showing a board, coin set and striker together.
// A picture only: positions are hand-placed, like BoardDiagram.

const RING = [[0, -6.4, 'white'], [5.5, -3.2, 'black'], [5.5, 3.2, 'white'], [0, 6.4, 'black'], [-5.5, 3.2, 'white'], [-5.5, -3.2, 'black']] as const;
const POCKETS = [[13, 13], [87, 13], [13, 87], [87, 87]] as const;

function Piece({ id, x, y, r, st }: { id: string; x: number; y: number; r: number; st: PieceStyle }) {
  return (
    <g>
      <defs>
        <radialGradient id={id} cx="0.34" cy="0.3" r="0.7">
          <stop offset="0" stopColor={hex(st.hi)} />
          <stop offset="0.5" stopColor={hex(st.base)} />
          <stop offset="1" stopColor={hex(st.edge)} />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} stroke={hex(st.edge)} strokeWidth={0.4} />
      <circle cx={x} cy={y} r={r * 0.68} fill="none" stroke={hex(st.ring)} strokeWidth={0.35} opacity={0.6} />
    </g>
  );
}

/** Item ids for each slot; unknown ids draw the classic look. */
export function SkinPreview({ board, coins, striker, className }: { board: string; coins: string; striker: string; className?: string }) {
  const C = boardPalette(board);
  const set = coinSkin(coins);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" data-testid="skin-preview" className={cn('h-auto', className)}>
      <rect x={0} y={0} width={100} height={100} rx={4} fill={hex(C.frame)} />
      <rect x={5} y={5} width={90} height={90} rx={2} fill={hex(C.frameLight)} />
      <rect x={7} y={7} width={86} height={86} fill={hex(C.surface)} stroke={hex(C.frameEdge)} strokeWidth={0.5} />
      {POCKETS.map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={4.6} fill={hex(C.pocket)} stroke={hex(C.pocketRim)} strokeWidth={0.8} />)}
      {[22, 78].map((v) => (
        <g key={v} stroke={hex(C.line)} strokeWidth={0.6}>
          <line x1={26} y1={v} x2={74} y2={v} />
          <line x1={v} y1={26} x2={v} y2={74} />
        </g>
      ))}
      <circle cx={50} cy={50} r={13} fill="none" stroke={hex(C.line)} strokeWidth={0.6} />
      <circle cx={50} cy={50} r={11.5} fill="none" stroke={hex(C.accent)} strokeWidth={0.8} />
      {RING.map(([dx, dy, k], i) => <Piece key={i} id={`${uid}c${i}`} x={50 + dx} y={50 + dy} r={3} st={set[k]} />)}
      <Piece id={`${uid}red`} x={50} y={50} r={3} st={set.red} />
      <Piece id={`${uid}striker`} x={50} y={78} r={4.4} st={strikerStyle(striker)} />
    </svg>
  );
}

/** HAPP-5 the registry's shop preview: carrom's slots (board, coins, striker) by id. */
export function CarromPreview({ equipped, className }: CosmeticPreviewProps) {
  return <SkinPreview board={equipped.board ?? ''} coins={equipped.coins ?? ''} striker={equipped.striker ?? ''} className={className} />;
}
