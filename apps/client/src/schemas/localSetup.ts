import { z } from 'zod';
import type { GameConfig, Length } from '@carrom/rules';

export const NAME_MIN = 1;
export const NAME_MAX = 16;
export const MAX_PLAYERS = 4;

/** Which game lengths each preset allows (LOC-1). */
export const LENGTHS = {
  colour: ['board', '19', '29'],
  point: ['board', '300'],
} as const;

export type LengthChoice = 'board' | '19' | '29' | '300';

export const playerCount = (format: '1v1' | '2v2'): number => (format === '1v1' ? 2 : 4);

export const defaultNames = (): string[] =>
  Array.from({ length: MAX_PLAYERS }, (_, i) => `Player ${i + 1}`);

// Messages are i18n keys; the form translates them.
export const localSetupSchema = z.object({
  format: z.enum(['1v1', '2v2']),
  preset: z.enum(['colour', 'point']),
  length: z.enum(['board', '19', '29', '300']),
  names: z.array(z.string()).length(MAX_PLAYERS),
  clockOn: z.boolean(),
}).superRefine((v, ctx) => {
  if (!(LENGTHS[v.preset] as readonly string[]).includes(v.length)) {
    ctx.addIssue({ code: 'custom', path: ['length'], message: 'setup.err.length' });
  }
  for (let i = 0; i < playerCount(v.format); i++) {
    const n = (v.names[i] ?? '').trim();
    if (n.length < NAME_MIN || n.length > NAME_MAX) {
      ctx.addIssue({ code: 'custom', path: ['names', i], message: 'setup.err.name' });
    }
  }
});

export type LocalSetup = z.infer<typeof localSetupSchema>;

export const defaultSetup = (): LocalSetup => ({
  format: '1v1', preset: 'colour', length: 'board', names: defaultNames(), clockOn: true,
});

export function toLength(choice: LengthChoice): Length {
  return choice === 'board' ? { kind: 'board' } : { kind: 'points', target: Number(choice) as 19 | 29 | 300 };
}

/** Game config + the names of the players actually seated, trimmed. */
export function toGame(v: LocalSetup, seed: number): { cfg: GameConfig; names: string[] } {
  return {
    cfg: { format: v.format, preset: v.preset, length: toLength(v.length), seed },
    names: v.names.slice(0, playerCount(v.format)).map((n) => n.trim()),
  };
}
