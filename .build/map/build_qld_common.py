"""build_qld_common.py — the shared /map/ frame emitter for Queensland's
three state-election frames (qld17, qld20, qld24). The sa26 discipline on
the ECQ's own products: qld_ecq.py (same directory) parses the two source
eras into one ElectionData shape; this file emits the federal res schema
(.build/map/app/app-1-base.js deriveDiv) from it.

Sources per frame (none of it fetched here — the mirrors are the source of
truth, .build/map/harvest-qld-src.py assembles them):
  qld24, qld20   .build/state-flow-src/qld/<YYYY>/xml/publicResults.xml
                 (the ECQ Vote Result System media feed: geocoded venue
                 roll, official first-preference counts per venue incl. the
                 declaration/absent pseudo rows, and the preference round's
                 per-venue two-candidate counts at the district's final pair)
  qld17          .build/state-flow-src/qld/2017/booth<N>.html.gz (primary
                 by booth + per-district distribution summary),
                 .build/map/src/qld17/district<N>.html.gz (roster, enrolment,
                 district totals), profile<N>.html.gz (day-booth venue roll),
                 prepoll-offices.html.gz (the ~63 early voting centres and
                 the 93 returning officers)

The booth lane files REAL venues only (day booths 1, early voting centres
5; 93 mobile teams 4 with null coords). Pseudo rows — postal/declaration
(DV1/DV2), absent day/early (AB1/AB2), Telephone Voting rows, and for 2017
every district's "Returning Officer … Pre-Poll" lump row, the All-Districts
centres and the electoral-visit teams — fold into the district totals and
never enter the lane; lane formal + pseudo formal == district formal, per
candidate, asserted. 2017 has no per-venue TCP anywhere (the era published
the distribution at district level only), so qld17 booth `tcp` is null; its
booth coordinates come from the (name, locality) join onto the VRS-era
venue roll and stand empty where the era join can't place them
(unlocated booths simply draw no dot — the app's contract).

Tally oracles asserted against the emitted numbers (fail-loud):
  frame   seats                                   formal    informal  enrolled
  qld24   LNP 52 ALP 36 KAP 3 GRN 1 IND 1        3,105,945   126,203  3,683,368
  qld20   ALP 52 LNP 34 KAP 3 GRN 2 ONP 1 IND 1  2,868,324   101,023  3,377,476
  qld17   ALP 48 LNP 39 KAP 3 GRN 1 ONP 1 IND 1  2,703,941   122,672  3,229,536

Census/SEIFA lanes ride data/qld<yy>-{demo,seifa}.json (the ABS census SA1
pools joined onto the 93 districts by build_qld<yy>_{demo,seifa}.py — a
measured-only read like sa26's: the 2021 census for qld20 and qld24, the
2016 census for qld17; qld17's data file carries demoYear 2016 so the
page's census-year copy knows which edition it quotes). The preferences
lens rides data/qld<yy>-flows.json, the two-class pile estimator's MODELLED
per-district flows (.build/estimate-state-flows.py, written only when its
federal back-test gates pass — the ECQ publishes a distribution of
preferences, never where each party's own voters ended).

usage: python3 -I .build/map/build_qld<yy>_data.py <out_dir>
then:  MAPSHAPER="$PWD/node_modules/.bin/mapshaper" \\
         node .build/map/geo_build.mjs .build/map/src/qld map/data map/data --years=qld<yy>
"""
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qld_ecq
from qld_ecq import BUCKETS, bucket, fail
from qld_flow_lane import load_store, flow_rows

REPO = qld_ecq.REPO
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

FRAMES = {
    "qld24": {
        "year": "qld24", "date": "2024-10-26", "jurisdiction": "QLD",
        "seats": {"LNP": 52, "ALP": 36, "KAP": 3, "GRN": 1, "IND": 1},
        "formal": 3105945, "inf": 126203, "enrolled": 3683368,
        "demoYear": 2021,
    },
    "qld20": {
        "year": "qld20", "date": "2020-10-31", "jurisdiction": "QLD",
        "seats": {"ALP": 52, "LNP": 34, "KAP": 3, "GRN": 2, "ONP": 1, "IND": 1},
        "formal": 2868324, "inf": 101023, "enrolled": 3377476,
        "demoYear": 2021,
    },
    "qld17": {
        "year": "qld17", "date": "2017-11-25", "jurisdiction": "QLD",
        "seats": {"ALP": 48, "LNP": 39, "KAP": 3, "GRN": 1, "ONP": 1, "IND": 1},
        "formal": 2703941, "inf": 122672, "enrolled": 3229536,
        "demoYear": 2016,
    },
}

#: booth TCP sum vs its own formal — CPV's exhaust is capped at a generous
#: bound; a real figure-wobble is a stop, never a tolerance
BOOTH_TCP_GAP_MAX = 200

