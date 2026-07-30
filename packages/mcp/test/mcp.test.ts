/**
 * MCP sunucusunun uçtan uca testi.
 *
 * Gerçek bir MCP istemcisi ayağa kaldırıp sunucuyu alt süreç olarak stdio
 * üzerinden konuşturuyoruz. Araç fonksiyonlarını doğrudan çağırmak daha kolay
 * olurdu ama protokolün kendisini sınamazdı — ve bu paketin tek işi protokol.
 *
 * Ayrıca saat dilimi çözümü ayrıca sınanıyor: yanlış harita üretmenin bir
 * numaralı yolu o ve LLM'in varsayılan davranışı tam olarak orada hata yapmak.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolveTime, formatClock } from '../src/time.js';
import { formatLongitude, formatDeclination, formatAngle } from '../src/format.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..', 'dist', 'index.js');
const hasBuild = existsSync(SERVER);

// --- saf birimler --------------------------------------------------------

describe('derece biçimlendirme', () => {
  /**
   * Astroloji yazılımları KESER, yuvarlamaz. Bu farkı bu projede bir kez
   * yaşadık: demo yuvarlayınca 10 cismin 4'ünde 1 dakikalık sahte fark çıktı.
   */
  it('yuvarlamıyor, kesiyor', () => {
    // 29.9999° Koç: yuvarlasaydık 30°00'00" olur ve BOĞA'ya kayardı.
    expect(formatLongitude(29.99999)).toBe(`29°59'59" Aries`);
    expect(formatLongitude(0)).toBe(`00°00'00" Aries`);
    expect(formatLongitude(54.5033)).toBe(`24°30'11" Taurus`);
  });

  it('burç sınırlarını doğru veriyor', () => {
    expect(formatLongitude(30)).toBe(`00°00'00" Taurus`);
    expect(formatLongitude(359.9)).toContain('Pisces');
    expect(formatLongitude(-1)).toContain('Pisces');   // negatif sarmalı
    expect(formatLongitude(361)).toContain('Aries');   // 360 üstü sarmalı
  });

  it('deklinasyon işaretli', () => {
    expect(formatDeclination(19.2)).toBe(`+19°12'00"`);
    expect(formatDeclination(-19.2)).toBe(`-19°12'00"`);
  });

  it('açı biçimi derece-dakika', () => {
    expect(formatAngle(2.5)).toBe(`2°30'`);
    expect(formatAngle(0)).toBe(`0°00'`);
  });
});

