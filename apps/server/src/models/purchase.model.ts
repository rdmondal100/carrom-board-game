import mongoose, { Schema, type InferSchemaType } from 'mongoose';

export const PURCHASE_STATUSES = ['pending', 'credited'] as const;

/**
 * IAP-5 one Play Billing purchase. The unique purchase token makes
 * /iap/verify idempotent: a token is credited once, however often it is sent.
 */
const purchaseSchema = new Schema(
  {
    userId: { type: String, required: true },
    productId: { type: String, required: true },
    purchaseToken: { type: String, required: true },
    /** Google's order id; set once the payment completed. */
    orderId: { type: String, default: null },
    /** Coins this pack gives (credited only when status is `credited`). */
    coins: { type: Number, required: true, min: 0 },
    /** pending = seen, payment not complete yet; credited = coins given. */
    status: { type: String, enum: PURCHASE_STATUSES, required: true, default: 'pending' },
  },
  { timestamps: true },
);

purchaseSchema.index({ purchaseToken: 1 }, { unique: true });
purchaseSchema.index({ userId: 1, createdAt: -1 });

export type PurchaseFields = InferSchemaType<typeof purchaseSchema>;
export const Purchase = mongoose.model('Purchase', purchaseSchema);
