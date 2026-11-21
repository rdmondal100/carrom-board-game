import type { EmoteId } from './room';
import type { VoiceSignal } from './voice';

/**
 * HUB-5: the room protocol is the same for every game. Game-specific parts
 * (a move, what a seat sees, rule events, a live hint) are payloads the
 * room checks with the game module's schemas; the type parameters let one
 * game's client code see them typed (e.g. carrom: ShotInput, GameState, RuleEvent).
 */

/** Messages a client sends to a match room. */
export type ClientMessage<M = unknown, H = unknown> =
  | { type: 'move'; turnId: number; move: M }
  /** Live, non-binding (carrom: the aim preview, ROOM-6). Only from the seat on turn. */
  | { type: 'hint'; data: H }
  | { type: 'emote'; id: EmoteId }
  | { type: 'rematch' }
  /** ROOM-3 host only: start once every seat is filled. */
  | { type: 'start' }
  /** ROOM-3 host only: swap whoever sits at seats a and b (either may be empty). */
  | { type: 'swap'; a: number; b: number }
  /** VOICE-2 WebRTC signalling for the session `to` in this room (relayed to that session only). */
  | { type: 'voice'; to: string; signal: VoiceSignal }
  /** VOICE-2 / VOICE-4 this player's voice: `on` = takes part (ranked: opted in), `muted` = mic off. */
  | { type: 'voiceState'; on: boolean; muted: boolean };

/** Messages a match room sends to its clients. */
export type ServerMessage<V = unknown, E = unknown, M = unknown, H = unknown> =
  | {
      type: 'moveResult'; turnId: number; seat: number; move: M;
      events: E[];
      /** HUB-1 the game's hash of the full state after the move (ROOM-5 check). */
      hash: string;
      /** What this client may see after the move. */
      view: V;
      /** ROOM-7 replay time; the shot clock waits this long. */
      durationMs: number;
    }
  | { type: 'hint'; seat: number; data: H }
  | { type: 'error'; code: string; message: string }
  | { type: 'emote'; seat: number; id: EmoteId }
  /** Whole game: on start, rematch and (re)join. `turnId` is the next move's id. */
  | { type: 'game'; view: V; turnId: number }
  /** ROOM-7 the shot clock ran out for `seat`. */
  | { type: 'timeout'; turnId: number; seat: number; events: E[]; view: V }
  /** ROOM-7 the shot clock for `turnId` runs now with `ms` left. */
  | { type: 'clock'; turnId: number; ms: number }
  /** RANK-4 a ranked game is over and ratings are saved (also on abandon). */
  | { type: 'rankedResult'; winner: string; abandoned: boolean; players: RatingChange[] }
  /** COS-2 coins this player just earned for the finished game. */
  | { type: 'reward'; coins: number }
  /** VOICE-2 signalling from the session `from` (voice state itself is synced per seat in the lobby state). */
  | { type: 'voice'; from: string; signal: VoiceSignal };

/** RANK-4 one player's rating before and after a ranked game. */
export interface RatingChange { seat: number; userId: string; ratingBefore: number; ratingAfter: number }

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];
