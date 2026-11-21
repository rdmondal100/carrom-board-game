import { describe, expect, it } from 'vitest';
import { LUDO } from './config';
import { DEFAULT_LUDO_CONFIG, ludoModule as m } from './module';
import { playOut } from './playOut';
import type { LudoEvent, LudoState } from './types';

describe('ludo module', () => {
  it('LUDO-3 same seed → same dice and game; other seeds differ', () => {
    const cfg = { ...DEFAULT_LUDO_CONFIG, players: 4 } as const;
    const a = playOut(cfg, 42, {});
    expect(m.result(a.at(-1)!)).not.toBeNull();
    expect(a.map(m.hash)).toEqual(playOut(cfg, 42, {}).map(m.hash));
    expect(playOut(cfg, 43, {}).map(m.hash)).not.toEqual(a.map(m.hash));
  });

  it('LUDO-1 the view hides the dice source', () => {
    const s = m.newGame(DEFAULT_LUDO_CONFIG, 9);
    const v = m.view(s, null) as Record<string, unknown>;
    expect('rng' in v || 'seed' in v).toBe(false);
    expect(v.tokens).toEqual(s.tokens);
  });

  it('LUDO-4 a timeout auto-moves the furthest legal token', () => {
    const s: LudoState = {
      ...m.newGame({ ...DEFAULT_LUDO_CONFIG, tapToRoll: true }, 1),
      tokens: [[12, 30, LUDO.YARD, 4], [], [LUDO.YARD, LUDO.YARD, LUDO.YARD, LUDO.YARD], []],
      turnSeat: 0, phase: 'move', dice: 3,
    };
    const out = m.timeout(s);
    expect(out.seat).toBe(0);
    expect(out.state.tokens[0]).toEqual([12, 33, LUDO.YARD, 4]);
    expect(out.state.turnId).toBe(s.turnId + 1);
  });

  it('LUDO-4 two timeouts in a row → bot takeover; a move in between resets the count', () => {
    let s = m.newGame({ ...DEFAULT_LUDO_CONFIG, players: 4 }, 3);
    const seen: LudoEvent[] = [];
    for (let i = 0; i < 8; i++) {
      const out = m.timeout(s);
      seen.push(...out.events);
      s = out.state;
    }
    const takeovers = m.takeovers(seen);
    expect(new Set(takeovers).size).toBe(takeovers.length);
    expect(takeovers.length).toBeGreaterThan(0);
    for (const seat of takeovers) expect(seen.filter((e) => e.type === 'timeout' && e.seat === seat).length).toBeGreaterThanOrEqual(2);

    const fresh = m.newGame(DEFAULT_LUDO_CONFIG, 3);
    const seat = m.turnSeat(fresh);
    const once = { ...fresh, timeouts: fresh.timeouts.map((n, i) => (i === seat ? 1 : n)) };
    expect(m.takeovers(m.timeout(once).events)).toEqual([seat]);
    const moved = m.applyMove(once, seat, once.turnId, m.bot(once, seat, 'easy', 1));
    if (!moved.ok) throw new Error(moved.message);
    expect(moved.state.timeouts[seat]).toBe(0);
  });

  it('LUDO-2 rematch: same settings, the next seat rolls first', () => {
    const s = m.newGame({ ...DEFAULT_LUDO_CONFIG, players: 3 }, 8);
    const r = m.rematch(s);
    expect(r.config).toEqual(s.config);
    expect(r.first).toBe((s.first + 1) % 3);
  });
});
