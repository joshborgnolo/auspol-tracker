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
import { copyFor, flowNote, MONF } from "./copy.mjs";

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
  const out = path.join(root, "dawn");
  fs.mkdirSync(out, { recursive: true });
  /* the sidecars, hashed so a browser keeps each until it changes: the past
     terms (read once the page is idle) and the vote by group (read when a
     group is first picked) */
  const side = (src, stem) => {
    const buf = fs.readFileSync(path.join(assets, src)), name = `${stem}.${hash8(buf)}.json`;
    if (!fs.existsSync(path.join(out, name)) || !fs.readFileSync(path.join(out, name)).equals(buf)) write(path.join(out, name), buf);
    for (const f of fs.readdirSync(out))
      if (new RegExp(`^${stem}\\.[0-9a-f]{8}\\.json$`).test(f) && f !== name && !keep(`dawn/${f}`)) fs.unlinkSync(path.join(out, f));
    return name;
  };
  const histName = side("dawn-hist.json", "hist");
  const groupsName = fs.existsSync(path.join(assets, "dawn-groups.json")) ? side("dawn-groups.json", "groups") : "";
  /* a group's past terms: the file the site's own pages already fetch
     (build.mjs names it by the same hash) */
  const ghPath = path.join(assets, "group-history.json");
  const ghName = fs.existsSync(ghPath) ? `group-history.${hash8(fs.readFileSync(ghPath))}.json` : null;
  const ghUrl = ghName && fs.existsSync(path.join(root, "assets", ghName)) ? "/assets/" + ghName : "";
  /* the browser copy of the primary model, for the pollster menu */
  const enginePath = path.join(assets, "pm-engine.js");
  const engine = fs.existsSync(enginePath) ? fs.readFileSync(enginePath, "utf8").replace(/<\/script/gi, "<\\/script") : "";
  /* the mock-up's face, Commissioner, is the one the map page already serves */
  const font = fs.readdirSync(path.join(root, "assets", "fonts")).find((f) => /^commissioner-latin\.[0-9a-f]+\.woff2$/.test(f));
  if (!font) throw new Error("dawn: assets/fonts has no commissioner-latin face");
  const C = copyFor(D), T = flowTotals(D);
  const notes = { lnp: flowNote(D, "lnp", T.lnp), on: flowNote(D, "on", T.on) };
  const json = JSON.stringify(D).replace(/</g, "\\u003c");
  let html = fs.readFileSync(path.join(HERE, "template.html"), "utf8");
  const fill = { HIST: histName, GROUPS: groupsName, GHIST: ghUrl, FONT: "/assets/fonts/" + font, asOf: esc(C.asOf), votesHead: esc(C.votesHead), votesDek: esc(C.votesDek),
                 tppHead: esc(C.tppHead), tppDek: esc(C.tppDek), flowsHead: esc(C.flowsHead) };
  html = html.replace(/\{\{(HIST|GROUPS|GHIST|FONT|asOf|votesHead|votesDek|tppHead|tppDek|flowsHead)\}\}/g, (m, k) => fill[k]);
  html = html.replace("/*{{PMENGINE}}*/", () => engine);
  html = html.replace("{{FLOWNOTES}}", () => JSON.stringify(notes).replace(/</g, "\\u003c"));
  html = html.replace("{{DATA}}", () => json);
  html = html.replace("/*{{STARS}}*/", () => fs.readFileSync(path.join(HERE, "stars.js"), "utf8").trim());
  const left = html.match(/\{\{[A-Za-z]+\}\}/);
  if (left) throw new Error("dawn: template placeholder left unfilled: " + left[0]);
  write(path.join(out, "index.html"), html);
  /* the polls page (template-polls.html): every poll this term, newest first, the parties in today's order */
  const pollsPath = path.join(assets, "dawn-polls.json");
  let pollsFile = null;
  if (fs.existsSync(pollsPath)) {
    const PL = JSON.parse(fs.readFileSync(pollsPath, "utf8")), L = D.weeks.length - 1;
    const order = [...D.parties].sort((a, b) => D.prim[b].v[L] - D.prim[a].v[L]);
    const [ey, em] = D.election.date.split("-").map(Number);
    const houses = new Set(PL.map((q) => q.h.replace(/\s*\(.*\)$/, "")));
    const fillP = { FONT: "/assets/fonts/" + font, pollsHead: esc(`${PL.length} polls since the ${MONF[em - 1]} ${ey} election`),
                    pollsDek: esc(`From ${houses.size} pollsters, newest first, each as printed. Open a poll for its details and the model’s figures for the same week.`) };
    let ph = fs.readFileSync(path.join(HERE, "template-polls.html"), "utf8");
    ph = ph.replace(/\{\{(FONT|pollsHead|pollsDek)\}\}/g, (m, k) => fillP[k]).replace("{{ORDER}}", () => JSON.stringify(order))
      .replace("{{POLLS}}", () => JSON.stringify(PL).replace(/</g, "\\u003c"));
    const leftP = ph.match(/\{\{[A-Za-z]+\}\}/);
    if (leftP) throw new Error("dawn: polls template placeholder left unfilled: " + leftP[0]);
    fs.mkdirSync(path.join(out, "polls"), { recursive: true });
    pollsFile = path.join(out, "polls", "index.html");
    write(pollsFile, ph);
  }
  return { polls: pollsFile, file: path.join(out, "index.html"), bytes: Buffer.byteLength(html), hist: histName, groups: groupsName, ghist: ghUrl, weeks: D.weeks.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = buildDawn();
  console.log(`built dawn/index.html · ${(r.bytes / 1024).toFixed(0)} KB · ${r.weeks} weeks · ${r.hist}`);
}
