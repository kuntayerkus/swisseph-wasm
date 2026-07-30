# @kuntay/swisseph-mcp

Swiss Ephemeris as a [Model Context Protocol](https://modelcontextprotocol.io)
server. Gives a language model exact astronomical and astrological
calculations instead of plausible-looking guesses.

> ## ⚠️ Licence: AGPL-3.0 — read before deploying
>
> Running this on your own machine, for yourself, carries no obligation.
>
> **Exposing it as a hosted service does.** AGPL-3.0 §13 means anyone
> interacting with it over a network must be offered the source of your whole
> application. If you want to run a closed-source service, you need a Swiss
> Ephemeris Professional License from
> [Astrodienst](https://www.astro.com/swisseph/).

## Why this exists

Ask a model for a birth chart and it will produce something confident and
wrong. Planetary positions come out of a series expansion with thousands of
terms, corrected for ΔT, nutation, aberration and light-time — not something
that can be reasoned out or recalled. Models do not know this about
themselves, so they answer anyway.

This server moves the arithmetic to a WebAssembly build of Swiss Ephemeris and
hands back finished text.

## Install

```bash
npm install -g @kuntay/swisseph-mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "swisseph": {
      "command": "npx",
      "args": ["-y", "@kuntay/swisseph-mcp"]
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add swisseph -- npx -y @kuntay/swisseph-mcp
```

Then ask in plain language: *"Cast a chart for 15 May 1990, 17:30, Ankara."*

## Full precision

The server works with no data files, using Swiss Ephemeris's built-in Moshier
theory — accurate to about a quarter of an arcsecond for the outer planets and
under 0.07″ for the Sun. That is far finer than any birth time is known.

For the full JPL DE441-derived ephemeris, either install the data package:

```bash
npm install @kuntay/swisseph-data
```

or point the server at a directory of `.se1` files:

```json
{
  "mcpServers": {
    "swisseph": {
      "command": "npx",
      "args": ["-y", "@kuntay/swisseph-mcp"],
      "env": { "SWISSEPH_EPHE_PATH": "/path/to/ephe" }
    }
  }
}
```

Every answer states which was used. A path that does not exist is reported
rather than silently ignored.

## Tools

| Tool | What it returns |
|---|---|
| `natal_chart` | Positions with declinations, houses and angles, **aspects**, essential dignities, Arabic lots, sect |
| `transits` | Transiting positions and every cross-chart aspect, applying or separating |
| `synastry` | Aspects between two charts, cross-pairs only |
| `return_chart` | Solar or lunar return, with the full chart for that moment |
| `eclipses` | Next solar or lunar eclipse, globally or as visible from a place |
| `rise_set` | Rise, culmination, set and anticulmination times |
| `time_lords` | Annual, monthly and daily profection plus Persian firdaria |
| `declinations` | Declinations, parallels, contraparallels, out-of-bounds bodies |

### Aspects are computed here

This matters more than it looks. If the tool returned only longitudes, the
model would derive the aspects itself — and it would get them wrong. It would
have to handle the 0/360 wrap (355° and 85° are square), apply an orb scheme
where the allowance depends on the bodies involved, and decide applying versus
separating for a retrograde planet. Three chances to fail, taken silently.

Three orb schemes are available through `orb_scheme`:

- **`modern`** (default) — the orb belongs to the aspect. The usual software
  default.
- **`traditional`** — each body carries half an orb and the two halves are
  added, so the luminaries get wide orbs. This is the moiety scheme.
- **`tight`** — close contacts only.

## Design notes

**Local time, not UT.** Every tool takes the clock time as it was read at the
place, plus a zone. Passing a birth time through as UT is the single most
common way to produce a wrong chart — for Ankara it moves the Ascendant about
36°. Prefer an IANA zone name (`Europe/Istanbul`) over a fixed offset: Türkiye
observed daylight saving until 2016, so a May 1990 birth is +03 and a January
1990 birth is +02, and nobody remembers that correctly. Every answer echoes
the derived UT back so the conversion is visible.

**Degrees are formatted, not raw.** Positions come back as `24°30'11" Taurus`
with the decimal alongside. Handed only `54.5033`, a model converts it itself
and **rounds**, while astrology software **truncates** — a difference that
produced a phantom one-arcminute disagreement on four of ten bodies in this
project's own demo.

**Failures are stated, not hidden.** A body that needs a missing data file is
reported as unavailable rather than dropped. A house system undefined at high
latitude reports the substitution. A body that never rises at a polar latitude
returns "does not occur", which is an answer, not an error.

**One instance per call.** Swiss Ephemeris keeps all its state in a single
global C struct, so a shared instance would leak settings between calls. A
fresh instance costs about 9 ms against 0.6 ms for a full chart.

## Licence

AGPL-3.0-or-later, following Swiss Ephemeris's dual-licence terms. See
[LICENSE](LICENSE) and [NOTICE](NOTICE).
