/**
 * The public constants.
 *
 * Every numeric value comes from `generated/constants.ts`, which is produced
 * from `swephexp.h` — so a transcription error is impossible and an upstream
 * version bump carries the values across on its own.
 *
 * This file only improves the **names**. The generated ones are mechanical
 * transforms of C macros (`Helctr`, `Nonut`, `MeanApog`) and make for a poor
 * public API. Both spellings work: the generated names are spread in, then
 * readable aliases are added alongside them.
 */

import {
  Body as RawBody,
  Flag as RawFlag,
  Calendar as RawCalendar,
  HouseSystem as RawHouseSystem,
} from './generated/constants.js';

export {
  Ayanamsa,
  HOUSE_SYSTEM_NAMES,
  HOUSE_SYSTEM_ALIASES,
  AsteroidOffset,
  FictitiousOffset,
  PlanetMoonOffset,
  RiseTransit,
  EclipseFlag,
  HeliacalEvent,
  HeliacalFlag,
  EclipticNutationId,
} from './generated/constants.js';

/**
 * House system codes as string literal types.
 * Provides compile-time validation for house system selection.
 */
export type HouseSystemCode = 
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' 
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';

/**
 * Aspect indices as typed constants.
 * Each aspect has a specific orb and meaning in astrological interpretation.
 */
export const AspectIndex = {
  Conjunction: 0,
  Opposition: 1,
  Trine: 2,
  Square: 3,
  Sextile: 4,
  Quincunx: 5,
  SemiSquare: 6,
  Sesquiquadrate: 7,
  SemiSextile: 8,
  Quintile: 9,
  BiQuintile: 10,
} as const;

export type AspectIndex = (typeof AspectIndex)[keyof typeof AspectIndex];

/**
 * Sign names in order (Aries through Pisces).
 * Use for display and localization purposes.
 */
export const SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

export type Sign = (typeof SIGNS)[number];

/**
 * Element types for signs.
 * Fire, Earth, Air, Water triplicities.
 */
export type Element = 'Fire' | 'Earth' | 'Air' | 'Water';

/**
 * Modality types for signs.
 * Cardinal, Fixed, Mutable qualities.
 */
export type Modality = 'Cardinal' | 'Fixed' | 'Mutable';

/**
 * Map of signs to their elements.
 */
export const SIGN_ELEMENTS: Record<Sign, Element> = {
  'Aries': 'Fire',
  'Taurus': 'Earth',
  'Gemini': 'Air',
  'Cancer': 'Water',
  'Leo': 'Fire',
  'Virgo': 'Earth',
  'Libra': 'Air',
  'Scorpio': 'Water',
  'Sagittarius': 'Fire',
  'Capricorn': 'Earth',
  'Aquarius': 'Air',
  'Pisces': 'Water',
};

/**
 * Map of signs to their modalities.
 */
export const SIGN_MODALITIES: Record<Sign, Modality> = {
  'Aries': 'Cardinal',
  'Taurus': 'Fixed',
  'Gemini': 'Mutable',
  'Cancer': 'Cardinal',
  'Leo': 'Fixed',
  'Virgo': 'Mutable',
  'Libra': 'Cardinal',
  'Scorpio': 'Fixed',
  'Sagittarius': 'Mutable',
  'Capricorn': 'Cardinal',
  'Aquarius': 'Fixed',
  'Pisces': 'Mutable',
};

/**
 * Polarities: which signs are diurnal (positive) vs nocturnal (negative).
 */
export type Polarity = 'Diurnal' | 'Nocturnal';

export const SIGN_POLARITIES: Record<Sign, Polarity> = {
  'Aries': 'Diurnal',
  'Taurus': 'Nocturnal',
  'Gemini': 'Diurnal',
  'Cancer': 'Nocturnal',
  'Leo': 'Diurnal',
  'Virgo': 'Nocturnal',
  'Libra': 'Diurnal',
  'Scorpio': 'Nocturnal',
  'Sagittarius': 'Diurnal',
  'Capricorn': 'Nocturnal',
  'Aquarius': 'Diurnal',
  'Pisces': 'Nocturnal',
};

/**
 * Celestial bodies.
 *
 * "Lilith" names three different things in astrology and they are constantly
 * confused. All three are here, under names that tell them apart:
 *
 *   `BlackMoonLilithMean` — the mean lunar apogee. **Not** a body. This is
 *                           what most astrology software calls "Lilith".
 *   `BlackMoonLilithTrue` — the osculating (true) apogee. A different answer.
 *   Asteroid 1181         — an actual asteroid: `AsteroidOffset + 1181`.
 *
 * The three give completely different positions.
 *
 * **Not every body in this enum behaves like a planet.** `Chiron`, `Pholus`,
 * `Ceres`, `Pallas`, `Juno` and `Vesta` need `seas_18.se1` and **throw** when
 * it is absent, where the planets fall back to Moshier. They sit next to
 * `Pluto` with nothing in the type to distinguish them, so a loop over "all
 * the bodies" works in Moshier mode until it reaches Chiron. Filter with
 * {@link REQUIRES_EPHEMERIS_FILE}.
 */
