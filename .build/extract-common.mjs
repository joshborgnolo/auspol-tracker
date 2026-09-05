// Shared helpers for the extract-*.mjs poll agents. One home for the pieces
// every extractor was carrying its own copy of: the retrying fetch, the
// month-name map, the HTML-to-text normaliser, and the .tmp+rename atomic
// write. Push a fix here and every house gets it — that's the point.
// Melbourne-date helpers ride along so a watcher or extractor can import
// one module for both text and date conventions.
import { writeFileSync, renameSync } from "node:fs";
export { melbourneDate, melbourneMinute } from "./melbourne-time.mjs";

export const FETCH_TIMEOUT_MS = 30_000;
export const FETCH_TRIES = 3;

// Paywalled/bot-walled sources check for a real browser string; the rest are
// happier with an honest crawler UA. Pick per call site (`ua` option).
export const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
export const TRACKER_UA = "Mozilla/5.0 (auspol-tracker data update)";

// Retrying text fetch. Resolves { url, text } so click-through redirects see
// their final URL. err.status is attached on HTTP failure; statuses in
// `fatalStatuses` (403/429 by default — walls don't lift on retry) break the
// loop instead of backing off. Backoff is 1.5s, 3s, … between tries.
export async function fetchText(url,
  { tries = FETCH_TRIES, timeoutMs = FETCH_TIMEOUT_MS, ua = BROWSER_UA,
    fatalStatuses = [403, 429] } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": ua },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status}`);
        e.status = res.status;
        throw e;
      }
      return { url: res.url, text: await res.text() };
    } catch (err) {
      lastErr = err;
      if (fatalStatuses.includes(err.status)) break;
      if (i < tries) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}

// Month names → 0-indexed month number (full and abbreviation forms, plus
// the "sept" Australians actually write).
export const MONTHS = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };

// HTML → plain text: drop script/style, tags to spaces, decode the entities
// poll prose actually carries, straighten curly quotes so downstream
// ASCII-based regexes can rely on a single quote shape, collapse whitespace.
export function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&lsquo;|&#8217;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
}

// Atomic write: data files must never sit half-written between the tmp open
// and the rename. Same "<path>.tmp + rename" convention every writer uses,
// hosted once instead of copied to a dozen places.
export function writeAtomic(path, str) {
  writeFileSync(path + ".tmp", str);
  renameSync(path + ".tmp", path);
}