describe('saat dilimi çözümü', () => {
  // swe_julday yerine saf aritmetik: gün kesrini doğrudan sınıyoruz.
  const julday = (y: number, mo: number, d: number, h: number) =>
    Date.UTC(y, mo - 1, d) / 86_400_000 + 2440587.5 + h / 24;

  it('yerel saati UT\'ye çeviriyor', () => {
    const r = resolveTime(
      { date: '1990-05-15', time: '17:30', timezone: 'Europe/Istanbul' }, julday);
    expect(r.offsetHours).toBe(3);
    expect(r.utcLabel).toContain('14:30');
    expect(r.source).toBe('iana');
  });

  /**
   * Asıl mesele bu. Türkiye 2016'ya kadar yaz saati uyguluyordu, sonra +03'te
   * sabitlendi. 1990 Ocak +02, 1990 Mayıs +03. Ezberden sabit ofset geçen
   * biri ikisinden birinde bir saat yanılır — ki bu Yükselen'de ~15 derece.
   */
  it('tarihsel yaz saatini doğru alıyor', () => {
    const winter = resolveTime(
      { date: '1990-01-15', time: '12:00', timezone: 'Europe/Istanbul' }, julday);
    const summer = resolveTime(
      { date: '1990-05-15', time: '12:00', timezone: 'Europe/Istanbul' }, julday);
    expect(winter.offsetHours).toBe(2);
    expect(summer.offsetHours).toBe(3);

    // 2016 sonrası yaz saati kalktı: iki mevsim de +03.
    const after = resolveTime(
      { date: '2020-01-15', time: '12:00', timezone: 'Europe/Istanbul' }, julday);
    expect(after.offsetHours).toBe(3);
  });

  it('batı yarıküre negatif ofset', () => {
    const r = resolveTime(
      { date: '2020-07-04', time: '09:00', timezone: 'America/New_York' }, julday);
    expect(r.offsetHours).toBe(-4);          // EDT
    expect(r.offsetLabel).toBe('-04:00');
    expect(r.utcLabel).toContain('13:00');
  });

  it('yarım saatlik dilimler', () => {
    const r = resolveTime(
      { date: '2020-01-15', time: '12:00', timezone: 'Asia/Kolkata' }, julday);
    expect(r.offsetHours).toBeCloseTo(5.5, 6);
    expect(r.offsetLabel).toBe('+05:30');
  });

  it('sabit ofset ve UTC kabul ediliyor', () => {
    expect(resolveTime({ date: '2020-01-01', time: '00:00', timezone: '+03:00' }, julday)
      .offsetHours).toBe(3);
    expect(resolveTime({ date: '2020-01-01', time: '00:00', timezone: '-0530' }, julday)
      .offsetHours).toBeCloseTo(-5.5, 6);
    expect(resolveTime({ date: '2020-01-01', time: '00:00', timezone: 'UTC' }, julday)
      .source).toBe('utc');
  });

  it('gün sınırını geçen çevrim işaretleniyor', () => {
    const r = resolveTime(
      { date: '2020-01-01', time: '01:00', timezone: 'Asia/Tokyo' }, julday);
    expect(r.offsetHours).toBe(9);
    // 01:00 +09 -> önceki günün 16:00 UT'si.
    expect(r.utcLabel).toContain('16:00');
    expect(r.utcLabel).toContain('-1 day');
  });

  /**
   * 1582 öncesinde IANA dilimleri anlamsız (takvim reformu + LMT). Sessizce
   * yanlış cevap vermektense açıkça reddediyoruz.
   */
  it('takvim reformu öncesi IANA dilimi reddediliyor', () => {
    expect(() => resolveTime(
      { date: '-0043-03-15', time: '12:00', timezone: 'Europe/Rome' }, julday))
      .toThrow(/calendar reform/);
    // Sabit ofsetle sorun yok.
    expect(() => resolveTime(
      { date: '-0043-03-15', time: '12:00', timezone: '+00:50' }, julday)).not.toThrow();
  });

  /*
   * Etc/GMT±N POSIX işaret kuralını izler ve TERSİNE çalışır: Etc/GMT+3 =
   * UTC−3. Intl bunu sessizce kabul ediyordu, yani İstanbul doğumuna
   * Etc/GMT+3 yazmak 6 saatlik UT hatası ve ~90° Yükselen sapması demekti.
   * Sessizce kabul edilen biçim tam olarak tehlikeli olanıydı.
   */
  describe('Etc/GMT±N ters işaret kuralı', () => {
    for (const zone of ['Etc/GMT+3', 'Etc/GMT-3', 'Etc/GMT+5', 'etc/gmt+10']) {
      it(`${zone} reddediliyor`, () => {
        expect(() => resolveTime(
          { date: '1990-05-15', time: '14:30', timezone: zone }, julday))
          .toThrow(/inverted POSIX sign convention/);
      });
    }

    it('hata mesajı gerçek anlamı söylüyor', () => {
      expect(() => resolveTime(
        { date: '1990-05-15', time: '14:30', timezone: 'Etc/GMT+3' }, julday))
        .toThrow(/means UTC-03:00, not UTC\+03:00/);
    });

    it('Etc/GMT ve Etc/UTC (rakamsız) hâlâ çalışıyor', () => {
      expect(resolveTime(
        { date: '2020-01-15', time: '12:00', timezone: 'Etc/UTC' }, julday)
        .offsetHours).toBe(0);
      expect(resolveTime(
        { date: '2020-01-15', time: '12:00', timezone: 'Etc/GMT' }, julday)
        .offsetHours).toBe(0);
    });
  });

  /** LLM'ler bu biçimleri üretiyor; işaret burada ISO yönünde, yani net. */
  describe('UTC+3 / GMT+03:00 yazımları', () => {
    for (const [zone, expected] of [
      ['UTC+3', 3], ['UTC+03:00', 3], ['GMT+03:00', 3], ['gmt+3', 3],
      ['UTC-5', -5], ['GMT-0530', -5.5], ['utc+05:30', 5.5],
    ] as const) {
      it(`${zone} → ${expected}`, () => {
        const r = resolveTime(
          { date: '2020-01-15', time: '12:00', timezone: zone }, julday);
        expect(r.offsetHours).toBeCloseTo(expected, 6);
        expect(r.source).toBe('fixed');
      });
    }

    it('UTC+3 ile Europe/Istanbul aynı UT veriyor (2020, DST yok)', () => {
      const a = resolveTime(
        { date: '2020-05-15', time: '14:30', timezone: 'UTC+3' }, julday);
      const b = resolveTime(
        { date: '2020-05-15', time: '14:30', timezone: 'Europe/Istanbul' }, julday);
      expect(a.julianDay).toBeCloseTo(b.julianDay, 12);
    });
  });

  /*
   * DST geri dönüşünde tekrarlanan saat. İki geçişli çözüm ikinci (standart
   * saat) oluşumu seçiyor — savunulabilir ama bir TERCİH, ve kullanıcı hangi
   * oluşumun seçildiğini bilmiyordu.
   */
  describe('DST belirsizliği işaretleniyor', () => {
    /**
     * Hangi oluşumun seçildiği ZONA GÖRE değişiyor — ilk UTC tahmininin
     * geçişin hangi tarafına düştüğüne bağlı. İstanbul'da +02 (ikinci),
     * New York'ta −04 (birinci) seçiliyor. Bu yüzden testler "hangisi
     * seçildi" değil, "iki ofset de bildirildi mi" diye soruyor: seçim
     * olduğu gibi bırakıldı, yalnızca sessiz olması bitti.
     */
    it('tekrarlanan saat ambiguous:true (İstanbul)', () => {
      // Türkiye 2015-11-08'de +03'ten +02'ye döndü: 03:00-03:59 iki kez.
      const r = resolveTime(
        { date: '2015-11-08', time: '03:30', timezone: 'Europe/Istanbul' }, julday);
      expect(r.ambiguous).toBe(true);
      expect([r.offsetHours, r.alternativeOffsetHours!].sort((a, b) => a - b)).toEqual([2, 3]);
    });

    it('ABD geri dönüşünde de yakalanıyor', () => {
      const r = resolveTime(
        { date: '2020-11-01', time: '01:30', timezone: 'America/New_York' }, julday);
      expect(r.ambiguous).toBe(true);
      expect([r.offsetHours, r.alternativeOffsetHours!].sort((a, b) => a - b)).toEqual([-5, -4]);
    });

    it('iki ofset tam bir saat ayrı ve seçilen gerçekten uygulanmış', () => {
      const r = resolveTime(
        { date: '2015-11-08', time: '03:30', timezone: 'Europe/Istanbul' }, julday);
      expect(Math.abs(r.offsetHours - r.alternativeOffsetHours!)).toBeCloseTo(1, 9);
      // utcLabel gerçekten uygulanan ofseti yansıtmalı: 03:30 − offsetHours.
      expect(r.utcLabel).toContain(
        `0${3 - r.offsetHours}:30`.slice(-5));
    });

    /**
     * İlkbahar boşluğu belirsiz DEĞİL: o saat hiç yaşanmadı, dolayısıyla
     * seçenek yok. Onu da işaretlemek uyarıyı anlamsızlaştırırdı.
     */
    it('olmayan saat (ilkbahar boşluğu) ambiguous olarak işaretlenmiyor', () => {
      const r = resolveTime(
        { date: '2016-03-27', time: '03:30', timezone: 'Europe/Istanbul' }, julday);
      expect(r.ambiguous).toBeUndefined();
    });

    it('sıradan saatlerde alan hiç yok', () => {
      const r = resolveTime(
        { date: '2020-05-15', time: '14:30', timezone: 'Europe/Istanbul' }, julday);
      expect(r.ambiguous).toBeUndefined();
    });
  });

  it('bozuk girdi anlaşılır hata veriyor', () => {
    expect(() => resolveTime(
      { date: '15/05/1990', time: '17:30', timezone: 'UTC' }, julday)).toThrow(/YYYY-MM-DD/);
    expect(() => resolveTime(
      { date: '1990-05-15', time: '17.30', timezone: 'UTC' }, julday)).toThrow(/HH:MM/);
    expect(() => resolveTime(
      { date: '1990-05-15', time: '17:30', timezone: 'Mars/Olympus' }, julday))
      .toThrow(/not recognised/);
  });

  it('formatClock saniyeleri koruyor', () => {
    expect(formatClock(14.5)).toBe('14:30:00');
    expect(formatClock(0)).toBe('00:00:00');
  });
});

