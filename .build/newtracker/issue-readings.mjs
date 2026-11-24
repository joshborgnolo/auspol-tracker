/* The issues model's readings (gen-data §7hm; issue-model.mjs fits them).
   Every store that asks what matters or who is best, turned into one
   reading per poll, issue and question, on the panel's issue keys
   (ISSUE_SHARED). Nothing here is renormalised or filled: a figure a poll
   didn't print is absent, and a house that asks differently keeps its own
   name, so the model gives it its own lean.

   WHAT MATTERS: { day, date, house, fmt, issue, p, n, step, avg? }
     fmt  "top3"  pick or rank three of a fixed list (RedBridge, Ipsos,
                  What Worries the World, Freshwater)
          "top5"  pick five (JWS Research)
          "first" the one most important (AES, ANUpoll's open question)
          "open"  open question, any number of mentions (SEC Newgate)
   WHO IS BEST: { day, date, house, issue, alp, lnp, onp?, n, step }
     shares of the whole sample as printed; onp only where One Nation was
     offered by name. */

import fs from "node:fs";
import path from "node:path";

export const DAYn = (iso) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86400000);
const ISOd = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
const midDay = (a, b) => (a ? Math.round((DAYn(a) + DAYn(b)) / 2) : DAYn(b) - 2);
const step1 = (x) => (Number.isInteger(x) ? 1 : 0.1);

/* federal polling days: the AES asks after each one */
export const ELECTION_DAYS = {
  1990: "1990-03-24", 1993: "1993-03-13", 1996: "1996-03-02", 1998: "1998-10-03", 2001: "2001-11-10",
  2004: "2004-10-09", 2007: "2007-11-24", 2010: "2010-08-21", 2013: "2013-09-07", 2016: "2016-07-02",
  2019: "2019-05-18", 2022: "2022-05-21", 2025: "2025-05-03",
};

/* ---- label maps, one per store: only where it is the same issue (or a
   bundle containing it, which its own lean absorbs) ---- */
const IPSOS_KEYS = new Set(["col", "housing", "health", "economy", "immigration", "crime", "security"]);
const WORRIES = { healthcare: "health", crime: "crime", immigration: "immigration", climate: "climate" };
const AES_LABEL = { "Cost of living": "col", "Management of the economy": "economy", Health: "health", "Health and Medicare": "health",
  Immigration: "immigration", "Climate change": "climate" };
const anuKey = (l) => {
  const s = l.toLowerCase().replace(/\s+/g, " ");
  if (/^economy( \/ |\/)?(jobs)?$/.test(s) || /^economy/.test(s)) return "economy";
  if (/^health/.test(s)) return "health";
  if (/^immigration/.test(s)) return "immigration";
  if (/^law and order/.test(s)) return "crime";
  if (/^housing/.test(s)) return "housing";
  if (/global warming/.test(s)) return "climate";
  if (/^defence|^terrorism/.test(s)) return "security";
  return null;
};
const jwsKey = (l) => {
  const s = l.replace(/[*^]/g, "").trim().toLowerCase();
  if (s === "cost of living") return "col";
  if (/^housing/.test(s)) return { k: "housing", era: /interest/.test(s) ? "JWS Research (housing and rates)" : null };
  if (/^hospitals/.test(s)) return { k: "health", era: /ageing/.test(s) ? "JWS Research (health and ageing)" : null };
  if (s === "the economy and finances") return "economy";
  if (s === "immigration and border security") return "immigration";
  if (s === "the environment and climate change") return "climate";
  if (/defen[cs]e and secu?i?r?i?ty of our nation|^defence, security/.test(s)) return "security";
  return null;
};
const FW_IMP = { "Cost of & standard of living": "col", "The cost & standard of living": "col", "Cost & standard of living": "col",
  "Housing & accommodation": "housing", "Health & social care": "health", "Managing the economy": "economy",
  "The environment & climate change": "climate", "Crime & social order": "crime", "Defence and national security": "security",
  "Defence & national security": "security", "Immigration & asylum": "immigration" };
const SEC_B1 = { "Cost of living": "col", "Housing affordability": "housing", Healthcare: "health", Economy: "economy",
  "Immigration & population": "immigration", Crime: "crime", "Climate change": "climate" };
