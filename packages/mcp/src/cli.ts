#!/usr/bin/env node
/**
 * The command line — everything that happens before this becomes a server.
 *
 * An MCP server is started by a program, not by a person, so argv was ignored
 * outright: every invocation opened a stdio transport and waited. That is
 * wrong in the one case where a person *is* at the keyboard. `swisseph-mcp
 * --version`, typed to check an install, printed nothing and hung until
 * Ctrl-C — a healthy server looking exactly like a broken one. Anyone
 * debugging a connection tries that command first.
 *
 * So this module owns argv, and hands over to the server only when no
 * subcommand was given. It is the bin entry; `index.js` stays the server and
 * the package's main export, and importing it starts serving as before.
 *
 * Nothing here imports the ephemeris. `doctor` pulls it in dynamically,
 * because that is the one subcommand that should pay for loading a megabyte
 * of WebAssembly.
 */

import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

/** The npm name, in one place — it appears in every config block we print. */
export const PACKAGE_NAME = '@kuntay/swisseph-mcp';

/** Server key written into client configs. Also the name reported over MCP. */
export const SERVER_KEY = 'swisseph';

/** package.json `engines.node`, as a number we can compare against. */
export const MINIMUM_NODE_MAJOR = 20;

// --- the launch line -----------------------------------------------------

export interface Launch {
  command: string;
  args: string[];
}

/**
 * The command a client config must contain, which is not the same on every
 * platform.
 *
 * Every MCP server's README says `"command": "npx"`. On Windows that is wrong,
 * and it fails in a way that reads as "this server is broken" rather than
 * "this line is wrong". A client spawns the command without a shell, and:
 *
 *   spawn('npx')      → ENOENT   — there is no `npx`, only `npx.cmd`
 *   spawn('npx.cmd')  → EINVAL   — Node refuses to spawn .cmd/.bat without a
 *                                  shell since the BatBadBut fix (CVE-2024-27980)
 *   spawn('cmd', ['/c', 'npx'])  → works
 *
 * All three measured on Node 24.12 / Windows 11. The `cmd /c` form also works
 * in clients that *do* use a shell — nesting one cmd inside another is fine —
 * so it is the single form that is correct everywhere on Windows, and there is
 * no case where plain `npx` is preferable there.
 */
export function launchCommand(platform: NodeJS.Platform = process.platform): Launch {
  return platform === 'win32'
    ? { command: 'cmd', args: ['/c', 'npx', '-y', PACKAGE_NAME] }
    : { command: 'npx', args: ['-y', PACKAGE_NAME] };
}

/** The entry as most clients want it: `{ command, args }` under a server key. */
export function serverEntry(platform: NodeJS.Platform = process.platform): Launch {
  const { command, args } = launchCommand(platform);
  return { command, args };
}

// --- clients -------------------------------------------------------------

/**
 * How a given client stores MCP servers.
 *
 * `json` clients keep a map of servers in a JSON file and can be edited
 * mechanically. `command` clients own their config through a CLI, and we print
 * the command rather than reaching into a file another program is managing.
 * `toml` is Codex: hand-written TOML with comments, which no round-trip
 * through a naive parser survives, so that one is printed too.
 */
export type ClientKind = 'json' | 'command' | 'toml';

export interface Client {
  id: string;
  label: string;
  kind: ClientKind;
  /** Config file for this platform, or null where there is no known location. */
  file: string | null;
  /** The object that holds the server map. VS Code calls it `servers`. */
  mapKey: string;
  /** For `command` clients: what to run instead of editing a file. */
  command?: string;
  /** For `toml` clients: the block to paste. */
  snippet?: string;
  /** One line explaining anything surprising about this client. */
  note?: string;
}

function appData(): string | null {
  return process.env.APPDATA ?? null;
}

/** Per-platform config location for the Electron apps that share a layout. */
function electronConfig(
  dir: string, file: string, platform: NodeJS.Platform,
): string | null {
  if (platform === 'win32') {
    const base = appData();
    return base ? join(base, dir, file) : null;
  }
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', dir, file);
  }
  return join(homedir(), '.config', dir, file);
}

