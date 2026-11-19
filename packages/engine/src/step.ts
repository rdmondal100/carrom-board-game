import { config, type Config } from './config';
import {
  resolveFrameHit, resolvePieceHit, timeToFrameHit, timeToPieceHit, type FrameAxis,
} from './collide';
import { bounceOffPocket, bouncesOut, dropInPocket, insidePocket, timeToPocket } from './pockets';
import type { BoardState, Piece, PocketId, ShotEvent } from './types';

// Only + - * / and Math.sqrt in this file. No randomness, trig or clocks.

type Next =
  | { kind: 'none' }
  | { kind: 'hit'; a: Piece; b: Piece }
  | { kind: 'frame'; p: Piece; axis: FrameAxis }
  | { kind: 'pocket'; p: Piece; pocket: PocketId };

export function cloneState(state: BoardState): BoardState {
  return { pieces: state.pieces.map((p) => ({ ...p })) };
}

function isMoving(p: Piece): boolean {
  return !p.pocketed && (p.vx !== 0 || p.vy !== 0);
}

export function isAtRest(state: BoardState): boolean {
  return !state.pieces.some(isMoving);
}

function findNext(pieces: Piece[], maxT: number, cfg: Config): { t: number; next: Next } {
  let t = Infinity;
  let next: Next = { kind: 'none' };
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i] as Piece;
    if (a.pocketed) continue;
    const aMoving = isMoving(a);
    if (aMoving) {
      const f = timeToFrameHit(a, maxT, cfg);
      if (f.t < t) { t = f.t; next = { kind: 'frame', p: a, axis: f.axis }; }
      const k = timeToPocket(a, maxT, cfg);
      if (k.t < t) { t = k.t; next = { kind: 'pocket', p: a, pocket: k.pocket }; }
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
 * Advance `state` by one DT in place, appending events. Used by step() and
 * simulateShot(); callers own the state they pass in.
 */
export function advanceInPlace(
  state: BoardState, timeMs: number, cfg: Config, events: ShotEvent[],
): void {
  const pieces = state.pieces;
  for (const p of pieces) {
    const k = insidePocket(p, cfg);
    if (k !== null) {
      dropInPocket(p, k, cfg);
      events.push({ t: timeMs, type: 'pocket', id: p.id, pocket: k });
    }
  }

  let remaining = cfg.DT;
  let elapsed = 0;
  for (let n = 0; n < cfg.MAX_EVENTS_PER_STEP; n++) {
    const { t, next } = findNext(pieces, remaining, cfg);
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
      resolveFrameHit(next.p, next.axis, cfg);
      events.push({ t: at, type: 'frame', id: next.p.id });
    } else if (bouncesOut(next.p, cfg)) {
      bounceOffPocket(next.p, next.pocket, cfg);
      events.push({ t: at, type: 'pocketBounce', id: next.p.id, pocket: next.pocket });
    } else {
      dropInPocket(next.p, next.pocket, cfg);
      events.push({ t: at, type: 'pocket', id: next.p.id, pocket: next.pocket });
    }
  }
  moveAll(pieces, remaining);
  applyFriction(pieces, cfg);
}

/** One fixed step of DT. Never changes the input; returns the new state. */
export function step(
  state: BoardState, timeMs: number, cfg: Config = config,
): { state: BoardState; events: ShotEvent[] } {
  const next = cloneState(state);
  const events: ShotEvent[] = [];
  advanceInPlace(next, timeMs, cfg, events);
  return { state: next, events };
}
