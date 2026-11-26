import { MeshPhysicalMaterial, MeshStandardMaterial, type CanvasTexture } from 'three';
import { rankOf, suitOf, type Card } from '@hub/cards';
import { SUIT_SYMBOL } from '@/games/callbreak/components/PlayingCard';
import type { CardBackSkin } from '@/games/callbreak/skins';
import { canvasTexture } from '@/game3d/three/textures';

/** Card art size (px); the 3D card is 5 : 7 like a real card. */
const W = 256;
const H = 358;
const RANK: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const FACE_RANKS = new Set([11, 12, 13]);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws on a W × H canvas (the texture is square-sized; we stretch it on the card's face). */
function cardCanvas(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  return canvasTexture(H, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.scale(s / W, s / H);
    draw(ctx);
    ctx.restore();
  });
}

/** T3D-6 a card's face: corner indices, a big suit, a framed letter on J, Q, K (our own design, like 2D). */
export function faceTexture(card: Card): CanvasTexture {
  const rank = rankOf(card);
  const suit = SUIT_SYMBOL[suitOf(card)];
  const red = suitOf(card) === 'H' || suitOf(card) === 'D';
  const label = RANK[rank] ?? String(rank);
  return cardCanvas((ctx) => {
    roundRect(ctx, 2, 2, W - 4, H - 4, 20);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e7e9ee');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = red ? '#dc2626' : '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const corner = (x: number, y: number, flip: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      if (flip) ctx.rotate(Math.PI);
      ctx.font = 'bold 46px system-ui, sans-serif';
      ctx.fillText(label, 0, -18);
      ctx.font = '38px system-ui, sans-serif';
      ctx.fillText(suit, 0, 24);
      ctx.restore();
    };
    corner(36, 48, false);
    corner(W - 36, H - 48, true);
    if (FACE_RANKS.has(rank)) {
      roundRect(ctx, 62, 86, W - 124, H - 172, 14);
      ctx.fillStyle = '#fde68a';
      ctx.fill();
      ctx.strokeStyle = red ? 'rgba(220,38,38,0.45)' : 'rgba(15,23,42,0.45)';
      ctx.stroke();
      ctx.fillStyle = red ? '#dc2626' : '#0f172a';
      ctx.font = 'bold 92px Georgia, serif';
      ctx.fillText(label, W / 2, H / 2 - 18);
      ctx.font = '52px system-ui, sans-serif';
      ctx.fillText(suit, W / 2, H / 2 + 54);
    } else {
      ctx.font = '130px system-ui, sans-serif';
      ctx.fillText(suit, W / 2, H / 2 + 6);
    }
  });
}

/** T3D-6 the back in the equipped design (lattice, nakshi, jamdani, royal). */
export function backTexture(skin: CardBackSkin): CanvasTexture {
  return cardCanvas((ctx) => {
    roundRect(ctx, 2, 2, W - 4, H - 4, 20);
    ctx.fillStyle = skin.base;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = skin.border;
    ctx.stroke();
    ctx.save();
    roundRect(ctx, 22, 22, W - 44, H - 44, 12);
    ctx.clip();
    ctx.strokeStyle = skin.ink;
    ctx.fillStyle = skin.ink;
    ctx.lineWidth = 3;
    const step = 32;
    for (let y = 22; y < H; y += step) {
      for (let x = 22; x < W; x += step) {
        const cx = x + step / 2;
        const cy = y + step / 2;
        ctx.beginPath();
        if (skin.pattern === 'lattice') {
          ctx.moveTo(cx, cy - 14); ctx.lineTo(cx + 14, cy); ctx.lineTo(cx, cy + 14); ctx.lineTo(cx - 14, cy); ctx.closePath(); ctx.stroke();
        } else if (skin.pattern === 'nakshi') {
          ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
        } else if (skin.pattern === 'jamdani') {
          ctx.moveTo(cx, cy - 12); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 12); ctx.lineTo(cx - 5, cy); ctx.closePath(); ctx.fill();
        } else {
          ctx.moveTo(cx - 11, cy + 8); ctx.lineTo(cx - 8, cy - 8); ctx.lineTo(cx, cy); ctx.lineTo(cx + 8, cy - 8); ctx.lineTo(cx + 11, cy + 8); ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = skin.ink;
    roundRect(ctx, 22, 22, W - 44, H - 44, 12);
    ctx.stroke();
  });
}

/** T3D-6 the materials of one card: face up (+y), back down (−y), white edges. */
export function cardMaterials(face: CanvasTexture | null, back: CanvasTexture, foil: boolean): MeshStandardMaterial[] {
  const edge = new MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 });
  const top = new MeshPhysicalMaterial({ map: face, color: face ? 0xffffff : 0xdddddd, roughness: 0.42, clearcoat: 0.4, alphaTest: 0.5, transparent: false });
  const bottom = new MeshPhysicalMaterial({
    map: back, roughness: foil ? 0.28 : 0.5, metalness: foil ? 0.75 : 0, clearcoat: 0.5, alphaTest: 0.5,
  });
  return [edge, edge, top, bottom, edge, edge];
}
