/**
 * Builder pattern for constructing natal charts with a fluent API.
 *
 * Provides a more readable and type-safe way to build chart calculations,
 * especially useful when many optional parameters are involved.
 *
 * @example
 * ```typescript
 * const chart = NatalChart.builder()
 *   .date(1990, 5, 15)
 *   .time(14, 30)
 *   .location(39.93, 32.86)
 *   .houseSystem('P')
 *   .ayanamsa(24)
 *   .build(swe);
 * ```
 */
import type { SwissEph } from '../instance.js';
import type { GeoPosition, Houses, PositionWithSign } from '../types.js';
import { HouseSystem, Ayanamsa } from '../constants.js';
/** Calendar date components */
export interface ChartDate {
    year: number;
    month: number;
    day: number;
    hour?: number;
}
/** Builder configuration for natal chart calculation */
export interface NatalChartConfig {
    date: ChartDate;
    location: GeoPosition;
    houseSystem?: string;
    ayanamsa?: number;
    includeAsteroids?: boolean;
    asteroidNumbers?: number[];
}
/** Complete natal chart result */
export interface NatalChart {
    /** Julian day of the chart */
    jd: number;
    /** Chart configuration used */
    config: NatalChartConfig;
    /** Planetary positions */
    planets: Record<string, PositionWithSign>;
    /** House cusps and angles */
    houses: Houses;
    /** House placements of planets */
    placements: Record<string, number>;
    /** Ascendant degree */
    ascendant: number;
    /** Midheaven degree */
    midheaven: number;
}
/**
 * Fluent builder for natal chart calculations.
 *
 * Immutable builder pattern - each method returns a new builder instance.
 */
export declare class NatalChartBuilder {
    private readonly config;
    private constructor();
    /**
     * Create a new builder instance.
     */
    static builder(): NatalChartBuilder;
    /**
     * Set the birth date.
     * @param year - Full year (e.g., 1990)
     * @param month - Month (1-12)
     * @param day - Day (1-31)
     * @param hour - Optional decimal hour (e.g., 14.5 = 14:30). If not provided, use .time() method.
     */
    date(year: number, month: number, day: number, hour?: number): NatalChartBuilder;
    /**
     * Set the birth time.
     * @param hours - Hours (0-23)
     * @param minutes - Minutes (0-59), optional
     */
    time(hours: number, minutes?: number): NatalChartBuilder;
    /**
     * Set the birth location.
     * @param latitude - Geographic latitude (-90 to 90)
     * @param longitude - Geographic longitude (-180 to 180)
     * @param altitude - Altitude in meters (optional)
     */
    location(latitude: number, longitude: number, altitude?: number): NatalChartBuilder;
    /**
     * Set the house system.
     * @param system - House system code (e.g., 'P' for Placidus)
     */
    houseSystem(system: string | keyof typeof HouseSystem): NatalChartBuilder;
    /**
     * Set the ayanamsa (sidereal mode).
     * @param mode - Ayanamsa mode number
     */
    ayanamsa(mode: number | keyof typeof Ayanamsa): NatalChartBuilder;
    /**
     * Include asteroids in the calculation.
     * @param numbers - Asteroid numbers to include (e.g., [1, 2, 3, 4] for Chiron, Ceres, Pallas, Juno)
     */
    includeAsteroids(...numbers: number[]): NatalChartBuilder;
    /**
     * Build and calculate the natal chart.
     * @param swe - SwissEph instance
     * @throws {@link SwissEphError} if required data is missing or calculation fails
     */
    build(swe: SwissEph): NatalChart;
}
/**
 * Builder pattern for transit calculations.
 *
 * @example
 * ```typescript
 * const transits = TransitChart.builder()
 *   .natalDate(1990, 5, 15)
 *   .transitDate(2024, 1, 1)
 *   .location(39.93, 32.86)
 *   .build(swe);
 * ```
 */
export interface TransitChartConfig {
    natalDate: ChartDate;
    transitDate: ChartDate;
    location: GeoPosition;
    orbs?: {
        [aspect: number]: number;
    };
}
export interface TransitAspect {
    /** Transit planet name */
    transitPlanet: string;
    /** Natal planet name */
    natalPlanet: string;
    /** Aspect type (0=conjunction, 1=opposition, etc.) */
    aspectType: number;
    /** Exact angle in degrees */
    angle: number;
    /** Orb in degrees */
    orb: number;
    /** Applying (true) or separating (false) */
    applying: boolean;
    /** Transit planet's longitude */
    transitLongitude: number;
    /** Natal planet's longitude */
    natalLongitude: number;
}
export interface TransitChart {
    natalJd: number;
    transitJd: number;
    config: TransitChartConfig;
    natalPositions: Record<string, PositionWithSign>;
    transitPositions: Record<string, PositionWithSign>;
    aspects: TransitAspect[];
}
/**
 * Builder for transit chart calculations.
 */
export declare class TransitChartBuilder {
    private readonly config;
    private constructor();
    static builder(): TransitChartBuilder;
    /**
     * Set the natal date.
     */
    natalDate(year: number, month: number, day: number, hour?: number): TransitChartBuilder;
    /**
     * Set the transit date.
     */
    transitDate(year: number, month: number, day: number, hour?: number): TransitChartBuilder;
    /**
     * Set the location.
     */
    location(latitude: number, longitude: number, altitude?: number): TransitChartBuilder;
    /**
     * Build and calculate the transit chart.
     */
    build(swe: SwissEph, options?: {
        aspects?: number[];
        orb?: number;
    }): TransitChart;
}
//# sourceMappingURL=chart-builder.d.ts.map