#!/usr/bin/env node
/**
 * Swiss Ephemeris as a Model Context Protocol server.
 *
 * A language model cannot compute an ephemeris. Asked for a chart it will
 * produce something well-shaped and wrong, because the arithmetic — a
 * multi-thousand-term series, ΔT, nutation, aberration — is not something
 * that can be reasoned out. This server hands the work to a WebAssembly build
 * of Swiss Ephemeris and returns finished text.
 *
 * Two principles shape the tool surface.
 *
 * **Coarse tools, not a mirror of the API.** One `natal_chart` call returns
 * positions, houses, aspects, dignities and lots together. A model given
 * twelve fine-grained tools would chain them, spend tokens, and — worse —
 * derive the parts that were not returned by itself.
 *
 * **Text, not floats.** Positions come back as `24°30'12" Taurus` with the
 * decimal alongside. Given only `54.5033` a model converts it itself and
 * rounds, while astrology software truncates; that difference alone produced
 * a phantom one-arcminute error on four of ten bodies in this project's own
 * demo.
 *
 * Licence note: this server links AGPL-3.0 code. Running it locally for
 * yourself carries no obligation. Exposing it as a hosted service does —
 * see the README.
 */
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Body, EclipseFlag, HOUSE_SYSTEM_NAMES, HouseSystem, RiseTransit, findAspectsBetween, firdariaAt, profection, findDeclinationAspects, outOfBounds, } from '@kuntay/swisseph';
/*
 * './cli.js' DEĞİL — cli.ts bu dosyayı dinamik import ile çağıran bin, ve
 * buradan oraya bir kenar daha koymak iki modülü kilitliyor. Gerekçe ve
 * ölçüm node-version.ts'in başında.
 */
import { assertSupportedNode } from './node-version.js';
import { ephemerisStatus, withEphemeris } from './session.js';
import { formatOffset, resolveTime } from './time.js';
import { formatAngle, formatCoordinate, formatDeclination, formatJulianDay, formatLongitude, pad, sections, } from './format.js';
import { ASPECT_ORDER_NOTE, ORB_SCHEMES, aspectPoints, computeChart, renderAspects, renderDignities, renderHouses, renderLots, renderPositions, renderSect, } from './chart.js';
/*
 * Sürüm package.json'dan OKUNUYOR, elle yazılmıyor.
 *
 * Sabit bir string burada sessizce bayatlıyor: 0.2.0 yayınlandıktan sonra
 * sunucu istemcilere hâlâ "swisseph 0.1.0" diye tanıtıyordu. MCP istemcisinin
 * sürümü gördüğü tek yer burası, dolayısıyla bir hata raporu yanlış sürümü
 * işaret eder ve yayının kendisi doğruyken kimse fark etmez. Ölçüldü —
 * initialize yanıtı 0.1.0 dönerken npx 0.2.0 paketini çalıştırıyordu.
 *
 * `dist/index.js` bir üst dizinde paketin package.json'ı var; npm her tarball'a
 * onu koyduğu için yayınlanmış halde de çözülüyor. createRequire kullanılıyor
 * çünkü paket ESM ve JSON import'u tsconfig tarafında ek ayar isterdi.
 */
const require = createRequire(import.meta.url);
const { version } = require('../package.json');
const server = new McpServer({
    name: 'swisseph',
    version,
});
// --- shared input shapes -------------------------------------------------
const dateField = () => z.string().describe('Calendar date as YYYY-MM-DD. Astronomical year numbering, so -0043 is ' +
    '44 BCE. Example: "1990-05-15".');
const timeField = () => z.string().describe('LOCAL clock time at the place, HH:MM or HH:MM:SS. Not UT — pass the time ' +
    'as it was read off a clock there.');
const timezoneField = () => z.string().describe('IANA zone name such as "Europe/Istanbul" — strongly preferred, because it ' +
    'gets historical daylight-saving right. A fixed offset ("+03:00") or "UTC" ' +
    'also works. Do NOT guess a fixed offset from memory for a historical date.');
const latitudeField = () => z.number().min(-90).max(90).describe('Geographic latitude in decimal degrees, north positive.');
const longitudeField = () => z.number().min(-180).max(180).describe('Geographic longitude in decimal degrees, EAST positive. Western ' +
    'longitudes are negative: New York is -74.0.');
const placeLabelField = () => z.string().optional().describe('Place name, used only for display.');
const houseSystemField = () => z.string().optional().describe('House system. Either the one-letter code — P=Placidus (default), K=Koch, ' +
    'W=whole sign, R=Regiomontanus, C=Campanus, A=equal, O=Porphyry, ' +
    'B=Alcabitius, M=Morinus, T=Polich/Page — or the full name ("Porphyry", ' +
    '"whole sign"). An unrecognised value is rejected, never silently ' +
    'substituted.');
/**
 * Ev sistemi girdisini koda çevirir; çeviremezse HATA verir.
 *
 * Buradaki tuzak sessiz ve pahalı. Swiss Ephemeris ev sistemini tek KARAKTER
 * olarak alıyor, yani "Porphyry" geçen bir çağrı 'P' okunup PLACIDUS
 * hesaplıyordu — üstelik başlığa "HOUSES — Porphyry" yazarak. Ankara için
 * ikinci ev ucu 3.5 derece kayıyor ve çıktının hiçbir yerinde yanlış olduğuna
 * dair iz yok. Bir model tam olarak "Porphyry" yazmaya eğilimli, çünkü
 * kullanıcı öyle söylüyor.
 *
 * O yüzden: kodu da adı da kabul ediyoruz, tanımadığımızı reddediyoruz.
 */
