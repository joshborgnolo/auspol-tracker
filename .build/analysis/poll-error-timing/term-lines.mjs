/* One past term's monthly primary lines, raw (the Past cycles construction:
   readings debiased by the term's house leans, rounded-month buckets, sqrt(m)
   repeat deflation, month 0 = the opening count) and drawn through the counts:
     adjusted(t) = raw(t) − e·[w0 + (1 − w0)·f],  f = share of the term elapsed
   e = the production estimate at polling day − the closing count.
   w0 = share of the miss already present when the term opens (0 = a ramp from
   the opening count, 1 = the whole miss all term).
   Run: node .build/analysis/poll-error-timing/term-lines.mjs <closing year> [w0 ...] */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const D = JSON.parse(execSync("git show HEAD:data/polls.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8"));
const [Y, ...W] = process.argv.slice(2); const W0 = W.length ? W.map(Number) : [0, 0.4, 1];
const LN2 = Math.log(2), MS_MONTH = 365.25 / 12;
const ddays = (a, b) => (a - b) / 86400000;
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
function houseEffectsFor(rows) {
  const devs = [];
  for (const a of rows) { let sw = 0, swx = 0, k = 0;
    for (const b of rows) { if (b === a || Math.abs(ddays(b.mid, a.mid)) > 28 || b.firm === a.firm) continue; sw += b.n; swx += b.n * b.x; k++; }
    if (k >= 3) devs.push({ firm: a.firm, mid: a.mid, dev: a.x - swx / sw }); }
  const by = {}; for (const d of devs) (by[d.firm] ||= []).push(d);
  return { at: (firm, t) => { let sw = 0, swx = 0; for (const d of by[firm] || []) { if (d.mid > t) continue; const w = Math.exp(-LN2 * ddays(t, d.mid) / 90); sw += w; swx += w * d.dev; } return sw ? (sw / (sw + 1.5)) * (swx / sw) : 0; } };
}
const taper = (d) => (d <= 14 ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - 14) / 7)));
function nowcast(rows, he, ref) { const pts = [], waves = new Map();
  for (const a of rows) { const d = ddays(ref, a.mid); if (d < 0 || d > 21) continue; waves.set(a.firm, (waves.get(a.firm) || 0) + 1); pts.push({ w: a.n * Math.exp(-LN2 * d / 7) * taper(d), x: a.x - he.at(a.firm, ref), firm: a.firm }); }
  let sw = 0, swx = 0; for (const p of pts) { p.w /= Math.sqrt(waves.get(p.firm)); sw += p.w; swx += p.w * p.x; } return sw ? swx / sw : null; }
const ELS = Object.entries(D.elections).map(([k, e]) => ({ y: +k.slice(1), ...e, T: Date.parse(e.date) })).sort((a, b) => a.T - b.T);
const ci = ELS.findIndex((e) => e.y === +Y), o = ELS[ci - 1], c = ELS[ci];
const firmOf = (p) => p.firm || p.pollster || "";
const polls = D.cyclePolls[Y].filter((p) => !/^(election|election result)$/i.test(firmOf(p)) && !/exit/i.test(firmOf(p)))
  .filter((p) => { const t = Date.parse(p.date); return t > o.T && t <= c.T; });
const out = [], monthIso = (m) => new Date(o.T + m * MS_MONTH * 86400000).toISOString().slice(0, 10);
const NAME = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation" };
const termM = ddays(c.T, o.T) / MS_MONTH;
for (const k of ["alp", "lnp"]) {
  const rows = polls.filter((p) => p[k] != null).map((p) => ({ mid: midMs(p), t: Date.parse(p.date), x: p[k], n: 1200, firm: firmOf(p) }));
  const he = houseEffectsFor(rows);
  const e = nowcast(rows, he, c.T) - c[k];
  const b = {}; for (const r of rows) { const m = Math.round(ddays(r.t, o.T) / MS_MONTH); (b[m] ||= []).push({ ...r, v: r.x - he.at(r.firm, r.t) }); }
  const months = Object.keys(b).map(Number).sort((x, y) => x - y);
  const raw = months.map((m) => { const waves = new Map(); for (const r of b[m]) waves.set(r.firm, (waves.get(r.firm) || 0) + 1);
    let sw = 0, swx = 0; for (const r of b[m]) { const w = r.n / Math.sqrt(waves.get(r.firm)); sw += w; swx += w * r.v; } return { m, v: swx / sw }; });
  console.error(`${NAME[k]}: opening count ${o[k]}  closing count ${c[k]}  polls at polling day ${(c[k] + e).toFixed(1)}  miss e ${e >= 0 ? "+" : ""}${e.toFixed(2)}  (${months.length} polled months of ${Math.round(termM)})`);
  out.push({ date: o.date, series: `${NAME[k]}: polls`, value: o[k] });
  for (const r of raw) out.push({ date: monthIso(r.m), series: `${NAME[k]}: polls`, value: +r.v.toFixed(2) });
  for (const w0 of W0) {
    const s = `${NAME[k]}: through the counts (w0 ${w0})`;
    out.push({ date: o.date, series: s, value: o[k] });
    for (const r of raw) { const f = Math.min(1, Math.max(0, r.m / termM)); out.push({ date: monthIso(r.m), series: s, value: +(r.v - e * (w0 + (1 - w0) * f)).toFixed(2) }); }
    out.push({ date: c.date, series: s, value: c[k] });
  }
  // the check that matters for the story: the term's lowest/highest readings either way
  for (const w0 of [null, ...W0]) {
    const vals = raw.map((r) => ({ m: r.m, v: w0 == null ? r.v : r.v - e * (w0 + (1 - w0) * Math.min(1, r.m / termM)) }));
    const lo = vals.reduce((a, q) => (q.v < a.v ? q : a)), hi = vals.reduce((a, q) => (q.v > a.v ? q : a));
    console.error(`   ${w0 == null ? "polls          " : "w0 " + String(w0).padEnd(12)} low ${lo.v.toFixed(1)} (${monthIso(lo.m).slice(0, 7)})  high ${hi.v.toFixed(1)} (${monthIso(hi.m).slice(0, 7)})`);
  }
}
console.log(JSON.stringify(out));
