import { useEffect, useRef, type RefObject } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import {
  baselinePoint, config, createRack, placeStriker, seatForward, seatRight, seatToWorld,
  type BoardState, type Seat, type ShotEvent, type ShotInput, type Vec,
} from '@carrom/engine';
import {
  BASELINE_TOUCH_STRIKERS, CLOCK_COLOURS, CLOCK_LOW_FRACTION, CLOCK_RING_SCALE, CLOCK_RING_WIDTH,
  CLOCK_START_ANGLE, CLOCK_TRACK_ALPHA, FULL_TURN, STRIKER_TOUCH_SCALE,
} from '@/constants/view';
import { aimFromDrag, type Aim } from './aim';
import { drawBoard, layoutFor, type BoardLayout } from './drawBoard';
import { createPieceLayer, drawAim, syncPieces } from './drawPieces';
import { createPlayback, type Playback } from './playback';
import { screenToWorld, worldToPx, worldToScreen } from './view';

export interface BoardCallbacks {
  onShot?: (input: ShotInput) => void;
  /** Events of one playback frame, with the board at the end of that frame (UI-7 sound strength). */
  onEvents?: (events: ShotEvent[], board: BoardState) => void;
  onPlayingChange?: (playing: boolean) => void;
  onPlacedChange?: (ok: boolean) => void;
}

/** `contain`: fit the host's width and height (UI-5 full-height board page); `width`: the host's width only. */
export type BoardFit = 'width' | 'contain';

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
}

type Drag =
  | { kind: 'place'; pointerId: number }
  | { kind: 'aim'; pointerId: number; start: Vec; pull: Vec; aim: Aim };

interface Ctrl {
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
  playback: Playback | null;
  pocketedAt: Map<string, number>;
  layout: BoardLayout;
}

/** aimFromDrag reads the drag from the view seat; turn it into the shooter's own frame. */
function aimFor(c: Ctrl, pull: Vec): Aim {
  const a = aimFromDrag(pull, c.layout.boardPx);
  if (c.view === c.seat || a.cancelled) return a;
  const w = seatToWorld(c.view, a.dirX, a.dirY);
  const r = seatRight(c.seat);
  const f = seatForward(c.seat);
  return { ...a, dirX: w.x * r.x + w.y * r.y, dirY: w.x * f.x + w.y * f.y };
}

