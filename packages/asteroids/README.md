# @kuntay/swisseph-asteroids

Ephemeris files for 16 popular asteroids and dwarf planets — the optional
asteroid companion to [`@kuntay/swisseph`](https://www.npmjs.com/package/@kuntay/swisseph).

**409 KB. Covers 1500–2100 CE.**

> **License: AGPL-3.0-or-later.** See [NOTICE](./NOTICE).

## Contents

| Body | MPC # | | Body | MPC # |
|---|---|---|---|---|
| Astraea | 5 | | Ixion | 28978 |
| Hygiea | 10 | | Quaoar | 50000 |
| Psyche | 16 | | Sedna | 90377 |
| Eros | 433 | | Orcus | 90482 |
| Lilith *(asteroid)* | 1181 | | Haumea | 136108 |
| Nessus | 7066 | | Eris | 136199 |
| Chariklo | 10199 | | Makemake | 136472 |
| Varuna | 20000 | | Gonggong | 225088 |

Ceres, Pallas, Juno, Vesta, Chiron and Pholus are **not** here — they already
live in the main ephemeris (`seas_18.se1`) that ships with
`@kuntay/swisseph-data`.

## Usage

```ts
import { createSwissEph, Asteroid, asteroidBody } from '@kuntay/swisseph';

const swe = await createSwissEph();
// ... mount the main ephemeris and this package's ephe/ directory ...

const eris = swe.calc(jd, asteroidBody(Asteroid.Eris));
```

**Always go through `asteroidBody()`** rather than `AsteroidOffset + number`.
Swiss Ephemeris only remaps MPC numbers 1–4 to its built-in bodies, so
`AsteroidOffset + 2060` looks for a `se02060s.se1` file and throws, even though
Chiron is present in the main ephemeris. `asteroidBody()` resolves the six
built-in bodies to their `Body` constants and everything else to the offset.

## Two behaviours that differ from planets

**Missing files are hard errors.** Planets silently fall back to the built-in
Moshier theory when a file is absent. Asteroids have no analytic theory, so a
missing file throws. Catch it.

**Coverage is narrower.** These are the *short* files: 1500–2100 CE. Long
versions covering 3000 BCE – 2999 CE exist upstream but are roughly 10× larger
(Eros: 92 KB short, 914 KB long).

## Provenance

Files are fetched from the HTTP mirror listed in the upstream readme
(<https://ephe.scryr.io/ephe>, provided by Phillip McCabe) and verified to
carry a valid `.se1` header. `manifest.json` records the SHA-256 of every file.

Data produced by Astrodienst AG from NASA/JPL Development Ephemeris DE441.
Upstream: <https://github.com/aloistr/swisseph>
