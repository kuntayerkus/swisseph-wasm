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
export declare class RateLimiter {
    private buckets;
    private config;
    constructor(config: RateLimitConfig);
    /**
     * Check if a client is rate limited.
     * @param clientId Unique identifier for the client (e.g., IP address)
     * @returns true if request is allowed, false if rate limited
     */
    isAllowed(clientId: string): boolean;
    /**
     * Get remaining tokens for a client
     */
    getRemainingTokens(clientId: string): number;
    /**
     * Get retry-after time in seconds for a client
     */
    getRetryAfter(clientId: string): number;
    /**
     * Clear all rate limit data (useful for testing)
     */
    clear(): void;
    /**
     * Remove old entries to prevent memory leaks
     * Call this periodically (e.g., every hour)
     */
    pruneOldEntries(maxAgeMs?: number): void;
}
/**
 * Default rate limit configuration for MCP server
 * 30 requests per minute per client
 */
export declare const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig;
/**
 * Create a rate limiter with default MCP server configuration
 */
export declare function createMcpRateLimiter(): RateLimiter;
//# sourceMappingURL=rate-limiter.d.ts.map