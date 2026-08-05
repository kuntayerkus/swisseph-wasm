/** Thrown when Swiss Ephemeris reports an error. */
export class SwissEphError extends Error {
    fn;
    detail;
    code;
    constructor(message, 
    /** The C function that failed. */
    fn, 
    /**
     * The library's own `serr` text, when `message` rephrases it.
     *
     * Kept because it is the ground truth and because a Swiss Ephemeris user
     * may recognise it — but it is not the message, since it can point
     * somewhere unhelpful. A missing-file error names the **virtual** search
     * path inside the WebAssembly filesystem (`'.:/users/ephe/'`), which does
     * not exist on the caller's machine and sends them looking in the wrong
     * place.
     */
    detail, 
    /**
     * Machine-readable error code for programmatic handling.
     */
    code) {
        super(message);
        this.fn = fn;
        this.detail = detail;
        this.code = code;
        this.name = 'SwissEphError';
    }
    /**
     * The `.se1` file the library could not find, when that is what failed.
     *
     * Null for every other error. Useful for deciding what to fetch and retry.
     */
    get missingFile() {
        const source = this.detail ?? this.message;
        return /SwissEph file '([^']+)' not found/.exec(source)?.[1] ?? null;
    }
}
/**
 * Machine-readable error codes for programmatic error handling.
 *
 * These codes allow applications to handle errors programmatically without
 * parsing error messages. Each code follows the pattern: CATEGORY_### where
 * CATEGORY indicates the error domain and ### is a sequential number.
 */
export var ErrorCode;
(function (ErrorCode) {
    // --- Ephemeris File Errors (EPHE_XXX) ---
    /** Ephemeris file not found in the virtual filesystem */
    ErrorCode["EPHE_FILE_NOT_FOUND"] = "EPHE_001";
    /** Failed to load ephemeris file into virtual filesystem */
    ErrorCode["EPHE_FILE_LOAD_FAILED"] = "EPHE_002";
    /** Ephemeris file corrupted or invalid format */
    ErrorCode["EPHE_FILE_INVALID"] = "EPHE_003";
    /** Required ephemeris file missing for calculation */
    ErrorCode["EPHE_FILE_REQUIRED"] = "EPHE_004";
    // --- Date/Time Errors (DATE_XXX) ---
    /** Invalid calendar date (e.g., February 30) */
    ErrorCode["DATE_INVALID"] = "DATE_001";
    /** Date out of supported range */
    ErrorCode["DATE_OUT_OF_RANGE"] = "DATE_002";
    /** Invalid hour value (must be 0-24) */
    ErrorCode["DATE_INVALID_HOUR"] = "DATE_003";
    // --- Calculation Errors (CALC_XXX) ---
    /** General calculation failure */
    ErrorCode["CALC_FAILED"] = "CALC_001";
    /** Body index out of valid range */
    ErrorCode["CALC_INVALID_BODY"] = "CALC_002";
    /** House system not supported or invalid */
    ErrorCode["CALC_INVALID_HOUSE_SYSTEM"] = "CALC_003";
    /** Sidereal mode not supported */
    ErrorCode["CALC_INVALID_SIDEREAL_MODE"] = "CALC_004";
    /** Calculation result undefined (e.g., houses at polar circle) */
    ErrorCode["CALC_UNDEFINED_RESULT"] = "CALC_005";
    // --- Position/Range Errors (RANGE_XXX) ---
    /** Latitude out of valid range (-90 to 90) */
    ErrorCode["RANGE_LATITUDE_INVALID"] = "RANGE_001";
    /** Longitude out of valid range (-180 to 180) */
    ErrorCode["RANGE_LONGITUDE_INVALID"] = "RANGE_002";
    /** Altitude out of valid range */
    ErrorCode["RANGE_ALTITUDE_INVALID"] = "RANGE_003";
    /** Julian day out of supported range */
    ErrorCode["RANGE_JD_OUT_OF_BOUNDS"] = "RANGE_004";
    // --- WASM/Runtime Errors (WASM_XXX) ---
    /** WebAssembly module failed to initialize */
    ErrorCode["WASM_INIT_FAILED"] = "WASM_001";
    /** WebAssembly memory allocation failed */
    ErrorCode["WASM_ALLOC_FAILED"] = "WASM_002";
    /** Instance already disposed */
    ErrorCode["WASM_ALREADY_DISPOSED"] = "WASM_003";
    // --- Star/Fixed Object Errors (STAR_XXX) ---
    /** Fixed star not found in catalog */
    ErrorCode["STAR_NOT_FOUND"] = "STAR_001";
    /** Invalid star designation format */
    ErrorCode["STAR_INVALID_DESIGNATION"] = "STAR_002";
    // --- Eclipse Errors (ECLIPSE_XXX) ---
    /** No eclipse occurs at given time */
    ErrorCode["ECLIPSE_NONE"] = "ECLIPSE_001";
    /** Eclipse calculation failed */
    ErrorCode["ECLIPSE_CALC_FAILED"] = "ECLIPSE_002";
    // --- Heliacal Visibility Errors (HELIACAL_XXX) ---
    /** Heliacal calculation failed */
    ErrorCode["HELIACAL_CALC_FAILED"] = "HELIACAL_001";
    /** Invalid atmospheric conditions */
    ErrorCode["HELIACAL_INVALID_ATMOSPHERE"] = "HELIACAL_002";
    // --- Rise/Set Errors (RISE_XXX) ---
    /** Celestial body never rises at given location */
    ErrorCode["RISE_NEVER_RISES"] = "RISE_001";
    /** Celestial body never sets at given location */
    ErrorCode["RISE_NEVER_SETS"] = "RISE_002";
    /** Rise/set calculation failed */
    ErrorCode["RISE_CALC_FAILED"] = "RISE_003";
})(ErrorCode || (ErrorCode = {}));
/**
 * Get recovery suggestions for common error codes.
 * Returns null if no specific suggestion is available.
 */
