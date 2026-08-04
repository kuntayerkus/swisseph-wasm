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
import { Body, HouseSystem, Ayanamsa } from '../constants.js';
import { houseOf } from './houses.js';
/**
 * Fluent builder for natal chart calculations.
 *
 * Immutable builder pattern - each method returns a new builder instance.
 */
export class NatalChartBuilder {
    config;
    constructor(config = {}) {
        this.config = config;
    }
    /**
     * Create a new builder instance.
     */
    static builder() {
        return new NatalChartBuilder();
    }
    /**
     * Set the birth date.
     * @param year - Full year (e.g., 1990)
     * @param month - Month (1-12)
     * @param day - Day (1-31)
     * @param hour - Optional decimal hour (e.g., 14.5 = 14:30). If not provided, use .time() method.
     */
    date(year, month, day, hour) {
        return new NatalChartBuilder({
            ...this.config,
            date: { ...this.config.date, year, month, day, hour },
        });
    }
    /**
     * Set the birth time.
     * @param hours - Hours (0-23)
     * @param minutes - Minutes (0-59), optional
     */
    time(hours, minutes = 0) {
        const hour = hours + minutes / 60;
        const existingDate = this.config.date;
        return new NatalChartBuilder({
            ...this.config,
            date: existingDate ? { ...existingDate, hour } : { year: 0, month: 0, day: 0, hour },
        });
    }
    /**
     * Set the birth location.
     * @param latitude - Geographic latitude (-90 to 90)
     * @param longitude - Geographic longitude (-180 to 180)
     * @param altitude - Altitude in meters (optional)
     */
    location(latitude, longitude, altitude) {
        return new NatalChartBuilder({
            ...this.config,
            location: { latitude, longitude, altitude },
        });
    }
    /**
     * Set the house system.
     * @param system - House system code (e.g., 'P' for Placidus)
     */
    houseSystem(system) {
        const code = typeof system === 'string' ? system : String(HouseSystem[system]);
        return new NatalChartBuilder({
            ...this.config,
            houseSystem: code,
        });
    }
    /**
     * Set the ayanamsa (sidereal mode).
     * @param mode - Ayanamsa mode number
     */
    ayanamsa(mode) {
        const value = typeof mode === 'number' ? mode : Ayanamsa[mode];
        return new NatalChartBuilder({
            ...this.config,
            ayanamsa: value,
        });
    }
    /**
     * Include asteroids in the calculation.
     * @param numbers - Asteroid numbers to include (e.g., [1, 2, 3, 4] for Chiron, Ceres, Pallas, Juno)
     */
    includeAsteroids(...numbers) {
        return new NatalChartBuilder({
            ...this.config,
            includeAsteroids: true,
            asteroidNumbers: numbers,
        });
    }
    /**
     * Build and calculate the natal chart.
     * @param swe - SwissEph instance
     * @throws {@link SwissEphError} if required data is missing or calculation fails
     */
    build(swe) {
        const { date, location, houseSystem, ayanamsa, includeAsteroids, asteroidNumbers } = this.config;
        if (!date || !location) {
            throw new Error('NatalChartBuilder: date and location are required');
        }
        const { year, month, day, hour = 0 } = date;
        // Validate date
        if (month < 1 || month > 12) {
            throw new Error(`Invalid month: ${month}. Must be 1-12.`);
        }
        if (day < 1 || day > 31) {
            throw new Error(`Invalid day: ${day}. Must be 1-31.`);
        }
        if (hour < 0 || hour >= 24) {
            throw new Error(`Invalid hour: ${hour}. Must be 0-24.`);
        }
        // Validate location
        if (location.latitude < -90 || location.latitude > 90) {
            throw new Error(`Latitude out of range: ${location.latitude}. Must be -90 to 90.`);
        }
        if (location.longitude < -180 || location.longitude > 180) {
            throw new Error(`Longitude out of range: ${location.longitude}. Must be -180 to 180.`);
        }
        // Calculate Julian day
        const jd = swe.julianDay(year, month, day, hour);
        // Set ayanamsa if specified
        if (ayanamsa !== undefined) {
            swe.setSiderealMode(ayanamsa);
        }
        // Calculate planetary positions
        const planets = {};
        const planetBodies = [
            Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars,
            Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune, Body.Pluto,
        ];
        for (const body of planetBodies) {
            const name = Object.entries(Body).find(([, v]) => v === body)?.[0] ?? `Body_${body}`;
            planets[name] = swe.calcWithSign(jd, body);
        }
        // Add asteroids if requested
        if (includeAsteroids && asteroidNumbers) {
            for (const num of asteroidNumbers) {
                try {
                    const asteroidBody = num < 10000 ? 10000 + num : num;
                    const name = `Asteroid_${num}`;
                    planets[name] = swe.calcWithSign(jd, asteroidBody);
                }
                catch (error) {
                    // Skip asteroids that require missing ephemeris files
                    console.warn(`Asteroid ${num} requires ephemeris file. Skipping.`);
                }
            }
        }
        // Calculate houses
        const hsys = houseSystem ?? 'P';
        const houses = swe.houses(jd, location.latitude, location.longitude, hsys);
        // Calculate house placements
        const placements = {};
        for (const [name, position] of Object.entries(planets)) {
            placements[name] = houseOf(position.longitude, houses.cusps);
        }
        const fullConfig = {
            date,
            location,
            houseSystem: hsys,
            ayanamsa,
            includeAsteroids: includeAsteroids ?? false,
            asteroidNumbers,
        };
        return {
            jd,
            config: fullConfig,
            planets,
            houses,
            placements,
            ascendant: houses.ascendant,
            midheaven: houses.midheaven,
        };
    }
}
/**
 * Builder for transit chart calculations.
 */
