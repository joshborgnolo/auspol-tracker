/* vote-switching.mjs – builds data/vote-switching.json: for each poll wave
   that publishes it, how voters in each 2025-vote group say they would vote
   now (the rows of a vote-switching table). The Snapshot panel "Where are One
   Nation voters coming from" and its Info entry are drawn from this file.

   Two houses publish the table:
     YouGov   – the "Generic" crosstab chart embedded in each Sky News Pulse
                (Feb–Jul 2026) and News24 Pulse (from Jul 2026) article, read
                exactly from the chart's own data at e.infogram.com.
     DemosAU  – the "Voting Intention: Past Election Vote" chart in each
                monthly report PDF, measured from the rendered bars by
                .build/demosau-switching.py (pdfplumber), since the PDF prints
                small segments without a label.
   Newspoll publishes only Labor's row (retention and where its losses went),
   which cannot place One Nation's gains, so it stays out of the file.

   Adding a wave: append it to WAVES below (YouGov: the crosstab chart's `_/`
   id, found among the article's embeds – the extractors record them; DemosAU:
   the report PDF) and run `node .build/vote-switching.mjs`. Waves already in
   the file are kept as they are unless --refresh is passed.

   Weights: each group's share of the 2025 formal vote (AEC event 31496, the
   TPP flow file cached in .build/aec-flow-src/tpp-2025.txt: first
   preferences, with independents split from other minor parties because
   YouGov splits them). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { infographicDataOf } from "./infogram.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "data", "vote-switching.json");

const WEIGHTS_2025 = { alp: 34.56, lnp: 31.82, grn: 12.20, onp: 6.40, ind: 7.27, oth: 7.74,
  source: "AEC 2025 federal election, first preferences (event 31496; independents split from other minor parties)" };

const IG = (id) => `https://e.infogram.com/${id}?src=embed`;
/* One row per wave. date/dateStart/sample are the wave's own (data/polls.json);
   article is where the chart was published. */
const WAVES = [
  { pollster: "YouGov", date: "2026-02-10", ig: "_/ZmzvfoQcPMj4PREkMRoQ" },
  { pollster: "YouGov", date: "2026-02-24", ig: "_/ihQUqVtPBNqqg4cvnJMI" },
  { pollster: "YouGov", date: "2026-03-10", ig: "_/pb7kijCuicNCIZB3PVwM" },
  // no "other" column this wave: its others' row can't be placed, so the
  // panel skips it (the rest of its table is kept)
  { pollster: "YouGov", date: "2026-03-24", ig: "_/oLs7Ez236QuKo9b8951m" },
  { pollster: "YouGov", date: "2026-04-07", ig: "_/5PSbKtbHyzvhiC0xbRSl" },
  { pollster: "YouGov", date: "2026-04-21", ig: "_/GM5wSTEgnFLWxZ5bKCB4" },
  { pollster: "YouGov", date: "2026-05-05", ig: "_/xlAzTHMulISJRy1rkc2C" },
  { pollster: "YouGov", date: "2026-05-19", ig: "_/rpPgjmCBFb9tgpiTDMJW" },
  { pollster: "YouGov", date: "2026-06-02", ig: "_/zSPbFJ7s5bfliWLjxj21" },
  { pollster: "YouGov", date: "2026-06-30", ig: "_/adAygP6VBs84ueM4jN4C" },
  { pollster: "YouGov", date: "2026-07-14", ig: "_/pL018pKKkRErkzkegdv6" },
  { pollster: "YouGov", date: "2026-07-28", ig: "_/cEkYPVrn9ybfCGXAflmL" },
  { pollster: "YouGov", date: "2026-08-10", ig: "_/bfCWmJWwJrLP0zgZOSEt" },
  { pollster: "YouGov", date: "2026-08-24", ig: "_/YM46DvOTftyx9pNzV67y" },
  { pollster: "YouGov", date: "2026-09-08", ig: "_/tffIGyctHfK10P86g4Pb" },
  { pollster: "YouGov", date: "2026-09-21", ig: "_/XdWD62anjLF6u5scKfkU" },
  { pollster: "DemosAU", date: "2026-02-20", pdf: "https://demosau.com/wp-content/uploads/2026/02/DemosAU-Federal-Poll-Feb-2026.pdf" },
  { pollster: "DemosAU", date: "2026-04-14", pdf: "https://demosau.com/wp-content/uploads/2026/04/DemosAU-Fed-Poll-April-2026.pdf" },
  { pollster: "DemosAU", date: "2026-05-20", pdf: "https://demosau.com/wp-content/uploads/2026/05/DemosAU-Fed-Poll-May-2026-FINAL.pdf" },
  { pollster: "DemosAU", date: "2026-06-18", pdf: "https://demosau.com/wp-content/uploads/2026/06/Capital-BriefDemosAU-Federal-Poll-June-2026-FINAL.pdf" },
  { pollster: "DemosAU", date: "2026-07-08", pdf: "https://demosau.com/wp-content/uploads/2026/07/Capital-BriefDemosAU-Federal-Poll-July-2026.pdf" },
  { pollster: "DemosAU", date: "2026-08-20", pdf: "https://demosau.com/wp-content/uploads/2026/08/Capital-BriefDemosAU-Federal-Poll-August-2026.pdf" },
  { pollster: "DemosAU", date: "2026-09-14", pdf: "https://demosau.com/wp-content/uploads/2026/09/Capital-BriefDemosAU-Federal-Poll-September-2026.pdf" },
];

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
function demosauTable(url) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demosau-"));
  const f = path.join(tmp, path.basename(new URL(url).pathname));
  execFileSync("curl", ["-sL", "-A", "Mozilla/5.0", "-o", f, url]);
  const out = JSON.parse(execFileSync("python3", [path.join(HERE, "demosau-switching.py"), f], { encoding: "utf8" }).trim());
  fs.rmSync(tmp, { recursive: true, force: true });
  if (out.error) throw new Error(`${url}: ${out.error}`);
  return out;
}

