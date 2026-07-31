/**
 * Time-lord techniques: annual profections and Persian firdaria.
 *
 * Both are pure arithmetic over a birth moment — no ephemeris involved — but
 * both hide a decision that changes every result: **how long a year is**.
 * Traditions used the Egyptian 365-day year, the Julian 365.25, or the
 * tropical year; modern software mostly uses the tropical year without
 * saying so. Over a 75-year firdaria cycle the Egyptian and tropical years
 * drift about 18 days apart, which is enough to move a sub-period boundary
 * past a transit you were trying to date. The length is an explicit option
 * here, and the default is stated.
 */

import { Body, SIGNS, type Sign } from '../constants.js';
import { rulerOfSign } from './dignities.js';
import type { Sect } from './sect.js';

/** Mean tropical year in days at J2000. The default throughout this module. */
export const TROPICAL_YEAR = 365.242190;

/** The Julian year — 365.25 days. Used by some traditional sources. */
export const JULIAN_YEAR = 365.25;

/** The Egyptian civil year — exactly 365 days, no intercalation. */
export const EGYPTIAN_YEAR = 365;

/** Yıl dönümü sınırındaki kayan nokta gürültüsü payı. Bkz. profection(). */
const BOUNDARY_TOLERANCE_YEARS = 1e-9;

// --- profections ---------------------------------------------------------

export interface ProfectionOptions {
  /** Days per year. Defaults to {@link TROPICAL_YEAR}. */
  yearLength?: number;
  /** Use modern rulerships (Pluto, Uranus, Neptune) for the lord. */
  modernRulers?: boolean;
  /**
   * Completed years of age, when you have computed it another way — for
   * instance from exact solar returns rather than a fixed year length.
   * Overrides the elapsed-time calculation.
   */
  age?: number;
}

export interface ProfectedUnit {
  /**
   * The activated natal house, 1–12 — counted from the natal Ascendant, for
   * the year, the month and the day alike.
   *
   * This is the house you would quote: if the profected month falls in the
   * sign occupying the natal seventh, `house` is 7. It is **not** the position
   * of the unit within its parent period; that is `month.index` and
   * `day.index`.
   */
  house: number;
  signIndex: number;
  sign: Sign;
  /** Ruler of the profected sign — the lord of the period. */
  lord: number;
}

export interface Profection extends ProfectedUnit {
  /** Completed years since birth. */
  age: number;
  /** How far through the profection year, 0–1. */
  yearFraction: number;
  /** The profected month: the year divided into twelve. */
  month: ProfectedUnit & { index: number };
  /** The profected day: the month divided into twelve, roughly 2.5 days. */
  day: ProfectedUnit & { index: number };
}

/**
 * Annual, monthly and daily profection from the natal Ascendant.
 *
 * The Ascendant advances one sign per year of life, so the twelfth year
 * returns to the natal sign. Each year subdivides into twelve months and each
 * month into twelve days, the same step applied three times.
 *
 * `house` is the natal house for all three units, counted from the natal
 * Ascendant; `month.index` and `day.index` give the position within the parent
 * period.
 *
 * ```ts
 * const p = profection(natalJd, targetJd, natalAscendant);
 * p.house;        // 1–12, the natal house activated for the year
 * p.month.house;  // 1–12, the natal house the profected month falls in
 * p.month.index;  // 1–12, which month of the profection year it is
 * p.lord;         // Body constant ruling the profected sign
 * ```
 *
 * @param natalJd    birth moment, Julian day
 * @param jd         the moment being examined
 * @param ascendant  natal Ascendant longitude in degrees
 */
export function profection(
  natalJd: number,
  jd: number,
  ascendant: number,
  options: ProfectionOptions = {},
): Profection {
  const yearLength = options.yearLength ?? TROPICAL_YEAR;
  const modern = options.modernRulers ?? false;

  /*
   * Yıl dönümü sınırı kayan noktada bir uçurum ve tam üstüne düşmek çok
   * yaygın bir kullanım: insanlar profeksiyonu tam güneş dönüşü anında
   * soruyor.
   *
   * Sorun şu: jd ~2.45e6 mertebesinde ve iki büyük sayının farkı ~5e-10 gün
   * hassasiyetinde. 30. yıl dönümünde (jd - natalJd) / yearLength
   * 29.999999999999 çıkabiliyor, floor() 29 diyor ve profeksiyon bir yıl
   * geri kayıyor. Aynı uçurum ay ve gün alt bölümlerinde de var.
   *
   * Tek bir tolerans ekliyoruz: 1e-9 yıl ≈ 31 mikrosaniye. Hiçbir doğum
   * saati bu çözünürlükte bilinmiyor, dolayısıyla sınırı bu kadar
   * yuvarlamak bilgi kaybetmiyor; kaybetmemek ise bir yıl kaydırıyor.
   */
  const elapsedYears = (jd - natalJd) / yearLength + BOUNDARY_TOLERANCE_YEARS;
  const age = options.age ?? Math.floor(elapsedYears);

  // Age may be supplied independently, so derive the fraction from the age
  // actually used — otherwise an overridden age and the fraction would
  // describe different years.
  const yearFraction = clamp01(elapsedYears - age);

  const ascSign = signIndexOf(ascendant);
  const monthIndex = Math.floor(yearFraction * 12);
  const dayFraction = yearFraction * 12 - monthIndex;
  const dayIndex = Math.floor(dayFraction * 12);

  const yearUnit = unit(ascSign, age, ascSign, modern);

  return {
    ...yearUnit,
    age,
    yearFraction,
    month: {
      ...unit(yearUnit.signIndex, monthIndex, ascSign, modern),
      index: monthIndex + 1,
    },
    day: {
      ...unit(mod(yearUnit.signIndex + monthIndex, 12), dayIndex, ascSign, modern),
      index: dayIndex + 1,
    },
  };
}

