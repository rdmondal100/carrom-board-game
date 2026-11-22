// NODI-4 Pixi drawing of the river: water, banks, islands, whirlpools, rocks, boats, aim.
// Pure drawing from plain data; the canvas hook owns the state.
import type { Graphics } from 'pixi.js';
import { config, NODI, seatToWorld, type BoardState, type Seat, type Table, type Vec } from '@carrom/engine';
import { boatOf, layoutOf, launchPoint, type NodiConfig, type Team } from '@hub/nodipar';
import { worldToPx, worldToScreen } from '@/games/carrom/view';
import type { BoatSkin, RiverSkin } from './skins';

/** Pixel size of one canvas (the river is the whole square). */
export interface RiverLayout { canvasPx: number; boardPx: number }

const MIN_PX = 200;
const MAX_PX = 720;
/** Land drawn along each bank, L. */
const BANK_W = 0.05;
const RING_W = 0.006;
const OWNED_ALPHA = 0.35;
const PAR_W = 0.012;
const WHIRL_TURNS = 2.5;
const WHIRL_ARMS = 3;
const AIM_LEN = 0.35;
const AIM_W = 0.006;

export function riverLayoutFor(availPx: number): RiverLayout {
  const canvasPx = Math.max(MIN_PX, Math.floor(Math.min(availPx, MAX_PX)));
  return { canvasPx, boardPx: canvasPx };
}

export interface SceneView {
  config: NodiConfig;
  table: Table;
  owners: readonly (Team | null)[];
  pars: Readonly<Record<Team, readonly number[]>>;
  viewSeat: Seat;
  boardPx: number;
  river: RiverSkin;
  teamColor: (team: Team) => number;
}

const sc = (p: Vec, v: Pick<SceneView, 'viewSeat' | 'boardPx'>): Vec => worldToScreen(p, v.viewSeat, v.boardPx);
const px = (len: number, v: Pick<SceneView, 'boardPx'>): number => worldToPx(len, v.boardPx);

/** Water, banks, land corners (2v2), island rings tinted by owner, par chains, rocks. */
export function drawScene(g: Graphics, v: SceneView): void {
  g.clear();
  const s = v.boardPx;
  g.rect(0, 0, s, s).fill(v.river.water);
  const band = px(BANK_W, v);
  // Banks on every side: the 1v1 river's side banks are plain shore.
  g.rect(0, 0, s, band).fill(v.river.bank);
  g.rect(0, s - band, s, band).fill(v.river.bank);
  g.rect(0, 0, band, s).fill(v.river.bank);
  g.rect(s - band, 0, band, s).fill(v.river.bank);
  g.rect(0, 0, s, s).stroke({ width: 2, color: v.river.bankEdge });

  const layout = layoutOf(v.config);
  // Par chains first, under the rings.
  for (const team of ['A', 'B'] as const) {
    const chain = v.pars[team];
    for (let i = 1; i < chain.length; i++) {
      const a = sc(layout.islands[chain[i - 1]!]!, v);
      const b = sc(layout.islands[chain[i]!]!, v);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: px(PAR_W, v), color: v.teamColor(team), alpha: 0.9, cap: 'round' });
    }
  }
  layout.islands.forEach((isl, i) => {
    const c = sc(isl, v);
    const r = px(isl.r, v);
    const owner = v.owners[i];
    g.circle(c.x, c.y, r).fill({ color: v.river.island, alpha: 0.55 });
    if (owner) g.circle(c.x, c.y, r).fill({ color: v.teamColor(owner), alpha: OWNED_ALPHA });
    g.circle(c.x, c.y, r).stroke({ width: px(RING_W, v), color: owner ? v.teamColor(owner) : v.river.ring });
  });
  for (const rock of v.table.rocks) {
    const c = sc(rock, v);
    g.circle(c.x, c.y, px(rock.r, v)).fill(rock.r > NODI.ROCK_R ? v.river.bank : v.river.rock)
      .stroke({ width: 1.5, color: v.river.bankEdge });
  }
}

/** One whirlpool's spiral, drawn around (0, 0) so the caller can spin the Graphics. */
export function drawWhirl(g: Graphics, rPx: number, river: RiverSkin): void {
  g.clear();
  g.circle(0, 0, rPx).fill({ color: river.whirl, alpha: 0.85 });
  const steps = 24;
  for (let arm = 0; arm < WHIRL_ARMS; arm++) {
    const start = (arm * 2 * Math.PI) / WHIRL_ARMS;
    g.moveTo(0, 0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const a = start + t * WHIRL_TURNS * Math.PI;
      g.lineTo(Math.cos(a) * rPx * t, Math.sin(a) * rPx * t);
    }
    g.stroke({ width: 1.5, color: river.line, alpha: 0.6 });
  }
}