// ---- assemble -----------------------------------------------------------------
const refresh = process.argv.includes("--refresh");
const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { waves: [] };
const have = new Map(prev.waves.map((w) => [w.pollster + "|" + w.date, w]));
const waves = [];
for (const w of WAVES) {
  const key = w.pollster + "|" + w.date;
  if (have.has(key) && !refresh) { waves.push(have.get(key)); continue; }
  const poll = polls.find((p) => p.pollster === w.pollster && p.date === w.date);
  if (!poll) throw new Error(`no ${w.pollster} wave dated ${w.date} in data/polls.json`);
  const base = { pollster: w.pollster, date: w.date, dateStart: poll.dateStart ?? null, sample: poll.sample ?? null,
                 article: poll.url ?? null, onp: poll.onp ?? null };
  if (w.ig) {
    const t = await yougovTable(w.ig);
    waves.push({ ...base, source: IG(w.ig).replace("?src=embed", ""), read: "published table", rows: t.rows, total: t.total });
    console.log(`${key}: ${Object.keys(t.rows).join(",")} (ON total ${t.total.onp})`);
  } else {
    const t = demosauTable(w.pdf);
    waves.push({ ...base, source: w.pdf, page: t.page, read: "measured from the chart", rows: t.rows, fit: t.maxOffInteger });
    console.log(`${key}: ${Object.keys(t.rows).join(",")} (page ${t.page}, max off-integer ${t.maxOffInteger})`);
  }
}
waves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster.localeCompare(b.pollster)));
const doc = {
  _about: "How voters in each 2025-vote group say they would vote now, per poll wave (rows[2025 group][current vote], % of that group). Built by .build/vote-switching.mjs – see its header for sources and method. Keys: alp, lnp, grn, onp, ind (independents), oth (other parties; DemosAU's oth includes independents), dnr (didn't remember / didn't vote – DemosAU only).",
  weights2025: WEIGHTS_2025,
  waves,
};
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + "\n");
console.log(`wrote ${path.relative(ROOT, OUT)}: ${waves.length} waves`);
