import { describe, expect, it } from 'vitest';
import { EXPECTED_HASH, runPhy7 } from './determinismFixture';

describe('determinism fixture', () => {
  it('BRD-8 Node: PHY-7 input hash equals EXPECTED_HASH', () => {
    expect(runPhy7()).toBe(EXPECTED_HASH);
  });
});
