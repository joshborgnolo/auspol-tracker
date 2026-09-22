/* Fixture test for extract-pollbludger.mjs — the Poll Bludger fallback.
   Runs the extractor as a child process against a synthetic feed and a
   scratch dataset, and asserts the behaviours the header promises: the
   grace period, filing into fallbackPolls (never polls[]), pruning once a
   canonical row lands, the MRP / ignore / unmapped / stale-wave skips, the
   2PP basis per house, Essential's wider date slack, the shape-guard exits,
   and validate.mjs accepting what it writes. Run: node .build/test-pollbludger.mjs */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const { validate } = await import("./newtracker/validate.mjs");

const dir = mkdtempSync(path.join(tmpdir(), "pb-"));
const POLLS = path.join(dir, "polls.json");
const SRC = path.join(dir, "src");
const XML = path.join(dir, "current.xml");

// ---- synthetic feed ---------------------------------------------------------
const pt = (id, pollster, start, end, sample, v) => {
  const tag = (k) => (v[k] == null ? `<${k} />` : `<${k}>${v[k]}</${k}>`);
  return `<point Id="${id}" start="${start}" end="${end}" median="${end}" pollster="${pollster}" mode="Online" scope="NAT" sample="${sample ?? ""}">` +
    ["ALP", "LNC", "GRN", "PHON", "UND", "ALP2", "LNC2", "ALPra", "LNCra", "UNDra"].map(tag).join("") + "</point>";
};
const election = pt(1, "Election", "03/05/2025", "03/05/2025", "", { ALP: 34.6, LNC: 31.8, GRN: 12.2, PHON: 6.4, ALP2: 55.2, LNC2: 44.8 });
const filler = Array.from({ length: 100 }, (_, i) => pt(100 + i, "YouGov", "01/06/2025", "07/06/2025", 1500, { ALP: 30, LNC: 30, GRN: 12, PHON: 15, ALPra: 51, LNCra: 49 }));
const stateNoise = `<point Id="900" start="14/09/2026" end="17/09/2026" pollster="Newspoll" mode="Online" scope="NSW" sample="400"><ALP>30</ALP><LNC>20</LNC><GRN>10</GRN><PHON>30</PHON><UND /><ALP2 /><LNC2 /><ALPra /><LNCra /><UNDra /></point>`;
const waves = [
  // Newspoll: missing from the tracker → should be filed (flows-basis house, no 2PP given)
  pt(1578, "Newspoll", "14/09/2026", "17/09/2026", 1244, { ALP: 27, LNC: 19, GRN: 13, PHON: 30 }),
  // Roy Morgan: missing → filed with the RA pair as headline and flows beside it
  pt(1561, "Roy Morgan", "07/09/2026", "13/09/2026", 1583, { ALP: 25, LNC: 21.5, GRN: 16, PHON: 25, ALP2: 53, LNC2: 47, ALPra: 55, LNCra: 45 }),
  // Resolve: PRESENT in the tracker (2 days off) → not a gap
  pt(1555, "Resolve Strategic", "06/09/2026", "12/09/2026", 2250, { ALP: 28, LNC: 24, GRN: 11, PHON: 27 }),
  // Essential: tracker row 5 days earlier (report-date keying) → covered by the 7-day slack
  pt(1600, "Essential Research", "10/09/2026", "16/09/2026", 1022, { ALP: 31, LNC: 25, GRN: 9, PHON: 22, UND: 6, ALPra: 49, LNCra: 45, UNDra: 6 }),
  // RedBridge MRP-sized sample → skipped
  pt(1601, "RedBridge Group", "01/09/2026", "10/09/2026", 5563, { ALP: 31, LNC: 20, GRN: 12.5, PHON: 27.5, ALPra: 53, LNCra: 47 }),
  // unmapped house → skipped
  pt(1602, "EMRS", "01/09/2026", "10/09/2026", 1000, { ALP: 31, LNC: 20, GRN: 12, PHON: 27 }),
  // an old missing wave (> 45 days) → not a gap
  pt(1603, "Newspoll", "01/06/2026", "05/06/2026", 1200, { ALP: 31, LNC: 20, GRN: 12, PHON: 27 }),
  // ignored by the human list
  pt(1604, "YouGov", "10/09/2026", "15/09/2026", 1500, { ALP: 31, LNC: 20, GRN: 12, PHON: 27 }),
  // a broken 2PP pair (does not sum) → row filed, pair dropped
  pt(1605, "DemosAU", "10/09/2026", "14/09/2026", 1583, { ALP: 28, LNC: 20, GRN: 13, PHON: 26, ALPra: 60, LNCra: 45 }),
];
// leader satisfaction: Newspoll (VI missing too), YouGov (VI present, approval
// missing — the cloud-landed shape), Resolve (both present), RedBridge (a
// favourability house — never filed), a DemosAU point with only PPM (ignored)
const lp = (id, pollster, start, end, v) => `<point Id="${id}" start="${start}" end="${end}" median="${end}" pollster="${pollster}" mode="Online" scope="NAT" sample="1500">` +
  ["pmSAT", "pmDIS", "olSAT", "olDIS", "pmPREF", "olPREF"].map((k) => (v[k] == null ? `<${k} />` : `<${k}>${v[k]}</${k}>`)).join("") + "</point>";
