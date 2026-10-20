/* Skipped slots v a new rhythm (gen-data CAD_SLOT_TOL / CAD_RHYTHM_RUN),
   through the REAL gen-data and np-project over the record plus synthetic
   Roy Morgan releases. The case that prompted it: Roy Morgan skipped the
   weeks of 5 Oct and 19 Oct 2026, two fortnight gaps in a row. Measured raw
   that turned an eleven-Mondays-in-twelve house into a ±3-day window and,
   had it kept going, a 10.5-day interval it never kept. Pinned:
     - two long gaps in a row are skipped slots: still every 7 days, a dated
       Monday, ±1, the skips counted
     - a third makes it fortnightly outright (14, dated), measured from the
       first gap of the run
     - back to weekly after one skip run stays weekly
   ~2s per scenario. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, runProjection } from "./np-replay.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, "..", "..", "data", "polls.json"), "utf8");
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` - got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

/* the record as it stands, Roy Morgan's last release moved to 12 Oct 2026
   (its real one: 29 Sep -> 12 Oct is the first skip) and `pubs` added after */
function rm(pubs) {
  const D = JSON.parse(SRC);
  const own = D.polls.filter((p) => p.pollster === "Roy Morgan" && p.published);
  const tpl = own.sort((a, b) => (a.published < b.published ? -1 : 1)).at(-1);
  D.polls = D.polls.filter((p) => !(p.pollster === "Roy Morgan" && (p.published || "") > "2026-10-13"));
  for (const pub of pubs) {
    const f = iso(Date.parse(pub) - DAY);
    D.polls.push({ ...tpl, date: f, dateStart: iso(Date.parse(f) - 6 * DAY),
      published: pub + "T16:30", url: tpl.url + "#" + pub });
  }
  const now = Date.parse((pubs.at(-1) || "2026-10-12") + "T20:00:00Z");
  const { cad, rows } = runProjection(D, now);
  const c = cad.find((x) => x.pollster === "Roy Morgan");
  const r = rows.find((x) => x.pollster === "Roy Morgan" && x.ahead === 0);
  return { c, next: r && iso(r.release), win: r && r.winHalf };
}

try {
  let s = rm(["2026-10-26"]);
  eq("two skips in a row: weekly, dated, ±1", [s.c.cadence, s.c.loose, s.c.spread], [7, false, 1]);
  eq("…both skips counted", s.c.slotsSkipped, 2);
  eq("…next is the Monday a week on", [s.next, s.win], ["2026-11-02", 0]);
  eq("…no rhythm change claimed", s.c.rhythmFrom, undefined);

  s = rm(["2026-10-26", "2026-11-09"]);
  eq("three fortnights: every 14 days, dated", [s.c.cadence, s.c.loose], [14, false]);
  eq("…moved from 7, measured from the run's first gap", [s.c.rhythmFrom, s.c.rhythmSince], [7, "2026-09-29"]);
  eq("…next is the Monday a fortnight on", s.next, "2026-11-23");

  s = rm(["2026-10-26", "2026-11-02"]);
  eq("back to weekly after the skips: weekly, dated", [s.c.cadence, s.c.loose, s.c.spread], [7, false, 1]);
  eq("…next is the Monday a week on", s.next, "2026-11-09");
} finally {
  cleanup();
}

console.log(fails ? `\n${fails} FAILED` : "\nslot-rhythm expectations held");
process.exit(fails ? 1 : 0);
