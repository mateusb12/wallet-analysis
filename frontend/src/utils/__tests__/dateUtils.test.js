import { describe, expect, it } from 'vitest';
import { formatElapsedPeriod } from '../dateUtils.js';

describe('formatElapsedPeriod', () => {
  it('formats complete months and remaining days', () => {
    expect(formatElapsedPeriod('2024-01-10', '2025-11-05')).toBe('21m26d');
  });

  it('handles dates before a full calendar month', () => {
    expect(formatElapsedPeriod('2025-01-31', '2025-02-28')).toBe('1m0d');
  });

  it('returns zero for missing or invalid periods', () => {
    expect(formatElapsedPeriod(null, '2025-02-28')).toBe('0m0d');
  });
});
