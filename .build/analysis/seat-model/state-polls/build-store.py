#!/usr/bin/env python3
"""State elections' final-month polls and results, from Wikipedia's polling tables.

  python3 build-store.py <dir of article sources>      (each saved as <Title>.wiki via ?action=raw)

For every state election listed, the article's voting-intention table is read (wiki_polls.py): each poll's
fieldwork end date, firm and primary votes, and the election's own row. Kept: polls ending in the 35 days
before polling day (exit polls dropped) - the federal calibration's "final month" - with Labor, the Coalition
(Liberal + National where printed apart), the Greens and One Nation where the table carries it.
NSW 2015 and 2019 have no table on Wikipedia and are left out; the four oldest tables are Newspoll's alone.
Results: the table's election row where it has one, else the article's infobox (noted per election);
calibrate-state-polls.mjs prefers the repo's own district counts where a store exists.
Writes data/state-election-final-polls.json."""
import sys, os, json, datetime, re
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import wiki_polls as wp  # noqa: E402
SRC = sys.argv[1]
EL = [("vic", "2010-11-27", "2010_Victorian_state_election"), ("vic", "2014-11-29", "2014_Victorian_state_election"), ("vic", "2018-11-24", "2018_Victorian_state_election"), ("vic", "2022-11-26", "2022_Victorian_state_election"),
      ("qld", "2012-03-24", "2012_Queensland_state_election"), ("qld", "2015-01-31", "2015_Queensland_state_election"), ("qld", "2017-11-25", "2017_Queensland_state_election"), ("qld", "2020-10-31", "2020_Queensland_state_election"), ("qld", "2024-10-26", "2024_Queensland_state_election"),
      ("nsw", "2011-03-26", "2011_New_South_Wales_state_election"), ("nsw", "2023-03-25", "2023_New_South_Wales_state_election"),
      ("wa", "2013-03-09", "2013_Western_Australian_state_election"), ("wa", "2017-03-11", "2017_Western_Australian_state_election"), ("wa", "2021-03-13", "2021_Western_Australian_state_election"), ("wa", "2025-03-08", "2025_Western_Australian_state_election"),
      ("sa", "2014-03-15", "2014_South_Australian_state_election"), ("sa", "2018-03-17", "2018_South_Australian_state_election"), ("sa", "2022-03-19", "2022_South_Australian_state_election"), ("sa", "2026-03-21", "Opinion_polling_for_the_2026_South_Australian_state_election")]
# results the tables do not carry: the articles' infoboxes (first-preference percentages)
INFOBOX = {("nsw", "2011-03-26"): {"alp": 25.55, "lnp": 51.15, "grn": 10.29}, ("wa", "2013-03-09"): {"alp": 33.13, "lnp": 47.10 + 6.05, "grn": 8.40}}
def norm(v, st):
    o = {}
    if "alp" in v: o["alp"] = v["alp"]
    if "lnp" in v: o["lnp"] = v["lnp"]
    elif "lib" in v and st == "sa": o["lnp"] = v["lib"]          # South Australia: the Liberals alone (its Nationals poll under 1%)
    elif "lib" in v and "nat" in v: o["lnp"] = round(v["lib"] + v["nat"], 2)
    if "grn" in v: o["grn"] = v["grn"]
    if "onp" in v: o["onp"] = v["onp"]
    return o
out = []; rows_by = {}
for st, d, f in EL:
    ed = datetime.date.fromisoformat(d)
    cols, polls = wp.parse(open(os.path.join(SRC, f + ".wiki"), encoding="utf8").read(), ed)
    rows_by[(st, d)] = polls
for st, d, f in EL:
    ed = datetime.date.fromisoformat(d); polls = rows_by[(st, d)]
    res = None; rsrc = None
    for (st2, d2), ps in rows_by.items():        # the election's own row, in its own table or the next election's
        if st2 != st: continue
        for p in ps:
            if p["election"] and p["date"] == ed and res is None: res = norm(p["v"], st); rsrc = "polling table election row (" + ("own article" if d2 == d else d2[:4] + " article") + ")"
    if (st, d) in INFOBOX and (res is None or len(res) < 3): res = INFOBOX[(st, d)]; rsrc = "article infobox"
    fin = []
    for p in polls:
        if p["election"] or p["exit"]: continue
        days = (ed - p["date"]).days
        if not (0 <= days < 35): continue
        firm = p["firm"] if re.search(r"[A-Za-z]{3}", p["firm"]) else "Newspoll"
        fin.append({"end": str(p["date"]), "firm": re.sub(r"\s*\(.*$", "", firm).strip(), **norm(p["v"], st)})
    out.append({"st": st, "date": d, "article": f.replace("_", " "), "result": res, "resultSource": rsrc, "polls": fin})
    print(f"{st} {d}: {len(fin)} final-month polls; result {res} [{rsrc}]")
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
doc = {"_about": "build-store.py: state elections' final-month polls (fieldwork ending in the 35 days before polling day) and first-preference results, read from Wikipedia's polling tables (article sources fetched 16 November 2026). lnp = Liberal + National (LNP in Queensland, the Liberals alone in South Australia). NSW 2015 and 2019 have no table there. Used by calibrate-state-polls.mjs for the Victorian model's polling error.",
       "source": "en.wikipedia.org, the articles named per election (?action=raw)", "elections": out}
json.dump(doc, open(os.path.join(ROOT, "data", "state-election-final-polls.json"), "w"), ensure_ascii=False, indent=0)
