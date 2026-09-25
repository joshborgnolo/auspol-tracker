/* Did the dispatch clock start the runs it was meant to? Two questions, one
   module, both answered from GitHub's own run list — the Worker keeps no
   record, and the runs it starts are the only trace it leaves.

   backup     (poll-agent.yml's `clock` job, cron-triggered runs only)
              Since the clock went live (2026-09-24) every tuned slot runs
              twice: on the minute by workflow_dispatch, then again 2–5h
              later when GitHub's cron gets round to it. The second run
              re-fetches the pollster's site for nothing — Essential walled
              GitHub's runners for four days in Sep 2026 — and doubles every
              run list. So a cron run first asks: was every slot of the cron
              line that fired me, in the last day, already started by a
              dispatch that is running or went green? Then it is a duplicate
              and its update job is skipped. Anything else runs, and any
              doubt runs: a line this can't read, an API error, a slot the
              clock never carried (Essential's 05:02 skip-confirm, DemosAU's
              hourly gate), a cron block still on last week's UTC offset
              after a DST change, a dispatched run that failed.
              Prints SERVED {json}; writes served=true|false to
              $GITHUB_OUTPUT; always exits 0.

   heartbeat  (coverage-check.yml's heartbeat job, daily)
              Every slot schedule.json listed in the trailing 24h (settled:
              15 min old or more) should have a workflow_dispatch run of
              its workflow within minutes of it. If the Worker stops — its
              GitHub token expires or is revoked, the Cloudflare account
              lapses, schedule.json stops loading — the cron backup keeps
              the site updating, hours late, and nothing else would say so.
              Prints CLOCK_STATUS {json}; exit 0 healthy (or degraded, with
              a warning), 1 inconclusive (the run list unreadable), 3 the
              clock is dead or dying (under half its slots served).

   Env: GH_TOKEN, GITHUB_REPOSITORY; backup also CRON (github.event.schedule)
   and GITHUB_RUN_ID. Test seams: SERVED_NOW (an ISO instant) and SERVED_RUNS
   (a JSON file of runs in the API's shape) replace the clock and the API.
   Usage: node .build/dispatch-clock/served.mjs backup|heartbeat */
import { readFileSync, appendFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dueWorkflows } from "./clock.mjs";

const MIN = 60_000;
// A dispatch run counts for a slot when GitHub created it in this window.
// The Worker fires on the minute and runs appear within seconds (measured
// 39–44 s after the minute, 25 Sep 2026); the margins absorb clock skew and
// a slow API without reaching the next slot of a 10-minute comb.
export const EARLY_MS = 1 * MIN, LATE_MS = 5 * MIN;
const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");

/* A GitHub cron line (five UTC fields) → a matcher on instants. Reads what
   the tuner writes (lists, single values) and the rest of POSIX cron (*,
   ranges, steps, 7 as Sunday); anything else throws, and callers fail open. */
export function cronMatcher(expr) {
  const fields = String(expr || "").trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`cron "${expr}": want 5 fields`);
  const RANGE = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  const sets = fields.map((field, i) => {
    const [lo, hi] = RANGE[i];
    const out = new Set();
    for (const part of field.split(",")) {
      const m = /^(?:\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
      if (!m) throw new Error(`cron "${expr}": can't read "${part}"`);
      const step = m[3] ? +m[3] : 1;
      const a = m[1] !== undefined ? +m[1] : lo;
      const b = m[2] !== undefined ? +m[2] : m[1] !== undefined && !m[3] ? a : hi;
      if (a < lo || b > hi || a > b || step < 1) throw new Error(`cron "${expr}": "${part}" is out of range`);
      for (let v = a; v <= b; v += step) out.add(i === 4 && v === 7 ? 0 : v);
    }
    return out;
  });
  const [mins, hours, doms, months, dows] = sets;
  const domAny = fields[2] === "*", dowAny = fields[4] === "*";
  return (d) => {
    if (!mins.has(d.getUTCMinutes()) || !hours.has(d.getUTCHours()) || !months.has(d.getUTCMonth() + 1)) return false;
    const dom = doms.has(d.getUTCDate()), dow = dows.has(d.getUTCDay());
    return domAny || dowAny ? dom && dow : dom || dow; // POSIX: two restricted day fields OR
  };
}

// runs in the API's shape → what the checks need
export const slim = (runs) => runs.map((r) => ({
  workflow: String(r.path || "").split("/").pop().replace(/@.*$/, ""),
  created: Date.parse(r.created_at), status: r.status, conclusion: r.conclusion,
}));
const near = (r, t) => r.created >= t - EARLY_MS && r.created <= t + LATE_MS;
// a slot's work is done, or being done, by this run
const didWork = (r) => r.status !== "completed" || r.conclusion === "success";

/* backup: `runs` are this workflow's workflow_dispatch runs. Every instant of
   the line in the last `hours` must have one near it that worked. */
