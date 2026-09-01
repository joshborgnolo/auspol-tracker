/* ====================================================================
   NEXT EXPECTED POLLS – the calibration log

   The projection (assets/np-project.js) makes a falsifiable claim every day:
   this house's next wave lands on that date ± that window. This script is
   the scoreboard for those claims. It has no opinions of its own about
   cadence; it watches the SHIPPED projection the same way the sim does -
   eval'd against the built data asset - and writes two artifacts:

     data/np-calibration.jsonl - one line per DISTINCT live prediction
     data/np-report.md         - the resolved ledger, regenerated

   What counts as a prediction: each house's FIRST projected row (ahead ===
   0) - the slot the panel and ticker are actually showing. Later rows of a
   house's walk are the same bet extended, not new ones. A prediction's
   identity is the tuple (pollster, release, winHalf, rolled); everything
   else on the row (inDays, overdue, missed) ticks with the clock and must
   NOT trigger a log line, so append-if-changed compares that tuple, never
   the row. A new line means the bet itself moved: a wave landed and the
   anchor re-projected, a skip confirmation rolled the slot, or the cadence
   estimate was re-measured.

   How a tuple resolves, oldest to newest per house:

     skip   - the slot it named was confirmed ABSENT at the publisher
              (pollsterRules.skippedSlots for a dated slot day, or
              skippedMonths for a calendar-month slot). Not a failure of the
              claim and not a success of it: it is excluded from the hit
              rate's numerator AND denominator, by agreement.
     hit    - the house's next recorded wave (the first wave after the
              tuple's anchor) was PUBLISHED inside [release-winHalf,
              release+winHalf], the window the ± claims.
     miss   - that wave was published outside the window. The report note
              says early or late and by how much.
     void   - the tuple was superseded without publisher evidence: no wave
              landed and no skip covers the slot (a data correction, a
              cadence re-measurement, a house dropping out of the cadence
              table, or the resolution wave carrying no recorded published
              date). Excluded like a skip, but listed with its reason -
              silent exclusions are how a scoreboard lies.
     pending- the house's latest tuple: the live open bet.

   Rolled tuples (the slot a confirmed skip moved the bet onto) are real
   predictions and resolve on the same rules, but they are tallied in their
   own bucket: they start life inside special circumstances, and mixing
   them with primary slots would grade two different tests as one.

   Usage:   node .build/newtracker/np-score.mjs            append new tuples
            node .build/newtracker/np-score.mjs --report   rewrite the report
   Both are idempotent and exit 0 on the happy path (1 = internal error).
   Scheduled daily by .github/workflows/np-score.yml. Env seams for testing:
   NP_SCORE_JSONL / NP_SCORE_REPORT / NP_SCORE_POLLS override the three
   artifact/source paths.
   ==================================================================== */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* fileURLToPath, not URL.pathname: the working copy's path may carry spaces,
   and pathname leaves them percent-encoded */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const JSONL = process.env.NP_SCORE_JSONL || ROOT + "data/np-calibration.jsonl";
const REPORT = process.env.NP_SCORE_REPORT || ROOT + "data/np-report.md";
const POLLS = process.env.NP_SCORE_POLLS || ROOT + "data/polls.json";
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/* The projection exactly as the page runs it: the built data asset, then the
   shipped np-project.js, eval'd - the same harness as sim-next-polls.mjs. */
const assetSrc = readFileSync(new URL("./assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", import.meta.url), "utf8");
global.window = {};
eval(assetSrc);
const D = window.AUSPOL;
window.AP = { D };
eval(readFileSync(new URL("./assets/np-project.js", import.meta.url), "utf8"));

