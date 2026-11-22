import { emptyRiver, LAYOUTS, type NodiConfig } from '@hub/nodipar';
import type { CosmeticPreviewProps } from '@/games/types';
import { nodiLook } from '../skins';
import { RiverSvg } from './RiverSvg';

const CONFIG: NodiConfig = { players: 2, borsha: false };
const ISL = LAYOUTS[2].islands;

/** A picture only: a few boats moored, a par for seat 0's side down the left. */
const SAMPLE = (() => {
  const spots: Record<string, [number, number]> = {
    '0-0': [ISL[0]!.x, ISL[0]!.y], '0-1': [ISL[2]!.x, ISL[2]!.y], '0-2': [ISL[5]!.x, ISL[5]!.y],
    '2-0': [ISL[4]!.x, ISL[4]!.y], '2-1': [ISL[3]!.x + 0.07, ISL[3]!.y], '2-2': [0.1, 0.36],
  };
  return { pieces: emptyRiver(CONFIG).pieces.map((p) => (spots[p.id] ? { ...p, x: spots[p.id]![0], y: spots[p.id]![1], pocketed: false } : p)) };
})();

/** NODI-6 the shop's preview of a boat skin and river theme. */
export function NodiPreview({ equipped, className }: CosmeticPreviewProps) {
  const look = nodiLook({ boat: equipped.boat ?? '', river: equipped.river ?? '' });
  return <RiverSvg config={CONFIG} board={SAMPLE} look={look} className={className} />;
}