export function backupVerdict(cron, runs, now, { hours = 24 } = {}) {
  const match = cronMatcher(cron);
  const end = Math.floor(now / MIN) * MIN;
  const slots = [];
  for (let t = end; t > end - hours * 3600e3; t -= MIN) if (match(new Date(t))) slots.push(t);
  if (!slots.length) return { served: false, reason: `no slot of "${cron}" in the last ${hours}h (a run that late is its own backup)` };
  const unserved = slots.filter((t) => !runs.some((r) => near(r, t) && didWork(r)));
  return unserved.length
    ? { served: false, slots: slots.length, unserved: unserved.slice(0, 6).map(iso), reason: "the clock did not start (or finish) every slot of this line" }
    : { served: true, slots: slots.length, reason: "the clock already started every slot of this line" };
}

/* heartbeat: `runs` are the repo's workflow_dispatch runs since `hours` ago */
export function clockHealth(table, runs, now, { hours = 24, settleMin = 15 } = {}) {
  const end = Math.floor((now - settleMin * MIN) / MIN) * MIN;
  const due = [];
  for (let t = end; t > end - hours * 3600e3; t -= MIN)
    for (const workflow of dueWorkflows(table, new Date(t))) due.push({ workflow, t });
  const unserved = due.filter(({ workflow, t }) => !runs.some((r) => r.workflow === workflow && near(r, t)));
  const served = due.length - unserved.length;
  const ratio = due.length ? served / due.length : 1;
  const verdict = !due.length || ratio >= 0.9 ? "healthy" : ratio >= 0.5 ? "degraded" : "dead";
  return { verdict, due: due.length, served, unserved: unserved.slice(0, 12).map((u) => `${u.workflow} ${iso(u.t)}`) };
}

// ---- the GitHub API ---------------------------------------------------------------
const UA = "auspol-dispatch-clock-check (+https://github.com/joshborgnolo/auspol-tracker)";
async function api(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": UA,
      ...(process.env.GH_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GitHub API answered HTTP ${res.status} for ${path.split("?")[0]}`);
  return res.json();
}
// workflow_dispatch runs created since `sinceMs`, repo-wide or for one workflow id
async function dispatchRuns(repo, sinceMs, workflowId) {
  if (process.env.SERVED_RUNS) return JSON.parse(readFileSync(process.env.SERVED_RUNS, "utf8"));
  const base = workflowId ? `repos/${repo}/actions/workflows/${workflowId}/runs` : `repos/${repo}/actions/runs`;
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const j = await api(`${base}?event=workflow_dispatch&created=%3E%3D${iso(sinceMs)}&per_page=100&page=${page}`);
    out.push(...(j.workflow_runs || []));
    if ((j.workflow_runs || []).length < 100) break;
  }
  return out;
}

// ---- the CLI ------------------------------------------------------------------------
async function main(mode) {
  const now = process.env.SERVED_NOW ? Date.parse(process.env.SERVED_NOW) : Date.now();
  const repo = process.env.GITHUB_REPOSITORY || "joshborgnolo/auspol-tracker";
  if (mode === "backup") {
    let v;
    try {
      const wf = process.env.SERVED_RUNS ? null : (await api(`repos/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`)).workflow_id;
      v = backupVerdict(process.env.CRON, slim(await dispatchRuns(repo, now - 24 * 3600e3 - 10 * MIN, wf)), now);
    } catch (e) {
      v = { served: false, reason: `could not tell (${e.message}); running` };
    }
    console.log("SERVED " + JSON.stringify({ cron: process.env.CRON || null, ...v }));
    console.log(v.served ? `dispatch clock already served this slot — the backup run's update is skipped` : `running the update: ${v.reason}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `served=${v.served}\n`);
    return 0;
  }
  if (mode === "heartbeat") {
    const table = JSON.parse(readFileSync(fileURLToPath(new URL("./schedule.json", import.meta.url)), "utf8"));
    let h;
    try {
      h = clockHealth(table, slim(await dispatchRuns(repo, now - 24 * 3600e3 - 30 * MIN)), now);
    } catch (e) {
      console.log("CLOCK_STATUS " + JSON.stringify({ verdict: "inconclusive", error: e.message }));
      console.log(`dispatch-clock heartbeat inconclusive: ${e.message}`);
      return 1;
    }
    console.log("CLOCK_STATUS " + JSON.stringify(h));
    const line = `dispatch clock: ${h.served} of ${h.due} slots in the last 24h started on time`;
    if (h.verdict === "healthy") { console.log(`${line} — healthy`); return 0; }
    for (const u of h.unserved) console.log(`  unserved: ${u}`);
    if (h.verdict === "degraded") { console.log(`::warning::${line} — degraded; see .build/dispatch-clock/README.md`); return 0; }
    console.log(`::error::${line} — the clock looks dead. The cron backup still runs the updaters, 2–5h late. ` +
      "Check the Worker (npx wrangler tail, in .build/dispatch-clock) and its GITHUB_TOKEN secret: a fine-grained PAT, which expires.");
    return 3;
  }
  console.error("usage: node .build/dispatch-clock/served.mjs backup|heartbeat");
  return 2;
}

// run as a script (argv[1] is not symlink-resolved; import.meta.url is)
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv[2]));