PARTY_PN = {
    "ALP": "Australian Labor Party",
    "LNP": "Liberal National Party",
    "GRN": "The Greens",
    "ONP": "Pauline Hanson's One Nation",
    "KAP": "Katter's Australian Party",
    "FFP": "Family First",
    "HMP": "Legalise Cannabis",
    "LTP": "Libertarian",
    "AJP": "Animal Justice Party",
    "UAPP": "United Australia (Clive Palmer)",
    "IND": "Independent",
}


def suburb_case(s):
    import re as _re
    t = (s or "").strip().title()
    return _re.sub(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), t)


def frame_fail(frame):
    def f(msg):
        raise SystemExit(f"{frame}: {msg}")
    return f


def load_census(frame, ffail):
    demo_path = os.path.join(REPO, "data", f"{frame}-demo.json")
    seifa_path = os.path.join(REPO, "data", f"{frame}-seifa.json")
    for p, call in ((demo_path, "build_%s_demo.py" % frame),):
        if not os.path.exists(p):
            ffail(f"census store {p} missing — run .build/map/{call}")
    with open(demo_path) as f:
        dd = json.load(f)
    if dd.get("year") != frame or dd.get("demoBasis") != "sa1":
        ffail(f"demo store is year {dd.get('year')!r} basis {dd.get('demoBasis')!r},"
              f" expected {frame}/sa1")
    if not os.path.exists(seifa_path):
        ffail(f"SEIFA store {seifa_path} missing — run .build/map/build_{frame}_seifa.py")
    with open(seifa_path) as f:
        sd = json.load(f)
    if sd.get("year") != frame:
        ffail(f"SEIFA store is year {sd.get('year')!r}, expected {frame}")
    demo, seifa = dd.get("demo"), sd.get("seifa")
    if not isinstance(demo, dict) or len(demo) != 93:
        ffail(f"demo store covers {len(demo or {})} districts, expected 93")
    if not isinstance(seifa, dict) or len(seifa) != 93:
        ffail(f"SEIFA store covers {len(seifa or {})} districts, expected 93")
    for name, row in seifa.items():
        for ix in ("irsad", "irsd", "ier", "ieo"):
            c = (row or {}).get(ix) or {}
            if not (isinstance(c.get("v"), (int, float)) and isinstance(c.get("dec"), int)
                    and isinstance(c.get("pct"), (int, float))):
                ffail(f"SEIFA store: {name}.{ix} lacks a {{v, pct, dec}} cell — rerun build_{frame}_seifa.py")
    return demo, seifa, dd.get("cobKeys") or []


