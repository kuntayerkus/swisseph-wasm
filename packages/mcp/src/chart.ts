/**
 * Chart computation and rendering.
 *
 * Everything a model needs about one moment and place, gathered in a single
 * pass and rendered as aligned text. The shape of this output is the whole
 * point of the server: a model given ten separate tools would call them in
 * sequence, burn tokens, and derive the interesting parts — aspects above
 * all — by itself, badly. Handing it the finished analysis removes the
 * opportunity.
 */

import {
  Body, HOUSE_SYSTEM_ALIASES, HOUSE_SYSTEM_NAMES, HouseSystem,
  evaluateDignities, findAspects,
  MODERN_ORBS, TIGHT_ORBS, TRADITIONAL_MOIETIES,
  type AspectPoint, type OrbScheme, type SwissEph,
} from '@kuntay/swisseph';
import { formatAngle, formatDeclination, formatLongitude, pad } from './format.js';

/** The bodies a chart reports, in traditional then modern order. */
const CHART_BODIES: readonly number[] = [
  Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars,
  Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune, Body.Pluto,
  Body.NorthNodeTrue, Body.Chiron,
];

/** The classical seven — the only bodies the dignity tables cover. */
const DIGNITY_BODIES: readonly number[] = [
  Body.Sun, Body.Moon, Body.Mercury, Body.Venus,
  Body.Mars, Body.Jupiter, Body.Saturn,
];

export const ORB_SCHEMES: Record<string, OrbScheme> = {
  modern: MODERN_ORBS,
  traditional: TRADITIONAL_MOIETIES,
  tight: TIGHT_ORBS,
};

