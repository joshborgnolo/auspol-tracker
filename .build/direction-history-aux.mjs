import fs from "node:fs";
import path from "node:path";
import { directionChartOf } from "./extract-secnewgate.mjs";

const SEC_BASE = "https://www.secnewgate.com.au/";
/* The public releases pin each wave's month. The later chart reprints only
   month names without years, so a uniform two-month cadence is NOT enough:
   2022 had monthly waves, while the December break and later schedule
   changes mean the ordinal-to-month map has to be carried explicitly. */
export const SEC_EARLY_WAVES = [
  [1, "2022-03", "mood-of-the-nation-march-2022/"],
  [2, "2022-04", "sec-newgate-mood-of-the-nation-april-2022/"],
  [3, "2022-05", "sec-newgate-mood-of-the-nation-may-2022/"],
  [4, "2022-06", "sec-newgate-mood-of-the-nation-energy-edition/"],
  [5, "2022-08", "sec-newgate-mood-of-the-nation-bush-edition/"],
  [6, "2022-09", "sec-newgate-mood-of-the-nation-victoria-edition/"],
  [7, "2022-10", "sec-newgate-mood-of-the-nation-october-2022/"],
  [8, "2022-11", "sec-newgate-mood-of-the-nation-november-2022/"],
  [9, "2023-02", "sec-newgate-mood-of-the-nation-february-2023/"],
  [10, "2023-04", "sec-newgate-mood-of-the-nation-april-2023/"],
  [11, "2023-06", "sec-newgate-mood-of-the-nation-june-2023/"],
  [12, "2023-08", "sec-newgate-mood-of-the-nation-august-2023/"],
  [13, "2023-10", "sec-newgate-mood-of-the-nation-october-2023/"],
  [14, "2024-02", "sec-newgate-mood-of-the-nation-february-2024/"],
  [15, "2024-04", "mood-of-the-nation-april-2024-summary/"],
  [16, "2024-07", "mood-of-the-nation-july-2024-summary/"],
  [17, "2024-09", "mood-of-the-nation-september-2024-summary/"],
  [18, "2024-11", "mood-of-the-nation-november-2024-summary/"],
  [19, "2025-02", "mood-of-the-nation-february-2025-summary/"],
  [20, "2025-04", "sec-newgate-mood-of-the-nation-april-2025/"],
].map(([wave, month, slug]) => ({ wave, month, url: SEC_BASE + slug }));

const wordsOf = (bbox) => [...bbox.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
  .map((m) => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], text: m[5] }));

/* Read the two long series polylines directly. The purple right-direction
   and orange wrong-direction lines cross in 2022–23, so "upper is always
   wrong" is not a valid historical rule. A node's y position is converted
   using the chart's own left-axis ticks and must equal one of the numbers
   pdftotext printed for that month. */