const sydNow = () => {
  try {
    const p = {};
    for (const x of new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date())) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day} ${String(+p.hour % 24).padStart(2, "0")}:${p.minute}`;
  } catch (e) {
    return new Date().toISOString().replace("T", " ").slice(0, 16);
  }
};

function liveTuples() {
  const { rows } = window.AP.nextPolls();
  const out = {};
  for (const r of rows) {
    if (r.ahead !== 0 || out[r.pollster]) continue;
    /* loose rows key their own window differently (release is the window's
       midpoint), but [release-winHalf, release+winHalf] recovers open/close
       for every form - dated, loose, calMonth - so one shape serves all. */
    out[r.pollster] = {
      ts: new Date().toISOString(),
      syd: sydNow(),
      pollster: r.pollster,
      kind: r.calMonth ? "calMonth" : r.loose ? "loose" : "dated",
      anchor: r.last,
      release: iso(r.release),
      open: iso(r.release - (r.winHalf || 0) * DAY),
      close: iso(r.release + (r.winHalf || 0) * DAY),
      winHalf: r.winHalf || 0,
      rolled: !!r.rolled,
      ahead: 0,
    };
  }
  return out;
}

function readLog() {
  if (!existsSync(JSONL)) return [];
  return readFileSync(JSONL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function cmdLog() {
  const last = {};
  for (const rec of readLog()) last[rec.pollster] = rec;
  const live = liveTuples();
  let appended = 0;
  const names = [];
  for (const [pollster, t] of Object.entries(live)) {
    const prev = last[pollster];
    const changed = !prev || prev.release !== t.release || prev.winHalf !== t.winHalf || prev.rolled !== t.rolled;
    if (!changed) continue;
    appendFileSync(JSONL, JSON.stringify(t) + "\n");
    appended++;
    names.push(pollster);
  }
  console.log(appended
    ? `np-score: appended ${appended} tuple(s) [${names.join(", ")}] to ${JSONL}`
    : `np-score: no tuple changes across ${Object.keys(live).length} houses`);
}

/* --- resolution -------------------------------------------------------- */

function cmdReport() {
  const polls = JSON.parse(readFileSync(POLLS, "utf8"));
  const rules = polls.pollsterRules || {};
  /* the house's wave list, oldest first (as polls.json keeps it); each wave
     keys by recorded published date when present, fieldwork end otherwise -
     the same key gen-data builds the cadence anchor from */
  const wavesOf = (name) => (polls.polls || [])
    .filter((p) => p.pollster === name)
    .map((p) => ({ date: p.date, pub: (p.published || "").slice(0, 10) || null }));
  const keyOf = (w) => w.pub || w.date;
  const cadenceNames = new Set((D.pollCadence || []).map((c) => c.pollster));

  const entries = readLog();
  const byHouse = {};
  for (const e of entries) (byHouse[e.pollster] ||= []).push(e);
  for (const list of Object.values(byHouse)) list.sort((a, b) => (a.ts < b.ts ? -1 : 1));

  const fmt = (isoDate) => {
    const d = new Date(isoDate + "T00:00:00Z");
    return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.getUTCDate()} ` +
      `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
  };

  const resolved = [];
  for (const [house, list] of Object.entries(byHouse)) {
    const waves = wavesOf(house);
    const skips = rules[house]?.skippedSlots || [];
    const skipMonths = rules[house]?.skippedMonths || [];
    list.forEach((e, i) => {
      const next = list[i + 1];
      const r = { ...e, house };
      if (!next) {
        /* the live bet - unless the house left the cadence table since,
           which ends it void no matter how fresh it is */
        if (!cadenceNames.has(house)) {
          resolved.push({ ...r, verdict: "void", note: "house left the cadence table (stopped?)" });
        } else {
          resolved.push({ ...r, verdict: "pending", note: `open; window closes ${fmt(r.close)}` });
        }
        return;
      }
      /* a slot the agent confirmed absent never was a contestable miss */
      const slotYm = e.release.slice(0, 7);
      if (skips.includes(e.release) || skipMonths.includes(slotYm)) {
        resolved.push({ ...r, verdict: "skip", note: `confirmed absent at the publisher${e.kind === "calMonth" ? ` (${slotYm})` : ""}` });
        return;
      }
      /* where the chain went after this tuple: the successor's anchor must
         BE the recorded key of a wave later than this tuple's anchor - else
         the chain moved without publisher evidence */
      const anchorIdx = waves.findLastIndex((w) => keyOf(w) === e.anchor);
      const anchorOk = anchorIdx >= 0 &&
        waves.slice(anchorIdx + 1).some((w) => keyOf(w) === next.anchor);
      if (!anchorOk) {
        resolved.push({
          ...r, verdict: "void",
          note: anchorIdx < 0
            ? `anchor ${e.anchor} matches no recorded wave - data corrected?`
            : "superseded with no wave and no skip - estimate re-measured?",
        });
        return;
      }
      const wave = waves[anchorIdx + 1];
      if (!wave.pub) {
        resolved.push({ ...r, verdict: "void", note: `resolving wave (fieldwork end ${fmt(wave.date)}) has no recorded publication date` });
        return;
      }
      const inWin = wave.pub >= e.open && wave.pub <= e.close;
      const off = Math.round((Date.parse(wave.pub) - Date.parse(e.release)) / DAY);
      resolved.push({
        ...r, verdict: inWin ? "hit" : "miss", wave,
        note: inWin ? `published ${fmt(wave.pub)}` : `published ${fmt(wave.pub)} (${off > 0 ? `${off}d late` : `${-off}d early`})`,
      });
    });
  }

  /* --- tallies ---------------------------------------------------------- */
  const tally = (rows) => {
    const h = rows.filter((r) => r.verdict === "hit").length;
    const m = rows.filter((r) => r.verdict === "miss").length;
    return { h, m, rate: h + m ? Math.round((100 * h) / (h + m)) : null };
  };
  const primary = resolved.filter((r) => !r.rolled);
  const rolled = resolved.filter((r) => r.rolled);
  const houses = [...new Set(resolved.map((r) => r.house))];
  const counts = (v) => resolved.filter((r) => r.verdict === v).length;

  const rateCell = (rows) => {
    const { h, m, rate } = tally(rows);
    return rate == null ? "–" : `${h}/${h + m} (${rate}%)`;
  };
  const line = [];
  line.push("# Next expected polls - calibration");
  line.push("");
  line.push("Regenerated by `.build/newtracker/np-score.mjs --report` from `data/np-calibration.jsonl` - do not edit by hand.");
  line.push("");
  line.push("Each house's first projected slot is logged when its identity changes (release, window, rolled). " +
    "A **hit** published inside the window, a **miss** outside it; a publisher-confirmed absence (**skip**) and a " +
    "data-side supersede (**void**) count neither for nor against. Rolled slots (moved by a confirmed skip) tally separately. " +
    "The newest entry per house is the live **pending** bet.");
  line.push("");
  line.push(`Last run: ${new Date().toISOString().slice(0, 16).replace("T", " ")}Z (${sydNow()} Sydney)`);
  line.push("");
  line.push("## Hit rate");
  line.push("");
  line.push("| house | primary slots | rolled slots | skip | void |");
  line.push("|---|---|---|---|---|");
  for (const h of houses) {
    const rows = resolved.filter((r) => r.house === h);
    line.push(`| ${h} | ${rateCell(rows.filter((r) => !r.rolled))} | ${rateCell(rows.filter((r) => r.rolled))} | ${rows.filter((r) => r.verdict === "skip").length || "–"} | ${rows.filter((r) => r.verdict === "void").length || "–"} |`);
  }
  const P = tally(primary), R = tally(rolled);
  line.push("");
  line.push(`**Overall: ${P.h + P.m ? `${P.h}/${P.h + P.m} (${P.rate}%)` : "no resolved predictions yet"} primary` +
    `${R.h + R.m ? ` · ${R.h}/${R.h + R.m} rolled` : ""}` +
    `${counts("skip") ? ` · ${counts("skip")} skip` : ""}${counts("void") ? ` · ${counts("void")} void` : ""}` +
    ` · ${counts("pending")} pending**`);
  line.push("");
  line.push("## Ledger");
  line.push("");
  line.push("| logged (Sydney) | house | slot | window | rolled | verdict |");
  line.push("|---|---|---|---|---|---|");
  for (const r of resolved) {
    line.push(`| ${r.syd} | ${r.house} | ${r.kind === "calMonth" ? r.release.slice(0, 7) + " (month)" : fmt(r.release)} | ${fmt(r.open)} - ${fmt(r.close)} | ${r.rolled ? "yes" : ""} | ${r.verdict}${r.note ? ` - ${r.note}` : ""} |`);
  }
  line.push("");
  writeFileSync(REPORT, line.join("\n"));
  console.log(`np-score: wrote ${REPORT} (${resolved.length} tuples; ${P.h}/${P.h + P.m} primary, ${counts("pending")} pending)`);
}

try {
  if (process.argv[2] === "--report") cmdReport();
  else cmdLog();
} catch (e) {
  console.error("np-score: " + (e && e.message ? e.message : e));
  process.exit(1);
}
