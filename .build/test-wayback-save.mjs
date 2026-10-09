#!/usr/bin/env node
/* ====================================================================
   Fixture tests for the Wayback archiving pass in check-citations.mjs
   (CITATION_CHECK_WAYBACK=1) — driven end to end by local HTTP servers,
   same conventions as test-citation-check.mjs. The fixture "Wayback"
   is any server that answers /save/<url> — the pass only reads the
   status class off the response, never the body.

     stamps the living       ok and wall entries get wayback: <date>,
                             gone gets none, already-stamped get none
     original url goes in    a moved entry saves entry.url, so Wayback
                             follows the same redirects to the capture
     idempotence             a second run stamps nothing, writes nothing
     failure is insurance    a 500ing wayback never moves an exit class
     429 gets one retry      rate-limit then accept -> stamped
     inconclusive skips      a >20%-error sweep makes no saves at all
     budget resumes later    the capped pass leaves pending; the next
                             run finishes them

   Run:  node .build/test-wayback-save.mjs    exits non-zero on failure
   ==================================================================== */

import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const PAGE = "<html><head><title>Some poll coverage</title></head><body>story</body></html>";
const NC_BOT = "<html><body><h2>You might have been detected and blocked as a crawler bot!</h2></body></html>";

function serve(router) {
  const server = createServer((req, res) => {
    const out = router(req.url, req.headers.host);
    if (!out) { res.writeHead(404); return res.end("not found"); }
    const [status, body, headers = {}] = out;
    res.writeHead(status, { "content-type": "text/html", ...headers });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, () =>
    resolve({ server, port: server.address().port })));
}

/* a fixture "wayback": records every save target, answers per `plan`
   (a status code, or a function of the hit count for retry cases) */
function serveWayback(plan, delayMs = 0) {
  const hits = [];
  const server = createServer((req, res) => {
    if (!req.url.startsWith("/save/")) { res.writeHead(404); return res.end(); }
    hits.push(decodeURIComponent(req.url.slice("/save/".length)));
    const status = typeof plan === "function" ? plan(hits.length, req.url) : plan;
    setTimeout(() => {
      res.writeHead(status, status >= 300 && status < 400 ? { location: "/web/20261009000000/x" } : {});
      res.end("ok");
    }, delayMs);
  });
  return new Promise((resolve) => server.listen(0, () =>
    resolve({ server, port: server.address().port, hits })));
}

