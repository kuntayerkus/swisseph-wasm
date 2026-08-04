/**
 * Simple LRU (Least Recently Used) cache implementation.
 *
 * Provides automatic eviction of least-recently-used entries when the cache
 * reaches its maximum size. Suitable for caching expensive calculations like
 * ephemeris positions.
 *
 * @template V - Value type
 */
export class LRUCache {
    maxSize;
    cache;
    /**
     * Create a new LRU cache.
     * @param maxSize - Maximum number of entries before eviction begins
     */
    constructor(maxSize = 1000) {
        if (maxSize <= 0) {
            throw new Error('LRUCache maxSize must be positive');
        }
        this.maxSize = maxSize;
        this.cache = new Map();
    }
    /**
     * Get the current number of entries in the cache.
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Get the maximum size of the cache.
     */
    get capacity() {
        return this.maxSize;
    }
    /**
     * Get a value from the cache.
     *
     * Updates the access timestamp to keep frequently used entries alive.
     *
     * @param key - The cache key
     * @returns The cached value, or undefined if not found
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }
        // Update timestamp to mark as recently used
        entry.timestamp = Date.now();
        return entry.value;
    }
    /**
     * Set a value in the cache.
     *
     * If the cache is at capacity, the least recently used entry will be evicted.
     *
     * @param key - The cache key
     * @param value - The value to cache
     */
    set(key, value) {
        // If key exists, update it and refresh timestamp
        if (this.cache.has(key)) {
            this.cache.set(key, { value, timestamp: Date.now() });
            return;
        }
        // Evict LRU entry if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        this.cache.set(key, { value, timestamp: Date.now() });
    }
    /**
     * Check if a key exists in the cache.
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Remove a specific entry from the cache.
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear all entries from the cache.
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Evict the least recently used entry.
     * Called automatically when cache reaches capacity.
     */
    evictLRU() {
        let oldestTime = Infinity;
        let oldestKey = null;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }
        if (oldestKey !== null) {
            this.cache.delete(oldestKey);
        }
    }
    /**
     * Get cache statistics for debugging/monitoring.
     */
    stats() {
        return {
            size: this.cache.size,
            capacity: this.maxSize,
            utilization: this.cache.size / this.maxSize,
        };
    }
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
export function memoize(fn, cache) {
    const memoCache = cache ?? new LRUCache(1000);
    return function (...args) {
        const key = JSON.stringify(args);
        const cached = memoCache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const result = fn(...args);
        memoCache.set(key, result);
        return result;
    };
}
/**
 * Enhanced memoization with configuration options.
 *
 * @param fn - The function to memoize
 * @param config - Cache configuration
 * @returns Memoized function with cache management methods
 */
export function createCachedFunction(fn, config = {}) {
    const { maxSize = 1000, enabled = true, keyGenerator, } = config;
    const cache = new LRUCache(maxSize);
    const cachedFn = function (...args) {
        if (!enabled) {
            return fn(...args);
        }
        const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
        const cachedResult = cache.get(key);
        if (cachedResult !== undefined) {
            return cachedResult;
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
    // Attach cache management methods
    cachedFn.cache = cache;
    cachedFn.clearCache = () => cache.clear();
    cachedFn.getStats = () => cache.stats();
    return cachedFn;
}
//# sourceMappingURL=lru-cache.js.map