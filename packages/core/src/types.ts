import type { 
  Sign, 
  EphemerisModelType, 
  AspectKind, 
  DeclinationAspectKind,
  ElementType,
  ModalityType,
  PolarityType,
  RulingPlanet,
  DignityType,
  CalendarType,
  EclipseType,
  LunarPhase,
} from './constants.js';

/** The ephemeris that actually produced a result. */
export type EphemerisModel = EphemerisModelType;

/** A body's position. */
export interface Position {
  /** Ecliptic longitude in degrees, [0, 360). Right ascension under `Flag.Equatorial`. */
  longitude: number;
  /** Ecliptic latitude in degrees. Declination under `Flag.Equatorial`. */
  latitude: number;
  /** Distance in astronomical units. */
  distance: number;
  /** Change in longitude, degrees per day. Negative means retrograde. */
  longitudeSpeed: number;
  latitudeSpeed: number;
  /** Change in distance, AU per day. */
  distanceSpeed: number;

  /**
   * Which ephemeris was actually used.
   *
   * Swiss Ephemeris does **not** fail when it cannot find the `.se1` file you
   * asked for — it falls back to Moshier without saying so. Check this field
   * or you will believe you have a precision you did not get.
   */
  ephemeris: EphemerisModel;

  /** Warning text from the library, e.g. a missing file. Null when clean. */
  warning: string | null;
}

/** A position with sign and retrograde state derived. */
export interface PositionWithSign extends Position {
  /** Sign index, 0 = Aries. */
  signIndex: number;
  sign: Sign;
  /** Degrees within the sign, [0, 30). */
  degreeInSign: number;
  /** True when longitude speed is negative. */
  retrograde: boolean;
}

/** Equatorial coordinates — what declination work needs. */
export interface EquatorialPosition {
  /** Right ascension in degrees, [0, 360). */
  rightAscension: number;
  /** Declination in degrees, north positive. */
  declination: number;
  distance: number;
  /** Degrees per day. */
  rightAscensionSpeed: number;
  /** Degrees per day. Drives applying/separating for parallels. */
  declinationSpeed: number;
  distanceSpeed: number;
  ephemeris: EphemerisModel;
  warning: string | null;
}

/** Obliquity of the ecliptic and the nutation at a moment. */
export interface Obliquity {
  /** True obliquity — mean plus the nutation in obliquity. */
  trueObliquity: number;
  meanObliquity: number;
  nutationInLongitude: number;
  nutationInObliquity: number;
}

/** An observer's place on Earth. */
export interface GeoPosition {
  /** Geographic latitude, north positive. */
  latitude: number;
  /** Geographic longitude, east positive. */
  longitude: number;
  /** Height above sea level in metres. Defaults to 0. */
  altitude?: number;
}

/** House cusps and angles. */
export interface Houses {
  /**
   * The cusps, `cusps[0]` being the first house. (The C API uses a 1-based
   * array; this one is 0-based.)
   *
   * **Twelve entries for every house system except `'G'`.** Gauquelin sectors
   * are 36, and they are counted in the *clockwise* direction — check
   * `cusps.length` rather than assuming twelve. The one exception is a
   * Gauquelin chart beyond the polar circle: the system is undefined there,
   * Swiss Ephemeris substitutes Porphyry and produces only twelve cusps, so
   * `substituted` is true and `cusps.length` is 12.
   */
  cusps: number[];

  /** The house system code that was asked for. */
  requestedSystem: string;

  /**
   * True when Swiss Ephemeris used a different system than the one requested.
   *
   * Placidus, Koch, Gauquelin and Sunshine are mathematically undefined
   * beyond the polar circle. Swiss Ephemeris quietly substitutes Porphyry and
   * returns −1 (swehouse.c:1252) while still filling in **valid** cusps — so
   * that −1 is a warning, not a failure.
   *
   * Ignore this field and a high-latitude chart may be using a house system
   * you did not choose. The `warning` text names the substitute.
   */
  substituted: boolean;
  ascendant: number;
  midheaven: number;
  /**
   * The Descendant — the Ascendant's opposition.
   *
   * Derived here rather than read from a cusp on purpose. In a quadrant
   * system it equals `cusps[6]`, but in whole sign, equal, Morinus, Vehlow
   * and the meridian systems it does **not**: the seventh cusp is a house
   * boundary, and the Descendant is where the ecliptic meets the western
   * horizon. Reading one for the other is wrong by up to a whole sign.
   */
  descendant: number;
  /**
   * The Imum Coeli — the Midheaven's opposition, the lower meridian.
   * Equal to `cusps[3]` in a quadrant system and not otherwise; see
   * {@link descendant}.
   */
  imumCoeli: number;
  /** Right ascension of the meridian. */
  armc: number;
  vertex: number;
  equatorialAscendant: number;
  coAscendantKoch: number;
  coAscendantMunkasey: number;
  polarAscendant: number;
  warning: string | null;
}

/** A fixed star's position. */
export interface StarPosition extends Position {
  /**
   * The full name the library resolved, in the form `Aldebaran,alTau`:
   * traditional name plus Bayer/Flamsteed designation.
   */
  resolvedName: string;
}

/** A Julian day converted back to a calendar date. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
  /** Decimal hour, e.g. 14.5 = 14:30. */
  hour: number;
}

export interface CalcOptions {
  /**
   * Extra flags (`Flag.*`). The ephemeris source and `Flag.Speed` are added
   * by default; both can be overridden from here.
   */
  flags?: number;
  /** Ephemeris source. Defaults to `'swiss'`, which falls back to Moshier. */
  ephemeris?: EphemerisModel;
}