function resolveHouseSystem(input) {
    if (input === undefined)
        return HouseSystem.Placidus;
    const raw = input.trim();
    if (raw.length === 0)
        return HouseSystem.Placidus;
    // Tek karakter: 'i' ile 'I' AYRI sistemler, o yüzden önce birebir bakıyoruz.
    if (raw.length === 1) {
        if (raw in HOUSE_SYSTEM_NAMES)
            return raw;
        const upper = raw.toUpperCase();
        if (upper in HOUSE_SYSTEM_NAMES)
            return upper;
    }
    const normalise = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
    const wanted = normalise(raw);
    // Yaygın söyleyişler tablodaki adlarla birebir tutmuyor.
    const SPOKEN = {
        wholesign: 'W', wholesigns: 'W', wholesignhouses: 'W',
        equalhouse: 'A', equalhouses: 'A', equal: 'A',
        placidus: 'P', koch: 'K', porphyry: 'O', porphyrius: 'O',
        regiomontanus: 'R', campanus: 'C', alcabitius: 'B', morinus: 'M',
        topocentric: 'T', polichpage: 'T', meridian: 'X', vehlow: 'V',
    };
    if (wanted in SPOKEN)
        return SPOKEN[wanted];
    for (const [code, name] of Object.entries(HOUSE_SYSTEM_NAMES)) {
        if (normalise(name) === wanted)
            return code;
    }
    throw new Error(`house_system "${input}" was not recognised. Pass a one-letter code — ` +
        'P (Placidus), K (Koch), W (whole sign), R (Regiomontanus), C (Campanus), ' +
        'A (equal), O (Porphyry), B (Alcabitius), M (Morinus), T (Polich/Page) — ' +
        'or the full system name. It is rejected rather than substituted, because ' +
        'a wrong house system moves every cusp without looking wrong.');
}
const orbSchemeField = () => z.enum(['modern', 'traditional', 'tight']).optional()
    .describe('Which orb scheme to use. "modern" gives the orb to the aspect and is the ' +
    'usual software default. "traditional" gives each body half an orb and ' +
    'adds the two, so the luminaries get wide orbs. "tight" reports only ' +
    'close contacts. Default: modern.');
/** Header every answer carries, so the model can see what it actually got. */
function header(title, resolved, place, anyMoshier) {
    const placeLabel = place.label ? `${place.label} — ` : '';
    const zoneNote = resolved.source === 'iana'
        ? `${resolved.zone} (${resolved.offsetLabel})`
        : resolved.source === 'utc' ? 'UTC' : `fixed offset ${resolved.offsetLabel}`;
    const precision = ephemerisStatus.full && !anyMoshier
        ? ephemerisStatus.description
        : `${ephemerisStatus.description}${anyMoshier && ephemerisStatus.full
            ? ' — but some bodies fell back to Moshier' : ''}`;
    return [
        `${title}`,
        `Local: ${resolved.localLabel} ${zoneNote}  →  ${resolved.utcLabel}`,
        // Tekrarlanan DST saati: hangi ofsetin kullanıldığını ve ötekinin ne
        // olduğunu SÖYLE. Modülün "kullanılan değeri geri yaz" ilkesi tam olarak
        // bunu gerektiriyor — aksi hâlde model bir saatlik gerçek bir belirsizliği
        // kesinlik sanır. Bir saat UT, bu enlemlerde ~15° Yükselen demek.
        ...(resolved.ambiguous && resolved.alternativeOffsetHours !== undefined
            ? [`AMBIGUOUS TIME: this wall clock occurred twice in ${resolved.zone} ` +
                    '(daylight-saving fall-back). Computed with ' +
                    `${resolved.offsetLabel}; the other occurrence is ` +
                    `${formatOffset(resolved.alternativeOffsetHours)}, one hour ` +
                    'away in UT — about 15° of Ascendant. Pass that offset directly if ' +
                    'the birth record distinguishes them.']
            : []),
        `Julian day: ${resolved.julianDay.toFixed(6)}`,
        // Koordinat İKİ gösterimde birden: girdi ondalık derece, ama "40.18" yazan
        // biri çoğu zaman 40°18' demek istiyor. İkisi 12 yay-dakikası ayrı ve
        // ikisi de geçerli sayı olduğu için hangisinin kastedildiği tespit
        // EDİLEMEZ — o yüzden tahmin etmiyor, kullanılanı öbür gösterimde de
        // yazıyoruz. Yanlış yazılmış bir koordinat orada bakışta belli oluyor.
        `Place: ${placeLabel}${formatCoordinate(place.latitude, 'N', 'S')} ` +
            `${formatCoordinate(place.longitude, 'E', 'W')}`,
        `Ephemeris: ${precision}`,
    ].join('\n');
}
const text = (body) => ({ content: [{ type: 'text', text: body }] });
/**
 * Tutulma anındaki yükseklik satırı.
 *
 * İki tuzağı birden kapatıyor. Yüksekliği İŞARETLİ gösteriyoruz — işaretsiz
 * bir "0°21'" ufkun altında mı üstünde mi belli değil. Ve "görünür" ile
 * "en büyük evrede ufkun altında" birlikte gelebiliyor: Swiss Ephemeris
 * tutulmanın BİR KISMI görünüyorsa görünür diyor, cisim doruk anında batmış
 * olsa bile. Bunu açıklamazsak model çelişki sanır.
 */
