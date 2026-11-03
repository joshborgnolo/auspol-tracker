#!/usr/bin/env node
/* site-claims.mjs: the Who-votes election test's claims, checked against the polls' own election-time gaps.

   gen-data §7gb's election test asks, for each group the AES 2025 measures the site's way, whether the group's
   gap from all voters has moved since the election: now = the current pooled gap (the dot plot's "vs all
   voters"), then = the AES's gap (group − all respondents). Two instruments, so a difference can be a change or
   the two measuring differently. group-error.mjs shows that before the election the polls already differed from
   the AES on several of these gaps, so this re-asks each question with the polls' own election-time gap as
   "then" (same instruments, final five weeks, pooled across houses), read on the site's bands:
     gender, education, housing, working   the houses' printed cells (Rent = Renting, No tertiary = Year 12
                                           or less, TAFE/Tech = TAFE or trade)
     age                                   18–34 printed; 35–54 and 55+ read off the four-band tables with the
                                           site's own ageStandardise (demo-groups.mjs), as gen-data reads
                                           those houses today
     generation                            no pre-election poll cut; left as the AES test has it
   Each house's final-window gap is the sample-weighted mean of its releases (design effects from
   group-error.mjs), houses pooled by inverse variance. The test: |now − then_polls| against the current
   figure's margin (the row's ciNow) and the pooled election-time margin combined, as the site's test combines
   its two; the ratio half of the site's test is not repeated.

   Reads the live rows from the built dataset (index.html's data-late chunk), so it checks what the site prints.
   Writes out/prepoll-groups.json (the polls' election-time gaps on the site's sets) beside the report.

   Run from the repo root:
     node .build/analysis/group-poll-error-2025/site-claims.mjs > .build/analysis/group-poll-error-2025/out/site-claims.txt */
import fs from "node:fs";
import path from "node:path";
import { HERE, ROOT, J, K, FINAL_FROM, ELECTION, releases, gapOf, pool, fmt } from "./lib.mjs";
import { analyse } from "./group-error.mjs";
import { ageStandardise } from "../../newtracker/demo-groups.mjs";

const SITE = {
  gender: { Men: "Male", Women: "Female" },
  education: { "Year 12 or less": "No tertiary", "TAFE or trade": "TAFE/Tech", University: "University" },
  housing: { "Own outright": "Own outright", Mortgage: "Mortgage", Renting: "Rent" },
  working: { "Full time": "Full time", "Part time": "Part time", Retired: "Retired" },
  age: { "18–34": "Age 18-34", "35–54": null, "55+": null },
};
const AGE4 = { "Age 18-34": "18-34", "Age 35-49": "35-49", "Age 50-64": "50-64", "Age 65+": "65+" };

function prepoll() {
  const deff = analyse().deff, dist = J("data/age-dist.json");
  const adults = dist.adults, tot = adults.reduce((s, x) => s + x, 0);
  const popShare = (lo, hi) => adults.slice(lo - 18, hi == null ? undefined : hi - 18).reduce((s, x) => s + x, 0) / tot;
  const rs = releases().list.filter((R) => R.all && !R.flags.length && R.end >= FINAL_FROM && R.end <= ELECTION);
  const per = {}; // set|group|party -> house -> [{gap, v, n}]
  const push = (set, group, house, k, o) => { const key = `${set}|${group}|${k}`; ((per[key] = per[key] || {})[house] = per[key][house] || []).push(o); };
  for (const R of rs) {
    const d = deff[R.house]?.deff ?? 1.5;
    for (const [set, groups] of Object.entries(SITE)) for (const [group, scope] of Object.entries(groups)) {
      if (!scope || !R.cells[scope] || R.cells[scope].flags.length) continue;
      const g = gapOf(R, R.cells[scope], d);
      for (const k of K) if (g?.[k]) push(set, group, R.house, k, { gap: g[k].gap, v: g[k].v, n: R.cells[scope].n });
    }
    // 35–54 and 55+ read off a complete four-band age table
    const four = Object.keys(AGE4).every((s) => R.cells[s] && !R.cells[s].flags.length);
    if (!four) continue;
    const dim = Object.fromEntries(Object.entries(AGE4).map(([s, lab]) => [lab, R.cells[s].s]));
    const st = ageStandardise(dim, dist);
    if (!st) continue;
    const N = Object.keys(AGE4).reduce((s, x) => s + R.cells[x].n, 0);
    for (const [group, lo, hi] of [["35–54", 35, 55], ["55+", 55, null]]) {
      if (!st.shares[group]) continue;
      const f = popShare(lo, hi), n = N * f;
      for (const k of K) {
        const a = st.shares[group][k], t = R.all.s[k];
        if (a == null || t == null) continue;
        const pg = a / 100, pr = Math.min(Math.max((t / 100 - f * pg) / (1 - f), 0.001), 0.999);
        const v = d * 1e4 * (1 - f) ** 2 * (pg * (1 - pg) / n + pr * (1 - pr) / (N - n)) + 1 / 6;
        push("age", group, R.house, k, { gap: a - t, v, n });
      }
    }
  }
  const out = {};
  for (const [key, houses] of Object.entries(per)) {
    const [set, group, k] = key.split("|");
    const hs = Object.fromEntries(Object.entries(houses).map(([h, xs]) => {
      const W = xs.reduce((s, x) => s + x.n, 0);
      return [h, { gap: xs.reduce((s, x) => s + x.n * x.gap, 0) / W, v: xs.reduce((s, x) => s + (x.n / W) ** 2 * x.v, 0), releases: xs.length }];
    }));
    const p = pool(Object.values(hs).map((h) => ({ y: h.gap, v: h.v })));
    (((out[set] = out[set] || {})[group] = out[set][group] || {})[k] = { gap: +p.y.toFixed(2), ci: +(1.96 * Math.sqrt(p.v)).toFixed(2), houses: Object.fromEntries(Object.entries(hs).map(([h, x]) => [h, +x.gap.toFixed(2)])) });
  }
  return out;
}

