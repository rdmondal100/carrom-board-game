import { config, TABLES, type Config } from './config';
import {
  resolveFrameHit, resolvePieceHit, resolveRockHit, timeToFrameHit, timeToPieceHit, timeToRockHit,
  type FrameAxis,
} from './collide';
import { bounceOffPocket, bouncesOut, dropInPocket, insidePocket, timeToPocket } from './pockets';
import type { BoardState, Piece, PocketId, ShotEvent, Table } from './types';

// Only + - * / and Math.sqrt in this file. No randomness, trig or clocks.

type Next =
  | { kind: 'none' }
  | { kind: 'hit'; a: Piece; b: Piece }
  | { kind: 'frame'; p: Piece; axis: FrameAxis }
  | { kind: 'pocket'; p: Piece; pocket: PocketId }
  | { kind: 'rock'; p: Piece; rock: number };

export function cloneState(state: BoardState): BoardState {
  return { pieces: state.pieces.map((p) => ({ ...p })) };
}

function isMoving(p: Piece): boolean {
  return !p.pocketed && (p.vx !== 0 || p.vy !== 0);
}

export function isAtRest(state: BoardState): boolean {
  return !state.pieces.some(isMoving);
}

function findNext(pieces: Piece[], maxT: number, table: Table): { t: number; next: Next } {
  let t = Infinity;
  let next: Next = { kind: 'none' };
  const rocks = table.rocks;
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i] as Piece;
    if (a.pocketed) continue;
    const aMoving = isMoving(a);
    if (aMoving) {
      const f = timeToFrameHit(a, maxT, table);
      if (f.t < t) { t = f.t; next = { kind: 'frame', p: a, axis: f.axis }; }
      const k = timeToPocket(a, maxT, table);
      if (k.t < t) { t = k.t; next = { kind: 'pocket', p: a, pocket: k.pocket }; }
      for (let r = 0; r < rocks.length; r++) {
        const h = timeToRockHit(a, rocks[r]!, maxT);
        if (h < t) { t = h; next = { kind: 'rock', p: a, rock: r }; }
      }
    }
    for (let j = i + 1; j < pieces.length; j++) {
      const b = pieces[j] as Piece;
      if (b.pocketed || (!aMoving && !isMoving(b))) continue;
      const h = timeToPieceHit(a, b, maxT);
      if (h < t) { t = h; next = { kind: 'hit', a, b }; }
    }
  }
  return { t, next };
}

function moveAll(pieces: Piece[], t: number): void {
  if (t === 0) return;
  for (const p of pieces) {
    if (p.pocketed) continue;
    p.x += p.vx * t;
    p.y += p.vy * t;
  }
}

function applyFriction(pieces: Piece[], cfg: Config): void {
  const drop = cfg.FRICTION_DECEL * cfg.DT;
  const keep = 1 - cfg.FRICTION_DRAG * cfg.DT;
  for (const p of pieces) {
    if (!isMoving(p)) continue;
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const slower = speed * keep - drop;
    if (slower < cfg.REST_SPEED) {
      p.vx = 0;
      p.vy = 0;
    } else {
      const k = slower / speed;
      p.vx *= k;
      p.vy *= k;
    }
  }
}

/**
 * NODI-1 half a step of the table's current on every moving piece. Applied
 * before and after the step's motion (kick, drift, kick), so a free piece
 * follows x0 + v0·t + a·t²/2 exactly. Pieces at rest stay put.
 */
function kick(pieces: Piece[], ax: number, ay: number): void {
  for (const p of pieces) {
    if (!isMoving(p)) continue;
    p.vx += ax;
    p.vy += ay;
  }
}

/**
 * Advance `state` by one DT in place, appending events. Used by step() and
 * simulateShot(); callers own the state they pass in.
 */
export function advanceInPlace(
  state: BoardState, timeMs: number, cfg: Config, events: ShotEvent[], table: Table = TABLES.carrom,
): void {
  const pieces = state.pieces;
  const flows = table.current.x !== 0 || table.current.y !== 0;
  const hx = (table.current.x * cfg.DT) / 2;
  const hy = (table.current.y * cfg.DT) / 2;
  for (const p of pieces) {
    const k = insidePocket(p, table);
    if (k !== null) {
      dropInPocket(p, k, table);
      events.push({ t: timeMs, type: 'pocket', id: p.id, pocket: k });
    }
  }
  if (flows) kick(pieces, hx, hy);

  let remaining = cfg.DT;
  let elapsed = 0;
  for (let n = 0; n < cfg.MAX_EVENTS_PER_STEP; n++) {
    const { t, next } = findNext(pieces, remaining, table);
    if (next.kind === 'none') break;
    moveAll(pieces, t);
    elapsed += t;
    remaining -= t;
    const at = timeMs + elapsed * 1000;
    if (next.kind === 'hit') {
      if (resolvePieceHit(next.a, next.b, cfg)) {
        events.push({ t: at, type: 'hit', a: next.a.id, b: next.b.id });
      }
    } else if (next.kind === 'frame') {
      resolveFrameHit(next.p, next.axis, table, cfg);
      events.push({ t: at, type: 'frame', id: next.p.id });
    } else if (next.kind === 'rock') {
      if (resolveRockHit(next.p, table.rocks[next.rock]!, table)) {
        events.push({ t: at, type: 'rock', id: next.p.id, rock: next.rock });
      }
    } else if (bouncesOut(next.p, table)) {
      bounceOffPocket(next.p, next.pocket, table, cfg);
      events.push({ t: at, type: 'pocketBounce', id: next.p.id, pocket: next.pocket });
    } else {
      dropInPocket(next.p, next.pocket, table);
      events.push({ t: at, type: 'pocket', id: next.p.id, pocket: next.pocket });
    }
  }
  moveAll(pieces, remaining);
  if (flows) kick(pieces, hx, hy);
  applyFriction(pieces, cfg);
}

/** One fixed step of DT. Never changes the input; returns the new state. */
export function step(
  state: BoardState, timeMs: number, cfg: Config = config, table: Table = TABLES.carrom,
): { state: BoardState; events: ShotEvent[] } {
  const next = cloneState(state);
  const events: ShotEvent[] = [];
  advanceInPlace(next, timeMs, cfg, events, table);
  return { state: next, events };
}
