# @kuntay/swisseph

Swiss Ephemeris 2.10.03 compiled to WebAssembly — planetary positions, house
systems, eclipses and fixed stars for Node.js, browsers, Deno and Bun.

**230 KB brotli. Works with no data files.**

> **License: AGPL-3.0-or-later.** Using this in a network service obliges you to
> release your application's source under a compatible license. If that does not
> work for you, obtain a
> [Swiss Ephemeris Professional License](https://www.astro.com/swisseph/) from
> Astrodienst AG. See [NOTICE](./NOTICE).

## Status

Under development — the typed API layer is being built. The WASM core is
compiled and verified.

## Precision without data files

The built-in Moshier theory needs no `.se1` files and stays within a fraction of
an arcsecond of the full JPL DE441-derived ephemeris across 1800–2399 CE — well
below the precision any astrological chart is drawn to. Install
`@kuntay/swisseph-data` when you need exact agreement with the reference
implementation.

Full accuracy table and rationale in the
[project README](https://github.com/kuntayerkus/swisseph-wasm).

## Credits

Swiss Ephemeris is the work of Dieter Koch and Alois Treindl at Astrodienst AG,
built on NASA/JPL's DE441. This package is a port, not original astronomical
work. Not affiliated with or endorsed by Astrodienst AG.
