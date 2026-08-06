/**
 * Geo paketi: ayrıştırma, arama sıralaması ve saat dilimi ofsetleri.
 *
 * Saat dilimi denemeleri bilinen TAKVİM gerçeklerine bağlanır: Türkiye'de
 * yaz saati 2016'da kalktı — Ocak 1990 +02, Mayıs 1990 +03'tü. Bu ikisi
 * birlikte hem Intl'in veritabanını hem iki geçişli hesabı sınar.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  formatOffsetHours, offsetForWallClock, parseCities, searchCities,
  zoneOffsetHours, type City,
} from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CITIES_TSV = join(HERE, '..', 'cities.tsv');
const hasCities = existsSync(CITIES_TSV);

const SAMPLE = [
  { name: 'İstanbul', asciiName: 'Istanbul', latitude: 41.01, longitude: 28.97, countryCode: 'TR', country: 'Türkiye', timezone: 'Europe/Istanbul', population: 14_800_000 },
  { name: 'İzmir', asciiName: 'Izmir', latitude: 38.42, longitude: 27.14, countryCode: 'TR', country: 'Türkiye', timezone: 'Europe/Istanbul', population: 2_950_000 },
  { name: 'Istranca', asciiName: 'Istranca', latitude: 41.5, longitude: 27.5, countryCode: 'TR', country: 'Türkiye', timezone: 'Europe/Istanbul', population: 20_000 },
  { name: 'Los Angeles', asciiName: 'Los Angeles', latitude: 34.05, longitude: -118.24, countryCode: 'US', country: 'United States', timezone: 'America/Los_Angeles', population: 3_900_000 },
  { name: 'Istres', asciiName: 'Istres', latitude: 43.51, longitude: 4.99, countryCode: 'FR', country: 'France', timezone: 'Europe/Paris', population: 44_000 },
] satisfies City[];

describe('parseCities', () => {
  it('başlık ve bozuk satırları atlar, alanları çözer', () => {
    const text = [
      '# yorum satırı',
      'Ankara\tAnkara\t39.93\t32.86\tTR\tTürkiye\tEurope/Istanbul\t4500000',
      'bozuk satır',
      'KötüSayı\tBad\tabc\tdef\tTR\tTürkiye\tEurope/Istanbul\t1',
    ].join('\n');
    const cities = parseCities(text);
    expect(cities).toHaveLength(1);
    expect(cities[0]).toMatchObject({
      name: 'Ankara', latitude: 39.93, longitude: 32.86,
      countryCode: 'TR', timezone: 'Europe/Istanbul', population: 4_500_000,
    });
  });

  // Üretilmiş dosya varsa gerçek veriyle de dene.
  (hasCities ? it : it.skip)('cities.tsv tam dosyayı çözer', () => {
    const cities = parseCities(readFileSync(CITIES_TSV, 'utf8'));
    expect(cities.length).toBeGreaterThan(30_000);
    const istanbul = cities.find((c) => c.asciiName === 'Istanbul');
    expect(istanbul).toBeDefined();
    expect(istanbul!.timezone).toBe('Europe/Istanbul');
    expect(istanbul!.latitude).toBeCloseTo(41.01, 1);
    expect(istanbul!.longitude).toBeCloseTo(28.97, 1);
  });
});

describe('searchCities', () => {
  it('tam ad, önekle ve kıtalar arası sıralama', () => {
    const exact = searchCities(SAMPLE, 'izmir');
    expect(exact[0].name).toBe('İzmir');

    const prefixed = searchCities(SAMPLE, 'ist');
    // İstanbul nüfusça en büyük 'ist' öneki; Izmir yok (önek değil).
    expect(prefixed[0].name).toBe('İstanbul');
    expect(prefixed.map((c) => c.name)).toContain('Istres');
    expect(prefixed.map((c) => c.name)).not.toContain('İzmir');

    const word = searchCities(SAMPLE, 'los');
    expect(word[0].name).toBe('Los Angeles');

    const sub = searchCities(SAMPLE, 'ange');
    expect(sub[0].name).toBe('Los Angeles');
  });

  it('Türkçe karakter katlaması: "istanbul" → İstanbul', () => {
    const hits = searchCities(SAMPLE, 'istanbul');
    expect(hits[0].name).toBe('İstanbul');
  });

  it('ülke filtresi ve limit', () => {
    const onlyTr = searchCities(SAMPLE, 'i', { country: 'TR', limit: 5 });
    expect(onlyTr.every((c) => c.countryCode === 'TR')).toBe(true);

    const limited = searchCities(SAMPLE, 'i', { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('boş sorgu boş döner', () => {
    expect(searchCities(SAMPLE, '   ')).toEqual([]);
  });
});

describe('saat dilimi ofsetleri', () => {
  it('Europe/Istanbul: 2016 sonrası sabit +03', () => {
    const summer = zoneOffsetHours('Europe/Istanbul', Date.UTC(2026, 7, 6, 12));
    const winter = zoneOffsetHours('Europe/Istanbul', Date.UTC(2026, 0, 15, 12));
    expect(summer).toBe(3);
    expect(winter).toBe(3);
  });

  it('Europe/Istanbul: tarihsel yaz saati — Ocak 1990 +02, Mayıs 1990 +03', () => {
    const jan = zoneOffsetHours('Europe/Istanbul', Date.UTC(1990, 0, 15, 12));
    const may = zoneOffsetHours('Europe/Istanbul', Date.UTC(1990, 4, 15, 12));
    expect(jan).toBe(2);
    expect(may).toBe(3);
  });

  it('yarım saatlik ve negatif dilimler', () => {
    expect(zoneOffsetHours('Asia/Kathmandu', Date.UTC(2026, 0, 1))).toBeCloseTo(5.75, 10);
    expect(zoneOffsetHours('America/New_York', Date.UTC(2026, 6, 1, 12))).toBe(-4);
    expect(zoneOffsetHours('America/New_York', Date.UTC(2026, 0, 1, 12))).toBe(-5);
  });

  it('offsetForWallClock duvar saatinden çözer', () => {
    const winter = offsetForWallClock('Europe/Istanbul', 1990, 1, 15, 14, 30);
    expect(winter.offsetHours).toBe(2);
    expect(winter.ambiguous).toBe(false);

    const summer = offsetForWallClock('Europe/Istanbul', 1990, 5, 15, 14, 30);
    expect(summer.offsetHours).toBe(3);
  });

  it('sonbahar geri dönüşünde tekrarlanan saat belirsiz işaretlenir', () => {
    // New York 2020-11-01 01:30 yerel saat İKİ kez yaşandı (-04 ve -05).
    const repeated = offsetForWallClock('America/New_York', 2020, 11, 1, 1, 30);
    expect(repeated.ambiguous).toBe(true);
    expect([repeated.offsetHours, repeated.alternativeOffsetHours].sort((a, b) => a - b))
      .toEqual([-5, -4]);

    // Sıradan saatte belirsizlik yok.
    const plain = offsetForWallClock('America/New_York', 2020, 11, 2, 1, 30);
    expect(plain.ambiguous).toBe(false);
  });

  it('formatOffsetHours', () => {
    expect(formatOffsetHours(3)).toBe('+03:00');
    expect(formatOffsetHours(-5.5)).toBe('-05:30');
    expect(formatOffsetHours(5.75)).toBe('+05:45');
    expect(formatOffsetHours(0)).toBe('+00:00');
  });
});
