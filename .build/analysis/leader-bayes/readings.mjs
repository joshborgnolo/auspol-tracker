/* Leader readings for the leadership model prototype (2026-11-23).
   ratings: one row per (poll, leader, question): net, and app/dis/unsure where printed
   ppm:     one row per (poll, contest): shares and uncommitted
   Persons by date from gen-data's CYC_META (offices' handovers) + the
   current term's Ley → Taylor splice. Run: node readings.mjs > readings.json */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
const GEN = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
const { HOUSE_RENAMES } = await import(path.join(ROOT, ".build", "newtracker", "house-renames.mjs"));
const canonHouse = (h) => HOUSE_RENAMES[h] || h;

/* ---- CYC_META, read out of gen-data (analysis only) ---- */
const a = GEN.indexOf("const CYC_META = JUR ? jurCycles() : [");
const b = GEN.indexOf("\n];", a);
const CYC = vm.runInNewContext("(" + GEN.slice(GEN.indexOf("[", a), b + 2) + ")", { OPP_SPLICE_ISO: "2026-02-13" });
const PARTY_OF = { Curtin: "alp", Chifley: "alp", Evatt: "alp", Calwell: "alp", Whitlam: "alp", Hayden: "alp", Hawke: "alp", Keating: "alp", Beazley: "alp", Crean: "alp", Latham: "alp", Rudd: "alp", Gillard: "alp", Shorten: "alp", Albanese: "alp",
  Fadden: "lnp", Menzies: "lnp", Holt: "lnp", McEwen: "lnp", Gorton: "lnp", McMahon: "lnp", Snedden: "lnp", Fraser: "lnp", Peacock: "lnp", Howard: "lnp", Hewson: "lnp", Downer: "lnp", Nelson: "lnp", Turnbull: "lnp", Abbott: "lnp", Morrison: "lnp", Dutton: "lnp", Ley: "lnp", Taylor: "lnp", Hanson: "onp" };
/* stints per office: [{ person, from, to, party }] */
function stints(office) {
  const out = [];
  CYC.forEach((c, i) => {
    const next = CYC[i + 1];
    const end = next ? next.eDate : "2099-01-01";
    const party = null;
    const spl = office === "pm" ? c.pmSpl : c.oppSpl;
    const names = spl ? spl.names : [office === "pm" ? c.lead : c.oppLead];
    const isos = spl ? (spl.isos || [spl.iso]) : [];
    const bounds = [c.eDate, ...isos, end];
    names.forEach((nm, k) => out.push({ person: nm, from: bounds[k], to: bounds[k + 1], party, office }));
  });
  /* a split dated past its term's end (Shorten → Albanese, 27 May 2019, sits
     on both the 2016 and 2019 rows) leaves an empty or inverted stint: drop it,
     then merge consecutive same-person stints across elections */
  const ok = out.filter((s) => s.to > s.from).sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : 0));
  const m = [];
  for (const s of ok) { const l = m[m.length - 1]; if (l && l.person === s.person && l.to >= s.from) l.to = s.to > l.to ? s.to : l.to; else m.push({ ...s, party: PARTY_OF[s.person] || null }); }
  for (let i = 0; i + 1 < m.length; i++) if (m[i].to > m[i + 1].from) m[i].to = m[i + 1].from;
  return m;
}
const PM = stints("pm"), OPP = stints("opp");
const whoOn = (list, iso) => list.find((s) => iso >= s.from && iso < s.to) || null;

/* ---- helpers ---- */
const DAY = (iso) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86400000);
const POLL_BY = new Map(D.polls.map((p) => [p.date + "|" + canonHouse(p.pollster), p]));
const rowN = (p) => (p && p.sampleEff != null) ? p.sampleEff * 1.6 : Math.min((p && p.sample) || 1200, 3000);
const midDay = (p, date) => (p && p.dateStart ? Math.round((DAY(p.dateStart) + DAY(date)) / 2) : DAY(date) - 1);
const FAV_FIRMS = new Set(D.metricRules.favFirms);
const canonFirm = (firm) => (firm || "").replace(/\s*\(.*\)\s*$/, "").replace(/\s*\/.*$/, "").trim().toLowerCase();
const metricOf = (firm, lk, date) => {
  const c = canonFirm(firm);
  if (FAV_FIRMS.has(c)) return "fav";
  const o = lk && D.metricRules.overrides[c + "|" + lk];
  if (o && o.metric === "fav" && (!date || date < o.before)) return "fav";
  return "approval";
};
const NO_AGG = new Set(["Roy Morgan (SMS)", "Roy Morgan (pooled)", "Newspoll (pooled)", "EMRS (Tas)"]);

