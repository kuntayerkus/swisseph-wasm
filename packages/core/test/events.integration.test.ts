/**
 * Deklinasyon, doğuş/batış, dönüşler, tutulmalar ve heliacal olaylar —
 * gerçek WASM build'i üzerinden.
 *
 * chart.integration.test.ts ile aynı bayatlık koruması geçerli: derlenmiş
 * dist/ sınanıyor, src/ ondan yeniyse test çalışmadan patlıyor.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { findDeclinationAspects, outOfBounds } from '../src/derived/declination.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist', 'index.js');
const SRC = join(HERE, '..', 'src');
const DATA_DIR = join(HERE, '..', '..', 'data', 'ephe');

const hasBuild = existsSync(DIST);
/** Sabit yıldız adı çözmek sefstars.txt istiyor; Moshier bunu karşılamıyor. */
const hasStars = existsSync(join(DATA_DIR, 'sefstars.txt'));

function newestSourceTime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory()
      ? newestSourceTime(path)
      : statSync(path).mtimeMs);
  }
  return newest;
}

if (hasBuild && newestSourceTime(SRC) > statSync(DIST).mtimeMs) {
  throw new Error(
    'packages/core/dist/ bayat — src/ daha yeni.\n' +
    '  Entegrasyon testleri eski kodu sınardı. Önce: npm run build:ts',
  );
}

const describeBuilt = hasBuild ? describe : describe.skip;

const DEG = Math.PI / 180;