function liveRows() {
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const file = (idx.match(/data-late\.[a-f0-9]+\.js/) || [])[0];
  if (!file) throw new Error("site-claims: no data-late chunk named in index.html");
  const s = fs.readFileSync(path.join(ROOT, "assets", "js", file), "utf8");
  const i = s.indexOf('JSON.parse("') + 11, j = s.indexOf('");\n', i) + 1;
  const L = JSON.parse(JSON.parse(s.slice(i, j)));
  return { file, trend: L.t.demoTrend, all: L.t.demographics.all };
}

const PRE = prepoll();
fs.writeFileSync(path.join(HERE, "out", "prepoll-groups.json"), JSON.stringify({ _about: "The polls' own gaps from all voters at the 2025 election (fieldwork ending 29 Mar – 2 May 2025), on the site's Who-votes sets, pooled across houses: gap (points) and its 95% margin; per-house gaps beside. Built by site-claims.mjs from bludgertrack-2022-25.json.", sets: PRE }, null, 1) + "\n");
const { file, trend, all } = liveRows();
const L = (s = "") => console.log(s);
L(`The site's election test (${file}, current primaries ${K.map((k) => `${k} ${all[k]}`).join(" ")}), each row re-asked against the`);
L("polls' own election-time gap. then/now/d are the site's (AES baseline); polls-then is the pre-election polls' pooled gap ±95%;");
L("d' = now − polls-then, ±' its margin (the row's ciNow and polls-then's combined). CLAIM = the site's copy may cite it today.");
L();
const rows = [];
for (const [party, o] of Object.entries(trend)) for (const r of o.elec || []) {
  const p = PRE[r.set]?.[r.group]?.[party];
  const dp = p ? r.now - p.gap : null, cip = p ? Math.sqrt(r.ciNow ** 2 + p.ci ** 2) : null;
  rows.push({ party, ...r, pThen: p?.gap ?? null, pCi: p?.ci ?? null, dp, cip, sigP: p ? Math.abs(dp) > cip : null, offset: p ? p.gap - r.then : null });
}
const show = (r) => L(`  ${r.party.padEnd(4)} ${r.set.padEnd(10)} ${r.group.padEnd(16)} then ${fmt(r.then)} now ${fmt(r.now)} d ${fmt(r.d)}±${r.ci.toFixed(1)} ${r.sig ? "sig" : "   "} ${r.claim ? "CLAIM" : "     "}` +
  (r.pThen == null ? "   | no pre-election poll cut" : `   | polls-then ${fmt(r.pThen)}±${r.pCi.toFixed(1)} (AES−polls ${fmt(-r.offset)})  d' ${fmt(r.dp)}±${r.cip.toFixed(1)} ${r.sigP ? "moved" : "no change"}`));
L("Rows the site's test passes (sig) today:");
rows.filter((r) => r.sig).forEach(show);
L();
L("Rows only the same-instrument test passes:");
rows.filter((r) => !r.sig && r.sigP).forEach(show);
L();
L("Where the AES and the polls disagreed at the election by more than both margins (|polls-then − then| > √(ciThen² + polls-ci²)):");
rows.filter((r) => r.pThen != null && Math.abs(r.offset) > Math.sqrt(r.ciThen ** 2 + r.pCi ** 2)).forEach((r) => L(`  ${r.party.padEnd(4)} ${r.set.padEnd(10)} ${r.group.padEnd(16)} AES ${fmt(r.then)}±${r.ciThen.toFixed(1)}  polls ${fmt(r.pThen)}±${r.pCi.toFixed(1)}`));
