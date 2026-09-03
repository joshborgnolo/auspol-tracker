/* extract-galaxy-archive.mjs — the Galaxy Research archive, re-derivable.
   Galaxy polled federally for the News Ltd metropolitan dailies from 2004,
   took over Newspoll's administration in mid-2015, was bought by YouGov
   (announced 15 December 2017), published as YouGov Galaxy through 2018-20 and
   then simply as YouGov. galaxyresearch.com.au is dead; nothing on it was
   preserved by its owner. This script rebuilds an index of what survives and
   re-checks the figures the tracker took from it.

   Two outputs:

     data/galaxy-release-index.csv   every archived Galaxy page that carries a
       poll, with the Wayback capture that holds it. Built live from the
       Internet Archive CDX API, so a re-run picks up captures added since.

     (verification pass)             every row of data/galaxy-federal-pre2012.csv
       is fetched from the page it cites and its 2PP pair looked for in the
       text. A row whose source stops saying what the CSV says is an error, not
       a warning — the CSV is a transcript, and a transcript that no longer
       matches its source has to be re-read by hand.

   Where the material is, and why it is in three places:

   1. galaxyresearch.com.au release pages, via the Wayback Machine. From 2012
      Galaxy ran WordPress and gave each poll its own dated post (/28-29-august-
      2013/); 114 of those are archived, spanning 2012 to 2017, and ~38 of them
      are the Newspoll waves Galaxy administered rather than Galaxy's own brand.
      Each page carries the full release: primaries, 2PP, better PM, sample size
      and question wording. Before 2012 there were no per-poll pages — the
      current wave sat on the front page and on pubpolls.html, so only whatever
      a capture happened to freeze survives.

   2. pubpolls.html, via the Wayback Machine. Galaxy's own "Polls" page printed
      the latest federal wave in full and kept an accuracy table of its final
      campaign polls. 15 distinct captures exist; two hold a federal wave
      (1-3 June and 24-26 August 2007) and the 2007-08 ones hold the final 2004
      and 2007 campaign polls. Its Greens shares agree with the Courier Mail
      trend tables (5) everywhere both survive. Five captures survive with
      content; the rest of the URL's history is 404 pages after the 2012
      rebuild dropped the path.

   3. The Poll Bludger, pollbludger.net. William Bowe wrote up essentially every
      Galaxy federal poll from 2004 on, and through 2007 maintained a running
      table of the whole year's Galaxy series which he re-published in each new
      post — which is why the 2007 record is complete when nothing else holds
      it. The site serves its entire back catalogue live, including the posts
      published under blogs.crikey.com.au. Its search is NOT a complete index
      (it missed the 25 June 2010 wave, whose title contains "Galaxy"), so the
      Wayback URL index and the month archives are the cross-check.

   4. GhostWhoVotes, ghostwhovotes.files.wordpress.com. The de-facto Galaxy
      release mirror of the era: 12 archived PDFs and scans, 2011-2013.

   5. The Courier Mail's media server, media01.couriermail.com.au. Galaxy polled
      for the News Ltd tabloids and the commissioner's site still serves the
      trend tables Galaxy printed for them as polldetail PDFs. Two 2007 ones
      (June, n=1021; November, n=1010) between them carry every 2007 wave's
      Greens and others shares and fieldwork windows — the record Bowe's
      running table omitted. Not indexed below (a different genre and domain);
      the transcript CSV's note column cites the two URLs on each 2007 row.

   What Wikipedia holds, for contrast: Galaxy rows exist only in its 2013, 2016
   and 2019 opinion-polling articles (20, 9 and 5 of them). Its 2010-cycle
   article has none and there is no 2007-cycle article. The tracker's own Galaxy
   rows began at 2011-08-03 for exactly that reason.

   Run: node .build/extract-galaxy-archive.mjs           (index only, dry run)
        node .build/extract-galaxy-archive.mjs --apply   (writes the index CSV)
        node .build/extract-galaxy-archive.mjs --verify  (also re-checks the CSV)
        node .build/extract-galaxy-archive.mjs --verify-only  (re-checks the
          CSV without the CDX index build — for when archive.org's CDX API is
          down but the transcript still needs its provenance gate) */
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const UA = "auspoltracker.com archive rebuild (one page at a time)";
const OUT = "data/galaxy-release-index.csv";
const TRANSCRIPT = "data/galaxy-federal-pre2012.csv";

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december"
             + "|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";

const get = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};
const wayback = (ts, url) => `https://web.archive.org/web/${ts}id_/${url}`;

/* ---- 1. the release index -------------------------------------------------
   collapse=urlkey gives one row per distinct URL, which is what a list of
   release pages wants; the timestamp that comes back with it is the capture the
   index links, so the link always resolves. pubpolls.html is the exception —
   it is ONE url whose every capture holds a different wave, so it collapses on
   digest (distinct content) instead. A `*` in the url and matchType are
   mutually exclusive in the CDX API; passing both silently returns almost
   nothing, which is how this was got wrong the first time. */
