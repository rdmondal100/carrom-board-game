/**
 * COS-1: the cosmetics catalogue. Looks only: an item names a skin the client
 * draws by `assetKey`; nothing here changes how a game plays. This file has no
 * imports, so the server and client can both load it, and the engine never does.
 */

/**
 * HAPP-5 the cosmetic slots of each game. The keys are game-kit's GAME_IDS
 * (the server's user.model.test checks they match).
 */
export const GAME_SLOTS = {
  carrom: ['striker', 'coins', 'board'],
  ludo: ['tokens', 'board', 'dice'],
  callbreak: ['cardBack', 'table'],
  nodipar: ['boat', 'river'],
} as const;

export type CosmeticGame = keyof typeof GAME_SLOTS;
export type SlotOf<G extends CosmeticGame> = (typeof GAME_SLOTS)[G][number];
export type CosmeticType = SlotOf<CosmeticGame>;
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const COSMETIC_GAMES = Object.keys(GAME_SLOTS) as CosmeticGame[];

export interface CosmeticItem {
  id: string;
  /** HAPP-5 the game it is for; 'any' fits that slot type in every game that has it. */
  game: CosmeticGame | 'any';
  type: CosmeticType;
  /** Coins. 0 = a default item everyone owns (COS-5). */
  price: number;
  rarity: Rarity;
  /** The client's skin key (the game's `skins.ts`). */
  assetKey: string;
}

/** The item id equipped in each slot of one game. */
export type GameSlots<G extends CosmeticGame> = { [S in SlotOf<G>]: string };
/** HAPP-5 every game's equipped items. */
export type EquippedMap = { [G in CosmeticGame]: GameSlots<G> };
/** Carrom's slots (spec 12). */
export type Equipped = GameSlots<'carrom'>;

/** Carrom's slot types (spec 12 name, kept). */
export const COSMETIC_TYPES: readonly SlotOf<'carrom'>[] = GAME_SLOTS.carrom;

/** COS-5: owned by everyone, equipped until a player picks something else. */
export const DEFAULT_SLOTS: Readonly<EquippedMap> = {
  carrom: { striker: 'classic-striker', coins: 'classic-coins', board: 'classic-board' },
  ludo: { tokens: 'classic-tokens', board: 'classic-ludo-board', dice: 'classic-dice' },
  callbreak: { cardBack: 'classic-card-back', table: 'classic-table' },
  nodipar: { boat: 'classic-boat', river: 'classic-river' },
};

/** Carrom's defaults (spec 12 name, kept). */
export const DEFAULT_EQUIPPED: Readonly<Equipped> = DEFAULT_SLOTS.carrom;

