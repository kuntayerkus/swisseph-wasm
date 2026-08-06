import type { Body, PlanetData } from '@kuntay/swisseph';

/**
 * Vedik Astroloji Nakshatra Sistemi
 * 27 lunar mansion (ay konakları)
 */

export interface NakshatraData {
  id: number;
  name: string;
  sanskritName: string;
  deity: string;
  symbol: string;
  animal: string;
  bird: string;
  tree: string;
  startLongitude: number;
  endLongitude: number;
  padaCount: number;
  rulingPlanet: Body;
  gana: 'Deva' | 'Manushya' | 'Rakshasa';
  nadi: 'Adi' | 'Madhya' | 'Antya';
  varna: string;
  yoni: string;
  quality: 'Fixed' | 'Movable' | 'Dual';
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  purpose: 'Dharma' | 'Artha' | 'Kama' | 'Moksha';
  luckyLetter: string[];
}

export interface NakshatraResult {
  nakshatra: NakshatraData;
  pada: number;
  padaLord: Body;
  longitude: number;
  remainingDegrees: number;
  percentComplete: number;
}

/**
 * Junction star (yogatāra) per nakshatra — the star each nakshatra is
 * defined by. Keyed by nakshatra id (1-27) so the mapping stays valid
 * regardless of name transliteration.
 *
 * Source: Sūrya Siddhānta junction-star table (Burgess 1860, ch. 8),
 * asterism membership via Basham (1954); the three judgment calls
 * (Bharaṇī → 41 Arietis, Viśākhā → al-2Lib, Uttara Āṣāḍhā → siSgr) are
 * documented in docs/NAKSHATRA-STARS.md. Positions are NOT stored here:
 * resolve `designation` through @kuntay/swisseph's `fixedStar()` +
 * `byDesignation()` at runtime — the catalogue (sefstars.txt) is the
 * source of coordinates, never a hand-typed table. The same list ships
 * in core as `NAKSHATRA_JUNCTION_STARS`.
 */
export interface NakshatraJunctionStar {
  /** Nakshatra id, 1-27, matching NAKSHATRAS entries. */
  id: number;
  /** sefstars.txt designation for byDesignation() lookup. */
  designation: string;
  /** IAST nakshatra name, as in docs/NAKSHATRA-STARS.md. */
  nakshatra: string;
}

export const NAKSHATRA_JUNCTION_STARS: readonly NakshatraJunctionStar[] = [
  { id: 1, designation: 'beAri', nakshatra: 'Aśvinī' },
  { id: 2, designation: '41Ari', nakshatra: 'Bharaṇī' },
  { id: 3, designation: 'etTau', nakshatra: 'Kṛttikā' },
  { id: 4, designation: 'alTau', nakshatra: 'Rohiṇī' },
  { id: 5, designation: 'laOri', nakshatra: 'Mṛgaśira' },
  { id: 6, designation: 'alOri', nakshatra: 'Ārdrā' },
  { id: 7, designation: 'beGem', nakshatra: 'Punarvasū' },
  { id: 8, designation: 'gaCnc', nakshatra: 'Puṣya' },
  { id: 9, designation: 'epHya', nakshatra: 'Āśleṣā' },
  { id: 10, designation: 'alLeo', nakshatra: 'Maghā' },
  { id: 11, designation: 'deLeo', nakshatra: 'Pūrva Phalgunī' },
  { id: 12, designation: 'beLeo', nakshatra: 'Uttara Phalgunī' },
  { id: 13, designation: 'deCrv', nakshatra: 'Hasta' },
  { id: 14, designation: 'alVir', nakshatra: 'Citrā' },
  { id: 15, designation: 'alBoo', nakshatra: 'Svātī' },
  { id: 16, designation: 'al-2Lib', nakshatra: 'Viśākhā' },
  { id: 17, designation: 'deSco', nakshatra: 'Anurādhā' },
  { id: 18, designation: 'alSco', nakshatra: 'Jyeṣṭhā' },
  { id: 19, designation: 'laSco', nakshatra: 'Mūla' },
  { id: 20, designation: 'deSgr', nakshatra: 'Pūrva Āṣāḍhā' },
  { id: 21, designation: 'siSgr', nakshatra: 'Uttara Āṣāḍhā' },
  { id: 22, designation: 'alAql', nakshatra: 'Śravaṇa' },
  { id: 23, designation: 'beDel', nakshatra: 'Dhaniṣṭhā' },
  { id: 24, designation: 'laAqr', nakshatra: 'Śatabhiṣā' },
  { id: 25, designation: 'alPeg', nakshatra: 'Pūrva Bhādrapadā' },
  { id: 26, designation: 'gaPeg', nakshatra: 'Uttara Bhādrapadā' },
  { id: 27, designation: 'zePsc', nakshatra: 'Revatī' },
];

