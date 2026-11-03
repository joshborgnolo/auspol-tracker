#!/usr/bin/env node
/* extract-bludgertrack.mjs: the 2022–25 term's poll table from Poll Bludger's BludgerTrack feed, kept in the repo.

   Source: https://www.pollbludger.net/fed2025/bludgertrack/xml/current.xml (the 2022–25 cycle's feed, still live on
   2026-11-03; the page that loads it is fed2025/bludgertrack/polldata.htm). Its <federal><table> holds every poll of
   the term, one <point> per poll and scope: fieldwork start/end, pollster, mode, sample, primaries
   (ALP/LNC/GRN/PHON, UND where the house printed undecided), the published 2PP (ALP2/LNC2) and a
   respondent-allocated one (ALPra/LNCra). Scope is NAT, a state (NSW…TAS), or a demographic group: gender, age
   (18-34/35-49/50-64/65+), education (No tertiary/TAFE/Tech/University), household income, work status, language
   at home, religion, housing tenure, and RedBridge's AEC region classes. The repo's own demographics store
   (data/demographics.json) starts after the 2025 election, so this is the only record we hold of the houses'
   group breakdowns before it. The leaders table and the trend charts are not kept.

   The values are copied as the feed prints them, apart from &amp; and empty cells (null). Nothing is normalised
   here: group-error.mjs drops undecided and works out One Nation and others.

   Usage (from the repo root):
     node .build/analysis/group-poll-error-2025/extract-bludgertrack.mjs [path/to/current.xml]
   With no path it fetches the live feed. Writes bludgertrack-2022-25.json beside this script. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = "https://www.pollbludger.net/fed2025/bludgertrack/xml/current.xml";
const OUT = path.join(HERE, "bludgertrack-2022-25.json");

const src = process.argv[2];
const xml = src ? fs.readFileSync(src, "utf8") : await (await fetch(URL)).text();
const rootDate = (xml.match(/<root date="([^"]+)"/) || [])[1] || null;
const fed = xml.slice(xml.indexOf("<federal>"), xml.indexOf("</federal>"));
const table = fed.slice(fed.indexOf("<table>"));
if (!rootDate || !table) throw new Error("extract-bludgertrack: feed shape changed (no <root date> or <federal><table>)");

const FIELDS = { ALP: "alp", LNC: "lnp", GRN: "grn", PHON: "onp", UND: "und", ALP2: "alp2", LNC2: "lnp2", ALPra: "alpRa", LNCra: "lnpRa", UNDra: "undRa" };
const rows = [];
for (const [, attrs, body] of table.matchAll(/<point ([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/point>)/g)) {
  const a = Object.fromEntries([...attrs.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&amp;/g, "&")]));
  const r = { start: a.start, end: a.end, pollster: a.pollster, mode: a.mode || null, scope: a.scope, n: a.sample ? +a.sample : null };
  for (const [tag, key] of Object.entries(FIELDS)) {
    const m = (body || "").match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    r[key] = m && m[1] !== "" ? +m[1] : null;
  }
  rows.push(r);
}
if (rows.length < 1500) throw new Error(`extract-bludgertrack: only ${rows.length} rows – feed shape changed?`);

const out = {
  _about: "Poll Bludger's BludgerTrack poll table for the 2022–25 term (every poll and scope: national, state, demographic group), copied from the feed by extract-bludgertrack.mjs. Values as printed; null = empty cell. alp/lnp/grn/onp/und = primaries (und only where the house printed undecided), alp2/lnp2 = published 2PP, alpRa/lnpRa/undRa = respondent-allocated 2PP.",
  source: URL,
  feedDate: rootDate,
  fetched: new Date().toISOString().slice(0, 10),
  rows,
};
fs.writeFileSync(OUT, "{\n" + Object.entries(out).filter(([k]) => k !== "rows").map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n") + '\n "rows": [\n' + rows.map((r) => "  " + JSON.stringify(r)).join(",\n") + "\n ]\n}\n");
const by = {};
for (const r of rows) by[r.pollster] = (by[r.pollster] || 0) + 1;
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${rows.length} rows, feed dated ${rootDate}`);
console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
