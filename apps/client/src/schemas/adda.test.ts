import { describe, expect, it } from 'vitest';
import { friendCodeSchema, groupCodeSchema, groupNameSchema } from './adda';

describe('ADDA forms', () => {
  it('ADDA-1 a player code: 8 chars of the invite alphabet, any case, spaces ignored', () => {
    expect(friendCodeSchema.parse({ code: 'abcd efgh' })).toEqual({ code: 'ABCDEFGH' });
    expect(friendCodeSchema.safeParse({ code: 'ABCDEFG0' }).success).toBe(false); // 0 is not in the alphabet
    expect(friendCodeSchema.safeParse({ code: 'ABC' }).success).toBe(false);
  });

  it('ADDA-2 a group code, or the invite link pasted whole', () => {
    expect(groupCodeSchema.parse({ code: 'https://adda.example/a/wxyz2345?x=1' })).toEqual({ code: 'WXYZ2345' });
    expect(groupCodeSchema.parse({ code: 'wxyz2345' })).toEqual({ code: 'WXYZ2345' });
    expect(groupCodeSchema.safeParse({ code: 'https://adda.example/join/ABCDEF' }).success).toBe(false);
  });

  it('ADDA-2 a group name is 3 to 30 characters after trimming', () => {
    expect(groupNameSchema.parse({ name: '  Friday adda ' })).toEqual({ name: 'Friday adda' });
    expect(groupNameSchema.safeParse({ name: ' ab ' }).success).toBe(false);
    expect(groupNameSchema.safeParse({ name: 'x'.repeat(31) }).success).toBe(false);
  });
});
