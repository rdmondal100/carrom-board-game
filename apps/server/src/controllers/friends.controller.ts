import type { RequestHandler, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import {
  FRIENDS_MAX, PLAYER_CODE_LENGTH, type FriendRequestResponse, type FriendsResponse, type PresenceResponse,
} from '@carrom/protocol';
import { Friendship, otherOf, pairOf } from '../models/friendship.model.js';
import { isDuplicateKey, User, type UserDoc } from '../models/user.model.js';
import { cleanCode, eitherBlocked, ensurePlayerCode, summaryOf, usersById } from '../utils/adda.js';
import { logger } from '../utils/logger.js';
import type { PresenceStore } from '../utils/presence.js';
import { parseBody } from './auth.controller.js';
import { userIdOr401 } from './wallet.controller.js';

export const NO_PLAYER = 'No player with that code';
export const CANT_ADD = "You can't add this player";

const requestBody = z.union([
  z.strictObject({ code: z.string().max(32) }),
  z.strictObject({ userId: z.string().refine((v) => isValidObjectId(v), 'Unknown player') }),
]);
const presenceBody = z.strictObject({ game: z.string().min(1).max(32).nullable() });

function failed(res: Response, what: string, err: unknown): void {
  logger.error(`${what} failed`, err);
  res.status(500).json({ error: `${what} failed` });
}

async function meOr401(res: Response): Promise<UserDoc | null> {
  const id = userIdOr401(res);
  if (!id) return null;
  const me = await User.findById(id);
  if (!me) res.status(401).json({ error: 'Account not found' });
  return me;
}

/** ADDA-1 / ADDA-6: /friends and /presence handlers (notices go through `presence`). */
export function friendHandlers(presence: PresenceStore) {
  /** GET /friends → your code, friends with their status, requests both ways. */
  const list: RequestHandler = async (_req, res) => {
    try {
      const me = await meOr401(res);
      if (!me) return;
      const myId = me.id as string;
      const rows = await Friendship.find({ $or: [{ a: myId }, { b: myId }] }).sort({ updatedAt: -1 }).lean();
      const blockedIds = [...(me.blocked ?? [])];
      const users = await usersById([...rows.map((f) => otherOf(f, myId)), ...blockedIds]);
      const friendIds = rows.filter((f) => f.status === 'accepted').map((f) => otherOf(f, myId)).filter((id) => users.has(id));
      const status = await presence.statuses(friendIds);
      const pending = (incoming: boolean) => rows
        .filter((f) => f.status === 'pending' && (f.requester === myId) !== incoming)
        .map((f) => users.get(otherOf(f, myId)))
        .filter((u): u is UserDoc => u !== undefined)
        .map(summaryOf);
      res.status(200).json({
        code: await ensurePlayerCode(me),
        friends: friendIds.map((id) => ({ ...summaryOf(users.get(id)!), presence: status.get(id) ?? { state: 'offline' } })),
        incoming: pending(true),
        outgoing: pending(false),
        blocked: blockedIds.map((id) => users.get(id)).filter((u): u is UserDoc => u !== undefined).map(summaryOf),
      } satisfies FriendsResponse);
    } catch (err) {
      failed(res, 'Friends list', err);
    }
  };

  /** POST /friends/requests { code } | { userId } → 201 sent, or 200 when already sent / now friends. */
  const request: RequestHandler = async (req, res) => {
    try {
      const body = parseBody(requestBody, req, res);
      if (!body) return;
      const me = await meOr401(res);
      if (!me) return;
      const myId = me.id as string;
      let target: UserDoc | null = null;
      if ('code' in body) {
        const code = cleanCode(body.code, PLAYER_CODE_LENGTH);
        target = code === null ? null : await User.findOne({ playerCode: code });
      } else target = await User.findById(body.userId);
      if (!target) return void res.status(404).json({ error: NO_PLAYER });
      const theirId = target.id as string;
      if (theirId === myId) return void res.status(400).json({ error: 'That is your own code' });
      if (eitherBlocked(me, target)) return void res.status(403).json({ error: CANT_ADD });

      const pair = pairOf(myId, theirId);
      const existing = await Friendship.findOne(pair);
      if (existing) {
        if (existing.status === 'pending' && existing.requester === theirId) {
          existing.status = 'accepted';
          await existing.save();
          await presence.push(theirId, { kind: 'friendAccepted', from: summaryOf(me) });
          return void res.status(200).json({ status: 'friends' } satisfies FriendRequestResponse);
        }
        return void res.status(200).json({ status: existing.status === 'accepted' ? 'friends' : 'sent' } satisfies FriendRequestResponse);
      }
      const count = await Friendship.countDocuments({ $or: [{ a: myId }, { b: myId }] });
      if (count >= FRIENDS_MAX) return void res.status(400).json({ error: 'Too many friends and requests' });
      try {
        await Friendship.create({ ...pair, requester: myId, status: 'pending' });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        return void res.status(200).json({ status: 'sent' } satisfies FriendRequestResponse);
      }
      await presence.push(theirId, { kind: 'friendRequest', from: summaryOf(me) });
      res.status(201).json({ status: 'sent' } satisfies FriendRequestResponse);
    } catch (err) {
      failed(res, 'Friend request', err);
    }
  };

  /** POST /friends/:userId/accept → 200; 404 when they never asked. */
  const accept: RequestHandler = async (req, res) => {
    try {
      const me = await meOr401(res);
      if (!me) return;
      const theirId = String(req.params.userId);
      const f = await Friendship.findOneAndUpdate(
        { ...pairOf(me.id as string, theirId), requester: theirId, status: 'pending' },
        { $set: { status: 'accepted' } },
      );
      if (!f) return void res.status(404).json({ error: 'No request from that player' });
      await presence.push(theirId, { kind: 'friendAccepted', from: summaryOf(me) });
      res.status(200).json({ ok: true });
    } catch (err) {
      failed(res, 'Accept', err);
    }
  };

  /** POST /friends/:userId/decline → 200 (a request they sent you). */
  const decline: RequestHandler = async (req, res) => {
    try {
      const myId = userIdOr401(res);
      if (!myId) return;
      const theirId = String(req.params.userId);
      await Friendship.deleteOne({ ...pairOf(myId, theirId), requester: theirId, status: 'pending' });
      res.status(200).json({ ok: true });
    } catch (err) {
      failed(res, 'Decline', err);
    }
  };

  /** DELETE /friends/:userId → 200: unfriend, or take back your request. */
  const remove: RequestHandler = async (req, res) => {
    try {
      const myId = userIdOr401(res);
      if (!myId) return;
      await Friendship.deleteOne(pairOf(myId, String(req.params.userId)));
      res.status(200).json({ ok: true });
    } catch (err) {
      failed(res, 'Remove friend', err);
    }
  };

  /** ADDA-1 / ADDA-6 POST /presence { game } → { notices } (the client beats every PRESENCE_BEAT_MS). */
  const beat: RequestHandler = async (req, res) => {
    try {
      const body = parseBody(presenceBody, req, res);
      if (!body) return;
      const myId = userIdOr401(res);
      if (!myId) return;
      await presence.beat(myId, body.game);
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ notices: await presence.take(myId) } satisfies PresenceResponse);
    } catch (err) {
      failed(res, 'Presence', err);
    }
  };

  return { list, request, accept, decline, remove, beat };
}
