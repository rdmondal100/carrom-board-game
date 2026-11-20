import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { IapVerifyResponse } from '@carrom/protocol/api';
import { Purchase } from '../models/purchase.model.js';
import { isDuplicateKey, toPublicUser, User } from '../models/user.model.js';
import { IAP_CONFIG, IAP_PRODUCT_IDS, packCoins } from '../utils/iapConfig.js';
import { logger } from '../utils/logger.js';
import { CANCELLED, PENDING, PURCHASED, type PlayBilling } from '../utils/playBilling.js';
import { parseBody } from './auth.controller.js';
import { userIdOr401 } from './wallet.controller.js';

export const IAP_OFF = 'In-app purchases are not available';
export const INVALID_PURCHASE = 'Invalid purchase';
export const CANCELLED_PURCHASE = 'Purchase was cancelled or refunded';
export const NOT_YOUR_PURCHASE = 'Purchase belongs to another account';

const verifyBody = z.strictObject({
  productId: z.enum(IAP_PRODUCT_IDS),
  purchaseToken: z.string().min(1).max(IAP_CONFIG.tokenMax),
});

/** The purchase row for this token: created as pending on first sight (parallel calls end up on one row). */
async function rowFor(userId: string, productId: string, purchaseToken: string) {
  const query = { purchaseToken };
  const insert = { $setOnInsert: { userId, productId, purchaseToken, coins: packCoins(productId), status: 'pending' } };
  try {
    return await Purchase.findOneAndUpdate(query, insert, { upsert: true, returnDocument: 'after' });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return Purchase.findOne(query);
  }
}

async function answer(res: Response, http: number, userId: string, body: Omit<IapVerifyResponse, 'user'>) {
  const user = await User.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  res.status(http).json({ ...body, user: toPublicUser(user) } satisfies IapVerifyResponse);
}

/**
 * IAP-3/4 POST /iap/verify { productId, purchaseToken }: ask Google about the
 * token, record it, credit the pack once (idempotent by token), then consume
 * it so it can be bought again. Pending payments answer 202 and are credited
 * when the client sends them again after they complete.
 */
export function verifyPurchase(billing: PlayBilling | null): RequestHandler {
  return async (req, res) => {
    try {
      const userId = userIdOr401(res);
      if (!userId) return;
      if (!billing) {
        res.status(503).json({ error: IAP_OFF });
        return;
      }
      const body = parseBody(verifyBody, req, res);
      if (!body) return;
      const { productId, purchaseToken } = body;

      const info = await billing.getProduct(productId, purchaseToken);
      if (!info || (info.purchaseState !== PURCHASED && info.purchaseState !== PENDING && info.purchaseState !== CANCELLED)) {
        res.status(400).json({ error: INVALID_PURCHASE });
        return;
      }
      if (info.purchaseState === CANCELLED) {
        res.status(400).json({ error: CANCELLED_PURCHASE });
        return;
      }
      if (info.accountId !== null && info.accountId !== userId) {
        res.status(403).json({ error: NOT_YOUR_PURCHASE });
        return;
      }

      const row = await rowFor(userId, productId, purchaseToken);
      if (!row || row.userId !== userId || row.productId !== productId) {
        res.status(409).json({ error: NOT_YOUR_PURCHASE });
        return;
      }
      if (info.purchaseState === PENDING) {
        await answer(res, 202, userId, { status: 'pending', credited: 0 });
        return;
      }

      // Record first, then credit: only the call that flips pending → credited pays.
      const won = await Purchase.findOneAndUpdate(
        { purchaseToken, status: 'pending' },
        { $set: { status: 'credited', orderId: info.orderId } },
      );
      const credited = won ? row.coins : 0;
      if (won) await User.updateOne({ _id: userId }, { $inc: { coins: credited } });

      if (info.consumptionState === 0) {
        // Not fatal: the client sends unconsumed purchases again on the next start.
        await billing.consume(productId, purchaseToken).catch((err: unknown) => logger.error('iap consume failed', err));
      }
      await answer(res, 200, userId, { status: 'credited', credited });
    } catch (err) {
      logger.error('iap verify failed', err);
      res.status(500).json({ error: 'Purchase check failed' });
    }
  };
}
