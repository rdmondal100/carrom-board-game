import type { BotLevel } from '@hub/game-kit';
import type { CallbreakConfig } from '@hub/callbreak';
import { z } from 'zod';
import { BOT_LEVELS } from '../localCallbreak';

export const NAME_MAX = 16;
const ROUNDS = ['5', '3'] as const;
export const ROUND_CHOICES: readonly (typeof ROUNDS)[number][] = ROUNDS;
const level = z.enum(BOT_LEVELS as unknown as [BotLevel, ...BotLevel[]]);

/** CB-3 / CB-4 the settings the vs-bot and online forms share. */
const rules = { rounds: z.enum(ROUNDS), redeal: z.boolean() };

export const cbRoomSchema = z.object(rules);
export type CbRoomForm = z.infer<typeof cbRoomSchema>;

export const cbSetupSchema = z.object({
  ...rules,
  name: z.string().trim().min(1, 'setup.err.name').max(NAME_MAX, 'setup.err.name'),
  /** Bots at seats 1, 2, 3. */
  levels: z.array(level).length(3),
  clockOn: z.boolean(),
});
export type CbSetupForm = z.infer<typeof cbSetupSchema>;

export const configOf = (v: Pick<CbRoomForm, 'rounds' | 'redeal'>): CallbreakConfig => ({ rounds: Number(v.rounds) as 3 | 5, redeal: v.redeal });

export const defaultCbSetup = (name: string): CbSetupForm => ({
  rounds: '5', redeal: true, name, levels: ['medium', 'medium', 'medium'], clockOn: false,
});
