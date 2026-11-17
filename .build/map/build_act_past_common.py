#!/usr/bin/env python3
"""build_act_past_common.py — the ACT frames' past lane (h rows,
prev totals) across every boundary-era pair the state owns:

  act16 ← act12   Elections ACT's 2014 redistribution remade the
                  electorate map for act16 (five divisions, 25 members
                  versus 2012's three-division 17): Brindabella and
                  Ginninderra kept their names; Molonglo went with it
                  as Elections ACT plus Seats' own Kurrajong /
                  Murrumbidgee / Yerrabi arrived. The parent's elected
                  register comes off Elections ACT's own
                  elected.html-era print under
                  .build/state-flow-src/act/2012 (the first-party figure
                  lane everywhere—no reconstruction required).

Each pair's h rows stay [prevYear, lastElectedSharePct, ptag, name]
(four-cell protocol set by the sa18 era as sa21/sa22 territory), one per
elected member of the PARENT election in every division, with the share
computed as that member's first-preference count over the parent's
division formal total ×100, exactly two decimals.

Per-candidate swing cells (c[5]) ride the current frame's candidate
leafes against the parent's per-candidate first-preference votes over the
parent division formal total, matching candidates by cleaned name inside
the same division (candidates whose names never appear the parent era
carry c[5]=0 — new entrants, or a party-context change the database has
no better explanation for).

usage: python3 -I .build/map/build_act_past_common.py act<yy>
       (as the past phase after build_act<yy>_data.py on the same frame)
"""
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import act_parse  # noqa: E402
import warnings
warnings.simplefilter("ignore")

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(REPO, "map", "data")

PAIRS = {
    "act16": ("act12", 2012),
}


def fail(msg):
    raise SystemExit(f"build-tas-past: {msg}")


def _key(n):
    return "|".join(sorted(act_parse.nm_of(n).split()))


def pct_shares(formal_votes, parent_formal):
    if not formal_votes or not parent_formal:
        return None
    return round(100 * formal_votes / parent_formal, 2)


def _share_of(c_votes, formal):
    if not formal:
        return None
    return round(100 * c_votes / formal, 4)


RENAME_PARENT = {}
# act16↔act12: Brindabella and Ginninderra kept their names
# across the three-division→five-division redraw — Molonglo's
# abolition belongs to adjudication, not a rename pass
#: (frame, division-in-current-roster) -> division-name in the parent's
#: roster. the ACT's one ever rename across these pairs rides here,
#: adjudicated at .build/map/src/tas/past-adjudication.md


def parent_rows(frame):
    """H rows + candidate-level per-division vote data of the parent's era,
    pulled via load_frame on the parent frame id."""
    parent_id, parent_year = PAIRS[frame]
    pfr = act_parse.load_frame(parent_id)
    rows_by_div = {}
    for dv in act_parse.FRAMES[parent_id]["elects"]:
        cands = pfr["cands"].get(dv, [])
        rows_by_div[dv] = [{"n": c["n"], "pty": c["pty"], "votes": c["votes"]}
                           for c in cands]
    elected_by_div = {dv: pfr["elected"][dv] for dv in act_parse.FRAMES[parent_id]["elects"]}
    return pfr, rows_by_div, elected_by_div, parent_year


