import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { GROUP_MAX_MEMBERS, type GroupResponse, type GroupsResponse, type GroupView } from '@carrom/protocol';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Group } from '../models/group.model.js';
import { GroupMember } from '../models/groupMember.model.js';
import { Report } from '../models/report.model.js';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import { memoryPresence } from '../utils/presence.js';

const SECRET = 'g'.repeat(32);
const env: AppEnv = { CORS_ORIGIN: [], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] };
const app = createApp(env, { authRateLimit: 10_000, presence: memoryPresence() });
const auth = (id: string) => `Bearer ${signToken(id, SECRET)}`;

async function makeUsers(n: number, prefix = 'User'): Promise<string[]> {
  const docs = await User.insertMany(Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i + 100}` })));
  return docs.map((d) => d.id as string);
}

describe('ADDA-2 / ADDA-7 groups', () => {
  let owner = '';
  let amit = '';
  let code = '';
  let gid = '';
  const join = (id: string, c = code) => request(app).post(`/groups/join/${c}`).set('Authorization', auth(id));
  const view = async (id: string) => (await request(app).get(`/groups/${gid}`).set('Authorization', auth(id))).body as GroupView;

  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await Promise.all([User.syncIndexes(), Group.syncIndexes(), GroupMember.syncIndexes(), Report.syncIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Group.deleteMany({}), GroupMember.deleteMany({}), Report.deleteMany({})]);
    [owner = '', amit = ''] = await makeUsers(2);
    const res = await request(app).post('/groups').set('Authorization', auth(owner)).send({ name: '  Friday adda ' });
    expect(res.status).toBe(201);
    const g = (res.body as GroupResponse).group;
    ({ code, id: gid } = g);
    expect(g).toMatchObject({ name: 'Friday adda', role: 'owner', members: 1, invitesLocked: false });
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it('ADDA-2 invite link joins: preview, join once, listed in both members\' views', async () => {
    const pre = await request(app).get(`/groups/invite/${code.toLowerCase()}`);
    expect(pre.body).toEqual({ id: gid, name: 'Friday adda', members: 1, locked: false, member: false });
    expect((await join(amit)).status).toBe(201);
    expect((await join(amit)).status).toBe(200); // a second tap is fine
    const pre2 = await request(app).get(`/groups/invite/${code}`).set('Authorization', auth(amit));
    expect(pre2.body).toMatchObject({ members: 2, member: true });
    const v = await view(owner);
    expect(v.members.map((m) => [m.name, m.role])).toEqual([['User100', 'owner'], ['User101', 'member']]);
    expect(v.members[1]?.presence).toEqual({ state: 'offline' });
    const mine = (await request(app).get('/groups').set('Authorization', auth(amit))).body as GroupsResponse;
    expect(mine.groups).toEqual([{ id: gid, name: 'Friday adda', code, role: 'member', members: 2, invitesLocked: false }]);
    expect((await join(amit, 'ZZZZZZZZ')).status).toBe(404);
  });

  it('ADDA-2 21st member refused, also when many join at once', async () => {
    const others = await makeUsers(GROUP_MAX_MEMBERS + 4, 'Joiner');
    const res = await Promise.all(others.map((id) => join(id)));
    expect(res.filter((r) => r.status === 201)).toHaveLength(GROUP_MAX_MEMBERS - 1);
    expect(res.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await GroupMember.countDocuments({ groupId: gid })).toBe(GROUP_MAX_MEMBERS);
    expect((await Group.findById(gid))?.members).toBe(GROUP_MAX_MEMBERS);
  });

  it('ADDA-2 non-owner can\'t remove; owner removes; owner leaving hands the group over', async () => {
    const [cara = ''] = await makeUsers(1, 'Cara');
    await join(amit);
    await join(cara);
    expect((await request(app).delete(`/groups/${gid}/members/${cara}`).set('Authorization', auth(amit))).status).toBe(403);
    expect((await request(app).delete(`/groups/${gid}/members/${cara}`).set('Authorization', auth(owner))).status).toBe(200);
    expect((await view(owner)).members.map((m) => m.id)).toEqual([owner, amit]);
    // Removed members can't see the group.
    expect((await request(app).get(`/groups/${gid}`).set('Authorization', auth(cara))).status).toBe(404);

    expect((await request(app).post(`/groups/${gid}/leave`).set('Authorization', auth(owner))).status).toBe(200);
    const v = await view(amit);
    expect(v.group).toMatchObject({ ownerId: amit, role: 'owner', members: 1 });
    // The last member leaving deletes the group.
    await request(app).post(`/groups/${gid}/leave`).set('Authorization', auth(amit));
    expect(await Group.countDocuments()).toBe(0);
  });

  it('ADDA-7 owner locks invites; blocked users can\'t join; only the owner edits', async () => {
    expect((await request(app).patch(`/groups/${gid}`).set('Authorization', auth(owner)).send({ invitesLocked: true })).status).toBe(200);
    expect((await join(amit)).status).toBe(403);
    await request(app).patch(`/groups/${gid}`).set('Authorization', auth(owner)).send({ invitesLocked: false });

    await request(app).post('/me/block').set('Authorization', auth(owner)).send({ userId: amit });
    expect((await join(amit)).status).toBe(403);
    await request(app).delete(`/me/block/${amit}`).set('Authorization', auth(owner));
    expect((await join(amit)).status).toBe(201);
    expect((await request(app).patch(`/groups/${gid}`).set('Authorization', auth(amit)).send({ name: 'Mine now' })).status).toBe(403);
  });

  it('ADDA-7 report a member or the group, once each', async () => {
    await join(amit);
    const report = (b: object) => request(app).post(`/groups/${gid}/report`).set('Authorization', auth(amit)).send(b);
    expect((await report({ userId: owner, reason: 'abuse' })).status).toBe(201);
    expect((await report({ userId: owner, reason: 'abuse' })).status).toBe(200);
    expect((await report({ reason: 'spam' })).status).toBe(201);
    expect((await report({ userId: amit, reason: 'spam' })).status).toBe(400);
    const rows = await Report.find({}).sort({ createdAt: 1 }).lean();
    expect(rows.map((r) => [r.userId, r.matchId, r.reason])).toEqual([
      [owner, `group:${gid}`, 'abuse'], [owner, `group:${gid}:self`, 'spam'],
    ]);
  });
});
