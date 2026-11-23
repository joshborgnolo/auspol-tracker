/* Pins the primary vote by group through the past terms (gen-data §7gm,
   group-span.mjs; shipped as .build/newtracker/assets/group-history.json):
     - every term meets the next on polling day: a group's closing figure
       equals the next term's opening one (the gap is one walk through the
       terms and both sides read the same draws there), on every party the
       two terms both draw apart;
     - where the count cuts the group (states from 1993, AEC seat types from
       1996), the polling-day figure is the count: the all-voters count the
       vote charts draw (data/polls.json, the rings) moved by the group's
       counted gap from the nation (the AEC results, like with like – the two
       bucket a few parties differently: the Greens WA in 1996–98, One Nation
       inside others 2004–13), within 0.25, its band nearly shut;
     - the last past term ends exactly where this term's line starts (the
       demographics payload's `el`, the model's polling-day estimate);
     - shares add to about 100 and bands stay in range;
     - data/group-counts.json is current with map/data's results.
   Run after a build: node .build/test-group-history.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { nestCats, nestCoords, nestShares } from "./newtracker/group-span.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NT = path.join(ROOT, ".build", "newtracker", "assets");
const H = JSON.parse(fs.readFileSync(path.join(NT, "group-history.json"), "utf8"));
assert.ok(H && Array.isArray(H.terms) && H.terms.length >= 10, "the group history carries the past terms");
const CNT = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "group-counts.json"), "utf8"));
const before = fs.readFileSync(path.join(ROOT, "data", "group-counts.json"), "utf8");
execFileSync(process.execPath, [path.join(ROOT, ".build", "build-group-counts.mjs")], { stdio: "pipe" });
assert.equal(fs.readFileSync(path.join(ROOT, "data", "group-counts.json"), "utf8"), before, "data/group-counts.json is stale: run node .build/build-group-counts.mjs");
const KEYS = ["alp", "lnp", "onp", "grn", "oth"];
const dataSrc = fs.readFileSync(path.join(NT, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
const grab = (name) => { const m = dataSrc.match(new RegExp("const " + name + " = (.*);\\n")); return m ? JSON.parse(m[1]) : null; };
const demo = grab("demographics"), stateEl = grab("demoStateElection"), locEl = grab("demoLocElection");
const ELECTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).elections;
const natCountOf = (date) => {
  const yr = date.slice(0, 4);
  if (yr === "2025") return stateEl.groups.Nat;
  return CNT.elections[yr] ? CNT.elections[yr].Nat.pct : null;
};
/* the end the model should draw: the polls.json count in the term's lanes,
   moved by the counted gap at the lanes' level */
const asObj = (a) => Object.fromEntries(KEYS.map((k, i) => [k, a[i]]));
const fold = (o, lanes) => ({ alp: o.alp, lnp: o.lnp, grn: lanes.includes("grn") ? o.grn : null, onp: lanes.includes("onp") ? o.onp : null,
  oth: (o.oth || 0) + (lanes.includes("onp") ? 0 : o.onp || 0) + (lanes.includes("grn") ? 0 : o.grn || 0) });
const lvl = (lanes) => 2 + (lanes.includes("grn") ? 1 : 0) + (lanes.includes("onp") ? 1 : 0);
const wantEnd = (grp, nat, polls, lanes) => {
  const lev = lvl(lanes);
  const g = nestCoords(nestCats(fold(asObj(grp), lanes), lev, 0.05)), n = nestCoords(nestCats(fold(asObj(nat), lanes), lev, 0.05));
  /* the vote charts' count: the lanes as printed, others the remainder */
  const pl = { alp: polls.alp, lnp: polls.lnp, grn: lanes.includes("grn") ? polls.grn || 0 : 0, onp: lanes.includes("onp") ? polls.onp || 0 : 0 };
  pl.oth = 100 - pl.alp - pl.lnp - pl.grn - pl.onp;
  const p = nestCoords(nestCats(pl, lev, 0.005));
  const sh = nestShares(p.map((v, k) => v + g[k] - n[k]), lev).map((v) => 100 * v);
  /* back to the payload's key order (alp, lnp, onp, grn, oth) */
  const L = ["alp", "lnp", ...(lev >= 3 ? ["grn"] : []), ...(lev >= 4 ? ["onp"] : []), "oth"];
  return KEYS.map((k) => (L.includes(k) ? sh[L.indexOf(k)] : null));
};

