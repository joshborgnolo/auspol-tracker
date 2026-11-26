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
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { copyFor, flowNote, MONF } from "./copy.mjs";
import { latestPollLine } from "./poll-meta.mjs";
import { ISSUES as ISSUE_NAMES } from "../issues-parse.mjs";

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

/* the past terms' events, the list the main site's charts mark on a past term (Past cycles'
   CYC_EVENTS), read from its script so the two pages can't differ */
export function pastEvents(file) {
  const src = fs.readFileSync(file, "utf8"), at = src.indexOf("const CYC_EVENTS = {"), end = src.indexOf("\n};", at);
  if (at < 0 || end < 0) throw new Error("dawn: CYC_EVENTS not found in " + file);
  const table = vm.runInNewContext("(" + src.slice(src.indexOf("{", at), end + 2) + ")");
  return Object.values(table).flat().map((e) => ({ d: e.date, s: e.short, l: e.label, t: e.desc })).sort((x, y) => (x.d < y.d ? -1 : 1));
}

/* np-score's record of the projection, read from the report it regenerates every day
   (data/np-report.md). Importing the scorer is no way in: loading it runs its CLI, which appends
   to the ledger it reads. Returns null when the report is missing or its overall line has
   changed shape, and the page then leaves its record out (test-dawn notices first). */
