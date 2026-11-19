import type { ShotInput } from '@carrom/engine';
import type { GameState, RuleEvent } from '@carrom/rules';

/** Messages a client sends to a match room. */
export type ClientMessage =
  | { type: 'shot'; turnId: number; input: ShotInput }
  | { type: 'aim'; x: number; dirX: number; dirY: number; power: number }
  | { type: 'emote'; id: string }
  | { type: 'rematch' };

/** Messages a match room sends to its clients. */
export type ServerMessage =
  | {
      type: 'shotResult'; turnId: number; seat: number; input: ShotInput;
      ruleEvents: RuleEvent[]; stateHash: string; state: GameState;
    }
  | { type: 'aim'; seat: number; x: number; dirX: number; dirY: number; power: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'emote'; seat: number; id: string };

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];