export const Body = {
  ...RawBody,

  BlackMoonLilithMean: RawBody.MeanApog,
  BlackMoonLilithTrue: RawBody.OscuApog,

  InterpolatedApogee: RawBody.IntpApog,
  InterpolatedPerigee: RawBody.IntpPerg,

  /** The Moon's mean north node (Rahu). */
  NorthNodeMean: RawBody.MeanNode,
  /** The Moon's true (osculating) north node. */
  NorthNodeTrue: RawBody.TrueNode,
} as const;

export type Body = (typeof Body)[keyof typeof Body];

/**
 * The bodies that need an ephemeris file and **throw** without one.
 *
 * Swiss Ephemeris has an analytic theory (Moshier) for the Sun through Pluto,
 * so those degrade quietly to lower precision when `sepl_*.se1` is missing —
 * check `Position.ephemeris` to see which you got. There is no analytic theory
 * for the asteroids, so for these there is nothing to degrade to: the call
 * raises.
 *
 * That difference is invisible in the type. `Body.Chiron` sits beside
 * `Body.Pluto` and nothing says one of them behaves differently, so this set is
 * the machine-readable form of the distinction — preferable to a documentation
 * note, which a loop cannot read:
 *
 * ```ts
 * const safe = bodies.filter((b) => !REQUIRES_EPHEMERIS_FILE.has(b));
 * ```
 *
 * Numbered asteroids (`AsteroidOffset + n`) need their own file each and are
 * not listed; they are covered by `BUILT_IN_ASTEROIDS` and `asteroidFile()`.
 */
export const REQUIRES_EPHEMERIS_FILE: ReadonlySet<number> = new Set([
  Body.Chiron,
  Body.Pholus,
  Body.Ceres,
  Body.Pallas,
  Body.Juno,
  Body.Vesta,
]);

/**
 * `swe_calc()` flags, combined as a bit mask.
 *
 * The ephemeris choices (Swiss / Moshier / JPL) are mutually exclusive —
 * pass at most one. With none, Swiss Ephemeris is assumed and falls back to
 * Moshier when the files are absent.
 */
export const Flag = {
  ...RawFlag,

  // --- efemeris kaynağı ---
  /** The `.se1` files. Falls back to Moshier, silently, when absent. */
  SwissEphemeris: RawFlag.Swieph,
  /** Analytic theory, no files needed. Always available. */
  Moshier: RawFlag.Moseph,
  /** A raw JPL file (`de441.eph` and friends). Node only, 2.6 GB. */
  JplEphemeris: RawFlag.Jpleph,

  // --- koordinat çerçevesi ---
  Heliocentric: RawFlag.Helctr,
  Barycentric: RawFlag.Baryctr,
  Topocentric: RawFlag.Topoctr,
  /** Equatorial instead of ecliptic coordinates (right ascension / declination). */
  Equatorial: RawFlag.Equatorial,
  /** Cartesian x/y/z instead of spherical. */
  Cartesian: RawFlag.Xyz,
  Radians: RawFlag.Radians,

  // --- konum düzeltmeleri ---
  /** No light-time or aberration correction — the geometric (true) position. */
  TruePosition: RawFlag.Truepos,
  NoNutation: RawFlag.Nonut,
  NoGravitationalDeflection: RawFlag.Nogdefl,
  NoAberration: RawFlag.Noaberr,
  J2000Equinox: RawFlag.J2000,

  // --- zodyak ---
  /** The sidereal zodiac, used together with `setSiderealMode()`. */
  Sidereal: RawFlag.Sidereal,

  /** Also compute speeds. Cheap, and usually wanted. */
  Speed: RawFlag.Speed,
} as const;

export type Flag = number;

export const Calendar = { ...RawCalendar } as const;
export type Calendar = (typeof Calendar)[keyof typeof Calendar];

export const HouseSystem = { ...RawHouseSystem } as const;
export type HouseSystem = (typeof HouseSystem)[keyof typeof HouseSystem];

/** Indices into the `ascmc` array of `swe_houses_ex2()` (swephexp.h:164–172). */
export const ASCMC = {
  Ascendant: 0,
  Midheaven: 1,
  Armc: 2,
  Vertex: 3,
  EquatorialAscendant: 4,
  CoAscendantKoch: 5,
  CoAscendantMunkasey: 6,
  PolarAscendant: 7,
  Count: 8,
} as const;

// SIGNS and Sign type already defined above (lines 69-84)
