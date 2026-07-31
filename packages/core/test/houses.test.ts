import { describe, expect, it } from 'vitest';
import { assignHouses, houseOf } from '../src/derived/houses.js';

/**
 * Ankara, 1990-05-15 14:30 UT — Placidus. Gerçek kütüphane çıktısı.
 * Eşit olmayan genişlikler (23.6°'den 34.5°'ye) tam da bu testin konusu:
 * `floor((boylam − Yükselen) / 30)` kestirmesi burada çöker.
 */
const PLACIDUS = [
  206.622387138, 234.653967620, 266.641695688, 301.190219002,
  334.349890317, 3.000203066, 26.622387138, 54.653967620,
  86.641695688, 121.190219002, 154.349890317, 183.000203066,
];

/** Aynı harita, whole sign — birinci ev 0° Terazi. */
const WHOLE_SIGN = [180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120, 150];

describe('houseOf', () => {
  it('her ev ucu KENDİ evini veriyor', () => {
    // Sınırda oturan bir cismin bir önceki eve düşmesi, tam da bu
    // fonksiyonun var olma sebebi olan sessiz hata.
    for (let i = 0; i < 12; i++) {
      expect(houseOf(PLACIDUS[i], PLACIDUS)).toBe(i + 1);
    }
  });

  it('her evin orta noktası o evde', () => {
    const norm = (d: number) => ((d % 360) + 360) % 360;
    for (let i = 0; i < 12; i++) {
      const width = norm(PLACIDUS[(i + 1) % 12] - PLACIDUS[i]);
      expect(houseOf(norm(PLACIDUS[i] + width / 2), PLACIDUS)).toBe(i + 1);
    }
  });

  it('0/360 sarmasını geçen evi doğru buluyor', () => {
    // 5. ev 334.35°'de başlayıp 3.00°'de bitiyor: Koç noktasının üstünden.
    expect(houseOf(350, PLACIDUS)).toBe(5);
    expect(houseOf(359.999, PLACIDUS)).toBe(5);
    expect(houseOf(0, PLACIDUS)).toBe(5);
    expect(houseOf(2.9, PLACIDUS)).toBe(5);
    expect(houseOf(3.1, PLACIDUS)).toBe(6);
  });

  it('boylamı önce normalize ediyor', () => {
    expect(houseOf(350 + 360, PLACIDUS)).toBe(5);
    expect(houseOf(350 - 720, PLACIDUS)).toBe(5);
    expect(houseOf(-10, PLACIDUS)).toBe(5);
  });

  it('hiçbir boylam boşta kalmıyor', () => {
    for (let d = 0; d < 360; d += 0.125) {
      const house = houseOf(d, PLACIDUS);
      expect(house).toBeGreaterThanOrEqual(1);
      expect(house).toBeLessThanOrEqual(12);
    }
  });

  it('eşit olmayan genişlikleri 30° varsaymıyor', () => {
    // Yükselen'den 30° ileride olmak 2. ev demek DEĞİL: 2. ev 28.03°'de
    // başlıyor, yani 30° zaten oranın içinde — ama 3. ev 60.03°'de başladığı
    // için 62° hâlâ 2. evde. 30'a bölen kestirme burada 3 derdi.
    expect(houseOf(206.622387138 + 30, PLACIDUS)).toBe(2);
    expect(houseOf(206.622387138 + 62, PLACIDUS)).toBe(3);
    expect(houseOf(206.622387138 + 59, PLACIDUS)).toBe(2);
  });

  it('whole sign ile çalışıyor ve MC 10. evde OLMAYABİLİR', () => {
    expect(houseOf(180, WHOLE_SIGN)).toBe(1);
    expect(houseOf(206.62, WHOLE_SIGN)).toBe(1);      // Yükselen 1. evin içinde
    expect(houseOf(121.19, WHOLE_SIGN)).toBe(11);     // MC 11. evde
  });

  it('12 uç değilse reddediyor — Gauquelin sektörü ev değildir', () => {
    expect(() => houseOf(10, new Array(36).fill(0)))
      .toThrow(/Gauquelin sectors are not houses/);
    expect(() => houseOf(10, [0, 30, 60])).toThrow(/needs twelve cusps/);
  });

  it('burç yönünde sıralı olmayan uçları reddediyor', () => {
    // Ters sıralı bir dizide arama sessizce her cismi 1. eve koyardı.
    const reversed = [...PLACIDUS].reverse();
    expect(() => houseOf(10, reversed)).toThrow(/do not cover the circle once/);
  });
});

describe('assignHouses', () => {
  it('bir küme noktayı tek seferde yerleştiriyor', () => {
    const points = [
      { name: 'Sun', longitude: 54.4966 },
      { name: 'Moon', longitude: 298.4501 },
      { name: 'Mars', longitude: 348.4112 },
    ];
    const placed = assignHouses(points, PLACIDUS, (p) => p.longitude);
    expect(placed.map((p) => p.house)).toEqual([7, 3, 5]);
    expect(placed[0].point.name).toBe('Sun');
  });
});