function fixtureDir(links, seed) {
  const dir = mkdtempSync(join(tmpdir(), "wayback-"));
  writeFileSync(join(dir, "polls.json"), JSON.stringify({ polls: links.map((url) => ({ url })), pollsterRules: {} }));
  if (seed) writeFileSync(join(dir, "link-health.json"), JSON.stringify({ version: 1, generated: "2026-10-01", links: seed }, null, 2));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
const seedEntry = (url, over = {}) =>
  ({ url, fields: ["url"], lastChecked: "2026-10-01", verdict: "ok", finalUrl: url, redirects: 0, status: 200, note: "", ...over });

async function run(dir, wbPort, extraEnv = {}, wallRules = []) {
  const env = {
    ...process.env,
    CITATION_CHECK_POLLS: join(dir, "polls.json"),
    CITATION_CHECK_STATE: join(dir, "link-health.json"),
    CITATION_CHECK_ISSUES: join(dir, "issues.json"),
    CITATION_CHECK_DELAY_MS: "0",
    CITATION_CHECK_TIMEOUT_MS: "3000",
    CITATION_CHECK_429_BACKOFF_MS: "20",
    CITATION_CHECK_WALL_JSON: JSON.stringify(wallRules),
    CITATION_CHECK_WAYBACK: "1",
    CITATION_CHECK_WAYBACK_BASE: `http://127.0.0.1:${wbPort}`,
    CITATION_CHECK_WAYBACK_BACKOFF_MS: "10",
    CITATION_CHECK_WAYBACK_TIMEOUT_MS: "4000",
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
const entryOf = (dir, url) =>
  JSON.parse(readFileSync(join(dir, "link-health.json"), "utf8")).links.find((e) => e.url === url);

/* --- stamps the living; skips the dead and the already-stamped --------- */
{
  const content = await serve((path) =>
    path === "/ok" ? [200, PAGE] :
    path === "/wall" ? [403, NC_BOT] :
    path === "/prestamped" ? [200, PAGE] :
    path === "/dead" ? [404, PAGE] : null);
  const wb = await serveWayback(302);
  const u = (p) => `http://127.0.0.1:${content.port}${p}`;
  const prestampedUrl = u("/prestamped");
  const fx = fixtureDir([u("/ok"), u("/wall"), prestampedUrl, u("/dead")],
    // a stamp recorded earlier survives without a second save
    [seedEntry(prestampedUrl, { wayback: "2026-10-02" })]);
  const wallRules = [{ host: `127.0.0.1:${content.port}`, bodyRe: "crawler bot" }];
  const r = await run(fx.dir, wb.port, {}, wallRules);
  ok("living: exit 0 despite a gone entry", r.code === 0, `code=${r.code}\n${r.stdout}${r.stderr}`);
  ok("living: LINK_STATUS carries the wayback tally",
    r.status?.wayback && r.status.wayback.attempted === 2 && r.status.wayback.saved === 2 &&
    r.status.wayback.failed === 0 && r.status.wayback.pending === 0,
    JSON.stringify(r.status?.wayback));
  const d = /^\d{4}-\d{2}-\d{2}$/;
  ok("living: ok and wall entries stamped with a date",
    d.test(entryOf(fx.dir, u("/ok"))?.wayback || "") && d.test(entryOf(fx.dir, u("/wall"))?.wayback || ""),
    JSON.stringify(entryOf(fx.dir, u("/ok"))) + JSON.stringify(entryOf(fx.dir, u("/wall"))));
  ok("living: gone entry stays stamp-free — a dead page cannot be saved",
    !entryOf(fx.dir, u("/dead"))?.wayback, JSON.stringify(entryOf(fx.dir, u("/dead"))));
  ok("living: wayback saw exactly the ok and wall targets, nothing else",
    wb.hits.length === 2 && wb.hits.includes(u("/ok")) && wb.hits.includes(u("/wall")),
    JSON.stringify(wb.hits));
  ok("living: the pre-stamped entry kept its original stamp and was not re-saved",
    entryOf(fx.dir, prestampedUrl)?.wayback === "2026-10-02" && !wb.hits.includes(prestampedUrl),
    JSON.stringify(entryOf(fx.dir, prestampedUrl)));

  const before = readFileSync(join(fx.dir, "link-health.json"), "utf8");
  const r2 = await run(fx.dir, wb.port, {}, wallRules);
  ok("idempotence: second run attempts nothing and the file is untouched",
    r2.status?.wayback?.attempted === 0 && readFileSync(join(fx.dir, "link-health.json"), "utf8") === before,
    JSON.stringify(r2.status?.wayback));
  ok("idempotence: no wayback key when every living entry is stamped",
    r2.status?.wayback?.saved === 0 && wb.hits.length === 2, `${r2.status?.wayback?.saved} saved, ${wb.hits.length} hits`);
  content.server.close(); wb.server.close();
  fx.cleanup();
}

/* --- a moved entry saves its ORIGINAL recorded url --------------------- */
{
  const content = await serve((path) => {
    if (path === "/old") return [301, "", { location: "/new" }];
    if (path === "/new") return [200, PAGE];
    return null;
  });
  const wb = await serveWayback(302);
  const url = `http://127.0.0.1:${content.port}/old`;
  const fx = fixtureDir([url]);
  const r = await run(fx.dir, wb.port);
  ok("moved: verdict moved and it still earns a stamp",
    r.code === 0 && entryOf(fx.dir, url)?.verdict === "moved" && !!entryOf(fx.dir, url)?.wayback,
    JSON.stringify(entryOf(fx.dir, url)));
  ok("moved: the save request carries the citation url, not finalUrl",
    wb.hits.length === 1 && wb.hits[0] === url, JSON.stringify(wb.hits));
  content.server.close(); wb.server.close();
  fx.cleanup();
}

/* --- save failure never crosses into an exit class --------------------- */
{
  const content = await serve((path) => (path === "/a" || path === "/b" ? [200, PAGE] : null));
  const wb = await serveWayback(500);
  const u = (p) => `http://127.0.0.1:${content.port}${p}`;
  const fx = fixtureDir([u("/a"), u("/b")]);
  const r = await run(fx.dir, wb.port, { CITATION_CHECK_WAYBACK_BACKOFF_MS: "10" });
  ok("failure: exit 0 with zero stamps when wayback is down",
    r.code === 0 && !entryOf(fx.dir, u("/a"))?.wayback && !entryOf(fx.dir, u("/b"))?.wayback,
    `code=${r.code}\n${r.stdout}${r.stderr}`);
  ok("failure: tally reports 2 failed, 0 saved; each entry retried once",
    r.status?.wayback?.failed === 2 && r.status.wayback.saved === 0 && wb.hits.length === 4,
    JSON.stringify(r.status?.wayback) + ` hits=${wb.hits.length}`);
  content.server.close(); wb.server.close();
  fx.cleanup();
}

/* --- a 429 earns one backoff retry ------------------------------------- */
{
  const content = await serve((path) => (path === "/p" ? [200, PAGE] : null));
  const wb = await serveWayback((n) => (n === 1 ? 429 : 302));
  const url = `http://127.0.0.1:${content.port}/p`;
  const fx = fixtureDir([url]);
  const r = await run(fx.dir, wb.port);
  ok("retry: 429 then accept leaves the entry stamped",
    r.status?.wayback?.saved === 1 && wb.hits.length === 2 && !!entryOf(fx.dir, url)?.wayback,
    `hits=${wb.hits.length} ${JSON.stringify(entryOf(fx.dir, url))}`);
  content.server.close(); wb.server.close();
  fx.cleanup();
}

/* --- an inconclusive sweep fires no saves at all ----------------------- */
{
  const dead = await serve(() => [200, PAGE]);
  dead.server.close(); // open port, nothing listening
  const wb = await serveWayback(302);
  const url = `http://127.0.0.1:${dead.port}/unreachable`;
  const fx = fixtureDir([url], [seedEntry(url)]);
  const r = await run(fx.dir, wb.port);
  ok("inconclusive: exit 1 and not a single save attempted",
    r.code === 1 && r.status && !("wayback" in r.status) && wb.hits.length === 0,
    `code=${r.code} hits=${wb.hits.length} ${JSON.stringify(r.status)}`);
  wb.server.close();
  fx.cleanup();
}

/* --- the budget cap leaves the rest pending for next run --------------- */
{
  const content = await serve(() => [200, PAGE]);
  const wb = await serveWayback(302, 120); // each save takes 120ms
  const links = Array.from({ length: 4 }, (_, i) => `http://127.0.0.1:${content.port}/p${i}`);
  const fx = fixtureDir(links);
  const r1 = await run(fx.dir, wb.port, {
    CITATION_CHECK_WAYBACK_BUDGET_MS: "10",
    CITATION_CHECK_WAYBACK_CONCURRENCY: "1",
  });
  const w1 = r1.status?.wayback || {};
  ok("budget: capped pass does not finish the queue",
    w1.attempted < 4 && w1.pending === 4 - w1.attempted,
    JSON.stringify(w1));
  const r2 = await run(fx.dir, wb.port, {
    CITATION_CHECK_WAYBACK_BUDGET_MS: "30000",
    CITATION_CHECK_WAYBACK_CONCURRENCY: "1",
  });
  const w2 = r2.status?.wayback || {};
  ok("budget: the following run stamps the remainder",
    w2.saved === w1.pending && links.every((l) => /^\d{4}-/.test(entryOf(fx.dir, l)?.wayback || "")),
    `first=${JSON.stringify(w1)} second=${JSON.stringify(w2)}`);
  content.server.close(); wb.server.close();
  fx.cleanup();
}

console.log(fails ? `\n${fails} FAILED` : "\nwayback-save test: all expectations held");
process.exit(fails ? 1 : 0);
