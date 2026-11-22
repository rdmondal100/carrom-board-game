import { z } from 'zod';
import { GROUP_CODE_LENGTH, GROUP_NAME_MAX, GROUP_NAME_MIN, INVITE_ALPHABET, PLAYER_CODE_LENGTH } from '@carrom/protocol';
import { cleanCode } from './joinCode';

// Messages are i18n keys; the forms translate them. Rules match the server's.

const codeOf = (length: number) => z.string().transform(cleanCode).refine(
  (c) => c.length === length && [...c].every((ch) => INVITE_ALPHABET.includes(ch)),
  { message: 'adda.err.code' },
);

/** ADDA-1 a friend's player code (typed in any case, spaces ignored). */
export const friendCodeSchema = z.object({ code: codeOf(PLAYER_CODE_LENGTH) });
export type FriendCodeForm = z.input<typeof friendCodeSchema>;

/** ADDA-2 a group's invite code, or the whole invite link pasted. */
export const groupCodeSchema = z.object({
  code: z.string().transform((v) => /\/a\/([^/?#\s]+)/.exec(v)?.[1] ?? v).pipe(codeOf(GROUP_CODE_LENGTH)),
});
export type GroupCodeForm = z.input<typeof groupCodeSchema>;

/** ADDA-2 a new group's name. */
export const groupNameSchema = z.object({
  name: z.string().trim().min(GROUP_NAME_MIN, 'adda.err.groupName').max(GROUP_NAME_MAX, 'adda.err.groupName'),
});
export type GroupNameForm = z.input<typeof groupNameSchema>;
