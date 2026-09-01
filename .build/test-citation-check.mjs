#!/usr/bin/env node
/* ====================================================================
   Fixture tests for check-citations.mjs — the citation sweep's verdicts
   and exit classes, driven end to end by local HTTP servers it cannot
   tell from the open web.

   The script's whole contract IS its exit classes plus its per-host
   wall rules, so each case is one fixture state, one spawn of the real
   script against it, one LINK_STATUS line parsed off stdout. Wall rules
   are host-keyed, so the fixtures lean on two facts: `127.0.0.1` and
   `localhost` are DIFFERENT hostnames that resolve to the same server
   (enough to build a cross-host redirect chain), and the rules accept
   a host:port pin so several independent rule-sets can coexist.

     australian-style wall   200 + "No Cookies" title -> wall, never ok
     news24-style wall       404 + "Nocookies" title  -> wall, never gone
     any2xx shell            200 at an any2xx host    -> wall
     plain ok / gone         200 -> ok, 404  -> gone
     pdf identity            application/pdf -> ok; text/html -> error
     redirect drift          127.0.0.1 -(3 hops)-> localhost wall -> moved
     transitions             ok/wall/moved -> gone fires exit 2
     steady gone             gone staying gone stays green (exit 0)
     inconclusive            everything refuses -> exit 1
     error carry-forward     a transient error keeps the old verdict
     state idempotence       a no-change run leaves the file byte-identical

   Run:  node .build/test-citation-check.mjs    exits non-zero on failure
   ==================================================================== */