def data_main(frame):
    ffail = frame_fail(frame)
    C = FRAMES[frame]
    src = qld_ecq.load(frame)
    demo, seifa, cob_keys = load_census(frame, ffail)
    flows, contests, flow_err = load_store(os.path.join(REPO, "data", f"{frame}-flows.json"), ffail)

    D = []
    seats = collections.Counter()
    tot_prim = collections.Counter()
    tot_formal = tot_inf = tot_enrolled = 0
    tpp_tot = [0, 0]
    B = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                         "v", "inf", "tpp", "tcp", "fl", "dec", "vdec")}
    types_seen = collections.Counter()
    geocoded = tcp_booths = zero_booths = 0
    for di, x in enumerate(src["districts"]):
        name = x["name"]
        if name not in demo:
            ffail(f"census store lacks district {name} — the frame's names moved")
        # candidates, vote-sorted (the res schema's candidate order)
        rows = []
        for c in x["cands"]:
            key = c["key"]
            v = x["fpv"][key]
            rows.append({
                "cid": key, "key": key, "n": c["n"], "ab": c["ab"],
                "pn": c["pn"] or PARTY_PN.get(c["ab"], c["ab"]),
                "b": bucket(c["ab"]), "v": v,
                "el": key == x["elected"],
            })
        rows.sort(key=lambda r: -r["v"])
        if not any(r["el"] for r in rows):
            ffail(f"{name}: elected key {x['elected']} not on the roster")
        w = next(r for r in rows if r["el"])
        seats[w["ab"]] += 1

        pair_keys = x["tcp"]["k"]
        pair_votes = x["tcp"]["v"]
        pair_rows = []
        key2row = {r["key"]: i for i, r in enumerate(rows)}
        for k in pair_keys:
            if k not in key2row:
                ffail(f"{name}: TCP candidate {k} left the roster in sorting")
            pair_rows.append(key2row[k])
        tcp = [[pair_rows[0], pair_votes[0]], [pair_rows[1], pair_votes[1]]]
        pair_buckets = {rows[pair_rows[0]]["b"], rows[pair_rows[1]]["b"]}
        tpp = None
        if pair_buckets == {"alp", "lnp"}:
            ia = pair_rows[0] if rows[pair_rows[0]]["b"] == "alp" else pair_rows[1]
            ib = pair_rows[1] if ia == pair_rows[0] else pair_rows[0]
            va = pair_votes[pair_rows.index(ia)]
            vb = pair_votes[pair_rows.index(ib)]
            tpp = [va, vb, None]
            tpp_tot[0] += va
            tpp_tot[1] += vb

        fl = flow_rows(name, rows, pair_buckets, rows[pair_rows[0]]["b"],
                       {r["cid"]: k for k, r in enumerate(rows)}, flows, contests, ffail)

        for bk, b in enumerate(x["booths"]):
            if b["pseudo"]:
                continue
            types_seen[b["ty"]] += 1
            vrow = [0] * len(rows)
            for c in rows:
                vrow[key2row[c["key"]]] = b["pv"][c["key"]]
            if b["formal"] != sum(vrow):
                ffail(f"{name}: booth {b['name']!r} formal {b['formal']} != its votes {sum(vrow)}")
            if b["formal"] == 0:
                zero_booths += 1
            venue = b.get("venue")
            lat = lon = None
            prem = sub = pc = None
            if venue:
                prem = venue.get("prem") or None
                sub = suburb_case(venue.get("sub") or "") or None
                pc = venue.get("pc") or None
                if venue.get("lat") is not None:
                    lat, lon = round(venue["lat"], 5), round(venue["lon"], 5)
                    geocoded += 1
            tcp_b = b.get("tcp")
            if tcp_b is not None:
                if sum(tcp_b) > b["formal"]:
                    ffail(f"{name}: booth {b['name']!r} tcp {sum(tcp_b)} exceeds formal {b['formal']}")
                if b["formal"] and sum(tcp_b) < b["formal"] - BOOTH_TCP_GAP_MAX:
                    ffail(f"{name}: booth {b['name']!r} tcp {sum(tcp_b)} short of formal {b['formal']}"
                          f" beyond CPV exhaust headroom")
                tcp_booths += 1
            B["d"].append(di)
            B["id"].append(f"{frame}-{di}-{bk}")
            B["n"].append(b["name"])
            B["ty"].append(b["ty"])
            B["prem"].append(prem)
            B["sub"].append(sub)
            B["pc"].append(pc)
            B["lat"].append(lat)
            B["lon"].append(lon)
            B["v"].append(vrow)
            B["inf"].append(b["informal"])
            B["tpp"].append(None)
            B["tcp"].append(tcp_b)
            B["fl"].append(None)
            B["dec"].append(None)
            B["vdec"].append(None)

        rec = {
            "id": di, "n": name, "st": "QLD",
            "c": [[r["n"], r["ab"], r["pn"], r["b"], r["v"], 0, 1 if r["el"] else 0, 0] for r in rows],
            "inf": x["informal"],
            "tcp": tcp,
            "fl": fl,
            "h": [],
            "enrolled": x["enrolled"],
            "demo": demo[name],
            "seifa": seifa[name],
        }
        if tpp:
            rec["tpp"] = tpp
        D.append(rec)
        tot_formal += x["formal"]
        tot_inf += x["informal"]
        tot_enrolled += x["enrolled"]
        for r in rows:
            tot_prim[r["b"]] += r["v"]

    if dict(seats) != C["seats"]:
        ffail(f"seat counts {dict(seats)} != the ECQ oracle {C['seats']}")
    if (tot_formal, tot_inf, tot_enrolled) != (C["formal"], C["inf"], C["enrolled"]):
        ffail(f"tallies {(tot_formal, tot_inf, tot_enrolled)} != the ECQ totals"
              f" {(C['formal'], C['inf'], C['enrolled'])}")

    agg = {"prim": {k: tot_prim[k] for k in BUCKETS}, "formal": tot_formal, "inf": tot_inf,
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": dict(seats)}
    out = {"year": frame, "date": C["date"], "prev": None, "jurisdiction": "QLD",
           "demoBasis": "sa1", "flBasis": "modelled", "flowErr": flow_err,
           "agg": {"AUS": agg, "QLD": dict(agg)}, "divs": D, "booths": B}
    if C["demoYear"] != 2021:
        out["demoYear"] = C["demoYear"]
    # cobKeys and the booths' dec/demo/cob lanes are build_qld_boothcensus's,
    # never this script's (its stale-lane guard owns them)
    del cob_keys
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"data-{frame}.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1]) if tpp_tot[0] or tpp_tot[1] else None
    print(f"{frame} districts {len(D)} | seats {dict(seats)}"
          f" | classic-2PP ALP {round(tp, 2) if tp else '-'}%"
          f" | informal {round(100 * tot_inf / (tot_inf + tot_formal), 2)}%"
          f" | enrolled {tot_enrolled} | booths {len(B['id'])} {dict(sorted(types_seen.items()))}"
          f" | geocoded {geocoded} (tcp {tcp_booths}, zero-vote {zero_booths})"
          f" -> {os.path.getsize(p)} bytes")
