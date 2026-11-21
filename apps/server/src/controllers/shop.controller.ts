import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
  COSMETIC_GAMES, cosmeticById, equippedEntries, fitsSlot, GAME_SLOTS, isSlotOf, ownsItem, resolveEquippedMap,
  type CosmeticGame,
} from '@carrom/protocol';
import type { MeResponse } from '@carrom/protocol/api';
import { toPublicUser, User } from '../models/user.model.js';
import { logger } from '../utils/logger.js';
import { parseBody } from './auth.controller.js';
import { userIdOr401 } from './wallet.controller.js';

export const UNKNOWN_ITEM = 'Unknown item';
export const NOT_ENOUGH_COINS = 'Not enough coins';
export const ALREADY_OWNED = 'You already own this item';
export const NOT_OWNED = 'You do not own this item';

const buyBody = z.strictObject({ itemId: z.string().min(1, 'itemId is required') });
/** Every slot name of every game (HAPP-5); each must belong to the body's game. */
const ALL_SLOTS = [...new Set(COSMETIC_GAMES.flatMap((g) => GAME_SLOTS[g]))];
const equipBody = z.strictObject({
  game: z.enum(COSMETIC_GAMES as [CosmeticGame, ...CosmeticGame[]]).default('carrom'),
  ...Object.fromEntries(ALL_SLOTS.map((s) => [s, z.string().optional()])),
});

/**
 * COS-3 POST /shop/buy { itemId }: one atomic update that only matches when the
 * player has the coins and doesn't own the item, so a double buy charges once.
 */
export const buy: RequestHandler = async (req, res) => {
  try {
    const body = parseBody(buyBody, req, res);
    if (!body) return;
    const userId = userIdOr401(res);
    if (!userId) return;
    const item = cosmeticById(body.itemId);
    if (!item) {
      res.status(400).json({ error: UNKNOWN_ITEM });
      return;
    }
    if (item.price === 0) {
      res.status(409).json({ error: ALREADY_OWNED });
      return;
    }
    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: item.price }, 'cosmetics.owned': { $ne: item.id } },
      { $inc: { coins: -item.price }, $push: { 'cosmetics.owned': item.id } },
      { returnDocument: 'after' },
    );
    if (user) {
      res.status(200).json({ user: toPublicUser(user) } satisfies MeResponse);
      return;
    }
    // Nothing matched: say why.
    const now = await User.findById(userId);
    if (!now) res.status(401).json({ error: 'Account not found' });
    else if (now.cosmetics?.owned.includes(item.id)) res.status(409).json({ error: ALREADY_OWNED });
    else res.status(400).json({ error: NOT_ENOUGH_COINS });
  } catch (err) {
    logger.error('buy failed', err);
    res.status(500).json({ error: 'Buying failed' });
  }
};

/**
 * COS-4 / HAPP-5 PATCH /me/equip { game? (default carrom), <slot>? }: only owned
 * items that fit that game's slot. Other games' slots are left as they are.
 */
export const equip: RequestHandler = async (req, res) => {
  try {
    const body = parseBody(equipBody, req, res) as ({ game: CosmeticGame } & Record<string, string | undefined>) | null;
    if (!body) return;
    const userId = userIdOr401(res);
    if (!userId) return;
    const { game } = body;
    const user = await User.findById(userId);
    if (!user) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    const next = resolveEquippedMap(user.cosmetics?.equipped ?? []);
    const slots = next[game] as Record<string, string>;
    for (const slot of ALL_SLOTS) {
      const id = body[slot];
      if (id === undefined) continue;
      if (!isSlotOf(game, slot)) {
        res.status(400).json({ error: `${slot}: not a ${game} slot` });
        return;
      }
      if (!fitsSlot(cosmeticById(id), game, slot)) {
        res.status(400).json({ error: `${slot}: ${UNKNOWN_ITEM}` });
        return;
      }
      if (!ownsItem(user.cosmetics?.owned ?? [], id)) {
        res.status(403).json({ error: NOT_OWNED });
        return;
      }
      slots[slot] = id;
    }
    const saved = await User.findByIdAndUpdate(
      userId,
      { $set: { 'cosmetics.equipped': equippedEntries(next) } },
      { returnDocument: 'after' },
    );
    if (!saved) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    res.status(200).json({ user: toPublicUser(saved) } satisfies MeResponse);
  } catch (err) {
    logger.error('equip failed', err);
    res.status(500).json({ error: 'Equipping failed' });
  }
};
