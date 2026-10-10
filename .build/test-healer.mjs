/* test-healer.mjs — pins for the layout healer's deterministic half
   (.build/healer.mjs), exercised end to end without a network:

   gate          only an "(exit 2)" guard trip opens the healer; transient
                 upstream, push races, dirty-tree refusals and logless runs
                 never do.
   faithfulness  figures must match the printed form ("27%", "1,512"); bare
                 digits (a day-of-month) are not evidence.
   acceptance    fabricated evidence + fabricated agent output under a temp
                 root per house: correct rows land sorted with extractor
                 parity (row shape, provenance sidecars, run proof);
                 hallucinated figures, house-guard violations and duplicates
                 are all rejected — and a second run is a quiet no-op.

   Run: node .build/test-healer.mjs */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import assert from "node:assert/strict";
import { gateVerdict, failLinesOf, unfaithfulFields, acceptRun, readLlmJson } from "./healer.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "healer-test-"));
const put = (path, str) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, str); };

// ------------------------------------------------------------------ gate
// Lines as `gh run view --log-failed` prints them: job \t step \t ISO ts.
const GH = "update\tRun the roymorgan updater\t2026-10-02T00:12:44.1234567Z ";
{
  const lines = failLinesOf(GH + '2026-10-02 00:12:44 FAIL extract (exit 2): RM_STATUS {"changed":false,"guard":["x: primaries Σ=113.0 ~100"]}\n');
  assert.deepEqual(lines, ['FAIL extract (exit 2): RM_STATUS {"changed":false,"guard":["x: primaries Σ=113.0 ~100"]}']);
  const v = gateVerdict(lines);
  assert.equal(v.heal, true, "a guard trip (exit 2) is healer work");
  assert.equal(v.kind, "exit-2");
}
{
  const v = gateVerdict(failLinesOf(GH + '2026-10-02 00:12:44 FAIL extract (exit 1): RM_STATUS {"changed":false,"error":"feed page 1 fetch failed after 3 tries: fetch failed"}\n'));
  assert.equal(v.class, "transient");
  assert.equal(v.kind, "upstream");
  assert.equal(v.heal, false, "the pollster being down is never healer work");
}
{
  const v = gateVerdict(failLinesOf(GH + '2026-10-02 00:12:44 FAIL push race: the push after the rebase was rejected too (commit kept locally: x)\n'));
  assert.equal(v.class, "transient");
  assert.equal(v.kind, "race");
  assert.equal(v.heal, false);
}
{
  const v = gateVerdict(failLinesOf(GH + '2026-10-02 00:12:44 FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base\n'));
  assert.equal(v.class, "defect");
  assert.equal(v.heal, false, "a dirty-tree refusal belongs nowhere near the healer");
}
{
  const v = gateVerdict([]);
  assert.equal(v.kind, "no-fail-line");
  assert.equal(v.heal, false, "an opaque defect is agent-repair's, not the healer's");
}
{
  // end-to-end through the CLI: a logdir with the guard-trip line above
  const dir = tmp();
  writeFileSync(join(dir, "run.log"), GH + '2026-10-02 00:12:44 FAIL extract (exit 2): N24_STATUS {"guard":["wiki fallback: 5 new waves > cap 4"]}\n');
  const out = execFileSync("node", [".build/healer.mjs", "--gate", "--logdir", dir], { encoding: "utf8" });
  const v = JSON.parse(out.trim().split("\n").pop().replace(/^HEALER_GATE /, ""));
  assert.equal(v.heal, true);
  assert.equal(v.kind, "exit-2");
}

// ----------------------------------------------------- faithfulness wall
{
  const text = "ALP primary support is down 1.5% to 27% ... a cross-section of 1,512 Australian electors.";
  assert.deepEqual(unfaithfulFields(text, [
    { name: "alp", value: 27, kind: "pct" },
    { name: "sample", value: 1512, kind: "sample" },
  ]), []);
  assert.deepEqual(unfaithfulFields(text, [{ name: "alp", value: 26.5, kind: "pct" }]), ["alp=26.5"],
    "an invented figure cannot pass");
  assert.deepEqual(unfaithfulFields("on 27 September the Prime Minister", [{ name: "alp", value: 27, kind: "pct" }]), ["alp=27"],
    "a bare day-of-month is not a printed share");
  assert.deepEqual(unfaithfulFields("sample of 1380 electors", [{ name: "sample", value: 1380, kind: "sample" }]), [],
    "a comma-free printed sample also matches");
}

