import type { ShotInput } from '@carrom/engine';
import type { GameState, RuleEvent } from '@carrom/rules';
import type { EmoteId } from './room';

/** Messages a client sends to a match room. */
export type ClientMessage =
  | { type: 'shot'; turnId: number; input: ShotInput }
  | { type: 'aim'; x: number; dirX: number; dirY: number; power: number }
  | { type: 'emote'; id: EmoteId }
  | { type: 'rematch' }
  /** ROOM-3 host only: start once every seat is filled. */
  | { type: 'start' }
  /** ROOM-3 host only: swap whoever sits at seats a and b (either may be empty). */
  | { type: 'swap'; a: number; b: number };

/** Messages a match room sends to its clients. */
export type ServerMessage =
  | {
      type: 'shotResult'; turnId: number; seat: number; input: ShotInput;
      ruleEvents: RuleEvent[]; stateHash: string; state: GameState;
      /** ROOM-7 replay time; the shot clock waits this long. */
      durationMs: number;
    }
  | { type: 'aim'; seat: number; x: number; dirX: number; dirY: number; power: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'emote'; seat: number; id: EmoteId }
  /** Whole game: on start, rematch and (re)join. `turnId` is the next shot's id. */
  | { type: 'game'; state: GameState; turnId: number }
  /** ROOM-7 the shot clock ran out for `seat`. */
  | { type: 'timeout'; turnId: number; seat: number; ruleEvents: RuleEvent[]; state: GameState }
  /** ROOM-7 the shot clock for `turnId` runs now with `ms` left. */
  | { type: 'clock'; turnId: number; ms: number };

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];
