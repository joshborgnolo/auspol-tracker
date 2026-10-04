#!/usr/bin/env node
// Offline checks for newspoll-read.mjs's verification — the part that
// decides which of Matilda's citations become figures. Paragraphs are
// made-up text in The Australian's style; the readings are what Matilda
// would answer, right and wrong. (The Matilda call itself was backtested on
// the laptop against the 15 Newspoll stories of Jul 2025–Sep 2026.)
import { numbersIn, verifyReading, prevNewspoll } from "./newspoll-read.mjs";

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

eq("numbers: signed words and digits", numbersIn("slipped to minus seven, with 44 per cent and a net of -27").map((n) => n.v), [-7, 44, -27]);
eq("numbers: a 52-48 pair is not a minus", numbersIn("52-48 two-party").map((n) => n.v), [52, 48, 2]);
eq("numbers: compound words", numbersIn("twenty-one per cent").map((n) => n.v), [21]);

const paras = [
  "Newspoll: Labor slumps",
  "The Newspoll showed core support for Labor fell from 29 per cent to 27 per cent, down from 37 per cent in September last year.",
  "Boasting a net approval rating of minus 27, with 35 per cent of voters satisfied with his performance and 62 per cent dissatisfied, Mr ­Albanese's ratings match Malcolm Turnbull's.",
  "One Nation's primary vote remained at 30 per cent, the Greens stayed at 13 per cent and others increased from 9 to 11 per cent. Pauline Hanson's net rating slipped to minus seven, with 44 per cent satisfied and 51 per cent dissatisfied.",
  "Mr Taylor edged closer in a one-on-one contest for better prime minister, with 42 per cent backing the Labor leader and 41 per cent the Liberal leader.",
  "But after adding Senator Hanson to a three-way contest, Mr Albanese leads with 44 per cent, ahead of the One Nation leader on 32 per cent and Mr Taylor on 24 per cent.",
  "On which party is best to handle the economy, the Coalition rose to 29 per cent.",
  "Pauline Hanson's net rating was minus 15, with 44 per cent satisfied and 51 per cent dissatisfied.",
];
const era = { pm: "Albanese", opp: "Taylor", third: "Hanson" };
const prev = { alp: 29, onp: 30, grn: 13, ind: 9, lnp: 20 };
const cite = (para, quote, value, from = null) => ({ para, quote, value, from });
const read = (fields) => verifyReading({ scope: "newspoll", fields }, paras, prev, era);

let v = read({
  alp: cite(1, "core support for Labor fell from 29 per cent to 27 per cent", 27, 29),
  onp: cite(3, "One Nation's primary vote remained at 30 per cent", 30, 30),
  grn: cite(3, "the Greens stayed at 13 per cent", 13, 13),
  ind: cite(3, "others increased from 9 to 11 per cent", 11, 9),
  pmNet: cite(2, "a net approval rating of minus 27", -27),
  pmApp: cite(2, "35 per cent of voters satisfied", 35),
  pmDis: cite(2, "62 per cent dissatisfied", 62),
  hanNet: cite(3, "slipped to minus seven", -7),
  hanApp: cite(3, "44 per cent satisfied", 44),
  hanDis: cite(3, "51 per cent dissatisfied", 51),
  ppmA: cite(4, "with 42 per cent backing the Labor leader", 42),
  ppmO: cite(4, "41 per cent the Liberal leader", 41),
  ppm3A: cite(5, "Mr Albanese leads with 44 per cent", 44),
  ppm3H: cite(5, "the One Nation leader on 32 per cent", 32),
  ppm3O: cite(5, "Mr Taylor on 24 per cent", 24),
});
eq("a right reading verifies every figure (soft hyphen, words, short quotes)", v.ok,
  { alp: 27, grn: 13, onp: 30, ind: 11, pmApp: 35, pmDis: 62, pmNet: -27, hanApp: 44, hanDis: 51, hanNet: -7,
    ppmA: 42, ppmO: 41, ppm3A: 44, ppm3O: 24, ppm3H: 32 });

