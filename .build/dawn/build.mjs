/* /dawn/ – a trial design for the site (the owner's "auspol.html" mock-up,
   Nov 2026), wired to the site's own data and linked from nowhere.

   Four screens: the primaries (the mock-up's sunrise, as drawn), the primary
   vote week by week, Labor's two-party vote week by week, and where
   preferences flow. Its data is gen-data §13 (assets/dawn-data.json, and the
   past terms in dawn-hist.json, fetched when a window first reaches behind
   this term). newtracker/build.mjs calls buildDawn after the federal page;
   `node .build/dawn/build.mjs` rebuilds the page alone from the last data.

   The template keeps the mock-up's markup, styles and scripts; its words
   come from copy.mjs, which writes every head by rule. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { copyFor, flowNote } from "./copy.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hash8 = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);

/* the flow diagram's totals, as the page sums them: today's unrounded
   shares through each table, the three-cornered term in the Coalition's */
export function flowTotals(D) {
  const s = D.nowShares, F = D.flows;
  return {
    lnp: s.alp + s.grn * F.lnp.grn + s.onp * F.lnp.onp + s.oth * F.lnp.oth + F.cnr,
    on: s.alp + s.grn * F.on.grn + s.lnp * F.on.lnp + s.oth * F.on.oth,
  };
}

export function buildDawn({ root = path.resolve(HERE, "..", ".."), assets = path.join(root, ".build", "newtracker", "assets"),
                            keep = () => false, write = (f, s) => fs.writeFileSync(f, s) } = {}) {
  const D = JSON.parse(fs.readFileSync(path.join(assets, "dawn-data.json"), "utf8"));
  const hist = fs.readFileSync(path.join(assets, "dawn-hist.json"));
  const out = path.join(root, "dawn");
  fs.mkdirSync(out, { recursive: true });
  /* the past terms: a hashed sidecar, so a browser keeps it until it changes */
  const histName = `hist.${hash8(hist)}.json`;
  if (!fs.existsSync(path.join(out, histName)) || !fs.readFileSync(path.join(out, histName)).equals(hist)) write(path.join(out, histName), hist);
  for (const f of fs.readdirSync(out))
    if (/^hist\.[0-9a-f]{8}\.json$/.test(f) && f !== histName && !keep(`dawn/${f}`)) fs.unlinkSync(path.join(out, f));
  /* the mock-up's face, Commissioner, is the one the map page already serves */
  const font = fs.readdirSync(path.join(root, "assets", "fonts")).find((f) => /^commissioner-latin\.[0-9a-f]+\.woff2$/.test(f));
  if (!font) throw new Error("dawn: assets/fonts has no commissioner-latin face");
  const C = copyFor(D), T = flowTotals(D);
  const notes = { lnp: flowNote(D, "lnp", T.lnp), on: flowNote(D, "on", T.on) };
  const json = JSON.stringify(D).replace(/</g, "\\u003c");
  let html = fs.readFileSync(path.join(HERE, "template.html"), "utf8");
  const fill = { HIST: histName, FONT: "/assets/fonts/" + font, asOf: esc(C.asOf), votesHead: esc(C.votesHead), votesDek: esc(C.votesDek),
                 tppHead: esc(C.tppHead), tppDek: esc(C.tppDek), flowsHead: esc(C.flowsHead) };
  html = html.replace(/\{\{(HIST|FONT|asOf|votesHead|votesDek|tppHead|tppDek|flowsHead)\}\}/g, (m, k) => fill[k]);
  html = html.replace("{{FLOWNOTES}}", () => JSON.stringify(notes).replace(/</g, "\\u003c"));
  html = html.replace("{{DATA}}", () => json);
  html = html.replace("/*{{STARS}}*/", () => fs.readFileSync(path.join(HERE, "stars.js"), "utf8").trim());
  const left = html.match(/\{\{[A-Za-z]+\}\}/);
  if (left) throw new Error("dawn: template placeholder left unfilled: " + left[0]);
  write(path.join(out, "index.html"), html);
  return { file: path.join(out, "index.html"), bytes: Buffer.byteLength(html), hist: histName, weeks: D.weeks.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = buildDawn();
  console.log(`built dawn/index.html · ${(r.bytes / 1024).toFixed(0)} KB · ${r.weeks} weeks · ${r.hist}`);
}