export function readScore(file) {
  if (!fs.existsSync(file)) return null;
  const md = fs.readFileSync(file, "utf8");
  const ov = md.match(/\*\*Overall: (\d+)\/(\d+) \((\d+)%\) primary · median midpoint error ([\d.]+)d · (\d+)\/(\d+) rolled · (\d+) skip · (\d+) void · (\d+) pending\*\*/);
  if (!ov) return null;
  const sect = (h) => ((md.split("\n## " + h)[1] || "").split("\n## ")[0]);
  const cells = (line) => line.split("|").slice(1, -1).map((c) => c.trim());
  const frac = (c) => { const m = /^(\d+)\/(\d+)/.exec(c); return m ? [+m[1], +m[2]] : null; };
  const n0 = (c) => (c === "–" || c === "" ? 0 : +c);
  const houses = {};
  for (const line of sect("Hit rate").split("\n")) {
    if (!line.startsWith("|")) continue;
    const c = cells(line);
    if (c.length !== 6 || c[0] === "house" || /^-+$/.test(c[0])) continue;
    houses[c[0]] = { prim: frac(c[1]), err: c[2] === "–" ? null : parseFloat(c[2]), rolled: frac(c[3]), skip: n0(c[4]), void: n0(c[5]) };
  }
  const ledger = {};
  let since = null;
  for (const line of sect("Ledger").split("\n")) {
    if (!line.startsWith("|")) continue;
    const c = cells(line);
    if (c.length !== 6 || c[0].startsWith("logged") || /^-+$/.test(c[0])) continue;
    const i = c[5].indexOf(" - ");
    (ledger[c[1]] ||= []).push({ logged: c[0], slot: c[2], window: c[3], rolled: c[4] === "yes",
      verdict: (i < 0 ? c[5] : c[5].slice(0, i)).trim(), note: i < 0 ? "" : c[5].slice(i + 3).trim() });
    const d = c[0].slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!since || d < since)) since = d;
  }
  const [, sm, sd] = (since || "").split("-").map(Number);
  return {
    overall: { h: +ov[1], n: +ov[2], rate: +ov[3], err: +ov[4], rolledH: +ov[5], rolledN: +ov[6], skip: +ov[7], void: +ov[8], pending: +ov[9] },
    houses, ledger, since, sinceLabel: since ? sd + " " + MONF[sm - 1] : null,
    lastRun: (md.match(/^Last run: (.+)$/m) || [])[1] || null,
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
  /* a group's past terms: gen-data's group-history.json, the file the site's
     own pages fetch, in a sidecar of this page's own. Pointing at the site's
     copy tore the tree whenever a commit made without this page renamed it
     (about ten times a month): the page's references stay inside dawn/,
     bar the favicon and the font */
  const ghPath = path.join(assets, "group-history.json");
  const ghUrl = fs.existsSync(ghPath) && fs.readFileSync(ghPath, "utf8").trim() !== "null" ? side("group-history.json", "ghist") : "";
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
  const fill = { HIST: histName, GROUPS: groupsName, GHIST: ghUrl, FONT: "/assets/fonts/" + font, asOf: esc(C.asOf), latestPoll: esc(latestPollLine(D)), votesHead: esc(C.votesHead), votesDek: esc(C.votesDek),
                 tppHead: esc(C.tppHead), tppDek: esc(C.tppDek), flowsHead: esc(C.flowsHead) };
  html = html.replace(/\{\{(HIST|GROUPS|GHIST|FONT|asOf|latestPoll|votesHead|votesDek|tppHead|tppDek|flowsHead)\}\}/g, (m, k) => fill[k]);
  const filterStyle = fs.readFileSync(path.join(HERE, "filter-select.css"), "utf8");
  const filterScript = fs.readFileSync(path.join(HERE, "filter-select.mjs"), "utf8").replaceAll("export function", "function");
  html = html.replace("/*{{PMENGINE}}*/", () => engine);
  html = html.replace("/*{{POLLMETA}}*/", () => fs.readFileSync(path.join(HERE, "poll-meta.mjs"), "utf8").replaceAll("export function", "function"));
  html = html.replace("/*{{FILTERSCSS}}*/", () => filterStyle);
  html = html.replace("/*{{FILTERSJS}}*/", () => "const filterSelect=(()=>{" + filterScript + "return filterSelect;})();");
  html = html.replace("{{FLOWNOTES}}", () => JSON.stringify(notes).replace(/</g, "\\u003c"));
  const past = pastEvents(path.join(HERE, "..", "newtracker", "assets", "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js"));
  html = html.replace("{{PASTEVENTS}}", () => JSON.stringify(past).replace(/</g, "\\u003c"));
  html = html.replace("{{DATA}}", () => json);
  html = html.replace("/*{{STARS}}*/", () => fs.readFileSync(path.join(HERE, "stars.js"), "utf8").trim());
  const left = html.match(/\{\{[A-Za-z]+\}\}/);
  if (left) throw new Error("dawn: template placeholder left unfilled: " + left[0]);
  write(path.join(out, "index.html"), html);
  /* the polls page (template-polls.html): every poll this term, newest first, the parties in today's order */
  const pollsPath = path.join(assets, "dawn-polls.json");
  let pollsFile = null;
  if (fs.existsSync(pollsPath)) {
    const PD = JSON.parse(fs.readFileSync(pollsPath, "utf8")), PL = PD.polls, L = D.weeks.length - 1;
    PD.issL = ISSUE_NAMES;   // each issue by the name the site gives it
    const order = [...D.parties].sort((a, b) => D.prim[b].v[L] - D.prim[a].v[L]);
    const fillP = { FONT: "/assets/fonts/" + font, pollsHead: "Federal opinion polls",
                    pollsDek: "From 13 pollsters, with the newest first. Open a poll to see details." };
    let ph = fs.readFileSync(path.join(HERE, "template-polls.html"), "utf8");
    ph = ph.replace(/\{\{(FONT|pollsHead|pollsDek)\}\}/g, (m, k) => fillP[k]).replace("{{ORDER}}", () => JSON.stringify(order))
      .replace("{{POLLS}}", () => JSON.stringify(PD).replace(/</g, "\\u003c"))
      .replace("/*{{SIGTRIANGLE}}*/", () => fs.readFileSync(path.join(HERE, "sig-triangle.mjs"), "utf8").replaceAll("export function", "function"))
      .replace("/*{{POLLHEADING}}*/", () => "const pollHeading=(()=>{" + fs.readFileSync(path.join(HERE, "poll-heading.mjs"), "utf8").replaceAll("export function", "function") + "return pollHeading;})();")
      .replace("/*{{FILTERSCSS}}*/", () => filterStyle)
      .replace("/*{{FILTERSJS}}*/", () => "const filterSelect=(()=>{" + filterScript + "return filterSelect;})();");
    const leftP = ph.match(/\{\{[A-Za-z]+\}\}/);
    if (leftP) throw new Error("dawn: polls template placeholder left unfilled: " + leftP[0]);
    fs.mkdirSync(path.join(out, "polls"), { recursive: true });
    pollsFile = path.join(out, "polls", "index.html");
    write(pollsFile, ph);
  }
  /* the next-polls page (template-next.html): the site's projection, np-project.js, runs in the
     page on the reader's own Sydney clock and next-copy.js words it; the page carries the cadence
     table, the houses' release dates and np-score's record of how the dates have done */
  const nextPath = path.join(assets, "dawn-next.json"), npPath = path.join(assets, "np-project.js");
  let nextFile = null;
  if (fs.existsSync(nextPath) && fs.existsSync(npPath)) {
    const ND = JSON.parse(fs.readFileSync(nextPath, "utf8"));
    ND.score = readScore(path.join(root, "data", "np-report.md"));
    const js = (f) => fs.readFileSync(f, "utf8").replace(/<\/script/gi, "<\\/script");
    let nh = fs.readFileSync(path.join(HERE, "template-next.html"), "utf8")
      .replace(/\{\{FONT\}\}/g, "/assets/fonts/" + font)
      .replace("{{NEXT}}", () => JSON.stringify(ND).replace(/</g, "\\u003c"));
    const leftN = nh.replace("/*{{NPPROJECT}}*/", "").replace("/*{{NEXTCOPY}}*/", "").match(/\{\{[A-Za-z]+\}\}/);
    if (leftN) throw new Error("dawn: next template placeholder left unfilled: " + leftN[0]);
    nh = nh.replace("/*{{NPPROJECT}}*/", () => js(npPath)).replace("/*{{NEXTCOPY}}*/", () => js(path.join(HERE, "next-copy.js")));
    fs.mkdirSync(path.join(out, "next"), { recursive: true });
    nextFile = path.join(out, "next", "index.html");
    write(nextFile, nh);
  }
  return { polls: pollsFile, next: nextFile, file: path.join(out, "index.html"), bytes: Buffer.byteLength(html), hist: histName, groups: groupsName, ghist: ghUrl, weeks: D.weeks.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = buildDawn();
  console.log(`built dawn/index.html · ${(r.bytes / 1024).toFixed(0)} KB · ${r.weeks} weeks · ${r.hist}`);
}
