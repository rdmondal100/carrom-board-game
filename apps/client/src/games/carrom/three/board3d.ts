import { CircleGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Vector3 } from 'three';
import { config, seatToWorld, type Seat } from '@carrom/engine';
import { CLOCK_COLOURS, CLOCK_LOW_FRACTION, CLOCK_RING_SCALE, CLOCK_RING_WIDTH, GUIDE_MAX_LEN, POCKET_ANIM_MS } from '@/constants/view';
import { boardFinish, boardPalette, pieceFinish, DEFAULT_SKINS, type BoardSkins } from '@/games/carrom/skins';
import { boxCorners, fitCamera, viewDir } from '@/game3d/three/camera';
import { addRoom } from '@/game3d/three/room';
import { createStage, disposeTree } from '@/game3d/three/stage';
import { store } from '@/store/store';
import type { BoardRenderer, RendererFactory } from '../boardRenderer';
import { planeToPx, pxToPlane, toPlane } from '../boardPlane';
import { layoutFor } from '../drawBoard';
import { BASE, boardMesh, CUP, FRAME, FRAME_H } from './boardMesh';
import { disposePieceMaterials, makePiece, type Piece3d } from './pieces3d';

const H = config.HALF_L;
const TILT_DEG = 54;
/** The aim lines float just above a striker's top (fraction of its diameter). */
const AIM_Y = 0.22;

