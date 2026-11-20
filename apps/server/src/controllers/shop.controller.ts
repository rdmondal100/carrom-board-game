import type { RequestHandler } from 'express';
import { z } from 'zod';
import { cosmeticById, COSMETIC_TYPES, ownsItem, resolveEquipped, type Equipped } from '@carrom/protocol';
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
const equipBody = z.strictObject({
  striker: z.string().optional(),
  coins: z.string().optional(),
  board: z.string().optional(),
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

/** COS-4 PATCH /me/equip { striker?, coins?, board? }: only owned items of that slot. */
export const equip: RequestHandler = async (req, res) => {
  try {
    const body = parseBody(equipBody, req, res);
    if (!body) return;
    const userId = userIdOr401(res);
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    const next: Equipped = resolveEquipped(user.cosmetics?.equipped ?? []);
    for (const slot of COSMETIC_TYPES) {
      const id = body[slot];
      if (id === undefined) continue;
      if (cosmeticById(id)?.type !== slot) {
        res.status(400).json({ error: `${slot}: ${UNKNOWN_ITEM}` });
        return;
      }
      if (!ownsItem(user.cosmetics?.owned ?? [], id)) {
        res.status(403).json({ error: NOT_OWNED });
        return;
      }
      next[slot] = id;
    }
    const saved = await User.findByIdAndUpdate(
      userId,
      { $set: { 'cosmetics.equipped': [next.striker, next.coins, next.board] } },
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
