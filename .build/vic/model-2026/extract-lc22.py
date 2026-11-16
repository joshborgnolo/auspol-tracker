#!/usr/bin/env python3
"""Each party's 2022 Legislative Council vote in every Assembly district.

The VEC's 2022 upper-house count is published per region with a DISTRICT TOTAL row for each of the region's
eleven districts (the mirror at .build/map/src/vic22/xlc/<region>-votes.xls, the files build_vic22_lc.py
reads). Most minor parties stood in few Assembly districts in 2022 but in every Council region, so their
Council vote is the only measure of where their voters are: the Victorian model (vic-inputs.mjs) starts a
party from it wherever the party did not stand for the Assembly in 2022.

Writes data/vic-lc-2022-by-district.json: { district: { formal, groups: { party name: votes } } }.
Ungrouped and unnamed groups are filed "Ungrouped / independent". Usage: python3 extract-lc22.py
"""
import json, os, re, sys, warnings
warnings.simplefilter("ignore")
import xlrd  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
XLC = os.path.join(ROOT, ".build", "map", "src", "vic22", "xlc")
REGIONS = ["eastern-victoria", "north-eastern-metropolitan", "northern-metropolitan", "northern-victoria",
           "south-eastern-metropolitan", "southern-metropolitan", "western-metropolitan", "western-victoria"]
out = {}
for slug in REGIONS:
    sh = xlrd.open_workbook(os.path.join(XLC, f"{slug}-votes.xls"), logfile=open(os.devnull, "w")).sheets()[0]
    r = 0
    while r < sh.nrows:
        a = str(sh.cell_value(r, 0)).strip()
        m = re.match(r"^(.*) District$", a)
        if not m: r += 1; continue
        dist = m.group(1)
        # group TOTAL columns of this block, named by the party on the group's first column
        cols = {}; name = None
        for c in range(1, sh.ncols):
            h = str(sh.cell_value(r, c)).strip()
            if not h: continue
            parts = [p.strip() for p in h.split("\n")]
            if parts[-1] == "TOTAL" and parts[0].startswith("Group"):
                cols[c] = name or "Ungrouped / independent"; name = None
            elif parts[0].startswith("Group") and name is None:
                name = parts[1] if len(parts) >= 3 else None      # "Group E\nATL" has no party name
            elif parts[0] in ("Ungrouped",) and parts[-1] == "TOTAL":
                cols[c] = "Ungrouped / independent"
        tot_formal = None
        for c in range(1, sh.ncols):
            if str(sh.cell_value(r, c)).replace("\n", " ").strip() in ("Total Votes", "Total Formal", "Total Formal Votes"): tot_formal = c
        rr = r + 1
        while rr < sh.nrows and str(sh.cell_value(rr, 0)).strip() != "DISTRICT TOTAL": rr += 1
        if rr >= sh.nrows: raise SystemExit(f"no DISTRICT TOTAL for {dist}")
        groups = {}
        for c, nm in cols.items():
            v = sh.cell_value(rr, c); v = int(v) if v != "" else 0
            groups[nm] = groups.get(nm, 0) + v
        formal = sum(groups.values())
        out[dist] = {"formal": formal, "groups": dict(sorted(groups.items(), key=lambda kv: -kv[1]))}
        r = rr + 1
if len(out) != 88: raise SystemExit(f"{len(out)} districts, expected 88")
tot = {}
for d in out.values():
    for k, v in d["groups"].items(): tot[k] = tot.get(k, 0) + v
T = sum(tot.values())
doc = {"_about": "extract-lc22.py: first-preference votes for each Legislative Council group at the 2022 Victorian election, by Assembly district (the DISTRICT TOTAL rows of the VEC's region workbooks, .build/map/src/vic22/xlc). formal = the groups' sum.",
       "source": "Victorian Electoral Commission, State Election 2022, Region Votes Received (printed 14 December 2022)",
       "statewide": {k: round(100 * v / T, 2) for k, v in sorted(tot.items(), key=lambda kv: -kv[1])}, "formal": T, "districts": dict(sorted(out.items()))}
json.dump(doc, open(os.path.join(ROOT, "data", "vic-lc-2022-by-district.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"88 districts, {T:,} formal Council votes")
for k, v in doc["statewide"].items(): print(f"  {v:6.2f}  {k}")
