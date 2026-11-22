// NODI-4 the river's touch and playback logic, without Pixi or React (tested on its own).
import { cloneState, NODI, seatForward, seatRight, seatToWorld, type Seat, type Vec } from '@carrom/engine';
import { aimedStart, boatId, inHand, launchPoint, layoutOf, onRiver, tableOf, type NodiMove, type NodiState } from '@hub/nodipar';
import { aimFromDrag, type Aim } from '@/games/carrom/aim';
import { createBoardPlayback, type Playback } from '@/games/carrom/playback';

/** A touch lands within this many boat radii of a boat to grab it. */
const GRAB_RADII = 1.8;
/** Half the bank band a touch may slide the ready boat along, L. */
const BANK_BAND = 0.07;

/** What a press on the river picks: one of your boats, the ready boat on your bank, or a spot along the bank. */
export type Touch =
  | { kind: 'boat'; boat: number }
  | { kind: 'ready' }
  | { kind: 'bank'; along: number }
  | null;

/** Along / across the seat's bank line, measured from its middle. */
export function bankCoords(seat: number, w: Vec): { along: number; across: number } {
  const base = launchPoint(seat, 0);
  const r = seatRight(seat as Seat);
  const f = seatForward(seat as Seat);
  const dx = w.x - base.x;
  const dy = w.y - base.y;
  return { along: dx * r.x + dy * r.y, across: dx * f.x + dy * f.y };
}

export const clampAlong = (s: NodiState, along: number): number => {
  const half = layoutOf(s.config).bankHalf;
  return Math.max(-half, Math.min(half, along));
};

/** NODI-4 which of `seat`'s things a press at world point `w` picks (nearest boat first). */
export function touchAt(s: NodiState, seat: number, w: Vec, along: number): Touch {
  const reach = (NODI.BOAT_D / 2) * GRAB_RADII;
  let best: { boat: number; d2: number } | null = null;
  for (const boat of onRiver(s, seat)) {
    const p = s.board.pieces.find((q) => q.id === boatId(seat, boat))!;
    const d2 = (p.x - w.x) * (p.x - w.x) + (p.y - w.y) * (p.y - w.y);
    if (d2 <= reach * reach && (!best || d2 < best.d2)) best = { boat, d2 };
  }
  if (best) return { kind: 'boat', boat: best.boat };
  if (inHand(s, seat).length === 0) return null;
  const at = launchPoint(seat, along);
  if ((at.x - w.x) * (at.x - w.x) + (at.y - w.y) * (at.y - w.y) <= reach * reach) return { kind: 'ready' };
  const b = bankCoords(seat, w);
  if (Math.abs(b.across) <= BANK_BAND && Math.abs(b.along) <= layoutOf(s.config).bankHalf + BANK_BAND) {
    return { kind: 'bank', along: clampAlong(s, b.along) };
  }
  return null;
}

/** A slingshot drag seen from `viewSeat`, as an aim in the shooter's own frame. */
export function aimForSeat(pullPx: Vec, boardPx: number, viewSeat: Seat, seat: Seat): Aim {
  const a = aimFromDrag(pullPx, boardPx);
  if (viewSeat === seat || a.cancelled) return a;
  const w = seatToWorld(viewSeat, a.dirX, a.dirY);
  const r = seatRight(seat);
  const f = seatForward(seat);
  return { ...a, dirX: w.x * r.x + w.y * r.y, dirY: w.x * f.x + w.y * f.y };
}

/** The move a release makes: launch from the bank spot, or flick the grabbed boat. */
export function moveOf(source: { kind: 'boat'; boat: number } | { kind: 'ready'; along: number }, aim: Aim): NodiMove {
  const { dirX, dirY, power } = aim;
  return source.kind === 'boat' ? { kind: 'flick', boat: source.boat, dirX, dirY, power } : { kind: 'launch', x: source.along, dirX, dirY, power };
}

/** Where the move's boat starts (on the bank or where it lies). */
export function moveFrom(s: NodiState, seat: number, move: NodiMove): Vec | null {
  if (move.kind === 'launch') return launchPoint(seat, move.x);
  const p = s.board.pieces.find((q) => q.id === boatId(seat, move.boat));
  return p && !p.pocketed ? { x: p.x, y: p.y } : null;
}

/**
 * NODI-4 real-time playback of a move from the state on screen, reusing
 * carrom's playback on this game's table. Ends on exactly the rules' board.
 */
export function playbackOf(s: NodiState, seat: number, move: NodiMove): Playback {
  const a = aimedStart(s, seat, move);
  const board = cloneState(a.board);
  const p = board.pieces.find((q) => q.id === a.id)!;
  p.vx = a.vx;
  p.vy = a.vy;
  return createBoardPlayback(board, tableOf(s.config));
}
