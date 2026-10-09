/* Fixture test for the wave-adjudication chain: adjudicate-cases.mjs contract,
   adjudicate.mjs (LLM pass, against a stubbed `matilda` CLI on PATH), and the
   --adjudicate/--decisions flow in both extractors (pollbludger via a
   synthetic feed + env overrides, roymorgan via --feed-dir + a scratch cwd).
   Run: node .build/test-adjudicate.mjs */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const { validate } = await import("./newtracker/validate.mjs");
const { validateCases, caseJson } = await import("./adjudicate-cases.mjs");

const baseEnv = { ...process.env };
delete baseEnv.MATILDA_API_KEY;

// ---- A. the shared contract ----------------------------------------------------
{
  const dbl = { case: "double:2026-09-20:2026-09-27" };
  const rei = { case: "reissue:2026-09-13" };
  assert.equal(validateCases("roymorgan", [dbl, rei]).ok, true);
  assert.equal(validateCases("roymorgan", [dbl], [{ case: dbl.case, action: "file_both" }]).ok, true);
  assert.equal(validateCases("roymorgan", [dbl], [{ case: dbl.case, action: "file_only", slug: "a-federal-voting-intention-x" }]).ok, true);
  assert.equal(validateCases("roymorgan", [dbl], [{ case: dbl.case, action: "file_only" }]).ok, false, "file_only without slug");
  assert.equal(validateCases("roymorgan", [dbl], [{ case: dbl.case, action: "never_file" }]).ok, false, "never_file without slug");
  assert.equal(validateCases("roymorgan", [dbl], [{ case: dbl.case, action: "explode" }]).ok, false, "unknown action");
  assert.equal(validateCases("roymorgan", [dbl], [{ case: "reissue:2099-01-01", action: "escalate" }]).ok, false, "unknown case id");
  assert.equal(validateCases("roymorgan", [dbl, dbl]).ok, false, "duplicate case id");
  const pend = { case: "pending:2002" }, mm = { case: "mismatch:2001" };
  assert.equal(validateCases("pollbludger", [pend, mm], [{ case: pend.case, action: "defer" }, { case: mm.case, action: "same_wave" }]).ok, true);
  assert.equal(validateCases("pollbludger", [pend], [{ case: pend.case, action: "file_both" }]).ok, false, "house-mismatched action");
  assert.equal(validateCases("pollbludger", [{ case: "double:x:y" }]).ok, false, "unknown kind for house");
  // the evidence-size guard the extractors gate emission on
  assert.equal(caseJson({ case: "pending:1" }), JSON.stringify({ case: "pending:1" }), "small case serialises");
  assert.equal(caseJson({ case: "pending:1", blob: "x".repeat(6000) }), null, "over-cap bundle refused");
  assert.ok(caseJson({ case: "pending:1", blob: "x".repeat(6000) }, 8000), "the cap is the caller's knob");
}
console.log("contract table: ok");

// ---- B. adjudicate.mjs against a stubbed CLI -------------------------------------
const bin = mkdtempSync(path.join(tmpdir(), "adj-bin-"));
const stub = `#!/usr/bin/env node
// stub matilda CLI: answers from ADJ_STUB_MODE, derives case ids from the bundle
const argv = process.argv.slice(2);
if (process.env.ADJ_STUB_ARGV) require("node:fs").appendFileSync(process.env.ADJ_STUB_ARGV, JSON.stringify(argv) + "\\n");
const p = argv[argv.indexOf("-p") + 1] || "";
const mode = process.env.ADJ_STUB_MODE || "good";
if (mode === "garbage") { console.log("Sorry, I cannot help with that."); process.exit(0); }
const m = p.match(/## Evidence bundle \\(JSON\\)\\n\\n\`\`\`json\\n([\\s\\S]*?)\\n\`\`\`/);
const cases = JSON.parse(m ? m[1] : "{}").cases || [];
const ACTIONS = { double: "file_both", reissue: "escalate", pending: "defer", mismatch: "same_wave" };
const decisions = cases.map((c, i) => {
  const kind = c.case.split(":")[0];
  const d = { case: c.case, action: ACTIONS[kind] || "defer", reason: "stub verdict " + i };
  if (mode === "file_only_no_slug") return { case: c.case, action: "file_only", reason: "no slug" };
  if (mode === "poison" && i === 0) d.alp = 33; // a data field — routing only fails
  return d;
});
console.log("Some prose first.");
console.log(JSON.stringify({ decisions }, null, 2));
`;
writeFileSync(path.join(bin, "matilda"), stub);
chmodSync(path.join(bin, "matilda"), 0o755);

