/**
 * The runtime precondition, in a module of its own.
 *
 * It lives apart from both `cli.ts` and `index.ts` for a structural reason,
 * not a stylistic one. `cli.ts` is the bin and reaches the server with
 * `await import('./index.js')`; if `index.ts` imports anything back out of
 * `cli.ts`, the two deadlock. ES modules with top-level await make the cycle
 * unresolvable rather than merely awkward: `cli.js` is suspended at its await
 * and so its evaluation has not completed, `index.js` cannot begin until it
 * does, and `cli.js` cannot resume until `index.js` finishes. Node drains the
 * event loop and exits 13 with *Detected unsettled top-level await* — no
 * server, no error, no output on stdout.
 *
 * This shipped. 0.2.1's bin could not start at all, and it was the exact
 * command `install` writes into every client config. It survived the test
 * suite because every test drove either `index.js` directly or the bin with a
 * subcommand, and a subcommand exits before reaching the import. The path
 * nothing covered was the ordinary one: the bin with no arguments.
 *
 * So: nothing that `index.ts` needs may live in `cli.ts`. Keeping this
 * function here is what enforces that.
 */
/** package.json `engines.node`, as a number we can compare against. */
export const MINIMUM_NODE_MAJOR = 20;
/**
 * Refuses to start on a runtime that cannot run this.
 *
 * `engines.node` is advisory — npm prints a warning and runs the thing anyway,
 * and npx does not even warn. What the user then sees is a syntax error or a
 * missing global from deep inside a dependency, which reads as "this server is
 * broken" rather than "this Node is too old". One sentence naming both
 * versions costs nothing and answers the question.
 */
export function assertSupportedNode(reportedVersion = process.versions.node) {
    const major = Number(reportedVersion.split('.')[0]);
    if (Number.isFinite(major) && major < MINIMUM_NODE_MAJOR) {
        process.stderr.write(`swisseph-mcp needs Node ${MINIMUM_NODE_MAJOR} or newer; this is Node ` +
            `${reportedVersion}.\nUpgrade Node, or point your MCP client at a newer ` +
            'one with an absolute path to its executable.\n');
        process.exit(1);
    }
}
//# sourceMappingURL=node-version.js.map