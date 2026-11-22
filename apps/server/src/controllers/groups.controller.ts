import type { RequestHandler, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import {
  GROUP_CODE_LENGTH, GROUP_MATCHES_MAX, GROUP_MAX_MEMBERS, GROUP_NAME_MAX, GROUP_NAME_MIN, GROUPS_PER_USER_MAX,
  type GroupInvitePreview, type GroupResponse, type GroupsResponse, type GroupSummary, type GroupView,
} from '@carrom/protocol';
import { Group, type GroupDoc } from '../models/group.model.js';
import { GroupMember, type GroupMemberDoc } from '../models/groupMember.model.js';
import { Match, toMatchView } from '../models/match.model.js';
import { isDuplicateKey, User } from '../models/user.model.js';
import { authedUserId } from '../middleware/auth.middleware.js';
import { cleanCode, CODE_TRIES, randomCode, summaryOf, usersById } from '../utils/adda.js';
import { logger } from '../utils/logger.js';
import type { PresenceStore } from '../utils/presence.js';
import { parseBody } from './auth.controller.js';
import { userIdOr401 } from './wallet.controller.js';

export const GROUP_NOT_FOUND = 'No such group';
export const GROUP_FULL = 'The group is full';
export const CANT_JOIN = "You can't join this group";

const name = z.string().trim().min(GROUP_NAME_MIN).max(GROUP_NAME_MAX);
const createBody = z.strictObject({ name });
const updateBody = z.strictObject({ name: name.optional(), invitesLocked: z.boolean().optional() });

export function failed(res: Response, what: string, err: unknown): void {
  logger.error(`${what} failed`, err);
  res.status(500).json({ error: `${what} failed` });
}

export const summaryOfGroup = (g: GroupDoc, role: GroupSummary['role']): GroupSummary => ({
  id: g.id as string, name: g.name, code: g.code, role, members: g.members, invitesLocked: g.invitesLocked,
});

/** The group and the caller's membership; answers 401/404/403 itself and returns null then. */
export async function membership(req: { params: Record<string, unknown> }, res: Response, ownerOnly = false):
  Promise<{ userId: string; group: GroupDoc; member: GroupMemberDoc } | null> {
  const userId = userIdOr401(res);
  if (!userId) return null;
  const id = String(req.params.id ?? '');
  const group = isValidObjectId(id) ? await Group.findById(id) : null;
  const member = group ? await GroupMember.findOne({ groupId: id, userId }) : null;
  if (!group || !member) return void res.status(404).json({ error: GROUP_NOT_FOUND }), null;
  if (ownerOnly && member.role !== 'owner') return void res.status(403).json({ error: 'Only the owner can do that' }), null;
  return { userId, group, member };
}

/** ADDA-2 the next owner when the owner leaves: the longest-standing member. */
async function handOver(groupId: string): Promise<void> {
  const next = await GroupMember.findOne({ groupId }).sort({ createdAt: 1, _id: 1 });
  if (!next) {
    await Group.deleteOne({ _id: groupId });
    return;
  }
  await GroupMember.updateOne({ _id: next._id }, { $set: { role: 'owner' } });
  await Group.updateOne({ _id: groupId }, { $set: { ownerId: next.userId } });
}

/** ADDA-2 take one member out (leave or removed) and keep the count right. */
async function dropMember(group: GroupDoc, member: GroupMemberDoc): Promise<void> {
  const gone = await GroupMember.deleteOne({ _id: member._id });
  if (gone.deletedCount === 0) return;
  await Group.updateOne({ _id: group._id }, { $inc: { members: -1 } });
  if (member.role === 'owner') await handOver(group.id as string);
}

/** ADDA-1..3 / ADDA-7: /groups handlers. */
export function groupHandlers(presence: PresenceStore) {
  /** POST /groups { name } → 201 { group } (you are its owner). */
  const create: RequestHandler = async (req, res) => {
    try {
      const body = parseBody(createBody, req, res);
      if (!body) return;
      const userId = userIdOr401(res);
      if (!userId) return;
      if (!(await User.exists({ _id: userId }))) return void res.status(401).json({ error: 'Account not found' });
      if ((await GroupMember.countDocuments({ userId })) >= GROUPS_PER_USER_MAX) {
        return void res.status(400).json({ error: 'You are in too many groups' });
      }
      let group: GroupDoc | null = null;
      for (let i = 0; i < CODE_TRIES && !group; i++) {
        try {
          group = await Group.create({ name: body.name, code: randomCode(GROUP_CODE_LENGTH), ownerId: userId, members: 1 });
        } catch (err) {
          if (!isDuplicateKey(err)) throw err;
        }
      }
      if (!group) throw new Error('No free group code');
      await GroupMember.create({ groupId: group.id as string, userId, role: 'owner' });
      res.status(201).json({ group: summaryOfGroup(group, 'owner') } satisfies GroupResponse);
    } catch (err) {
      failed(res, 'Create group', err);
    }
  };

  /** GET /groups → your groups. */
  const list: RequestHandler = async (_req, res) => {
    try {
      const userId = userIdOr401(res);
      if (!userId) return;
      const mine = await GroupMember.find({ userId }).sort({ createdAt: 1 });
      const groups = await Group.find({ _id: { $in: mine.map((m) => m.groupId) } });
      const byId = new Map(groups.map((g) => [g.id as string, g]));
      res.status(200).json({
        groups: mine.filter((m) => byId.has(m.groupId)).map((m) => summaryOfGroup(byId.get(m.groupId)!, m.role as GroupSummary['role'])),
      } satisfies GroupsResponse);
    } catch (err) {
      failed(res, 'Groups list', err);
    }
  };

  /** ADDA-3 GET /groups/:id → members with status and recent group matches. */
  const get: RequestHandler = async (req, res) => {
    try {
      const m = await membership(req, res);
      if (!m) return;
      const gid = m.group.id as string;
      const members = await GroupMember.find({ groupId: gid }).sort({ createdAt: 1 });
      const users = await usersById(members.map((x) => x.userId));
      const status = await presence.statuses(members.map((x) => x.userId));
      const matches = await Match.find({ groupId: gid }).sort({ createdAt: -1 }).limit(GROUP_MATCHES_MAX);
      res.status(200).json({
        group: { ...summaryOfGroup(m.group, m.member.role as GroupSummary['role']), ownerId: m.group.ownerId },
        members: members.filter((x) => users.has(x.userId)).map((x) => ({
          ...summaryOf(users.get(x.userId)!), role: x.role as GroupSummary['role'],
          presence: status.get(x.userId) ?? { state: 'offline' }, joinedAt: x.createdAt.toISOString(),
        })),
        matches: matches.map(toMatchView),
      } satisfies GroupView);
    } catch (err) {
      failed(res, 'Group', err);
    }
  };

  /** ADDA-2 GET /groups/invite/:code → what the invite page shows (sign-in optional). */
  const preview: RequestHandler = async (req, res) => {
    try {
      const code = cleanCode(req.params.code, GROUP_CODE_LENGTH);
      const group = code === null ? null : await Group.findOne({ code });
      if (!group) return void res.status(404).json({ error: GROUP_NOT_FOUND });
      const userId = authedUserId(res);
      const member = userId && isValidObjectId(userId) ? await GroupMember.exists({ groupId: group.id as string, userId }) : null;
      res.status(200).json({
        id: group.id as string, name: group.name, members: group.members, locked: group.invitesLocked, member: member !== null,
      } satisfies GroupInvitePreview);
    } catch (err) {
      failed(res, 'Group invite', err);
    }
  };

  /** ADDA-2 / ADDA-7 POST /groups/join/:code → 201 { group } (200 when already in). */
  const join: RequestHandler = async (req, res) => {
    try {
      const userId = userIdOr401(res);
      if (!userId) return;
      const code = cleanCode(req.params.code, GROUP_CODE_LENGTH);
      const group = code === null ? null : await Group.findOne({ code });
      if (!group) return void res.status(404).json({ error: GROUP_NOT_FOUND });
      const gid = group.id as string;
      const already = await GroupMember.findOne({ groupId: gid, userId });
      if (already) return void res.status(200).json({ group: summaryOfGroup(group, already.role as GroupSummary['role']) } satisfies GroupResponse);
      if (group.invitesLocked) return void res.status(403).json({ error: 'This group is not taking new members' });
      const [me, owner] = await Promise.all([User.findById(userId), User.findById(group.ownerId, { blocked: 1 })]);
      if (!me) return void res.status(401).json({ error: 'Account not found' });
      if ((owner?.blocked ?? []).includes(userId) || (me.blocked ?? []).includes(group.ownerId)) {
        return void res.status(403).json({ error: CANT_JOIN });
      }
      if ((await GroupMember.countDocuments({ userId })) >= GROUPS_PER_USER_MAX) {
        return void res.status(400).json({ error: 'You are in too many groups' });
      }
      // The count is the guard: only a join that finds room gets a seat.
      const room = await Group.findOneAndUpdate(
        { _id: gid, invitesLocked: false, members: { $lt: GROUP_MAX_MEMBERS } }, { $inc: { members: 1 } }, { returnDocument: 'after' },
      );
      if (!room) return void res.status(409).json({ error: GROUP_FULL });
      try {
        await GroupMember.create({ groupId: gid, userId, role: 'member' });
      } catch (err) {
        await Group.updateOne({ _id: gid }, { $inc: { members: -1 } });
        if (!isDuplicateKey(err)) throw err;
        return void res.status(200).json({ group: summaryOfGroup(group, 'member') } satisfies GroupResponse);
      }
      res.status(201).json({ group: summaryOfGroup(room, 'member') } satisfies GroupResponse);
    } catch (err) {
      failed(res, 'Join group', err);
    }
  };

  /** ADDA-2 POST /groups/:id/leave → 200. The owner's role passes to the longest-standing member. */
  const leave: RequestHandler = async (req, res) => {
    try {
      const m = await membership(req, res);
      if (!m) return;
      await dropMember(m.group, m.member);
      res.status(200).json({ ok: true });
    } catch (err) {
      failed(res, 'Leave group', err);
    }
  };

  /** ADDA-2 DELETE /groups/:id/members/:userId → 200 (owner only). */
  const removeMember: RequestHandler = async (req, res) => {
    try {
      const m = await membership(req, res, true);
      if (!m) return;
      const target = String(req.params.userId);
      if (target === m.userId) return void res.status(400).json({ error: 'Leave the group instead' });
      const member = await GroupMember.findOne({ groupId: m.group.id as string, userId: target });
      if (!member) return void res.status(404).json({ error: 'Not a member' });
      await dropMember(m.group, member);
      res.status(200).json({ ok: true });
    } catch (err) {
      failed(res, 'Remove member', err);
    }
  };

  /** ADDA-7 PATCH /groups/:id { name?, invitesLocked? } → { group } (owner only). */
  const update: RequestHandler = async (req, res) => {
    try {
      const body = parseBody(updateBody, req, res);
      if (!body) return;
      const m = await membership(req, res, true);
      if (!m) return;
      if (body.name !== undefined) m.group.name = body.name;
      if (body.invitesLocked !== undefined) m.group.invitesLocked = body.invitesLocked;
      await m.group.save();
      res.status(200).json({ group: summaryOfGroup(m.group, 'owner') } satisfies GroupResponse);
    } catch (err) {
      failed(res, 'Update group', err);
    }
  };

  return { create, list, get, preview, join, leave, removeMember, update };
}
