import { BOT_MAX_THINK_MS, BOT_MIN_THINK_MS, chooseShot, mulberry32, type BotLevel } from '@carrom/bot';
import type { ShotInput } from '@carrom/engine';
import type { GameState } from '@carrom/rules';

export interface BotRequest { id: number; state: GameState; level: BotLevel; seed: number }
export type BotReply = { id: number; input: ShotInput } | { id: number; error: string };

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (s: ShotInput) => void; reject: (e: Error) => void }>();

/** The shared worker, or null where workers don't exist (tests); then the bot runs inline. */
function getWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined') return worker;
  worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<BotReply>) => {
    const w = waiting.get(e.data.id);
    if (!w) return;
    waiting.delete(e.data.id);
    if ('input' in e.data) w.resolve(e.data.input);
    else w.reject(new Error(e.data.error));
  };
  return worker;
}

function search(state: GameState, level: BotLevel, seed: number): Promise<ShotInput> {
  const w = getWorker();
  if (!w) return Promise.resolve().then(() => chooseShot(state, level, seed));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    w.postMessage({ id, state, level, seed } satisfies BotRequest);
  });
}

/** BOT-6: how long this move "thinks", BOT_MIN_THINK_MS..BOT_MAX_THINK_MS, from the seed. */
export function thinkMs(seed: number): number {
  return BOT_MIN_THINK_MS + mulberry32(seed)() * (BOT_MAX_THINK_MS - BOT_MIN_THINK_MS);
}

/**
 * BOT-6: the bot's shot for the seat to move, no sooner than its think time
 * (a fast search still waits; a slow one is not delayed further).
 */
export async function requestBotShot(state: GameState, level: BotLevel, seed: number): Promise<ShotInput> {
  const wait = new Promise((r) => setTimeout(r, thinkMs(seed)));
  const [input] = await Promise.all([search(state, level, seed), wait]);
  return input;
}
