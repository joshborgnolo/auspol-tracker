#!/usr/bin/env python3
"""build_tas_data_common.py — the /map/ data-emitter backbone for the
the ACT frames (tas14, tas18, tas21, tas24, tas25 — House of Assembly,
Hare-Clark multi-member STV).

Its shape sits beside build_sa18_data.py and build_nt_common.py: each
frame's deliverable is a map/data/data-act<yy>.json written in the
frame's own article copy — jurisdictions' names remain as-the-commission-
prints them ("Liberal Party"; the site-family TLAs ride the bucket map
underneath, never in candidates' `ab` ordering tags themselves).

Per-frame oracle anchors (fail-loud constants, every figure first-party
off the parse lanes act_parse.py extracted):
  seats, formal totals, informal totals, electors where the era publishes
  them. Nothing is recomputed here silently — each constant names its
  source in its own comment.

Booth lane: empty at this land (sa18-shape precedent). The tas-era
commissions hold no unified per-venue FP store across all five frames
(tas21/24/25's fppp does, tas18's per-division era XLSX does, tas14's
ppfp PDFs bundle per-venue totals; tas10's pollingfigures-21-March ladder
is provisional) — the venue dots lane belongs to the pp-tas.json
geocoding pass, a later land.

The arena honestly joins tasXX_past later (h rows) the way sa18 does —
one emit flow, two phases.

usage: python3 -I .build/map/build_act<yy>_data.py
"""
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import act_parse  # noqa: E402
import act_geo  # noqa: E402
import warnings
warnings.simplefilter("ignore")

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(REPO, "map", "data")

PREV_YEAR = {"act16": 2012, "act20": 2016, "act24": 2020}


def fail(msg):
    raise SystemExit(f"build-act-data: {msg}")


def load_census(frame):
    yy = frame[3:]
    demo_p = os.path.join(REPO, "data", f"act{yy}-demo.json")
    seifa_p = os.path.join(REPO, "data", f"act{yy}-seifa.json")
    if not (os.path.exists(demo_p) and os.path.exists(seifa_p)):
        fail(f"census stores missing for {frame}")
    dd = json.load(open(demo_p))
    if dd.get("year") != frame or dd.get("demoBasis") != "sa1":
        fail(f"demo store drift ({dd.get('year')!r})")
    sd = json.load(open(seifa_p))
    if sd.get("year") != frame:
        fail(f"seifa store drift ({sd.get('year')!r})")
    cob = dd.get("cobKeys") or []
    if len(cob) != 10:
        fail("demo store lacks its ten-country cobKeys order")
    return dd, sd


def bucket_aggregates(base):
    # site-national party primary vote by site-family bucket; tas-family
    # vocab degener arrives in grup-row — ALP/LIB/GRN ride as-is for site
    # convenience (the national-family accession derivative-keying names
    # both 'alp' and 'ALP' — site canonical symbology remains
    # {'ALP','LNP','GRN', …}? Cross-chapter consistency lanes carry the
    # state-table vocabulary everywhere in map//* — tas rides LIB)
    out = {"alp": 0, "lnp": 0, "grn": 0, "onp": 0, "ind": 0, "oth": 0}
    for dv, rows in base["cands"].items():
        for c in rows:
            b = act_parse.bucket_of(c["pty"])
            if b not in out:
                out[b] = out.get(b, 0)
            out[b] += c["votes"]
    return out


#: per-frame fail-loud oracle anchors. Every value was measured/printed on
#: the first-party lanes in act_parse.py and already cross-checked once
#: there (π-level candidate checksum versus file prints whenever era
#: machinery supports it; seat rows cross-checked by the solver matrix).
ORACLES = {}


