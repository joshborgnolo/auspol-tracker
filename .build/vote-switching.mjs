/* vote-switching.mjs – builds data/vote-switching.json: for each poll wave
   that publishes it, how voters in each 2025-vote group say they would vote
   now (the rows of a vote-switching table). The Snapshot panel "Where One
   Nation's new voters came from" and its Info entry are drawn from this file.

   Runs itself: the News24 and DemosAU updaters call it after every new wave
   (non-fatal), and it finds the waves the file doesn't hold yet –
     YouGov   – the "Generic" crosstab chart embedded in each Pulse article
                (Sky News Pulse Feb–Jul 2026, News24 Pulse since), read exactly
                from the chart's own data at e.infogram.com. News24 waves: the
                chart id comes from the extractor's cache for the wave
                (.build/news24-src/news24-<date>.json, the chart classed
                "crosstab"); that cache is written by the laptop's run, which
                reads the article through Chrome – a CI run can't, so a wave
                it lands stays pending until the laptop run that upgrades it.
                Sky News waves need a browser to read at all, so their chart
                ids are recorded below.
     DemosAU  – the "Voting Intention: Past Election Vote" chart in the
                wave's report PDF (its releaseUrl), measured from the rendered
                bars by .build/demosau-switching.mjs, since the PDF prints small
                segments without a label.
   A wave checked and found to carry no usable table is listed in `skipped`
   and not fetched again; one whose source isn't reachable yet is retried on
   the next run. Newspoll publishes only Labor's row (retention and where its
   losses went), which cannot place One Nation's gains, so it isn't read.
   Neither house published the table before February 2026.

   Weights: each group's share of the 2025 formal vote (AEC event 31496, the
   TPP flow file cached in .build/aec-flow-src/tpp-2025.txt: first
   preferences, with independents split from other minor parties because
   YouGov splits them).

   Usage: node .build/vote-switching.mjs [--refresh]
     --refresh  re-read every wave, not just the new ones
   Last line: VS_STATUS {"changed":…,"added":[…],"pending":[…],"skipped":[…]} */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { infographicDataOf } from "./infogram.mjs";
import { measure as demosauMeasure } from "./demosau-switching.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "data", "vote-switching.json");
const FIRST_TABLE = "2026-02-01";

const WEIGHTS_2025 = { alp: 34.56, lnp: 31.82, grn: 12.20, onp: 6.40, ind: 7.27, oth: 7.74,
  source: "AEC 2025 federal election, first preferences (event 31496; independents split from other minor parties)" };

const IG = (id) => `https://e.infogram.com/${id}?src=embed`;
/* Crosstab chart ids read by hand from each article (Sky News pages need a
   browser; the News24 waves before the extractor's cache kept them). New
   News24 waves need no entry here. */
const KNOWN_IG = {
  "2026-02-10": "_/ZmzvfoQcPMj4PREkMRoQ", "2026-02-24": "_/ihQUqVtPBNqqg4cvnJMI",
  "2026-03-10": "_/pb7kijCuicNCIZB3PVwM", "2026-03-24": "_/oLs7Ez236QuKo9b8951m",
  "2026-04-07": "_/5PSbKtbHyzvhiC0xbRSl", "2026-04-21": "_/GM5wSTEgnFLWxZ5bKCB4",
  "2026-05-05": "_/xlAzTHMulISJRy1rkc2C", "2026-05-19": "_/rpPgjmCBFb9tgpiTDMJW",
  "2026-06-02": "_/zSPbFJ7s5bfliWLjxj21", "2026-06-30": "_/adAygP6VBs84ueM4jN4C",
  "2026-07-14": "_/pL018pKKkRErkzkegdv6", "2026-07-28": "_/cEkYPVrn9ybfCGXAflmL",
  "2026-08-10": "_/bfCWmJWwJrLP0zgZOSEt", "2026-08-24": "_/YM46DvOTftyx9pNzV67y",
  "2026-09-08": "_/tffIGyctHfK10P86g4Pb", "2026-09-21": "_/XdWD62anjLF6u5scKfkU",
};

/* Waves known to carry no table, so they are recorded as skipped at once
   rather than retried every run. */
const KNOWN_SKIP = {
  "YouGov|2026-03-19": "an Australia Institute poll – no 2025-vote crosstab published",
  "YouGov|2026-06-16": "the wave's article carries no 2025-vote table",
};

