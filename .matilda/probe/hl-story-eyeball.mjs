/* eyeball the RdHouseLean head/dek stories per measure against the built
   bundle's houseLean (mirror of the rd-allpolls.jsx generator) */
import fs from "node:fs";
import path from "node:path";

const dir = ".build/newtracker/assets";
const dataFile = fs.readdirSync(dir).find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
let src = fs.readFileSync(path.join(dir, dataFile), "utf8");
const grab = (name) => {
  const m = src.match(new RegExp("const " + name + " = (\\{.*?\\}|\\[.*?\\});\\n", "ms"));
  if (!m) throw new Error("no " + name);
  return JSON.parse(m[1]);
};
const HL0 = grab("houseLean"), HE = grab("houseEffects");

/* the page's split series */
const HL = { ...HL0, split: Object.fromEntries(Object.keys(HL0.onp || {}).filter((h) => (HL0.lnp || {})[h]).map((h) => {
  const co = Object.fromEntries(HL0.lnp[h].map((d) => [d.ym, d.v]));
  return [h, HL0.onp[h].filter((d) => co[d.ym] != null).map((d) => ({ ym: d.ym, v: Math.round((d.v - co[d.ym]) * 10) / 10 }))];
})) };

const rowsOf = (k) => Object.keys(HL[k] || {}).map((h) => {
  const s = HL[k][h] || [];
  return { h, s, v: s.length ? s[s.length - 1].v : 0 };
}).filter((r) => r.s.length);

const hlWords = (id, onM) => {
  if (id === "tpp") {
    const rival = onM ? "One Nation" : "the Coalition";
    return { hi: (pl) => `lean${pl ? "" : "s"} furthest to Labor`,
      lo: (pl) => `lean${pl ? "" : "s"} furthest to ${rival}` };
  }
  if (id === "split") return { hi: (pl) => `read${pl ? "" : "s"} One Nation widest against the Coalition`,
    lo: (pl) => `read${pl ? "" : "s"} One Nation narrowest against the Coalition` };
  const whose = { alp: "Labor’s", lnp: "the Coalition’s", onp: "One Nation’s", grn: "the Greens’", oth: "the others’" }[id];
  return { hi: (pl) => `read${pl ? "" : "s"} ${whose} vote highest`,
    lo: (pl) => `read${pl ? "" : "s"} ${whose} vote lowest` };
};
const hlJoin = (ns) => ns.length > 2 ? ns.slice(0, -1).join(", ") + " and " + ns[ns.length - 1] : ns.join(" and ");

const story = (key, onM) => {
  let head = null, dek = null;
  const hsr = rowsOf(key).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).filter((r) => Math.abs(r.v) >= 0.05);
  if (hsr.length) {
    const isTpp = ["imp", "onimp", "tpp", "onpub"].includes(key);
    const words = hlWords(isTpp ? "tpp" : key, onM);
    const tail = " The averages take each lean out before the polls are combined.";
    const fmtPt = (v) => `${v.toFixed(1)} point${v.toFixed(1) === "1.0" ? "" : "s"}`;
    const sgn = hsr[0].v > 0;
    const tied = hsr.filter((r) => (r.v > 0) === sgn && Math.abs(r.v) >= Math.abs(hsr[0].v) - 0.05);
    const next = hsr.filter((r) => !tied.includes(r));
    const pl = tied.length > 1, topV = Math.abs(hsr[0].v);
    head = `${hlJoin(tied.map((r) => r.h))} ${(sgn ? words.hi : words.lo)(pl)}, and ${topV <= 1 ? "only " : ""}by ${fmtPt(topV)}`;
    if (!next.length) {
      dek = "No other pollster leans measurably either way." + tail;
    } else {
      const nextMax = Math.abs(next[0].v);
      const nextTied = next.filter((r) => Math.abs(r.v) >= nextMax - 0.05);
      dek = `${hlJoin(nextTied.map((r) => r.h))} ${nextTied.length > 1 ? "are" : "is"} next, ${fmtPt(nextMax)} off`
        + (next.length > nextTied.length ? "; no other pollster is further out" : "")
        + `.${topV >= 1 && nextMax <= topV / 2 ? ` ${pl ? "They are" : "It is"} well clear of the pack.` : ""}${tail}`;
    }
  } else if (rowsOf(key).length) {
    head = "No pollster leans away from the pack here";
    dek = "Every pollster sits level with the pollsters polling beside it. The averages take out any lean that builds up.";
  }
  return { head, dek, leans: rowsOf(key).map((r) => `${r.h} ${r.v > 0 ? "+" : ""}${r.v.toFixed(1)}`).join(" · ") };
};

/* synthetic edge sets over the same generator */
const synth = (name, vals, measure = "lnp") => {
  HL[measure] = Object.fromEntries(Object.entries(vals).map(([h, v]) => [h, [{ ym: "2026-10", v }]]));
  const o = story(measure, false);
  console.log(`\n## ${name}\n  ${o.head}\n  ${o.dek}`);
};

for (const k of ["tpp", "split", "alp", "lnp", "onp", "grn", "oth"]) {
  const o = story(k === "tpp" ? "imp" : k, false);
  console.log(`## ${k}${k === "tpp" ? " (implied, Labor v Coalition)" : ""}\n  ${o.head}\n  ${o.dek}\n  [${o.leans}]`);
  if (k === "tpp") {
    for (const [kk, lab] of [["onimp", "implied, Labor v ON"], ["tpp", "published, Lab/Coal"], ["onpub", "published, Lab/ON"]]) {
      const p = story(kk, kk.startsWith("on"));
      console.log(`## tpp ${lab}\n  ${p.head}\n  ${p.dek}`);
    }
  }
}
synth("tie at top, same way", { A: 1.2, B: 1.2, C: 0.4, D: -0.3 });
synth("tie at top, THREE", { A: 0.9, B: 0.9, C: 0.9, D: 0.2, E: -0.8 });
synth("equal-opposite outliers", { A: 1.4, B: -1.4, C: 0.2 });
synth("well clear", { A: 2.6, B: 0.5, C: -0.4, D: 0.1 });
synth("all same lean", { A: 0.7, B: 0.7 });
synth("all level", { A: 0.0, B: 0.02, C: -0.04 });
synth("single house off", { A: 1.1, B: 0.0, C: 0.0 });
synth("split dir, negative outlier", { A: -2.6, B: 0.4, C: 0.3, D: -0.2 }, "split");
