// NODI-3 the carrom shot search (`@carrom/bot`) with Nodi Par targets
// (island rings and opponent boats) and a Nodi Par score.
import { addNoise, bestRobust, blockers, ghostPoint, mulberry32, robustTop, ROBUST_TRIES, type PowerRange } from '@carrom/bot';
import { config as engine, NODI, seatForward, seatRight, spotIsFree, type Piece, type Seat, type Vec } from '@carrom/engine';
import type { BotLevel } from '@hub/game-kit';
import { NODI_BOT, NODI_RULES } from './config';
import { boatOf, islandOf, layoutOf, tableOf, teamOf } from './islands';
import { applyNodiMove, inHand, launchPoint, onRiver } from './rules';
import type { NodiEvent, NodiMove, NodiState, Team } from './types';

const RANGE: PowerRange = { min: NODI_RULES.MIN_POWER, max: NODI_RULES.MAX_POWER };
const BOAT_R = NODI.BOAT_D / 2;
const K = engine.FRICTION_DRAG;
const A = engine.FRICTION_DECEL;

/** How far a lone boat starting at speed v slides (no current): v/k − (a/k²)·ln(1 + k·v/a). */
export function slideDistance(v: number): number {
  return v / K - (A / (K * K)) * Math.log(1 + (K * v) / A);
}

/** Start speed that slides `d` (bisection; capped at the boat's top speed). */
export function speedFor(d: number): number {
  let lo = 0;
  let hi: number = NODI.MAX_SPEED;
  if (slideDistance(hi) <= d) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (slideDistance(mid) < d) lo = mid;
    else hi = mid;
  }
  return hi;
}

const dist = (a: Vec, b: Vec): number => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

interface Source { from: Vec; move: (dirX: number, dirY: number, power: number) => NodiMove; id: string }

function sources(s: NodiState, seat: number): Source[] {
  const out: Source[] = [];
  if (inHand(s, seat).length > 0) {
    const half = layoutOf(s.config).bankHalf;
    const n = NODI_BOT.BANK_SPOTS;
    const table = tableOf(s.config);
    for (let i = 0; i < n; i++) {
      const x = -half * 0.8 + (1.6 * half * i) / (n - 1);
      const from = launchPoint(seat, x);
      if (!spotIsFree(s.board, from.x, from.y, BOAT_R, table)) continue;
      out.push({ from, id: '', move: (dirX, dirY, power) => ({ kind: 'launch', x, dirX, dirY, power }) });
    }
  }
  for (const boat of onRiver(s, seat)) {
    const p = s.board.pieces.find((q) => q.id === `${seat}-${boat}`)!;
    out.push({ from: p, id: p.id, move: (dirX, dirY, power) => ({ kind: 'flick', boat, dirX, dirY, power }) });
  }
  return out;
}

/** Spots worth stopping on: a ring's centre, or (when a rock sits there) four points around it. */
function islandSpots(s: NodiState): { at: Vec; island: number }[] {
  const layout = layoutOf(s.config);
  const table = tableOf(s.config);
  const out: { at: Vec; island: number }[] = [];
  layout.islands.forEach((isl, island) => {
    if (spotIsFree({ pieces: [] }, isl.x, isl.y, BOAT_R, table)) {
      out.push({ at: isl, island });
      return;
    }
    const off = isl.r * 0.65;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) out.push({ at: { x: isl.x + dx * off, y: isl.y + dy * off }, island });
  });
  return out;
}

