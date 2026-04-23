import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