function altitudeNote(body, altitude, visible) {
    const lines = [`Altitude of the ${body} at maximum: ${formatDeclination(altitude)}`];
    if (visible && altitude < 0) {
        lines.push(`  ↳ Below the horizon at maximum, yet part of the eclipse is visible ` +
            `from here — the ${body} rises or sets while the event is under way.`);
    }
    return lines;
}
// --- 1. natal chart ------------------------------------------------------
server.registerTool('natal_chart', {
    title: 'Natal chart',
    description: 'Complete chart for one moment and place: planetary positions with ' +
        'declinations, house cusps and angles, ASPECTS BETWEEN THE PLANETS, ' +
        'essential dignities, Arabic lots, and whether the chart is diurnal or ' +
        'nocturnal. Aspects are computed here — do not derive them from the ' +
        'longitudes yourself. Use this for any birth chart, event chart or ' +
        '"what does the sky look like at time X" question.',
    inputSchema: {
        date: dateField(),
        time: timeField(),
        timezone: timezoneField(),
        latitude: latitudeField(),
        longitude: longitudeField(),
        place: placeLabelField(),
        house_system: houseSystemField(),
        orb_scheme: orbSchemeField(),
    },
}, async ({ date, time, timezone, latitude, longitude, place, house_system, orb_scheme }) => withEphemeris((swe) => {
    const resolved = resolveTime({ date, time, timezone }, (y, mo, d, h) => swe.julianDay(y, mo, d, h));
    const location = { latitude, longitude, label: place };
    const chart = computeChart(swe, resolved.julianDay, location, resolveHouseSystem(house_system));
    return text(sections(header('NATAL CHART', resolved, location, chart.anyMoshier), renderSect(chart), renderPositions(chart), renderHouses(chart), renderAspects(aspectPoints(chart), orb_scheme ?? 'modern'), renderDignities(swe, chart), renderLots(chart)));
}));
// --- 2. transits ---------------------------------------------------------
server.registerTool('transits', {
    title: 'Transits to a natal chart',
    description: 'Aspects from the planets at one moment (the transit date) to the ' +
        'planets and angles of a natal chart. Returns the transiting positions ' +
        'and every cross-chart aspect, marked applying or separating. Use this ' +
        'for "what is transiting my chart now" and forecasting questions.',
    inputSchema: {
        natal_date: dateField(),
        natal_time: timeField(),
        natal_timezone: timezoneField(),
        latitude: latitudeField(),
        longitude: longitudeField(),
        place: placeLabelField(),
        transit_date: z.string().describe('Date to examine, YYYY-MM-DD.'),
        transit_time: z.string().optional()
            .describe('Time of day to examine, HH:MM. Defaults to 12:00.'),
        transit_timezone: z.string().optional()
            .describe('Zone for the transit time. Defaults to the natal zone.'),
        house_system: houseSystemField(),
        orb_scheme: orbSchemeField(),
    },
}, async (args) => withEphemeris((swe) => {
    const julday = (y, mo, d, h) => swe.julianDay(y, mo, d, h);
    const natalTime = resolveTime({
        date: args.natal_date, time: args.natal_time, timezone: args.natal_timezone,
    }, julday);
    const transitTime = resolveTime({
        date: args.transit_date,
        time: args.transit_time ?? '12:00',
        timezone: args.transit_timezone ?? args.natal_timezone,
    }, julday);
    const location = { latitude: args.latitude, longitude: args.longitude, label: args.place };
    const system = resolveHouseSystem(args.house_system);
    const natal = computeChart(swe, natalTime.julianDay, location, system);
    const transiting = computeChart(swe, transitTime.julianDay, location, system);
    /*
     * Natal tarafa speed: 0 veriyoruz, undefined DEĞİL.
     *
     * Fark kritik: core'daki applyingState iki taraftan biri hızsızsa hiç
     * hesaplamıyor, `{}` dönüyor. undefined bıraktığımızda geçişlerin
     * TAMAMI işaretsiz kalıyordu — oysa aracın açıklaması "applying ya da
     * separating olarak işaretlenmiş" diye söz veriyor ve geçiş yorumunun
     * bütün değeri o ayrımda.
     *
     * 0 aynı zamanda fiziksel olarak doğru: natal harita donmuş bir andır,
     * natal gezegen hareket etmez. Böylece yalnızca geçen cisim ileri
     * itiliyor, ki standart uygulanan/ayrılan tanımı da budur.
     */
    const scheme = ORB_SCHEMES[args.orb_scheme ?? 'modern'];
    const crossings = findAspectsBetween(aspectPoints(transiting, false).map((p) => ({ ...p, name: `t.${p.name}` })), aspectPoints(natal, true).map((p) => ({ ...p, name: `n.${p.name}`, speed: 0 })), { orbs: scheme });
    const lines = [`TRANSIT ASPECTS (orb scheme: ${scheme.name})`];
    if (crossings.length === 0)
        lines.push('No transiting aspects within orb.');
    else
        lines.push(ASPECT_ORDER_NOTE);
    for (const a of crossings) {
        const motion = a.applying === undefined ? '' : a.applying ? '  applying' : '  separating';
        lines.push(`${pad(a.from.name, 14)} ${pad(a.aspect.name, 13)} ${pad(a.to.name, 14)}` +
            ` orb ${pad(formatAngle(a.orb), 8)}${motion}`);
    }
    return text(sections(header('TRANSITS', transitTime, location, transiting.anyMoshier), `Natal: ${natalTime.localLabel} ${natalTime.offsetLabel} → ${natalTime.utcLabel}`, renderPositions(transiting), lines.join('\n')));
}));
// --- 3. synastry ---------------------------------------------------------
server.registerTool('synastry', {
    title: 'Synastry between two charts',
    description: 'Aspects between the planets and angles of two different birth charts. ' +
        'Only cross-chart pairs are reported, never aspects within one chart. ' +
        'Use this for relationship comparisons.',
    inputSchema: {
        a_date: dateField(), a_time: timeField(), a_timezone: timezoneField(),
        a_latitude: latitudeField(), a_longitude: longitudeField(),
        a_place: placeLabelField(),
        b_date: dateField(), b_time: timeField(), b_timezone: timezoneField(),
        b_latitude: latitudeField(), b_longitude: longitudeField(),
        b_place: placeLabelField(),
        house_system: houseSystemField(),
        orb_scheme: orbSchemeField(),
    },
}, async (args) => withEphemeris((swe) => {
    const julday = (y, mo, d, h) => swe.julianDay(y, mo, d, h);
    const system = resolveHouseSystem(args.house_system);
    const timeA = resolveTime({ date: args.a_date, time: args.a_time, timezone: args.a_timezone }, julday);
    const timeB = resolveTime({ date: args.b_date, time: args.b_time, timezone: args.b_timezone }, julday);
    const placeA = { latitude: args.a_latitude, longitude: args.a_longitude, label: args.a_place };
    const placeB = { latitude: args.b_latitude, longitude: args.b_longitude, label: args.b_place };
    const chartA = computeChart(swe, timeA.julianDay, placeA, system);
    const chartB = computeChart(swe, timeB.julianDay, placeB, system);
    /*
     * Burada speed: undefined DOĞRU — geçişlerin aksine.
     *
     * Geçişte bir taraf yürüyor, diğeri donmuş; "uygulanan" anlamlı. Sinastride
     * iki taraf da donmuş iki ayrı an. İkisine de hız versek, aslında ikisi de
     * hareket etmediği hâlde bir yaklaşma yönü uydurmuş olurduk. Hız yoksa
     * applying tanımsız kalıyor ve satırda hiçbir şey yazmıyor, ki doğrusu bu.
     */
    const scheme = ORB_SCHEMES[args.orb_scheme ?? 'modern'];
    const crossings = findAspectsBetween(aspectPoints(chartA, true).map((p) => ({ ...p, name: `A.${p.name}`, speed: undefined })), aspectPoints(chartB, true).map((p) => ({ ...p, name: `B.${p.name}`, speed: undefined })), { orbs: scheme });
    const lines = [`SYNASTRY ASPECTS (orb scheme: ${scheme.name})`];
    if (crossings.length === 0)
        lines.push('No cross-chart aspects within orb.');
    else
        lines.push(ASPECT_ORDER_NOTE);
    for (const a of crossings) {
        lines.push(`${pad(a.from.name, 14)} ${pad(a.aspect.name, 13)} ${pad(a.to.name, 14)}` +
            ` orb ${formatAngle(a.orb)}`);
    }
    return text(sections('SYNASTRY', `A: ${args.a_place ?? ''} ${timeA.localLabel} ${timeA.offsetLabel} → ${timeA.utcLabel}`, `B: ${args.b_place ?? ''} ${timeB.localLabel} ${timeB.offsetLabel} → ${timeB.utcLabel}`, `Ephemeris: ${ephemerisStatus.description}`, 'CHART A', renderPositions(chartA), 'CHART B', renderPositions(chartB), lines.join('\n')));
}));
// --- 4. returns ----------------------------------------------------------
server.registerTool('return_chart', {
    title: 'Solar or lunar return',
    description: 'Finds when the Sun or Moon comes back to its natal longitude, and casts ' +
        'the full chart for that moment. A solar return recurs yearly near the ' +
        'birthday, a lunar return about every 27.3 days. Set ' +
        'precession_corrected when the tradition calls for the sidereal return; ' +
        'the two differ by roughly a day after thirty years.',
    /*
     * natal_latitude / natal_longitude BİLEREK yok.
     *
     * Şemada zorunlu duruyorlardı ve hiçbir yerde okunmuyorlardı: iki çağrı,
     * yalnızca bu ikisi 0/0 ile -80/179 farkıyla, bayt bayt aynı sonucu
     * veriyordu. Dönüş ANI, Güneş'in geosentrik boylamının natal boylamına
     * dönmesidir — gözlemcinin yerinden bağımsızdır. Modelden istemek hem
     * token yakıyor hem de sonucu etkilediği izlenimi veriyordu. Haritanın
     * kurulduğu yer aşağıdaki latitude/longitude; ilgili olan tek yer orası.
     */
    inputSchema: {
        natal_date: dateField(), natal_time: timeField(), natal_timezone: timezoneField(),
        kind: z.enum(['solar', 'lunar']).describe('Which return to find.'),
        after_date: z.string().describe('Search forward from this date, YYYY-MM-DD. For "my solar return in ' +
            '2026" pass 2026-01-01.'),
        latitude: latitudeField().describe('Latitude to cast the return chart for — the RELOCATED place if the ' +
            'person is elsewhere, otherwise the birth place.'),
        longitude: longitudeField(),
        place: placeLabelField(),
        precession_corrected: z.boolean().optional()
            .describe('Return to the same sidereal longitude instead. Default false.'),
        house_system: houseSystemField(),
        orb_scheme: orbSchemeField(),
    },
}, async (args) => withEphemeris((swe) => {
    const julday = (y, mo, d, h) => swe.julianDay(y, mo, d, h);
    const natalTime = resolveTime({
        date: args.natal_date, time: args.natal_time, timezone: args.natal_timezone,
    }, julday);
    const after = resolveTime({
        date: args.after_date, time: '00:00', timezone: 'UTC',
    }, julday);
    const options = {
        after: after.julianDay,
        precessionCorrected: args.precession_corrected ?? false,
    };
    const result = args.kind === 'solar'
        ? swe.solarReturn(natalTime.julianDay, options)
        : swe.lunarReturn(natalTime.julianDay, options);
    const location = { latitude: args.latitude, longitude: args.longitude, label: args.place };
    const chart = computeChart(swe, result.jd, location, resolveHouseSystem(args.house_system));
    const correction = result.precessionCorrected
        ? `\nPrecession correction applied: the target longitude is ` +
            `${result.targetLongitude.toFixed(4)}° rather than the natal ` +
            `${result.natalLongitude.toFixed(4)}° ` +
            `(difference ${formatAngle(result.targetLongitude - result.natalLongitude)}).`
        : '';
    return text(sections(`${args.kind === 'solar' ? 'SOLAR' : 'LUNAR'} RETURN\n` +
        `Moment of return: ${formatJulianDay(result.jd, (jd) => swe.calendarDate(jd))}\n` +
        `Julian day: ${result.jd.toFixed(6)}\n` +
        `Natal ${args.kind === 'solar' ? 'Sun' : 'Moon'}: ${formatLongitude(result.natalLongitude)}` +
        correction + `\nEphemeris: ${ephemerisStatus.description}`, renderSect(chart), renderPositions(chart), renderHouses(chart), renderAspects(aspectPoints(chart), args.orb_scheme ?? 'modern')));
}));
// --- 5. eclipses ---------------------------------------------------------
const ECLIPSE_TYPES = {
    any: 0,
    total: EclipseFlag.Total,
    annular: EclipseFlag.Annular,
    partial: EclipseFlag.Partial,
    penumbral: EclipseFlag.Penumbral,
};
server.registerTool('eclipses', {
    title: 'Find eclipses',
    description: 'The next solar or lunar eclipse after a date, with its phase timings ' +
        'and zodiacal position. Give a latitude and longitude to search for the ' +
        'next one VISIBLE from there instead, which also returns magnitude and ' +
        'the body\'s altitude. Local searches accept no type filter.',
    inputSchema: {
        kind: z.enum(['solar', 'lunar']).describe('Which luminary is eclipsed.'),
        after_date: z.string().describe('Search forward from this date, YYYY-MM-DD.'),
        type: z.enum(['any', 'total', 'annular', 'partial', 'penumbral']).optional()
            .describe('Restrict to one kind. Only valid for a global search — omit it when ' +
            'passing latitude/longitude. "annular" is solar only, "penumbral" lunar only.'),
        latitude: latitudeField().optional()
            .describe('Optional: search for an eclipse visible from this latitude.'),
        longitude: longitudeField().optional(),
        place: placeLabelField(),
        backward: z.boolean().optional()
            .describe('Search backwards in time instead. Default false.'),
    },
}, async (args) => withEphemeris((swe) => {
    const julday = (y, mo, d, h) => swe.julianDay(y, mo, d, h);
    const start = resolveTime({ date: args.after_date, time: '00:00', timezone: 'UTC' }, julday);
    /*
     * Enlem verilip boylam verilmemesi SESSİZCE küresel aramaya düşüyordu.
     * "İstanbul'dan görünen bir sonraki tutulma" sorusu, yalnızca Antarktika'dan
     * görünen bir tutulmayla cevaplanıyor ve çıktıda konumun düştüğüne dair tek
     * satır yok. Yarım koordinat, koordinat değildir.
     */
    if ((args.latitude === undefined) !== (args.longitude === undefined)) {
        throw new Error('A local eclipse search needs BOTH latitude and longitude. Only ' +
            `${args.latitude === undefined ? 'longitude' : 'latitude'} was given, ` +
            'and half a coordinate would silently become a global search — a ' +
            'different eclipse entirely. Pass both, or neither.');
    }
    const local = args.latitude !== undefined && args.longitude !== undefined;
    if (local && args.type && args.type !== 'any') {
        throw new Error('A local eclipse search accepts no type filter: Swiss Ephemeris has no ' +
            'query for "the next TOTAL eclipse visible from here". Either drop the ' +
            'location, or drop the type and read the kind off the result.');
    }
    const when = (jd) => formatJulianDay(jd, (j) => swe.calendarDate(j));
    const options = local
        ? { place: { latitude: args.latitude, longitude: args.longitude },
            backward: args.backward ?? false }
        : { type: ECLIPSE_TYPES[args.type ?? 'any'] || undefined,
            backward: args.backward ?? false };
    const lines = [];
    if (args.kind === 'solar') {
        const eclipse = swe.solarEclipse(start.julianDay, options);
        const sun = swe.calc(eclipse.timings.maximum, Body.Sun);
        lines.push(`SOLAR ECLIPSE — ${eclipse.kind}${eclipse.central ? ', central' : ''}`);
        lines.push(`Maximum: ${when(eclipse.timings.maximum)}`);
        lines.push(`Zodiacal position:  ${formatLongitude(sun.longitude)}`);
        if (eclipse.timings.partialBegin)
            lines.push(`Partial phase begins: ${when(eclipse.timings.partialBegin)}`);
        if (eclipse.timings.totalityBegin)
            lines.push(`Totality begins: ${when(eclipse.timings.totalityBegin)}`);
        if (eclipse.timings.totalityEnd)
            lines.push(`Totality ends: ${when(eclipse.timings.totalityEnd)}`);
        if (eclipse.timings.partialEnd)
            lines.push(`Partial phase ends: ${when(eclipse.timings.partialEnd)}`);
        if (eclipse.timings.sunrise)
            lines.push(`Sunrise during the eclipse: ${when(eclipse.timings.sunrise)}`);
        if (eclipse.timings.sunset)
            lines.push(`Sunset during the eclipse: ${when(eclipse.timings.sunset)}`);
        if (eclipse.local) {
            lines.push('', `From ${args.place ?? 'the given place'} ` +
                `(${Math.abs(args.latitude).toFixed(4)}°${args.latitude >= 0 ? 'N' : 'S'} ` +
                `${Math.abs(args.longitude).toFixed(4)}°${args.longitude >= 0 ? 'E' : 'W'}): ` +
                `${eclipse.local.visible ? 'VISIBLE' : 'not visible'}`);
            lines.push(`Magnitude: ${eclipse.local.magnitude.toFixed(3)}`);
            lines.push(`Obscuration of the disc: ${(eclipse.local.obscuration * 100).toFixed(1)}%`);
            lines.push(...altitudeNote('Sun', eclipse.local.altitude, eclipse.local.visible));
            lines.push(`Saros ${eclipse.local.saros}, member ${eclipse.local.sarosMember}`);
        }
    }
    else {
        const eclipse = swe.lunarEclipse(start.julianDay, options);
        const moon = swe.calc(eclipse.timings.maximum, Body.Moon);
        lines.push(`LUNAR ECLIPSE — ${eclipse.kind}`);
        lines.push(`Maximum: ${when(eclipse.timings.maximum)}`);
        lines.push(`Zodiacal position:  ${formatLongitude(moon.longitude)}`);
        if (eclipse.timings.penumbralBegin)
            lines.push(`Penumbral phase begins: ${when(eclipse.timings.penumbralBegin)}`);
        if (eclipse.timings.partialBegin)
            lines.push(`Partial phase begins: ${when(eclipse.timings.partialBegin)}`);
        if (eclipse.timings.totalityBegin)
            lines.push(`Totality begins: ${when(eclipse.timings.totalityBegin)}`);
        if (eclipse.timings.totalityEnd)
            lines.push(`Totality ends: ${when(eclipse.timings.totalityEnd)}`);
        if (eclipse.timings.partialEnd)
            lines.push(`Partial phase ends: ${when(eclipse.timings.partialEnd)}`);
        if (eclipse.timings.penumbralEnd)
            lines.push(`Penumbral phase ends: ${when(eclipse.timings.penumbralEnd)}`);
        if (eclipse.timings.moonrise)
            lines.push(`Moonrise during the eclipse: ${when(eclipse.timings.moonrise)}`);
        if (eclipse.timings.moonset)
            lines.push(`Moonset during the eclipse: ${when(eclipse.timings.moonset)}`);
        if (eclipse.local) {
            lines.push('', `From ${args.place ?? 'the given place'} ` +
                `(${Math.abs(args.latitude).toFixed(4)}°${args.latitude >= 0 ? 'N' : 'S'} ` +
                `${Math.abs(args.longitude).toFixed(4)}°${args.longitude >= 0 ? 'E' : 'W'}): ` +
                `${eclipse.local.visible ? 'VISIBLE' : 'not visible'}`);
            lines.push(`Umbral magnitude: ${eclipse.local.magnitude.toFixed(3)}`);
            lines.push(`Penumbral magnitude: ${eclipse.local.penumbralMagnitude.toFixed(3)}`);
            lines.push(...altitudeNote('Moon', eclipse.local.altitude, eclipse.local.visible));
            lines.push(`Saros ${eclipse.local.saros}, member ${eclipse.local.sarosMember}`);
        }
    }
    return text(sections(lines.join('\n'), `Ephemeris: ${ephemerisStatus.description}`));
}));
// --- 6. rise and set -----------------------------------------------------
const RISE_BODIES = {
    sun: Body.Sun, moon: Body.Moon, mercury: Body.Mercury, venus: Body.Venus,
    mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn,
};
/**
 * Kaldeli sıra: geleneğin "yavaştan hızlıya" dizdiği yedi gezegen.
 * Gezegen saatleri bu diziyi döngüsel olarak takip eder.
 */
