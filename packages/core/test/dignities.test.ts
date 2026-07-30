import { describe, expect, it } from 'vitest';
import {
  DOMICILE, EXALTATION, FACES, MODERN_RULERS, TRADITIONAL_RULERS,
  elementOf, evaluateDignities, rulerOfSign, termsOfSign,
} from '../src/derived/dignities.js';
import { Body, SIGNS } from '../src/constants.js';

describe('tablo bütünlüğü', () => {
  it('her burcun bir ev sahibi var', () => {
    expect(DOMICILE).toHaveLength(12);
    for (const ruler of DOMICILE) {
      expect(TRADITIONAL_RULERS).toContain(ruler);
    }
  });

  /**
   * Klasik şema: Güneş ve Ay birer burç, diğer beş gezegen ikişer burç
   * yönetir. Bir sapma tabloda yazım hatası demektir.
   */
  it('Güneş ve Ay birer, diğerleri ikişer burç yönetiyor', () => {
    const counts = new Map<number, number>();
    for (const ruler of DOMICILE) counts.set(ruler, (counts.get(ruler) ?? 0) + 1);
    expect(counts.get(Body.Sun)).toBe(1);
    expect(counts.get(Body.Moon)).toBe(1);
    for (const body of [Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn]) {
      expect(counts.get(body), `${body}`).toBe(2);
    }
  });

  it('modern atamalar yalnızca üç burçta ayrılıyor', () => {
    const differing = DOMICILE
      .map((r, i) => (r === MODERN_RULERS[i] ? null : i))
      .filter((i) => i !== null);
    expect(differing).toEqual([7, 10, 11]);   // Akrep, Kova, Balık
    expect(MODERN_RULERS[7]).toBe(Body.Pluto);
    expect(MODERN_RULERS[10]).toBe(Body.Uranus);
    expect(MODERN_RULERS[11]).toBe(Body.Neptune);
  });

  it('yedi klasik gezegenin yücelmesi tanımlı', () => {
    for (const body of TRADITIONAL_RULERS) {
      expect(EXALTATION[body], `${body}`).toBeTypeOf('number');
      expect(EXALTATION[body]).toBeGreaterThanOrEqual(0);
      expect(EXALTATION[body]).toBeLessThan(360);
    }
  });

  it('bilinen yücelme dereceleri', () => {
    expect(EXALTATION[Body.Sun]).toBe(19);        // 19° Koç
    expect(EXALTATION[Body.Moon]).toBe(33);       // 3° Boğa
    expect(EXALTATION[Body.Jupiter]).toBe(105);   // 15° Yengeç
    expect(EXALTATION[Body.Saturn]).toBe(201);    // 21° Terazi
  });
});

describe('sınırlar (Mısır)', () => {
  it('her burçta beş bölüm var ve 30°yi tam kapsıyor', () => {
    for (let sign = 0; sign < 12; sign++) {
      const bounds = termsOfSign(sign);
      expect(bounds, SIGNS[sign]).toHaveLength(5);
      expect(bounds[0].from).toBe(0);
      expect(bounds[4].to).toBe(30);
      // Bölümler bitişik olmalı — boşluk ya da örtüşme yazım hatasıdır.
      for (let i = 1; i < 5; i++) {
        expect(bounds[i].from, `${SIGNS[sign]} ${i}`).toBe(bounds[i - 1].to);
      }
    }
  });

  it('bir burçtaki sınır yöneticileri tekrar etmiyor', () => {
    for (let sign = 0; sign < 12; sign++) {
      const rulers = termsOfSign(sign).map((b) => b.ruler);
      expect(new Set(rulers).size, SIGNS[sign]).toBe(5);
    }
  });

  it('Işıklar sınır yöneticisi olmuyor', () => {
    // Mısır sınırlarında Güneş ve Ay yer almaz — yalnızca beş gezegen.
    for (let sign = 0; sign < 12; sign++) {
      for (const { ruler } of termsOfSign(sign)) {
        expect(ruler === Body.Sun || ruler === Body.Moon, SIGNS[sign]).toBe(false);
      }
    }
  });
});

describe('yüzler (dekanlar)', () => {
  it('36 yüz var', () => {
    expect(FACES).toHaveLength(36);
  });

  /**
   * Yüzler Keldani sırasında kesintisiz döner. Tabloyu elle yazmak yerine
   * diziden ürettiğimiz için bu test aslında üretimin doğruluğunu sınıyor.
   */
  it('Keldani sırası kesintisiz tekrar ediyor', () => {
    const chaldean = [Body.Saturn, Body.Jupiter, Body.Mars, Body.Sun,
                      Body.Venus, Body.Mercury, Body.Moon];
    const start = chaldean.indexOf(FACES[0]);
    for (let i = 0; i < 36; i++) {
      expect(FACES[i], `yüz ${i}`).toBe(chaldean[(start + i) % 7]);
    }
  });

  it('Koç\'un ilk yüzü Mars', () => {
    expect(FACES[0]).toBe(Body.Mars);
  });
});

