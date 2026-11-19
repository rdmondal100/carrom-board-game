import { z } from 'zod';
import { INVITE_ALPHABET, INVITE_LENGTH, type CreateRoomOptions } from '@carrom/protocol';
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

export const toRoomOptions = (v: CreateRoomForm): CreateRoomOptions =>
  ({ format: v.format, preset: v.preset, length: toLength(v.length) });

/** The code as typed, made canonical: no spaces, upper case. */
export const cleanCode = (raw: string): string => raw.replace(/\s+/g, '').toUpperCase();

/** ROOM-1: 6 characters from the invite alphabet (typed in any case). */
export const joinCodeSchema = z.object({
  code: z.string().transform(cleanCode).refine(
    (c) => c.length === INVITE_LENGTH && [...c].every((ch) => INVITE_ALPHABET.includes(ch)),
    { message: 'online.err.code' },
  ),
});
export type JoinCodeForm = z.input<typeof joinCodeSchema>;
