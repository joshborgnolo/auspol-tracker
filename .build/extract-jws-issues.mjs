// JWS Research True Issues core-wave archive.
//
// --fetch-sources enumerates the live WordPress media index, verifies the
// selected core reports and caches their real PDF bytes plus pdftotext -layout
// output under .build/jws-issues-src/.  Offline regeneration never fetches.
// This is a parse-only public-opinion store: it is deliberately not connected
// to polls.json, the voting-intention aggregates or any page.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MEDIA_URL = "https://www.jwsresearch.com/wp-json/wp/v2/media?search=True%20Issues&per_page=100&_fields=id,date,slug,source_url,title,caption";
export const FIRST_CORE_WAVE = 18;
export const LAST_CORE_WAVE = 43;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DEFAULT_SRC = path.join(HERE, "jws-issues-src");
const DEFAULT_OUT = path.join(ROOT, "data", "jws-issues.json");

// Later/current uploads win over the superseded twins in the media archive.
// Wave 19's surviving core PDF has no wave number in its filename.
export const CORE_SOURCES = [
  [18, 2796, "2019-05-22T12:36:46", "https://www.jwsresearch.com/wp-content/uploads/2019/05/JWS-Research-True-Issues-18-March-2019-1.pdf"],
  [19, 3037, "2019-07-05T17:59:58", "https://www.jwsresearch.com/wp-content/uploads/2019/07/True-Issues-JWS-Research-July-2019-1.pdf"],
  [20, 3178, "2019-11-15T16:43:02", "https://www.jwsresearch.com/wp-content/uploads/2019/11/JWS-Research-True-Issues-20-November-2019-1.pdf"],
  [21, 3261, "2020-02-28T15:19:49", "https://www.jwsresearch.com/wp-content/uploads/2020/02/JWS-Research-True-Issues-21-February-2020-1.pdf"],
  [22, 3302, "2020-07-13T15:13:37", "https://www.jwsresearch.com/wp-content/uploads/2020/07/JWS-Research-True-Issues-22-July-2020-1.pdf"],
  [23, 3489, "2020-11-30T14:26:06", "https://www.jwsresearch.com/wp-content/uploads/2020/11/JWS-Research-True-Issues-23-November-2020-1.pdf"],
  [24, 3550, "2021-03-05T13:50:30", "https://www.jwsresearch.com/wp-content/uploads/2021/03/JWS-Research-True-Issues-24-February-2021-1.pdf"],
  [25, 3646, "2021-09-08T14:33:33", "https://www.jwsresearch.com/wp-content/uploads/2021/09/JWS-Research-True-Issues-25-July-2021-1.pdf"],
  [26, 3727, "2021-12-13T14:32:03", "https://www.jwsresearch.com/wp-content/uploads/2021/12/JWS-Research-True-Issues-26-November-2021-1.pdf"],
  [27, 3767, "2022-03-18T16:56:25", "https://www.jwsresearch.com/wp-content/uploads/2022/03/JWS-Research-True-Issues-27-March-2022-1.pdf"],
  [28, 3846, "2022-08-26T10:56:54", "https://www.jwsresearch.com/wp-content/uploads/2022/08/JWS-Research-True-Issues-28-August-2022-2.pdf"],
  [29, 3899, "2022-11-15T11:26:17", "https://www.jwsresearch.com/wp-content/uploads/2022/11/JWS-Research-True-Issues-29-November-2022-1.pdf"],
  [30, 4017, "2023-03-07T14:11:43", "https://www.jwsresearch.com/wp-content/uploads/2023/03/JWS-Research-True-Issues-30-March-2023-1.pdf"],
  [31, 4181, "2023-06-27T16:38:56", "https://www.jwsresearch.com/wp-content/uploads/2023/06/JWS-Research-True-Issues-31-June-2023-2.pdf"],
  [32, 4241, "2023-10-24T16:19:54", "https://www.jwsresearch.com/wp-content/uploads/2023/10/JWS-Research-True-Issues-32-October-2023-1.pdf"],
  [33, 4307, "2024-02-21T12:39:46", "https://www.jwsresearch.com/wp-content/uploads/2024/02/JWS-Research-True-Issues-33-February-2024-D2-1.pdf"],
  [34, 6565, "2024-08-27T17:50:00", "https://www.jwsresearch.com/wp-content/uploads/True-Issues-34-May-2024.pdf"],
  [35, 6632, "2024-09-03T06:37:52", "https://www.jwsresearch.com/wp-content/uploads/True-Issues-35-August-2024.pdf"],
  [36, 6892, "2024-12-03T17:27:10", "https://www.jwsresearch.com/wp-content/uploads/True-Issues-36-November-2024-1.pdf"],
  [37, 6913, "2025-02-17T03:45:32", "https://www.jwsresearch.com/wp-content/uploads/True-Issues-37-February-2025.pdf"],
  [38, 7232, "2025-09-12T02:33:44", "https://www.jwsresearch.com/wp-content/uploads/True-Issues-38-Sept-2025-1.pdf"],
  [39, 7296, "2025-11-26T02:39:02", "https://www.jwsresearch.com/wp-content/uploads/True-Issues-39-Nov-2025.pdf"],
  [40, 7557, "2026-02-20T09:18:30", "https://www.jwsresearch.com/wp-content/uploads/True-Issues-40-Feb-2026_Final.pdf"],
  [41, 7674, "2026-05-22T15:22:16", "https://www.jwsresearch.com/wp-content/uploads/True-Issues-41-May-2026.pdf"],
  [42, 8022, "2026-08-31T16:34:37", "https://www.jwsresearch.com/wp-content/uploads/True_Issues_42_0826-1.pdf"],
  [43, 8166, "2026-11-17T15:12:44", "https://www.jwsresearch.com/wp-content/uploads/True_Issues_43_131126.pdf"],
].map(([wave, mediaId, mediaDate, sourceUrl]) => ({ wave, mediaId, mediaDate, sourceUrl }));

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const atomic = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};