/**
 * Bir profeksiyon birimi.
 *
 * `house` NATAL YÜKSELEN'den sayılıyor, `steps`'ten değil.
 *
 * Eskiden `mod(steps, 12) + 1` idi ve `steps` üç birim için farklı şeyler
 * demek: yıl için yaş (Yükselen'den sayıldığı için tesadüfen mutlak ev),
 * ay için yıl içindeki sıra, gün için ay içindeki sıra. Sonuç: `month.house`
 * ve `day.house` ev değil, sıra numarasıydı — ama tip ve JSDoc üçü için
 * aynıydı, dolayısıyla okuyanın bunu bilmesinin bir yolu yoktu. Ölçüldü:
 * Oğlak'ın natal 7. evde olduğu bir haritada `month.house` 1 diyordu.
 *
 * Geleneksel pratikte aylık profeksiyon evi gerçekten alıntılanan bir değer,
 * yani 7 yerine 1 raporlamak *önemli olan biçimde* yanlış. Sıra numarası
 * `month.index` / `day.index` alanlarında zaten var, dolayısıyla bu düzeltme
 * hiçbir bilgi kaybetmiyor.
 *
 * @param fromSignIndex sayıma başlanacak burç
 * @param steps         o burçtan ileri adım sayısı
 * @param natalAscSign  natal Yükselen'in burcu — mutlak evin referansı
 */
function unit(
  fromSignIndex: number,
  steps: number,
  natalAscSign: number,
  modern: boolean,
): ProfectedUnit {
  const signIndex = mod(fromSignIndex + steps, 12);
  return {
    house: mod(signIndex - natalAscSign, 12) + 1,
    signIndex,
    sign: SIGNS[signIndex],
    lord: rulerOfSign(signIndex, modern),
  };
}

// --- firdaria ------------------------------------------------------------

/**
 * Firdaria time lords. The lunar nodes take their turn alongside the seven
 * planets, and Swiss Ephemeris has no body constant for the south node, so
 * lords are named rather than numbered. {@link LORD_BODY} maps the seven
 * planets and the north node to body constants.
 */
export type FirdariaLord =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn'
  | 'NorthNode' | 'SouthNode';

/*
 * Kuzey düğüm için GERÇEK (true) düğüm — kütüphanenin geri kalanıyla aynı.
 *
 * Burası NorthNodeMean idi, oysa swe.lots() ve MCP haritası NorthNodeTrue
 * kullanıyor. Aynı oturumda "kuzey ay düğümü"nün iki farklı konumu çıkıyordu
 * (bu tarihte 1.08° fark) ve hangisinin nereden geldiğini söyleyen bir şey
 * yoktu. Firdaria'da düğümün KONUMU zaten kullanılmıyor — LORD_BODY sadece
 * "bu efendinin yerine bakmak istersen" diye var — dolayısıyla tutarlılık
 * bedelsiz. Ortalama düğümü isteyen Body.NorthNodeMean ile kendisi bakar.
 */
export const LORD_BODY: Record<FirdariaLord, number | null> = {
  Sun: Body.Sun,
  Moon: Body.Moon,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  NorthNode: Body.NorthNodeTrue,
  SouthNode: null,
};

interface LordSpan { lord: FirdariaLord; years: number }

/**
 * Day-birth sequence. Begins with the Sun and totals 75 years.
 * Abu Ma'shar, transmitted through Bonatti.
 */
export const FIRDARIA_DIURNAL: readonly LordSpan[] = [
  { lord: 'Sun', years: 10 },
  { lord: 'Venus', years: 8 },
  { lord: 'Mercury', years: 13 },
  { lord: 'Moon', years: 9 },
  { lord: 'Saturn', years: 11 },
  { lord: 'Jupiter', years: 12 },
  { lord: 'Mars', years: 7 },
  { lord: 'NorthNode', years: 3 },
  { lord: 'SouthNode', years: 2 },
];

