import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const FRIEND_STATUSES = ['pending', 'accepted'] as const;

/**
 * ADDA-1 one friendship (or a request for one) between two players. The pair
 * is stored sorted (`a` < `b`) so there is one document per pair whoever asked.
 */
const friendshipSchema = new Schema(
  {
    a: { type: String, required: true },
    b: { type: String, required: true },
    /** Who sent the request. */
    requester: { type: String, required: true },
    status: { type: String, required: true, enum: FRIEND_STATUSES },
  },
  { timestamps: true },
);

friendshipSchema.index({ a: 1, b: 1 }, { unique: true });
friendshipSchema.index({ b: 1 });

export type FriendshipFields = InferSchemaType<typeof friendshipSchema>;
export type FriendshipDoc = HydratedDocument<FriendshipFields>;

export const Friendship = mongoose.model('Friendship', friendshipSchema);

/** The stored (sorted) form of a pair. */
export function pairOf(x: string, y: string): { a: string; b: string } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

/** The other player of a friendship, seen from `me`. */
export const otherOf = (f: Pick<FriendshipFields, 'a' | 'b'>, me: string): string => (f.a === me ? f.b : f.a);