import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const SCRIPT = fileURLToPath(new URL("./check-citations.mjs", import.meta.url));

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : (extra ? `\n      ${extra}` : "")}`);
};

/* --- fixture infrastructure -------------------------------------------- */
function serve(router) {
  const server = createServer((req, res) => {
    const out = router(req.url, req.headers.host);
    if (!out) { res.writeHead(404); return res.end("not found"); }
    const [status, body, headers = {}] = out;
    res.writeHead(status, { "content-type": "text/html", ...headers });
    res.end(body);
  });
  // listen dual-stack: the drift case introduces `localhost` as a second
  // hostname, and localhost may resolve to ::1
  return new Promise((resolve) => server.listen(0, () =>
    resolve({ server, port: server.address().port })));
}

const AUS_WALL = "<html><head><title>No Cookies | The Australian</title></head><body>walled</body></html>";
const N24_WALL = "<html><head><title>Nocookies</title></head><body>walled</body></html>";
const PAGE = "<html><head><title>Some poll coverage</title></head><body>story</body></html>";
const SHELL = "<html><head><title>JavaScript is required</title></head><body></body></html>";
const NC_BOT = "<html><body><h2>You might have been detected and blocked as a crawler bot!</h2></body></html>";
const CF_SHELL = "<html><head><title>Just a moment...</title></head><body>challenge</body></html>";

/* a temp dir holding a polls fixture + optional state seed; returns paths */
function fixtureDir(links, seed) {
  const dir = mkdtempSync(join(tmpdir(), "cite-check-"));
  const polls = {
    polls: links.map((l) => ({ url: l })),
    pollsterRules: {},
  };
  writeFileSync(join(dir, "polls.json"), JSON.stringify(polls));
  const state = join(dir, "link-health.json");
  if (seed) writeFileSync(state, JSON.stringify({ version: 1, generated: "2026-08-24", links: seed }, null, 2));
  return {
    dir, state,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
const seedEntry = (url, verdict, over = {}) =>
  ({ url, fields: ["url"], lastChecked: "2026-08-24", verdict, finalUrl: url, redirects: 0, status: 200, note: "", ...over });

async function run(dir, wallRules, extraEnv = {}) {
  const env = {
    ...process.env,
    CITATION_CHECK_POLLS: join(dir, "polls.json"),
    CITATION_CHECK_STATE: join(dir, "link-health.json"),
    CITATION_CHECK_DELAY_MS: "0",
    CITATION_CHECK_TIMEOUT_MS: "8000",
    CITATION_CHECK_429_BACKOFF_MS: "20",
    CITATION_CHECK_WALL_JSON: JSON.stringify(wallRules),
    ...extraEnv,
  };
  let code = 0, stdout = "", stderr = "";
  try {
    ({ stdout, stderr } = await execFileP(process.execPath, [SCRIPT], { env, maxBuffer: 4 << 20 }));
  } catch (e) {
    code = e.code; stdout = e.stdout || ""; stderr = e.stderr || "";
  }
  const m = stdout.match(/LINK_STATUS (\{.*\})/);
  return { code, stdout, stderr, status: m ? JSON.parse(m[1]) : null };
}
const verdictOf = (dir, url) => JSON.parse(readFileSync(join(dir, "link-health.json"), "utf8")).links.find((e) => e.url === url);

/* --- core verdict battery ---------------------------------------------- */
{
  /* three rule-sets on three ports: s1 proves both title rules (200-wall
     and 404-wall on the same port, told apart by status), s2 any2xx, s3 none */
  const s1 = await serve((path) =>
    path === "/aus" ? [200, AUS_WALL] :
    path === "/n24" ? [404, N24_WALL] : null);
  const s2 = await serve((path) => path === "/shell" ? [200, SHELL] : null);
  const s3 = await serve((path) =>
    path === "/ok" ? [200, PAGE] :
    path === "/doc.pdf" ? [200, "%PDF-1.4 fake-bytes", { "content-type": "application/pdf" }] :
    path === "/fake.pdf" ? [200, PAGE] :
    path === "/dead" ? [404, PAGE] : null);
  /* the News-Corp-flavoured wall: the block page arrives at 403 with NO
     title tag, so only a body regex can see it */
  const s4 = await serve((path) =>
    path === "/nc-bot" ? [403, NC_BOT] :
    path === "/cf" ? [403, CF_SHELL] : null);
  const u = (p, path) => `http://127.0.0.1:${p}${path}`;
  const links = [
    u(s1.port, "/aus"), u(s1.port, "/n24"), u(s2.port, "/shell"),
    u(s3.port, "/ok"), u(s3.port, "/doc.pdf"), u(s3.port, "/fake.pdf"), u(s3.port, "/dead"),
    u(s4.port, "/nc-bot"), u(s4.port, "/cf"),
  ];
  const rules = [
    { host: `127.0.0.1:${s1.port}`, status: 200, titleRe: "no cookies" },
    { host: `127.0.0.1:${s1.port}`, status: 404, titleRe: "nocookies" },
    { host: `127.0.0.1:${s2.port}`, any2xx: true },
    { host: `127.0.0.1:${s4.port}`, bodyRe: "crawler bot" },
    { host: `127.0.0.1:${s4.port}`, titleRe: "^just a moment" },
  ];
  const fx = fixtureDir(links);
  const r = await run(fx.dir, rules);
  ok("battery: exit 0", r.code === 0, r.stdout + r.stderr);
  const c = r.status?.counts || {};
  ok("battery: 200+No Cookies -> wall", verdictOf(fx.dir, u(s1.port, "/aus"))?.verdict === "wall",
    JSON.stringify(verdictOf(fx.dir, u(s1.port, "/aus"))));
  ok("battery: 404+Nocookies -> wall (not gone)", verdictOf(fx.dir, u(s1.port, "/n24"))?.verdict === "wall",
    JSON.stringify(verdictOf(fx.dir, u(s1.port, "/n24"))));
  ok("battery: any2xx shell -> wall", verdictOf(fx.dir, u(s2.port, "/shell"))?.verdict === "wall");
  ok("battery: 403 crawler-bot body -> wall (bodyRe, status-free)", verdictOf(fx.dir, u(s4.port, "/nc-bot"))?.verdict === "wall",
    JSON.stringify(verdictOf(fx.dir, u(s4.port, "/nc-bot"))));
  ok("battery: 403 Cloudflare challenge title -> wall", verdictOf(fx.dir, u(s4.port, "/cf"))?.verdict === "wall",
    JSON.stringify(verdictOf(fx.dir, u(s4.port, "/cf"))));
  ok("battery: plain 200 -> ok", verdictOf(fx.dir, u(s3.port, "/ok"))?.verdict === "ok");
  ok("battery: real pdf -> ok", verdictOf(fx.dir, u(s3.port, "/doc.pdf"))?.verdict === "ok");
  ok("battery: pdf url serving html -> error, never gone", verdictOf(fx.dir, u(s3.port, "/fake.pdf"))?.verdict === "error",
    JSON.stringify(verdictOf(fx.dir, u(s3.port, "/fake.pdf"))));
  ok("battery: plain 404 -> gone", verdictOf(fx.dir, u(s3.port, "/dead"))?.verdict === "gone");
  /* a first-run gone is reported but fires no transition; 1/9 errors is
     under the inconclusive bar */
  ok("battery: no newGone, no alarm on a seeded-file-free first run", r.status?.newGone?.length === 0 && r.code === 0,
    JSON.stringify(r.status));

  /* idempotence: second run against the same fixtures writes nothing */
  const before = readFileSync(fx.state, "utf8");
  const r2 = await run(fx.dir, rules);
  ok("idempotent: second run exits 0 and leaves state byte-identical",
    r2.code === 0 && readFileSync(fx.state, "utf8") === before, r2.stdout);
  s1.server.close(); s2.server.close(); s3.server.close(); s4.server.close();
  fx.cleanup();
}

