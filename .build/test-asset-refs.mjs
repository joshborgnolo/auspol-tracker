/* test-asset-refs.mjs — pins for the torn-tree guard (.build/check-asset-refs.mjs
   + the shared .build/asset-refs.mjs extraction).

   The shape pinned here is the 2026-10-31 incident: a worktree sweep plus an
   `assets/` directory staging shipped the DELETION of late-css.deff1edb.js
   while every tab document still named it — and the reference itself was a
   JS config string (window.AP_LATE), which an attribute-only scan never
   sees. The committed-tree audit (--tree) had to be invented to see it at
   all: worktree checks can't judge what a commit lands.

   Hermetic half: a scratch repo with a consistent tree passes, the same
   tree minus a bare-string-referenced asset fails and names both file and
   referrer. Live half: the real repo's HEAD must be whole — the tripwire
   that turns any future torn landing red minutes after it lands.

   Run: node .build/test-asset-refs.mjs */
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { refsOfDocument } from "./asset-refs.mjs";

const CHECK = path.resolve(".build/check-asset-refs.mjs");
assert.ok(existsSync(CHECK), "check-asset-refs.mjs must exist beside this test");

/* ---- extraction units ------------------------------------------------------
   The three lanes land root-relative; doc-relative resolves against the
   doc's own directory; external and fragment refs never count. */
{
  const refs = refsOfDocument(
    `<script src="assets/js/app.aaaaaaaa.js"></script>
     <script>window.AP_LATE=["assets/js/late-css.bbbbbbbb.js","assets/js/x.js"];</script>
     <link rel="stylesheet" href="assets/site-shell.css?v=deadbeef">
     <style>.a{background:url("assets/tile.svg#t")}</style>
     <script>window.AP_SRC="/assets/cycle-source.dddddddd.json";</script>
     <a href="https://example.com/assets/not-ours.js">x</a>`,
    "index.html",
  );
  assert.ok(refs.has("assets/js/app.aaaaaaaa.js"), "markup attr lane");
  assert.ok(refs.has("assets/js/late-css.bbbbbbbb.js"), "bare AP_LATE string lane");
  assert.ok(refs.has("assets/site-shell.css"), "query suffix stripped");
  assert.ok(refs.has("assets/tile.svg"), "inline-css url lane, hash fragment stripped");
  assert.ok(refs.has("assets/cycle-source.dddddddd.json"), "site-absolute normalised");
  assert.ok(!refs.has("assets/not-ours.js"), "external host never counts");

  const nested = refsOfDocument(`<script src="../assets/js/deep.eeeeeeee.js"></script>`, "vic/index.html");
  assert.ok(nested.has("assets/js/deep.eeeeeeee.js"), "doc-relative resolves to the root");
  /* /a/b/../../x.js CLAMPS at the repo root (browser URL semantics) and
     lands in-repo; only a ref that still escapes after that is dropped */
  const clamped = refsOfDocument(`<script src="../../elsewhere/x.js"></script>`, "a/b/index.html");
  assert.ok(clamped.has("elsewhere/x.js"), "root-clamped relative refs land in-repo");
  const outside = refsOfDocument(`<script src="../../../../x.js"></script>`, "a/b/index.html");
  assert.equal(outside.size, 0, "paths escaping the repo are unverifiable, never a finding");
}

/* ---- hermetic committed-tree audits --------------------------------------- */
const root = mkdtempSync(path.join(tmpdir(), "assetrefs-"));
const git = (...args) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
const write = (rel, s) => {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, s);
};

git("init", "-q");
git("config", "user.email", "test@example.com");
git("config", "user.name", "test");

write("index.html", `<!doctype html><html><head>
<script src="assets/js/app.aaaaaaaa.js"></script>
<script>window.AP_LATE=["assets/js/late-css.bbbbbbbb.js"];</script>
<link rel="stylesheet" href="assets/site-shell.css?v=deadbeef">
<style>@font-face{src:url("assets/fonts/f.cccccccc.woff2")}</style>
</head><body></body></html>`);
write("tab/index.html", `<script>window.AP_SRC="/assets/cycle-source.dddddddd.json";</script>`);
write("assets/js/app.aaaaaaaa.js", "x");
write("assets/js/late-css.bbbbbbbb.js", "x");
write("assets/site-shell.css", "x");
write("assets/fonts/f.cccccccc.woff2", "x");
write("assets/cycle-source.dddddddd.json", "{}");
git("add", "-A");
git("commit", "-qm", "whole tree");

const run = (cwd, ...args) => spawnSync("node", [CHECK, ...args], {
  env: { ...process.env, AUSPOL_ROOT: cwd }, encoding: "utf8",
});

{
  const r = run(root, "--tree", "HEAD");
  assert.equal(r.status, 0, `a whole tree passes:\n${r.stderr}\n${r.stdout}`);
  assert.match(r.stdout, /asset-refs OK \(tree HEAD\):/, "pass line names the tree mode");
}

/* the incident's exact shape: delete an asset only a bare JS string names,
   commit nothing else — the deployed pages would 404 it on the next push */
git("rm", "-q", "assets/js/late-css.bbbbbbbb.js");
git("commit", "-qm", "deletion-only tear");
{
  const r = run(root, "--tree", "HEAD");
  assert.equal(r.status, 1, "a deletion-only torn tree must fail");
  assert.match(r.stderr, /FAIL asset-ref check/, "fails by the contract line");
  assert.match(r.stderr, /index\.html: assets\/js\/late-css\.bbbbbbbb\.js/, "names the missing ref and its referrer");
  const back = run(root, "--tree", "HEAD~1");
  assert.equal(back.status, 0, "the still-whole parent passes when named explicitly");
}

/* the deletion becomes lawful only once the referencing page moves with it —
   commit the re-pointed page and the deletion together */
write("index.html", `<!doctype html><html><head>
<script src="assets/js/app.aaaaaaaa.js"></script>
<script>window.AP_LATE=["assets/js/late-css.99999999.js"];</script>
<link rel="stylesheet" href="assets/site-shell.css?v=deadbeef">
<style>@font-face{src:url("assets/fonts/f.cccccccc.woff2")}</style>
</head><body></body></html>`);
write("assets/js/late-css.99999999.js", "x");
git("add", "-A");
git("commit", "-qm", "re-point and delete in one commit");
{
  const r = run(root, "--tree", "HEAD");
  assert.equal(r.status, 0, `deletion + re-point together is coherent:\n${r.stderr}\n${r.stdout}`);
}

/* ---- the live tripwire ------------------------------------------------------
   Every guard above aside, HEAD itself must be whole — red within minutes
   of anything torn landing. */
{
  const r = spawnSync("node", [CHECK, "--tree", "HEAD"], { encoding: "utf8" });
  assert.equal(r.status, 0, `the repo's own HEAD must be whole:\n${r.stderr}\n${r.stdout}`);
}

console.log("test-asset-refs OK");