const CHALDEAN = [
    Body.Saturn, Body.Jupiter, Body.Mars, Body.Sun, Body.Venus, Body.Mercury, Body.Moon,
];
/** Haftanın gününün yöneticisi, Pazar = 0. */
const DAY_RULERS = [
    Body.Sun, Body.Moon, Body.Mars, Body.Mercury, Body.Jupiter, Body.Venus, Body.Saturn,
];
/**
 * Gezegen saatleri.
 *
 * Aracın açıklaması bunu zaten vaat ediyordu ama çıktı hiç üretmiyordu; vaadi
 * silmek yerine hesaplıyoruz.
 *
 * İki nüans var ve ikisi de sessizce yanlış sonuç verebilecek cinsten.
 *
 * **Saatler eşit değil.** Gündüz doğuştan batışa on iki eşit parçaya, gece
 * batıştan ertesi doğuşa on iki eşit parçaya bölünür. Ankara'da Mayıs'ta bir
 * gündüz saati 72 dakika, gece saati 48 dakika sürer. Saat 60 dakika sanan
 * bir hesap yaz ortasında iki saat birden kayar.
 *
 * **Gezegen günü gece yarısında değil, DOĞUŞTA başlar.** Gece 02:00'deki bir
 * saat, takvimin gösterdiği güne değil, bir önceki doğuşla başlayan güne
 * aittir. Gün yöneticisini doğuş anının yerel gününden alıyoruz.
 */
