// COS-6: skins drawn by asset key. Procedural colours only (no image textures yet).
// Looks only: nothing here reaches the engine or changes a shot.
import { cosmeticById, DEFAULT_EQUIPPED, itemOrDefault, type Equipped, type SlotOf } from '@carrom/protocol';
import { BOARD_COLOURS, PIECE_STYLES, type PieceStyle } from '@/constants/view';
import type { Finish } from '@/game3d/finish';

/** The board colours a board skin may change (shadow, guide lines etc. stay fixed). */
export type BoardPalette = Record<
  'frame' | 'frameLight' | 'frameEdge' | 'surface' | 'surfaceGlow' | 'surfaceEdge' | 'line' | 'accent' | 'pocket' | 'pocketRim',
  number
>;

export interface CoinSkin { white: PieceStyle; black: PieceStyle; red: PieceStyle }

const CLASSIC_BOARD: BoardPalette = {
  frame: BOARD_COLOURS.frame, frameLight: BOARD_COLOURS.frameLight, frameEdge: BOARD_COLOURS.frameEdge,
  surface: BOARD_COLOURS.surface, surfaceGlow: BOARD_COLOURS.surfaceGlow, surfaceEdge: BOARD_COLOURS.surfaceEdge,
  line: BOARD_COLOURS.line, accent: BOARD_COLOURS.accent, pocket: BOARD_COLOURS.pocket, pocketRim: BOARD_COLOURS.pocketRim,
};

export const STRIKER_SKINS: Record<string, PieceStyle> = {
  'striker.classic': PIECE_STYLES.striker,
  'striker.ruby': { hi: 0xffb3c1, base: 0xc2185b, edge: 0x5c0a2b, ring: 0x5c0a2b, ringLight: 0xffd1dc },
  'striker.emerald': { hi: 0xb9f6ca, base: 0x14915a, edge: 0x07402a, ring: 0x07402a, ringLight: 0xd7ffe6 },
  'striker.gold': { hi: 0xfff6c2, base: 0xd4a017, edge: 0x6b4e05, ring: 0x6b4e05, ringLight: 0xfff3b0 },
  'striker.galaxy': { hi: 0xd9c2ff, base: 0x3b1a7a, edge: 0x0d0526, ring: 0x00e5ff, ringLight: 0xff7af6 },
};

export const COIN_SKINS: Record<string, CoinSkin> = {
  'coins.classic': { white: PIECE_STYLES.white, black: PIECE_STYLES.black, red: PIECE_STYLES.red },
  'coins.jade': {
    white: { hi: 0xffffff, base: 0xd8f3e4, edge: 0x7fb89a, ring: 0x5d9479, ringLight: 0xffffff },
    black: { hi: 0x6fcf97, base: 0x1e6b46, edge: 0x07301d, ring: 0x07301d, ringLight: 0x9fe3bd },
    red: PIECE_STYLES.red,
  },
  'coins.pearl': {
    white: { hi: 0xffffff, base: 0xf7f1ff, edge: 0xb9a9d6, ring: 0x9a88bd, ringLight: 0xffffff },
    black: { hi: 0x8c7aa8, base: 0x2e2140, edge: 0x0c0714, ring: 0x0c0714, ringLight: 0xb7a6d6 },
    red: { hi: 0xffc6d4, base: 0xe0457b, edge: 0x7a1239, ring: 0x7a1239, ringLight: 0xffdbe6 },
  },
  'coins.neon': {
    white: { hi: 0xffffff, base: 0x9ff7ff, edge: 0x1aa6b8, ring: 0x0a6e7a, ringLight: 0xffffff },
    black: { hi: 0xff9cf2, base: 0x7a1673, edge: 0x2a0428, ring: 0xff4fe0, ringLight: 0xffc2f6 },
    red: { hi: 0xfff59d, base: 0xff6d00, edge: 0x7a2c00, ring: 0x7a2c00, ringLight: 0xffe0b2 },
  },
};

