// Label-dodge simulator for the five Past-cycles charts, using REAL cycle data
// from the built bundle. Mirrors the x-aware dodge now in 08b413e7: labels are
// chained into x-collision components first, then the shipped cluster-centring
// runs inside each component only. Prints per-label deviation from ideals.
// Geometry: VB 1000x300, pad {l:46,r:20,t:18,b:34}, x-domain [-1.6, 37.6].

import { readFileSync } from "fs";

const src = readFileSync(new URL("./assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", import.meta.url), "utf8");
global.window = {};
eval(src);
const D = window.AUSPOL;

const VB = { W: 1000, H: 300 };
const pad = { l: 46, r: 20, t: 18, b: 34 };
const plotH = VB.H - pad.t - pad.b;
const XDOM = [-1.6, 37.6];
const sx = (v) => pad.l + ((v - XDOM[0]) / (XDOM[1] - XDOM[0])) * (VB.W - pad.l - pad.r);

const METRIC = {
  tpp: { key: "tpp", step: 5, onp: false },
  primary: { key: "primary", step: 5, onp: false },
  net: { key: "net", step: 20, onp: false },
  oppnet: { key: "oppnet", step: 10, onp: false },
  oppr: { key: "oppr", step: 5, onp: true },
};

function chartInput(name, withOnp) {
  const M = METRIC[name];
  const vals = [];
  for (const c of D.cycles) for (const v of c.raw[M.key] || []) if (v != null) vals.push(+v);
  if (M.onp) for (const c of D.cycles) for (const v of c.raw.onp || []) if (v != null) vals.push(+v);
  const d0 = Math.floor((Math.min(...vals) - M.step * 0.3) / M.step) * M.step;
  const d1 = Math.ceil((Math.max(...vals) + M.step * 0.3) / M.step) * M.step;
  const sy = (v) => pad.t + ((d1 - v) / (d1 - d0)) * plotH;
  const labs = D.cycles.map((c) => ({
    label: "’" + String(c.year).slice(2),
    xMonth: c.span,
    y: sy(c.raw[M.key][c.raw[M.key].length - 1]),
  }));
  if (M.onp && withOnp) {
    const cur = D.cycles[D.cycles.length - 1];
    const onpEnd = [...cur.raw.onp].reverse().find((v) => v != null);
    if (onpEnd != null) labs.push({ label: "ON ’25", xMonth: cur.span, y: sy(onpEnd) });
  }
  return labs.sort((a, b) => a.y - b.y);
}

const adv = (ch) => (ch >= "0" && ch <= "9" ? 0.55 : ch === " " ? 0.3 : ch === "’" ? 0.25 : 0.72);

// --- the exact algorithm shipped in 08b413e7 (x-aware) ---
function runDodge(inputLabs, cw) {
  const scale = cw / 1000;
  const refUnits = 10.5 / scale;
  const gap = refUnits * 1.15;
  const plotHeight = plotH;
  if ((inputLabs.length - 1) * gap > plotHeight * 0.55) return null; // all-or-nothing guard
  const labs = inputLabs.map((l) => ({
    text: l.label, ideal: l.y, y: l.y, x: sx(l.xMonth) + 7 / scale, w: 0,
  })).sort((a, b) => a.y - b.y);
  for (const l of labs) l.w = [...l.text].reduce((t, ch) => t + adv(ch), 0) * refUnits * 0.95;
  const xOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w;

  const comp = labs.map(() => -1);
  let nc = 0;
  for (let i = 0; i < labs.length; i++) {
    if (comp[i] >= 0) continue;
    const stack = [i]; comp[i] = nc;
    while (stack.length) {
      const a = stack.pop();
      for (let j = 0; j < labs.length; j++)
        if (comp[j] < 0 && xOverlap(labs[a], labs[j]) && Math.abs(labs[a].ideal - labs[j].ideal) < gap) {
          comp[j] = nc; stack.push(j);
        }
    }
    nc++;
  }
  const groups = [];
  for (let c = 0; c < nc; c++) groups.push(labs.filter((_, j) => comp[j] === c).sort((a, b) => a.y - b.y));

  const dodge = (g) => {
    const clusters = [];
    for (const l of g) {
      const top = clusters[clusters.length - 1];
      if (top && l.y - top[top.length - 1].y < gap) top.push(l);
      else clusters.push([l]);
    }
    for (const c of clusters) {
      const m = c.reduce((t, l) => t + l.y, 0) / c.length;
      c.forEach((l, j) => { l.y = m + (j - (c.length - 1) / 2) * gap; });
    }
  };
  const yLo = pad.t + gap * 0.4, yHi = VB.H - pad.b - gap * 0.4;
  const clampGroup = (g) => {
    const under = yLo - g[0].y;
    if (under > 0) for (const l of g) l.y = Math.min(l.y + under, yHi);
    const over = g[g.length - 1].y - yHi;
    if (over > 0) for (const l of g) l.y = Math.max(l.y - over, yLo);
  };
  const settle = () => {
    for (const g of groups) {
      g.sort((a, b) => a.y - b.y);
      dodge(g);
      for (let fold = 0; fold < 10; fold++) {
        let collided = false;
        for (let i = 1; i < g.length; i++)
          if (g[i].y - g[i - 1].y < gap - 0.01 && xOverlap(g[i], g[i - 1])) { collided = true; break; }
        if (!collided) break;
        dodge(g);
      }
      clampGroup(g);
    }
  };
  settle();
  for (let pass = 0; pass < labs.length; pass++) {
    let merged = false;
    outer: for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const hit = groups[i].some((a) => groups[j].some((b) => xOverlap(a, b) && Math.abs(a.y - b.y) < gap - 0.01));
        if (hit) { groups[j].push(...groups[i]); groups.splice(i, 1); merged = true; break outer; }
      }
    if (!merged) break;
    settle();
  }
  const all = groups.flat();
  // verification: no remaining visual collisions anywhere
  let collisions = 0;
  for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) {
    const a = all[i], b = all[j];
    if (xOverlap(a, b) && Math.abs(a.y - b.y) < gap - 0.01) collisions++;
  }
  return { scale, collisions, groups: groups.map((g) => g.map((l) => l.text)), labs: all.map((l) => ({ label: l.text, devPx: (l.y - l.ideal) * scale })) };
}

for (const cw of [660, 500, 400]) {
  console.log(`\n####### width ${cw}px #######`);
  for (const name of Object.keys(METRIC)) {
    for (const on of (METRIC[name].onp ? [false, true] : [false])) {
      const r = runDodge(chartInput(name, on), cw);
      const tag = name + (on ? " +ON" : "");
      if (!r) { console.log(`${tag}: labels dropped (guard)`); continue; }
      const worst = Math.max(...r.labs.map((l) => Math.abs(l.devPx)));
      const f = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);
      console.log(`${tag}: worst ${worst.toFixed(1)}px, collisions=${r.collisions}, groups=[${r.groups.map((g) => g.join(",")).join(" | ")}]`);
      if (cw === 660) for (const l of r.labs) console.log(`    ${l.label.padEnd(6)} ${f(l.devPx)}px`);
    }
  }
}
