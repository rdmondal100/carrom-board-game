import { useId } from 'react';
import { LUDO, LUDO_ANIM, SAFE_SQUARES } from '@hub/ludo';
import { columnOf, GRID, pointOf, rotationFor, stackOffset, TRACK, turn, yardSpot, type Pt } from '@/games/ludo/geometry';
import { seatColor, tokenColor, type BoardSkin, type TokenSkin } from '@/games/ludo/skins';
import { cn } from '@/lib/utils';

export interface LudoBoardProps {
  /** Seats in play. */
  seats: readonly number[];
  /** Token progress per seat 0..3. */
  tokens: readonly (readonly number[])[];
  board: BoardSkin;
  /** Token set per seat (online: each player's own; same device: one set). */
  tokenSkinOf: (seat: number) => TokenSkin;
  /** Seat whose yard sits bottom left. */
  viewSeat: number;
  turnSeat: number | null;
  /** Tokens of `turnSeat` that can move now (tappable). */
  legal: readonly number[];
  onPick?: (token: number) => void;
  label?: string;
  className?: string;
}

const START: readonly Pt[] = [0, 1, 2, 3].map((s) => TRACK[s * LUDO.QUARTER]!);

/** A five-point star centred at `p`. */
function starPath(p: Pt, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(p.x + rr * Math.cos(rad)).toFixed(3)},${(p.y + rr * Math.sin(rad)).toFixed(3)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** One token at (x, y), drawn in the set's shape. */
export function TokenShape({ x, y, color, skin }: { x: number; y: number; color: string; skin: TokenSkin }) {
  const s = { fill: color, stroke: skin.edge, strokeWidth: 0.06 };
  switch (skin.shape) {
    case 'gem':
      return <path d={`M${x},${y - 0.36}L${x + 0.3},${y}L${x},${y + 0.36}L${x - 0.3},${y}Z`} {...s} />;
    case 'lantern':
      return (
        <g>
          <rect x={x - 0.24} y={y - 0.26} width={0.48} height={0.56} rx={0.16} {...s} />
          <rect x={x - 0.1} y={y - 0.38} width={0.2} height={0.1} rx={0.03} fill={skin.edge} />
          <circle cx={x} cy={y + 0.02} r={0.09} fill="#fff6c2" opacity={0.9} />
        </g>
      );
    case 'shapla':
      return (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={x} cy={y - 0.17} rx={0.11} ry={0.19} transform={`rotate(${a} ${x} ${y})`} {...s} />
          ))}
          <circle cx={x} cy={y} r={0.1} fill="#fff3b0" stroke={skin.edge} strokeWidth={0.03} />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={x} cy={y + 0.08} r={0.3} {...s} />
          <circle cx={x} cy={y - 0.16} r={0.15} {...s} />
        </g>
      );
  }
}

