#!/usr/bin/env node
// fetchWithCookies against a local stand-in for news24.com.au's Akamai
// cookie check: a cookieless request is bounced to /remote/check_cookie.html,
// which sets the cookie and bounces back; only a request carrying the cookie
// gets the article. Plain fetch() drops the cookie between hops and loops.
import { createServer } from "node:http";
import { fetchWithCookies } from "./extract-common.mjs";

const server = createServer((req, res) => {
  const hasCookie = /(?:^|;\s*)n_regis=123456789/.test(req.headers.cookie ?? "");
  if (req.url.startsWith("/remote/check_cookie.html")) {
    const back = decodeURIComponent(new URL(req.url, "http://x").searchParams.get("url"));
    res.writeHead(302, { "set-cookie": "n_regis=123456789; path=/; HttpOnly", location: back });
    return res.end();
  }
  if (req.url.startsWith("/loop")) { res.writeHead(302, { location: "/loop" }); return res.end(); }
  if (!hasCookie) {
    res.writeHead(302, { location: `/remote/check_cookie.html?url=${encodeURIComponent(req.url)}` });
    return res.end();
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(`<title>article</title><div class="infogram-embed" data-id="_/abc"></div>`);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

let fails = 0;
const ok = (name, cond) => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"}: ${name}`); };
try {
  const r = await fetchWithCookies(`${base}/politics/story/news-story/abc`, { tries: 1 });
  ok("passes the cookie check and returns the article", r.text.includes('data-id="_/abc"'));
  ok("reports the article's own URL", r.url === `${base}/politics/story/news-story/abc`);
  let plain = null;
  try { plain = await (await fetch(`${base}/politics/story/news-story/abc`)).text(); } catch { /* redirect loop */ }
  ok("plain fetch() does not (the reason this exists)", !plain?.includes("_/abc"));
  let threw = false;
  try { await fetchWithCookies(`${base}/loop`, { tries: 1, maxHops: 4 }); } catch { threw = true; }
  ok("a redirect loop fails instead of hanging", threw);
} finally { server.close(); }
if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("fetchWithCookies checks pass");
