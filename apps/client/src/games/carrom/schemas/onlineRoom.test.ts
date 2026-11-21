import { describe, expect, it } from 'vitest';
import { createRoomSchema, joinCodeSchema, toRoomOptions } from './onlineRoom';

describe('online room forms', () => {
  it('ROOM-11 create: lengths must suit the preset', () => {
    expect(createRoomSchema.safeParse({ format: '2v2', preset: 'point', length: '300' }).success).toBe(true);
    expect(createRoomSchema.safeParse({ format: '1v1', preset: 'point', length: '29' }).success).toBe(false);
    expect(toRoomOptions({ format: '1v1', preset: 'colour', length: '19' }))
      .toEqual({ gameId: 'carrom', config: { format: '1v1', preset: 'colour', length: { kind: 'points', target: 19 } } });
  });

  it('ROOM-1 join code: any case and spaces are fine; 0/O/1/I and bad lengths are not', () => {
    expect(joinCodeSchema.parse({ code: ' abc 234 ' })).toEqual({ code: 'ABC234' });
    expect(joinCodeSchema.safeParse({ code: 'ABC10O' }).success).toBe(false);
    expect(joinCodeSchema.safeParse({ code: 'ABC23' }).success).toBe(false);
  });
});