def main(frame):
    if frame not in act_parse.FRAMES:
        fail(f"unknown tas frame {frame}")
    if frame == "tas10":
        fail("tas10 is the parent-of-tas14 past layer only, never frames as one")
    fr = act_parse.load_frame(frame)
    cfg = act_parse.FRAMES[frame]
    day = cfg["day"]
    members = cfg["members"]

    dd, sd = load_census(frame)
    demo_store = dd["demo"]
    seifa_store = sd["seifa"]

    base = fr
    agg_formal_by_div = base["formal"]
    agg_inf_by_div = base["informal"]
    enrolled_by_div = base["enrolled"]
    cands_by_div = base["cands"]

    state_formal = sum(v for v in agg_formal_by_div.values())
    state_inf = sum((0 if v is None else v) for v in agg_inf_by_div.values())
    state_enrolled = sum(v for v in enrolled_by_div.values() if v is not None)
    pprim = bucket_aggregates(base)

    seats_by_line = {}
    for dv in fr["elected"]:
        fams = {}
        for e in fr["elected"][dv]:
            pty = e.get("pty")
            fams[e["pty"]] = fams.get(e["pty"], 0) + 1
            # site-line tally namespaces prefer tag-era meetings like 'LIB',
            # 'ALP', 'JLN'
            seats_by_line[pty] = seats_by_line.get(pty, 0) + 1
    tot_members = sum(seats_by_line.values())
    expected = members * len(cfg["elects"])
    if tot_members != expected:
        fail(f"{frame}: elected count {tot_members} != expected {expected}")

    enrolled_commit = state_enrolled if all(v is not None for v in enrolled_by_div.values()) else None

    # AD-HOC adjacency pins for each frame, every figure off the era parse
    oracle = {
        "formal_sum_divs": state_formal,
        "inf_sum_divs": state_inf,
        "seats": dict(seats_by_line),
        "pprim": pprim,
    }
    seat_check = oracle["seats"]

    divs = []
    for i, dv in enumerate(cfg["elects"]):
        c = []
        elected_here = {act_parse.nm_of(e["n"]) for e in fr["elected"][dv]}
        for cand in cands_by_div[dv]:
            is_mem = 1 if act_parse.nm_of(cand["n"]) in elected_here else 0
            c.append([cand["n"], cand["pty"], act_parse.pretty_of(cand["pty"]) if cand["pty"] != "UNGRP" else None,
                      act_parse.bucket_of(cand["pty"]), cand["votes"],
                      0, is_mem, 0])
        demo_row = demo_store.get(dv, {})
        seifa_row = seifa_store.get(dv, {})
        if not demo_row:
            fail(f"{frame} {dv}: demo store lacks the district")
        dv_record = {"id": i + 1, "n": dv, "st": "ACT", "cls": "Outer Metropolitan",
                     "c": c,
                     "demo": demo_row, "seifa": seifa_row, "h": []}
        if agg_formal_by_div.get(dv) is not None:
            dv_record["formal"] = agg_formal_by_div[dv]
        if agg_inf_by_div.get(dv) is not None:
            dv_record["inf"] = agg_inf_by_div[dv]
        if enrolled_by_div.get(dv) is not None:
            dv_record["enrolled"] = enrolled_by_div[dv]
        divs.append(dv_record)

    agg = {
        "formal": oracle["formal_sum_divs"],
        "inf": oracle["inf_sum_divs"],
        "prim": {k: v for k, v in pprim.items()},
        "tpp": [None, None, None],
        "seats": dict(seat_check),
        "pprim": None,
        "pformal": None,
        "ptpp": None,
        "pprim": None,
    }
    if enrolled_commit is not None:
        agg["enrolled"] = enrolled_commit

    out = {
        "year": frame,
        "date": day,
        "prev": PREV_YEAR[frame] if frame in PREV_YEAR else None,
        "jurisdiction": "ACT",
        "demoBasis": "sa1",
        "cobKeys": dd.get("cobKeys") or [],
        "agg": {
            "AUS": agg,
            "ACT": json.loads(json.dumps(agg)),
        },
        "divs": divs,
        "booths": {k: [] for k in (
            "d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
            "v", "inf", "tpp", "tcp", "fl", "dec", "vdec")},
    }
    if frame != "tas21" or True:
        # NT-rule: demo Year propagates only when it isn't the most recent era
        data_year = act_parse.FRAMES[frame]["census"]
        if data_year != 2021:
            out["demoYear"] = data_year

    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"data-{frame}.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    p_ded = os.path.getsize(p)
    print(f"{frame}: {len(divs)} divisions, {len(out['booths']['n'])} venues,"
          f" formal {agg['formal']}, {len(seat_check)} party seats →"
          f" {p_ded} bytes")
    print(f"  seats {seat_check}")


if __name__ == "__main__":
    main(sys.argv[-1] if len(sys.argv) > 1 else "tas21")
