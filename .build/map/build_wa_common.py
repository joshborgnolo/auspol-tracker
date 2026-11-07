#!/usr/bin/env python3
"""build_wa_common.py — the shared /map/ frame emitter for Western
Australia's three state-election frames (wa17, wa21, wa25). The qld
discipline on the WAEC's own products: wa_eis.py (same directory) parses the
EIS results-API mirror into one district stream; this file emits the
federal res schema (.build/map/app/app-1-base.js deriveDiv) from it.

Sources per frame (none of it fetched here — the mirrors are the source of
truth, .build/map/harvest-wa-src.py assembles them):
  all     .build/state-flow-src/wa/sg<>/{CODE}.json  (EIS per-district
          results + tallies), .build/map/src/wa/sg<>-{root,candidates}.json
          (count card + label points; the candidate roster's long names)
  geo     venue registers .build/map/src/wa/pp-<yyyy>.xlsx (2017 official,
          2021/2025 Tally Room)

The booth lane is REAL venues only (day booths + early voting centres).
Count-Centre pseudo rows (Absent / Early-by-Post / Early-in-Person /
Provisional) and the 2017/2021-era aggregate "Special Institutions,
 Hospitals & Remotes" row fold into the district totals and never enter the
lane; lane formal + pseudo formal == district formal, per party-code and
statewide, asserted.

Tally oracles asserted against the emitted numbers (fail-loud; the seats
are the 2CP winners' own party codes — the only official-seat roll the
frames need):
  frame   seats                               formal    informal  enrolled
  wa17    ALP 41 LIB 13 NAT 5                1321640    62860     1593222
  wa21    ALP 53 NAT 4 LIB 2                 1411990    55169     1716732
  wa25    ALP 46 LIB 7 NATS 6                1527968    69071     1868946
(the turnout figures 1384500 / 1467159 / 1597039 — formal+informal sums —
stay quoted in the print line, not as oracle cells: the tally check compares
formal counts cleanly against WAEC's per-district FORMAL column)

Two-party semantics: WA's district 2CP is emitted per district as-is; the
classic line (district tpp, ALP vs Lib-fam) covers ALP-v-LIB AND
ALP-v-NAT pairs — The Nationals WA ride the lnp fam everywhere on /map/
(FAM(NAT)="lnp"), which is also how the app's `classic` predicate meets
them. There is no statewide  predators-2PP published; agg.tpp sums the
classic-paired districts like qld's.

usage: python3 -I .build/map/build_wa<yy>_data.py <out_dir>
then:  MAPSHAPER="$PWD/node_modules/.bin/mapshaper" \\
         node .build/map/geo_build.mjs .build/map/src/wa maps/data maps/data --years=wa<yy>
"""
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wa_eis

REPO = wa_eis.REPO
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "maps", "data")

FRAMES = {
    "wa17": {"year": "wa17", "date": "2017-03-11", "jurisdiction": "WA",
             "seats": {"ALP": 41, "LIB": 13, "NAT": 5},
             "formal": 1321640, "inf": 62860, "enrolled": 1593222,
             "demoYear": 2016},
    "wa21": {"year": "wa21", "date": "2021-03-13", "jurisdiction": "WA",
             "seats": {"ALP": 53, "NAT": 4, "LIB": 2},
             "formal": 1411990, "inf": 55169, "enrolled": 1716732,
             "demoYear": 2021},
    "wa25": {"year": "wa25", "date": "2025-03-08", "jurisdiction": "WA",
             "seats": {"ALP": 46, "LIB": 7, "NATS": 6},
             "formal": 1527968, "inf": 69071, "enrolled": 1868946,
             "demoYear": 2021},
}


def frame_fail(frame):
    def f(msg):
        raise SystemExit(f"{frame}: {msg}")
    return f


