/* vote-switching.mjs – builds data/vote-switching.json: for each poll wave
   that publishes it, how voters in each 2025-vote group say they would vote
   now (the rows of a vote-switching table). The Snapshot panel "Where One
   Nation's new voters came from" and its Info entry are drawn from this file.

   Runs itself: the News24 and DemosAU updaters call it after every new wave
   (non-fatal), and the weekly crosstabs-update workflow
   (.build/crosstabs-updater.sh) runs it too; it finds the waves the file
   doesn't hold yet. Sources (read through
   .build/crosstab-sources.mjs, shared with .build/demographics.mjs):
     YouGov   – the 2025-vote columns of each Pulse wave's crosstab chart.
     DemosAU  – the "Voting Intention: Past Election Vote" chart in the
                wave's report PDF, measured from the rendered bars by
                .build/demosau-charts.mjs, since the PDF prints small
                segments without a label.
   Nothing is saved on a guess: each row must sum to about 100, a YouGov
   table's all-voters column must match the wave's published primaries
   (crosstab-parse.mjs), and a DemosAU chart must measure close to whole
   percentages (FIT_LIMIT, demosau-charts.mjs). A wave that fails, or whose
   source isn't reachable yet, stays pending and is retried every run; only
   KNOWN_SKIP below – each entry checked by hand – marks a wave as having no
   table. A wave still pending STALE_DAYS after its fieldwork closed is
   listed as `stale`, and the weekly run fails on it so a person (or
   agent-repair) looks. Neither house published the table before February
   2026.
     Newspoll – no table. The Australian's report of a wave says in prose
                where Labor's and the Coalition's 2025 voters now stand;
                those rows are entered by hand in QUOTED below.

   Weights: each group's share of the 2025 formal vote (AEC event 31496, the
   TPP flow file cached in .build/aec-flow-src/tpp-2025.txt: first
   preferences, with independents split from other minor parties because
   YouGov splits them).

   Usage: node .build/vote-switching.mjs [--refresh]
     --refresh  re-read every wave, not just the new ones
   Last line: VS_STATUS {"changed":…,"added":[…],"pending":[…],"stale":[…],"skipped":[…]} */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, youGovSource, youGovCrosstab, demosauReport } from "./crosstab-sources.mjs";
import { switchingOf, sharesProblem, totalProblem } from "./crosstab-parse.mjs";
import { measure as demosauMeasure, FIT_LIMIT } from "./demosau-charts.mjs";

const OUT = path.join(ROOT, "data", "vote-switching.json");
const FIRST_TABLE = "2026-02-01";
const HOUSES = ["YouGov", "DemosAU"];
const STALE_DAYS = 16;                 // a week to publish, then a weekly retry, then someone looks

const WEIGHTS_2025 = { alp: 34.56, lnp: 31.82, grn: 12.20, onp: 6.40, ind: 7.27, oth: 7.74,
  source: "AEC 2025 federal election, first preferences (event 31496; independents split from other minor parties)" };

/* Waves checked by hand and found to carry no table: recorded as skipped,
   never fetched. Nothing else is ever skipped. */
const KNOWN_SKIP = {
  "YouGov|2026-03-19": "an Australia Institute poll – no 2025-vote crosstab published",
  "YouGov|2026-06-16": "the wave's article carries no 2025-vote table",
};

/* Rows a poll's report states in prose, entered by hand with the words they
   come from. A row holds only the cells the report gives. Newspoll's give
   Labor's and the Coalition's 2025 voters, which count toward those two
   groups' rates (gen-data §5b); with no Greens or others row, a wave like
   this can't be split on its own. Its dates, sample, article and One Nation
   vote come from its polls.json row. */
const QUOTED = {
  "Newspoll|2026-09-17": {
    quote: "Based on voter recollections of who they supported at the last election and who they support now, the ALP has retained a little under two-thirds of its vote since the 2025 poll. Of those lost, about 15 per cent have gone to One Nation, 9 per cent to the Coalition, 6 per cent to the Greens and 5 per cent to others. The Coalition, which suffered its worst result at last year’s election, has retained about 53 per cent of its low vote, with 39 per cent switching to One Nation.",
    // the losses (15 + 9 + 6 + 5) are shares of all Labor's 2025 voters, so it kept
    // the other 65 – "a little under two-thirds"; "others" includes independents
    rows: { alp: { alp: 65, onp: 15, lnp: 9, grn: 6, oth: 5 }, lnp: { lnp: 53, onp: 39 } },
  },
};

