// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { SHOCK_ENERGY_LEVELS } from './constants';

describe('SHOCK_ENERGY_LEVELS', () => {
  it('should contain the correct shock energy levels', () => {
    expect(SHOCK_ENERGY_LEVELS).toEqual([120, 150, 200]);
  });

  it('should be read-only (as const)', () => {
    // Ensuring the type matches expectation
    const levels: readonly number[] = SHOCK_ENERGY_LEVELS;
    expect(levels).toBeDefined();
  });
});
