/**
 * Aspects between chart points.
 *
 * Pure geometry over longitudes the library already computes. The interesting
 * part is not detecting a 90° separation — it is that **orb schemes genuinely
 * disagree** between traditions, and most libraries hardcode one.
 *
 * Three schemes ship here and custom ones are first-class. Orbs may be
 * attached to the aspect, to the body, or to both; all three conventions
 * exist in practice, so which one applies is an explicit choice.
 */

import { Body } from '../constants.js';
import { normalizeDegrees } from './sect.js';

/** A named angular relationship. */
export interface AspectDefinition {
  name: string;
  /** Exact separation in degrees. */
  angle: number;
  /**
   * Relative strength, used for sorting and for schemes that scale orbs by
   * aspect importance. 1 = major, lower = minor.
   */
  weight: number;
}

/** Ptolemaic aspects — the five recognised by traditional astrology. */
export const MAJOR_ASPECTS: Record<string, AspectDefinition> = {
  Conjunction: { name: 'Conjunction', angle: 0, weight: 1 },
  Sextile: { name: 'Sextile', angle: 60, weight: 0.7 },
  Square: { name: 'Square', angle: 90, weight: 1 },
  Trine: { name: 'Trine', angle: 120, weight: 1 },
  Opposition: { name: 'Opposition', angle: 180, weight: 1 },
};

/** Minor aspects in common modern use. */
export const MINOR_ASPECTS: Record<string, AspectDefinition> = {
  SemiSextile: { name: 'Semi-sextile', angle: 30, weight: 0.3 },
  SemiSquare: { name: 'Semi-square', angle: 45, weight: 0.4 },
  Quintile: { name: 'Quintile', angle: 72, weight: 0.3 },
  Sesquiquadrate: { name: 'Sesquiquadrate', angle: 135, weight: 0.4 },
  BiQuintile: { name: 'Bi-quintile', angle: 144, weight: 0.3 },
  Quincunx: { name: 'Quincunx', angle: 150, weight: 0.5 },
};

export const ALL_ASPECTS: Record<string, AspectDefinition> = {
  ...MAJOR_ASPECTS,
  ...MINOR_ASPECTS,
};

/**
 * How orbs are decided.
 *
 * `byAspect` gives each aspect a fixed orb. `byBody` gives each body its own
 * orb and combines the two bodies' values. Supply both and `combine` decides
 * how they interact.
 */
export interface OrbScheme {
  name: string;
  /** Orb in degrees, per aspect key. */
  byAspect?: Record<string, number>;
  /** Orb in degrees, per body. */
  byBody?: Record<number, number>;
  /**
   * How two bodies' orbs combine when `byBody` is used.
   * 'mean' averages them, 'max' takes the wider, 'sum' adds them (the
   * traditional "moiety" convention adds each body's half-orb).
   */
  combine?: 'mean' | 'max' | 'sum';
  /** Fallback when neither table covers a pair. */
  fallback: number;
}

/**
 * A common modern scheme: orb depends on the aspect, not the bodies.
 * Widely used in software defaults.
 */
export const MODERN_ORBS: OrbScheme = {
  name: 'modern (by aspect)',
  byAspect: {
    Conjunction: 8, Opposition: 8, Trine: 8, Square: 7, Sextile: 6,
    Quincunx: 3, SemiSquare: 2, Sesquiquadrate: 2,
    SemiSextile: 2, Quintile: 2, BiQuintile: 2,
  },
  fallback: 2,
};

/**
 * Traditional moiety scheme: each body carries half an orb and two bodies
 * aspect when they are within the sum of their halves. The luminaries get the
 * widest orbs, which is the point of the scheme.
 */
export const TRADITIONAL_MOIETIES: OrbScheme = {
  name: 'traditional (moieties)',
  byBody: {
    [Body.Sun]: 7.5, [Body.Moon]: 6, [Body.Mercury]: 3.5, [Body.Venus]: 3.5,
    [Body.Mars]: 4, [Body.Jupiter]: 4.5, [Body.Saturn]: 4.5,
  },
  combine: 'sum',
  fallback: 3,
};

/** A deliberately tight scheme, useful when only exact contacts matter. */
export const TIGHT_ORBS: OrbScheme = {
  name: 'tight',
  byAspect: { Conjunction: 3, Opposition: 3, Trine: 3, Square: 3, Sextile: 2 },
  fallback: 1,
};

