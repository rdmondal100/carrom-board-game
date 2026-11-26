import { cosmeticById, DEFAULT_SLOTS, itemOrDefault } from '@carrom/protocol';
import type { Finish } from '@/game3d/finish';

/** CB-9 looks only: nothing here changes play. Unknown keys draw the classic look. */

export type BackPattern = 'lattice' | 'nakshi' | 'jamdani' | 'royal';
/** `finish` is the T3D-8 3D surface of the back (metal = foil). */
export interface CardBackSkin { pattern: BackPattern; base: string; ink: string; border: string; finish: Finish }
/** `rimFinish` is the T3D-8 3D table edge. */
export interface TableSkin { felt: string; rim: string; text: string; rimFinish: Finish }

const BACKS: Record<string, CardBackSkin> = {
  'callbreak.cardBack.classic': { pattern: 'lattice', base: '#1f4e8c', ink: '#9cc0f0', border: '#ffffff', finish: 'satin' },
  'callbreak.cardBack.nakshi': { pattern: 'nakshi', base: '#8c2f24', ink: '#f2d6a2', border: '#fff7e6', finish: 'satin' },
  'callbreak.cardBack.jamdani': { pattern: 'jamdani', base: '#f4efe3', ink: '#2f6f73', border: '#2f6f73', finish: 'satin' },
  'callbreak.cardBack.royal': { pattern: 'royal', base: '#2a1440', ink: '#f2c14e', border: '#f2c14e', finish: 'gloss' },
  // T3D-8 3D sets.
  'callbreak.cardBack.indigo': { pattern: 'lattice', base: '#2b2d7a', ink: '#c7c9ff', border: '#e8e9ff', finish: 'satin' },
  'callbreak.cardBack.goldFoil': { pattern: 'royal', base: '#3a2a08', ink: '#f5d46a', border: '#f5d46a', finish: 'metal' },
};

const TABLES: Record<string, TableSkin> = {
  'callbreak.table.classic': { felt: '#1e6b47', rim: '#0f3d28', text: '#f4f1e8', rimFinish: 'wood' },
  'callbreak.table.rosewood': { felt: '#7a3a2a', rim: '#4a1f15', text: '#fbeee0', rimFinish: 'wood' },
  'callbreak.table.teaGarden': { felt: '#3f7d3a', rim: '#24481f', text: '#f3f7e6', rimFinish: 'wood' },
  'callbreak.table.night': { felt: '#1d2340', rim: '#0d1024', text: '#e6e9ff', rimFinish: 'gloss' },
  // T3D-8 3D sets.
  'callbreak.table.blueFelt': { felt: '#1f4f86', rim: '#5a3418', text: '#eef4ff', rimFinish: 'wood' },
  'callbreak.table.velvet': { felt: '#6b0f35', rim: '#c9a227', text: '#fff0f5', rimFinish: 'metal' },
};

const keyOf = (id: string): string => cosmeticById(id)?.assetKey ?? '';

export const cardBackSkin = (id: string | undefined): CardBackSkin =>
  BACKS[keyOf(itemOrDefault(id, 'cardBack', 'callbreak'))] ?? BACKS['callbreak.cardBack.classic']!;
export const tableSkin = (id: string | undefined): TableSkin =>
  TABLES[keyOf(itemOrDefault(id, 'table', 'callbreak'))] ?? TABLES['callbreak.table.classic']!;

export interface CbLook { back: CardBackSkin; table: TableSkin }

/** The look for one player's equipped Callbreak items (missing = the free defaults). */
export function cbLook(equipped: Readonly<Record<string, string>> | undefined): CbLook {
  const e = equipped ?? DEFAULT_SLOTS.callbreak;
  return { back: cardBackSkin(e.cardBack), table: tableSkin(e.table) };
}

/** T3D-8 known asset keys (tests check every catalogue item has a look). */
export const CB_ASSET_KEYS: readonly string[] = [...Object.keys(BACKS), ...Object.keys(TABLES)];