const leaders = `<leaders><charts><point Id="1" date="07/16/2025" week="12"><pmNET>0</pmNET></point></charts><table>` +
  lp(74, "Newspoll", "14/09/2026", "17/09/2026", { pmSAT: 35, pmDIS: 62, olSAT: 35, olDIS: 50, pmPREF: 42, olPREF: 41 }) +
  lp(71, "YouGov", "01/09/2026", "09/09/2026", { pmSAT: 36, pmDIS: 59, olSAT: 36, olDIS: 48, pmPREF: 43, olPREF: 39 }) +
  lp(72, "Resolve Strategic", "06/09/2026", "12/09/2026", { pmSAT: 34, pmDIS: 53, olSAT: 39, olDIS: 30 }) +
  lp(75, "RedBridge Group", "01/09/2026", "05/09/2026", { pmSAT: 40, pmDIS: 50, olSAT: 30, olDIS: 40 }) +
  lp(73, "DemosAU", "10/09/2026", "14/09/2026", { pmPREF: 39, olPREF: 35 }) +
  `</table></leaders>`;
const feed = (extra = "") => `<root date="2026-09-21 01:01:55+00:00">${leaders}<federal><table>${election}${filler.join("")}${stateNoise}${waves.join("")}${extra}</table></federal></root>`;
writeFileSync(XML, feed());

// ---- scratch dataset ------------------------------------------------------------
const poll = (pollster, date, client, extra = {}) => ({ date, dateStart: date, pollster, client, sample: 1000, alp: 30, lnp: 30, grn: 12, onp: 15, ind: 8, oth: 5, tpp_alp: 51, tpp_lnp: 49, ...extra });
const base = {
  metricRules: { favFirms: ["redbridge", "demosau", "freshwater", "spectre strategy"], overrides: {} },
  pollsterRules: { "Roy Morgan": {}, Newspoll: {}, Resolve: {}, Essential: {}, "RedBridge/Accent": {}, YouGov: {}, DemosAU: {}, "Fox & Hedgehog": {}, Freshwater: {} },
  polls: [
    poll("Roy Morgan", "2026-09-06", "—"), poll("Newspoll", "2026-08-27", "The Australian"), poll("Resolve", "2026-09-14", "SMH"),
    poll("Essential", "2026-09-11", "The Guardian"), poll("RedBridge/Accent", "2026-08-30", "AFR"), poll("YouGov", "2026-09-09", "News24"),
    poll("DemosAU", "2026-08-24", "Capital Brief"),
  ].sort((a, b) => (a.date < b.date ? -1 : 1)), // validate demands date order
  ppm: [],
  approval: [{ date: "2026-09-12", firm: "Resolve", alb: -19, opp: 9, oppName: "Taylor", han: null, detail: { alb: { app: 34, dis: 53 }, opp: { app: 39, dis: 30 } } }],
  cyclePolls: {}, cycleApproval: {},
};
writeFileSync(POLLS, JSON.stringify(base, null, 2));
mkdirSync(SRC, { recursive: true });
writeFileSync(path.join(SRC, "ignore.json"), JSON.stringify({ 1604: "commissioned one-off the tracker omits" }));

