import { useEffect, useRef, type RefObject } from 'react';
import type { BoardState, Seat, ShotEvent, Vec } from '@carrom/engine';
import { inHand, standing, tableOf, type NodiMove, type NodiState, type Team } from '@hub/nodipar';
import type { Aim } from '@/games/carrom/aim';
import type { Playback } from '@/games/carrom/playback';
import type { View } from '@/store/settingsSlice';
import { createPixiRiver } from './pixiRiver';
import type { RiverFactory, RiverRenderer } from './riverRenderer';
import { aimForSeat, bankCoords, clampAlong, moveFrom, moveOf, playbackOf, touchAt } from './riverCtrl';
import { boatSkin, riverSkin, seatColor, type BoatSkin, type RiverSkin } from './skins';

/** A bot's or another player's aim shows this long before the boat moves, ms. */
const PREVIEW_MS = 700;

export interface RiverCallbacks {
  /** The person on this screen released a shot. */
  onMove?: (move: NodiMove) => void;
  /** Physics events of one playback frame (sounds). */
  onEvents?: (events: ShotEvent[], board: BoardState) => void;
  /** T3D-2 the 3D river could not start (the page shows 2D instead). */
  onFail?: () => void;
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
}

const classic = boatSkin(undefined);
const teamColor = (s: NodiState) => (team: Team): number =>
  Number.parseInt(seatColor(team === 'A' ? 0 : s.config.players === 2 ? 2 : 1).slice(1), 16);

/** T3D-2 three.js loads only when a 3D river is first shown. */
const create3d: RiverFactory = (host, onLost) => import('./three/river3d').then((m) => m.createRiver3d(host, onLost));

/**
 * NODI-4 mounts the river in `host`, drawn in 2D (Pixi) or T3D-7 3D (three.js).
 * State lives in a plain object that outlives a 2D ↔ 3D switch; React hears only about moves and events.
 */
export function useRiverCanvas(host: RefObject<HTMLDivElement | null>, callbacks: RiverCallbacks, view: View = '2d'): RefObject<RiverApi> {
  const cb = useRef(callbacks);
  useEffect(() => { cb.current = callbacks; });
  const ctrl = useRef<Ctrl>({
    state: null, view: 0, canMove: false, along: 0, drag: null, preview: null, playback: null, board: null,
    clock: null, skinOf: () => classic, river: riverSkin(undefined),
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
    c.drag = null;
    let alive = true;
    let r: RiverRenderer | null = null;
    const busy = () => c.playback !== null || c.preview !== null;

    const onDown = (e: PointerEvent) => {
      const s = c.state;
      if (!r || !s || !c.canMove || busy() || c.drag || s.winner) return;
      const w = r.world(e, c.view);
      const p = r.screen(e);
      if (!w || !p) return;
      const seat = s.turnSeat;
      const hit = touchAt(s, seat, w, c.along);
      if (!hit) return;
      if (hit.kind === 'bank') {
        c.along = hit.along;
        c.drag = { kind: 'place', pointerId: e.pointerId };
      } else {
        const source: Source = hit.kind === 'boat' ? hit : { kind: 'ready', along: c.along };
        c.drag = { kind: 'aim', pointerId: e.pointerId, source, start: p, aim: { dirX: 0, dirY: 1, power: 0, cancelled: true } };
      }
      r.canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = c.drag;
      const s = c.state;
      if (!r || !d || !s || d.pointerId !== e.pointerId) return;
      if (d.kind === 'place') {
        const w = r.world(e, c.view);
        if (w) c.along = clampAlong(s, bankCoords(s.turnSeat, w).along);
      } else {
        const p = r.screen(e);
        if (p) d.aim = aimForSeat({ x: p.x - d.start.x, y: p.y - d.start.y }, r.layout().boardPx, c.view, s.turnSeat as Seat);
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
      if (!s || !r) return;
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
      const live = c.board ? standing(c.board, s.config) : s;
      const waiting = !busy() && !s.winner;
      const seat = s.turnSeat;
      const showReady = waiting && c.canMove && inHand(s, seat).length > 0;
      const d = c.drag;
      // The aim: this screen's drag, or a preview of someone else's move.
      let aimFrom: Vec | null = null;
      let aim: Aim | null = null;
      let aimSeat = seat;
      if (d?.kind === 'aim' && !d.aim.cancelled) {
        aimFrom = moveFrom(s, seat, moveOf(d.source, d.aim));
        aim = d.aim;
      } else if (c.preview) {
        aimSeat = c.preview.seat;
        aimFrom = moveFrom(s, aimSeat, c.preview.move);
        const t = Math.min(1, c.preview.elapsed / PREVIEW_MS);
        aim = { ...c.preview.move, power: c.preview.move.power * t, cancelled: false };
      }
      r.draw({
        config: s.config, table: tableOf(s.config), owners: live.owners, pars: live.pars, view: c.view, river: c.river,
        teamColor: teamColor(s), board: c.board ?? s.board, skinOf: c.skinOf,
        ready: showReady ? { seat, along: c.along } : null,
        selected: d?.kind === 'aim' && d.source.kind === 'boat' ? `${seat}-${d.source.boat}` : null,
        aimFrom, aim, aimSeat: aimSeat as Seat,
        clock: waiting ? c.clock : null,
        clockAt: showReady ? moveFrom(s, seat, { kind: 'launch', x: c.along, dirX: 0, dirY: 1, power: 0 }) : null,
        deltaMs,
      });
    };

    const make = view === '3d' ? create3d : createPixiRiver;
    make(el, () => cb.current.onFail?.()).then((made) => {
      if (!alive) { made.destroy(); return; }
      r = made;
      r.canvas.addEventListener('pointerdown', onDown);
      r.canvas.addEventListener('pointermove', onMove);
      r.canvas.addEventListener('pointerup', onUp);
      r.canvas.addEventListener('pointercancel', onCancel);
      r.start(tick);
    }).catch(() => {
      if (alive && view === '3d') cb.current.onFail?.();
    });

    return () => {
      alive = false;
      r?.destroy();
      r = null;
    };
  }, [host, view]);

  return api;
}
