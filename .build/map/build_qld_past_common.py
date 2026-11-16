"""The Queensland frames' past-election joins (build_qld17_past.py
through build_qld24_past.py), the sa26-past discipline on the ECQ's own
record.

qld20 stands on qld17, qld24 on qld20 — both fought on the unchanged
93-district map (the 2017 determination), so the join rides its identity
contract: a drifted name fails the build. qld17 stands on 2015 —
Queensland's LAST election on the 89-district map — and joins through
the 2017 determination renames per .build/map/src/qld/past-adjudication.md
(9 renames, 3 abolished, 7 new; centroid-adjudicated against both ABS SED
editions).

The build reads the previous election through qld_ecq's load() — the same
committed mirrors its sister data builder just turned into data-qld<prev>.
It then joins INTO map/data/data-<frame>.json so the frame can speak of
change:
  prev            the previous election's year (2017 / 2020)
  agg.pprim/pformal   the previous election's party-total primitives
  div.h           [[prevYear, winner-TCP%, winner's party, member]], the
                  federal years' history shape
  c[5]            each candidate's swing: primary-point change on the
                  previous election IN THE SEAT (same party id in the seat
                  last time, or the whole share as the change — the federal
                  files' convention for a new name)
  tpp[2]          the Labor-point swing, filled where BOTH elections' final
                  counts were Labor v LNP in the seat (null until now)

Wipe doctrine: build_qld<yy>_data.py rewrites data-<yy>.json wholesale
(prev:null, swings 0/null), so this script reruns whenever its data builder
does — and ALWAYS before geo_build/assemble. The chain, per frame:
  python3 -I .build/map/build_<yy>_data.py map/data
  python3 -I .build/map/build_qld_boothcensus.py <yy>
  python3 -I .build/map/build_<yy>_past.py map/data
  node .build/map/geo_build.mjs .build/map/src/qld map/data map/data --years=qld<yy>
"""
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qld_ecq

REPO = qld_ecq.REPO
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

#: previous-election lookup per frame. qld17 now names 2015: the
#: 89-district election joins the 93-district frame through the
#: documented 2017 determination renames, adjudicated by ABS SED
#: polygon-centroid maps in .build/map/src/qld/past-adjudication.md
PREV_OF = {"qld24": "qld20", "qld20": "qld17", "qld17": "qld15"}
PREV_YEAR = {"qld20": 2017, "qld24": 2020, "qld17": 2015}

#: the join contract per frame — adjudication lives in
#: .build/map/src/qld/past-adjudication.md. NEW districts keep no history
#: rows and carry no swings (their story is "new seat"); ABOLISHED ride
#: the aggregates only. qld20/qld24 chain name-for-name on the unchanged
#: map (the existing contract): their PREV_ADJ records stay {}, and a
#: drift still fails loudly.
PREV_ADJ = {
    "qld17": {
        "renames": {
            "Theodore": "Albert", "Cooper": "Ashgrove", "Scenic Rim": "Beaudesert",
            "McConnel": "Brisbane Central", "Oodgeroo": "Cleveland",
            "Maiwar": "Indooroopilly", "Kurwongbah": "Kallangur",
            "Traeger": "Mount Isa", "Miller": "Yeerongpilly",
        },
        "new": {"Bancroft", "Bonney", "Hill", "Jordan", "Macalister", "Ninderry", "Toohey"},
        "abolished": {"Dalrymple", "Mount Coot-tha", "Sunnybank"},
    },
    "qld20": {"renames": {}, "new": set(), "abolished": set()},
    "qld24": {"renames": {}, "new": set(), "abolished": set()},
}


def fail(frame):
    def f(msg):
        raise SystemExit(f"{frame}-past: {msg}")
    return f


def r2(v):
    return round(v + 1e-9, 2)


