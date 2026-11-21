// BOT-6: the bot's search runs here, off the main thread.
import { chooseShot } from '@carrom/bot';
import type { BotRequest, BotReply } from './botClient';

interface WorkerScope {
  onmessage: ((e: MessageEvent<BotRequest>) => void) | null;
  postMessage(reply: BotReply): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { id, state, level, seed } = e.data;
  try {
    scope.postMessage({ id, input: chooseShot(state, level, seed) });
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