const cdx = async (query, collapse = "urlkey") =>
  (await get(`https://web.archive.org/cdx/search/cdx?${query}&output=text&fl=original,timestamp`
           + `&collapse=${collapse}&filter=statuscode:200&limit=4000`))
    .trim().split("\n").filter(Boolean).map((l) => l.split(" "));

const kindOf = (slug) => {
  if (/^(smart|start)/.test(slug)) return "not-a-poll";          // media clippings
  if (slug.startsWith("newspoll")) return "newspoll";            // Galaxy-administered Newspoll
  if (/^(qld|queensland|wa|sa|victoria|vic|nsw|tas)[-\s]/.test(slug)) return "state";
  if (slug.includes("fairfax")) return "commissioned";
  return "federal";
};

const VERIFY_ONLY = process.argv.includes("--verify-only");

if (!VERIFY_ONLY) {
const index = [];
for (const [url, ts] of await cdx("url=galaxyresearch.com.au*")) {
  const slug = url.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "").toLowerCase();
  if (slug.includes("/") || slug.includes("category")) continue;   // release pages sit at the root
  if (!new RegExp(MONTHS).test(slug) || !/\d/.test(slug)) continue;
  index.push({ slug, kind: kindOf(slug), first_capture: ts, url: wayback(ts, url) });
}
// pubpolls.html — the pre-2012 route: one wave per capture, so every capture counts
for (const [url, ts] of await cdx("url=galaxyresearch.com.au/pubpolls.html", "digest"))
  index.push({ slug: "pubpolls.html", kind: "pubpolls", first_capture: ts, url: wayback(ts, url) });
/* GhostWhoVotes' mirror of the release scans. Linked through the Wayback
   capture, not the live wordpress.com URL: the originals answer 302 now, and an
   archive that links to a redirect is not an archive. */
for (const [url, ts] of await cdx("url=ghostwhovotes.files.wordpress.com&matchType=domain&filter=urlkey:.*galaxy.*"))
  index.push({ slug: url.split("/").pop(), kind: "ghostwhovotes", first_capture: ts, url: wayback(ts, url) });

index.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));

const counts = index.reduce((a, r) => ({ ...a, [r.kind]: (a[r.kind] || 0) + 1 }), {});
console.log(`release index: ${index.length} archived pages`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

const csv = ["slug,kind,first_capture,wayback_url",
  ...index.map((r) => [r.slug, r.kind, r.first_capture, r.url].join(","))].join("\n") + "\n";
if (APPLY) { writeFileSync(OUT, csv); console.log(`\nwrote ${OUT}`); }
else console.log(`\ndry run — pass --apply to write ${OUT}`);
}

/* ---- 2. verify the transcript against its sources ------------------------ */
if (!VERIFY && !VERIFY_ONLY) process.exit(0);

const rows = readFileSync(TRANSCRIPT, "utf8").trim().split("\n").slice(1)
  .map((l) => {                                     // notes are quoted; split on top-level commas
    const cells = []; let cell = "", q = false;
    for (const c of l) {
      if (c === '"') q = !q;
      else if (c === "," && !q) { cells.push(cell); cell = ""; }
      else cell += c;
    }
    cells.push(cell);
    return { date: cells[0], tpp_alp: cells[9], tpp_lnp: cells[10], source: cells[11] };
  });

/* The post body ALONE. A Poll Bludger post carries hundreds of reader comments
   quoting poll numbers at each other, so searching the whole page finds "52-48"
   on almost any page and proves nothing. Everything before the comment thread,
   and for a Wayback capture of a plain table, the whole document. */
const strip = (html) => {
  const body = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)(?:<div[^>]*class="[^"]*(?:comments|entry-footer|sharedaddy))/)
            || html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*)/);
  // the headline counts as the post: Bowe routinely states a result in the
  // title and then describes it in words ("the two parties tied") in the body
  const title = html.match(/<title>([\s\S]*?)<\/title>/);
  return ((title ? title[1] + " " : "") + (body ? body[1] : html))
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ");
};

let bad = 0;
for (const r of rows) {
  const label = r.date || "(undated)";
  try {
    const text = strip(await get(r.source));
    /* Three shapes the pair is printed in, either way round: "52-48" in prose,
       "52% ... 48%" in Galaxy's own two-column table, and "52 48" as a row of
       Bowe's running table. */
    const [a, b] = [r.tpp_alp, r.tpp_lnp];
    const prose = new RegExp(`\\b${a}\\s*[-–]\\s*${b}\\b|\\b${b}\\s*[-–]\\s*${a}\\b`);
    const table = new RegExp(`\\b${a}\\s+${b}\\b|\\b${b}\\s+${a}\\b`);
    const pct = text.includes(`${a}%`) && text.includes(`${b}%`);
    if (prose.test(text) || table.test(text) || pct) console.log(`  ok    ${label} — ${a}/${b}`);
    else { console.log(`  CHECK ${label} — ${r.tpp_alp}/${r.tpp_lnp} not found in ${r.source}`); bad++; }
  } catch (e) { console.log(`  FETCH ${label} — ${e.message}`); bad++; }
}
console.log(`\nverified ${rows.length - bad}/${rows.length} rows against their cited source`);
process.exit(bad ? 1 : 0);