/*
 * Geçersiz takvim tarihleri.
 *
 * `day <= 31` kontrolü 1990-02-31'i geçiriyordu; swe_julday onu şikâyetsiz
 * 3 Mart'a taşıyordu ve sunucu tarihi kullanıcının yazdığı hâliyle geri
 * yazıyordu. Bu modülün tam tersini yapmak için var olduğu şey.
 */
describe('geçersiz takvim tarihleri', () => {
  const julday = (y: number, mo: number, d: number, h: number) =>
    Date.UTC(y, mo - 1, d) / 86_400_000 + 2440587.5 + h / 24;

  const at = (date: string, timezone = 'UTC') =>
    resolveTime({ date, time: '12:00', timezone }, julday);

  for (const date of [
    '2025-02-31',   // Şubat'ın 31'i yok
    '2025-02-30',
    '1990-02-31',   // denetimde ölçülen özgün vaka
    '2025-04-31',   // Nisan 30 gün
    '2025-06-31',
    '2025-09-31',
    '2025-11-31',
    '1900-02-29',   // Gregoryen'de artık yıl DEĞİL (yüzyıl, 400'e bölünmez)
    '2100-02-29',
    '2025-01-00',   // sıfırıncı gün
  ]) {
    it(`${date} reddediliyor`, () => {
      expect(() => at(date)).toThrow(/is not a real date/);
    });
  }

  for (const date of [
    '2024-02-29',   // Gregoryen artık yıl
    '2000-02-29',   // 400'e bölünen yüzyıl — artık yıl
    '2025-02-28',
    '2025-01-31',
    '2025-04-30',
    '2025-12-31',
  ]) {
    it(`${date} kabul ediliyor`, () => {
      expect(() => at(date)).not.toThrow();
    });
  }

  /**
   * Reform öncesi JÜLYEN artık yıl kuralı: her 4 yıl, yüzyıl istisnası yok.
   * 1500-02-29 Jülyen takviminde VARDI; Gregoryen kuralını geriye dönük
   * uygulamak onu yok sayardı.
   */
  it('1500-02-29 kabul ediliyor (Jülyen artık yılı)', () => {
    expect(() => at('1500-02-29', '+01:00')).not.toThrow();
  });

  it('1500-02-30 reddediliyor (Jülyen\'de de yok)', () => {
    expect(() => at('1500-02-30', '+01:00')).toThrow(/is not a real date/);
  });

  it('hata mesajı ayın gerçek gün sayısını ve takvimi söylüyor', () => {
    expect(() => at('1900-02-29'))
      .toThrow(/month 2 of 1900 has 28 days in the Gregorian calendar/);
    expect(() => at('1500-02-30', '+01:00'))
      .toThrow(/month 2 of 1500 has 29 days in the Julian calendar/);
  });

  /**
   * Denetimin ölçtüğü asıl zarar: kabul edilen tarih SESSİZCE kayıyordu.
   * 1990-02-31 → JD 2447954.02 → gerçekte 1990-03-03.
   */
  it('kabul edilen her tarih kendi gününe çözülüyor — sessiz kayma yok', () => {
    for (const [date, expected] of [
      ['2024-02-29', [2024, 2, 29]],
      ['2025-02-28', [2025, 2, 28]],
      ['2025-12-31', [2025, 12, 31]],
    ] as const) {
      const jd = at(date).julianDay;
      const ms = (jd - 2440587.5 - 0.5) * 86_400_000;
      const back = new Date(Math.round(ms));
      expect([back.getUTCFullYear(), back.getUTCMonth() + 1, back.getUTCDate()])
        .toEqual([...expected]);
    }
  });
});