export function secDirectionSeries(bboxHtml, svg) {
  const words = wordsOf(bboxHtml);
  const axis = words.filter((w) => /^(?:30|40|50|60|70)$/.test(w.text) && w.x1 < 65 && w.y0 < 225)
    .map((w) => ({ v: +w.text, y: (w.y0 + w.y1) / 2 })).sort((a, b) => a.v - b.v);
  if (axis.length < 3) throw new Error("SEC direction chart: fewer than three y-axis anchors");
  const n = axis.length;
  const mv = axis.reduce((s, p) => s + p.v, 0) / n, my = axis.reduce((s, p) => s + p.y, 0) / n;
  const slope = axis.reduce((s, p) => s + (p.v - mv) * (p.y - my), 0) /
    axis.reduce((s, p) => s + (p.v - mv) ** 2, 0);
  const intercept = my - slope * mv;
  const num = words.filter((w) => /^\d{2}$/.test(w.text) && w.x0 >= 60 && w.x0 <= 680 && w.y0 > 90 && w.y1 < 221)
    .map((w) => ({ x: (w.x0 + w.x1) / 2, v: +w.text }));
  const paths = [...svg.matchAll(/<path fill="none"[^>]*stroke="rgb\(([^)]+)\)"[^>]*d="([^"]+)"[^>]*>/g)]
    .map((m) => ({
      color: m[1],
      points: [...m[2].matchAll(/[ML] ([\d.]+) ([\d.]+)/g)].map((p) => ({ x: +p[1], y: 540 - +p[2] })),
    })).filter((p) => p.points.length >= 20 && p.points[0].x < 100 && p.points.every((q) => q.y > 100 && q.y < 240));
  const right = paths.find((p) => p.color.startsWith("8.628845%"));
  const wrong = paths.find((p) => p.color.startsWith("100%, 51."));
  if (!right || !wrong || right.points.length !== wrong.points.length)
    throw new Error("SEC direction chart: right/wrong vector lines not both present with equal lengths");
  const columns = right.points.map((p, i) => {
    const near = num.filter((w) => Math.abs(w.x - p.x) < 2).map((w) => w.v);
    if (near.length !== 2) throw new Error(`SEC direction column ${i + 1}: printed pair missing or stray number`);
    const markers = { right: right.points[i], wrong: wrong.points[i] };
    const out = {};
    for (const [series, point] of Object.entries(markers)) {
      const raw = (point.y - intercept) / slope;
      const v = near.reduce((best, candidate) => Math.abs(candidate - raw) < Math.abs(best - raw) ? candidate : best);
      if (Math.abs(v - raw) > 0.75)
        throw new Error(`SEC direction column ${i + 1}: ${series} marker ${raw.toFixed(2)} does not fit printed pair ${near}`);
      if (Math.abs(point.x - p.x) > 0.1) throw new Error(`SEC direction column ${i + 1}: misaligned series markers`);
      out[series] = v;
    }
    if (out.right + out.wrong !== 100 || (near[0] !== near[1] && out.right === out.wrong))
      throw new Error(`SEC direction column ${i + 1}: printed pair count/sum guard failed`);
    return { wave: i + 1, ...out };
  });
  return columns;
}

export function secHistoryWaves(src) {
  const reports = fs.readdirSync(src).filter((f) => f.endsWith(".json") && !f.endsWith(".notes.json"))
    .map((f) => {
      const side = JSON.parse(fs.readFileSync(path.join(src, f), "utf8"));
      return { side, basename: f.slice(0, -5) };
    }).filter((r) => Number.isInteger(r.side.wave) && r.side.date);
  if (!reports.length) return [];
  reports.sort((a, b) => a.side.wave - b.side.wave);
  const latest = reports[reports.length - 1];
  const bbox = fs.readFileSync(path.join(src, latest.basename + ".bbox.html"), "utf8");
  const svg = fs.readFileSync(path.join(src, latest.basename + ".direction.svg"), "utf8");
  const series = secDirectionSeries(bbox, svg);
  if (series.length !== latest.side.wave)
    throw new Error(`SEC direction history: ${series.length} columns for wave ${latest.side.wave}`);
  for (const r of reports) {
    const endpoint = series[r.side.wave - 1];
    const chart = directionChartOf(fs.readFileSync(path.join(src, r.basename + ".bbox.html"), "utf8"));
    const endpointText = chart.columns.at(-1);
    if (chart.problems.length || !endpointText || !endpoint ||
      endpoint.right !== endpointText.right || endpoint.wrong !== endpointText.wrong)
      throw new Error(`SEC direction history: wave ${r.side.wave}'s own report does not match its reprint`);
  }
  const dated = new Map(reports.map((r) => [r.side.wave, r]));
  const rows = [];
  for (const p of series) {
    const early = SEC_EARLY_WAVES.find((w) => w.wave === p.wave);
    const report = early ? null : dated.get(p.wave);
    const month = early?.month || report?.side.date.slice(0, 7);
    if (!month) throw new Error(`SEC direction history: wave ${p.wave} has no month source`);
    if (p.wave >= Math.min(...dated.keys())) continue;   // the dated live rows own this span
    rows.push({
      month, right: p.right, wrong: p.wrong, unsure: 100 - p.right - p.wrong,
      pollster: "SEC Newgate", method: "Online",
      sample: report?.side.sample ?? null,
      url: early?.url || report.side.url || report.side.pdf,
      source: "SEC Newgate Mood of the Nation, Perceived direction of Australia (%)",
      quote: `SEC Newgate wave ${p.wave}'s purple right-direction and orange wrong-direction paths and printed values; ${month}.`,
    });
  }
  return rows;
}

