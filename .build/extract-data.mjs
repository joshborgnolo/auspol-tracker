/* extract-data.mjs — ONE-TIME migration: lift every dataset out of the legacy
   auspol-polling.html and write it to data/polls.json, which is from now on the
   canonical source. Re-runnable (idempotent) but not part of the normal build:
   after the migration you edit data/polls.json directly and auspol-polling.html
   is frozen as a historical artefact.
   Run: node .build/extract-data.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = fs.readFileSync(path.join(ROOT, "auspol-polling.html"), "utf8");

/* The legacy scanner, used here for the last time. Walks an array literal by
   bracket depth, skipping strings and // comments. */
function arrLit(name) {
  const start = SRC.indexOf("const " + name + " = [");
  if (start < 0) throw new Error("array literal not found: " + name);
  let i = SRC.indexOf("[", start), depth = 0, inStr = null, end = -1;
  for (; i < SRC.length; i++) {
    const c = SRC[i];
    if (inStr) { if (c === "\\") i++; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && SRC[i + 1] === "/") { i = SRC.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  const text = SRC.slice(SRC.indexOf("[", start), end + 1);
  return (0, eval)("(" + text + ")");
}

const jsonText = SRC.slice(
  SRC.indexOf(">", SRC.indexOf('id="poll-data"')) + 1,
  SRC.indexOf("</script>", SRC.indexOf('id="poll-data"'))
);
const BLOCK = JSON.parse(jsonText);

/* ---- positional tuples -> named objects -------------------------------
   Every one of these was hand-edited weekly as a bare array, which is how a
   value ends up one slot to the left. Named fields end that class of bug. */
const ppm = arrLit("ppmData").map(([date, firm, alb, opp, oppName, han, extra]) =>
  ({ date, firm, alb, opp, oppName, han, extra: extra ?? null }));

// 7th slot (`wat`) is present in the legacy rows but consumed by nothing.
const approval = arrLit("approvalData").map(([date, firm, alb, opp, oppName, han, wat, detail]) =>
  ({ date, firm, alb, opp, oppName, han, detail: detail ?? null }));

const ppmHeadToHead = arrLit("PPM_H2_RAW").map(([key, alb, han]) => {
  const [date, firm] = key.split("|");
  return { date, firm, alb, han };
});

const altTpp = arrLit("altTppRaw").map(([date, firm, alpVsOnp_alp, lnpVsOnp_lnp]) =>
  ({ date, firm, alpVsOnp_alp, lnpVsOnp_lnp }));

const CYCLE_FIELDS = ["date", "firm", "lnp", "alp", "grn", "onp", "oth", "tpp_lnp", "tpp_alp"];
const toPoll = (r) => Object.fromEntries(r.map((v, i) => [CYCLE_FIELDS[i], v]));
const cyclePolls = {};
for (const y of [2013, 2016, 2019, 2022, 2025]) cyclePolls[y] = arrLit("raw" + y).map(toPoll);

const cycleApproval = {};
for (const [y, name] of [[2010, "approval2010Raw"], [2013, "approval2013Raw"], [2016, "approval2016Raw"],
                         [2019, "approval2019Raw"], [2022, "approvalAlb1Raw"]])
  cycleApproval[y] = arrLit(name).map(([date, firm, pmNet, oppNet, metric]) =>
    metric ? { date, firm, pmNet, oppNet, metric } : { date, firm, pmNet, oppNet });

const out = {
  $comment: "Canonical dataset for the auspol tracker. See polls.schema.json for field meanings. Edit this file to add a poll, then run: node .build/newtracker/build.mjs",
  meta: {
    migratedFrom: "auspol-polling.html",
    migratedOn: new Date().toISOString().slice(0, 10),
  },
  /* Which question a house asks about a leader. Was duplicated in gen-data.mjs
     (FAV_FIRMS) and auspol-polling.html (LEADER_NET_METRIC) — a fact about
     pollsters, so it lives with the data now, in one place. */
  metricRules: {
    favFirms: ["redbridge", "demosau", "freshwater", "spectre strategy"],
    overrides: { "resolve|han": { metric: "fav", before: "2026-07-06" } },
  },
  elections: BLOCK.elections,
  events: BLOCK.events,
  direction: BLOCK.direction || [],
  polls: BLOCK.polls,
  ppm, approval, ppmHeadToHead, altTpp,
  cyclePolls, cycleApproval,
};

const dest = path.join(ROOT, "data", "polls.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
const c = (o) => (Array.isArray(o) ? o.length : Object.values(o).reduce((s, v) => s + v.length, 0));
console.log(`wrote ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
console.log(`  polls ${c(out.polls)} · direction ${c(out.direction)} · ppm ${c(ppm)} · approval ${c(approval)}`);
console.log(`  ppmH2 ${c(ppmHeadToHead)} · altTpp ${c(altTpp)} · cyclePolls ${c(cyclePolls)} · cycleAppr ${c(cycleApproval)}`);
console.log(`  events ${c(out.events)} · elections ${c(out.elections)}`);
