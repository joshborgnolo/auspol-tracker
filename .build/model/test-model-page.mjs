#!/usr/bin/env node
/* test-model-page.mjs: the /model/ page's written lines, rendered in node from the stores it ships with.

   The page's copy is written by rule from model/data/*.json and the official runs (.build/model/app/*.js,
   views.mjs). This runs those same sources - assembled as assemble.mjs assembles them, less the boot part -
   against a stand-in document, with the page's state filled from the files, and reads what they write:
     1. every part renders, in both modes and in the Victorian view, and nothing reads "undefined" or "NaN";
     2. the method's steps say what the stores say: who sits now (every entry of the candidate overlay), the
        independents' record, what an independent takes of preferences and its SA 2026 check, the respondents;
     3. the seat cards say what happened in the seat: the by-election, the member who changed party, the
        retirement, the independent challenge and whose 2025 vote it stands in for;
     4. the rules have both branches: each is pinned with the payload changed under it (a score that is better,
        worse or the same; a check that is closer or not; a paragraph whose data is absent).
   It checks words, not layout: nothing here measures a box.
   Run from the repo root: node .build/model/test-model-page.mjs */
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const text = (h) => String(h).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/* ---- a stand-in document: every selector is an element that keeps what is written to it ---- */
function makeDom() {
  const els = new Map();
  const mk = (sel) => ({
    sel, _h: "", hidden: false, dataset: {}, style: {}, value: "", clientWidth: 720, childElementCount: 0, attrs: {},
    set innerHTML(v) { this._h = String(v); this.childElementCount = /<\w/.test(this._h) ? 1 : 0; }, get innerHTML() { return this._h; },
    set textContent(v) { this._h = String(v); }, get textContent() { return text(this._h); },
    insertAdjacentHTML(_, h) { this._h += h; this.childElementCount++; },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, appendChild(c) { return c; }, append() {}, remove() {}, replaceChildren() {},
    querySelector(s) { return el(`${sel} ${s}`); }, querySelectorAll() { return []; }, closest() { return null; }, matches() { return false; },
    scrollIntoView() {}, focus() {}, click() {}, getBoundingClientRect() { return { width: 720, height: 300, left: 0, top: 0, right: 720, bottom: 300 }; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  });
  const el = (sel) => { if (!els.has(sel)) els.set(sel, mk(sel)); return els.get(sel); };
  const document = { querySelector: el, querySelectorAll: () => [], createElement: (t) => mk(`<${t}>`), createElementNS: (_, t) => mk(`<${t}>`), addEventListener() {}, documentElement: mk("html"), body: mk("body") };
  return { document, el, html: (sel) => el(sel).innerHTML, clear: () => els.clear() };
}

/* ---- the page's own sources, as assemble.mjs joins them (the boot part left out: the state is set here) ---- */
const views = fs.readFileSync(".build/model/views.mjs", "utf8").replace(/^export /gm, "");
const parts = ["app-1-base.js", "app-2-dist.js", "app-3-seats.js", "app-4-explore.js", "app-5-evidence.js", "app-5b-vic.js"].map((f) => fs.readFileSync(`.build/model/app/${f}`, "utf8")).join("\n");
const SRC = `(() => {"use strict";\nconst URLS = {};\n${views}\n${parts}\nreturn { STATE, SEATS, renderHead, renderDist, renderSeats, renderEvidence, dek, headline };\n})()`;
function page() {
  const D = makeDom();
  const ctx = vm.createContext({ document: D.document, window: {}, location: { hash: "", search: "", pathname: "/model/", href: "http://x/model/" }, history: { replaceState() {} }, navigator: {}, innerWidth: 1280,
    addEventListener() {}, setTimeout, clearTimeout, console, fetch: () => Promise.reject(new Error("no fetch in the test")), IntersectionObserver: class { observe() {} disconnect() {} }, Worker: class { postMessage() {} terminate() {} } });
  const P = vm.runInContext(SRC, ctx, { filename: "model-page" });
  return { ...D, P };
}
const stores = () => ({ nowcast: J("data/seat-model-2028-nowcast.json"), forecast: J("data/seat-model-2028-forecast.json"), inputs: J("model/data/inputs.json"), evidence: J("model/data/evidence.json"), reasons: J("model/data/reasons.json"), vic: J("data/seat-model-vic-2026.json"), vicInputs: J("model/data/inputs-vic.json") });
function render(mut = (s) => s) {
  const s = mut(stores()), pg = page(), { P } = pg;
  Object.assign(P.STATE, { res: { nowcast: s.nowcast, forecast: s.forecast }, inputs: s.inputs, evidence: s.evidence, reasons: s.reasons });
  P.renderHead(); P.renderDist(); P.renderSeats(); P.renderEvidence();
  return { ...pg, s };
}
const card = (pg, seat) => { pg.P.SEATS.filter = "all"; pg.P.SEATS.q = seat; pg.P.SEATS.shown = 20; pg.P.SEATS.open.clear(); pg.P.SEATS.open.add(seat); pg.P.renderSeats(); return text(pg.html("#seat-table")); };
const BAD = /undefined|NaN|\[object |null%|Infinity/;
const clean = (label, h) => { const m = BAD.exec(text(h)); assert.ok(!m, `${label}: "${m && text(h).slice(Math.max(0, m.index - 60), m.index + 40)}"`); };

/* ---- 1. everything renders ---- */
const A = render(), E = A.s.evidence, IN = E.independents, OV = E.changes;
for (const sel of ["#md-hed", "#md-dek", "#how-steps", "#tests-body", "#limits-body", "#seat-table", "#seats-meta", "#files-body"]) { assert.ok(A.html(sel).length > 20, `${sel} is written`); clean(sel, A.html(sel)); }
const how = text(A.html("#how-steps")), tests = text(A.html("#tests-body")), limits = text(A.html("#limits-body"));
const heads = [...A.html("#how-steps").matchAll(/<h3><span class="n">(\d+)<\/span>([^<]+)<\/h3>/g)].map((m) => [+m[1], m[2]]);
assert.deepEqual(heads.map((h) => h[0]), [1, 2, 3, 4, 5, 6], "six numbered steps");
assert.equal(heads[2][1], "Draw the independents from the record");
assert.match(fs.readFileSync("model/index.html", "utf8"), /Six steps, every setting fitted on past elections/, "the section's standfirst counts the steps");
// forecast mode, and every seat's card in both modes
for (const mode of ["nowcast", "forecast"]) { A.P.STATE.mode = mode; A.P.renderHead(); A.P.renderDist(); A.P.renderSeats(); clean(`head (${mode})`, A.html("#md-dek")); for (const s of A.s.inputs.seats) clean(`${s.name} card (${mode})`, card(A, s.name)); }
A.P.STATE.mode = "nowcast";

/* ---- 2. the method says what the stores say ---- */
for (const e of OV.byElections) { assert.ok(how.includes(`${e.seat} went to`) && how.includes(e.winner.name) && how.includes(e.vacatedBy), `step 2 names the ${e.seat} by-election`); }
for (const e of OV.defections) { assert.ok(how.includes(`${e.member}, elected for`) && how.includes(e.seat), `step 2 names ${e.member}`); if (e.recontests == null) assert.ok(how.includes(`Whether ${e.member.split(" ").pop()} stands there again is not settled`), "an undecided member is said to be undecided"); }
for (const e of OV.retirements) assert.ok(how.includes(`${e.member} is not standing again in ${e.seat}`), `step 2 names ${e.member}'s retirement`);
assert.ok(how.includes(`${IN.sitting.n} sitting independents have faced the voters again and ${IN.sitting.held} held their seats`), "the sitting independents' record");
assert.ok(how.includes(`Each of the ${IN.seats.challenges} seats a party holds gets one independent challenge`) && how.includes(`In ${IN.seats.standing.length} seats an independent polled`), "the challenges");
for (const y of IN.window) assert.ok(how.includes(`passed 10% in ${y} and`), `the ${y} wave`);
const sa = IN.check.conversion.find((e) => e.id === "sa26");
assert.ok(how.includes("On these polls independents win about") && how.includes("more than at any of those elections") && how.includes(`In ${sa.label}, the one election in the stores with a field this split`), "today's gains, and the split-field record");
const TK = IN.take, pc = (v) => Math.round(100 * v);
assert.ok(how.includes(`${pc(TK.own.GRN)}% of a Greens pile while Labor was still standing`) && how.includes(`${pc(TK.cross.ALP)}% of a Labor pile and ${pc(TK.cross.COAL)}% of a Coalition pile`), "what an independent takes, by who is left");
assert.ok(how.includes(`${TK.vsOneNation.counts[0].seat} by-election of`) && how.includes(`${pc(TK.vsOneNation.COAL.share)}% chose the independent`), "the count of an independent against One Nation");
const CK = IN.check.sa26, f1 = (x) => (100 * x).toFixed(1);
assert.ok(how.includes(`come out ${f1(CK.meanAbsError.byWhoIsLeft)} points from the count on average, against ${f1(CK.meanAbsError.flat)} when one share served for every case`), "the SA 2026 check, as measured");
const RS = E.respondents;
if (RS) assert.ok(how.includes("Poll respondents now say something different") && how.includes(`${pc(RS.said.on)}% of One Nation voters putting Labor ahead of the Coalition`) && how.includes(`One Nation would average ${Math.round(RS.halfway.expectedSeats.on)} seats`), "the respondents' what-if");
assert.ok(tests.includes("Independents: the record against the old treatment") && tests.includes(`Independents won ${IN.backtest.all.after.actualInd} seats`), "the independents' test");
assert.ok(limits.includes("Nobody is nominated yet") && limits.includes("no independent challenger is a named person yet") && limits.includes("Tasmania, South Australia and the ACT were redrawn"), "the limits");
assert.ok(text(A.html("#md-dek")).includes("independents"), "independents averaging ten seats or more are named in the summary");

/* ---- 3. the seat cards ---- */
const by = OV.byElections[0], def = OV.defections[0], ret = OV.retirements[0];
if (by) { const c = card(A, by.seat); assert.ok(c.includes(`Won by ${by.vacatedBy}`) && c.includes(`held by ${by.winner.name} (${by.winner.party}) since the by-election of`), `${by.seat}: the by-election on its card`); assert.ok(c.includes("Held now") && /One Nation/.test(c)); }
if (def) { const c = card(A, def.seat); assert.ok(c.includes(`${def.member} won it for`) && (def.recontests != null || c.includes("is not settled, and the model assumes neither")), `${def.seat}: the change of party on its card`); }
if (ret) assert.ok(card(A, ret.seat).includes(`${ret.member} is not standing again.`), `${ret.seat}: the retirement on its card`);
const top = IN.seats.standing[0];
assert.ok(card(A, top.seat).includes(`Independent: nobody is nominated. ${top.name} polled ${(100 * top.share).toFixed(1)}% here in 2025`), `${top.seat}: the challenge stands in for ${top.name}`);
const fresh = A.s.inputs.seats.find((s) => s.cands.some((c) => c.slot === "_new" && !c.was));
assert.ok(card(A, fresh.name).includes("A challenger of 10% or more appears in"), `${fresh.name}: a challenge added to the field`);
const sitter = A.s.inputs.seats.find((s) => s.cands.some((c) => c.free && c.slot == null)), who = sitter.cands.find((c) => c.free && c.slot == null).label;
assert.ok(card(A, sitter.name).includes(`${who} moves by sitting independents’ own record`), `${sitter.name}: the sitting independent`);
const flip = Object.keys(A.s.reasons.nowcast.seats)[0];
assert.ok(card(A, flip).includes("Why it changes hands"), `${flip}: its reasons`);

/* ---- 4. both branches of each rule ---- */
const hw = (mut) => { const r = render(mut); return { how: text(r.html("#how-steps")), tests: text(r.html("#tests-body")), dek: text(r.html("#md-dek")) }; };
// a) the log score: better / worse / the same
const setLog = (d) => (s) => { const b = s.evidence.independents.backtest.all; b.after.logScore = b.before.logScore + d; return s; };
assert.ok(hw(setLog(0.03)).tests.includes("the record scores better"), "log score better");
assert.ok(hw(setLog(-0.03)).tests.includes("the record scores worse"), "log score worse");
assert.ok(hw(setLog(0.001)).tests.includes("the record scores the same"), "log score the same");
// b) the Brier score by era: better / a little worse / the same, and the reason only when the early era is worse
const setBr = (dr, de) => (s) => { const b = s.evidence.independents.backtest; b.recent.after.brier = b.recent.before.brier + dr; b.early.after.brier = b.early.before.brier + de; return s; };
let t = hw(setBr(-0.003, 0.003)).tests; assert.ok(t.includes("it scores better over the elections from") && t.includes("a little worse before them") && t.includes("when independents were rare"), "Brier: better, then worse");
t = hw(setBr(0.003, -0.003)).tests; assert.ok(t.includes("it scores a little worse over the elections from") && t.includes("better before them") && !t.includes("when independents were rare"), "Brier: worse, then better");
t = hw(setBr(0.0001, 0.0001)).tests; assert.ok(t.includes("it scores the same over the elections from") && t.includes("and the same before them"), "Brier: the same in both");
// c) the record's expectation against what happened
const setExp = (v) => (s) => { const b = s.evidence.independents.backtest.all; b.after.expectedInd = b.after.actualInd + v; return s; };
assert.ok(hw(setExp(-5)).tests.includes("The record is still cautious"), "cautious"); assert.ok(hw(setExp(5)).tests.includes("The record expected more than independents won"), "over"); assert.ok(!/still cautious|expected more than/.test(hw(setExp(0)).tests), "level");
// d) the SA 2026 check: closer, or no closer
assert.ok(hw((s) => { const m = s.evidence.independents.check.sa26.meanAbsError; m.byWhoIsLeft = m.flat + 0.01; return s; }).how.includes("no closer than the"), "the check when it is not closer");
// e) the respondents' paragraph is absent without a poll in the window; the old count sentence without the two-case table
assert.ok(!hw((s) => { s.evidence.respondents = null; return s; }).how.includes("Poll respondents now say"), "no respondents, no paragraph");
const noInd = hw((s) => { s.evidence.independents = null; return s; });
assert.ok(noInd.how.includes("Sitting independents take the share of moving ballots they took in their 2025 counts") && !noInd.how.includes("Draw the independents from the record"), "without the record the page says what the model then does");
// the gains sentence compares with the window's largest election only when above it
assert.ok(hw((s) => { s.evidence.independents.byElection[s.evidence.independents.window[1]].freshWon = 50; return s; }).how.includes("seats they do not hold now, against "), "gains under the record's largest are set beside each election");
// f) the summary names independents only from ten seats
assert.ok(!hw((s) => { s.nowcast.national.expectedSeats.member = 6; return s; }).dek.includes("independents"), "independents under ten seats are not named");
// g) who sits now: a member who has said they stand, and one who has said they will not
const setDef = (v) => (s) => { s.evidence.changes.defections[0].recontests = v; return s; };
if (def) { assert.ok(hw(setDef(true)).how.includes("and stands there again"), "a defector standing"); assert.ok(hw(setDef(false)).how.includes("and is not standing there again"), "a defector not standing"); }
assert.ok(!hw((s) => { s.evidence.changes = { byElections: [], defections: [], retirements: [] }; return s; }).how.includes("Who sits has changed"), "no changes, no paragraph");

/* ---- the Victorian view still renders on the shared seat code ---- */
{ const pg = page(), s = stores();
  Object.assign(pg.P.STATE, { jur: "vic", res: { nowcast: s.nowcast, forecast: s.forecast, vic: s.vic }, inputs: s.inputs, vicInputs: s.vicInputs, evidence: s.evidence, reasons: s.reasons });
  pg.P.renderHead(); pg.P.renderSeats();
  for (const d of s.vicInputs.seats) clean(`${d.name} (Victoria)`, card(pg, d.name));
  const moved = s.vicInputs.seats.find((d) => d.won2022 && d.held && d.won2022.group !== d.held.group && !String(d.held.group).startsWith("member"));
  if (moved) assert.ok(card(pg, moved.name).includes(`Won by ${moved.won2022.name}`), `${moved.name}: Victoria's changed holder still says so`);
}
console.log(`model page OK: six steps, ${A.s.inputs.seats.length} federal and ${A.s.vicInputs.seats.length} Victorian seat cards render clean in every mode, the copy matches the stores, ${OV.byElections.length + OV.defections.length + OV.retirements.length} changes since 2025 named, every rule's branches pinned`);
