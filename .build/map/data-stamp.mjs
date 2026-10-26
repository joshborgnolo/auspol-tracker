/* data-stamp.mjs – each Election map data file's content hash, stamped into map.js.

   The data files keep their names (map/data/res-2025.json …) and Pages serves them with a ten-minute
   cache, while map.js itself is fetched by a hashed URL. A release that changes a file's shape could
   pair the new script with a browser's cached older copy and draw nothing (the Senate's floor,
   2026-10-26: the new script read a field the cached file didn't have). So assemble.mjs writes every
   tracked data file's hash into map.js, where getJSON asks for `<file>?v=<hash>`: a script only ever
   reads the data it shipped with. Rebuilding a data file changes its hash, so re-run
   node .build/map/assemble.mjs after it (test-map-page fails until you do). */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const TOKEN = "/*@data-stamps*/{}";
// the tracked JSON files only: a session's untracked build output must not change what map.js says
export function dataStamps(root) {
  let files;
  try { files = execFileSync("git", ["ls-files", "map/data/*.json"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean); }
  catch { files = fs.readdirSync(path.join(root, "map/data")).filter((f) => f.endsWith(".json")).map((f) => "map/data/" + f); }
  const out = {};
  for (const f of files.filter((f) => path.dirname(f) === "map/data").sort()) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) out[path.basename(f)] = crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex").slice(0, 8);
  }
  return out;
}
export function stampData(js, stamps) {
  if (!js.includes(TOKEN)) throw new Error(`map.js has no ${TOKEN} to stamp (app-1-base.js)`);
  return js.replace(TOKEN, `/*@data-stamps*/${JSON.stringify(stamps)}`);
}

/* each election's and each Senate's eyebrow facts (the date, seats and polling places the meta
   line names), stamped into map.js the same way: the eyebrow holds the height of its longest line
   (holdEyebrow, app-6-ui.js) before the reader has loaded any election but the first, and a
   stand-in line can only guess — too long, the floor leaves a blank line for good; too short, a
   walk still moves the map */
export const META_TOKEN = "/*@meta-facts*/{}";
export function metaFacts(root) {
  const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(root, "map/data", f), "utf8")); } catch { return null; } };
  const house = {}, senate = {};
  for (const f of fs.readdirSync(path.join(root, "map/data")).sort()) {
    let m = f.match(/^res-(\w+)\.json$/);
    if (m) {
      const r = read(f);
      if (r) house[m[1]] = [r.date, r.divs.length, r.booths ? r.booths.n.length : 0];
      continue;
    }
    m = f.match(/^senate-(\d{4}|now)\.json$/);
    if (m) { const r = read(f); if (r) senate[m[1]] = [r.asOf, r.senators.length]; }
  }
  const now = read("data-now.json");
  // Now is the 2025 House with its changes since
  if (now && house["2025"]) house.now = [now.asOf, house["2025"][1], house["2025"][2]];
  return { house, senate };
}
export function stampMeta(js, facts) {
  if (!js.includes(META_TOKEN)) throw new Error(`map.js has no ${META_TOKEN} to stamp (app-6-ui.js)`);
  return js.replace(META_TOKEN, `/*@meta-facts*/${JSON.stringify(facts)}`);
}
