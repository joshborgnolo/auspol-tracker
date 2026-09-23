/* demographics.mjs – builds data/demographics.json: first-preference vote by
   gender, age (or generation) and education, per poll wave, as each pollster
   groups it. The Snapshot panel "The vote by age, gender and education" and
   its Info entry are drawn from this file.

   Runs itself: the YouGov/News24, DemosAU, RedBridge and Resolve updaters
   call it after every new wave (non-fatal), and the weekly crosstabs-update
   workflow (.build/crosstabs-updater.sh) runs it too; it finds what the file
   doesn't hold yet.
     YouGov    – the crosstab chart of each Pulse wave (.build/crosstab-
                 sources.mjs): gender, age bands, generations, education –
                 whichever columns that wave carries (they changed over 2026).
     DemosAU   – the Gender, Age and Education charts in the wave's report
                 PDF, measured from the rendered bars (.build/demosau-charts
                 .mjs); from the April 2026 report (earlier reports used
                 another layout without them).
     RedBridge – the "First preference vote intention" table in the report
                 text extract-redbridge.mjs caches (.build/redbridge-src/),
                 from February 2026 (earlier reports printed it as figures).
     Resolve   – the SMH Political Monitor interactive's age and gender
                 series, every month of the term, rebuilt each run from one
                 fetch (values decoded as extract-resolve-rpm.mjs does).
   Groups are kept exactly as each house draws them – the age bands differ
   (Resolve and DemosAU 18–34/35–54/55+, YouGov 18–34/35–49/50+, RedBridge by
   generation) – with labels only tidied. Party keys alp/lnp/onp/grn/oth;
   independents and every smaller party are oth. Shares are stored as
   published; the page rescales each group to 100.

   Nothing is saved on a guess. Every table passes the gate in
   crosstab-parse.mjs first: each group's shares sum to about 100, and a
   table's all-voters column matches the wave's published primaries. A table
   that fails, a chart measured off whole percentages (a layout the measurer
   doesn't know), or a source not reachable yet leaves the wave pending: it
   is retried every run, never skipped. Only KNOWN_SKIP below – each entry
   checked by hand – marks a wave as having no breakdowns. A wave still
   pending STALE_DAYS after its fieldwork closed is listed as `stale`, and
   the weekly run fails on it so a person (or agent-repair) looks.

   Usage: node .build/demographics.mjs [--refresh]
     --refresh  re-read every wave, not just the new ones
   Last line: DEMO_STATUS {"changed":…,"added":[…],"pending":[…],"stale":[…],"skipped":[…]} */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, youGovSource, youGovCrosstab, demosauReport, resolveData } from "./crosstab-sources.mjs";
import { youGovDims, DEMOS_DIM, demosLabel, redbridgeTable, resolveWaves, dimsProblem, totalProblem } from "./crosstab-parse.mjs";
import { measureCharts, FIT_LIMIT } from "./demosau-charts.mjs";

const OUT = path.join(ROOT, "data", "demographics.json");
const FIRST = "2026-02-01";            // no house published these breakdowns earlier this term
const HOUSES = ["YouGov", "DemosAU", "RedBridge/Accent", "Resolve"];
const STALE_DAYS = 16;                 // a week to publish, then a weekly retry, then someone looks
const RESOLVE_MATCH_DAYS = 4;          // the interactive can date a month a day or two off the poll row

const KNOWN_SKIP = {
  "DemosAU|2026-02-20": "the February report predates the Gender, Age and Education charts (an older layout)",
  "YouGov|2026-03-19": "an Australia Institute poll – no crosstab published",
  "YouGov|2026-06-16": "the wave's article carries no crosstab",
  "RedBridge/Accent|2026-03-27": "filed from the AFR article – Accent's March report was never cached",
};

function redbridgeCache(date) {
  const dir = path.join(ROOT, ".build", "redbridge-src");
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    const txt = path.join(dir, f.replace(/\.json$/, ".txt"));
    if (j.date === date && fs.existsSync(txt)) return txt;
  }
  return null;
}

