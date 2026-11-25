import fs from "node:fs";
import path from "node:path";

const DS = "support_for_new_data_centre_being_built_in_local_area";
const SPEC = {
  id: "dEGca",
  question: "To what extent would you support or oppose a new datacentre being built in your area?",
  waveDate: "2026-11-24",
  csvWave: "2026-11-25",
  month: "Nov'26",
  key: "Support for new data centre being built in your local area.",
  article: "https://www.theguardian.com/australia-news/2026/nov/25/guardian-essential-poll-anthony-albaneses-ai-datacentres-labor-one-nation-coalition",
  embed: "https://interactive.guim.co.uk/datawrapper/embed/dEGca/2/",
  dataset: "https://interactive.guim.co.uk/datawrapper/embed/dEGca/2/dataset.csv",
};
const LABELS = ["Strongly support", "Somewhat support", "Neither support nor oppose", "Somewhat oppose", "Strongly oppose", "Unsure"];

export function parseDatawrapperTable(text) {
  const rows = text.trim().split(/\r?\n/);
  const header = rows.shift().trim().split(/\s{2,}|\t/);
  if (header.length < 3 || header[header.length - 2] !== SPEC.month || header.at(-1) !== "Change")
    throw new Error("Datawrapper table: unexpected current or previous period headings");
  const out = [], previous = {}, current = {}, notes = [];
  for (const line of rows) {
    const label = LABELS[rows.indexOf(line)];
    if (!label || !line.trim().startsWith(label))
      throw new Error(`Datawrapper table: unrecognised row ${JSON.stringify(line)}`);
    const [old, now, change] = line.trim().slice(label.length).trim().split(/\s{2,}|\t/);
    if (old == null || now == null || change == null) throw new Error(`Datawrapper table: incomplete row ${label}`);
    const pct = (s) => {
      const m = s.match(/^([+-]?\d+(?:\.\d+)?)%$/);
      if (!m) throw new Error(`Datawrapper table: non-percentage cell ${s}`);
      return Number(m[1]);
    };
    // Publisher tables vary only in punctuation: treat these response labels
    // as the same answer, or the merge would print both rows.
    const answer = label === "Neither support nor oppose" ? "Neither support, nor oppose" : label;
    previous[answer] = pct(old); current[answer] = pct(now);
    if (!/^[+-−]?\d+(?:\.\d+)?%$/.test(change)) throw new Error(`Datawrapper table: invalid change cell ${change}`);
    const d = Number(change.replace(/[+−-]/g, (m) => m === "+" ? "" : "-").replace(/%$/, ""));
    const computed = current[answer] - previous[answer];
    if (d !== computed) notes.push(`${label}: printed change ${d} but ${previous[answer]} -> ${current[answer]} is ${computed}`);
    out.push({ ds: DS, qid: SPEC.id, q: SPEC.question, vis: "Overall", ans: answer, dim: "", key: SPEC.key, date: SPEC.csvWave, val: current[answer], url: SPEC.article, printedChange: d });
  }
  for (const vals of [previous, current]) {
    const sum = Object.values(vals).reduce((a, b) => a + b, 0);
    if (sum < 99 || sum > 101) throw new Error(`Datawrapper table: response shares sum to ${sum}`);
  }
  return { rows: out, previous, current, notes, source: SPEC };
}

export async function appendDatawrapperTable(allRows, { writeCache = true } = {}) {
  const res = await fetch(SPEC.dataset);
  if (!res.ok) throw new Error(`Datawrapper ${SPEC.id}: HTTP ${res.status}`);
  const raw = await res.text();
  const read = parseDatawrapperTable(raw);
  for (const note of read.notes) console.warn(`NOTE: Datawrapper ${SPEC.id}: ${note}`);
  const cache = path.resolve(".build", "essential-src", `${SPEC.id}.csv`);
  // Preserve the provenance input separately from the derived one-off store.
  if (writeCache) {
    fs.writeFileSync(cache + ".tmp", raw);
    fs.renameSync(cache + ".tmp", cache);
  }
  const entry = allRows.get(DS) || { qid: null, q: SPEC.question, rows: [] };
  entry.rows.push(...read.rows);
  allRows.set(DS, entry);
  return read.rows;
}
