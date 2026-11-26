import type { BoardState, Seat, Table, Vec } from '@carrom/engine';
import type { NodiConfig, Team } from '@hub/nodipar';
import type { Aim } from '@/games/carrom/aim';
import type { RiverLayout } from './drawRiver';
import type { BoatSkin, RiverSkin } from './skins';

/** What one frame of the river shows (the hook works it out; a renderer only draws it). */
export interface RiverDraw {
  config: NodiConfig;
  table: Table;
  owners: readonly (Team | null)[];
  pars: Readonly<Record<Team, readonly number[]>>;
  view: Seat;
  river: RiverSkin;
  teamColor: (team: Team) => number;
  board: BoardState;
  skinOf: (seat: number) => BoatSkin;
  ready: { seat: number; along: number } | null;
  selected: string | null;
  aimFrom: Vec | null;
  aim: Aim | null;
  aimSeat: Seat;
  clock: number | null;
  clockAt: Vec | null;
  deltaMs: number;
}

/** T3D-7 one way of drawing the river (Pixi 2D or three.js 3D); touches come back as world points and board px. */
export interface RiverRenderer {
  canvas: HTMLCanvasElement;
  layout(): RiverLayout;
  /** A pointer as a world point seen from `view`, or null off the river. */
  world(e: { clientX: number; clientY: number }, view: Seat): Vec | null;
  /** A pointer as board px (the slingshot pull), or null off the river. */
  screen(e: { clientX: number; clientY: number }): Vec | null;
  draw(d: RiverDraw): void;
  start(tick: (deltaMs: number) => void): void;
  destroy(): void;
}

export type RiverFactory = (host: HTMLDivElement, onLost: () => void) => Promise<RiverRenderer>;