// ------------------------------------------- roymorgan acceptance (int.)
const RM_TEXT =
  "ALP primary support is down 1.5% to 27.5% while L-NP Coalition support is up 0.5% to 38.5% comprising the Liberals 34% " +
  "and Nationals 4.5%. The Greens are unchanged at 12.5%, One Nation support is up 1% to 13%, and support for " +
  "Independents/ Others is down 2% to 8.5%. If a federal election were held now the ALP 52% (down 1.5%) would be " +
  "returned to government against the L-NP 48% (up 1.5%) on a two-party preferred basis, according to how electors " +
  "say they would vote their preferences. This Roy Morgan survey was conducted from September 21 – 27, 2026 with a " +
  "cross-section of 1,512 Australian electors. A further 5.5% (down 0.5%) of electors can't say who they support. " +
  "Allocating preference flows based on how Australians voted at the 2025 Federal Election shows the ALP on 51.5% " +
  "cf. the L-NP on 48.5%.";
const RM_SLUG = "federal-voting-intention-september-26-2026";

function rmTree(waveOverride = {}) {
  const root = tmp();
  const evidenceDir = join(root, "evidence");
  put(join(evidenceDir, `rel-${RM_SLUG}.txt`), RM_TEXT + "\n");
  put(join(evidenceDir, `post-${RM_SLUG}.json`), JSON.stringify({ content: "<p>html</p>", date: "2026-09-28T02:15:00" }, null, 2) + "\n");
  put(join(evidenceDir, "manifest.json"), JSON.stringify({
    house: "roymorgan", releases: [{
      slug: RM_SLUG,
      url: `https://www.roymorgan.com/findings/${RM_SLUG}`,
      releaseDateIso: "2026-09-28", postDate: "2026-09-28T02:15:00",
      textFile: `rel-${RM_SLUG}.txt`,
    }],
  }, null, 2) + "\n");
  const pollsPath = join(root, "polls.json");
  writeFileSync(pollsPath, JSON.stringify({
    polls: [
      { date: "2026-08-30", pollster: "Roy Morgan" },
      { date: "2026-09-27", pollster: "YouGov" },
    ],
  }, null, 2) + "\n");
  const wave = {
    slug: RM_SLUG, date: "2026-09-27", dateStart: "2026-09-21", sample: 1512,
    alp: 27.5, lnp: 38.5, grn: 12.5, onp: 13, ind: 8.5, lib: 34, nat: 4.5,
    tpp_alp: 52, tpp_lnp: 48, undecided: 5.5, tpp_flows: 51.5,
    ...waveOverride,
  };
  const outFile = join(root, "out.json");
  writeFileSync(outFile, JSON.stringify({ waves: [wave], notes: "ok" }));
  return { root, evidenceDir, pollsPath, outFile };
}

