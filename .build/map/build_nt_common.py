#!/usr/bin/env python3
"""build_nt_common.py — the shared /map/ frame emitter for the Northern
Territory's three Legislative Assembly frames (nt16, nt20, nt24). The
wa/qld discipline on the NTEC mirror: nt_parse.py (same directory) parses
the committed results-page mirror into one district stream; this file
emits the federal res schema (.build/map/app/app-1-base.js deriveDiv)
from it.

Sources per frame (none of it fetched here — the mirrors are the source of
truth, .build/map/harvest-nt-src.py assembles and verifies them):
  all     .build/state-flow-src/nt/<YYYY>/<division>.html   (per-division
          NTEC pages: candidate/TCP summary, FP+TCP by voting centre,
          tallies) + .build/map/src/nt/pp-nt.json venue coordinates
  past    .build/state-flow-src/nt/2012/ (psephos transcription + the
          official NTEC statistical report, division-level only)

The booth lane is REAL venues only (day booths + early voting centres —
338 located rows over the three elections). Mobile-team rows (the bulk of
remote NT voting), Absent, Declaration, Postal and the 2016-era
"Early (…)" aggregates fold into the district totals and never appear as
dots; per-candidate and per-TCP-pair identities against the district
totals are asserted fail-loud in nt_parse.py's facade.

Tally oracles asserted against the emitted numbers (fail-loud):
  frame   seats                        formal   informal  enrolled
  nt16    ALP 18 IND 5 CLP 2            98299      2005     135506
  nt20    ALP 14 CLP 8 TA 1 IND 2      102172      3661     141225
  nt24    CLP 17 ALP 4 IND 3 GRN 1     101741      3160     153249
(nt24 enrolled is the page-sum figure: NTEC's per-division pages total
153,249 against its printed territory roll of 153,248 — the mirrored
per-division figures are what's reconciled here; the one-elector roll
difference is recorded, never smoothed. 2012's oracle lives in
build_nt_past_common — the same page discipline says the psephos
transcription's Sanderson roll sits 10 high vs the official report and is
corrected at parse time, per PSEPHOS_2012_ROLL_OVERRIDES.)

Two-party semantics: district TCP pairs emit as-is; the classic line
(district tpp) covers ALP-v-CLP pairs — the Country Liberal Party rides
the lnp fam everywhere on /map/ (FAM(CLP)="lnp") which is also how the
app's `classic` predicate meets it. Party long-names come off each page's
Parties register, the flow machinery's LONG_NAMES map as fallback.

usage: python3 -I .build/map/build_nt<yy>_data.py map/data
then:  MAPSHAPER="$PWD/node_modules/.bin/mapshaper" \\
         node .build/map/geo_build.mjs .build/map/src/nt map/data map/data --years=nt<yy>
"""
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nt_parse

REPO = nt_parse.REPO
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

FRAMES = {
    "nt16": {"year": "nt16", "date": "2016-08-27", "jurisdiction": "NT",
             "seats": {"ALP": 18, "Ind": 5, "CLP": 2},
             "formal": 98299, "inf": 2005, "enrolled": 135506,
             "demoYear": 2016},
    "nt20": {"year": "nt20", "date": "2020-08-22", "jurisdiction": "NT",
             "seats": {"ALP": 14, "CLP": 8, "TA": 1, "Ind": 2},
             "formal": 102172, "inf": 3661, "enrolled": 141225,
             "demoYear": 2021},
    "nt24": {"year": "nt24", "date": "2024-08-24", "jurisdiction": "NT",
             "seats": {"CLP": 17, "ALP": 4, "Ind": 3, "GRN": 1},
             "formal": 101741, "inf": 3160, "enrolled": 153249,
             "demoYear": 2021},
}


def frame_fail(frame):
    def f(msg):
        raise SystemExit(f"build-nt-{frame}: {msg}")
    return f


def load_census(frame, ffail):
    demo_path = os.path.join(REPO, "data", f"{frame}-demo.json")
    seifa_path = os.path.join(REPO, "data", f"{frame}-seifa.json")
    if not os.path.exists(demo_path):
        ffail(f"census store {demo_path} missing — run .build/map/build_{frame}_demo.py")
    dd = json.load(open(demo_path))
    if dd.get("year") != frame or dd.get("demoBasis") != "sa1":
        ffail(f"demo store is year {dd.get('year')!r} basis {dd.get('demoBasis')!r},"
              f" expected {frame}/sa1")
    if not os.path.exists(seifa_path):
        ffail(f"SEIFA store {seifa_path} missing — run .build/map/build_{frame}_seifa.py")
    sd = json.load(open(seifa_path))
    if sd.get("year") != frame:
        ffail(f"SEIFA store is year {sd.get('year')!r}, expected {frame}")
    demo, seifa = dd.get("demo"), sd.get("seifa")
    if not isinstance(demo, dict) or len(demo) != 25:
        ffail(f"demo store covers {len(demo or {})} divisions, expected 25")
    if not isinstance(seifa, dict) or len(seifa) != 25:
        ffail(f"SEIFA store covers {len(seifa or {})} divisions, expected 25")
    for name, row in seifa.items():
        for ix in ("irsad", "irsd", "ier", "ieo"):
            c = (row or {}).get(ix) or {}
            if not (isinstance(c.get("v"), (int, float)) and isinstance(c.get("dec"), int)
                    and isinstance(c.get("pct"), (int, float))):
                ffail(f"SEIFA store: {name}.{ix} lacks a {{v, pct, dec}} cell"
                      f" — rerun build_{frame}_seifa.py")
    return demo, seifa, dd.get("cobKeys") or []