export function getErrorSuggestion(code) {
    switch (code) {
        case ErrorCode.EPHE_FILE_NOT_FOUND:
            return {
                problem: 'Required ephemeris file is not loaded',
                solution: 'Load the file using mountEphemeris() or install @kuntay/swisseph-data',
                action: 'npm install @kuntay/swisseph-data',
            };
        case ErrorCode.EPHE_FILE_REQUIRED:
            return {
                problem: 'This calculation requires ephemeris files',
                solution: 'Install the data package for full precision',
                action: 'npm install @kuntay/swisseph-data',
            };
        case ErrorCode.DATE_INVALID:
            return {
                problem: 'Invalid calendar date provided',
                solution: 'Ensure the date components form a valid calendar date',
            };
        case ErrorCode.DATE_OUT_OF_RANGE:
            return {
                problem: 'Date is outside the supported range',
                solution: 'Use dates between 1800 CE and 2399 CE for best results',
            };
        case ErrorCode.RANGE_LATITUDE_INVALID:
            return {
                problem: 'Latitude must be between -90 and 90 degrees',
                solution: 'Check your geographic coordinates',
            };
        case ErrorCode.RANGE_LONGITUDE_INVALID:
            return {
                problem: 'Longitude must be between -180 and 180 degrees',
                solution: 'Check your geographic coordinates',
            };
        case ErrorCode.WASM_ALREADY_DISPOSED:
            return {
                problem: 'SwissEph instance has been disposed',
                solution: 'Create a new instance with createSwissEph()',
            };
        case ErrorCode.STAR_NOT_FOUND:
            return {
                problem: 'Fixed star not found in catalog',
                solution: 'Check the star designation or use findByDesignation() helper',
            };
        case ErrorCode.ECLIPSE_NONE:
            return {
                problem: 'No eclipse occurs at the specified time',
                solution: 'Search a wider date range using findSolarEclipses() or findLunarEclipses()',
            };
        case ErrorCode.RISE_NEVER_RISES:
            return {
                problem: 'Celestial body never rises at this latitude',
                solution: 'This is expected for circumpolar regions; try a different location',
            };
        case ErrorCode.RISE_NEVER_SETS:
            return {
                problem: 'Celestial body never sets at this latitude',
                solution: 'This is expected for circumpolar regions; try a different location',
            };
        default:
            return null;
    }
}
// Add method to prototype
SwissEphError.prototype.getSuggestion = function () {
    if (this.code) {
        return getErrorSuggestion(this.code);
    }
    // Fallback: check for missing file
    if (this.missingFile) {
        return {
            problem: `Ephemeris file '${this.missingFile}' is not loaded`,
            solution: 'Load the file using mountEphemeris() or install the appropriate data package',
            action: this.missingFile.includes('seas')
                ? 'npm install @kuntay/swisseph-data'
                : this.missingFile.match(/^s\d/)
                    ? 'npm install @kuntay/swisseph-asteroids'
                    : undefined,
        };
    }
    return null;
};
//# sourceMappingURL=types.js.map