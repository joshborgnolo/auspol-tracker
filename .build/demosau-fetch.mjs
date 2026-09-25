// demosau-fetch.mjs – fetching from demosau.com, shared by extract-demosau.mjs
// (the index, the report PDFs, the Capital Brief watch) and
// crosstab-sources.mjs (the report PDFs the vote-switching and demographics
// builders measure). One copy of the SiteGround wall's solver, so a change to
// the wall is fixed once.

import { createHash } from "node:crypto";

export const FETCH_TIMEOUT_MS = 60_000;
export const FETCH_TRIES = 3;

// shared cookie jar: since 2026-09-02 demosau.com sits behind SiteGround's
// bot wall, whose pass cookie (set once the PoW below is solved) has to ride
// on every later fetch — index, refetches, and the PDFs alike
const cookieJar = new Map();
function storeCookies(res) {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
export async function fetchBuffer(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (auspol-tracker data update)",
          ...(cookieJar.size ? { cookie: [...cookieJar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      storeCookies(res);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`fetch failed after ${FETCH_TRIES} tries: ${url}: ${lastErr.message}`);
}

// SiteGround's "sgcaptcha" wall answers each request with a meta-refresh to
// a JS proof-of-work: sha1(challenge ‖ counterBytes) must show `complexity`
// leading zero bits (counter = minimal big-endian bytes, base64(challenge ‖
// counter) goes back as ?sol=). A few million sha1 rounds — ~1s in Node.
function solveSgChallenge(challenge) {
  const complexity = parseInt(challenge.split(":", 1)[0], 10);
  const cb = Buffer.from(challenge, "utf8");
  const shift = 32 - complexity;
  const t0 = Date.now();
  for (let c = 0; ; c++) {
    const len = c < 0x100 ? 1 : c < 0x10000 ? 2 : c < 0x1000000 ? 3 : c < 0x100000000 ? 4 : 6;
    const nb = Buffer.alloc(len);
    nb.writeUIntBE(c, 0, len);
    const d = createHash("sha1").update(cb).update(nb).digest();
    if (d.readUInt32BE(0) >>> shift === 0) {
      return { sol: Buffer.concat([cb, nb]).toString("base64"), ms: Date.now() - t0, hashes: c + 1 };
    }
  }
}

// follow the wall's meta-refresh, solve, submit — on success the jar holds
// the pass cookie. False when html isn't the wall or the challenge page
// didn't parse; the caller's bounded retry loop decides what happens next.
export async function passSgCaptcha(html, pageUrl) {
  const m = html.match(/refresh" content="0;([^"]*sgcaptcha[^"]*)/);
  if (!m) return false;
  const chal = (await fetchBuffer(new URL(m[1], pageUrl).href)).toString("utf8");
  const challenge = chal.match(/sgchallenge="([^"]+)"/)?.[1];
  const submit = chal.match(/sgsubmit_url="([^"]+)"/)?.[1];
  if (!challenge || !submit) return false;
  const { sol, ms, hashes } = solveSgChallenge(challenge);
  const u = new URL(submit, pageUrl);
  u.search += `${u.search ? "&" : "?"}sol=${encodeURIComponent(sol)}&s=${ms}:${hashes}`;
  await fetchBuffer(u.href);
  return true;
}
