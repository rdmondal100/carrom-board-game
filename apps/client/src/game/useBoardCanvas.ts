import { useEffect, useRef, type RefObject } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import {
  baselinePoint, config, placeStriker, seatForward, seatRight,
  type BoardState, type Seat, type ShotEvent, type ShotInput, type Vec,
} from '@carrom/engine';
import { BASELINE_TOUCH_STRIKERS, STRIKER_TOUCH_SCALE } from '@/constants/view';
import { createBoardApi, type BoardApi, type RemoteAim } from './boardApi';
import { aimFor, botPreviewAt, drawClock, newCtrl, pullFor, type Ctrl } from './boardCtrl';
import { drawBoard, layoutFor } from './drawBoard';
import { createPieceLayer, drawAim, syncPieces } from './drawPieces';
import { createPlayback } from './playback';
import { screenToWorld, worldToPx, worldToScreen } from './view';

export interface BoardCallbacks {
  onShot?: (input: ShotInput) => void;
  /** Events of one playback frame, with the board at the end of that frame (UI-7 sound strength). */
  onEvents?: (events: ShotEvent[], board: BoardState) => void;
  onPlayingChange?: (playing: boolean) => void;
  onPlacedChange?: (ok: boolean) => void;
  /** ROOM-6: the aim while this screen's player drags (striker spot + aim). */
  onAim?: (aim: RemoteAim) => void;
}

/** `contain`: fit the host's width and height (UI-5 full-height board page); `width`: the host's width only. */
export type BoardFit = 'width' | 'contain';
export type { BoardApi, RemoteAim };

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
  /** Start playing a shot from the current board (a release, a bot preview's end, or a replay). */
  const shoot = (c: Ctrl, input: ShotInput, own: boolean) => {
    c.playback = createPlayback(c.board, input);
    if (own) cb.current.onShot?.(input);
    cb.current.onPlayingChange?.(true);
  };
  // The API object is stable; its methods reach the board once it is mounted (until then there is none).
  const api = useRef<BoardApi>(createBoardApi({ ctrl: () => null, redraw: () => {}, replace: () => {}, shoot: () => {} }));
  useEffect(() => {
    Object.assign(api.current, createBoardApi({
      ctrl: () => ctrlRef.current, redraw: () => redrawRef.current(), replace, shoot,
    }));
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
      if (c.playback || c.drag || c.locked || c.bot) return;
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
        if (!d.aim.cancelled) cb.current.onAim?.({ x: c.placed.x, dirX: d.aim.dirX, dirY: d.aim.dirY, power: d.aim.power });
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = c.drag;
      if (!d || d.pointerId !== e.pointerId) return;
      c.drag = null;
      if (d.kind !== 'aim' || d.aim.cancelled || !c.placed.ok || c.locked) return;
      shoot(c, { seat: c.seat, x: c.placed.x, dirX: d.aim.dirX, dirY: d.aim.dirY, power: d.aim.power }, true);
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
      // BOT-6: the bot's striker slides into place, its aim grows, then it shoots.
      const preview = c.bot ? botPreviewAt(c.bot) : null;
      if (c.bot && preview) {
        c.bot.elapsed += deltaMs;
        if (preview.done) {
          const { input } = c.bot;
          c.bot = null;
          c.placed = { ok: true, x: input.x };
          shoot(c, input, true);
        }
      }
      const waiting = !c.playback;
      const remote = waiting && !c.drag && !c.bot ? c.remote : null;
      const along = preview && c.bot ? preview.along : remote ? remote.x : c.placed.ok ? c.placed.x : c.along;
      const spot = baselinePoint(c.seat, along);
      syncPieces(pieces, {
        state: c.board, viewSeat: c.view, boardPx: c.layout.boardPx, nowMs: now,
        pocketedAt: c.pocketedAt, striker: waiting ? { pos: spot, ok: c.placed.ok || c.bot !== null } : null,
      });
      const d = c.drag;
      // A bot's preview or ROOM-6 another player's aim is drawn like a drag.
      const shown = c.bot ? preview?.aim ?? null : remote ? { ...remote, cancelled: false } : null;
      const aim = d?.kind === 'aim' ? d.aim : shown;
      const pull = d?.kind === 'aim' ? d.pull : shown ? pullFor(shown, c.seat, c.view, c.layout.boardPx, spot) : null;
      drawAim(aimG, spot, aim, pull, c.seat, c.view, c.layout.boardPx);
      drawClock(clockG, waiting && !c.locked && !c.bot ? c.clock : null, spot, c.view, c.layout.boardPx);
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
