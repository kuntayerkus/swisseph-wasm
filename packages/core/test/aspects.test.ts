import { describe, expect, it } from 'vitest';
import {
  ALL_ASPECTS, MAJOR_ASPECTS, MODERN_ORBS, TIGHT_ORBS, TRADITIONAL_MOIETIES,
  findAspects, findAspectsBetween, separation,
} from '../src/derived/aspects.js';
import {
  antiscion, contraAntiscion, findAntiscia, reflect,
} from '../src/derived/antiscia.js';
import { Body } from '../src/constants.js';

const at = (name: string, longitude: number, body?: number, speed?: number) =>
  ({ name, longitude, ...(body !== undefined ? { body } : {}),
     ...(speed !== undefined ? { speed } : {}) });

describe('separation', () => {
  it('en kısa yayı veriyor', () => {
    expect(separation(0, 90)).toBe(90);
    expect(separation(0, 270)).toBe(90);      // 360 sarması
    expect(separation(350, 10)).toBe(20);
    expect(separation(10, 350)).toBe(20);     // simetrik
    expect(separation(0, 180)).toBe(180);
  });

  it("asla 180'i geçmiyor", () => {
    for (let a = 0; a < 360; a += 17) {
      for (let b = 0; b < 360; b += 23) {
        const s = separation(a, b);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('findAspects', () => {
  it('tam kareyi buluyor', () => {
    const found = findAspects([at('A', 0), at('B', 90)]);
    expect(found).toHaveLength(1);
    expect(found[0].aspect.name).toBe('Square');
    expect(found[0].orb).toBe(0);
    expect(found[0].strength).toBe(1);
  });

  it('orb dışındaki çifti bulmuyor', () => {
    // Modern şemada kare orbu 7°; 20° sapma hiçbir açıya girmez.
    expect(findAspects([at('A', 0), at('B', 110)])).toHaveLength(0);
  });

  it('orb büyüdükçe güç azalıyor', () => {
    const tight = findAspects([at('A', 0), at('B', 90)])[0];
    const wide = findAspects([at('A', 0), at('B', 95)])[0];
    expect(wide.strength).toBeLessThan(tight.strength);
    expect(wide.orb).toBeCloseTo(5, 9);
  });

  it('her çift en fazla bir kez raporlanıyor', () => {
    const found = findAspects([at('A', 0), at('B', 90), at('C', 180)]);
    const pairs = found.map((f) => [f.from.name, f.to.name].sort().join('-'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('sonuçlar güce göre sıralı', () => {
    const found = findAspects([at('A', 0), at('B', 90), at('C', 183), at('D', 61)]);
    for (let i = 1; i < found.length; i++) {
      expect(found[i - 1].strength).toBeGreaterThanOrEqual(found[i].strength);
    }
  });

  it('360 sınırını doğru geçiyor', () => {
    // 355° ile 85° arasında 90° var.
    const found = findAspects([at('A', 355), at('B', 85)]);
    expect(found[0]?.aspect.name).toBe('Square');
  });
});

describe('orb şemaları', () => {
  it('dar şema geniş şemadan daha az açı buluyor', () => {
    const points = [at('A', 0), at('B', 95), at('C', 185)];
    const modern = findAspects(points, { orbs: MODERN_ORBS });
    const tight = findAspects(points, { orbs: TIGHT_ORBS });
    expect(tight.length).toBeLessThan(modern.length);
  });

  /**
   * Moiety şemasının bütün amacı ışıklara geniş orb vermek. Güneş-Ay çifti
   * (7.5 + 6 = 13.5°) Merkür-Venüs çiftinden (3.5 + 3.5 = 7°) belirgin
   * biçimde geniş olmalı.
   */
  it('moiety şemasında ışıklar daha geniş orb alıyor', () => {
    const luminaries = findAspects(
      [at('Sun', 0, Body.Sun), at('Moon', 100, Body.Moon)],
      { orbs: TRADITIONAL_MOIETIES },
    );
    const smalls = findAspects(
      [at('Mercury', 0, Body.Mercury), at('Venus', 100, Body.Venus)],
      { orbs: TRADITIONAL_MOIETIES },
    );
    expect(luminaries).toHaveLength(1);       // 10° sapma, 13.5° orb içinde
    expect(smalls).toHaveLength(0);           // 7° orbun dışında
  });

  it('cisim bilgisi yoksa fallback kullanılıyor', () => {
    // byBody tablosu var ama noktalarda body yok -> fallback 3°.
    const found = findAspects([at('X', 0), at('Y', 92)], { orbs: TRADITIONAL_MOIETIES });
    expect(found).toHaveLength(1);
    expect(found[0].maxOrb).toBe(TRADITIONAL_MOIETIES.fallback);
  });

  it('özel şema kabul ediliyor', () => {
    const found = findAspects([at('A', 0), at('B', 100)], {
      orbs: { name: 'çok geniş', byAspect: { Square: 15 }, fallback: 1 },
    });
    expect(found[0].aspect.name).toBe('Square');
    expect(found[0].maxOrb).toBe(15);
  });
});

describe('uygulanan / ayrılan', () => {
  it('yaklaşan çift uygulanan olarak işaretleniyor', () => {
    // Ay hızlı ve Güneş'e doğru gidiyor -> kare tamamlanmaya yaklaşıyor.
    const found = findAspects([
      at('Sun', 0, Body.Sun, 1.0),
      at('Moon', 88, Body.Moon, 13.0),
    ]);
    expect(found[0].applying).toBe(true);
  });

  it('uzaklaşan çift ayrılan olarak işaretleniyor', () => {
    const found = findAspects([
      at('Sun', 0, Body.Sun, 1.0),
      at('Moon', 92, Body.Moon, 13.0),
    ]);
    expect(found[0].applying).toBe(false);
  });

  it('retrograd hareket doğru ele alınıyor', () => {
    // B kareden BÜYÜK tarafta (92°) ve geri gidiyor -> 90°'ye yaklaşıyor.
    const closing = findAspects([
      at('A', 0, Body.Sun, 1.0),
      at('B', 92, Body.Mars, -0.3),
    ]);
    expect(closing[0].applying).toBe(true);

    // B kareden KÜÇÜK tarafta (88°) ve geri gidiyor -> uzaklaşıyor.
    const opening = findAspects([
      at('A', 0, Body.Sun, 1.0),
      at('B', 88, Body.Mars, -0.3),
    ]);
    expect(opening[0].applying).toBe(false);
  });

  it('hız verilmezse applying tanımsız', () => {
    expect(findAspects([at('A', 0), at('B', 90)])[0].applying).toBeUndefined();
  });
});

describe('findAspectsBetween', () => {
  it('yalnızca kümeler arası çiftleri karşılaştırıyor', () => {
    const natal = [at('N1', 0), at('N2', 90)];
    const transit = [at('T1', 1), at('T2', 91)];
    const found = findAspectsBetween(natal, transit);
    // Küme içi çiftler (N1-N2, T1-T2) raporlanmamalı.
    for (const a of found) {
      expect(a.from.name.startsWith('N')).toBe(true);
      expect(a.to.name.startsWith('T')).toBe(true);
    }
    expect(found.length).toBe(4);   // 2 kavuşum + 2 kare
  });
});

describe('açı tanımları', () => {
  it('tüm açılar 0-180 aralığında ve benzersiz', () => {
    const angles = Object.values(ALL_ASPECTS).map((a) => a.angle);
    expect(new Set(angles).size).toBe(angles.length);
    for (const angle of angles) {
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(180);
    }
  });

  it('Batlamyus açıları beş tane', () => {
    expect(Object.keys(MAJOR_ASPECTS)).toHaveLength(5);
  });
});

// --- antiscia -----------------------------------------------------------

describe('antiscion', () => {
  /** Yansıma ekseni 0° Yengeç – 0° Oğlak; eksen üzerindeki noktalar sabit. */
  it('gündönümü noktaları kendine eşleniyor', () => {
    expect(antiscion(90)).toBeCloseTo(90, 9);    // 0° Yengeç
    expect(antiscion(270)).toBeCloseTo(270, 9);  // 0° Oğlak
  });

  it('bilinen eşlemeler', () => {
    expect(antiscion(75)).toBeCloseTo(105, 9);   // 15° İkizler -> 15° Yengeç
    expect(antiscion(0)).toBeCloseTo(180, 9);    // 0° Koç -> 0° Terazi
    expect(antiscion(30)).toBeCloseTo(150, 9);   // 0° Boğa -> 0° Başak
  });

  it('kendi tersi — iki kez uygulanınca başa dönüyor', () => {
    for (const lon of [0, 45, 123.456, 270, 359.9]) {
      expect(antiscion(antiscion(lon))).toBeCloseTo(lon, 9);
      expect(contraAntiscion(contraAntiscion(lon))).toBeCloseTo(lon, 9);
    }
  });

  it("kontra-antiscion, antiscion\'un karşıtı", () => {
    for (const lon of [10, 100, 200, 300]) {
      const expected = (antiscion(lon) + 180) % 360;
      expect(contraAntiscion(lon)).toBeCloseTo(expected, 9);
    }
  });

  it('ekinoks noktaları kontra eksende sabit', () => {
    expect(contraAntiscion(0)).toBeCloseTo(0, 9);
    expect(contraAntiscion(180)).toBeCloseTo(180, 9);
  });

  it('sonuç her zaman [0, 360)', () => {
    for (const lon of [-90, 0, 400, 720.5]) {
      for (const fn of [antiscion, contraAntiscion]) {
        const v = fn(lon);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(360);
      }
    }
  });
});

describe('reflect', () => {
  it('burçları doğru veriyor', () => {
    const r = reflect('Sun', 75);              // 15° İkizler
    // antiscion 105° = 15° Yengeç, kontra 285° = 15° Oğlak
    expect(r.antiscion).toBeCloseTo(105, 9);
    expect(r.antiscionSign).toBe('Cancer');
    expect(r.contraAntiscion).toBeCloseTo(285, 9);
    expect(r.contraAntiscionSign).toBe('Capricorn');
  });
});

describe('findAntiscia', () => {
  it('tam antiscia temasını buluyor', () => {
    // 75° (15° İkizler) yansıması 105°; oraya bir nokta koyalım.
    const found = findAntiscia([at('A', 75), at('B', 105)], { orb: 1 });
    expect(found.some((c) => c.kind === 'antiscion')).toBe(true);
    expect(found[0].orb).toBeCloseTo(0, 9);
  });

  it('kontra-antiscia temasını buluyor', () => {
    const found = findAntiscia([at('A', 75), at('B', 285)], { orb: 1 });
    expect(found.some((c) => c.kind === 'contra-antiscion')).toBe(true);
  });

  it('includeContra kapatılabiliyor', () => {
    const found = findAntiscia([at('A', 75), at('B', 285)],
      { orb: 1, includeContra: false });
    expect(found).toHaveLength(0);
  });

  it('orb dışını bulmuyor', () => {
    expect(findAntiscia([at('A', 75), at('B', 110)], { orb: 1 })).toHaveLength(0);
    expect(findAntiscia([at('A', 75), at('B', 110)], { orb: 6 })).toHaveLength(1);
  });

  /**
   * Bağıntı simetrik: A'nın antiscion'u B'ye düşüyorsa B'ninki de A'ya düşer.
   * Her çift bir kez raporlanmalı, yoksa her temas ikiye katlanır.
   */
  it('simetrik bağıntı iki kez raporlanmıyor', () => {
    const found = findAntiscia([at('A', 75), at('B', 105)], { orb: 1 });
    expect(found.filter((c) => c.kind === 'antiscion')).toHaveLength(1);
  });
});
