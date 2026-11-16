#!/usr/bin/env python3
"""build_sa18_data.py — the /map/ frame emitter for South Australia's
2018 state election (17 March 2018), the build_nt_common.py shape on the
ECSA's own static-result pages.

Sources (all committed mirrors; nothing is fetched here):
  .build/map/src/sa22/ecsa-2018-*.html.gz            per-district 2018 result
          pages (fetched/verified per harvest-sa18-src.py; parsed on
          build_sa22_past.py's own machinery — the pages and their
          assertions are the same ones the sa22 frame's past lane rides)
  data/sa18-demo.json, data/sa18-seifa.json          this frame's census
          stores (build_sa18_demo.py, build_sa18_seifa.py — run first)

Sits where sa22 sits multihomingly within the re-emission discipline:
the emit always runs through build_sa18_past.py's prev lane afterward
(the past build joins into the emitted file):
  python3 -I .build/map/build_sa18_demo.py        (was run)
  python3 .build/map/build_sa18_seifa.py          (was run — xlrd, not -I)
  python3 -I .build/map/build_sa18_data.py map/data
  python3 -I .build/map/build_sa18_past.py map/data
  MAPSHAPER="$PWD/node_modules/.bin/mapshaper" \\
    node .build/map/geo_build.mjs .build/map/src/sa18 map/data map/data --years=sa18

There are no 2018-era polling-place results available anywhere (the
ECSA-era static tree for 2014 is the only machine-readable vintage; the
2018 era publishes district-summary snapshots only), so this frame's
booth lane stays empty the same way its predecessor era's couldn't have
shipped one either. The district tallies ride the HoA statewide answer
key: REF total formal 1,048,713, informal 44,821, electors 1,201,775,
seats LIB 25 / ALP 19 / IND 3 — all asserted per-commit inside
build_sa22_past.build_2018(), never rebound here.
"""
import collections
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
for path in (sys.path[0],):
    pass
import sa18_geo  # noqa: E402
import build_sa22_past as P  # noqa: E402 (guarded main)

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

FRAME = {"year": "sa18", "date": "2018-03-17", "jurisdiction": "SA",
         "seats": P.EXPECTED_2018_SEATS,  # {"LIB": 25, "ALP": 19, "IND": 3}
         "formal": 1048713, "inf": 44821, "enrolled": 1201775,
         "demoYear": 2016}


def ffail(msg):
    raise SystemExit(f"build-sa18-data: {msg}")


def load_census():
    demo_p = os.path.join(REPO, "data", "sa18-demo.json")
    seifa_p = os.path.join(REPO, "data", "sa18-seifa.json")
    if not os.path.exists(demo_p) or not os.path.exists(seifa_p):
        ffail("census stores missing — run build_sa18_demo.py and build_sa18_seifa.py")
    dd = json.load(open(demo_p))
    if dd.get("year") != "sa18" or dd.get("demoBasis") != "sa1":
        ffail(f"demo store drift ({dd.get('year')!r}, {dd.get('demoBasis')!r})")
    sd = json.load(open(seifa_p))
    if sd.get("year") != "sa18":
        ffail(f"seifa store drift ({sd.get('year')!r})")
    for name, row in sd.get("seifa", {}).items():
        if set(row) != set(("irsad", "irsd", "ier", "ieo")):
            ffail(f"seifa store {name}: index cells drift")
    if not isinstance(dd.get("cobKeys"), list) or len(dd["cobKeys"]) != 10:
        ffail("demo store lacks its ten-country cobKeys order")
    return dd["demo"], sd["seifa"], dd.get("cobKeys") or []


def frac(v):
    return v


