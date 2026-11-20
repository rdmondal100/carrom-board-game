import { Container, FillGradient, Graphics } from 'pixi.js';
import {
  config, seatToWorld, type BoardState, type Kind, type Piece, type Seat, type Vec,
} from '@carrom/engine';
import {
  BOARD_COLOURS, GUIDE_ALPHA, GUIDE_MAX_LEN, LINE_WIDTH, PIECE_RING_ALPHA, PIECE_RING_RADIUS,
  PIECE_SHADOW_ALPHA, PIECE_SHADOW_OFFSET, PIECE_SHINE, POCKET_ANIM_MS, PULL_ALPHA, type PieceStyle,
} from '@/constants/view';
import type { Aim } from './aim';
import { worldToPx, worldToScreen } from './view';

// One shared radial gradient per style (COS-6 skins), lit from the top-left (local 0–1 space).
const gradients = new WeakMap<PieceStyle, FillGradient>();
function bodyFill(st: PieceStyle): FillGradient {
  let fill = gradients.get(st);
  if (!fill) {
    fill = new FillGradient({
      type: 'radial',
      center: { x: 0.34, y: 0.3 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: st.hi },
        { offset: 0.45, color: st.base },
        { offset: 0.85, color: st.base },
        { offset: 1, color: st.edge },
      ],
    });
    gradients.set(st, fill);
  }
  return fill;
}

/** Each piece is a body plus a soft shadow kept on a layer below every body. */
interface Sprite { g: Graphics; shadow: Graphics; drawnPx: number; blocked: boolean; style: PieceStyle | null }

export interface PieceLayer {
  container: Container;
  shadows: Container;
  bodies: Container;
  sprites: Map<string, Sprite>;
}

export function createPieceLayer(): PieceLayer {
  const container = new Container();
  const shadows = new Container();
  const bodies = new Container();
  container.addChild(shadows, bodies);
  return { container, shadows, bodies, sprites: new Map() };
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
  /** COS-6 the look of each kind (the striker's is the shooter's skin). */
  styleOf: (kind: Kind) => PieceStyle;
}

function paint(s: Sprite, p: Piece, boardPx: number, blocked: boolean, st: PieceStyle): void {
  const r = worldToPx(p.r, boardPx);
  if (s.drawnPx === boardPx && s.blocked === blocked && s.style === st) return;
  const line = worldToPx(LINE_WIDTH, boardPx);
  s.shadow.clear();
  s.shadow.circle(PIECE_SHADOW_OFFSET.x * r, PIECE_SHADOW_OFFSET.y * r, r)
    .fill({ color: BOARD_COLOURS.shadow, alpha: PIECE_SHADOW_ALPHA });
  s.g.clear();
  s.g.circle(0, 0, r).fill(bodyFill(st)).stroke({ width: line, color: st.edge });
  // Engraved ring: a dark groove with a light lip just inside it.
  s.g.circle(0, 0, r * PIECE_RING_RADIUS)
    .stroke({ width: line, color: st.ring, alpha: PIECE_RING_ALPHA });
  s.g.circle(0, 0, r * PIECE_RING_RADIUS - line)
    .stroke({ width: line * 0.8, color: st.ringLight, alpha: PIECE_RING_ALPHA * 0.6 });
  s.g.circle(PIECE_SHINE.x * r, PIECE_SHINE.y * r, PIECE_SHINE.r * r)
    .fill({ color: 0xffffff, alpha: PIECE_SHINE.alpha });
  if (blocked) s.g.circle(0, 0, r + line * 2).stroke({ width: line * 2, color: BOARD_COLOURS.blocked });
  s.drawnPx = boardPx;
  s.blocked = blocked;
  s.style = st;
}

/** Bring the sprites in line with the state. Cheap enough for every frame. */
export function syncPieces(layer: PieceLayer, view: PieceView): void {
  const seen = new Set<string>();
  view.state.pieces.forEach((p) => {
    seen.add(p.id);
    let s = layer.sprites.get(p.id);
    if (!s) {
      s = { g: new Graphics(), shadow: new Graphics(), drawnPx: 0, blocked: false, style: null };
      layer.sprites.set(p.id, s);
      layer.shadows.addChild(s.shadow);
      layer.bodies.addChild(s.g);
    }
    const isStriker = p.kind === 'striker';
    const spot = isStriker ? view.striker : null;
    paint(s, p, view.boardPx, spot ? !spot.ok : false, view.styleOf(p.kind));

    const world = spot ? spot.pos : p;
    const at = worldToScreen(world, view.viewSeat, view.boardPx);
    s.g.position.set(at.x, at.y);
    s.shadow.position.set(at.x, at.y);

    let scale = 1;
    let visible = true;
    if (p.pocketed && !spot) {
      const since = view.pocketedAt.get(p.id);
      const k = since === undefined ? 1 : (view.nowMs - since) / POCKET_ANIM_MS;
      visible = k < 1;
      scale = Math.max(0, 1 - k);
    }
    s.g.visible = visible;
    s.shadow.visible = visible;
    s.g.scale.set(scale);
    s.shadow.scale.set(scale);
  });
  layer.sprites.forEach((s, id) => {
    if (seen.has(id)) return;
    s.g.destroy();
    s.shadow.destroy();
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
