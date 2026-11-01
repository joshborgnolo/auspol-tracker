/* assemble.mjs – the Election model page's script, styles, engine copies and static head.

   model/index.html is hand-maintained (its shell regions filled by node .build/site-shell.mjs); its
   behaviour lives here in .build/model/:
     views.mjs          the written lines and head figures, by rule (also run here, in node, for the static head)
     app/app-1-base.js  helpers, state, the mode switch, the head
     app/app-2-dist.js  how many seats each party wins across the simulations
     app/app-3-seats.js seat by seat, with a card per seat
     app/app-4-explore.js  "Try your own numbers": the reader's settings, run in a worker
     app/app-5-evidence.js how it works, how well it has done, what it cannot know, the files
     app/app-6-boot.js  loading and wiring
     worker.mjs         the worker that runs the engine
     page.css           the page's own styles (the palette is inline in the page)
   This writes
     model/model.js     one closure: URLS (data stamped by content hash) + views.mjs + the app parts
     model/model.css
     model/js/*.mjs     the seat model's pure modules, BYTE-IDENTICAL to .build/analysis/seat-model/ (the
                        worker imports them; test-model-bundle.mjs pins them and replays the engine)
     model/js/worker.mjs
     model/index.html   its asset stamps, and the static head between the md-static markers, written from
                        the official nowcast so the page opens on real figures before the script runs
   Run after export.mjs (which runs after the model's official runs):
     node .build/model/export.mjs && node .build/model/assemble.mjs */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { staticHead } from "./views.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const R = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
const write = (rel, body) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === body) return console.log(rel, "unchanged");
  fs.writeFileSync(p, body); console.log(rel, body.length, "bytes");
};

/* the engine, copied verbatim */
const MODS = ["seat-engine.mjs", "senate-flows.mjs", "seat-build.mjs", "model-sim.mjs"];
let engine = "";
for (const m of MODS) { const src = R(`.build/analysis/seat-model/${m}`); engine += src; write(`model/js/${m}`, src); }
const worker = fs.readFileSync(path.join(HERE, "worker.mjs"), "utf8");
write("model/js/worker.mjs", worker);

/* data stamps: each file the page fetches carries its content hash */
const stamp = (rel) => `/${rel}?v=${hash(R(rel))}`;
const URLS = {
  nowcast: stamp("data/seat-model-2028-nowcast.json"),
  forecast: stamp("data/seat-model-2028-forecast.json"),
  inputs: stamp("model/data/inputs.json"),
  evidence: stamp("model/data/evidence.json"),
  senate: stamp("data/senate-rankings-2025.json"),
  worker: `/model/js/worker.mjs?v=${hash(worker + engine)}`,
};
const views = fs.readFileSync(path.join(HERE, "views.mjs"), "utf8").replace(/^export /gm, "");
const parts = ["app-1-base.js", "app-2-dist.js", "app-3-seats.js", "app-4-explore.js", "app-5-evidence.js", "app-6-boot.js"].map((f) => fs.readFileSync(path.join(HERE, "app", f), "utf8")).join("\n");
const js = `/* the Election model – assembled from .build/model by .build/model/assemble.mjs; edit the parts, not this file */\n(() => {\n"use strict";\nconst URLS = ${JSON.stringify(URLS)};\n${views}\n${parts}\n})();\n`;
const css = fs.readFileSync(path.join(HERE, "page.css"), "utf8");
write("model/model.js", js);
write("model/model.css", css);

/* the page: asset stamps and the static head */
const ip = path.join(ROOT, "model", "index.html");
let html = fs.readFileSync(ip, "utf8");
const now = JSON.parse(R("data/seat-model-2028-nowcast.json")), inputs = JSON.parse(R("model/data/inputs.json"));
html = html.replace(/(src|href)="\/model\/(model\.js|model\.css)(\?v=[0-9a-f]{8})?"/g, (m, attr, f) => `${attr}="/model/${f}?v=${hash(f === "model.js" ? js : css)}"`);
html = html.replace(/<!--md-static:begin-->[\s\S]*?<!--md-static:end-->/, `<!--md-static:begin-->\n${staticHead(now, "nowcast", inputs.asOf)}\n<!--md-static:end-->`);
const prev = fs.readFileSync(ip, "utf8");
if (html !== prev) { fs.writeFileSync(ip, html); console.log("model/index.html stamped and its head written"); } else console.log("model/index.html current");