/* --- redirect drift: 127.0.0.1 to localhost is a cross-host chain ------ */
{
  let hits = [];
  const srv = await serve((path, hostHdr) => {
    hits.push(`${hostHdr}${path}`);
    if (path === "/sky") return [302, "", { location: "/hop1" }];
    if (path === "/hop1") return [302, "", { location: "/hop2" }];
    if (path === "/hop2") return [301, "", { location: `http://localhost:${srv.port}/nocookies` }];
    if (path === "/nocookies") return [404, N24_WALL];
    return null;
  });
  const url = `http://127.0.0.1:${srv.port}/sky`;
  const rules = [{ host: `localhost:${srv.port}`, status: 404, titleRe: "nocookies" }];
  const fx = fixtureDir([url]);
  const r = await run(fx.dir, rules);
  const e = verdictOf(fx.dir, url);
  ok("drift: cross-host chain into a wall -> moved, not wall, not gone", r.code === 0 && e?.verdict === "moved",
    `verdict=${e?.verdict} code=${r.code}\n${r.stdout}`);
  ok("drift: three redirects counted, finalUrl lands on the other hostname",
    e?.redirects === 3 && new URL(e.finalUrl).hostname === "localhost", JSON.stringify(e));
  ok("drift: appears in newMoved headline", r.status?.newMoved?.includes(url), JSON.stringify(r.status));
  /* and once recorded, a steady chain is not re-reported */
  const r2 = await run(fx.dir, rules);
  ok("drift: steady chain does not re-fire newMoved", r2.status?.newMoved?.length === 0, JSON.stringify(r2.status));
  srv.server.close();
  fx.cleanup();
}

/* --- transitions fire exit 2 ------------------------------------------- */
for (const [name, seedVerdict] of [["ok", "ok"], ["wall", "wall"], ["moved", "moved"]]) {
  const srv = await serve(() => [404, PAGE]);
  const url = `http://127.0.0.1:${srv.port}/was-${name}`;
  const fx = fixtureDir([url], [seedEntry(url, seedVerdict)]);
  const r = await run(fx.dir, []);
  ok(`transition ${name}->gone: exit 2 naming the url`,
    r.code === 2 && r.status?.newGone?.includes(url),
    `code=${r.code} ${JSON.stringify(r.status)}\n${r.stdout}${r.stderr}`);
  ok(`transition ${name}->gone: state now records gone`, verdictOf(fx.dir, url)?.verdict === "gone");
  srv.server.close();
  fx.cleanup();
}

/* --- steady gone stays green -------------------------------------------- */
{
  const srv = await serve(() => [404, PAGE]);
  const url = `http://127.0.0.1:${srv.port}/already-known-dead`;
  const fx = fixtureDir([url], [seedEntry(url, "gone", { status: 404 })]);
  const r = await run(fx.dir, []);
  ok("steady gone: exit 0, no newGone", r.code === 0 && r.status?.newGone?.length === 0,
    `code=${r.code} ${JSON.stringify(r.status)}`);
  srv.server.close();
  fx.cleanup();
}

/* --- inconclusive when the sweep is mostly errors ----------------------- */
{
  const srv = await serve(() => [200, PAGE]);
  srv.server.close(); // nothing on the port
  const url = `http://127.0.0.1:${srv.port}/unreachable`;
  const fx = fixtureDir([url], [seedEntry(url, "ok")]);
  const r = await run(fx.dir, []);
  ok("inconclusive: exit 1, never 2", r.code === 1, `code=${r.code}\n${r.stdout}${r.stderr}`);
  ok("inconclusive: errored entry carries its previous verdict forward",
    verdictOf(fx.dir, url)?.verdict === "ok" && !!verdictOf(fx.dir, url)?.lastError,
    JSON.stringify(verdictOf(fx.dir, url)));
  fx.cleanup();
}

/* --- a lone gone inside a healthy sweep is just one entry --------------- */
{
  const srv = await serve((path) => (path === "/dead" ? [404, PAGE] : [200, PAGE]));
  const port = srv.port;
  const oks = Array.from({ length: 5 }, (_, i) => `http://127.0.0.1:${port}/ok${i}`);
  const gone = `http://127.0.0.1:${port}/dead`;
  const fx = fixtureDir([...oks, gone]);
  // six urls: one 404 and five ok -> 0 errors, exit 0 even though one is gone
  const r = await run(fx.dir, []);
  ok("small sweep: a first-seen gone fires no transition", r.code === 0 && r.status?.counts?.gone === 1,
    `code=${r.code} ${JSON.stringify(r.status)}`);
  const state = JSON.parse(readFileSync(fx.state, "utf8"));
  ok("small sweep: state holds all six entries", state.links.length === 6);
  srv.server.close();
  fx.cleanup();
}

console.log(fails ? `\n${fails} FAILED` : "\ncitation-check test: all expectations held");
process.exit(fails ? 1 : 0);
