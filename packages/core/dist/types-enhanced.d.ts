/**
 * Enhanced TypeScript type safety utilities for swisseph.
 *
 * This module provides template literal types and stricter type constraints
 * for better developer experience and compile-time error detection.
 */
/**
 * Template literal type for house system codes.
 * Ensures only valid single-character codes are accepted.
 */
export type HouseSystemCode = 'P' | 'K' | 'O' | 'R' | 'C' | 'A' | 'W' | 'B' | 'M' | 'T' | 'G' | 'X' | 'V' | 'i' | 'U' | 'H' | 'I' | 'N' | 'Q' | 'L' | 'S' | 'p';
/**
 * Type guard to validate house system code at runtime.
 * @param code - The code to validate
 * @returns true if the code is valid
 */
export declare function isValidHouseSystemCode(code: string): code is HouseSystemCode;
/**
 * Aspect kind identifiers for type-safe aspect definitions.
 */
export type AspectKind = 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile' | 'quincunx' | 'semisquare' | 'sesquiquadrate' | 'semisextile' | 'quintile' | 'biquintile';
/**
 * Strict coordinate validation types.
 */
export type Latitude = number & {
    readonly __brand: unique symbol;
};
export type Longitude = number & {
    readonly __brand: unique symbol;
};
/**
 * Type guard for valid latitude (-90 to 90).
 * @param lat - The latitude value to validate
 * @returns The value as Latitude if valid, throws error otherwise
 */
export declare function validateLatitude(lat: number): Latitude;
/**
 * Type guard for valid longitude (-180 to 180).
 * @param lon - The longitude value to validate
 * @returns The value as Longitude if valid, throws error otherwise
 */
export declare function validateLongitude(lon: number): Longitude;
/**
 * Julian day number type with branding for type safety.
 */
export type JulianDay = number & {
    readonly __brand: unique symbol;
};
/**
 * Convert a Julian day to branded type after validation.
 * @param jd - The Julian day value
 * @returns Branded JulianDay
 */
export declare function toJulianDay(jd: number): JulianDay;
/**
 * Utility type for making properties required but nullable.
 */
export type RequiredNullable<T> = {
    [P in keyof T]-?: T[P] | null;
};
/**
 * Extract only the numeric literal types from a union.
 */
export type ExtractNumeric<T> = T extends number ? T : never;
/**
 * Create a strict enum-like type with both keys and values.
 */
export type StrictEnum<T extends Record<string, string | number>> = {
    [K in keyof T]: T[K];
} & {
    [K in keyof T as T[K]]: K;
};
/**
 * Function parameter validator decorator pattern.
 * Use for runtime validation with static type safety.
 */
export interface Validator<T> {
    (value: unknown): value is T;
    errorMessage: string;
}
/**
 * Create a validated number type with custom range.
 */
export declare function createRangeValidator(min: number, max: number, name: string): Validator<number>;
/**
 * Validate and coerce input with type guard.
 * @param value - The value to validate
 * @param validator - The validator function
 * @returns The validated value
 * @throws Error if validation fails
 */
export declare function validate<T>(value: unknown, validator: Validator<T>): T;
export declare const latitudeValidator: Validator<number>;
export declare const longitudeValidator: Validator<number>;
export declare const hourValidator: Validator<number>;
export declare const minuteValidator: Validator<number>;
export declare const secondValidator: Validator<number>;
/**
 * Orb scheme types for aspect calculations.
 */
export type OrbScheme = 'modern' | 'traditional' | 'tight';
/**
 * Sect (day/night) types.
 */
export type SectType = 'diurnal' | 'nocturnal';
/**
 * Element types for zodiac signs.
 */
export type ElementType = 'fire' | 'earth' | 'air' | 'water';
/**
 * Modality types for zodiac signs.
 */
export type ModalityType = 'cardinal' | 'fixed' | 'mutable';
/**
 * Gender types for zodiac signs.
 */
export type GenderType = 'masculine' | 'feminine';
/**
 * Dignity types for planetary evaluations.
 */
export type DignityType = 'domicile' | 'exaltation' | 'fall' | 'detriment' | 'triplicity' | 'term' | 'face' | 'peregrine';
/**
 * Lot (Arabic Part) calculation modes.
 */
export type LotCalculationMode = 'hermetic' | 'traditional' | 'modern';
/**
 * Eclipse type identifiers.
 */
export type EclipseType = 'solar' | 'lunar';
export type EclipseKind = 'partial' | 'total' | 'annular' | 'penumbral';
/**
 * Heliacal event types.
 */
export type HeliacalEventType = 'risingVisible' | 'settingVisible' | 'risingCosmical' | 'settingCosmical' | 'risingAcronychal' | 'settingAcronychal';
/**
 * Export enhanced types for external use
 * Note: Individual types are already exported above
 */
export type { HouseSystemCode, AspectKind, Latitude as ValidatedLatitude, Longitude as ValidatedLongitude, JulianDay as ValidatedJulianDay, OrbScheme, SectType, ElementType, ModalityType, GenderType, DignityType, LotCalculationMode, EclipseType, EclipseKind, HeliacalEventType, };
//# sourceMappingURL=types-enhanced.d.ts.map