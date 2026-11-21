import { z } from 'zod';
import type { CarromRoomConfig, CreateRoomOptions } from '@carrom/protocol';
import { LENGTHS, toLength } from './localSetup';

// Messages are i18n keys; the forms translate them.

/** ROOM-11: create a room — format, preset, length (same choices as a local game). */
export const createRoomSchema = z.object({
  format: z.enum(['1v1', '2v2']),
  preset: z.enum(['colour', 'point']),
  length: z.enum(['board', '19', '29', '300']),
}).superRefine((v, ctx) => {
  if (!(LENGTHS[v.preset] as readonly string[]).includes(v.length)) {
    ctx.addIssue({ code: 'custom', path: ['length'], message: 'setup.err.length' });
  }
});
export type CreateRoomForm = z.infer<typeof createRoomSchema>;

/** HUB-5 a carrom room: the game id and its settings. */
export const toRoomOptions = (v: CreateRoomForm): CreateRoomOptions<CarromRoomConfig> =>
  ({ gameId: 'carrom', config: { format: v.format, preset: v.preset, length: toLength(v.length) } });

export { cleanCode, joinCodeSchema, type JoinCodeForm } from '@/schemas/joinCode';
