/* pack.mjs — rebuild "NEW Auspol Tracker (Standalone).html" from the working
   copies in .build/newtracker/ (template.html + assets/*.js|jsx).
   Only the manifest entries for JS/JSX assets and the template line are
   replaced; fonts, loader and everything else stay byte-identical.
   Run: node .build/newtracker/pack.mjs
   (Full refresh after new polls: node .build/newtracker/gen-data.mjs && node .build/newtracker/pack.mjs) */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "NEW Auspol Tracker (Standalone).html");

const lines = fs.readFileSync(OUT, "utf8").split("\n");
const tagIdx = (t) => {
  const i = lines.findIndex((l) => l.trim() === `<script type="__bundler/${t}">`);
  if (i < 0) throw new Error("bundler tag not found: " + t);
  return i;
};

// ---- manifest: swap in the (re)generated JS/JSX assets ----
const mi = tagIdx("manifest") + 1;
const manifest = JSON.parse(lines[mi]);
let swapped = 0;
for (const f of fs.readdirSync(path.join(HERE, "assets"))) {
  const uuid = f.replace(/\.(js|jsx)$/, "");
  if (!manifest[uuid]) throw new Error("asset not in manifest: " + f);
  const buf = fs.readFileSync(path.join(HERE, "assets", f));
  manifest[uuid].data = zlib.gzipSync(buf, { level: 9 }).toString("base64");
  manifest[uuid].compressed = true;
  swapped++;
}
// "</" must be escaped to "<\/" inside the inline <script> blocks, or the
// HTML parser ends the block at the first </script> found in the JSON
const esc = (s) => s.replace(/<\//g, "<\\/");
lines[mi] = esc(JSON.stringify(manifest));

// ---- template ----
const ti = tagIdx("template") + 1;
lines[ti] = esc(JSON.stringify(fs.readFileSync(path.join(HERE, "template.html"), "utf8")));

fs.writeFileSync(OUT, lines.join("\n"));
console.log(`packed ${swapped} assets + template → ${OUT} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`);
