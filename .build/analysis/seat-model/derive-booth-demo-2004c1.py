#!/usr/bin/env python3
"""data/booth-demo-2004-c1.json — the 2006-census (c1) side of the 2004
people-interpolation lane.

Mirrors derive-booth-demo-2011.py's c1-side design against the 2006
census: a booth's demo block is the 2006 Basic Community Profile counts
of the 2006-census collection district the booth's premises sit in
(point-in-polygon against the ABS 1259.0.30.002 per-state CD-2006 shape
packs, the locate ladder derive-booth-seifa-hist.py's interp lane
rides); a division's row is the exact 2006-BCP sum over the CDs
whole-allocated to the 2003-edition division set
(SEIFA machinery's committed seifa-src/cd-2006-ced-2003ed.json,
derive-ced-era-alloc.py) — real headcounts, never averages of booth rows.
The venue coordinates ride each booth's OWN records in
data/booth-seifa-2004.json (6,852 of 8,234 rows carry them — the 2007
poll-book carry — the rest take demo:null, counts.boothsPipMiss; a
booth whose premises sit outside every 2006 CD polygon differs only in
cause, same null).

The Derive reads through derive-booth-demo-2006.py's readers
importlib-side (the 2006 BCP per-state tables ARE the loaders the 2006
measured stores pass through) — this script is a re-driving of that
machinery onto the 2004 boundary set, never a re-implementation. No
income lanes (the repo's income floor stays at the 2013 election; the
2004 store and its c1 counterpart carry no incomeCuts record).

Guards fail loud: booth-set drift vs the venue store's (div, boothId)
pairs, division-name drift, alloc universe drift, national persons
inside the published 2006 census envelope.
Run:  python3 .build/analysis/seat-model/derive-booth-demo-2004c1.py
Test: node .build/analysis/seat-model/test-booth-demo-2001.mjs
"""

import importlib.util
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"


