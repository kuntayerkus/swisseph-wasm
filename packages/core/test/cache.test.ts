import { describe, it, expect } from 'vitest';
import { LRUCache, memoize, createCachedFunction } from '../src/cache/lru-cache.js';

describe('LRUCache', () => {
  it('should store and retrieve values', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('key1', 42);
    expect(cache.get('key1')).toBe(42);
  });

  it('should return undefined for missing keys', () => {
    const cache = new LRUCache<string, number>(10);
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should evict LRU entry when at capacity', async () => {
    const cache = new LRUCache<number>(3);
    cache.set('a', 1);
    
    // Wait to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 5));
    cache.set('b', 2);
    
    await new Promise(resolve => setTimeout(resolve, 5));
    cache.set('c', 3);
    
    // Access 'a' to make it recently used (updates its timestamp to now)
    cache.get('a');
    
    // Now order by timestamp (oldest to newest): b, c, a
    // Add new entry, should evict 'b' (least recently used)
    cache.set('d', 4);
    
    expect(cache.get('a')).toBe(1); // Still there (most recently used)
    expect(cache.get('b')).toBeUndefined(); // Evicted (oldest)
    expect(cache.get('c')).toBe(3); // Still there
    expect(cache.get('d')).toBe(4); // New entry
  });

  it('should update timestamp on get', async () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('x', 1);
    cache.set('y', 2);
    
    // Wait a bit then access 'x'
    await new Promise(resolve => setTimeout(resolve, 10));
    cache.get('x');
    
    // Add new entry, should evict 'y' not 'x'
    cache.set('z', 3);
    
    expect(cache.get('x')).toBe(1);
    expect(cache.get('y')).toBeUndefined();
    expect(cache.get('z')).toBe(3);
  });

  it('should update value and refresh timestamp on set for existing key', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('key', 1);
    cache.set('key', 2);
    
    expect(cache.get('key')).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('should check existence with has', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('exists', 42);
    
    expect(cache.has('exists')).toBe(true);
    expect(cache.has('notexists')).toBe(false);
  });

  it('should delete entries', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('todelete', 42);
    
    expect(cache.delete('todelete')).toBe(true);
    expect(cache.has('todelete')).toBe(false);
    expect(cache.delete('nonexistent')).toBe(false);
  });

  it('should clear all entries', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    
    cache.clear();
    
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('should report correct stats', () => {
    const cache = new LRUCache<string, number>(100);
    cache.set('a', 1);
    cache.set('b', 2);
    
    const stats = cache.stats();
    expect(stats.size).toBe(2);
    expect(stats.capacity).toBe(100);
    expect(stats.utilization).toBe(0.02);
  });

  it('should throw error for non-positive maxSize', () => {
    expect(() => new LRUCache(0)).toThrow('maxSize must be positive');
    expect(() => new LRUCache(-1)).toThrow('maxSize must be positive');
  });

  it('should handle default maxSize of 1000', () => {
    const cache = new LRUCache<string, number>();
    expect(cache.capacity).toBe(1000);
  });
});

describe('memoize', () => {
  it('should cache function results', () => {
    let callCount = 0;
    const fn = memoize((x: number): number => {
      callCount++;
      return x * 2;
    });
    
    expect(fn(5)).toBe(10);
    expect(fn(5)).toBe(10);
    expect(callCount).toBe(1); // Only called once
  });

  it('should cache different arguments separately', () => {
    let callCount = 0;
    const fn = memoize((x: number): number => {
      callCount++;
      return x * 2;
    });
    
    fn(1);
    fn(2);
    fn(1);
    fn(3);
    fn(2);
    
    expect(callCount).toBe(3); // Called for 1, 2, and 3
  });

  it('should work with multiple arguments', () => {
    let callCount = 0;
    const fn = memoize((a: number, b: number): number => {
      callCount++;
      return a + b;
    });
    
    expect(fn(1, 2)).toBe(3);
    expect(fn(1, 2)).toBe(3);
    expect(fn(2, 1)).toBe(3);
    expect(fn(2, 1)).toBe(3);
    expect(callCount).toBe(2); // Different arg combinations
  });

  it('should use custom cache if provided', () => {
    const customCache = new LRUCache<string, number>(5);
    let callCount = 0;
    
    const fn = memoize((x: number): number => {
      callCount++;
      return x * 2;
    }, customCache);
    
    fn(1);
    fn(2);
    
    expect(customCache.size).toBe(2);
    expect(callCount).toBe(2);
  });
});

describe('createCachedFunction', () => {
  it('should create cached function with management methods', () => {
    let callCount = 0;
    const cachedFn = createCachedFunction((x: number): number => {
      callCount++;
      return x * 2;
    });
    
    expect(cachedFn(5)).toBe(10);
    expect(cachedFn(5)).toBe(10);
    expect(callCount).toBe(1);
    
    expect(typeof cachedFn.clearCache).toBe('function');
    expect(typeof cachedFn.getStats).toBe('function');
    expect(cachedFn.cache).toBeDefined();
  });

  it('should allow clearing cache', () => {
    let callCount = 0;
    const cachedFn = createCachedFunction((x: number): number => {
      callCount++;
      return x * 2;
    });
    
    cachedFn(5);
    cachedFn(5);
    expect(callCount).toBe(1);
    
    cachedFn.clearCache();
    cachedFn(5);
    expect(callCount).toBe(2); // Recalculated after clear
  });

  it('should provide stats', () => {
    const cachedFn = createCachedFunction((x: number): number => x * 2);
    
    cachedFn(1);
    cachedFn(2);
    cachedFn(3);
    
    const stats = cachedFn.getStats();
    expect(stats.size).toBe(3);
    expect(stats.capacity).toBe(1000);
  });

  it('should respect custom maxSize config', () => {
    const cachedFn = createCachedFunction((x: number): number => x * 2, {
      maxSize: 5,
    });
    
    for (let i = 0; i < 10; i++) {
      cachedFn(i);
    }
    
    const stats = cachedFn.getStats();
    expect(stats.size).toBe(5);
    expect(stats.capacity).toBe(5);
  });

  it('should allow disabling cache', () => {
    let callCount = 0;
    const cachedFn = createCachedFunction((x: number): number => {
      callCount++;
      return x * 2;
    }, { enabled: false });
    
    cachedFn(5);
    cachedFn(5);
    cachedFn(5);
    
    expect(callCount).toBe(3); // Called every time
  });

  it('should use custom key generator', () => {
    let callCount = 0;
    const cachedFn = createCachedFunction(
      (obj: { id: number }): number => {
        callCount++;
        return obj.id * 2;
      },
      {
        keyGenerator: (...args: unknown[]) => {
          const obj = args[0] as { id: number };
          return `id:${obj.id}`;
        },
      }
    );
    
    cachedFn({ id: 1 });
    cachedFn({ id: 1 });
    cachedFn({ id: 2 });
    
    expect(callCount).toBe(2);
  });
});
