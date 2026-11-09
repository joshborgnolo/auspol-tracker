#!/usr/bin/env node
// Offline checks for resolve-oneoffs-file.mjs: the dataset shaping against
// the 2026-11-08 wave's two verbatim Datawrapper datasets (living-costs
// blame and the golf-club-grant trust battery), the modelled-series skips,
// and the LLM-verdict verifier's gates.
import {
  modelledReason, shapeTable, dedupeRows, checks, sumNote, trendNote,
  SERIES_SEED, verifyVerdict, metaOf,
} from "./resolve-oneoffs-file.mjs";
import { dwTable } from "./resolve-article-read.mjs";

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

/* the 2026-11-08 wave's "Responsibility for living costs" trend table (verbatim) */
const blameCsv = "Response Options In Poll\tOct 2024\tDec 2024\tNov 25\tFeb 26\tMar 26\tApr 26\tMay 26\tJun 26\tJul 26\tAug 26\tSep 26\tOct 26\t Nov 26\nBusinesses\t\t\t7%\t5%\t6%\t6%\t5%\t4%\t4%\t4%\t3%\t4%\t3%\nFederal Government\t36%\t35%\t42% \t40%\t40%\t38%\t35%\t36%\t39%\t40%\t41%\t46%\t42% \nThe Reserve Bank of Aus. (RBA)\t10%\t9%\t7%\t7%\t8%\t8%\t6%\t7%\t7%\t7%\t6%\t4%\t7%\nState and territory governments\t\t\t11%\t10%\t11%\t9%\t7%\t7%\t7%\t7%\t6%\t7%\t5%\nConsumer spending\t\t\t\t\t\t\t\t\t\t\t\t\t2%\nGlobal factors outside Australia’s control\t25%\t24%\t16%\t18%\t18%\t18%\t16%\t16%\t16%\t17%\t19%\t26%\t26%\nAI data centre construction^\t\t\t\t\t\t\t\t\t\t\t\t\t2%\nUnsure\t\t\t14%\t12%\t11%\t14%\t18%\t15%\t14%\t14%\t13%\t13%\t12%\n";
const blame = dwTable(blameCsv);
eq("blame table is a trend shape", blame.head.slice(1).every((h) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(h.trim().replace(/^\s+/, "")) || /\b(Nov|Dec|Oct)\b/.test(h.trim())), true);
const extra = { trendPrev: null, firstAsked: null, prevCol: null, curCol: null };
const shaped = shapeTable(blame, "2026-11-07", extra);
eq("blame: projects to the wave's Nov 26 column", shaped.rows, [
  ["Businesses", 3], ["Federal Government", 42], ["The Reserve Bank of Aus. (RBA)", 7],
  ["State and territory governments", 5], ["Consumer spending", 2],
  ["Global factors outside Australia’s control", 26], ["AI data centre construction", 2], ["Unsure", 12],
]);
eq("blame: AI data centres and consumer spending were first-asked", extra.firstAsked, ["Consumer spending", "AI data centre construction"]);
eq("blame: calls the wave out of date Nov 26 for a Dec wave", shapeTable(blame, "2026-12-05", {}).why, 'last non-empty column "Nov 26" is not Dec (the wave’s month) – the dataset is behind');
eq("blame: sums to 99", sumNote(shaped.rows, null), "The responses sum to 99 per cent from rounding.");
eq("blame: matching against the seed", SERIES_SEED.find((s) => s.when("Responsibility for living costs", "Who do you hold most responsible for rising living costs?"))?.id, "cost-of-living-blame");
eq("blame: the trust chart does not match the blame seed", SERIES_SEED.find((s) => s.when("Impact on trust", "And has the aforementioned grants program or Albanese’s grant to a local golf club changed your trust in the Prime Minister?"))?.id ?? null, null);
eq("blame: trend note flags the Federal Government's 46→42 ease", trendNote(shaped.rows, blame.rows.map((r) => [r[0], Math.round(parseFloat(r[12]))]), "Oct 26"), "Federal Government eased 4 points from 46 per cent in Oct 26 (now 42).");