/** NODI-3 candidate moves, best ranked first: stop on an island, or knock an opponent boat away. */
export function nodiCandidates(s: NodiState, seat: number, sims: number, powerScales: readonly number[]): { input: NodiMove; rank: number }[] {
  const layout = layoutOf(s.config);
  const table = tableOf(s.config);
  const team = teamOf(s.config, seat);
  const river = s.board.pieces.filter((p) => !p.pocketed);
  const foes = river.filter((p) => teamOf(s.config, boatOf(p.id).seat) !== team && islandOf(p, layout) >= 0);
  const spots = islandSpots(s);
  const right = seatRight(seat as Seat);
  const fwd = seatForward(seat as Seat);
  const aims: { src: Source; to: Vec; speed: number; rank: number }[] = [];

  for (const src of sources(s, seat)) {
    const others = [...river.filter((p) => p.id !== src.id), ...table.rocks];
    const here = src.id ? islandOf(src.from as Piece, layout) : -1;
    for (const { at, island } of spots) {
      if (island === here) continue;
      const d = dist(src.from, at);
      const owner = s.owners[island];
      const worth = layout.islands[island]!.points * (owner === team ? 0.5 : 1);
      let rank = worth / (1 + d);
      for (let i = 0; i < blockers(src.from, at, BOAT_R, others); i++) rank /= NODI_BOT.BLOCKED_PENALTY;
      aims.push({ src, to: at, speed: speedFor(d), rank });
    }
    for (const foe of foes) {
      // Push the foe straight on, or into the nearest whirlpool.
      const goals = [...table.pockets].sort((a, b) => dist(foe, a) - dist(foe, b)).slice(0, 1);
      const straight = { x: foe.x + (foe.x - src.from.x) * 2, y: foe.y + (foe.y - src.from.y) * 2 };
      for (const goal of [...goals, straight]) {
        const g = ghostPoint(foe, goal, BOAT_R);
        if (!g) continue;
        const path = dist(src.from, g.ghost);
        const push = Math.min(g.dist, NODI_BOT.PUSH_PAST + foe.r);
        const atHit = speedFor(push) / 0.95;
        const speed = speedFor(path + slideDistance(atHit));
        const isl = layout.islands[islandOf(foe, layout)]!;
        let rank = (isl.points * 1.2) / (1 + path);
        for (let i = 0; i < blockers(src.from, g.ghost, BOAT_R, others.filter((o) => o !== foe)); i++) rank /= NODI_BOT.BLOCKED_PENALTY;
        aims.push({ src, to: g.ghost, speed, rank });
      }
    }
  }
  aims.sort((a, b) => b.rank - a.rank);
  const out: { input: NodiMove; rank: number }[] = [];
  for (const a of aims) {
    const len = dist(a.src.from, a.to);
    if (len === 0) continue;
    const dx = (a.to.x - a.src.from.x) / len;
    const dy = (a.to.y - a.src.from.y) / len;
    const dirX = dx * right.x + dy * right.y;
    const dirY = dx * fwd.x + dy * fwd.y;
    for (const k of powerScales) {
      const power = Math.min(RANGE.max, Math.max(RANGE.min, (a.speed * k) / NODI.MAX_SPEED));
      out.push({ input: a.src.move(dirX, dirY, power), rank: a.rank });
    }
    if (out.length >= sims) break;
  }
  return out.slice(0, sims);
}

/** How deep a boat sits in its ring: 1 at the centre, 0 at the rim or off any island. */
function depth(p: Piece, s: NodiState): number {
  const layout = layoutOf(s.config);
  const i = islandOf(p, layout);
  if (i < 0) return 0;
  const isl = layout.islands[i]!;
  return 1 - dist(p, isl) / isl.r;
}

/** NODI-3 how good a move's outcome is for `team`. */
export function scoreNodi(after: NodiState, events: readonly NodiEvent[], team: Team): number {
  const opp: Team = team === 'A' ? 'B' : 'A';
  const win = events.find((e) => e.type === 'win');
  if (win) return win.winner === team ? 1e6 : -1e6;
  const end = events.find((e) => e.type === 'roundEnd');
  if (end) return (end.result.points[team] - end.result.points[opp]) * NODI_BOT.POINT * 3;
  let score = (after.live[team] - after.live[opp]) * NODI_BOT.POINT;
  for (const p of after.board.pieces) {
    if (p.pocketed) continue;
    const mine = teamOf(after.config, boatOf(p.id).seat) === team;
    score += (mine ? 1 : -0.5) * NODI_BOT.DEEP * depth(p, after);
  }
  for (const e of events) {
    if (e.type !== 'whirlpool') continue;
    score += teamOf(after.config, e.seat) === team ? NODI_BOT.LOST : NODI_BOT.SUNK;
  }
  return score;
}

function fallback(s: NodiState, seat: number): NodiMove {
  const boat = onRiver(s, seat)[0];
  if (inHand(s, seat).length > 0 || boat === undefined) return { kind: 'launch', x: 0, dirX: 0, dirY: 1, power: 0.3 };
  return { kind: 'flick', boat, dirX: 0, dirY: 1, power: 0.3 };
}

/** NODI-3 pick a move for `seat`. Pure: same state, level and seed → same move. */
export function nodiBot(s: NodiState, seat: number, level: BotLevel, seed: number): NodiMove {
  const cfg = NODI_BOT.LEVELS[level];
  const team = teamOf(s.config, seat);
  const evaluate = (m: NodiMove): number => {
    const out = applyNodiMove(s, seat, s.turnId, m);
    return out.ok ? scoreNodi(out.state, out.events, team) : -Infinity;
  };
  const top = robustTop(cfg.sims);
  const best = bestRobust(nodiCandidates(s, seat, cfg.sims - top * ROBUST_TRIES, cfg.powerScales), evaluate, cfg, top, RANGE);
  return addNoise(best ?? fallback(s, seat), cfg, mulberry32(seed), RANGE);
}