const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, [".build/extract-pollbludger.mjs", "--xml", XML, ...args],
    { env: { ...process.env, POLLS_JSON: POLLS, PB_SRC_DIR: SRC, ...env }, encoding: "utf8" });
  const last = r.stdout.trim().split("\n").pop();
  assert.ok(last.startsWith("PB_STATUS "), `no status line: ${r.stdout}\n${r.stderr}`);
  return { code: r.status, status: JSON.parse(last.slice(10)) };
};
const data = () => JSON.parse(readFileSync(POLLS, "utf8"));
const NOW1 = "2026-09-22T02:00:00Z", NOW2 = "2026-09-22T22:00:00Z";

// ---- run 1: everything missing is pending, nothing written ----------------------
let r = run(["--apply", "--now", NOW1]);
assert.equal(r.code, 0);
assert.equal(r.status.changed, false);
assert.deepEqual(r.status.filed, []);
assert.deepEqual(r.status.pending.filter((p) => p.kind !== "approval").map((p) => p.pollster).sort(), ["DemosAU", "Newspoll", "Roy Morgan"], JSON.stringify(r.status.pending));
assert.deepEqual(r.status.pending.filter((p) => p.kind === "approval").map((p) => p.pollster).sort(), ["Newspoll", "YouGov"], "approval pending: favourability house and PPM-only point excluded");
const whys = r.status.skipped.map((s) => s.why);
assert.ok(whys.some((w) => /MRP-sized/.test(w)), "MRP skip " + whys);
assert.ok(whys.some((w) => /unmapped house "EMRS"/.test(w)), "unmapped skip");
assert.ok(whys.some((w) => /ignored: commissioned/.test(w)), "ignore list");
assert.ok(!r.status.pending.some((p) => p.pollster === "Essential"), "Essential covered by the 7-day slack");
assert.ok(!r.status.pending.some((p) => p.end === "2026-06-05"), "old wave is not a gap");
assert.equal(data().fallbackPolls, undefined, "nothing filed before grace");
assert.ok(existsSync(path.join(SRC, "seen.json")), "ledger written");

// ---- run 2: grace elapsed → filed into fallbackPolls, polls[] untouched ------------
r = run(["--apply", "--now", NOW2]);
assert.equal(r.status.changed, true);
assert.deepEqual(r.status.filed.map((f) => f.pollster + " " + f.date).sort(), ["DemosAU 2026-09-14", "Newspoll 2026-09-17", "Roy Morgan 2026-09-13"], JSON.stringify(r.status.filed));
let D = data();
assert.equal(D.polls.length, base.polls.length, "polls[] never written");
assert.equal(D.fallbackPolls.length, 3);
const rm = D.fallbackPolls.find((f) => f.pollster === "Roy Morgan");
assert.deepEqual([rm.tpp_alp, rm.tpp_lnp, rm.tpp_flows], [55, 45, 53], "RA headline with flows beside it");
assert.equal(rm.ind, 12.5); assert.equal(rm.oth, null); assert.equal(rm.client, "—");
const np = D.fallbackPolls.find((f) => f.pollster === "Newspoll");
assert.equal(np.tpp_alp, null); assert.equal(np.client, "The Australian"); assert.equal(np.ind, 11);
assert.equal(np.provisional.source, "Poll Bludger"); assert.equal(np.provisional.feedId, "1578");
const dm = D.fallbackPolls.find((f) => f.pollster === "DemosAU");
assert.equal(dm.tpp_alp, null, "non-summing pair dropped");
assert.ok(r.status.notes.some((n) => /does not sum/.test(n)));
assert.ok(D.fallbackPolls.every((f, i, a) => i === 0 || a[i - 1].date <= f.date), "sorted");
assert.deepEqual(validate(D).errors, [], "validate accepts the filed rows");
// leader satisfaction: Newspoll (no VI, no approval) and YouGov (VI present,
// approval missing) filed; Resolve covered; RedBridge a favourability house;
// DemosAU PPM-only — never filed
assert.deepEqual(r.status.filedApproval.map((f) => f.firm + " " + f.date).sort(), ["Newspoll 2026-09-17", "YouGov 2026-09-09"], JSON.stringify(r.status.filedApproval));
const npA = D.fallbackApproval.find((f) => f.firm === "Newspoll");
assert.deepEqual({ alb: npA.alb, opp: npA.opp, oppName: npA.oppName, han: npA.han, detail: npA.detail },
  { alb: -27, opp: -15, oppName: "Taylor", han: null, detail: { alb: { app: 35, dis: 62 }, opp: { app: 35, dis: 50 } } });
