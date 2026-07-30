import { describe, expect, it } from 'vitest';
import {
  ALL_LOTS, calculateLots, COMMON_LOTS, HERMETIC_LOTS, LOT_VARIANTS,
  NON_HERMETIC_LOTS,
  type ChartPoints, type LotDefinition,
} from '../src/derived/lots.js';
import { normalizeDegrees } from '../src/derived/sect.js';

/** Ankara, 1990-05-15 14:30 UT — gerçek hesaptan alınmış konumlar. */
const POINTS: ChartPoints = {
  ascendant: 206.622,
  midheaven: 121.190,
  sun: 54.497,
  moon: 298.450,
  mercury: 38.000,
  venus: 20.000,
  mars: 327.963,
  jupiter: 25.253,
  saturn: 295.248,
  northNode: 310.000,
};

describe('calculateLots — temel', () => {
  it('tüm tanımlı lotları hesaplar', () => {
    const lots = calculateLots(POINTS, 'day');
    expect(Object.keys(lots).sort()).toEqual(Object.keys(ALL_LOTS).sort());
  });

  it('her lot [0, 360) aralığında', () => {
    for (const sect of ['day', 'night'] as const) {
      for (const lot of Object.values(calculateLots(POINTS, sect))) {
        expect(lot.longitude).toBeGreaterThanOrEqual(0);
        expect(lot.longitude).toBeLessThan(360);
      }
    }
  });

  it('burç ve derece boylamla tutarlı', () => {
    for (const lot of Object.values(calculateLots(POINTS, 'day'))) {
      expect(lot.signIndex).toBe(Math.floor(lot.longitude / 30));
      expect(lot.degreeInSign).toBeCloseTo(lot.longitude - lot.signIndex * 30, 10);
      expect(lot.degreeInSign).toBeGreaterThanOrEqual(0);
      expect(lot.degreeInSign).toBeLessThan(30);
    }
  });
});

describe('Şans ve Ruh noktaları — matematiksel değişmezler', () => {
  /**
   * Gündüz  Şans = Asc + Ay − Güneş,  Ruh = Asc + Güneş − Ay.
   * Toplamları sadeleşerek 2·Asc verir. Bu, formüllerin doğru girildiğinin
   * güçlü bir kontrolü: tek bir işaret hatası bunu bozar.
   */
  it('Şans + Ruh = 2 × Yükselen (her iki sektte)', () => {
    for (const sect of ['day', 'night'] as const) {
      const lots = calculateLots(POINTS, sect, HERMETIC_LOTS);
      const sum = normalizeDegrees(lots.Fortune.longitude + lots.Spirit.longitude);
      expect(sum).toBeCloseTo(normalizeDegrees(2 * POINTS.ascendant), 9);
    }
  });

  /** Sekt değişince ikisi yer değiştirir — formüller birbirinin aynası. */
  it('gündüz Şans = gece Ruh, gündüz Ruh = gece Şans', () => {
    const day = calculateLots(POINTS, 'day', HERMETIC_LOTS);
    const night = calculateLots(POINTS, 'night', HERMETIC_LOTS);
    expect(day.Fortune.longitude).toBeCloseTo(night.Spirit.longitude, 10);
    expect(day.Spirit.longitude).toBeCloseTo(night.Fortune.longitude, 10);
  });

  it('gündüz Şans Noktası elle hesapla uyuşuyor', () => {
    const lots = calculateLots(POINTS, 'day', HERMETIC_LOTS);
    const expected = normalizeDegrees(POINTS.ascendant + POINTS.moon - POINTS.sun);
    expect(lots.Fortune.longitude).toBeCloseTo(expected, 10);
  });

  /**
   * Sekt yanlış hesaplanırsa nokta bambaşka yere düşer ve hiçbir hata alınmaz.
   * Bu testin amacı o riskin büyüklüğünü kayda geçirmek.
   */
  it('yanlış sekt Şans Noktası\'nı belirgin biçimde kaydırır', () => {
    const day = calculateLots(POINTS, 'day', HERMETIC_LOTS);
    const night = calculateLots(POINTS, 'night', HERMETIC_LOTS);
    let diff = Math.abs(day.Fortune.longitude - night.Fortune.longitude);
    if (diff > 180) diff = 360 - diff;
    expect(diff).toBeGreaterThan(10);
  });
});

