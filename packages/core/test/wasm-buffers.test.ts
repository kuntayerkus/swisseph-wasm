/**
 * C tarafının çıktı dizilerine KAÇ double yazdığını ölçer.
 *
 * `instance.ts` bu tamponları bir kez ayırıp tekrar tekrar kullanıyor, yani
 * boyutları yanlışsa her çağrı komşu ayırmanın üstüne yazıyor — ve dönen
 * değerler doğru göründüğü için hiçbir şey yanlış görünmüyor. Bir kez tam
 * olarak bu oldu: ascmc için `ASCMC.Count` (= SE_NASCMC = 8) kadar yer
 * ayrılmıştı, oysa C 10 double yazıyor. Taşan iki double komşu ayırmaların
 * malloc başlığını sıfırlıyordu.
 *
 * `SE_NASCMC` dizinin BOYUTU değil, anlamlı alanların sayısı — belgelerin
 * kendisi `ascmc[10]` diyor (swehouse.c:120, :194, :609). Burada bunu ölçüp
 * sabitliyoruz: upstream bir gün daha fazla yazarsa bu test düşer ve
 * `instance.ts`'teki `ASCMC_BUFFER_SIZE` güncellenmelidir.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const WASM = join(HERE, '..', 'wasm', 'swisseph.mjs');

/** Sıfırdan da NaN'dan da ayırt edilebilen bir işaret değeri. */
const SENTINEL = -1.2345678901234e100;

const describeBuilt = existsSync(WASM) ? describe : describe.skip;

describeBuilt('WASM çıktı tamponlarının boyutu', () => {
  let wasm: {
    _malloc(bytes: number): number;
    getValue(ptr: number, type: string): number;
    setValue(ptr: number, value: number, type: string): void;
    cwrap(name: string, ret: string | null, args: string[]): (...a: number[]) => number;
  };
  let housesEx2: (...a: number[]) => number;
  let julday: (...a: number[]) => number;

  beforeAll(async () => {
    const { default: create } = await import(pathToFileURL(WASM).href);
    wasm = await create();
    housesEx2 = wasm.cwrap('swe_houses_ex2', 'number',
      ['number', 'number', 'number', 'number', 'number',
       'number', 'number', 'number', 'number', 'number']);
    julday = wasm.cwrap('swe_julday', 'number',
      ['number', 'number', 'number', 'number', 'number']);
  });

  /** Cömertçe ayrılmış bir tamponda kaç gözün DEĞİŞTİĞİNİ döndürür. */
  function touchedCount(
    system: string,
    read: (buffers: Record<string, number>) => number,
  ): number {
    const room = 64;                       // ölçülen sayının çok üstünde
    const buffers = {
      cusps: wasm._malloc(room * 8),
      ascmc: wasm._malloc(room * 8),
      cuspSpeed: wasm._malloc(room * 8),
      ascmcSpeed: wasm._malloc(room * 8),
      error: wasm._malloc(256),
    };
    for (const key of ['cusps', 'ascmc', 'cuspSpeed', 'ascmcSpeed'] as const) {
      for (let i = 0; i < room; i++) {
        wasm.setValue(buffers[key] + i * 8, SENTINEL, 'double');
      }
    }
    wasm.setValue(buffers.error, 0, 'i8');

    const jd = julday(1990, 5, 15, 14.5, 1);
    const ret = housesEx2(jd, 0, 39.93, 32.86, system.charCodeAt(0),
      buffers.cusps, buffers.ascmc, buffers.cuspSpeed, buffers.ascmcSpeed,
      buffers.error);
    expect(ret, `swe_houses_ex2('${system}')`).toBeGreaterThanOrEqual(0);

    const base = read(buffers);
    let highest = -1;
    for (let i = 0; i < room; i++) {
      if (wasm.getValue(base + i * 8, 'double') !== SENTINEL) highest = i;
    }
    return highest + 1;
  }

  it('ascmc: SE_NASCMC 8 diyor ama C 10 double yazıyor', () => {
    expect(touchedCount('P', (b) => b.ascmc)).toBe(10);
  });

  it('ascmc_speed de 10 double', () => {
    expect(touchedCount('P', (b) => b.ascmcSpeed)).toBe(10);
  });

  it('cusps: 12 ev sisteminde 13 double (dizi 1-tabanlı)', () => {
    expect(touchedCount('P', (b) => b.cusps)).toBe(13);
  });

  it('cusps: Gauquelin\'de 37 double', () => {
    // CUSPS_BUFFER_SIZE = 37 bunu karşılıyor.
    expect(touchedCount('G', (b) => b.cusps)).toBe(37);
    expect(touchedCount('G', (b) => b.cuspSpeed)).toBe(37);
  });

  it('Sunshine (I) ascmc[9]\'u okuyor VE yazıyor', () => {
    // swe_houses_ex2 çağrıdan önce Güneş'in deklinasyonunu ascmc[9]'a koyuyor
    // (swehouse.c:267). Tampon 10'dan küçükse bu yazma da taşma.
    expect(touchedCount('I', (b) => b.ascmc)).toBe(10);
  });
});
