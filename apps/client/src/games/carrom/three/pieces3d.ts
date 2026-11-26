import {
  CircleGeometry, Color, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Vector2,
  type BufferGeometry, type Material,
} from 'three';
import { PIECE_RING_RADIUS, type PieceStyle } from '@/constants/view';
import type { Finish } from '@/game3d/finish';
import { finishMaterial } from '@/game3d/three/materials';
import { canvasTexture, css } from '@/game3d/three/textures';
import { paintWood } from '@/game3d/three/wood';

/** Thickness for diameter: a carrom coin (~8 mm on 30 mm) and the thinner, wider striker. */
const COIN_THICK = 0.26;
const STRIKER_THICK = 0.19;

/** Carved rings on a coin's top: (centre radius, half width) as fractions of r. Drawn as relief (bump map),
 * not geometry: a groove thinner than a pixel aliases into dots on a phone. */
const GROOVES: readonly (readonly [number, number])[] = [[0.78, 0.045], [0.55, 0.04], [0.31, 0.04]];

/** The turned profile (radius, height), bottom centre to top centre: rounded edge, a faint dome on top. */
function profile(r: number, h: number): Vector2[] {
  const p: [number, number][] = [
    [0, 0], [r * 0.9, 0], [r * 0.975, h * 0.06], [r, h * 0.22], [r, h * 0.74], [r * 0.985, h * 0.88], [r * 0.95, h * 0.97],
    [r * 0.88, h], [r * 0.6, h * 1.012], [r * 0.3, h * 1.02], [0, h * 1.022],
  ];
  return p.map(([x, y]) => new Vector2(x, y));
}

/** Paints the carved rings: `relief` = height for the bump map (grey, grooves dark); else shading on the colour map. */
function paintGrooves(ctx: CanvasRenderingContext2D, s: number, relief: boolean): void {
  const c = s / 2;
  for (const [rc, w] of GROOVES) {
    const g = ctx.createRadialGradient(c, c, c * (rc - w), c, c, c * (rc + w));
    if (relief) {
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.35, 'rgba(60,35,15,0.42)');
      g.addColorStop(0.65, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c * (rc + w), 0, Math.PI * 2);
    ctx.arc(c, c, c * (rc - w), 0, Math.PI * 2, true);
    ctx.fill();
  }
}

/** The carved rings' relief, shared by every coin. */
let grooveBump: ReturnType<typeof canvasTexture> | null = null;
const grooveRelief = () => (grooveBump ??= canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, s, s);
  paintGrooves(ctx, s, true);
}));

const geos = new Map<string, BufferGeometry>();

/** A turned disc with planar UVs, so a texture lies flat across its top like real grain. */
function discGeometry(r: number, striker: boolean): { geo: BufferGeometry; h: number } {
  const h = r * 2 * (striker ? STRIKER_THICK : COIN_THICK);
  const key = `${r}|${striker}`;
  let g = geos.get(key);
  if (!g) {
    g = new LatheGeometry(profile(r, h), 56);
    const uv = g.attributes.uv!;
    const pos = g.attributes.position!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (2 * r) + 0.5, pos.getZ(i) / (2 * r) + 0.5);
    g.computeVertexNormals();
    geos.set(key, g);
  }
  return { geo: g, h };
}

/** Wood in the coin's colour, darker toward the rim like lacquered turned wood. */
function coinTexture(st: PieceStyle, seed: number) {
  return canvasTexture(256, (ctx, s) => {
    paintWood(ctx, s, st.base, { rings: 4, warp: 1.2, contrast: st.base < 0x404040 ? 0.45 : 0.18, fibre: 0.15, seed });
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `${css(st.edge)}aa`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    paintGrooves(ctx, s, false);
  });
}

