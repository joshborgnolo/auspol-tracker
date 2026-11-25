/* test-dawn.mjs – the /dawn/ trial design (.build/dawn/, gen-data §13).
   1. its data ends on the site's own figures: the last week's primaries are
      latest.primary, and the two-party lines end on the site's implied lines;
   2. every branch of the copy rules (copy.mjs) on mutated data, so a head
      can only claim what clears its margin;
   3. the built page: every placeholder filled, its data parses, its past
      terms' sidecar is on disk, the heads are today's rules;
   4. the next-polls page: the site's projection (np-project.js) and its words
      (next-copy.js) evaluated together on mocked Sydney clocks across the
      coming weeks, every head on its rule, and the branches no schedule this
      year reaches on hand-built rows; np-score's report read whole.
   Run: node .build/test-dawn.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { votesHead, votesDek, tppStory, flowsHead, flowNote, verdicts, copyFor } from "./dawn/copy.mjs";
import { latestPollLine, pollPublishedMs } from "./dawn/poll-meta.mjs";
import { buildDawn, flowTotals, readScore } from "./dawn/build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const A = path.join(HERE, "newtracker", "assets");
const D0 = JSON.parse(fs.readFileSync(path.join(A, "dawn-data.json"), "utf8"));
const clone = () => JSON.parse(JSON.stringify(D0));
const r1 = (v) => Math.round(v * 10) / 10;
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.equal(a, b, m); n++; };

/* the latest poll's publication age, rounded in the unit the reader is given */
{
  const P = { latestPoll: { h: "Essential", pub: "2026-11-25T01:00" } };
  const at = pollPublishedMs(P.latestPoll.pub), age = (ms) => latestPollLine(P, at + ms);
  eq(at, Date.parse("2026-11-24T14:00:00Z"), "the publication stamp is Sydney wall time, in daylight saving");
  eq(pollPublishedMs("2026-07-25T01:00"), Date.parse("2026-07-24T15:00:00Z"), "and outside daylight saving");
  eq(pollPublishedMs("2026-11-25T01:00:00+11:00"), at, "an explicit zone reads the same instant");
  eq(age(29000), "Latest poll is Essential’s, 0 minutes ago.");
  eq(age(31000), "Latest poll is Essential’s, 1 minute ago.");
  eq(age(59 * 60000 + 29000), "Latest poll is Essential’s, 59 minutes ago.");
  eq(age(59 * 60000 + 31000), "Latest poll is Essential’s, 60 minutes ago.");
  eq(age(3600000), "Latest poll is Essential’s, 1 hour ago.");
  eq(age(3 * 3600000 + 31 * 60000), "Latest poll is Essential’s, 4 hours ago.");
  eq(age(23 * 3600000 + 31 * 60000), "Latest poll is Essential’s, 24 hours ago.");
  eq(age(86400000), "Latest poll is Essential’s, 1 day ago.");
  eq(age(36 * 3600000), "Latest poll is Essential’s, 2 days ago.");
  for (const pub of [undefined, null, "", "2026-11-25"]) eq(latestPollLine({ latestPoll: { h: "Essential", pub } }, at), "Latest poll is Essential’s.", "no age when the clock time is unknown");
  eq(latestPollLine({}, at), "", "no latest-poll clause when no poll is on record");
}

