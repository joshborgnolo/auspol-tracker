"""sa_flow_lane.py – the /map/ preferences lane for a South Australian frame,
shared by build_sa26_data.py and build_sa22_data.py.

The store is .build/estimate-state-flows.py's MODELLED per-district flows
(data/sa<yy>-flows.json, written only when its federal back-test gates pass —
the ECSA publishes a distribution of preferences, never where each party's own
voters ended): `flows` the districts whose final was Labor v Liberal, buckets
grn/onp/oth; `contests` those whose final was Labor v One Nation, buckets
grn/lnp/oth; each cell [to Labor, to the other finalist]. The estimator folds
independents into oth (its SA loader buckets IND -> oth), so grouping keys on
the STORE bucket, not the display fam: ind rides the oth cell.

A district's rows are [candidateRow, to the tcp's first finalist, to its
second] — the federal lanes' order, which the app reads through the Labor side
— each bucket's cell apportioned over its candidates in proportion to first
preferences, the last candidate taking the remainder.
"""
import json
import os

CLASSIC = {"grn", "onp", "oth"}
CONTEST = {"grn", "lnp", "oth"}


def load_store(path, fail):
    """(flows, contests, flowErr) from the store; flowErr carries the per-seat
    p90s the UI quotes (ind = oth's), plus vsOnp, the Labor v One Nation table's
    totals-only errors (lnp its Liberal cell), when the frame has contests."""
    if not os.path.exists(path):
        fail(f"flows store {path} missing — run .build/estimate-state-flows.py")
    with open(path) as f:
        d = json.load(f)
    flows, contests = d.get("flows"), d.get("contests") or {}
    if not isinstance(flows, dict) or len(flows) != d.get("nClassic"):
        fail(f"flows store: {len(flows or {})} districts vs nClassic {d.get('nClassic')!r}")
    if len(contests) != d.get("nContest", 0):
        fail(f"flows store: {len(contests)} Labor v One Nation districts vs nContest {d.get('nContest')!r}")
    for store, ok in ((flows, CLASSIC), (contests, CONTEST)):
        for name, fl in store.items():
            if set(fl) - ok:
                fail(f"flows store: {name} carries buckets {sorted(set(fl) - ok)}")
            for b, cell in fl.items():
                if min(cell) < 0:
                    fail(f"flows store: {name}.{b} has a negative share {cell}")
    err = d.get("seaterr") or {}
    for b in CLASSIC:
        if not (err.get(b) or {}).get("p90"):
            fail(f"flows store: seaterr.{b}.p90 missing")
    flow_err = {"grn": err["grn"]["p90"], "onp": err["onp"]["p90"], "oth": err["oth"]["p90"], "ind": err["oth"]["p90"]}
    if contests:
        ce = d.get("contestErr") or {}
        if not all(ce.get(b) for b in ("lib", "grn", "oth")):
            fail("flows store: contestErr lacks lib/grn/oth")
        flow_err["vsOnp"] = {"lnp": ce["lib"], "grn": ce["grn"], "oth": ce["oth"], "ind": ce["oth"]}
    return flows, contests, flow_err


def flow_rows(name, rows, pair, first, cid2row, flows, contests, fail):
    """the district's fl rows; pair is the final's two buckets, first the
    bucket of the tcp's first finalist. [] where the final wasn't Labor
    against the Liberals or One Nation."""
    if pair == {"alp", "lnp"}:
        rival, st = "lnp", flows.get(name)
    elif pair == {"alp", "onp"}:
        rival, st = "onp", contests.get(name)
    else:
        return []
    if st is None:
        fail(f"{name}: Labor v {rival} district missing from the flows store — rerun estimate-state-flows.py")
    alp_first = first == "alp"
    by_b = {}
    for r in rows:
        if r["b"] in ("alp", rival):
            continue
        by_b.setdefault("oth" if r["b"] == "ind" else r["b"], []).append(r)
    fl = []
    for b, cands in by_b.items():
        tot_v = sum(r["v"] for r in cands)
        if tot_v == 0:
            continue
        cell = st.get(b)
        if cell is None or sum(cell) == 0:
            fail(f"{name}: flows store lacks a {b} cell the district's first preferences need")
        al, cl = cell
        acc = [0, 0]
        for i, r in enumerate(cands):
            if i < len(cands) - 1:
                ta, tc = round(al * r["v"] / tot_v), round(cl * r["v"] / tot_v)
                acc[0] += ta
                acc[1] += tc
            else:
                ta, tc = al - acc[0], cl - acc[1]
            fl.append([cid2row[r["cid"]], ta, tc] if alp_first else [cid2row[r["cid"]], tc, ta])
    fl.sort()
    return fl
