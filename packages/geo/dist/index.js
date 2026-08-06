/**
 * City lookup and timezone resolution.
 *
 * The coordinate/offset half of chart input. `@kuntay/swisseph` computes
 * the sky; this package answers "where is İstanbul and what was its clock
 * doing on 1990-01-15?" — from bundled GeoNames data and the platform's
 * own tz database, with no web service and no dependencies.
 */
const COLUMN_COUNT = 8;
/**
 * Parses `cities.tsv` (the file this package ships).
 *
 * The format is deliberately boring: one tab-separated line per city,
 * `#` lines ignored, columns fixed by {@link City}. Rows that cannot be
 * parsed are skipped, not thrown on — a data file should never take the
 * whole application down, and the generator already validated the shape.
 */
export function parseCities(text) {
    const cities = [];
    for (const line of text.split('\n')) {
        if (!line || line.startsWith('#'))
            continue;
        const f = line.split('\t');
        if (f.length < COLUMN_COUNT)
            continue;
        const latitude = Number(f[2]);
        const longitude = Number(f[3]);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
            continue;
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
/*
 * Arama katmanı büyük/küçük harf ve aksan katmanlarında eşitlenir:
 * sorgu 'istanbul' ile veri 'İstanbul' buluşmalı. Türkçe yer adları için
 * 'tr' locale'iyla küçültme yetmez ('I' -> 'ı'), ASCII adı zaten
 * katlanmış taşıyor — iki alanı da tarıyoruz.
 */
const fold = (s) => s.toLocaleLowerCase('en');
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
export function searchCities(cities, query, options = {}) {
    const q = fold(query.trim());
    if (!q)
        return [];
    const limit = options.limit ?? 10;
    const country = options.country ? fold(options.country) : undefined;
    const exact = [];
    const prefix = [];
    const wordPrefix = [];
    const substring = [];
    for (const city of cities) {
        if (country && fold(city.countryCode) !== country)
            continue;
        const name = fold(city.name);
        const ascii = fold(city.asciiName);
        if (name === q || ascii === q)
            exact.push(city);
        else if (name.startsWith(q) || ascii.startsWith(q))
            prefix.push(city);
        else if (name.split(' ').some((w) => w.startsWith(q))
            || ascii.split(' ').some((w) => w.startsWith(q)))
            wordPrefix.push(city);
        else if (name.includes(q) || ascii.includes(q))
            substring.push(city);
    }
    const byPopulation = (a, b) => b.population - a.population;
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
export function zoneOffsetHours(zone, utcMs) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = {};
    for (const part of formatter.formatToParts(new Date(utcMs))) {
        parts[part.type] = part.value;
    }
    // hour12:false bazı ICU sürümlerinde gece yarısı için "24" üretir.
    const hour = Number(parts.hour) % 24;
    const asIfUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
    return (asIfUtc - utcMs) / 3_600_000;
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
export function offsetForWallClock(zone, year, month, day, hour, minute = 0, second = 0) {
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
    const valid = [...candidates].filter((o) => zoneOffsetHours(zone, guess - o) * 3_600_000 === o);
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
export function formatOffsetHours(hours) {
    const sign = hours < 0 ? '-' : '+';
    const total = Math.round(Math.abs(hours) * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
//# sourceMappingURL=index.js.map