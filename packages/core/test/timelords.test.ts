import { describe, expect, it } from 'vitest';
import {
  EGYPTIAN_YEAR, FIRDARIA_CYCLE_YEARS, FIRDARIA_DIURNAL, FIRDARIA_NOCTURNAL,
  firdaria, firdariaAt, profection, TROPICAL_YEAR,
} from '../src/derived/timelords.js';
import { findParans, eventSeparationMinutes } from '../src/derived/parans.js';
import { Body } from '../src/constants.js';

const NATAL = 2448027.104167;   // 1990-05-15 14:30 UT
const ARIES_15 = 15;            // 15° Koç yükselen

describe('profeksiyon', () => {
  it('doğumda birinci ev, yükselenin burcu', () => {
    const p = profection(NATAL, NATAL, ARIES_15);
    expect(p.age).toBe(0);
    expect(p.house).toBe(1);
    expect(p.sign).toBe('Aries');
    expect(p.lord).toBe(Body.Mars);
  });

  it('her yıl bir burç ilerliyor', () => {
    const oneYear = profection(NATAL, NATAL + TROPICAL_YEAR, ARIES_15);
    expect(oneYear.age).toBe(1);
    expect(oneYear.house).toBe(2);
    expect(oneYear.sign).toBe('Taurus');
    expect(oneYear.lord).toBe(Body.Venus);
  });

  it('on ikinci yıl başa dönüyor', () => {
    const p = profection(NATAL, NATAL + 12 * TROPICAL_YEAR, ARIES_15);
    expect(p.age).toBe(12);
    expect(p.house).toBe(1);
    expect(p.sign).toBe('Aries');
  });

  it('yıl uzunluğu sonucu değiştirebiliyor', () => {
    // 30 tropik yıl sonrası Mısır yılıyla 30 değil 30. yılın epey içinde:
    // 365.2422 ile 365 arasındaki fark 30 yılda 7 günü aşıyor.
    const jd = NATAL + 30 * TROPICAL_YEAR;
    expect(profection(NATAL, jd, ARIES_15).age).toBe(30);
    expect(profection(NATAL, jd, ARIES_15, { yearLength: EGYPTIAN_YEAR }).age).toBe(30);
    // Yıl kesri farkı görünür: Mısır yılıyla yılın içinde daha ilerideyiz.
    expect(profection(NATAL, jd, ARIES_15, { yearLength: EGYPTIAN_YEAR }).yearFraction)
      .toBeGreaterThan(profection(NATAL, jd, ARIES_15).yearFraction);
  });

  it('modern yöneticiler seçilebiliyor', () => {
    // Yükselen Akrep: geleneksel Mars, modern Plüton.
    const traditional = profection(NATAL, NATAL, 220);
    const modern = profection(NATAL, NATAL, 220, { modernRulers: true });
    expect(traditional.sign).toBe('Scorpio');
    expect(traditional.lord).toBe(Body.Mars);
    expect(modern.lord).toBe(Body.Pluto);
  });

  it('aylık profeksiyon yıl içinde ilerliyor', () => {
    const start = profection(NATAL, NATAL + 1, ARIES_15);
    expect(start.month.index).toBe(1);
    expect(start.month.sign).toBe('Aries');

    // Yılın tam ortası: altıncı ay.
    const middle = profection(NATAL, NATAL + TROPICAL_YEAR / 2, ARIES_15);
    expect(middle.month.index).toBe(7);
    expect(middle.month.sign).toBe('Libra');
  });

  it('günlük profeksiyon ay içinde ilerliyor', () => {
    const p = profection(NATAL, NATAL + TROPICAL_YEAR / 12 / 2, ARIES_15);
    expect(p.month.index).toBe(1);
    expect(p.day.index).toBe(7);
  });

  it('yaş elle geçilebiliyor', () => {
    const p = profection(NATAL, NATAL, ARIES_15, { age: 40 });
    expect(p.age).toBe(40);
    expect(p.house).toBe(5);   // 40 mod 12 = 4
  });

  it('yıl kesri her zaman [0, 1)', () => {
    for (let d = 0; d < 4000; d += 37) {
      const f = profection(NATAL, NATAL + d, ARIES_15).yearFraction;
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  /*
   * house alanı MUTLAK ev olmalı — üç birimde de.
   *
   * Eskiden `mod(steps, 12) + 1` idi ve `steps` üç birim için farklı şeyler
   * demekti: yıl için yaş, ay için yıl içindeki sıra, gün için ay içindeki
   * sıra. Yani month.house/day.house ev değil sıra numarasıydı.
   *
   * Yukarıdaki testlerin bunu görmemesinin sebebi fixture: 15° KOÇ yükselen,
   * yani natal burç indeksi 0. O durumda mod(signIndex − 0, 12) + 1 ile
   * signIndex + 1 çakışıyor ve hata görünmez oluyor. Bu blok bilinçli olarak
   * Koç DIŞI bir yükselen kullanıyor.
   */
  describe('house alanı natal Yükselen\'den sayılıyor', () => {
    const CANCER_10 = 100;          // 10° Yengeç → burç indeksi 3
    const ascSign = 3;

    /** Bir burcun natal Yükselen'e göre mutlak evi. */
    const absoluteHouse = (signIndex: number) => ((signIndex - ascSign) % 12 + 12) % 12 + 1;

    it('yıl, ay ve gün için house === burcun mutlak evi', () => {
      // Denetimde ölçülen özgün vaka: 30 yıl + 0.05 sonrası.
      const p = profection(NATAL, NATAL + 30.05 * TROPICAL_YEAR, CANCER_10);
      for (const unit of [p, p.month, p.day]) {
        expect(unit.house).toBe(absoluteHouse(unit.signIndex));
      }
      // Somut değerler: Oğlak natal 7. ev. Eskiden month.house 1 diyordu.
      expect(p.sign).toBe('Capricorn');
      expect(p.house).toBe(7);
      expect(p.month.sign).toBe('Capricorn');
      expect(p.month.house).toBe(7);
      expect(p.day.house).toBe(absoluteHouse(p.day.signIndex));
    });

    /** Sıra numarası ile ev artık AYRI alanlarda; ikisi de kaybolmuyor. */
    it('index sıra numarasını, house evi taşıyor', () => {
      const p = profection(NATAL, NATAL + 30.05 * TROPICAL_YEAR, CANCER_10);
      expect(p.month.index).toBe(1);        // yılın birinci ayı
      expect(p.month.house).toBe(7);        // ama natal 7. evde
      expect(p.month.index).not.toBe(p.month.house);
    });

    it('geniş taramada üç birim de değişmezi koruyor', () => {
      for (const asc of [0, 45, 100, 190, 275, 359.9]) {
        const sign = Math.floor(((asc % 360) + 360) % 360 / 30);
        const houseOf = (i: number) => ((i - sign) % 12 + 12) % 12 + 1;
        for (let d = 0; d < 30000; d += 313) {
          const p = profection(NATAL, NATAL + d, asc);
          for (const unit of [p, p.month, p.day]) {
            expect(unit.house).toBe(houseOf(unit.signIndex));
            expect(unit.house).toBeGreaterThanOrEqual(1);
            expect(unit.house).toBeLessThanOrEqual(12);
          }
        }
      }
    });

    it('doğum anında üçü de birinci ev', () => {
      const p = profection(NATAL, NATAL, CANCER_10);
      expect([p.house, p.month.house, p.day.house]).toEqual([1, 1, 1]);
      expect([p.sign, p.month.sign, p.day.sign])
        .toEqual(['Cancer', 'Cancer', 'Cancer']);
    });

    /** lord her zaman house'un değil, signIndex'in yöneticisi olmalı. */
    it('lord, burcun yöneticisi olmayı sürdürüyor', () => {
      const p = profection(NATAL, NATAL + 30.05 * TROPICAL_YEAR, CANCER_10);
      // Oğlak → Satürn (geleneksel).
      expect(p.lord).toBe(Body.Saturn);
      expect(p.month.lord).toBe(Body.Saturn);
    });
  });
});

describe('firdaria', () => {
  it('dizi 75 yıl ve dokuz dönem', () => {
    for (const order of [FIRDARIA_DIURNAL, FIRDARIA_NOCTURNAL]) {
      expect(order).toHaveLength(9);
      expect(order.reduce((sum, s) => sum + s.years, 0)).toBe(FIRDARIA_CYCLE_YEARS);
    }
  });

  it('gündüz Güneş ile, gece Ay ile başlıyor', () => {
    expect(firdaria(NATAL, 'day')[0].lord).toBe('Sun');
    expect(firdaria(NATAL, 'night')[0].lord).toBe('Moon');
  });

  it('dönemler kesintisiz ve sıralı', () => {
    const periods = firdaria(NATAL, 'day');
    expect(periods[0].startJd).toBe(NATAL);
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i].startJd).toBeCloseTo(periods[i - 1].endJd, 9);
    }
  });

  it('iki devir varsayılan, toplam 150 yıl', () => {
    const periods = firdaria(NATAL, 'day');
    expect(periods).toHaveLength(18);
    expect(periods[periods.length - 1].endJd - NATAL)
      .toBeCloseTo(2 * FIRDARIA_CYCLE_YEARS * TROPICAL_YEAR, 6);
  });

  it('gezegen dönemleri yedi eşit alt döneme bölünüyor', () => {
    const sun = firdaria(NATAL, 'day')[0];
    expect(sun.sub).toHaveLength(7);
    expect(sun.sub![0].lord).toBe('Sun');       // kendi dönemiyle başlıyor
    expect(sun.sub![1].lord).toBe('Venus');     // dizideki sıradaki
    for (const s of sun.sub!) {
      expect(s.years).toBeCloseTo(10 / 7, 9);
    }
    expect(sun.sub![6].endJd).toBeCloseTo(sun.endJd, 6);
  });

  it('alt dönem dizisi düğümleri atlıyor', () => {
    // Mars gündüz dizisinin son gezegeni; alt dönemleri başa sarmalı.
    const mars = firdaria(NATAL, 'day').find((p) => p.lord === 'Mars')!;
    expect(mars.sub!.map((s) => s.lord))
      .toEqual(['Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter']);
  });

  it('düğüm dönemlerinin alt dönemi yok', () => {
    const periods = firdaria(NATAL, 'day');
    for (const lord of ['NorthNode', 'SouthNode'] as const) {
      expect(periods.find((p) => p.lord === lord)!.sub).toBeUndefined();
    }
  });

  it('güney düğümünün cisim karşılığı yok', () => {
    const south = firdaria(NATAL, 'day').find((p) => p.lord === 'SouthNode')!;
    expect(south.body).toBeNull();
    expect(firdaria(NATAL, 'day').find((p) => p.lord === 'Sun')!.body).toBe(Body.Sun);
  });

  it('belirli bir anın efendilerini veriyor', () => {
    // Gündüz doğum: ilk 10 yıl Güneş. 5. yıl Güneş'in ortasında.
    const at5 = firdariaAt(NATAL, 'day', NATAL + 5 * TROPICAL_YEAR)!;
    expect(at5.major.lord).toBe('Sun');
    expect(at5.ageYears).toBeCloseTo(5, 6);

    // 10 yılın hemen ötesi Venüs.
    const at11 = firdariaAt(NATAL, 'day', NATAL + 11 * TROPICAL_YEAR)!;
    expect(at11.major.lord).toBe('Venus');
  });

  it('alt dönem efendisi doğru', () => {
    // Güneş dönemi 10 yıl, alt dönemler 10/7 = 1.4286 yıl.
    // 2. yıl ikinci alt dönemin (Venüs) içinde.
    const at2 = firdariaAt(NATAL, 'day', NATAL + 2 * TROPICAL_YEAR)!;
    expect(at2.major.lord).toBe('Sun');
    expect(at2.minor?.lord).toBe('Venus');
  });

  it('düğüm döneminde alt efendi yok', () => {
    // Gündüz dizisinde düğümler 70-75 arası.
    const at71 = firdariaAt(NATAL, 'day', NATAL + 71 * TROPICAL_YEAR)!;
    expect(at71.major.lord).toBe('NorthNode');
    expect(at71.minor).toBeNull();
  });

  it('devirlerin dışında null', () => {
    expect(firdariaAt(NATAL, 'day', NATAL + 200 * TROPICAL_YEAR)).toBeNull();
    expect(firdariaAt(NATAL, 'day', NATAL - 1)).toBeNull();
  });

  it('yıl uzunluğu tüm sınırları kaydırıyor', () => {
    const tropical = firdaria(NATAL, 'day');
    const egyptian = firdaria(NATAL, 'day', { yearLength: EGYPTIAN_YEAR });
    expect(egyptian[0].endJd).toBeLessThan(tropical[0].endJd);
    // 10 yılda fark 2.4 günü aşıyor — bir alt dönem sınırını kaydırmaya yeter.
    expect(tropical[0].endJd - egyptian[0].endJd).toBeCloseTo(10 * 0.242190, 4);
  });
});

