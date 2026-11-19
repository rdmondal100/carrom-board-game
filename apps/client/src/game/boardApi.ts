import type { BoardState, Seat, ShotInput } from '@carrom/engine';
import { newCtrl, type Ctrl } from './boardCtrl';

/** ROOM-6: another player's aim, seat-relative to the shooter. */
export interface RemoteAim { x: number; dirX: number; dirY: number; power: number }

export interface BoardApi {
  /** New rack with `seat` breaking; that seat shoots and sits at the bottom. */
  reset(seat: Seat): void;
  /** Change the shooting (and viewing) seat without touching the coins. */
  setSeat(seat: Seat): void;
  /** Show this board with `shooter` to play, seen from `viewSeat` (at the bottom). */
  load(board: BoardState, shooter: Seat, viewSeat: Seat): void;
  /** While locked, touches are ignored. */
  setLocked(locked: boolean): void;
  /** Shot clock ring around the striker: fraction of time left, or null to hide. */
  setClock(fraction: number | null): void;
  /** BOT-6: slide the striker to the bot's spot, show its aim, then shoot (onShot fires as for a person). */
  playBot(input: ShotInput): void;
  /** Stop a bot preview that hasn't shot yet. */
  cancelBot(): void;
  /** ROOM-5: play a shot someone else made, from the board on screen. onShot does not fire. */
  replay(input: ShotInput): void;
  /** ROOM-6: show the shooter's aim as another player sends it (null hides it). */
  showAim(aim: RemoteAim | null): void;
}

interface Deps {
  ctrl: () => Ctrl | null;
  redraw: () => void;
  /** Place the striker again and report whether it fits. */
  replace: (c: Ctrl) => void;
  /** Start playing `input` from the current board; `own` = a shot made on this screen. */
  shoot: (c: Ctrl, input: ShotInput, own: boolean) => void;
}

/** The imperative board API; all state lives in the Ctrl, none in React. */
export function createBoardApi({ ctrl, redraw, replace, shoot }: Deps): BoardApi {
  return {
    reset(seat) {
      const c = ctrl();
      if (!c || c.playback) return;
      Object.assign(c, { ...newCtrl(seat), layout: c.layout });
      replace(c);
      redraw();
    },
    setSeat(seat) {
      const c = ctrl();
      if (!c || c.playback) return;
      Object.assign(c, { seat, view: seat, along: 0, drag: null });
      replace(c);
      redraw();
    },
    load(board, shooter, viewSeat) {
      const c = ctrl();
      if (!c || c.playback) return;
      Object.assign(c, { board, seat: shooter, view: viewSeat, along: 0, drag: null, bot: null, remote: null });
      replace(c);
      redraw();
    },
    setLocked(locked) {
      const c = ctrl();
      if (!c) return;
      c.locked = locked;
      if (locked) c.drag = null;
    },
    setClock(fraction) {
      const c = ctrl();
      if (c) c.clock = fraction;
    },
    playBot(input) {
      const c = ctrl();
      if (!c || c.playback || input.seat !== c.seat) return;
      c.drag = null;
      c.bot = { from: c.placed.x, input, elapsed: 0 };
    },
    cancelBot() {
      const c = ctrl();
      if (!c || !c.bot) return;
      c.bot = null;
      replace(c);
    },
    replay(input) {
      const c = ctrl();
      if (!c || c.playback) return;
      Object.assign(c, { drag: null, bot: null, remote: null, seat: input.seat, placed: { ok: true, x: input.x } });
      shoot(c, input, false);
    },
    showAim(aim) {
      const c = ctrl();
      if (!c || c.playback) return;
      c.remote = aim;
    },
  };
}