/* the 2026-11-08 wave's "Impact on trust" crosstab (verbatim) */
const trustCsv = "Statement\tAll voters\tLabor voters\tCoalition voters\tGreens voters\tOne Nation voters\tIndependent voters\tUncommitted voters\tMarginal seats\nI did not trust Albanese before this anyway\t43%\t10%\t66%\t24%\t69%\t33%\t33%\t43%\nI have lost trust in what Albanese says in the future\t22%\t20%\t18%\t35%\t21%\t28%\t27%\t20%\nI still trust in what Albanese says and promises\t20%\t47%\t10%\t22%\t2%\t9%\t22%\t20%\nUnsure\t16%\t23%\t6%\t19%\t8%\t30%\t18%\t17%\n";
const trust = dwTable(trustCsv);
const tShaped = shapeTable(trust, "2026-11-07", {});
eq("trust: files every column as a crosstab", tShaped.rows.length, 4);
eq("trust: all-voters row keeps the article's figures", tShaped.rows[0], ["I did not trust Albanese before this anyway", 43, 10, 66, 24, 69, 33, 33, 43]);
eq("trust: the ONP 'still trust' cell the article's own dataset prints", tShaped.rows[2], ["I still trust in what Albanese says and promises", 20, 47, 10, 22, 2, 9, 22, 20]);
eq("trust: all-voters sums to 101", sumNote(tShaped.rows, ["", ...trust.head.slice(1)]), "Column sums differ from 100 from rounding (the All voters column sums to 101).");
eq("trust: no trend note", trendNote(tShaped.rows, null, null), null);

/* modelled charts skip deterministically */
const perf = dwTable("\tAlbanese\tTaylor\tHanson\nGood\t36%\t41%\t45%\nUndecided\t9%\t25%\t14%\nPoor\t54%\t34%\t41%");
eq("performance table never offered to the model", modelledReason(perf), "performance table (resolve-article-read's lane)");
const like = dwTable("NET LIKEABILITY (POS. – NEG.)\tSep-26\tOct-26\nAnthony Albanese\t-15\t-12\nPauline Hanson\t6\t8");
eq("likeability table never offered to the model", modelledReason(like), "likeability (resolve-article-read's lane)");
eq("blame is not modelled data", modelledReason(blame), null);

/* row hygiene */
eq("dedupe drops empty labels and repeats", dedupeRows([["a", 1], ["", 2], ["a", 3], ["b", 4]]), [["a", 1], ["b", 4]]);
eq("checks refuses an out-of-range figure", checks([["x", 101]]), "value 101 out of 0–100");
eq("checks refuses an all-null table", checks([["x", null], ["y", null]]), "no figures");
eq("checks passes the trust rows", checks(tShaped.rows), null);

/* chart meta */
eq("og:title parses with property first", metaOf('<meta property="og:title" content="Impact on trust">', "og:title"), "Impact on trust");
eq("og:description parses with content first", metaOf('<meta content="Q: Who do you hold most responsible for rising living costs?" property="og:description">', "og:description"), "Q: Who do you hold most responsible for rising living costs?");

/* the verdict verifier */
const ids = new Set(["cost-of-living-blame"]);
const ev = "Impact on trust Asked after the $6 million Marrickville Golf Club grant 43 22 20 16";
const ok = verifyVerdict({ kind: "file", id: "albanese-trust-golf-club-grant", themeId: "trust-democracy", question: "Has the grants program and Albanese's Marrickville Golf Club grant changed your trust in the Prime Minister?", notes: "'Did not trust' was up from 34 per cent." }, ev + " 34", ids);
eq("a sound verdict files, notes intact", ok.verdict?.notes, "'Did not trust' was up from 34 per cent.");
const faked = verifyVerdict({ kind: "file", id: "albanese-trust-golf-club-grant", themeId: "trust-democracy", question: "Has the grants program changed your trust in the Prime Minister?", notes: "Down from 46 per cent." }, ev, ids);
eq("notes numerals not in the evidence strip the notes", faked.verdict?.notes, null);
eq("non-kebab id refused", verifyVerdict({ kind: "file", id: "Golf Grant", themeId: "trust-democracy", question: "Has the grant changed your trust?" }, ev, ids).verdict, null);
eq("an existing id can't come from the model", verifyVerdict({ kind: "file", id: "cost-of-living-blame", themeId: "cost-of-living", question: "Who is most responsible?" }, ev, ids).verdict, null);
eq("an unknown theme can't by picked", verifyVerdict({ kind: "file", id: "x", themeId: "wibble", question: "Who is most responsible?" }, ev, ids).verdict, null);
eq("skip verdicts pass through", verifyVerdict({ kind: "skip", reason: "advertising card" }, ev, ids).verdict, "skip");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
