import { formatCredits, creditsToDollars, formatDate, formatDateTime, truncate } from '@/lib/utils';

describe('utils', () => {
  describe('formatCredits', () => {
    it('formats zero credits', () => {
      expect(formatCredits(0)).toBe('0');
    });

    it('formats small numbers without commas', () => {
      expect(formatCredits(100)).toBe('100');
      expect(formatCredits(999)).toBe('999');
    });

    it('formats large numbers with commas', () => {
      expect(formatCredits(1000)).toBe('1,000');
      expect(formatCredits(1000000)).toBe('1,000,000');
      expect(formatCredits(10500)).toBe('10,500');
    });

    it('handles negative numbers', () => {
      expect(formatCredits(-500)).toBe('-500');
      expect(formatCredits(-1500)).toBe('-1,500');
    });
  });

  describe('creditsToDollars', () => {
    it('converts 0 credits to $0.00', () => {
      expect(creditsToDollars(0)).toBe('$0.00');
    });

    it('converts 100 credits to $1.00', () => {
      expect(creditsToDollars(100)).toBe('$1.00');
    });

    it('converts 4999 credits to $49.99', () => {
      expect(creditsToDollars(4999)).toBe('$49.99');
    });

    it('converts 50 credits to $0.50', () => {
      expect(creditsToDollars(50)).toBe('$0.50');
    });

    it('handles large amounts', () => {
      expect(creditsToDollars(100000)).toBe('$1000.00');
    });
  });

  describe('formatDate', () => {
    it('formats a Date object', () => {
      const date = new Date('2026-02-10T12:00:00Z');
      const result = formatDate(date);
      expect(result).toMatch(/Feb/);
      expect(result).toMatch(/10/);
      expect(result).toMatch(/2026/);
    });

    it('formats a date string', () => {
      const result = formatDate('2026-01-15');
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2026/);
    });
  });

  describe('formatDateTime', () => {
    it('includes time in output', () => {
      const date = new Date('2026-02-10T14:30:00Z');
      const result = formatDateTime(date);
      expect(result).toMatch(/Feb/);
      expect(result).toMatch(/10/);
    });
  });

  describe('truncate', () => {
    it('returns string as-is if shorter than limit', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('returns string as-is if exactly at limit', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('truncates and adds ellipsis if longer than limit', () => {
      expect(truncate('hello world', 5)).toBe('hello...');
    });

    it('handles empty string', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('truncates long text correctly', () => {
      const longText = 'a'.repeat(100);
      const result = truncate(longText, 10);
      expect(result).toBe('a'.repeat(10) + '...');
      expect(result.length).toBe(13);
    });
  });
});
