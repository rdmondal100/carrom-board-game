import { seatsOf, type NodiConfig } from '@hub/nodipar';
import { z } from 'zod';
import { t } from '@/i18n/t';
import { SEATINGS, type Seating } from '../localNodi';

export const NAME_MAX = 16;
export const FORMATS = ['1v1', '2v2'] as const;
export type Format = (typeof FORMATS)[number];

/** NODI-5 the settings the same-device and online forms share. */
const rules = { format: z.enum(FORMATS), borsha: z.boolean() };

export const nodiRoomSchema = z.object(rules);
export type NodiRoomForm = z.infer<typeof nodiRoomSchema>;

/** The rules config of a form. */
export const configOf = (v: Pick<NodiRoomForm, 'format' | 'borsha'>): NodiConfig =>
  ({ players: v.format === '2v2' ? 4 : 2, borsha: v.borsha });

export const nodiSetupSchema = z.object({
  ...rules,
  /** Per seat 0..3 (seats the format doesn't use are ignored). */
  names: z.array(z.string()).length(4),
  players: z.array(z.enum(SEATINGS as unknown as [Seating, ...Seating[]])).length(4),
  clockOn: z.boolean(),
}).superRefine((v, ctx) => {
  for (const s of seatsOf(configOf(v))) {
    const n = (v.names[s] ?? '').trim();
    if (n.length === 0 || n.length > NAME_MAX) ctx.addIssue({ code: 'custom', path: ['names', s], message: 'setup.err.name' });
  }
});
export type NodiSetupForm = z.infer<typeof nodiSetupSchema>;

export const defaultNames = (): string[] => [1, 2, 3, 4].map((n) => t('setup.playerN', { n }));

/** The form's first values; vs bot: you at seat 0, medium bots elsewhere. */
export function defaultNodiSetup(vsBot: boolean): NodiSetupForm {
  return {
    format: '1v1', borsha: false, names: defaultNames(),
    players: vsBot ? ['human', 'medium', 'medium', 'medium'] : ['human', 'human', 'human', 'human'], clockOn: false,
  };
}
