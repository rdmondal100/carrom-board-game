import { LUDO, LUDO_ANIM, type LudoEvent } from '@hub/ludo';

/** One picture of a move being shown: token progress per seat, the die on show, and how long to hold it. */
export interface Frame {
  tokens: number[][];
  dice: { seat: number; value: number } | null;
  ms: number;
  /** A sound or toast cue for this frame. */
  cue: 'roll' | 'hop' | 'capture' | 'home' | 'pass' | null;
}

const copy = (t: readonly (readonly number[])[]): number[][] => t.map((l) => [...l]);

/**
 * LUDO-6 frames for a move's events: the die rolls, the token hops one cell
 * per frame, a captured token jumps back to its yard. Timings match the
 * server's `durationOf`, so the clock starts as the last frame ends.
 */
export function framesFor(start: readonly (readonly number[])[], events: readonly LudoEvent[]): Frame[] {
  let tokens = copy(start);
  let dice: Frame['dice'] = null;
  const frames: Frame[] = [];
  for (const e of events) {
    if (e.type === 'roll') {
      dice = { seat: e.seat, value: e.value };
      frames.push({ tokens: copy(tokens), dice, ms: LUDO_ANIM.DICE_MS, cue: 'roll' });
    } else if (e.type === 'move') {
      const steps = e.from === LUDO.YARD ? [0] : Array.from({ length: e.to - e.from }, (_, i) => e.from + i + 1);
      for (const p of steps) {
        tokens = copy(tokens);
        tokens[e.seat]![e.token] = p;
        frames.push({ tokens, dice, ms: LUDO_ANIM.HOP_MS, cue: 'hop' });
      }
    } else if (e.type === 'capture') {
      tokens = copy(tokens);
      tokens[e.victim]![e.token] = LUDO.YARD;
      frames.push({ tokens, dice, ms: LUDO_ANIM.CAPTURE_MS, cue: 'capture' });
    } else if (e.type === 'home') {
      frames.at(-1)!.cue = 'home';
    } else if (e.type === 'pass') {
      frames.push({ tokens: copy(tokens), dice, ms: LUDO_ANIM.PASS_MS, cue: 'pass' });
    }
  }
  return frames;
}

/** Total time of the frames (equals the server's durationOf for the same events). */
export const framesMs = (frames: readonly Frame[]): number => frames.reduce((s, f) => s + f.ms, 0);