/** Junction star for a nakshatra id (1-27), if defined. */
export function junctionStarOf(id: number): NakshatraJunctionStar | undefined {
  return NAKSHATRA_JUNCTION_STARS.find((star) => star.id === id);
}

/**
 * 27 Nakshatra Listesi
 * Kaynak: Brihat Parashara Hora Shastra
 */
export const NAKSHATRAS: NakshatraData[] = [
  {
    id: 1,
    name: 'Ashwini',
    sanskritName: 'अश्विनी',
    deity: 'Ashwini Kumaras',
    symbol: "Horse's Head",
    animal: 'Male Horse',
    bird: 'Wild Eagle',
    tree: 'Mushti Tree',
    startLongitude: 0,
    endLongitude: 13.333,
    padaCount: 4,
    rulingPlanet: Body.Ketu,
    gana: 'Deva',
    nadi: 'Adi',
    varna: 'Vaishya',
    yoni: 'Horse',
    quality: 'Movable',
    element: 'Earth',
    purpose: 'Dharma',
    luckyLetter: ['Chu', 'Che', 'Cho', 'La']
  },
  {
    id: 2,
    name: 'Bharani',
    sanskritName: 'भरणी',
    deity: 'Yama',
    symbol: 'Yoni (Womb)',
    animal: 'Elephant',
    bird: 'Crow',
    tree: 'Amalaki Tree',
    startLongitude: 13.333,
    endLongitude: 26.667,
    padaCount: 4,
    rulingPlanet: Body.Venus,
    gana: 'Manushya',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Elephant',
    quality: 'Movable',
    element: 'Earth',
    purpose: 'Artha',
    luckyLetter: ['Li', 'Lu', 'Le', 'Lo']
  },
  {
    id: 3,
    name: 'Krittika',
    sanskritName: 'कृत्तिका',
    deity: 'Agni',
    symbol: 'Knife or Razor',
    animal: 'Sheep',
    bird: 'Peacock',
    tree: 'Nyagrodha Tree',
    startLongitude: 26.667,
    endLongitude: 40,
    padaCount: 4,
    rulingPlanet: Body.Sun,
    gana: 'Rakshasa',
    nadi: 'Madhya',
    varna: 'Brahmin',
    yoni: 'Sheep',
    quality: 'Fixed',
    element: 'Fire',
    purpose: 'Kama',
    luckyLetter: ['Aa', 'Ee', 'Uu', 'E']
  },
  {
    id: 4,
    name: 'Rohini',
    sanskritName: 'रोहिणी',
    deity: 'Brahma',
    symbol: 'Cart or Chariot',
    animal: 'Serpent',
    bird: 'Owl',
    tree: 'Jamvu Tree',
    startLongitude: 40,
    endLongitude: 53.333,
    padaCount: 4,
    rulingPlanet: Body.Moon,
    gana: 'Manushya',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Serpent',
    quality: 'Fixed',
    element: 'Earth',
    purpose: 'Artha',
    luckyLetter: ['Oo', 'Vaa', 'Vee', 'Vu']
  },
  {
    id: 5,
    name: 'Mrigashira',
    sanskritName: 'म्रृगशीर्षा',
    deity: 'Soma',
    symbol: 'Pearl',
    animal: 'Female Serpent',
    bird: 'Kuruvinda Bird',
    tree: 'Samri Tree',
    startLongitude: 53.333,
    endLongitude: 66.667,
    padaCount: 4,
    rulingPlanet: Body.Mars,
    gana: 'Deva',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Serpent',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Kama',
    luckyLetter: ['Ve', 'Vo', 'Ka', 'Ke']
  },
  {
    id: 6,
    name: 'Ardra',
    sanskritName: 'आर्द्रा',
    deity: 'Rudra',
    symbol: 'Teardrop',
    animal: 'Female Dog',
    bird: 'Parrot',
    tree: 'Shalmali Tree',
    startLongitude: 66.667,
    endLongitude: 80,
    padaCount: 4,
    rulingPlanet: Body.Rahu,
    gana: 'Manushya',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Dog',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Artha',
    luckyLetter: ['Ku', 'Gh', 'Ing', 'Chh']
  },
  {
    id: 7,
    name: 'Punarvasu',
    sanskritName: 'पुनर्वसु',
    deity: 'Aditi',
    symbol: 'Quiver of Arrows',
    animal: 'Cat',
    bird: 'Cuckoo',
    tree: 'Vetasa Tree',
    startLongitude: 80,
    endLongitude: 93.333,
    padaCount: 4,
    rulingPlanet: Body.Jupiter,
    gana: 'Deva',
    nadi: 'Adi',
    varna: 'Vaishya',
    yoni: 'Cat',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Dharma',
    luckyLetter: ['Ke', 'Ko', 'Ha', 'Hi']
  },
  {
    id: 8,
    name: 'Pushya',
    sanskritName: 'पुष्य',
    deity: 'Brihaspati',
    symbol: 'Cow\'s Udder',
    animal: 'Ram',
    bird: 'Crow',
    tree: 'Peepal Tree',
    startLongitude: 93.333,
    endLongitude: 106.667,
    padaCount: 4,
    rulingPlanet: Body.Saturn,
    gana: 'Deva',
    nadi: 'Madhya',
    varna: 'Kshatriya',
    yoni: 'Ram',
    quality: 'Fixed',
    element: 'Water',
    purpose: 'Dharma',
    luckyLetter: ['Hu', 'He', 'Ho', 'Da']
  },
  {
    id: 9,
    name: 'Ashlesha',
    sanskritName: 'आश्लेषा',
    deity: 'Nagas',
    symbol: 'Coiled Serpent',
    animal: 'Lion',
    bird: 'Vulture',
    tree: 'Dadhi Tree',
    startLongitude: 106.667,
    endLongitude: 120,
    padaCount: 4,
    rulingPlanet: Body.Mercury,
    gana: 'Rakshasa',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Cat',
    quality: 'Fixed',
    element: 'Water',
    purpose: 'Dharma',
    luckyLetter: ['Di', 'Du', 'De', 'Do']
  },
  {
    id: 10,
    name: 'Magha',
    sanskritName: 'मघा',
    deity: 'Pitris',
    symbol: 'Royal Throne',
    animal: 'Male Rat',
    bird: 'Cock',
    tree: 'Palasha Tree',
    startLongitude: 120,
    endLongitude: 133.333,
    padaCount: 4,
    rulingPlanet: Body.Ketu,
    gana: 'Rakshasa',
    nadi: 'Adi',
    varna: 'Brahmin',
    yoni: 'Rat',
    quality: 'Fixed',
    element: 'Fire',
    purpose: 'Dharma',
    luckyLetter: ['Ma', 'Mi', 'Mu', 'Me']
  },
  {
    id: 11,
    name: 'Purva Phalguni',
    sanskritName: 'पूर्व फाल्गुनी',
    deity: 'Bhaga',
    symbol: 'Front Legs of Bed',
    animal: 'Female Rat',
    bird: 'Blue Jay',
    tree: 'Plaksha Tree',
    startLongitude: 133.333,
    endLongitude: 146.667,
    padaCount: 4,
    rulingPlanet: Body.Venus,
    gana: 'Manushya',
    nadi: 'Madhya',
    varna: 'Brahmin',
    yoni: 'Rat',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Kama',
    luckyLetter: ['Mo', 'Ta', 'Ti', 'Tu']
  },
  {
    id: 12,
    name: 'Uttara Phalguni',
    sanskritName: 'उत्तर फाल्गुनी',
    deity: 'Aryaman',
    symbol: 'Back Legs of Bed',
    animal: 'Bull',
    bird: 'Goose',
    tree: 'Udumbara Tree',
    startLongitude: 146.667,
    endLongitude: 160,
    padaCount: 4,
    rulingPlanet: Body.Sun,
    gana: 'Manushya',
    nadi: 'Madhya',
    varna: 'Kshatriya',
    yoni: 'Bull',
    quality: 'Fixed',
    element: 'Air',
    purpose: 'Artha',
    luckyLetter: ['Te', 'To', 'Pa', 'Pi']
  },
  {
    id: 13,
    name: 'Hasta',
    sanskritName: 'हस्त',
    deity: 'Savitar',
    symbol: 'Hand',
    animal: 'Buffalo',
    bird: 'Parrot',
    tree: 'Bilva Tree',
    startLongitude: 160,
    endLongitude: 173.333,
    padaCount: 4,
    rulingPlanet: Body.Moon,
    gana: 'Deva',
    nadi: 'Madhya',
    varna: 'Vaishya',
    yoni: 'Buffalo',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Kama',
    luckyLetter: ['Pu', 'Sha', 'Na', 'Tha']
  },
  {
    id: 14,
    name: 'Chitra',
    sanskritName: 'चित्रा',
    deity: 'Vishvakarma',
    symbol: 'Jewel',
    animal: 'Tiger',
    bird: 'Peacock',
    tree: 'Saptaparna Tree',
    startLongitude: 173.333,
    endLongitude: 186.667,
    padaCount: 4,
    rulingPlanet: Body.Mars,
    gana: 'Rakshasa',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Tiger',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Kama',
    luckyLetter: ['Pe', 'Po', 'Ra', 'Ri']
  },
  {
    id: 15,
    name: 'Swati',
    sanskritName: 'स्वाति',
    deity: 'Vayu',
    symbol: 'Coral',
    animal: 'Buffalo',
    bird: 'Hawk',
    tree: 'Kadam Tree',
    startLongitude: 186.667,
    endLongitude: 200,
    padaCount: 4,
    rulingPlanet: Body.Rahu,
    gana: 'Deva',
    nadi: 'Madhya',
    varna: 'Vaishya',
    yoni: 'Buffalo',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Artha',
    luckyLetter: ['Ru', 'Re', 'Ro', 'Ta']
  },
  {
    id: 16,
    name: 'Vishakha',
    sanskritName: 'विशाखा',
    deity: 'Indra-Agni',
    symbol: 'Triumphal Gateway',
    animal: 'Tiger',
    bird: 'Peacock',
    tree: 'Kumbhi Tree',
    startLongitude: 200,
    endLongitude: 213.333,
    padaCount: 4,
    rulingPlanet: Body.Jupiter,
    gana: 'Rakshasa',
    nadi: 'Madhya',
    varna: 'Vaishya',
    yoni: 'Tiger',
    quality: 'Fixed',
    element: 'Air',
    purpose: 'Dharma',
    luckyLetter: ['Ti', 'Tu', 'Te', 'To']
  },
  {
    id: 17,
    name: 'Anuradha',
    sanskritName: 'अनुराधा',
    deity: 'Mitra',
    symbol: 'Lotus',
    animal: 'Deer',
    bird: 'Crow',
    tree: 'Jambu Tree',
    startLongitude: 213.333,
    endLongitude: 226.667,
    padaCount: 4,
    rulingPlanet: Body.Saturn,
    gana: 'Deva',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Deer',
    quality: 'Fixed',
    element: 'Fire',
    purpose: 'Dharma',
    luckyLetter: ['Na', 'Ni', 'Nu', 'Ne']
  },
  {
    id: 18,
    name: 'Jyeshtha',
    sanskritName: 'ज्येष्ठा',
    deity: 'Indra',
    symbol: 'Circular Amulet',
    animal: 'Lion',
    bird: 'Crow',
    tree: 'Vata Tree',
    startLongitude: 226.667,
    endLongitude: 240,
    padaCount: 4,
    rulingPlanet: Body.Mercury,
    gana: 'Rakshasa',
    nadi: 'Madhya',
    varna: 'Brahmin',
    yoni: 'Lion',
    quality: 'Fixed',
    element: 'Water',
    purpose: 'Artha',
    luckyLetter: ['No', 'Ya', 'Yi', 'Yu']
  },
  {
    id: 19,
    name: 'Mula',
    sanskritName: 'मूल',
    deity: 'Nirrti',
    symbol: 'Bunch of Roots',
    animal: 'Lion',
    bird: 'Vulture',
    tree: 'Khadira Tree',
    startLongitude: 240,
    endLongitude: 253.333,
    padaCount: 4,
    rulingPlanet: Body.Ketu,
    gana: 'Rakshasa',
    nadi: 'Adi',
    varna: 'Shudra',
    yoni: 'Dog',
    quality: 'Fixed',
    element: 'Fire',
    purpose: 'Artha',
    luckyLetter: ['Ye', 'Yo', 'Bha', 'Bhi']
  },
  {
    id: 20,
    name: 'Purva Ashadha',
    sanskritName: 'पूर्वाषाढ़ा',
    deity: 'Apas',
    symbol: 'Winnowing Fan',
    animal: 'Monkey',
    bird: 'Parrot',
    tree: 'Udumbara Tree',
    startLongitude: 253.333,
    endLongitude: 266.667,
    padaCount: 4,
    rulingPlanet: Body.Venus,
    gana: 'Manushya',
    nadi: 'Adi',
    varna: 'Brahmin',
    yoni: 'Monkey',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Kama',
    luckyLetter: ['Bhu', 'Dha', 'Fa', 'Dhru']
  },
  {
    id: 21,
    name: 'Uttara Ashadha',
    sanskritName: 'उत्तराषाढ़ा',
    deity: 'Vishvadevas',
    symbol: 'Elephant Tusk',
    animal: 'Mongoose',
    bird: 'Crow',
    tree: 'Palasha Tree',
    startLongitude: 266.667,
    endLongitude: 280,
    padaCount: 4,
    rulingPlanet: Body.Sun,
    gana: 'Manushya',
    nadi: 'Madhya',
    varna: 'Kshatriya',
    yoni: 'Mongoose',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Dharma',
    luckyLetter: ['Bhe', 'Bho', 'Ja', 'Ji']
  },
  {
    id: 22,
    name: 'Shravana',
    sanskritName: 'श्रवण',
    deity: 'Vishnu',
    symbol: 'Three Footprints',
    animal: 'Monkey',
    bird: 'Crane',
    tree: 'Banyan Tree',
    startLongitude: 280,
    endLongitude: 293.333,
    padaCount: 4,
    rulingPlanet: Body.Moon,
    gana: 'Deva',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Monkey',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Dharma',
    luckyLetter: ['Bhee', 'Bhoo', 'Kh', 'Jh']
  },
  {
    id: 23,
    name: 'Dhanishta',
    sanskritName: 'धनिष्ठा',
    deity: 'Eight Vasus',
    symbol: 'Drum',
    animal: 'Lion',
    bird: 'Crow',
    tree: 'Rudraksha Tree',
    startLongitude: 293.333,
    endLongitude: 306.667,
    padaCount: 4,
    rulingPlanet: Body.Mars,
    gana: 'Rakshasa',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Lion',
    quality: 'Movable',
    element: 'Air',
    purpose: 'Artha',
    luckyLetter: ['Bha', 'Bhi', 'Bhu', 'Dha']
  },
  {
    id: 24,
    name: 'Shatabhisha',
    sanskritName: 'शतभिषा',
    deity: 'Varuna',
    symbol: 'Thousand Stars',
    animal: 'Horse',
    bird: 'Owl',
    tree: 'Kurchaka Tree',
    startLongitude: 306.667,
    endLongitude: 320,
    padaCount: 4,
    rulingPlanet: Body.Rahu,
    gana: 'Rakshasa',
    nadi: 'Madhya',
    varna: 'Shudra',
    yoni: 'Horse',
    quality: 'Fixed',
    element: 'Air',
    purpose: 'Dharma',
    luckyLetter: ['Go', 'Sa', 'Si', 'Su']
  },
  {
    id: 25,
    name: 'Purva Bhadrapada',
    sanskritName: 'पूर्वभाद्रपदा',
    deity: 'Aja Ekapada',
    symbol: 'Two Faces',
    animal: 'Lion',
    bird: 'Parrot',
    tree: 'Bilva Tree',
    startLongitude: 320,
    endLongitude: 333.333,
    padaCount: 4,
    rulingPlanet: Body.Jupiter,
    gana: 'Manushya',
    nadi: 'Adi',
    varna: 'Brahmin',
    yoni: 'Lion',
    quality: 'Fixed',
    element: 'Air',
    purpose: 'Dharma',
    luckyLetter: ['Se', 'So', 'Da', 'Di']
  },
  {
    id: 26,
    name: 'Uttara Bhadrapada',
    sanskritName: 'उत्तरभाद्रपदा',
    deity: 'Ahir Budhnya',
    symbol: 'Back Legs of Cot',
    animal: 'Cow',
    bird: 'Parrot',
    tree: 'Jamvu Tree',
    startLongitude: 333.333,
    endLongitude: 346.667,
    padaCount: 4,
    rulingPlanet: Body.Saturn,
    gana: 'Manushya',
    nadi: 'Madhya',
    varna: 'Kshatriya',
    yoni: 'Cow',
    quality: 'Fixed',
    element: 'Water',
    purpose: 'Artha',
    luckyLetter: ['Du', 'Tha', 'Jh', 'Ña']
  },
  {
    id: 27,
    name: 'Revati',
    sanskritName: 'रेवती',
    deity: 'Pushan',
    symbol: 'Fish',
    animal: 'Elephant',
    bird: 'Parrot',
    tree: 'Palasha Tree',
    startLongitude: 346.667,
    endLongitude: 360,
    padaCount: 4,
    rulingPlanet: Body.Mercury,
    gana: 'Deva',
    nadi: 'Madhya',
    varna: 'Brahmin',
    yoni: 'Elephant',
    quality: 'Movable',
    element: 'Water',
    purpose: 'Kama',
    luckyLetter: ['De', 'Do', 'Ch', 'Chi']
  }
];

