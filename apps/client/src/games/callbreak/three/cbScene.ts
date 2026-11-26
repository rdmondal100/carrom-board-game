import { BoxGeometry, Group, Mesh, Vector3, type CanvasTexture, type MeshPhysicalMaterial, type MeshStandardMaterial } from 'three';
import type { Card, Play } from '@hub/cards';
import { CB_ANIM } from '@hub/callbreak';
import type { CardBackSkin, TableSkin } from '@/games/callbreak/skins';
import { boxCorners, fitCamera, viewDir } from '@/game3d/three/camera';
import { addRoom } from '@/game3d/three/room';
import { createStage } from '@/game3d/three/stage';
import type { Quality } from '@/store/settingsSlice';
import { backTexture, cardMaterials, faceTexture } from './cardArt';
import { TABLE, tableMesh } from './tableMesh';

/** Card size (table units) and the camera's angle above the table. */
const CW = 0.62;
const CH = 0.868;
const CT = 0.008;
const TILT_DEG = 60;
type Spot = 'bottom' | 'left' | 'top' | 'right';
const SPOTS: readonly Spot[] = ['bottom', 'left', 'top', 'right'];
const spotOf = (seat: number, me: number): Spot => SPOTS[(seat - me + 4) % 4]!;
const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
/** Where each seat's trick card lands, where its cards come from and go to, and its hand fan. */
const TRICK: Record<Spot, Vector3> = { bottom: v3(0, 0, 0.6), top: v3(0, 0, -0.6), left: v3(-0.78, 0, 0), right: v3(0.78, 0, 0) };
const EDGE: Record<Spot, Vector3> = { bottom: v3(0, 0.9, 2.3), top: v3(0, 0.2, -1.5), left: v3(-2.1, 0.2, 0), right: v3(2.1, 0.2, 0) };
const FAN: Record<Exclude<Spot, 'bottom'>, { at: Vector3; turn: number }> = {
  top: { at: v3(0, 0, -1.05), turn: Math.PI }, left: { at: v3(-1.55, 0, 0.05), turn: -Math.PI / 2 }, right: { at: v3(1.55, 0, 0.05), turn: Math.PI / 2 },
};

export interface CbFrame {
  me: number;
  trick: readonly Play[];
  winner: number | null;
  handSizes: readonly number[];
  dealer: number;
  dealing: boolean;
  back: CardBackSkin;
  table: TableSkin;
}

interface Flying { mesh: Mesh; from: Vector3; to: Vector3; flip: boolean; t0: number; ms: number; arc: number; spin: number; done?: () => void }

const ease = (k: number) => 1 - (1 - k) ** 3;
const tiltOf = (card: string) => { let h = 0; for (const c of card) h = (h * 31 + c.charCodeAt(0)) % 997; return ((h % 17) - 8) * (Math.PI / 180); };

/** T3D-6 a live Callbreak table. */
export interface CbScene { update(f: CbFrame): void; dispose(): void }

