/**
 * Antiscia and contra-antiscia.
 *
 * A point's antiscion is its mirror across the solstitial axis (0° Cancer –
 * 0° Capricorn). Two points in antiscion share the same declination and the
 * same day length, which is the physical basis of the technique: they are
 * equidistant from the solstice, so the Sun stands at the same height on both
 * days of the year.
 *
 * Contra-antiscia mirror across the equinoctial axis (0° Aries – 0° Libra)
 * instead, giving opposite declinations.
 *
 * The arithmetic is trivial; the value is in getting the axis right and in
 * finding contacts, which is where implementations differ.
 */

import { SIGNS, type Sign } from '../constants.js';
import { normalizeDegrees } from './sect.js';
import type { AspectPoint } from './aspects.js';

/**
 * The antiscion of a longitude: its reflection across the Cancer–Capricorn
 * axis.
 *
 * Derivation: reflecting across 0° Cancer (90°) maps `x` to `180 − x`.
 * 15° Gemini (75°) becomes 15° Cancer (105°); 0° Cancer maps to itself.
 */
export function antiscion(longitude: number): number {
  return normalizeDegrees(180 - longitude);
}

/**
 * The contra-antiscion: reflection across the Aries–Libra axis, which maps
 * `x` to `360 − x`. Equivalently, the antiscion's opposition.
 */
export function contraAntiscion(longitude: number): number {
  return normalizeDegrees(360 - longitude);
}

export interface ReflectedPoint {
  /** The original point's label. */
  name: string;
  /** Original longitude. */
  longitude: number;
  /** Reflection across the solstitial axis. */
  antiscion: number;
  /** Reflection across the equinoctial axis. */
  contraAntiscion: number;
  antiscionSign: Sign;
  contraAntiscionSign: Sign;
}

const signOf = (longitude: number): Sign =>
  SIGNS[Math.floor(normalizeDegrees(longitude) / 30)];

/** Computes both reflections for a point. */
export function reflect(name: string, longitude: number): ReflectedPoint {
  const anti = antiscion(longitude);
  const contra = contraAntiscion(longitude);
  return {
    name,
    longitude: normalizeDegrees(longitude),
    antiscion: anti,
    contraAntiscion: contra,
    antiscionSign: signOf(anti),
    contraAntiscionSign: signOf(contra),
  };
}

export type AntisciaKind = 'antiscion' | 'contra-antiscion';

export interface AntisciaContact {
  kind: AntisciaKind;
  /** The point whose reflection was taken. */
  from: AspectPoint;
  /** The point the reflection falls on. */
  to: AspectPoint;
  /** Where the reflection landed. */
  reflectedLongitude: number;
  /** Distance from the contacted point, in degrees. */
  orb: number;
  maxOrb: number;
  /** 1 when exact, falling to 0 at the edge of the orb. */
  strength: number;
}

export interface AntisciaOptions {
  /**
   * Allowed orb in degrees. Traditional practice keeps these very tight —
   * often 1° or less — because the technique rests on an exact symmetry
   * rather than on a sphere of influence.
   */
  orb?: number;
  /** Whether to include contra-antiscia. Defaults to true. */
  includeContra?: boolean;
}

/** Shortest angular distance between two longitudes, 0–180. */
function distance(a: number, b: number): number {
  const d = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return d > 180 ? 360 - d : d;
}

/**
 * Finds antiscia contacts among a set of points.
 *
 * Each unordered pair is reported once. A pair is checked in one direction
 * only because the relation is symmetric: if A's antiscion falls on B, then
 * B's antiscion falls on A by construction, and reporting both would double
 * every contact.
 *
 * ```ts
 * const contacts = findAntiscia([
 *   { name: 'Sun', longitude: 54.5 },
 *   { name: 'Mars', longitude: 126.1 },
 * ], { orb: 1 });
 * ```
 */
export function findAntiscia(
  points: AspectPoint[],
  options: AntisciaOptions = {},
): AntisciaContact[] {
  const maxOrb = options.orb ?? 1;
  const includeContra = options.includeContra ?? true;
  const contacts: AntisciaContact[] = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const from = points[i];
      const to = points[j];

      const anti = antiscion(from.longitude);
      const antiOrb = distance(anti, to.longitude);
      if (antiOrb <= maxOrb) {
        contacts.push({
          kind: 'antiscion', from, to,
          reflectedLongitude: anti, orb: antiOrb, maxOrb,
          strength: 1 - antiOrb / maxOrb,
        });
      }

      if (!includeContra) continue;

      const contra = contraAntiscion(from.longitude);
      const contraOrb = distance(contra, to.longitude);
      if (contraOrb <= maxOrb) {
        contacts.push({
          kind: 'contra-antiscion', from, to,
          reflectedLongitude: contra, orb: contraOrb, maxOrb,
          strength: 1 - contraOrb / maxOrb,
        });
      }
    }
  }

  return contacts.sort((a, b) => b.strength - a.strength);
}
