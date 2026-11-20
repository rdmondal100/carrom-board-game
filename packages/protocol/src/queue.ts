import { z } from 'zod';

/** RANK-2: the shared queue room players join to look for a ranked game. Leaving it cancels. */
export const QUEUE_ROOM = 'ranked_queue';
/** RANK-2: ranked game rooms (created by the server only, seats reserved). */
export const RANKED_ROOM = 'ranked';

/** What Colyseus `matchMaker.reserveSeatFor` returns; the client hands it to `consumeSeatReservation`. */
export interface SeatReservation {
  name: string;
  roomId: string;
  sessionId: string;
  processId: string;
  publicAddress?: string;
  devMode?: boolean;
}

/** Messages the queue room sends (on the `MSG` type). */
export type QueueMessage =
  /** RANK-2 still looking: time waited and the current rating window (±window). */
  | { type: 'queue'; waitedMs: number; window: number; rating: number }
  /** RANK-3 no match yet: the client may offer an unranked game vs the bot. */
  | { type: 'botOffer' }
  /** RANK-2 an opponent was found: join this ranked room. */
  | { type: 'matched'; reservation: SeatReservation }
  | { type: 'error'; code: string; message: string };

const reservation = z.object({
  name: z.string(),
  roomId: z.string(),
  sessionId: z.string(),
  processId: z.string(),
  publicAddress: z.string().optional(),
  devMode: z.boolean().optional(),
});

export const QueueMessageSchema: z.ZodType<QueueMessage> = z.union([
  z.object({ type: z.literal('queue'), waitedMs: z.number().min(0), window: z.number().min(0), rating: z.number() }),
  z.object({ type: z.literal('botOffer') }),
  z.object({ type: z.literal('matched'), reservation }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export function parseQueueMessage(data: unknown): QueueMessage | null {
  const r = QueueMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}