export const BOARD_SKINS: Record<string, BoardPalette> = {
  'board.classic': CLASSIC_BOARD,
  'board.teak': {
    ...CLASSIC_BOARD, frame: 0x7a3f12, frameLight: 0x9c5a24, frameEdge: 0x3d1d06,
    surface: 0xd9b07a, surfaceGlow: 0xe8c695, surfaceEdge: 0xb88a52, line: 0x40220c, accent: 0x8a2a12,
  },
  'board.midnight': {
    ...CLASSIC_BOARD, frame: 0x1b2433, frameLight: 0x2c3a52, frameEdge: 0x0a0f17,
    surface: 0x3d4f6b, surfaceGlow: 0x52688a, surfaceEdge: 0x2a3850, line: 0xc8d6ec, accent: 0x4fc3f7, pocketRim: 0x0a0f17,
  },
  'board.royal': {
    ...CLASSIC_BOARD, frame: 0x4a0d2e, frameLight: 0x6e1a46, frameEdge: 0x22041a,
    surface: 0xf0e2c0, surfaceGlow: 0xfff3d6, surfaceEdge: 0xd8c08a, line: 0x5a3a10, accent: 0xc9a227, pocketRim: 0x22041a,
  },
};

// T3D-8 sets made for the 3D view (their 2D colours below).
Object.assign(STRIKER_SKINS, {
  'striker.ivory': { hi: 0xffffff, base: 0xf3ead6, edge: 0xb8a988, ring: 0x9c8b66, ringLight: 0xffffff },
  'striker.chrome': { hi: 0xffffff, base: 0xb8c2cc, edge: 0x4a5560, ring: 0x2d343b, ringLight: 0xf2f6fa },
  'striker.crystal': { hi: 0xffffff, base: 0xbfe9ff, edge: 0x5aa9d6, ring: 0x2f7fb0, ringLight: 0xffffff },
} satisfies Record<string, PieceStyle>);
Object.assign(COIN_SKINS, {
  'coins.rosewood': {
    white: { hi: 0xffe8c8, base: 0xd9a46a, edge: 0x7a4a1c, ring: 0x6b3d12, ringLight: 0xffe3bf },
    black: { hi: 0x9a5a3a, base: 0x5a2416, edge: 0x240b05, ring: 0x240b05, ringLight: 0xb86a4a },
    red: PIECE_STYLES.red,
  },
  'coins.marble': {
    white: { hi: 0xffffff, base: 0xeeeae2, edge: 0xa8a090, ring: 0x8a8070, ringLight: 0xffffff },
    black: { hi: 0x6a6a72, base: 0x23232a, edge: 0x050507, ring: 0xc9a227, ringLight: 0x8a8a92 },
    red: { hi: 0xffb3a8, base: 0xb3261e, edge: 0x4a0a06, ring: 0xc9a227, ringLight: 0xffd0c8 },
  },
  'coins.goldSilver': {
    white: { hi: 0xffffff, base: 0xc9ced6, edge: 0x5d646d, ring: 0x3f454d, ringLight: 0xf4f6f9 },
    black: { hi: 0xfff1b0, base: 0xc99a1e, edge: 0x5e4306, ring: 0x5e4306, ringLight: 0xfff0b8 },
    red: { hi: 0xffc2a8, base: 0xc2410c, edge: 0x5a1a02, ring: 0xf5cf5a, ringLight: 0xffe0cc },
  },
} satisfies Record<string, CoinSkin>);
Object.assign(BOARD_SKINS, {
  'board.birch': {
    ...CLASSIC_BOARD, frame: 0xa8794a, frameLight: 0xc89a66, frameEdge: 0x5a3a1c,
    surface: 0xf2dfbc, surfaceGlow: 0xfbeed2, surfaceEdge: 0xdcc39a, line: 0x5a3a1c,
  },
  'board.neon': {
    ...CLASSIC_BOARD, frame: 0x14102a, frameLight: 0x2a1f55, frameEdge: 0x05030f,
    surface: 0x1c1838, surfaceGlow: 0x2a2552, surfaceEdge: 0x120f26, line: 0x4ff0ff, accent: 0xff4fd8, pocketRim: 0xff4fd8,
  },
  'board.marble': {
    ...CLASSIC_BOARD, frame: 0x2b2b30, frameLight: 0x45454c, frameEdge: 0x0d0d10,
    surface: 0xeeeae2, surfaceGlow: 0xffffff, surfaceEdge: 0xd8d2c4, line: 0x3a3a40, accent: 0xc9a227, pocketRim: 0xc9a227,
  },
} satisfies Record<string, BoardPalette>);

