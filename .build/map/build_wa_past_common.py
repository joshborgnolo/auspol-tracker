#!/usr/bin/env python3
"""The Western Australia frames' past-election joins — the qld/vic doctrine
on the WAEC's own record, adjudicated per .build/map/src/wa/
past-adjudication.md (renames/new/abolition maps cross-checked by ABS SED
polygon-centroid overlaps).

wa21 stands on wa17, wa25 on wa21, wa17 on the 2013 election — none of
those pairs share a boundary set, so name-jointed swings ride the renamed
partner seat's recorded figures seat-for-seat where the districts share
enough of a fence (the vic22 cross-redistribution convention — approxima-
tions across a redraw, never notional estimates).

The build reads the previous election through wa_eis.load (the same
committed EIS mirror its sister data builder consumed — the 2013 mirror
is also committed for wa17's past lane). It then joins INTO
maps/data/data-<frame>.json so the frame can speak of change:
  prev            the previous election's year
  agg.pprim/pformal   the previous election's party-total primitives
  div.h           [[prevYear, winner-TCP%, winner's party, member]],
                  the federal years' history shape
  c[5]            each candidate's swing vs the partner seat's same-token
                  share (the federal files' new-name convention elsewhere,
                  zeroed on NEW districts)
  tpp[2]          the Labor-point swing where BOTH elections' finals were
                  classic Labor-v-Coalition in the seat

Wipe doctrine: build_wa<yy>_data.py rewrites data-<yy>.json wholesale
(prev:null, swings 0/null), so this script reruns whenever its data
builder does — and ALWAYS before geo_build/assemble. The chain, per frame:
  python3 -I .build/map/build_<yy>_data.py maps/data
  python3 -I .build/map/build_<yy>_past.py maps/data
  node .build/map/geo_build.mjs .build/map/src/wa maps/data maps/data --years=wa<yy>
"""
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wa_eis

REPO = wa_eis.REPO
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "maps", "data")

#: the join contract per frame — names are the EIS role names; NEW districts
#: keep empty h + zeroed swings (vic22's convention); ABOLISHED ride the
#: state aggregates only. Adjudication lives in
#: .build/map/src/wa/past-adjudication.md.
PREV = {
    "wa17": {"frame": "wa13", "year": 2013,
             "renames": {"Bicton": "Alfred Cove", "Burns Beach": "Ocean Reef"},
             "new": {"Baldivis", "Roe", "Thornlie"},
             "abolished": {"Eyre", "Gosnells", "Wagin"}},
    "wa21": {"frame": "wa17", "year": 2017,
             "renames": {"Landsdale": "Girrawheen"},
             "new": set(),
             "abolished": set()},
    "wa25": {"frame": "wa21", "year": 2021,
             "renames": {"Secret Harbour": "Warnbro"},
             "new": {"Bibra Lake", "Oakford", "Mindarie", "Girrawheen", "Mid-West"},
             "abolished": {"Burns Beach", "Mirrabooka", "Moore", "North West Central", "Willagee"},
             },
}

BUCKETS = ("alp", "lnp", "grn", "onp", "ind", "oth")


def fail(frame):
    def f(msg):
        raise SystemExit(f"{frame}-past: {msg}")
    return f


def r2(v):
    return round(v + 1e-9, 2)


def past_main(frame):
    ffail = fail(frame)
    P = PREV.get(frame)
    if P is None:
        ffail(f"{frame} has no past join configured")
    past_frame, past_year = P["frame"], P["year"]
    past = wa_eis.load(past_frame)
    past_d = {x["name"]: x for x in past["districts"]}
    if len(past_d) != 59:
        ffail(f"previous election parsed {len(past_d)} districts, expected 59")

    data_path = os.path.join(OUT, f"data-{frame}.json")
    if not os.path.exists(data_path):
        ffail(f"{data_path} missing — run build_{frame}_data.py maps/data")
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
    for st_k in ("AUS", "WA"):
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
            ffail(f"{frame} district {name} matches nothing in the {past_year}"
                  f" mirror (extend the RENAMES map deliberately, per"
                  f" past-adjudication.md)")
        matched.add(past_name)
        # the history row rides the winning pair member (2CP top vote)
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
            prev_by_ab[c["ab"]] += c["v"]
        for r in div["c"]:
            share = (100 * r[4]) / formal
            prev_share = (100 * prev_by_ab[r[1]]) / past_formal if r[1] in prev_by_ab else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1

        if div.get("tpp"):
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
        ffail(f"{past_year} districts never consumed and not adjudicated: "
              f"{sorted(missing_past)[:8]} — the adjudication map is stale")
    handled = matched | P["new"] | set(P["renames"])
    unhandled = [x["n"] for x in data["divs"] if x["n"] not in handled]
    if unhandled:
        ffail(f"{frame} districts neither matched nor adjudicated new: {unhandled[:8]}")

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{frame} past ({past_year}): {n_hist} history rows, {n_sw} candidate"
          f" swings, {n_tpp} 2PP swings; prev totals formal {pformal}"
          f" {'|'.join(b + '=' + str(pprim[b]) for b in BUCKETS)}")