const ratings = [], ppm = [];
/* ---- current term ---- */
for (const r0 of D.approval) {
  const r = { ...r0, firm: canonHouse(r0.firm) };
  if (NO_AGG.has(r.firm)) continue;
  const p = POLL_BY.get(r.date + "|" + r.firm), n = rowN(p), day = midDay(p, r.date);
  for (const lk of ["alb", "opp", "han"]) {
    if (r[lk] == null) continue;
    const person = lk === "alb" ? "Albanese" : lk === "han" ? "Hanson" : (r.date < "2026-02-13" ? "Ley" : "Taylor");
    const role = lk === "alb" ? "pm" : lk === "han" ? "han" : "opp";
    const sp = r.detail && r.detail[lk];
    const R = sp && sp.app != null ? sp.app : null, W = sp && sp.dis != null ? sp.dis : null;
    const U = sp && sp.unsure != null ? sp.unsure : (R != null && W != null ? Math.max(0, 100 - R - W) : null);
    ratings.push({ date: r.date, day, house: r.firm, role, person, metric: metricOf(r.firm, lk, r.date), net: r[lk], R, W, U, n, src: "approval" });
  }
  /* Resolve's likeability nets beside its performance question */
  const fav = r.detail && r.detail.fav;
  if (fav) for (const lk of ["alb", "opp", "han"]) if (fav[lk] != null) {
    const person = lk === "alb" ? "Albanese" : lk === "han" ? "Hanson" : (r.date < "2026-02-13" ? "Ley" : "Taylor");
    ratings.push({ date: r.date, day, house: r.firm + " (likeability)", role: lk === "alb" ? "pm" : lk === "han" ? "han" : "opp", person, metric: "fav", net: fav[lk], R: null, W: null, U: null, n, src: "approval.fav" });
  }
}
for (const r0 of D.ppm) {
  const r = { ...r0, firm: canonHouse(r0.firm) };
  if (NO_AGG.has(r.firm)) continue;
  const p = POLL_BY.get(r.date + "|" + r.firm), n = rowN(p), day = midDay(p, r.date);
  const opp = r.date < "2026-02-13" ? "Ley" : "Taylor";
  if (r.han == null && r.alb != null && r.opp != null)
    ppm.push({ date: r.date, day, house: r.firm, contest: "pm-opp", kind: "two", pm: "Albanese", opp, a: r.alb, b: r.opp, unc: Math.max(0, 100 - r.alb - r.opp), n });
  if (r.han != null) ppm.push({ date: r.date, day, house: r.firm, contest: "three", kind: "three", pm: "Albanese", opp, a: r.alb, b: r.opp, c: r.han, unc: Math.max(0, 100 - r.alb - r.opp - r.han), n });
  for (const e of r.extra || []) {
    if (e.kind === "2pmp") ppm.push({ date: r.date, day, house: r.firm, contest: "pm-opp", kind: "2pmp", pm: "Albanese", opp, a: e.alb, b: e.opp, unc: 0, n });
    else ppm.push({ date: r.date, day, house: r.firm, contest: "pm-opp", kind: "two", pm: "Albanese", opp, a: e.alb, b: e.opp, unc: Math.max(0, 100 - e.alb - e.opp), n });
  }
}
for (const r0 of D.ppmHeadToHead) {
  const r = { ...r0, firm: canonHouse(r0.firm) };
  const p = POLL_BY.get(r.date + "|" + r.firm), n = rowN(p), day = midDay(p, r.date);
  ppm.push({ date: r.date, day, house: r.firm, contest: "alb-han", kind: "two", pm: "Albanese", opp: "Hanson", a: r.alb, b: r.han, unc: Math.max(0, 100 - r.alb - r.han), n });
}