// --- uçtan uca protokol --------------------------------------------------

const describeBuilt = hasBuild ? describe : describe.skip;

describeBuilt('MCP protokolü', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
    }));
  }, 60_000);

  afterAll(async () => {
    await client?.close();
  });

  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text: string }[];
    return content.map((c) => c.text).join('\n');
  };

  const ANKARA = { latitude: 39.93, longitude: 32.86, place: 'Ankara' };
  const NATAL = {
    date: '1990-05-15', time: '17:30', timezone: 'Europe/Istanbul', ...ANKARA,
  };

  it('araçları listeliyor', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'declinations', 'eclipses', 'natal_chart', 'return_chart',
      'rise_set', 'synastry', 'time_lords', 'transits',
    ]);
    // Her aracın açıklaması olmalı — model seçimini buna göre yapıyor.
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.description!.length, tool.name).toBeGreaterThan(80);
    }
  });

  it('natal harita üretiyor', async () => {
    const out = await call('natal_chart', NATAL);

    // Saat dilimi çevrimi görünür olmalı: LLM'in en sık hatası burada.
    expect(out).toContain('17:30');
    expect(out).toContain('14:30:00 UT');
    expect(out).toContain('+03:00');

    expect(out).toContain('POSITIONS');
    expect(out).toContain('HOUSES');
    expect(out).toContain('ASPECTS');
    expect(out).toContain('DIGNITIES');
    expect(out).toContain('ARABIC LOTS');
    expect(out).toContain('Sect:');

    // Dereceler biçimlendirilmiş gelmeli, çıplak float değil.
    expect(out).toMatch(/\d{2}°\d{2}'\d{2}" (Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)/);
  }, 60_000);

  /**
   * Bu testin asıl noktası: LLM açıları kendisi çıkarmak zorunda kalmasın.
   * Harita çıktısında gerçek açı satırları olmalı.
   */
  it('açılar hazır geliyor', async () => {
    const out = await call('natal_chart', NATAL);
    const aspectBlock = out.slice(out.indexOf('ASPECTS'));
    expect(aspectBlock).toMatch(/(Conjunction|Sextile|Square|Trine|Opposition)/);
    expect(aspectBlock).toMatch(/orb \d+°\d{2}'/);
  }, 60_000);

  /**
   * Liste GÜCE göre sıralı, orb'a göre değil: güç = (1 - orb/izin) × ağırlık,
   * ve sextile'ın ağırlığı 0.7. Yani sıkı bir sextile geniş bir kavuşumun
   * altına düşebiliyor. Sıralamayı söylemezsek "en sıkı açı hangisi" diye
   * sorulan model listenin başını okur ve yanlış cevap verir.
   */
  it('açı sıralamasını açıklıyor', async () => {
    const out = await call('natal_chart', NATAL);
    const block = out.slice(out.indexOf('ASPECTS'));
    expect(block).toContain('strongest first');
    expect(block).toMatch(/read the orb column/);

    // Notun gerçekten gerekli olduğunu da doğruluyoruz: liste orb'a göre
    // sıralı OLSAYDI not gereksiz olurdu ve sessizce bayatlardı.
    const orbs = [...block.matchAll(/orb (\d+)°(\d{2})'/g)]
      .map(([, d, m]) => Number(d) * 60 + Number(m));
    expect(orbs.length).toBeGreaterThan(5);
    expect(orbs.some((v, i) => i > 0 && v < orbs[i - 1])).toBe(true);
  }, 60_000);

  it('orb şeması sonucu değiştiriyor', async () => {
    const tight = await call('natal_chart', { ...NATAL, orb_scheme: 'tight' });
    const modern = await call('natal_chart', { ...NATAL, orb_scheme: 'modern' });
    const count = (s: string) =>
      (s.slice(s.indexOf('ASPECTS')).match(/orb \d+°/g) ?? []).length;
    expect(count(tight)).toBeLessThan(count(modern));
  }, 60_000);

  it('geçişleri hesaplıyor', async () => {
    const out = await call('transits', {
      natal_date: NATAL.date, natal_time: NATAL.time, natal_timezone: NATAL.timezone,
      latitude: ANKARA.latitude, longitude: ANKARA.longitude,
      transit_date: '2026-03-01',
    });
    expect(out).toContain('TRANSIT ASPECTS');
    // Geçiş noktaları t. öneki, natal olanlar n. öneki taşımalı.
    expect(out).toMatch(/t\.\w+/);
    expect(out).toMatch(/n\.\w+/);
  }, 60_000);

  /**
   * Aracın açıklaması "applying ya da separating olarak işaretlenmiş" diye söz
   * veriyor ve geçiş yorumunun bütün değeri o ayrımda. Natal tarafa
   * speed: undefined verildiğinde core hiç hesaplamıyordu ve 52 satırın 52'si
   * işaretsiz çıkıyordu — sessizce, çünkü eksik bir sütun hata vermez.
   */
  it('her geçiş satırı uygulanan/ayrılan taşıyor', async () => {
    const out = await call('transits', {
      natal_date: NATAL.date, natal_time: NATAL.time, natal_timezone: NATAL.timezone,
      latitude: ANKARA.latitude, longitude: ANKARA.longitude,
      transit_date: '2026-03-01',
    });
    const rows = out.split('\n').filter((l) => /orb \d+°\d{2}'/.test(l) && l.includes('t.'));
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(row, row).toMatch(/(applying|separating)$/);
    }
  }, 60_000);

  /**
   * Sinastride İKİ taraf da donmuş; uygulanan/ayrılan uydurmak olurdu.
   * Geçişin tam tersi karar, o yüzden ayrıca sınanıyor.
   */
  it('sinastride uygulanan/ayrılan İŞARETLENMİYOR', async () => {
    const out = await call('synastry', {
      a_date: '1990-05-15', a_time: '17:30', a_timezone: 'Europe/Istanbul',
      a_latitude: 39.93, a_longitude: 32.86,
      b_date: '1988-11-02', b_time: '08:15', b_timezone: 'Europe/Istanbul',
      b_latitude: 41.01, b_longitude: 28.98,
    });
    const rows = out.split('\n').filter((l) => /orb \d+°\d{2}'/.test(l) && l.startsWith('A.'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row, row).not.toMatch(/(applying|separating)/);
  }, 60_000);

  /**
   * En pahalı sessiz hata buydu: "Porphyry" geçen çağrı ilk harfi okunup
   * PLACIDUS hesaplıyor, üstelik başlığa "Porphyry" yazıyordu. İkinci ev ucu
   * 3.5° kayıyor ve çıktının hiçbir yerinde yanlış olduğuna dair iz yok.
   */
  it('ev sistemi adı doğru sisteme çözülüyor', async () => {
    const cusp = (t: string, n: number) =>
      (t.match(new RegExp(`House ${n}\\s+(\\S+ \\S+)`)) ?? [])[1];
    const byName = await call('natal_chart', { ...NATAL, house_system: 'Porphyry' });
    const byCode = await call('natal_chart', { ...NATAL, house_system: 'O' });
    const placidus = await call('natal_chart', { ...NATAL, house_system: 'P' });

    expect(cusp(byName, 2)).toBe(cusp(byCode, 2));
    expect(cusp(byName, 2)).not.toBe(cusp(placidus, 2));
    expect(byName).toContain('HOUSES — Porphyry (O)');

    // "whole sign" gibi konuşma dilindeki biçimler de tutmalı.
    const whole = await call('natal_chart', { ...NATAL, house_system: 'whole sign' });
    expect(whole).toContain('(W)');
  }, 60_000);

  it('tanınmayan ev sistemi sessizce ikame edilmiyor', async () => {
    const result = await client.callTool({
      name: 'natal_chart',
      arguments: { ...NATAL, house_system: 'Vedic' },
    });
    expect(result.isError).toBe(true);
    const content = result.content as { text: string }[];
    expect(content[0].text).toMatch(/was not recognised/);
  }, 60_000);

  /**
   * Yarım koordinat, koordinat değil. Enlem verilip boylam verilmediğinde
   * sessizce KÜRESEL aramaya düşüyordu: "İstanbul'dan görünen tutulma"
   * sorusuna yalnızca Antarktika'dan görünen tutulmayla cevap veriyordu.
   */
  it('tutulmada yarım koordinat reddediliyor', async () => {
    const result = await client.callTool({
      name: 'eclipses',
      arguments: { kind: 'solar', after_date: '2026-01-01', latitude: 41.0 },
    });
    expect(result.isError).toBe(true);
    const content = result.content as { text: string }[];
    expect(content[0].text).toMatch(/BOTH latitude and longitude/);
  }, 60_000);

  /**
   * riseTransit ileri doğru arıyor. Ay bazı günler hiç doğmuyor ve bir sonraki
   * doğuş dönüyor: 14 Mayıs 1990 Ankara'da Ay doğmuyor. Çıplak saat yazınca
   * iki farklı gün aynı satırı üretiyordu.
   */
  it('istenen güne ait olmayan olay tarihiyle işaretleniyor', async () => {
    const out = await call('rise_set', {
      date: '1990-05-14', timezone: 'Europe/Istanbul',
      latitude: ANKARA.latitude, longitude: ANKARA.longitude, bodies: ['moon'],
    });
    expect(out).toMatch(/rise \d{2}:\d{2} local on 1990-05-15/);

    // Aynı olay 15 Mayıs istendiğinde tarihsiz, çünkü o gün gerçekten oluyor.
    const same = await call('rise_set', {
      date: '1990-05-15', timezone: 'Europe/Istanbul',
      latitude: ANKARA.latitude, longitude: ANKARA.longitude, bodies: ['moon'],
    });
    expect(same).toMatch(/rise 00:12 local {2}·/);
  }, 60_000);

  /**
   * Araç açıklaması gezegen saatlerini vaat ediyordu, çıktı hiç üretmiyordu.
   * İki nüans sınanıyor: saatler EŞİT DEĞİL, ve gezegen günü DOĞUŞTA başlıyor
   * (15 Mayıs 1990 Salı → Mars).
   */
  it('gezegen saatlerini veriyor', async () => {
    const out = await call('rise_set', {
      date: '1990-05-15', timezone: 'Europe/Istanbul',
      latitude: ANKARA.latitude, longitude: ANKARA.longitude,
    });
    expect(out).toContain('PLANETARY HOURS — Tuesday, ruler of the day Mars');

    // Kaldeli sıra Mars'tan: Mars, Güneş, Venüs, Merkür, Ay, Satürn, Jüpiter.
    expect(out).toMatch(/1 Mars \d{2}:\d{2} · 2 Sun \d{2}:\d{2} · 3 Venus/);

    // Mayıs'ta Ankara'da gündüz saati geceden belirgin uzun olmalı.
    const day = Number((out.match(/Day hours   \(each (\d+) min\)/) ?? [])[1]);
    const night = Number((out.match(/Night hours \(each (\d+) min/) ?? [])[1]);
    expect(day).toBeGreaterThan(night);
    expect(day + night).toBeCloseTo(120, 0);   // ikisi toplam 2 saat eder
  }, 60_000);

  /**
   * Paylaşılan zod nesnesi ikinci kez kullanılınca zod-to-json-schema $ref
   * üretiyor ve o alanın TİPİ ile AÇIKLAMASI şemadan düşüyor — modelin
   * "boylam DOĞU pozitif" uyarısını tam da en çok gerektiği yerde kaybetmesi
   * demek. Alan şekilleri bu yüzden fabrika.
   */
  it('şemada $ref yok, her alan kendi açıklamasını taşıyor', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const props = (tool.inputSchema as { properties: Record<string, unknown> }).properties;
      for (const [name, shape] of Object.entries(props)) {
        expect(shape, `${tool.name}.${name}`).not.toHaveProperty('$ref');
        expect(shape, `${tool.name}.${name}`).toHaveProperty('description');
      }
    }
  }, 60_000);

  /** Şemada duran ama hiç okunmayan zorunlu alan, modele yalan söylüyor. */
  it('return_chart ölü natal koordinat istemiyor', async () => {
    const { tools } = await client.listTools();
    const ret = tools.find((t) => t.name === 'return_chart')!;
    const required = (ret.inputSchema as { required: string[] }).required;
    expect(required).not.toContain('natal_latitude');
    expect(required).not.toContain('natal_longitude');
  }, 60_000);

  it('güneş dönüşü buluyor', async () => {
    const out = await call('return_chart', {
      natal_date: NATAL.date, natal_time: NATAL.time, natal_timezone: NATAL.timezone,
      natal_latitude: ANKARA.latitude, natal_longitude: ANKARA.longitude,
      kind: 'solar', after_date: '2026-01-01',
      latitude: ANKARA.latitude, longitude: ANKARA.longitude,
    });
    expect(out).toContain('SOLAR RETURN');
    // Doğum günü civarı olmalı.
    expect(out).toMatch(/2026-05-1\d/);
  }, 60_000);

  it('bilinen tutulmayı buluyor', async () => {
    const out = await call('eclipses', { kind: 'solar', after_date: '2017-08-01' });
    expect(out).toContain('SOLAR ECLIPSE');
    expect(out).toContain('total');
    expect(out).toContain('2017-08-21');
  }, 60_000);

  /**
   * Yerel tutulma aramasının tip süzgeci yok. Sessizce yok saymak yerine
   * hata veriyoruz — "buradaki bir sonraki TAM tutulma" isteyip parçalı
   * almak fark edilmezdi.
   */
  it('yerel arama + tip süzgeci açıkça reddediliyor', async () => {
    const result = await client.callTool({
      name: 'eclipses',
      arguments: { kind: 'solar', after_date: '2017-08-01', type: 'total',
                   latitude: 39.93, longitude: 32.86 },
    });
    expect(result.isError).toBe(true);
    const content = result.content as { text: string }[];
    expect(content[0].text).toMatch(/no type filter/);
  }, 60_000);

  it('doğuş ve batış veriyor', async () => {
    const out = await call('rise_set', {
      date: '1990-05-15', timezone: 'Europe/Istanbul',
      latitude: ANKARA.latitude, longitude: ANKARA.longitude,
    });
    expect(out).toContain('RISE / SET');
    expect(out).toMatch(/rise \d{2}:\d{2} local/);
  }, 60_000);

  /** Kutup gecesi hata değil; "YOK" diye raporlanmalı. */
  it('kutupta batmayan Güneş hata vermiyor', async () => {
    const out = await call('rise_set', {
      date: '2020-06-21', timezone: 'UTC', latitude: 80, longitude: 20,
    });
    expect(out).toContain('set NONE');
    expect(out).toContain('planetary hours are undefined');
  }, 60_000);

  it('zaman efendilerini veriyor', async () => {
    const out = await call('time_lords', {
      natal_date: NATAL.date, natal_time: NATAL.time, natal_timezone: NATAL.timezone,
      latitude: ANKARA.latitude, longitude: ANKARA.longitude,
      target_date: '2026-03-01',
    });
    expect(out).toContain('PROFECTION');
    expect(out).toContain('FIRDARIA');
    expect(out).toMatch(/Age: 3[0-9]/);
    expect(out).toMatch(/house \d+/);
  }, 60_000);

  it('deklinasyon ve sınır dışı veriyor', async () => {
    const out = await call('declinations', {
      date: '2006-09-15', time: '12:00', timezone: 'UTC',
    });
    expect(out).toContain('DECLINATIONS');
    expect(out).toContain('PARALLELS');
    expect(out).toContain('OUT OF BOUNDS');
    expect(out).toMatch(/Obliquity \(of the date\): 23\.4/);
  }, 60_000);

  it('sinastri yalnızca çapraz çiftleri veriyor', async () => {
    const out = await call('synastry', {
      a_date: '1990-05-15', a_time: '17:30', a_timezone: 'Europe/Istanbul',
      a_latitude: 39.93, a_longitude: 32.86,
      b_date: '1988-11-02', b_time: '08:15', b_timezone: 'Europe/Istanbul',
      b_latitude: 41.01, b_longitude: 28.98,
    });
    expect(out).toContain('SYNASTRY ASPECTS');
    const block = out.slice(out.indexOf('SYNASTRY ASPECTS'));
    // Yalnızca açı SATIRLARI: başlıktaki sıralama notu da "orb" kelimesini
    // taşıyor, o yüzden gevşek bir includes('orb') değil satır biçimi aranıyor.
    const rows = block.split('\n').filter((l) => /orb \d+°\d{2}'/.test(l));
    expect(rows.length).toBeGreaterThan(0);
    for (const line of rows) {
      expect(line.startsWith('A.'), line).toBe(true);
      expect(line).toMatch(/B\./);
    }
  }, 60_000);

  it('bozuk saat dilimi anlaşılır hata döndürüyor', async () => {
    const result = await client.callTool({
      name: 'natal_chart',
      arguments: { ...NATAL, timezone: 'Bilinmeyen/Yer' },
    });
    expect(result.isError).toBe(true);
    const content = result.content as { text: string }[];
    expect(content[0].text).toMatch(/not recognised/);
  }, 60_000);
});
