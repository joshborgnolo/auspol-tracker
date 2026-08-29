// Backfill `tpp_flows` onto existing Roy Morgan rows in data/polls.json.
//
// Roy Morgan publishes two ALP-v-L/NP 2PPs in each release: the respondent-
// allocated pair (stored in tpp_alp/tpp_lnp) and one allocated by the
// preference flows of the 2025 Federal Election, which until now the tracker
// dropped on the way in. Each release's own URL is already cited on its row
// in polls.json, so each row is re-fetched from that URL and the flows pair
// is read out of the release prose, e.g.:
//   "…allocated based on how Australians voted at the 2025 Federal Election
//    the gap is closer, ALP 52.5% (up 1%) leads L-NP 47.5% (down 1%)."
// Only the ALP share is stored (tpp_flows); the L-NP share is its complement.
//
// Safety: the respondent-allocated pair is re-parsed from the same release
// and compared to the row's stored tpp_alp/tpp_lnp — a row where they
// disagree signals a parse shift, and the whole run aborts without writing.
// A wave whose release genuinely prints no flows pair is left without the
// field (absent, not zero) and listed in the report.
//
// Usage: node .build/backfill-roymorgan-flows.mjs [--check]
//   --check fetches and reports but never writes. Exit 0 = ok, 1 = fetch
//   error, 2 = a guard tripped (parse shifted upstream or stored data
//   contradicted); in either failure case nothing is written.
import { readFileSync, writeFileSync, renameSync } from "node:fs";

const CHECK = process.argv.includes("--check");
const OUT = "data/polls.json";
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_TRIES = 3;
const PACE_MS = 250;

async function fetchText(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker data backfill)" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`fetch failed after ${FETCH_TRIES} tries: ${url}: ${lastErr.message}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nextData(html, what) {
  const m = html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no __NEXT_DATA__ in ${what}`);
  return JSON.parse(m[1]);
}

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
}

// Pair parser: "ALP 52.5% (up 1%) leads L-NP 47.5%", "ALP 53% cf. L-NP 47%"…
// The change parentheticals carry their own %, so the bridge must be able to
// cross them.
function pairIn(scope, fromIdx, window = 320) {
  const s = scope.slice(fromIdx, fromIdx + window);
  const m = s.match(/ALP\s+(?:on\s+)?([\d.]+)\s*%(?:\s*\([^)]*\))?.{0,90}?L-NP(?:\s+Coalition)?\s+(?:on\s+)?([\d.]+)\s*%/i);
  if (!m) return null;
  return { alp: parseFloat(m[1]), lnp: parseFloat(m[2]) };
}

function parseTppPairs(t) {
  // respondent pair: first ALP…L-NP pair after the "vote their preferences" anchor
  let resp = null;
  const wi = t.search(/vote.\s*their preferences/i);
  if (wi !== -1) resp = pairIn(t, wi);

  // flows pair: the pair that follows the "2025 Federal Election" allocation
  // anchor. New-era releases put the pair in the anchor sentence; the Dec-25 /
  // Jan-26 era spends a whole clause first ("…marginally closer than the
  // respondent allocated preferences – which favours the ALP more heavily.
  // Allocating the preference flows … shows the ALP on 55% …"), so the window
  // must be generous. The first pair after the anchor is still the flows pair.
  let flows = null;
  const fi = t.search(/2025 Federal Election/i);
  if (fi !== -1) flows = pairIn(t, fi, 700);
  return { resp, flows };
}

const status = { check: CHECK, patched: [], absent: [], absent_combined: [] };
try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const rows = D.polls.filter((p) => p.pollster === "Roy Morgan" && p.url && p.tpp_flows == null);

  /* A combined release covers several waves and prints one figure that
     belongs to no single wave (the same rule the undecided field already
     follows): when several RM rows cite the one release, none of them takes
     the figure. */
  const urlCounts = {};
  for (const p of D.polls) if (p.pollster === "Roy Morgan" && p.url) urlCounts[p.url] = (urlCounts[p.url] || 0) + 1;
  const solo = rows.filter((p) => urlCounts[p.url] === 1);
  status.absent_combined = rows.filter((p) => urlCounts[p.url] > 1).map((p) => p.date);
  console.log(`${rows.length} Roy Morgan waves to fill (${status.absent_combined.length} skip: combined release)`);

  const guardFails = [];
  for (const p of solo) {
    await sleep(PACE_MS);
    const post = nextData(await fetchText(p.url), p.url)?.props?.pageProps?.findingData?.postBy;
    if (!post?.content) { guardFails.push(`${p.date}: no findingData.postBy.content`); continue; }
    const t = clean(post.content);
    const { resp, flows } = parseTppPairs(t);

    if (resp) {
      const d = Math.max(Math.abs(resp.alp - p.tpp_alp), Math.abs(resp.lnp - p.tpp_lnp));
      if (d > 0.15) {
        guardFails.push(`${p.date}: page respondent pair ${resp.alp}/${resp.lnp} vs stored ${p.tpp_alp}/${p.tpp_lnp}`);
        continue;
      }
    }
    if (!flows) { status.absent.push(p.date); continue; }
    const sum = flows.alp + flows.lnp;
    if (Math.abs(sum - 100) > 1.0 || flows.alp < 40 || flows.alp > 65) {
      guardFails.push(`${p.date}: implausible flows pair ${flows.alp}/${flows.lnp}`);
      continue;
    }
    // tpp_flows rides directly after the respondent pair in the row's keys
    const rebuilt = {};
    for (const [k, v] of Object.entries(p)) {
      rebuilt[k] = v;
      if (k === "tpp_lnp") rebuilt.tpp_flows = flows.alp;
    }
    D.polls[D.polls.indexOf(p)] = rebuilt;
    status.patched.push(`${p.date} → ${flows.alp}`);
  }

  if (guardFails.length) {
    console.error("FLOW_GUARD " + guardFails.join(" | "));
    status.guard = guardFails;
    console.log("FLOW_STATUS " + JSON.stringify(status, null, 1));
    process.exit(2);
  }

  const trailingNl = orig.endsWith("\n") ? "\n" : "";
  const next = JSON.stringify(D, null, 2) + trailingNl;
  status.changed = next !== orig;
  if (status.changed && !CHECK) {
    writeFileSync(OUT + ".tmp", next);
    renameSync(OUT + ".tmp", OUT);
    console.log(`wrote ${OUT}: tpp_flows on ${status.patched.length} waves`);
  } else if (status.changed) {
    console.log(`--check: would patch ${status.patched.length} waves, leave ${status.absent.length} without`);
  } else {
    console.log("no changes");
  }
  if (status.absent.length) console.log("no flows pair printed:", status.absent.join(", "));
  console.log("FLOW_STATUS " + JSON.stringify({ changed: status.changed ?? false, patched: status.patched.length, absent: status.absent.length }));
} catch (err) {
  console.error("FLOW_ERROR " + (err?.message || err));
  process.exit(1);
}
