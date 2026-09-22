/* Fixture test for extract-news24.mjs's Wikipedia leg — the parser that
   discovers News24-only YouGov waves (candidate URL, sample, primaries, 2PP)
   from the federal polling table. Pins BOTH table layouts the page has used:
   form A (until Sep 2026: `!` header date cell, six primary cells with IND
   and OTH separate) and form C (since Sep 2026: rowspan data date cell, the
   leading 2PP in a `!` cell, IND+OTH merged into one "Others" cell with the
   split in an {{efn}} footnote) — the change that blinded this leg for
   twelve days. Run: node .build/test-news24-wiki.mjs */
import assert from "node:assert/strict";

process.env.N24_LIB = "1";
const { parseWikiYouGov, wikiOthersSplit } = await import("./extract-news24.mjs");

const head = `==Voting intention==
===2026===
{| class="wikitable sortable"
! rowspan="5" | Date
! rowspan="5" | Polling firm
! colspan="6" | Primary vote
! colspan="3" |[[Two-party-preferred vote|2PP vote]]
`;

// ---- form C: the current layout, verbatim shape of the 9 Sep 2026 row -------------
const formC = head + `|-
| rowspan="2" | 1–8 Sept
| align=left rowspan="2" | [[YouGov]]<ref name="September9YouGov">{{cite news|title=One Nation surges|url=https://www.news24.com.au/politics/australian-politics/one-nation-surges/news-story/334ce8596f4b51edb853c103514385a0|date=9 September 2026|access-date=9 September 2026}}</ref>
| rowspan="2" | [https://www.news24.com.au/politics/australian-politics/one-nation-surges/news-story/334ce8596f4b51edb853c103514385a0 ''News24'']
| rowspan="2" | Online
| rowspan="2" | 1,500
| rowspan="2" | 26%
| rowspan="2" colspan=2 | 18%
| rowspan="2" | 12%
| rowspan="2" style="background:#FFC7A8" | '''30%'''
| rowspan="2" | 14%{{efn|name=yougov9sept|7% [[Independent politicians in Australia|Independent]], 2% [[Community Strong Australia]] and 5% Other}}
! style="background:#FFB6B6" | 52%
| 48%
| {{N/A}}
|-
! style="background:#FFB6B6" | 53%
| {{n/a}}
|-
| rowspan="2" | 18–24 Aug
| align=left rowspan="2" | [[YouGov]]<ref>{{cite news|title=x|url=https://www.news24.com.au/politics/australian-politics/x/news-story/d04bde51f5545775296ce13f7e15515e|date=25 August 2026}}</ref>
| rowspan="2" | [https://www.news24.com.au/politics/australian-politics/x/news-story/d04bde51f5545775296ce13f7e15515e ''News24'']
| rowspan="2" | Online
| rowspan="2" | 1,510
| rowspan="2" style="background:#FFB6B6" | '''29%'''
| rowspan="2" colspan=2 | 21%
| rowspan="2" | 12%
| rowspan="2" | 26%
| rowspan="2" | 12%{{efn|name=yougov24aug| 5% Independent, 2% [[Community Strong Australia]] and 5% Other}}
! style="background:#FFB6B6" | 53%
| 47%
| {{N/A}}
|-
! style="background:#FFB6B6" | 56%
| {{n/a}}
|}
`;
let r = parseWikiYouGov(formC);
assert.equal(r.waves.length, 2, JSON.stringify(r));
const sep = r.waves.find((w) => w.date === "2026-09-08");
assert.ok(sep, "9 Sep wave found: " + JSON.stringify(r.waves.map((w) => w.date)));
assert.equal(sep.dateStart, "2026-09-01");
assert.equal(sep.sample, 1500);
assert.equal(sep.client, "News24");
assert.match(sep.url, /news-story\/334ce8596f4b51edb853c103514385a0$/);
// canon row 2026-09-08: ind 7 (Independent), oth 7 (CSA 2 + Other 5)
assert.deepEqual(sep.vi, { alp: 26, lnp: 18, grn: 12, onp: 30, ind: 7, oth: 7, tpp_alp: 52, tpp_lnp: 48 });
const aug = r.waves.find((w) => w.date === "2026-08-24");
assert.deepEqual(aug.vi, { alp: 29, lnp: 21, grn: 12, onp: 26, ind: 5, oth: 7, tpp_alp: 53, tpp_lnp: 47 }, "bare 'Independent' wording, bold leader cell");
assert.deepEqual(r.unparsed, []);

// a footnote whose split does not add to the Others cell is not trusted:
// the cell's figure stays as oth, ind absent
r = parseWikiYouGov(formC.replace("7% [[Independent politicians in Australia|Independent]], 2%", "9% [[Independent politicians in Australia|Independent]], 2%"));
assert.deepEqual(r.waves.find((w) => w.date === "2026-09-08").vi.ind, null);
assert.equal(r.waves.find((w) => w.date === "2026-09-08").vi.oth, 14);
assert.deepEqual(wikiOthersSplit("x{{efn|name=a|7% Independents, 3% Other}}y"), { ind: 7, oth: 3 });
assert.equal(wikiOthersSplit("no footnote here"), null);

// ---- form A: the layout until Sep 2026 (header date cell, six primaries) ---------
const formA = head + `|-
! 7–14 July
| [[YouGov]]<ref>{{cite news|title=y|url=https://www.news24.com.au/politics/australian-politics/y/news-story/abc|date=15 July 2026}}</ref>
| [https://www.news24.com.au/politics/australian-politics/y/news-story/abc ''News24'']
| Online
| 1,468
| 28%
| colspan=3 | 22%
| 13%
| 25%
| 6%
| 6%
| 53%
| 47%
|-
| colspan="11" | (the parser closes a table on the chunk carrying |}, so a row must not share it)
|}
`;
r = parseWikiYouGov(formA);
assert.equal(r.waves.length, 1, JSON.stringify(r));
assert.deepEqual(r.waves[0].vi, { alp: 28, lnp: 22, grn: 13, onp: 25, ind: 6, oth: 6, tpp_alp: 53, tpp_lnp: 47 });
assert.equal(r.waves[0].date, "2026-07-14");

// ---- an MRP row and a non-YouGov row are ignored ------------------------------------
const noise = head + `|-
| rowspan="2" | 1–8 Sept
| rowspan="2" | [[Newspoll]]<ref>z</ref>
| rowspan="2" | 1,244
| rowspan="2" | 27%
|-
! 14–20 Sept
| [[YouGov]] MRP<ref>m</ref>
| 10,000
| 30%
|-
| filler
|}
`;
r = parseWikiYouGov(noise);
assert.equal(r.waves.length, 0, JSON.stringify(r));

console.log("test-news24-wiki: ok");