{
  const t = rmTree();
  const st = await acceptRun("roymorgan", { ...t, srcRoot: t.root });
  assert.equal(st.changed, true, "a well-formed wave is accepted");
  assert.equal(st.accepted.length, 1);
  const D = JSON.parse(readFileSync(t.pollsPath, "utf8"));
  assert.equal(D.polls.length, 3);
  const row = D.polls.find((p) => p.pollster === "Roy Morgan" && p.date === "2026-09-27");
  assert.ok(row, "the row landed");
  assert.equal(row.client, "—");
  assert.equal(row.oth, null);
  assert.deepEqual(row.lnpSplit, { Lib: 34, Nat: 4.5 });
  assert.equal(row.tpp_flows, 51.5);
  assert.equal(row.undecided, 5.5);
  assert.equal(row.published, "2026-09-28T12:15", "CMS datetime converted to Melbourne local like the extractor's own rows");
  assert.equal(row.url, `https://www.roymorgan.com/findings/${RM_SLUG}`);
  assert.deepEqual(D.polls.map((p) => p.pollster), ["Roy Morgan", "YouGov", "Roy Morgan"], "globally date-sorted");
  assert.ok(existsSync(join(t.root, ".build/roymorgan-src", `release-${RM_SLUG}.json`)), "extractor-parity provenance sidecar");
  assert.ok(existsSync(join(t.root, st.proof)), "the run proof is written");
  // second run over the same output: the row is now a duplicate, quiet no-op
  const st2 = await acceptRun("roymorgan", { ...t, srcRoot: t.root });
  assert.equal(st2.changed, false);
  assert.equal(st2.rejected.length, 1);
  assert.match(st2.rejected[0].reasons[0], /already has a Roy Morgan row/);
}
{
  const t = rmTree({ alp: 26.5 }); // not printed anywhere in the evidence
  const st = await acceptRun("roymorgan", { ...t, srcRoot: t.root });
  assert.equal(st.changed, false, "hallucinated figures never land");
  assert.match(st.rejected[0].reasons[0], /not found verbatim/);
}
{
  const t = rmTree({ nat: 5.5 }); // printed (the undecided line) but 34 + 5.5 ≠ 38.5
  const st = await acceptRun("roymorgan", { ...t, srcRoot: t.root });
  assert.equal(st.changed, false);
  assert.match(st.rejected[0].reasons.join(" "), /lib\+nat=39.5 ≈ lnp=38.5/, "the house guard owns plausibility, not the healer");
}
{
  const t = rmTree({ date: "2026-08-30" }); // an already-recorded wave
  const st = await acceptRun("roymorgan", { ...t, srcRoot: t.root });
  assert.equal(st.changed, false);
  assert.match(st.rejected[0].reasons[0], /already has a Roy Morgan row/);
}
{
  const t = rmTree();
  writeFileSync(t.outFile, "{ not json");
  await assert.rejects(() => acceptRun("roymorgan", { ...t, srcRoot: t.root }), SyntaxError,
    "malformed agent output is a loud acceptance defect, never silently rescued");
}
{
  const t = rmTree();
  writeFileSync(t.outFile, JSON.stringify({ waves: [], notes: "release is an SMS special — out of scope" }));
  const st = await acceptRun("roymorgan", { ...t, srcRoot: t.root });
  assert.equal(st.changed, false);
  assert.match(st.note, /zero waves/, "zero waves is a quiet, successful outcome");
}

// ----------------------------------------------- news24 acceptance (int.)
const N24_WIKI = [
  "==2026==",
  '{| class="wikitable"',
  "! Date !! Firm !! Sample !! ALP !! L/NP !! GRN !! ON !! IND !! OTH !! 2PP",
  "|-",
  "| 24–29 Sep",
  "| [[YouGov]]",
  "| 1,501",
  "| 33% || 36% || 12% || 14% || 3% || 2% || 52% || 48%",
  "|-",
  "| 15 Sep",
  "| [[YouGov]]",
  "| 1,380",
  "| 34% || 37% || 12% || 13% || 2.5% || 1.5% || — || —",
  "|}",
].join("\n");

function n24Tree(waves, prePolls = []) {
  const root = tmp();
  const evidenceDir = join(root, "evidence");
  put(join(evidenceDir, "wiki.txt"), N24_WIKI + "\n");
  const pollsPath = join(root, "polls.json");
  writeFileSync(pollsPath, JSON.stringify({ polls: prePolls }, null, 2) + "\n");
  const outFile = join(root, "out.json");
  writeFileSync(outFile, JSON.stringify({ waves, notes: "ok" }));
  return { root, evidenceDir, pollsPath, outFile };
}

