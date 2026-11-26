import { Container, FillGradient, Graphics } from 'pixi.js';
import type { BoardState, Kind, Piece, Seat, Vec } from '@carrom/engine';
import {
  BOARD_COLOURS, LINE_WIDTH, PIECE_BEVEL, PIECE_GROOVES, PIECE_RING_ALPHA, PIECE_SHADOW_ALPHA, PIECE_SHADOW_OFFSET,
  PIECE_SHINE, POCKET_ANIM_MS, STRIKER_STAR_INNER, STRIKER_STAR_POINTS, type PieceStyle,
} from '@/constants/view';
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

/** A thin ring drawn as two strokes: a dark groove and the light lip just inside it. */
function groove(g: Graphics, r: number, line: number, st: PieceStyle): void {
  g.circle(0, 0, r).stroke({ width: line, color: st.ring, alpha: PIECE_RING_ALPHA });
  g.circle(0, 0, r - line * 0.9).stroke({ width: line * 0.7, color: st.ringLight, alpha: PIECE_RING_ALPHA * 0.55 });
}

/** The striker's printed star, points on the unit circle scaled to `r`. */
function star(g: Graphics, r: number, st: PieceStyle): void {
  const pts: number[] = [];
  for (let i = 0; i < STRIKER_STAR_POINTS * 2; i++) {
    const a = (i * Math.PI) / STRIKER_STAR_POINTS - Math.PI / 2;
    const k = i % 2 === 0 ? r : r * STRIKER_STAR_INNER;
    pts.push(Math.cos(a) * k, Math.sin(a) * k);
  }
  g.poly(pts).fill({ color: st.ring, alpha: 0.85 }).stroke({ width: r * 0.05, color: st.ringLight, alpha: 0.6 });
  g.circle(0, 0, r * 0.28).fill({ color: st.ringLight, alpha: 0.9 });
}

/**
 * A turned wooden coin (or the acrylic striker) seen from above: a soft contact
 * shadow, a bevelled rim catching the light, carved rings (coins) or a printed
 * star (striker), and the lacquer's highlight.
 */
function paint(s: Sprite, p: Piece, boardPx: number, blocked: boolean, st: PieceStyle): void {
  const r = worldToPx(p.r, boardPx);
  if (s.drawnPx === boardPx && s.blocked === blocked && s.style === st) return;
  const line = Math.max(0.6, worldToPx(LINE_WIDTH, boardPx) * 0.8);
  const ox = PIECE_SHADOW_OFFSET.x * r;
  const oy = PIECE_SHADOW_OFFSET.y * r;
  s.shadow.clear();
  // Penumbra then umbra, so the shadow has a soft edge without a blur filter.
  s.shadow.circle(ox * 1.3, oy * 1.3, r * 1.08).fill({ color: BOARD_COLOURS.shadow, alpha: PIECE_SHADOW_ALPHA * 0.45 });
  s.shadow.circle(ox, oy, r * 0.98).fill({ color: BOARD_COLOURS.shadow, alpha: PIECE_SHADOW_ALPHA });
  s.g.clear();
  s.g.circle(0, 0, r).fill(bodyFill(st)).stroke({ width: line, color: st.edge });
  // Bevel: lit on the top-left of the rim, in shade on the bottom-right.
  const bevel = r * PIECE_BEVEL;
  s.g.arc(0, 0, r - bevel / 2, Math.PI * 0.95, Math.PI * 1.75).stroke({ width: bevel, color: 0xffffff, alpha: 0.22 });
  s.g.arc(0, 0, r - bevel / 2, -Math.PI * 0.05, Math.PI * 0.75).stroke({ width: bevel, color: st.edge, alpha: 0.35 });
  if (p.kind === 'striker') {
    groove(s.g, r * 0.84, line, st);
    star(s.g, r * 0.58, st);
  } else {
    PIECE_GROOVES.forEach((k) => groove(s.g, r * k, line, st));
    s.g.circle(0, 0, r * 0.1).fill({ color: st.ring, alpha: PIECE_RING_ALPHA * 0.8 });
  }
  s.g.ellipse(PIECE_SHINE.x * r, PIECE_SHINE.y * r, PIECE_SHINE.r * r * 1.5, PIECE_SHINE.r * r * 0.8)
    .fill({ color: 0xffffff, alpha: PIECE_SHINE.alpha });
  if (blocked) s.g.circle(0, 0, r + line * 2).stroke({ width: line * 2.5, color: BOARD_COLOURS.blocked });
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
