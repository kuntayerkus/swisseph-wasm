/**
 * Turning numbers into text an LLM reads correctly.
 *
 * This module exists because handing a model raw floats is a reliable way to
 * get wrong output. Given `54.5033` it will convert to degrees and minutes
 * itself, and it will **round** — while every piece of astrology software
 * **truncates**. That single difference produced a phantom one-arcminute
 * disagreement on four of ten bodies when this project's own demo rounded.
 *
 * So: format here, once, correctly, and give the model text it can quote
 * verbatim. The raw value goes alongside in parentheses for anything that
 * needs to compute rather than read.
 */

import { SIGNS } from '@kuntay/swisseph';

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Kesme, ikili gösterim hatasını BÜYÜTÜYOR.
 *
 * 19.2 derece bir double'da tam olarak saklanamıyor; gerçek değer
 * 19.199999999999999289... Bunu 3600 ile çarpıp kestiğimizde 69119 saniye,
 * yani 19°11'59" çıkıyor — oysa doğrusu 19°12'00".
 *
 * Yuvarlamak çözüm değil: burç sınırında 29°59'60" üretip bir SONRAKİ burcu
 * gösterirdi, ki bu koca bir burç hatası. Bunun yerine kesmeden önce saniyenin
 * on milyonda biri kadar ekliyoruz. Double'ın bu büyüklükteki gürültüsü
 * ~4e-10 saniye, kütüphanenin kendi doğruluğu ise en iyi ihtimalle 1e-6
 * saniye — yani bu pay gürültünün üstünde, anlamlı hassasiyetin altında.
 */
const ARCSECOND_EPSILON = 1e-7;

/** Bir açıyı tam saniyeye kesip derece/dakika/saniyeye ayırır. */
function toDegreesMinutesSeconds(value: number): [number, number, number] {
  const totalSeconds = Math.floor(value * 3600 + ARCSECOND_EPSILON);
  return [
    Math.floor(totalSeconds / 3600),
    Math.floor(totalSeconds / 60) % 60,
    totalSeconds % 60,
  ];
}

/**
 * Degrees, minutes and seconds within a sign — `15°23'44" Taurus`.
 *
 * Truncates, matching Solar Fire, Astro-Gold and the rest. Rounding would
 * show 29°59'60" as 30°00'00" of the *next* sign, which is a whole sign
 * wrong at the boundary.
 */
export function formatLongitude(longitude: number): string {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const [degrees, minutes, seconds] = toDegreesMinutesSeconds(normalized - signIndex * 30);
  return `${two(degrees)}°${two(minutes)}'${two(seconds)}" ${SIGNS[signIndex]}`;
}

/** Signed degrees, minutes and seconds — used for declination and latitude. */
export function formatDeclination(declination: number): string {
  const sign = declination < 0 ? '-' : '+';
  const [degrees, minutes, seconds] = toDegreesMinutesSeconds(Math.abs(declination));
  return `${sign}${two(degrees)}°${two(minutes)}'${two(seconds)}"`;
}

/** A bare angle with no sign attached — orbs, aspect separations. */
export function formatAngle(degrees: number): string {
  const [whole, minutes] = toDegreesMinutesSeconds(Math.abs(degrees));
  return `${whole}°${two(minutes)}'`;
}

/**
 * A Julian day as a readable UT timestamp.
 *
 * @param calendarDate the instance's `calendarDate()`, injected so this
 *                     module needs no live instance of its own
 */
export function formatJulianDay(
  jd: number,
  calendarDate: (jd: number) => { year: number; month: number; day: number; hour: number },
): string {
  const d = calendarDate(jd);
  const totalSeconds = Math.round(d.hour * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const era = d.year <= 0 ? ` (${Math.abs(d.year) + 1} BCE)` : '';
  return `${d.year}-${two(d.month)}-${two(d.day)} ${two(hours)}:${two(minutes)} UT${era}`;
}

/** Pads a label so columns line up — an LLM parses aligned text more reliably. */
export function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

/** Joins sections with a blank line, dropping the empty ones. */
export function sections(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join('\n\n');
}
