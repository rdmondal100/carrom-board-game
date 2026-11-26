import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, RingGeometry, Vector3 } from 'three';
import { LUDO, LUDO_ANIM } from '@hub/ludo';
import { pointOf, rotationFor, stackOffset, GRID } from '@/games/ludo/geometry';
import { seatColor, tokenColor, type BoardSkin, type TokenSkin } from '@/games/ludo/skins';
import { boxCorners, fitCamera, viewDir } from '@/game3d/three/camera';
import { finishMaterial } from '@/game3d/three/materials';
import { addRoom } from '@/game3d/three/room';
import { createStage, type Stage } from '@/game3d/three/stage';
import type { Quality } from '@/store/settingsSlice';
import { ART_CELLS, boardArt } from './boardArt';
import { pawnGeometry } from './pawns';

/** Slab thickness and the camera's angle above the table. */
const SLAB = 0.7;
const TILT_DEG = 54;
/** A hop lifts this high (cells); a token sent home flies higher. */
const HOP_H = 0.55;
const FLY_H = 2.4;
/** A legal token is picked by a tap within this many cells. */
const PICK_R = 0.75;
/** Pawns are drawn this much bigger than a cell-sized pawn, so they read well on a phone. */
const PAWN = 1.25;

export interface LudoFrame {
  seats: readonly number[];
  tokens: readonly (readonly number[])[];
  board: BoardSkin;
  tokenSkinOf: (seat: number) => TokenSkin;
  viewSeat: number;
  turnSeat: number | null;
  legal: readonly number[];
}

interface Piece {
  mesh: Mesh;
  skin: TokenSkin | null;
  from: Vector3;
  to: Vector3;
  t0: number;
  ms: number;
  arc: number;
  key: string;
}

/** T3D-5 a live Ludo table: call `update` with each frame's data; taps on legal tokens call `onPick`. */
export interface LudoScene { update(f: LudoFrame): void; dispose(): void }

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

