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
/** The npm name, in one place — it appears in every config block we print. */
export declare const PACKAGE_NAME = "@kuntay/swisseph-mcp";
/** Server key written into client configs. Also the name reported over MCP. */
export declare const SERVER_KEY = "swisseph";
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
export declare function launchCommand(platform?: NodeJS.Platform): Launch;
/** The entry as most clients want it: `{ command, args }` under a server key. */
export declare function serverEntry(platform?: NodeJS.Platform): Launch;
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
export declare function knownClients(platform?: NodeJS.Platform): Client[];
/** The JSON block for a client, ready to paste. */
export declare function renderConfig(client: Client, platform?: NodeJS.Platform): string;
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
export declare function installIntoJson(client: Client, options?: {
    dryRun?: boolean;
}): WriteResult;
/**
 * Runs a subcommand if argv names one.
 *
 * Returns an exit code, or null meaning "no subcommand — go and be a server".
 * Unrecognised arguments are an error rather than being ignored: a client
 * passing something we do not understand is a misconfiguration, and starting
 * up anyway hides it.
 */
export declare function runCli(argv: string[]): Promise<number | null>;
//# sourceMappingURL=cli.d.ts.map