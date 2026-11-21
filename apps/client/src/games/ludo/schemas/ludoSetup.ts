import { seatsOf, type LudoConfig } from '@hub/ludo';
import { z } from 'zod';
import { t } from '@/i18n/t';
import { SEATINGS, type Seating } from '../localLudo';

export const NAME_MAX = 16;
const COUNTS = ['2', '3', '4', '2v2'] as const;
export type PlayerCount = (typeof COUNTS)[number];
export const PLAYER_COUNTS: readonly PlayerCount[] = COUNTS;

/** LUDO-2 the settings both the same-device and the online forms share. */
const rules = {
  preset: z.enum(['classic', 'bd']),
  count: z.enum(COUNTS),
  quick: z.boolean(),
  tapToRoll: z.boolean(),
};

export const ludoRoomSchema = z.object(rules);
export type LudoRoomForm = z.infer<typeof ludoRoomSchema>;

export const ludoSetupSchema = z.object({
  ...rules,
  /** Per seat 0..3 (seats a count doesn't use are ignored). */
  names: z.array(z.string()).length(4),
  players: z.array(z.enum(SEATINGS as unknown as [Seating, ...Seating[]])).length(4),
  clockOn: z.boolean(),
}).superRefine((v, ctx) => {
  for (const s of seatsOf(configOf(v))) {
    const n = (v.names[s] ?? '').trim();
    if (n.length === 0 || n.length > NAME_MAX) ctx.addIssue({ code: 'custom', path: ['names', s], message: 'setup.err.name' });
  }
});
export type LudoSetupForm = z.infer<typeof ludoSetupSchema>;

/** The rules config of a form. */
export function configOf(v: Pick<LudoRoomForm, 'preset' | 'count' | 'quick' | 'tapToRoll'>): LudoConfig {
  const teams = v.count === '2v2';
  const players = teams ? 4 : (Number(v.count) as 2 | 3 | 4);
  return { preset: v.preset, players, teams, quick: v.quick, tapToRoll: v.tapToRoll };
}

/** "Player 1".."Player 4" in the current language, per seat. */
export const defaultNames = (): string[] => [1, 2, 3, 4].map((n) => t('setup.playerN', { n }));

/** The form's first values; vs bot: you at the first seat, medium bots elsewhere. */
export function defaultLudoSetup(vsBot: boolean): LudoSetupForm {
  return {
    preset: 'bd', count: vsBot ? '2' : '4', quick: false, tapToRoll: false,
    names: defaultNames(), players: vsBot ? ['human', 'medium', 'medium', 'medium'] : ['human', 'human', 'human', 'human'], clockOn: false,
  };
}
