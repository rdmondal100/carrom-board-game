import {
  CylinderGeometry, DoubleSide, Group, LatheGeometry, Mesh, MeshPhysicalMaterial, Shape, ShapeGeometry, SphereGeometry,
  TorusGeometry, Vector2, type BufferGeometry, type Material,
} from 'three';
import { NODI } from '@carrom/engine';
import type { BoatSkin } from '@/games/nodipar/skins';
import { finishMaterial } from '@/game3d/three/materials';

const R = NODI.BOAT_D / 2;
/** Hull height for its radius. */
export const HULL_H = R * 0.46;

let hullGeo: BufferGeometry | null = null;
const hull = () => (hullGeo ??= new LatheGeometry(
  [[0, 0], [R * 0.72, 0], [R * 0.95, R * 0.18], [R, R * 0.4], [R * 0.94, HULL_H], [0, HULL_H]].map(([x, y]) => new Vector2(x, y)), 36,
));

const mats = new Map<string, Material>();
const mat = (key: string, make: () => Material) => {
  let m = mats.get(key);
  if (!m) { m = make(); mats.set(key, m); }
  return m;
};

/** Free the shared boat materials (the scene is going away). */
export function disposeBoatMaterials(): void {
  mats.forEach((m) => m.dispose());
  mats.clear();
  hullGeo?.dispose();
  hullGeo = null;
}

/** T3D-7 one boat in a skin: hull in the seat colour and finish, the skin's mark on deck. */
export function makeBoat(skin: BoatSkin, seat: number): Group {
  const g = new Group();
  const color = skin.colors[seat % 4]!;
  const body = new Mesh(hull(), mat(`h${color}|${skin.finish}`, () => finishMaterial(color, skin.finish)));
  body.castShadow = true;
  g.add(body);
  const mark = mat(`m${skin.mark}`, () => new MeshPhysicalMaterial({ color: skin.mark, roughness: 0.5, side: DoubleSide }));
  const edge = mat(`e${skin.edge}`, () => finishMaterial(skin.edge, skin.finish === 'glass' ? 'gloss' : skin.finish));
  const rim = new Mesh(new TorusGeometry(R * 0.96, R * 0.06, 8, 36).rotateX(Math.PI / 2), edge);
  rim.position.y = HULL_H;
  g.add(rim);
  if (skin.shape === 'nouka') {
    const mast = new Mesh(new CylinderGeometry(R * 0.04, R * 0.05, R * 1.3, 8), edge);
    mast.position.y = HULL_H + R * 0.65;
    const s = new Shape();
    s.moveTo(0, 0); s.lineTo(R * 0.75, R * 0.15); s.lineTo(0, R * 1.1); s.closePath();
    const sail = new Mesh(new ShapeGeometry(s), mark);
    sail.position.set(R * 0.03, HULL_H + R * 0.15, 0);
    sail.castShadow = true;
    g.add(mast, sail);
  } else if (skin.shape === 'lotus') {
    const petal = new SphereGeometry(R * 0.28, 12, 8).scale(1, 0.45, 1.8);
    for (let k = 0; k < 5; k++) {
      const a = (k * 2 * Math.PI) / 5;
      const p = new Mesh(petal, mark);
      p.position.set(Math.cos(a) * R * 0.42, HULL_H + R * 0.08, Math.sin(a) * R * 0.42);
      p.rotation.set(0.35, -a + Math.PI / 2, 0);
      g.add(p);
    }
  } else {
    const ring = new Mesh(new TorusGeometry(R * 0.45, R * 0.07, 8, 32).rotateX(Math.PI / 2), mark);
    ring.position.y = HULL_H + 0.0005;
    g.add(ring);
  }
  return g;
}