describe('bağımlılık çözümü', () => {
  it('başka lota atıf yapan lotlar doğru çözülür', () => {
    const lots = calculateLots(POINTS, 'day', HERMETIC_LOTS);
    // Gündüz Eros = Asc + Venüs − Ruh
    const expected = normalizeDegrees(
      POINTS.ascendant + POINTS.venus - lots.Spirit.longitude,
    );
    expect(lots.Eros.longitude).toBeCloseTo(expected, 10);
  });

  it('tanım sırası sonucu etkilemez', () => {
    // Eros, Ruh'a bağlı. Eros'u önce tanımlarsak da aynı sonuç çıkmalı.
    const reordered: Record<string, LotDefinition> = {
      Eros: HERMETIC_LOTS.Eros,
      Spirit: HERMETIC_LOTS.Spirit,
      Fortune: HERMETIC_LOTS.Fortune,
    };
    const a = calculateLots(POINTS, 'day', reordered);
    const b = calculateLots(POINTS, 'day', HERMETIC_LOTS);
    expect(a.Eros.longitude).toBeCloseTo(b.Eros.longitude, 12);
  });

  it('döngüsel bağımlılık sonsuz döngü yerine hata verir', () => {
    const circular: Record<string, LotDefinition> = {
      A: { name: 'A', day: { a: 'Ascendant', b: 'lot:B', c: 'Sun' }, source: 'test' },
      B: { name: 'B', day: { a: 'Ascendant', b: 'lot:A', c: 'Moon' }, source: 'test' },
    };
    expect(() => calculateLots(POINTS, 'day', circular)).toThrow(/[Cc]ircular/);
  });

  it('bilinmeyen lot referansı hata verir', () => {
    const broken: Record<string, LotDefinition> = {
      X: { name: 'X', day: { a: 'Ascendant', b: 'lot:YokBöyleBirŞey', c: 'Sun' }, source: 'test' },
    };
    expect(() => calculateLots(POINTS, 'day', broken)).toThrow(/Unknown lot reference/);
  });
});

describe('sekte bağlı olmayan lotlar', () => {
  it('Kardeşler Noktası gündüz ve gece aynı', () => {
    const day = calculateLots(POINTS, 'day');
    const night = calculateLots(POINTS, 'night');
    expect(day.Siblings.longitude).toBeCloseTo(night.Siblings.longitude, 12);
    expect(day.Siblings.sectDependent).toBe(false);
  });

  it('sekte bağlı lotlar işaretlenmiş', () => {
    const lots = calculateLots(POINTS, 'day');
    expect(lots.Fortune.sectDependent).toBe(true);
    expect(lots.Siblings.sectDependent).toBe(false);
  });
});

describe('özel noktalar', () => {
  it('sabit derece kullanan lot (Yücelme) çalışır', () => {
    const lots = calculateLots(POINTS, 'day');
    // Gündüz Yücelme = Asc + 19° (Güneş\'in yücelmesi, 19° Koç) − Güneş
    const expected = normalizeDegrees(POINTS.ascendant + 19 - POINTS.sun);
    expect(lots.Exaltation.longitude).toBeCloseTo(expected, 10);
  });

  it('Alçalan, Yükselen + 180 olarak çözülür', () => {
    const custom: Record<string, LotDefinition> = {
      T: { name: 'T', day: { a: 'Descendant', b: { degree: 0 }, c: { degree: 0 } }, source: 'test' },
    };
    const lots = calculateLots(POINTS, 'day', custom);
    expect(lots.T.longitude).toBeCloseTo(normalizeDegrees(POINTS.ascendant + 180), 10);
  });

  it('düğüm gerektiren lot, düğüm verilmezse açık hata verir', () => {
    const { northNode, ...withoutNode } = POINTS;
    const custom: Record<string, LotDefinition> = {
      T: { name: 'T', day: { a: 'Ascendant', b: 'NorthNode', c: 'Sun' }, source: 'test' },
    };
    expect(() => calculateLots(withoutNode as ChartPoints, 'day', custom))
      .toThrow(/northNode/);
  });
});

/*
 * Bu blok bir denetim bulgusuna karşılık geliyor: COMMON_LOTS (bugünkü adıyla
 * NON_HERMETIC_LOTS) `definitions` olarak geçirildiğinde HER çağrı patlıyordu,
 * çünkü Basis lot:Fortune ve lot:Spirit'e bağlı ve o ikisi HERMETIC_LOTS'ta.
 * 227 testin hiçbiri bir alt kümeyi `definitions` olarak geçirmediği için
 * kaçmıştı.
 *
 * Ders: elle seçilmiş kümeleri değil, DIŞA VERİLEN kümelerin hepsini gez.
 * Yeni bir küme eklenirse test onu kendiliğinden kapsar.
 */
