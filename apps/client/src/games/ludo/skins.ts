import { cosmeticById, DEFAULT_SLOTS, itemOrDefault } from '@carrom/protocol';
import type { Finish } from '@/game3d/finish';

/** LUDO-8 looks only: nothing here changes play. Unknown keys draw the classic look. */

export type TokenShape = 'pawn' | 'gem' | 'lantern' | 'shapla';
/** `finish` is the T3D-8 3D surface. */
export interface TokenSkin { shape: TokenShape; colors: readonly [string, string, string, string]; edge: string; finish: Finish }
/** `rim` and `finish`: the T3D-8 3D slab's sides. */
export interface BoardSkin {
  bg: string; cell: string; line: string; star: string; centre: string; tints: readonly [string, string, string, string];
  rim: string; finish: Finish;
}
/** `glass` draws see-through faces. */
export interface DiceSkin { face: string; pip: string; edge: string; glass?: boolean }

/** Seat colours: 0 red, 1 green, 2 yellow, 3 blue (the classic four, in our own shades). */
const SEAT_COLORS = ['#d9463b', '#2f9e5b', '#e8b52c', '#2f6fc4'] as const;

const TOKENS: Record<string, TokenSkin> = {
  'ludo.tokens.classic': { shape: 'pawn', colors: SEAT_COLORS, edge: '#1f1a17', finish: 'gloss' },
  'ludo.tokens.gem': { shape: 'gem', colors: ['#e0245e', '#1fb58f', '#f2c14e', '#5b6cf0'], edge: '#ffffff', finish: 'pearl' },
  'ludo.tokens.lantern': { shape: 'lantern', colors: ['#ff7a45', '#7bc950', '#ffd166', '#4cc9f0'], edge: '#3b2a1a', finish: 'glow' },
  'ludo.tokens.shapla': { shape: 'shapla', colors: ['#f25c9b', '#46c2a8', '#f7d154', '#7a8cff'], edge: '#fff7e6', finish: 'satin' },
  // T3D-8 3D sets.
  'ludo.tokens.wooden': { shape: 'pawn', colors: ['#b5523b', '#5f8a4a', '#d0a24a', '#4f6f9a'], edge: '#3b2412', finish: 'wood' },
  'ludo.tokens.crystal': { shape: 'gem', colors: ['#ff6b81', '#3ddc97', '#ffd76a', '#6aa8ff'], edge: '#ffffff', finish: 'glass' },
  'ludo.tokens.gold': { shape: 'pawn', colors: ['#c8553d', '#3f9e6a', '#f5cf5a', '#4a78c8'], edge: '#5a3b00', finish: 'metal' },
};

const BOARDS: Record<string, BoardSkin> = {
  'ludo.board.classic': { bg: '#f6efe0', cell: '#fffaf0', line: '#8c7a5b', star: '#b58b3a', centre: '#efe3c8', tints: ['#f3c4bf', '#bfe3cc', '#f6e2a6', '#bcd2ef'], rim: '#b07a2a', finish: 'wood' },
  'ludo.board.nakshi': { bg: '#f3e2c7', cell: '#fff3df', line: '#7a3b2e', star: '#b0412e', centre: '#e9cfa6', tints: ['#e9a99c', '#a8d5b5', '#f0d58c', '#a9c1e8'], rim: '#7a3b2e', finish: 'wood' },
  'ludo.board.river': { bg: '#d7ece9', cell: '#f2fbf9', line: '#3c6e71', star: '#1b998b', centre: '#bfe0dc', tints: ['#f0b9b0', '#a6dcc0', '#f2df9b', '#9fc4ec'], rim: '#3c6e71', finish: 'satin' },
  'ludo.board.night': { bg: '#1d2235', cell: '#2b3150', line: '#8a93c9', star: '#ffd166', centre: '#323a5e', tints: ['#6b2f3a', '#245640', '#6b5a24', '#26406b'], rim: '#11142a', finish: 'gloss' },
  // T3D-8 3D sets.
  'ludo.board.wood': { bg: '#e2c497', cell: '#f3e0c0', line: '#6b4420', star: '#8a2a12', centre: '#d9b583', tints: ['#e7a790', '#a9cf9a', '#efd28a', '#9fbcdf'], rim: '#6b3f16', finish: 'wood' },
  'ludo.board.marble': { bg: '#efebe3', cell: '#fbf9f5', line: '#3a3a40', star: '#c9a227', centre: '#e4ddcf', tints: ['#f1c4bf', '#c2e3cf', '#f3e2ad', '#c4d6ef'], rim: '#2b2b30', finish: 'marble' },
};

const DICE: Record<string, DiceSkin> = {
  'ludo.dice.classic': { face: '#ffffff', pip: '#1f1a17', edge: '#cfc6b8' },
  'ludo.dice.wood': { face: '#c99a5b', pip: '#3b2412', edge: '#8a6235' },
  'ludo.dice.gold': { face: '#f5cf5a', pip: '#5a3b00', edge: '#b88a12' },
  'ludo.dice.ivory': { face: '#f6efdf', pip: '#8a2a12', edge: '#d2c3a0' },
  'ludo.dice.crystal': { face: '#cdeeff', pip: '#0b3a5a', edge: '#7cc4ea', glass: true },
};

const keyOf = (id: string): string => cosmeticById(id)?.assetKey ?? '';

export const tokenSkin = (id: string | undefined): TokenSkin =>
  TOKENS[keyOf(itemOrDefault(id, 'tokens', 'ludo'))] ?? TOKENS['ludo.tokens.classic']!;
export const boardSkin = (id: string | undefined): BoardSkin =>
  BOARDS[keyOf(itemOrDefault(id, 'board', 'ludo'))] ?? BOARDS['ludo.board.classic']!;
export const diceSkin = (id: string | undefined): DiceSkin =>
  DICE[keyOf(itemOrDefault(id, 'dice', 'ludo'))] ?? DICE['ludo.dice.classic']!;

export interface LudoLook { tokens: TokenSkin; board: BoardSkin; dice: DiceSkin }

/** The look for one player's equipped Ludo items (missing = the free defaults). */
export function ludoLook(equipped: Readonly<Record<string, string>> | undefined): LudoLook {
  const e = equipped ?? DEFAULT_SLOTS.ludo;
  return { tokens: tokenSkin(e.tokens), board: boardSkin(e.board), dice: diceSkin(e.dice) };
}

/** Each seat's token colour (seat colour stays recognisable in every set). */
export const tokenColor = (skin: TokenSkin, seat: number): string => skin.colors[seat % 4]!;
export const seatColor = (seat: number): string => SEAT_COLORS[seat % 4]!;

/** T3D-8 known asset keys (tests check every catalogue item has a look). */
export const LUDO_ASSET_KEYS: readonly string[] = [...Object.keys(TOKENS), ...Object.keys(BOARDS), ...Object.keys(DICE)];