export function createCbScene(host: HTMLElement, quality: Quality, onLost: () => void): CbScene {
  const stage = createStage(host, { quality, fov: 34, onLost, fit: (el) => ({ w: el.clientWidth, h: el.clientHeight }) });
  stage.fitLights(TABLE.hw + TABLE.rim);
  const hw = TABLE.hw + TABLE.rim;
  const hd = TABLE.hd + TABLE.rim;
  const target = v3(0, 0, 0.15);
  stage.onResize(() => fitCamera(stage.camera, target, viewDir(TILT_DEG), boxCorners(hw, 0.1, hd, 0.1), 0.98));
  // The table stands on a wooden floor under the lamp.
  addRoom(stage, hw, -TABLE.base - 0.05, target);
  const geo = new BoxGeometry(CW, CT, CH);
  const faces = new Map<Card, CanvasTexture>();
  let backKey = '';
  let backTex: CanvasTexture | null = null;
  let backMats: MeshStandardMaterial[] = [];
  let tableKey = '';
  let tableGroup: Group | null = null;
  const trick = new Map<Card, { mesh: Mesh; fly: Flying; rest: Vector3; sweep0: number | null }>();
  const loose = new Set<Flying>();
  const fans = new Group();
  stage.scene.add(fans);
  let lastHands = '';
  let wasDealing = false;
  /** Where the won trick sweeps to (the winner's side as this seat sees it). */
  let swept: Spot | null = null;
  const drop = (mesh: Mesh) => {
    stage.scene.remove(mesh);
    for (const m of mesh.material as MeshStandardMaterial[]) if (!backMats.includes(m)) m.dispose();
  };

  const cardMesh = (card: Card | null, f: CbFrame) => {
    let mats = backMats;
    if (card) {
      let face = faces.get(card);
      if (!face) { face = faceTexture(card); faces.set(card, face); }
      mats = cardMaterials(face, backTex!, f.back.finish === 'metal');
    }
    const m = new Mesh(geo, mats);
    m.castShadow = true;
    return m;
  };

  const rebuildFans = (f: CbFrame) => {
    fans.clear();
    for (const spot of ['left', 'top', 'right'] as const) {
      const seat = (f.me + SPOTS.indexOf(spot)) % 4;
      const n = Math.min(13, f.handSizes[seat] ?? 0);
      const fan = FAN[spot];
      for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        const m = new Mesh(geo, backMats);
        m.castShadow = true;
        const a = fan.turn + off * 0.09;
        m.position.set(fan.at.x + Math.sin(a) * 0.35 - Math.sin(fan.turn) * 0.35, 0.01 + i * CT * 1.2, fan.at.z + Math.cos(a) * 0.35 - Math.cos(fan.turn) * 0.35);
        m.rotation.set(Math.PI, a, 0);
        fans.add(m);
      }
    }
  };

  const update = (f: CbFrame) => {
    const now = performance.now();
    const bk = `${f.back.pattern}|${f.back.base}|${f.back.finish}`;
    if (bk !== backKey) {
      backKey = bk;
      backTex = backTexture(f.back);
      backMats = cardMaterials(null, backTex, f.back.finish === 'metal');
      lastHands = '';
    }
    const tk = `${f.table.felt}|${f.table.rim}|${f.table.rimFinish}`;
    if (tk !== tableKey) {
      tableKey = tk;
      if (tableGroup) stage.scene.remove(tableGroup);
      tableGroup = tableMesh(f.table);
      stage.scene.add(tableGroup);
    }
    const hk = `${f.me}|${f.handSizes.join()}`;
    if (hk !== lastHands) { lastHands = hk; rebuildFans(f); }

    // New trick cards fly in from their player; yours rises from your hand.
    const live = new Set(f.trick.map((p) => p.card));
    for (const [card, t] of trick) if (!live.has(card)) { drop(t.mesh); trick.delete(card); }
    for (const play of f.trick) {
      if (trick.has(play.card)) continue;
      const spot = spotOf(play.seat, f.me);
      const mesh = cardMesh(play.card, f);
      const rest = TRICK[spot].clone().setY(0.01 + trick.size * CT * 1.5);
      const fly: Flying = { mesh, from: EDGE[spot].clone(), to: rest, flip: play.seat !== f.me, t0: now, ms: CB_ANIM.CARD_MS * 0.9, arc: 0.5, spin: tiltOf(play.card) };
      mesh.position.copy(fly.from);
      stage.scene.add(mesh);
      trick.set(play.card, { mesh, fly, rest, sweep0: null });
    }
    // A won trick: gather, hold with the winner lit, then sweep to the winner.
    if (f.winner !== null && swept === null) {
      swept = spotOf(f.winner, f.me);
      for (const t of trick.values()) t.sweep0 = now;
    }
    if (f.winner === null) swept = null;

    // A deal: backs leave the dealer one by one round the table.
    if (f.dealing && !wasDealing) {
      const from = EDGE[spotOf(f.dealer, f.me)];
      for (let i = 0; i < 12; i++) {
        const to = EDGE[spotOf((f.dealer + 1 + i) % 4, f.me)];
        const mesh = cardMesh(null, f);
        mesh.position.copy(from);
        mesh.visible = false;
        stage.scene.add(mesh);
        const fly: Flying = { mesh, from: v3(from.x * 0.3, 0.3, from.z * 0.3), to: to.clone().setY(0.05), flip: false, t0: now + i * 42, ms: 380, arc: 0.4, spin: Math.PI * 1.5, done: () => { drop(mesh); loose.delete(fly); } };
        loose.add(fly);
      }
    }
    wasDealing = f.dealing;
    stage.invalidate();
  };

  const step = (fl: Flying, now: number): boolean => {
    const k = Math.max(0, Math.min(1, (now - fl.t0) / fl.ms));
    fl.mesh.visible = now >= fl.t0;
    const e = ease(k);
    fl.mesh.position.lerpVectors(fl.from, fl.to, e);
    fl.mesh.position.y += fl.arc * 4 * k * (1 - k);
    // Opponents' cards travel face down and turn over; dealt cards stay face down.
    fl.mesh.rotation.set(fl.flip ? Math.PI * (1 - e) : fl.done ? Math.PI : 0, fl.spin * (fl.done ? e : 1), 0);
    if (k >= 1) fl.done?.();
    return k < 1;
  };

  stage.onFrame((_dt, now) => {
    let moving = false;
    for (const fl of [...loose]) if (step(fl, now) || now < fl.t0) moving = true;
    for (const t of trick.values()) {
      if (t.sweep0 === null) { if (step(t.fly, now)) moving = true; continue; }
      const k = Math.min(1, (now - t.sweep0) / CB_ANIM.TRICK_MS);
      const gather = t.rest.clone().multiplyScalar(0.3).setY(t.rest.y);
      const winEdge = EDGE[swept ?? 'bottom'].clone();
      const top = t.mesh.material as MeshPhysicalMaterial[];
      if (k < 0.3) t.mesh.position.lerpVectors(t.rest, gather, ease(k / 0.3));
      else if (k < 0.55) t.mesh.position.copy(gather);
      else {
        const kk = ease((k - 0.55) / 0.45);
        t.mesh.position.lerpVectors(gather, winEdge, kk);
        t.mesh.scale.setScalar(1 - 0.45 * kk);
      }
      top[2]?.emissive?.set(k > 0.25 && k < 0.6 ? 0x664400 : 0x000000);
      if (k < 1) moving = true;
    }
    return moving;
  });

  return {
    update,
    dispose() {
      faces.forEach((t) => t.dispose());
      stage.dispose();
    },
  };
}
