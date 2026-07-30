/**
 * Instance lifecycle and ephemeris discovery.
 *
 * One Swiss Ephemeris instance per tool call, disposed afterwards. That is
 * not caution for its own sake: the library keeps all of its state in a
 * single global C struct, so a shared instance would let the sidereal mode or
 * topocentric position set by one call leak into the next. Measured cost of a
 * fresh instance is about 9 ms against 0.6 ms for a full chart — cheap enough
 * that isolation needs no defending.
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createSwissEph, type SwissEph } from '@kuntay/swisseph';

export interface EphemerisStatus {
  /** Where the data came from, for the caller to see. */
  description: string;
  /** True when real `.se1` files were mounted. */
  full: boolean;
}

/**
 * Finds ephemeris data, once, at startup.
 *
 * Order: an explicit `SWISSEPH_EPHE_PATH`, then the optional data package,
 * then nothing — in which case Swiss Ephemeris falls back to its built-in
 * Moshier theory and still answers, within about a quarter of an arcsecond
 * for the outer planets.
 */
function locateEphemeris(): { directory: string | null; status: EphemerisStatus } {
  const fromEnv = process.env.SWISSEPH_EPHE_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      // Sessizce Moshier'e düşmek yerine söylüyoruz: kullanıcı bir yol
      // verdiyse onun kullanılmasını bekliyor demektir.
      return {
        directory: null,
        status: {
          description:
            `Moshier (SWISSEPH_EPHE_PATH="${fromEnv}" does not exist — full ` +
            'precision NOT loaded)',
          full: false,
        },
      };
    }
    return {
      directory: fromEnv,
      status: { description: `full ephemeris (${fromEnv})`, full: true },
    };
  }

  try {
    const require = createRequire(import.meta.url);
    const manifest = require.resolve('@kuntay/swisseph-data/manifest.json');
    const directory = join(dirname(manifest), 'ephe');
    if (existsSync(join(directory, 'sepl_18.se1'))) {
      return {
        directory,
        status: { description: 'full ephemeris (@kuntay/swisseph-data)', full: true },
      };
    }
  } catch {
    // Veri paketi kurulu değil — geçerli ve yaygın durum.
  }

  return {
    directory: null,
    status: {
      description: 'Moshier (built-in analytic theory, no data files)',
      full: false,
    },
  };
}

const located = locateEphemeris();

export const ephemerisStatus: EphemerisStatus = located.status;

/**
 * Runs `work` against a fresh instance and disposes it afterwards.
 *
 * The directory is mounted through NODEFS rather than copied, so the 2 MB of
 * data is shared across instances instead of duplicated per call.
 */
export async function withEphemeris<T>(work: (swe: SwissEph) => T): Promise<T> {
  const swe = await createSwissEph();
  try {
    if (located.directory) swe.mountEphemerisDirectory(located.directory);
    return work(swe);
  } finally {
    swe.dispose();
  }
}
