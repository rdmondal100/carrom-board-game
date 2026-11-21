import { cosmeticById, DEFAULT_SLOTS, itemOrDefault } from '@carrom/protocol';

/** CB-9 looks only: nothing here changes play. Unknown keys draw the classic look. */

export type BackPattern = 'lattice' | 'nakshi' | 'jamdani' | 'royal';
export interface CardBackSkin { pattern: BackPattern; base: string; ink: string; border: string }
export interface TableSkin { felt: string; rim: string; text: string }

const BACKS: Record<string, CardBackSkin> = {
  'callbreak.cardBack.classic': { pattern: 'lattice', base: '#1f4e8c', ink: '#9cc0f0', border: '#ffffff' },
  'callbreak.cardBack.nakshi': { pattern: 'nakshi', base: '#8c2f24', ink: '#f2d6a2', border: '#fff7e6' },
  'callbreak.cardBack.jamdani': { pattern: 'jamdani', base: '#f4efe3', ink: '#2f6f73', border: '#2f6f73' },
  'callbreak.cardBack.royal': { pattern: 'royal', base: '#2a1440', ink: '#f2c14e', border: '#f2c14e' },
};

const TABLES: Record<string, TableSkin> = {
  'callbreak.table.classic': { felt: '#1e6b47', rim: '#0f3d28', text: '#f4f1e8' },
  'callbreak.table.rosewood': { felt: '#7a3a2a', rim: '#4a1f15', text: '#fbeee0' },
  'callbreak.table.teaGarden': { felt: '#3f7d3a', rim: '#24481f', text: '#f3f7e6' },
  'callbreak.table.night': { felt: '#1d2340', rim: '#0d1024', text: '#e6e9ff' },
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