// ---- assemble -----------------------------------------------------------------
const refresh = process.argv.includes("--refresh");
const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { waves: [], skipped: [] };
const key = (w) => w.pollster + "|" + w.date;
const have = new Map((prev.waves || []).map((w) => [key(w), w]));
const candidates = polls.filter((p) => HOUSES.includes(p.pollster) && p.date >= FIRST_TABLE);
const waves = [], skipped = [], added = [], pending = [];
const push = (w) => { waves.push(w); if (!have.has(key(w))) added.push(key(w)); };
// not readable this run: retried next run, and a wave already on file stays
const pend = (k, why) => { pending.push(`${k}: ${why}`); if (have.has(k)) waves.push(have.get(k)); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vote-switching-"));
try {
  for (const p of candidates) {
    const k = key({ pollster: p.pollster, date: p.date });
    if (KNOWN_SKIP[k]) { skipped.push({ pollster: p.pollster, date: p.date, reason: KNOWN_SKIP[k] }); continue; }
    if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
    const base = { pollster: p.pollster, date: p.date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
                   article: p.url ?? null, onp: p.onp ?? null };
    try {
      if (p.pollster === "YouGov") {
        const src = youGovSource(p.date);
        if (src.pending) { pend(k, src.pending); continue; }
        const t = await youGovCrosstab(src.ids);
        if (!t) { pend(k, "no 2025-vote crosstab among the wave's charts (none published? add it to KNOWN_SKIP once checked)"); continue; }
        const s = switchingOf(t);
        const bad = (Object.keys(s.rows).length ? sharesProblem(s.rows) : "no 2025-vote columns") || totalProblem(s.total, p);
        if (bad) { pend(k, `the crosstab didn't read cleanly – ${bad}`); continue; }
        push({ ...base, source: t.source, read: "published table", rows: s.rows, total: s.total });
        console.log(`${k}: ${Object.keys(s.rows).join(",")} (ON total ${s.total.onp}, poll ${p.onp})`);
      } else {
        const rep = await demosauReport(p, tmp);
        if (!rep) { pend(k, "the report PDF isn't reachable yet (not on record, the site's captcha, or not up)"); continue; }
        const t = demosauMeasure(rep.file);
        const bad = t.error ? `${t.error} (no chart? add it to KNOWN_SKIP once checked)`
          : t.maxOffInteger > FIT_LIMIT ? `the chart read ${t.maxOffInteger} off whole percentages – a layout the measurer doesn't know?`
          : sharesProblem(t.rows);
        if (bad) { pend(k, bad); continue; }
        push({ ...base, source: rep.url, page: t.page, read: "measured from the chart", rows: t.rows, fit: t.maxOffInteger });
        console.log(`${k}: ${Object.keys(t.rows).join(",")} (page ${t.page}, max off-integer ${t.maxOffInteger})`);
      }
    } catch (e) {
      // a fetch that failed this run is retried next run, never recorded as skipped
      pend(k, String(e.message || e).slice(0, 160));
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
for (const [k, q] of Object.entries(QUOTED)) {
  const p = polls.find((x) => x.pollster + "|" + x.date === k);
  if (!p) { pend(k, "quoted rows, but polls.json holds no such poll – fix the QUOTED key"); continue; }
  push({ pollster: p.pollster, date: p.date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
         article: p.url ?? null, onp: p.onp ?? null, source: p.url ?? null,
         read: "quoted in the article", quote: q.quote, rows: q.rows });
}
waves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster.localeCompare(b.pollster)));
skipped.sort((a, b) => (a.date < b.date ? -1 : 1));

// stale: a wave of a house read here, older than STALE_DAYS, still not on file
const daysAgo = (d) => (Date.now() - Date.parse(d + "T00:00:00Z")) / 864e5;
const onFile = new Set(waves.map(key)), skippedKeys = new Set(skipped.map(key));
const stale = candidates.filter((p) => daysAgo(p.date) > STALE_DAYS && !onFile.has(key(p)) && !skippedKeys.has(key(p))).map(key);

const doc = {
  _about: "How voters in each 2025-vote group say they would vote now, per poll wave (rows[2025 group][current vote], % of that group). Built by .build/vote-switching.mjs – see its header for sources and method. Keys: alp, lnp, grn, onp, ind (independents), oth (other parties; DemosAU's and Newspoll's oth include independents), dnr (didn't remember / didn't vote – DemosAU only). A wave read \"quoted in the article\" (Newspoll) holds only the rows and cells its report states, with the words in `quote`. `skipped` lists waves checked by hand and found to carry no usable table.",
  weights2025: WEIGHTS_2025,
  waves,
  skipped,
};
const next = JSON.stringify(doc, null, 1) + "\n";
const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== next;
if (changed) { fs.writeFileSync(OUT + ".tmp", next); fs.renameSync(OUT + ".tmp", OUT); }
for (const m of pending) console.log("pending", m);
console.log("VS_STATUS " + JSON.stringify({ changed, added, pending: pending.map((m) => m.split(":")[0]), stale, skipped: skipped.map(key) }));