/** LUDO-6 the SVG board: yards, track, safe stars, home columns, tokens; legal tokens glow and take taps. */
export function LudoBoard({ seats, tokens, board, tokenSkinOf, viewSeat, turnSeat, legal, onPick, label, className }: LudoBoardProps) {
  const placed = seats.flatMap((seat) => (tokens[seat] ?? []).map((p, token) => ({ seat, token, p, at: pointOf(seat, token, p) })));
  const key = (pt: Pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
  const stacks = new Map<string, number>();
  for (const t of placed) stacks.set(key(t.at), (stacks.get(key(t.at)) ?? 0) + 1);
  const seen = new Map<string, number>();
  const c = GRID / 2;
  const uid = useId().replace(/:/g, '');
  const RIM = 0.45;
  return (
    <svg viewBox={`${-RIM} ${-RIM} ${GRID + 2 * RIM} ${GRID + 2 * RIM}`} className={cn('aspect-square w-full max-w-[min(100%,70vh)]', className)} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`rim${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" /><stop offset="0.45" stopColor="#c98a1c" /><stop offset="1" stopColor="#6b3d07" />
        </linearGradient>
        <radialGradient id={`nest${uid}`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="1" stopColor="#fff" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      <rect x={-RIM} y={-RIM} width={GRID + 2 * RIM} height={GRID + 2 * RIM} rx={0.8} fill={`url(#rim${uid})`} />
      <rect x={-0.12} y={-0.12} width={GRID + 0.24} height={GRID + 0.24} rx={0.45} fill="#3b1f05" opacity={0.55} />
      <g transform={`rotate(${rotationFor(viewSeat)} ${c} ${c})`}>
        <rect width={GRID} height={GRID} rx={0.3} fill={board.bg} />
        {[0, 1, 2, 3].map((s) => {
          const corner = turn({ x: 0, y: 0 }, s);
          const x = Math.min(corner.x, turn({ x: 6, y: 6 }, s).x);
          const y = Math.min(corner.y, turn({ x: 6, y: 6 }, s).y);
          return (
            <g key={`yard${s}`} opacity={seats.includes(s) ? 1 : 0.45}>
              <rect x={x + 0.15} y={y + 0.15} width={5.7} height={5.7} rx={0.5} fill={seatColor(s)} />
              <rect x={x + 0.15} y={y + 0.15} width={5.7} height={2.6} rx={0.5} fill="#fff" opacity={0.14} />
              {turnSeat === s && <rect x={x + 0.15} y={y + 0.15} width={5.7} height={5.7} rx={0.5} fill="none" stroke="#fff" strokeWidth={0.16} className="animate-pulse" />}
              <rect x={x + 0.9} y={y + 0.9} width={4.2} height={4.2} rx={0.6} fill={board.cell} stroke={board.tints[s]} strokeWidth={0.1} />
              {[0, 1, 2, 3].map((i) => {
                const p = yardSpot(s, i);
                return <circle key={i} cx={p.x} cy={p.y} r={0.44} fill={board.tints[s]} stroke={seatColor(s)} strokeWidth={0.07} />;
              })}
            </g>
          );
        })}
        {TRACK.map((p, i) => {
          const startOf = START.findIndex((q) => q === p);
          return (
            <rect key={`t${i}`} x={p.x - 0.5} y={p.y - 0.5} width={1} height={1}
              fill={startOf >= 0 ? board.tints[startOf] : board.cell} stroke={board.line} strokeWidth={0.03} />
          );
        })}
        {[0, 1, 2, 3].map((s) => columnOf(s).map((p, i) => (
          <rect key={`c${s}-${i}`} x={p.x - 0.5} y={p.y - 0.5} width={1} height={1} fill={board.tints[s]} stroke={board.line} strokeWidth={0.03} />
        )))}
        {SAFE_SQUARES.map((sq) => <path key={`s${sq}`} d={starPath(TRACK[sq]!, 0.36)} fill="none" stroke={board.star} strokeWidth={0.07} />)}
        <rect x={6} y={6} width={3} height={3} fill={board.centre} />
        {[0, 1, 2, 3].map((s) => {
          const a = turn({ x: 6, y: 6 }, s);
          const b = turn({ x: 6, y: 9 }, s);
          return <path key={`h${s}`} d={`M${a.x},${a.y}L${b.x},${b.y}L${c},${c}Z`} fill={seatColor(s)} opacity={0.85} />;
        })}
        {placed.map(({ seat, token, p, at }) => {
          const k = key(at);
          const i = seen.get(k) ?? 0;
          seen.set(k, i + 1);
          const off = stackOffset(i, stacks.get(k) ?? 1);
          const x = at.x + off.x;
          const y = at.y + off.y;
          const can = seat === turnSeat && legal.includes(token);
          const skin = tokenSkinOf(seat);
          // MOT-3 glide to the new cell; a token sent to its yard flies there in a high arc.
          const back = p === LUDO.YARD;
          const ms = back ? LUDO_ANIM.CAPTURE_MS : LUDO_ANIM.HOP_MS;
          const lift = `${back ? 'token-fly' : 'token-hop'} ${ms}ms ${back ? 'ease-in-out' : 'ease-out'}`;
          return (
            <g key={`k${seat}-${token}`} data-testid={`token-${seat}-${token}`} data-progress={p}
              className={cn(can && onPick && 'cursor-pointer')} role={can && onPick ? 'button' : undefined}
              aria-label={can ? `token ${token + 1}` : undefined}
              onClick={can && onPick ? () => onPick(token) : undefined}
              style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${ms}ms ${back ? 'cubic-bezier(0.45, 0, 0.3, 1)' : 'cubic-bezier(0.3, 0.6, 0.4, 1)'}` }}>
              {can && <circle r={0.5} fill={seatColor(seat)} opacity={0.35} stroke="#fff" strokeWidth={0.09} className="animate-pulse" />}
              <g transform={`rotate(${-rotationFor(viewSeat)})`}>
                <ellipse key={`s${p}`} cy={0.36} rx={0.27} ry={0.08} fill="#000" opacity={0.28} style={{ animation: `token-shadow ${ms}ms ease-out`, transformOrigin: '0px 0.36px' }} />
                {p === LUDO.HOME && <circle key="burst" r={0.4} fill="none" stroke={seatColor(seat)} strokeWidth={0.12} style={{ animation: 'token-burst 700ms ease-out forwards' }} />}
                <g className={cn(can && 'animate-hop')}>
                  <g key={p} style={{ animation: lift, transformOrigin: back ? '0px 0px' : '0px 0.36px' }}>
                    <TokenShape x={0} y={0} color={tokenColor(skin, seat)} skin={skin} />
                    <ellipse cx={-0.07} cy={-0.2} rx={0.07} ry={0.045} fill="#fff" opacity={0.65} />
                  </g>
                </g>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
