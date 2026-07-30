# @kuntay/swisseph-data

Swiss Ephemeris `.se1` data files for **1800–2399 CE** — the optional
full-precision companion to [`@kuntay/swisseph`](https://www.npmjs.com/package/@kuntay/swisseph).

**2.05 MB.** Also served free from jsDelivr and unpkg for browser use.

> **License: AGPL-3.0-or-later.** See [NOTICE](./NOTICE).

## What this is for

`@kuntay/swisseph` works on its own using the built-in Moshier theory, with no
data files. This package upgrades it to the full ephemeris derived from NASA/JPL
DE441.

**It is an optimisation, not a requirement.** Swiss Ephemeris falls back to
Moshier automatically when a file is missing or a date falls outside the covered
range, so a missing or failed install degrades precision — it does not break
anything.

The practical difference is under 6 arcseconds in the worst case (Pluto near
2399) and under 0.07″ for the Sun. That is invisible for astrology and relevant
for astronomy or reference fidelity. See the
[accuracy table](https://github.com/kuntayerkus/swisseph-wasm#accuracy-honestly).

## Contents

| File | Size | Contents |
|---|---|---|
| `sepl_18.se1` | 473 KB | Planets |
| `semo_18.se1` | 1274 KB | Moon |
| `seas_18.se1` | 218 KB | Ceres, Pallas, Juno, Vesta, Chiron, Pholus |
| `sefstars.txt` | 133 KB | Fixed star catalogue, 1360 entries |
| `seorbel.txt` | 6 KB | Orbital elements for hypothetical bodies |

Coverage is **1800–2399 CE**. Outside that range calculations fall back to
Moshier automatically.

## Credits

Data files produced by Astrodienst AG from NASA/JPL Development Ephemeris DE441.
Upstream: <https://github.com/aloistr/swisseph>
