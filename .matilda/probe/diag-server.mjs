/* diag-server.mjs — serves the instrumented diag-index.html on the LAN and
   proxies EVERYTHING else to https://auspoltracker.com so the page runs
   byte-identical assets/data on one origin. POST /diag-beacon appends to
   .matilda/diag-log.jsonl. GET /diag-beacon (for my polling) also prints
   the log tail. Run detached: node .matilda/probe/diag-server.mjs */
import http from "node:http";
import https from "node:https";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, "..", "..");
const LOG = join(REPO, ".matilda", "diag-log.jsonl");
const PAGE = join(here, "diag-index.html");
const UPSTREAM = "https://auspoltracker.com";
const PORT = 8735;

const server = http.createServer((req, res) => {
  const u = (req.url || "/").split("?")[0];
  try {
    if (u === "/" || u === "/diag" || u === "/diag-index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(readFileSync(PAGE));
      return;
    }
    if (u === "/diag-beacon" && (req.method === "POST" || req.method === "PUT")) {
      let body = "";
      req.on("data", (c) => { body += c; if (body.length > 20000) req.destroy(); });
      req.on("end", () => {
        try {
          body.split("\n").filter(Boolean).forEach((line) => {
            JSON.parse(line); /* drop malformed lines */
            appendFileSync(LOG, line + "\n");
          });
        } catch { appendFileSync(LOG, JSON.stringify({ kind: "raw-beacon", data: body.slice(0, 3000) }) + "\n"); }
        res.writeHead(204); res.end();
      });
      return;
    }
    if (u === "/diag-dump") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(existsSync(LOG) ? readFileSync(LOG, "utf8") : "(no beacons yet)");
      return;
    }
    /* proxy everything else to the live site, preserving URL semantics */
    const target = UPSTREAM + req.url;
    https.get(target, { headers: { "user-agent": "diag-proxy" } }, (up) => {
      const h = {};
      for (const k of ["content-type", "cache-control", "content-encoding", "etag", "last-modified"]) {
        if (up.headers[k]) h[k] = up.headers[k];
      }
      res.writeHead(up.statusCode || 502, h);
      up.pipe(res);
    }).on("error", (e) => {
      res.writeHead(502); res.end("proxy error: " + e.message);
    });
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});
server.listen(PORT, "0.0.0.0", () => {
  console.log(`diag server on http://0.0.0.0:${PORT}/  (log: ${LOG})`);
});
