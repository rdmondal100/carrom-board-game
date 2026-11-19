import { describe, expect, it } from 'vitest';
import { config } from './config';
import { POCKET_IDS, pocketCentre } from './pockets';
import { createRack } from './rack';
import { baselinePoint, seatForward, seatRight } from './seats';
import { simulateShot, stateHash } from './shot';
import { step } from './step';
import type { BoardState, Piece, PocketId, Seat, ShotEvent, ShotInput } from './types';

// Test-only seeded PRNG (mulberry32). Never used inside the engine.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEATS: Seat[] = [0, 1, 2, 3];
const d = config.COIN_D;
const striker = (): Piece => ({ ...(createRack(0).pieces.at(-1) as Piece) });
const coin = (id: string, x: number, y: number, vx = 0, vy = 0): Piece => ({
  id, kind: 'white', x, y, vx, vy, r: d / 2, m: config.COIN_MASS, pocketed: false,
});
const emptyBoard = (): BoardState => ({ pieces: [striker()] });

/** Step until rest, with a check after every step. */
function run(state: BoardState, check?: (s: BoardState) => void) {
  const events: ShotEvent[] = [];
  let s = state;
  let distance = 0;
  const stepMs = config.DT * 1000;
  for (let n = 0; n * stepMs < config.MAX_SHOT_MS; n++) {
    if (s.pieces.every((p) => p.pocketed || (p.vx === 0 && p.vy === 0))) break;
    const out = step(s, n * stepMs);
    const a = s.pieces.find((p) => p.kind === 'striker');
    const b = out.state.pieces.find((p) => p.kind === 'striker');
    if (a && b) distance += Math.hypot(b.x - a.x, b.y - a.y);
    s = out.state;
    events.push(...out.events);
    check?.(s);
  }
  return { state: s, events, distance };
}

/** Striker on seat 0's baseline centre, shot straight ahead. */
function straightShot(power: number) {
  const s = striker();
  s.vy = -config.MAX_SPEED * power;
  const out = run({ pieces: [s] });
  return { ...out, crossings: out.distance / (config.L - config.STRIKER_D) };
}

/** A seat-relative aim at a world point, pulled in to the legal aim limit. */
function aimAt(seat: Seat, x: number, target: { x: number; y: number }) {
  const from = baselinePoint(seat, x);
  const f = seatForward(seat);
  const r = seatRight(seat);
  const wx = target.x - from.x;
  const wy = target.y - from.y;
  let dirX = wx * r.x + wy * r.y;
  let dirY = wx * f.x + wy * f.y;
  const len = Math.hypot(dirX, dirY);
  dirX /= len;
  dirY /= len;
  if (dirY < config.MIN_AIM_FORWARD) {
    dirY = config.MIN_AIM_FORWARD + 1e-9;
    dirX = Math.sign(dirX || 1) * Math.sqrt(1 - dirY * dirY);
  }
  return { dirX, dirY };
}

/** Any legal direction: forward, sideways or back toward the shooter's frame. */
function randomShot(next: () => number): ShotInput {
  const seat = SEATS[Math.floor(next() * 4)] as Seat;
  const dirX = next() * 2 - 1;
  const ahead = Math.sqrt(1 - dirX * dirX);
  const dirY = Math.max(config.MIN_AIM_FORWARD, next() < 0.5 ? -ahead : ahead);
  return {
    seat,
    x: (next() * 2 - 1) * config.BASELINE_HALF,
    dirX,
    dirY,
    power: config.MIN_POWER + next() * (1 - config.MIN_POWER),
  };
}

/** A few coins scattered at random, kept off the baselines and each other. */
function randomBoard(next: () => number): BoardState {
  const pieces: Piece[] = [];
  const count = 1 + Math.floor(next() * 8);
  const span = config.HALF_L - config.BASELINE_INSET - config.STRIKER_D;
  for (let i = 0; pieces.length < count && i < 200; i++) {
    const c = coin(`c${i}`, (next() * 2 - 1) * span, (next() * 2 - 1) * span);
    if (pieces.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > d)) pieces.push(c);
  }
  return { pieces: [...pieces, striker()] };
}

