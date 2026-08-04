/**
 * Enhanced TypeScript type safety utilities for swisseph.
 *
 * This module provides template literal types and stricter type constraints
 * for better developer experience and compile-time error detection.
 */
/**
 * Type guard to validate house system code at runtime.
 * @param code - The code to validate
 * @returns true if the code is valid
 */
export function isValidHouseSystemCode(code) {
    const validCodes = new Set([
        'P', 'K', 'O', 'R', 'C', 'A', 'W', 'B', 'M', 'T',
        'G', 'X', 'V', 'i', 'U', 'H', 'I', 'N', 'Q', 'L', 'S', 'p'
    ]);
    return validCodes.has(code);
}
/**
 * Type guard for valid latitude (-90 to 90).
 * @param lat - The latitude value to validate
 * @returns The value as Latitude if valid, throws error otherwise
 */
export function validateLatitude(lat) {
    if (lat < -90 || lat > 90) {
        throw new Error(`Latitude must be between -90 and 90, got ${lat}`);
    }
    return lat;
}
/**
 * Type guard for valid longitude (-180 to 180).
 * @param lon - The longitude value to validate
 * @returns The value as Longitude if valid, throws error otherwise
 */
export function validateLongitude(lon) {
    if (lon < -180 || lon > 180) {
        throw new Error(`Longitude must be between -180 and 180, got ${lon}`);
    }
    return lon;
}
/**
 * Convert a Julian day to branded type after validation.
 * @param jd - The Julian day value
 * @returns Branded JulianDay
 */
export function toJulianDay(jd) {
    if (!Number.isFinite(jd)) {
        throw new Error('Julian day must be a finite number');
    }
    // Reasonable range: 1000 BCE to 5000 CE
    if (jd < 1350000 || jd > 2700000) {
        throw new Error(`Julian day ${jd} is outside reasonable range`);
    }
    return jd;
}
/**
 * Create a validated number type with custom range.
 */
export function createRangeValidator(min, max, name) {
    const validator = function (value) {
        return typeof value === 'number' && value >= min && value <= max;
    };
    validator.errorMessage = `${name} must be between ${min} and ${max}`;
    return validator;
}
/**
 * Validate and coerce input with type guard.
 * @param value - The value to validate
 * @param validator - The validator function
 * @returns The validated value
 * @throws Error if validation fails
 */
export function validate(value, validator) {
    if (!validator(value)) {
        throw new Error(validator.errorMessage);
    }
    return value;
}
// Pre-built validators for common use cases
export const latitudeValidator = createRangeValidator(-90, 90, 'Latitude');
export const longitudeValidator = createRangeValidator(-180, 180, 'Longitude');
export const hourValidator = createRangeValidator(0, 24, 'Hour');
export const minuteValidator = createRangeValidator(0, 60, 'Minute');
export const secondValidator = createRangeValidator(0, 60, 'Second');
//# sourceMappingURL=types-enhanced.js.map