def load_tcp25(ffail):
    """The Tally Room's WA-2025-LA-2CP-PollingPlace.xlsx, keyed for booth joins:
    {(district-key, venue-key): {surname-key: votes}}. Party codes in the file
    differ from EIS's ("NAT" for EIS's "NATS") so the surname alone keys a
    row — the emitter still asserts both pair candidates resolve on the
    district roster."""
    p = os.path.join(REPO, ".build", "map", "src", "wa", "tcp-2025.xlsx")
    if not os.path.exists(p):
        ffail("tcp-2025.xlsx missing — run .build/map/harvest-wa-src.py --fetch (or drop the wa25 tcp lane)")
    regs = {}
    rows = wa_eis.openpyxl_rows(p)
    h = [str(c).lower().strip() if c is not None else "" for c in rows[0]]
    try:
        i = {k: h.index(k) for k in ("district_name", "pp_name", "surname", "votes")}
    except ValueError:
        ffail(f"tcp-2025.xlsx header drifted: {h[:12]}")
    for r in rows[1:]:
        if r[i["district_name"]] is None:
            continue
        k = (wa_eis.norm_key(r[i["district_name"]]), wa_eis.norm_key(r[i["pp_name"]]))
        regs.setdefault(k, {})[wa_eis.norm_key(r[i["surname"]])] = int(float(r[i["votes"]]))
    return regs


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
    if not isinstance(demo, dict) or len(demo) != 59:
        ffail(f"demo store covers {len(demo or {})} districts, expected 59")
    if not isinstance(seifa, dict) or len(seifa) != 59:
        ffail(f"SEIFA store covers {len(seifa or {})} districts, expected 59")
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
    src = wa_eis.load(frame)
    demo, seifa, cob_keys = load_census(frame, ffail)
    TCP25 = load_tcp25(ffail) if frame == "wa25" else {}
    dropped25 = []

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

        tcp25 = TCP25
        surmap = {c["key"]: wa_eis.norm_key(c["sur"]) for c in x["cands"]}
        pair_surs = [surmap[pair_keys[0]], surmap[pair_keys[1]]]

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
            tcell = None
            if frame == "wa25":
                row25 = tcp25.get((wa_eis.norm_key(name), wa_eis.norm_key(b["name"])))
                if row25 is not None:
                    cell = [row25.get(pair_surs[0]), row25.get(pair_surs[1])]
                    if None in cell:
                        ffail(f"{name}: booth {b['name']!r} 2CP pair {pair_surs} "
                              f"not both present in the venue split")
                    formal = sum(vrow)
                    # per-venue parity: the Tally Room's 2CP may sit few votes off
                    # the FP formal (recount-era deltas swing a handful), but a
                    # venue that sits further out is mislabelled — Balcatta's two
                    # schools trade totals in the file, exactly this. Dropping a
                    # mislabelled row is honest; keeping a close one is fine.
                    if formal == 0 or abs(sum(cell) - formal) <= max(10, formal // 200):
                        tcell = cell
                        tcp_booths += 1
                    else:
                        dropped25.append((name, b["name"], sum(cell), formal))
            B["tcp"].append(tcell)
            B["fl"].append(None)
            B["dec"].append(None)
            B["vdec"].append(None)

        rec = {
            "id": di, "n": name, "st": "WA",
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
        ffail(f"tallies {(tot_formal, tot_inf, tot_enrolled)} != the WAEC totals"
              f" {(C['formal'], C['inf'], C['enrolled'])}")

    agg = {"prim": {k: tot_prim[k] for k in ("alp", "lnp", "grn", "onp", "ind", "oth")},
           "formal": tot_formal, "inf": tot_inf,
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": dict(seats)}
    out = {"year": frame, "date": C["date"], "prev": None, "jurisdiction": "WA",
           "demoBasis": "sa1",
           "agg": {"AUS": agg, "WA": dict(agg)}, "divs": D, "booths": B}
    if C["demoYear"] != 2021:
        out["demoYear"] = C["demoYear"]
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
          f" | geocoded {geocoded} | booth-tcp {tcp_booths} (dropped {len(dropped25)})"
          f" -> {os.path.getsize(p)} bytes")
    for dname, vname, have, want in dropped25[:10]:
        print(f"   tcp drop: {dname} · {vname} — TR 2CP {have} vs FP formal {want}")
