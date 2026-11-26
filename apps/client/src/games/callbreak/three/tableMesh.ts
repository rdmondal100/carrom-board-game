import { Color, ExtrudeGeometry, Group, Mesh, MeshPhysicalMaterial, Path, Shape, ShapeGeometry } from 'three';
import type { TableSkin } from '@/games/callbreak/skins';
import { finishMaterial } from '@/game3d/three/materials';
import { canvasTexture, rng, shade } from '@/game3d/three/textures';

/** Felt half sizes and the rim (table units: a card is 0.5 × 0.7). */
export const TABLE = { hw: 2.3, hd: 1.55, rim: 0.24, rimH: 0.14, corner: 0.5, base: 0.16 } as const;

function rounded(hw: number, hd: number, r: number): Shape {
  const s = new Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}

/** T3D-6 felt (soft light in the middle, fibres) and a bevelled rim in the table skin's colours and finish. */
export function tableMesh(skin: TableSkin): Group {
  const g = new Group();
  const feltTex = canvasTexture(512, (ctx, s) => {
    const grad = ctx.createRadialGradient(s / 2, s * 0.45, s * 0.05, s / 2, s / 2, s * 0.7);
    grad.addColorStop(0, shade(skin.felt, 0.22));
    grad.addColorStop(0.6, skin.felt);
    grad.addColorStop(1, shade(skin.felt, -0.35));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    const r = rng(17);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(r() * s, r() * s, 1.5, 1.5);
    }
  });
  const feltGeo = new ShapeGeometry(rounded(TABLE.hw, TABLE.hd, TABLE.corner), 12);
  // ShapeGeometry UVs are in shape units: map them onto 0..1 across the felt.
  const uv = feltGeo.attributes.uv!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + TABLE.hw) / (2 * TABLE.hw), (uv.getY(i) + TABLE.hd) / (2 * TABLE.hd));
  feltGeo.rotateX(-Math.PI / 2);
  const felt = new Mesh(feltGeo, new MeshPhysicalMaterial({
    map: feltTex, roughness: 0.95, sheen: 1, sheenRoughness: 0.7, sheenColor: new Color(skin.felt).lerp(new Color(0xffffff), 0.4),
  }));
  felt.receiveShadow = true;
  g.add(felt);

  const outer = rounded(TABLE.hw + TABLE.rim, TABLE.hd + TABLE.rim, TABLE.corner + TABLE.rim);
  const hole = rounded(TABLE.hw, TABLE.hd, TABLE.corner);
  outer.holes.push(new Path(hole.getPoints(12)));
  const rimGeo = new ExtrudeGeometry(outer, {
    depth: TABLE.rimH + TABLE.base, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 12,
  });
  rimGeo.rotateX(-Math.PI / 2);
  rimGeo.translate(0, -TABLE.base, 0);
  const rim = new Mesh(rimGeo, finishMaterial(skin.rim, skin.rimFinish));
  rim.castShadow = true;
  rim.receiveShadow = true;
  g.add(rim);
  return g;
}
