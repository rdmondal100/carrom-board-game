import RedisMock from 'ioredis-mock';
import { describe, expect, it } from 'vitest';
import { NOTICES_MAX, PRESENCE_TTL_S } from '@carrom/protocol';
import { memoryPresence, redisPresence, type PresenceStore } from './presence.js';
import type { Redis } from './redis.js';

const from = { id: 'u1', name: 'Rina', avatar: 0 };

function shared(name: string, make: () => PresenceStore) {
  it(`ADDA-1 ${name}: menu, game, offline`, async () => {
    const p = make();
    await p.beat('a', null);
    await p.beat('b', 'ludo');
    const s = await p.statuses(['a', 'b', 'c']);
    expect(Object.fromEntries(s)).toEqual({ a: { state: 'menu' }, b: { state: 'game', game: 'ludo' }, c: { state: 'offline' } });
    expect((await p.statuses([])).size).toBe(0);
  });

  it(`ADDA-6 ${name}: notices come once, oldest first, at most NOTICES_MAX`, async () => {
    const p = make();
    for (let i = 0; i < NOTICES_MAX + 3; i++) await p.push('a', { kind: 'friendRequest', from: { ...from, avatar: i % 12 } });
    const got = await p.take('a');
    expect(got).toHaveLength(NOTICES_MAX);
    expect(got[0]).toMatchObject({ kind: 'friendRequest', from: { avatar: 3 } });
    expect(typeof got[0]?.id).toBe('string');
    expect(await p.take('a')).toEqual([]);
  });
}

describe('ADDA-1 / ADDA-6 presence store', () => {
  shared('memory', () => memoryPresence());
  shared('redis', () => redisPresence(new RedisMock() as unknown as Redis));

  it('ADDA-1 memory: a status without a beat for PRESENCE_TTL_S is offline', async () => {
    let now = 1000;
    const p = memoryPresence(() => now);
    await p.beat('a', 'carrom');
    now += PRESENCE_TTL_S * 1000 - 1;
    expect((await p.statuses(['a'])).get('a')).toEqual({ state: 'game', game: 'carrom' });
    now += 2;
    expect((await p.statuses(['a'])).get('a')).toEqual({ state: 'offline' });
  });
});