export const COSMETICS: readonly CosmeticItem[] = [
  { id: 'classic-striker', game: 'carrom', type: 'striker', price: 0, rarity: 'common', assetKey: 'striker.classic' },
  { id: 'ruby-striker', game: 'carrom', type: 'striker', price: 150, rarity: 'rare', assetKey: 'striker.ruby' },
  { id: 'emerald-striker', game: 'carrom', type: 'striker', price: 150, rarity: 'rare', assetKey: 'striker.emerald' },
  { id: 'gold-striker', game: 'carrom', type: 'striker', price: 400, rarity: 'epic', assetKey: 'striker.gold' },
  { id: 'galaxy-striker', game: 'carrom', type: 'striker', price: 900, rarity: 'legendary', assetKey: 'striker.galaxy' },
  { id: 'classic-coins', game: 'carrom', type: 'coins', price: 0, rarity: 'common', assetKey: 'coins.classic' },
  { id: 'jade-coins', game: 'carrom', type: 'coins', price: 200, rarity: 'rare', assetKey: 'coins.jade' },
  { id: 'pearl-coins', game: 'carrom', type: 'coins', price: 350, rarity: 'epic', assetKey: 'coins.pearl' },
  { id: 'neon-coins', game: 'carrom', type: 'coins', price: 700, rarity: 'legendary', assetKey: 'coins.neon' },
  { id: 'classic-board', game: 'carrom', type: 'board', price: 0, rarity: 'common', assetKey: 'board.classic' },
  { id: 'teak-board', game: 'carrom', type: 'board', price: 250, rarity: 'rare', assetKey: 'board.teak' },
  { id: 'midnight-board', game: 'carrom', type: 'board', price: 500, rarity: 'epic', assetKey: 'board.midnight' },
  { id: 'royal-board', game: 'carrom', type: 'board', price: 800, rarity: 'legendary', assetKey: 'board.royal' },
  // HAPP-5 the other games' free defaults; their shop items come with their specs (18–20).
  { id: 'classic-tokens', game: 'ludo', type: 'tokens', price: 0, rarity: 'common', assetKey: 'ludo.tokens.classic' },
  { id: 'classic-ludo-board', game: 'ludo', type: 'board', price: 0, rarity: 'common', assetKey: 'ludo.board.classic' },
  { id: 'classic-dice', game: 'ludo', type: 'dice', price: 0, rarity: 'common', assetKey: 'ludo.dice.classic' },
  // LUDO-8 Ludo's shop: token sets, board themes and dice (dice may become 'any' when another game rolls).
  { id: 'gem-tokens', game: 'ludo', type: 'tokens', price: 150, rarity: 'rare', assetKey: 'ludo.tokens.gem' },
  { id: 'lantern-tokens', game: 'ludo', type: 'tokens', price: 400, rarity: 'epic', assetKey: 'ludo.tokens.lantern' },
  { id: 'shapla-tokens', game: 'ludo', type: 'tokens', price: 800, rarity: 'legendary', assetKey: 'ludo.tokens.shapla' },
  { id: 'nakshi-ludo-board', game: 'ludo', type: 'board', price: 250, rarity: 'rare', assetKey: 'ludo.board.nakshi' },
  { id: 'river-ludo-board', game: 'ludo', type: 'board', price: 500, rarity: 'epic', assetKey: 'ludo.board.river' },
  { id: 'night-ludo-board', game: 'ludo', type: 'board', price: 800, rarity: 'legendary', assetKey: 'ludo.board.night' },
  { id: 'wood-dice', game: 'ludo', type: 'dice', price: 120, rarity: 'rare', assetKey: 'ludo.dice.wood' },
  { id: 'gold-dice', game: 'ludo', type: 'dice', price: 450, rarity: 'epic', assetKey: 'ludo.dice.gold' },
  { id: 'classic-card-back', game: 'callbreak', type: 'cardBack', price: 0, rarity: 'common', assetKey: 'callbreak.cardBack.classic' },
  { id: 'classic-table', game: 'callbreak', type: 'table', price: 0, rarity: 'common', assetKey: 'callbreak.table.classic' },
  // CB-9 card backs and table themes: looks only.
  { id: 'nakshi-card-back', game: 'callbreak', type: 'cardBack', price: 150, rarity: 'rare', assetKey: 'callbreak.cardBack.nakshi' },
  { id: 'jamdani-card-back', game: 'callbreak', type: 'cardBack', price: 400, rarity: 'epic', assetKey: 'callbreak.cardBack.jamdani' },
  { id: 'royal-card-back', game: 'callbreak', type: 'cardBack', price: 800, rarity: 'legendary', assetKey: 'callbreak.cardBack.royal' },
  { id: 'rosewood-table', game: 'callbreak', type: 'table', price: 250, rarity: 'rare', assetKey: 'callbreak.table.rosewood' },
  { id: 'tea-garden-table', game: 'callbreak', type: 'table', price: 500, rarity: 'epic', assetKey: 'callbreak.table.teaGarden' },
  { id: 'night-table', game: 'callbreak', type: 'table', price: 800, rarity: 'legendary', assetKey: 'callbreak.table.night' },
  { id: 'classic-boat', game: 'nodipar', type: 'boat', price: 0, rarity: 'common', assetKey: 'nodipar.boat.classic' },
  { id: 'classic-river', game: 'nodipar', type: 'river', price: 0, rarity: 'common', assetKey: 'nodipar.river.classic' },
  // NODI-6 boat skins and river themes: looks only.
  { id: 'nouka-boat', game: 'nodipar', type: 'boat', price: 150, rarity: 'rare', assetKey: 'nodipar.boat.nouka' },
  { id: 'lotus-boat', game: 'nodipar', type: 'boat', price: 400, rarity: 'epic', assetKey: 'nodipar.boat.lotus' },
  { id: 'golden-boat', game: 'nodipar', type: 'boat', price: 800, rarity: 'legendary', assetKey: 'nodipar.boat.golden' },
  { id: 'sundarban-river', game: 'nodipar', type: 'river', price: 250, rarity: 'rare', assetKey: 'nodipar.river.sundarban' },
  { id: 'dusk-river', game: 'nodipar', type: 'river', price: 500, rarity: 'epic', assetKey: 'nodipar.river.dusk' },
  { id: 'moonlit-river', game: 'nodipar', type: 'river', price: 800, rarity: 'legendary', assetKey: 'nodipar.river.moonlit' },
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string): CosmeticItem | undefined {
  return BY_ID.get(id);
}