const LOWY = { "Ensuring Australia’s national security is maintained": "security", "Managing Australia’s immigration policy": "immigration",
  "Managing Australia’s response to climate change": "climate", "Managing the Australian economy over time": "economy" };
const AES_POLICY = { "3.3": "economy", "3.6": "health", "3.8": "climate", "3.9": "immigration" };

/* Ipsos Issues Monitor: one reading per month – the month's own report
   column, else the earliest reprint read within eleven months of the
   month (a column read twelve or more months on can carry the year
   after's figure: the reader dates a yearless label backwards). Quarter
   and two-month columns are never used (their years collide), and the
   annual averages only for years no month reaches (2010, 2011). */
export function ipsosMonths(H) {
  const nat = H.reports.filter((r) => r.scope === "Australia");
  const lag = (a, b) => (+a.slice(0, 4) - +b.slice(0, 4)) * 12 + (+a.slice(5, 7) - +b.slice(5, 7));
  const best = new Map();
  for (const r of nat) {
    const put = (ym, issues, rank, meta) => {
      const L = lag(r.ym, ym);
      if (L < 0 || L > 11) return;
      const cur = best.get(ym);
      if (!cur || rank > cur.rank || (rank === cur.rank && L < cur.lag)) best.set(ym, { ym, issues, rank, lag: L, ...meta });
    };
    for (const s of r.salience || []) if (s.basis === "month" && s.startMonth === s.endMonth) put(s.startMonth, s.issues, r.ym === s.startMonth ? 2 : 1, {});
    if (r.current && r.ym) put(r.ym, r.current, 3, { dateStart: r.dateStart, date: r.date, n: r.sample });
  }
  const months = [...best.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1));
  const annual = new Map();
  for (const r of nat) for (const s of r.salience || []) if (s.basis === "annual average" && !annual.has(s.year)) annual.set(s.year, s.issues);
  const firstYm = months.length ? months[0].ym : "9999";
  const years = [...annual].filter(([y]) => `${y}-12` < firstYm).map(([y, issues]) => ({ year: +y, issues }));
  /* party most capable: one per report month (a reprinted report agrees) */
  const own = new Map();
  for (const r of nat) if (r.ownership && Object.keys(r.ownership).length && !own.has(r.ym)) own.set(r.ym, { ym: r.ym, dateStart: r.dateStart, date: r.date, n: r.sample, issues: r.ownership });
  return { months, years, own: [...own.values()] };
}

