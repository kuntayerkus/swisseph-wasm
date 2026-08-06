/**
 * City lookup and timezone resolution.
 *
 * The coordinate/offset half of chart input. `@kuntay/swisseph` computes
 * the sky; this package answers "where is İstanbul and what was its clock
 * doing on 1990-01-15?" — from bundled GeoNames data and the platform's
 * own tz database, with no web service and no dependencies.
 */

/** One populated place from the GeoNames cities15000 tier. */
export interface City {
  /** Local-script name, e.g. `İstanbul`. */
  name: string;
  /** ASCII-folded name for matching, e.g. `Istanbul`. */
  asciiName: string;
  /** Degrees north (south negative). */
  latitude: number;
  /** Degrees east (west negative). */
  longitude: number;
  /** ISO 3166-1 alpha-2, e.g. `TR`. */
  countryCode: string;
  /** English country name, e.g. `Türkiye`. */
  country: string;
  /** IANA zone id, e.g. `Europe/Istanbul`. */
  timezone: string;
  /** Population figure from the source; ranking aid, not astronomy. */
  population: number;
}

const COLUMN_COUNT = 8;

/**
 * Parses `cities.tsv` (the file this package ships).
 *
 * The format is deliberately boring: one tab-separated line per city,
 * `#` lines ignored, columns fixed by {@link City}. Rows that cannot be
 * parsed are skipped, not thrown on — a data file should never take the
 * whole application down, and the generator already validated the shape.
 */
export function parseCities(text: string): City[] {
  const cities: City[] = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (f.length < COLUMN_COUNT) continue;
    const latitude = Number(f[2]);
    const longitude = Number(f[3]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    cities.push({
      name: f[0],
      asciiName: f[1] || f[0],
      latitude,
      longitude,
      countryCode: f[4],
      country: f[5],
      timezone: f[6],
      population: Number(f[7]) || 0,
    });
  }
  return cities;
}

/** Options for {@link searchCities}. */
export interface SearchOptions {
  /** Restrict to one ISO 3166-1 alpha-2 code, e.g. `TR`. */
  country?: string;
  /** Maximum number of results. Defaults to 10. */
  limit?: number;
}

/*
 * Arama katmanı büyük/küçük harf ve aksan katmanlarında eşitlenir:
 * sorgu 'istanbul' ile veri 'İstanbul' buluşmalı. Türkçe yer adları için
 * 'tr' locale'iyla küçültme yetmez ('I' -> 'ı'), ASCII adı zaten
 * katlanmış taşıyor — iki alanı da tarıyoruz.
 */
const fold = (s: string): string => s.toLocaleLowerCase('en');

/**
 * Finds cities matching a query string.
 *
 * Ranking, within each class by population:
 * 1. exact name match (`izmir` → İzmir)
 * 2. name starts with the query (`ist` → İstanbul, Istres, ...)
 * 3. any word of the name starts with it (`los` → Los Angeles)
 * 4. substring (`ange` → Los Angeles)
 *
 * Returns at most `limit` results (default 10).
 */
export function searchCities(
  cities: readonly City[],
  query: string,
  options: SearchOptions = {},
): City[] {
  const q = fold(query.trim());
  if (!q) return [];
  const limit = options.limit ?? 10;
  const country = options.country ? fold(options.country) : undefined;

  const exact: City[] = [];
  const prefix: City[] = [];
  const wordPrefix: City[] = [];
  const substring: City[] = [];

  for (const city of cities) {
    if (country && fold(city.countryCode) !== country) continue;
    const name = fold(city.name);
    const ascii = fold(city.asciiName);
    if (name === q || ascii === q) exact.push(city);
    else if (name.startsWith(q) || ascii.startsWith(q)) prefix.push(city);
    else if (name.split(' ').some((w) => w.startsWith(q))
      || ascii.split(' ').some((w) => w.startsWith(q))) wordPrefix.push(city);
    else if (name.includes(q) || ascii.includes(q)) substring.push(city);
  }

  const byPopulation = (a: City, b: City) => b.population - a.population;
  exact.sort(byPopulation);
  prefix.sort(byPopulation);
  wordPrefix.sort(byPopulation);
  substring.sort(byPopulation);
  return [...exact, ...prefix, ...wordPrefix, ...substring].slice(0, limit);
}