export function isCosmeticGame(id: unknown): id is CosmeticGame {
  return typeof id === 'string' && Object.hasOwn(GAME_SLOTS, id);
}

/** Is `slot` one of `game`'s slots? */
export function isSlotOf(game: CosmeticGame, slot: string): boolean {
  return (GAME_SLOTS[game] as readonly string[]).includes(slot);
}

/** HAPP-5 can `item` go in `game`'s `slot`? */
export function fitsSlot(item: CosmeticItem | undefined, game: CosmeticGame, slot: string): boolean {
  return item !== undefined && item.type === slot && isSlotOf(game, slot) && (item.game === game || item.game === 'any');
}

/** HAPP-5 the catalogue items that fit some slot of `game` ('any' items included). */
export function itemsForGame(game: CosmeticGame): CosmeticItem[] {
  return COSMETICS.filter((c) => fitsSlot(c, game, c.type));
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

/**
 * HAPP-5 stored equip entries: `game:id` (one game's slot) or a bare `id`
 * (spec 12 documents: the slot of that item's own game). Later entries win.
 */
function entryFits(entry: string, game: CosmeticGame, slot: string): string | undefined {
  const cut = entry.indexOf(':');
  if (cut >= 0 && entry.slice(0, cut) !== game) return undefined;
  const id = cut >= 0 ? entry.slice(cut + 1) : entry;
  return fitsSlot(BY_ID.get(id), game, slot) ? id : undefined;
}

/** HAPP-5 one game's equipped item per slot from the stored entries; unknown or missing → the default. */
export function resolveGameSlots<G extends CosmeticGame>(entries: readonly string[], game: G): GameSlots<G> {
  const out: Record<string, string> = { ...DEFAULT_SLOTS[game] };
  for (const slot of GAME_SLOTS[game]) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const id = entryFits(entries[i]!, game, slot);
      if (id !== undefined) {
        out[slot] = id;
        break;
      }
    }
  }
  return out as GameSlots<G>;
}

/** HAPP-5 every game's equipped items from the stored entries. */
export function resolveEquippedMap(entries: readonly string[]): EquippedMap {
  const out = {} as Record<CosmeticGame, Record<string, string>>;
  for (const g of COSMETIC_GAMES) out[g] = resolveGameSlots(entries, g);
  return out as EquippedMap;
}

/** HAPP-5 the entries to store for an equipped map (`game:id`, every slot). */
export function equippedEntries(map: EquippedMap): string[] {
  return COSMETIC_GAMES.flatMap((g) => Object.values<string>(map[g]).map((id) => `${g}:${id}`));
}

/** Carrom's equipped items from the stored entries (spec 12; old id lists resolve as before). */
export function resolveEquipped(entries: readonly string[]): Equipped {
  return resolveGameSlots(entries, 'carrom');
}

/** A known item for `game`'s `type` slot, or that slot's default (for ids that come over the wire). */
export function itemOrDefault<G extends CosmeticGame = 'carrom'>(
  id: string | undefined, type: SlotOf<G>, game: G = 'carrom' as G,
): string {
  if (id !== undefined && fitsSlot(BY_ID.get(id), game, type)) return id;
  return (DEFAULT_SLOTS[game] as Record<string, string>)[type]!;
}
