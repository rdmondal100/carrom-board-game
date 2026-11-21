// The board hook's plain state and helpers (no React, no per-frame state in React).
import type { Graphics } from 'pixi.js';
import {
  config, createRack, placeStriker, seatForward, seatRight, seatToWorld,
  type BoardState, type Seat, type ShotInput, type Vec,
} from '@carrom/engine';
import {
  AIM_MAX_DRAG, BOT_PREVIEW_MS, BOT_SLIDE_SHARE, CLOCK_COLOURS, CLOCK_LOW_FRACTION, CLOCK_RING_SCALE,
  CLOCK_RING_WIDTH, CLOCK_START_ANGLE, CLOCK_TRACK_ALPHA, FULL_TURN,
} from '@/constants/view';
import { aimFromDrag, type Aim } from './aim';
import { layoutFor, type BoardLayout } from './drawBoard';
import type { RemoteAim } from './boardApi';
import type { Playback } from './playback';
import { DEFAULT_SKINS, type BoardSkins } from './skins';
import { worldToPx, worldToScreen } from './view';

export type Drag =
  | { kind: 'place'; pointerId: number }
  | { kind: 'aim'; pointerId: number; start: Vec; pull: Vec; aim: Aim };

/** BOT-6: a bot shot being shown before it is played. */
export interface BotPreview { from: number; input: ShotInput; elapsed: number }

export interface Ctrl {
  board: BoardState;
  /** Shooting seat. */
  seat: Seat;
  /** Seat drawn at the bottom of the screen. */
  view: Seat;
  locked: boolean;
  clock: number | null;
  along: number;
  placed: { ok: boolean; x: number };
  drag: Drag | null;
  bot: BotPreview | null;
  /** ROOM-6: aim another player is showing for this shooter. */
  remote: RemoteAim | null;
  playback: Playback | null;
  pocketedAt: Map<string, number>;
  layout: BoardLayout;
  /** COS-6 what the board, coins and each seat's striker look like. */
  skins: BoardSkins;
}

export function newCtrl(seat: Seat): Ctrl {
  const board = createRack(seat);
  return {
    board, seat, view: seat, locked: false, clock: null, along: 0, placed: placeStriker(board, seat, 0),
    drag: null, bot: null, remote: null, playback: null, pocketedAt: new Map(), layout: layoutFor(0),
    skins: DEFAULT_SKINS,
  };
}

/** aimFromDrag reads the drag from the view seat; turn it into the shooter's own frame. */
export function aimFor(c: Ctrl, pull: Vec): Aim {
  const a = aimFromDrag(pull, c.layout.boardPx);
  if (c.view === c.seat || a.cancelled) return a;
  const w = seatToWorld(c.view, a.dirX, a.dirY);
  const r = seatRight(c.seat);
  const f = seatForward(c.seat);
  return { ...a, dirX: w.x * r.x + w.y * r.y, dirY: w.x * f.x + w.y * f.y };
}

const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * BOT-6: where the bot's striker sits and what aim shows, `elapsed` ms into
 * the preview: first it slides from `from` to the shot's spot, then the aim
 * grows to the shot's power. done once BOT_PREVIEW_MS has passed.
 */
export function botPreviewAt(p: BotPreview): { along: number; aim: Aim | null; done: boolean } {
  const t = Math.min(1, p.elapsed / BOT_PREVIEW_MS);
  const slide = Math.min(1, t / BOT_SLIDE_SHARE);
  const along = slide >= 1 ? p.input.x : p.from + (p.input.x - p.from) * ease(slide);
  if (t < BOT_SLIDE_SHARE) return { along, aim: null, done: false };
  const grow = ease((t - BOT_SLIDE_SHARE) / (1 - BOT_SLIDE_SHARE));
  const aim = { dirX: p.input.dirX, dirY: p.input.dirY, power: p.input.power * grow, cancelled: false };
  return { along, aim, done: t >= 1 };
}

/** The pull line (screen px) a person would have dragged for this aim. */
export function pullFor(aim: Aim, seat: Seat, view: Seat, boardPx: number, from: Vec): Vec {
  const dir = seatToWorld(seat, aim.dirX, aim.dirY);
  const len = AIM_MAX_DRAG * aim.power;
  const s = worldToScreen(from, view, boardPx);
  const e = worldToScreen({ x: from.x - dir.x * len, y: from.y - dir.y * len }, view, boardPx);
  return { x: e.x - s.x, y: e.y - s.y };
}

/** LOC-5: a ring around the waiting striker that empties as the clock runs. */
export function drawClock(g: Graphics, fraction: number | null, at: Vec, view: Seat, boardPx: number): void {
  g.clear();
  if (fraction === null) return;
  const s = worldToScreen(at, view, boardPx);
  const r = worldToPx((config.STRIKER_D / 2) * CLOCK_RING_SCALE, boardPx);
  const width = worldToPx(CLOCK_RING_WIDTH, boardPx);
  const left = Math.max(0, Math.min(1, fraction));
  g.circle(s.x, s.y, r).stroke({ width, color: CLOCK_COLOURS.track, alpha: CLOCK_TRACK_ALPHA });
  if (left <= 0) return;
  const colour = left < CLOCK_LOW_FRACTION ? CLOCK_COLOURS.low : CLOCK_COLOURS.ok;
  g.moveTo(s.x + r * Math.cos(CLOCK_START_ANGLE), s.y + r * Math.sin(CLOCK_START_ANGLE))
    .arc(s.x, s.y, r, CLOCK_START_ANGLE, CLOCK_START_ANGLE + FULL_TURN * left)
    .stroke({ width, color: colour, cap: 'round' });
}