const adjRun = (house, statusObj, env = {}, args = []) => {
  const tmp = mkdtempSync(path.join(tmpdir(), "adj-"));
  const sf = path.join(tmp, "status.json");
  const out = path.join(tmp, "verdict.json");
  writeFileSync(sf, JSON.stringify(statusObj));
  const r = spawnSync(process.execPath, [".build/adjudicate.mjs", "--house", house, "--status-file", sf, "--out", out, ...args],
    { env: { ...baseEnv, PATH: bin + path.delimiter + baseEnv.PATH, ...env }, encoding: "utf8" });
  const last = r.stdout.trim().split("\n").pop();
  assert.ok(last.startsWith("ADJ_STATUS "), `no ADJ_STATUS line: ${r.stdout}\n${r.stderr}`);
  assert.equal(r.status, 0, "adjudicate must always exit 0: " + last);
  return { status: JSON.parse(last.slice(11)), out };
};

const MIXED = { ambiguous: [
  { case: "double:2026-09-20:2026-09-27", waves: [{ slug: "a-federal-voting-intention-x" }], nearbyRows: [] },
  { case: "reissue:2026-09-13", moved: ["alp"] },
] };
{
  let s = adjRun("roymorgan", MIXED).status;
  assert.equal(s.ran, false); assert.equal(s.why, "no-key", "no key → no run");
  s = adjRun("roymorgan", { ambiguous: [] }, { MATILDA_API_KEY: "test" }).status;
  assert.equal(s.ran, false); assert.equal(s.why, "no-cases");
  s = adjRun("roymorgan", { ambiguous: [null, { case: "weird" }] }, { MATILDA_API_KEY: "test" }).status;
  assert.equal(s.ran, false); assert.match(s.why, /case emission invalid/, "malformed emission rejected before the LLM");
  s = adjRun("pollbludger", { ambiguous: Array.from({ length: 6 }, (_, i) => ({ case: `pending:${i}` })) }, { MATILDA_API_KEY: "test" }).status;
  assert.equal(s.ran, false); assert.match(s.why, /too many cases/);

  const argvLog = path.join(bin, "argv.log");
  let t = adjRun("roymorgan", MIXED, { MATILDA_API_KEY: "test", ADJ_STUB_ARGV: argvLog });
  assert.equal(t.status.ran, true); assert.equal(t.status.applied, true, "good verdict applies: " + JSON.stringify(t.status));
  assert.equal(t.status.decisions, 2);
  const v = JSON.parse(readFileSync(t.out, "utf8"));
  assert.deepEqual(v.decisions.map((d) => d.case), ["double:2026-09-20:2026-09-27", "reissue:2026-09-13"]);
  assert.deepEqual(v.decisions.map((d) => d.action), ["file_both", "escalate"]);
  assert.ok(v.decisions.every((d) => typeof d.reason === "string" && d.reason.length <= 240), "reasons capped");
  // the verdict call runs with NO tool surface: no --yolo, shell/write/edit
  // excluded; the hard budgets stay
  const callArgv = JSON.parse(readFileSync(argvLog, "utf8").trim().split("\n").pop());
  assert.ok(!callArgv.includes("--yolo"), "verdict call carries no --yolo");
  assert.deepEqual((callArgv[callArgv.indexOf("--exclude-tools") + 1] || "").split(",").sort(),
    ["edit", "shell", "write"], "shell/write/edit excluded from the verdict call");
  assert.ok(callArgv.includes("--max-wall-time") && callArgv.includes("--max-tool-calls"), "hard budgets still present");

  t = adjRun("roymorgan", MIXED, { MATILDA_API_KEY: "test", ADJ_STUB_MODE: "garbage" });
  assert.equal(t.status.applied, false); assert.match(t.status.why, /no JSON object/);
  t = adjRun("roymorgan", MIXED, { MATILDA_API_KEY: "test", ADJ_STUB_MODE: "poison" });
  assert.equal(t.status.applied, false); assert.match(t.status.why, /data field "alp"/, "poison key poisons the run");
  t = adjRun("roymorgan", MIXED, { MATILDA_API_KEY: "test", ADJ_STUB_MODE: "file_only_no_slug" });
  assert.equal(t.status.applied, false); assert.match(t.status.why, /needs a slug field/, "contract reject: slug");
  assert.ok(!existsSync(t.out), "no verdict file written on a rejected verdict");
}
console.log("adjudicate.mjs: ok");