// ---- assemble -----------------------------------------------------------------
const refresh = process.argv.includes("--refresh");
const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { waves: [], skipped: [] };
const key = (w) => w.pollster + "|" + w.date;
const have = new Map((prev.waves || []).map((w) => [key(w), w]));
const waves = [], skipped = [], added = [], pending = [];
const push = (w) => { waves.push(w); if (!have.has(key(w))) added.push(key(w)); };
// not readable this run: retried next run, and a wave already on file stays
const pend = (k, why) => { pending.push(`${k}: ${why}`); if (have.has(k)) waves.push(have.get(k)); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demographics-"));
try {
  const candidates = polls.filter((p) => ["YouGov", "DemosAU", "RedBridge/Accent"].includes(p.pollster) && p.date >= FIRST);
  for (const p of candidates) {
    const k = key(p);
    if (KNOWN_SKIP[k]) { skipped.push({ pollster: p.pollster, date: p.date, reason: KNOWN_SKIP[k] }); continue; }
    if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
    const base = { pollster: p.pollster, date: p.date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
                   article: p.url ?? null };
    try {
      if (p.pollster === "YouGov") {
        const src = youGovSource(p.date);
        if (src.pending) { pend(k, src.pending); continue; }
        const t = await youGovCrosstab(src.ids);
        if (!t) { pend(k, "no crosstab among the wave's charts (none published? add it to KNOWN_SKIP once checked)"); continue; }
        const d = youGovDims(t);
        const bad = dimsProblem(d.dims) || totalProblem(d.total, p);
        if (bad) { pend(k, `the crosstab didn't read cleanly – ${bad}`); continue; }
        push({ ...base, source: t.source, read: "published table", dims: d.dims, total: d.total });
        console.log(`${k}: ${Object.entries(d.dims).map(([dm, g]) => `${dm}(${Object.keys(g).join("/")})`).join(" ")}`);
      } else if (p.pollster === "DemosAU") {
        const rep = await demosauReport(p, tmp);
        if (!rep) { pend(k, "the report PDF isn't reachable yet"); continue; }
        const charts = measureCharts(rep.file, Object.keys(DEMOS_DIM));
        const dims = {}; let fit = 0, bad = null;
        for (const [name, c] of Object.entries(charts)) {
          if (c.error) continue;
          if (c.maxOffInteger > FIT_LIMIT) { bad = `the ${name} chart read ${c.maxOffInteger} off whole percentages – a layout the measurer doesn't know?`; break; }
          fit = Math.max(fit, c.maxOffInteger);
          const dim = DEMOS_DIM[name];
          dims[dim] = Object.fromEntries(Object.entries(c.rows).map(([label, sh]) => [demosLabel(dim, label), sh]));
        }
        bad ||= Object.keys(dims).length ? dimsProblem(dims) : "no Gender, Age or Education chart found in the report";
        if (bad) { pend(k, bad); continue; }
        push({ ...base, source: rep.url, read: "measured from the charts", dims, fit });
        console.log(`${k}: ${Object.keys(dims).join(", ")} (fit ${fit})`);
      } else {
        const txt = redbridgeCache(p.date);
        if (!txt) { pend(k, "no RedBridge extractor cache for this wave yet"); continue; }
        const t = redbridgeTable(fs.readFileSync(txt, "utf8"));
        const bad = !t ? "no first-preference table by group the reader knows in the report" : dimsProblem(t.dims) || totalProblem(t.total, p);
        if (bad) { pend(k, bad); continue; }
        push({ ...base, source: p.releaseUrl || p.url || null, read: "published table", dims: t.dims, ...(t.total ? { total: t.total } : {}) });
        console.log(`${k}: ${Object.keys(t.dims).join(", ")} (columns ${t.columns.join(",")})`);
      }
    } catch (e) {
      pend(k, String(e.message || e).slice(0, 160));
    }
  }
  // Resolve: one fetch carries every month; rebuilt whole each run, or kept
  // whole from the file when the fetch or any month fails the gate
  try {
    const rs = resolveWaves(await resolveData());
    for (const w of rs) {
      const bad = dimsProblem(w.dims);
      if (bad) throw new Error(`the ${w.date} series didn't read cleanly – ${bad}`);
    }
    if (!rs.length) throw new Error("the interactive carried no age or gender series for this term");
    for (const w of rs) push(w);
  } catch (e) {
    pending.push(`Resolve: ${String(e.message || e).slice(0, 160)}`);
    for (const w of prev.waves || []) if (w.pollster === "Resolve") waves.push(w);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
waves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster.localeCompare(b.pollster)));
skipped.sort((a, b) => (a.date < b.date ? -1 : 1));

// stale: a wave of a house read here, older than STALE_DAYS, still not on file
const daysAgo = (d) => (Date.now() - Date.parse(d + "T00:00:00Z")) / 864e5;
const onFile = new Set(waves.map(key)), skippedKeys = new Set(skipped.map(key));
const stale = polls.filter((p) => HOUSES.includes(p.pollster) && p.date >= FIRST && daysAgo(p.date) > STALE_DAYS
  && !onFile.has(key(p)) && !skippedKeys.has(key(p))
  && !(p.pollster === "Resolve" && waves.some((w) => w.pollster === "Resolve" && Math.abs(daysAgo(w.date) - daysAgo(p.date)) <= RESOLVE_MATCH_DAYS)))
  .map(key);

const doc = {
  _about: "First-preference vote by group, per poll wave, as each pollster groups it: dims[gender|age|generation|education|…][group][party] (% of that group). Party keys alp, lnp, onp, grn, oth (independents and all smaller parties). Built by .build/demographics.mjs – see its header for sources. `skipped` lists waves checked by hand and found to carry no breakdowns.",
  waves,
  skipped,
};
const next = JSON.stringify(doc, null, 1) + "\n";
const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== next;
if (changed) { fs.writeFileSync(OUT + ".tmp", next); fs.renameSync(OUT + ".tmp", OUT); }
for (const m of pending) console.log("pending", m);
const rsAdded = added.filter((k) => k.startsWith("Resolve|")).length;
console.log("DEMO_STATUS " + JSON.stringify({ changed,
  added: added.filter((k) => !k.startsWith("Resolve|")).concat(rsAdded ? [`Resolve (${rsAdded} months)`] : []),
  pending: pending.map((m) => m.split(":")[0]), stale, skipped: skipped.map(key) }));
