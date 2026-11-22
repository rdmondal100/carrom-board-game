import { NODI, type BoardState } from '@carrom/engine';
import { boatOf, layoutOf, standing, tableOf, type NodiConfig } from '@hub/nodipar';
import { cn } from '@/lib/utils';
import type { NodiLook } from '../skins';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
/** World (origin centre, +y up) → SVG units (0..100, y down). */
const X = (x: number) => (x + 0.5) * 100;
const Y = (y: number) => (0.5 - y) * 100;

/** NODI-6 a still picture of the river (shop preview, how-to): islands, owners, rocks, whirlpools, boats. */
export function RiverSvg({ config, board, look, className, label }: { config: NodiConfig; board: BoardState; look: NodiLook; className?: string; label?: string }) {
  const layout = layoutOf(config);
  const table = tableOf(config);
  const { owners, pars } = standing(board, config);
  const r = look.river;
  const teamFill = (team: 'A' | 'B') => hex(look.boat.colors[team === 'A' ? 0 : config.players === 2 ? 2 : 1]);
  return (
    <svg viewBox="0 0 100 100" className={cn('rounded-md', className)} role="img" aria-label={label}>
      <rect width="100" height="100" fill={hex(r.water)} />
      <rect width="100" height="100" fill="none" stroke={hex(r.bank)} strokeWidth="10" />
      {(['A', 'B'] as const).map((team) => pars[team].slice(1).map((isl, i) => {
        const a = layout.islands[pars[team][i]!]!;
        const b = layout.islands[isl]!;
        return <line key={`${team}${isl}`} x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} stroke={teamFill(team)} strokeWidth="1.2" strokeLinecap="round" />;
      }))}
      {layout.islands.map((isl, i) => {
        const o = owners[i];
        return (
          <g key={`i${i}`}>
            <circle cx={X(isl.x)} cy={Y(isl.y)} r={isl.r * 100} fill={hex(r.island)} fillOpacity={0.55} />
            {o && <circle cx={X(isl.x)} cy={Y(isl.y)} r={isl.r * 100} fill={teamFill(o)} fillOpacity={0.35} />}
            <circle cx={X(isl.x)} cy={Y(isl.y)} r={isl.r * 100} fill="none" stroke={o ? teamFill(o) : hex(r.ring)} strokeWidth="0.6" />
          </g>
        );
      })}
      {table.pockets.map((w, i) => <circle key={`w${i}`} cx={X(w.x)} cy={Y(w.y)} r={(table.pocketD / 2) * 100} fill={hex(r.whirl)} stroke={hex(r.line)} strokeOpacity={0.5} strokeWidth="0.4" strokeDasharray="1.5 1" />)}
      {table.rocks.map((k, i) => <circle key={`r${i}`} cx={X(k.x)} cy={Y(k.y)} r={k.r * 100} fill={hex(k.r > NODI.ROCK_R ? r.bank : r.rock)} />)}
      {board.pieces.filter((p) => !p.pocketed).map((p) => (
        <circle key={p.id} cx={X(p.x)} cy={Y(p.y)} r={(NODI.BOAT_D / 2) * 100} fill={hex(look.boat.colors[boatOf(p.id).seat % 4]!)} stroke={hex(look.boat.edge)} strokeWidth="0.6" />
      ))}
    </svg>
  );
}