export function createLudoScene(host: HTMLElement, quality: Quality, onPick: (token: number) => void, onLost: () => void): LudoScene {
  const stage: Stage = createStage(host, { quality, fov: 34, onLost, fit: (el) => ({ w: el.clientWidth, h: Math.round(el.clientWidth * 0.84) }) });
  const half = ART_CELLS / 2;
  const centre = GRID / 2;
  stage.fitLights(half);
  const table = new Group();
  stage.scene.add(table);

  const target = new Vector3(0, 0, 0.3);
  stage.onResize(() => {
    fitCamera(stage.camera, target, viewDir(TILT_DEG), boxCorners(half, SLAB / 2, half, -SLAB / 2), 0.96);
  });
  // The board lies on a wooden floor under the lamp.
  addRoom(stage, half, -SLAB, target);

  // The slab: sides in the board's finish, top painted with the board art.
  const top = new MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  let slab: Mesh | null = null;
  let artKey = '';
  const setBoard = (f: LudoFrame) => {
    const key = `${f.board.bg}|${f.board.finish}|${f.seats.join()}`;
    if (key === artKey) return;
    artKey = key;
    top.map?.dispose();
    top.map = boardArt(f.seats, f.board, f.tokenSkinOf(f.seats[0] ?? 0), () => stage.invalidate());
    Object.assign(top, f.board.finish === 'marble' ? { roughness: 0.15, clearcoat: 1 } : f.board.finish === 'gloss' ? { roughness: 0.25, clearcoat: 0.9 } : { roughness: 0.5, clearcoat: 0.45 });
    top.needsUpdate = true;
    if (slab) { table.remove(slab); (slab.material as MeshPhysicalMaterial[])[0]!.dispose(); slab.geometry.dispose(); }
    const side = finishMaterial(f.board.rim, f.board.finish);
    slab = new Mesh(new BoxGeometry(ART_CELLS, SLAB, ART_CELLS), [side, side, top, side, side, side]);
    slab.position.y = -SLAB / 2;
    slab.receiveShadow = true;
    slab.castShadow = true;
    table.add(slab);
  };

  // A glowing ring under each legal token.
  const glowGeo = new RingGeometry(0.38, 0.5, 32).rotateX(-Math.PI / 2);
  const glows = new Map<string, Mesh>();
  const pieces = new Map<string, Piece>();
  const mats = new Map<string, MeshPhysicalMaterial>();
  const materialOf = (skin: TokenSkin, seat: number) => {
    const k = `${tokenColor(skin, seat)}|${skin.finish}`;
    let m = mats.get(k);
    if (!m) { m = finishMaterial(tokenColor(skin, seat), skin.finish); mats.set(k, m); }
    return m;
  };
  let frame: LudoFrame | null = null;

  const update = (f: LudoFrame) => {
    frame = f;
    setBoard(f);
    table.rotation.y = (-rotationFor(f.viewSeat) * Math.PI) / 180;
    const now = performance.now();
    const at = new Map<string, number>();
    const placed = f.seats.flatMap((seat) => (f.tokens[seat] ?? []).map((p, token) => ({ seat, token, p, pt: pointOf(seat, token, p) })));
    const cellKey = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
    for (const q of placed) at.set(cellKey(q.pt.x, q.pt.y), (at.get(cellKey(q.pt.x, q.pt.y)) ?? 0) + 1);
    const seen = new Map<string, number>();
    const live = new Set<string>();
    for (const { seat, token, p, pt } of placed) {
      const id = `${seat}-${token}`;
      live.add(id);
      const ck = cellKey(pt.x, pt.y);
      const i = seen.get(ck) ?? 0;
      seen.set(ck, i + 1);
      const off = stackOffset(i, at.get(ck) ?? 1);
      const target = new Vector3(pt.x + off.x - centre, 0, pt.y + off.y - centre);
      const skin = f.tokenSkinOf(seat);
      let piece = pieces.get(id);
      if (!piece) {
        const mesh = new Mesh(pawnGeometry(skin.shape), materialOf(skin, seat));
        mesh.castShadow = true;
        mesh.position.copy(target);
        table.add(mesh);
        piece = { mesh, skin, from: target.clone(), to: target.clone(), t0: 0, ms: 0, arc: 0, key: `${p}` };
        pieces.set(id, piece);
      }
      if (piece.skin !== skin) {
        piece.mesh.geometry = pawnGeometry(skin.shape);
        piece.mesh.material = materialOf(skin, seat);
        piece.skin = skin;
      }
      if (!piece.to.equals(target)) {
        const back = p === LUDO.YARD && piece.key !== `${p}`;
        Object.assign(piece, {
          from: piece.mesh.position.clone(), to: target, t0: now,
          ms: back ? LUDO_ANIM.CAPTURE_MS : LUDO_ANIM.HOP_MS * 0.95, arc: back ? FLY_H : piece.key === `${p}` ? 0 : HOP_H,
        });
      }
      piece.key = `${p}`;
      const legal = seat === f.turnSeat && f.legal.includes(token);
      let glow = glows.get(id);
      if (legal && !glow) {
        glow = new Mesh(glowGeo, new MeshBasicMaterial({ color: seatColor(seat), transparent: true, opacity: 0.8, depthWrite: false }));
        glows.set(id, glow);
        table.add(glow);
      } else if (!legal && glow) {
        table.remove(glow);
        (glow.material as MeshBasicMaterial).dispose();
        glows.delete(id);
      }
    }
    for (const [id, piece] of pieces) if (!live.has(id)) { table.remove(piece.mesh); pieces.delete(id); }
    stage.invalidate();
  };

  stage.onFrame((_dt, now) => {
    let moving = glows.size > 0;
    for (const [id, p] of pieces) {
      const k = p.ms > 0 ? Math.min(1, (now - p.t0) / p.ms) : 1;
      if (k < 1) moving = true;
      const e = ease(k);
      p.mesh.position.lerpVectors(p.from, p.to, e);
      p.mesh.position.y = p.arc * 4 * k * (1 - k);
      // Squash a little as it lands, spin when flying home.
      const land = k > 0.8 && k < 1 && p.arc > 0 ? Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.14 : 0;
      p.mesh.scale.set(PAWN * (1 + land * 0.6), PAWN * (1 - land), PAWN * (1 + land * 0.6));
      p.mesh.rotation.y = p.arc === FLY_H ? k * Math.PI * 2 : 0;
      const glow = glows.get(id);
      if (glow) {
        const pulse = 1 + Math.sin(now / 180) * 0.12;
        glow.position.set(p.mesh.position.x, 0.02, p.mesh.position.z);
        glow.scale.setScalar(pulse);
        p.mesh.position.y += (Math.sin(now / 160) + 1) * 0.06;
      }
    }
    return moving;
  });

  // A tap near a legal token of the player on turn picks it.
  const down = (e: PointerEvent) => {
    const f = frame;
    if (!f || f.turnSeat === null || f.legal.length === 0) return;
    const hit = stage.ground(e, 0);
    if (!hit) return;
    const local = table.worldToLocal(hit.clone());
    let best: { token: number; d: number } | null = null;
    for (const token of f.legal) {
      const p = pieces.get(`${f.turnSeat}-${token}`);
      if (!p) continue;
      const d = Math.hypot(p.to.x - local.x, p.to.z - local.z);
      if (d <= PICK_R && (!best || d < best.d)) best = { token, d };
    }
    if (best) onPick(best.token);
  };
  stage.canvas.addEventListener('pointerdown', down);

  return {
    update,
    dispose() {
      stage.canvas.removeEventListener('pointerdown', down);
      glowGeo.dispose();
      mats.forEach((m) => m.dispose());
      stage.dispose();
    },
  };
}