// ---- C. pollbludger extractor adjudication ----------------------------------------
const ptXml = (id, pollster, start, end, sample, v) => {
  const tag = (k) => (v[k] == null ? `<${k} />` : `<${k}>${v[k]}</${k}>`);
  return `<point Id="${id}" start="${start}" end="${end}" median="${end}" pollster="${pollster}" mode="Online" scope="NAT" sample="${sample ?? ""}">` +
    ["ALP", "LNC", "GRN", "PHON", "UND", "ALP2", "LNC2", "ALPra", "LNCra", "UNDra"].map(tag).join("") + "</point>";
};
const election = ptXml(1, "Election", "03/05/2025", "03/05/2025", "", { ALP: 34.6, LNC: 31.8, GRN: 12.2, PHON: 6.4, ALP2: 55.2, LNC2: 44.8 });
const filler = Array.from({ length: 100 }, (_, i) => ptXml(100 + i, "YouGov", "01/06/2025", "07/06/2025", 1500, { ALP: 30, LNC: 30, GRN: 12, PHON: 15, ALPra: 51, LNCra: 49 }));
// feed Newspoll wave near (1d) the tracker Newspoll row with moved primaries: a
// mismatch case; RedBridge wave missing entirely: a pending case
const pbWaves =
  ptXml(2001, "Newspoll", "14/09/2026", "17/09/2026", 1244, { ALP: 27, LNC: 19, GRN: 13, PHON: 30 }) +
  ptXml(2002, "RedBridge Group", "17/09/2026", "20/09/2026", 993, { ALP: 28, LNC: 22, GRN: 11, PHON: 27, ALPra: 49, LNCra: 51, ALP2: 48, LNC2: 52 });
const pbFeed = `<root date="2026-09-21 01:01:55+00:00"><federal><table>${election}${filler.join("")}${pbWaves}</table></federal></root>`;

const poll = (pollster, date, client, extra = {}) => ({ date, dateStart: date, pollster, client, sample: 1000, alp: 30, lnp: 30, grn: 12, onp: 15, ind: 8, oth: 5, tpp_alp: 51, tpp_lnp: 49, ...extra });
const pbBase = () => ({
  metricRules: { favFirms: ["redbridge", "demosau", "freshwater", "spectre strategy"], overrides: {} },
  pollsterRules: { "Roy Morgan": {}, Newspoll: {}, "RedBridge/Accent": {} },
  polls: [
    poll("Roy Morgan", "2026-09-06", "—"),
    poll("Newspoll", "2026-09-18", "The Australian"), // sits within the date slack of feed wave 2001
    poll("RedBridge/Accent", "2026-08-30", "AFR"),
  ].sort((a, b) => (a.date < b.date ? -1 : 1)),
  ppm: [], approval: [], cyclePolls: {}, cycleApproval: {},
});

