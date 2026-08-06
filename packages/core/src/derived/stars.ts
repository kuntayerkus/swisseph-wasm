/**
 * Fixed star curation.
 *
 * There is **no new data** here — `sefstars.txt` already carries every star
 * brighter than magnitude 5 with ICRS coordinates, proper motion and
 * parallax. What was missing is which stars matter to which tradition, and
 * how to look them up unambiguously.
 *
 * The table itself is **generated** from the catalogue (`generated/stars.ts`).
 * A hand-written first version gave Betelgeuse magnitude 0.50 instead of
 * 0.42; fields like designation and magnitude have to come from the source,
 * not from memory.
 *
 * Rebuilding the catalogue from Gaia would not help: Gaia saturates on bright
 * stars and effectively runs out around magnitude 3, and every traditional
 * astrological star sits in that range. See `docs/ROADMAP.md`.
 */

import {
  BRIGHT_MAGNITUDE_LIMIT, CURATED_STARS, STAR_GROUP_COUNTS,
  type CuratedStar, type StarGroup,
} from '../generated/stars.js';

export {
  BRIGHT_MAGNITUDE_LIMIT, CURATED_STARS, STAR_GROUP_COUNTS,
  type CuratedStar, type StarGroup,
};

/** The stars in a group, brightest first. */
export function starsInGroup(group: StarGroup): CuratedStar[] {
  return CURATED_STARS.filter((star) => star.groups.includes(group));
}

/**
 * The four Royal Stars of Persia — the Watchers.
 *
 * Around 3000 BCE they sat near the equinoctial and solstitial points,
 * dividing the sky into four seasons. Precession has long since broken that
 * alignment.
 */
export const ROYAL_STARS: readonly CuratedStar[] = starsInGroup('royal');

/**
 * The 15 Behenian stars of the medieval magical tradition, listed in
 * Agrippa's *De Occulta Philosophia*, each with a stone and a plant.
 */
export const BEHENIAN_STARS: readonly CuratedStar[] = starsInGroup('behenian');

/** Other stars that recur throughout the astrological literature. */
export const NOTABLE_STARS: readonly CuratedStar[] = starsInGroup('notable');

/**
 * The 27 junction stars (yogatāra) of the nakshatras — the star each
 * nakshatra is defined by, in the order of the Sūrya Siddhānta. Positions
 * come from `sefstars.txt` at runtime via {@link byDesignation}; the
 * curation (which star defines which nakshatra, and the three places where
 * that choice needed judgment) is documented in `docs/NAKSHATRA-STARS.md`.
 */
export const NAKSHATRA_STARS: readonly CuratedStar[] = starsInGroup('nakshatra');

/** The 27 nakshatra names in traditional order, 1 (Aśvinī) through 27. */
export const NAKSHATRA_ORDER: readonly string[] = [
  'Aśvinī', 'Bharaṇī', 'Kṛttikā', 'Rohiṇī', 'Mṛgaśira', 'Ārdrā',
  'Punarvasū', 'Puṣya', 'Āśleṣā', 'Maghā', 'Pūrva Phalgunī',
  'Uttara Phalgunī', 'Hasta', 'Citrā', 'Svātī', 'Viśākhā', 'Anurādhā',
  'Jyeṣṭhā', 'Mūla', 'Pūrva Āṣāḍhā', 'Uttara Āṣāḍhā', 'Śravaṇa',
  'Dhaniṣṭhā', 'Śatabhiṣā', 'Pūrva Bhādrapadā', 'Uttara Bhādrapadā',
  'Revatī',
];

/**
 * The junction stars in traditional nakshatra order, 1 (Aśvinī) through
 * 27 (Revatī). `NAKSHATRA_STARS` is sorted by magnitude like every other
 * group; this ordering is the tradition's own, so it lives here rather
 * than in the generated table.
 */
export const NAKSHATRA_JUNCTION_STARS: readonly CuratedStar[] =
  NAKSHATRA_ORDER
    .map((name) => NAKSHATRA_STARS.find((star) => star.nakshatra === name))
    .filter((star): star is CuratedStar => star !== undefined);

/**
 * Stars brighter than {@link BRIGHT_MAGNITUDE_LIMIT}.
 * This group is not curated by hand — it falls out of the catalogue.
 */
export const BRIGHT_STARS: readonly CuratedStar[] = starsInGroup('bright');

/**
 * A lookup string that finds a star by its **designation**.
 *
 * `sefstars.txt` carries some stars under several traditional spellings —
 * "Zubenelgenubi" and "Zuben Elgenubi", both al-2Lib. Their search keys are
 * identical, so which one comes back depends on the stability of `qsort`,
 * which C does not guarantee and which varies between platforms. The
 * positions agree, but getting a different **name** back is a surprise.
 *
 * Searching by designation removes the ambiguity: `,alTau` always resolves to
 * exactly one record.
 */
export function byDesignation(designation: string): string {
  return `,${designation}`;
}

/** Finds a curated star by name, ignoring case and spaces. */
export function findCuratedStar(name: string): CuratedStar | undefined {
  const key = name.toLowerCase().replace(/\s+/g, '');
  return CURATED_STARS.find(
    (star) => star.name.toLowerCase().replace(/\s+/g, '') === key,
  );
}

/** Finds a curated star by designation, e.g. `"alTau"`. */
export function findByDesignation(designation: string): CuratedStar | undefined {
  return CURATED_STARS.find((star) => star.designation === designation);
}