const N24_WAVES = [
  { date: "2026-09-29", dateStart: "2026-09-24", sample: 1501, client: "News24", url: "https://www.news24.com.au/x", alp: 33, lnp: 36, grn: 12, onp: 14, ind: 3, oth: 2, tpp_alp: 52, tpp_lnp: 48 },
  { date: "2026-09-15", dateStart: "2026-09-15", sample: 1380, client: "News24", alp: 34, lnp: 37, grn: 12, onp: 13, ind: 2.5, oth: 1.5 },
];
{
  const t = n24Tree(N24_WAVES);
  const st = await acceptRun("news24", { ...t, srcRoot: t.root });
  assert.equal(st.changed, true);
  assert.equal(st.accepted.length, 2);
  const D = JSON.parse(readFileSync(t.pollsPath, "utf8"));
  assert.equal(D.polls.length, 2);
  assert.deepEqual(D.polls.map((p) => p.date), ["2026-09-15", "2026-09-29"], "inserted in date order");
  const [sep15, sep29] = D.polls;
  assert.equal(sep15.tpp_alp, null, "a wave without a 2PP files absent-not-zero");
  assert.equal("published" in sep15, false, "wiki-only rows carry no published key");
  assert.equal("url" in sep15, false);
  assert.equal(sep29.client, "News24");
  assert.equal(sep29.tpp_lnp, 48);
  assert.ok(existsSync(join(t.root, ".build/news24-src", "wiki-2026-09-29.json")), "extractor-parity provenance sidecar");
  const sidecar = JSON.parse(readFileSync(join(t.root, ".build/news24-src", "wiki-2026-09-29.json"), "utf8"));
  assert.equal(sidecar.healer, true, "healer-filed sidecars say so");
  const st2 = await acceptRun("news24", { ...t, srcRoot: t.root });
  assert.equal(st2.changed, false, "re-running is a deduped no-op");
  assert.equal(st2.rejected.length, 2);
}
{
  // "13.5%"/"12.5%" are nowhere in the wikitext, and the pair keeps Σ=100 so
  // the guard passes and the FAITHFULNESS wall is the gate under test
  const t = n24Tree([{ ...N24_WAVES[0], grn: 13.5, onp: 12.5 }]);
  const st = await acceptRun("news24", { ...t, srcRoot: t.root });
  assert.equal(st.changed, false);
  assert.match(st.rejected[0].reasons[0], /not found verbatim/);
}
{
  const t = n24Tree([{ ...N24_WAVES[0], sample: 900 }]); // under the house guard's 1000–2500 range
  const st = await acceptRun("news24", { ...t, srcRoot: t.root });
  assert.equal(st.changed, false);
  assert.match(st.rejected[0].reasons.join(" "), /sample=900 in 1000–2500/);
}
{
  // half a pair — JSON.stringify drops the undefined member, as the agent
  // would emit it
  const t = n24Tree([{ ...N24_WAVES[0], tpp_alp: 52, tpp_lnp: undefined }], []);
  const st = await acceptRun("news24", { ...t, srcRoot: t.root });
  assert.equal(st.changed, false, "a 2PP pair is both or neither");
}
{
  const t = n24Tree(N24_WAVES, [{ date: "2026-09-29", pollster: "YouGov" }]);
  const st = await acceptRun("news24", { ...t, srcRoot: t.root });
  assert.equal(st.accepted.length, 1, "only the genuinely missing wave files");
  assert.equal(st.accepted[0].date, "2026-09-15");
}
{
  // a wave dated in the future can never be real — the guard says so
  const t = n24Tree([{ ...N24_WAVES[0], date: "2999-01-01", dateStart: "2999-01-01" }]);
  const st = await acceptRun("news24", { ...t, srcRoot: t.root });
  assert.equal(st.changed, false);
  assert.match(st.rejected[0].reasons.join(" "), /not future/);
}

// ------------------------------------- faithfulness wall, boundary anchors
// A printed form counts only as its own token: "152%" never vouches for
// 52, "1,512" never for 512, and a digit run's head is not a token either.
{
  assert.deepEqual(unfaithfulFields("152% of respondents", [{ name: "alp", value: 52, kind: "pct" }]), ["alp=52"],
    "a glued-on leading digit does not print the figure");
  assert.deepEqual(unfaithfulFields("1,512 electors", [{ name: "s", value: 512, kind: "sample" }]), ["s=512"],
    "a thousands-group is not the tail figure");
  assert.deepEqual(unfaithfulFields("51,512 electors", [{ name: "s", value: 1512, kind: "sample" }]), ["s=1512"],
    "nor is a longer comma-grouped number");
  assert.deepEqual(unfaithfulFields("batch 15125 ran", [{ name: "s", value: 1512, kind: "sample" }]), ["s=1512"],
    "the head of a longer digit run is not a token");
  assert.deepEqual(unfaithfulFields("growth of 2.5% year on year", [{ name: "g", value: 5, kind: "pct" }]), ["g=5"],
    "a decimal is not its fractional tail");
  assert.deepEqual(unfaithfulFields("a sample of 1,512. ask them", [{ name: "s", value: 1512, kind: "sample" }]), [],
    "a trailing full stop is still the token");
}

// --------------------------------------------------------- output parsing
// readLlmJson is the adjudicator's tolerant extraction: plain JSON parses
// whole, fences are stripped, prose-wrapped JSON is found, garbage is a
// loud SyntaxError (never a silent empty verdict).
{
  const dir = tmp();
  const f = (name, text) => { const p = join(dir, name); writeFileSync(p, text); return p; };
  assert.deepEqual(readLlmJson(f("plain.json", '{"waves":[],"notes":"ok"}\n')), { waves: [], notes: "ok" });
  assert.deepEqual(readLlmJson(f("fenced.json", "```json\n{\"waves\":[]}\n```\n")), { waves: [] });
  assert.deepEqual(readLlmJson(f("prose.json", "Here is my filing.\n{\"waves\":[]}\nDone.\n")), { waves: [] });
  assert.throws(() => readLlmJson(f("garbage.json", "no object here at all")), SyntaxError);
  assert.throws(() => readLlmJson(f("empty.json", "")), SyntaxError);
}