function pbTree() {
  const dir = mkdtempSync(path.join(tmpdir(), "pb-adj-"));
  const POLLS = path.join(dir, "polls.json");
  const SRC = path.join(dir, "src");
  const XML = path.join(dir, "current.xml");
  mkdirSync(SRC, { recursive: true });
  writeFileSync(POLLS, JSON.stringify(pbBase(), null, 2));
  writeFileSync(XML, pbFeed);
  const run = (args, env = {}) => {
    const r = spawnSync(process.execPath, [".build/extract-pollbludger.mjs", "--xml", XML, ...args],
      { env: { ...baseEnv, POLLS_JSON: POLLS, PB_SRC_DIR: SRC, ...env }, encoding: "utf8" });
    const last = r.stdout.trim().split("\n").pop();
    assert.ok(last.startsWith("PB_STATUS "), `no status line: ${r.stdout}\n${r.stderr}`);
    return { code: r.status, status: JSON.parse(last.slice(10)) };
  };
  const data = () => JSON.parse(readFileSync(POLLS, "utf8"));
  const ledger = () => (existsSync(path.join(SRC, "adjudicated.json")) ? JSON.parse(readFileSync(path.join(SRC, "adjudicated.json"), "utf8")) : null);
  const verdictTo = (decisions) => { const f = path.join(dir, "verdict.json"); writeFileSync(f, JSON.stringify({ decisions })); return f; };
  return { run, data, ledger, verdictTo, POLLS };
}
const NOW1 = "2026-09-21T02:00:00Z";

const isAmb = (s) => s.ambiguous.map((c) => c.case).sort();

{ // keyed: cases emitted + asked marks, verdicts same_wave/never_file applied, terminal wins
  const T = pbTree();
  let r = T.run(["--apply", "--adjudicate", "--now", NOW1], { MATILDA_API_KEY: "test" });
  assert.equal(r.code, 0);
  assert.equal(r.status.changed, false, "held waves never change data");
  assert.deepEqual(isAmb(r.status), ["mismatch:2001", "pending:2002"], JSON.stringify(r.status.ambiguous));
  assert.equal(T.data().fallbackPolls, undefined, "held waves not filed");
  let led = T.ledger();
  assert.equal(led[2001].action, "asked"); assert.equal(led[2002].action, "asked");

  const verdict = T.verdictTo([
    { case: "mismatch:2001", action: "same_wave", reason: "the 18 Sep row is this wave" },
    { case: "pending:2002", action: "never_file", reason: "pre-election calibration wave" },
  ]);
  r = T.run(["--apply", "--adjudicate", "--decisions", verdict, "--now", NOW1], { MATILDA_API_KEY: "test" });
  assert.equal(r.status.changed, false);
  assert.deepEqual(r.status.ambiguous, [], "nothing re-asked once asked");
  assert.ok(r.status.skipped.some((s) => /adjudicated same_wave/.test(s.why)), "same_wave skip: " + JSON.stringify(r.status.skipped));
  assert.ok(r.status.skipped.some((s) => /adjudicated never_file/.test(s.why)), "never_file skip");
  led = T.ledger();
  assert.equal(led[2001].action, "same_wave"); assert.ok(led[2001].decided && led[2001].reason, "same_wave is terminal with provenance");
  assert.equal(led[2002].action, "never_file");

  // the terminal ledger wins over a later contradictory verdict
  const flip = T.verdictTo([
    { case: "mismatch:2001", action: "distinct_wave", reason: "changed my mind" },
    { case: "pending:2002", action: "file_now", reason: "changed my mind" },
  ]);
  r = T.run(["--apply", "--adjudicate", "--decisions", flip, "--now", NOW1], { MATILDA_API_KEY: "test" });
  assert.equal(r.status.changed, false, "terminal marks are final");
  assert.equal(T.data().fallbackPolls, undefined);
}