def main():
    demo, seifa, cob_keys = load_census()
    # the same assertion ladder build_sa22_past's own build_2018() runs:
    # district parses + per-district totals against the printed statewide
    # record; returns {"dists", "prim", "formal"}
    ha = P.build_2018()

    D = []
    seats = collections.Counter()
    tot_prim = collections.Counter()
    tot_formal = 0
    tpp_tot = [0, 0]
    geo_missing = []
    for name in sa18_geo.EXPECTED_NAMES:
        past = ha["dists"].get(name)
        if past is None:
            ffail(f"mirror lacks the 2018 {name} page")
        cands_sorted = sorted(past["candidates"], key=lambda c: -c["v"])
        win_n = past["winner"]["n"]
        if not any(c["n"] == win_n for c in cands_sorted):
            ffail(f"{name}: winner {win_n!r} not on its own candidate roster")

        seats[past["winner"]["ab"]] += 1
        tot_formal += past["formal"]

        # two-party semantics: same contract the carriage every other state
        # frame (classic pair = ALP v LIB); pages' Two Candidate Preferred
        # rows are the distribution-final figures
        tpp = None
        if past.get("tpp"):
            tpp = [past["tpp"][0], past["tpp"][1], None]
            tpp_tot[0] += tpp[0]
            tpp_tot[1] += tpp[1]
        c_rows = [[c["n"], c["ab"], None, P.bucket(c["ab"]), c["v"], 0,
                   1 if c["n"] == win_n else 0, 0]
                  for c in cands_sorted]

        rec = {
            "id": len(D), "n": name, "st": "SA",
            "c": c_rows,
            "inf": past["inf"], "tcp": [], "fl": [], "h": [],
            "enrolled": None,
            "demo": demo[name], "seifa": seifa[name],
        }
        if tpp:
            rec["tpp"] = tpp
        D.append(rec)
        for c in cands_sorted:
            tot_prim[P.bucket(c["ab"])] += c["v"]

    if dict(seats) != P.EXPECTED_2018_SEATS:
        ffail(f"seat tally {dict(seats)} != the ECSA's own {P.EXPECTED_2018_SEATS}")
    if tot_formal != P.REF_2018_TOTALS["formal"]:
        ffail(f"formal totals {tot_formal} != the ECSA statewide print")
    agg_prim = {k: tot_prim[k] for k in ("alp", "lnp", "grn", "onp", "ind", "oth")}
    if sum(agg_prim.values()) != tot_formal:
        ffail("party-primary buckets don't reach the formal vote (affiliation class drift)")

    # the statewide party-primary answer, independent third angle
    want_prim = {b: v for b, v in P.REF_2018_PRIM.items()}
    check = {"lnp": want_prim["LIB"], "alp": want_prim["ALP"],
             "grn": want_prim["GRN"], "ind": want_prim["IND"]}
    for b, v in check.items():
        if agg_prim[b] != v:
            ffail(f"agg prim {b} {agg_prim[b]} != HoA statewide {v}")
    oth_ref = sum(v for k, v in want_prim.items() if k in ("SAB", "AC", "DIG", "AJP", "DPA", "SPGN"))
    if agg_prim["oth"] != oth_ref:
        ffail(f"agg oth {agg_prim['oth']} != HoA small parties {oth_ref}")
    if agg_prim["onp"] != 0:
        ffail(f"agg onp {agg_prim['onp']} != 0 for a 2018-era frame")

    B = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                         "v", "inf", "tpp", "tcp", "fl", "dec", "vdec")}
    agg = {"prim": agg_prim, "formal": P.REF_2018_TOTALS["formal"],
           "inf": P.REF_2018_TOTALS["informal"],
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": dict(seats)}
    out = {"year": FRAME["year"], "date": FRAME["date"], "prev": None,
           "jurisdiction": FRAME["jurisdiction"], "demoBasis": "sa1",
           "cobKeys": cob_keys,
           "agg": {"AUS": agg, "SA": dict(agg)}, "divs": D, "booths": B}
    if FRAME["demoYear"] != 2021:
        out["demoYear"] = FRAME["demoYear"]
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"data-{FRAME['year']}.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1]) if tpp_tot[0] or tpp_tot[1] else None
    print(f"sa18 divisions {len(D)} | seats {dict(seats)}"
          f" | classic-2PP ALP {round(tp, 2) if tp else None}%"
          f" | formal {P.REF_2018_TOTALS['formal']} -> {os.path.getsize(p)} bytes")


if __name__ == "__main__":
    main()
