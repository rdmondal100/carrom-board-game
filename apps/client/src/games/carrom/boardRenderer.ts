import type { BoardState, Kind, Seat, Vec } from '@carrom/engine';
import type { PieceStyle } from '@/constants/view';
import type { Aim } from './aim';
import type { BoardLayout } from './drawBoard';
import type { StrikerSpot } from './drawPieces';
import type { BoardSkins } from './skins';

/** `contain`: fit the host's width and height (UI-5 full-height board page); `width`: the host's width only. */
export type BoardFit = 'width' | 'contain';

/** What one frame shows (the hook works it out; a renderer only draws it). */
export interface BoardDraw {
  board: BoardState;
  view: Seat;
  seat: Seat;
  nowMs: number;
  pocketedAt: ReadonlyMap<string, number>;
  striker: StrikerSpot | null;
  styleOf: (kind: Kind) => PieceStyle;
  /** The waiting striker's spot (aim and clock are drawn from it). */
  spot: Vec;
  aim: Aim | null;
  /** The pull line in board px, or null. */
  pull: Vec | null;
  clock: number | null;
  skins: BoardSkins;
}

/**
 * T3D-4 one way of drawing the board (Pixi 2D or three.js 3D). Input maths
 * works in board px either way, so a drag gives the same shot in both.
 */
export interface BoardRenderer {
  canvas: HTMLCanvasElement;
  /** The board's size in px for the input maths (origin at the inner board's top-left). */
  layout(): BoardLayout;
  /** A pointer as board px, or null when it is off the board's plane. */
  local(e: { clientX: number; clientY: number }): Vec | null;
  /** The static board, after a view change or a new board skin. */
  redraw(view: Seat, skins: BoardSkins): void;
  draw(d: BoardDraw): void;
  /** Call `tick` every animation frame with the ms since the last. */
  start(tick: (deltaMs: number) => void): void;
  destroy(): void;
}

/**
 * Makes a renderer in `host`; `onResize` fires after each fit (the hook reads
 * `layout()` again); `onLost` when the GPU drops a 3D context (T3D-2).
 */
export type RendererFactory = (host: HTMLDivElement, fit: BoardFit, onResize: () => void, onLost: () => void) => Promise<BoardRenderer>;
