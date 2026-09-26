#!/usr/bin/env node
/* extract-ipsos.mjs – caches the Ipsos Issues Monitor as text, for
   .build/issues.mjs to read (issues-parse.mjs's ipReports and ipStatement).

   Ipsos isn't a voting-intention house here: it asks every month which
   issues matter most and which party is most capable on the top five, and
   publishes a two-page national report about three weeks after fieldwork
   closes (16 to 22 days in 2026, January's 31 aside). Two pages are read:
     https://www.ipsos.com/en-au/issuesmonitor – the national reports: this
       year's monthly PDFs (IM_Nat_…) and each past year's reports bound in
       one PDF (AU NATIONAL IPSOS ISSUES MONITOR - JAN-DEC REPORTS 2025).
       The state reports (IM_States_…) are skipped.
     https://www.ipsos.com/en-au/polling-methodology-disclosure-statements –
       one statement per month ("… Issues Monitor August 2026"), which alone
       gives the effective sample size after weighting.
   Only what covers IP_FIRST on is cached. Each PDF becomes
   .build/ipsos-src/<slug>.txt (pdftotext -layout) and <slug>.json ({ pdf,
   kind }), written once when first fetched and never touched again, so a
   run that finds nothing new changes nothing. A page that won't load is a
   warning, not a failure: the cache stays. The daily run
   (.build/ipsos-updater.sh) fails on the warning, once anything that did
   load is committed; the weekly crosstabs run, which fetches again as the
   backstop, leaves the alarm to issues.mjs, which raises it if no new
   report arrives for too long.

   No release date is kept: nothing in the PDFs states one, and their
   Last-Modified stamps move when Ipsos re-uploads a corrected version
   (June 2026's v4 reads 23 July, but its v3 was up on 2 July).

   Usage: node .build/extract-ipsos.mjs [--force]   (--force refetches PDFs
   already cached). IPSOS_SRC_DIR redirects the cache.
   Last line: IPSOS_STATUS {"fetched":[…],"cached":n,"warnings":[…]} */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { ROOT } from "./crosstab-sources.mjs";
import { IP_FIRST } from "./issues-parse.mjs";

const FORCE = process.argv.includes("--force");
const SRC = process.env.IPSOS_SRC_DIR || path.join(ROOT, ".build", "ipsos-src");
const PAGES = {
  report: "https://www.ipsos.com/en-au/issuesmonitor",
  statement: "https://www.ipsos.com/en-au/polling-methodology-disclosure-statements",
};
const ORIGIN = "https://www.ipsos.com";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august",
                "september", "october", "november", "december"];
const MON3 = MONTHS.map((m) => m.slice(0, 3));

async function get(url) {
  let last;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (auspol-tracker data update)" },
                                     signal: AbortSignal.timeout(60_000), redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      if (i < 3) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw new Error(`${url}: ${last.message}`);
}
const pdfToText = (buf, slug) => {
  const f = path.join(tmpdir(), `ipsos-${slug}.pdf`);
  fs.writeFileSync(f, buf);
  for (const bin of ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"]) {
    try { return execFileSync(bin, ["-layout", f, "-"], { encoding: "utf8", maxBuffer: 1 << 26 }); }
    catch (e) { if (e.code !== "ENOENT") throw new Error(`pdftotext failed on ${slug}: ${String(e.message).slice(0, 200)}`); }
  }
  throw new Error("pdftotext (poppler) not found");
};

/* The month (or, for a bound year, the December) a link covers, from its
   file name or link text; null for anything that isn't a national report
   or an Issues Monitor statement. */
export function coverOf(kind, href) {
  const name = decodeURIComponent(href.split("/").pop()).replace(/\.pdf$/i, "");
  if (kind === "report") {
    if (/States/i.test(name)) return null;
    const bound = name.match(/NATIONAL.*ISSUES MONITOR.*REPORTS (\d{4})/i);
    if (bound) return `${bound[1]}-12`;
    // IM_Nat_Aug_26_v1, IM_Nat_May26_v2, IM_Nat_March_26
    const m = name.match(/^IM_Nat_([A-Za-z]+)_?(\d{2})(?:_|$)/i);
    const mo = m && MON3.indexOf(m[1].slice(0, 3).toLowerCase());
    return m && mo >= 0 ? `20${m[2]}-${String(mo + 1).padStart(2, "0")}` : null;
  }
  const s = name.match(/Issues Monitor ([A-Za-z]+) (\d{4})/i);
  const mo = s && MONTHS.indexOf(s[1].toLowerCase());
  return s && mo >= 0 ? `${s[2]}-${String(mo + 1).padStart(2, "0")}` : null;
}
const slugOf = (href) => decodeURIComponent(href.split("/").pop()).replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_");

async function main() {
  const fetched = [], warnings = [];
  fs.mkdirSync(SRC, { recursive: true });
  for (const [kind, page] of Object.entries(PAGES)) {
    let html;
    try { html = (await get(page)).toString("utf8"); }
    catch (e) { warnings.push(`${kind} page: ${e.message}`); continue; }
    const hrefs = [...new Set([...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => m[1]))];
    const wanted = hrefs.map((h) => ({ h, ym: coverOf(kind, h) })).filter((x) => x.ym && x.ym >= IP_FIRST);
    if (!wanted.length) warnings.push(`${kind} page: no ${kind === "report" ? "national report" : "Issues Monitor statement"} linked from ${IP_FIRST} on – has the page changed?`);
    for (const { h } of wanted) {
      const url = h.startsWith("http") ? h : ORIGIN + h;
      const slug = slugOf(h);
      const txt = path.join(SRC, slug + ".txt");
      if (fs.existsSync(txt) && !FORCE) continue;
      try {
        const buf = await get(url);
        if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("not a PDF");
        const text = pdfToText(buf, slug);
        fs.writeFileSync(txt + ".tmp", text);
        fs.renameSync(txt + ".tmp", txt);
        fs.writeFileSync(path.join(SRC, slug + ".json"), JSON.stringify({ pdf: url, kind }, null, 1) + "\n");
        fetched.push(slug);
        console.log(`cached ${kind} ${slug}`);
      } catch (e) { warnings.push(`${slug}: ${e.message}`); }
    }
  }
  for (const w of warnings) console.log("warning", w);
  const cached = fs.readdirSync(SRC).filter((f) => f.endsWith(".txt")).length;
  console.log("IPSOS_STATUS " + JSON.stringify({ fetched, cached, warnings }));
}
// run as a script; imported (test-issues.mjs pins coverOf), it fetches nothing
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