/** Boats on the river, the ready boat on the bank, and the selected boat's ring. */
export function drawBoats(
  g: Graphics, board: BoardState, v: Pick<SceneView, 'viewSeat' | 'boardPx'>, skinOf: (seat: number) => BoatSkin,
  ready: { seat: number; along: number } | null, selected: string | null,
): void {
  g.clear();
  const r = px(NODI.BOAT_D / 2, v);
  const one = (at: Vec, seat: number, alpha = 1) => {
    const c = sc(at, v);
    const skin = skinOf(seat);
    const color = skin.colors[seat % 4]!;
    g.circle(c.x + r * 0.15, c.y + r * 0.2, r).fill({ color: 0x000000, alpha: 0.25 * alpha });
    g.circle(c.x, c.y, r).fill({ color, alpha }).stroke({ width: Math.max(1, r * 0.18), color: skin.edge, alpha });
    if (skin.shape === 'nouka') {
      g.moveTo(c.x - r * 0.6, c.y).quadraticCurveTo(c.x, c.y + r * 0.7, c.x + r * 0.6, c.y).stroke({ width: Math.max(1, r * 0.2), color: skin.mark, alpha });
      g.moveTo(c.x, c.y + r * 0.1).lineTo(c.x, c.y - r * 0.6).stroke({ width: Math.max(1, r * 0.12), color: skin.mark, alpha });
    } else if (skin.shape === 'lotus') {
      for (let k = 0; k < 5; k++) {
        const a = (k * 2 * Math.PI) / 5;
        g.circle(c.x + Math.cos(a) * r * 0.42, c.y + Math.sin(a) * r * 0.42, r * 0.22).fill({ color: skin.mark, alpha: 0.85 * alpha });
      }
    } else {
      g.circle(c.x, c.y, r * 0.45).stroke({ width: Math.max(1, r * 0.14), color: skin.mark, alpha: 0.8 * alpha });
    }
  };
  for (const p of board.pieces) if (!p.pocketed) one(p, boatOf(p.id).seat);
  if (ready) one(launchPoint(ready.seat, ready.along), ready.seat, 0.85);
  const sel = selected ? board.pieces.find((p) => p.id === selected && !p.pocketed) : null;
  const at = sel ?? (ready ? launchPoint(ready.seat, ready.along) : null);
  if (at) {
    const c = sc(at, v);
    g.circle(c.x, c.y, r * 1.45).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
  }
}

/** The aim: a guide in the shot direction (length by power) from `from`. */
export function drawRiverAim(
  g: Graphics, from: Vec | null, aim: { dirX: number; dirY: number; power: number } | null, seat: Seat,
  v: Pick<SceneView, 'viewSeat' | 'boardPx'>,
): void {
  g.clear();
  if (!from || !aim) return;
  const d = seatToWorld(seat, aim.dirX, aim.dirY);
  const len = AIM_LEN * Math.max(0.15, aim.power);
  const a = sc(from, v);
  const b = sc({ x: from.x + d.x * len, y: from.y + d.y * len }, v);
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: px(AIM_W, v), color: 0xffffff, alpha: 0.9, cap: 'round' });
  g.circle(b.x, b.y, px(AIM_W * 1.6, v)).fill({ color: 0xffffff, alpha: 0.9 });
}

/** Turn clock ring around the boat about to move (fraction left), like carrom's. */
export function drawRiverClock(g: Graphics, fraction: number | null, at: Vec | null, v: Pick<SceneView, 'viewSeat' | 'boardPx'>): void {
  g.clear();
  if (fraction === null || !at) return;
  const c = sc(at, v);
  const r = px(NODI.BOAT_D * 0.95, v);
  const left = Math.max(0, Math.min(1, fraction));
  g.circle(c.x, c.y, r).stroke({ width: 3, color: 0x000000, alpha: 0.25 });
  if (left <= 0) return;
  const start = -Math.PI / 2;
  g.moveTo(c.x + r * Math.cos(start), c.y + r * Math.sin(start))
    .arc(c.x, c.y, r, start, start + 2 * Math.PI * left)
    .stroke({ width: 3, color: left < 0.25 ? 0xff3b30 : 0x2ecc71, cap: 'round' });
}

/** Board side in px for a world distance (exported for the hook's touch sizes). */
export const boatTouchPx = (boardPx: number): number => worldToPx(NODI.BOAT_D, boardPx);
export const HALF_L = config.HALF_L;
