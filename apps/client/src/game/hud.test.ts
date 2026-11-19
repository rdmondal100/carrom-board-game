import { describe, expect, it } from 'vitest';
import type { GameState } from '@carrom/rules';
import bn from '@/i18n/bn.json';
import en from '@/i18n/en.json';
import { coinsDown, reasonKey, REASON_KEYS, redStatus, scoreLine, UNKNOWN_REASON_KEY } from './hud';
import { startLocal, type LocalGame } from './localGame';

const one = () => startLocal({ format: '1v1', preset: 'colour', length: { kind: 'board' }, seed: 1 }, ['Asha', 'Bilu'], true);
const four = () => startLocal({ format: '2v2', preset: 'point', length: { kind: 'board' }, seed: 1 }, ['Asha', 'Bilu', 'Chandni', 'Dipu'], true);
const withState = (g: LocalGame, patch: Partial<GameState>): LocalGame => ({ ...g, state: { ...g.state, ...patch } });

describe('hud', () => {
  it('LOC-4 redStatus: on the board', () => {
    expect(redStatus(one())).toEqual({ key: 'hud.redOnBoard' });
  });

  it('LOC-4 redStatus: waiting for cover by the player who pocketed it', () => {
    expect(redStatus(withState(one(), { redPending: { seat: 2, shotsLeft: 1 } })))
      .toEqual({ key: 'hud.redWaiting', vars: { name: 'Bilu' } });
    expect(redStatus(withState(four(), { redPending: { seat: 3, shotsLeft: 1 } })))
      .toEqual({ key: 'hud.redWaiting', vars: { name: 'Dipu' } });
  });

  it('LOC-4 redStatus: covered by a side', () => {
    expect(redStatus(withState(one(), { pocketed: { A: ['w1', 'red'], B: [] } })))
      .toEqual({ key: 'hud.redCovered', vars: { name: 'Asha' } });
    expect(redStatus(withState(four(), { pocketed: { A: [], B: ['b2', 'red'] } })))
      .toEqual({ key: 'hud.redCovered', vars: { name: 'Bilu & Dipu' } });
  });

  it('LOC-4 scoreLine names both sides', () => {
    expect(scoreLine(withState(one(), { scores: { A: 12, B: 7 } }))).toBe('Asha 12 – 7 Bilu');
    expect(scoreLine(withState(four(), { scores: { A: 0, B: 45 } }))).toBe('Asha & Chandni 0 – 45 Bilu & Dipu');
  });

  it('LOC-4 coinsDown leaves red out', () => {
    const g = withState(one(), { pocketed: { A: ['w1', 'red', 'w2'], B: ['b1'] } });
    expect(coinsDown(g.state, 'A')).toBe(2);
    expect(coinsDown(g.state, 'B')).toBe(1);
  });

  it('LOC-4 reasonKey maps every rules reason, and unknown text', () => {
    expect(reasonKey('last coin while red is on the board')).toBe('reason.lastCoin');
    expect(reasonKey('red not covered')).toBe('reason.redNotCovered');
    expect(reasonKey('red before a coin')).toBe('reason.redBeforeCoin');
    expect(reasonKey('something new')).toBe(UNKNOWN_REASON_KEY);
  });

  it('LOC-4 every reason key and hud key exists in bn and en', () => {
    const keys = [...Object.values(REASON_KEYS), UNKNOWN_REASON_KEY, 'hud.redOnBoard', 'hud.redWaiting', 'hud.redCovered'];
    for (const k of keys) {
      expect(bn).toHaveProperty([k]);
      expect(en).toHaveProperty([k]);
    }
  });
});
