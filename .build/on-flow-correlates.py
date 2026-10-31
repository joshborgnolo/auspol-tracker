"""on-flow-correlates.py – which seat characteristics move One Nation's
preference split between the Coalition and Labor?

Asked 2026-10-31: find correlates of ON preference flows to the Coalition
(vs Labor) in the elections on /map/, using the map's own data stores; if
the levels say nothing, try deviations from each election's mean.

Universe: map/data/res-<key>.json rows where One Nation stood and its
ballots were redistributed (the divs[].fl array). Federal 1998-2025 plus
the state elections on the map (nsw23, qld17/20/24, sa22, sa26); vic22
carries no flows. Every explanatory field comes from the same res store:
ON first preferences (c[] group "onp"), AEC class (cls, federal only),
SEIFA percentiles (seifa), seat history (h, prior winner), and the TPP
margin (tpp).

Outcome: ON-to-Coalition share = toCoal / (toALP + toCoal) over seats
whose final pair was Labor v a Coalition party (the classic lens). Rows
landing on non-major finalists (Bean 2025's IND, Kennedy's KAP) and NSW's
exhausted ballots are counted separately and join only the
all-preferences robustness cut.

Guards (run to the vote, stop on any failure):
  G1  ON first preferences summed over seats equal the file's own agg
      prim.onp, every election.
  G2  Federal classic-row ON totals equal data/fed-class-flows.json's
      four classes summed (its onp votes, per year).
  G3  QLD/SA per-seat ON pairs equal data/<jur><yy>-flows.json's onp rows.
  G4  nsw23 classic-filtered ON totals equal data/state-flows.csv's
      nsw/2023/onp est_vote columns.

Analysis is ballot-weighted throughout; WLS over within-election demeaned
variables is a weighted election fixed-effects fit. Stdlib only; reads
committed stores; writes nothing.
Usage: python3 .build/on-flow-correlates.py
"""

import gzip
import json
import math
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

ELECTIONS = [
    ("res-1998", 1998, "fed"), ("res-2001", 2001, "fed"),
    ("res-2004", 2004, "fed"), ("res-2007", 2007, "fed"),
    ("res-2010", 2010, "fed"), ("res-2013", 2013, "fed"),
    ("res-2016", 2016, "fed"), ("res-2019", 2019, "fed"),
    ("res-2022", 2022, "fed"), ("res-2025", 2025, "fed"),
    ("res-qld17", 2017, "QLD"), ("res-qld20", 2020, "QLD"),
    ("res-qld24", 2024, "QLD"), ("res-sa22", 2022, "SA"),
    ("res-sa26", 2026, "SA"), ("res-nsw23", 2023, "NSW"),
]

COAL = {"LP", "NP", "LNP", "CLP", "LIB", "NAT"}
COAL_G = {"lp", "np", "lnp", "clp", "lib", "nat"}

COVERAGE = {}


def jload(*p):
    with open(os.path.join(ROOT, *p), encoding="utf-8") as fh:
        return json.load(fh)


def party_group(party_str):
    p = (party_str or "").upper().strip()
    if p == "ALP":
        return "alp"
    if p in COAL:
        return "coal"
    return "other"


def gzload(*p):
    with gzip.open(os.path.join(ROOT, *p)) as fh:
        return json.load(fh)