assert.equal(npA.provisional.feedId, "74");
assert.ok(!D.fallbackApproval.some((f) => f.firm === "RedBridge/Accent"), "favourability house never filed");
assert.ok(!D.fallbackApproval.some((f) => f.firm === "DemosAU"), "PPM-only point never filed");
assert.ok(!D.fallbackApproval.some((f) => f.firm === "Resolve"), "covered wave not filed");
assert.ok(!("ppm" in npA) && D.fallbackPolls.every((p) => !("ppm" in p)), "preferred-PM never filed");

// ---- run 3: idempotent ----------------------------------------------------------
r = run(["--apply", "--now", NOW2]);
assert.equal(r.status.changed, false); assert.deepEqual(r.status.filed, []);

// ---- run 4: the house lands its real row → the fallback is pruned ----------------------
D = data();
D.polls.push(poll("Newspoll", "2026-09-17", "The Australian", { published: "2026-09-20T21:00" }));
D.polls.sort((a, b) => (a.date < b.date ? -1 : 1));
writeFileSync(POLLS, JSON.stringify(D, null, 2));
r = run(["--apply", "--now", "2026-09-23T02:00:00Z"]);
assert.equal(r.status.changed, true);
assert.deepEqual(r.status.pruned.map((p) => p.pollster), ["Newspoll"]);
// the VI row landing does NOT prune the provisional ratings — those wait for
// a canonical approval row
assert.deepEqual(r.status.prunedApproval, []);
assert.ok(data().fallbackApproval.some((f) => f.firm === "Newspoll"), "ratings survive a VI-only canonical landing");
D = data();
D.approval.push({ date: "2026-09-17", firm: "Newspoll", alb: -27, opp: -15, oppName: "Taylor", han: -7, detail: { alb: { app: 35, dis: 62 } } });
writeFileSync(POLLS, JSON.stringify(D, null, 2));
r = run(["--apply", "--now", "2026-09-23T03:00:00Z"]);
assert.deepEqual(r.status.prunedApproval.map((p) => p.firm), ["Newspoll"]);
assert.deepEqual(data().fallbackApproval.map((f) => f.firm), ["YouGov"]);
assert.deepEqual(validate(data()).errors, []);
assert.deepEqual(data().fallbackPolls.map((f) => f.pollster).sort(), ["DemosAU", "Roy Morgan"]);
const seen = JSON.parse(readFileSync(path.join(SRC, "seen.json"), "utf8"));
assert.ok(!Object.values(seen).some((s) => s.pollster === "Newspoll"), "ledger forgets a covered wave");

// ---- dry run never writes -----------------------------------------------------------------
const before = readFileSync(POLLS, "utf8");
r = run(["--check", "--now", "2026-09-23T02:00:00Z"]);
assert.equal(readFileSync(POLLS, "utf8"), before);

// ---- shape guards ------------------------------------------------------------------------
writeFileSync(XML, feed().replace("<ALP>34.6</ALP>", "<ALP>44.6</ALP>"));
r = run(["--apply", "--now", NOW2]);
assert.equal(r.code, 2, "canary trips on a wrong election baseline");
assert.match(r.status.error, /baseline/);
writeFileSync(XML, `<root date="x"><federal><table>${election}</table></federal></root>`);
r = run(["--apply", "--now", NOW2]);
assert.equal(r.code, 2); assert.match(r.status.error, /national points/);
writeFileSync(XML, "<html>not the feed</html>");
r = run(["--apply", "--now", NOW2]);
assert.equal(r.code, 2); assert.match(r.status.error, /root date/);
assert.equal(readFileSync(POLLS, "utf8"), before, "a guard trip writes nothing");

console.log("test-pollbludger: ok");
