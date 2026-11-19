import { describe, expect, it } from 'vitest';
import type { ShotInput } from '@carrom/engine';
import { BOT_PREVIEW_MS, BOT_SLIDE_SHARE } from '@/constants/view';
import { botPreviewAt } from './boardCtrl';

const input: ShotInput = { seat: 0, x: 0.2, dirX: 0.6, dirY: 0.8, power: 0.5 };
const at = (elapsed: number) => botPreviewAt({ from: -0.1, input, elapsed });

describe('botPreviewAt', () => {
  it('BOT-6 the striker slides from its spot to the shot spot, then the aim grows to full power', () => {
    expect(at(0)).toEqual({ along: -0.1, aim: null, done: false });
    const slid = at(BOT_PREVIEW_MS * BOT_SLIDE_SHARE);
    expect(slid.along).toBeCloseTo(0.2);
    expect(slid.aim?.power ?? 0).toBeCloseTo(0);
    const mid = at(BOT_PREVIEW_MS * (1 + BOT_SLIDE_SHARE) / 2);
    expect(mid.aim?.power).toBeGreaterThan(0);
    expect(mid.aim?.power).toBeLessThan(input.power);
    expect(mid.done).toBe(false);
    const end = at(BOT_PREVIEW_MS);
    expect(end).toEqual({ along: 0.2, aim: { dirX: 0.6, dirY: 0.8, power: 0.5, cancelled: false }, done: true });
  });
});
