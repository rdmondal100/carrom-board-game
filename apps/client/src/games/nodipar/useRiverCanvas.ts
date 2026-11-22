import { useEffect, useRef, type RefObject } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import type { BoardState, Seat, ShotEvent, Vec } from '@carrom/engine';
import { inHand, standing, tableOf, type NodiMove, type NodiState, type Team } from '@hub/nodipar';
import type { Aim } from '@/games/carrom/aim';
import type { Playback } from '@/games/carrom/playback';
import { screenToWorld, worldToPx, worldToScreen } from '@/games/carrom/view';
import { drawBoats, drawRiverAim, drawRiverClock, drawScene, drawWhirl, riverLayoutFor, type RiverLayout } from './drawRiver';
import { aimForSeat, bankCoords, clampAlong, moveFrom, moveOf, playbackOf, touchAt } from './riverCtrl';
import { boatSkin, riverSkin, seatColor, type BoatSkin, type RiverSkin } from './skins';

/** A bot's or another player's aim shows this long before the boat moves, ms. */
const PREVIEW_MS = 700;
const WHIRL_SPEED = 0.0015;

export interface RiverCallbacks {
  /** The person on this screen released a shot. */
  onMove?: (move: NodiMove) => void;
  /** Physics events of one playback frame (sounds). */
  onEvents?: (events: ShotEvent[], board: BoardState) => void;
}

export interface RiverApi {
  /** Show this state, seen from `viewSeat` (at the bottom). */
  show(state: NodiState, viewSeat: Seat): void;
  /** May the person on this screen move for the seat on turn? */
  setCanMove(on: boolean): void;
  /** Play a move from the state on screen; `preview` shows its aim first (bots, other players). */
  play(seat: number, move: NodiMove, preview: boolean, onDone: () => void): void;
  setClock(fraction: number | null): void;
  /** NODI-6 the look: each seat's boat skin and the river theme. */
  setLook(skinOf: (seat: number) => BoatSkin, river: RiverSkin): void;
}

type Source = { kind: 'boat'; boat: number } | { kind: 'ready'; along: number };
type Drag = { kind: 'place'; pointerId: number } | { kind: 'aim'; pointerId: number; source: Source; start: Vec; aim: Aim };

interface Ctrl {
  state: NodiState | null;
  view: Seat;
  canMove: boolean;
  along: number;
  drag: Drag | null;
  preview: { seat: number; move: NodiMove; elapsed: number; onDone: () => void } | null;
  playback: { pb: Playback; onDone: () => void } | null;
  /** Board drawn during a playback. */
  board: BoardState | null;
  clock: number | null;
  skinOf: (seat: number) => BoatSkin;
  river: RiverSkin;
  layout: RiverLayout;
}

const classic = boatSkin(undefined);
const teamColor = (s: NodiState) => (team: Team): number =>
  Number.parseInt(seatColor(team === 'A' ? 0 : s.config.players === 2 ? 2 : 1).slice(1), 16);

