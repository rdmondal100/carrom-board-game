/** The voice fields of a seated player (lobby `PlayerState`). */
export interface VoicePlayer { sessionId: string; left: boolean; voiceOn: boolean }

/**
 * VOICE-4: in a private room anyone who turned voice on can talk. In a ranked
 * (stranger) room voice stays closed until every player still there opted in.
 */
export function voiceOpen(players: Iterable<VoicePlayer>, ranked: boolean): boolean {
  if (!ranked) return true;
  const here = [...players].filter((p) => !p.left);
  return here.length > 1 && here.every((p) => p.voiceOn);
}

/**
 * VOICE-2: may a `voice` signal go from session `from` to session `to`?
 * Only between two different players of this room who both have voice on,
 * neither gone for good, and only while voice is open (VOICE-4). A `to` that
 * isn't seated here (e.g. a session of another room) is refused.
 */
export function mayRelay(players: ReadonlyMap<string, VoicePlayer>, ranked: boolean, from: string, to: string): boolean {
  if (from === to) return false;
  const a = players.get(from);
  const b = players.get(to);
  if (!a || !b || a.left || b.left || !a.voiceOn || !b.voiceOn) return false;
  return voiceOpen(players.values(), ranked);
}