/* ---- past terms: cycleApproval (+ printed splits where a source CSV has them) ---- */
const csv = (f) => { const L = fs.readFileSync(path.join(ROOT, "data", f), "utf8").trim().split("\n"); const h = L[0].split(","); return L.slice(1).map((l) => { const v = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "")); return Object.fromEntries(h.map((k, i) => [k, v[i] === "" || v[i] == null ? null : v[i]])); }); };
const bull = csv("bulletin-leader-approval.csv");
const acn = csv("acnielsen-polls.csv");
const near = (rows, iso, tol = 4) => rows.filter((x) => Math.abs(DAY(x.date) - DAY(iso)) <= tol);
let splitHits = 0;
for (const [cyc, rows] of Object.entries(D.cycleApproval)) {
  for (const r0 of rows) {
    const r = { ...r0, firm: canonHouse(r0.firm) };
    const iso = r.date, day = DAY(iso) - 1;
    const pmS = whoOn(PM, iso), opS = whoOn(OPP, iso);
    const n = r.firm === "Morning Consult" ? 3000 : 1200;
    for (const [lk, role, S] of [["pmNet", "pm", pmS], ["oppNet", "opp", opS]]) {
      if (r[lk] == null || !S) continue;
      let R = null, W = null, U = null;
      if (r.firm === "Morgan Gallup") {
        const m = near(bull, iso, 3).find((x) => (role === "pm" ? x.role === "pm" : x.role === "opposition") && x.net != null && Math.abs(+x.net - r[lk]) <= 1);
        if (m && m.approve != null) { R = +m.approve; W = +m.disapprove; U = m.undecided != null ? +m.undecided : 100 - R - W; splitHits++; }
      }
      if (/Nielsen/.test(r.firm)) {
        const m = near(acn, iso, 3)[0];
        const ra = role === "pm" ? ["pm_approve", "pm_disapprove", "pm_uncommitted"] : ["ol_approve", "ol_disapprove", "ol_uncommitted"];
        if (m && m[ra[0]] != null && Math.abs(+m[ra[0]] - +m[ra[1]] - r[lk]) <= 1) { R = +m[ra[0]]; W = +m[ra[1]]; U = m[ra[2]] != null ? +m[ra[2]] : 100 - R - W; splitHits++; }
      }
      ratings.push({ date: iso, day, house: r.firm, role, person: S.person, party: S.party, stint: S.from, metric: r.metric || metricOf(r.firm, "alb"), net: r[lk], R, W, U, n, src: "cycle" + cyc });
    }
    if (r.pmPpm != null && r.oppPpm != null && pmS && opS)
      ppm.push({ date: iso, day, house: r.firm, contest: "pm-opp", kind: "two", pm: pmS.person, opp: opS.person, a: r.pmPpm, b: r.oppPpm, unc: Math.max(0, 100 - r.pmPpm - r.oppPpm), n, src: "cycle" + cyc });
  }
}
/* party per current-term person */
for (const r of ratings) if (!r.party) r.party = PARTY_OF[r.person] || null;
/* stint key: office + person + the stint's start (Rudd's two prime ministerships are two series) */
const stintOf = (role, person, iso) => { const l = role === "pm" ? PM : role === "opp" ? OPP : null; const s = l && whoOn(l, iso); return s && s.person === person ? s.from : (role === "han" ? "2025-05-03" : null); };
for (const r of ratings) r.series = r.role + ":" + r.person + ":" + (r.stint || stintOf(r.role, r.person, r.date));
for (const r of ppm) { const a = whoOn(PM, r.date), o = whoOn(OPP, r.date); r.series = r.contest === "pm-opp" ? "pm-opp:" + r.pm + "-" + r.opp + ":" + (a ? a.from : "") + "/" + (o ? o.from : "") : r.contest + ":" + r.pm + "-" + r.opp; }
ratings.sort((x, y) => x.day - y.day || (x.house < y.house ? -1 : 1));
ppm.sort((x, y) => x.day - y.day || (x.house < y.house ? -1 : 1));
ratings.forEach((r, k) => { r.rid = k; }); ppm.forEach((r, k) => { r.rid = k; });
console.error(`ratings ${ratings.length} (split ${ratings.filter((r) => r.R != null).length}, history splits matched ${splitHits}); ppm ${ppm.length}`);
process.stdout.write(JSON.stringify({ PM, OPP, ratings, ppm }));
