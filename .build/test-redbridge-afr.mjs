#!/usr/bin/env node
// Offline checks for extract-redbridge-afr.mjs's own parsing: the chart
// footers AFR has printed, the OCR line shapes seen in the Nov 2025–Oct 2026
// charts, and the prose corroboration. The OCR and Matilda steps need the
// laptop (Vision, the logged-in Chrome); they were backtested there.
process.env.RBAFR_LIB = "1";
const { parseFooter, lineNumbers, proseStates } = await import("./extract-redbridge-afr.mjs");

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

eq("footer: month-spanning fieldwork",
  parseFooter("Conducted September 28-October 2, sample of 1000 voters, margin of error +/- 3.4%", "2026-10-04"),
  { dateStart: "2026-09-28", date: "2026-10-02", sample: 1000 });
eq("footer: 'Survey conducted' with a thousands comma",
  parseFooter("Survey conducted March 23-27, sample of 1,003 voters, margin of error +/- 3.5%", "2026-03-29"),
  { dateStart: "2026-03-23", date: "2026-03-27", sample: 1003 });
eq("footer: 'Survey May 25-28, 1005 voters'",
  parseFooter("Survey May 25-28, 1005 voters, margin of error +/- 3.4%.", "2026-05-31"),
  { dateStart: "2026-05-25", date: "2026-05-28", sample: 1005 });
eq("footer: 'Poll sampled N voters between Jun 22 and Jun 26'",
  parseFooter("Poll sampled 1006 voters between Jun 22 and Jun 26. Margin of error +/-3.5%", "2026-06-28"),
  { dateStart: "2026-06-22", date: "2026-06-26", sample: 1006 });
eq("footer: a December wave published in January takes the old year",
  parseFooter("Survey conducted Dec 8-12, sample of 1010 voters", "2027-01-03"),
  { dateStart: "2026-12-08", date: "2026-12-12", sample: 1010 });
eq("footer: none", parseFooter("SOURCE: REDBRIDGE GROUP, ACCENT RESEARCH", "2026-10-04"), null);

eq("line: figure and change", lineNumbers("28 (-1)"), { value: 28, change: -1, changeSigned: true });
eq("line: no space before the bracket", lineNumbers("50(-2)"), { value: 50, change: -2, changeSigned: true });
eq("line: negative net with 'pts'", lineNumbers("-27 (-10pts)"), { value: -27, change: -10, changeSigned: true });
eq("line: zero change", lineNumbers("31 (0)"), { value: 31, change: 0, changeSigned: true });
eq("line: unsigned change OCR'd without its sign", lineNumbers("30(3)"), { value: 30, change: 3, changeSigned: false });
eq("line: label run into the figure", lineNumbers("-2(+1) Angus Taylor"), { value: -2, change: 1, changeSigned: true });
eq("line: footnote caret inside the bracket", lineNumbers("-16(-2^)"), { value: -16, change: -2, changeSigned: true });
eq("line: OCR's letter O for a zero figure", lineNumbers("O(+1)"), { value: 0, change: 1, changeSigned: true });
eq("line: OCR's letter O for a zero change", lineNumbers("-10 (O)"), { value: -10, change: 0, changeSigned: true });
eq("line: bare figure", lineNumbers("54"), { value: 54, change: null, changeSigned: false });

const paras = [
  "Albanese's net favourability rating plunged 10 points in a month to minus 27 per cent, his lowest rating ever.",
  "Based on asking poll respondents how they would direct their preference, Labor leads One Nation by 52 per cent to 48 per cent on a two-party-preferred basis.",
  "In terms of which party is most trusted to handle the economy, Labor has dropped 4 points to 20 per cent, while the Coalition increased a point to 29 per cent.",
];
eq("prose: a net rating in words", proseStates(paras, "net_alb", -27, "Taylor"), true);
eq("prose: Labor v One Nation 2PP", proseStates(paras, "tpp_on_alp", 52, "Taylor"), true);
eq("prose: an issue rating does not back a primary", proseStates(paras, "lnp", 29, "Taylor"), false);
eq("prose: a wrong figure is not corroborated", proseStates(paras, "net_alb", -23, "Taylor"), false);

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("all redbridge-afr parser checks pass");
