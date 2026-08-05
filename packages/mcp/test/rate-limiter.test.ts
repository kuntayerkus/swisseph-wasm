import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, DEFAULT_RATE_LIMIT_CONFIG, createMcpRateLimiter } from '../src/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000, // 1 second for testing
      message: 'Rate limit exceeded',
    });
  });

  it('allows requests within limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed('client1')).toBe(true);
    }
  });

  it('blocks requests exceeding limit', () => {
    // Use all tokens
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed('client1');
    }
    
    // Next request should be blocked
    expect(limiter.isAllowed('client1')).toBe(false);
  });

  it('tracks different clients separately', () => {
    // Exhaust client1's limit
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed('client1');
    }
    
    // client2 should still have tokens
    expect(limiter.isAllowed('client2')).toBe(true);
  });

  it('refills tokens over time', async () => {
    const fastLimiter = new RateLimiter({
      maxRequests: 2,
      windowMs: 100, // 100ms for fast testing
      message: 'Rate limit exceeded',
    });

    // Use all tokens
    fastLimiter.isAllowed('client1');
    fastLimiter.isAllowed('client1');
    expect(fastLimiter.isAllowed('client1')).toBe(false);

    // Wait for refill
    await new Promise(resolve => setTimeout(resolve, 110));
    
    // Should have refilled
    expect(fastLimiter.isAllowed('client1')).toBe(true);
  });

  it('returns correct remaining tokens', () => {
    expect(limiter.getRemainingTokens('new-client')).toBe(5);
    
    limiter.isAllowed('client1');
    limiter.isAllowed('client1');
    
    expect(limiter.getRemainingTokens('client1')).toBeLessThan(5);
  });

  it('returns retry-after time when limited', () => {
    // Exhaust tokens
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed('client1');
    }
    
    const retryAfter = limiter.getRetryAfter('client1');
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(2); // Should be around 1 second
  });

  it('clears all buckets', () => {
    limiter.isAllowed('client1');
    limiter.isAllowed('client2');
    
    limiter.clear();
    
    expect(limiter.getRemainingTokens('client1')).toBe(5);
    expect(limiter.getRemainingTokens('client2')).toBe(5);
  });

  it('prunes old entries', async () => {
    const pruneLimiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 50,
      message: 'Rate limit exceeded',
    });

    pruneLimiter.isAllowed('client1');
    pruneLimiter.isAllowed('client2');
    
    // Wait for entries to become old
    await new Promise(resolve => setTimeout(resolve, 110));
    
    pruneLimiter.pruneOldEntries(100);
    
    // Buckets should be pruned
    expect(pruneLimiter.getRemainingTokens('client1')).toBe(5);
  });

  it('uses default MCP configuration', () => {
    const mcpLimiter = createMcpRateLimiter();
    
    expect(mcpLimiter.getRemainingTokens('test')).toBe(30);
    
    // Use some tokens
    for (let i = 0; i < 10; i++) {
      mcpLimiter.isAllowed('test');
    }
    
    expect(mcpLimiter.getRemainingTokens('test')).toBe(20);
  });
});