def extract():
    rows = []
    for key, year, jur in ELECTIONS:
        res = jload("map", "data", key + ".json")
        # 1996-2001 res fl rows are DoP pile-transfer volumes, not the
        # per-candidate flow table (a row total can exceed its primary —
        # e.g. DEM Canberra 1998 transfers 11,039 on 7,237 first prefs).
        # For those two years the flow rows come from the official
        # statistics-pack "TCP Preference Flow" per-division tables
        # instead (.build/aec-flow-src/tcp-<year>.json.gz): full
        # redistribution of each candidate's ballots to the final pair.
        pack = None
        if year in (1998, 2001):
            pack = gzload(".build", "aec-flow-src",
                          f"tcp-{year}.json.gz")
        n_stood = 0
        seats_onp = 0
        for d in res["divs"]:
            on_votes = sum(c[4] for c in d["c"] if c[3] == "onp")
            seats_onp += on_votes
            if not on_votes:
                continue
            n_stood += 1
            on_idx = next(i for i, c in enumerate(d["c"]) if c[3] == "onp")
            if pack is not None:
                rec = pack.get(d["n"])
                if not rec:
                    continue
                han = next((f for f in rec["from"]
                            if f[0] in ("HAN", "ONP", "ON")), None)
                if han is None:
                    continue
                pair = rec["pair"]
                # CLR = Country Labor (the NSW Labor rural brand, 2001
                # only) — sits in the final pair for seats like
                # Eden-Monaro and counts as the Labor destination, as
                # fed-class-flows.py treats it.
                classic = any(p in ("ALP", "CLR") for p in pair) and \
                    any(p in COAL for p in pair)
                dest = {pair[0]: han[1], pair[1]: han[2]}
                to_alp = dest.get("ALP", 0) + dest.get("CLR", 0)
                to_coal = sum(dest.get(p, 0) for p in COAL)
                to_other = han[1] + han[2] - to_alp - to_coal
                exh = 0
                r = None
            else:
                fl = [r for r in (d.get("fl") or []) if r[0] == on_idx]
                if not fl:
                    continue  # ON reached the final pair
                r = fl[0]
                tcp = d["tcp"]
                g0 = d["c"][tcp[0][0]][3]
                g1 = d["c"][tcp[1][0]][3]
                dest = {g0: r[1], g1: r[2]}
                exh = r[3] if len(r) > 3 else 0
                to_alp = dest.get("alp", 0)
                to_coal = sum(v for g, v in dest.items() if g in COAL_G)
                to_other = sum(v for g, v in dest.items()
                               if g != "alp" and g not in COAL_G)
                classic = g0 != g1 and (
                    ("alp" in (g0, g1)) and
                    (g0 in COAL_G or g1 in COAL_G))
            formal = sum(c[4] for c in d["c"])
            seifa = d.get("seifa") or {}
            adv = (seifa.get("irsad") or seifa.get("irsd") or {}).get("pct")
            hist = [h for h in (d.get("h") or []) if h[0] < year]
            held = party_group(hist[-1][2]) if hist else None
            tpp = d.get("tpp")
            coal_margin = None
            if tpp and (tpp[0] + tpp[1]) > 0:
                coal_margin = tpp[1] / (tpp[0] + tpp[1]) - 0.5
            rows.append({
                "el": key, "year": year, "jur": jur, "seat": d["n"],
                "state": d.get("st") or (jur if jur != "fed" else None),
                "cls": d.get("cls"),
                "on_prim": on_votes / formal if formal else None,
                "on_votes": on_votes,
                "adv": adv, "coal_margin": coal_margin,
                "held_alp": 1 if held == "alp" else 0,
                "held_coal": 1 if held == "coal" else 0,
                "held_xb": 1 if held == "other" else 0,
                "held_known": held is not None,
                "to_alp": to_alp, "to_coal": to_coal,
                "to_other": to_other, "exh": exh,
                "classic": classic,
            })
        # G1: ON primaries reconcile to the file's own agg block
        agg_total = res["agg"]["AUS"]["prim"].get("onp", 0)
        assert seats_onp == agg_total, (
            f"G1 {key}: seat ON primaries {seats_onp} != agg {agg_total}")
        COVERAGE[key] = n_stood
    return rows