/** T3D-4 the carrom board in WebGL 3D. Same contract as the Pixi board. */
export const createBoard3d: RendererFactory = async (host, fit, onResize, onLost) => {
  const size = () => (fit === 'contain' ? Math.min(host.clientWidth, host.clientHeight) : host.clientWidth);
  const stage = createStage(host, { quality: store.getState().settings.quality, fov: 32, fit: () => ({ w: size(), h: Math.round(size() * 0.86) }), onLost });
  stage.fitLights(H + FRAME);
  let layout = layoutFor(size());
  const target = new Vector3(0, 0, 0.03);
  stage.onResize(() => {
    layout = layoutFor(size());
    fitCamera(stage.camera, target, viewDir(TILT_DEG), boxCorners(H + FRAME, (FRAME_H + BASE) / 2, H + FRAME, (FRAME_H - BASE) / 2), 0.97);
    onResize();
  });
  // The board lies on a wooden floor under the lamp.
  addRoom(stage, H + FRAME, -BASE, target);

  const boardGroup = new Group();
  stage.scene.add(boardGroup);
  let boardKey = '';
  const buildBoard = (skins: BoardSkins) => {
    if (skins.board === boardKey) return;
    boardKey = skins.board;
    disposeTree(boardGroup);
    boardGroup.clear();
    boardGroup.add(boardMesh(boardPalette(skins.board), boardFinish(skins.board)));
  };

  // Pieces, the aim guide and the clock ring.
  const pieces = new Map<string, Piece3d>();
  const guideMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  const pullMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const guide = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), guideMat);
  const pull = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), pullMat);
  const tip = new Mesh(new CircleGeometry(config.COIN_D / 4, 24).rotateX(-Math.PI / 2), guideMat);
  const clockMat = new MeshBasicMaterial({ color: CLOCK_COLOURS.ok, transparent: true, depthWrite: false });
  const clock = new Mesh(new RingGeometry(1, 1.1, 48), clockMat);
  clock.rotation.x = -Math.PI / 2;
  const warnR = config.STRIKER_D / 2;
  const warn = new Mesh(new RingGeometry(warnR * 1.02, warnR * 1.22, 40).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.9, depthWrite: false }));
  warn.visible = false;
  stage.scene.add(guide, pull, tip, clock, warn);
  let clockShown = -1;

  /** A flat strip on the board from a to b (plane coordinates). */
  const strip = (m: Mesh, a: { x: number; z: number }, b: { x: number; z: number }, width: number, y: number) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    m.visible = len > 1e-6;
    m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
    m.scale.set(width, 1, len);
    m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  };

  let skins: BoardSkins = DEFAULT_SKINS;
  const r: BoardRenderer = {
    canvas: stage.canvas,
    layout: () => layout,
    local(e) {
      const hit = stage.ground(e, 0);
      return hit ? planeToPx(hit.x, hit.z, layout.boardPx) : null;
    },
    redraw(_v: Seat, s) {
      skins = s;
      buildBoard(s);
      stage.invalidate();
    },
    draw(d) {
      if (d.skins !== skins) r.redraw(d.view, d.skins);
      const seen = new Set<string>();
      for (const p of d.board.pieces) {
        seen.add(p.id);
        const striker = p.kind === 'striker';
        const spot = striker ? d.striker : null;
        const finish = pieceFinish(striker ? d.skins.strikers[d.seat] : d.skins.coins, striker ? 'striker' : 'coins');
        let piece = pieces.get(p.id);
        if (!piece) {
          piece = makePiece(p.r, d.styleOf(p.kind), finish, striker);
          pieces.set(p.id, piece);
          stage.scene.add(piece.group);
        }
        piece.restyle(d.styleOf(p.kind), finish);
        const at = toPlane(spot ? spot.pos : p, d.view);
        let sink = 0;
        let visible = true;
        if (p.pocketed && !spot) {
          const since = d.pocketedAt.get(p.id);
          const k = since === undefined ? 1 : (d.nowMs - since) / POCKET_ANIM_MS;
          visible = k < 1;
          sink = Math.min(1, k);
        }
        // A pocketed coin falls into the cup under the hole (speeding up as it drops).
        piece.group.visible = visible;
        piece.group.position.set(at.x, -sink * sink * CUP * 0.85, at.z);
        // A striker that can't go here gets a red ring round it.
        if (striker) {
          warn.visible = spot !== null && !spot.ok;
          warn.position.set(at.x, 0.001, at.z);
        }
      }
      for (const [id, piece] of pieces) if (!seen.has(id)) { stage.scene.remove(piece.group); pieces.delete(id); }

      const from = toPlane(d.spot, d.view);
      const lift = config.STRIKER_D * AIM_Y;
      if (d.aim && d.pull) {
        const end = pxToPlane({ x: planeToPx(from.x, from.z, layout.boardPx).x + d.pull.x, y: planeToPx(from.x, from.z, layout.boardPx).y + d.pull.y }, layout.boardPx);
        strip(pull, from, end, config.L * 0.006, lift);
      } else pull.visible = false;
      if (d.aim && !d.aim.cancelled) {
        const dir = seatToWorld(d.seat, d.aim.dirX, d.aim.dirY);
        const len = GUIDE_MAX_LEN * d.aim.power;
        const to = toPlane({ x: d.spot.x + dir.x * len, y: d.spot.y + dir.y * len }, d.view);
        strip(guide, from, to, config.L * 0.006, lift + 0.0005);
        tip.visible = true;
        tip.position.set(to.x, lift + 0.0006, to.z);
      } else { guide.visible = false; tip.visible = false; }
      clock.visible = d.clock !== null;
      if (d.clock !== null) {
        const left = Math.max(0, Math.min(1, d.clock));
        if (Math.abs(left - clockShown) > 0.004) {
          clockShown = left;
          const rr = (config.STRIKER_D / 2) * CLOCK_RING_SCALE;
          clock.geometry.dispose();
          clock.geometry = new RingGeometry(rr, rr + CLOCK_RING_WIDTH, 48, 1, Math.PI / 2, Math.PI * 2 * Math.max(0.001, left));
          clockMat.color.set(left < CLOCK_LOW_FRACTION ? CLOCK_COLOURS.low : CLOCK_COLOURS.ok);
        }
        clock.position.set(from.x, 0.0015, from.z);
      }
      stage.invalidate();
    },
    start(tick) { stage.onFrame((dt) => { tick(dt); }); },
    destroy() {
      disposePieceMaterials();
      stage.dispose();
    },
  };
  return r;
};