export class TransitChartBuilder {
    config;
    constructor(config = {}) {
        this.config = config;
    }
    static builder() {
        return new TransitChartBuilder();
    }
    /**
     * Set the natal date.
     */
    natalDate(year, month, day, hour = 0) {
        return new TransitChartBuilder({
            ...this.config,
            natalDate: { year, month, day, hour },
        });
    }
    /**
     * Set the transit date.
     */
    transitDate(year, month, day, hour = 0) {
        return new TransitChartBuilder({
            ...this.config,
            transitDate: { year, month, day, hour },
        });
    }
    /**
     * Set the location.
     */
    location(latitude, longitude, altitude) {
        return new TransitChartBuilder({
            ...this.config,
            location: { latitude, longitude, altitude },
        });
    }
    /**
     * Build and calculate the transit chart.
     */
    build(swe, options) {
        const { natalDate, transitDate, location } = this.config;
        if (!natalDate || !transitDate || !location) {
            throw new Error('TransitChartBuilder: natalDate, transitDate, and location are required');
        }
        const { year: nYear, month: nMonth, day: nDay, hour: nHour = 0 } = natalDate;
        const { year: tYear, month: tMonth, day: tDay, hour: tHour = 0 } = transitDate;
        const natalJd = swe.julianDay(nYear, nMonth, nDay, nHour);
        const transitJd = swe.julianDay(tYear, tMonth, tDay, tHour);
        // Calculate positions
        const planetBodies = [
            Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars,
            Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune, Body.Pluto,
        ];
        const natalPositions = {};
        const transitPositions = {};
        for (const body of planetBodies) {
            const name = Object.entries(Body).find(([, v]) => v === body)?.[0] ?? `Body_${body}`;
            natalPositions[name] = swe.calcWithSign(natalJd, body);
            transitPositions[name] = swe.calcWithSign(transitJd, body);
        }
        // Find aspects (simplified - in production would use findAspects)
        const aspects = [];
        const aspectTypes = options?.aspects ?? [0, 1, 2, 3, 4]; // conjunction, opposition, trine, square, sextile
        const defaultOrb = options?.orb ?? 8;
        const aspectAngles = [0, 180, 120, 90, 60];
        const natalPlanets = Object.entries(natalPositions);
        const transitPlanets = Object.entries(transitPositions);
        for (const [tName, tPos] of transitPlanets) {
            for (const [nName, nPos] of natalPlanets) {
                let separation = Math.abs(tPos.longitude - nPos.longitude);
                if (separation > 180)
                    separation = 360 - separation;
                for (let i = 0; i < aspectAngles.length; i++) {
                    if (!aspectTypes.includes(i))
                        continue;
                    const angle = aspectAngles[i];
                    const orb = Math.abs(separation - angle);
                    if (orb <= defaultOrb) {
                        aspects.push({
                            transitPlanet: tName,
                            natalPlanet: nName,
                            aspectType: i,
                            angle,
                            orb,
                            applying: tPos.longitudeSpeed > 0,
                            transitLongitude: tPos.longitude,
                            natalLongitude: nPos.longitude,
                        });
                    }
                }
            }
        }
        const fullConfig = {
            natalDate,
            transitDate,
            location,
        };
        return {
            natalJd,
            transitJd,
            config: fullConfig,
            natalPositions,
            transitPositions,
            aspects,
        };
    }
}
//# sourceMappingURL=chart-builder.js.map