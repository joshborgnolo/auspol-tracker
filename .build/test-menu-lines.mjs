/* Pins .build/newtracker/assets/menu-lines.js, the menu pages' findings: the
   More menu's figure rules on every branch of each finding (mutated
   payloads, so a branch today's data doesn't reach is still held to its
   rule), and the satellites' copy of the lines in assets/auspol-now.json
   against the same file run on the built dataset. The page heads and deks
   the findings write are the components' own, moved verbatim on 2026-10-18;
   their wording is pinned where it always was (hl-story, test-flow-splits).
   Run after a build: node .build/test-menu-lines.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A = (f) => path.join(ROOT, ".build", "newtracker", "assets", f);
/* objects made inside the vm carry its own prototypes; compare their JSON */
const J = (o) => JSON.parse(JSON.stringify(o));
const fresh = (mutate) => {
  const win = {};
  const ctx = vm.createContext({ window: win, React: {}, console });
  win.window = win;
  vm.runInContext(fs.readFileSync(A("9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"), ctx);
  if (mutate) mutate(win.AUSPOL, win);
  for (const f of ["ed2260de-5b11-4bd5-8a8d-a391156c05ee.js", "menu-lines.js"]) vm.runInContext(fs.readFileSync(A(f), "utf8"), ctx);
  return win.AP;
};

/* ---- Poll disagreement: the widest ratio among the parties the head names */
{
  const run = (R) => {
    const AP = fresh();
    AP.discord = (id) => (R[id] != null ? [{ ym: "2026-09", sigma: null }, { ym: "2026-10", sigma: 2, floor: 2 / R[id], R: R[id] }] : []);
    return AP.disStory();
  };
  let s = run({ p_onp: 1.5, p_lnp: 1.1, rd_right: 1.0, p_alp: 1.0, p_grn: 1.0 });
  assert.equal(s.head, "Pollsters agree on the size of the right’s vote but disagree on its split");
  assert.deepEqual(J(s.fig), { v: "1.5×", cap: "One Nation v chance", tone: "onp" }, "the split: the right's party beyond chance");
  s = run({ p_onp: 1.3, p_lnp: 1.9, rd_right: 1.1, p_alp: 2.4, p_grn: 1.0 });
  assert.deepEqual(J(s.fig), { v: "1.9×", cap: "Coalition v chance", tone: "lnp" }, "the split names the right only: Labor's 2.4 isn't its figure");
  s = run({ p_onp: 1.3, p_lnp: 1.25, rd_right: 1.3, p_alp: 1.6, p_grn: 1.0 });
  assert.equal(s.head, "The polls disagree on One Nation’s, the Coalition’s and Labor’s vote");
  assert.deepEqual(J(s.fig), { v: "1.6×", cap: "Labor v chance", tone: "alp" }, "the widest of the parties named");
  s = run({ p_onp: 1.1, p_lnp: 1.0, rd_right: 1.0, p_alp: 0.7, p_grn: 1.15 });
  assert.equal(s.head, "The polls agree about as closely as sampling error allows");
  assert.deepEqual(J(s.fig), { v: "1.1×", cap: "Greens v chance", tone: "grn" }, "agreeing: the widest of all four, inside chance");
  assert.equal(run({}).fig, null, "no readings, no figure");
}

/* ---- Pollster leans: the head's own lean, signed, on the two-party tab */
{
  const lean = (key, vals) => (D) => {
    const hs = Object.keys(D.houseLean[key]);
    hs.forEach((h, i) => { const s = D.houseLean[key][h]; s[s.length - 1].v = vals[i] ?? 0; });
  };
  let AP = fresh(lean("onimp", [0.2, -1.6, 0.3, 0.1, 0.4, 0.2, 0.1, 0.3, 0.2]));
  let s = AP.leanStory("tpp", true, false);
  assert.match(s.head, / leans furthest to One Nation, and by 1\.6 points$/);
  assert.equal(s.fig.v, "−1.6", "a lean to the rival is signed minus");
  assert.equal(s.fig.tone, "onp");
  assert.ok(!/pollsters$/.test(s.fig.cap) && s.head.startsWith(s.fig.cap), "one house: the caption names it as the head does");
  AP = fresh(lean("imp", [1.3, 1.24, 0.2, 0.1, -0.3]));
  s = AP.leanStory("tpp", false, false);
  assert.match(s.head, / and .* lean furthest to Labor, and by 1\.2 points$/);
  assert.deepEqual(J([s.fig.v, s.fig.cap, s.fig.tone]), ["+1.2", "2 pollsters", "alp"], "a tie: the group's floor, the count of houses");
  AP = fresh(lean("imp", [0.02, -0.03, 0.01, 0, 0.04, 0, 0, 0, 0, 0]));
  s = AP.leanStory("tpp", false, false);
  assert.equal(s.head, "No pollster leans away from the pack here");
  assert.equal(s.fig, null, "no lean, no figure");
}

/* ---- Preference flows: the move the head reports, or none */
{
  let AP = fresh((D) => { D.flowDriftOn.now = { ...D.flowDriftOn.now, v: 2.6, ci95: 1.1 }; D.flowDrift.now = { ...D.flowDrift.now, v: 0.1, ci95: 1.0 }; });
  let s = AP.flowStory();
  assert.equal(s.head, "Preferences against One Nation have moved towards Labor since the election");
  assert.deepEqual(J(s.fig), { v: "+2.6", cap: "Pts v One Nation", tone: "alp" });
  AP = fresh((D) => { D.flowDrift.now = { ...D.flowDrift.now, v: -1.9, ci95: 1.0 }; D.flowDriftOn.now = { ...D.flowDriftOn.now, v: 0.2, ci95: 1.1 }; });
  s = AP.flowStory();
  assert.equal(s.head, "Preferences against the Coalition have moved away from Labor since the election");
  assert.deepEqual(J(s.fig), { v: "−1.9", cap: "Pts v Coalition", tone: "lnp" });
  AP = fresh((D) => { D.flowDrift.now = { ...D.flowDrift.now, v: 1.7, ci95: 1.0 }; D.flowDriftOn.now = { ...D.flowDriftOn.now, v: -2.2, ci95: 1.1 }; });
  assert.deepEqual(J(AP.flowStory().fig), { v: "−2.2", cap: "Pts v One Nation", tone: "onp" }, "both moved: the wider drift");
  /* the voter battery: one group moved -> its share now, as the dek quotes it */
  AP = fresh((D) => {
    D.flowDrift.now = { ...D.flowDrift.now, v: 0, ci95: 1 }; D.flowDriftOn.now = { ...D.flowDriftOn.now, v: 0, ci95: 1 };
    const n = D.flowForced.vsCoal.length;
    /* a falling line with a little scatter (a perfect line has no error to test) */
    D.flowForced.vsCoal = D.flowForced.vsCoal.map((w, i) => ({ ...w, onp: Math.round(30 - (16 * i) / (n - 1)) + (i % 2), grn: 80, oth: 50 }));
    D.flowForced.vsOn = D.flowForced.vsOn.map((w) => ({ ...w, grn: 80, coal: 30, oth: 50 }));
    D.flowForced.lnpOn = [];
  });
  s = AP.flowStory();
  assert.equal(s.head, "One Nation voters say they’d now send Labor fewer preferences");
  assert.equal(s.fig.v, s.ff.find((r) => r.key === "coonp").waves.slice(-1)[0].onp + "%");
  assert.ok(s.dek.includes(s.fig.v + " of One Nation voters now pick Labor"), "the figure is the share the dek quotes");
  assert.deepEqual(J([s.fig.cap, s.fig.tone]), ["One Nation to Labor", "onp"]);
  AP = fresh((D) => {
    D.flowDrift.now = { ...D.flowDrift.now, v: 0, ci95: 1 }; D.flowDriftOn.now = { ...D.flowDriftOn.now, v: 0, ci95: 1 };
    for (const k of ["vsOn", "vsCoal"]) D.flowForced[k] = D.flowForced[k].map((w) => ({ ...w, grn: 80, onp: 20, coal: 30, oth: 50 }));
    D.flowForced.lnpOn = [];
  });
  s = AP.flowStory();
  assert.equal(s.head, "Preferences are still flowing much as they did at the election");
  assert.equal(s.fig, null, "nothing moved, no figure");
  assert.equal(fresh((D) => { D.flowDrift = null; }).flowStory(), null, "no drift, no finding");
}

/* ---- the flows explainer's figure: the two frozen flow tables, a coloured
   trio per matchup, whole numbers (the graphic's own idiom) - plus its
   rival-ordering swap and the no-table fallback */
{
  const rows = (m) => JSON.parse(JSON.stringify(m["flows-explained"].fig || {})).rows;
  const coRow = { cap: "To Labor v Coalition", cells: [{ v: "88", tone: "grn" }, { v: "26", tone: "onp" }, { v: "55", tone: "oth" }] };
  const onRow = { cap: "To Labor v One Nation", cells: [{ v: "91", tone: "grn" }, { v: "30", tone: "lnp" }, { v: "55", tone: "oth" }] };
  const AP = fresh();
  const L = AP.menuLines();
  assert.deepEqual(rows(L), [coRow, onRow], "the Coalition row first while it is Labor's main rival");
  assert.ok(!("chip" in L["flows-explained"]), "the figure replaces the Explainer tag");
  assert.deepEqual(rows(fresh((D) => { D.latest.rivalLead = "alp_on"; }).menuLines()), [onRow, coRow],
    "One Nation the main rival: the two rows swap to follow it");
  /* the cells are the estimator's own tables - mutate flowTables and the
     figure moves with it, so the menu can never quote a retired constant */
  const moved = fresh((D) => { D.flowTables.lnp.grn = 0.75; }).menuLines();
  assert.equal(JSON.parse(JSON.stringify(moved["flows-explained"].fig)).rows[0].cells[0].v, "75", "the figure reads flowTables, not a restated constant");
  /* no table, no figure - the "Explainer" tag stands back (an empty tables
     object, not null, which ed2260de's load-time flows read could not take) */
  const flat = JSON.parse(JSON.stringify(fresh((D) => { D.flowTables = {}; }).menuLines()["flows-explained"]));
  assert.equal(flat.chip, "Explainer", "a build without the tables keeps the tag");
  assert.equal(flat.fig, null, "not half a figure");
}

/* ---- the menu's lines, and the satellites' copy of them */
{
  const AP = fresh();
  const L = AP.menuLines();
  for (const id of ["disagreement", "leans", "flows", "flows-explained", "beyond-the-vote", "changelog", "info"]) assert.ok(L[id] && L[id].head, id + " has its line");
  assert.equal(L["flows-explained"].head, AP.PAGE_HEAD["flows-explained"]);
  assert.match(L["beyond-the-vote"].fig.v, /^\d+$/);
  assert.match(L.changelog.fig.v, /^\d{1,2} [A-Z][a-z]{2}$/);
  /* a finding that throws gives way to the tip, never takes the menu down */
  const broken = fresh();
  broken.disStory = () => { throw new Error("boom"); };
  const quiet = console.error; console.error = () => {};
  try { assert.ok(!("disagreement" in broken.menuLines()) && broken.menuLines().leans, "one failure, one line lost"); }
  finally { console.error = quiet; }
  const now = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "auspol-now.json"), "utf8"));
  assert.deepEqual(now.menu, JSON.parse(JSON.stringify(L)), "auspol-now.json carries this build's lines (rebuild if this fails)");
}

console.log("PASS: menu lines – the figure rules on every branch, the menu's pages, the satellites' copy current");