/** The striker's top art: the 2D piece's gradient and rings. */
function strikerTexture(st: PieceStyle) {
  return canvasTexture(256, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(s * 0.38, s * 0.34, 0, c, c, c);
    g.addColorStop(0, css(st.hi));
    g.addColorStop(0.5, css(st.base));
    g.addColorStop(0.9, css(st.base));
    g.addColorStop(1, css(st.edge));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = s * 0.02;
    ctx.strokeStyle = css(st.ring);
    ctx.beginPath(); ctx.arc(c, c, c * PIECE_RING_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = css(st.ringLight);
    ctx.lineWidth = s * 0.01;
    ctx.beginPath(); ctx.arc(c, c, c * PIECE_RING_RADIUS - s * 0.025, 0, Math.PI * 2); ctx.stroke();
  });
}

const mats = new Map<string, Material>();

/** T3D-4 the material of a piece style in a finish (made once per style). */
function materialOf(st: PieceStyle, finish: Finish, striker: boolean): Material {
  const key = `${st.hi}|${st.base}|${st.edge}|${finish}|${striker}`;
  let m = mats.get(key);
  if (m) return m;
  if (striker && finish !== 'metal' && finish !== 'glass') {
    // Acrylic: a deep, mirror-like lacquer over the painted design.
    m = new MeshPhysicalMaterial({ map: strikerTexture(st), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1 });
  } else if (finish === 'gloss' || finish === 'satin' || finish === 'wood') {
    // Turned wood under lacquer (real carrom coins).
    m = new MeshPhysicalMaterial({
      map: coinTexture(st, (st.base & 0xff) + 3), bumpMap: grooveRelief(), bumpScale: 1.2,
      roughness: finish === 'satin' ? 0.5 : 0.36, clearcoat: finish === 'satin' ? 0.4 : 1, clearcoatRoughness: 0.1,
    });
  } else {
    const f = finishMaterial(new Color(st.base), finish);
    // Marble, metal, glass, pearl and glow coins are carved too.
    Object.assign(f, { bumpMap: grooveRelief(), bumpScale: 1.2 });
    m = f;
  }
  mats.set(key, m);
  return m;
}

/** A soft contact shadow under every piece (it also grounds pieces when shadows are off). */
let blobMat: MeshBasicMaterial | null = null;
const blobMaterial = () => (blobMat ??= new MeshBasicMaterial({
  map: canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }),
  transparent: true, depthWrite: false,
}));
const blobs = new Map<number, BufferGeometry>();
const blobGeometry = (r: number) => {
  let g = blobs.get(r);
  if (!g) { g = new CircleGeometry(r * 1.25, 32).rotateX(-Math.PI / 2); blobs.set(r, g); }
  return g;
};

/** Free the shared materials and geometries (the scene is going away). */
export function disposePieceMaterials(): void {
  mats.forEach((m) => m.dispose());
  mats.clear();
  geos.forEach((g) => g.dispose());
  geos.clear();
  blobMat?.map?.dispose();
  blobMat?.dispose();
  grooveBump?.dispose();
  grooveBump = null;
  blobMat = null;
}

/** A piece: a turned body and its contact shadow; `restyle` swaps its look. */
export interface Piece3d { group: Group; height: number; restyle(st: PieceStyle, finish: Finish): void }

export function makePiece(r: number, st: PieceStyle, finish: Finish, striker: boolean): Piece3d {
  const group = new Group();
  const { geo, h } = discGeometry(r, striker);
  const body = new Mesh(geo, materialOf(st, finish, striker));
  body.castShadow = true;
  // Coins cast shadows but don't take them: self-shadowing speckles the carved rings.
  body.receiveShadow = false;
  const blob = new Mesh(blobGeometry(r), blobMaterial());
  blob.position.set(r * 0.1, 0.0003, r * 0.14);
  blob.renderOrder = -1;
  group.add(blob, body);
  let last = '';
  return {
    group,
    height: h,
    restyle(next, f) {
      const k = `${next.hi}|${next.base}|${f}`;
      if (k === last) return;
      last = k;
      body.material = materialOf(next, f, striker);
    },
  };
}