/** LOC-5: a ring around the waiting striker that empties as the clock runs. */
function drawClock(g: Graphics, fraction: number | null, at: Vec, view: Seat, boardPx: number): void {
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

function newCtrl(seat: Seat): Ctrl {
  const board = createRack(seat);
  return {
    board, seat, view: seat, locked: false, clock: null, along: 0, placed: placeStriker(board, seat, 0),
    drag: null, playback: null, pocketedAt: new Map(), layout: layoutFor(0),
  };
}

/**
 * Mounts a Pixi board in `host`. Board, aim and playback live in a plain
 * object; React only hears about shots, events and play start/stop.
 */
export function useBoardCanvas(
  host: RefObject<HTMLDivElement | null>, initialSeat: Seat, callbacks: BoardCallbacks, fit: BoardFit = 'width',
): RefObject<BoardApi> {
  const cb = useRef(callbacks);
  useEffect(() => { cb.current = callbacks; });
  const ctrlRef = useRef<Ctrl | null>(null);
  const redrawRef = useRef<() => void>(() => {});

  const replace = (c: Ctrl) => {
    c.placed = placeStriker(c.board, c.seat, c.along);
    cb.current.onPlacedChange?.(c.placed.ok);
  };
  const api = useRef<BoardApi>({
    reset(seat) {
      const c = ctrlRef.current;
      if (!c || c.playback) return;
      const fresh = newCtrl(seat);
      Object.assign(c, { ...fresh, layout: c.layout });
      replace(c);
      redrawRef.current();
    },
    setSeat(seat) {
      const c = ctrlRef.current;
      if (!c || c.playback) return;
      c.seat = seat;
      c.view = seat;
      c.along = 0;
      c.drag = null;
      replace(c);
      redrawRef.current();
    },
    load(board, shooter, viewSeat) {
      const c = ctrlRef.current;
      if (!c || c.playback) return;
      Object.assign(c, { board, seat: shooter, view: viewSeat, along: 0, drag: null });
      replace(c);
      redrawRef.current();
    },
    setLocked(locked) {
      const c = ctrlRef.current;
      if (!c) return;
      c.locked = locked;
      if (locked) c.drag = null;
    },
    setClock(fraction) {
      const c = ctrlRef.current;
      if (c) c.clock = fraction;
    },
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const c = newCtrl(initialSeat);
    ctrlRef.current = c;
    const app = new Application();
    let alive = true;
    let ready = false;
    let observer: ResizeObserver | null = null;

    const root = new Container();
    const boardG = new Graphics();
    const pieces = createPieceLayer();
    const aimG = new Graphics();
    const clockG = new Graphics();
    root.addChild(boardG, clockG, pieces.container, aimG);

    const avail = () => (fit === 'contain' ? Math.min(el.clientWidth, el.clientHeight) : el.clientWidth);
    const redraw = () => {
      if (!ready) return;
      const size = layoutFor(avail());
      if (size.canvasPx !== c.layout.canvasPx) app.renderer.resize(size.canvasPx, size.canvasPx);
      c.layout = size;
      root.position.set(size.framePx, size.framePx);
      drawBoard(boardG, size, c.view);
    };
    redrawRef.current = redraw;

    // Pointer position in board px (origin at the inner board's top-left).
    const local = (e: PointerEvent): Vec => {
      const rect = app.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left - c.layout.framePx, y: e.clientY - rect.top - c.layout.framePx };
    };
    const alongOf = (p: Vec) => {
      const w = screenToWorld(p, c.view, c.layout.boardPx);
      const base = baselinePoint(c.seat, 0);
      const r = seatRight(c.seat);
      const f = seatForward(c.seat);
      const dx = w.x - base.x;
      const dy = w.y - base.y;
      return { along: dx * r.x + dy * r.y, across: dx * f.x + dy * f.y };
    };

    const onDown = (e: PointerEvent) => {
      if (c.playback || c.drag || c.locked) return;
      const p = local(e);
      const spot = worldToScreen(baselinePoint(c.seat, c.placed.x), c.view, c.layout.boardPx);
      const reach = worldToPx(config.STRIKER_D / 2, c.layout.boardPx) * STRIKER_TOUCH_SCALE;
      const dx = p.x - spot.x;
      const dy = p.y - spot.y;
      if (c.placed.ok && dx * dx + dy * dy <= reach * reach) {
        c.drag = { kind: 'aim', pointerId: e.pointerId, start: p, pull: { x: 0, y: 0 }, aim: aimFor(c, { x: 0, y: 0 }) };
      } else {
        const b = alongOf(p);
        const band = BASELINE_TOUCH_STRIKERS * config.STRIKER_D;
        if (Math.abs(b.across) > band || Math.abs(b.along) > config.BASELINE_HALF + band) return;
        c.drag = { kind: 'place', pointerId: e.pointerId };
        c.along = b.along;
        replace(c);
      }
      app.canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = c.drag;
      if (!d || d.pointerId !== e.pointerId) return;
      const p = local(e);
      if (d.kind === 'place') {
        c.along = Math.max(-config.BASELINE_HALF, Math.min(config.BASELINE_HALF, alongOf(p).along));
        replace(c);
      } else {
        d.pull = { x: p.x - d.start.x, y: p.y - d.start.y };
        d.aim = aimFor(c, d.pull);
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = c.drag;
      if (!d || d.pointerId !== e.pointerId) return;
      c.drag = null;
      if (d.kind !== 'aim' || d.aim.cancelled || !c.placed.ok || c.locked) return;
      const input: ShotInput = { seat: c.seat, x: c.placed.x, dirX: d.aim.dirX, dirY: d.aim.dirY, power: d.aim.power };
      c.playback = createPlayback(c.board, input);
      cb.current.onShot?.(input);
      cb.current.onPlayingChange?.(true);
    };
    const onCancel = (e: PointerEvent) => {
      if (c.drag?.pointerId === e.pointerId) c.drag = null;
    };

    const tick = (deltaMs: number) => {
      const now = performance.now();
      if (c.playback) {
        const out = c.playback.advance(deltaMs);
        c.board = out.state;
        out.events.forEach((ev) => { if (ev.type === 'pocket') c.pocketedAt.set(ev.id, now); });
        if (out.events.length > 0) cb.current.onEvents?.(out.events, out.state);
        if (out.done) {
          c.playback = null;
          replace(c);
          cb.current.onPlayingChange?.(false);
        }
      }
      const waiting = !c.playback;
      const spot = baselinePoint(c.seat, c.placed.ok ? c.placed.x : c.along);
      syncPieces(pieces, {
        state: c.board, viewSeat: c.view, boardPx: c.layout.boardPx, nowMs: now,
        pocketedAt: c.pocketedAt, striker: waiting ? { pos: spot, ok: c.placed.ok } : null,
      });
      const d = c.drag;
      drawAim(aimG, spot, d?.kind === 'aim' ? d.aim : null, d?.kind === 'aim' ? d.pull : null,
        c.seat, c.view, c.layout.boardPx);
      drawClock(clockG, waiting && !c.locked ? c.clock : null, spot, c.view, c.layout.boardPx);
    };

    app.init({
      width: layoutFor(el.clientWidth).canvasPx,
      height: layoutFor(el.clientWidth).canvasPx,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      backgroundAlpha: 0,
    }).then(() => {
      if (!alive) { app.destroy(true, { children: true }); return; }
      ready = true;
      app.canvas.style.touchAction = 'none';
      app.canvas.style.display = 'block';
      el.appendChild(app.canvas);
      app.stage.addChild(root);
      c.layout = layoutFor(0);
      redraw();
      replace(c);
      app.canvas.addEventListener('pointerdown', onDown);
      app.canvas.addEventListener('pointermove', onMove);
      app.canvas.addEventListener('pointerup', onUp);
      app.canvas.addEventListener('pointercancel', onCancel);
      app.ticker.add((ticker) => tick(ticker.deltaMS));
      observer = new ResizeObserver(redraw);
      observer.observe(el);
    });

    return () => {
      alive = false;
      observer?.disconnect();
      redrawRef.current = () => {};
      ctrlRef.current = null;
      if (ready) app.destroy(true, { children: true });
    };
  }, [host, initialSeat, fit]);

  return api;
}
