/* stamp-agg-prev-tpp.mjs – carry each state election's previous-election two-party
   totals into its own aggregate (agg.ptpp: [Labor, Coalition]), so the app can read a
   two-party "change on <year>" for a state frame the way it already reads a primary
   change from agg.pprim/pformal (deriveAreas computes the share delta at read time).

   The previous election is another frame the map itself ships, read from maps/data:
   nsw19 stands on nsw15, wa25 on wa21, and so on, via each frame's own recorded
   `prev` year. A frame whose predecessor isn't shipped (vic14 ← vic10) keeps no
   two-party change figure, and neither does a pair whose official tallies are
   counted on wildly different shares of the roll — SA 2026's notional sums cover
   about a quarter of the formal vote while 2022's cover most of it, so a share
   difference there wouldn't mean what it reads as. Federal frames already carry
   their swings in tpp[2] and are untouched.

   Idempotent; assemble.mjs runs it before the cores split. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COVER_MIN = 0.45; // both tallies must count at least this share of the formal roll …
const COVER_BAND = [0.7, 1.4]; // … and be counted on a like share of it (qld17's 70% v qld20's
// 92% still reads like-for-like; sa26's 28% against sa22's 88% does not)

export function stampPrevTpp(ROOT) {
  const dataDir = path.join(ROOT, "maps", "data");
  const read = (y) => {
    const p = path.join(dataDir, `res-${y}.json`);
    return fs.existsSync(p) ? { path: p, data: JSON.parse(fs.readFileSync(p, "utf8")) } : null;
  };
  const share = (t) => (t && t[0] + t[1] ? (100 * t[0]) / (t[0] + t[1]) : null);
  const cover = (a) => (a.formal ? (a.tpp[0] + a.tpp[1]) / a.formal : 0);
  const keys = fs.readdirSync(dataDir).map((f) => /^res-([a-z]+\d+)\.json$/.exec(f)).filter(Boolean).map((m) => m[1]).sort();
  const lines = [];
  let changed = 0;
  for (const y of keys) {
    const st = read(y), a = st.data.agg && st.data.agg.AUS;
    if (!a || !Array.isArray(a.tpp) || a.tpp[2] != null || st.data.prev == null) continue;
    const m = /^([a-z]+)\d+$/.exec(y);
    const prevY = m[1] + String(st.data.prev).slice(2);
    const pv = read(prevY);
    if (!pv) { lines.push(`${y}: no shipped ${prevY} frame — no two-party change`); continue; }
    if (JSON.stringify(ptppOf(pv.data)) === JSON.stringify(a.ptpp)) continue; // already carried
    const c0 = cover(pv.data.agg.AUS), c1 = cover(a), ratio = c0 && c1 ? c1 / c0 : 0;
    if (c0 < COVER_MIN || c1 < COVER_MIN || ratio < COVER_BAND[0] || ratio > COVER_BAND[1]) {
      lines.push(`${y}: ${prevY} tallies cover ${Math.round(100 * c0)}% v this frame's ${Math.round(100 * c1)}% — no two-party change`);
      continue;
    }
    const ptpp = ptppOf(pv.data);
    for (const k of Object.keys(st.data.agg)) st.data.agg[k].ptpp = [...ptpp];
    fs.writeFileSync(st.path, JSON.stringify(st.data));
    changed++;
    lines.push(`${y}: on ${prevY} two-party ${share(ptpp).toFixed(1)} → ${share(a.tpp).toFixed(1)} (${r2p(share(a.tpp) - share(ptpp))} points)`);
  }
  if (!changed && !lines.length) return;
  for (const l of lines) console.log("stamp-agg-prev-tpp", l);
  if (!changed) console.log("stamp-agg-prev-tpp: carried totals unchanged");
}
function ptppOf(d) { const t = d.agg.AUS.tpp; return [t[0], t[1]]; }
const r2p = (v) => (v > 0 ? "+" : "−") + Math.abs(v).toFixed(2);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  stampPrevTpp(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
}