export interface SwissEphOptions {
  /**
   * Ephemeris files to write into the virtual filesystem. Keys are file names
   * (`"sepl_18.se1"`), values are the contents.
   */
  files?: Record<string, Uint8Array | ArrayBuffer>;
  /**
   * Where to look for ephemeris files. A real directory under Node; the
   * virtual directory populated by `files` in a browser (default `/ephe`).
   */
  ephemerisPath?: string;
}

/** Thrown when Swiss Ephemeris reports an error. */
export class SwissEphError extends Error {
  constructor(
    message: string,
    /** The C function that failed. */
    public readonly fn: string,
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
    public readonly detail?: string,
    /**
     * Machine-readable error code for programmatic handling.
     */
    public readonly code?: ErrorCode,
  ) {
    super(message);
    this.name = 'SwissEphError';
  }

  /**
   * The `.se1` file the library could not find, when that is what failed.
   *
   * Null for every other error. Useful for deciding what to fetch and retry.
   */
  get missingFile(): string | null {
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
export enum ErrorCode {
  // --- Ephemeris File Errors (EPHE_XXX) ---
  /** Ephemeris file not found in the virtual filesystem */
  EPHE_FILE_NOT_FOUND = 'EPHE_001',
  /** Failed to load ephemeris file into virtual filesystem */
  EPHE_FILE_LOAD_FAILED = 'EPHE_002',
  /** Ephemeris file corrupted or invalid format */
  EPHE_FILE_INVALID = 'EPHE_003',
  /** Required ephemeris file missing for calculation */
  EPHE_FILE_REQUIRED = 'EPHE_004',

  // --- Date/Time Errors (DATE_XXX) ---
  /** Invalid calendar date (e.g., February 30) */
  DATE_INVALID = 'DATE_001',
  /** Date out of supported range */
  DATE_OUT_OF_RANGE = 'DATE_002',
  /** Invalid hour value (must be 0-24) */
  DATE_INVALID_HOUR = 'DATE_003',

  // --- Calculation Errors (CALC_XXX) ---
  /** General calculation failure */
  CALC_FAILED = 'CALC_001',
  /** Body index out of valid range */
  CALC_INVALID_BODY = 'CALC_002',
  /** House system not supported or invalid */
  CALC_INVALID_HOUSE_SYSTEM = 'CALC_003',
  /** Sidereal mode not supported */
  CALC_INVALID_SIDEREAL_MODE = 'CALC_004',
  /** Calculation result undefined (e.g., houses at polar circle) */
  CALC_UNDEFINED_RESULT = 'CALC_005',

  // --- Position/Range Errors (RANGE_XXX) ---
  /** Latitude out of valid range (-90 to 90) */
  RANGE_LATITUDE_INVALID = 'RANGE_001',
  /** Longitude out of valid range (-180 to 180) */
  RANGE_LONGITUDE_INVALID = 'RANGE_002',
  /** Altitude out of valid range */
  RANGE_ALTITUDE_INVALID = 'RANGE_003',
  /** Julian day out of supported range */
  RANGE_JD_OUT_OF_BOUNDS = 'RANGE_004',

  // --- WASM/Runtime Errors (WASM_XXX) ---
  /** WebAssembly module failed to initialize */
  WASM_INIT_FAILED = 'WASM_001',
  /** WebAssembly memory allocation failed */
  WASM_ALLOC_FAILED = 'WASM_002',
  /** Instance already disposed */
  WASM_ALREADY_DISPOSED = 'WASM_003',

  // --- Star/Fixed Object Errors (STAR_XXX) ---
  /** Fixed star not found in catalog */
  STAR_NOT_FOUND = 'STAR_001',
  /** Invalid star designation format */
  STAR_INVALID_DESIGNATION = 'STAR_002',

  // --- Eclipse Errors (ECLIPSE_XXX) ---
  /** No eclipse occurs at given time */
  ECLIPSE_NONE = 'ECLIPSE_001',
  /** Eclipse calculation failed */
  ECLIPSE_CALC_FAILED = 'ECLIPSE_002',

  // --- Heliacal Visibility Errors (HELIACAL_XXX) ---
  /** Heliacal calculation failed */
  HELIACAL_CALC_FAILED = 'HELIACAL_001',
  /** Invalid atmospheric conditions */
  HELIACAL_INVALID_ATMOSPHERE = 'HELIACAL_002',

  // --- Rise/Set Errors (RISE_XXX) ---
  /** Celestial body never rises at given location */
  RISE_NEVER_RISES = 'RISE_001',
  /** Celestial body never sets at given location */
  RISE_NEVER_SETS = 'RISE_002',
  /** Rise/set calculation failed */
  RISE_CALC_FAILED = 'RISE_003',
}

/**
 * Suggestion for recovering from an error.
 * Attached to SwissEphError instances to guide users toward resolution.
 */
export interface ErrorSuggestion {
  /** What went wrong, in one sentence */
  problem: string;
  /** How to fix it */
  solution: string;
  /** Optional: which package to install or method to call */
  action?: string;
}

/**
 * Get recovery suggestions for common error codes.
 * Returns null if no specific suggestion is available.
 */
export function getErrorSuggestion(code: ErrorCode): ErrorSuggestion | null {
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

/**
 * Extend SwissEphError with suggestion capability
 */
declare module './types.js' {
  interface SwissEphError {
    /** Recovery suggestion for this error, if available */
    getSuggestion(): ErrorSuggestion | null;
  }
}

// Add method to prototype
SwissEphError.prototype.getSuggestion = function(this: SwissEphError): ErrorSuggestion | null {
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