/** A point participating in aspect search. */
export interface AspectPoint {
  /** Label used in results. */
  name: string;
  longitude: number;
  /** Body constant, if this point is a body — required for `byBody` orbs. */
  body?: number;
  /** Degrees per day; enables applying/separating detection. */
  speed?: number;
  /**
   * Points that are **not independent of one another**.
   *
   * {@link findAspects} never pairs two points carrying the same group, and
   * the reason is that the angle between them is not an aspect at all.
   * The Ascendant and the Midheaven are the case that forces this: their
   * separation is a function of latitude and obliquity, nothing else. At 20°
   * it happens to be 89.98°, so a chart there reports an Ascendant–Midheaven
   * square with a 0°01' orb — the tightest contact in the chart, sorted to
   * the top, and carrying no information whatsoever. Every chart at that
   * latitude gets it.
   *
   * Only {@link findAspects} honours this. {@link findAspectsBetween} compares
   * two separate sets, where one chart's angles against another's are a real
   * contact, so it deliberately ignores the group.
   */
  group?: string;
}

export interface Aspect {
  aspect: AspectDefinition;
  from: AspectPoint;
  to: AspectPoint;
  /** Angular separation between the points, 0–180. */
  separation: number;
  /** How far from exact, in degrees. Always positive. */
  orb: number;
  /** The orb allowed for this pair under the chosen scheme. */
  maxOrb: number;
  /**
   * 1 when exact, falling to 0 at the edge of the orb. Multiplied by the
   * aspect's weight, so a wide minor aspect scores below a tight major one.
   */
  strength: number;
  /**
   * True when the faster point is moving toward exactness. Requires `speed`
   * on both points; undefined otherwise.
   */
  applying?: boolean;
}

/**
 * Signed angular difference `b − a`, reduced to (−180, 180].
 *
 * The sign says which way round the pair sits, which is what tells an
 * applying aspect from a separating one.
 */
function signedSeparation(a: number, b: number): number {
  const d = normalizeDegrees(b - a);
  return d > 180 ? d - 360 : d;
}

/** Shortest angular distance between two longitudes, 0–180. */
export function separation(a: number, b: number): number {
  return Math.abs(signedSeparation(a, b));
}

function orbFor(
  scheme: OrbScheme,
  aspectKey: string,
  from: AspectPoint,
  to: AspectPoint,
): number {
  const byAspect = scheme.byAspect?.[aspectKey];

  if (scheme.byBody && from.body !== undefined && to.body !== undefined) {
    const a = scheme.byBody[from.body];
    const b = scheme.byBody[to.body];
    if (a !== undefined && b !== undefined) {
      switch (scheme.combine ?? 'mean') {
        case 'sum': return a + b;
        case 'max': return Math.max(a, b);
        default: return (a + b) / 2;
      }
    }
  }

  return byAspect ?? scheme.fallback;
}

export interface FindAspectsOptions {
  /** Which aspects to look for. Defaults to the Ptolemaic five. */
  aspects?: Record<string, AspectDefinition>;
  /** Orb scheme. Defaults to {@link MODERN_ORBS}. */
  orbs?: OrbScheme;
}

/*
 * `includeSelfPairs` BURADAN KALDIRILDI.
 *
 * Tanımlıydı, JSDoc'u davranışını anlatıyordu ve findAspects onu hiç
 * okumuyordu: false geçmek de true geçmek de aynı 25 açıyı döndürüyordu.
 * Anlattığı şey (yalnızca kümeler arası karşılaştırma) zaten ayrı bir
 * fonksiyon — findAspectsBetween. Etkisiz bir seçeneği tutmak, onu ayarlayan
 * çağıranın bir şeyi kapattığını sanması demekti. Yerine gelen ayrım
 * AspectPoint.group.
 */

/**
 * Finds aspects among a set of points.
 *
 * Each unordered pair is examined once, except pairs that share a
 * {@link AspectPoint.group} — those are not independent and are skipped.
 * Results are sorted strongest first.
 *
 * ```ts
 * const aspects = findAspects([
 *   { name: 'Sun', longitude: 54.5, body: Body.Sun, speed: 0.97 },
 *   { name: 'Moon', longitude: 296.9, body: Body.Moon, speed: 12.8 },
 * ], { orbs: TRADITIONAL_MOIETIES });
 * ```
 */
export function findAspects(
  points: AspectPoint[],
  options: FindAspectsOptions = {},
): Aspect[] {
  const aspects = options.aspects ?? MAJOR_ASPECTS;
  const scheme = options.orbs ?? MODERN_ORBS;
  const found: Aspect[] = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j];
      if (a.group !== undefined && a.group === b.group) continue;

      const hit = examine(a, b, aspects, scheme);
      if (hit) found.push(hit);
    }
  }

  return found.sort((a, b) => b.strength - a.strength);
}

