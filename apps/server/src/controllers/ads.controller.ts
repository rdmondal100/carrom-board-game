import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import type { AdStatusResponse } from '@carrom/protocol/api';
import { AdReward } from '../models/adReward.model.js';
import { isDuplicateKey, User } from '../models/user.model.js';
import { verifySsv, type KeySource } from '../utils/admobSsv.js';
import { ADS_CONFIG } from '../utils/adsConfig.js';
import { logger } from '../utils/logger.js';
import { cappedLeft, claimCapped, type CapFields } from '../utils/wallet.js';
import { userIdOr401 } from './wallet.controller.js';

export const BAD_SIGNATURE = 'Bad signature';
const AD_CAP: CapFields = { day: 'adRewardDay', count: 'adRewards' };

/** The raw query string as AdMob sent it (the signature covers its exact bytes). */
function rawQuery(url: string): string {
  const at = url.indexOf('?');
  return at < 0 ? '' : url.slice(at + 1);
}

/**
 * AD-3 GET /ads/ssv: AdMob's server-side verification callback. A good
 * signature answers 200 (credited or not: replays and capped rewards are
 * acknowledged so AdMob stops retrying); a bad one answers 400.
 */
export function ssvCallback(keys: KeySource): RequestHandler {
  return async (req, res) => {
    try {
      const reward = await verifySsv(rawQuery(req.originalUrl), keys);
      if (!reward) {
        res.status(400).json({ error: BAD_SIGNATURE });
        return;
      }
      // Idempotent by transaction id: only the first callback is recorded and credited.
      try {
        await AdReward.create({ transactionId: reward.transactionId, userId: reward.userId, adUnit: reward.adUnit, coins: 0 });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        res.status(200).json({ credited: 0, replay: true });
        return;
      }
      const known = isValidObjectId(reward.userId) && (await User.exists({ _id: reward.userId })) !== null;
      const coins = known
        ? await claimCapped(reward.userId, AD_CAP, ADS_CONFIG.rewardedPerDay, ADS_CONFIG.rewardedCoins)
        : 0;
      if (coins > 0) await AdReward.updateOne({ transactionId: reward.transactionId }, { $set: { coins } });
      res.status(200).json({ credited: coins });
    } catch (err) {
      logger.error('ad reward failed', err);
      res.status(500).json({ error: 'Ad reward failed' });
    }
  };
}

/** AD-3 GET /ads/status: rewarded ads that still pay today. */
export const adStatus: RequestHandler = async (_req, res) => {
  try {
    const userId = userIdOr401(res);
    if (!userId) return;
    const body: AdStatusResponse = {
      rewardedLeft: await cappedLeft(userId, AD_CAP, ADS_CONFIG.rewardedPerDay),
      rewardedCoins: ADS_CONFIG.rewardedCoins,
    };
    res.status(200).json(body);
  } catch (err) {
    logger.error('ad status failed', err);
    res.status(500).json({ error: 'Ad status failed' });
  }
};