// ----------------------------------------- news24 cap: >4 new wiki waves
// Five new waves in one pass is the same upstream shift the extractor's
// MAX_WIKI_ADDS=4 guards — the healer refuses LOUDLY (exit 2, not a quiet
// trim or a partial filing), writing nothing. End-to-end through the CLI.
{
  const root = tmp();
  const rows = [], waves = [];
  for (let i = 1; i <= 5; i++) {
    const date = `2026-09-${String(i).padStart(2, "0")}`;
    const sample = 1500 + i;
    rows.push(`| ${i} Sep\n| [[YouGov]]\n| ${sample.toLocaleString("en-US")}\n| 34% || 36% || 12% || 13% || 3% || 2% || 51% || 49%`);
    waves.push({ date, dateStart: date, sample, client: "News24", alp: 34, lnp: 36, grn: 12, onp: 13, ind: 3, oth: 2, tpp_alp: 51, tpp_lnp: 49 });
  }
  const wiki = [
    "==2026==", '{| class="wikitable"',
    "! Date !! Firm !! Sample !! ALP !! L/NP !! GRN !! ON !! IND !! OTH !! 2PP",
    "|-", rows.join("\n|-\n"), "|}",
  ].join("\n");
  put(join(root, "evidence", "wiki.txt"), wiki + "\n");
  const pollsPath = join(root, "polls.json");
  writeFileSync(pollsPath, JSON.stringify({ polls: [] }) + "\n");
  const outFile = join(root, "out.json");
  writeFileSync(outFile, JSON.stringify({ waves }));
  let err = null;
  try {
    execFileSync("node", [".build/healer.mjs", "--accept", "--house", "news24",
      "--out", outFile, "--evidence-dir", join(root, "evidence"), "--polls", pollsPath],
      { encoding: "utf8", stdio: "pipe" });
  } catch (e) { err = e; }
  assert.ok(err, "five new wiki waves in one pass must not land");
  assert.equal(err.status, 2, "the refusal is loud (exit 2), not a quiet trim");
  assert.match(String(err.stderr), /wiki healer: 5 new waves > cap 4/);
  assert.equal(JSON.parse(readFileSync(pollsPath, "utf8")).polls.length, 0, "nothing was written");
}

// ------------------------------------------------------------- prompts
// The two agent prompts are part of the chain's correctness: their example
// JSON teaches the model what a valid wave looks like, so a mis-summed
// example (the 110-total roymorgan one) teaches mis-sums. And the output
// contract is stdout-only — no shell one-liners for dedupe (the agent has
// no shell); the manifest's existingDates carries the filed-date list.
for (const [file, primaries, tppKeys] of [
  [".build/healer-prompts/roymorgan.md", ["alp", "lnp", "grn", "onp", "ind"], ["tpp_alp", "tpp_lnp"]],
  [".build/healer-prompts/news24.md", ["alp", "lnp", "grn", "onp", "ind", "oth"], ["tpp_alp", "tpp_lnp"]],
]) {
  const md = readFileSync(file, "utf8");
  const m = /```json\n([\s\S]*?)\n```/.exec(md);
  assert.ok(m, `${file}: an example JSON block is present`);
  const ex = JSON.parse(m[1].replace(/"https:\/\/… or omit"/g, "null"));
  assert.ok(Array.isArray(ex.waves) && ex.waves.length, `${file}: the example has a wave`);
  for (const w of ex.waves) {
    const sum = primaries.reduce((a, k) => a + w[k], 0);
    assert.ok(Math.abs(sum - 100) < 0.51, `${file}: example primaries sum to 100, got ${sum}`);
    const [ta, tb] = tppKeys;
    assert.equal(w[ta] + w[tb], 100, `${file}: example 2PP sums to 100`);
    if ("lib" in w) assert.equal(w.lib + w.nat, w.lnp, `${file}: example lib+nat = lnp`);
  }
  assert.ok(!/node -e/.test(md), `${file}: no shell one-liners (the agent has no shell)`);
  assert.ok(md.includes("existingDates"), `${file}: the dedupe list comes from the manifest's existingDates`);
  assert.ok(/no\s+shell/i.test(md), `${file}: states the no-shell tool surface explicitly`);
}

console.log("test-healer: ok");
