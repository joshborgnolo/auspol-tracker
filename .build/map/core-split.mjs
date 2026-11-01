/* core-split.mjs – each Election map results file without its polling places'
   census lanes: map/data/core-<frame>.json, written beside res-<frame>.json by
   assemble.mjs (2026-11-01, the /map/ speed pass).

   The lanes (each polling place's People shares: demo, cob, rel, ten, anc,
   and the age and income lanes) are about 60% of a results file, gzipped
   (2025: 1.0MB of 1.7MB), and only two things read them: the Census lens's
   People measures at polling-place level, and an opened polling place's
   neighbourhood facts. So a frame loads its core file first (a first visit
   to an election downloads ~40% of what it did), and the full res file comes
   only when those lanes are wanted (loadPpl, app-1-base.js), merged into the
   frame's booths by index. The core file names the lanes it lacks
   (pplLanes); a frame whose file had none to strip carries no pplLanes and
   never asks for its res file.

   The res files stay the builders' source of truth, untouched; the core
   files are derived and committed with them. Re-run node .build/map/assemble.mjs
   after rebuilding any res file (test-map-page fails until you do). */
import fs from "node:fs";
import path from "node:path";

export const PPL_LANES = ["demo", "cob", "rel", "ten", "anc", "medinc", "ageMed", "a1824", "a3554", "a75"];

// the core file's text for a results file's text
export function coreText(resText) {
  const r = JSON.parse(resText), b = r.booths;
  const lanes = b ? PPL_LANES.filter((k) => k in b) : [];
  for (const k of lanes) delete b[k];
  if (lanes.length) r.pplLanes = lanes;
  return JSON.stringify(r);
}
// every res-<frame>.json in map/data → its core-<frame>.json, written when it changed
export function writeCores(root, log = console.log) {
  const dir = path.join(root, "map", "data");
  for (const f of fs.readdirSync(dir).sort()) {
    const m = f.match(/^res-(\w+)\.json$/);
    if (!m) continue;
    const out = path.join(dir, `core-${m[1]}.json`), body = coreText(fs.readFileSync(path.join(dir, f), "utf8"));
    if (fs.existsSync(out) && fs.readFileSync(out, "utf8") === body) continue;
    fs.writeFileSync(out, body);
    log(`map/data/core-${m[1]}.json`, body.length, "bytes");
  }
}
