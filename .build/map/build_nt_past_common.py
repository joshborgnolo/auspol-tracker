#!/usr/bin/env python3
"""The Northern Territory frames' past-election joins — the wa doctrine on
the NTEC's own record, adjudicated per .build/map/src/nt/
past-adjudication.md.

nt20 stands on nt16, nt24 on nt20, nt16 on the 2012 election. The
2012→2016 redistribution set sits ENTIRELY inside name-stable territory
(Greatorex out, Spillett in — the only roster delta of the 25), so that
pair needs no polygons at all (no ABS edition carries the 2012 divisions
anyway — the 2011 gazettal pre-dates the SED product). The 2016→2020 pair
rides the documented Stuart→Gwoja and Nhulunbuy→Mulka renames; the
2020→2024 (2023 redistribution) set renamed nothing but moved the
Gwoja↔Daly and Mulka↔Arnhem fences — still a one-for-one name join.

The build reads the previous election through nt_parse.load (the same
committed mirror its sister data builder consumed, the 2012 mirror
included). It then joins INTO map/data/data-<frame>.json so the frame can
speak of change:
  prev            the previous election's year
  agg.pprim/pformal   the previous election's party-total primitives
  div.h           [[prevYear, winner-TCP%, winner's party, member]],
                  the federal years' history shape
  c[5]            each candidate's swing vs the partner division's
                  same-token primary share (era tokens aliased:
                  2012's "Greens"/"IND" are 2016-on's "GRN"/"Ind")
  tpp[2]          the Labor-point swing where BOTH elections' final pairs
                  were ALP v CLP in the division (the only classic era pair
                  the NT's fam mapping supports)

Wipe doctrine: build_nt<yy>_data.py rewrites data-<yy>.json wholesale
(prev:null, swings 0/null), so this script reruns whenever its data
builder does — and ALWAYS before geo_build/assemble. The chain, per frame:
  python3 -I .build/map/build_nt<yy>_data.py map/data
  python3 -I .build/map/build_nt<yy>_past.py map/data
  node .build/map/geo_build.mjs .build/map/src/nt map/data map/data --years=nt<yy>
"""
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nt_parse

REPO = nt_parse.REPO
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

#: the join contract per frame — adjudication lives in
#: .build/map/src/nt/past-adjudication.md. NEW divisions keep empty h +
#: zeroed swings (vic22's convention); ABOLISHED ride the aggregates only.
PREV = {
    "nt16": {"frame": "nt12", "year": 2012,
             "renames": {},
             "new": {"Spillett"},
             "abolished": {"Greatorex"}},
    "nt20": {"frame": "nt16", "year": 2016,
             "renames": {"Gwoja": "Stuart", "Mulka": "Nhulunbuy"},
             "new": set(),
             "abolished": set()},
    "nt24": {"frame": "nt20", "year": 2020,
             "renames": {},
             "new": set(),
             "abolished": set()},
}

BUCKETS = ("alp", "lnp", "grn", "onp", "ind", "oth")

#: past-era party tokens -> the current-era display tokens the swings are
#: written against (2012's psephos-era print vs the NTEC web era's codes)
NORM_PREV_AB = {"Greens": "GRN", "IND": "Ind", "Independents": "Ind"}


def fail(frame):
    def f(msg):
        raise SystemExit(f"build-nt-past-{frame}: {msg}")
    return f


def r2(v):
    return round(v + 1e-9, 2)


