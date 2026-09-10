#!/usr/bin/env node
/* refresh-bonham-additional-aeforecasts.mjs — mirror the federal poll database
   of d-j-hirst/aus-polling-analyser (the data behind https://www.aeforecasts.com)
   VERBATIM into data/bonham-additional-aeforecasts.csv.

     node .build/refresh-bonham-additional-aeforecasts.mjs           # fetch live
     node .build/refresh-bonham-additional-aeforecasts.mjs --offline # rebuild from cache

   Upstream table: analysis/Data/poll-data-fed.csv on the master branch
   (3,997 rows, 1943→, "MidDate,Firm,Brand,@TPP,...,GLApp,GLDis,Comments";
   cell "##"/"#N/A" markers kept verbatim — it is a REFERENCE COPY, not a
   normalised layer). The fetched bytes are cached in
   .build/aeforecasts-src/ so the commit carries bytes that were actually seen,
   and data/bonham-additional-aeforecasts.csv is byte-identical to what was
   fetched.

   This script does NOT touch polls.json or the build — that folding is
   .build/assimilate-bonham-additional-aeforecasts.mjs's job. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC_DIR = path.join(HERE, "aeforecasts-src");
const CACHE = path.join(SRC_DIR, "poll-data-fed.csv");
const OUT = path.join(ROOT, "data", "bonham-additional-aeforecasts.csv");
const URL =
  "https://raw.githubusercontent.com/d-j-hirst/aus-polling-analyser/master/analysis/Data/poll-data-fed.csv";
const OFFLINE = process.argv.includes("--offline");

async function main() {
  let body;
  if (OFFLINE) {
    body = fs.readFileSync(CACHE);
  } else {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`fetch ${URL} -> ${res.status}`);
    body = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(SRC_DIR, { recursive: true });
    fs.writeFileSync(CACHE, body);
  }
  fs.writeFileSync(OUT, body);

  const lines = body.toString("utf8").trim().split("\n");
  const dates = lines.slice(1).map((l) => l.split(",")[0]).filter((d) => /^\d{4}/.test(d)).sort();
  const sha = crypto.createHash("sha256").update(body).digest("hex").slice(0, 12);
  console.log(
    `${outRel(OUT)} <- ${outRel(CACHE)}\n` +
      `rows ${lines.length - 1} · span ${dates[0]}..${dates[dates.length - 1]} · sha256 ${sha} · bytes ${body.length}`
  );
}
const outRel = (p) => path.relative(ROOT, p);

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