// ---- YouGov: the crosstab sheet whose columns are 2025-vote groups ----------
const GROUP = (h) => {
  const s = h.toLowerCase();
  if (!/2025/.test(s)) return null;
  if (/labor/.test(s)) return "alp";
  if (/coalition/.test(s)) return "lnp";
  if (/green/.test(s)) return "grn";
  if (/one nation/.test(s)) return "onp";
  if (/independent/.test(s)) return "ind";
  if (/other/.test(s)) return "oth";
  return null;
};
const PARTY = (r) => {
  const s = r.toLowerCase().trim();
  if (s === "labor") return "alp";
  if (s === "coalition") return "lnp";
  if (s === "one nation") return "onp";
  if (/greens/.test(s)) return "grn";
  if (s === "independent") return "ind";
  if (s === "other") return "oth";
  return s.replace(/[^a-z]+/g, "-");
};
async function yougovTable(id) {
  const html = await (await fetch(IG(id), { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const data = infographicDataOf(html);
  const ents = data?.elements?.content?.content?.entities || {};
  for (const e of Object.values(ents)) {
    const cd = e?.props?.chartData;
    if (e?.type !== "CHART" || !cd?.data) continue;
    for (const sheet of cd.data) {
      if (!Array.isArray(sheet) || !Array.isArray(sheet[0])) continue;
      const rows = sheet.map((r) => r.map((c) => String(c?.value ?? c ?? "").trim()));
      const head = rows[0];
      const cols = head.map((h, n) => [GROUP(h), n]).filter(([g]) => g);
      const totalAt = head.findIndex((h) => /^total$/i.test(h));
      if (cols.length < 4 || !rows.some((r) => /^one nation$/i.test(r[0]))) continue;
      const out = {}, total = {};
      for (const r of rows.slice(1)) {
        if (!r[0]) continue;
        const p = PARTY(r[0]);
        if (totalAt >= 0 && r[totalAt] !== "") total[p] = +r[totalAt];
        for (const [g, n] of cols) {
          if (r[n] === "" || r[n] == null) continue;
          (out[g] ||= {})[p] = +r[n];
        }
      }
      return { rows: out, total, title: (html.match(/<title>(.*?)<\/title>/s) || [])[1]?.trim() };
    }
  }
  throw new Error(`no 2025-vote crosstab in ${id}`);
}

// ---- DemosAU: measure the chart in the report PDF ---------------------------
/* demosau.com has sat behind a SiteGround captcha since 2 Sep 2026, which
   extract-demosau.mjs solves; it leaves every report it read in the temp dir
   as demosau-<slug>.pdf, so in the updater's own run the report is read from
   there, and fetched only when it isn't. A fetch that returns a captcha page
   rather than a PDF is a retry, never a skip. */
const isPdf = (f) => {
  try { const b = Buffer.alloc(5); const fd = fs.openSync(f, "r"); fs.readSync(fd, b, 0, 5, 0); fs.closeSync(fd); return b.toString() === "%PDF-"; }
  catch { return false; }
};
function demosauFile(url, tmp) {
  const slug = decodeURIComponent(url.split("/").pop().replace(/\.pdf$/i, ""));
  const extracted = path.join(os.tmpdir(), `demosau-${slug}.pdf`);
  if (isPdf(extracted)) return extracted;
  const f = path.join(tmp, "report.pdf");
  try { execFileSync("curl", ["-sfL", "-A", "Mozilla/5.0", "-o", f, url]); } catch { return null; }
  return isPdf(f) ? f : null;
}
/* The wave's report PDF: its releaseUrl (or url) where it links one, else the
   report the extractor read for that fieldwork date (its cache names it by
   slug, and DemosAU files reports under the month they went up). */
function demosauPdfUrls(p) {
  const urls = [p.releaseUrl, p.url].filter((u) => /^https:\/\/demosau\.com\/wp-content\/.+\.pdf$/i.test(u || ""));
  const dir = path.join(ROOT, ".build", "demosau-src");
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    if (j.date !== p.date || !j.slug) continue;
    const [y, m] = p.date.split("-").map(Number);
    for (const [yy, mm] of [[y, m], m === 12 ? [y + 1, 1] : [y, m + 1]])
      urls.push(`https://demosau.com/wp-content/uploads/${yy}/${String(mm).padStart(2, "0")}/${encodeURIComponent(j.slug)}.pdf`);
  }
  return [...new Set(urls)];
}
function demosauTable(p) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demosau-vs-"));
  try {
    const urls = demosauPdfUrls(p);
    if (!urls.length) return { pending: "no report PDF on record yet" };
    for (const url of urls) {
      const f = demosauFile(url, tmp);
      if (f) return { url, ...demosauMeasure(f) };
    }
    return { pending: "the report PDF couldn't be fetched (the site's captcha, or not up yet)" };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* Where a wave's table lives, or why it can't be read (yet). */
function youGovSource(date) {
  if (KNOWN_IG[date]) return { ids: [KNOWN_IG[date]] };
  const f = path.join(ROOT, ".build", "news24-src", `news24-${date}.json`);
  if (!fs.existsSync(f)) return { pending: "no News24 extractor cache for this wave yet" };
  const ig = JSON.parse(fs.readFileSync(f, "utf8")).infogram || {};
  const ids = ig.ids || [], kinds = ig.kinds || [];
  if (!ids.length) return { pending: "the wave's chart ids aren't known yet (read by the laptop's Chrome run)" };
  // the chart the extractor classed "crosstab" first, then every other one
  const k = kinds.indexOf("crosstab");
  return { ids: k >= 0 ? [ids[k], ...ids.filter((_, i) => i !== k)] : ids };
}

// ---- assemble -----------------------------------------------------------------
const refresh = process.argv.includes("--refresh");
const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { waves: [], skipped: [] };
const key = (w) => w.pollster + "|" + w.date;
const have = new Map((prev.waves || []).map((w) => [key(w), w]));
const skippedPrev = new Map((prev.skipped || []).map((w) => [key(w), w]));
const candidates = polls.filter((p) => (p.pollster === "YouGov" || p.pollster === "DemosAU") && p.date >= FIRST_TABLE);
const waves = [], skipped = [], added = [], pending = [];
for (const p of candidates) {
  const k = key({ pollster: p.pollster, date: p.date });
  if (!refresh && have.has(k)) { waves.push(have.get(k)); continue; }
  if (!refresh && skippedPrev.has(k)) { skipped.push(skippedPrev.get(k)); continue; }
  if (KNOWN_SKIP[k]) { skipped.push({ pollster: p.pollster, date: p.date, reason: KNOWN_SKIP[k] }); continue; }
  const base = { pollster: p.pollster, date: p.date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
                 article: p.url ?? null, onp: p.onp ?? null };
  try {
    if (p.pollster === "YouGov") {
      const src = youGovSource(p.date);
      if (src.pending) { pending.push(`${k}: ${src.pending}`); continue; }
      let t = null, used = null;
      for (const id of src.ids) {
        try { t = await yougovTable(id); used = id; break; } catch { /* not the crosstab – try the next chart */ }
      }
      if (!t) { skipped.push({ pollster: p.pollster, date: p.date, reason: "no 2025-vote crosstab among the wave's charts" }); continue; }
      waves.push({ ...base, source: IG(used).replace("?src=embed", ""), read: "published table", rows: t.rows, total: t.total });
      added.push(k);
      console.log(`${k}: ${Object.keys(t.rows).join(",")} (ON total ${t.total.onp}, poll ${p.onp})`);
    } else {
      const t = demosauTable(p);
      if (t.pending) { pending.push(`${k}: ${t.pending}`); continue; }
      if (t.error) { skipped.push({ pollster: p.pollster, date: p.date, reason: t.error, source: t.url }); continue; }
      waves.push({ ...base, source: t.url, page: t.page, read: "measured from the chart", rows: t.rows, fit: t.maxOffInteger });
      added.push(k);
      console.log(`${k}: ${Object.keys(t.rows).join(",")} (page ${t.page}, max off-integer ${t.maxOffInteger})`);
    }
  } catch (e) {
    // a fetch that failed this run is retried next run, never recorded as skipped
    pending.push(`${k}: ${String(e.message || e).slice(0, 160)}`);
    if (have.has(k)) waves.push(have.get(k));
  }
}
waves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster.localeCompare(b.pollster)));
skipped.sort((a, b) => (a.date < b.date ? -1 : 1));
const doc = {
  _about: "How voters in each 2025-vote group say they would vote now, per poll wave (rows[2025 group][current vote], % of that group). Built by .build/vote-switching.mjs – see its header for sources and method. Keys: alp, lnp, grn, onp, ind (independents), oth (other parties; DemosAU's oth includes independents), dnr (didn't remember / didn't vote – DemosAU only). `skipped` lists waves checked and found to carry no usable table.",
  weights2025: WEIGHTS_2025,
  waves,
  skipped,
};
const next = JSON.stringify(doc, null, 1) + "\n";
const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== next;
if (changed) fs.writeFileSync(OUT, next);
for (const m of pending) console.log("pending", m);
console.log("VS_STATUS " + JSON.stringify({ changed, added, pending: pending.map((m) => m.split(":")[0]), skipped: skipped.map(key) }));
