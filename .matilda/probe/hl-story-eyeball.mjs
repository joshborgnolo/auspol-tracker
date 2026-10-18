/* eyeball the RdHouseLean head/dek stories per measure against the built
   bundle's houseLean - the shipped generator itself (menu-lines.js
   AP.leanStory, run on the dataset as the page runs it), no mirror */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const dir = ".build/newtracker/assets";
const win = {};
const ctx = vm.createContext({ window: win, React: {}, console });
win.window = win;
for (const f of [fs.readdirSync(dir).find((x) => x.startsWith("9f09dca2") && x.endsWith(".js")), "ed2260de-5b11-4bd5-8a8d-a391156c05ee.js", "menu-lines.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f });
}
const AP = win.AP, D = win.AUSPOL;

const story = (view, onM, pub) => {
  const o = AP.leanStory(view, onM, pub);
  const rows = AP.leanRows(AP.leanKey(view, onM, pub));
  return { ...o, leans: rows.map((r) => `${r.h} ${r.v > 0 ? "+" : ""}${r.v.toFixed(1)}`).join(" · ") };
};

/* synthetic edge sets over the same generator: a fresh houseLean object
   each time, so the split pairing (derived from onp less lnp) re-derives */
const synth = (name, vals, measure = "lnp") => {
  const one = (v) => Object.fromEntries(Object.entries(v).map(([h, x]) => [h, [{ ym: "2026-10", v: x }]]));
  D.houseLean = measure === "split"
    ? { ...D.houseLean, onp: one(vals), lnp: one(Object.fromEntries(Object.keys(vals).map((h) => [h, 0]))) }
    : { ...D.houseLean, [measure]: one(vals) };
  const o = story(measure, false, false);
  console.log(`\n## ${name}\n  ${o.head}\n  ${o.dek}`);
};

for (const k of ["tpp", "split", "alp", "lnp", "onp", "grn", "oth"]) {
  const o = story(k, false, false);
  console.log(`## ${k}${k === "tpp" ? " (implied, Labor v Coalition)" : ""}\n  ${o.head}\n  ${o.dek}\n  [${o.leans}]`);
  if (k === "tpp") {
    for (const [onM, pub, lab] of [[true, false, "implied, Labor v ON"], [false, true, "published, Lab/Coal"], [true, true, "published, Lab/ON"]]) {
      const p = story("tpp", onM, pub);
      console.log(`## tpp ${lab}\n  ${p.head}\n  ${p.dek}`);
    }
  }
}
synth("tie at top, same way", { A: 1.2, B: 1.2, C: 0.4, D: -0.3 });
synth("tie at top, a tenth apart", { A: 1.3, B: 1.2, C: 0.4, D: -0.3 });
synth("leader + pair inside a tenth, second pair tied below", { A: 1.3, B: 1.2, C: 0.8, D: 0.8, E: -0.9 });
synth("tie at top, THREE", { A: 0.9, B: 0.9, C: 0.9, D: 0.2, E: -0.8 });
synth("equal-opposite outliers", { A: 1.4, B: -1.4, C: 0.2 });
synth("well clear", { A: 2.6, B: 0.5, C: -0.4, D: 0.1 });
synth("all same lean", { A: 0.7, B: 0.7 });
synth("all level", { A: 0.0, B: 0.02, C: -0.04 });
synth("single house off", { A: 1.1, B: 0.0, C: 0.0 });
synth("split dir, negative outlier", { A: -2.6, B: 0.4, C: 0.3, D: -0.2 }, "split");
