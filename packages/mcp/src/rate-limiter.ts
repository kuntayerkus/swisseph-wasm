/**
 * Simple token bucket rate limiter for MCP server.
 * 
 * Prevents abuse by limiting the number of requests per IP/client within
 * a time window. Uses a token bucket algorithm: tokens are consumed on
 * each request and refilled at a constant rate.
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Message to return when rate limit is exceeded */
  message: string;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a client is rate limited.
   * @param clientId Unique identifier for the client (e.g., IP address)
   * @returns true if request is allowed, false if rate limited
   */
  isAllowed(clientId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(clientId);

    // Create new bucket if doesn't exist
    if (!bucket) {
      bucket = {
        tokens: this.config.maxRequests,
        lastRefill: now,
      };
      this.buckets.set(clientId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = elapsed * refillRate;
    
    bucket.tokens = Math.min(this.config.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Consume a token if available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get remaining tokens for a client
   */
  getRemainingTokens(clientId: string): number {
    const bucket = this.buckets.get(clientId);
    if (!bucket) return this.config.maxRequests;

    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = elapsed * refillRate;
    
    return Math.min(this.config.maxRequests, bucket.tokens + tokensToAdd);
  }

  /**
   * Get retry-after time in seconds for a client
   */
  getRetryAfter(clientId: string): number {
    const bucket = this.buckets.get(clientId);
    if (!bucket || bucket.tokens >= 1) return 0;

    const tokensNeeded = 1 - bucket.tokens;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const timeNeeded = tokensNeeded / refillRate;
    
    return Math.ceil(timeNeeded / 1000); // Convert to seconds
  }

  /**
   * Clear all rate limit data (useful for testing)
   */
  clear(): void {
    this.buckets.clear();
  }

  /**
   * Remove old entries to prevent memory leaks
   * Call this periodically (e.g., every hour)
   */
  pruneOldEntries(maxAgeMs: number = this.config.windowMs * 2): void {
    const now = Date.now();
    for (const [clientId, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAgeMs) {
        this.buckets.delete(clientId);
      }
    }
  }
}

/**
 * Default rate limit configuration for MCP server
 * 30 requests per minute per client
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
  message: 'Rate limit exceeded. Too many requests, please try again later.',
};

/**
 * Create a rate limiter with default MCP server configuration
 */
export function createMcpRateLimiter(): RateLimiter {
  return new RateLimiter(DEFAULT_RATE_LIMIT_CONFIG);
}