async function getBuffer(url) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker source archive)" },
        redirect: "follow", signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      last = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error(`${url}: ${last?.message || last}`);
}

function pdfToText(pdf, wave) {
  for (const bin of ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"]) {
    try {
      return execFileSync(bin, ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 1 << 27 });
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`wave ${wave}: pdftotext failed: ${String(error.message).slice(0, 240)}`);
    }
  }
  throw new Error("pdftotext (poppler) not found");
}

// Waves 1–17 have no per-wave PDF in the current WordPress media archive.
// These are chronology labels only (printed in the later reports' trend axes),
// not recovered observations. No values are read out of those trend charts.
const EARLY_WAVE_LABELS = [
  "June 2013", "November 2013", "March 2014", "July 2014", "November 2014",
  "March 2015", "June 2015", "November 2015", "May 2016", "August 2016",
  "November 2016", "March 2017", "July 2017", "April 2018", "August 2018",
  "November 2018", "February 2019",
];
const CORE_WAVE_LABELS = [
  "March 2019", "July 2019", "November 2019", "February 2020", "July 2020",
  "November 2020", "February 2021", "July 2021", "November 2021",
];
const MONTH = Object.fromEntries(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => [m, i + 1]));
const isoDate = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const collapse = (s) => s.replace(/\s+/g, " ").trim();
const stripTitle = (s) => s.replace(/&#8211;|&ndash;/g, "–").replace(/&#038;|&amp;/g, "&");

function tableLines(page, title) {
  const start = page.indexOf(title);
  if (start < 0) throw new Error(`table heading not found: ${title}`);
  const body = page.slice(start + title.length);
  const stops = ["Significantly higher", "Significantly ▲", "Q. What are", "Q. From the following", "Q. How would", "Q. Do you think"];
  let end = body.length;
  for (const marker of stops) {
    const at = body.indexOf(marker);
    if (at >= 0) end = Math.min(end, at);
  }
  return body.slice(0, end).split("\n").map(collapse).filter(Boolean)
    .filter((line) => !/^(?:\(?Up to 3 issues|\(?Top 5 most important|\(?Performance index|Net direction|Index score|Top (?:10|ten) results|Top results|20\d\d(?:\s+20\d\d)*$)/i.test(line))
    .filter((line) => !/^(?:(?:Mar|Nov|Jul|Feb|Aug|Oct|May|Jun|Sep|Sept)(?:\s+20\d\d)?\s*)+$/i.test(line));
}

const DEMO_START = /(?:One Nation voters|Other voters|ALP voters|LNP voters|Greens voters|Green voters|Women\b|Men\b|Rent(?:ers| home)|HHI\b|Hhold\b|Own home|Families\b|CALD\b|WA:|Vic:|SA:|Qld:|NSW:|18-34|35-54|55\+|University|Employed|Regions)/i;
function labelBeforeValues(prefix) {
  const demo = prefix.search(DEMO_START);
  let label = (demo >= 0 ? prefix.slice(0, demo) : prefix).trim();
  // Current-column months/years and chart annotations are not issue labels.
  if (/^(?:Top results|Top 10 results|Top ten results|\d{4}|Nov|Aug|May|Feb|Mar|Jul|Oct|Sep)\b/i.test(label)) return "";
  if (/^\$/.test(label)) return "";
  return label.replace(/\s+/g, " ").trim();
}

function parseSalienceTable(page, kind) {
  if (!/Most important issues the Australian Government should focus on/.test(page)) throw new Error(`${kind}: salience heading absent`);
  const lines = tableLines(page, "Most important issues the Australian Government should focus on");
  const rows = [];
  let pendingLabel = "", needsCurrent = -1;
  for (const line of lines) {
    if (!line || /^JWS Research/i.test(line)) continue;
    if (/^(?:[*^#]|COVID-19 \/ coronavirus pandemic|and wages:|TOTAL economy and finances|\d+% of Australians mention|\(?(?:Nov|Jul|Feb|Mar|Aug)\s+20\d\d:)/i.test(line)) continue;
    const percent = line.search(/(?:\d+)?%/);
    if (percent < 0) {
      // Long issue labels can wrap before their value; demographic call-outs
      // and historical notes are label-less and are never treated as values.
      if (/^[A-Za-z]/.test(line) && !DEMO_START.test(line) && !/(?:voters|years|yrs|income|respondents|Australians|previously|added|new code)/i.test(line)) {
        pendingLabel = pendingLabel ? `${pendingLabel} ${line}` : line;
      }
      continue;
    }
    const prefix = line.slice(0, percent).trim();
    let label = labelBeforeValues(prefix);
    let rest = line.slice(label ? line.indexOf(label) + label.length : 0).trim();
    const demographicPrefix = DEMO_START.test(prefix);
    if (!label && pendingLabel) {
      label = pendingLabel;
      rest = line;
    } else if (pendingLabel && label && percent === line.length - 1) {
      // no-op: a standalone wrapped label was already the best label
    }
    if (!label && pendingLabel) label = pendingLabel;
    if (pendingLabel && label && label !== pendingLabel && !label.startsWith(pendingLabel) && prefix.length < 30) label = `${pendingLabel} ${label}`;
    pendingLabel = "";
    if (!label) {
      if (needsCurrent >= 0 && !rows[needsCurrent].demographicPrefix) {
        // Defensive: a label-less value belongs only to an explicitly pending row.
      }
      if (needsCurrent >= 0) {
        const row = rows[needsCurrent];
        const match = rest.match(/(?:^|\s)(\d+)%/);
        if (match) row.share = Number(match[1]);
        needsCurrent = -1;
      }
      continue;
    }
    // A bare % is an artefact beside some Interest rates labels, not a
    // missing observation: each of these tables still has all four wave cells.
    const first = rest.match(/(\d+)%/);
    const row = { label, share: first ? Number(first[1]) : null, demographicPrefix };
    rows.push(row);
    if (demographicPrefix) needsCurrent = rows.length - 1;
  }
  return rows.filter((row) => row.label && !/^(?:Top results|Top ten results)$/i.test(row.label))
    .map(({ demographicPrefix, ...row }) => row);
}

function parseGovernmentPerformance(page) {
  const title = "Australian Government performance on issues";
  if (!page.includes(title)) throw new Error("government issue-performance heading absent");
  const lines = tableLines(page, title);
  const rows = [];
  let pendingLabel = "";
  for (const line of lines) {
    if (/^(?:JWS Research|Performance|Index score)/i.test(line)) continue;
    // Bare indices, not rates; numbers joined to words (COVID-19, 18-34) are labels/call-outs.
    const value = line.match(/(?<![-\w])(\d{1,3})(?![-\w])/);
    if (!value) {
      if (/^[A-Za-z]/.test(line) && !DEMO_START.test(line) && !/(?:voters|years|yrs|income|previously)/i.test(line)) pendingLabel = pendingLabel ? `${pendingLabel} ${line}` : line;
      continue;
    }
    let prefix = line.slice(0, value.index).trim();
    const demo = prefix.search(DEMO_START);
    if (demo >= 0) prefix = prefix.slice(0, demo).trim();
    let label = prefix || pendingLabel;
    if (pendingLabel && prefix && prefix.length < 30) label = `${pendingLabel} ${prefix}`;
    pendingLabel = "";
    if (!label) continue;
    rows.push({ label: label.replace(/\s+%\s*$/, "").trim(), index: Number(value[1]) });
  }
  return rows;
}

function questionOf(page) {
  const match = page.match(/Q\.\s+([\s\S]*?)(?:\n\s*Base:|$)/);
  if (!match) return null;
  return collapse(match[1]).replace(/\s+\d{1,2}$/, "").trim();
}

function parseOrganisationPerformance(page) {
  if (!page.includes("Performance of organisations and groups in Australia") || !/Very Good/i.test(page)) throw new Error("organisation rating chart absent");
  const table = collapse(page.slice(page.indexOf("Performance of organisations and groups in Australia"), page.search(/#For an explanation|# For an explanation/)));
  const entities = [
    { key: "businessAndIndustry", label: "Business and industry", re: /Business and industry/g },
    { key: "localCouncil", label: "Your Local Council", re: /Your Local Council/g },
    { key: "stateGovernment", label: null, re: /Your State (?:or|\/) Territory(?: Government)?/g },
    { key: "australianGovernment", label: "The Australian Government", re: /The Australian(?: Government)?/g },
  ];
  const found = entities.flatMap((entity) => [...table.matchAll(entity.re)].map((match) => ({ ...entity,
    label: entity.label || (match[0].endsWith("Government") ? match[0] : `${match[0]} Government`),
    start: match.index, end: match.index + match[0].length }))).sort((a, b) => a.start - b.start);
  const rows = found.map((entity, i) => {
    const end = i + 1 < found.length ? found[i + 1].start : table.indexOf("Very Good", entity.end);
    const rest = table.slice(entity.end, end > entity.end ? end : undefined);
    // The first five ratings are spatially adjacent. Don't know can be split
    // away from them by demographic text, so identify that sixth cell with
    // both the row total and the report's own printed-index formula.
    const five = [...rest.matchAll(/(?=((\d+)%\s*(\d+)%\s*(\d+)%\s*(\d+)%\s*(\d+)%))/g)];
    let selected = null, fallback = null;
    for (const start of five) {
      const firstFive = start.slice(2, 7).map(Number);
      const firstTotal = firstFive.reduce((a, b) => a + b, 0);
      if (firstTotal < 80 || firstTotal > 100) continue;
      const afterFive = rest.slice(start.index + start[1].length);
      for (const dk of afterFive.matchAll(/(\d+)%/g)) {
        const values = [...firstFive, Number(dk[1])];
        const total = values.reduce((a, b) => a + b, 0);
        if (total < 95 || total > 105) continue;
        const tail = afterFive.slice(dk.index + dk[0].length);
        let index = null;
        for (const match of tail.matchAll(/(?<![\w%.-])(\d{1,3})(?![\w%.-])/g)) {
          if (tail.slice(0, match.index).trimEnd().endsWith(":")) continue;
          index = Number(match[1]);
          break;
        }
        if (index == null) continue;
        const candidate = { values, index };
        fallback ||= candidate;
        const formula = (100 * values[0] + 75 * values[1] + 50 * values[2] + 25 * values[3]) / 100;
        if (Math.abs(formula - index) <= 3) { selected = candidate; break; }
      }
      if (!selected) {
        // Waves 38/39 place Australian Government don't know immediately
        // BEFORE its label, while all other categories and the index follow.
        const before = [...table.slice(0, entity.start).matchAll(/(\d+)%/g)].at(-1);
        const values = before ? [...firstFive, Number(before[1])] : [];
        const total = values.reduce((a, b) => a + b, 0);
        if (before && total >= 95 && total <= 105) {
          let index = null;
          for (const match of afterFive.matchAll(/(?<![\w%.-])(\d{1,3})(?![\w%.-])/g)) {
            if (afterFive.slice(0, match.index).trimEnd().endsWith(":")) continue;
            index = Number(match[1]);
            break;
          }
          if (index != null) {
            const candidate = { values, index };
            fallback ||= candidate;
            const formula = (100 * values[0] + 75 * values[1] + 50 * values[2] + 25 * values[3]) / 100;
            if (Math.abs(formula - index) <= 3) selected = candidate;
          }
        }
      }
      if (selected) break;
    }
    selected ||= fallback;
    const values = selected?.values || [];
    return {
      key: entity.key, label: entity.label,
      ratings: values.length === 6 ? { veryGood: values[0], good: values[1], average: values[2], poor: values[3], veryPoor: values[4] } : null,
      excludedShares: values.length === 6 ? { dontKnow: values[5] } : null,
      index: selected?.index ?? null,
    };
  });
  const legend = page.match(/(Very Good)\s+(Good)\s+(Average)\s+(Poor)\s+(Very Poor)\s+(Don't Know)/i);
  return { rows, options: legend ? legend.slice(1) : [] };
}

function parseDirection(page) {
  if (!page.includes("Direction of organisations and groups in Australia") || !/Neither right nor wrong direction/.test(page)) throw new Error("direction rating chart absent");
  const table = collapse(page.slice(page.indexOf("Direction of organisations and groups in Australia"), page.search(/Significantly higher than the national|Q\. Do you think/)));
  const entities = [
    { key: "localCommunity", label: "Your local community", re: /Your local community/g },
    { key: "personalSituation", label: "Your own personal situation", re: /Your own personal(?: situation)?/g },
    { key: "businessAndIndustry", label: "Business and industry in Australia", re: /Business and industry(?: in Australia)?/g },
    { key: "stateEconomy", label: null, re: /Your [Ss]tate or [Tt]erritory(?: economy)?/g },
    { key: "nationalEconomy", label: "National economy", re: /National economy/g },
  ];
  const found = entities.flatMap((entity) => [...table.matchAll(entity.re)].map((match) => ({ ...entity,
    label: entity.label || (match[0].endsWith("economy") ? match[0] : `${match[0]} economy`),
    start: match.index, end: match.index + match[0].length }))).sort((a, b) => a.start - b.start);
  const rows = found.map((entity, i) => {
    const end = i + 1 < found.length ? found[i + 1].start : table.indexOf("Right direction", entity.end);
    const rest = table.slice(entity.end, end > entity.end ? end : undefined);
    // Nets can be emitted before or after the four ratings when the PDF's
    // right-hand commentary column wraps. Match the category run first and
    // then reconcile any nearby signed net, including printed <0.5 forms.
    const runs = [...rest.matchAll(/(?=((\d+)%\s*(\d+)%\s*(\d+)%\s*(\d+)%))/g)]
      .map((m) => m.slice(2, 6).map(Number))
      .filter((values) => {
        const sum = values.reduce((a, b) => a + b, 0);
        return sum >= 95 && sum <= 105;
      });
    const netTokens = [...rest.matchAll(/(?<![\w$%])([+-][<>]?[+-]?\d+(?:\.\d+)?|[<>][+-]?\d+(?:\.\d+)?)(?![\w%])/g)]
      .map((m) => m[1]);
    let values = [], netLabel = null;
    for (const candidate of runs) {
      const diff = candidate[0] - candidate[2];
      netLabel = netTokens.find((token) => {
        if (/^[+-]?\d+$/.test(token)) return Math.abs(diff - Number(token)) <= 2;
        if (token.includes("0.5")) return Math.abs(diff) <= 1;
        return false;
      }) || null;
      // Zero is occasionally printed without a sign directly beside a row.
      if (!netLabel && /(?:^|\s)0(?:\s|$)/.test(rest) && Math.abs(diff) <= 2) netLabel = "0";
      if (netLabel) { values = candidate; break; }
    }
    const numericNet = netLabel && /^[+-]?\d+$/.test(netLabel) ? Number(netLabel) : null;
    return { key: entity.key, label: entity.label,
      ratings: values.length === 4 ? { right: values[0], neither: values[1], wrong: values[2], unsure: values[3] } : null,
      net: numericNet, netLabel };
  });
  const unsure = page.match(/Not sure\s*\/\s*Don[’']t know/);
  return { rows, options: ["Right direction", "Neither right nor wrong direction", "Wrong direction", unsure ? collapse(unsure[0]) : null].filter(Boolean) };
}

function metadataOf(text, wave) {
  const n = text.match(/n=([\d,]+)\s+Australian adults/i);
  const conducted = text.match(/Conducted\s+(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s*)?(?:–|—|-|\bto\b)\s*(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  const issued = text.match(/Issued:\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  const label = text.match(new RegExp(`JWS Research\\s+[–-]\\s+True Issues\\s+${wave}\\s+[–-]\\s+([A-Z][a-z]+\\s+\\d{4})`));
  const titleCaseMonth = (m) => m ? m[0].toUpperCase() + m.slice(1).toLowerCase() : null;
  const endMonth = conducted && titleCaseMonth(conducted[4]);
  const startMonth = conducted && (conducted[2] ? titleCaseMonth(conducted[2]) : endMonth);
  return {
    waveLabel: label?.[1] || null,
    sample: n ? Number(n[1].replace(/,/g, "")) : null,
    methodologyLabel: n ? collapse(n[0]) : null,
    dateStart: conducted ? isoDate(Number(conducted[5]), MONTH[startMonth], Number(conducted[1])) : null,
    date: conducted ? isoDate(Number(conducted[5]), MONTH[endMonth], Number(conducted[3])) : null,
    fieldworkLabel: conducted ? collapse(conducted[0]) : null,
    issuedDate: issued ? isoDate(Number(issued[3]), MONTH[titleCaseMonth(issued[2])], Number(issued[1])) : null,
    issuedLabel: issued ? collapse(issued[0]) : null,
  };
}

export function parseWave(text, wave) {
  const pages = text.split("\f");
  const errors = [];
  const pick = (test, name) => {
    const found = pages.filter(test);
    if (found.length !== 1) errors.push(`${name}: expected one chart page, found ${found.length}`);
    return found[0] || null;
  };
  const saliencePage = (prompted) => pick((p) => p.includes("Most important issues the Australian Government should focus on") && (prompted ? /\(Top 5 most important[^\n]*prompted\)/.test(p) : /\(Up to 3 issues[^\n]*unprompted/.test(p)), prompted ? "promptedTopFive" : "unpromptedTopThree");
  const unpromptedPage = saliencePage(false), promptedPage = saliencePage(true);
  const governmentPage = pick((p) => p.includes("Australian Government performance on issues") && /\(Performance index/.test(p), "governmentIssuePerformance");
  const organisationPage = pick((p) => p.includes("Performance of organisations and groups in Australia") && /Very Good/i.test(p) && !/index score trend/i.test(p), "organisationPerformance");
  const directionPage = pick((p) => p.includes("Direction of organisations and groups in Australia") && /Neither right nor wrong direction/.test(p) && !/Net direction trend/i.test(p), "direction");
  const safe = (name, fn) => {
    try { return fn(); } catch (error) { errors.push(`${name}: ${error.message}`); return null; }
  };
  const unpromptedRows = unpromptedPage ? safe("unpromptedTopThree", () => parseSalienceTable(unpromptedPage, "unprompted")) : [];
  const promptedRows = promptedPage ? safe("promptedTopFive", () => parseSalienceTable(promptedPage, "prompted")) : [];
  const governmentRows = governmentPage ? safe("governmentIssuePerformance", () => parseGovernmentPerformance(governmentPage)) : [];
  const organisation = organisationPage ? safe("organisationPerformance", () => parseOrganisationPerformance(organisationPage)) : null;
  const direction = directionPage ? safe("direction", () => parseDirection(directionPage)) : null;
  const families = {
    unpromptedTopThree: {
      status: unpromptedRows?.length ? "read" : "unreadable", selection: "unprompted, up to three", question: unpromptedPage ? questionOf(unpromptedPage) : null,
      options: null, rows: unpromptedRows || [],
    },
    promptedTopFive: {
      status: promptedRows?.length ? "read" : "unreadable", selection: "prompted list, select five", question: promptedPage ? questionOf(promptedPage) : null,
      options: (promptedRows || []).map((r) => r.label), rows: promptedRows || [],
    },
    governmentIssuePerformance: {
      status: governmentRows?.length ? "read" : "unreadable", measure: "printed performance index (0–100), calculated from very good/good/average/poor/very poor with don't know excluded", question: governmentPage ? questionOf(governmentPage) : null,
      printedRatingsPerIssue: false, rows: governmentRows || [],
    },
    organisationPerformance: {
      status: organisation?.rows.every((r) => r.ratings && r.index != null) ? "read" : "unreadable", measure: "printed category shares and performance index", question: organisationPage ? questionOf(organisationPage) : null,
      printedOptions: organisation?.options || [], excludedFromIndex: ["Don't Know"],
      rows: organisation?.rows || [],
    },
    direction: {
      status: direction?.rows.every((r) => r.ratings && r.netLabel != null) ? "read" : "unreadable", question: directionPage ? questionOf(directionPage) : null,
      printedOptions: direction?.options || [], rows: direction?.rows || [],
    },
  };
  const expectedMinimum = { unpromptedTopThree: 5, promptedTopFive: 15, governmentIssuePerformance: 15, organisationPerformance: 4, direction: 5 };
  for (const [name, minimum] of Object.entries(expectedMinimum)) {
    if ((families[name].rows?.length || 0) < minimum) errors.push(`${name}: only ${families[name].rows?.length || 0} rows (expected at least ${minimum})`);
  }
  for (const name of ["unpromptedTopThree", "promptedTopFive"]) for (const row of families[name].rows) {
    if (!Number.isFinite(row.share) || row.share < 0 || row.share > 100) errors.push(`${name}: ${row.label || "unlabelled row"} has no readable current share`);
  }
  for (const row of families.governmentIssuePerformance.rows) {
    if (!Number.isFinite(row.index) || row.index < 0 || row.index > 100) errors.push(`governmentIssuePerformance: ${row.label || "unlabelled row"} has no readable index`);
  }
  for (const name of ["organisationPerformance", "direction"]) for (const row of families[name].rows) {
    if (!row.ratings || (name === "organisationPerformance" ? !row.excludedShares || row.index == null : row.netLabel == null)) errors.push(`${name}: ${row.label} has missing ratings, excluded share or summary score`);
    if (!families[name].question) errors.push(`${name}: printed question not found`);
  }
  for (const [name, count] of [["unpromptedTopThree", null], ["promptedTopFive", 15], ["governmentIssuePerformance", null], ["organisationPerformance", 6], ["direction", 4]]) {
    if (!families[name].question) errors.push(`${name}: printed question not found`);
    if (count != null && families[name].printedOptions?.length !== count && name !== "promptedTopFive") errors.push(`${name}: expected ${count} printed answer options, found ${families[name].printedOptions?.length || 0}`);
  }
  if (families.promptedTopFive.options.length < 15) errors.push(`promptedTopFive: only ${families.promptedTopFive.options.length} printed issue options`);
  const metadata = metadataOf(text, wave);
  for (const field of ["waveLabel", "sample", "dateStart", "date", "issuedDate"]) if (metadata[field] == null) errors.push(`metadata: printed ${field} not found`);
  return { wave, ...metadata, families, parseErrors: errors };
}

export function buildJwsData(index, src = DEFAULT_SRC) {
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.sources)) throw new Error("unsupported JWS source index");
  const errors = index.errors || [];
  const waves = [];
  for (const source of [...index.sources].sort((a, b) => a.wave - b.wave)) {
    const pdfPath = path.join(src, source.pdf);
    const textPath = path.join(src, source.text);
    const pdf = fs.readFileSync(pdfPath);
    const textBuf = fs.readFileSync(textPath);
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${source.pdf}: cached source is not a PDF`);
    if (sha256(pdf) !== source.sha256) throw new Error(`${source.pdf}: PDF hash does not match source index`);
    if (sha256(textBuf) !== source.textSha256) throw new Error(`${source.text}: text hash does not match source index`);
    const parsed = parseWave(textBuf.toString("utf8"), source.wave);
    waves.push({
      ...parsed,
      source: {
        mediaId: source.mediaId, mediaDate: source.mediaDate, title: stripTitle(source.title || ""), url: source.sourceUrl,
        pdf: `.build/jws-issues-src/${source.pdf}`, text: `.build/jws-issues-src/${source.text}`,
        bytes: source.pdfBytes, sha256: source.sha256, textSha256: source.textSha256,
      },
    });
  }
  const present = new Set(waves.map((w) => w.wave));
  const sourceGaps = [];
  for (let wave = 1; wave <= LAST_CORE_WAVE; wave++) {
    if (present.has(wave)) continue;
    const early = wave < FIRST_CORE_WAVE;
    const pinned = CORE_SOURCES.find((s) => s.wave === wave);
    sourceGaps.push({
      wave,
      knownDateLabel: early ? EARLY_WAVE_LABELS[wave - 1] : CORE_WAVE_LABELS[wave - FIRST_CORE_WAVE],
      reason: early ? "no per-wave PDF is exposed in the current WordPress True Issues media archive" : "selected current media record exists, but its PDF request failed",
      sourceUrl: pinned?.sourceUrl || null,
      mediaId: pinned?.mediaId || null,
      sourceError: errors.find((e) => e.startsWith(`wave ${wave}:`)) || null,
      observations: null,
      note: "No values recovered from historical line-chart pixels; categories not printed in a surviving table remain unknown, never zero.",
    });
  }
  const parseErrors = waves.flatMap((w) => w.parseErrors.map((e) => `wave ${w.wave}: ${e}`));
  const sourceReconciliationWarnings = waves.flatMap((w) => w.families.organisationPerformance.rows.flatMap((row) => {
    const r = row.ratings;
    const fromRoundedShares = Math.round(100 * r.veryGood + 75 * r.good + 50 * r.average + 25 * r.poor) / 100;
    const residual = Math.round((row.index - fromRoundedShares) * 100) / 100;
    return Math.abs(residual) > 1.25 ? [{ wave: w.wave, row: row.label, printedIndex: row.index,
      indexFromPrintedRoundedShares: fromRoundedShares, residual,
      note: "Both the printed shares and printed index are retained verbatim; their published rounded values do not fully reconcile." }] : [];
  }));
  const familyNames = ["unpromptedTopThree", "promptedTopFive", "governmentIssuePerformance", "organisationPerformance", "direction"];
  return {
    schemaVersion: 1,
    _about: "JWS Research True Issues core-wave public-opinion archive. Generated offline from verified PDFs and their pdftotext -layout twins. Unprompted top-three, prompted select-five, government issue performance indexes, organisation performance ratings and direction answers are separate question families; labels and wording remain per-wave because categories change. Organisation category shares exclude don't know from the stored ratings object; the printed don't-know share is retained separately as excludedShares.dontKnow. The issue-level government chart prints only an index, not its five underlying shares. This store is not voting intention, is not joined to polls.json and feeds no aggregate or UI.",
    pollster: "JWS Research",
    series: "True Issues",
    coverage: {
      status: sourceGaps.length || parseErrors.length ? "partial" : "complete",
      expectedCoreRange: { first: FIRST_CORE_WAVE, last: LAST_CORE_WAVE, waves: LAST_CORE_WAVE - FIRST_CORE_WAVE + 1 },
      parsedCoreWaves: waves.length,
      parsedCoreWaveNumbers: waves.map((w) => w.wave),
      unavailableCoreWaves: sourceGaps.filter((g) => g.wave >= FIRST_CORE_WAVE).map((g) => g.wave),
      unavailableEarlyWaves: sourceGaps.filter((g) => g.wave < FIRST_CORE_WAVE).map((g) => g.wave),
      totalSourceGaps: sourceGaps.length,
      liveMediaRecordsAtFetch: index.mediaRecords,
      sourceErrorCount: errors.length,
      parseErrorCount: parseErrors.length,
      reconciliationWarningCount: sourceReconciliationWarnings.length,
      familyWaveCounts: Object.fromEntries(familyNames.map((name) => [name, waves.filter((w) => w.families[name].status === "read").length])),
      note: "Coverage describes readable per-wave core PDFs actually cached and parsed, not the full 43-wave historical series.",
    },
    sourceErrors: [...errors],
    parseErrors,
    sourceReconciliationWarnings,
    sourceGaps,
    waves,
  };
}

function readCachedSources(src) {
  const file = path.join(src, "source-index.json");
  if (!fs.existsSync(file)) throw new Error(`missing ${file}; run --fetch-sources first`);
  const index = JSON.parse(fs.readFileSync(file, "utf8"));
  if (index.schemaVersion !== 1 || !Array.isArray(index.sources)) throw new Error(`${file}: unsupported source-index shape`);
  return index;
}

async function fetchSources(src) {
  fs.mkdirSync(src, { recursive: true });
  const mediaBytes = await getBuffer(MEDIA_URL);
  const media = JSON.parse(mediaBytes.toString("utf8"));
  if (!Array.isArray(media)) throw new Error("WordPress media response is not an array");
  const byId = new Map(media.map((m) => [m.id, m]));
  const sources = [], errors = [];
  for (const pinned of CORE_SOURCES) {
    const live = byId.get(pinned.mediaId);
    if (!live) {
      errors.push(`wave ${pinned.wave}: selected media id ${pinned.mediaId} is absent from the live True Issues index`);
      continue;
    }
    if (live.source_url !== pinned.sourceUrl || live.date !== pinned.mediaDate) {
      errors.push(`wave ${pinned.wave}: selected media id ${pinned.mediaId} moved from ${pinned.sourceUrl} (${pinned.mediaDate}) to ${live.source_url} (${live.date})`);
      continue;
    }
    const pdf = path.join(src, `wave-${pinned.wave}.pdf`);
    const txt = path.join(src, `wave-${pinned.wave}.txt`);
    let bytes;
    try {
      bytes = fs.existsSync(pdf) ? fs.readFileSync(pdf) : await getBuffer(pinned.sourceUrl);
      if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`not a PDF (${bytes.length} bytes)`);
      // pdftotext reads a path, so the verified bytes must land before conversion.
      atomic(pdf, bytes);
      const text = pdfToText(pdf, pinned.wave);
      if (!text.trim()) throw new Error("pdftotext produced an empty document");
      atomic(txt, text);
      sources.push({ ...pinned, slug: live.slug, title: live.title?.rendered || "", pdf: path.basename(pdf), text: path.basename(txt),
        pdfBytes: bytes.length, sha256: sha256(bytes), textSha256: sha256(Buffer.from(text)) });
    } catch (error) {
      errors.push(`wave ${pinned.wave}: ${error.message}`);
    }
  }
  // This index is evidence about discovery, not generated data. Fetch time is
  // kept out so an unchanged re-fetch is byte-idempotent too.
  const index = {
    schemaVersion: 1,
    mediaUrl: MEDIA_URL,
    mediaRecords: media.length,
    selectionRule: "pinned later/current core-wave uploads; special releases, methodology statements and images excluded",
    sources: sources.sort((a, b) => a.wave - b.wave),
    errors,
  };
  atomic(path.join(src, "source-index.json"), JSON.stringify(index, null, 2) + "\n");
  return index;
}

async function main() {
  const args = process.argv.slice(2);
  const src = process.env.JWS_SRC_DIR ? path.resolve(process.env.JWS_SRC_DIR) : DEFAULT_SRC;
  if (args.includes("--fetch-sources")) {
    const index = await fetchSources(src);
    console.log("JWS_SOURCES " + JSON.stringify({ cached: index.sources.length, errors: index.errors }));
    if (index.errors.length) process.exitCode = 2;
    return;
  }
  if (args.includes("--offline") || args.includes("--check")) {
    const check = args.includes("--check");
    const out = process.env.JWS_OUT ? path.resolve(process.env.JWS_OUT) : DEFAULT_OUT;
    const data = buildJwsData(readCachedSources(src), src);
    const serialised = JSON.stringify(data, null, 2) + "\n";
    const previous = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
    const changed = previous !== serialised;
    if (changed && !check) atomic(out, serialised);
    console.log("JWS_STATUS " + JSON.stringify({
      changed, check, cached: data.coverage.parsedCoreWaves,
      sourceGaps: data.coverage.totalSourceGaps, sourceErrors: data.coverage.sourceErrorCount,
      parseErrors: data.parseErrors, status: data.coverage.status,
    }));
    if (data.parseErrors.length || (check && changed)) process.exitCode = 2;
    return;
  }
  throw new Error("usage: node .build/extract-jws-issues.mjs --fetch-sources | --offline | --check");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
