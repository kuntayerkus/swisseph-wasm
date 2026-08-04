/**
 * Simple LRU (Least Recently Used) cache implementation.
 *
 * Provides automatic eviction of least-recently-used entries when the cache
 * reaches its maximum size. Suitable for caching expensive calculations like
 * ephemeris positions.
 *
 * @template V - Value type
 */
export declare class LRUCache<V> {
    private readonly maxSize;
    private readonly cache;
    /**
     * Create a new LRU cache.
     * @param maxSize - Maximum number of entries before eviction begins
     */
    constructor(maxSize?: number);
    /**
     * Get the current number of entries in the cache.
     */
    get size(): number;
    /**
     * Get the maximum size of the cache.
     */
    get capacity(): number;
    /**
     * Get a value from the cache.
     *
     * Updates the access timestamp to keep frequently used entries alive.
     *
     * @param key - The cache key
     * @returns The cached value, or undefined if not found
     */
    get(key: string): V | undefined;
    /**
     * Set a value in the cache.
     *
     * If the cache is at capacity, the least recently used entry will be evicted.
     *
     * @param key - The cache key
     * @param value - The value to cache
     */
    set(key: string, value: V): void;
    /**
     * Check if a key exists in the cache.
     */
    has(key: string): boolean;
    /**
     * Remove a specific entry from the cache.
     */
    delete(key: string): boolean;
    /**
     * Clear all entries from the cache.
     */
    clear(): void;
    /**
     * Evict the least recently used entry.
     * Called automatically when cache reaches capacity.
     */
    private evictLRU;
    /**
     * Get cache statistics for debugging/monitoring.
     */
    stats(): {
        size: number;
        capacity: number;
        utilization: number;
    };
}
/**
 * Memoization decorator for expensive calculations.
 *
 * Wraps a function and caches its results based on input arguments.
 * Uses LRU eviction strategy to prevent unbounded memory growth.
 *
 * @param fn - The function to memoize
 * @param cache - Optional LRU cache instance (creates new one if not provided)
 * @returns Memoized version of the function
 *
 * @example
 * ```typescript
 * const expensiveCalc = memoize((jd: number, body: number) => {
 *   // ... expensive calculation
 *   return result;
 * }, new LRUCache(500));
 *
 * // First call computes the result
 * const pos1 = expensiveCalc(2451545.0, 0);
 *
 * // Second call with same args returns cached result instantly
 * const pos2 = expensiveCalc(2451545.0, 0);
 * ```
 */
export declare function memoize<T extends (...args: unknown[]) => unknown>(fn: T, cache?: LRUCache<ReturnType<T>>): T;
/**
 * Cache configuration options.
 */
export interface CacheConfig {
    /** Maximum number of entries (default: 1000) */
    maxSize?: number;
    /** Enable/disable caching (default: true) */
    enabled?: boolean;
    /** Custom key generator function */
    keyGenerator?: (...args: unknown[]) => string;
}
/**
 * Enhanced memoization with configuration options.
 *
 * @param fn - The function to memoize
 * @param config - Cache configuration
 * @returns Memoized function with cache management methods
 */
export declare function createCachedFunction<T extends (...args: unknown[]) => unknown>(fn: T, config?: CacheConfig): T & {
    cache: LRUCache<ReturnType<T>>;
    clearCache: () => void;
    getStats: () => {
        size: number;
        capacity: number;
        utilization: number;
    };
};
//# sourceMappingURL=lru-cache.d.ts.map