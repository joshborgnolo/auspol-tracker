#!/usr/bin/env node
/* ====================================================================
   Fixture tests for check-site.mjs — the deployed-site watchdog's exit
   classes, driven end to end by a local HTTP server it cannot tell from
   GitHub Pages.

   The script's whole contract IS its exit classes, so each case is one
   environmental state served from here, one spawn of the real script
   against it, one SITE_STATUS line parsed off stdout:

     happy            all five files match, two hashed assets resolve -> 0
     index mismatch   live bytes differ -> 2, firstDiffAt is the real offset
     feed mismatch    index matches, feed.xml doesn't -> 2 naming the file
     missing asset    html matches but a referenced asset 404s -> 2 naming it
     unreachable      nothing on the port -> 1, never 2
     grace flip       Pages-mid-deploy: wrong bytes twice, then right -> 0
     dirty tree       uncommitted served file outside CI -> refuse with 1

   Run:  node .build/test-site-check.mjs        exits non-zero on failure
   ==================================================================== */

import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const SCRIPT = fileURLToPath(new URL("./check-site.mjs", import.meta.url));

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : (extra ? `\n      ${extra}` : "")}`);
};

/* --- the canonical deployed site ------------------------------------- */
const INDEX = `<!doctype html><html><head><link rel="preload" href="assets/somefont-a1b2c3.woff2">` +
  `<meta property="og:image" content="https://auspoltracker.com/assets/auspol-card.png"></head>` +
  `<body><div id="root"></div><script>fetch("assets/cycle-source.fbdfeeb3.json")</script></body></html>`;
const SITE = {
  "index.html": INDEX,
  "feed.xml": "<?xml version=\"1.0\"?><rss><channel/></rss>",
  "sitemap.xml": "<?xml version=\"1.0\"?><urlset/>",
  "robots.txt": "User-agent: *\nAllow: /\n",
  "auspol-polling.html": "<!doctype html><html><body>legacy</body></html>",
  "assets/somefont-a1b2c3.woff2": Buffer.from("woff2-font-bytes"),
  "assets/cycle-source.fbdfeeb3.json": Buffer.from("{\"cycles\":[]}"),
  "assets/auspol-card.png": Buffer.from("png-bytes"),
};

/* a fixture server: a router takes the request path and returns
   [status, body]. Anything unanswered is a 404. */
function serve(router) {
  const server = createServer((req, res) => {
    const path = req.url.replace(/^\//, "");
    const out = router(path, req);
    if (!out) { res.writeHead(404); return res.end(); }
    res.writeHead(out[0] ?? 200, { "content-type": /\.html?$|^$/.test(path) ? "text/html" : "application/octet-stream" });
    res.end(out[1]);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () =>
    resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}
const wholeSite = (over = {}) => (path) =>
  path in { ...SITE, ...over } ? [200, { ...SITE, ...over }[path]] : null;

function rootWith(over = {}) {
  const dir = mkdtempSync(join(tmpdir(), "site-check-root-"));
  const files = { ...SITE, ...over };
  for (const f of ["index.html", "feed.xml", "sitemap.xml", "robots.txt", "auspol-polling.html"])
    writeFileSync(join(dir, f), files[f]);
  return dir;
}

/* the child runs ASYNC: spawnSync would freeze this process's event loop,
   and with it the fixture server the child is trying to fetch from */
async function run(url, root, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.GITHUB_ACTIONS; // keep local semantics unless a case opts in
  const opts = {
    env: {
      ...env,
      SITE_CHECK_URL: url,
      SITE_CHECK_ROOT: root,
      SITE_CHECK_GRACE_MS: extraEnv.SITE_CHECK_GRACE_MS ?? "6000",
      SITE_CHECK_SLEEP_MS: "600",
    },
    maxBuffer: 4 << 20,
  };
  let code = 0, stdout = "", stderr = "";
  try {
    ({ stdout, stderr } = await execFileP(process.execPath, [SCRIPT], opts));
  } catch (e) {
    code = e.code; stdout = e.stdout || ""; stderr = e.stderr || "";
  }
  const m = stdout.match(/SITE_STATUS (\{.*\})/);
  return { code, stdout, stderr, status: m ? JSON.parse(m[1]) : null };
}

const made = [];
const close = (server, ...dirs) => server.close(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/* --- happy path --------------------------------------------------------- */
{
  const { server, url } = await serve(wholeSite());
  const root = rootWith();
  const r = await run(url, root);
  ok("happy: exit 0", r.code === 0, r.stdout + r.stderr);
  ok("happy: verdict 0, 3 assets checked, no failures", r.status?.verdict === 0 &&
    r.status?.assets?.checked === 3 && r.status?.assets?.failed?.length === 0,
    JSON.stringify(r.status));
  ok("happy: byte counts agree", r.status?.liveBytes === INDEX.length && r.status?.localBytes === INDEX.length);
  close(server, root);
}

/* --- index mismatch: class 2 with the real first-diff offset ----------- */
{
  const tampered = INDEX.replace("<div id=\"root\">", "<div id=\"root\"X");
  // first actual byte difference, derived by comparing the strings directly
  let expectedOff = 0;
  while (INDEX[expectedOff] === tampered[expectedOff]) expectedOff++;
  const { server, url } = await serve(wholeSite({ "index.html": Buffer.from(tampered) }));
  const root = rootWith(); // clean local copy == SERVER'S other files
  const r = await run(url, root, { SITE_CHECK_GRACE_MS: "1800" });
  ok("index mismatch: exit 2", r.code === 2, r.stdout + r.stderr);
  ok("index mismatch: firstDiffAt is the tampered byte", r.code === 2 &&
    r.status?.firstDiffAt === expectedOff,
    `expected ${expectedOff}, got ${r.status?.firstDiffAt}`);
  ok("index mismatch: file named", r.status?.file === "index.html");
  close(server, root);
}

/* --- secondary-file mismatch: class 2, index itself clean -------------- */
{
  const { server, url } = await serve(wholeSite({ "feed.xml": Buffer.from("<rss>older bytes</rss>") }));
  const root = rootWith();
  const r = await run(url, root, { SITE_CHECK_GRACE_MS: "1800" });
  ok("feed mismatch: exit 2 naming feed.xml", r.code === 2 && r.status?.file === "feed.xml",
    r.stdout + r.stderr);
  close(server, root);
}

/* --- missing hashed asset: class 2 naming the asset -------------------- */
{
  // the deployed html references an asset the server doesn't have (as if the
  // rename emitted index.html but not cycle-source.<hash>.json)
  const router = wholeSite();
  const { server, url } = await serve((path, req) =>
    path === "assets/cycle-source.fbdfeeb3.json" ? null : router(path, req));
  const root = rootWith();
  const r = await run(url, root, { SITE_CHECK_GRACE_MS: "1800" });
  ok("missing asset: exit 2", r.code === 2, r.stdout + r.stderr);
  ok("missing asset: failed[] names cycle-source", r.code === 2 &&
    r.status?.assets?.failed?.includes("assets/cycle-source.fbdfeeb3.json"),
    JSON.stringify(r.status?.assets));
  close(server, root);
}

/* --- unreachable: class 1, never 2 -------------------------------------- */
{
  const { server, url } = await serve(() => null);
  server.close(); // nothing on the port
  const root = rootWith();
  const r = await run(url, root);
  ok("unreachable: exit 1", r.code === 1, r.stdout + r.stderr);
  ok("unreachable: verdict 1 with reason", r.status?.verdict === 1 && !!r.status?.reason);
  rmSync(root, { recursive: true, force: true });
}

/* --- nonexistent host: DNS failure is also class 1, never 2 ------------- */
{
  const root = rootWith();
  const r = await run("https://this-host-does-not-exist.invalid/", root);
  ok("nonexistent host: exit 1", r.code === 1, r.stdout + r.stderr);
  rmSync(root, { recursive: true, force: true });
}

/* --- grace flip: Pages finishes mid-check => retry then pass ------------ */
{
  let hits = 0;
  const router = wholeSite();
  const { server, url } = await serve((path, req) => {
    if (path !== "index.html") return router(path, req);
    hits++;
    return [200, hits <= 2 ? Buffer.from(SITE["index.html"] + "<!-- stale -->") : Buffer.from(SITE["index.html"])];
  });
  const root = rootWith();
  const r = await run(url, root, { SITE_CHECK_GRACE_MS: "20000" });
  ok("grace flip: retries then exits 0", r.code === 0 && hits >= 3,
    `hits=${hits} code=${r.code}\n${r.stdout}`);
  close(server, root);
}

/* --- dirty tree: local run refuses -------------------------------------- */
{
  const { server, url } = await serve(wholeSite());
  const root = rootWith();
  const git = (args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git(["init", "-q"]);
  git(["-c", "user.name=t", "-c", "user.email=t@t", "add", "."]);
  git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x"]);
  writeFileSync(join(root, "index.html"), SITE["index.html"] + "<!-- uncommitted rebuild -->");
  const r = await run(url, root);
  ok("dirty tree: refuses with exit 1", r.code === 1, r.stdout + r.stderr);
  ok("dirty tree: reason explains", /working tree dirty/.test(r.stdout));
  close(server, root);
}

console.log(fails ? `\n${fails} FAILED` : "\nsite-check test: all expectations held");
process.exit(fails ? 1 : 0);
