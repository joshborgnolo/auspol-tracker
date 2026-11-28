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
import { cohesionModel } from "./cohesion-model.mjs";
import { copyFor, flowNote, leadersHead, leadersDek, favHead, favDek, ppmHead, ppmDek, moodHead, moodDek, trustHead, trustDek, lifeHead, lifeDek, cycleChapeau, cycleStatsHtml, cycleHead, cycleDek, cycleLit, SHARE_KEYS, splitChapeau, splitHead, splitDek, spreadHead, spreadDek, emapChapeau, emapHead, opinionLede, closestHead, closestSeats, fdate, MONF } from "./copy.mjs";
import { latestPollLine } from "./poll-meta.mjs";
import { disagreeData } from "./disagree-data.mjs";
import { decidedData } from "./decided-data.mjs";
import { emapData } from "./emap-data.mjs";
import { heroSlides, newestPublished, rowKey, rowQuestions, pubopCss, pubopApp } from "./po-data.mjs";
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

/* a block template.html marks for the other pages to share: its styles, the sky,
   the mark, the chart and its time window, the rolling figures, the nav */
export function sharedBlock(template, name) {
  const html = name === "logo";
  const open = html ? `<!--@shared ${name}-->` : `/*@shared ${name}*/`, close = html ? `<!--@end ${name}-->` : `/*@end ${name}*/`;
  const a = template.indexOf(open), b = template.indexOf(close);
  if (a < 0 || b < a || template.indexOf(open, a + 1) >= 0) throw new Error(`dawn: template.html must mark the shared block "${name}" once`);
  return template.slice(a + open.length, b).replace(/^\n|\n$/g, "");
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
    /* the releases that asked the public opinion page's questions too: each row's way there */
    const asked = path.join(assets, "oneoffs-source.json");
    if (fs.existsSync(asked)) {
      const by = rowQuestions(JSON.parse(fs.readFileSync(asked, "utf8")));
      for (const p of PL) if (by.has(p.k)) p.po = by.get(p.k);
    }
    const order = [...D.parties].sort((a, b) => D.prim[b].v[L] - D.prim[a].v[L]);
    const fillP = { FONT: "/assets/fonts/" + font, pollsHead: "Federal opinion polls",
                    pollsDek: "From 13 pollsters, with the newest first. Open a poll for details." };
    let ph = fs.readFileSync(path.join(HERE, "template-polls.html"), "utf8");
    ph = ph.replace(/\{\{(FONT|pollsHead|pollsDek)\}\}/g, (m, k) => fillP[k]).replace("{{ORDER}}", () => JSON.stringify(order))
      .replace("{{POLLS}}", () => JSON.stringify(PD).replace(/</g, "\\u003c"))
      .replace("/*{{SIGTRIANGLE}}*/", () => fs.readFileSync(path.join(HERE, "sig-triangle.mjs"), "utf8").replaceAll("export function", "function"))
      .replace("/*{{POLLINTERVALS}}*/", () => fs.readFileSync(path.join(HERE, "poll-intervals.mjs"), "utf8").replaceAll("export function", "function"))
      .replace("/*{{POLLHEADING}}*/", () => "const {pollHeading,houseName,sampleBase}=(()=>{" + fs.readFileSync(path.join(HERE, "poll-heading.mjs"), "utf8").replaceAll("export function", "function") + "return {pollHeading,houseName,sampleBase};})();")
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
  /* the leadership ratings and mood pages (template-leaders.html, template-mood.html): the sunrise
     and long charts of the votes page, drawn from the leader, direction and trust models; what the
     pages share is read out of template.html, and chart-windows.js gives each chart its own window */
  const base = fs.readFileSync(path.join(HERE, "template.html"), "utf8");
  const sunPage = ({ asset, template, dir, fill, markup = {}, extra = () => ({}) }) => {
    const src = path.join(assets, asset);
    if (!fs.existsSync(src)) return null;
    const raw = JSON.parse(fs.readFileSync(src, "utf8"));
    const PG = { ...raw, ...extra(raw) };
    const words = { FONT: "/assets/fonts/" + font, asOf: esc(fdate(PG.asOf)), latestPoll: esc(latestPollLine(PG)),
                    ...Object.fromEntries(Object.entries(fill).map(([k, f]) => [k, esc(f(PG))])),
                    ...Object.fromEntries(Object.entries(markup).map(([k, f]) => [k, f(PG)])) };
    let h = fs.readFileSync(path.join(HERE, template), "utf8")
      .replace(/\/\*\{\{SHARED:([a-z]+)\}\}\*\//g, (m, k) => sharedBlock(base, k))
      .replace("/*{{FILTERSCSS}}*/", "");
    h = h.replace(/\{\{([A-Za-z]+)\}\}/g, (m, k) => (k in words ? words[k] : m))
      .replace("/*{{CHARTWINDOWS}}*/", () => fs.readFileSync(path.join(HERE, "chart-windows.js"), "utf8"))
      .replace("/*{{POLLMETA}}*/", () => fs.readFileSync(path.join(HERE, "poll-meta.mjs"), "utf8").replaceAll("export function", "function"))
      .replace("{{PASTEVENTS}}", () => JSON.stringify(past).replace(/</g, "\\u003c"))
      .replace("{{DATA}}", () => JSON.stringify(PG).replace(/</g, "\\u003c"))
      .replace("/*{{STARS}}*/", () => fs.readFileSync(path.join(HERE, "stars.js"), "utf8").trim());
    const unfilled = h.match(/\{\{[A-Za-z:]+\}\}/);
    if (unfilled) throw new Error("dawn: " + template + " placeholder left unfilled: " + unfilled[0]);
    fs.mkdirSync(path.join(out, dir), { recursive: true });
    const file = path.join(out, dir, "index.html");
    write(file, h);
    return file;
  };
  const leadFile = sunPage({ asset: "dawn-leaders.json", template: "template-leaders.html", dir: "leadership-ratings",
    fill: { leadersHead: (L) => leadersHead(L).head, leadersDek, ppmHead, ppmDek, favHead: (L) => favHead(L).head, favDek } });
  const moodFile = sunPage({ asset: "dawn-mood.json", template: "template-mood.html", dir: "mood",
    extra: () => {
      const read = name => JSON.parse(fs.readFileSync(path.resolve(HERE, "../../data", name), "utf8"));
      const cohesion = read("social-cohesion.json");
      const polls = read("polls.json").direction.filter(r => r.pollster === "SEC Newgate");
      const waves = cohesion.sec.map(([date, good, poor]) => {
        const poll = polls.find(r => r.date.startsWith(date));
        return [date, good, poor, poll?.sampleEff || (poll?.sample || 1500) / 1.6];
      });
      return { cohesion: { ...cohesion, trend: cohesionModel(waves) } };
    },
    fill: { dirHead: moodHead, dirDek: moodDek, trustHead, trustDek, lifeHead, lifeDek } });
  const cyclesFile = sunPage({ asset: "dawn-cycles.json", template: "template-cycles.html", dir: "past-cycles",
    fill: { chapeau: cycleChapeau, primaryHead: (C) => cycleHead(C, "primary"), primaryDek: (C) => cycleDek(C, "primary"), netHead: (C) => cycleHead(C, "net"), netDek: (C) => cycleDek(C, "net"),
            ppmHead: (C) => cycleHead(C, "ppmm"), ppmDek: (C) => cycleDek(C, "ppmm"), opprHead: (C) => cycleHead(C, "oppr"), opprDek: (C) => cycleDek(C, "oppr") },
    markup: { cyStats: cycleStatsHtml },
    /* which terms each chart opens with brought out */
    extra: (C) => ({ lit: Object.fromEntries(["primary", "net", "ppmm", "oppr"].map((k) => [k, cycleLit(C, k)])),
      /* the primary charts' two readings: each one's head, dek and terms brought out */
      views: Object.fromEntries(SHARE_KEYS.map((k) => [k, Object.fromEntries(["share", "points"].map((m) => [m, { head: cycleHead(C, k, m), dek: cycleDek(C, k, m), lit: cycleLit(C, k, m) }]))])) }) });
  /* the electoral map page: the main map's own 2025 results and boundaries (emap-data.mjs) */
  let emapFile = null;
  const mapRoot = path.resolve(HERE, "..", "..");
  if (fs.existsSync(path.join(mapRoot, "map", "data", "core-2025.json"))) {
    const EM = emapData(mapRoot);
    EM.closest = closestSeats(EM).map((s) => s.n);
    /* the map panel's heading for each election in its menu */
    const heads = Object.fromEntries(EM.history.map((h) => [h.y, emapHead({ history: [h] })]));
    heads.now = emapHead({ history: [EM.today] }).replace(/ won a majority/, " holds a majority").replace(/^No party won a majority in the House$/, "No party holds a majority in the House");
    EM.heads = heads;
    EM.lastYear = EM.history.at(-1).y;
    /* the full map's script and styles, by content, so a cached copy never outlives a change */
    const asset = (f) => "/map/" + f + "?v=" + crypto.createHash("sha256").update(fs.readFileSync(path.join(mapRoot, "map", f))).digest("hex").slice(0, 8);
    const words = { MAPCSS: asset("map.css"), MAPJS: asset("map.js"), LASTY: EM.lastYear, FONT: "/assets/fonts/" + font, chapeau: esc(emapChapeau(EM)), mapHead: esc(heads[EM.lastYear]), closestHead: esc(closestHead(EM)) };
    let h = fs.readFileSync(path.join(HERE, "template-emap.html"), "utf8")
      .replace(/\/\*\{\{SHARED:([a-z]+)\}\}\*\//g, (m, k) => sharedBlock(base, k)).replace("/*{{FILTERSCSS}}*/", "");
    h = h.replace(/\{\{([A-Za-z]+)\}\}/g, (m, k) => (k in words ? words[k] : m))
      .replace("{{PASTEVENTS}}", () => "[]")
      .replace("{{DATA}}", () => JSON.stringify(EM).replace(/</g, "\\u003c"))
      .replace("/*{{STARS}}*/", () => fs.readFileSync(path.join(HERE, "stars.js"), "utf8").trim());
    const unfilled = h.match(/\{\{[A-Za-z:]+\}\}/);
    if (unfilled) throw new Error("dawn: template-emap.html placeholder left unfilled: " + unfilled[0]);
    fs.mkdirSync(path.join(out, "electoral-map"), { recursive: true });
    emapFile = path.join(out, "electoral-map", "index.html");
    write(emapFile, h);
  }
  /* the decidedness page: the main site's Decidedness figures (decided-data.mjs); a dot opens its
     poll where the polls page has a row for it */
  let decidedFile = null;
  if (fs.existsSync(path.join(assets, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"))) {
    const source = path.join(HERE, "..", "newtracker", "assets");
    const rows = pollsPath && fs.existsSync(pollsPath) ? new Set(JSON.parse(fs.readFileSync(pollsPath, "utf8")).polls.map((p) => p.k)) : new Set();
    const DC = decidedData(assets, source, { keys: rows, key: (h, released) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + released });
    DC.terms = (JSON.parse(fs.readFileSync(path.join(assets, "dawn-data.json"), "utf8")).terms);
    DC.events = D.events;
    const words = { FONT: "/assets/fonts/" + font, asOf: esc(fdate(DC.asOf)), latestPoll: esc(latestPollLine(DC)),
      undecidedHead: esc(DC.story.head), undecidedDek: esc(DC.story.dek), softHead: "Voters who named a party but might change their mind", softDek: "% of those who named a party calling their vote soft, as two pollsters ask it",
      partyHead: esc(DC.party ? DC.party.head : ""), partyDek: esc(DC.party ? DC.party.dek : ""), partyNote: esc(DC.party ? DC.party.note : ""),
      ageHead: esc(DC.age ? DC.age.head : ""), ageDek: esc(DC.age ? DC.age.dek : ""), ageNote: esc(DC.age ? DC.age.note : "") };
    let h = fs.readFileSync(path.join(HERE, "template-decided.html"), "utf8")
      .replace(/\/\*\{\{SHARED:([a-z]+)\}\}\*\//g, (m, k) => sharedBlock(base, k)).replace("/*{{FILTERSCSS}}*/", "");
    h = h.replace(/\{\{([A-Za-z]+)\}\}/g, (m, k) => (k in words ? words[k] : m))
      .replace("/*{{CHARTWINDOWS}}*/", () => fs.readFileSync(path.join(HERE, "chart-windows.js"), "utf8"))
      .replace("/*{{POLLMETA}}*/", () => fs.readFileSync(path.join(HERE, "poll-meta.mjs"), "utf8").replaceAll("export function", "function"))
      .replace("{{PASTEVENTS}}", () => JSON.stringify(past).replace(/</g, "\\u003c"))
      .replace("{{DATA}}", () => JSON.stringify(DC).replace(/</g, "\\u003c"))
      .replace("/*{{STARS}}*/", () => fs.readFileSync(path.join(HERE, "stars.js"), "utf8").trim());
    const unfilled = h.match(/\{\{[A-Za-z:]+\}\}/);
    if (unfilled) throw new Error("dawn: template-decided.html placeholder left unfilled: " + unfilled[0]);
    fs.mkdirSync(path.join(out, "decidedness"), { recursive: true });
    decidedFile = path.join(out, "decidedness", "index.html");
    write(decidedFile, h);
  }
  /* the poll disagreement page: the main site's own figures, its engine run here (disagree-data.mjs) */
  let disagreeFile = null;
  if (fs.existsSync(path.join(assets, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"))) {
    const source = path.join(HERE, "..", "newtracker", "assets");
    const PD = disagreeData(assets, source);
    const tmpl = fs.readFileSync(path.join(HERE, "template-disagree.html"), "utf8");
    const words = { FONT: "/assets/fonts/" + font, chapeau: esc(splitChapeau(PD)), splitHead: esc(splitHead(PD)), splitDek: esc(splitDek(PD)), spreadHead: esc(spreadHead(PD)), spreadDek: esc(spreadDek(PD)),
                    leansHead: esc(PD.leans["tpp-lnp-imp"].head), leansDek: esc(PD.leans["tpp-lnp-imp"].dek) };
    let h = tmpl.replace(/\/\*\{\{SHARED:([a-z]+)\}\}\*\//g, (m, k) => sharedBlock(base, k)).replace("/*{{FILTERSCSS}}*/", "");
    h = h.replace(/\{\{([A-Za-z]+)\}\}/g, (m, k) => (k in words ? words[k] : m))
      .replace("{{PASTEVENTS}}", () => JSON.stringify(past).replace(/</g, "\\u003c"))
      .replace("{{DATA}}", () => JSON.stringify(PD).replace(/</g, "\\u003c"))
      .replace("/*{{STARS}}*/", () => fs.readFileSync(path.join(HERE, "stars.js"), "utf8").trim());
    const unfilled = h.match(/\{\{[A-Za-z:]+\}\}/);
    if (unfilled) throw new Error("dawn: template-disagree.html placeholder left unfilled: " + unfilled[0]);
    fs.mkdirSync(path.join(out, "poll-disagreement"), { recursive: true });
    disagreeFile = path.join(out, "poll-disagreement", "index.html");
    write(disagreeFile, h);
  }
  /* the public opinion page (po-data.mjs): the site's own catalogue component, styles and sidecar under
     a sunrise of its findings. Its script and data are sidecars of this page's own, hashed */
  let opinionFile = null;
  const oneOffsPath = path.join(assets, "oneoffs-source.json");
  if (fs.existsSync(oneOffsPath)) {
    const newtracker = path.join(HERE, "..", "newtracker");
    const src = JSON.parse(fs.readFileSync(oneOffsPath, "utf8"));
    const hashed = (stem, ext, body) => {
      const buf = Buffer.from(body), name = `${stem}.${hash8(buf)}.${ext}`;
      if (!fs.existsSync(path.join(out, name)) || !fs.readFileSync(path.join(out, name)).equals(buf)) write(path.join(out, name), buf);
      for (const f of fs.readdirSync(out))
        if (new RegExp(`^${stem}\\.[0-9a-f]{8}\\.${ext}$`).test(f) && f !== name && !keep(`dawn/${f}`)) fs.unlinkSync(path.join(out, f));
      return name;
    };
    const poJson = hashed("po", "json", fs.readFileSync(oneOffsPath, "utf8"));
    const poApp = hashed("po-app", "js", pubopApp(newtracker));
    const rows = fs.existsSync(pollsPath) ? JSON.parse(fs.readFileSync(pollsPath, "utf8")).polls.map((p) => p.k) : [];
    const linked = new Set(src.topics.flatMap((t) => t.blocks.flatMap((b) => (b.panels || []).flatMap((p) => p.points.filter((q) => q.rk)
      .map((q) => rowKey(q.rk))))));
    const PO = { asOf: D.asOf, terms: D.terms, slides: heroSlides(src), rows: rows.filter((k) => linked.has(k)) };
    const words = { FONT: "/assets/fonts/" + font, lede: esc(opinionLede(src, newestPublished(src))), POJSON: poJson, POAPP: poApp };
    let h = fs.readFileSync(path.join(HERE, "template-public-opinion.html"), "utf8")
      .replace(/\/\*\{\{SHARED:([a-z]+)\}\}\*\//g, (m, k) => sharedBlock(base, k)).replace("/*{{FILTERSCSS}}*/", "")
      .replace("/*{{PUBOPCSS}}*/", () => pubopCss(fs.readFileSync(path.join(newtracker, "template.html"), "utf8")));
    h = h.replace(/\{\{([A-Za-z]+)\}\}/g, (m, k) => (k in words ? words[k] : m))
      .replace("{{DATA}}", () => JSON.stringify(PO).replace(/</g, "\\u003c"))
      .replace("/*{{STARS}}*/", () => fs.readFileSync(path.join(HERE, "stars.js"), "utf8").trim());
    const unfilled = h.match(/\{\{[A-Za-z:]+\}\}/);
    if (unfilled) throw new Error("dawn: template-public-opinion.html placeholder left unfilled: " + unfilled[0]);
    fs.mkdirSync(path.join(out, "public-opinion"), { recursive: true });
    opinionFile = path.join(out, "public-opinion", "index.html");
    write(opinionFile, h);
  }
  return { opinion: opinionFile, emap: emapFile, decided: decidedFile, disagree: disagreeFile, cycles: cyclesFile, leaders: leadFile, mood: moodFile, polls: pollsFile, next: nextFile, file: path.join(out, "index.html"), bytes: Buffer.byteLength(html), hist: histName, groups: groupsName, ghist: ghUrl, weeks: D.weeks.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = buildDawn();
  console.log(`built dawn/index.html · ${(r.bytes / 1024).toFixed(0)} KB · ${r.weeks} weeks · ${r.hist}`);
}
