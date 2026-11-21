import { z } from 'zod';
import { INVITE_ALPHABET, INVITE_LENGTH } from '@carrom/protocol';

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
