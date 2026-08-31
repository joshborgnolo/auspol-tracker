// Self-test for ./news24-infogram.mjs — fixtures are the six anonymously
// captured 2026-08-24 embeds (committed at .build/news24-src/ig-fixtures-2026-08-24/),
// with exact-figure assertions against the canon polls.json row for that wave:
// primaries 29/21/12/26/5/7, TPP 53/47, approval −24/−16, ppm 44/37,
// Alb–Hanson 52/37, ALP-v-ONP 56/44, sample-free (prose owns sample).
// Run from the repo root:  node .build/test-news24-infogram.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { infographicDataOf } from "./infogram.mjs";
import { n24IdsOf, n24WindowOf, parseN24Approvals, parseN24Ppm, parseN24Tpp,
  parseN24Crosstab, parseN24Horserace, n24InfogramFetch, n24Corroborate,
  n24Figures } from "./news24-infogram.mjs";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(DIR, ".build/news24-src/ig-fixtures-2026-08-24");
const fx = (id) => readFileSync(path.join(FIX, `ig-${id.replace("_/", "")}.html`), "utf8");
const dataOf = (id) => infographicDataOf(fx(id));

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${name}`);
};
const ok = (name, cond) => eq(name, !!cond, true);

// ---- id scraping (DOM + JSON-escape + entity variants, dedupe in order)
eq("n24IdsOf plain", n24IdsOf(`<div class="media embed-infogram infogram-embed" data-id="_/AbC123" data-type="interactive">`), ["_/AbC123"]);
eq("n24IdsOf json-escaped", n24IdsOf(`data-id=\\"_\\/XyZ789\\"`), ["_/XyZ789"]);
eq("n24IdsOf html entity", n24IdsOf(`data-id="_&#47;QwErTy"`), ["_/QwErTy"]);
eq("n24IdsOf dedupe order", n24IdsOf(`data-id="_/B" x data-id="_/A" y data-id="_/B"`), ["_/B", "_/A"]);
eq("n24IdsOf no live-project id", n24IdsOf(`data-id="8b461452-4d45"`), []);

// ---- window captions (all embeds repeat it — except the horserace, whose
// source line is a YEAR range "(2025 - 2026)" that must NOT parse as a window)
for (const id of ["_/1HmxLVdMCZuLu6przWpP", "_/jSJgw3l3groFHC28VREB", "_/KHPe2ut8KWwbhpNt9NFM",
  "_/TBlBtAE3k0f4YBE6MIpF", "_/YM46DvOTftyx9pNzV67y"])
  eq(`window ${id.slice(2, 8)}`, n24WindowOf(dataOf(id)), { start: "2026-08-18", end: "2026-08-24" });
eq("window horserace year-range immune", n24WindowOf(dataOf("_/pWKd54huH0REqno4nuue")), null);

// ---- approvals: positional, title order zipped to geometry order
{
  const a = parseN24Approvals(dataOf("_/1HmxLVdMCZuLu6przWpP"));
  eq("approvals pairs", a.pairs, {
    albanese: { app: 35, dis: 59, unc: 6 },
    taylor: { app: 33, dis: 49, unc: 18 },
  });
  const scrambled = parseN24Approvals({ title: "Leader support tracker N24P", elements: dataOf("_/1HmxLVdMCZuLu6przWpP").elements });
  ok("approvals title drift declines", scrambled.pairs === null && /unsafe/i.test(scrambled.why));
}

// ---- ppm: name-keyed tables
{
  const ppm = parseN24Ppm(dataOf("_/KHPe2ut8KWwbhpNt9NFM"));
  eq("ppm two tables", ppm.length, 2);
  const taylor = ppm.find((p) => /taylor/i.test(p.oppRaw));
  const hanson = ppm.find((p) => /hanson/i.test(p.oppRaw));
  eq("ppm albanese-taylor", [taylor.alb, taylor.dk, taylor.opp], [44, 19, 37]);
  eq("ppm albanese-hanson", [hanson.alb, hanson.dk, hanson.opp], [52, 11, 37]);
}

// ---- 2pp: structural blanks
eq("tpp pairs", parseN24Tpp(dataOf("_/jSJgw3l3groFHC28VREB")).tpp,
  { coalition: { alp: 53, lnp: 47 }, oneNation: { alp: 56, onp: 44 } });

// ---- crosstab: authoritative primaries
{
  const ct = parseN24Crosstab(dataOf("_/YM46DvOTftyx9pNzV67y"));
  eq("crosstab vi", ct.vi, { alp: 29, lnp: 21, onp: 26, grn: 12, ind: 5, oth: 7 });
  eq("crosstab oth decomposition", ct.detail, { other: 5, csa: 2 });
  // Σ100 gate: a tampered Total declines authority
  const tampered = JSON.parse(JSON.stringify(dataOf("_/YM46DvOTftyx9pNzV67y")));
  const ents = tampered.elements.content.content.entities;
  for (const e of Object.values(ents)) {
    if (e.type === "CHART" && e.props.chartData?.data?.[0]?.[0]?.[0]?.value === "Party") {
      e.props.chartData.data[0].find((r) => r[0].value === "Labor")[1].value = "5";
    }
  }
  const bad = parseN24Crosstab(tampered);
  ok("crosstab Σ tamper declines", bad.vi === null && /Σ=/.test(bad.why));
}

// ---- horserace: corroboration-only, Σ-guarded
{
  const hr = parseN24Horserace(dataOf("_/pWKd54huH0REqno4nuue"));
  eq("horserace bad columns", hr.bad, [
    { label: "Jan 8, 2026", sum: 102 },
    { label: "July 14, 2026", sum: 94 },
  ]);
  ok("horserace row count (16 dated + election − 2 bad)", hr.rows.length === 15);
  const latest = hr.rows.find((r) => r.date === "2026-08-24");
  eq("horserace latest", [latest.alp, latest.lnp, latest.onp, latest.grn, latest.indoth, latest.csa], [29, 21, 26, 12, 10, 2]);
  const canon = { alp: 29, lnp: 21, onp: 26, grn: 12, ind: 5, oth: 7 };
  eq("corroborate exact wave", n24Corroborate(hr.rows, "2026-08-24", canon), []);
  ok("corroborate catches drift", n24Corroborate(hr.rows, "2026-08-24", { ...canon, alp: 33 }).length === 1);
  const jun3 = { alp: 26, lnp: 20, onp: 29, grn: 12, ind: null, oth: 12 };
  eq("corroborate +1d label offset", n24Corroborate(hr.rows, "2026-06-02", jun3).filter((p) => !/ind/.test(p)), []);
}

// ---- full fetch+classify+assembly over the six fixtures
{
  const projects = await n24InfogramFetch(async (id) => fx(id),
    ["_/1HmxLVdMCZuLu6przWpP", "_/jSJgw3l3groFHC28VREB", "_/KHPe2ut8KWwbhpNt9NFM",
      "_/pWKd54huH0REqno4nuue", "_/TBlBtAE3k0f4YBE6MIpF", "_/YM46DvOTftyx9pNzV67y"]);
  eq("classified kinds", projects.map((p) => [p.state, p.kind ?? null]),
    [["ok", "approvals"], ["ok", "tpp"], ["ok", "ppm"], ["ok", "horserace"], ["ok", "unmodelled"], ["ok", "crosstab"]]);
  const fig = n24Figures(projects);
  eq("assembly window", fig.window, { start: "2026-08-18", end: "2026-08-24" });
  eq("assembly vi", fig.vi, { alp: 29, lnp: 21, onp: 26, grn: 12, ind: 5, oth: 7 });
  eq("assembly tpp", fig.tpp, { tpp_alp: 53, tpp_lnp: 47 });
  eq("assembly altTpp", fig.altTpp, { alpVsOnp_alp: 56, alpVsOnp_onp: 44 });
  eq("assembly approval", [fig.approval.alb.app, fig.approval.alb.dis, fig.approval.opp.app, fig.approval.opp.dis, fig.approval.oppName],
    [35, 59, 33, 49, "taylor"]);
  eq("assembly ppm tables", fig.ppm.map((p) => [p.alb, p.opp, p.oppRaw]).sort(),
    [[44, 37, "Angus Taylor"], [52, 37, "Pauline Hanson"]]);
  ok("assembly records horserace Σ notes", fig.problems.filter((p) => /sums to/.test(p)).length === 2);
}

// ---- network tail: the six current-wave embeds fetch anonymously (ids age
// out; structural assertions only)
try {
  const heads = await Promise.all(["_/YM46DvOTftyx9pNzV67y"].map(async (id) => {
    const r = await fetch(`https://e.infogram.com/${id}?src=embed`,
      { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36" } });
    return r.status;
  }));
  eq("embed anon fetch 200", heads[0], 200);
} catch (e) {
  console.log(`note: network tail skipped — ${e.message}`);
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS");
process.exit(fails ? 1 : 0);