{ // keyed: distinct_wave + file_now file immediately, rows validate, then idempotent
  const T = pbTree();
  const verdict = T.verdictTo([
    { case: "mismatch:2001", action: "distinct_wave", reason: "a second wave in the window" },
    { case: "pending:2002", action: "file_now", reason: "trust the feed here" },
  ]);
  let r = T.run(["--apply", "--adjudicate", "--decisions", verdict, "--now", NOW1], { MATILDA_API_KEY: "test" });
  assert.equal(r.status.changed, true);
  assert.deepEqual(r.status.filed.map((f) => f.pollster + " " + f.date).sort(), ["Newspoll 2026-09-17", "RedBridge/Accent 2026-09-20"], JSON.stringify(r.status.filed));
  const D = T.data();
  assert.equal(D.polls.length, 3, "polls[] never written");
  assert.equal(D.fallbackPolls.length, 2);
  const np = D.fallbackPolls.find((f) => f.pollster === "Newspoll");
  assert.equal(np?.date, "2026-09-17", "distinct wave filed beside the 18 Sep canonical row");
  const rb = D.fallbackPolls.find((f) => f.pollster === "RedBridge/Accent");
  assert.deepEqual([rb.tpp_alp, rb.tpp_lnp, rb.tpp_flows], [49, 51, 48], "RA headline with flows beside it");
  assert.deepEqual(validate(D).errors, [], "validate accepts the adjudicated rows");
  const led = T.ledger();
  assert.equal(led[2001].action, "distinct_wave"); assert.equal(led[2002].action, "file_now");
  r = T.run(["--apply", "--now", NOW1]);
  assert.equal(r.status.changed, false); assert.deepEqual(r.status.filed, [], "idempotent beside the adjudicated-against row");

  // the house's REAL row for this wave lands later → prunes it, adjudication or not
  const landed = T.data();
  landed.polls.push(poll("Newspoll", "2026-09-17", "The Australian"));
  landed.polls.sort((a, b) => (a.date < b.date ? -1 : 1));
  writeFileSync(T.POLLS, JSON.stringify(landed, null, 2));
  r = T.run(["--apply", "--now", "2026-09-21T22:00:00Z"]);
  assert.deepEqual(r.status.pruned.map((p) => p.pollster), ["Newspoll"], "a new canonical row prunes even an adjudicated fallback");
  assert.deepEqual(T.data().fallbackPolls.map((f) => f.pollster), ["RedBridge/Accent"], "the file_now row is untouched");
  assert.deepEqual(validate(T.data()).errors, []);
}

{ // key-less: --adjudicate is a no-op — exactly today's deterministic clock
  const T = pbTree();
  const r = T.run(["--apply", "--adjudicate", "--now", NOW1]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.status.ambiguous, [], "no cases without a key");
  assert.equal(T.ledger(), null, "no adjudication ledger without a key");
  assert.ok(!r.status.pending.some((p) => p.id === "2001"), "mismatch wave is covered by the dedupe");
  assert.ok(r.status.pending.some((p) => p.id === "2002" && p.filesAt), "pending wave stays on the plain grace clock");
}
console.log("pollbludger extractor: ok");

