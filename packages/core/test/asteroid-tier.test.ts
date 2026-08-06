/**
 * Genişletilmiş asteroid kademesi: metadata + seçici yükleme.
 *
 * Ad tablosu ÜRETİLMİŞ veridir (tools/generate-asteroid-names.mjs, kaynak:
 * Astrodienst seasnam.txt); burada tablonun kendisi değil, şekli ve bilinen
 * birkaç girdi denetlenir. loadAsteroids() ise gerçek dosyalarla, dist
 * üzerinden sınanır — asteroid paketi derlenmemişse sayısal kısım atlanır.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ASTEROID_NAMES, EXTENDED_ASTEROIDS, extendedAsteroidName, asteroidFile,
} from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist', 'index.js');
const ASTEROID_DIR = join(HERE, '..', '..', 'asteroids', 'ephe');
const DATA_DIR = join(HERE, '..', '..', 'data', 'ephe');

const hasBuild = existsSync(DIST);
const hasEros = existsSync(join(ASTEROID_DIR, 'se00433s.se1'));
const hasPlanets = existsSync(join(DATA_DIR, 'sepl_18.se1'));

describe('EXTENDED_ASTEROIDS — üretilmiş metadata', () => {
  it('ilk 100 + 16 küratörlü, kesişim düşülmüş: 113 girdi', () => {
    expect(EXTENDED_ASTEROIDS).toHaveLength(113);
  });

  it('numaralar benzersiz ve artan sırada', () => {
    const numbers = EXTENDED_ASTEROIDS.map((a) => a.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
    }
  });

  it('ilk 100 numarayı kapsıyor', () => {
    const numbers = new Set(EXTENDED_ASTEROIDS.map((a) => a.number));
    for (let n = 1; n <= 100; n++) expect(numbers.has(n), `numara ${n}`).toBe(true);
  });

  it('bilinen adlar kaynaktan doğru geldi', () => {
    expect(extendedAsteroidName(1)).toBe('Ceres');
    expect(extendedAsteroidName(433)).toBe('Eros');
    expect(extendedAsteroidName(136199)).toBe('Eris');
    expect(extendedAsteroidName(999999)).toBeUndefined();
  });

  it('elle tutulan ASTEROID_NAMES ile çelişmiyor', () => {
    // 5, 10, 16 hem eski tabloda hem yeni kademede var.
    for (const [name, number] of Object.entries(ASTEROID_NAMES)) {
      const generated = extendedAsteroidName(number);
      if (generated !== undefined) {
        expect(generated, `${name} (${number})`).toBe(name);
      }
    }
  });
});

const describeBuilt = hasBuild ? describe : describe.skip;

describeBuilt('loadAsteroids — seçici yükleme', () => {
  let mod: typeof import('../src/index.js');
  let swe: Awaited<ReturnType<typeof mod.createSwissEph>>;

  beforeAll(async () => {
    mod = await import(DIST);
    swe = await mod.createSwissEph();
    if (hasPlanets) {
      // Asteroid hesabı Güneş konumu ister: gezegen dosyası da bağlanmalı.
      swe.mountEphemerisDirectory(DATA_DIR);
    }
  });

  afterAll(() => swe?.dispose());

  it('geçersiz numarada asteroidFile ile aynı RangeError', async () => {
    const source = new mod.NodeFsEphemeris(ASTEROID_DIR);
    await expect(swe.loadAsteroids(source, [0])).rejects.toThrow(RangeError);
    await expect(swe.loadAsteroids(source, [-5])).rejects.toThrow(RangeError);
    await expect(swe.loadAsteroids(source, [1.5])).rejects.toThrow(RangeError);
  });

  // Dosyalar yerel derlenmişse uçtan uca: Eros + Hygiea + olmayan numara.
  (hasEros && hasPlanets ? it : it.skip)('istenenler yüklenir, olmayan missing düşer', async () => {
    const source = new mod.NodeFsEphemeris(ASTEROID_DIR);
    const result = await swe.loadAsteroids(source, [433, 10, 999999]);
    expect(result.loaded).toEqual([433, 10]);
    expect(result.missing).toEqual([999999]);
    expect(result.bytes).toBeGreaterThan(0);

    const jd = swe.julianDay(1990, 5, 15, 14.5);
    const eros = swe.calc(jd, mod.asteroidBody(mod.Asteroid.Eros));
    expect(eros.ephemeris).toBe('swiss');
    expect(eros.distance).toBeGreaterThan(0.8);
    expect(eros.distance).toBeLessThan(3);

    const hygiea = swe.calc(jd, mod.asteroidBody(10));
    expect(hygiea.ephemeris).toBe('swiss');
  });

  (hasEros ? it : it.skip)('tekrarlanan numaralar tek dosya indirir', async () => {
    const reads: string[] = [];
    const source = {
      description: 'spy',
      async read(name: string) {
        reads.push(name);
        return null;
      },
    };
    await swe.loadAsteroids(source, [433, 433, 433]);
    // İç içe yol + düz ad art zinciri: numara başına en çok 2 okuma.
    expect(reads.length).toBeLessThanOrEqual(2);
    expect(reads[0]).toBe(asteroidFile(433).path);
  });
});