def main(frame):
    if frame not in PAIRS:
        fail(f"tas frame without a past pair defined: {frame}")
    data_p = os.path.join(OUT, f"data-{frame}.json")
    if not os.path.exists(data_p):
        fail(f"data-{frame}.json missing — run its data emitter first")
    cur = json.load(open(data_p))
    if cur["divs"] and cur["divs"][0]["h"]:
        fail(f"{frame} already carries past rows — rerun its data emitter first")
    pfr, rows_by_div, elected_by_div, parent_year = parent_rows(frame)

    # per-division pprim/pformal from the parent's divisions (counterparty
    # parts of its agg) over the parent's own primary-vote records
    parent_id, parent_year = PAIRS[frame]
    pprim = {}
    pformal_total = sum(v for v in pfr["formal"].values() if v is not None)
    for dv in act_parse.FRAMES[parent_id]["elects"]:
        for cc in rows_by_div[dv]:
            b = act_parse.bucket_of(cc["pty"])
            pprim[b] = pprim.get(b, 0) + cc["votes"]

    cur_agg = cur["agg"]["ACT"]
    cur_agg["pformal"] = pformal_total
    cur_agg["pprim"] = {k: pprim.get(k, 0) for k in ("alp", "lnp", "grn", "onp", "ind", "oth")}
    cur["agg"]["AUS"]["pformal"] = pformal_total
    cur["agg"]["AUS"]["pprim"] = cur_agg["pprim"]

    year_int = parent_year

    # candidates' swing cells (c[5]) under the parent's votes per division.
    # Divisions the parent era never carried (the 2014 redistribution's
    # three new ACT names: Kurrajong / Murrumbidgee / Yerrabi + Molonglo
    # abolished-by-it) skip every parent lane: h stays empty and c[5]
    # stays 0 as the adjudication doc records.
    errors_prime = []
    no_parent_divs = {dv for dv in [d["n"] for d in cur["divs"]]
                      if dv not in pfr.get("formal", {})}
    for dv_rec in cur["divs"]:
        dv = dv_rec["n"]
        dv_parent = RENAME_PARENT.get((frame, dv), dv)
        if dv_parent in no_parent_divs:
            dv_rec["h"] = []
            for candrec in dv_rec["c"]:
                candrec[5] = 0
            continue
        p_c = {_key(p["n"]): p for p in rows_by_div.get(dv_parent, [])}
        parent_formal = pfr["formal"][dv_parent]
        def _find_member_by_name(nm, cands):
            """Elected-register names arrive in several shapes across eras:
            act12's hub prints surname-only ('White'), act16/18 print full
            names with commas, the 21-series pages print 'GUTWEIN, Peter' or
            the psephos mixed-cap shapes. Resolves to exactly one row."""
            want = act_parse.nm_of(nm)
            direct = [c for c in cands if act_parse.nm_of(c["n"]) == want]
            if direct:
                return direct[0]
            if want and " " not in want:
                sur = want
                surnames_of = lambda c: act_parse.nm_of(c["n"]).split()
                alone = [c for c in cands if surnames_of(c) and surnames_of(c)[-1] == sur]
                if len(alone) == 1:
                    return alone[0]
                closer = [c for c in cands if sur in surnames_of(c)]
                if len(closer) == 1:
                    return closer[0]
                return None
            if "," in nm:
                sur = nm.split(",")[0].strip()
                hits = [c for c in cands
                        if act_parse.nm_of(sur) in act_parse.nm_of(c["n"]).split()]
                if len(hits) == 1:
                    return hits[0]
            tokens = act_parse.nm_of(nm).split()
            if len(tokens) == 2 and len(tokens[1]) == 1:
                # act12's hub disambiguates same-surname elected members by
                # initial suffix ("O'Byrne M" / "O'Byrne D"): the parent's
                # candidate register names them "Given SURNAME" —
                # initial matches the first given token's first letter
                sur, initial = tokens
                surk = act_parse.nm_of(sur)
                cand_list = [c for c in cands
                             if surk in act_parse.nm_of(c["n"]).split()]
                hits = []
                for c in cand_list:
                    words = act_parse.nm_of(c["n"]).split()
                    given = [w for w in words if w != surk]
                    if given and given[0] and given[0][0] == initial:
                        hits.append(c)
                if len(hits) == 1:
                    return hits[0]
                if len(cand_list) == 1:
                    return cand_list[0]
            return None

        hs = []
        for papert in elected_by_div.get(dv_parent, []):
            nm = papert["n"]
            ptc = papert["pty"]
            # find this elected member's vote count in the parent's cands
            m = None
            m = _find_member_by_name(nm, rows_by_div[dv_parent])
            if m is None:
                faile = (f"{frame}/{dv}: parent's elected list's {nm!r} lacks a "
                         f"candidate row on its own division print")
                errors_prime.append(faile)
                continue
            share = _share_of(m["votes"], parent_formal)
            hs.append([year_int, share, act_parse.bucket_of(ptc), nm])
        hs.sort(key=lambda h: (h[2] in ("lnp",), -(h[1] or 0)))
        dv_rec["h"] = hs
        for candrec in dv_rec["c"]:
            nm_dash = _key(candrec[0])
            if nm_dash in p_c:
                pp = p_c[nm_dash]
                prev_share = _share_of(pp["votes"], parent_formal)
                cur_share = _share_of(candrec[4], dv_rec.get("formal")
                                       or dv_rec.get("formal_votes"))
                if prev_share is not None and cur_share is not None:
                    candrec[5] = round(cur_share - prev_share, 2)
                else:
                    candrec[5] = 0
            else:
                candrec[5] = 0

    if errors_prime:
        for e in errors_prime:
            print("WARN:", e)

    # tas-parent oracles (hard guard constants): pass when composite cheap
    unregister = sum(len(dv["h"]) for dv in cur["divs"])
    pcfg = act_parse.FRAMES[f"act{str(year_int)[2:]}"]
    # expected h sum is parent members' rolling total over the CURRENT
    # divisions that carry onto a parent division (its electorate map
    # under a 2014 era era dies Molonglo with its seven members never
    # airing at this land's act16 downstate at all).
    cur_div_names = [d["n"] for d in cur["divs"]]
    expect = 0
    for dvn in cur_div_names:
        pdn = RENAME_PARENT.get((frame, dvn), dvn)
        if pdn not in pfr.get("formal", {}):
            continue
        pmb = pcfg.get("members_by_div", {}).get(pdn, pcfg.get("members", 5))
        expect += pmb
    if unregister != expect:
        fail(f"h-row count {unregister} != parent's share of the register {expect}")

    with open(data_p, "w") as f:
        json.dump(cur, f, separators=(",", ":"), ensure_ascii=False)
    nswing = sum(1 for dv in cur["divs"] for c in dv["c"] if c[5] != 0)
    print(f"{frame}: parent {year_int}, h rows {unregister}, swings {nswing},"
          f" pformal {pformal_total} -> {data_p}")


if __name__ == "__main__":
    main(sys.argv[-1] if len(sys.argv) > 1 else "act20")
