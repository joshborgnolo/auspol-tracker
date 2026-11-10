#!/usr/bin/env python3
"""backtest-2013-22.py: the polls-plus-AES combination tested at four earlier elections.

Question (owner, 2026-11-10): how should each group's vote at an election be estimated - the final polls, the
Australian Election Study, or both? combine-test.py answered it on 2025's 37 counted cells. This repeats the
test at 2013, 2016, 2019 and 2022 with the final-poll stores (data/demographics-<year>-election.json, filed
2026-11-10 from the houses' original tables) and the AES integrated file.

Two tests, both gap to gap (a group's figure less the same instrument's all-voters figure, so each
instrument's miss on the level cancels):
  1. STATES - the count is the truth. Polls, the AES, their plain mean and the site's weighted mean
     (weights 1 / (sampling variance + INSTR^2), INSTR = 1.5 as fitted on 2025) against the count's gap.
     Primaries (Labor, Coalition, Greens) where a house printed them; two-party-preferred where it printed
     only that (the AES's 2PP: major-party voters plus minor-party voters by the side they say their
     preferences reached, prfhor).
  2. AGE AND GENDER - no truth. Polls against the AES: how far apart beyond sampling, and whether the 2025
     differences (Labor's and the Greens' gender gaps, the Coalition among the young) recur at each election.
     A difference with the same sign every time is a standing difference between the instruments; one that
     comes and goes is noise in one of them.

Houses in one election are pooled by inverse sampling variance. A cell's sampling variance is binomial on
the cell's sample (the printed one, else the wave's n times the group's share of AES respondents) times
DEFF, plus rounding. The AES side uses Kish effective n.

The AES file is licensed and not committed. Run from the repo root with a Python that has pandas:
  /usr/bin/python3 .build/analysis/group-poll-error-2025/backtest-2013-22.py \
      ~/Downloads/2_aes67to25_integrated_general_v1.dta > .build/analysis/group-poll-error-2025/out/backtest-2013-22.txt
"""
import json
import math
import os
import sys

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
YEARS = [2013, 2016, 2019, 2022]
INSTR = 1.5
DEFF = 1.5
VOTE = {2: "alp", 1: "lnp", 3: "lnp", 5: "grn", 6: "onp", 4: "oth", 7: "oth", 11: "oth", 19: "oth", 8: "oth"}
STATE = {1: "nsw", 2: "vic", 3: "qld", 4: "sa", 5: "wa", 6: "tas", 7: "nt", 8: "act"}
# a poll's state label -> the states it covers
ST = {"NSW (inc. ACT)": ["nsw", "act"], "NSW": ["nsw"], "New South Wales": ["nsw"], "VIC": ["vic"], "Victoria": ["vic"],
      "QLD": ["qld"], "Queensland": ["qld"], "SA": ["sa"], "South Australia": ["sa"], "WA": ["wa"],
      "Western Australia": ["wa"], "Tasmania": ["tas"]}
# an age label -> [lo, hi]
AGE = {"18-24": (18, 24), "25-34": (25, 34), "35-49": (35, 49), "50-64": (50, 64), "65+": (65, 120),
       "18–34": (18, 34), "35–49": (35, 49), "50+": (50, 120), "50–64": (50, 64), "35–54": (35, 54), "55+": (55, 120)}
SEX = {"Men": 1, "Women": 2}
KEYS = ["alp", "lnp", "grn"]


def rms(xs):
    return math.sqrt(sum(x * x for x in xs) / len(xs)) if xs else float("nan")


def load_aes(path):
    df = pd.read_stata(path, columns=["aeswave", "vthor", "prfhor", "state", "age", "sex", "weight"], convert_categoricals=False)
    df = df[df.aeswave.isin(YEARS)].copy()
    df["vote"] = df.vthor.map(VOTE)
    df = df[df.vote.notna()]
    df["w"] = np.where(df.weight > 0, df.weight, np.nan)
    df = df[df.w.notna()]
    df["st"] = df.state.map(STATE)
    # two-party side: the majors' own voters, a minor voter by where the preferences went (unsure: out)
    df["tpp"] = np.where(df.vote == "alp", 1.0, np.where(df.vote == "lnp", 0.0,
                 np.where(df.prfhor == 2, 1.0, np.where(df.prfhor == 1, 0.0, np.nan))))
    return df


def aes_cell(g, sel, key):
    """(share %, Kish n, gap variance pts^2) of `key` among `sel` v all of g; key 'alp2' = two-party."""
    if key == "alp2":
        g = g[g.tpp.notna()]
        sel = sel.reindex(g.index).fillna(False)
        y = g.tpp
    else:
        y = (g.vote == key).astype(float)
    a, b = g[sel], g[~sel]
    if len(a) < 20:
        return None
    pa = float((a.w * y[sel]).sum() / a.w.sum())
    pall = float((g.w * y).sum() / g.w.sum())
    na = float(a.w.sum() ** 2 / (a.w ** 2).sum())
    nb = float(b.w.sum() ** 2 / (b.w ** 2).sum()) if len(b) else float("inf")
    f = float(a.w.sum() / g.w.sum())
    pb = float((b.w * y[~sel]).sum() / b.w.sum()) if len(b) else pa
    # gap = (1 - f)(pa - pb), group and rest independent
    v = (1 - f) ** 2 * (pa * (1 - pa) / na + pb * (1 - pb) / nb) * 1e4
    return {"gap": (pa - pall) * 100, "v": v, "share": f, "n": len(a)}