export interface ChartPlace {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface BodyPosition {
  name: string;
  body: number;
  longitude: number;
  speed: number;
  retrograde: boolean;
  declination: number;
  /** Set when the body needed a data file that is not present. */
  unavailable?: string;
}

export interface Chart {
  jd: number;
  place: ChartPlace;
  positions: BodyPosition[];
  houses: ReturnType<SwissEph['houses']>;
  sect: ReturnType<SwissEph['lots']>['sect'];
  lots: ReturnType<SwissEph['lots']>['lots'];
  houseSystem: string;
  /** True when at least one body fell back to Moshier. */
  anyMoshier: boolean;
}

export function computeChart(
  swe: SwissEph,
  jd: number,
  place: ChartPlace,
  houseSystem: string = HouseSystem.Placidus,
): Chart {
  const positions: BodyPosition[] = [];
  let anyMoshier = false;

  for (const body of CHART_BODIES) {
    /*
     * Gövde başına hata yakalıyoruz. Chiron seas_18.se1 istiyor ve
     * gezegenlerin aksine Moshier'e DÜŞMÜYOR — dosya yoksa hata veriyor.
     * Tek bir cisim yüzünden bütün haritayı kaybetmek doğru olmazdı.
     */
    try {
      const position = swe.calc(jd, body);
      const equatorial = swe.equatorial(jd, body);
      if (position.ephemeris === 'moshier') anyMoshier = true;
      positions.push({
        name: swe.planetName(body),
        body,
        longitude: position.longitude,
        speed: position.longitudeSpeed,
        retrograde: position.longitudeSpeed < 0,
        declination: equatorial.declination,
      });
    } catch (error) {
      positions.push({
        name: swe.planetName(body),
        body,
        longitude: NaN, speed: NaN, retrograde: false, declination: NaN,
        unavailable: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const houses = swe.houses(jd, place.latitude, place.longitude, houseSystem);
  const derived = swe.lots(jd, {
    latitude: place.latitude,
    longitude: place.longitude,
    houseSystem,
  });

  return {
    jd, place, positions, houses,
    sect: derived.sect,
    lots: derived.lots,
    houseSystem,
    anyMoshier,
  };
}

/** Chart bodies as aspect points, optionally with the angles included. */
export function aspectPoints(chart: Chart, includeAngles = true): AspectPoint[] {
  const points: AspectPoint[] = chart.positions
    .filter((p) => !p.unavailable)
    .map((p) => ({ name: p.name, longitude: p.longitude, body: p.body, speed: p.speed }));

  if (includeAngles) {
    // Açılara hız vermiyoruz: Yükselen ve MC günde bir tur atıyor ve o hızla
    // "uygulanan" hesaplamak anlamsız olurdu. Hız yoksa applying tanımsız
    // kalıyor, ki doğrusu bu.
    points.push({ name: 'Ascendant', longitude: chart.houses.ascendant });
    points.push({ name: 'Midheaven', longitude: chart.houses.midheaven });
  }
  return points;
}

// --- rendering -----------------------------------------------------------

const NAME_WIDTH = 12;

export function renderPositions(chart: Chart): string {
  const lines = ['POSITIONS'];
  for (const p of chart.positions) {
    if (p.unavailable) {
      lines.push(`${pad(p.name, NAME_WIDTH)} — could not be computed: ${p.unavailable}`);
      continue;
    }
    const retrograde = p.retrograde ? 'R' : ' ';
    lines.push(
      `${pad(p.name, NAME_WIDTH)}${retrograde} ${pad(formatLongitude(p.longitude), 20)}` +
      ` (${p.longitude.toFixed(4)}°)  ${p.speed >= 0 ? '+' : ''}${p.speed.toFixed(4)}°/day` +
      `  dec ${formatDeclination(p.declination)}`,
    );
  }
  return lines.join('\n');
}

export function renderHouses(chart: Chart): string {
  const { houses } = chart;

  // Kod harfi yerine adı: modelin okuduğu metinde "P" değil "Placidus".
  const canonical = HOUSE_SYSTEM_ALIASES[chart.houseSystem] ?? chart.houseSystem;
  const systemName = HOUSE_SYSTEM_NAMES[chart.houseSystem]
    ?? HOUSE_SYSTEM_NAMES[canonical] ?? chart.houseSystem;
  const lines = [`HOUSES — ${systemName} (${chart.houseSystem})`];

  if (houses.substituted) {
    lines.push(
      `⚠ The requested house system is undefined at this latitude; Swiss ` +
      `Ephemeris substituted another one. ${houses.warning ?? ''}`.trim());
  }

  lines.push(`${pad('Ascendant', NAME_WIDTH)} ${formatLongitude(houses.ascendant)}`);
  lines.push(`${pad('Midheaven', NAME_WIDTH)} ${formatLongitude(houses.midheaven)}`);
  lines.push(`${pad('Vertex', NAME_WIDTH)} ${formatLongitude(houses.vertex)}`);
  for (let i = 0; i < 12; i++) {
    lines.push(`${pad(`House ${i + 1}`, NAME_WIDTH)} ${formatLongitude(houses.cusps[i])}`);
  }
  return lines.join('\n');
}

/**
 * Sıralamayı açıkça yazmamız gerekiyor.
 *
 * `findAspects()` GÜCE göre sıralıyor: (1 - orb/izin) × açının ağırlığı.
 * Sextile'ın ağırlığı 0.7 olduğu için 1°33'lük bir sextile, 3°39'lük bir
 * kavuşumun ALTINA düşüyor. Bu çekirdeğin bilinçli tercihi ve doğru.
 *
 * Ama görünen sütun `orb`. Sıralamayı söylemezsek "bu haritadaki en sıkı
 * açılar" diye sorulan model listenin başını okur ve yanlış cevap verir —
 * kendi hatası değil, bizim metnimizin hatası olur.
 */
export const ASPECT_ORDER_NOTE =
  'Order: strongest first — strength = (1 − orb/allowed) × the aspect\'s ' +
  'weight. A sextile carries less weight, so a tight sextile can sit below a ' +
  'wider conjunction. For the TIGHTEST contact read the orb column, not the ' +
  'order.';

export function renderAspects(
  points: AspectPoint[],
  schemeName: string,
  heading = 'ASPECTS',
): string {
  const scheme = ORB_SCHEMES[schemeName] ?? MODERN_ORBS;
  const aspects = findAspects(points, { orbs: scheme });

  const lines = [`${heading} (orb scheme: ${scheme.name})`];
  if (aspects.length === 0) {
    lines.push('No aspects within this scheme\'s orbs.');
    return lines.join('\n');
  }
  lines.push(ASPECT_ORDER_NOTE);

  for (const a of aspects) {
    const motion = a.applying === undefined ? '' : a.applying ? '  applying' : '  separating';
    lines.push(
      `${pad(a.from.name, NAME_WIDTH)} ${pad(a.aspect.name, 13)} ` +
      `${pad(a.to.name, NAME_WIDTH)} orb ${pad(formatAngle(a.orb), 8)}` +
      `(allowed ${formatAngle(a.maxOrb)})${motion}`,
    );
  }
  return lines.join('\n');
}

export function renderDignities(swe: SwissEph, chart: Chart): string {
  const lines = ['DIGNITIES (essential)'];
  for (const position of chart.positions) {
    if (position.unavailable || !DIGNITY_BODIES.includes(position.body)) continue;

    const report = evaluateDignities(position.body, position.longitude, chart.sect.sect);
    const held = report.dignities.length
      ? report.dignities.join(', ')
      : 'peregrine (no dignity at all)';
    lines.push(
      `${pad(position.name, NAME_WIDTH)} ${pad(held, 34)} score ${report.score >= 0 ? '+' : ''}${report.score}` +
      `  · term ${swe.planetName(report.termRuler)}, face ${swe.planetName(report.faceRuler)}`,
    );
  }
  return lines.join('\n');
}

export function renderLots(chart: Chart): string {
  const lines = ['ARABIC LOTS'];
  for (const [name, lot] of Object.entries(chart.lots)) {
    const note = lot.sectDependent ? ` (${lot.sectUsed} formula)` : '';
    lines.push(`${pad(name, NAME_WIDTH)} ${formatLongitude(lot.longitude)}${note}`);
  }
  return lines.join('\n');
}

export function renderSect(chart: Chart): string {
  const { sect } = chart;
  const borderline = sect.borderline
    ? '  ⚠ BORDERLINE — the Sun is within 1° of the horizon; one minute of ' +
      'uncertainty in the birth time can flip the sect, which moves every ' +
      'sect-dependent lot.'
    : '';
  const overridden = sect.overridden ? '  (overridden by the caller)' : '';
  return `Sect: ${sect.sect === 'day' ? 'diurnal (day)' : 'nocturnal (night)'}` +
    ` — Sun ${formatAngle(Math.abs(sect.sunElevation))} ` +
    `${sect.sunElevation >= 0 ? 'above' : 'below'} the horizon` +
    `${overridden}${borderline}`;
}
