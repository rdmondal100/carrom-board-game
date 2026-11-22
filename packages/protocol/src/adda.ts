import { z } from 'zod';
import type { MatchView } from './api';
import type { ReportReason } from './voice';

/**
 * ADDA-1..7 (spec 21): friends, groups ("adda"), presence and in-app
 * notices. HTTP API types plus the few constants client and server share.
 */

/** ADDA-2 a group holds at most this many members (the owner included). */
export const GROUP_MAX_MEMBERS = 20;
export const GROUP_NAME_MIN = 3;
export const GROUP_NAME_MAX = 30;
/** Groups one player may be in. */
export const GROUPS_PER_USER_MAX = 20;
/** ADDA-1 friends (and pending requests) per player. */
export const FRIENDS_MAX = 200;
/** ADDA-1 a player code: what friends type to add you. Same alphabet as room invites. */
export const PLAYER_CODE_LENGTH = 8;
/** ADDA-2 a group invite code (`/a/:code`). */
export const GROUP_CODE_LENGTH = 8;
/** ADDA-1 presence: the client beats this often; a status is kept this long without a beat. */
export const PRESENCE_BEAT_MS = 20_000;
export const PRESENCE_TTL_S = 60;
/** ADDA-6 in-app notices kept per player until fetched (oldest dropped first). */
export const NOTICES_MAX = 30;
/** ADDA-5 the group voice lounge (Colyseus room name) and its P2P mesh size. */
export const LOUNGE_ROOM = 'lounge';
export const LOUNGE_MAX = 4;
/** ADDA-3 recent group matches on the group page. */
export const GROUP_MATCHES_MAX = 20;

/** ADDA-3 / ADDA-4 seats wanted in a group room (the game picks its settings for that many). */
export type GroupPlayers = 2 | 4;
export const GroupPlayersSchema: z.ZodType<GroupPlayers> = z.union([z.literal(2), z.literal(4)]);

/** ADDA-1 where a player is: not around, in the menus, or in a game of `game`. */
export type Presence = { state: 'offline' } | { state: 'menu' } | { state: 'game'; game: string };

/** A player as lists show them. */
export interface PlayerSummary { id: string; name: string; avatar: number }

// ---- friends ---------------------------------------------------------------

export interface FriendView extends PlayerSummary { presence: Presence }

/** GET /friends: your player code, friends with status, and pending requests both ways. */
export interface FriendsResponse {
  code: string;
  friends: FriendView[];
  incoming: PlayerSummary[];
  outgoing: PlayerSummary[];
  /** VOICE-6 / ADDA-1 players you blocked (to unblock them). */
  blocked: PlayerSummary[];
}

/** POST /friends/requests: by player code, or by user id (someone from a recent match). */
export type FriendRequestBody = { code: string } | { userId: string };
/** `sent` = waiting for them; `friends` = they had asked you already, so you are friends now. */
export interface FriendRequestResponse { status: 'sent' | 'friends' }

// ---- groups ----------------------------------------------------------------

export type GroupRole = 'owner' | 'member';

/** One of your groups. */
export interface GroupSummary {
  id: string;
  name: string;
  /** Invite code (`/a/:code`). */
  code: string;
  role: GroupRole;
  members: number;
  /** ADDA-7 the owner closed the invite link. */
  invitesLocked: boolean;
}

export interface GroupsResponse { groups: GroupSummary[] }

export interface GroupMemberView extends PlayerSummary { role: GroupRole; presence: Presence; joinedAt: string }

/** GET /groups/:id: the group page. */
export interface GroupView {
  group: GroupSummary & { ownerId: string };
  members: GroupMemberView[];
  /** ADDA-3 recent games played in this group's rooms, newest first. */
  matches: MatchView[];
}

/** ADDA-3 one row of a group's leaderboard in one game: wins inside the group. */
export interface GroupLeaderRow { userId: string; name: string; avatar: number; wins: number; games: number }
/** GET /groups/:id/leaderboard?game=… */
export interface GroupLeaderboardResponse { game: string; rows: GroupLeaderRow[] }

/** GET /groups/invite/:code: what the invite page shows before joining. */
export interface GroupInvitePreview { id: string; name: string; members: number; locked: boolean; member: boolean }

export interface CreateGroupRequest { name: string }
/** PATCH /groups/:id (owner only). */
export interface UpdateGroupRequest { name?: string; invitesLocked?: boolean }
export interface GroupResponse { group: GroupSummary }

/** ADDA-3 POST /groups/:id/rooms: start a private room of `gameId` for the group. */
export interface StartGroupRoomRequest { gameId: string; players: GroupPlayers }
export interface StartGroupRoomResponse { roomId: string; code: string; gameId: string }

/** ADDA-7 POST /groups/:id/report: a member (`userId`) or, without it, the group itself. */
export interface GroupReportRequest { userId?: string; reason: ReportReason }

// ---- presence and notices --------------------------------------------------

/** ADDA-6 an in-app notice. */
export type Notice =
  | { id: string; at: number; kind: 'friendRequest'; from: PlayerSummary }
  | { id: string; at: number; kind: 'friendAccepted'; from: PlayerSummary }
  | {
      id: string; at: number; kind: 'groupRoom'; from: PlayerSummary;
      groupId: string; groupName: string; gameId: string; code: string;
    };

/** POST /presence: the game this player is in now (null = menus). Answers with new notices. */
export interface PresenceRequest { game: string | null }
export interface PresenceResponse { notices: Notice[] }