def _lib(name, path):
    spec = importlib.util.spec_from_file_location(name, SM / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


d13 = _lib("d13", "derive-booth-demo-2013.py")
d06 = _lib("d06", "derive-booth-demo-2006.py")
hist = _lib("hist", "derive-booth-seifa-hist.py")
fail, hash16 = d13.fail, d13.hash16

STATE_ORDER = d13.STATE_ORDER
BANDS = d13.BANDS
ALLOC = SM / "seifa-src/cd-2006-ced-2003ed.json"
VENUE = ROOT / "data/booth-seifa-2004.json"
OUT = ROOT / "data/booth-demo-2004-c1.json"


def main():
    people = d06.load_bcp()
    alloc_d = json.loads(ALLOC.read_text())
    alloc = {k: v for k, v in alloc_d["alloc"].items()}
    if alloc_d.get("unit") != "CD_CODE_2006":
        fail("alloc unit drift")
    # 2006-census CDs the BCP covers but the alloc does not (cube-extras
    # carry no population — the alloc's own BCP gate proved them empty)
    venue = json.loads(VENUE.read_text())
    booths = venue["booths"]
    divs_hist = sorted({b["div"] for b in booths})
    mapped = set(alloc_d["divisions"])
    if len(mapped) != 150 or mapped != set(divs_hist):
        fail(f"division drift: alloc-only {sorted(mapped - set(divs_hist))} "
             f"venue-only {sorted(set(divs_hist) - mapped)}")

    not_in_bcp = sorted(k for k in alloc if k not in people)
    if not_in_bcp:
        fail(f"{ALLOC.name}: {len(not_in_bcp)} allocated CDs absent "
             f"from the BCP, e.g. {not_in_bcp[:8]}")

    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * 11,
                                  "eng": 0, "oth": 0, "aus": 0,
                                  "totc": 0, "cobns": 0, "uni": 0,
                                  "eduns": 0, "bluen": 0, "occd": 0,
                                  "pop15": 0,
                                  "sch6": [0] * 6,
                                  "indig": 0, "indigDen": 0,
                                  "relvec": [0] * len(d06.REL_KEYS),
                                  "relNS": 0, "relTot": 0,
                                  "ten6": [0] * 6,
                                  "famN": 0, "famD": 0})
    for code, dv in alloc.items():
        r = people[code]
        acc = divsum[dv]
        acc["pers"] += r["pers"]
        for i in range(11):
            acc["bands"][i] += r["ages"][i]
        for k in ("eng", "oth", "aus", "totc", "cobns", "uni", "eduns",
                  "bluen", "occd", "pop15"):
            acc[k] += r[k]
        for i in range(6):
            acc["sch6"][i] += r["sch6"][i]
            acc["ten6"][i] += r["ten6"][i]
        for k in ("indig", "indigDen", "relNS", "relTot",
                  "famN", "famD"):
            acc[k] += r[k]
        for i in range(len(d06.REL_KEYS)):
            acc["relvec"][i] += r["relvec"][i]

    nat = defaultdict(int)
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd", "pop15"):
            nat[k] += dv[k]
        for i in range(11):
            nat.setdefault("bands", [0] * 11)
            nat["bands"][i] += dv["bands"][i]
        for i in range(6):
            nat.setdefault("sch6", [0] * 6)
            nat.setdefault("ten6", [0] * 6)
            nat["sch6"][i] += dv["sch6"][i]
            nat["ten6"][i] += dv["ten6"][i]
        for k in ("indig", "indigDen", "relNS", "relTot",
                  "famN", "famD"):
            nat[k] += dv[k]
        for i in range(len(d06.REL_KEYS)):
            nat.setdefault("relvec", [0] * len(d06.REL_KEYS))
            nat["relvec"][i] += dv["relvec"][i]
    nat_eo = nat["eng"] + nat["oth"]
    nat_fb = nat["totc"] - nat["cobns"]
    nat_p15 = nat["pers"] - nat["bands"][0] - nat["bands"][1]
    national = {
        "persons": nat["pers"],
        "langOther": round(nat["oth"] / nat_eo, 4),
        "fborn": round((nat_fb - nat["aus"]) / nat_fb, 4),
        "uni": round(nat["uni"] / (nat_p15 - nat["eduns"]), 4),
        "blue": round(nat["bluen"] / nat["occd"], 4),
        "age0_14": round((nat["bands"][0] + nat["bands"][1]) /
                         nat["pers"], 4),
        "age65ov": round(sum(nat["bands"][8:]) / nat["pers"], 4),
        "u15": round((nat["bands"][0] + nat["bands"][1]) /
                     (nat["pers"] - 0), 4),
        "y12less": round(sum(nat["sch6"][1:]) / sum(nat["sch6"]), 4),
        "atsci": round(nat["indig"] / nat["indigDen"], 4),
        "onepar": round(nat["famN"] / nat["famD"], 4),
        "rel": {k: round(nat["relvec"][i]
                         / (nat["relTot"] - nat["relNS"]), 4)
                for i, k in enumerate(d06.REL_KEYS)},
        "ten": {k: round({"mort": nat["ten6"][1],
                          "rent": nat["ten6"][2],
                          "own": nat["ten6"][0],
                          "rentPub": nat["ten6"][3]}[k]
                         / (nat["ten6"][0] + nat["ten6"][1]
                            + nat["ten6"][2] + nat["ten6"][4]), 4)
                for k in d06.TEN_KEYS},
    }
    # 2006-census usual residents: published census count 19,855,288
    pub = 19855288
    if not (0.995 * pub <= national["persons"] <= 1.005 * pub):
        fail(f"national persons {national['persons']} outside the "
             f"2006 census envelope {pub}")

    locate, _polys, _nulls = hist.build_locate("cd2006")
    out_booths = []
    pip_miss = pip_empty = 0
    for vb in booths:
        rec = {"div": vb["div"], "divId": vb["divId"],
               "state": vb["state"], "boothId": vb["boothId"],
               "booth": vb["booth"], "type": vb["type"]}
        lat, lon = vb.get("lat"), vb.get("lon")
        key = None
        if lat is not None and lon is not None and not (
                lat == 0.0 and lon == 0.0):
            key = locate(lon, lat)
        r = people.get(key) if key is not None else None
        if r is None:
            pip_miss += 1
            rec["demo"] = None
        elif r["pers"] == 0:
            pip_empty += 1
            rec["demo"] = None
        else:
            rec["demo"] = d06.shares({
                "pers": r["pers"], "bands": list(r["ages"]),
                "eng": r["eng"], "oth": r["oth"], "aus": r["aus"],
                "totc": r["totc"], "cobns": r["cobns"], "uni": r["uni"],
                "eduns": r["eduns"], "bluen": r["bluen"],
                "occd": r["occd"], "pop15": r["pop15"],
                "sch6": list(r["sch6"]),
                "indig": r["indig"], "indigDen": r["indigDen"],
                "relvec": list(r["relvec"]),
                "relNS": r["relNS"], "relTot": r["relTot"],
                "ten6": list(r["ten6"]),
                "famN": r["famN"], "famD": r["famD"]})
        out_booths.append(rec)

    divstate = {b["div"]: b["state"] for b in booths}
    divisions = []
    for name in sorted(divsum, key=lambda n: (STATE_ORDER[divstate[n]],
                                              n)):
        divisions.append({"div": name, "state": divstate[name],
                          **d06.shares(divsum[name])})
    counts = {
        "booths": len(out_booths),
        "boothsPip": len(out_booths) - pip_miss - pip_empty,
        "boothsPipMiss": pip_miss,
        "boothsPipEmpty": pip_empty,
        "divisions": len(divisions),
        "cdsBcp": len(people),
        "cdsAlloc": len(alloc),
        "national": national,
    }
    out = {
        "_about": (
            "2006-census side (c1) of the 2004 people-interpolation "
            "lane. A booth's demo block is the 2006 Basic Community "
            "Profile counts of the 2006-census collection district its "
            "premises sit in (data/booth-seifa-2004.json's coordinates, "
            "point-in-polygon against the ABS 1259.0.30.002 CD-2006 "
            "shapes) — the venue's neighbourhood, never the booth's "
            "voters; a division's row is the exact 2006-BCP sum over "
            "the CDs whole-allocated to the 2003-edition division set "
            "(seifa-src/cd-2006-ced-2003ed.json). Booth rows without "
            "carried coordinates, or whose coordinates fall outside "
            "every 2006 CD polygon, carry demo:null "
            "(counts.boothsPipMiss), as does one whose CD housed no one "
            "(boothsPipEmpty). Shares mirror the 2006-era store's "
            "recipes verbatim (derive-booth-demo-2006.py's load_bcp + "
            "shares via importlib); no income lanes (the repo's income "
            "floor stays at the 2013 election). The two sides blend to "
            "election day at the SEIFA pcti lane's day-share — see "
            "data/booth-demo-2004.json's demoInterp record; this store "
            "is the far side only."),
        "_provenance": {
            "sourceUrls": {
                "bcp": "ABS 2006 Census Basic Community Profile, "
                       "CD for AUS per state (abs.gov.au archive "
                       "Census 2006 downloads, census06bcp.zip)",
                "shapes": "ABS 1259.0.30.002 CD for AUS per state "
                          "(ASGC 2006, 1259030002_cd06a{st}_shape.zip)",
                "alloc": ".build/analysis/seat-model/seifa-src/"
                         "cd-2006-ced-2003ed.json "
                         "(derive-ced-era-alloc.py)",
                "venue": "data/booth-seifa-2004.json",
            },
            "files": {
                ".matilda/seifa-irsad-abs/dl/census06bcp.zip":
                    hash16(d06.BCP_ZIP),
                ".build/analysis/seat-model/seifa-src/"
                "cd-2006-ced-2003ed.json": hash16(ALLOC),
                "data/booth-seifa-2004.json": hash16(VENUE),
            },
            "extractedAt": str(date.today()),
        },
        "election": 2004,
        "censusEdition": 2006,
        "deliveryBasis": (
            "venue-proxy per booth (2006-census CD of the premises, "
            "point-in-polygon); exact 2006-BCP CD sum per division "
            "(cd-2006-ced-2003ed)"),
        "relKeys": list(d06.REL_KEYS),
        "tenKeys": list(d06.TEN_KEYS),
        "counts": counts,
        "divisions": divisions,
        "booths": out_booths,
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    print(f"OK -> {OUT} (booths {len(out_booths)}, pip-miss {pip_miss}, "
          f"pip-empty {pip_empty}, divisions {len(divisions)}, national "
          f"{national})")


if __name__ == "__main__":
    main()
