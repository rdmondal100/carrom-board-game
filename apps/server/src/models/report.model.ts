import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { REPORT_REASONS } from '@carrom/protocol';

/**
 * VOICE-6 one player reporting another, for the moderators. One report per
 * reporter, player and match (a second one is a no-op). Nothing of the voice
 * itself is ever recorded.
 */
const reportSchema = new Schema(
  {
    reporterId: { type: String, required: true },
    userId: { type: String, required: true },
    /** The room id the two met in. */
    matchId: { type: String, required: true },
    reason: { type: String, required: true, enum: REPORT_REASONS },
  },
  { timestamps: true },
);

reportSchema.index({ reporterId: 1, userId: 1, matchId: 1 }, { unique: true });
reportSchema.index({ userId: 1, createdAt: -1 });

export type ReportFields = InferSchemaType<typeof reportSchema>;
export const Report = mongoose.model('Report', reportSchema);