/** Night-birth sequence. Begins with the Moon; the same 75 years. */
export const FIRDARIA_NOCTURNAL: readonly LordSpan[] = [
  { lord: 'Moon', years: 9 },
  { lord: 'Saturn', years: 11 },
  { lord: 'Jupiter', years: 12 },
  { lord: 'Mars', years: 7 },
  { lord: 'Sun', years: 10 },
  { lord: 'Venus', years: 8 },
  { lord: 'Mercury', years: 13 },
  { lord: 'NorthNode', years: 3 },
  { lord: 'SouthNode', years: 2 },
];

/** Total length of one firdaria cycle, in years. */
export const FIRDARIA_CYCLE_YEARS = 75;

export interface FirdariaPeriod {
  lord: FirdariaLord;
  /** Body constant, or null for the south node. */
  body: number | null;
  startJd: number;
  endJd: number;
  /** Length in years, using the year length in force. */
  years: number;
  /**
   * Sub-periods, present on major periods only. The nodes have none — a
   * point on the Moon's orbit was not held to delegate.
   */
  sub?: FirdariaPeriod[];
}

export interface FirdariaOptions {
  /** Days per year. Defaults to {@link TROPICAL_YEAR}. */
  yearLength?: number;
  /**
   * How many 75-year cycles to lay out. Two covers any lifetime; the
   * sequence simply repeats.
   */
  cycles?: number;
}

/**
 * The firdaria sequence from birth.
 *
 * Nine periods totalling 75 years, ordered by sect. Each planetary period
 * divides into seven equal sub-periods that run through the seven planets in
 * the same order, starting from the period's own lord. The two node periods
 * are not subdivided.
 *
 * ```ts
 * const periods = firdaria(natalJd, 'day');
 * periods[0].lord;            // 'Sun' for a day birth
 * periods[0].sub?.[1].lord;   // 'Venus' — next in sequence
 * ```
 */
export function firdaria(
  birthJd: number,
  sect: Sect,
  options: FirdariaOptions = {},
): FirdariaPeriod[] {
  const yearLength = options.yearLength ?? TROPICAL_YEAR;
  const cycles = options.cycles ?? 2;
  const order = sect === 'day' ? FIRDARIA_DIURNAL : FIRDARIA_NOCTURNAL;

  // Sub-periods cycle through the planets only, keeping the sequence's order.
  const planets = order
    .map((s) => s.lord)
    .filter((lord) => lord !== 'NorthNode' && lord !== 'SouthNode');

  const periods: FirdariaPeriod[] = [];
  let cursor = birthJd;

  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const span of order) {
      const startJd = cursor;
      const endJd = cursor + span.years * yearLength;
      const period: FirdariaPeriod = {
        lord: span.lord,
        body: LORD_BODY[span.lord],
        startJd, endJd,
        years: span.years,
      };

      // findIndex, indexOf değil: TypeScript filter'dan bir tip daraltması
      // çıkarıyor ve daralmış diziye geniş birleşimi indexOf ile sormak
      // tip hatası oluyor. Karşılaştırma ise sorunsuz.
      const planetIndex = planets.findIndex((lord) => lord === span.lord);
      if (planetIndex >= 0) {
        const subYears = span.years / planets.length;
        period.sub = planets.map((_, i) => {
          const lord = planets[(planetIndex + i) % planets.length];
          return {
            lord,
            body: LORD_BODY[lord],
            startJd: startJd + i * subYears * yearLength,
            endJd: startJd + (i + 1) * subYears * yearLength,
            years: subYears,
          };
        });
      }

      periods.push(period);
      cursor = endJd;
    }
  }

  return periods;
}

export interface FirdariaAt {
  major: FirdariaPeriod;
  /** Null inside a node period, which has no sub-periods. */
  minor: FirdariaPeriod | null;
  /** Years elapsed since birth, using the year length in force. */
  ageYears: number;
}

/**
 * The firdaria lords in force at a given moment.
 *
 * Returns null when the moment falls outside the cycles laid out — raise
 * `cycles` rather than assuming the sequence stops.
 */
export function firdariaAt(
  birthJd: number,
  sect: Sect,
  jd: number,
  options: FirdariaOptions = {},
): FirdariaAt | null {
  const yearLength = options.yearLength ?? TROPICAL_YEAR;
  const periods = firdaria(birthJd, sect, options);

  const major = periods.find((p) => jd >= p.startJd && jd < p.endJd);
  if (!major) return null;

  return {
    major,
    minor: major.sub?.find((s) => jd >= s.startJd && jd < s.endJd) ?? null,
    ageYears: (jd - birthJd) / yearLength,
  };
}

// --- helpers -------------------------------------------------------------

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const signIndexOf = (longitude: number) => Math.floor(mod(longitude, 360) / 30);
