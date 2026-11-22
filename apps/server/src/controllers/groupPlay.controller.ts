import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import {
  GroupPlayersSchema, REPORT_REASONS, type GroupLeaderboardResponse, type StartGroupRoomResponse,
} from '@carrom/protocol';
import { GroupMember } from '../models/groupMember.model.js';
import { Match } from '../models/match.model.js';
import { isDuplicateKey, User } from '../models/user.model.js';
import { Report } from '../models/report.model.js';
import { createGroupRoom, UnknownGameError } from '../rooms/groupRoom.js';
import { isKnownGame } from '../rooms/games.js';
import { summaryOf, usersById } from '../utils/adda.js';
import { groupLeaderboard } from '../utils/groupLeaderboard.js';
import type { PresenceStore } from '../utils/presence.js';
import { parseBody } from './auth.controller.js';
import { failed, membership } from './groups.controller.js';

/** ADDA-3 games read for a leaderboard (the newest ones). */
export const LEADERBOARD_MATCHES = 500;

const startBody = z.strictObject({ gameId: z.string().min(1).max(32), players: GroupPlayersSchema });
const reportBody = z.strictObject({
  userId: z.string().refine((v) => isValidObjectId(v), 'Unknown player').optional(),
  reason: z.enum(REPORT_REASONS),
});

/** ADDA-3 / ADDA-7: group rooms, leaderboard and reports. */
export function groupPlayHandlers(presence: PresenceStore) {
  /** ADDA-3 POST /groups/:id/rooms { gameId, players } → 201 { roomId, code, gameId }; online members get a notice. */
  const startRoom: RequestHandler = async (req, res) => {
    try {
      const body = parseBody(startBody, req, res);
      if (!body) return;
      const m = await membership(req, res);
      if (!m) return;
      const gid = m.group.id as string;
      let room: StartGroupRoomResponse;
      try {
        room = await createGroupRoom(gid, body.gameId, body.players);
      } catch (err) {
        if (err instanceof UnknownGameError) return void res.status(400).json({ error: 'Unknown game' });
        throw err;
      }
      const me = await User.findById(m.userId);
      const others = (await GroupMember.find({ groupId: gid })).map((x) => x.userId).filter((id) => id !== m.userId);
      const status = await presence.statuses(others);
      if (me) {
        const from = summaryOf(me);
        await Promise.all(others.filter((id) => status.get(id)?.state !== 'offline').map((id) => presence.push(id, {
          kind: 'groupRoom', from, groupId: gid, groupName: m.group.name, gameId: room.gameId, code: room.code,
        })));
      }
      res.status(201).json(room satisfies StartGroupRoomResponse);
    } catch (err) {
      failed(res, 'Start room', err);
    }
  };

  /** ADDA-3 GET /groups/:id/leaderboard?game=… → wins inside the group in that game. */
  const leaderboard: RequestHandler = async (req, res) => {
    try {
      const game = String(req.query.game ?? '');
      if (!isKnownGame(game)) return void res.status(400).json({ error: 'Unknown game' });
      const m = await membership(req, res);
      if (!m) return;
      const gid = m.group.id as string;
      const ids = (await GroupMember.find({ groupId: gid })).map((x) => x.userId);
      const users = await usersById(ids);
      const members = new Map([...users].map(([id, u]) => [id, summaryOf(u)]));
      const matches = await Match.find({ groupId: gid, game }, { winner: 1, players: 1 })
        .sort({ createdAt: -1 }).limit(LEADERBOARD_MATCHES).lean();
      res.status(200).json({ game, rows: groupLeaderboard(matches, members) } satisfies GroupLeaderboardResponse);
    } catch (err) {
      failed(res, 'Group leaderboard', err);
    }
  };

  /**
   * ADDA-7 POST /groups/:id/report { userId?, reason } → 201 (200 when already reported).
   * A member report is stored against that member; a group report against its owner, with `matchId` saying which.
   */
  const report: RequestHandler = async (req, res) => {
    try {
      const body = parseBody(reportBody, req, res);
      if (!body) return;
      const m = await membership(req, res);
      if (!m) return;
      const gid = m.group.id as string;
      const target = body.userId ?? m.group.ownerId;
      if (body.userId === m.userId) return void res.status(400).json({ error: 'You cannot report yourself' });
      if (body.userId && !(await GroupMember.exists({ groupId: gid, userId: body.userId }))) {
        return void res.status(404).json({ error: 'Not a member' });
      }
      const matchId = body.userId ? `group:${gid}` : `group:${gid}:self`;
      try {
        await Report.create({ reporterId: m.userId, userId: target, matchId, reason: body.reason });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        return void res.status(200).json({ ok: true });
      }
      res.status(201).json({ ok: true });
    } catch (err) {
      failed(res, 'Report', err);
    }
  };

  return { startRoom, leaderboard, report };
}