// ---- D. roymorgan extractor adjudication -------------------------------------------
const RM_SCRIPT = path.resolve(".build/extract-roymorgan.mjs");
// Builder t: primaries [alp,lnp,grn,onp,ind]; lib = lnp-2, nat = 2
const rmContent = ({ alp, lnp, grn, onp, ind, tpp, flows = null, und = null, sample = 1583, from = "September 14 - 27, 2026" }) =>
  // the lead mirrors the real release's shape: keyword+digit pairings that
  // toValIn's pattern ladder resolves unambiguously (e.g. "Greens 12%", no "on")
  `The ALP on ${alp}% is ahead of One Nation on ${onp}%. The L-NP Coalition primary is ${lnp}% (${lnp - 2}% Liberal, 2% Nationals); Greens ${grn}% and Independents/ Others ${ind}%. ` +
  `The results are based on a representative Australia-wide cross-section of ${sample.toLocaleString("en-US")} electors. ` +
  `This Roy Morgan Poll on Federal voting intention was conducted from ${from} for this wave. ` +
  (und != null ? `A further ${und}% (up 1%) of electors can't say who they support. ` : "") +
  `If a Federal Election were held now on the basis of how electors said they'd 'vote' their preferences the ALP would win - ALP ${tpp[0]}% cf. L-NP ${tpp[1]}%. ` +
  (flows != null ? `When preferences are allocated based on how Australians voted at the 2025 Federal Election the ALP ${flows[0]}% leads L-NP ${flows[1]}%.` : "");

const rmPoll = (date, dateStart, alp, und, extra = {}) => ({
  date, dateStart, pollster: "Roy Morgan", client: "—", sample: 2569, alp, lnp: 22, grn: 12, onp: 25, ind: 7, oth: 1,
  tpp_alp: 55, tpp_lnp: 45, lnpSplit: { Lib: 20, Nat: 2 }, url: "https://www.roymorgan.com/findings/x", ...extra,
});
const rmBase = (extraRows) => ({
  metricRules: { favFirms: ["redbridge", "demosau"], overrides: {} },
  pollsterRules: { "Roy Morgan": {}, Newspoll: {}, Resolve: {} },
  polls: [
    rmPoll("2026-08-30", "2026-08-17", 32),
    rmPoll("2026-09-06", "2026-08-24", 33),
    poll("Newspoll", "2026-08-27", "The Australian"),
    poll("Resolve", "2026-09-14", "SMH"),
    ...extraRows,
  ].sort((a, b) => (a.date < b.date ? -1 : 1)),
  ppm: [], approval: [], cyclePolls: {}, cycleApproval: {},
});
function rmTree({ rows = [], waves }) {
  const dir = mkdtempSync(path.join(tmpdir(), "rm-adj-"));
  mkdirSync(path.join(dir, "data"), { recursive: true });
  const feed = mkdtempSync(path.join(tmpdir(), "rm-feed-"));
  waves.forEach((w, i) => {
    writeFileSync(path.join(feed, `post-${w.slug}.json`), JSON.stringify({
      props: { pageProps: { findingData: { postBy: { date: w.postDate || "2026-09-29T10:00:00", content: w.content, findings: { releaseDate: w.release } } } } },
    }));
    w.feedEntry = { slug: w.slug, date: w.postDate || "2026-09-29T10:00:00", release_date: w.release, topics: [{ name: "Federal Poll" }] };
  });
  writeFileSync(path.join(feed, "feed-page-1.json"), JSON.stringify(waves.map((w) => w.feedEntry)));
  mkdirSync(path.join(dir, "data"), { recursive: true });
  writeFileSync(path.join(dir, "data", "polls.json"), JSON.stringify(rmBase(rows), null, 2));
  const run = (args, env = {}) => {
    const r = spawnSync(process.execPath, [RM_SCRIPT, "--feed-dir", feed, ...args], { cwd: dir, env: { ...baseEnv, ...env }, encoding: "utf8" });
    const last = (r.stdout.trim().split("\n").pop() || "");
    const st = last.startsWith("RM_STATUS ") ? JSON.parse(last.slice(10)) : null;
    return { code: r.status, status: st, out: r.stdout, err: r.stderr };
  };
  const data = () => JSON.parse(readFileSync(path.join(dir, "data", "polls.json"), "utf8"));
  const ledger = () => (existsSync(path.join(dir, ".build/roymorgan-src/adjudicated.json")) ? JSON.parse(readFileSync(path.join(dir, ".build/roymorgan-src/adjudicated.json"), "utf8")) : null);
  const verdictTo = (decisions) => { const f = path.join(dir, "verdict.json"); writeFileSync(f, JSON.stringify({ decisions })); return f; };
  return { run, data, ledger, verdictTo };
}

