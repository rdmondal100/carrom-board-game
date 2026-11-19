import { INVITE_ALPHABET } from '@carrom/protocol';
import { describe, expect, it } from 'vitest';
import { makeInviteCode, normaliseInviteCode } from './inviteCode.js';

describe('invite code', () => {
  it('ROOM-1 codes are 6 chars from the alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = makeInviteCode();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      for (const c of code) expect(INVITE_ALPHABET).toContain(c);
    }
    expect(makeInviteCode(() => 0)).toBe('AAAAAA');
  });

  it('ROOM-1 normalise accepts lower case, rejects bad letters and lengths', () => {
    expect(normaliseInviteCode(' abc234 ')).toBe('ABC234');
    expect(normaliseInviteCode('ABC10O')).toBeNull();
    expect(normaliseInviteCode('ABCDE')).toBeNull();
  });
});
