/**
 * mountEphemeris() iç içe yolları kurabiliyor mu?
 *
 * Asteroid dosyaları upstream arşivinde `ast0/`, `ast20/` gibi alt
 * dizinlerde durur ve `asteroidFile()` bunu yansıtan bir `path` alanı
 * taşır. Bu path'i olduğu gibi mountEphemeris()'e veren çağıran, MEMFS'te
 * ara dizin olmadığı için ENOENT alıyordu — bir kez tam olarak bu oldu
 * (Faz B yayın doğrulamasında yakalandı).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist', 'index.js');
const ASTEROID_DIR = join(HERE, '..', '..', 'asteroids', 'ephe');
const DATA_DIR = join(HERE, '..', '..', 'data', 'ephe');

const hasBuild = existsSync(DIST);
const hasEros = existsSync(join(ASTEROID_DIR, 'se00433s.se1'));
// Asteroid hesabı Güneş konumu gerektirir: gezegen dosyası da şart,
// yoksa SE tüm hesap için Moshier'e düşer.
const hasPlanets = existsSync(join(DATA_DIR, 'sepl_18.se1'));

const describeBuilt = hasBuild ? describe : describe.skip;

describeBuilt('mountEphemeris — iç içe asteroid yolları', () => {
  let mod: typeof import('../src/index.js');
  let swe: Awaited<ReturnType<typeof mod.createSwissEph>>;

  beforeAll(async () => {
    mod = await import(DIST);
    swe = await mod.createSwissEph();
  });

  afterAll(() => swe?.dispose());

  it('asteroidFile().path iç içe dizinleriyle bağlanıyor', () => {
    const spec = mod.asteroidFile(433);
    expect(spec.path).toBe('ast0/se00433s.se1');

    // Dosya içeriği bu deneme için önemsiz — ara dizinlerin kurulması
    // ölçülüyor. Sahte baytlar yeterli.
    const bytes = swe.mountEphemeris({ [spec.path]: new Uint8Array([1, 2, 3]) });
    expect(bytes).toBe(3);

    const fs = (swe.raw as { FS: { analyzePath(p: string): { exists: boolean } } }).FS;
    expect(fs.analyzePath('/ephe/ast0/se00433s.se1').exists).toBe(true);
  });

  it('düz adla bağlamak da geçerli (sweph.c art zinciri)', () => {
    const bytes = swe.mountEphemeris({ 'se00005s.se1': new Uint8Array([4, 5]) });
    expect(bytes).toBe(2);
  });

  // Gerçek dosyayla sayısal doğrulama — asteroid ve veri paketleri derlenmişse.
  (hasEros && hasPlanets ? it : it.skip)('Eros (433) gerçek dosyayla hesaplanıyor', () => {
    const eros = readFileSync(join(ASTEROID_DIR, 'se00433s.se1'));
    const planets = readFileSync(join(DATA_DIR, 'sepl_18.se1'));
    const spec = mod.asteroidFile(mod.Asteroid.Eros);
    swe.mountEphemeris({ [spec.path]: eros, 'sepl_18.se1': planets });

    const jd = swe.julianDay(1990, 5, 15, 14.5);
    const pos = swe.calc(jd, mod.asteroidBody(mod.Asteroid.Eros));
    expect(pos.ephemeris).toBe('swiss');
    // Eros'un uzaklığı 0.9-3 AU arasında değişir.
    expect(pos.distance).toBeGreaterThan(0.8);
    expect(pos.distance).toBeLessThan(3);
  });
});