export function knownClients(platform: NodeJS.Platform = process.platform): Client[] {
  const { command, args } = launchCommand(platform);

  return [
    {
      id: 'claude-desktop',
      label: 'Claude Desktop',
      kind: 'json',
      file: electronConfig('Claude', 'claude_desktop_config.json', platform),
      mapKey: 'mcpServers',
      note: 'Quit and reopen Claude Desktop afterwards — it reads this file only at startup.',
    },
    {
      id: 'claude-code',
      label: 'Claude Code',
      kind: 'command',
      file: null,
      mapKey: 'mcpServers',
      command: `claude mcp add ${SERVER_KEY} --scope user -- ${command} ${args.join(' ')}`,
      note: 'Or drop a .mcp.json in the project — Claude Code reads that too, and it travels with the repo.',
    },
    {
      id: 'cursor',
      label: 'Cursor',
      kind: 'json',
      file: join(homedir(), '.cursor', 'mcp.json'),
      mapKey: 'mcpServers',
    },
    {
      id: 'vscode',
      label: 'VS Code (GitHub Copilot)',
      kind: 'json',
      file: electronConfig('Code', join('User', 'mcp.json'), platform),
      mapKey: 'servers',
      note: 'VS Code calls the map "servers", not "mcpServers".',
    },
    {
      id: 'windsurf',
      label: 'Windsurf',
      kind: 'json',
      file: join(homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
      mapKey: 'mcpServers',
    },
    {
      id: 'gemini',
      label: 'Gemini CLI',
      kind: 'json',
      file: join(homedir(), '.gemini', 'settings.json'),
      mapKey: 'mcpServers',
    },
    {
      id: 'codex',
      label: 'Codex CLI',
      kind: 'toml',
      file: join(homedir(), '.codex', 'config.toml'),
      mapKey: 'mcp_servers',
      snippet: [
        `[mcp_servers.${SERVER_KEY}]`,
        `command = "${command}"`,
        `args = [${args.map((a) => `"${a}"`).join(', ')}]`,
      ].join('\n'),
      note: 'Hand-edited TOML with comments; we print the block rather than rewrite the file.',
    },
  ];
}

// --- rendering -----------------------------------------------------------

/** The JSON block for a client, ready to paste. */
export function renderConfig(client: Client, platform: NodeJS.Platform = process.platform): string {
  if (client.kind === 'toml') return client.snippet ?? '';
  if (client.kind === 'command') return client.command ?? '';
  return JSON.stringify({ [client.mapKey]: { [SERVER_KEY]: serverEntry(platform) } }, null, 2);
}

// --- writing -------------------------------------------------------------

export interface WriteResult {
  client: Client;
  status: 'written' | 'unchanged' | 'would-write' | 'skipped' | 'failed';
  detail: string;
  backup?: string;
}

/**
 * Adds our entry to a client's JSON config, leaving everything else alone.
 *
 * Three refusals, all deliberate. A file that does not parse is never
 * overwritten — VS Code's `mcp.json` permits comments and JSON.parse does not,
 * and silently replacing a config full of other servers with a fresh one
 * holding only ours would be the worst outcome this command could produce. An
 * entry that already matches is left untouched, so running this twice is a
 * no-op. And the previous file is copied aside before any write.
 */
export function installIntoJson(
  client: Client, options: { dryRun?: boolean } = {},
): WriteResult {
  const file = client.file;
  if (!file) {
    return { client, status: 'skipped', detail: 'no known config location on this platform' };
  }

  const entry = serverEntry();
  let document: Record<string, unknown> = {};

  if (existsSync(file)) {
    const raw = readFileSync(file, 'utf8');
    try {
      document = raw.trim() === '' ? {} : (JSON.parse(raw) as Record<string, unknown>);
    } catch (error) {
      return {
        client,
        status: 'failed',
        detail: `${file} is not valid JSON (${(error as Error).message}) — ` +
          'left untouched. Add the block by hand.',
      };
    }
  }

  const map = (document[client.mapKey] ?? {}) as Record<string, unknown>;
  const existing = map[SERVER_KEY];
  if (existing && JSON.stringify(existing) === JSON.stringify(entry)) {
    return { client, status: 'unchanged', detail: `already configured in ${file}` };
  }

  map[SERVER_KEY] = entry;
  document[client.mapKey] = map;

  if (options.dryRun) {
    return { client, status: 'would-write', detail: file };
  }

  let backup: string | undefined;
  if (existsSync(file)) {
    backup = `${file}.bak`;
    copyFileSync(file, backup);
  } else {
    mkdirSync(dirname(file), { recursive: true });
  }

  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return {
    client,
    status: 'written',
    detail: existing ? `replaced the existing entry in ${file}` : `added to ${file}`,
    ...(backup ? { backup } : {}),
  };
}

// --- subcommands ---------------------------------------------------------

function usage(): string {
  const { command, args } = launchCommand();
  return [
    `swisseph-mcp ${version} — Swiss Ephemeris as an MCP server`,
    '',
    'With no arguments it speaks the Model Context Protocol over stdio, which',
    'is what an MCP client wants. The subcommands are for people.',
    '',
    '  swisseph-mcp                 run the server on stdio',
    '  swisseph-mcp doctor          check this machine and print the config to paste',
    '  swisseph-mcp install         write the config into every client found here',
    '  swisseph-mcp install <id>    write it into one client',
    '  swisseph-mcp config [<id>]   print the config without writing anything',
    '  swisseph-mcp --version       print the version',
    '  swisseph-mcp --help          this text',
    '',
    'Flags: --dry-run (with install), --json (with config)',
    '',
    `Clients: ${knownClients().map((c) => c.id).join(', ')}`,
    '',
    'Launch line on this platform:',
    `  ${command} ${args.join(' ')}`,
    '',
    'Ephemeris data is optional. Without it the built-in Moshier theory is used,',
    'which is under 0.07" for the Sun. For the JPL-derived files either install',
    '@kuntay/swisseph-data or set SWISSEPH_EPHE_PATH to a directory of .se1 files.',
  ].join('\n');
}

/** `config` — print, write nothing. */
function configCommand(argv: string[]): number {
  const wantJson = argv.includes('--json');
  const id = argv.find((a) => !a.startsWith('-'));
  const clients = knownClients();

  if (id) {
    const client = clients.find((c) => c.id === id);
    if (!client) {
      process.stderr.write(
        `Unknown client "${id}". Known: ${clients.map((c) => c.id).join(', ')}\n`);
      return 1;
    }
    process.stdout.write(`${renderConfig(client)}\n`);
    return 0;
  }

  if (wantJson) {
    process.stdout.write(
      `${JSON.stringify({ mcpServers: { [SERVER_KEY]: serverEntry() } }, null, 2)}\n`);
    return 0;
  }

  const lines: string[] = [];
  for (const client of clients) {
    lines.push(`--- ${client.label} (${client.id}) ---`);
    if (client.file) lines.push(client.file);
    if (client.note) lines.push(client.note);
    lines.push('');
    lines.push(renderConfig(client));
    lines.push('');
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

/** `install` — write the entry into client configs. */
function installCommand(argv: string[]): number {
  const dryRun = argv.includes('--dry-run');
  const requested = argv.filter((a) => !a.startsWith('-'));
  const clients = knownClients();

  const unknown = requested.filter((id) => !clients.some((c) => c.id === id));
  if (unknown.length > 0) {
    process.stderr.write(
      `Unknown client${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}\n` +
      `Known: ${clients.map((c) => c.id).join(', ')}\n`);
    return 1;
  }

  /*
   * Adres verilmediyse SADECE bu makinede kurulu olduğu görülen istemcilere
   * yazıyoruz. Bir client dizinini yoktan var etmek, o programı kullanmayan
   * birinin diskinde ne olduğu belirsiz bir yapılandırma bırakır. Adı açıkça
   * verildiyse dosya yaratılıyor — o zaman istek ortada.
   */
  const targets = requested.length > 0
    ? clients.filter((c) => requested.includes(c.id))
    : clients.filter((c) => c.kind === 'json' && c.file !== null && existsSync(c.file));

  if (targets.length === 0) {
    process.stdout.write(
      'No client config files found on this machine.\n\n' +
      'Name one explicitly — `swisseph-mcp install claude-desktop` — or run\n' +
      '`swisseph-mcp config` and paste the block yourself.\n');
    return 0;
  }

  const results: WriteResult[] = [];
  for (const client of targets) {
    if (client.kind === 'json') {
      results.push(installIntoJson(client, { dryRun }));
    } else {
      results.push({
        client,
        status: 'skipped',
        detail: client.kind === 'command'
          ? `run this instead:\n    ${client.command}`
          : `add this to ${client.file}:\n\n${renderConfig(client)}`,
      });
    }
  }

  const lines: string[] = [];
  for (const r of results) {
    const mark = { written: '✓', unchanged: '=', 'would-write': '·', skipped: '→', failed: '✗' }[r.status];
    lines.push(`${mark} ${r.client.label}: ${r.detail}`);
    if (r.backup) lines.push(`  previous file kept at ${r.backup}`);
    if (r.client.note && r.status === 'written') lines.push(`  ${r.client.note}`);
  }
  if (dryRun) lines.push('', 'Nothing was written — --dry-run.');
  process.stdout.write(`${lines.join('\n')}\n`);

  return results.some((r) => r.status === 'failed') ? 1 : 0;
}

/**
 * `doctor` — answers "why is my client not seeing this server?".
 *
 * The order is the order things fail in: the runtime, then the package, then
 * the ephemeris, then an actual calculation, then the line the client needs.
 * A real computation is run rather than merely imported, because loading the
 * module proves nothing about whether the WebAssembly instantiates.
 */
async function doctorCommand(): Promise<number> {
  const lines: string[] = [`swisseph-mcp ${version}`, ''];
  let healthy = true;

  const major = Number(process.versions.node.split('.')[0]);
  const nodeOk = major >= MINIMUM_NODE_MAJOR;
  healthy &&= nodeOk;
  lines.push(`${nodeOk ? '✓' : '✗'} Node ${process.versions.node}` +
    (nodeOk ? '' : ` — this package needs ${MINIMUM_NODE_MAJOR} or newer`));
  lines.push(`  platform ${process.platform} ${process.arch}`);

  let ephemeris = 'not determined';
  try {
    const { ephemerisStatus, withEphemeris } = await import('./session.js');
    ephemeris = ephemerisStatus.description;
    lines.push(`✓ ephemeris: ${ephemeris}`);

    const { Body } = await import('@kuntay/swisseph');
    const sun = await withEphemeris((swe) => {
      const jd = swe.julianDay(2000, 1, 1, 12);
      return swe.calc(jd, Body.Sun).longitude;
    });
    /*
     * ÇIPA, doğruluk ölçüsü DEĞİL. J2000.0'da Güneş'in görünür boylamı 280.4°
     * dolayında (bu kurulumda ölçülen: 280.3689°; 280.46 diye bilinen sayı
     * ORTALAMA boylam, görünür olan değil — ikisini karıştırmamak için burada
     * ölçülen değer yazılı). Kaç ondalık tuttuğunu check-golden denetliyor;
     * buradaki tek soru WASM'in gerçekten kurulup anlamlı bir sayı döndürüp
     * döndürmediği. Bozulan her durumda sonuç NaN ya da yüzlerce derece uzakta
     * çıkar, bir derecelik pencere ikisini de yakalar.
     */
    const plausible = Number.isFinite(sun) && Math.abs(sun - 280.4) < 1;
    healthy &&= plausible;
    lines.push(`${plausible ? '✓' : '✗'} calculation: Sun at J2000.0 = ${sun.toFixed(4)}°` +
      (plausible ? '' : ' — expected about 280.4°'));
  } catch (error) {
    healthy = false;
    lines.push(`✗ the ephemeris failed to load: ${(error as Error).message}`);
  }

  lines.push('');
  const { command, args } = launchCommand();
  lines.push('Launch line for this platform:');
  lines.push(`  ${command} ${args.join(' ')}`);
  if (process.platform === 'win32') {
    lines.push('  (on Windows this must be `cmd /c npx`, not `npx` — a client that');
    lines.push('   spawns without a shell gets ENOENT from `npx` and EINVAL from `npx.cmd`)');
  }

  lines.push('');
  lines.push('Clients found on this machine:');
  const clients = knownClients();
  const found = clients.filter((c) => c.file !== null && existsSync(c.file));
  if (found.length === 0) {
    lines.push('  none of the known config files exist yet');
  } else {
    for (const client of found) {
      let configured = false;
      if (client.kind === 'json' && client.file) {
        try {
          const doc = JSON.parse(readFileSync(client.file, 'utf8')) as Record<string, unknown>;
          const map = doc[client.mapKey] as Record<string, unknown> | undefined;
          configured = Boolean(map && map[SERVER_KEY]);
        } catch {
          // Ayrıştırılamayan dosya "yapılandırılmamış" sayılır; install da
          // ona dokunmuyor, ikisi aynı şeyi söylüyor.
        }
      }
      lines.push(`  ${configured ? '✓' : '·'} ${client.label} — ${client.file}` +
        (configured ? ' (configured)' : ''));
    }
    lines.push('');
    lines.push('Run `swisseph-mcp install` to add the entry to the unconfigured ones.');
  }

  process.stdout.write(`${lines.join('\n')}\n`);
  return healthy ? 0 : 1;
}

// --- dispatch ------------------------------------------------------------

/**
 * Runs a subcommand if argv names one.
 *
 * Returns an exit code, or null meaning "no subcommand — go and be a server".
 * Unrecognised arguments are an error rather than being ignored: a client
 * passing something we do not understand is a misconfiguration, and starting
 * up anyway hides it.
 */
export async function runCli(argv: string[]): Promise<number | null> {
  const [first, ...rest] = argv;

  if (first === undefined) return null;

  switch (first) {
    case '-v':
    case '--version':
      process.stdout.write(`${version}\n`);
      return 0;

    case '-h':
    case '--help':
    case 'help':
      process.stdout.write(`${usage()}\n`);
      return 0;

    case 'doctor':
      return doctorCommand();

    case 'config':
      return configCommand(rest);

    case 'install':
      return installCommand(rest);

    default:
      process.stderr.write(
        `swisseph-mcp: unrecognised argument "${first}".\n` +
        'Run `swisseph-mcp --help`, or pass no arguments to start the server.\n');
      return 2;
  }
}

/**
 * Refuses to start on a runtime that cannot run this.
 *
 * `engines.node` is advisory — npm prints a warning and runs the thing anyway,
 * and npx does not even warn. What the user then sees is a syntax error or a
 * missing global from deep inside a dependency, which reads as "this server is
 * broken" rather than "this Node is too old". One sentence naming both
 * versions costs nothing and answers the question.
 */
export function assertSupportedNode(reportedVersion = process.versions.node): void {
  const major = Number(reportedVersion.split('.')[0]);
  if (Number.isFinite(major) && major < MINIMUM_NODE_MAJOR) {
    process.stderr.write(
      `swisseph-mcp needs Node ${MINIMUM_NODE_MAJOR} or newer; this is Node ` +
      `${reportedVersion}.\nUpgrade Node, or point your MCP client at a newer ` +
      'one with an absolute path to its executable.\n');
    process.exit(1);
  }
}

// --- entry ---------------------------------------------------------------

/*
 * Bu dosya paketin `bin`i. Kütüphane olarak da içe aktarılabildiği için —
 * testler tam olarak bunu yapıyor — çalıştırma yalnızca doğrudan başlatıldığında
 * yapılıyor.
 */
const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  assertSupportedNode();
  const code = await runCli(process.argv.slice(2));
  if (code === null) {
    await import('./index.js');
  } else {
    process.exit(code);
  }
}
