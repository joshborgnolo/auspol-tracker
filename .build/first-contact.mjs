#!/usr/bin/env node
// First-contact state file — the fire-once memory for the new-pollster
// importer (.github/workflows/first-contact.yml, the agent's prompt is
// .build/first-contact-prompt.md).
//
// check-coverage.mjs emits a FIRST_CONTACT line for EVERY pollster name on
// the Wikipedia witness table that maps to no tracked house, unconditionally.
// This file is what stops that becoming a daily agent session for the same
// house: the workflow's gate keeps only names ABSENT here, records them
// `pending` before spending a session, and every recorded verdict —
// pending (session in flight or its branch awaiting review), attempted
// (session filed nothing; the ci-alert named this file for the reset),
// imported (waves landed), ignored (deliberately untracked) — suppresses a
// refire. Retrying an attempted house is a human edit: delete its entry, or
// `node .build/first-contact.mjs ignore "<name>" <reason>` to close it out.
//
// The file is valid JSON (JSON.parse reads it) laid out ONE ENTRY PER LINE,
// keys sorted — a review branch flipping its own verdict is a one-line diff
// and merges cleanly against entries main appended since the branch was cut.
//
// Usage:
//   node .build/first-contact.mjs filter '<FIRST_CONTACT json>'   → JSON array of unsuppressed names
//   node .build/first-contact.mjs pending "<name>" ["<name>"...]  → record fired names (creates only absent ones)
//   node .build/first-contact.mjs attempted "<name>" <runUrl>     → session filed nothing
//   node .build/first-contact.mjs imported "<name>"               → the import branch's own flip
//   node .build/first-contact.mjs ignore "<name>" <reason...>     → never track this name
//   node .build/first-contact.mjs slug "<name>"                   → branch-name slug on stdout
//   node .build/first-contact.mjs show
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { melbourneDate } from "./melbourne-time.mjs";

const FILE = ".build/first-contact-seen.json";

export const normKey = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function readSeen(file = FILE) {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8"));
}

export function writeSeen(seen, file = FILE) {
  const keys = Object.keys(seen).sort();
  writeFileSync(file, keys.length
    ? "{\n" + keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(seen[k])}`).join(",\n") + "\n}\n"
    : "{}\n");
}

const todayLocal = () => melbourneDate(new Date());

function upsert(name, patch) {
  const seen = readSeen();
  const key = normKey(name);
  const cur = seen[key] ?? { name: name.trim(), firstSeen: todayLocal() };
  seen[key] = { ...cur, ...patch, lastSeen: todayLocal() };
  writeSeen(seen);
  return seen[key];
}

// Names the workflow may interpolate into a job matrix and commit messages.
// Anything else (shell metacharacters ride a hostile wiki edit straight into
// the runner) is held back as unsafe — recorded here, alerted and left for a
// human rather than fired.
const SAFE_NAME = /^[A-Za-z0-9 .&(),'\-]+$/;
const MAX_PER_RUN = 3;

export function pickNames(contacts, seen = readSeen()) {
  const fresh = contacts.map((c) => c.name).filter((n) => !seen[normKey(n)]);
  return {
    names: fresh.filter((n) => SAFE_NAME.test(n)).slice(0, MAX_PER_RUN),
    unsafe: fresh.filter((n) => !SAFE_NAME.test(n)),
  };
}

function run(argv) {
  const [verb, ...rest] = argv;
  switch (verb) {
    case "filter": {
      const contacts = JSON.parse(rest[0] ?? "[]");
      const seen = readSeen();
      console.log(JSON.stringify(contacts.map((c) => c.name).filter((n) => !seen[normKey(n)])));
      break;
    }
    case "pick":
      console.log(JSON.stringify(pickNames(JSON.parse(rest[0] ?? "[]"))));
      break;
    case "pending":
      if (!rest.length) throw new Error("pending needs at least one name");
      for (const name of rest) {
        const seen = readSeen();
        if (seen[normKey(name)]) continue; // absent-only: never rewind a recorded verdict
        upsert(name, { verdict: "pending" });
      }
      break;
    case "attempted": {
      const [name, runUrl] = rest;
      if (!name || !runUrl) throw new Error("attempted needs <name> <runUrl>");
      upsert(name, { verdict: "attempted", runUrl });
      break;
    }
    case "imported": {
      if (!rest[0]) throw new Error("imported needs a name");
      upsert(rest[0], { verdict: "imported" });
      break;
    }
    case "ignore": {
      const [name, ...words] = rest;
      if (!name || !words.length) throw new Error("ignore needs <name> <reason>");
      upsert(name, { verdict: "ignored", reason: words.join(" ") });
      break;
    }
    case "slug":
      console.log(rest[0].toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
      break;
    case "show":
      console.log(JSON.stringify(readSeen(), null, 2));
      break;
    default:
      throw new Error(`unknown verb ${JSON.stringify(verb)} — filter|pending|attempted|imported|ignore|slug|show`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2));
}