def data_main(frame):
    ffail = frame_fail(frame)
    C = FRAMES[frame]
    src = nt_parse.load(frame)
    demo, seifa, cob_keys = load_census(frame, ffail)

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
            ffail(f"census store lacks division {name} — the frame's names moved")
        rows = []
        for c in x["cands"]:
            key = c["key"]
            rows.append({
                "cid": key, "key": key, "n": c["n"], "ab": c["ab"],
                "pn": c["pn"], "b": c["b"], "v": c["v"],
                "el": key == x["elected"],
            })
        rows.sort(key=lambda r: -r["v"])
        if not any(r["el"] for r in rows):
            ffail(f"{name}: elected key {x['elected']} not on the roster")
        w = next(r for r in rows if r["el"])
        seats[w["ab"]] += 1

        pair_keys = [t["key"] for t in x["tcp"]]
        pair_votes = [t["v"] for t in x["tcp"]]
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

        for bk, b in enumerate(x["booths"]):
            types_seen[b["ty"]] += 1
            vrow = list(b["pv"])
            if b.get("informal") is None:
                ffail(f"{name}: booth {b['name']!r} informal missing")
            if sum(vrow) == 0:
                zero_booths += 1
            if b.get("lat") is not None:
                geocoded += 1
            B["d"].append(di)
            B["id"].append(f"{frame}-{di}-{bk}")
            B["n"].append(b["name"])
            B["ty"].append(b["ty"])
            B["prem"].append(None)
            B["sub"].append(None)
            B["pc"].append(None)
            B["lat"].append(round(b["lat"], 5) if b["lat"] is not None else None)
            B["lon"].append(round(b["lon"], 5) if b["lon"] is not None else None)
            B["v"].append(vrow)
            B["inf"].append(b.get("informal"))
            B["tpp"].append(None)
            # booth tcp cells ride the TCP-by-centre table the mirror
            # carries (2016-2024 all three); the ordering is the division
            # tcp pair's own order
            B["tcp"].append(list(b["tcp"]) if b.get("tcp") else None)
            if b.get("tcp"):
                tcp_booths += 1
            B["fl"].append(None)
            B["dec"].append(None)
            B["vdec"].append(None)

        rec = {
            "id": di, "n": name, "st": "NT",
            "c": [[r["n"], r["ab"], r["pn"], r["b"], r["v"], 0, 1 if r["el"] else 0, 0] for r in rows],
            "inf": x["informal"],
            "tcp": tcp,
            "fl": [],
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
        ffail(f"seat counts {dict(seats)} != the oracle {C['seats']}")
    if (tot_formal, tot_inf, tot_enrolled) != (C["formal"], C["inf"], C["enrolled"]):
        ffail(f"tallies {(tot_formal, tot_inf, tot_enrolled)} != the NTEC totals"
              f" {(C['formal'], C['inf'], C['enrolled'])}")

    agg = {"prim": {k: tot_prim[k] for k in ("alp", "lnp", "grn", "onp", "ind", "oth")},
           "formal": tot_formal, "inf": tot_inf,
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": dict(seats)}
    out = {"year": frame, "date": C["date"], "prev": None, "jurisdiction": "NT",
           "demoBasis": "sa1",
           "agg": {"AUS": agg, "NT": dict(agg)}, "divs": D, "booths": B}
    if C["demoYear"] != 2021:
        out["demoYear"] = C["demoYear"]
    del cob_keys
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"data-{frame}.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1]) if tpp_tot[0] or tpp_tot[1] else None
    print(f"{frame} divisions {len(D)} | seats {dict(seats)}"
          f" | classic-2PP ALP {round(tp, 2) if tp else '-'}%"
          f" | informal {round(100 * tot_inf / (tot_inf + tot_formal), 2)}%"
          f" | enrolled {tot_enrolled} | booths {len(B['id'])} {dict(sorted(types_seen.items()))}"
          f" | geocoded {geocoded} | booth-tcp {tcp_booths}"
          f" -> {os.path.getsize(p)} bytes")
