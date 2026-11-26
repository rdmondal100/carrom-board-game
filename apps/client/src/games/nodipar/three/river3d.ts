import {
  BoxGeometry, CircleGeometry, Color, CylinderGeometry, DodecahedronGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  PlaneGeometry, RingGeometry, Vector3,
} from 'three';
import { config, NODI, seatToWorld, type Seat } from '@carrom/engine';
import { boatOf, launchPoint, layoutOf } from '@hub/nodipar';
import { planeToPx, toPlane } from '@/games/carrom/boardPlane';
import { screenToWorld } from '@/games/carrom/view';
import { boxCorners, fitCamera, viewDir } from '@/game3d/three/camera';
import { finishMaterial } from '@/game3d/three/materials';
import { addRoom } from '@/game3d/three/room';
import { createStage, disposeTree } from '@/game3d/three/stage';
import { canvasTexture, css, rng } from '@/game3d/three/textures';
import { store } from '@/store/store';
import { riverLayoutFor } from '../drawRiver';
import type { RiverDraw, RiverFactory, RiverRenderer } from '../riverRenderer';
import { disposeBoatMaterials, HULL_H, makeBoat } from './boats3d';

const H = config.HALF_L;
const BANK_W = 0.05;
const BANK_H = 0.025;
/** The board's thickness under the water. */
const RIVER_BASE = 0.03;
const ISLE_H = 0.012;
const AIM_LEN = 0.35;
const AIM_W = 0.006;
const TILT_DEG = 58;
const WHIRL_SPEED = 0.0015;

/** Soft light streaks on clear background; two layers drift across the water. */
const ripples = () => canvasTexture(512, (ctx, s) => {
  const r = rng(29);
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 70; i++) {
    const x = r() * s;
    const y = r() * s;
    const w = 20 + r() * 60;
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 4 - r() * 6, x + w, y);
    ctx.stroke();
  }
}, true);