/** NODI-4 mounts a Pixi river in `host`. State lives in a plain object; React hears only about moves and events. */
export function useRiverCanvas(host: RefObject<HTMLDivElement | null>, callbacks: RiverCallbacks): RefObject<RiverApi> {
  const cb = useRef(callbacks);
  useEffect(() => { cb.current = callbacks; });
  const ctrl = useRef<Ctrl>({
    state: null, view: 0, canMove: false, along: 0, drag: null, preview: null, playback: null, board: null,
    clock: null, skinOf: () => classic, river: riverSkin(undefined), layout: riverLayoutFor(0),
  });

  const api = useRef<RiverApi>({
    show(state, viewSeat) {
      const c = ctrl.current;
      if (c.playback || c.preview) return;
      Object.assign(c, { state, view: viewSeat, board: null, drag: null, along: clampAlong(state, c.along) });
    },
    setCanMove(on) {
      ctrl.current.canMove = on;
      if (!on) ctrl.current.drag = null;
    },
    play(seat, move, preview, onDone) {
      const c = ctrl.current;
      if (!c.state) { onDone(); return; }
      c.drag = null;
      if (preview) c.preview = { seat, move, elapsed: 0, onDone };
      else start(c, seat, move, onDone);
    },
    setClock(fraction) { ctrl.current.clock = fraction; },
    setLook(skinOf, river) { Object.assign(ctrl.current, { skinOf, river }); },
  });

  function start(c: Ctrl, seat: number, move: NodiMove, onDone: () => void): void {
    try {
      c.playback = { pb: playbackOf(c.state!, seat, move), onDone };
    } catch {
      onDone(); // a move the rules refuse can't be shown; the next state will be
    }
  }

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const c = ctrl.current;
    const app = new Application();
    let alive = true;
    let ready = false;
    let observer: ResizeObserver | null = null;
    const scene = new Graphics();
    const whirls = new Container();
    const boats = new Graphics();
    const aimG = new Graphics();
    const clockG = new Graphics();
    const root = new Container();
    root.addChild(scene, whirls, boats, clockG, aimG);
    let whirlKey = '';

    const resize = () => {
      if (!ready) return;
      const size = riverLayoutFor(el.clientWidth);
      if (size.canvasPx !== c.layout.canvasPx) app.renderer.resize(size.canvasPx, size.canvasPx);
      c.layout = size;
      whirlKey = '';
    };
    const world = (e: PointerEvent): Vec => {
      const rect = app.canvas.getBoundingClientRect();
      return screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, c.view, c.layout.boardPx);
    };
    const screen = (e: PointerEvent): Vec => {
      const rect = app.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const busy = () => c.playback !== null || c.preview !== null;

    const onDown = (e: PointerEvent) => {
      const s = c.state;
      if (!s || !c.canMove || busy() || c.drag || s.winner) return;
      const seat = s.turnSeat;
      const hit = touchAt(s, seat, world(e), c.along);
      if (!hit) return;
      if (hit.kind === 'bank') {
        c.along = hit.along;
        c.drag = { kind: 'place', pointerId: e.pointerId };
      } else {
        const source: Source = hit.kind === 'boat' ? hit : { kind: 'ready', along: c.along };
        c.drag = { kind: 'aim', pointerId: e.pointerId, source, start: screen(e), aim: { dirX: 0, dirY: 1, power: 0, cancelled: true } };
      }
      app.canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = c.drag;
      const s = c.state;
      if (!d || !s || d.pointerId !== e.pointerId) return;
      if (d.kind === 'place') {
        c.along = clampAlong(s, bankCoords(s.turnSeat, world(e)).along);
      } else {
        const p = screen(e);
        d.aim = aimForSeat({ x: p.x - d.start.x, y: p.y - d.start.y }, c.layout.boardPx, c.view, s.turnSeat as Seat);
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = c.drag;
      if (!d || d.pointerId !== e.pointerId) return;
      c.drag = null;
      if (d.kind !== 'aim' || d.aim.cancelled || !c.canMove) return;
      cb.current.onMove?.(moveOf(d.source, d.aim));
    };
    const onCancel = (e: PointerEvent) => { if (c.drag?.pointerId === e.pointerId) c.drag = null; };

    const tick = (deltaMs: number) => {
      const s = c.state;
      if (!s) return;
      if (c.preview) {
        c.preview.elapsed += deltaMs;
        if (c.preview.elapsed >= PREVIEW_MS) {
          const { seat, move, onDone } = c.preview;
          c.preview = null;
          start(c, seat, move, onDone);
        }
      }
      if (c.playback) {
        const out = c.playback.pb.advance(deltaMs);
        c.board = out.state;
        if (out.events.length > 0) cb.current.onEvents?.(out.events, out.state);
        if (out.done) {
          const { onDone } = c.playback;
          c.playback = null;
          onDone();
        }
      }
      const table = tableOf(s.config);
      const board = c.board ?? s.board;
      const live = c.board ? standing(c.board, s.config) : s;
      const v = { viewSeat: c.view, boardPx: c.layout.boardPx };
      drawScene(scene, { ...v, config: s.config, table, owners: live.owners, pars: live.pars, river: c.river, teamColor: teamColor(s) });
      const key = `${c.layout.boardPx}:${s.config.players}:${c.view}:${c.river.whirl}`;
      if (key !== whirlKey) {
        whirlKey = key;
        whirls.removeChildren().forEach((w) => w.destroy());
        for (const w of table.pockets) {
          const g = new Graphics();
          drawWhirl(g, worldToPx(table.pocketD / 2, c.layout.boardPx), c.river);
          const at = worldToScreen(w, c.view, c.layout.boardPx);
          g.position.set(at.x, at.y);
          whirls.addChild(g);
        }
      }
      for (const w of whirls.children) w.rotation -= WHIRL_SPEED * deltaMs;

      const waiting = !busy() && !s.winner;
      const seat = s.turnSeat;
      const showReady = waiting && c.canMove && inHand(s, seat).length > 0;
      const d = c.drag;
      const selected = d?.kind === 'aim' && d.source.kind === 'boat' ? `${seat}-${d.source.boat}` : null;
      drawBoats(boats, board, v, c.skinOf, showReady ? { seat, along: c.along } : null, selected);
      // The aim: this screen's drag, or a preview of someone else's move.
      let from: Vec | null = null;
      let aim: Aim | null = null;
      let aimSeat = seat;
      if (d?.kind === 'aim' && !d.aim.cancelled) {
        from = moveFrom(s, seat, moveOf(d.source, d.aim));
        aim = d.aim;
      } else if (c.preview) {
        aimSeat = c.preview.seat;
        from = moveFrom(s, aimSeat, c.preview.move);
        const t = Math.min(1, c.preview.elapsed / PREVIEW_MS);
        aim = { ...c.preview.move, power: c.preview.move.power * t, cancelled: false };
      }
      drawRiverAim(aimG, from, aim, aimSeat as Seat, v);
      drawRiverClock(clockG, waiting ? c.clock : null, showReady ? moveFrom(s, seat, { kind: 'launch', x: c.along, dirX: 0, dirY: 1, power: 0 }) : null, v);
    };

    app.init({
      width: riverLayoutFor(el.clientWidth).canvasPx, height: riverLayoutFor(el.clientWidth).canvasPx,
      resolution: window.devicePixelRatio || 1, autoDensity: true, antialias: true, backgroundAlpha: 0,
    }).then(() => {
      if (!alive) { app.destroy(true, { children: true }); return; }
      ready = true;
      app.canvas.style.touchAction = 'none';
      app.canvas.style.display = 'block';
      el.appendChild(app.canvas);
      app.stage.addChild(root);
      c.layout = riverLayoutFor(0);
      resize();
      app.canvas.addEventListener('pointerdown', onDown);
      app.canvas.addEventListener('pointermove', onMove);
      app.canvas.addEventListener('pointerup', onUp);
      app.canvas.addEventListener('pointercancel', onCancel);
      app.ticker.add((ticker) => tick(ticker.deltaMS));
      observer = new ResizeObserver(resize);
      observer.observe(el);
    });

    return () => {
      alive = false;
      observer?.disconnect();
      if (ready) app.destroy(true, { children: true });
    };
  }, [host]);

  return api;
}