def guard_fed_class(rows):
    """G2: federal classic ON totals == fed-class-flows classes sums."""
    fcf = jload("data", "fed-class-flows.json")
    years = fcf["years"]
    for _, year, jur in ELECTIONS:
        if jur != "fed":
            continue
        yi = years.index(year)
        t_alp = t_coal = 0
        for cls in ("inner", "outer", "provincial", "rural"):
            votes = (fcf["classes"][cls].get("votes") or {}).get("onp")
            if votes and votes[yi] is not None:
                a, c = votes[yi]
                if a is not None:
                    t_alp += a
                    t_coal += c
        mine_a = sum(r["to_alp"] for r in rows
                     if r["year"] == year and r["jur"] == "fed"
                     and r["classic"])
        mine_c = sum(r["to_coal"] for r in rows
                     if r["year"] == year and r["jur"] == "fed"
                     and r["classic"])
        assert (mine_a, mine_c) == (t_alp, t_coal), (
            f"G2 {year}: mine ({mine_a},{mine_c}) != fed-class-flows "
            f"({t_alp},{t_coal})")


def guard_state_flows(rows):
    """G3/G4: per-seat totals against the committed state flow stores."""
    for el, store in (("res-qld17", "qld17"), ("res-qld20", "qld20"),
                      ("res-qld24", "qld24"), ("res-sa22", "sa22"),
                      ("res-sa26", "sa26")):
        flows = jload("data", f"{store}-flows.json")["flows"]
        for seat, buckets in flows.items():
            want = buckets.get("onp")
            if want is None:
                continue
            mine = [r for r in rows if r["el"] == el and r["seat"] == seat]
            got_a = sum(r["to_alp"] for r in mine)
            got_c = sum(r["to_coal"] for r in mine)
            assert (got_a, got_c) == tuple(want), (
                f"G3 {el} {seat}: mine ({got_a},{got_c}) != store {want}")
    with open(os.path.join(ROOT, "data", "state-flows.csv"),
              encoding="utf-8") as fh:
        csv_rows = [l.split(",") for l in fh.read().strip().splitlines()[1:]]
    rec = next(r for r in csv_rows
               if r[0] == "nsw" and r[1] == "2023" and r[2] == "onp")
    wa, wc = int(rec[5]), int(rec[6])
    mine_a = sum(r["to_alp"] for r in rows
                 if r["el"] == "res-nsw23" and r["classic"])
    mine_c = sum(r["to_coal"] for r in rows
                 if r["el"] == "res-nsw23" and r["classic"])
    assert (mine_a, mine_c) == (wa, wc), (
        f"G4 nsw23: mine ({mine_a},{mine_c}) != state-flows.csv ({wa},{wc})")


# ---------- weighted stats ----------

def wmean(xs, ws):
    s = sum(ws)
    return sum(x * w for x, w in zip(xs, ws)) / s if s else None


def wcorr(xs, ys, ws):
    mx, my = wmean(xs, ws), wmean(ys, ws)
    cov = sum(w * (x - mx) * (y - my) for x, y, w in zip(xs, ys, ws))
    vx = sum(w * (x - mx) ** 2 for x, w in zip(xs, ws))
    vy = sum(w * (y - my) ** 2 for y, w in zip(ys, ws))
    return cov / math.sqrt(vx * vy) if vx > 0 and vy > 0 else None


def wls(ys, X, ws):
    """Weighted least squares, intercept included; returns (beta, se)."""
    n, k = len(ys), len(X[0])
    XtWX = [[sum(ws[i] * X[i][a] * X[i][b] for i in range(n))
             for b in range(k)] for a in range(k)]
    XtWy = [sum(ws[i] * X[i][a] * ys[i] for i in range(n)) for a in range(k)]

    def solve(A, b):
        M = [row[:] + [bb] for row, bb in zip(A, b)]
        for col in range(k):
            piv = max(range(col, k), key=lambda r2: abs(M[r2][col]))
            pivval = M[piv][col]
            if abs(pivval) < 1e-12:
                pivval = 1e-12
            M[col], M[piv] = M[piv], M[col]
            for r2 in range(k):
                if r2 != col and abs(M[r2][col]) > 1e-15:
                    f = M[r2][col] / M[col][col]
                    for c2 in range(col, k + 1):
                        M[r2][c2] -= f * M[col][c2]
        return [M[i][k] / M[i][i] for i in range(k)]

    beta = solve(XtWX, XtWy)
    resid = [ys[i] - sum(beta[a] * X[i][a] for a in range(k))
             for i in range(n)]
    dof = max(n - k, 1)
    s2 = sum(ws[i] * resid[i] ** 2 for i in range(n)) / dof
    Id = [[1.0 if a == b else 0.0 for b in range(k)] for a in range(k)]
    inv = [solve([row[:] for row in XtWX], Id[a]) for a in range(k)]
    se = [math.sqrt(max(s2 * inv[a][a], 0)) for a in range(k)]
    return beta, se


