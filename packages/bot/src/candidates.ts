import {
  baselinePoint, config as engine, placeStriker, pocketCentre, seatForward, seatOutward, seatRight,
  type Piece, type PocketId, type Seat, type ShotInput, type Vec,
} from '@carrom/engine';
import { RULES, teamOf, type GameState } from '@carrom/rules';
import { BOT, type LevelConfig } from './config';

export interface Candidate {
  input: ShotInput;
  /** Higher = more promising; only used to pick which shots to simulate. */
  rank: number;
}

const POCKETS: readonly PocketId[] = [0, 1, 2, 3];
const coinsOnly = (ids: string[]) => ids.filter((id) => id !== 'red');

/** Coins worth aiming at for the side to move. */
export function targetCoins(g: GameState): Piece[] {
  const seat = g.turnSeat;
  const team = teamOf(seat, g.config.format);
  const on = g.board.pieces.filter((p) => !p.pocketed && p.kind !== 'striker');
  const red = on.find((p) => p.kind === 'red');
  const redOnBoard = red !== undefined && g.redPending === null;
  const sideHasCoin = coinsOnly(g.pocketed[team]).length > 0;

  let coins: Piece[];
  if (g.config.preset === 'colour') {
    const colour = g.teamColour[team];
    coins = on.filter((p) => p.kind === colour);
    const left = RULES.COINS_PER_COLOUR - coinsOnly(g.pocketed[team]).length;
    // RUL-7: the last own coin would come back while red is on the board.
    if (redOnBoard && left <= 1) coins = [];
  } else {
    coins = on.filter((p) => p.kind === 'white' || p.kind === 'black');
    if (redOnBoard && coins.length <= 1) coins = [];
  }
  // RUL-5: red only counts once the side has a coin down (or one this shot).
  // Red waiting for cover is pocketed, so it never shows up here.
  if (red && redOnBoard && (sideHasCoin || coins.length === 0)) coins.push(red);
  return coins;
}

function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

/** Distance² from point p to segment a→b. */
function segDist2(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.min(1, Math.max(0, t));
  const dx = a.x + abx * t - p.x;
  const dy = a.y + aby * t - p.y;
  return dx * dx + dy * dy;
}

/** How many pieces sit in the way of a disc of radius r sliding a→b. */
function blockers(a: Vec, b: Vec, r: number, others: Piece[]): number {
  let n = 0;
  for (const o of others) {
    const reach = r + o.r;
    if (segDist2(o, a, b) < reach * reach) n++;
  }
  return n;
}

/** Baseline spot from which the striker, coin and pocket line up, or null. */
function straightX(seat: Seat, coin: Vec, u: Vec): number | null {
  const o = seatOutward(seat);
  const uo = dot(u, o);
  if (uo === 0) return null;
  const t = (dot(coin, o) - (engine.HALF_L - engine.BASELINE_INSET)) / uo;
  if (t <= 0) return null;
  const along = dot({ x: coin.x - u.x * t, y: coin.y - u.y * t }, seatRight(seat));
  return Math.abs(along) <= engine.BASELINE_HALF ? along : null;
}

/** A world direction as the seat-relative unit vector a ShotInput wants. */
function toSeat(seat: Seat, d: Vec): { dirX: number; dirY: number } {
  return { dirX: dot(d, seatRight(seat)), dirY: dot(d, seatForward(seat)) };
}

/** Striker spots along the baseline that placeStriker accepts, deduplicated. */
function strikerSpots(g: GameState, seat: Seat, wants: number[]): number[] {
  const out: number[] = [];
  for (const w of wants) {
    const p = placeStriker(g.board, seat, w);
    if (p.ok && !out.includes(p.x)) out.push(p.x);
  }
  return out;
}

function gridXs(): number[] {
  const half = engine.BASELINE_HALF;
  const xs: number[] = [];
  for (let i = 0; i < BOT.X_STEPS; i++) xs.push(-half + (2 * half * i) / (BOT.X_STEPS - 1));
  return xs;
}

/** Ghost-ball aims: each target coin into each pocket from several striker spots. */
function ghostAims(g: GameState, seat: Seat): { x: number; dir: Vec; rank: number }[] {
  const rs = engine.STRIKER_D / 2;
  const on = g.board.pieces.filter((p) => !p.pocketed && p.kind !== 'striker');
  const aims: { x: number; dir: Vec; rank: number }[] = [];
  const grid = gridXs();
  for (const coin of targetCoins(g)) {
    const others = on.filter((p) => p !== coin);
    for (const k of POCKETS) {
      const pc = pocketCentre(k, engine);
      const cpx = pc.x - coin.x;
      const cpy = pc.y - coin.y;
      const cpLen = Math.sqrt(cpx * cpx + cpy * cpy);
      if (cpLen === 0) continue;
      const u = { x: cpx / cpLen, y: cpy / cpLen };
      const ghost = { x: coin.x - u.x * (coin.r + rs), y: coin.y - u.y * (coin.r + rs) };
      const line = straightX(seat, coin, u);
      const spots = strikerSpots(g, seat, line === null ? grid : [line, ...grid]);
      const coinBlocked = blockers(coin, pc, coin.r, others);
      for (const x of spots) {
        const s = baselinePoint(seat, x);
        const vx = ghost.x - s.x;
        const vy = ghost.y - s.y;
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len === 0) continue;
        const dir = { x: vx / len, y: vy / len };
        const cut = dot(dir, u);
        if (cut < BOT.MIN_CUT_COS) continue;
        const blocked = coinBlocked + blockers(s, ghost, rs, others);
        let rank = cut / (1 + len + cpLen);
        for (let i = 0; i < blocked; i++) rank /= BOT.BLOCKED_PENALTY;
        aims.push({ x, dir, rank });
      }
    }
  }
  return aims;
}

/**
 * BOT-3: the shots worth simulating, best first, at most `sims`.
 * Ghost-ball aims × the level's powers, plus a few spread shots.
 */
export function candidates(g: GameState, level: LevelConfig, sims = level.sims): Candidate[] {
  const seat = g.turnSeat as Seat;
  const out: Candidate[] = [];

  const centre = strikerSpots(g, seat, [0, ...gridXs()])[0];
  const spreads: Candidate[] = [];
  if (centre !== undefined) {
    for (const power of BOT.SPREAD_POWERS) {
      for (const d of BOT.SPREAD_DIRS) {
        spreads.push({ input: { seat, x: centre, dirX: d.x, dirY: d.y, power }, rank: 0 });
      }
    }
  }

  const aims = ghostAims(g, seat).sort((a, b) => b.rank - a.rank);
  const budget = Math.max(0, Math.floor((sims - spreads.length) / level.powers.length));
  for (const aim of aims.slice(0, budget)) {
    const { dirX, dirY } = toSeat(seat, aim.dir);
    for (const power of level.powers) {
      out.push({ input: { seat, x: aim.x, dirX, dirY, power }, rank: aim.rank });
    }
  }
  return [...out, ...spreads].slice(0, sims);
}
