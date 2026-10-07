#!/usr/bin/env node
// status-warn.mjs — print the first warning from a wrapper's STATUS line.
// The wrapper warn→fatal pattern (SEC Newgate first): the extractor keeps
// exit 0 so the wave files, the wrapper turns a non-empty `warnings` array
// into the run's FAILURE after everything landed. Every wrapper used to
// inline this as its own node -e one-liner.
// Usage: node .build/status-warn.mjs PREFIX LINE
//   PREFIX  the status token without the trailing space (e.g. N24_STATUS)
//   LINE    the extractor's final line ("$LAST")
// Prints warnings[0] or nothing; exit 1 when LINE isn't a PREFIX line.
const [prefix, line] = process.argv.slice(2);
if (!prefix || typeof line !== "string" || !line.startsWith(`${prefix} `)) process.exit(1);
const s = JSON.parse(line.slice(prefix.length + 1));
const w = Array.isArray(s.warnings) ? s.warnings.filter(Boolean) : [];
if (w.length) console.log(w[0]);
