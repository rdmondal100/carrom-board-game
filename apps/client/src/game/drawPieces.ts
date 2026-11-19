import { Container, Graphics } from 'pixi.js';
import {
  config, seatToWorld, type BoardState, type Kind, type Piece, type Seat, type Vec,
} from '@carrom/engine';
import {
  BOARD_COLOURS, GUIDE_ALPHA, GUIDE_MAX_LEN, LINE_WIDTH, POCKET_ANIM_MS, PULL_ALPHA,
} from '@/constants/view';
import type { Aim } from './aim';
import { worldToPx, worldToScreen } from './view';

const FILL: Record<Kind, number> = {
  white: BOARD_COLOURS.white,
  black: BOARD_COLOURS.black,
  red: BOARD_COLOURS.red,
  striker: BOARD_COLOURS.striker,
};
const EDGE: Record<Kind, number> = {
  white: BOARD_COLOURS.whiteEdge,
  black: BOARD_COLOURS.blackEdge,
  red: BOARD_COLOURS.redEdge,
  striker: BOARD_COLOURS.strikerEdge,
};

interface Sprite { g: Graphics; drawnPx: number; blocked: boolean }

export interface PieceLayer {
  container: Container;
  sprites: Map<string, Sprite>;
}

export function createPieceLayer(): PieceLayer {
  return { container: new Container(), sprites: new Map() };
}

/** Where the striker is drawn while it waits on the baseline. */
export interface StrikerSpot { pos: Vec; ok: boolean }

export interface PieceView {
  state: BoardState;
  viewSeat: Seat;
  boardPx: number;
  nowMs: number;
  /** Piece id → time its pocket drop was seen (performance.now). */
  pocketedAt: ReadonlyMap<string, number>;
  /** Set while placing/aiming: overrides the striker's board position. */
  striker: StrikerSpot | null;
}

function paint(s: Sprite, p: Piece, boardPx: number, blocked: boolean): void {
  const r = worldToPx(p.r, boardPx);
  if (s.drawnPx === boardPx && s.blocked === blocked) return;
  const line = worldToPx(LINE_WIDTH, boardPx);
  s.g.clear();
  s.g.circle(0, 0, r).fill(FILL[p.kind]).stroke({ width: line, color: EDGE[p.kind] });
  s.g.circle(0, 0, r * 0.55).stroke({ width: line, color: EDGE[p.kind], alpha: 0.6 });
  if (blocked) s.g.circle(0, 0, r + line * 2).stroke({ width: line * 2, color: BOARD_COLOURS.blocked });
  s.drawnPx = boardPx;
  s.blocked = blocked;
}

/** Bring the sprites in line with the state. Cheap enough for every frame. */
export function syncPieces(layer: PieceLayer, view: PieceView): void {
  const seen = new Set<string>();
  view.state.pieces.forEach((p) => {
    seen.add(p.id);
    let s = layer.sprites.get(p.id);
    if (!s) {
      s = { g: new Graphics(), drawnPx: 0, blocked: false };
      layer.sprites.set(p.id, s);
      layer.container.addChild(s.g);
    }
    const isStriker = p.kind === 'striker';
    const spot = isStriker ? view.striker : null;
    paint(s, p, view.boardPx, spot ? !spot.ok : false);

    const world = spot ? spot.pos : p;
    const at = worldToScreen(world, view.viewSeat, view.boardPx);
    s.g.position.set(at.x, at.y);

    let scale = 1;
    let visible = true;
    if (p.pocketed && !spot) {
      const since = view.pocketedAt.get(p.id);
      const k = since === undefined ? 1 : (view.nowMs - since) / POCKET_ANIM_MS;
      visible = k < 1;
      scale = Math.max(0, 1 - k);
    }
    s.g.visible = visible;
    s.g.scale.set(scale);
  });
  layer.sprites.forEach((s, id) => {
    if (seen.has(id)) return;
    s.g.destroy();
    layer.sprites.delete(id);
  });
}

/** Draw the aim: a faint pull line to the finger and a guide line ∝ power. */
export function drawAim(
  g: Graphics, from: Vec, aim: Aim | null, pullPx: Vec | null, seat: Seat, viewSeat: Seat, boardPx: number,
): void {
  g.clear();
  if (!aim || !pullPx) return;
  const s = worldToScreen(from, viewSeat, boardPx);
  const line = worldToPx(LINE_WIDTH, boardPx);
  g.moveTo(s.x, s.y).lineTo(s.x + pullPx.x, s.y + pullPx.y)
    .stroke({ width: line * 2, color: BOARD_COLOURS.pull, alpha: PULL_ALPHA });
  if (aim.cancelled) return;
  const dir = seatToWorld(seat, aim.dirX, aim.dirY);
  const len = GUIDE_MAX_LEN * aim.power;
  const end = worldToScreen({ x: from.x + dir.x * len, y: from.y + dir.y * len }, viewSeat, boardPx);
  g.moveTo(s.x, s.y).lineTo(end.x, end.y)
    .stroke({ width: line * 2, color: BOARD_COLOURS.guide, alpha: GUIDE_ALPHA });
  g.circle(end.x, end.y, worldToPx(config.COIN_D / 4, boardPx))
    .fill({ color: BOARD_COLOURS.guide, alpha: GUIDE_ALPHA });
}