/** T3D-7 the Nodi Par river in WebGL 3D. Same contract as the Pixi river. */
export const createRiver3d: RiverFactory = async (host, onLost) => {
  const size = () => host.clientWidth;
  const stage = createStage(host, { quality: store.getState().settings.quality, fov: 34, onLost, fit: () => ({ w: size(), h: Math.round(size() * 0.86) }) });
  stage.fitLights(H);
  let layout = riverLayoutFor(size());
  const target = new Vector3(0, 0, 0.02);
  stage.onResize(() => {
    layout = riverLayoutFor(size());
    fitCamera(stage.camera, target, viewDir(TILT_DEG), boxCorners(H, (BANK_H + RIVER_BASE) / 2, H, (BANK_H - RIVER_BASE) / 2), 0.97);
  });
  // The river board lies on a wooden floor under the lamp.
  addRoom(stage, H, -RIVER_BASE, target);

  const statics = new Group();
  const isles: { mesh: Mesh; ring: Mesh }[] = [];
  const pars = new Group();
  const whirls: Mesh[] = [];
  const boats = new Map<string, { g: Group; key: string; phase: number }>();
  const flow1 = ripples();
  const flow2 = ripples();
  stage.scene.add(statics, pars);
  let sceneKey = '';

  const build = (d: RiverDraw) => {
    disposeTree(statics);
    statics.clear();
    isles.length = 0;
    whirls.length = 0;
    const R = d.river;
    const depth = canvasTexture(256, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.7);
      g.addColorStop(0, css(R.water));
      g.addColorStop(1, css(R.waterDeep));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    const water = new Mesh(new PlaneGeometry(config.L, config.L).rotateX(-Math.PI / 2),
      new MeshPhysicalMaterial({ map: depth, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }));
    water.receiveShadow = true;
    const shine = (tex: typeof flow1, op: number, y: number) => {
      const m = new Mesh(new PlaneGeometry(config.L, config.L).rotateX(-Math.PI / 2),
        new MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, color: R.line }));
      m.position.y = y;
      return m;
    };
    statics.add(water, shine(flow1, 0.28, 0.0006), shine(flow2, 0.18, 0.0007));
    const bank = finishMaterial(R.bank, 'matte');
    // The board under the water, so the river sits on the floor as one solid piece.
    const under = new Mesh(new BoxGeometry(config.L, RIVER_BASE, config.L), finishMaterial(R.bankEdge, 'satin'));
    under.position.y = -RIVER_BASE / 2 - 0.0005;
    under.castShadow = true;
    statics.add(under);
    for (const [w, dd, x, z] of [[config.L, BANK_W, 0, -H + BANK_W / 2], [config.L, BANK_W, 0, H - BANK_W / 2], [BANK_W, config.L, -H + BANK_W / 2, 0], [BANK_W, config.L, H - BANK_W / 2, 0]] as const) {
      const m = new Mesh(new BoxGeometry(w, BANK_H, dd), bank);
      m.position.set(x, BANK_H / 2, z);
      m.castShadow = m.receiveShadow = true;
      statics.add(m);
    }
    const lay = layoutOf(d.config);
    lay.islands.forEach((isl) => {
      const at = toPlane(isl, d.view);
      const mesh = new Mesh(new CylinderGeometry(isl.r, isl.r * 1.08, ISLE_H, 40), new MeshPhysicalMaterial({ color: R.island, roughness: 0.8 }));
      mesh.position.set(at.x, ISLE_H / 2, at.z);
      mesh.receiveShadow = mesh.castShadow = true;
      const ring = new Mesh(new RingGeometry(isl.r * 0.93, isl.r, 48).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: R.ring }));
      ring.position.set(at.x, ISLE_H + 0.0003, at.z);
      statics.add(mesh, ring);
      isles.push({ mesh, ring });
    });
    for (const rock of d.table.rocks) {
      const at = toPlane(rock, d.view);
      const m = new Mesh(new DodecahedronGeometry(rock.r, 0).scale(1, 0.6, 1), finishMaterial(rock.r > NODI.ROCK_R ? R.bank : R.rock, 'satin'));
      m.position.set(at.x, rock.r * 0.25, at.z);
      m.castShadow = true;
      statics.add(m);
    }
    const spiral = canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = css(R.whirl);
      ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = css(R.line);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 4;
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        ctx.moveTo(s / 2, s / 2);
        for (let i = 1; i <= 30; i++) {
          const t = i / 30;
          const a = (arm * 2 * Math.PI) / 3 + t * 2.5 * Math.PI;
          ctx.lineTo(s / 2 + Math.cos(a) * (s / 2) * t, s / 2 + Math.sin(a) * (s / 2) * t);
        }
        ctx.stroke();
      }
    });
    for (const w of d.table.pockets) {
      const at = toPlane(w, d.view);
      const m = new Mesh(new CircleGeometry(d.table.pocketD / 2, 40).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: spiral, transparent: true, opacity: 0.9 }));
      m.position.set(at.x, 0.0008, at.z);
      statics.add(m);
      whirls.push(m);
    }
  };

  // Aim, selection and clock marks.
  const white = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  const guide = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), white);
  const tip = new Mesh(new CircleGeometry(AIM_W * 1.6, 20).rotateX(-Math.PI / 2), white);
  const sel = new Mesh(new RingGeometry(NODI.BOAT_D * 0.7, NODI.BOAT_D * 0.76, 40).rotateX(-Math.PI / 2), white);
  const clockMat = new MeshBasicMaterial({ color: 0x2ecc71, transparent: true, depthWrite: false });
  const clock = new Mesh(new RingGeometry(1, 1.1, 40), clockMat);
  clock.rotation.x = -Math.PI / 2;
  stage.scene.add(guide, tip, sel, clock);
  let clockShown = -1;
  let parKey = '';

  const placeBoat = (id: string, seat: number, at: { x: number; z: number }, d: RiverDraw, now: number) => {
    const skin = d.skinOf(seat);
    const key = `${skin.shape}|${skin.finish}|${skin.colors[seat % 4]}`;
    let b = boats.get(id);
    if (!b || b.key !== key) {
      if (b) stage.scene.remove(b.g);
      b = { g: makeBoat(skin, seat), key, phase: (id.charCodeAt(0) + id.length * 7) % 6 };
      boats.set(id, b);
      stage.scene.add(b.g);
    }
    b.g.position.set(at.x, Math.sin(now / 420 + b.phase) * 0.0016, at.z);
    b.g.rotation.y = Math.sin(now / 900 + b.phase) * 0.15;
    return b;
  };

  const r: RiverRenderer = {
    canvas: stage.canvas,
    layout: () => layout,
    screen(e) {
      const hit = stage.ground(e, 0);
      return hit ? planeToPx(hit.x, hit.z, layout.boardPx) : null;
    },
    world(e, view: Seat) {
      const p = r.screen(e);
      return p ? screenToWorld(p, view, layout.boardPx) : null;
    },
    draw(d) {
      const now = performance.now();
      const key = `${d.config.players}|${d.view}|${d.river.water}|${d.river.bank}|${d.river.island}`;
      if (key !== sceneKey) { sceneKey = key; build(d); parKey = ''; }
      flow1.offset.set((now * 0.00002) % 1, (now * 0.00001) % 1);
      flow2.offset.set(1 - ((now * 0.000013) % 1), (now * 0.000017) % 1);
      for (const w of whirls) w.rotation.y += WHIRL_SPEED * d.deltaMs;
      // Islands take their owner's colour; par chains link a side's islands.
      isles.forEach((isl, i) => {
        const owner = d.owners[i];
        const tint = owner ? new Color(d.river.island).lerp(new Color(d.teamColor(owner)), 0.45) : new Color(d.river.island);
        (isl.mesh.material as MeshPhysicalMaterial).color.copy(tint);
        (isl.ring.material as MeshBasicMaterial).color.set(owner ? d.teamColor(owner) : d.river.ring);
      });
      const pk = JSON.stringify(d.pars);
      if (pk !== parKey) {
        parKey = pk;
        disposeTree(pars);
        pars.clear();
        const islands = layoutOf(d.config).islands;
        for (const team of ['A', 'B'] as const) {
          const chain = d.pars[team];
          for (let i = 1; i < chain.length; i++) {
            const a = toPlane(islands[chain[i - 1]!]!, d.view);
            const b = toPlane(islands[chain[i]!]!, d.view);
            const m = new Mesh(new BoxGeometry(0.012, 0.004, Math.hypot(b.x - a.x, b.z - a.z)), new MeshBasicMaterial({ color: d.teamColor(team) }));
            m.position.set((a.x + b.x) / 2, ISLE_H + 0.001, (a.z + b.z) / 2);
            m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
            pars.add(m);
          }
        }
      }
      const seen = new Set<string>();
      for (const p of d.board.pieces) {
        if (p.pocketed) continue;
        seen.add(p.id);
        placeBoat(p.id, boatOf(p.id).seat, toPlane(p, d.view), d, now);
      }
      if (d.ready) {
        seen.add('ready');
        placeBoat('ready', d.ready.seat, toPlane(launchPoint(d.ready.seat, d.ready.along), d.view), d, now);
      }
      for (const [id, b] of boats) if (!seen.has(id)) { stage.scene.remove(b.g); boats.delete(id); }
      const selAt = d.selected ? d.board.pieces.find((p) => p.id === d.selected && !p.pocketed) : d.ready ? launchPoint(d.ready.seat, d.ready.along) : null;
      sel.visible = selAt !== null && selAt !== undefined;
      if (selAt) { const at = toPlane(selAt, d.view); sel.position.set(at.x, 0.001, at.z); }
      guide.visible = tip.visible = d.aimFrom !== null && d.aim !== null;
      if (d.aimFrom && d.aim) {
        const dir = seatToWorld(d.aimSeat, d.aim.dirX, d.aim.dirY);
        const len = AIM_LEN * Math.max(0.15, d.aim.power);
        const a = toPlane(d.aimFrom, d.view);
        const b = toPlane({ x: d.aimFrom.x + dir.x * len, y: d.aimFrom.y + dir.y * len }, d.view);
        const l = Math.hypot(b.x - a.x, b.z - a.z);
        guide.position.set((a.x + b.x) / 2, HULL_H + 0.002, (a.z + b.z) / 2);
        guide.scale.set(AIM_W, 1, Math.max(l, 1e-6));
        guide.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        tip.position.set(b.x, HULL_H + 0.0025, b.z);
      }
      clock.visible = d.clock !== null && d.clockAt !== null;
      if (d.clock !== null && d.clockAt) {
        const left = Math.max(0, Math.min(1, d.clock));
        if (Math.abs(left - clockShown) > 0.004) {
          clockShown = left;
          const rr = NODI.BOAT_D * 0.95;
          clock.geometry.dispose();
          clock.geometry = new RingGeometry(rr, rr + 0.004, 40, 1, Math.PI / 2, Math.PI * 2 * Math.max(0.001, left));
          clockMat.color.set(left < 0.25 ? 0xff3b30 : 0x2ecc71);
        }
        const at = toPlane(d.clockAt, d.view);
        clock.position.set(at.x, 0.0012, at.z);
      }
      stage.invalidate();
    },
    start(tick) { stage.onFrame((dt) => { tick(dt); }); },
    destroy() {
      flow1.dispose();
      flow2.dispose();
      disposeBoatMaterials();
      stage.dispose();
    },
  };
  return r;
};