function planetaryHours(swe, sunriseJd, sunsetJd, place, offsetHours) {
    const nextRise = swe.riseTransit(sunsetJd, Body.Sun, place, RiseTransit.Rise);
    if (!nextRise.occurs || nextRise.jd === null) {
        return ['PLANETARY HOURS', 'The Sun does not rise again within the search ' +
                'window, so the night hours are undefined.'];
    }
    const dayHour = (sunsetJd - sunriseJd) / 12;
    const nightHour = (nextRise.jd - sunsetJd) / 12;
    // Jülyen gününden haftanın günü: JD 0 bir Pazartesi, +1.5 kayması Pazar'ı 0 yapıyor.
    const weekday = ((Math.floor(sunriseJd + offsetHours / 24 + 1.5) % 7) + 7) % 7;
    const dayRuler = DAY_RULERS[weekday];
    const startIndex = CHALDEAN.indexOf(dayRuler);
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
        'Friday', 'Saturday'];
    const clock = (jd) => {
        const d = swe.calendarDate(jd + offsetHours / 24);
        const total = Math.round(d.hour * 60);
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:` +
            `${String(total % 60).padStart(2, '0')}`;
    };
    const minutes = (days) => `${Math.round(days * 24 * 60)} min`;
    const sequence = (from, length, offset) => Array.from({ length: 12 }, (_, i) => {
        const ruler = CHALDEAN[(startIndex + offset + i) % 7];
        return `${i + 1} ${swe.planetName(ruler)} ${clock(from + i * length)}`;
    }).join(' · ');
    return [
        `PLANETARY HOURS — ${WEEKDAYS[weekday]}, ruler of the day ` +
            `${swe.planetName(dayRuler)}`,
        'The hours are unequal: sunrise to sunset makes twelve day hours, sunset ' +
            'to the next sunrise twelve night hours. The planetary day begins at ' +
            'SUNRISE, not midnight — an hour at 02:00 belongs to the day that started ' +
            'at the previous sunrise.',
        `Day hours   (each ${minutes(dayHour)}): ${sequence(sunriseJd, dayHour, 0)}`,
        `Night hours (each ${minutes(nightHour)}, past midnight): ` +
            `${sequence(sunsetJd, nightHour, 12)}`,
    ];
}
server.registerTool('rise_set', {
    title: 'Rise, set and culmination times',
    description: 'When a body rises, culminates, sets and anticulminates at a place on a ' +
        'given day. Near the poles a body may do none of these; that is reported ' +
        'plainly rather than treated as an error. Also gives the planetary hour ' +
        'rulers derived from sunrise and sunset.',
    inputSchema: {
        date: z.string().describe('Date to examine, YYYY-MM-DD.'),
        timezone: timezoneField(),
        latitude: latitudeField(),
        longitude: longitudeField(),
        place: placeLabelField(),
        bodies: z.array(z.enum(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']))
            .optional()
            .describe('Which bodies. Defaults to the Sun and Moon.'),
    },
}, async (args) => withEphemeris((swe) => {
    const julday = (y, mo, d, h) => swe.julianDay(y, mo, d, h);
    const start = resolveTime({ date: args.date, time: '00:00', timezone: args.timezone }, julday);
    const place = { latitude: args.latitude, longitude: args.longitude };
    const wanted = args.bodies ?? ['sun', 'moon'];
    /*
     * Olayın YEREL TARİHİNİ de yazıyoruz, çıplak saati değil.
     *
     * riseTransit verilen andan İLERİ doğru arıyor. Ay her gün ~50 dakika geç
     * doğduğu için bazı günler hiç doğmuyor: 14 Mayıs 1990 Ankara'da Ay
     * doğmuyor, bir sonraki doğuş 15 Mayıs 00:12. Çıplak "00:12" yazınca 14
     * Mayıs istendiğinde de 15 Mayıs istendiğinde de aynı satır çıkıyordu ve
     * ikisi de o güne aitmiş gibi okunuyordu. Tarih farklıysa görünsün.
     */
    const requested = /^(-?\d{1,6})-(\d{1,2})-(\d{1,2})$/.exec(args.date.trim());
    const requestedDate = requested
        ? `${requested[1]}-${requested[2].padStart(2, '0')}-${requested[3].padStart(2, '0')}`
        : args.date.trim();
    const localClock = (jd) => {
        // Jülyen gününü yerel saate çeviriyoruz: kullanıcı doğuşu yerel saatle
        // istiyor, UT ile değil.
        const d = swe.calendarDate(jd + start.offsetHours / 24);
        const totalMinutes = Math.round(d.hour * 60);
        const clock = `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:` +
            `${String(totalMinutes % 60).padStart(2, '0')}`;
        const two = (n) => String(n).padStart(2, '0');
        const eventDate = `${d.year}-${two(d.month)}-${two(d.day)}`;
        return eventDate === requestedDate
            ? `${clock} local`
            : `${clock} local on ${eventDate}`;
    };
    const lines = ['RISE / SET / CULMINATION'];
    for (const key of wanted) {
        const body = RISE_BODIES[key];
        const name = swe.planetName(body);
        const events = [
            ['rise', RiseTransit.Rise],
            ['upper culmination', RiseTransit.UpperCulmination],
            ['set', RiseTransit.Set],
            ['lower culmination', RiseTransit.LowerCulmination],
        ];
        const parts = [];
        for (const [label, event] of events) {
            const r = swe.riseTransit(start.julianDay, body, place, event);
            parts.push(r.occurs && r.jd !== null
                ? `${label} ${localClock(r.jd)}`
                : `${label} NONE`);
        }
        lines.push(`${pad(name, 10)} ${parts.join('  ·  ')}`);
    }
    const sunrise = swe.riseTransit(start.julianDay, Body.Sun, place, RiseTransit.Rise);
    const sunset = swe.riseTransit(start.julianDay, Body.Sun, place, RiseTransit.Set);
    if (!sunrise.occurs || !sunset.occurs) {
        lines.push('', 'At this latitude on this date the Sun does not cross the ' +
            'horizon (polar day or night); the planetary hours are undefined.');
    }
    else {
        lines.push('', ...planetaryHours(swe, sunrise.jd, sunset.jd, place, start.offsetHours));
    }
    return text(sections(header('RISE AND SET', start, { ...place, label: args.place }, false), lines.join('\n')));
}));
// --- 7. time lords -------------------------------------------------------
server.registerTool('time_lords', {
    title: 'Profection and firdaria',
    description: 'Traditional timing for a date: the annual, monthly and daily profection ' +
        'from the natal Ascendant with their ruling planets, and the Persian ' +
        'firdaria major and minor lords. Pure arithmetic over the birth chart. ' +
        'Use this for "what is my profected year" and traditional forecasting.',
    inputSchema: {
        natal_date: dateField(), natal_time: timeField(), natal_timezone: timezoneField(),
        latitude: latitudeField(), longitude: longitudeField(),
        place: placeLabelField(),
        target_date: z.string().describe('The date to evaluate, YYYY-MM-DD.'),
        house_system: houseSystemField(),
        year_length: z.enum(['tropical', 'julian', 'egyptian']).optional()
            .describe('Days per year. "tropical" (365.2422) is the default and what modern ' +
            'software uses; "egyptian" (365) and "julian" (365.25) appear in the ' +
            'traditional sources. Over a 75-year firdaria cycle tropical and ' +
            'Egyptian drift 18 days apart.'),
    },
}, async (args) => withEphemeris((swe) => {
    const julday = (y, mo, d, h) => swe.julianDay(y, mo, d, h);
    const natalTime = resolveTime({
        date: args.natal_date, time: args.natal_time, timezone: args.natal_timezone,
    }, julday);
    const target = resolveTime({
        date: args.target_date, time: '12:00', timezone: args.natal_timezone,
    }, julday);
    const location = { latitude: args.latitude, longitude: args.longitude, label: args.place };
    const chart = computeChart(swe, natalTime.julianDay, location, resolveHouseSystem(args.house_system));
    const yearLength = args.year_length === 'egyptian' ? 365
        : args.year_length === 'julian' ? 365.25 : undefined;
    const options = yearLength ? { yearLength } : {};
    const p = profection(natalTime.julianDay, target.julianDay, chart.houses.ascendant, options);
    const lords = firdariaAt(natalTime.julianDay, chart.sect.sect, target.julianDay, options);
    const lines = [
        'PROFECTION',
        `Age: ${p.age} (completed years)`,
        // Hem sıra numarası hem MUTLAK ev yazılıyor. İkisi farklı şeyler ve
        // geleneksel pratikte alıntılanan değer ev; yalnızca sırayı göstermek
        // modelin onu ev sanmasına açık kapı bırakıyordu.
        `Annual:  house ${p.house}, ${p.sign} — lord of the year ${swe.planetName(p.lord)}`,
        `Monthly: month ${p.month.index} of 12, ${p.month.sign} — natal house ` +
            `${p.month.house}, lord ${swe.planetName(p.month.lord)}`,
        `Daily:   day ${p.day.index} of 12, ${p.day.sign} — natal house ` +
            `${p.day.house}, lord ${swe.planetName(p.day.lord)}`,
        '',
        'FIRDARIA',
    ];
    if (!lords) {
        lines.push('The target date falls outside the computed periods.');
    }
    else {
        lines.push(`Sect: ${chart.sect.sect === 'day' ? 'diurnal sequence' : 'nocturnal sequence'}`);
        lines.push(`Major period: ${lords.major.lord} (${lords.major.years} years)`);
        lines.push(`Sub-period:   ${lords.minor ? lords.minor.lord
            : 'none — the nodal periods have no sub-periods'}`);
        lines.push(`Elapsed since birth: ${lords.ageYears.toFixed(2)} years`);
    }
    return text(sections(`TIME LORDS for ${args.target_date}`, `Natal: ${natalTime.localLabel} ${natalTime.offsetLabel} → ${natalTime.utcLabel}`, `Natal Ascendant: ${formatLongitude(chart.houses.ascendant)}`, lines.join('\n')));
}));
// --- 8. declinations -----------------------------------------------------
server.registerTool('declinations', {
    title: 'Declinations, parallels and out-of-bounds',
    description: 'The declination of each body at a moment, the parallels and ' +
        'contraparallels between them, and which bodies are out of bounds — ' +
        'past the obliquity of the ecliptic, which the Moon, Mercury, Venus, ' +
        'Mars and Pluto can manage. This is the half of a position that zodiacal ' +
        'longitude does not show; two bodies 90° apart in the zodiac can sit on ' +
        'the same declination.',
    inputSchema: {
        date: dateField(), time: timeField(), timezone: timezoneField(),
        orb: z.number().min(0).max(5).optional()
            .describe('Allowed orb in degrees for parallels. Default 1.'),
    },
}, async (args) => withEphemeris((swe) => {
    const julday = (y, mo, d, h) => swe.julianDay(y, mo, d, h);
    const resolved = resolveTime({ date: args.date, time: args.time, timezone: args.timezone }, julday);
    const bodies = [
        Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars,
        Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune, Body.Pluto,
    ];
    const points = swe.declinations(resolved.julianDay, bodies);
    const obliquity = swe.obliquity(resolved.julianDay).trueObliquity;
    const declinationLines = ['DECLINATIONS'];
    for (const p of points) {
        declinationLines.push(`${pad(p.name, 10)} ${formatDeclination(p.declination)}` +
            `  (${p.declination.toFixed(4)}°)  ${p.speed >= 0 ? '+' : ''}${p.speed.toFixed(4)}°/day`);
    }
    const ties = findDeclinationAspects(points, { orb: args.orb ?? 1 });
    const tieLines = [`PARALLELS (orb ${args.orb ?? 1}°)`];
    if (ties.length === 0)
        tieLines.push('No parallels or contraparallels within orb.');
    for (const t of ties) {
        tieLines.push(`${pad(t.from.name, 10)} ${pad(t.kind === 'parallel' ? 'parallel' : 'contraparallel', 15)}` +
            `${pad(t.to.name, 10)} orb ${formatAngle(t.orb)}` +
            (t.applying === undefined ? '' : t.applying ? '  applying' : '  separating'));
    }
    const oob = outOfBounds(points, obliquity).filter((r) => r.outOfBounds);
    const oobLines = ['OUT OF BOUNDS'];
    if (oob.length === 0) {
        oobLines.push(`No body is out of bounds (obliquity ${obliquity.toFixed(4)}°).`);
    }
    else {
        for (const r of oob) {
            oobLines.push(`${pad(r.name, 10)} ${formatDeclination(r.declination)} — past the limit ` +
                `by ${formatAngle(r.excess)} (${r.hemisphere})`);
        }
    }
    return text(sections(`DECLINATIONS\n${resolved.localLabel} ${resolved.offsetLabel} → ${resolved.utcLabel}` +
        `\nObliquity (of the date): ${obliquity.toFixed(6)}°\nEphemeris: ${ephemerisStatus.description}`, declinationLines.join('\n'), tieLines.join('\n'), oobLines.join('\n')));
}));
// --- start ---------------------------------------------------------------
/*
 * Sürüm kapısı burada da duruyor, cli.ts'de olmasına rağmen. Bu dosya paketin
 * `main`i ve `npm run mcp` doğrudan onu çalıştırıyor; kapı yalnızca bin'de
 * olsaydı en olası eski-Node yolu onu atlardı.
 */
assertSupportedNode();
/*
 * stdout MCP protokolünün kendisi. Oraya yazılan her şey akışı bozar, o
 * yüzden tanılama çıktısı stderr'e gidiyor.
 */
process.stderr.write(`swisseph MCP server ready — ephemeris: ${ephemerisStatus.description}\n`);
await server.connect(new StdioServerTransport());
//# sourceMappingURL=index.js.map