describe('dışa verilen her lot kümesi çağrılabilir', () => {
  const SETS: Record<string, Record<string, LotDefinition>> = {
    ALL_LOTS,
    HERMETIC_LOTS,
    NON_HERMETIC_LOTS,
    ...Object.fromEntries(
      Object.entries(LOT_VARIANTS).map(([name, set]) => [`LOT_VARIANTS.${name}`, set]),
    ),
  };

  for (const [name, set] of Object.entries(SETS)) {
    for (const sect of ['day', 'night'] as const) {
      it(`${name} (${sect}) patlamıyor ve tam olarak istenen anahtarları döndürüyor`, () => {
        const lots = calculateLots(POINTS, sect, set);
        // Ara değer olarak hesaplanan bağımlılıklar sonuca SIZMAMALI.
        expect(Object.keys(lots).sort()).toEqual(Object.keys(set).sort());
        for (const [key, lot] of Object.entries(lots)) {
          expect(lot, `${name}.${key} tanımsız döndü`).toBeDefined();
          expect(Number.isFinite(lot.longitude), `${name}.${key} sonlu değil`).toBe(true);
          expect(lot.longitude).toBeGreaterThanOrEqual(0);
          expect(lot.longitude).toBeLessThan(360);
        }
      });
    }
  }
});

describe('küme dışı bağımlılıklar ALL_LOTS\'tan çözülüyor', () => {
  it('NON_HERMETIC_LOTS.Basis, Şans/Ruh olmadan da doğru hesaplanıyor', () => {
    // Alt kümeyle hesaplanan Basis, tam kümeyle hesaplananla aynı olmalı:
    // bağımlılık ALL_HERMETIC'ten geliyor, uydurma bir varsayılandan değil.
    const subset = calculateLots(POINTS, 'day', NON_HERMETIC_LOTS);
    const full = calculateLots(POINTS, 'day', ALL_LOTS);
    expect(subset.Basis.longitude).toBeCloseTo(full.Basis.longitude, 12);
  });

  it('geçirilen tanım ALL_LOTS\'u eziyor — sıra doğru', () => {
    // FortuneNoSect gece Şans'ı değiştiriyor; ona bağlı Necessity de kaymalı.
    const overridden = calculateLots(POINTS, 'night', {
      Necessity: HERMETIC_LOTS.Necessity,
      ...LOT_VARIANTS.FortuneNoSect,
    });
    const expectedFortune = normalizeDegrees(
      POINTS.ascendant + POINTS.moon - POINTS.sun);           // sektsiz biçim
    const expectedNecessity = normalizeDegrees(
      POINTS.ascendant + POINTS.mercury - expectedFortune);   // gece formülü
    expect(overridden.Necessity.longitude).toBeCloseTo(expectedNecessity, 10);
  });

  it('gerçekten bilinmeyen referans hâlâ hata veriyor', () => {
    const broken: Record<string, LotDefinition> = {
      X: { name: 'X', day: { a: 'Ascendant', b: 'lot:HiçbirYerde', c: 'Sun' }, source: 'test' },
    };
    // Anahtar adına bağlanıyoruz, mesaj metnine değil: metin çevrilebilir.
    expect(() => calculateLots(POINTS, 'day', broken)).toThrow(/HiçbirYerde/);
  });
});

describe('COMMON_LOTS geriye dönük takma adı', () => {
  it('NON_HERMETIC_LOTS ile aynı nesne', () => {
    expect(COMMON_LOTS).toBe(NON_HERMETIC_LOTS);
  });
});

/*
 * sect doğrulaması. Eskiden 'night' dışındaki HER değer sessizce gündüz
 * dalına düşüyordu — eksik değer hata değil varsayılan oluyordu.
 */
