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

Nothing to install first — the command below fetches the package and writes
the right entry into every MCP client it finds on the machine:

```bash
npx -y @kuntay/swisseph-mcp install
```

Restart the client afterwards; most read their config only at startup. Then
ask in plain language: *"Cast a chart for 15 May 1990, 17:30, Ankara."*

Two companion commands:

```bash
npx -y @kuntay/swisseph-mcp doctor   # what is installed here, and is it working
npx -y @kuntay/swisseph-mcp config   # print the blocks, write nothing
```

`install` never overwrites a config it cannot parse, keeps a `.bak` of
anything it changes, and does nothing the second time you run it. Add
`--dry-run` to see the plan first, or name one client:
`install claude-desktop`.

### Configuring it by hand

<details>
<summary>macOS and Linux</summary>

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
</details>

<details>
<summary>Windows — the <code>npx</code> form above does not work</summary>

```json
{
  "mcpServers": {
    "swisseph": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@kuntay/swisseph-mcp"]
    }
  }
}
```

Most clients spawn the command directly, without a shell, and on Windows
there is no `npx` to spawn — only `npx.cmd`. Naming that instead does not
help: since the BatBadBut fix (CVE-2024-27980) Node refuses to spawn a
`.cmd` or `.bat` without a shell. Measured on Node 24.12 / Windows 11:

| `"command"` | result |
|---|---|
| `npx` | `ENOENT` |
| `npx.cmd` | `EINVAL` |
| `cmd` with `["/c", "npx", …]` | works |

The client reports this as a server that failed to start, which reads as a
broken server rather than a wrong line — and the model, finding no tool,
quietly answers from memory instead. The `cmd /c` form also works in clients
that *do* use a shell, so on Windows it is simply the correct form.
</details>

Where the file lives, and what the map is called:

| Client | File | Key |
|---|---|---|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` · `~/Library/Application Support/Claude/…` · `~/.config/Claude/…` | `mcpServers` |
| Claude Code | `claude mcp add swisseph --scope user -- …`, or a `.mcp.json` in the project | `mcpServers` |
| Cursor | `~/.cursor/mcp.json` | `mcpServers` |
| VS Code (Copilot) | `%APPDATA%\Code\User\mcp.json` · `~/Library/Application Support/Code/User/mcp.json` · `~/.config/Code/User/mcp.json` | **`servers`** |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` |
| Gemini CLI | `~/.gemini/settings.json` | `mcpServers` |
| Codex CLI | `~/.codex/config.toml` | `[mcp_servers.swisseph]` |

Anything else that speaks MCP over stdio works too — the server is a plain
stdio process with no options and no environment beyond the optional
`SWISSEPH_EPHE_PATH`.

### When it is not showing up

Run `npx -y @kuntay/swisseph-mcp doctor`. It checks the Node version, loads
the WebAssembly and computes one position with it, reports which ephemeris it
found, prints the launch line for the platform you are on, and lists which
client configs exist and which already have the entry.

Requires Node 20 or newer. Older versions are refused at startup with a
message saying so, rather than failing somewhere in a dependency.

## Full precision

The server works with no data files, using Swiss Ephemeris's built-in Moshier
theory — accurate to about a quarter of an arcsecond for the outer planets and
under 0.07″ for the Sun. That is far finer than any birth time is known.

For the full JPL DE441-derived ephemeris there are two routes, and which one
you can use depends on how the server is launched.

**With `npx`, use `SWISSEPH_EPHE_PATH`.** `npx` runs the package out of its own
cache directory, where a data package installed anywhere else is not on the
resolution path — so installing `@kuntay/swisseph-data` has no effect on an
npx-launched server. Point it at a directory of `.se1` files instead. `env`
sits beside `command` and `args`, whichever launch line your platform needs:

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

**Installed rather than npx'd, the data package is found on its own.** Install
the two together so they end up as siblings in one `node_modules`, then point
the client at the installed binary instead of `npx`:

```bash
npm install -g @kuntay/swisseph-mcp @kuntay/swisseph-data
```

```json
{
  "mcpServers": {
    "swisseph": { "command": "swisseph-mcp", "args": [] }
  }
}
```

Verified: with both packages side by side the server reports *full ephemeris
(@kuntay/swisseph-data)* at startup; installed apart, it does not. On Windows
a global bin is a `.cmd` shim, so the same `cmd /c` wrapper applies —
`"command": "cmd", "args": ["/c", "swisseph-mcp"]`.

Every answer states which was used. A path that does not exist is reported
rather than silently ignored, and `doctor` prints which one is in force.

Without the data files, Chiron and the other asteroids are reported as
unavailable — with an explanation of what to install, and an instruction not
to substitute a value. The planets, angles, houses, aspects, dignities and
lots are all unaffected: those come from Moshier and are complete.

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