function assertSafe(s: BoardState) {
  const live = s.pieces.filter((p) => !p.pocketed);
  for (const p of live) {
    expect(Math.abs(p.x)).toBeLessThanOrEqual(config.HALF_L - p.r + 1e-9);
    expect(Math.abs(p.y)).toBeLessThanOrEqual(config.HALF_L - p.r + 1e-9);
  }
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i] as Piece;
      const b = live[j] as Piece;
      const overlap = a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y);
      expect(overlap).toBeLessThanOrEqual(0.01 * d);
    }
  }
}

describe('acceptance', () => {
  it('PHY-1 glide: power 1.0 straight ahead does 4.0–4.6 crossings, touches 4 frames', () => {
    const { crossings, events } = straightShot(1);
    expect(crossings).toBeGreaterThanOrEqual(4.0);
    expect(crossings).toBeLessThanOrEqual(4.6);
    expect(events.filter((e) => e.type === 'frame')).toHaveLength(4);
  });

  it('PHY-2 power curve: 2.2–2.6 crossings at 0.5, under 1.3 at 0.25', () => {
    const half = straightShot(0.5).crossings;
    expect(half).toBeGreaterThanOrEqual(2.2);
    expect(half).toBeLessThanOrEqual(2.6);
    expect(straightShot(0.25).crossings).toBeLessThan(1.3);
  });

  it('PHY-3 striker never pockets: 10,000 seeded random shots + shots at each pocket', () => {
    const next = rng(3);
    for (let i = 0; i < 10_000; i++) {
      const board = i % 2 === 0 ? createRack(SEATS[i % 4] as Seat) : randomBoard(next);
      const out = simulateShot(board, randomShot(next));
      expect(out.events.some((e) => e.type === 'pocket' && e.id === 'striker')).toBe(false);
      expect(out.final.pieces.find((p) => p.kind === 'striker')?.pocketed).toBe(false);
    }
    for (const seat of SEATS) {
      for (const pocket of POCKET_IDS) {
        for (const x of [-config.BASELINE_HALF, 0, config.BASELINE_HALF]) {
          for (const power of [0.25, 0.5, 1.0]) {
            const aim = aimAt(seat, x, pocketCentre(pocket, config));
            const out = simulateShot(emptyBoard(), { seat, x, power, ...aim });
            expect(out.events.some((e) => e.type === 'pocket')).toBe(false);
            assertSafe(out.final);
          }
        }
      }
    }
  });

  it('PHY-4 clean pocketing: a lone coin rolled at a pocket at 0.2 L/s to just under POCKET_MAX_DROP_SPEED always drops', () => {
    const rim = config.POCKET_D / 2;
    for (const pocket of POCKET_IDS) {
      const c = pocketCentre(pocket, config);
      const sx = -Math.sign(c.x);
      const sy = -Math.sign(c.y);
      for (let deg = 0; deg <= 90; deg += 5) {
        const ux = sx * Math.cos((deg * Math.PI) / 180);
        const uy = sy * Math.sin((deg * Math.PI) / 180);
        for (const speed of [0.2, 0.5, 1, 2, config.POCKET_MAX_DROP_SPEED - 0.05]) {
          const start = rim + 0.01;
          const p = coin('a', c.x + ux * start, c.y + uy * start, -ux * speed, -uy * speed);
          const { events } = run({ pieces: [p] });
          expect(events.filter((e) => e.type === 'pocket')).toEqual([
            expect.objectContaining({ id: 'a', pocket }),
          ]);
        }
      }
    }
  });

  it('PHY-5 back-to-back drops: two coins in a line into one pocket both drop, in order', () => {
    expect(config.POCKET_D).toBeLessThan(2 * config.COIN_D);
    const pocket: PocketId = 3;
    const c = pocketCentre(pocket, config);
    const u = Math.SQRT1_2;
    const first = config.POCKET_D / 2 + 0.01;
    const second = first + d + 0.002;
    for (const speed of [0.5, 1.5, 2.5]) {
      const a = coin('a', c.x - u * first, c.y - u * first, u * speed, u * speed);
      const b = coin('b', c.x - u * second, c.y - u * second, u * speed, u * speed);
      const drops = run({ pieces: [a, b] }).events.filter((e) => e.type === 'pocket');
      expect(drops.map((e) => e.type === 'pocket' && [e.id, e.pocket])).toEqual([
        ['a', pocket], ['b', pocket],
      ]);
      expect((drops[0] as ShotEvent).t).toBeLessThan((drops[1] as ShotEvent).t);
    }
  });

  it('PHY-9 hard coins bounce out: a coin reaching a pocket above POCKET_MAX_DROP_SPEED comes back out', () => {
    const rim = config.POCKET_D / 2;
    for (const pocket of POCKET_IDS) {
      const c = pocketCentre(pocket, config);
      const sx = -Math.sign(c.x);
      const sy = -Math.sign(c.y);
      for (let deg = 0; deg <= 90; deg += 5) {
        const ux = sx * Math.cos((deg * Math.PI) / 180);
        const uy = sy * Math.sin((deg * Math.PI) / 180);
        for (const speed of [3.2, 4, 6]) {
          const start = rim + 0.01;
          const p = coin('a', c.x + ux * start, c.y + uy * start, -ux * speed, -uy * speed);
          const out = step({ pieces: [p] }, 0);
          const into = out.events.filter((e) => e.type === 'pocket' || e.type === 'pocketBounce');
          expect(into).toEqual([expect.objectContaining({ type: 'pocketBounce', id: 'a', pocket })]);
          const q = out.state.pieces[0] as Piece;
          expect(q.pocketed).toBe(false);
          // Moving away from the pocket centre, slower than it came in.
          expect((q.x - c.x) * q.vx + (q.y - c.y) * q.vy).toBeGreaterThan(0);
          expect(Math.hypot(q.vx, q.vy)).toBeLessThan(speed);
        }
      }
    }
  });

  it('PHY-6 no tunnelling: full power into a coin on a frame, and a full break', () => {
    const s = striker();
    s.vy = -config.MAX_SPEED;
    const target = coin('a', 0, -config.HALF_L + d / 2);
    const hit = run({ pieces: [target, s] }, assertSafe);
    expect(hit.events.some((e) => e.type === 'hit')).toBe(true);

    for (const seat of SEATS) {
      const rack = createRack(seat);
      const st = rack.pieces.find((p) => p.kind === 'striker') as Piece;
      const f = seatForward(seat);
      st.vx = f.x * config.MAX_SPEED;
      st.vy = f.y * config.MAX_SPEED;
      run(rack, assertSafe);
    }
  });

  it('PHY-7 determinism: one input replayed 1,000 times gives the same stateHash', () => {
    const input: ShotInput = { seat: 2, x: 0.07, dirX: 0.05, dirY: 0.99875, power: 1 };
    const first = stateHash(simulateShot(createRack(2), input).final);
    for (let i = 0; i < 1000; i++) {
      expect(stateHash(simulateShot(createRack(2), input).final)).toBe(first);
    }
  });

  it('PHY-8 settling: every shot rests within 5 s', () => {
    const next = rng(8);
    for (let i = 0; i < 2000; i++) {
      const board = i % 2 === 0 ? createRack(SEATS[i % 4] as Seat) : randomBoard(next);
      const out = simulateShot(board, randomShot(next));
      expect(out.durationMs).toBeLessThanOrEqual(5000);
      expect(out.final.pieces.every((p) => p.vx === 0 && p.vy === 0)).toBe(true);
    }
    const breakShot = simulateShot(createRack(0), { seat: 0, x: 0, dirX: 0, dirY: 1, power: 1 });
    expect(breakShot.durationMs).toBeLessThanOrEqual(5000);
  });
});
