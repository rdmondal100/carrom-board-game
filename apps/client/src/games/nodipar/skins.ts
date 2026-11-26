import { cosmeticById, DEFAULT_SLOTS, itemOrDefault } from '@carrom/protocol';
import type { Finish } from '@/game3d/finish';

/** NODI-6 looks only: nothing here changes play. Unknown keys draw the classic look. */

export interface BoatSkin {
  /** Owner colours per seat 0..3 (seat colour stays recognisable in every set). */
  colors: readonly [number, number, number, number];
  /** The hull's light edge and the sail / mark drawn on top. */
  edge: number;
  mark: number;
  shape: 'disc' | 'nouka' | 'lotus';
  /** T3D-8 the hull's 3D surface. */
  finish: Finish;
}

export interface RiverSkin {
  water: number;
  waterDeep: number;
  bank: number;
  bankEdge: number;
  ring: number;
  island: number;
  rock: number;
  whirl: number;
  line: number;
}

/** Seat colours: 0 red, 1 green, 2 yellow, 3 blue. */
const SEAT = [0xd9463b, 0x2f9e5b, 0xe8b52c, 0x2f6fc4] as const;

const BOATS: Record<string, BoatSkin> = {
  'nodipar.boat.classic': { colors: SEAT, edge: 0xffffff, mark: 0xfff4e0, shape: 'disc', finish: 'gloss' },
  'nodipar.boat.nouka': { colors: [0xb5452f, 0x3f8f4f, 0xd49b2a, 0x335f9e], edge: 0x3b2412, mark: 0xf3e3c3, shape: 'nouka', finish: 'satin' },
  'nodipar.boat.lotus': { colors: [0xe0457b, 0x2fb58f, 0xf2c14e, 0x6a6cf0], edge: 0xffe9f2, mark: 0xffffff, shape: 'lotus', finish: 'pearl' },
  'nodipar.boat.golden': { colors: [0xc8553d, 0x4a9e6a, 0xf5cf5a, 0x4a78c8], edge: 0xf5cf5a, mark: 0x5a3b00, shape: 'nouka', finish: 'metal' },
  // T3D-8 3D sets.
  'nodipar.boat.teak': { colors: [0xa8442e, 0x4f7f3a, 0xc9922e, 0x3f5f8f], edge: 0x5a3418, mark: 0xf3e3c3, shape: 'nouka', finish: 'wood' },
  'nodipar.boat.crystal': { colors: [0xff7a8a, 0x5ae0a8, 0xffdd77, 0x7ab4ff], edge: 0xffffff, mark: 0xffffff, shape: 'lotus', finish: 'glass' },
};

const RIVERS: Record<string, RiverSkin> = {
  'nodipar.river.classic': {
    water: 0x4a90b8, waterDeep: 0x2f6f96, bank: 0xc9a66b, bankEdge: 0x8c6a3a, ring: 0xf4e6c0, island: 0x8fbf6a,
    rock: 0x6b6b6b, whirl: 0x1b4b6b, line: 0xffffff,
  },
  'nodipar.river.sundarban': {
    water: 0x3f7f6e, waterDeep: 0x2a5a4c, bank: 0x6b8f3a, bankEdge: 0x3e5a1e, ring: 0xe8efc8, island: 0x4f8a3a,
    rock: 0x5a5245, whirl: 0x173f35, line: 0xf2f7e8,
  },
  'nodipar.river.dusk': {
    water: 0xb7687a, waterDeep: 0x7a3e5a, bank: 0xd9a45b, bankEdge: 0x8a5a2a, ring: 0xffe2b8, island: 0xa3a05a,
    rock: 0x5e4a52, whirl: 0x4a2238, line: 0xfff0e0,
  },
  'nodipar.river.moonlit': {
    water: 0x1d2a4a, waterDeep: 0x111a33, bank: 0x3a3f5a, bankEdge: 0x22263a, ring: 0xd8e2ff, island: 0x34507a,
    rock: 0x6e7590, whirl: 0x0a1022, line: 0xd8e2ff,
  },
  // T3D-8 3D sets.
  'nodipar.river.monsoon': {
    water: 0x5a7f8c, waterDeep: 0x3a5a66, bank: 0x7a8a4a, bankEdge: 0x4a5a2a, ring: 0xeef3e0, island: 0x6a9a4a,
    rock: 0x5a5a5a, whirl: 0x24414a, line: 0xf0f6f8,
  },
  'nodipar.river.goldenHour': {
    water: 0xe08a4a, waterDeep: 0xa8552a, bank: 0xe8c07a, bankEdge: 0x9a6a2a, ring: 0xfff1d0, island: 0xb8a24a,
    rock: 0x6a4a3a, whirl: 0x6a2a14, line: 0xfff6e0,
  },
};

/** T3D-8 known asset keys (tests check every catalogue item has a look). */
export const NODI_ASSET_KEYS: readonly string[] = [...Object.keys(BOATS), ...Object.keys(RIVERS)];

const keyOf = (id: string): string => cosmeticById(id)?.assetKey ?? '';

export const boatSkin = (id: string | undefined): BoatSkin =>
  BOATS[keyOf(itemOrDefault(id, 'boat', 'nodipar'))] ?? BOATS['nodipar.boat.classic']!;
export const riverSkin = (id: string | undefined): RiverSkin =>
  RIVERS[keyOf(itemOrDefault(id, 'river', 'nodipar'))] ?? RIVERS['nodipar.river.classic']!;

export interface NodiLook { boat: BoatSkin; river: RiverSkin }

/** The look for one player's equipped Nodi Par items (missing = the free defaults). */
export function nodiLook(equipped: Readonly<Record<string, string>> | undefined): NodiLook {
  const e = equipped ?? DEFAULT_SLOTS.nodipar;
  return { boat: boatSkin(e.boat), river: riverSkin(e.river) };
}

export const seatColor = (seat: number): string => `#${SEAT[seat % 4]!.toString(16).padStart(6, '0')}`;
export const teamColor = (team: 'A' | 'B', players: 2 | 4): string => seatColor(team === 'A' ? 0 : players === 2 ? 2 : 1);
