import { Color, MeshPhysicalMaterial, type ColorRepresentation, type Texture } from 'three';
import type { Finish } from '@/game3d/finish';
import { canvasTexture, paintGrain, paintMarble } from './textures';

export interface FinishOptions {
  /** Art painted on the surface (replaces the generated grain or veins). */
  map?: Texture | null;
  /** Vein colour for marble. */
  vein?: ColorRepresentation;
}

/** T3D-8 a physical material for a cosmetic's colour and finish. */
export function finishMaterial(color: ColorRepresentation, finish: Finish, o: FinishOptions = {}): MeshPhysicalMaterial {
  const base = new Color(color);
  const hex = base.getHex();
  const m = new MeshPhysicalMaterial({ color: base, roughness: 0.5, metalness: 0 });
  switch (finish) {
    case 'matte':
      Object.assign(m, { roughness: 0.85 });
      break;
    case 'satin':
      Object.assign(m, { roughness: 0.45, clearcoat: 0.25 });
      break;
    case 'gloss':
      Object.assign(m, { roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08 });
      break;
    case 'wood':
      Object.assign(m, { roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.25 });
      m.color.set(0xffffff);
      m.map = o.map ?? canvasTexture(256, (ctx, s) => paintGrain(ctx, s, hex, hex & 0xff), true);
      break;
    case 'marble':
      Object.assign(m, { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04 });
      m.color.set(0xffffff);
      m.map = o.map ?? canvasTexture(512, (ctx, s) => paintMarble(ctx, s, hex, new Color(o.vein ?? 0xc9a227).getHex(), hex & 0xff));
      break;
    case 'metal':
      Object.assign(m, { metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.1 });
      break;
    case 'glass':
      Object.assign(m, {
        roughness: 0.04, transparent: true, opacity: 0.62, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.5,
        specularIntensity: 1, envMapIntensity: 1.6,
      });
      break;
    case 'pearl':
      Object.assign(m, { roughness: 0.3, clearcoat: 0.8, sheen: 1, sheenColor: new Color(0xffffff), iridescence: 0.7, iridescenceIOR: 1.4 });
      break;
    case 'glow':
      Object.assign(m, { roughness: 0.35, clearcoat: 0.6, emissive: base.clone(), emissiveIntensity: 0.75 });
      break;
  }
  if (o.map && finish !== 'wood' && finish !== 'marble') m.map = o.map;
  return m;
}