/* ---- 1. the data ends on the site's figures ---------------------------- */
const asset = fs.readFileSync(path.join(A, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
const grab = (name) => { const m = asset.match(new RegExp(`const ${name} = (.*);\\n`)); assert.ok(m, "data asset lacks " + name); return JSON.parse(m[1]); };
const latest = grab("latest"), synth = grab("synth2pp"), synthOn = grab("synthOn"), events = grab("events");
const L = D0.weeks.length - 1;
for (const k of D0.parties) {
  eq(r1(D0.prim[k].v[L]), latest.primary[k], `last week's ${k} is the site's headline`);
  eq(D0.prim[k].v.length, D0.weeks.length, `${k}: one value a week`);
  ok(D0.prim[k].lo.every((lo, i) => lo <= D0.prim[k].v[i] && D0.prim[k].v[i] <= D0.prim[k].hi[i]), `${k}: every week inside its band`);
}
eq(D0.weeks[L], latest.updatedISO, "the last week is the newest poll's day");
eq(D0.tpp.imp.v.length, L, "two-party weeks start a week after polling day");
eq(r1(D0.tpp.imp.v[L - 1]), synth[synth.length - 1].alp, "implied v Coalition ends on the site's line");
eq(r1(D0.tpp.on.v[L - 1]), synthOn[synthOn.length - 1].a, "implied v One Nation ends on the site's line");
eq(D0.events.length, events.filter((e) => e.major || ["2026-02-12", "2025-12-08"].includes(e.date)).length, "the events the site's charts mark");
const T = flowTotals(D0);
eq(r1(T.lnp), r1(D0.tpp.imp.v[L - 1]), "the flow diagram's total is the chart's last implied figure");
eq(r1(T.on), r1(D0.tpp.on.v[L - 1]), "against One Nation too");
ok(D0.rank.length === D0.weeks.length && D0.rank.every((r) => r.length === D0.parties.length), "a ranking every week");

/* ---- 2. the copy rules, branch by branch -------------------------------- */
/* set today's primaries: { k: [v, lo, hi] }, the count left as it is */
const withNow = (o) => { const D = clone(); for (const [k, [v, lo, hi]] of Object.entries(o)) { D.prim[k].v[L] = v; D.prim[k].lo[L] = lo; D.prim[k].hi[L] = hi; } return D; };
const E = Object.fromEntries(D0.parties.map((k) => [k, D0.prim[k].v[0]]));   // the count
const flat = () => Object.fromEntries(D0.parties.map((k) => [k, [E[k], E[k] - 1, E[k] + 1]]));
eq(votesHead(withNow(flat())).head, "The primary vote is much where it was at the election", "nothing clears: much the same");
const grow = (k, f, lo) => withNow({ ...flat(), [k]: [E[k] * f, E[k] * lo, E[k] * f + 2] });
eq(votesHead(grow("onp", 2.6, 2.1)).head, "One Nation’s vote has more than doubled", "doubled, read off the interval's lower end");
eq(votesHead(grow("onp", 3.9, 3.6)).head, "One Nation’s vote has more than tripled", "tripled");
eq(votesHead(grow("onp", 4.6, 4.2)).head, "One Nation’s vote has more than quadrupled", "quadrupled");
eq(votesHead(grow("onp", 6, 5.4)).head, "One Nation’s vote has grown more than fivefold", "fivefold");
eq(votesHead(grow("onp", 2.2, 1.9)).head, "One Nation is up " + r1(E.onp * 1.2).toFixed(1) + " points since the election", "a point estimate past double whose interval is not: points");
const fall = (k, v, hi) => withNow({ ...flat(), [k]: [v, v - 1, hi] });
eq(votesHead(fall("lnp", E.lnp * 0.4, E.lnp * 0.48)).head, "The Coalition has lost more than half of its election vote", "half, read off the upper end");
eq(votesHead(fall("lnp", E.lnp * 0.6, E.lnp * 0.66)).head, "The Coalition has lost more than a third of its election vote", "a third");
eq(votesHead(fall("lnp", E.lnp * 0.7, E.lnp * 0.74)).head, "The Coalition has lost more than a quarter of its election vote", "a quarter");
eq(votesHead(fall("lnp", E.lnp * 0.76, E.lnp * 0.8)).head, "The Coalition has lost more than a fifth of its election vote", "a fifth");
eq(votesHead(fall("lnp", E.lnp - 3, E.lnp - 1)).head, "The Coalition is down 3.0 points since the election", "a small fall: points");
eq(votesHead(fall("grn", E.grn - 3, E.grn - 1)).head, "The Greens are down 3.0 points since the election", "a plural name takes a plural verb");
{
  const D = withNow({ ...flat(), onp: [E.onp * 3, E.onp * 2.5, E.onp * 3.5], alp: [E.alp - 5, E.alp - 6, E.alp - 4], lnp: [E.lnp - 4, E.lnp - 5, E.lnp - 3] });
  ok(votesDek(D).endsWith("Labor is down 5.0 points and the Coalition 4.0."), "two falls share a verb: " + votesDek(D));
  const D2 = withNow({ ...flat(), onp: [E.onp * 3, E.onp * 2.5, E.onp * 3.5], alp: [E.alp - 5, E.alp - 6, E.alp - 4], grn: [E.grn + 2, E.grn + 1, E.grn + 3] });
  ok(votesDek(D2).endsWith("Labor is down 5.0 points; the Greens are up 2.0."), "a fall and a rise: " + votesDek(D2));
  const D3 = withNow({ ...flat(), onp: [E.onp * 3, E.onp * 2.5, E.onp * 3.5] });
  ok(/election, %\.$/.test(votesDek(D3)), "nothing else clears: the dek describes the chart alone");
}
/* the two-party story (the site's rule) */
{
  const st = (onLast, coLast, ciOn = 1, ciCo = 1) => { const D = clone(); const m = D.months; m.on[m.on.length - 1] = [m.on[m.on.length - 1][0], onLast, ciOn]; m.imp[m.imp.length - 1] = [m.imp[m.imp.length - 1][0], coLast, ciCo]; return tppStory(D).head; };
  eq(st(51, 51.5), "One Nation now runs Labor as close as the Coalition does", "inside a point: as close");
  eq(st(50, 53, 1, 1), "One Nation now runs Labor closer than the Coalition does", "a gap past both margins: closer");
  eq(st(54, 51, 1, 1), "The Coalition still runs Labor closer than One Nation does", "the other way");
  eq(st(50, 52.5, 2, 2), "One Nation now runs Labor as close as the Coalition does", "a gap inside the combined margin: as close");
}
/* the flow diagram's verdicts, all nine pairs */
{
  const set = (lnp, on) => { const D = clone(); const i = D.tpp.imp.v.length - 1; D.tpp.imp.v[i] = lnp[0]; D.tpp.imp.ci[i] = lnp[1]; D.tpp.on.v[i] = on[0]; D.tpp.on.cs[i] = on[1]; D.tpp.on.cf[i] = 0; return D; };
  const L_ = [54, 1], T_ = [50.5, 1.4], R_ = [46, 1];
  const cases = [
    [L_, L_, "After preferences, Labor leads either rival"],
    [T_, T_, "After preferences, Labor is level with either rival"],
    [R_, R_, "After preferences, both rivals lead Labor"],
    [L_, T_, "After preferences, Labor leads the Coalition but is level with One Nation"],
    [T_, L_, "After preferences, Labor leads One Nation but is level with the Coalition"],
    [L_, R_, "After preferences, Labor leads the Coalition but trails One Nation"],
    [R_, L_, "After preferences, Labor leads One Nation but trails the Coalition"],
    [R_, T_, "After preferences, Labor trails the Coalition but is level with One Nation"],
    [T_, R_, "After preferences, Labor trails One Nation but is level with the Coalition"],
  ];
  for (const [a, b, want] of cases) eq(flowsHead(set(a, b)), want, "flows head " + JSON.stringify([a, b]));
  ok(verdicts(set(T_, T_)).lnp.margin === 2.8, "the margin as the site prints it: twice the interval");
}
/* the note under the diagram */
{
  const D = clone();
  ok(/^Preferences (widen|narrow) Labor’s lead over the Coalition from \d+\.\d points on first preferences to \d+\.\d/.test(flowNote(D, "lnp", flowTotals(D).lnp)), "today's note");
  D.nowShares = { ...D.nowShares, alp: 24, lnp: 26 };
  ok(/^Preferences turn Labor’s 2\.0-point deficit against the Coalition on first preferences into a/.test(flowNote(D, "lnp", 52)), "a deficit turned: " + flowNote(D, "lnp", 52));
  ok(/inside the ±/.test(flowNote(D0, "lnp", 50.6)) === (verdicts(D0).lnp.who === null), "inside the margin exactly when the verdict is level");
}

/* ---- 3. the built page --------------------------------------------------- */
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-"));
  fs.mkdirSync(path.join(tmp, "assets", "fonts"), { recursive: true });
  const font = fs.readdirSync(path.join(ROOT, "assets", "fonts")).find((f) => /^commissioner-latin\./.test(f));
  ok(!!font, "the site serves the face the page asks for");
  fs.copyFileSync(path.join(ROOT, "assets", "fonts", font), path.join(tmp, "assets", "fonts", font));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
  if (fs.existsSync(path.join(ROOT, "data", "np-report.md"))) fs.copyFileSync(path.join(ROOT, "data", "np-report.md"), path.join(tmp, "data", "np-report.md"));
  const r = buildDawn({ root: tmp, assets: A });
  const html = fs.readFileSync(r.file, "utf8");
  ok(!/\{\{[A-Za-z]+\}\}|\/\*\{\{STARS\}\}\*\//.test(html), "every placeholder filled");
  ok(fs.existsSync(path.join(tmp, "dawn", r.hist)), "the past terms' sidecar is beside the page");
  ok(html.includes(`href="${r.hist}"`), "and the page names it");
  ok(html.includes(`/assets/fonts/${font}`), "the face from the site's fonts");
  const data = JSON.parse(html.match(/<script id="dawn-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  eq(data.weeks.length, D0.weeks.length, "the page carries the data");
  /* the bar's backdrop is the sky drawn again inside .sky (so it inherits the sky's colours), clipped as the hero
     is, slid one px per px of scroll; this term's lines open on the 2025 count; lines stop at the plot's edges */
  ok(/<div class="sky"[\s\S]*?<div class="twin"><div class="tsky"[\s\S]*?<\/div>\s*<div class="grain" id="grain"/.test(html), "the bar's sky sits inside the hero's sky");
  ok(/\.tsky\{[^}]*overflow:hidden/.test(html) && /translateY\(-8192px\)/.test(html) && /animation-range:0px 8192px/.test(html), "the bar's sky is clipped like the hero and slides with the scroll");
  ok(/\.menu-on \.twin\{visibility:hidden\}/.test(html) && !/\.nav\{[^}]*background:var\(--bg\)/.test(html), "the open menu shows through the bar; the bar itself has no fill");
  ok(/if\(i0===0&&iS<=1\)\{const c=EST\[k\]\[0\]\.m;pts\.push\(\{x:ELX,y:c\}\)/.test(html) && /const open=\(c,a,band\)=>c==='lnp'&&cnt0!=null/.test(html), "this term's primary and Labor v Coalition lines open on the 2025 count");
  ok(/<clipPath id="\$\{cid\}"><rect x="\$\{ML\}" y="\$\{MT-8\}" width="\$\{PW\}"/.test(html), "lines and bands clip at the plot's edges");
  const scale = html.match(/S\.y0=0;S\.y1=([^;]+);/);
  ok(!!scale, "the primaries chart's y-axis rule is in the page");
  const primaryYMax = new Function("ys", `return ${scale[1]}`);
  eq(primaryYMax([59.76]), 60, "July 1975's measured peak leaves the All-view axis at 60, not 70");
  eq(primaryYMax([59.32]), 60, "the inferred support peak uses the same axis");
  eq(primaryYMax([60.01]), 70, "a reading actually above 60 still reaches the next rung");
  const C = copyFor(D0);
  for (const k of ["votesHead", "tppHead", "flowsHead"]) ok(html.includes(C[k].replace(/&/g, "&amp;")), k + " in the page");
  ok(html.includes('name="robots" content="noindex"'), "a trial: kept out of search");
  ok(/const STARS=\[/.test(html), "the sky's stars");
  ok(!html.includes(".skyset") && !html.includes('role="radiogroup" aria-label="Sky"'), "Sky’s Auto, Sunrise and Sunset controls are absent");
  ok(html.includes("const pickMode=") && html.includes("sky.dataset.mode=mode"), "Sky stays automatic by local time instead of a menu choice");
  ok(/window\.AP\.pmEngine\s*=/.test(html), "the browser copy of the model, for the pollster menu");
  ok(!!r.groups && fs.existsSync(path.join(tmp, "dawn", r.groups)) && html.includes(`href="${r.groups}"`), "the vote-by-group sidecar beside the page, named by it");
  ok(/^ghist\.[0-9a-f]{8}\.json$/.test(r.ghist) && fs.existsSync(path.join(tmp, "dawn", r.ghist)) && html.includes(`href="${r.ghist}"`), "the groups' past terms in a sidecar of the page's own");
  ok(!/href="#lead"/.test(html) && /href="polls\/"/.test(html), "one votes link, and the polls page");
  /* the polls page: every poll a dot can open has its row */
  ok(!!r.polls && fs.existsSync(r.polls), "the polls page is built");
  const ph = fs.readFileSync(r.polls, "utf8");
  ok(!/\{\{[A-Za-z]+\}\}/.test(ph), "every polls-page placeholder filled");
  const PL = JSON.parse(ph.match(/<script id="polls-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).polls;
  const keys = new Set(PL.map((q) => q.k));
  eq(keys.size, PL.length, "each poll's address is its own");
  ok(D0.polls.every((q) => keys.has(q.k)), "every chart poll's dot has a row to open");
  ok(PL.every((q, i) => !i || PL[i - 1].d >= q.d), "newest first");
  ok(/href="\.\.\/#votes"/.test(ph), "the polls page leads back to the votes pages");
  /* the pages point inside dawn/ but for the favicon and the face: a site
     asset renamed by a commit made without this page would tear the tree */
  ok(!!r.next && fs.existsSync(r.next), "the next-polls page is built");
  const nh = fs.readFileSync(r.next, "utf8");
  ok(!/\{\{[A-Za-z]+\}\}/.test(nh), "every next-page placeholder filled");
  ok(/window\.AP\.nextPolls\s*=\s*npProject/.test(nh) && /AP\.nextWords\s*=/.test(nh), "the site's projection and its words, inlined");
  const NX = JSON.parse(nh.match(/<script id="next-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  ok(NX.pollCadence.length >= 5 && NX.pollCadence.every((c) => c.tracked !== "confidence"), "every house on a pattern, the confidence gauges left out");
  ok(!!NX.score && NX.score.overall.n > 0, "np-score's record rides along");
  ok(/href="\.\.\/next\/"/.test(ph) && /href="\.\.\/polls\/"/.test(nh) && !/>next polls</.test(html + ph + nh), "the two polls pages link each other through their tabs; no menu lists next polls");
  const outside = [html, ph, nh].flatMap((h) => [...h.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]))
    .filter((u) => u !== "/assets/favicon.svg" && u !== `/assets/fonts/${font}`);
  eq(outside.length, 0, "every local reference stays inside dawn/ " + outside.join(", "));
  ok(/class="logo"/.test(html) && /class="logo"/.test(ph) && /\.nav:not\(\.over\) \.logo\{/.test(html), "the mark's sun, shown once the hero has gone");
  fs.rmSync(tmp, { recursive: true, force: true });
}
/* ---- 4. the next-polls page: the projection and its words on mocked clocks -------- */
{
  const ND = JSON.parse(fs.readFileSync(path.join(A, "dawn-next.json"), "utf8"));
  const ctx = vm.createContext({ Intl, console });
  ctx.window = ctx;
  ctx.AP = { D: { pollCadence: ND.pollCadence, subCadence: ND.subCadence } };
  vm.runInContext(fs.readFileSync(path.join(A, "np-project.js"), "utf8"), ctx, { filename: "np-project.js" });
  vm.runInContext(fs.readFileSync(path.join(HERE, "dawn", "next-copy.js"), "utf8"), ctx, { filename: "next-copy.js" });
  const W = ctx.AP.nextWords, DAY = 86400000;
  const score = readScore(path.join(ROOT, "data", "np-report.md"));
  if (fs.existsSync(path.join(ROOT, "data", "np-report.md"))) {
    ok(!!score, "np-score's report reads: its overall line has the shape the reader expects");
    ok(score.overall.n >= score.overall.h && Object.keys(score.houses).length > 0 && Object.keys(score.ledger).length > 0 && !!score.sinceLabel, "its houses, its ledger and when it began");
  }
  const RULE = {
    today: /^.+ (is|are) due (tonight|this afternoon|this morning|today)$/,
    notout: /^.+ (was due today and isn’t out yet|were due today and aren’t out yet)$/,
    late: /^.+ (is|are) (a day |\w+ days )?late$/,
    next: /^.+ (is|are) due (tomorrow|on (Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day|on \d{1,2} [A-Z][a-z]+)$/,
    window: /^(.+ is expected \d{1,2}[–\d ]*[A-Z][a-z]+.*|.+’s window is open)$/,
    summer: /^Polls return after the summer break$/,
    none: /^No polls are scheduled$/,
  };
  /* sweep the coming eleven weeks at four times of day, the clock as the page reads it (Sydney) */
  const today = Date.UTC(...new Date().toISOString().slice(0, 10).split("-").map((v, i) => +v - (i === 1 ? 1 : 0)));
  const seen = {};
  for (let d = 0; d < 77; d++) for (const mins of [6 * 60, 12 * 60 + 30, 19 * 60, 22 * 60 + 30]) {
    const proj = ctx.AP.nextPolls({ day: today + d * DAY, mins }, { horizonDays: 49, includeTracked: true });
    const c = W.copy(proj, score);
    assert.ok(RULE[c.kind] && RULE[c.kind].test(c.head), `head off its rule (${c.kind}): ${c.head}`);
    assert.ok(/next four weeks/.test(c.dek), "the dek counts the four weeks: " + c.dek);
    assert.ok(!proj.rows.filter((r) => r.tracked).some((r) => c.lead.includes(r.pollster)), "no direction or issues survey is ever the next poll");
    (seen[c.kind] ||= c.head);
  }
  n++;
  for (const k of ["today", "next", "summer"]) ok(!!seen[k], `the sweep reaches the ${k} head (${Object.keys(seen).join(", ")})`);
  ok(!!(seen.late || seen.notout), "the sweep reaches a slot passed with no poll on record");
  /* the branches no schedule this year need reach, on hand-built rows */
  const T = today, row = (o) => ({ ahead: 0, loose: false, overdue: false, missed: false, inDays: 0, release: T, spread: 0, winHalf: 0, opensIn: 0, closesIn: 0, cadence: 14, ...o });
  const C = (rows) => W.copy({ rows, t0: T, nowMs: T + 9 * 3600000 }, null);
  eq(C([row({ pollster: "A", releaseFrom: 19 * 60, releaseTo: 20 * 60 }), row({ pollster: "B", releaseFrom: 18 * 60, releaseTo: 18 * 60 })]).head, "A and B are due tonight", "two due tonight");
  eq(C([row({ pollster: "A", releaseFrom: 9 * 60, releaseTo: 10 * 60 }), row({ pollster: "B", releaseFrom: 18 * 60, releaseTo: 18 * 60 })]).head, "A and B are due today", "hours that straddle the day: today");
  eq(C([row({ pollster: "A" })]).head, "A is due today", "an untimed house: today");
  eq(C([row({ pollster: "A", overdue: true, releaseFrom: 480, releaseTo: 480 })]).head, "A was due today and isn’t out yet", "its hour passed");
  eq(C([row({ pollster: "A", inDays: -1, overdue: true, missed: true, release: T - DAY }), row({ pollster: "B", inDays: -2, overdue: true, release: T - 2 * DAY })]).head, "A and B are late", "late by different days");
  eq(C([row({ pollster: "A", inDays: 3, release: T + 3 * DAY })]).head, "A is due on " + W.WDF[new Date(T + 3 * DAY).getUTCDay()], "inside the week: the weekday");
  eq(C([row({ pollster: "A", inDays: 12, release: T + 12 * DAY })]).head, "A is due on " + W.dmf(T + 12 * DAY), "further out: the date");
  eq(C([row({ pollster: "A", loose: true, inDays: 9, release: T + 9 * DAY, spread: 4, opensIn: 5, closesIn: 13 })]).head, "A is expected " + W.spanF(T + 5 * DAY, T + 13 * DAY), "a window ahead");
  eq(C([row({ pollster: "A", loose: true, inDays: 2, release: T + 2 * DAY, spread: 4, opensIn: -2, closesIn: 6 })]).head, "A’s window is open", "a window open");
  eq(C([row({ pollster: "A", loose: true, summer: true, inDays: 40, release: T + 40 * DAY, spread: 11, opensIn: 29, closesIn: 51 })]).head, "Polls return after the summer break", "the summer break");
  eq(C([]).head, "No polls are scheduled", "nothing on the schedule");
  eq(C([row({ pollster: "A", tracked: "direction", inDays: 1, release: T + DAY }), row({ pollster: "B", inDays: 5, release: T + 5 * DAY })]).lead.join(), "B", "a direction survey is no next poll");
  eq(C([row({ pollster: "A" }), row({ pollster: "B" }), row({ pollster: "C" }), row({ pollster: "D" })]).head, "Four polls are due today", "four or more are counted");
}
/* linked from nowhere */
{
  const hits = ["index.html", "info/index.html", "allpolls/index.html"].filter((f) => fs.existsSync(path.join(ROOT, f)) && /href="\/?dawn\//.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  eq(hits.length, 0, "no page links /dawn/");
}
console.log(`PASS: dawn – ${n} checks: data ends on the site's figures, every copy branch, the built pages, the next polls on mocked clocks`);