const rowOK = (v, id) => {
  const sh = v.slice(0, 5), ci = v.slice(5, 10);
  const sum = sh.reduce((a, x) => a + (x || 0), 0);
  assert.ok(Math.abs(sum - 100) <= 0.6, `${id}: shares add to ${sum.toFixed(1)}`);
  sh.forEach((x, i) => { if (x != null) { assert.ok(x >= 0 && x <= 90, `${id}: a share in range`); assert.ok(ci[i] >= 0 && ci[i] < 25, `${id}: a band in range (${ci[i]})`); } });
};
const countOf = (setId, group, date) => {
  const yr = date.slice(0, 4);
  if (yr === "2025") { const E = setId === "state" ? stateEl : locEl; return E && E.groups[group] ? E.groups[group] : null; }
  const e = CNT.elections[yr];
  return e && e[setId] && e[setId][group] ? e[setId][group].pct : null;
};
let lines = 0, joins = 0, counts = 0;
const byGroup = new Map();
for (const t of H.terms) {
  assert.ok(t.from < t.to && t.a < t.b && Array.isArray(t.lanes), `term ${t.year}: election to election`);
  for (const [setId, gs] of Object.entries(t.sets)) for (const [g, c] of Object.entries(gs)) {
    lines++;
    const id = `term ${t.year} ${setId}|${g}`;
    for (const r of c.months) { assert.ok(r[0] > t.a && r[0] < t.b, `${id}: month ${r[0]} inside the term`); rowOK(r.slice(1), `${id} ${r[0]}`); }
    [c.open, c.close].forEach((e, j) => {
      if (!e) return;
      rowOK(e, `${id} ${j ? "close" : "open"}`);
      if (!c.counted[j]) return;
      const date = j ? t.to : t.from, cnt = countOf(setId, g, date), nat = natCountOf(date);
      const pe = ELECTIONS["e" + date.slice(0, 4)];
      assert.ok(cnt && nat && pe, `${id}: a counted end has a count`);
      counts++;
      const want = wantEnd(cnt, nat, pe, t.lanes);
      KEYS.forEach((k, i) => {
        if (e[i] == null) return;
        assert.ok(Math.abs(e[i] - want[i]) <= 0.25, `${id} ${j ? "close" : "open"} ${k}: ${e[i]} on the count ${want[i] && want[i].toFixed(2)}`);
        assert.ok(e[5 + i] <= 0.4, `${id} ${k}: a counted end's band nearly shut (${e[5 + i]})`);
      });
    });
    (byGroup.get(setId + "|" + g) || byGroup.set(setId + "|" + g, []).get(setId + "|" + g)).push({ t, c });
  }
}
/* consecutive terms meet */
for (const [key, arr] of byGroup) {
  arr.sort((p, q) => p.t.a - q.t.a);
  for (let i = 1; i < arr.length; i++) {
    const A = arr[i - 1], B = arr[i];
    if (Math.abs(A.t.b - B.t.a) > 1e-6 || !A.c.close || !B.c.open) continue;
    joins++;
    KEYS.forEach((k, q) => {
      if (k === "oth" || A.c.close[q] == null || B.c.open[q] == null) return;
      assert.ok(Math.abs(A.c.close[q] - B.c.open[q]) <= 0.1 + 1e-9, `${key} ${A.t.year}|${B.t.year} ${k}: ${A.c.close[q]} → ${B.c.open[q]}`);
    });
    if (A.t.lanes.join() === B.t.lanes.join()) assert.ok(Math.abs(A.c.close[4] - B.c.open[4]) <= 0.1 + 1e-9, `${key} ${A.t.year}|${B.t.year} others meet`);
  }
}
/* the last past term ends where this term starts */
let curJoins = 0;
const last = H.terms[H.terms.length - 1];
for (const tab of demo.tabs) for (const st of tab.sets) for (const g of st.groups) {
  const c = last.sets[st.id] && last.sets[st.id][g.label];
  if (!c || !c.close || !g.el) continue;
  curJoins++;
  KEYS.forEach((k, i) => assert.ok(Math.abs(c.close[i] - g.el[i]) <= 0.1 + 1e-9, `${st.id}|${g.label} 2025 ${k}: past term ends ${c.close[i]}, this term starts ${g.el[i]}`));
}
assert.ok(curJoins >= 25, `the 2025 join checked for most groups (${curJoins})`);
assert.ok(counts >= 150, `counted polling days checked (${counts})`);
console.log(`PASS: group history – ${H.terms.length} terms, ${lines} group lines, ${joins} term joins, ${counts} counted polling days, ${curJoins} groups joined to this term`);
