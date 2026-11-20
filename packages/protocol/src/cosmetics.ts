/**
 * COS-1: the cosmetics catalogue. Looks only: an item names a skin the client
 * draws by `assetKey`; nothing here changes how a shot plays. This file has no
 * imports, so the server and client can both load it, and the engine never does.
 */

export type CosmeticType = 'striker' | 'coins' | 'board';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CosmeticItem {
  id: string;
  type: CosmeticType;
  /** Coins. 0 = a default item everyone owns (COS-5). */
  price: number;
  rarity: Rarity;
  /** The client's skin key (`game/skins.ts`). */
  assetKey: string;
}

/** The item id equipped in each slot. */
export interface Equipped { striker: string; coins: string; board: string }

export const COSMETIC_TYPES: readonly CosmeticType[] = ['striker', 'coins', 'board'];

/** COS-5: owned by everyone, equipped until a player picks something else. */
export const DEFAULT_EQUIPPED: Readonly<Equipped> = {
  striker: 'classic-striker', coins: 'classic-coins', board: 'classic-board',
};

export const COSMETICS: readonly CosmeticItem[] = [
  { id: 'classic-striker', type: 'striker', price: 0, rarity: 'common', assetKey: 'striker.classic' },
  { id: 'ruby-striker', type: 'striker', price: 150, rarity: 'rare', assetKey: 'striker.ruby' },
  { id: 'emerald-striker', type: 'striker', price: 150, rarity: 'rare', assetKey: 'striker.emerald' },
  { id: 'gold-striker', type: 'striker', price: 400, rarity: 'epic', assetKey: 'striker.gold' },
  { id: 'galaxy-striker', type: 'striker', price: 900, rarity: 'legendary', assetKey: 'striker.galaxy' },
  { id: 'classic-coins', type: 'coins', price: 0, rarity: 'common', assetKey: 'coins.classic' },
  { id: 'jade-coins', type: 'coins', price: 200, rarity: 'rare', assetKey: 'coins.jade' },
  { id: 'pearl-coins', type: 'coins', price: 350, rarity: 'epic', assetKey: 'coins.pearl' },
  { id: 'neon-coins', type: 'coins', price: 700, rarity: 'legendary', assetKey: 'coins.neon' },
  { id: 'classic-board', type: 'board', price: 0, rarity: 'common', assetKey: 'board.classic' },
  { id: 'teak-board', type: 'board', price: 250, rarity: 'rare', assetKey: 'board.teak' },
  { id: 'midnight-board', type: 'board', price: 500, rarity: 'epic', assetKey: 'board.midnight' },
  { id: 'royal-board', type: 'board', price: 800, rarity: 'legendary', assetKey: 'board.royal' },
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string): CosmeticItem | undefined {
  return BY_ID.get(id);
}

/** COS-5 a default item (price 0) is owned by everyone. */
export function isDefaultItem(id: string): boolean {
  return BY_ID.get(id)?.price === 0;
}

/** Does a player with these bought ids own `id`? */
export function ownsItem(owned: readonly string[], id: string): boolean {
  return isDefaultItem(id) || (BY_ID.has(id) && owned.includes(id));
}

/** Everything a player owns: the defaults plus known bought ids, in catalogue order. */
export function ownedItems(bought: readonly string[]): string[] {
  return COSMETICS.filter((c) => ownsItem(bought, c.id)).map((c) => c.id);
}

/** The id of `type` among `ids`, if one is a known item of that type (last wins). */
function pick(ids: readonly string[], type: CosmeticType): string | undefined {
  return [...ids].reverse().find((id) => BY_ID.get(id)?.type === type);
}

/** The equipped item per slot from a stored id list; unknown or missing → the default. */
export function resolveEquipped(ids: readonly string[]): Equipped {
  return {
    striker: pick(ids, 'striker') ?? DEFAULT_EQUIPPED.striker,
    coins: pick(ids, 'coins') ?? DEFAULT_EQUIPPED.coins,
    board: pick(ids, 'board') ?? DEFAULT_EQUIPPED.board,
  };
}

/** A known item of `type`, or that slot's default (for ids that come over the wire). */
export function itemOrDefault(id: string | undefined, type: CosmeticType): string {
  return id !== undefined && BY_ID.get(id)?.type === type ? id : DEFAULT_EQUIPPED[type];
}
