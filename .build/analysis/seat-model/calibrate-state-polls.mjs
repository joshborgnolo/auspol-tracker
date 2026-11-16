#!/usr/bin/env node
/* calibrate-state-polls.mjs: how far the final month's polls sat from the result at STATE elections, for
   the Victorian model's polling error (the federal model's comes from federal cycles, calibrate-national.mjs).

   data/state-election-final-polls.json (state-polls/build-store.py): for each state election 2010-2026 with
   a polling table on Wikipedia, the polls whose fieldwork ended in the 35 days before polling day and the
   result. As federally, the plain mean of those polls is compared with the result on the logit scale, per
   party: Labor, the Coalition, the Greens, One Nation where the polls carried it, and the rest together.
   Results come from the repo's own district counts where a store exists (map/data/res-<id>.json), else the
   store's row.
   Writes data/seat-model-state-polls.json: sigma (RMS), bias, n, every election's row, and the federal
   final-month values beside them. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const logit = (p) => Math.log(p / (1 - p)), mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
const D = J("data/state-election-final-polls.json"), FED = J("data/seat-model-calibration.json").national;
const KEYS = ["alp", "lnp", "grn", "onp", "oth"];
function storeResult(st, year) {
  const f = `map/data/res-${st}${String(year).slice(2)}.json`; if (!existsSync(f)) return null;
  const t = { alp: 0, lnp: 0, grn: 0, onp: 0 }; let T = 0;
  for (const dv of J(f).divs) for (const c of dv.c) { if (t[c[3]] != null) t[c[3]] += c[4]; T += c[4]; }
  return { alp: r2(100 * t.alp / T), lnp: r2(100 * t.lnp / T), grn: r2(100 * t.grn / T), ...(t.onp > 0 ? { onp: r2(100 * t.onp / T) } : {}), source: f };
}
const rows = [];
for (const e of D.elections) {
  const year = +e.date.slice(0, 4), sr = storeResult(e.st, year), res = sr || (e.result && { ...e.result, source: e.resultSource });
  if (!res || !e.polls.length) continue;
  if (sr && e.result) for (const k of ["alp", "lnp", "grn"]) if (e.result[k] != null && Math.abs(e.result[k] - sr[k]) > 0.6) console.log(`  note ${e.st} ${year} ${k}: table ${e.result[k]} v district counts ${sr[k]}`);
  const pm = {}, n = {};
  for (const k of ["alp", "lnp", "grn", "onp"]) { const xs = e.polls.map((p) => p[k]).filter((x) => x != null); if (xs.length) { pm[k] = mean(xs); n[k] = xs.length; } }
  if (pm.onp != null && n.onp < e.polls.length / 2) { delete pm.onp; }     // One Nation carried by a minority of the polls: left in the rest
  if (res.onp == null) delete pm.onp;
  const rest = (o, withOn) => 100 - o.alp - o.lnp - o.grn - (withOn ? o.onp : 0);
  if (pm.alp == null || pm.lnp == null || pm.grn == null) continue;
  const withOn = pm.onp != null;
  // the rest: among polls carrying all of Labor, the Coalition and the Greens (and One Nation where kept)
  const full = e.polls.filter((p) => p.alp != null && p.lnp != null && p.grn != null && (!withOn || p.onp != null));
  pm.oth = mean(full.map((p) => rest(p, withOn)));
  const R = { ...res, oth: rest(res, withOn) };
  const err = {}; for (const k of KEYS) if (pm[k] != null && R[k] != null && pm[k] > 0.5 && R[k] > 0.5) err[k] = r3(logit(R[k] / 100) - logit(pm[k] / 100));
  rows.push({ st: e.st, date: e.date, polls: e.polls.length, firms: [...new Set(e.polls.map((p) => p.firm))].length, poll: Object.fromEntries(KEYS.filter((k) => pm[k] != null).map((k) => [k, r2(pm[k])])), result: Object.fromEntries(KEYS.filter((k) => R[k] != null).map((k) => [k, r2(R[k])])), resultSource: res.source, err });
}
const stat = (sel) => { const o = { sigma: {}, bias: {}, n: {} }; for (const k of KEYS) { const es = rows.filter(sel).map((r) => r.err[k]).filter((x) => x != null); if (!es.length) continue; o.sigma[k] = r3(Math.sqrt(mean(es.map((x) => x * x)))); o.bias[k] = r3(mean(es)); o.n[k] = es.length; } return o; };
const all = stat(() => true), multi = stat((r) => r.firms >= 2), recent = stat((r) => r.date >= "2017-01-01");
// One Nation as a large party only (a poll mean of 5% or more): the cases like Victoria's
const onBig = rows.filter((r) => r.err.onp != null && r.poll.onp >= 5).map((r) => r.err.onp);
const out = { _about: "calibrate-state-polls.mjs: the mean of the final month's polls v the result at state elections 2010-2026 (Victoria, Queensland, NSW, WA, SA; data/state-election-final-polls.json), logit scale. sigma = RMS over elections, bias = mean (result - polls). all = every election; multi = elections polled by two or more firms in the month; recent = since 2017. onpLarge = One Nation where its poll mean was 5% or more. federal = the federal final-month values (data/seat-model-calibration.json).",
  all, multi, recent, onpLarge: onBig.length ? { sigma: r3(Math.sqrt(mean(onBig.map((x) => x * x)))), bias: r3(mean(onBig)), n: onBig.length } : null,
  federal: { sigma: Object.fromEntries(KEYS.map((k) => [k, FED.sigma[k]["final month"]])), n: Object.fromEntries(KEYS.map((k) => [k, FED.n[k]["final month"]])) }, elections: rows };
writeFileSync("data/seat-model-state-polls.json", JSON.stringify(out, null, 1) + "\n");
const pts = (s, p) => (100 * s * p * (1 - p)).toFixed(1);
console.log("election        polls firms | poll mean -> result (logit error)");
for (const r of rows) console.log(`${r.st} ${r.date}  ${String(r.polls).padStart(2)}  ${r.firms} | ` + KEYS.filter((k) => r.err[k] != null).map((k) => `${k} ${r.poll[k].toFixed(1)}->${r.result[k].toFixed(1)} (${r.err[k] >= 0 ? "+" : ""}${r.err[k].toFixed(2)})`).join("  "));
for (const [name, s] of [["all", all], ["2+ firms", multi], ["since 2017", recent]]) console.log(`${name.padEnd(11)} sigma ` + KEYS.filter((k) => s.sigma[k] != null).map((k) => `${k} ${s.sigma[k]} (bias ${s.bias[k] >= 0 ? "+" : ""}${s.bias[k]}, n ${s.n[k]})`).join(" | "));
console.log(`One Nation at 5%+: sigma ${out.onpLarge?.sigma} (bias ${out.onpLarge?.bias}, n ${out.onpLarge?.n})`);
console.log("federal final month: " + KEYS.map((k) => `${k} ${out.federal.sigma[k]} (n ${out.federal.n[k]})`).join(" | "));
console.log(`in points at Victoria's vote: Labor 22% ±${pts(all.sigma.alp, 0.22)} (federal ±${pts(out.federal.sigma.alp, 0.22)}), Coalition 31% ±${pts(all.sigma.lnp, 0.31)} (±${pts(out.federal.sigma.lnp, 0.31)}), Greens 14% ±${pts(all.sigma.grn, 0.14)} (±${pts(out.federal.sigma.grn, 0.14)})`);
