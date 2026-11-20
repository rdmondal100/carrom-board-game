import { simulateShot, stateHash, type ShotInput } from '@carrom/engine';
import { applyShot, applyTimeout, firstBreakSeat, type GameConfig, type GameState } from '@carrom/rules';
import { nextFloat, type Rng } from '@hub/game-kit';
import { describe, expect, it } from 'vitest';
import { carromModule as carrom, newMatch, rematchOf, seedForBreaker, type CarromMatch } from './module';

const cfg: GameConfig = { format: '1v1', preset: 'colour', length: { kind: 'board' }, seed: 42 };
const roomCfg = { format: cfg.format, preset: cfg.preset, length: cfg.length };
const straight = (m: CarromMatch): ShotInput =>
  ({ seat: m.state.turnSeat as ShotInput['seat'], x: 0, dirX: 0, dirY: 1, power: 0.8 });

const play = (m: CarromMatch, seat: number, turnId: number, input: ShotInput) => carrom.applyMove(m, seat, turnId, input);

describe('carrom module (HUB-3, was server gameLogic)', () => {
  it('ROOM-4 out-of-turn shot is refused and the match is unchanged', () => {
    const m = newMatch(cfg);
    const before = JSON.stringify(m);
    const other = m.state.turnSeat === 0 ? 2 : 0;
    expect(play(m, other, 0, { ...straight(m), seat: other as ShotInput['seat'] })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
    // Right seat, but the input claims another seat.
    expect(play(m, m.state.turnSeat, 0, { ...straight(m), seat: other as ShotInput['seat'] })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
    expect(JSON.stringify(m)).toBe(before);
  });

  it('ROOM-4 stale turnId is refused', () => {
    const m = newMatch(cfg);
    expect(play(m, m.state.turnSeat, 1, straight(m))).toMatchObject({ ok: false, code: 'STALE_TURN' });
    const next = play(m, m.state.turnSeat, 0, straight(m));
    if (!next.ok) throw new Error('refused');
    expect(next.state.turnId).toBe(1);
    expect(play(next.state, next.state.state.turnSeat, 0, straight(next.state))).toMatchObject({ ok: false, code: 'STALE_TURN' });
  });

  it('ROOM-4 a shot the engine refuses is BAD_MOVE', () => {
    const m = newMatch(cfg);
    expect(play(m, m.state.turnSeat, 0, { ...straight(m), dirX: 0, dirY: 0 })).toMatchObject({ ok: false, code: 'BAD_MOVE' });
    expect(m.turnId).toBe(0);
  });

  it('ROOM-7 timeout passes the turn; the second in a row is a bot takeover', () => {
    const m = newMatch({ ...cfg, format: '2v2' });
    const seat = m.state.turnSeat;
    const a = carrom.timeout(m);
    expect(a.seat).toBe(seat);
    expect(a.state.state.turnSeat).not.toBe(seat);
    expect(a.state.turnId).toBe(1);
    expect(carrom.takeovers(a.events)).toEqual([]);
    let x = a.state;
    while (x.state.turnSeat !== seat) x = carrom.timeout(x).state;
    const b = carrom.timeout(x);
    expect(carrom.takeovers(b.events)).toEqual([seat]);
  });

  it('ROOM-9 rematch starts a new game with the next seat breaking', () => {
    for (const format of ['1v1', '2v2'] as const) {
      const m = newMatch({ ...cfg, format, seed: 7 });
      const r = carrom.rematch(m);
      const want = format === '1v1' ? (m.firstBreak === 0 ? 2 : 0) : (m.firstBreak + 1) % 4;
      expect(r.firstBreak).toBe(want);
      expect(r.state.turnSeat).toBe(want);
      expect(r.turnId).toBe(0);
      expect(r.state.scores).toEqual({ A: 0, B: 0 });
      expect(rematchOf(m)).toEqual(r);
    }
  });

  it('ROOM-9 seedForBreaker finds a seed for every seat', () => {
    for (const seat of [0, 1, 2, 3]) expect(firstBreakSeat(seedForBreaker(100, seat, '2v2'), '2v2')).toBe(seat);
  });

  it('HUB-3 200 random shots: module equals engine + rules run directly (old gameLogic)', () => {
    let rng: Rng = { seed: 2026 };
    const draw = (): number => {
      let u: number;
      [u, rng] = nextFloat(rng);
      return u;
    };
    let shots = 0;
    for (let game = 0; shots < 200; game++) {
      let m = carrom.newGame({ ...roomCfg, format: game % 2 ? '2v2' : '1v1' }, 1000 + game);
      let ref: GameState = m.state;
      expect(m.state).toEqual(newMatch({ ...cfg, format: m.state.config.format, seed: 1000 + game }).state);
      while (ref.winner === null && shots < 200) {
        if (draw() < 0.05) {
          const t = carrom.timeout(m);
          ref = applyTimeout(ref).state;
          m = t.state;
          expect(m.state).toEqual(ref);
          continue;
        }
        const a = draw() * 2 * Math.PI;
        const input: ShotInput = {
          seat: ref.turnSeat as ShotInput['seat'], x: (draw() - 0.5) * 0.6,
          dirX: Math.sin(a), dirY: Math.cos(a), power: 0.15 + draw() * 0.85,
        };
        const sim = ((): ReturnType<typeof simulateShot> | null => {
          try {
            return simulateShot(ref.board, input);
          } catch {
            return null;
          }
        })();
        const out = carrom.applyMove(m, ref.turnSeat, m.turnId, input);
        if (!sim) {
          expect(out).toMatchObject({ ok: false, code: 'BAD_MOVE' });
          continue;
        }
        const want = applyShot(ref, sim.events, sim.final);
        if (!out.ok) throw new Error(`refused: ${out.message}`);
        expect(out.state.state).toEqual(want.state);
        expect(out.events).toEqual(want.events);
        expect(out.durationMs).toBe(sim.durationMs);
        expect(carrom.hash(out.state)).toBe(stateHash(want.state.board));
        ref = want.state;
        m = out.state;
        shots++;
      }
      if (ref.winner !== null) expect(carrom.result(m)?.winner).toBe(ref.winner);
    }
  });

  it('HUB-3 contract helpers: seats, teams, view, config, result, bot', () => {
    expect(carrom.seats({ ...roomCfg, format: '2v2' })).toEqual([0, 1, 2, 3]);
    expect(carrom.seats(roomCfg)).toEqual([0, 2]);
    expect(carrom.teamOf(roomCfg, 2)).toBe('B');
    const m = carrom.newGame(roomCfg, 5);
    expect(carrom.view(m, 0)).toBe(m.state);
    expect(carrom.view(m, null)).toBe(m.state);
    expect(carrom.configOf(m)).toEqual(roomCfg);
    expect(carrom.result(m)).toBeNull();
    expect(carrom.rounds(m)).toBe(1);
    expect(carrom.moveSchema.safeParse(carrom.bot(m, m.state.turnSeat, 'easy', 3)).success).toBe(true);
    expect(carrom.configSchema.safeParse({ format: '3v3' }).success).toBe(false);
  });
});