def past_main(frame):
    ffail = fail(frame)
    P = PREV.get(frame)
    if P is None:
        ffail(f"{frame} has no past join configured")
    past_frame, past_year = P["frame"], P["year"]
    past = nt_parse.load(past_frame)
    past_d = {x["name"]: x for x in past["districts"]}
    if len(past_d) != 25:
        ffail(f"previous election parsed {len(past_d)} divisions, expected 25")

    data_path = os.path.join(OUT, f"data-{frame}.json")
    if not os.path.exists(data_path):
        ffail(f"{data_path} missing — run build_{frame}_data.py map/data")
    with open(data_path) as f:
        data = json.load(f)
    if data.get("year") != frame:
        ffail(f"{data_path} is not the {frame} frame")
    if data.get("prev") is not None:
        ffail(f"data-{frame}.json already carries prev {data['prev']} — rerun "
              f"build_{frame}_data.py first")

    pprim = {b: 0 for b in BUCKETS}
    pformal = 0
    for x in past["districts"]:
        pformal += x["formal"]
        for c in x["cands"]:
            pprim[c["b"]] += c["v"]
    agg = data["agg"]
    for st_k in ("AUS", "NT"):
        if st_k not in agg:
            ffail(f"agg lacks the {st_k} key")
        agg[st_k]["pprim"] = pprim
        agg[st_k]["pformal"] = pformal
    data["prev"] = past_year

    n_hist = n_sw = n_tpp = 0
    matched = set()
    for div in data["divs"]:
        name = div["n"]
        if name in P["new"]:
            matched.add(name)
            continue
        past_name = P["renames"].get(name, name)
        past_x = past_d.get(past_name)
        if past_x is None:
            ffail(f"{frame} division {name} matches nothing in the {past_year}"
                  f" mirror (extend the renames map deliberately, per"
                  f" past-adjudication.md)")
        matched.add(past_name)
        wv = max(past_x["tcp"], key=lambda t: t["v"])
        w_cand = next(c for c in past_x["cands"] if c["key"] == wv["key"])
        w_pct = r2(100 * wv["v"] / (past_x["tcp"][0]["v"] + past_x["tcp"][1]["v"]))
        if w_cand["key"] != past_x["elected"]:
            ffail(f"{name}: {past_year} elected member isn't the tcp leader"
                  f" — the mirror disagrees with itself")
        div["h"] = [[past_year, w_pct, w_cand["ab"], w_cand["n"]]]
        n_hist += 1

        formal = sum(r[4] for r in div["c"])
        past_formal = past_x["formal"]
        prev_by_ab = collections.Counter()
        for c in past_x["cands"]:
            prev_by_ab[NORM_PREV_AB.get(c["ab"], c["ab"])] += c["v"]
        for r in div["c"]:
            share = (100 * r[4]) / formal
            prev_share = (100 * prev_by_ab[r[1]]) / past_formal if r[1] in prev_by_ab else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1

        if div.get("tpp") and not (div.get("tppn") or div.get("tppe")):
            # classic pair both elections only — a notional or estimated
            # majors count never hangs a swing off the previous election's
            # (possibly official) row
            past_bs = [next(c for c in past_x["cands"] if c["key"] == t["key"])["b"]
                       for t in past_x["tcp"]]
            if set(past_bs) == {"alp", "lnp"}:
                ai = past_bs.index("alp")
                past_alp_v = past_x["tcp"][ai]["v"]
                past_lnp_v = past_x["tcp"][1 - ai]["v"]
                cur = (100 * div["tpp"][0]) / (div["tpp"][0] + div["tpp"][1])
                old2 = (100 * past_alp_v) / (past_alp_v + past_lnp_v)
                div["tpp"][2] = r2(cur - old2)
                n_tpp += 1

    missing_past = {x["name"] for x in past["districts"]} - matched - P["abolished"]
    if missing_past:
        ffail(f"{past_year} divisions never consumed and not adjudicated: "
              f"{sorted(missing_past)[:8]} — the adjudication map is stale")
    handled = matched | P["new"] | set(P["renames"])
    unhandled = [x["n"] for x in data["divs"] if x["n"] not in handled]
    if unhandled:
        ffail(f"{frame} divisions neither matched nor adjudicated new: {unhandled[:8]}")

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{frame} past ({past_year}): {n_hist} history rows, {n_sw} candidate"
          f" swings, {n_tpp} 2PP swings; prev totals formal {pformal}"
          f" {'|'.join(b + '=' + str(pprim[b]) for b in BUCKETS)}")