/**
 * Verilen boylam için nakshatra hesapla
 */
export function calculateNakshatra(longitude: number): NakshatraResult {
  // Normalize longitude to 0-360
  longitude = ((longitude % 360) + 360) % 360;

  // Her nakshatra 13°20' = 13.333... derece
  const nakshatraIndex = Math.floor(longitude / 13.333333);
  const nakshatra = NAKSHATRAS[nakshatraIndex % 27];

  // Pada hesapla (her pada 3°20' = 3.333... derece)
  const withinNakshatra = longitude - nakshatra.startLongitude;
  const pada = Math.floor(withinNakshatra / 3.333333) + 1;

  // Pada lord'u bul
  const padaLord = getPadaLord(nakshatra.rulingPlanet, pada);

  // Kalan derece ve tamamlanma yüzdesi
  const remainingDegrees = nakshatra.endLongitude - longitude;
  const totalDegrees = nakshatra.endLongitude - nakshatra.startLongitude;
  const completedDegrees = longitude - nakshatra.startLongitude;
  const percentComplete = (completedDegrees / totalDegrees) * 100;

  return {
    nakshatra,
    pada: Math.min(pada, 4),
    padaLord,
    longitude,
    remainingDegrees: Math.max(0, remainingDegrees),
    percentComplete: Math.min(100, percentComplete)
  };
}