export function buildReadings({ root, issuesFile, pollOf = () => null, rowN, keys }) {
  const rd = (f) => { const p = path.join(root, "data", f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null; };
  const KEYS = new Set(keys);
  const sal = [], own = [];
  const S = (r) => { if (KEYS.has(r.issue) && Number.isFinite(r.p) && r.p >= 0) sal.push(r); };
  const O = (r) => { if (KEYS.has(r.issue) && r.alp > 0 && r.lnp > 0) own.push(r); };
  const F = issuesFile;
  const nOf = (w) => rowN(pollOf(w) || { sample: w.sample, sampleEff: w.sampleEff });
  /* ---- the live store: RedBridge and Ipsos's top three, every house's best party ---- */
  const liveIpsos = new Set(), liveIpsosOwn = new Set();
  for (const w of F.salience || []) {
    const p = pollOf(w) || w, day = midDay(p.dateStart, p.date || w.date), n = nOf(w);
    if (w.pollster === "Ipsos") liveIpsos.add(w.date.slice(0, 7));
    for (const [k, v] of Object.entries(w.issues)) {
      if (v.top3 == null) continue;
      S({ day, date: w.date, house: w.pollster, fmt: "top3", issue: k, p: v.top3, n, step: step1(v.top3), live: true });
      if (w.pollster === "Ipsos" && k === "environment") S({ day, date: w.date, house: "Ipsos (environment)", fmt: "top3", issue: "climate", p: v.top3, n, step: 1, live: true });
    }
  }
  for (const w of F.ownership || []) {
    const p = pollOf(w) || w, day = midDay(p.dateStart, p.date || w.date), n = nOf(w);
    if (w.pollster === "Ipsos") liveIpsosOwn.add(w.date.slice(0, 7));
    const onOffered = (w.options || []).includes("onp");
    for (const [k, sh] of Object.entries(w.issues)) {
      if (sh.alp == null || sh.lnp == null) continue;
      O({ day, date: w.date, house: w.pollster, issue: k, alp: sh.alp, lnp: sh.lnp, onp: onOffered && sh.onp != null ? sh.onp : null,
          n, step: [sh.alp, sh.lnp].every(Number.isInteger) ? 1 : 0.1, onOffered, live: true });
    }
  }
  /* ---- Ipsos Issues Monitor, 2010–2025 ---- */
  const H = rd("ipsos-issues-history.json");
  if (H) {
    const { months, years, own: iown } = ipsosMonths(H);
    for (const m of months) {
      if (liveIpsos.has(m.ym)) continue;
      const day = m.date ? midDay(m.dateStart, m.date) : DAYn(m.ym + "-08");
      const n = Math.min(m.n || 1000, 3000);
      for (const [k, p] of Object.entries(m.issues)) {
        if (p == null) continue;
        if (IPSOS_KEYS.has(k)) S({ day, date: ISOd(day), house: "Ipsos", fmt: "top3", issue: k, p, n, step: 1 });
        if (k === "environment") S({ day, date: ISOd(day), house: "Ipsos (environment)", fmt: "top3", issue: "climate", p, n, step: 1 });
      }
    }
    for (const y of years) {
      const day = DAYn(`${y.year}-07-01`);
      for (const [k, p] of Object.entries(y.issues)) {
        if (p == null) continue;
        const r = { day, date: ISOd(day), fmt: "top3", p, n: 12000, step: 1, avg: 365 };
        if (IPSOS_KEYS.has(k)) S({ ...r, house: "Ipsos", issue: k });
        if (k === "environment") S({ ...r, house: "Ipsos (environment)", issue: "climate" });
      }
    }
    for (const m of iown) {
      if (liveIpsosOwn.has(m.ym)) continue;
      const day = m.date ? midDay(m.dateStart, m.date) : DAYn(m.ym + "-08");
      for (const [k, sh] of Object.entries(m.issues)) {
        if (sh.alp == null || sh.lnp == null) continue;
        O({ day, date: ISOd(day), house: "Ipsos", issue: k, alp: sh.alp, lnp: sh.lnp, onp: sh.onp ?? null, n: Math.min(m.n || 1000, 3000), step: 1, onOffered: sh.onp != null });
      }
    }
  }
  /* ---- What Worries the World (Ipsos's other panel question, Australia) ---- */
  const W = rd("ipsos-worries.json");
  if (W) for (const w of W.waves) {
    if (!w.australia || !w.australia.length || !w.end) continue;
    const day = midDay(w.start, w.end), n = (w.sample && w.sample.australia) || 1000;
    for (const o of w.australia) if (WORRIES[o.issue] && o.share != null)
      S({ day, date: w.end, house: "Ipsos What Worries the World", fmt: "top3", issue: WORRIES[o.issue], p: o.share, n, step: 1 });
  }
  /* ---- ANUpoll: the most important problem, open, first answer ---- */
  const A = rd("anupoll-issues.json");
  if (A) for (const w of A.waves) {
    const q = w.questions && w.questions.first;
    if (!q || !q.responses || !q.responses.length || !w.fieldwork || !w.fieldwork.reportEnd) continue;
    const day = midDay(w.fieldwork.reportStart, w.fieldwork.reportEnd), n = w.respondentsReport || (q.base && q.base.validN) || 1200;
    const sum = {};
    for (const r of q.responses) { const k = anuKey(r.label); if (k && r.percent != null) sum[k] = (sum[k] || 0) + r.percent; }
    for (const [k, p] of Object.entries(sum)) S({ day, date: w.fieldwork.reportEnd, house: "ANUpoll", fmt: "first", issue: k, p, n, step: 0.1 });
  }
  /* ---- AES: the most important issue of the campaign, asked after each election ---- */
  const E = rd("aes-issues.json");
  if (E) {
    for (const s of E.series.filter((x) => x.id === "3.1" || x.id === "3.2")) for (const row of s.rows) {
      const e = ELECTION_DAYS[row.year]; if (!e) continue;
      const day = DAYn(e) + 60;
      for (const [lab, p] of Object.entries(row.values)) {
        const k = AES_LABEL[lab]; if (!k || p == null) continue;
        S({ day, date: ISOd(day), house: "AES", fmt: "first", issue: k, p, n: 2000, step: 0.1 });
      }
    }
    for (const s of E.series.filter((x) => AES_POLICY[x.id])) for (const row of s.rows) {
      const e = ELECTION_DAYS[row.year], v = row.values; if (!e || v.ALP == null || v.Coalition == null) continue;
      const day = DAYn(e) + 60;
      O({ day, date: ISOd(day), house: "AES (party policy closest)", issue: AES_POLICY[s.id], alp: v.ALP, lnp: v.Coalition, onp: null, n: 2000, step: 0.1, onOffered: false });
    }
  }
  /* ---- JWS Research: pick five of twenty-odd ---- */
  const J = rd("jws-issues.json");
  if (J) for (const w of J.waves) {
    const f = w.families && w.families.promptedTopFive;
    if (!f || !f.rows || !w.date) continue;
    const day = midDay(w.dateStart, w.date), n = w.sample || 1000;
    for (const r of f.rows) {
      const m = jwsKey(r.label); if (!m || r.share == null) continue;
      const k = typeof m === "string" ? m : m.k, house = (typeof m === "object" && m.era) || "JWS Research";
      S({ day, date: w.date, house, fmt: "top5", issue: k, p: r.share, n, step: 1 });
    }
  }
  /* ---- Freshwater Strategy (AFR): up to three; best to manage, Labor / neither / Coalition ---- */
  const FW = rd("freshwater-issues.json");
  if (FW) {
    for (const w of FW.importance.waves) for (const r of w.rows || []) {
      const k = FW_IMP[r.issue]; if (!k || r.share == null || !w.fieldworkEnd) continue;
      S({ day: midDay(w.fieldworkStart, w.fieldworkEnd), date: w.fieldworkEnd, house: "Freshwater Strategy", fmt: "top3", issue: k, p: r.share, n: w.sample || 1000, step: 1 });
    }
    for (const w of FW.management.waves) {
      const opts = w.responseOptions || [];
      const ia = opts.findIndex((o) => /Labor/.test(o)), il = opts.findIndex((o) => /Coalition/.test(o));
      if (ia < 0 || il < 0 || !w.fieldworkEnd) continue;
      for (const r of w.rows || []) {
        const k = FW_IMP[r.issue]; if (!k || !r.shares) continue;
        O({ day: midDay(w.fieldworkStart, w.fieldworkEnd), date: w.fieldworkEnd, house: "Freshwater Strategy", issue: k, alp: r.shares[ia], lnp: r.shares[il], onp: null, n: w.sample || 1000, step: 1, onOffered: false });
      }
    }
  }
  /* ---- SEC Newgate: open question, any number of mentions ---- */
  const SEC = rd("sec-issues.json");
  if (SEC && SEC.series) for (const [lab, rows] of Object.entries(SEC.series)) {
    const k = SEC_B1[lab]; if (!k) continue;
    for (const r of rows) if (r.mention != null && r.month >= "2025-01")
      S({ day: DAYn(r.month + "-12"), date: r.month + "-15", house: "SEC Newgate (unprompted)", fmt: "open", issue: k, p: r.mention, n: 1000, step: 1 });
  }
  /* ---- Lowy Institute: which party would do the better job (national figures) ---- */
  const L = rd("lowy-issues.json");
  if (L && L.values) {
    const cats = L.dictionary.categories, yrs = L.dictionary.years;
    Object.entries(L.values).forEach(([yi, splits]) => {
      const row = splits["0"] || splits[0]; const y = yrs[+yi]; const wv = (L.waves || []).find((x) => +String(x.year || x.id || "").slice(0, 4) === y);
      if (!row) return;
      const end = (wv && (wv.fieldworkEnd || wv.end)) || `${y}-03-15`;
      row.forEach((cell, ci) => {
        const k = LOWY[cats[ci]]; if (!k || !Array.isArray(cell) || !cell.length) return;
        const [a, l] = cell; if (!(a > 0 && l > 0)) return;
        const onp = cell[4] === "" || cell[4] == null ? null : cell[4];
        O({ day: DAYn(end) - 7, date: end, house: "Lowy Institute", issue: k, alp: a, lnp: l, onp: null, n: (wv && wv.sample) || 1200, step: 1, onOffered: onp != null });
      });
    });
  }
  sal.sort((a, b) => a.day - b.day); own.sort((a, b) => a.day - b.day);
  return { sal, own };
}
