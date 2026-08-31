// Self-test for ./infogram.mjs — dated fixtures in .build/newspoll-src/ give
// the exact-figure assertions (2026-08-28 wave: hand-verified against the
// canonical rows at introduction, 2026-08-31); the live fixtures pin the feed
// shapes. Run from the repo root:
//   node .build/test-infogram.mjs
// Network-dependent tail (rungs against the live project) degrades to
// structural assertions only, since live figures change every wave.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { igDate, igWindow, infographicDataOf, parsePrimary, parseTpp,
  parseBetterPm, parseNetsat, parseStatic, attachTarget, infogramLive,
  infogramStatic } from "./infogram.mjs";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fx = (p) => readFileSync(path.join(DIR, ".build/newspoll-src", p), "utf8");
let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${name}`);
};
const ok = (name, cond) => eq(name, !!cond, true);

// ---- date anchors (pure)
eq("igDate with year", igDate("Aug 30, 2026"), "2026-08-30");
eq("igDate anchored same year", igDate("August 30", "2026-09-01"), "2026-08-30");
eq("igDate year rollback", igDate("Dec 28", "2026-01-02"), "2025-12-28");
eq("igWindow", igWindow("August 24-28", "2026-12-31"), { start: "2026-08-24", end: "2026-08-28" });

// ---- live feed fixtures (shape + exact 2026-08-30 values)
const primary = parsePrimary(JSON.parse(fx("infogram-live-primary-2026-08-30.json")).data[0]);
eq("primary fixture", [primary.alp, primary.lnp, primary.grn, primary.onp, primary.ind], [29, 19, 13, 30, 9]);
eq("primary label", primary.label, "August 30");
const netsat = parseNetsat(JSON.parse(fx("infogram-live-netsat-2026-08-30.json")).data[0]);
ok("netsat length sane", netsat.length >= 55);
eq("netsat first row", [netsat[0].iso, netsat[0].pm, netsat[0].dutton], ["2022-07-31", 35, -4]);
eq("netsat wave row", [netsat.at(-1).iso, netsat.at(-1).pm, netsat.at(-1).taylor], ["2026-08-30", -21, -17]);
eq("netsat pre-tenure nulls", [netsat[0].ley, netsat[0].taylor], [null, null]);

// parseTpp on the documented N/A and a resumed shape
eq("tpp N/A", (() => { const t = parseTpp([["DATE", "March 1"], ["ALP", "N/A"], ["Coalition", "N/A"]]); return [t.tpp_alp, t.tpp_lnp, t.resumed]; })(), [null, null, false]);
eq("tpp resumed", (() => { const t = parseTpp([["DATE", "March 1"], ["ALP", "53"], ["Coalition", "47"]]); return [t.tpp_alp, t.tpp_lnp, t.resumed]; })(), [53, 47, true]);

// parseBetterPm on the documented shape
eq("betterpm shape", (() => { const b = parseBetterPm([["Name", "Anthony Albanese", "Uncommitted", "Angus Taylor"], ["%", "44%", "21%", "35%"]]); return [b.ppmA, b.ppmO, b.ppmUnc, b.oppName]; })(), [44, 35, 21, "Angus Taylor"]);

// ---- static embed fixture (2026-08-28 wave, project "A TAD-2383 Newspoll Day 2")
const st = parseStatic(infographicDataOf(fx("infogram-static-oracle-2026-08-28.html")));
ok("static fixture not-live", !st.live);
eq("hanson latest column", [st.hanson.hanApp, st.hanson.hanDis], [47, 48]);
eq("hanson fieldwork label", st.hanson.fieldworkLabel, "August 24-28");
eq("ranked three-way", [st.ranked.ppm3A, st.ranked.ppm3O, st.ranked.ppm3H], [46, 23, 31]);
eq("ranked OL identity", st.ranked.oppName, "Angus Taylor");
eq("distributed pair", [st.distributed.alb, st.distributed.han, st.distributed.isAlbHan], [56, 44, true]);

// ---- attachTarget
const DAY = 86400000;
const merge = (m) => (d) => m[d];
eq("attach latest in window", attachTarget(["2026-08-07", "2026-08-28"], "2026-08-30", 5, 29, merge({ "2026-08-07": { alp: 30 }, "2026-08-28": { alp: 29 } }), DAY), "2026-08-28");
eq("attach alb disagreement rejects", attachTarget(["2026-08-28"], "2026-08-30", 5, 35, merge({ "2026-08-28": { alp: 29 } }), DAY), null);
eq("attach >5d wave excluded", attachTarget(["2026-08-20"], "2026-08-30", 5, 29, merge({ "2026-08-20": { alp: 29 } }), DAY), null);
eq("attach prose-without-alp ok", attachTarget(["2026-08-28"], "2026-08-30", 5, 29, merge({ "2026-08-28": {} }), DAY), "2026-08-28");
eq("attach chart-without-alp ok", attachTarget(["2026-08-28"], "2026-08-30", 5, null, merge({ "2026-08-28": { alp: 29 } }), DAY), "2026-08-28");

// ---- live network tail (structural only; figures move every wave)
try {
  const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36" };
  const fetchText = async (url) => {
    const r = await fetch(url, { headers: UA });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { url: r.url ?? url, text: await r.text() };
  };
  const A = await infogramLive(fetchText, "2026-08-01");
  ok("rung A state ok", A.state === "ok");
  ok("rung A primaries shape", [A.figs.alp, A.figs.lnp, A.figs.grn, A.figs.onp, A.figs.ind].every((v) => typeof v === "number"));
  ok("rung A primaries Σ~100", Math.abs([A.figs.alp, A.figs.lnp, A.figs.grn, A.figs.onp, A.figs.ind].reduce((a, b) => a + b, 0) - 100) <= 5);
  ok("rung A pubIso parses", /^\d{4}-\d{2}-\d{2}$/.test(A.pubIso));
  const stale = await infogramLive(fetchText, "2999-01-01");
  ok("staleness detected", stale.state === "stale");
  const S = await infogramStatic(fetchText, ["8b461452-4d45-46fc-8d8f-d1c761a4932e"]);
  ok("static rung resolves (ok or live-skip as the project evolves)", ["ok", "live-skip"].includes(S[0]?.state));
} catch (e) {
  console.log(`note: network tail skipped — ${e.message}`);
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS");
process.exit(fails ? 1 : 0);
