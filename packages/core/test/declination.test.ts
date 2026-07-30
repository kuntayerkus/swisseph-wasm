import { describe, expect, it } from 'vitest';
import {
  findDeclinationAspects, OBLIQUITY_J2000, outOfBounds,
} from '../src/derived/declination.js';

const at = (name: string, declination: number, speed?: number) =>
  ({ name, declination, ...(speed !== undefined ? { speed } : {}) });

describe('paralel', () => {
  it('aynı deklinasyonu buluyor', () => {
    const found = findDeclinationAspects([at('A', 21.3), at('B', 21.3)]);
    const parallel = found.find((f) => f.kind === 'parallel');
    expect(parallel).toBeDefined();
    expect(parallel!.orb).toBe(0);
    expect(parallel!.strength).toBe(1);
  });

  it('orb dışını bulmuyor', () => {
    expect(findDeclinationAspects([at('A', 21.3), at('B', 19.0)])).toHaveLength(0);
    expect(findDeclinationAspects([at('A', 21.3), at('B', 19.0)], { orb: 3 }))
      .toHaveLength(1);
  });

  it('orb büyüdükçe güç azalıyor', () => {
    const tight = findDeclinationAspects([at('A', 10), at('B', 10)])[0];
    const wide = findDeclinationAspects([at('A', 10), at('B', 10.5)])[0];
    expect(wide.strength).toBeLessThan(tight.strength);
    expect(wide.orb).toBeCloseTo(0.5, 9);
  });
});

describe('kontraparalel', () => {
  it('zıt deklinasyonu buluyor', () => {
    const found = findDeclinationAspects([at('A', 21.3), at('B', -21.3)]);
    const contra = found.find((f) => f.kind === 'contraparallel');
    expect(contra).toBeDefined();
    expect(contra!.orb).toBeCloseTo(0, 9);
  });

  it('kapatılabiliyor', () => {
    expect(findDeclinationAspects([at('A', 21.3), at('B', -21.3)],
      { includeContraparallel: false })).toHaveLength(0);
  });

  /**
   * Ekvatora yakın çiftler ikisini birden sağlıyor: +0.3 ile -0.3 hem 0.6°
   * fark (paralel) hem 0° toplam (kontraparalel). Geometrinin gerçeği bu;
   * ikisini de raporluyoruz.
   */
  it('ekvatora yakın çift her ikisini de sağlıyor', () => {
    const found = findDeclinationAspects([at('A', 0.3), at('B', -0.3)]);
    expect(found.map((f) => f.kind).sort())
      .toEqual(['contraparallel', 'parallel']);
    // Kontraparalel daha dar, dolayısıyla önce geliyor.
    expect(found[0].kind).toBe('contraparallel');
  });
});

describe('uygulanan / ayrılan', () => {
  it('yaklaşan deklinasyonlar uygulanan', () => {
    // A yükseliyor, B düşüyor: 20.0 ile 20.6 birbirine yaklaşıyor.
    const found = findDeclinationAspects([at('A', 20.0, 0.5), at('B', 20.6, -0.5)]);
    expect(found[0].applying).toBe(true);
  });

  it('uzaklaşan deklinasyonlar ayrılan', () => {
    const found = findDeclinationAspects([at('A', 20.0, -0.5), at('B', 20.6, 0.5)]);
    expect(found[0].applying).toBe(false);
  });

  it('hız verilmezse applying tanımsız', () => {
    expect(findDeclinationAspects([at('A', 10), at('B', 10)])[0].applying)
      .toBeUndefined();
  });

  it('kontraparalelde de çalışıyor', () => {
    // +20 düşüyor, -20 yükseliyor: |toplam| büyüyor, yani ayrılıyorlar.
    const found = findDeclinationAspects([at('A', 20.0, -0.5), at('B', -20.4, -0.5)]);
    const contra = found.find((f) => f.kind === 'contraparallel');
    expect(contra?.applying).toBe(false);
  });
});

describe('sınır dışı (out of bounds)', () => {
  it('eğikliği aşan cismi işaretliyor', () => {
    const [moon] = outOfBounds([at('Moon', 24.5)]);
    expect(moon.outOfBounds).toBe(true);
    expect(moon.excess).toBeCloseTo(24.5 - OBLIQUITY_J2000, 6);
    expect(moon.hemisphere).toBe('north');
  });

  it('güney yarıkürede de çalışıyor', () => {
    const [moon] = outOfBounds([at('Moon', -24.5)]);
    expect(moon.outOfBounds).toBe(true);
    expect(moon.hemisphere).toBe('south');
  });

  it('sınır içindeki cismi işaretlemiyor', () => {
    expect(outOfBounds([at('Sun', 23.0)])[0].outOfBounds).toBe(false);
  });

  /**
   * Eğiklik yüzyılda ~47 saniyelik yay küçülüyor. Sınıra çok yakın duran bir
   * cisim, hangi eğikliği kullandığınıza göre içeri ya da dışarı düşüyor —
   * J2000 sabitini varsaymanın neden yetmediği tam olarak bu.
   */
  it('eğiklik değiştiğinde sınırdaki cisim taraf değiştiriyor', () => {
    const point = [at('Moon', 23.42)];
    expect(outOfBounds(point, 23.4392911)[0].outOfBounds).toBe(false);
    expect(outOfBounds(point, 23.4100000)[0].outOfBounds).toBe(true);
  });
});
