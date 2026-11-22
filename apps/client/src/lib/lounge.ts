import { Client, type Room } from '@colyseus/sdk';
import { LOUNGE_ROOM, MSG, parseServerMessage, type ClientMessage, type VoiceSignal } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { getToken } from './auth';

/** ADDA-5 one person in the lounge, as its synced state shows them. */
export interface LoungeMemberView { sessionId: string; userId: string; name: string; avatar: number; voiceOn: boolean; voiceMuted: boolean }

export interface LoungeHandlers {
  onMembers(members: LoungeMemberView[]): void;
  onSignal(from: string, signal: VoiceSignal): void;
  /** The connection closed (left, kicked, network). */
  onClosed(): void;
}

export interface Lounge {
  sessionId: string;
  send(msg: Extract<ClientMessage, { type: 'voice' | 'voiceState' }>): void;
  leave(): Promise<void>;
}

/** ADDA-5 join a group's voice lounge (one per group; members only, at most LOUNGE_MAX). */
export async function joinLounge(groupId: string, h: LoungeHandlers): Promise<Lounge> {
  const c = new Client(API_BASE);
  c.auth.token = getToken() ?? '';
  const room: Room = await c.joinOrCreate(LOUNGE_ROOM, { groupId });
  room.reconnection.enabled = false;
  let open = true;
  room.onStateChange((s: { toJSON(): unknown }) => {
    const json = s.toJSON() as { members?: Record<string, LoungeMemberView> };
    h.onMembers(Object.values(json.members ?? {}));
  });
  room.onMessage(MSG, (raw: unknown) => {
    const m = parseServerMessage(raw);
    if (m?.type === 'voice') h.onSignal(m.from, m.signal);
  });
  room.onLeave(() => {
    open = false;
    h.onClosed();
  });
  return {
    sessionId: room.sessionId,
    send: (msg) => { if (open) room.send(MSG, msg); },
    leave: async () => { await room.leave().catch(() => {}); },
  };
}
