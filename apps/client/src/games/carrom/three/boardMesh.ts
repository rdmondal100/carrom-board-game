import {
  CircleGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  Path, Shape, ShapeGeometry, type Material,
} from 'three';
import { config, pocketCentre, type PocketId } from '@carrom/engine';
import { FRAME_WIDTH } from '@/constants/view';
import type { BoardFinish, BoardPalette } from '@/games/carrom/skins';
import { finishMaterial } from '@/game3d/three/materials';
import { canvasTexture } from '@/game3d/three/textures';
import { paintWood } from '@/game3d/three/wood';
import { toPlane } from '../boardPlane';
import { boardTexture } from './boardTexture';

const H = config.HALF_L;
/** Frame width, height above the surface, and the board's thickness under it (L). */
export const FRAME = FRAME_WIDTH * config.L;
export const FRAME_H = 0.042;
export const BASE = 0.03;
/** How deep a pocket's cup goes under the surface. */
export const CUP = 0.034;
const BEVEL = 0.005;
const POCKETS: readonly PocketId[] = [0, 1, 2, 3];

/** The far rail as a mitred trapezoid (shape y = −z), inset by the bevel so the bevelled rails meet cleanly. */
function railShape(): Shape {
  const a = H + BEVEL;
  const b = H + FRAME - BEVEL;
  const s = new Shape();
  s.moveTo(-a, a);
  s.lineTo(a, a);
  s.lineTo(b, b);
  s.lineTo(-b, b);
  s.closePath();
  return s;
}

/** The frame's wood: strong grain in the frame colour, under a clear lacquer. */
function frameMaterial(C: BoardPalette, fin: BoardFinish): Material {
  if (fin.frame !== 'wood') return finishMaterial(C.frame, fin.frame);
  const map = canvasTexture(512, (ctx, s) => paintWood(ctx, s, C.frame, { rings: 26, warp: 2.6, contrast: 0.32, fibre: 0.9, seed: 23 }), true);
  map.repeat.set(2, 2);
  return new MeshPhysicalMaterial({ map, color: 0xcfc2b6, roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.12, envMapIntensity: 0.55 });
}

/** A net at the bottom of a pocket. */
const netTexture = () => canvasTexture(128, (ctx, s) => {
  ctx.fillStyle = '#070504';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(200,170,120,0.35)';
  ctx.lineWidth = 2;
  for (let i = -s; i < 2 * s; i += 14) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + s, 0); ctx.lineTo(i, s); ctx.stroke();
  }
});

/**
 * T3D-4 a real carrom board: a lacquered playing surface with the four pockets
 * cut through it into dark cups with nets, framed by four mitred, bevelled
 * hardwood rails. The surface top is y = 0; the board rests on y = −BASE.
 */
export function boardMesh(C: BoardPalette, fin: BoardFinish): Group {
  const g = new Group();
  const rp = config.POCKET_D / 2;
  const shape = new Shape();
  shape.moveTo(-H, -H); shape.lineTo(H, -H); shape.lineTo(H, H); shape.lineTo(-H, H); shape.closePath();
  const centres = POCKETS.map((k) => toPlane(pocketCentre(k, config), 0));
  for (const c of centres) shape.holes.push(new Path().absarc(c.x, -c.z, rp, 0, Math.PI * 2, true));
  const geo = new ShapeGeometry(shape, 48);
  const uv = geo.attributes.uv!;
  const pos = geo.attributes.position!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + H) / config.L, (pos.getY(i) + H) / config.L);
  geo.rotateX(-Math.PI / 2);
  const glossy = fin.surface === 'marble' || fin.surface === 'gloss';
  const surface = new Mesh(geo, new MeshPhysicalMaterial({
    map: boardTexture(C, fin), roughness: glossy ? 0.12 : 0.2, clearcoat: 1, clearcoatRoughness: glossy ? 0.03 : 0.05,
  }));
  surface.receiveShadow = true;
  g.add(surface);

  // Under each hole: a dark cup and a net, so a pocketed coin really drops in.
  const wall = new MeshStandardMaterial({ color: 0x150b06, roughness: 0.9, side: DoubleSide });
  const net = new MeshStandardMaterial({ map: netTexture(), roughness: 1 });
  const cupGeo = new CylinderGeometry(rp, rp * 0.9, CUP, 32, 1, true);
  const netGeo = new CircleGeometry(rp * 0.9, 32).rotateX(-Math.PI / 2);
  for (const c of centres) {
    const cup = new Mesh(cupGeo, wall);
    cup.position.set(c.x, -CUP / 2, c.z);
    const bottom = new Mesh(netGeo, net);
    bottom.position.set(c.x, -CUP + 0.0005, c.z);
    g.add(cup, bottom);
  }

  // The frame: one mitred rail, turned to each side (the grain runs along every rail).
  const railGeo = new ExtrudeGeometry(railShape(), {
    depth: BASE + FRAME_H - 2 * BEVEL, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 4, curveSegments: 4,
  });
  railGeo.rotateX(-Math.PI / 2);
  railGeo.translate(0, -BASE + BEVEL, 0);
  const wood = frameMaterial(C, fin);
  for (let k = 0; k < 4; k++) {
    const rail = new Mesh(railGeo, wood);
    rail.rotation.y = (k * Math.PI) / 2;
    rail.castShadow = true;
    rail.receiveShadow = true;
    g.add(rail);
  }
  return g;
}