describe('sect doğrulaması', () => {
  for (const bad of ['DAY', 'Day', 'daytime', '', 'gece', null, undefined, 0, 1]) {
    it(`geçersiz sect (${JSON.stringify(bad)}) hata veriyor, gündüze düşmüyor`, () => {
      expect(() => calculateLots(POINTS, bad as never, HERMETIC_LOTS))
        .toThrow(TypeError);
    });
  }

  it('geçerli sect değerleri çalışıyor', () => {
    expect(calculateLots(POINTS, 'day', HERMETIC_LOTS).Fortune.sectUsed).toBe('day');
    expect(calculateLots(POINTS, 'night', HERMETIC_LOTS).Fortune.sectUsed).toBe('night');
  });

  it('determineSect() sonucu bütün olarak geçirilebiliyor', () => {
    // Bir nesne 'night' değildir; doğrulama olmadan sessizce GÜNDÜZ olurdu.
    const asResult = calculateLots(POINTS, { sect: 'night' }, HERMETIC_LOTS);
    const asString = calculateLots(POINTS, 'night', HERMETIC_LOTS);
    expect(asResult.Fortune.sectUsed).toBe('night');
    expect(asResult.Fortune.longitude).toBeCloseTo(asString.Fortune.longitude, 12);
  });

  it('geçersiz sect taşıyan nesne de reddediliyor', () => {
    expect(() => calculateLots(POINTS, { sect: 'DAY' } as never, HERMETIC_LOTS))
      .toThrow(TypeError);
  });
});

describe('tanım bütünlüğü', () => {
  it('her lotun kaynağı belirtilmiş', () => {
    for (const [key, def] of Object.entries(ALL_LOTS)) {
      expect(def.source, `${key} kaynaksız`).toBeTruthy();
      expect(def.name, `${key} adsız`).toBeTruthy();
    }
  });

  it('atıf yapılan tüm lotlar tanımlı', () => {
    for (const [key, def] of Object.entries(ALL_LOTS)) {
      for (const formula of [def.day, def.night]) {
        if (!formula) continue;
        for (const point of [formula.a, formula.b, formula.c]) {
          if (typeof point === 'string' && point.startsWith('lot:')) {
            expect(ALL_LOTS[point.slice(4)], `${key} -> ${point} tanımsız`).toBeDefined();
          }
        }
      }
    }
  });
});

describe('Temel Noktası — kısa yay kuralı', () => {
  /**
   * Basis, sekt aynası DEĞİL: Şans ile Ruh arasındaki kısa yay kullanılır.
   * Bu ayrımı kaçıran uygulamalar noktayı yanlış yere koyar.
   */
  it('Şans ile Ruh arasındaki KISA yayı kullanıyor', () => {
    const lots = calculateLots(POINTS, 'day');
    const arc = normalizeDegrees(lots.Spirit.longitude - lots.Fortune.longitude);
    const shorter = arc <= 180 ? arc : 360 - arc;
    const expected = normalizeDegrees(POINTS.ascendant + shorter);
    expect(lots.Basis.longitude).toBeCloseTo(expected, 10);
  });

  it('Yükselen ile arasındaki uzaklık asla 180°yi geçmiyor', () => {
    for (const sect of ['day', 'night'] as const) {
      const lots = calculateLots(POINTS, sect);
      const fromAsc = normalizeDegrees(lots.Basis.longitude - POINTS.ascendant);
      expect(fromAsc).toBeLessThanOrEqual(180.0000001);
    }
  });

  it('sekte bağlı değil — kısa yay her iki sektte aynı', () => {
    // Sekt Şans ve Ruh\'u takas eder ama aralarındaki kısa yay değişmez.
    const day = calculateLots(POINTS, 'day');
    const night = calculateLots(POINTS, 'night');
    expect(day.Basis.longitude).toBeCloseTo(night.Basis.longitude, 10);
    expect(day.Basis.sectDependent).toBe(false);
  });
});

describe('compute() kaçış kapağı', () => {
  it('özel hesap day/night formüllerinin yerine geçiyor', () => {
    const custom: Record<string, LotDefinition> = {
      Fixed: {
        name: 'Sabit',
        day: { a: 'Ascendant', b: 'Sun', c: 'Moon' },
        compute: () => 123.456,
        source: 'test',
      },
    };
    expect(calculateLots(POINTS, 'day', custom).Fixed.longitude).toBeCloseTo(123.456, 10);
  });

  it('compute() içinden başka lotlara erişilebiliyor', () => {
    const custom: Record<string, LotDefinition> = {
      ...HERMETIC_LOTS,
      Mid: {
        name: 'Orta',
        day: { a: 'Ascendant', b: 'Sun', c: 'Moon' },
        compute: (resolve) =>
          (resolve('lot:Fortune') + resolve('lot:Spirit')) / 2,
        source: 'test',
      },
    };
    const lots = calculateLots(POINTS, 'day', custom);
    expect(lots.Mid.longitude).toBeCloseTo(
      normalizeDegrees((lots.Fortune.longitude + lots.Spirit.longitude) / 2), 10);
  });
});
