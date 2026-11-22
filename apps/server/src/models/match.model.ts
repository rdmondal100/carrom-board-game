import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { MatchView } from '@carrom/protocol/api';

const matchPlayerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** Name at the time of the game (history shows it even after a rename). */
    name: { type: String, required: true },
    seat: { type: Number, required: true, min: 0, max: 3 },
    /** HUB-9 the game's team id (carrom: A or B). */
    team: { type: String, required: true },
    ratingBefore: { type: Number, required: true },
    ratingAfter: { type: Number, required: true },
  },
  { _id: false },
);

/** RANK-5: one finished online game. `matchId` makes writing it idempotent (RANK-4). */
const matchSchema = new Schema(
  {
    matchId: { type: String, required: true },
    /** HUB-9 the game played. Old documents get 'carrom' from the startup migration (HUB-8). */
    game: { type: String, required: true },
    players: { type: [matchPlayerSchema], required: true },
    /** The winning team id. */
    winner: { type: String, required: true },
    /** Boards (rounds) played. */
    boards: { type: Number, required: true, min: 1 },
    ranked: { type: Boolean, required: true },
    abandoned: { type: Boolean, required: true, default: false },
    /** ADDA-3 played in a room started for this group. */
    groupId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

matchSchema.index({ matchId: 1 }, { unique: true });
matchSchema.index({ game: 1, 'players.userId': 1, createdAt: -1 });
matchSchema.index({ groupId: 1, game: 1, createdAt: -1 }, { partialFilterExpression: { groupId: { $type: 'string' } } });

export type MatchFields = InferSchemaType<typeof matchSchema>;
export type MatchDoc = HydratedDocument<MatchFields>;

export const Match = mongoose.model('Match', matchSchema);

export function toMatchView(m: MatchDoc): MatchView {
  return {
    id: m.id as string,
    game: m.game,
    ranked: m.ranked,
    winner: m.winner,
    boards: m.boards,
    abandoned: m.abandoned,
    players: m.players.map((p) => ({
      userId: String(p.userId), name: p.name, seat: p.seat, team: p.team,
      ratingBefore: p.ratingBefore, ratingAfter: p.ratingAfter,
    })),
    createdAt: m.createdAt.toISOString(),
  };
}