const WAVE_A = { // Sep 14-27 wave: overlaps wave B's window
  slug: "10001-federal-voting-intention-september-27-2026", release: "29/09/2026",
  content: rmContent({ alp: 33, lnp: 22, grn: 12, onp: 25, ind: 8, tpp: [55, 45], flows: [52, 48], from: "September 14 - 27, 2026" }),
};
const WAVE_B = { // Sep 7-20 wave: 7d from A's date but the field windows overlap → same cluster
  slug: "10002-federal-voting-intention-september-20-2026", release: "21/09/2026", postDate: "2026-09-21T09:00:00",
  content: rmContent({ alp: 31, lnp: 23, grn: 12, onp: 26, ind: 8, tpp: [53, 47], from: "September 7 - 20, 2026" }),
};
const DOUBLE_CASE = "double:2026-09-20:2026-09-27";

{ // held on ask; file_only verdict files the named wave and dup-marks its sibling forever
  const T = rmTree({ rows: [], waves: [WAVE_A, WAVE_B] });
  let r = T.run(["--adjudicate"], { MATILDA_API_KEY: "test" });
  assert.equal(r.code, 0, r.err + r.out);
  assert.equal(r.status.changed, false, "cluster held, nothing filed");
  const cases = r.status.ambiguous;
  assert.equal(cases.length, 1);
  assert.equal(cases[0].case, DOUBLE_CASE, "cluster joined by the overlapping window: " + JSON.stringify(cases));
  assert.ok(cases[0].nearbyRows.length >= 2, "cluster case carries nearby RM rows as evidence");
  assert.deepEqual([...r.status.held].sort(), [WAVE_A.slug, WAVE_B.slug].sort(), "both slugs held");
  assert.equal(T.ledger()[DOUBLE_CASE].action, "asked");

  const verdict = T.verdictTo([{ case: DOUBLE_CASE, action: "file_only", slug: WAVE_A.slug, reason: "B is a re-skin of A" }]);
  r = T.run(["--adjudicate", "--decisions", verdict], { MATILDA_API_KEY: "test" });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.status.changed, true);
  assert.deepEqual(r.status.added.map((a) => a.date), ["2026-09-27"], "only the verdict's slug files");
  const D = T.data();
  assert.ok(D.polls.some((p) => p.date === "2026-09-27" && p.tpp_flows === 52), "wave A filed with its flows pair");
  assert.ok(!D.polls.some((p) => p.date === "2026-09-20"), "sibling never filed");
  assert.deepEqual(validate(D).errors, [], "validate accepts the adjudicated filing");
  const led = T.ledger();
  assert.equal(led[WAVE_B.slug].action, "dup_of"); assert.equal(led[WAVE_B.slug].of, WAVE_A.slug);

  r = T.run(["--adjudicate"], { MATILDA_API_KEY: "test" });
  assert.equal(r.status.changed, false, "dup-marked slug is gone from candidacy forever");
  assert.deepEqual(r.status.ambiguous, []);
}

{ // ask spent, no verdict: the plain rule owns and everything files
  const T = rmTree({ rows: [], waves: [WAVE_A, WAVE_B] });
  let r = T.run(["--adjudicate"], { MATILDA_API_KEY: "test" });
  assert.equal(r.status.ambiguous.length, 1);
  r = T.run(["--adjudicate"]); // key-less re-run: the asked mark holds the case spent
  assert.equal(r.code, 0, r.err);
  assert.equal(r.status.changed, true, "after the ask is spent the plain rule files both");
  assert.deepEqual(r.status.added.map((a) => a.date).sort(), ["2026-09-20", "2026-09-27"]);
  assert.deepEqual(validate(T.data()).errors, []);
}

