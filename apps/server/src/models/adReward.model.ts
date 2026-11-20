import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * AD-3 one verified rewarded-ad callback. The unique transaction id makes
 * the callback idempotent: AdMob may call again, it is credited once.
 */
const adRewardSchema = new Schema(
  {
    transactionId: { type: String, required: true },
    userId: { type: String, required: true },
    adUnit: { type: String, default: '' },
    /** Coins given (0 = over the daily cap or unknown user). */
    coins: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

adRewardSchema.index({ transactionId: 1 }, { unique: true });

export type AdRewardFields = InferSchemaType<typeof adRewardSchema>;
export const AdReward = mongoose.model('AdReward', adRewardSchema);
