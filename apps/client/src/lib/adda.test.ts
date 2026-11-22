import { describe, expect, it } from 'vitest';
import { loungePeers } from '@/components/LoungeVoice';
import { groupInviteUrl, presenceGame, presenceText } from './adda';

describe('ADDA client helpers', () => {
  it('ADDA-2 invite links open on the web: the page origin there, the hub URL inside the apps', () => {
    expect(groupInviteUrl('ABCDEFGH', false, 'https://adda.example')).toBe('https://adda.example/a/ABCDEFGH');
    expect(groupInviteUrl('ABCDEFGH', true, 'https://localhost')).toMatch(/^https:\/\/(?!localhost).+\/a\/ABCDEFGH$/);
  });

  it('ADDA-1 presence reports the game of a running match only', () => {
    expect(presenceGame('/g/ludo/online/game')).toBe('ludo');
    expect(presenceGame('/g/carrom/local/play')).toBe('carrom');
    expect(presenceGame('/g/carrom/online/lobby')).toBeNull();
    expect(presenceGame('/groups/abc')).toBeNull();
    expect(presenceText({ state: 'game', game: 'ludo' })).toEqual({ key: 'adda.status.game', game: 'ludo' });
    expect(presenceText({ state: 'offline' }).key).toBe('adda.status.offline');
  });

  it('ADDA-5 lounge links: everyone else with voice on, sorted by session id', () => {
    const m = (sessionId: string, voiceOn: boolean) => ({ sessionId, userId: `u-${sessionId}`, name: sessionId, avatar: 0, voiceOn, voiceMuted: true });
    expect(loungePeers([m('c', true), m('me', true), m('a', true), m('b', false)], 'me'))
      .toEqual([{ sessionId: 'a', userId: 'u-a' }, { sessionId: 'c', userId: 'u-c' }]);
  });
});
