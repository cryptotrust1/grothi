import { checkDailyLimit, wrapLinksForTracking, getTrackingPixelUrl } from '@/lib/email';

describe('Email utilities', () => {
  describe('checkDailyLimit', () => {
    it('allows sending when under limit', () => {
      const result = checkDailyLimit(5, 100, new Date());
      expect(result.canSend).toBe(true);
      expect(result.remaining).toBe(95);
      expect(result.needsReset).toBe(false);
    });

    it('blocks sending when at limit', () => {
      const result = checkDailyLimit(100, 100, new Date());
      expect(result.canSend).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('blocks sending when over limit', () => {
      const result = checkDailyLimit(150, 100, new Date());
      expect(result.canSend).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('resets counter when last reset was on a different day', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = checkDailyLimit(100, 100, yesterday);
      expect(result.canSend).toBe(true);
      expect(result.remaining).toBe(100);
      expect(result.needsReset).toBe(true);
    });

    it('does not reset counter when last reset was today', () => {
      const result = checkDailyLimit(50, 100, new Date());
      expect(result.needsReset).toBe(false);
      expect(result.remaining).toBe(50);
    });

    it('handles zero daily limit', () => {
      const result = checkDailyLimit(0, 0, new Date());
      expect(result.canSend).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('wrapLinksForTracking', () => {
    it('wraps http links with tracking URL', () => {
      const html = '<a href="https://example.com/page">Click</a>';
      const result = wrapLinksForTracking(html, 'send123', 'https://grothi.com');
      expect(result).toContain('href="https://grothi.com/api/email/track/click?sid=send123&url=');
      expect(result).toContain(encodeURIComponent('https://example.com/page'));
    });

    it('does not wrap unsubscribe links', () => {
      const html = '<a href="https://example.com/unsubscribe?id=1">Unsubscribe</a>';
      const result = wrapLinksForTracking(html, 'send123', 'https://grothi.com');
      expect(result).toContain('href="https://example.com/unsubscribe?id=1"');
    });

    it('wraps multiple links', () => {
      const html = '<a href="https://a.com">A</a><a href="https://b.com">B</a>';
      const result = wrapLinksForTracking(html, 'send1', 'https://grothi.com');
      expect(result).toContain(encodeURIComponent('https://a.com'));
      expect(result).toContain(encodeURIComponent('https://b.com'));
    });

    it('handles html with no links', () => {
      const html = '<p>No links here</p>';
      const result = wrapLinksForTracking(html, 'send1', 'https://grothi.com');
      expect(result).toBe(html);
    });

    it('encodes sendId in tracking URL', () => {
      const html = '<a href="https://example.com">Link</a>';
      const result = wrapLinksForTracking(html, 'id with spaces', 'https://grothi.com');
      expect(result).toContain('sid=id%20with%20spaces');
    });
  });

  describe('getTrackingPixelUrl', () => {
    it('generates correct tracking pixel URL', () => {
      const url = getTrackingPixelUrl('send123', 'https://grothi.com');
      expect(url).toBe('https://grothi.com/api/email/track/open?sid=send123');
    });

    it('encodes special characters in sendId', () => {
      const url = getTrackingPixelUrl('id&special', 'https://grothi.com');
      expect(url).toContain('sid=id%26special');
    });
  });
});
