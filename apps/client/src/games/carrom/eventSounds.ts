import { config, type BoardState, type Piece, type ShotEvent } from '@carrom/engine';
import type { SoundKind } from '@/lib/sound';

export interface SoundCue { kind: SoundKind; strength: number }

const speedOf = (p: Piece): number => Math.sqrt(p.vx * p.vx + p.vy * p.vy);

/** Speed → loudness 0–1. The square root keeps soft touches audible. */
const loudness = (speed: number): number => Math.sqrt(Math.max(0, Math.min(1, speed / config.MAX_SPEED)));

/**
 * UI-7: the sounds for one frame of playback. Events carry no speed, so it is
 * read from the board at the end of the frame: the two pieces' relative speed
 * for a hit, the piece's speed for a frame bounce. One cue per kind per frame
 * (the loudest), so a break doesn't stack dozens of tones.
 */
export function soundsForEvents(events: readonly ShotEvent[], board: BoardState): SoundCue[] {
  const byId = new Map(board.pieces.map((p) => [p.id, p]));
  const loudest = new Map<SoundKind, number>();
  const add = (kind: SoundKind, strength: number) => {
    loudest.set(kind, Math.max(loudest.get(kind) ?? 0, strength));
  };
  for (const ev of events) {
    if (ev.type === 'hit') {
      const a = byId.get(ev.a);
      const b = byId.get(ev.b);
      if (!a || !b) continue;
      const dvx = a.vx - b.vx;
      const dvy = a.vy - b.vy;
      add('hit', loudness(Math.sqrt(dvx * dvx + dvy * dvy)));
    } else if (ev.type === 'frame' || ev.type === 'pocketBounce') {
      const p = byId.get(ev.id);
      if (p) add('frame', loudness(speedOf(p)));
    } else {
      add('pocket', 1);
    }
  }
  return [...loudest].map(([kind, strength]) => ({ kind, strength }));
}
