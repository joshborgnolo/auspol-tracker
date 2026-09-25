// Add RedBridge/Accent's vote-softness table to the committed RedBridge/Accent
// rows in polls.json. Each report since March 2026 reprints the whole
// history (back to Nov 2024) in the wide layout parseFirmness reads, so the
// cached report text in .build/redbridge-src/ covers waves whose own report
// is not cached or predates the layout. The extractor fills new waves from
// their own report; this is the one-off for the rest. Dry-run by default;
// --apply writes.
//
// A history row is matched to a committed row through the same report's
// wave table (Table 2), which prints each wave's primaries under the same
// `Mon YYYY` label: the row whose Labor, Coalition, One Nation and Greens
// primaries equal the printed ones, or, failing that, the only row whose
// fieldwork ends in that month with each primary within a point (the older
// reports print the Coalition as four rounded parts, whose sum can land a
// point off the committed figure). Anything else is left unfilled and
// listed. Reports must agree on a wave's figures; a disagreement stops the
// run.
import { readFileSync, readdirSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

process.env.RB_LIB = "1";
const { parseFirmness, parseTable2 } = await import("./extract-redbridge.mjs");

const APPLY = process.argv.includes("--apply");
const SRC = ".build/redbridge-src";
const POLLSTER = "RedBridge/Accent";
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12 };
const PRIM = ["alp", "lnp", "onp", "grn"];

// newest report first, so a wave's primaries come from the latest print
// (the combined-Coalition layout where it exists)
const waveKey = (r) => (r ? r.year * 12 + r.month : -1);
const reports = readdirSync(SRC).filter((f) => f.endsWith(".txt"))
  .map((f) => { const txt = readFileSync(`${SRC}/${f}`, "utf8"); return { f, txt, t2: parseTable2(txt) }; })
  .sort((a, b) => waveKey(b.t2.wave) - waveKey(a.t2.wave));
const firm = new Map(), prim = new Map();
for (const { f, txt, t2 } of reports) {
  const fm = parseFirmness(txt);
  if (fm.error) { console.log(`  ${f}: ${fm.error} — not read`); continue; }
  for (const r of fm.rows) {
    const k = JSON.stringify(r.firmness);
    if (firm.has(r.label) && firm.get(r.label) !== k) {
      console.error(`reports disagree on ${r.label}: ${firm.get(r.label)} vs ${k} (${f})`);
      process.exit(2);
    }
    firm.set(r.label, k);
  }
  for (const r of t2.rows || []) if (!prim.has(r.label)) prim.set(r.label, r);
}

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const rows = D.polls.filter((p) => p.pollster === POLLSTER);
const filled = [], unmatched = [];
for (const [label, k] of firm) {
  const t = prim.get(label);
  const [mon, yr] = label.split(" ");
  const ym = `${yr}-${String(MON[mon]).padStart(2, "0")}`;
  const exact = t && rows.filter((p) => PRIM.every((q) => p[q] === t[q]));
  const inMonth = rows.filter((p) => p.date.slice(0, 7) === ym);
  const near = t && inMonth.length === 1 && PRIM.every((q) => Math.abs(inMonth[0][q] - t[q]) <= 1) ? inMonth : [];
  const hit = exact && exact.length === 1 ? exact[0] : near.length === 1 ? near[0] : null;
  if (!hit) { unmatched.push(label); continue; }
  const how = exact && exact.length === 1 ? "primaries" : "month, primaries ±1";
  if (hit.firmness) {
    if (JSON.stringify(hit.firmness) !== k) console.log(`  ${hit.date}: file firmness differs from ${label} — left as is`);
    continue;
  }
  // splice before "url", where the extractor puts it
  const es = Object.entries(hit), at = Object.keys(hit).indexOf("url");
  es.splice(at < 0 ? es.length : at, 0, ["firmness", JSON.parse(k)]);
  for (const key of Object.keys(hit)) delete hit[key];
  Object.assign(hit, Object.fromEntries(es));
  filled.push(`${label} → ${hit.date} (${how})`);
}

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`filled ${filled.length}:`);
filled.forEach((s) => console.log("  +", s));
console.log(`no committed row for ${unmatched.length}: ${unmatched.join(", ")}`);
if (APPLY && filled.length) {
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