def share(r):
    d = r["to_alp"] + r["to_coal"]
    return r["to_coal"] / d if d else None


def wts(r):
    return r["to_alp"] + r["to_coal"]


def pct(x, dp=1):
    return "  n/a" if x is None else f"{100 * x:5.{dp}f}%"


def f4(x):
    return "  n/a" if x is None else f"{x:+.3f}"


def elec_mean(erows):
    return wmean([share(r) for r in erows], [wts(r) for r in erows])


def main():
    rows = extract()
    guard_fed_class(rows)
    guard_state_flows(rows)
    print("guards:  G1 onp primary totals == res agg, every election [ok]")
    print("         G2 federal classic totals == fed-class-flows.json  [ok]")
    print("         G3 qld/sa seat rows == *-flows.json stores          [ok]")
    print("         G4 nsw23 classic totals == state-flows.csv          [ok]")

    cl = [r for r in rows if r["classic"]]
    fedyears = sorted({r["year"] for r in cl if r["jur"] == "fed"})

    # ---------- 1. headline series ----------
    print("\n=== 1. ON -> Coalition share per election (classic seats, "
          "ballot-weighted) ===")
    print(f"{'election':<16}{'ON stood':>9}{'fl rows':>8}{'classic':>8}"
          f"{'share':>9}{'+/-SE':>7}{'of all prefs':>14}")
    for key, year, jur in ELECTIONS:
        er = [r for r in rows if r["el"] == key]
        ec = [r for r in er if r["classic"]]
        if not ec:
            continue
        m = elec_mean(ec)
        se = math.sqrt(m * (1 - m) / sum(wts(r) for r in ec))
        allp = sum(r["to_coal"] for r in er) / sum(
            wts(r) + r["to_other"] + r["exh"] for r in er)
        print(f"{key + ' ' + str(year):<16}{COVERAGE[key]:>9}{len(er):>8}"
              f"{len(ec):>8}{pct(m):>9}{100 * se:>6.1f}{pct(allp):>13}")

    # ---------- 2. federal per-state screen ----------
    print("\n=== 2. Federal elections: ON -> Coalition share by state "
          "(% of elections' ballots) ===")
    states = sorted({r["state"] for r in cl if r["jur"] == "fed"})
    print("state " + "".join(f"{y:>7}" for y in fedyears) + "   pool-dev")
    for s in states:
        cells = []
        dev_num = dev_den = 0.0
        for y in fedyears:
            er = [r for r in cl if r["jur"] == "fed" and r["year"] == y]
            mnat = elec_mean(er)
            es = [r for r in er if r["state"] == s]
            if len(es) >= 3:
                m = wmean([share(r) for r in es], [wts(r) for r in es])
                cells.append(f"{100 * m:6.1f} ")
            else:
                cells.append("     - ")
            for r in es:
                dev_num += (share(r) - mnat) * wts(r)
                dev_den += wts(r)
        pd = dev_num / dev_den if dev_den else None
        print(f"{s:<5} " + "".join(cells) + f"{100 * pd:+6.1f}")

    # ---------- 3. within-election weighted correlations ----------
    print("\n=== 3. Weighted r: seat ON -> Coalition share vs correlate, "
          "per election ===")
    preds = [
        ("ON primary share", lambda r: r["on_prim"]),
        ("advantage pctile", lambda r: r["adv"]),
        ("Rural class", lambda r: (1.0 if r["cls"] == "Rural" else 0.0)
         if r["cls"] else None),
        ("Provincial class", lambda r: (1.0 if r["cls"] == "Provincial"
         else 0.0) if r["cls"] else None),
        ("Coalition margin", lambda r: r["coal_margin"]),
        ("Coalition held", lambda r: float(r["held_coal"])
         if r["held_known"] else None),
    ]
    short = {k: k[4:] for k, _, _ in ELECTIONS}
    print(f"{'correlate':<20}" + "".join(f"{sh:>8}" for _, sh in short.items())
          + "   wtd-mean")
    for name, fn in preds:
        rs, wsp, cells = [], [], []
        for key, year, jur in ELECTIONS:
            er = [r for r in cl if r["el"] == key]
            dat = [(fn(r), share(r), wts(r)) for r in er]
            dat = [t for t in dat if t[0] is not None and t[1] is not None]
            if len(dat) < 8:
                cells.append(f"{'--':>8}")
                continue
            rr = wcorr([t[0] for t in dat], [t[1] for t in dat],
                       [t[2] for t in dat])
            if rr is None:
                cells.append(f"{'--':>8}")
                continue
            rs.append(rr)
            wsp.append(sum(t[2] for t in dat))
            cells.append(f"{rr:+.2f}  ")
        wm = wmean(rs, wsp) if rs else None
        print(f"{name:<20}" + "".join(cells) + f"  {f4(wm)}")

    # ---------- 4. deviations lens: FE fits ----------
    print("\n=== 4. Weighted election fixed-effects fits ===")
    print("(outcome and regressors demeaned within election; ballot-"
          "weighted;\n  coefficients = points of ON->Coal share)")

    def fe_fit(fam, label, have_cls, have_jurdum):
        er = [r for r in cl
              if (r["jur"] == "fed") == (fam == "fed")]
        dat = []
        for r in er:
            need = [r["on_prim"], r["adv"], r["coal_margin"]]
            if any(v is None for v in need):
                continue
            if have_cls and r["cls"] is None:
                continue
            y0 = share(r)
            if y0 is None:
                continue
            x = list(need)
            x.append(float(r["held_coal"]))
            x.append(float(r["held_xb"]))
            x.append(0.0 if r["held_known"] else 1.0)  # held unknown
            if have_cls:
                x.append(1.0 if r["cls"] == "Rural" else 0.0)
                x.append(1.0 if r["cls"] == "Provincial" else 0.0)
            if fam == "fed":
                for s in ("ACT", "NT", "QLD", "SA", "TAS", "VIC", "WA"):
                    x.append(1.0 if r["state"] == s else 0.0)  # base NSW
            elif have_jurdum:
                for j2 in ("QLD", "SA"):
                    x.append(1.0 if r["jur"] == j2 else 0.0)  # base NSW
            dat.append({"y": y0, "w": wts(r), "el": r["el"], "X": x})
        names = ["ON primary", "Coal margin", "advantage pct", "coal held",
                 "xb held", "held unk"]
        if have_cls:
            names += ["Rural", "Provincial"]
        if fam == "fed":
            names += ["st ACT", "st NT", "st QLD", "st SA", "st TAS",
                      "st VIC", "st WA"]
        elif have_jurdum:
            names += ["jur QLD", "jur SA"]
        els = sorted({d["el"] for d in dat})
        for e2 in els:
            grp = [d for d in dat if d["el"] == e2]
            W = sum(d["w"] for d in grp)
            my = sum(d["y"] * d["w"] for d in grp) / W
            mx = [sum(d["X"][a] * d["w"] for d in grp) / W
                  for a in range(len(names))]
            for d in grp:
                d["y"] = d["y"] - my
                d["X"] = [d["X"][a] - mx[a] for a in range(len(names))]
        # drop columns left degenerate by the within-election demean
        # (e.g. "held unk" identically 1 in qld17 becomes identically 0
        # everywhere after demeaning)
        keep = [a for a in range(len(names))
                if sum(d["X"][a] ** 2 for d in dat) > 1e-9]
        dropped = [names[a] for a in range(len(names)) if a not in keep]
        names = [names[a] for a in keep]
        for d in dat:
            d["X"] = [d["X"][a] for a in keep]
        beta, se = wls([d["y"] for d in dat], [d["X"] for d in dat],
                       [d["w"] for d in dat])
        nbal = sum(d["w"] for d in dat)
        print(f"\n  {label} (n={len(dat)} seats, {int(nbal):,} ON ballots, "
              f"{len(els)} elections)")
        if dropped:
            print(f"    (dropped degenerate: {', '.join(dropped)})")
        for nm, b, s in zip(names, beta, se):
            t = abs(b / s) if s > 0 else 0
            flag = "**" if t > 2.6 else ("*" if t > 1.96 else "  ")
            print(f"    {nm:<14}{100 * b:+7.2f}pts  (se {100 * s:5.2f}) "
                  f"{flag}")
        return beta

    fe_fit("fed", "FEDERAL 1998-2025", have_cls=True, have_jurdum=False)
    fe_fit("state", "STATE (qld17/20/24, sa22/26, nsw23)",
           have_cls=False, have_jurdum=True)

    # ---------- 5. Queensland focus ----------
    print("\n=== 5. Queensland vs the rest, federal elections ===")
    print("year   QLD     rest    gap      QLD seats")
    for y in fedyears:
        q = [r for r in cl if r["jur"] == "fed" and r["year"] == y
             and r["state"] == "QLD"]
        o = [r for r in cl if r["jur"] == "fed" and r["year"] == y
             and r["state"] != "QLD"]
        if not q:
            continue
        mq, mo = elec_mean(q), elec_mean(o)
        print(f"{y}  {pct(mq)}  {pct(mo)}  {100 * (mq - mo):+6.1f}pts"
              f"   n={len(q)}")

    # ---------- 6. extremes ----------
    print("\n=== 6. Robustness ===")
    y25 = [r for r in rows if r["el"] == "res-2025"]
    y25c = [r for r in y25 if r["classic"]]
    m_all = elec_mean(y25)
    m_cls = elec_mean(y25c)
    print(f"  2025 all-ON-seats share {pct(m_all)} (n={len(y25)}) "
          f"vs classic-only {pct(m_cls)} (n={len(y25c)})")
    print("  ballot-weighted vs equal-seat headlines, federal:")
    for y in fedyears:
        ec = [r for r in cl if r["jur"] == "fed" and r["year"] == y]
        mw = elec_mean(ec)
        mu = sum(share(r) for r in ec) / len(ec)
        big = [r for r in ec if wts(r) >= 500]
        mb = elec_mean(big) if big else None
        print(f"    {y}  wtd {pct(mw)}   seat-equal {pct(mu)}   "
              f"excl.small-piles {pct(mb)}")
    print("  (nsw23's of-all-prefs figure in section 1 shows optional-"
          "preferential\n   exhaustion: 61% of ON ballots exhausted "
          "before a major there.)")

    # ---------- 7. extremes ----------
    print("\n=== 7. Strongest / weakest ON -> Coalition seats, "
          "min 1500 flowed ON ballots ===")
    big = [r for r in cl if wts(r) >= 1500]
    big.sort(key=share)

    def line(r):
        c = (r["cls"] or r["jur"])[:12]
        return (f"    {r['seat']:<18}{r['el'][4:]:<7}{(r['state'] or ''):<5}"
                f"{c:<13}{pct(share(r))}  (ON primary {pct(r['on_prim'])})")
    print("  most Labor-leaning:")
    for r in big[:10]:
        print(line(r))
    print("  most Coalition-leaning:")
    for r in big[-10:][::-1]:
        print(line(r))


if __name__ == "__main__":
    main()