const REISSUE = {
  slug: "10003-federal-voting-intention-september-13-2026", release: "15/09/2026", postDate: "2026-09-15T10:00:00",
  content: rmContent({ alp: 34, lnp: 22, grn: 12, onp: 25, ind: 7, tpp: [55, 45], flows: [52, 48], und: 7, sample: 1102, from: "September 7 - 13, 2026" }),
};
{ // reissue + heal_absent: absent allowlisted fields only, never an overwrite
  const row = rmPoll("2026-09-13", "2026-09-07", 33);
  row.tpp_flows = undefined; delete row.tpp_flows;
  const T = rmTree({ rows: [row], waves: [REISSUE] });
  let r = T.run(["--adjudicate"], { MATILDA_API_KEY: "test" });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.status.ambiguous.map((c) => c.case), ["reissue:2026-09-13"]);
  assert.deepEqual(r.status.ambiguous[0].moved, ["alp"], "only the primary moved");
  assert.equal(r.status.ambiguous[0].parsed.tpp_flows, 52, "evidence carries the heal candidate");
  assert.deepEqual(T.data().polls.find((p) => p.date === "2026-09-13").published, undefined, "untouched until a verdict");

  const verdict = T.verdictTo([{ case: "reissue:2026-09-13", action: "heal_absent", reason: "re-release carried the flows pair" }]);
  r = T.run(["--adjudicate", "--decisions", verdict], { MATILDA_API_KEY: "test" });
  assert.equal(r.status.changed, true);
  assert.deepEqual(r.status.reissue_healed.map((h) => h.date), ["2026-09-13"]);
  const healed = T.data().polls.find((p) => p.date === "2026-09-13");
  assert.equal(healed.tpp_flows, 52, "healed from the reissue");
  assert.equal(healed.undecided, 7);
  assert.equal(typeof healed.published, "string", "published healed");
  assert.equal(healed.sample, 2569, "a field the row carries is never touched");
  assert.equal(healed.alp, 33, "figures are never overwritten");
  assert.equal(T.ledger()["reissue:2026-09-13"].action, "heal_absent", "terminal ledger entry");
  assert.deepEqual(validate(T.data()).errors, []);
}

{ // reissue + escalate: notes it, changes nothing
  const T = rmTree({ rows: [rmPoll("2026-09-13", "2026-09-07", 33)], waves: [REISSUE] });
  let r = T.run(["--adjudicate"], { MATILDA_API_KEY: "test" });
  assert.deepEqual(r.status.ambiguous.map((c) => c.case), ["reissue:2026-09-13"]);
  const verdict = T.verdictTo([{ case: "reissue:2026-09-13", action: "escalate", reason: "genuine correction — human call" }]);
  r = T.run(["--adjudicate", "--decisions", verdict], { MATILDA_API_KEY: "test" });
  assert.equal(r.status.changed, false, "escalate never changes data");
  assert.deepEqual(r.status.escalated, ["2026-09-13"]);
  assert.equal(T.data().polls.find((p) => p.date === "2026-09-13").alp, 33);
  assert.equal(T.ledger()["reissue:2026-09-13"].action, "escalate");
}

{ // key-less RM run: no cases, no ledger — plain run files everything
  const T = rmTree({ rows: [rmPoll("2026-09-13", "2026-09-07", 33)], waves: [WAVE_A, WAVE_B] });
  const r = T.run(["--adjudicate"]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.status.ambiguous, []);
  assert.equal(T.ledger(), null, "no adjudication ledger without a key");
  assert.equal(r.status.changed, true);
  assert.deepEqual(r.status.added.map((a) => a.date).sort(), ["2026-09-20", "2026-09-27"], "plain run files both");
}
console.log("roymorgan extractor: ok");

console.log("test-adjudicate: ok");
