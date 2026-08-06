/**
 * City lookup and timezone resolution.
 *
 * The coordinate/offset half of chart input. `@kuntay/swisseph` computes
 * the sky; this package answers "where is İstanbul and what was its clock
 * doing on 1990-01-15?" — from bundled GeoNames data and the platform's
 * own tz database, with no web service and no dependencies.
 */
/** One populated place from the GeoNames cities15000 tier. */
export interface City {
    /** Local-script name, e.g. `İstanbul`. */
    name: string;
    /** ASCII-folded name for matching, e.g. `Istanbul`. */
    asciiName: string;
    /** Degrees north (south negative). */
    latitude: number;
    /** Degrees east (west negative). */
    longitude: number;
    /** ISO 3166-1 alpha-2, e.g. `TR`. */
    countryCode: string;
    /** English country name, e.g. `Türkiye`. */
    country: string;
    /** IANA zone id, e.g. `Europe/Istanbul`. */
    timezone: string;
    /** Population figure from the source; ranking aid, not astronomy. */
    population: number;
}
/**
 * Parses `cities.tsv` (the file this package ships).
 *
 * The format is deliberately boring: one tab-separated line per city,
 * `#` lines ignored, columns fixed by {@link City}. Rows that cannot be
 * parsed are skipped, not thrown on — a data file should never take the
 * whole application down, and the generator already validated the shape.
 */
export declare function parseCities(text: string): City[];
/** Options for {@link searchCities}. */
export interface SearchOptions {
    /** Restrict to one ISO 3166-1 alpha-2 code, e.g. `TR`. */
    country?: string;
    /** Maximum number of results. Defaults to 10. */
    limit?: number;
}
/**
 * Finds cities matching a query string.
 *
 * Ranking, within each class by population:
 * 1. exact name match (`izmir` → İzmir)
 * 2. name starts with the query (`ist` → İstanbul, Istres, ...)
 * 3. any word of the name starts with it (`los` → Los Angeles)
 * 4. substring (`ange` → Los Angeles)
 *
 * Returns at most `limit` results (default 10).
 */
export declare function searchCities(cities: readonly City[], query: string, options?: SearchOptions): City[];
/**
 * The zone's offset from UTC at one instant, in hours east of Greenwich.
 *
 * Implemented over `Intl.DateTimeFormat` — the platform's tz database —
 * which is present in every browser and in Node ≥ 16 with full ICU
 * (Node 24 ships it by default). Historical offsets and DST are answered
 * by the database, not by a lookup table in this package.
 *
 * The technique: format the instant in the target zone, read the
 * wall-clock fields back, interpret them as UTC. The difference is the
 * offset.
 */
export declare function zoneOffsetHours(zone: string, utcMs: number): number;
/** Result of resolving a wall-clock reading to an offset. */
export interface WallClockOffset {
    /** Offset actually applying to that wall-clock reading, hours east of UTC. */
    offsetHours: number;
    /**
     * True when the reading occurred TWICE — the repeated hour of a
     * daylight-saving fall-back. `alternativeOffsetHours` carries the other
     * occurrence; a birth record giving only the clock cannot tell them apart.
     */
    ambiguous: boolean;
    /** The offset of the occurrence not chosen. Only set when ambiguous. */
    alternativeOffsetHours?: number;
}
/**
 * Resolves a local wall-clock reading to the zone offset that applied.
 *
 * Two passes: the first treats the wall clock as UTC and measures the
 * offset there; the second re-measures at the corrected instant, which
 * matters when the guess and the answer sit on opposite sides of a DST
 * transition. (The full treatment — including spring-forward gaps and a
 * discussion of both fall-back occurrences — lives in the MCP server's
 * `time.ts`; this is the compact, dependency-free core of it.)
 */
export declare function offsetForWallClock(zone: string, year: number, month: number, day: number, hour: number, minute?: number, second?: number): WallClockOffset;
/** Formats hours east of Greenwich as `"+03:00"` / `"-05:30"`. */
export declare function formatOffsetHours(hours: number): string;
//# sourceMappingURL=index.d.ts.map