describe('evaluateDignities', () => {
  it('Güneş Aslan\'da ev sahibi', () => {
    const r = evaluateDignities(Body.Sun, 135, 'day');   // 15° Aslan
    expect(r.sign).toBe('Leo');
    expect(r.dignities).toContain('domicile');
    expect(r.score).toBeGreaterThanOrEqual(5);
  });

  it('Güneş Kova\'da zararda', () => {
    const r = evaluateDignities(Body.Sun, 315, 'day');   // 15° Kova
    expect(r.dignities).toContain('detriment');
    expect(r.score).toBeLessThan(0);
  });

  it('Güneş Koç\'ta yücelmede', () => {
    const r = evaluateDignities(Body.Sun, 19, 'day');
    expect(r.dignities).toContain('exaltation');
  });

  it('Güneş Terazi\'de düşüşte', () => {
    const r = evaluateDignities(Body.Sun, 199, 'day');
    expect(r.dignities).toContain('fall');
  });

  it('üçlü yönetici sekte göre değişiyor', () => {
    // Ateş üçlüsü: gündüz Güneş, gece Jüpiter.
    expect(evaluateDignities(Body.Sun, 135, 'day').triplicityRuler).toBe(Body.Sun);
    expect(evaluateDignities(Body.Sun, 135, 'night').triplicityRuler).toBe(Body.Jupiter);
  });

  it('hiçbir onuru olmayan cisim peregrine', () => {
    // Ay, Koç\'un 25. derecesinde: ev sahibi Mars, yücelme Güneş,
    // üçlü Güneş (gündüz), sınır Mars, yüz Venüs -> Ay hiçbirinde yok.
    const r = evaluateDignities(Body.Moon, 25, 'day');
    expect(r.dignities).toEqual(['peregrine']);
    expect(r.score).toBe(0);
  });

  it('sınır yöneticisi derece ile değişiyor', () => {
    // Koç: Jüpiter 0-6, Venüs 6-12, Merkür 12-20, Mars 20-25, Satürn 25-30
    expect(evaluateDignities(Body.Sun, 3, 'day').termRuler).toBe(Body.Jupiter);
    expect(evaluateDignities(Body.Sun, 8, 'day').termRuler).toBe(Body.Venus);
    expect(evaluateDignities(Body.Sun, 15, 'day').termRuler).toBe(Body.Mercury);
    expect(evaluateDignities(Body.Sun, 22, 'day').termRuler).toBe(Body.Mars);
    expect(evaluateDignities(Body.Sun, 28, 'day').termRuler).toBe(Body.Saturn);
  });

  it('yüz yöneticisi 10°lik dilimlerle değişiyor', () => {
    expect(evaluateDignities(Body.Sun, 5, 'day').faceRuler).toBe(Body.Mars);
    expect(evaluateDignities(Body.Sun, 15, 'day').faceRuler).toBe(Body.Sun);
    expect(evaluateDignities(Body.Sun, 25, 'day').faceRuler).toBe(Body.Venus);
  });

  it('burç sınırlarında ve negatif boylamda kırılmıyor', () => {
    for (const lon of [0, 29.9999, 30, 359.9999, -1, 720.5]) {
      const r = evaluateDignities(Body.Mars, lon, 'day');
      expect(r.longitude).toBeGreaterThanOrEqual(0);
      expect(r.longitude).toBeLessThan(360);
      expect(r.degreeInSign).toBeGreaterThanOrEqual(0);
      expect(r.degreeInSign).toBeLessThan(30);
      expect(r.dignities.length).toBeGreaterThan(0);
    }
  });

  it('her burçta klasik yedilinin tamamı değerlendirilebiliyor', () => {
    for (let sign = 0; sign < 12; sign++) {
      for (const body of TRADITIONAL_RULERS) {
        const r = evaluateDignities(body, sign * 30 + 15, 'day');
        expect(r.dignities.length, `${SIGNS[sign]} ${body}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('rulerOfSign', () => {
  it('geleneksel ve modern', () => {
    expect(rulerOfSign(4)).toBe(Body.Sun);              // Aslan
    expect(rulerOfSign(7)).toBe(Body.Mars);             // Akrep, geleneksel
    expect(rulerOfSign(7, true)).toBe(Body.Pluto);      // Akrep, modern
  });
});

describe('elementOf', () => {
  it('elementler dörtlü döngüde', () => {
    expect(elementOf(0)).toBe(0);   // Koç, ateş
    expect(elementOf(4)).toBe(0);   // Aslan, ateş
    expect(elementOf(8)).toBe(0);   // Yay, ateş
    expect(elementOf(1)).toBe(1);   // Boğa, toprak
    expect(elementOf(3)).toBe(3);   // Yengeç, su
  });
});