/**
 * Finds aspects between two sets — synastry, transits to a natal chart, or
 * any comparison where within-set pairs are not wanted.
 */
export function findAspectsBetween(
  from: AspectPoint[],
  to: AspectPoint[],
  options: FindAspectsOptions = {},
): Aspect[] {
  const aspects = options.aspects ?? MAJOR_ASPECTS;
  const scheme = options.orbs ?? MODERN_ORBS;
  const found: Aspect[] = [];

  for (const a of from) {
    for (const b of to) {
      const hit = examine(a, b, aspects, scheme);
      if (hit) found.push(hit);
    }
  }

  return found.sort((x, y) => y.strength - x.strength);
}

function examine(
  from: AspectPoint,
  to: AspectPoint,
  aspects: Record<string, AspectDefinition>,
  scheme: OrbScheme,
): Aspect | null {
  const sep = separation(from.longitude, to.longitude);

  /*
   * Bir çift aynı anda tek bir açıyı sağlayabilir; iki tanım geniş bir orb
   * şemasında çakışırsa EN GÜÇLÜ olanı tutuyoruz.
   *
   * Eskiden en DAR orb'lu tutuluyordu, ki bu modülün kendi sıralama ölçütüyle
   * çelişiyordu: findAspects sonucu güce göre sıralıyor, dolayısıyla "hangi
   * açı" sorusunu orb'la, "hangisi önce" sorusunu güçle cevaplamak tutarsız.
   * Fark gerçek: geleneksel moiety şemasında Güneş–Ay çiftinin izni her açı
   * için 13.5° olduğundan 37°'lik bir ayrım hem yarım-altmışlığa (orb 7,
   * güç 0.144) hem yarım-kareye (orb 8, güç 0.163) uyuyor. Orb dar olanı,
   * güç ise güçlü olanı seçer — ikincisi listenin geri kalanıyla aynı dili
   * konuşuyor.
   *
   * Eşitlikte ilk tanım kazanıyor; MAJOR_ASPECTS başta geldiği için bu da
   * majör lehine.
   */
  let best: Aspect | null = null;

  for (const [key, aspect] of Object.entries(aspects)) {
    const orb = Math.abs(sep - aspect.angle);
    const maxOrb = orbFor(scheme, key, from, to);
    if (orb > maxOrb) continue;

    const strength = (1 - orb / maxOrb) * aspect.weight;
    if (best && best.strength >= strength) continue;

    best = {
      aspect, from, to, separation: sep, orb, maxOrb, strength,
      ...applyingState(from, to, aspect.angle, sep),
    };
  }

  return best;
}

/**
 * Whether the aspect is applying (closing) or separating.
 *
 * The orb is `|separation − angle|`, so the aspect is applying exactly when
 * that quantity is **decreasing**. We take its derivative rather than
 * sampling:
 *
 *   d(separation)/dt = sign(Δ) · (to.speed − from.speed),  Δ = signed b − a
 *   d(orb)/dt        = sign(separation − angle) · d(separation)/dt
 *
 * This was a finite step of 0.01 days, and the step **overshot exactness**.
 * The Moon covers 0.13° in that time, so any Moon aspect closer than about
 * 0.06° to exact was pushed past perfection and reported as separating while
 * it was still applying — measured: correct at an orb of 0°03'43", inverted
 * at 0°03'40" and everything tighter. That is precisely the partile range,
 * the one horary and electional work turns on. The threshold scaled with
 * relative speed, so it silently affected the fastest pairs the most.
 *
 * The derivative has no step to overshoot. Retrograde motion and the 0/360
 * boundary still need no special case: both live in the signed difference.
 *
 * At exactness the orb is at a corner (a minimum), so `sign(0) = 0` makes
 * this report **separating** — from that instant the orb only widens.
 */
function applyingState(
  from: AspectPoint,
  to: AspectPoint,
  angle: number,
  currentSeparation: number,
): { applying?: boolean } {
  if (from.speed === undefined || to.speed === undefined) return {};

  const delta = signedSeparation(from.longitude, to.longitude);
  const separationRate = Math.sign(delta) * (to.speed - from.speed);
  const orbRate = Math.sign(currentSeparation - angle) * separationRate;

  return { applying: orbRate < 0 };
}