// --- paran eşleştirme (saf kısım) ---------------------------------------

describe('paran eşleştirme', () => {
  const obj = (name: string, events: Record<string, number>) =>
    ({ name, events } as Parameters<typeof findParans>[0][number]);

  it('eşzamanlı olayları buluyor', () => {
    const found = findParans([
      obj('Sun', { rise: 2448027.25 }),
      obj('Sirius', { culminate: 2448027.25 }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].orbMinutes).toBeCloseTo(0, 9);
    expect(found[0].strength).toBe(1);
  });

  it('orb dışını bulmuyor', () => {
    const objects = [
      obj('Sun', { rise: 2448027.25 }),
      obj('Sirius', { culminate: 2448027.25 + 1 / 24 }),   // 60 dakika
    ];
    expect(findParans(objects, { orbMinutes: 30 })).toHaveLength(0);
    expect(findParans(objects, { orbMinutes: 90 })).toHaveLength(1);
  });

  /**
   * Olaylar günde bir tekrarlıyor. 23:50'deki doğuş ile ertesi 00:10'daki
   * kültminasyon arasında 20 dakika var, 23 saat değil — ham Jülyen günü
   * karşılaştırsaydık pencere sınırını aşan her paranı kaçırırdık.
   */
  it('gün sınırını doğru geçiyor', () => {
    // 5 basamak: 2.45e6 mertebesindeki Jülyen günü farkının kendi
    // hassasiyeti zaten ~0.7 mikrosaniye, yani ~7e-7 dakika.
    expect(eventSeparationMinutes(2448027.99, 2448028.01)).toBeCloseTo(28.8, 5);
    const found = findParans([
      obj('A', { rise: 2448027.99 }),
      obj('B', { culminate: 2448028.01 }),
    ], { orbMinutes: 30 });
    expect(found).toHaveLength(1);
  });

  it('yarım günü aşan fark diğer yönden ölçülüyor', () => {
    // 0.6 gün ileri = 0.4 gün geri; kısa olanı alıyoruz.
    expect(eventSeparationMinutes(2448027.0, 2448027.6)).toBeCloseTo(0.4 * 1440, 6);
  });

  it('aynı cisim kendisiyle eşleşmiyor', () => {
    const found = findParans([obj('Sun', { rise: 2448027.25, culminate: 2448027.25 })]);
    expect(found).toHaveLength(0);
  });

  it('bir çift birden çok açıda temas edebiliyor', () => {
    const found = findParans([
      obj('A', { rise: 2448027.25, set: 2448027.25 }),
      obj('B', { culminate: 2448027.25 }),
    ]);
    expect(found).toHaveLength(2);
  });

  it('onlyInvolving süzgeci çalışıyor', () => {
    const objects = [
      obj('Sun', { rise: 2448027.25 }),
      obj('Mars', { rise: 2448027.25 }),
      obj('Sirius', { culminate: 2448027.25 }),
    ];
    expect(findParans(objects)).toHaveLength(3);
    expect(findParans(objects, { onlyInvolving: ['Sirius'] })).toHaveLength(2);
  });

  it('gerçekleşmeyen olay eşleşmeye girmiyor', () => {
    const found = findParans([
      obj('Circumpolar', { culminate: 2448027.25 }),   // doğuş/batış yok
      obj('Sun', { rise: 2448027.25 }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].from.event).toBe('culminate');
  });
});