v = read({ alp: cite(1, "down from 37 per cent in September last year", 37, 29) });
eq("a figure not stated with the cited earlier figure is refused", v.ok, {});
v = read({ alp: cite(1, "Labor fell from 29 per cent to 27 per cent", 29, 29) });
eq("a quote that does not state the value is refused", [v.ok.alp, /does not state/.test(v.verdict.alp)], [29, false]);
v = verifyReading({ scope: "newspoll", fields: { ind: cite(3, "others increased from 9 to 11 per cent", 11, 9) } }, paras, { ind: 10 }, era);
eq("an earlier figure that is not the previous Newspoll rejects the figure", [v.ok.ind === undefined, /^REJECTED/.test(v.verdict.ind)], [true, true]);
v = read({ ind: cite(3, "others increased from 9 to 11 per cent", 11, 8) });
eq("an earlier figure that is not the previous wave is refused even when implied", v.ok.ind === undefined, true);
v = verifyReading({ scope: "newspoll", fields: { onp: cite(1, "One Nation, which fell a point to 29 per cent", 29, 30) } },
  ["x".repeat(40), "Labor trails One Nation, which fell a point to 29 per cent."], { onp: 30 }, era);
eq("an earlier figure implied by 'fell a point' is accepted", v.ok.onp, 29);
v = verifyReading({ scope: "newspoll", fields: { onp: cite(1, "One Nation, which fell a point to 29 per cent", 29, 31) } },
  ["x".repeat(40), "Labor trails One Nation, which fell a point to 29 per cent."], { onp: 31 }, era);
eq("an earlier figure the change phrase does not imply is refused", v.ok.onp, undefined);
v = read({ tpp_alp: cite(1, "down from 37 per cent", 37) });
eq("a 2PP needs a two-party sentence", v.ok.tpp_alp, undefined);
v = read({ lnp: cite(6, "the Coalition rose to 29 per cent", 29) });
eq("an issue rating is not a primary", [v.ok.lnp, v.verdict.lnp], [undefined, "sentence is about issue ratings, not the vote"]);
v = read({ ppmA: cite(5, "Mr Albanese leads with 44 per cent", 44) });
eq("the head-to-head is not read from the three-way sentence", v.ok.ppmA, undefined);
v = read({ hanNet: cite(7, "net rating was minus 15", -15), hanApp: cite(7, "44 per cent satisfied", 44), hanDis: cite(7, "51 per cent dissatisfied", 51) });
eq("satisfied − dissatisfied ≠ net refuses the leader's figures", v.ok, {});
v = read({ hanDis: cite(2, "62 per cent dissatisfied", 62) });
eq("another leader's figure is refused by its sentence", v.ok.hanDis, undefined);
v = read({ pmNet: cite(2, "a net approval rating of minus 27", 27) });
eq("a net's sign must be stated", v.ok.pmNet, undefined);
v = read({ alp: cite(1, "Labor fell from 29 per cent to 27 percent", 27, 29) });
eq("a quote not verbatim in the paragraph is refused", v.ok.alp, undefined);
v = verifyReading({ scope: "newspoll", fields: { lnp: cite(1, "Its primary vote now stands at 19 per cent", 19) } },
  ["x".repeat(40), "Support for the Coalition has slid again. Its primary vote now stands at 19 per cent."], {}, era);
eq("a pronoun's antecedent one sentence back names the subject", v.ok.lnp, 19);
v = read({ hanApp: cite(3, "44 per cent satisfied", 44), hanDis: cite(3, "51 per cent dissatisfied", 51) });
eq("an unstated net follows from satisfied − dissatisfied", v.ok.hanNet, -7);
eq("scope other files nothing", verifyReading({ scope: "other", fields: {} }, paras, prev, era).ok, {});

const D = {
  polls: [{ pollster: "Newspoll", date: "2026-08-28", alp: 29, lnp: 20, grn: 13, onp: 30, ind: 9, oth: null, tpp_alp: null }],
  approval: [{ firm: "Newspoll", date: "2026-08-28", alb: -21, opp: -18, han: -5, detail: { alb: { app: 37, dis: 58 } } }],
  ppm: [{ firm: "Newspoll", date: "2026-08-28", alb: 45, opp: 24, han: 31, extra: [{ alb: 44, opp: 40 }] }],
};
const p = prevNewspoll(D, "2026-09-14");
eq("previous wave in reader field names", [p.alp, p.pmNet, p.pmApp, p.ppm3H, p.ppmA, p.ppmO], [29, -21, 37, 31, 44, 40]);

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("all newspoll-read checks pass");