/** T3D-8 how each piece set looks in 3D, by asset key (unknown → gloss). */
const PIECE_FINISH: Record<string, Finish> = {
  'striker.classic': 'gloss', 'striker.ruby': 'gloss', 'striker.emerald': 'gloss', 'striker.gold': 'metal',
  'striker.galaxy': 'pearl', 'striker.ivory': 'satin', 'striker.chrome': 'metal', 'striker.crystal': 'glass',
  'coins.classic': 'gloss', 'coins.jade': 'gloss', 'coins.pearl': 'pearl', 'coins.neon': 'glow',
  'coins.rosewood': 'wood', 'coins.marble': 'marble', 'coins.goldSilver': 'metal',
};
/** T3D-8 a board's frame and playing surface in 3D. */
export interface BoardFinish { frame: Finish; surface: Finish }
const BOARD_FINISH: Record<string, BoardFinish> = {
  'board.classic': { frame: 'wood', surface: 'wood' }, 'board.teak': { frame: 'wood', surface: 'wood' },
  'board.midnight': { frame: 'satin', surface: 'satin' }, 'board.royal': { frame: 'wood', surface: 'gloss' },
  'board.birch': { frame: 'wood', surface: 'wood' }, 'board.neon': { frame: 'glow', surface: 'gloss' },
  'board.marble': { frame: 'marble', surface: 'marble' },
};

/** The asset key of a known item of `type`, else that slot's default key. */
function keyOf(id: string | undefined, type: SlotOf<'carrom'>): string {
  return cosmeticById(itemOrDefault(id, type))!.assetKey;
}

export function strikerStyle(itemId: string | undefined): PieceStyle {
  return STRIKER_SKINS[keyOf(itemId, 'striker')] ?? PIECE_STYLES.striker;
}

export function coinSkin(itemId: string | undefined): CoinSkin {
  return COIN_SKINS[keyOf(itemId, 'coins')] ?? COIN_SKINS['coins.classic']!;
}

export function boardPalette(itemId: string | undefined): BoardPalette {
  return BOARD_SKINS[keyOf(itemId, 'board')] ?? CLASSIC_BOARD;
}

/** T3D-8 the 3D finish of a striker or coin set item. */
export const pieceFinish = (itemId: string | undefined, type: 'striker' | 'coins'): Finish => PIECE_FINISH[keyOf(itemId, type)] ?? 'gloss';
export const boardFinish = (itemId: string | undefined): BoardFinish => BOARD_FINISH[keyOf(itemId, 'board')] ?? BOARD_FINISH['board.classic']!;

/** What one board shows: a striker per seat (0..3), one coin set, one board. Item ids. */
export interface BoardSkins { strikers: readonly string[]; coins: string; board: string }

export const DEFAULT_SKINS: BoardSkins = {
  strikers: [0, 1, 2, 3].map(() => DEFAULT_EQUIPPED.striker),
  coins: DEFAULT_EQUIPPED.coins,
  board: DEFAULT_EQUIPPED.board,
};

/** Same device / Vs bot: this player's equipped items for every seat (classic when signed out). */
export function localSkins(eq: Equipped | undefined): BoardSkins {
  if (!eq) return DEFAULT_SKINS;
  return { strikers: [0, 1, 2, 3].map(() => eq.striker), coins: eq.coins, board: eq.board };
}

/**
 * COS-6 online: each seat's own striker; the coin set of the player who broke
 * this board (so everyone sees the same coins); the board is this player's own.
 */
export function onlineSkins(
  players: readonly { seat: number; striker?: string; coinSet?: string }[], breakSeat: number, ownBoard: string | undefined,
): BoardSkins {
  const at = (seat: number) => players.find((p) => p.seat === seat);
  return {
    strikers: [0, 1, 2, 3].map((s) => itemOrDefault(at(s)?.striker, 'striker')),
    coins: itemOrDefault(at(breakSeat)?.coinSet, 'coins'),
    board: itemOrDefault(ownBoard, 'board'),
  };
}

/** `#rrggbb` for SVG / CSS (the shop preview). */
export function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** T3D-8 known asset keys (tests check every catalogue item has a look). */
export const CARROM_ASSET_KEYS: readonly string[] = [...Object.keys(STRIKER_SKINS), ...Object.keys(COIN_SKINS), ...Object.keys(BOARD_SKINS)];
