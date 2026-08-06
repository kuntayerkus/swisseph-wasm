/**
 * ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
 *
 * Kaynak: seasnam.txt (Astrodienst'in numaralı asteroid ad listesi)
 * Kanonik kaynak: https://github.com/aloistr/swisseph (Astrodienst)
 * Üreten: tools/generate-asteroid-names.mjs (2026-08-05)
 *
 * Adlar kaynaktan okundu, elle yazılmadı. Kürasyon kararı üreteçte:
 * ilk 100 numaralı asteroid + yayınlanan 16 küratörlü cisim.
 *
 * Yeniden üretmek için: node tools/generate-asteroid-names.mjs
 */
/* eslint-disable */

/** Numarası ve resmi adı bilinen bir asteroid. */
export interface NamedAsteroid {
  /** Küçük gezegen numarası — `asteroidBody()` ve `asteroidFile()` bunu alır. */
  number: number;
  /** MPC resmi adı, kaynaktan. */
  name: string;
}

/**
 * Genişletilmiş kademe: ilk 100 numaralı asteroid + 16 küratörlü cisim.
 *
 * Numaraya göre sıralı. Dosyaları pakete dahil DEĞİLDİR — seçici yükleme
 * için `loadAsteroids()` kullanılır.
 */
export const EXTENDED_ASTEROIDS: readonly NamedAsteroid[] = [
  { number: 1, name: "Ceres" },
  { number: 2, name: "Pallas" },
  { number: 3, name: "Juno" },
  { number: 4, name: "Vesta" },
  { number: 5, name: "Astraea" },
  { number: 6, name: "Hebe" },
  { number: 7, name: "Iris" },
  { number: 8, name: "Flora" },
  { number: 9, name: "Metis" },
  { number: 10, name: "Hygiea" },
  { number: 11, name: "Parthenope" },
  { number: 12, name: "Victoria" },
  { number: 13, name: "Egeria" },
  { number: 14, name: "Irene" },
  { number: 15, name: "Eunomia" },
  { number: 16, name: "Psyche" },
  { number: 17, name: "Thetis" },
  { number: 18, name: "Melpomene" },
  { number: 19, name: "Fortuna" },
  { number: 20, name: "Massalia" },
  { number: 21, name: "Lutetia" },
  { number: 22, name: "Kalliope" },
  { number: 23, name: "Thalia" },
  { number: 24, name: "Themis" },
  { number: 25, name: "Phocaea" },
  { number: 26, name: "Proserpina" },
  { number: 27, name: "Euterpe" },
  { number: 28, name: "Bellona" },
  { number: 29, name: "Amphitrite" },
  { number: 30, name: "Urania" },
  { number: 31, name: "Euphrosyne" },
  { number: 32, name: "Pomona" },
  { number: 33, name: "Polyhymnia" },
  { number: 34, name: "Circe" },
  { number: 35, name: "Leukothea" },
  { number: 36, name: "Atalante" },
  { number: 37, name: "Fides" },
  { number: 38, name: "Leda" },
  { number: 39, name: "Laetitia" },
  { number: 40, name: "Harmonia" },
  { number: 41, name: "Daphne" },
  { number: 42, name: "Isis" },
  { number: 43, name: "Ariadne" },
  { number: 44, name: "Nysa" },
  { number: 45, name: "Eugenia" },
  { number: 46, name: "Hestia" },
  { number: 47, name: "Aglaja" },
  { number: 48, name: "Doris" },
  { number: 49, name: "Pales" },
  { number: 50, name: "Virginia" },
  { number: 51, name: "Nemausa" },
  { number: 52, name: "Europa" },
  { number: 53, name: "Kalypso" },
  { number: 54, name: "Alexandra" },
  { number: 55, name: "Pandora" },
  { number: 56, name: "Melete" },
  { number: 57, name: "Mnemosyne" },
  { number: 58, name: "Concordia" },
  { number: 59, name: "Elpis" },
  { number: 60, name: "Echo" },
  { number: 61, name: "Danae" },
  { number: 62, name: "Erato" },
  { number: 63, name: "Ausonia" },
  { number: 64, name: "Angelina" },
  { number: 65, name: "Cybele" },
  { number: 66, name: "Maja" },
  { number: 67, name: "Asia" },
  { number: 68, name: "Leto" },
  { number: 69, name: "Hesperia" },
  { number: 70, name: "Panopaea" },
  { number: 71, name: "Niobe" },
  { number: 72, name: "Feronia" },
  { number: 73, name: "Klytia" },
  { number: 74, name: "Galatea" },
  { number: 75, name: "Eurydike" },
  { number: 76, name: "Freia" },
  { number: 77, name: "Frigga" },
  { number: 78, name: "Diana" },
  { number: 79, name: "Eurynome" },
  { number: 80, name: "Sappho" },
  { number: 81, name: "Terpsichore" },
  { number: 82, name: "Alkmene" },
  { number: 83, name: "Beatrix" },
  { number: 84, name: "Klio" },
  { number: 85, name: "Io" },
  { number: 86, name: "Semele" },
  { number: 87, name: "Sylvia" },
  { number: 88, name: "Thisbe" },
  { number: 89, name: "Julia" },
  { number: 90, name: "Antiope" },
  { number: 91, name: "Aegina" },
  { number: 92, name: "Undina" },
  { number: 93, name: "Minerva" },
  { number: 94, name: "Aurora" },
  { number: 95, name: "Arethusa" },
  { number: 96, name: "Aegle" },
  { number: 97, name: "Klotho" },
  { number: 98, name: "Ianthe" },
  { number: 99, name: "Dike" },
  { number: 100, name: "Hekate" },
  { number: 433, name: "Eros" },
  { number: 1181, name: "Lilith" },
  { number: 7066, name: "Nessus" },
  { number: 10199, name: "Chariklo" },
  { number: 20000, name: "Varuna" },
  { number: 28978, name: "Ixion" },
  { number: 50000, name: "Quaoar" },
  { number: 90377, name: "Sedna" },
  { number: 90482, name: "Orcus" },
  { number: 136108, name: "Haumea" },
  { number: 136199, name: "Eris" },
  { number: 136472, name: "Makemake" },
  { number: 225088, name: "Gonggong" },
];

/** Numaradan ada; bilinmeyen numarada `undefined`. */
export const extendedAsteroidName = (number: number): string | undefined =>
  EXTENDED_ASTEROIDS.find((a) => a.number === number)?.name;