/* RedBridge's Figure 53 / 41 is a seven-row image table. Vision reads each
   row as separate label and three right-aligned numbers. Keep rows only
   when all five expected labels and every 0–100 figure are present, then
   require the two reports' common months to agree. */
const RB_MONTHS = { Jan: 1, January: 1, Feb: 2, February: 2, Mar: 3, March: 3, Apr: 4, April: 4,
  May: 5, Jun: 6, June: 6, Jul: 7, July: 7, Aug: 8, August: 8,
  Sep: 9, Sept: 9, September: 9, Oct: 10, October: 10, Nov: 11, November: 11, Dec: 12, December: 12 };
export function redbridgeDirectionRows(ocrRows) {
  const items = ocrRows.map((r) => ({ ...r, numbers: /^\d{1,2}\|?$/.test(r.text) ? +r.text.replace(/\|$/, "") : null }));
  const rows = [];
  for (const label of items.filter((r) => {
    const m = r.text.match(/^(\w+) (20\d\d)$/);
    return m && m[1] in RB_MONTHS;
  })) {
    const figures = items.filter((r) => r.numbers != null && Math.abs(r.y - label.y) < 0.013 && r.x > label.x + 0.2)
      .sort((a, b) => a.x - b.x).map((r) => r.numbers);
    if (figures.length < 2) throw new Error(`RedBridge direction ${label.text}: ${figures.length} figures, expected at least 2`);
    const [right, wrong] = figures;
    const unsure = figures.length === 2 ? 100 - right - wrong : figures[2];
    if ([right, wrong, unsure].some((v) => v < 0 || v > 100) || right + wrong + unsure !== 100)
      throw new Error(`RedBridge direction ${label.text}: shares ${right}/${wrong}/${unsure} do not sum to 100`);
    const [monthName, year] = label.text.split(" ");
    const month = String(RB_MONTHS[monthName]).padStart(2, "0");
    rows.push({ month: `${year}-${month}`, right, wrong, unsure });
  }
  const fig = items.find((r) => /^Figure \d+:/.test(r.text));
  if (!fig || rows.length < 7) throw new Error(`RedBridge direction chart: ${rows.length} rows read, expected at least 7`);
  return rows;
}

export function redbridgeHistoryWaves(src) {
  const reports = ["redbridge-nov2025-p111.json", "redbridge-jan2026-p106.json"]
    .map((file, i) => ({
      file,
      pdf: i === 0
        ? "https://6b72024e-077a-44e2-88f5-dc1a0ed81099.usrfiles.com/ugd/b86980_abdcc3923bde4644b76c7f976a0f0034.pdf"
        : "https://6b72024e-077a-44e2-88f5-dc1a0ed81099.usrfiles.com/ugd/b86980_a04c3282929c4378a2f96d0134bfd344.pdf",
      caption: i === 0 ? "Figure 53, November 2025" : "Figure 41, January 2026",
    }));
  const banks = reports.map((r) => ({ ...r, rows: redbridgeDirectionRows(JSON.parse(fs.readFileSync(path.join(src, r.file), "utf8"))) }));
  const [first, second] = banks;
  if (!first.rows.some((r) => r.month === "2025-11") || !second.rows.some((r) => r.month === "2026-01"))
    throw new Error("RedBridge direction history: report endpoints drifted");
  for (const row of first.rows) {
    const again = second.rows.find((r) => r.month === row.month);
    if (!again || ["right", "wrong", "unsure"].some((k) => row[k] !== again[k]))
      throw new Error(`RedBridge direction history: ${row.month} differs between reports`);
  }
  const times = {};
  return banks.flatMap((bank) => bank.rows.filter((r) => r.month < "2025-11" && !times[r.month] && (times[r.month] = true))
    .map((r) => ({ ...r, pollster: "RedBridge/Accent", url: bank.pdf,
      source: `RedBridge/Accent national-direction trend, ${bank.caption}`,
      quote: `${bank.caption}: ${r.month}, ${r.right} generally right / ${r.wrong} generally wrong / ${r.unsure} not sure.` })));
}
