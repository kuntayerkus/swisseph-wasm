# @kuntay/swisseph-geo

City → coordinates + timezone, without a web service.

Astrology software's most common input mistake is not the math but the
place and the clock: typing a latitude by hand, or guessing a timezone
offset from memory. This package replaces both with a lookup:

- **34,073 cities** (GeoNames cities15000, population ≥ 15,000) with
  latitude, longitude, country and **IANA timezone id** — bundled as
  `cities.tsv`, generated from the source, never hand-typed.
- **Timezone offset computation** via the platform's own `Intl` (no
  dependency): historical daylight saving is answered by the system's tz
  database, so a January 1990 chart in Istanbul gets +02 and a May 1990
  chart +03, without anyone remembering which was which.

## Usage

```ts
import { readFileSync } from 'node:fs';
import { parseCities, searchCities, offsetForWallClock, formatOffsetHours }
  from '@kuntay/swisseph-geo';

const cities = parseCities(readFileSync('cities.tsv', 'utf8'));
const [hit] = searchCities(cities, 'istanbul', { country: 'TR' });
// { name: 'İstanbul', latitude: 41.01, longitude: 28.97,
//   timezone: 'Europe/Istanbul', ... }

const { offsetHours, ambiguous } =
  offsetForWallClock(hit.timezone, 1990, 1, 15, 14, 30);
formatOffsetHours(offsetHours); // '+02:00'
```

`ambiguous` is true when the wall-clock time occurred twice (a
daylight-saving fall-back); the alternative offset is reported as
`alternativeOffsetHours`. Pair it with `@kuntay/swisseph`'s `julianDay()`:
UT hours = local decimal hours − offsetHours.

## Data provenance

`cities.tsv` is produced by `tools/build-geo-package.mjs` from GeoNames
(CC-BY 4.0 — see NOTICE). The manifest carries the SHA-256 of the file,
row count and the source URLs.
