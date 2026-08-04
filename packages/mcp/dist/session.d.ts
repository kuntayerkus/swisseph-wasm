/**
 * Instance lifecycle and ephemeris discovery.
 *
 * One Swiss Ephemeris instance per tool call, disposed afterwards. That is
 * not caution for its own sake: the library keeps all of its state in a
 * single global C struct, so a shared instance would let the sidereal mode or
 * topocentric position set by one call leak into the next. Measured cost of a
 * fresh instance is about 9 ms against 0.6 ms for a full chart — cheap enough
 * that isolation needs no defending.
 */
import { type SwissEph } from '@kuntay/swisseph';
import { type RateLimiter } from './rate-limiter.js';
export interface EphemerisStatus {
    /** Where the data came from, for the caller to see. */
    description: string;
    /** True when real `.se1` files were mounted. */
    full: boolean;
}
export declare const ephemerisStatus: EphemerisStatus;
/** Global rate limiter instance for the MCP server */
export declare const rateLimiter: RateLimiter;
/**
 * Runs `work` against a fresh instance and disposes it afterwards.
 *
 * The directory is mounted through NODEFS rather than copied, so the 2 MB of
 * data is shared across instances instead of duplicated per call.
 */
export declare function withEphemeris<T>(work: (swe: SwissEph) => T): Promise<T>;
//# sourceMappingURL=session.d.ts.map