// --- Saat dilimi -----------------------------------------------------------

/**
 * The zone's offset from UTC at one instant, in hours east of Greenwich.
 *
 * Implemented over `Intl.DateTimeFormat` — the platform's tz database —
 * which is present in every browser and in Node ≥ 16 with full ICU
 * (Node 24 ships it by default). Historical offsets and DST are answered
 * by the database, not by a lookup table in this package.
 *
 * The technique: format the instant in the target zone, read the
 * wall-clock fields back, interpret them as UTC. The difference is the
 * offset.
 */
export function zoneOffsetHours(zone: string, utcMs: number): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(utcMs))) {
    parts[part.type] = part.value;
  }
  // hour12:false bazı ICU sürümlerinde gece yarısı için "24" üretir.
  const hour = Number(parts.hour) % 24;
  const asIfUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second),
  );
  return (asIfUtc - utcMs) / 3_600_000;
}

/** Result of resolving a wall-clock reading to an offset. */
export interface WallClockOffset {
  /** Offset actually applying to that wall-clock reading, hours east of UTC. */
  offsetHours: number;
  /**
   * True when the reading occurred TWICE — the repeated hour of a
   * daylight-saving fall-back. `alternativeOffsetHours` carries the other
   * occurrence; a birth record giving only the clock cannot tell them apart.
   */
  ambiguous: boolean;
  /** The offset of the occurrence not chosen. Only set when ambiguous. */
  alternativeOffsetHours?: number;
}

/**
 * Resolves a local wall-clock reading to the zone offset that applied.
 *
 * Two passes: the first treats the wall clock as UTC and measures the
 * offset there; the second re-measures at the corrected instant, which
 * matters when the guess and the answer sit on opposite sides of a DST
 * transition. (The full treatment — including spring-forward gaps and a
 * discussion of both fall-back occurrences — lives in the MCP server's
 * `time.ts`; this is the compact, dependency-free core of it.)
 */
export function offsetForWallClock(
  zone: string,
  year: number, month: number, day: number,
  hour: number, minute = 0, second = 0,
): WallClockOffset {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstPass = guess - zoneOffsetHours(zone, guess) * 3_600_000;
  const offsetHours = zoneOffsetHours(zone, firstPass);

  /*
   * Tekrarlanan saat denetimi: geçişin iki yanındaki ofsetleri aday al ve
   * her aday için "bu ofsetle geri gidip yeniden ölçersem aynı ofseti
   * buluyor muyum" diye sor. Kendini doğrulayan iki aday varsa saat iki
   * kez yaşanmıştır. İlkbahar boşluğunda hiçbir aday doğrulanmaz — orada
   * belirsizlik yoktur, saat hiç yaşanmamıştır.
   */
  const DAY_MS = 86_400_000;
  const candidates = new Set([
    zoneOffsetHours(zone, guess - DAY_MS) * 3_600_000,
    zoneOffsetHours(zone, guess + DAY_MS) * 3_600_000,
  ]);
  const offsetMs = offsetHours * 3_600_000;
  const valid = [...candidates].filter(
    (o) => zoneOffsetHours(zone, guess - o) * 3_600_000 === o);
  const alternative = valid.length > 1
    ? valid.find((o) => o !== offsetMs)
    : undefined;

  return {
    offsetHours,
    ambiguous: alternative !== undefined,
    ...(alternative !== undefined
      ? { alternativeOffsetHours: alternative / 3_600_000 }
      : {}),
  };
}

/** Formats hours east of Greenwich as `"+03:00"` / `"-05:30"`. */
export function formatOffsetHours(hours: number): string {
  const sign = hours < 0 ? '-' : '+';
  const total = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