def past_main(frame):
    ffail = fail(frame)
    prev_frame = PREV_OF.get(frame)
    if not prev_frame:
        ffail(f"{frame} has no past join by definition")
    past_year = PREV_YEAR[frame]
    adj = PREV_ADJ[frame]
    past = qld_ecq.load(prev_frame)
    past_d = {x["name"]: x for x in past["districts"]}
    expect_divs = {"qld15": 89, "qld17": 93, "qld20": 93}[prev_frame]
    if len(past_d) != expect_divs:
        ffail(f"previous election parsed {len(past_d)} districts, expected {expect_divs}")

    data_path = os.path.join(OUT, f"data-{frame}.json")
    if not os.path.exists(data_path):
        ffail(f"{data_path} missing — run build_{frame}_data.py map/data")
    with open(data_path) as f:
        data = json.load(f)
    if data.get("year") != frame:
        ffail(f"{data_path} is not the {frame} frame")
    if data.get("prev") is not None:
        ffail(f"data-{frame}.json already carries prev {data['prev']} — rerun "
              f"build_{frame}_data.py first (its lane reset wiped nothing)")

    # previous election's aggregate primitives
    pprim = {b: 0 for b in qld_ecq.BUCKETS}
    pformal = 0
    for x in past["districts"]:
        pformal += x["formal"]
        for c in x["cands"]:
            pprim[qld_ecq.bucket(c["ab"])] += x["fpv"][c["key"]]
    agg = data["agg"]
    for st_k in ("AUS", "QLD"):
        if st_k not in agg:
            ffail(f"agg lacks the {st_k} key")
        agg[st_k]["pprim"] = pprim
        agg[st_k]["pformal"] = pformal
    data["prev"] = past_year

    n_hist = n_sw = n_tpp = 0
    matched = set()
    for div in data["divs"]:
        name = div["n"]
        if name in adj["new"]:
            continue   # a new seat keeps no history rows and no swings
        past_name = adj["renames"].get(name, name)
        past_x = past_d.get(past_name)
        if past_x is None:
            ffail(f"{frame} district {name} matches no {past_year} district —"
                  " extend the PREV_ADJ renames map deliberately (see"
                  " .build/map/src/qld/past-adjudication.md), never silently")
        matched.add(past_name)
        w_key = past_x["elected"]
        w_pct = r2(100 * past_x["tcp"]["v"][0] / sum(past_x["tcp"]["v"]))
        w_ab = next(c["ab"] for c in past_x["cands"] if c["key"] == w_key)
        w_name = next(c["n"] for c in past_x["cands"] if c["key"] == w_key)
        div["h"] = [[past_year, w_pct, w_ab, w_name]]
        n_hist += 1

        formal = sum(r[4] for r in div["c"])
        past_formal = past_x["formal"]
        prev_by_ab = collections.Counter()
        for c in past_x["cands"]:
            prev_by_ab[c["ab"]] += past_x["fpv"][c["key"]]
        for r in div["c"]:
            share = (100 * r[4]) / formal
            prev_share = (100 * prev_by_ab[r[1]]) / past_formal if r[1] in prev_by_ab else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1

        # Labor-point 2PP swing where both elections finished Labor v LNP
        if div.get("tpp"):
            past_pair_bs = [qld_ecq.bucket(next(c["ab"] for c in past_x["cands"] if c["key"] == k))
                            for k in past_x["tcp"]["k"]]
            if set(past_pair_bs) == {"alp", "lnp"}:
                alp_i = past_pair_bs.index("alp")
                past_alp_v = past_x["tcp"]["v"][alp_i]
                past_lnp_v = past_x["tcp"]["v"][1 - alp_i]
                cur = (100 * div["tpp"][0]) / (div["tpp"][0] + div["tpp"][1])
                old2 = (100 * past_alp_v) / (past_alp_v + past_lnp_v)
                div["tpp"][2] = r2(cur - old2)
                n_tpp += 1
    leftover = set(past_d) - matched - adj["abolished"]
    if leftover:
        ffail(f"{past_year} districts never matched nor adjudicated: {sorted(leftover)[:5]}"
              " — the adjudication record is stale")
    handled = matched | adj["new"] | set(adj["renames"])
    unhandled = [x["n"] for x in data["divs"] if x["n"] not in handled]
    if unhandled:
        ffail(f"{frame} districts neither matched nor adjudicated new: {unhandled[:5]}")

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{frame} past ({past_year}): {n_hist} history rows, {n_sw} candidate"
          f" swings, {n_tpp} 2PP swings; prev totals formal {pformal}"
          f" {'|'.join(b + '=' + str(pprim[b]) for b in qld_ecq.BUCKETS)}")