def truth(year):
    P = json.load(open(os.path.join(ROOT, "data", "primary-history.json")))["fed"]
    T = json.load(open(os.path.join(ROOT, "data", "2pp-history.json")))["fed"]
    out = {"nat": {k: P[k][P["years"].index(year)] for k in KEYS}}
    out["nat"]["alp2"] = T["alp"][T["years"].index(year)]
    for s in STATE.values():
        ps, ts = P["states"].get(s), T["states"].get(s)
        if not ps or year not in ps["years"]:
            continue
        out[s] = {k: ps[k][ps["years"].index(year)] for k in KEYS}
        if ts and year in ts["years"]:
            out[s]["alp2"] = ts["alp"][ts["years"].index(year)]
    return out


def main(path):
    aes = load_aes(path)
    print(__doc__.split("\n\n")[0].strip())
    print(f"\nINSTR {INSTR} (points of error beyond sampling, each instrument), DEFF {DEFF}. Gaps in points.\n")
    truth_cells, demo_cells = [], []
    for year in YEARS:
        store = json.load(open(os.path.join(ROOT, "data", f"demographics-{year}-election.json")))
        g = aes[aes.aeswave == year]
        T = truth(year)
        stw = g.groupby("st").w.sum() / g.w.sum()           # the AES's weighted state shares stand in for the roll's
        acc = {}                                            # (dim, group, key) -> list of (gap, v, house)
        for w in store["waves"]:
            dims = w.get("dims") or {}
            tot = dict(w.get("total") or {})
            if w.get("tpp") and w["tpp"].get("alp") is not None:
                tot["alp2"] = w["tpp"]["alp"]
            # a table printed without a national row: the gender rows' mean is the national figure
            if "alp2" not in tot and "gender" in dims and all(dims["gender"].get(s, {}).get("alp2") is not None for s in SEX):
                tot["alp2"] = sum(dims["gender"][s]["alp2"] for s in SEX) / 2
            n = w.get("sample") or 1500
            for dim in ("state", "age", "gender"):
                for label, cell in (dims.get(dim) or {}).items():
                    if dim == "state":
                        sts = ST.get(label)
                        if not sts:
                            continue
                        share = float(sum(stw.get(s, 0) for s in sts))
                    elif dim == "age":
                        if label not in AGE:
                            continue
                        lo, hi = AGE[label]
                        share = float(g[(g.age >= lo) & (g.age <= hi)].w.sum() / g[g.age >= 18].w.sum())
                    else:
                        if label not in SEX:
                            continue
                        share = 0.5
                    nc = cell.get("sample") or n * share
                    for k in KEYS + ["alp2"]:
                        if cell.get(k) is None or tot.get(k) is None:
                            continue
                        if k == "alp2" and all(cell.get(q) is not None and tot.get(q) is not None for q in ("alp", "lnp")):
                            continue                        # primaries printed: the 2PP beside them adds no new cell
                        p = cell[k] / 100
                        v = (1 - share) ** 2 * (p * (1 - p) / nc + p * (1 - p) / max(1, n - nc)) * 1e4 * DEFF + 2 * 0.25 / 12
                        acc.setdefault((dim, label, k), []).append((cell[k] - tot[k], v, w["pollster"]))
        for (dim, label, k), rows in acc.items():
            wsum = sum(1 / r[1] for r in rows)
            pg, pv = sum(r[0] / r[1] for r in rows) / wsum, 1 / wsum
            if dim == "state":
                sel = g.st.isin(ST[label])
            elif dim == "age":
                lo, hi = AGE[label]
                sel = (g.age >= lo) & (g.age <= hi)
            else:
                sel = g.sex == SEX[label]
            gg = g[g.age >= 18] if dim == "age" else g[g.sex.isin([1, 2])] if dim == "gender" else g[g.st.notna()]
            a = aes_cell(gg, sel.reindex(gg.index), k)
            if not a:
                continue
            c = {"year": year, "dim": dim, "label": label, "k": k, "poll": pg, "pv": pv, "aes": a["gap"], "av": a["v"],
                 "houses": sorted({r[2] for r in rows})}
            if dim == "state":
                sts = ST[label]
                if any(s not in T or k not in T[s] for s in sts):
                    continue
                ws = [float(stw.get(s, 0)) for s in sts]
                c["truth"] = sum(T[s][k] * x for s, x in zip(sts, ws)) / sum(ws) - T["nat"][k]
                truth_cells.append(c)
            else:
                demo_cells.append(c)

    def comb(c):
        wp, wa = 1 / (c["pv"] + INSTR ** 2), 1 / (c["av"] + INSTR ** 2)
        return (c["poll"] * wp + c["aes"] * wa) / (wp + wa)

    print("1. STATES: each estimate's gap against the count's (typical miss, RMSE, points)")
    print(f"   {'':26s} cells   polls    AES   plain mean   weighted   polls' sampling   AES's sampling   r(errors)")

    def line(label, cs):
        if not cs:
            return
        ep = [c["poll"] - c["truth"] for c in cs]
        ea = [c["aes"] - c["truth"] for c in cs]
        em = [(c["poll"] + c["aes"]) / 2 - c["truth"] for c in cs]
        ew = [comb(c) - c["truth"] for c in cs]
        r = float(np.corrcoef(ep, ea)[0, 1]) if len(cs) > 2 else float("nan")
        print(f"   {label:26s} {len(cs):4d}   {rms(ep):5.2f}  {rms(ea):5.2f}   {rms(em):8.2f}   {rms(ew):8.2f}   "
              f"{math.sqrt(sum(c['pv'] for c in cs) / len(cs)):13.2f}   {math.sqrt(sum(c['av'] for c in cs) / len(cs)):13.2f}   {r:+7.2f}")

    line("all four elections", truth_cells)
    line("  primaries", [c for c in truth_cells if c["k"] != "alp2"])
    line("  two-party-preferred", [c for c in truth_cells if c["k"] == "alp2"])
    for y in YEARS:
        line(f"  {y}", [c for c in truth_cells if c["year"] == y])
    print("\n   The polls' sampling column is a ceiling, not a measure: most of these tables print no cell samples and the")
    print("   design effect is assumed, so no error-beyond-sampling figure is read off these years (2025's: 1.74 and 1.64).")
    best = min(((rms([w * c["poll"] + (1 - w) * c["aes"] - c["truth"] for c in truth_cells]), w) for w in [i / 20 for i in range(21)]))
    wmean = sum((1 / (c["pv"] + INSTR ** 2)) / (1 / (c["pv"] + INSTR ** 2) + 1 / (c["av"] + INSTR ** 2)) for c in truth_cells) / len(truth_cells)
    print(f"   Best single weight on the polls, fitted here: {best[1]:.2f} (RMSE {best[0]:.2f}); the rule's mean weight on the polls: {wmean:.2f}.")

    print("\n2. AGE AND GENDER: polls against the AES (no truth)")
    for dim in ("gender", "age"):
        cs = [c for c in demo_cells if c["dim"] == dim]
        if not cs:
            continue
        d = [c["poll"] - c["aes"] for c in cs]
        samp = sum(c["pv"] + c["av"] for c in cs) / len(cs)
        ex = max(0, rms(d) ** 2 - samp)
        print(f"   {dim:7s} {len(cs):3d} cells   RMS polls - AES {rms(d):.2f}   sampling alone {math.sqrt(samp):.2f}   beyond sampling {math.sqrt(ex):.2f} "
              f"(each instrument {math.sqrt(ex / 2):.2f})")
    print("\n   Cell by cell (poll gap, AES gap, difference, z):")
    for c in sorted(demo_cells, key=lambda c: (c["dim"], c["k"], c["label"], c["year"])):
        z = (c["poll"] - c["aes"]) / math.sqrt(c["pv"] + c["av"])
        print(f"   {c['year']} {c['dim']:6s} {c['label']:6s} {c['k']:4s}  polls {c['poll']:+6.1f}  AES {c['aes']:+6.1f}  diff {c['poll'] - c['aes']:+6.1f}  z {z:+5.1f}  [{', '.join(c['houses'])}]")

    print("\n   The 2025 differences, at each earlier election (polls - AES, points):")
    def track(name, pick):
        rows = [(c["year"], c["poll"] - c["aes"]) for c in demo_cells if pick(c)]
        print(f"   {name:44s} " + "  ".join(f"{y} {d:+5.1f}" for y, d in sorted(rows)) if rows else f"   {name:44s} no cell")
    track("Labor, women (2025: -3.1)", lambda c: c["dim"] == "gender" and c["label"] == "Women" and c["k"] == "alp")
    track("Greens, women (2025: -2.9)", lambda c: c["dim"] == "gender" and c["label"] == "Women" and c["k"] == "grn")
    track("Labor 2PP, women", lambda c: c["dim"] == "gender" and c["label"] == "Women" and c["k"] == "alp2")
    track("Coalition, 18-34 (2025: -7.2)", lambda c: c["dim"] == "age" and c["label"] == "18–34" and c["k"] == "lnp")
    track("Labor, 18-34", lambda c: c["dim"] == "age" and c["label"] == "18–34" and c["k"] == "alp")
    track("Labor 2PP, 18-34", lambda c: c["dim"] == "age" and c["label"] == "18–34" and c["k"] == "alp2")
    track("Coalition, oldest band", lambda c: c["dim"] == "age" and c["label"] in ("50+", "55+", "65+") and c["k"] == "lnp")
    track("Labor 2PP, 65+", lambda c: c["dim"] == "age" and c["label"] == "65+" and c["k"] == "alp2")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Downloads/2_aes67to25_integrated_general_v1.dta"))