/**
 * Pada lord'unu belirle
 * Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury sırası
 */
function getPadaLord(nakshatraLord: Body, pada: number): Body {
  const lords: Body[] = [
    Body.Ketu, Body.Venus, Body.Sun, Body.Moon, 
    Body.Mars, Body.Rahu, Body.Jupiter, Body.Saturn, Body.Mercury
  ];

  const startIndex = lords.indexOf(nakshatraLord);
  if (startIndex === -1) return lords[0];

  const lordIndex = (startIndex + pada - 1) % 9;
  return lords[lordIndex];
}

/**
 * Nakshatra uyumluluk analizi
 */
export interface CompatibilityResult {
  score: number;
  maxScore: number;
  factors: Array<{
    name: string;
    points: number;
    description: string;
  }>;
  recommendation: string;
}

export function analyzeCompatibility(
  moonLongitude1: number,
  moonLongitude2: number
): CompatibilityResult {
  const nak1 = calculateNakshatra(moonLongitude1);
  const nak2 = calculateNakshatra(moonLongitude2);

  const factors: Array<{ name: string; points: number; description: string }> = [];
  let totalScore = 0;

  // Gana Matching (6 puan)
  const ganaPoints = nak1.nakshatra.gana === nak2.nakshatra.gana ? 6 : 
                    (nak1.nakshatra.gana === 'Deva' && nak2.nakshatra.gana === 'Manushya') ||
                    (nak1.nakshatra.gana === 'Manushya' && nak2.nakshatra.gana === 'Deva') ? 5 :
                    (nak1.nakshatra.gana === 'Manushya' && nak2.nakshatra.gana === 'Rakshasa') ||
                    (nak1.nakshatra.gana === 'Rakshasa' && nak2.nakshatra.gana === 'Manushya') ? 3 : 1;
  
  factors.push({
    name: 'Gana (Temperament)',
    points: ganaPoints,
    description: `${nak1.nakshatra.gana} ↔ ${nak2.nakshatra.gana}`
  });
  totalScore += ganaPoints;

  // Yoni Matching (4 puan)
  const yoniSame = nak1.nakshatra.yoni === nak2.nakshatra.yoni;
  const yoniPoints = yoniSame ? 4 : 2;
  
  factors.push({
    name: 'Yoni (Animal Nature)',
    points: yoniPoints,
    description: yoniSame ? 'Same' : `${nak1.nakshatra.yoni} ↔ ${nak2.nakshatra.yoni}`
  });
  totalScore += yoniPoints;

  // Nadi Matching (8 puan)
  const nadiPoints = nak1.nakshatra.nadi !== nak2.nakshatra.nadi ? 8 : 0;
  
  factors.push({
    name: 'Nadi (Health)',
    points: nadiPoints,
    description: nak1.nakshatra.nadi !== nak2.nakshatra.nadi 
      ? 'Different (Excellent)' 
      : 'Same (Challenging)'
  });
  totalScore += nadiPoints;

  // Element Matching (3 puan)
  const elementPoints = nak1.nakshatra.element === nak2.nakshatra.element ? 3 : 1;
  
  factors.push({
    name: 'Element',
    points: elementPoints,
    description: `${nak1.nakshatra.element} ↔ ${nak2.nakshatra.element}`
  });
  totalScore += elementPoints;

  // Varna Matching (1 puan)
  const varnaPoints = nak1.nakshatra.varna === nak2.nakshatra.varna ? 1 : 0.5;
  
  factors.push({
    name: 'Varna (Spiritual)',
    points: varnaPoints,
    description: nak1.nakshatra.varna === nak2.nakshatra.varna ? 'Compatible' : 'Different'
  });
  totalScore += varnaPoints;

  const maxScore = 22;
  const percentage = (totalScore / maxScore) * 100;

  let recommendation = '';
  if (percentage >= 75) {
    recommendation = 'Excellent compatibility! This is a highly favorable match.';
  } else if (percentage >= 50) {
    recommendation = 'Good compatibility with some areas requiring understanding.';
  } else {
    recommendation = 'Challenging match. Requires significant effort and understanding.';
  }

  return {
    score: totalScore,
    maxScore,
    factors,
    recommendation
  };
}

/**
 * Nakshatra'dan isim harfi önerisi
 */
export function getNameSuggestions(longitude: number): string[] {
  const result = calculateNakshatra(longitude);
  return result.nakshatra.luckyLetter;
}

export { NAKSHATRAS };