describeBuilt('olaylar — gerçek efemeris', () => {
  let mod: typeof import('../src/index.js');
  let swe: Awaited<ReturnType<typeof mod.createSwissEph>>;
  let Body: typeof mod.Body;
  let RiseTransit: typeof mod.RiseTransit;
  let HeliacalEvent: typeof mod.HeliacalEvent;
  let HeliacalFlag: typeof mod.HeliacalFlag;

  const ANKARA = { latitude: 39.93, longitude: 32.86 };

  beforeAll(async () => {
    mod = await import(DIST);
    ({ Body, RiseTransit, HeliacalEvent, HeliacalFlag } = mod);
    swe = await mod.createSwissEph();

    if (hasStars) {
      const files: Record<string, Uint8Array> = {};
      for (const f of ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1', 'sefstars.txt']) {
        const p = join(DATA_DIR, f);
        if (existsSync(p)) files[f] = readFileSync(p);
      }
      swe.mountEphemeris(files);
    }
  });

  afterAll(() => swe?.dispose());

  // --- eğiklik ve ekvatoral koordinat ------------------------------------

  describe('eğiklik', () => {
    /**
     * Sık karıştırılan iki sabit var: IAU 1976'nın 84381.448" değeri
     * (23.4392911°) ve IAU 2006'nın 84381.406" değeri (23.4392794°).
     * Swiss Ephemeris ikincisini kullanıyor; OBLIQUITY_J2000 da öyle.
     */
    it('J2000 değeri IAU 2006 sabitine uyuyor', () => {
      const jd = swe.julianDay(2000, 1, 1, 12);
      const { meanObliquity, trueObliquity } = swe.obliquity(jd);
      expect(meanObliquity).toBeCloseTo(84381.406 / 3600, 6);
      expect(meanObliquity).toBeCloseTo(mod.OBLIQUITY_J2000, 6);
      // Gerçek eğiklik nutasyon kadar farklı — sıfır değil, 0.01°'yi de aşmaz.
      expect(Math.abs(trueObliquity - meanObliquity)).toBeGreaterThan(1e-5);
      expect(Math.abs(trueObliquity - meanObliquity)).toBeLessThan(0.01);
    });

    it('eğiklik yüzyıllar içinde azalıyor', () => {
      const past = swe.obliquity(swe.julianDay(1600, 1, 1, 0)).meanObliquity;
      const future = swe.obliquity(swe.julianDay(2400, 1, 1, 0)).meanObliquity;
      expect(past).toBeGreaterThan(future);
      // 800 yılda ~47"/yüzyıl → ~0.1°
      expect(past - future).toBeCloseTo(0.104, 2);
    });
  });

  describe('ekvatoral koordinat', () => {
    /**
     * Bağımsız doğrulama: deklinasyonu küresel trigonometriyle yeniden
     * hesaplıyoruz. Kütüphanenin kendi sayısına "doğru" demek yerine,
     * tutmak ZORUNDA olan bir bağıntıyı sınıyoruz.
     *
     *   sin δ = sin β cos ε + cos β sin ε sin λ
     */
    it('deklinasyon ekliptik koordinattan yeniden türetilebiliyor', () => {
      const jd = swe.julianDay(1990, 5, 15, 14.5);
      const epsilon = swe.obliquity(jd).trueObliquity * DEG;

      for (const body of [Body.Sun, Body.Moon, Body.Mars, Body.Saturn]) {
        const ecliptic = swe.calc(jd, body);
        const equatorial = swe.equatorial(jd, body);

        const lambda = ecliptic.longitude * DEG;
        const beta = ecliptic.latitude * DEG;
        const sinDec = Math.sin(beta) * Math.cos(epsilon)
          + Math.cos(beta) * Math.sin(epsilon) * Math.sin(lambda);
        const expected = Math.asin(sinDec) / DEG;

        // 1 saniyelik yay: nutasyon ve aberasyon işlenişindeki küçük
        // farklar bu düzeyde kalıyor.
        expect(equatorial.declination, swe.planetName(body))
          .toBeCloseTo(expected, 3);
      }
    });

    it('gündönümünde Güneş eğikliğe değiyor', () => {
      const jd = swe.julianDay(2020, 6, 20, 21.7);   // 2020 Haziran gündönümü
      const { declination } = swe.equatorial(jd, Body.Sun);
      const { trueObliquity } = swe.obliquity(jd);
      expect(declination).toBeCloseTo(trueObliquity, 2);
    });

    it('ekinoksta Güneş ekvatorda', () => {
      const jd = swe.julianDay(2020, 3, 20, 3.83);   // 2020 Mart ekinoksu
      expect(Math.abs(swe.equatorial(jd, Body.Sun).declination)).toBeLessThan(0.01);
    });
  });

  describe('sınır dışı Ay', () => {
    const maxLunarDeclination = (year: number) => {
      let max = 0;
      for (let day = 0; day < 365; day += 2) {
        const jd = swe.julianDay(year, 1, 1, 0) + day;
        max = Math.max(max, Math.abs(swe.equatorial(jd, Body.Moon).declination));
      }
      return max;
    };

    /**
     * Ay'ın deklinasyon uç değeri 18.6 yıllık düğüm devriyle salınıyor:
     * büyük duraklamada (2006) eğikliğin epey ötesine, küçük duraklamada
     * (2015) altına düşüyor. Kod doğruysa bu desen kendiliğinden çıkar.
     */
    it('büyük duraklamada eğikliği aşıyor, küçükte aşmıyor', () => {
      const major = maxLunarDeclination(2006);
      const minor = maxLunarDeclination(2015);
      expect(major).toBeGreaterThan(28);
      expect(minor).toBeLessThan(19);

      const obliquity = swe.obliquity(swe.julianDay(2006, 6, 1, 0)).trueObliquity;
      expect(outOfBounds([{ name: 'Moon', declination: major }], obliquity)[0]
        .outOfBounds).toBe(true);
      expect(outOfBounds([{ name: 'Moon', declination: minor }], obliquity)[0]
        .outOfBounds).toBe(false);
    });

    it('declinations() türetilmiş katmanı besliyor', () => {
      const jd = swe.julianDay(1990, 5, 15, 14.5);
      const points = swe.declinations(jd, [Body.Sun, Body.Moon, Body.Venus]);
      expect(points.map((p) => p.name)).toEqual(['Sun', 'Moon', 'Venus']);
      for (const p of points) {
        expect(Math.abs(p.declination)).toBeLessThan(30);
        expect(p.speed).toBeDefined();
      }
      // Saf katman girdiyi kabul ediyor — tip ve alan uyumu.
      expect(() => findDeclinationAspects(points, { orb: 2 })).not.toThrow();
    });
  });

  // --- doğuş, batış, kültminasyon ----------------------------------------

  describe('doğuş / batış', () => {
    it('doğuş, kültminasyon ve batış doğru sırada', () => {
      const jd = swe.julianDay(1990, 5, 15, 0);
      const rise = swe.riseTransit(jd, Body.Sun, ANKARA, RiseTransit.Rise);
      const culminate = swe.riseTransit(jd, Body.Sun, ANKARA,
        RiseTransit.UpperCulmination);
      const set = swe.riseTransit(jd, Body.Sun, ANKARA, RiseTransit.Set);

      expect(rise.occurs && culminate.occurs && set.occurs).toBe(true);
      expect(rise.jd!).toBeLessThan(culminate.jd!);
      expect(culminate.jd!).toBeLessThan(set.jd!);
      // Mayıs ortası Ankara: gün uzunluğu 14 saate yakın.
      expect((set.jd! - rise.jd!) * 24).toBeCloseTo(14.2, 0);
    });

    /**
     * Kutup gecesi/günü hata değil. swe_rise_trans -2 döndürüyor ve bunu
     * hata sayarsak 80° enlemde bir harita hiç hesaplanamaz.
     */
    it('kutupta yaz Güneşi batmıyor — hata değil, occurs: false', () => {
      const arctic = { latitude: 80, longitude: 20 };
      const jd = swe.julianDay(2020, 6, 21, 0);
      const set = swe.riseTransit(jd, Body.Sun, arctic, RiseTransit.Set);
      expect(set.occurs).toBe(false);
      expect(set.jd).toBeNull();
      // Kültminasyon yine de var: cisim ufkun üstünde dönüyor.
      expect(swe.riseTransit(jd, Body.Sun, arctic, RiseTransit.UpperCulmination)
        .occurs).toBe(true);
    });

    it('kutupta kış Güneşi doğmuyor', () => {
      const arctic = { latitude: 80, longitude: 20 };
      const jd = swe.julianDay(2020, 12, 21, 0);
      expect(swe.riseTransit(jd, Body.Sun, arctic, RiseTransit.Rise).occurs)
        .toBe(false);
    });

    it('angleEvents dört açıyı da veriyor', () => {
      const jd = swe.julianDay(1990, 5, 15, 0);
      const [sun] = swe.angleEvents(jd, [Body.Sun], ANKARA);
      expect(sun.name).toBe('Sun');
      expect(sun.body).toBe(Body.Sun);
      expect(Object.keys(sun.events).sort())
        .toEqual(['anticulminate', 'culminate', 'rise', 'set']);
      expect(sun.circumpolar).toBeUndefined();
    });

    it('kutupta hep-yukarıda ile hiç-doğmayan ayırt ediliyor', () => {
      const arctic = { latitude: 80, longitude: 20 };
      const summer = swe.angleEvents(swe.julianDay(2020, 6, 21, 0),
        [Body.Sun], arctic)[0];
      const winter = swe.angleEvents(swe.julianDay(2020, 12, 21, 0),
        [Body.Sun], arctic)[0];

      expect(summer.circumpolar).toBe(true);
      expect(summer.neverRises).toBeUndefined();
      expect(winter.neverRises).toBe(true);
      expect(winter.circumpolar).toBeUndefined();
      // İkisinde de kültminasyon var.
      expect(summer.events.culminate).toBeDefined();
      expect(winter.events.culminate).toBeDefined();
    });

    it('paran taraması çalışıyor ve simetrik çift üretmiyor', () => {
      const jd = swe.julianDay(1990, 5, 15, 0);
      const contacts = swe.parans(jd, [Body.Sun, Body.Moon, Body.Mars],
        ANKARA, { orbMinutes: 180 });
      for (const contact of contacts) {
        expect(contact.orbMinutes).toBeLessThanOrEqual(180);
        expect(contact.from.name).not.toBe(contact.to.name);
      }
      const pairs = contacts.map((contact) =>
        [contact.from.name, contact.from.event,
         contact.to.name, contact.to.event].join('|'));
      expect(new Set(pairs).size).toBe(pairs.length);
    });
  });

  // --- dönüşler ----------------------------------------------------------

  describe('dönüşler', () => {
    const NATAL_JD = 2448027.104167;   // 1990-05-15 14:30 UT

    it('güneş dönüşünde Güneş natal boylamda', () => {
      const natalSun = swe.calc(NATAL_JD, Body.Sun).longitude;
      const { jd } = swe.solarReturn(NATAL_JD);
      const returnSun = swe.calc(jd, Body.Sun).longitude;

      // Kesişim rutininin toleransı; saniyelik yayın çok altında.
      expect(Math.abs(returnSun - natalSun)).toBeLessThan(1e-5);
      expect(jd - NATAL_JD).toBeCloseTo(365.24, 0);
    });

    it('doğum anının kendisini dönüş saymıyor', () => {
      const { jd } = swe.solarReturn(NATAL_JD);
      expect(jd).toBeGreaterThan(NATAL_JD + 300);
    });

    it('art arda çağrılar ardışık dönüşleri veriyor', () => {
      let jd = NATAL_JD;
      const years: number[] = [];
      for (let i = 0; i < 3; i++) {
        jd = swe.solarReturn(NATAL_JD, { after: jd }).jd;
        years.push(jd);
      }
      expect(years[1] - years[0]).toBeCloseTo(365.24, 0);
      expect(years[2] - years[1]).toBeCloseTo(365.24, 0);
    });

    it('ay dönüşü bir tropik ay sonra', () => {
      const natalMoon = swe.calc(NATAL_JD, Body.Moon).longitude;
      const { jd } = swe.lunarReturn(NATAL_JD);
      expect(Math.abs(swe.calc(jd, Body.Moon).longitude - natalMoon))
        .toBeLessThan(1e-4);
      expect(jd - NATAL_JD).toBeCloseTo(27.32, 0);
    });

    /**
     * Presesyon düzeltmeli dönüş, aynı SİDEREAL boylama dönüş. Hedef ileri
     * kayıyor, dolayısıyla dönüş GEÇ oluyor.
     *
     * Kayma miktarını bir ders kitabı sabitine çivilemiyoruz: ayanamsa
     * modelleri arasında oran yılda ~1 saniyelik yay farkedebiliyor ve
     * doğru cevap seçili moda bağlı. Bunun yerine üç şeyi sınıyoruz —
     * kayma ayanamsa farkının TA KENDİSİ mi (formülün doğrulaması),
     * büyüklüğü presesyon mertebesinde mi, ve zaman kayması Güneş hızıyla
     * tutarlı mı.
     */
    it('presesyon düzeltmeli dönüş daha geç ve ayanamsa farkıyla tutarlı', () => {
      const after = NATAL_JD + 29.5 * 365.25;
      const plain = swe.solarReturn(NATAL_JD, { after });
      const corrected = swe.solarReturn(NATAL_JD, { after, precessionCorrected: true });

      expect(corrected.jd).toBeGreaterThan(plain.jd);
      expect(corrected.precessionCorrected).toBe(true);
      expect(plain.targetLongitude).toBe(plain.natalLongitude);

      const shiftDegrees = corrected.targetLongitude - corrected.natalLongitude;
      const ayanamsaShift = swe.ayanamsa(corrected.jd) - swe.ayanamsa(NATAL_JD);
      expect(shiftDegrees).toBeCloseTo(ayanamsaShift, 9);

      const years = (corrected.jd - NATAL_JD) / 365.2422;
      const arcsecPerYear = shiftDegrees * 3600 / years;
      expect(arcsecPerYear).toBeGreaterThan(45);
      expect(arcsecPerYear).toBeLessThan(55);

      expect(corrected.jd - plain.jd).toBeCloseTo(shiftDegrees / 0.9856, 1);
    });

    /**
     * Genel amaçlı kesişim araması ile SE'nin kendi rutini birbirini
     * doğruluyor. İkisi tamamen farklı yollar: biri adımlayıp ikiye bölüyor,
     * diğeri Newton yinelemesi yapıyor.
     */
    it('genel arama SE\'nin kendi kesişim rutiniyle aynı sonucu veriyor', () => {
      const natalSun = swe.calc(NATAL_JD, Body.Sun).longitude;
      const dedicated = swe.nextCrossing(Body.Sun, natalSun, NATAL_JD + 1);
      const searched = swe.nextCrossing(Body.Sun, natalSun, NATAL_JD + 1,
        { forceSearch: true });
      // 1e-6 gün = 0.09 saniye.
      expect(Math.abs(dedicated - searched)).toBeLessThan(1e-6);
    });

    it('Ay için de aynı iki yol örtüşüyor', () => {
      const natalMoon = swe.calc(NATAL_JD, Body.Moon).longitude;
      const dedicated = swe.nextCrossing(Body.Moon, natalMoon, NATAL_JD + 1);
      const searched = swe.nextCrossing(Body.Moon, natalMoon, NATAL_JD + 1,
        { forceSearch: true });
      expect(Math.abs(dedicated - searched)).toBeLessThan(1e-6);
    });

    /**
     * MEAN_RETURN_DAYS elle yazılmış bir tablo ve yalnızca arama sınırını
     * ölçeklendiriyor. Yine de sınanıyor: her cisim varsayılan sınır içinde
     * dönüşünü bulabilmeli, yoksa tablo sessizce çürür.
     */
    it('her klasik cisim varsayılan sınır içinde dönüşünü buluyor', () => {
      const expected: [number, number][] = [
        [Body.Mercury, 88], [Body.Venus, 225], [Body.Mars, 687],
        [Body.Jupiter, 4333], [Body.Saturn, 10759],
      ];
      for (const [body, approximateDays] of expected) {
        const natal = swe.calc(NATAL_JD, body).longitude;
        const { jd } = swe.returnOf(body, NATAL_JD);
        const found = swe.calc(jd, body).longitude;
        expect(Math.abs(found - natal), swe.planetName(body)).toBeLessThan(1e-4);
        // İlk kesişim retrograd ilmek yüzünden erken olabilir; büyüklük
        // mertebesi yine de tutmalı.
        expect(jd - NATAL_JD, swe.planetName(body))
          .toBeLessThan(approximateDays * 1.5);
      }
    }, 60_000);

    it('bulunamayan kesişim açık hata veriyor', () => {
      expect(() => swe.nextCrossing(Body.Saturn, 0, NATAL_JD, { maxDays: 10 }))
        .toThrow(/maxDays/);
    });
  });

  // --- tutulmalar --------------------------------------------------------

  describe('tutulmalar', () => {
    it('2017 Ağustos tam güneş tutulmasını buluyor', () => {
      const eclipse = swe.solarEclipse(swe.julianDay(2017, 8, 1, 0));
      const date = swe.calendarDate(eclipse.timings.maximum);

      expect(eclipse.kind).toBe('total');
      expect(eclipse.central).toBe(true);
      expect([date.year, date.month, date.day]).toEqual([2017, 8, 21]);
      expect(date.hour).toBeCloseTo(18.4, 0);

      // Evreler sıralı olmalı.
      const t = eclipse.timings;
      expect(t.partialBegin!).toBeLessThan(t.totalityBegin!);
      expect(t.totalityBegin!).toBeLessThan(t.maximum);
      expect(t.maximum).toBeLessThan(t.totalityEnd!);
      expect(t.totalityEnd!).toBeLessThan(t.partialEnd!);
    });

    it('tipe göre süzülebiliyor', () => {
      const { EclipseFlag } = mod;
      const annular = swe.solarEclipse(swe.julianDay(2017, 1, 1, 0),
        { type: EclipseFlag.Annular });
      expect(annular.kind).toBe('annular');
      // 2017-02-26 halkalı tutulma.
      const date = swe.calendarDate(annular.timings.maximum);
      expect([date.year, date.month, date.day]).toEqual([2017, 2, 26]);
    });

    it('geriye doğru arama çalışıyor', () => {
      const back = swe.solarEclipse(swe.julianDay(2017, 8, 25, 0),
        { backward: true });
      const date = swe.calendarDate(back.timings.maximum);
      expect([date.year, date.month, date.day]).toEqual([2017, 8, 21]);
    });

    it('yerel arama görünürlük ve büyüklük veriyor', () => {
      const eclipse = swe.solarEclipse(swe.julianDay(2017, 8, 1, 0), {
        place: { latitude: 36.97, longitude: -76.29 },   // ABD doğu kıyısı
      });
      expect(eclipse.local).toBeDefined();
      expect(eclipse.local!.magnitude).toBeGreaterThan(0);
      expect(eclipse.local!.magnitude).toBeLessThanOrEqual(1.1);
      expect(eclipse.local!.obscuration).toBeGreaterThan(0);
      // Yerel tutulma görünür olduğuna göre Güneş ufkun üstünde.
      expect(eclipse.local!.altitude).toBeGreaterThan(0);
      expect(eclipse.local!.saros).toBeGreaterThan(0);
    });

    /**
     * swe_sol_eclipse_when_loc bir tip süzgeci almıyor. Sessizce yok saymak
     * yerine açıkça hata veriyoruz: "en yakın tam tutulmayı burada göster"
     * isteyen biri, sessizce parçalı bir tutulma alsaydı bunu fark etmezdi.
     */
    it('yerel arama + tip süzgeci açıkça reddediliyor', () => {
      const { EclipseFlag } = mod;
      expect(() => swe.solarEclipse(swe.julianDay(2017, 8, 1, 0), {
        place: ANKARA, type: EclipseFlag.Total,
      })).toThrow(/type/);
    });

    it('2018 Temmuz tam ay tutulmasını buluyor', () => {
      const eclipse = swe.lunarEclipse(swe.julianDay(2018, 7, 1, 0));
      const date = swe.calendarDate(eclipse.timings.maximum);

      expect(eclipse.kind).toBe('total');
      expect([date.year, date.month, date.day]).toEqual([2018, 7, 27]);
      expect(date.hour).toBeCloseTo(20.4, 0);

      const t = eclipse.timings;
      expect(t.penumbralBegin!).toBeLessThan(t.partialBegin!);
      expect(t.partialBegin!).toBeLessThan(t.totalityBegin!);
      expect(t.totalityEnd!).toBeLessThan(t.partialEnd!);
      expect(t.partialEnd!).toBeLessThan(t.penumbralEnd!);
      // Yüzyılın en uzun tam evresi: 103 dakika.
      expect((t.totalityEnd! - t.totalityBegin!) * 24 * 60).toBeCloseTo(103, 0);
    });

    it('ay tutulmasında yerel görünürlük geliyor', () => {
      const eclipse = swe.lunarEclipse(swe.julianDay(2018, 7, 1, 0),
        { place: ANKARA });
      expect(eclipse.local).toBeDefined();
      expect(eclipse.local!.magnitude).toBeGreaterThan(1);   // tam tutulma
      expect(eclipse.local!.penumbralMagnitude)
        .toBeGreaterThan(eclipse.local!.magnitude);
    });

    it('yarıgölge tutulmasında tam evre yok', () => {
      const { EclipseFlag } = mod;
      const eclipse = swe.lunarEclipse(swe.julianDay(2020, 1, 1, 0),
        { type: EclipseFlag.Penumbral });
      expect(eclipse.kind).toBe('penumbral');
      expect(eclipse.timings.totalityBegin).toBeUndefined();
      expect(eclipse.timings.partialBegin).toBeUndefined();
      expect(eclipse.timings.penumbralBegin).toBeDefined();
    });
  });

  // --- heliacal ----------------------------------------------------------

  describe('heliacal olaylar', () => {
    const EGYPT = { latitude: 30.0, longitude: 31.2, altitude: 20 };

    it('Venüs\'ün akşam ilk görünüşünü buluyor', () => {
      const start = swe.julianDay(2020, 1, 1, 0);
      const result = swe.heliacal(start, 'venus', EGYPT,
        HeliacalEvent.EveningFirst,
        { heliacalFlags: HeliacalFlag.NoDetails });

      expect(result.visibilityBegin).toBeGreaterThan(start);
      // Venüs'ün sinodik devri 584 gün; olay bunun içinde olmalı.
      expect(result.visibilityBegin - start).toBeLessThan(584);
      expect(result.object.toLowerCase()).toContain('venus');
    }, 60_000);

    it.skipIf(!hasStars)('sabit yıldızın heliacal doğuşunu buluyor', () => {
      const start = swe.julianDay(2020, 1, 1, 0);
      const result = swe.heliacal(start, 'Sirius', EGYPT,
        HeliacalEvent.HeliacalRising,
        { heliacalFlags: HeliacalFlag.NoDetails });

      expect(result.visibilityBegin).toBeGreaterThan(start);
      expect(result.visibilityBegin - start).toBeLessThan(400);
      // Sirius Mısır'da yaz başında doğuyor — takvimin dayandığı olay.
      const date = swe.calendarDate(result.visibilityBegin);
      expect(date.month).toBeGreaterThanOrEqual(6);
      expect(date.month).toBeLessThanOrEqual(8);
    }, 60_000);

    it.skipIf(!hasStars)('atmosfer ve gözlemci sonucu değiştiriyor', () => {
      const start = swe.julianDay(2020, 1, 1, 0);
      const sharp = swe.heliacal(start, 'Sirius', EGYPT,
        HeliacalEvent.HeliacalRising,
        { observer: { age: 23, snellenRatio: 1.5 },
          heliacalFlags: HeliacalFlag.NoDetails });
      const dim = swe.heliacal(start, 'Sirius', EGYPT,
        HeliacalEvent.HeliacalRising,
        { observer: { age: 70, snellenRatio: 0.5 },
          heliacalFlags: HeliacalFlag.NoDetails });

      // Keskin göz yıldızı daha erken görüyor; en azından geç görmüyor.
      expect(sharp.visibilityBegin).toBeLessThanOrEqual(dim.visibilityBegin);
    }, 60_000);
  });
});
