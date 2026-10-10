/* wv-copy-rules.mjs - the Who-votes headline, dek and composition-trend copy
   follow their written rules on the live pool AND on built scenarios.

   Runs the COMPILED generators the page itself calls (rdDemoHead,
   rdDemoDek, rdDemoShift: top-level functions in the built index.html, so
   page.evaluate reaches them) against:
   1. the live pool - the rendered head/dek match the generators, and every
      claim names only groups whose dot is filled;
   2. scripted scenarios on a flat payload (every group level with all
      voters, so each case sets only what it tests) - including the three
      overlap questions of 2026-10-11: Gen Z v 18–34, opposite leans on one
      scale v across states, 55+ beside Gen X and Boomers;
   3. 300 randomised payloads - invariants that must hold for any pool;
   4. composition-trend cases on mutated demoTrend moves.
   Usage: BASE=<checkout> node .matilda/probe/wv-copy-rules.mjs */
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(import.meta.url);
let puppeteer;
try { puppeteer = require("puppeteer-core"); } catch { puppeteer = createRequire(path.join(process.cwd(), "package.json"))("puppeteer-core"); }

const BASE = process.env.BASE || process.cwd();
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }

const fails = [];
const check = (ok, msg, got) => { console.log((ok ? "  ok " : "FAIL ") + msg + (ok || got === undefined ? "" : "\n       got: " + JSON.stringify(got))); if (!ok) fails.push(msg); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.setViewport({ width: 1200, height: 900 });
await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("#who-votes .rd-hed", { timeout: 30000 });
check(!errs.length, "page loads without errors", errs);
const ready = await page.evaluate(() => typeof rdDemoHead === "function" && typeof rdDemoDek === "function" && typeof rdDemoShift === "function");
check(ready, "the compiled generators are reachable");
if (!ready) { await browser.close(); process.exit(1); }

/* ---- 1. the live pool -------------------------------------------------- */
console.log("\n1. live pool");
const live = await page.evaluate(() => {
  const T = window.AUSPOL.demographics;
  return ["onp", "alp", "lnp", "grn", "oth"].map((p) => {
    const r = rdDemoHead(T, p), G = rdDemoStand(T, p);
    return { p, head: r.head, kept: r.kept, bad: r.kept.flatMap((c) => (c.trait === "gender" || c.trait === "language") ? []
      : c.labels.filter((l) => !(G[l] && G[l].sig && G[l].dir === c.dir))) };
  });
});
for (const l of live) {
  console.log("     " + l.p + ": " + l.head);
  check(l.bad.length === 0, l.p + ": every named group's dot is filled, leaning the claimed way", l.bad);
}
// the rendered page shows exactly the generators' output (default chip and tab, then a chip/tab walk)
const shown = await page.evaluate(() => ({ head: document.querySelector("#who-votes .rd-hed").textContent, dek: document.querySelector("#who-votes .rd-dek").textContent }));
const want = await page.evaluate(() => { const T = window.AUSPOL.demographics; return { head: rdDemoHead(T, "onp").head, dek: rdDemoDek(T, T.tabs[0], "onp") }; });
check(shown.head === want.head, "rendered head = rdDemoHead (One Nation)", shown.head);
check(shown.dek === want.dek, "rendered dek = rdDemoDek (One Nation, Age)", shown.dek);
const chips = ["onp", "alp", "lnp", "grn", "oth"];
for (let c = 0; c < chips.length; c++) {
  await page.evaluate((c) => document.querySelectorAll("#who-votes .rd-chip")[c].click(), c);
  await new Promise((r) => setTimeout(r, 650));
  const tabs = await page.$$eval("#who-votes .rd-wv-tabs .rd-tab", (els) => els.length);
  for (let t = 0; t < tabs; t++) {
    await page.evaluate((t) => document.querySelectorAll("#who-votes .rd-wv-tabs .rd-tab")[t].click(), t);
    await new Promise((r) => setTimeout(r, 120));
    const got = await page.evaluate((p, t) => {
      const T = window.AUSPOL.demographics;
      return { head: document.querySelector("#who-votes .rd-hed").textContent, dek: document.querySelector("#who-votes .rd-dek").textContent,
               wHead: rdDemoHead(T, p).head, wDek: rdDemoDek(T, T.tabs[t], p) };
    }, chips[c], t);
    if (got.head !== got.wHead || got.dek !== got.wDek) check(false, chips[c] + " tab " + t + ": rendered copy = generators", got);
  }
}
check(true, "chip x tab walk: rendered copy = generators everywhere it was checked above");

/* ---- 2. scripted scenarios --------------------------------------------- */
console.log("\n2. scenarios (flat payload: every group level with all voters, ±3)");
const scen = await page.evaluate(() => {
  const base = window.AUSPOL.demographics;
  const flat = () => {
    const T = JSON.parse(JSON.stringify(base));
    for (const tab of T.tabs) for (const st of tab.sets) for (const g of st.groups)
      for (const k of Object.keys(g.v)) { g.v[k] = T.all[k]; g.ci[k] = 3; }
    return T;
  };
  // set(T, "Gen Z", +20, 3): the group's One Nation figure all + d, margin ci
  const set = (T, label, d, ci = 3, p = "onp") => {
    for (const tab of T.tabs) for (const st of tab.sets) for (const g of st.groups)
      if (g.label === label) { g.v[p] = T.all[p] + d; g.ci[p] = ci; }
    return T;
  };
  const run = (muts) => { const T = flat(); for (const m of muts) set(T, ...m); return { head: rdDemoHead(T, "onp").head, T }; };
  const dekOf = (T, tabId) => rdDemoDek(T, T.tabs.find((t) => t.id === tabId), "onp");
  const out = {};
  out.none = run([]).head;
  out.noneDeks = (() => { const T = flat(); return T.tabs.map((t) => rdDemoDek(T, t, "onp")); })();
  // Q1: Gen Z and 18–34 both significant
  out.genzClear = run([["18–34", 10, 2], ["Gen Z", 20, 4]]).head;
  out.genzClose = run([["18–34", 10, 2], ["Gen Z", 11, 4]]).head;
  out.genzOnly = run([["Gen Z", 12, 4]]).head;
  // Q2: opposite leans - one scale v unordered states
  out.innerRural = run([["Inner metro", 6, 2], ["Rural", -6, 2]]).head;
  out.innerOuter = run([["Inner metro", 6, 2], ["Outer metro", -4, 2]]).head;
  out.vicNsw = run([["Vic", 5, 2], ["NSW", -5, 2]]).head;
  out.vicNswDek = (() => { const r = run([["Vic", 5, 2], ["NSW", -5, 2]]); return dekOf(r.T, "place"); })();
  // Q3: 55+ beside Gen X and Boomers
  out.oldAll = run([["55+", 5, 2], ["Gen X", 6, 3], ["Boomers", 5.5, 3]]).head;
  out.boomClear = run([["55+", 5, 2], ["Boomers", 12, 3]]).head;
  // rulers contradicting
  const contra = run([["55+", 3, 2], ["Boomers", -3, 2]]);
  out.contra = contra.head;
  out.contraDek = dekOf(contra.T, "age");
  // pairs said once, from the right side
  out.womenDown = run([["Women", -3, 2]]).head;
  out.engUp = run([["English only", 3, 2]]).head;
  // the bucket
  out.bucketFold = run([["Non-NSW/Vic/Qld", -4, 2], ["SA", -5, 2]]).head;
  out.bucketBreak = run([["Non-NSW/Vic/Qld", -4, 2], ["WA", 6, 2]]).head;
  // retirement against the age claim
  out.retiredOld = run([["55+", 5, 2], ["Retired", 8, 3]]).head;
  out.retiredAlone = run([["Retired", 8, 3]]).head;
  // neighbours merge; a 3-of-4 pole is said from the one left
  out.regional = run([["Provincial", 5, 2], ["Rural", 7, 2], ["Inner metro", -8, 2]]).head;
  out.notInner = run([["Outer metro", 3, 2], ["Provincial", 5, 2], ["Rural", 7, 2], ["Inner metro", -8, 2]]).head;
  out.noDegree = run([["Year 12 or less", 5, 2], ["TAFE or trade", 3, 2], ["University", -10, 2]]).head;
  // only negatives
  out.onlyNeg = run([["Rural", -7, 2], ["Own outright", -4, 2]]).head;
  // room: a crowded pool keeps five claims, four up, three down at most
  const crowd = run([["55+", 6, 2], ["Women", 3, 1], ["University", 6, 2], ["Rural", 7, 2], ["Qld", 6, 2], ["Renting", 5, 2],
    ["Other language", -8, 2], ["Vic", -4, 2], ["Part time", -5, 2], ["Full time", 4, 2]]);
  const ck = rdDemoHead(crowd.T, "onp").kept;
  out.crowd = { head: crowd.head, n: ck.length, up: ck.filter((c) => c.dir > 0).length, down: ck.filter((c) => c.dir < 0).length };
  // the dek: a filled dot never sits under "much the same"
  out.markDek = (() => { const r = run([["University", 3, 2]]); return dekOf(r.T, "education"); })();
  // a small but significant gap prints as percentages, not fractions that double it
  out.gapDek = (() => { const r = run([["Men", 1.25, 0.6], ["Women", -1.25, 0.6]]); return dekOf(r.T, "gender"); })();
  return out;
});
const has = (s, re) => re.test(s);
check(scen.none === "One Nation voters look much like the electorate as a whole", "nothing significant: the plain fallback", scen.none);
check(scen.noneDeks.every((d) => /much the same/.test(d) && !/more likely|less likely/.test(d)), "nothing significant: every tab says much the same", scen.noneDeks);
console.log("     Q1 " + scen.genzClear + "\n        " + scen.genzClose + "\n        " + scen.genzOnly);
check(has(scen.genzClear, /be Gen Z/) && !/18–34/.test(scen.genzClear), "Q1: Gen Z's gap clears 18–34's margin -> Gen Z named, not 18–34", scen.genzClear);
check(has(scen.genzClose, /be 18–34/) && !/Gen Z/.test(scen.genzClose), "Q1: Gen Z within 18–34's margin -> the band (18–34) named, Gen Z not", scen.genzClose);
check(has(scen.genzOnly, /be Gen Z/), "Q1: Gen Z alone significant -> Gen Z named", scen.genzOnly);
console.log("     Q2 " + scen.innerRural + "\n        " + scen.innerOuter + "\n        " + scen.vicNsw);
check(has(scen.innerRural, /inner-metro/) && !/rural/.test(scen.innerRural), "Q2: inner metro up, rural down = one tilt -> named once, from the over-represented end", scen.innerRural);
check(has(scen.innerOuter, /inner-metro/) && has(scen.innerOuter, /live in an outer metro/), "Q2: inner up, outer down (short of the far end) -> both named", scen.innerOuter);
check(has(scen.vicNsw, /Victorian/) && has(scen.vicNsw, /live in NSW/), "Q2: Victoria up, NSW down - states have no order -> both named", scen.vicNsw);
check(has(scen.vicNswDek, /Victorians/) && has(scen.vicNswDek, /NSW voters/) && !/much the same/.test(scen.vicNswDek), "Q2: the Place dek names both states with their figures", scen.vicNswDek);
console.log("     Q3 " + scen.oldAll + "\n        " + scen.boomClear);
check(has(scen.oldAll, /be 55\+/) && !/Gen X|Boomers/.test(scen.oldAll), "Q3: 55+, Gen X and Boomers all up -> one age claim, the band (55+)", scen.oldAll);
check(has(scen.boomClear, /be Boomers/) && !/55\+/.test(scen.boomClear), "Q3: Boomers' gap clears 55+'s margin -> Boomers stand in", scen.boomClear);
check(!/55\+|Boomers|older/.test(scen.contra), "rulers disagree (55+ up, Boomers down) -> no age claim in the head", scen.contra);
check(/disagree/.test(scen.contraDek) && /over-55s/.test(scen.contraDek) && /Boomers/.test(scen.contraDek), "rulers disagree -> the Age dek says so", scen.contraDek);
check(/be men/.test(scen.womenDown), "gender: women significantly below -> said as 'men'", scen.womenDown);
check(/less likely to speak a language other than English at home/.test(scen.engUp), "language: English-only above -> 'less likely to speak a language other than English'", scen.engUp);
check(/non-eastern-mainland/.test(scen.bucketFold) && !/South Australia/.test(scen.bucketFold), "bucket and a member lean the same way -> the bucket speaks for it", scen.bucketFold);
check(/West Australian/.test(scen.bucketBreak) && !/non-eastern-mainland/.test(scen.bucketBreak), "a member breaks from its bucket -> the bucket is dropped, the member named", scen.bucketBreak);
check(/55\+/.test(scen.retiredOld) && !/retired/.test(scen.retiredOld), "retired only repeats an older age claim -> left out", scen.retiredOld);
check(/retired/.test(scen.retiredAlone), "retired with no age claim -> named", scen.retiredAlone);
check(/regional/.test(scen.regional) && !/inner metro/.test(scen.regional), "provincial + rural -> 'regional'; inner metro's deficit is the same tilt", scen.regional);
check(/less likely to live in an inner metro/.test(scen.notInner) && !/outer-metro|provincial|rural/.test(scen.notInner), "three of four areas up, no name for them -> said from the one left", scen.notInner);
check(/without a degree/.test(scen.noDegree) && !/university/.test(scen.noDegree), "Year 12 or less + TAFE up, university down -> 'without a degree'", scen.noDegree);
check(/^One Nation voters are less likely to /.test(scen.onlyNeg) && !/more likely/.test(scen.onlyNeg), "only negatives -> a 'less likely' head", scen.onlyNeg);
check(scen.crowd.n === 5 && scen.crowd.up <= 4 && scen.crowd.down <= 3, "a crowded pool: five claims, at most four up, three down", scen.crowd);
console.log("     crowd: " + scen.crowd.head);
check(/University graduates \(\d+\.\d%\) are more likely than voters overall/.test(scen.markDek) && !/much the same/.test(scen.markDek), "a filled dot with no pair difference -> named with its figure, never 'much the same'", scen.markDek);
check(/\d+\.\d% of men/.test(scen.gapDek), "a gap the fractions would double prints as percentages", scen.gapDek);

/* ---- 3. randomised payloads: invariants -------------------------------- */
console.log("\n3. 300 randomised pools");
const rnd = await page.evaluate(() => {
  const base = window.AUSPOL.demographics;
  let seed = 20261011;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const SCALES = RD_DEMO_SCALE;
  const issues = [];
  for (let n = 0; n < 300; n++) {
    const T = JSON.parse(JSON.stringify(base));
    for (const tab of T.tabs) for (const st of tab.sets) for (const g of st.groups) for (const k of Object.keys(g.v)) {
      g.ci[k] = 1 + rand() * 6;
      g.v[k] = Math.max(0.5, T.all[k] + (rand() - 0.5) * 24 * (rand() < 0.5 ? 0.3 : 1));
    }
    for (const p of ["onp", "alp", "lnp", "grn", "oth"]) {
      const r = rdDemoHead(T, p), G = rdDemoStand(T, p);
      const say = (m) => issues.push(n + "/" + p + ": " + m + " | " + r.head);
      // every kept claim's groups lean the claimed way and are filled
      for (const c of r.kept) {
        if (c.trait === "gender" || c.trait === "language") continue;
        if (c.labels.some((l) => !(G[l] && G[l].sig && G[l].dir === c.dir))) say("claim on an unfilled or wrong-way group " + c.key);
      }
      // one claim per trait and direction
      const seen = new Set();
      for (const c of r.kept) { const k = c.trait + c.dir; if (seen.has(k)) say("two claims " + k); seen.add(k); }
      // an ordered trait never carries both ends of one tilt
      for (const [trait, set] of [["education", "education"], ["area", "location"], ["home", "housing"]]) {
        const up = r.kept.find((c) => c.trait === trait && c.dir > 0), dn = r.kept.find((c) => c.trait === trait && c.dir < 0);
        if (up && dn) {
          const ord = SCALES[set], pi = up.labels.map((l) => ord.indexOf(l)), ni = dn.labels.map((l) => ord.indexOf(l));
          const tilted = (Math.max(...pi) < Math.min(...ni) && pi.includes(0) && ni.includes(ord.length - 1)) || (Math.min(...pi) > Math.max(...ni) && pi.includes(ord.length - 1) && ni.includes(0));
          if (tilted) say("both ends of one " + trait + " tilt");
        }
      }
      // rulers disagreeing -> no age claim
      const split = [["Gen Z", "18–34"], ["Boomers", "55+"]].some(([a, b]) => G[a] && G[b] && G[a].sig && G[b].sig && G[a].dir !== G[b].dir);
      if (split && r.kept.some((c) => c.trait === "age")) say("age claimed while the rulers disagree");
      // room
      if (r.kept.length > 5 || r.kept.filter((c) => c.dir > 0).length > 4 || r.kept.filter((c) => c.dir < 0).length > 3) say("over the room");
      // prose hygiene
      if (/ {2}|undefined|null|NaN|,,|\.$| ;/.test(r.head)) say("bad text");
      if (/ACT\/NT\/Tas|Non-NSW/.test(r.head)) say("raw label in the head");
      for (const tab of T.tabs) {
        const d = rdDemoDek(T, tab, p);
        if (/ {2}|undefined|null|NaN|outlier|ACT\/NT\/Tas|Non-NSW|\.\./.test(d) || !/\.$/.test(d)) issues.push(n + "/" + p + "/" + tab.id + ": bad dek | " + d);
        // "much the same" only where no dot in that set is filled
        for (const st of tab.sets) {
          const filled = st.groups.some((g) => g.v[p] != null && Math.abs(g.v[p] - T.all[p]) > (g.ci[p] || 0));
          const same = new RegExp("much the same across " + (DEMO_SET_WORDS[st.id] || {}).all).test(d);
          if (filled && same) issues.push(n + "/" + p + "/" + st.id + ": 'much the same' over a filled dot | " + d);
        }
      }
    }
  }
  return issues;
});
check(rnd.length === 0, "300 random pools x 5 parties: no invariant broken (" + rnd.length + " issues)", rnd.slice(0, 6));

/* ---- 4. the composition trend ------------------------------------------ */
console.log("\n4. composition trend");
const tr = await page.evaluate(() => {
  const T = window.AUSPOL.demographics, DT = window.AUSPOL.demoTrend;
  const mv = (o) => ({ tab: "place", set: "state", setLabel: "By state", dir: 1, tAbs: 3, tLR: 3, thin: false, months: 12, g0: 30, g1: 30, a0: 30, a1: 25, ...o });
  const mk = (moves) => ({ windowYm: "2025-07", moves, rows: [] });
  const out = {};
  out.payloadAgree = Object.values(DT).every((d) => d.moves.every((m) => Math.sign(m.tAbs) === Math.sign(m.tLR)));
  out.live = ["onp", "alp", "lnp", "grn", "oth"].map((p) => rdDemoShift(DT[p], T, p));
  out.bucket = rdDemoShift(mk([mv({ group: "Non-NSW/Vic/Qld" })]), T, "alp");
  out.trio = rdDemoShift(mk([mv({ group: "ACT/NT/Tas" })]), T, "alp");
  out.rising = rdDemoShift(mk([mv({ group: "Vic", dir: -1, tAbs: -3, tLR: -3, g0: 10, g1: 20, a0: 8, a1: 27 })]), T, "onp");
  out.slower = rdDemoShift(mk([mv({ tab: "place", set: "location", group: "Rural", g0: 30, g1: 27, a0: 30, a1: 24 })]), T, "lnp");
  out.lnpGroup = rdDemoShift(mk([mv({ tab: "home", set: "housing", group: "Renting", dir: -1, tAbs: -3, tLR: -3, g0: 25, g1: 15, a0: 25, a1: 20 })]), T, "lnp");
  out.thinHeld = rdDemoShift(mk([
    mv({ group: "Vic", tLR: 5 }), mv({ tab: "home", set: "housing", group: "Renting", tLR: 4 }), mv({ tab: "home", set: "language", group: "Other language", tLR: 3.5 }),
    mv({ tab: "home", set: "working", group: "Retired", thin: true, tLR: 3 })]), T, "alp");
  out.allThin = rdDemoShift(mk([mv({ group: "Vic", thin: true })]), T, "alp");
  return out;
});
check(tr.payloadAgree, "gen-data: every demoTrend move's two tests agree in sign");
for (const s of tr.live) if (s) check(!/The composition of The /.test(s.head) && !/ {2}|undefined/.test(s.head + s.dek), "live trend copy is clean: " + s.head, s);
check(/losing voters faster in the eastern-mainland states/.test(tr.bucket.head) && /away from the eastern-mainland states, and towards the non-eastern-mainland states \(\+5 points relative to all Labor voters\)/.test(tr.bucket.dek),
  "bucket move: complement named as the eastern mainland, figure on the moving side only", tr.bucket);
check(!/South Australia, Western Australia/.test(tr.trio.dek) && /towards Tasmania, the ACT and the NT/.test(tr.trio.dek), "trio move: no five-state complement list", tr.trio);
check(/gaining more slowly in Victoria/.test(tr.rising.head), "a rising party's away move: 'gaining more slowly', never 'losing voters faster'", tr.rising);
check(/falling more slowly than the national vote/.test(tr.slower.dek) && /relative to the overall decrease/.test(tr.slower.dek), "a group falling slower than its party: 'falling more slowly', not 'rising'", tr.slower);
check(/^The composition of the Coalition’s vote is shifting$/.test(tr.lnpGroup.head) && /^Since July 2025, the composition of the Coalition’s vote has shifted away from renters/.test(tr.lnpGroup.dek), "lnp: lower-case article mid-sentence; an opening group sentence names its subject", tr.lnpGroup);
check(!/appears/.test(tr.thinHeld.dek), "a thin move stays out while a solid set was left out for room", tr.thinHeld);
check(/is unchanged$/.test(tr.allThin.head), "all-thin -> the unchanged pair", tr.allThin);
console.log("     " + tr.bucket.head + " / " + tr.bucket.dek + "\n     " + tr.slower.dek);

await browser.close();
if (fails.length) { console.error("\n" + fails.length + " FAILURES"); process.exit(1); }
console.log("\nALL CHECKS PASSED");
