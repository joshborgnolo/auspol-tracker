#!/usr/bin/env python3
"""Feasibility prototype: subpopulation primary votes, 2025 federal election.

Ecological estimation of party group shares within demographic groups:
booth-level first-preference votes (AEC VTR per-state FPV lane, ordinary
votes) against vote-weighted census-footprint demographic profiles of each
booth's voters (data/booth-seifa-voter-2025.json). Validated against the
site's pooled poll crosstabs (data/demographics.json, early-term waves).

Scratch analysis only. Pure stdlib. Deterministic (fixed bootstrap seed).
"""
import csv, gzip, json, math, os, random, sys
from collections import defaultdict

REPO = os.path.dirname(os.path.abspath(__file__))
ROOT, _ = os.path.split(os.path.split(os.path.split(REPO)[0])[0])[0] if False else (None, None)
# .build/analysis/subpop-votes-2025 -> repo root is three levels up.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

FOOTPRINT = os.path.join(ROOT, "data", "booth-seifa-voter-2025.json")
DEMOG = os.path.join(ROOT, "data", "demographics.json")
FPV_DIR = os.path.join(ROOT, ".build", "aec-flow-src", "booth", "fpv")
OUT = os.path.join(REPO, "results-2025.json")

PARTIES = ["alp", "lnp", "grn", "on", "oth"]
PARTY_MAP = {"ALP": "alp", "LP": "lnp", "NP": "lnp", "LNP": "lnp", "CLP": "lnp",
             "GRN": "grn", "ON": "on"}

POLL_PARTY_MAP = {"alp": "alp", "lnp": "lnp", "grn": "grn", "onp": "on", "oth": "oth"}
POLL_WAVE_CUTOFF = "2026-01-01"  # early-term waves: nearest available to the election

BOOTS = 200
SEED = 20260503
RIDGE_LAMBDAS = [0.0, 0.1, 1.0]

# ---------------------------------------------------------------- data load


def load_footprint():
    with open(FOOTPRINT) as fh:
        d = json.load(fh)
    return d["booths"]


def load_fpv():
    """per (div, boothId) -> {party: votes}; per unit formal total."""
    votes = defaultdict(lambda: defaultdict(float))
    for st in ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]:
        path = os.path.join(FPV_DIR, f"2025-{st}.csv.gz")
        with gzip.open(path, "rt", newline="") as fh:
            next(fh)  # banner line precedes the header
            for row in csv.DictReader(fh):
                grp = PARTY_MAP.get(row["PartyAb"], "oth")
                key = (row["DivisionNm"].strip(), int(row["PollingPlaceID"]))
                votes[key][grp] += float(row["OrdinaryVotes"])
    return votes


AGE_MAP = {  # G01 band -> (fraction into canonical 18+ bands a18_34/a35_54/a55ov)
    "15_19": [("a18_34", 0.4)],
    "20_24": [("a18_34", 1.0)],
    "25_34": [("a18_34", 1.0)],
    "35_44": [("a35_54", 1.0)],
    "45_54": [("a35_54", 1.0)],
    "55_64": [("a55ov", 1.0)],
    "65_74": [("a55ov", 1.0)],
    "75_84": [("a55ov", 1.0)],
    "85ov": [("a55ov", 1.0)],
}


def unit_features(demo):
    age = demo.get("age")
    adult = sum(v for k, v in age.items() if k in AGE_MAP)
    if adult <= 0:
        return None
    f = {"a18_34": 0.0, "a35_54": 0.0, "a55ov": 0.0}
    for band, parts in AGE_MAP.items():
        for canon, frac in parts:
            f[canon] += age[band] * frac / adult
    lang = demo.get("langOther")
    if lang is None or demo.get("loinc") is None or demo.get("uni") is None:
        return None
    f["engOnly"] = 1.0 - lang
    f["langOther"] = lang
    f["uni"] = demo["uni"]
    f["noUni"] = 1.0 - demo["uni"]
    f["loinc"] = demo["loinc"]
    f["hiinc"] = demo["hiinc"]
    f["midinc"] = max(0.0, 1.0 - demo["loinc"] - demo["hiinc"])
    cob = demo.get("cob", {})
    f["cob_chn"] = cob.get("chn", 0.0)
    f["cob_ind"] = cob.get("ind", 0.0)
    f["cob_vnm"] = cob.get("vnm", 0.0)
    f["cob_phl"] = cob.get("phl", 0.0)
    f["cob_rest"] = max(0.0, 1.0 - sum(cob.get(k, 0.0) for k in ("chn", "ind", "vnm", "phl")))
    return f


DIMS = {
    "age": ["a18_34", "a35_54", "a55ov"],
    "language": ["engOnly", "langOther"],
    "education": ["uni", "noUni"],
    "income": ["loinc", "midinc", "hiinc"],
    "cob": ["cob_chn", "cob_ind", "cob_vnm", "cob_phl", "cob_rest"],
}

# ---------------------------------------------------------------- poll prior

AGE_BUCKET = {"18–34": "a18_34", "18–35": "a18_34", "18–24": "a18_34", "25–34": "a18_34",
              "35–54": "a35_54", "35–49": "a35_54", "50–64": "a35_54", "36–53": "a35_54",
              "55+": "a55ov", "65+": "a55ov", "50+": "a55ov", "54+": "a55ov"}
UNI_LABELS = {"University", "Undergraduate", "Postgraduate"}
NOUNI_LABELS = {"TAFE", "Year 12", "School", "Below Year 12", "TAFE or trade",
                "Year 12 or less", "TAFE or college", "No tertiary", "Less than year 12",
                "High School", "Trade Cert."}


def load_poll_targets():
    """Sample-weighted pooled poll crosstabs per canonical dim-group-party."""
    with open(DEMOG) as fh:
        waves = json.load(fh)["waves"]
    acc = defaultdict(lambda: [0.0, 0.0])  # (dim,group,party) -> [num, den]
    for w in waves:
        if str(w.get("date")) >= POLL_WAVE_CUTOFF:
            continue
        n = w.get("sample") or 1000
        dims = w.get("dims", {})
        for lbl, canon in AGE_BUCKET.items():
            cell = dims.get("age", {}).get(lbl)
            if cell:
                _acc_cell(acc, "age", canon, cell, n)
        for lbl, canon in (("English only", "engOnly"), ("Other language", "langOther")):
            cell = dims.get("language", {}).get(lbl)
            if cell:
                _acc_cell(acc, "language", canon, cell, n)
        edu = dims.get("education", {})
        for lbl, canon in ([(l, "uni") for l in UNI_LABELS] +
                           [(l, "noUni") for l in NOUNI_LABELS]):
            cell = edu.get(lbl)
            if cell:
                _acc_cell(acc, "education", canon, cell, n)
    out = {}
    for key, (num, den) in acc.items():
        if den > 0:
            out[key] = num / den
    return out


def _acc_cell(acc, dim, canon, cell, n):
    tot = sum(POLL_PARTY_MAP[k] and cell.get(k, 0) for k in POLL_PARTY_MAP if cell.get(k) is not None)
    if not tot:
        return
    for pk, party in POLL_PARTY_MAP.items():
        v = cell.get(pk)
        if v is None:
            continue
        key = (dim, canon, party)
        acc[key][0] += n * (v / tot * 100.0)
        acc[key][1] += n

# ---------------------------------------------------------------- OLS bits


def solve(a, b):
    """Gaussian elimination, a (k x k) SPD, b (k). Returns solution."""
    k = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(k):
        p = max(range(c, k), key=lambda r: abs(m[r][c]))
        if abs(m[p][c]) < 1e-12:
            m[c][c] = 1e-12
            p = c
        m[c], m[p] = m[p], m[c]
        inv = 1.0 / m[c][c]
        for j in range(c, k + 1):
            m[c][j] *= inv
        for r in range(k):
            if r != c and m[r][c] != 0.0:
                f = m[r][c]
                for j in range(c, k + 1):
                    m[r][j] -= f * m[c][j]
    return [m[i][k] for i in range(k)]


# ---------------------------------------------------------------- main


def main():
    booths = load_footprint()
    fpv = load_fpv()
    polls = load_poll_targets()

    units = []
    skipped = defaultdict(int)
    for b in booths:
        demo = b.get("demo")
        if not demo:
            skipped["no_demo"] += 1
            continue
        key = (b["div"], b["boothId"])
        votes = fpv.get(key)
        if not votes:
            skipped["no_fpv"] += 1
            continue
        tot = sum(votes.values())
        if tot < 30:
            skipped["tiny"] += 1
            continue
        feats = unit_features(demo)
        if not feats:
            skipped["no_feats"] += 1
            continue
        y = {p: votes.get(p, 0.0) / tot * 100.0 for p in PARTIES}
        units.append({"div": b["div"], "w": tot, "x": feats, "y": y})

    n_units = len(units)
    total_votes = sum(u["w"] for u in units)
    print(f"units: {n_units} booths, {total_votes:,.0f} formal ordinary votes")
    print(f"skipped: {dict(skipped)}")

    # grouped by division for the cluster bootstrap
    by_div = defaultdict(list)
    for u in units:
        by_div[u["div"]].append(u)
    divs = sorted(by_div)

    # group means for the prior renorm
    print("\n=== diagnostics ===")
    diag = {"skipped": dict(skipped), "units": n_units, "votes": total_votes, "dims": {}}
    for dname, cols in DIMS.items():
        wsum = sum(u["w"] for u in units)
        means = [sum(u["w"] * u["x"][c] for u in units) / wsum for c in cols]
        var_within = 0.0
        var_tot = 0.0
        for c in cols:
            mu = sum(u["w"] * u["x"][c] for u in units) / wsum
            div_mu = {}
            for dv, us in by_div.items():
                dw = sum(u["w"] for u in us)
                div_mu[dv] = sum(u["w"] * u["x"][c] for u in us) / dw
            var_within += sum(u["w"] * (u["x"][c] - div_mu[u["div"]]) ** 2 for u in units) / wsum
            var_tot += sum(u["w"] * (u["x"][c] - mu) ** 2 for u in units) / wsum
        diag["dims"][dname] = {"col_means": {c: round(m, 4) for c, m in zip(cols, means)},
                               "within_div_var_share": round(var_within / var_tot, 4) if var_tot else None}
        print(f"{dname}: within-division variance share = {diag['dims'][dname]['within_div_var_share']}")

    rng = random.Random(SEED)
    results = {"units": n_units, "votes": total_votes, "diagnostics": diag, "fits": {}, "validation": {}}

    for lam in RIDGE_LAMBDAS:
        for dname, cols in DIMS.items():
            k = len(cols)
            # per-division sufficient statistics
            per_div = {}
            for dv, us in by_div.items():
                xwx = [[0.0] * k for _ in range(k)]
                xwy = {p: [0.0] * k for p in PARTIES}
                for u in us:
                    xi = [u["x"][c] for c in cols]
                    for a in range(k):
                        for bb in range(k):
                            xwx[a][bb] += u["w"] * xi[a] * xi[bb]
                        for p in PARTIES:
                            xwy[p][a] += u["w"] * xi[a] * u["y"][p]
                per_div[dv] = (xwx, xwy)

            def assemble(sample_mult):
                xwx = [[0.0] * k for _ in range(k)]
                xwy = {p: [0.0] * k for p in PARTIES}
                for dv, mult in sample_mult.items():
                    if not mult:
                        continue
                    dxwx, dxwy = per_div[dv]
                    for a in range(k):
                        for bb in range(k):
                            xwx[a][bb] += mult * dxwx[a][bb]
                        for p in PARTIES:
                            xwy[p][a] += mult * dxwy[p][a]
                return xwx, xwy

            prior = {}
            for p in PARTIES:
                prior[p] = [polls.get((dname if dname != "cob" else None or "?", c, p), None) for c in cols]
            # cob has no poll target -> mean share prior from data
            wsum = sum(u["w"] for u in units)
            for p in PARTIES:
                nat = sum(u["w"] * u["y"][p] for u in units) / wsum
                for j, c in enumerate(cols):
                    if prior[p][j] is None:
                        prior[p][j] = nat

            def fit(xwx, xwy):
                out = {}
                s = sum(xwx[a][a] for a in range(k)) / k
                res = {}
                for p in PARTIES:
                    a = [row[:] for row in xwx]
                    b = xwy[p][:]
                    if lam > 0:
                        for j in range(k):
                            a[j][j] += lam * s
                            b[j] += lam * s * prior[p][j]
                    beta = solve(a, b)
                    # weighted R^2 (on the full data)
                    mu = sum(u["w"] * u["y"][p] for u in units) / wsum
                    sse = sum(u["w"] * (u["y"][p] - sum(u["x"][c] * beta[j] for j, c in enumerate(cols))) ** 2 for u in units)
                    sst = sum(u["w"] * (u["y"][p] - mu) ** 2 for u in units)
                    res[p] = 1 - sse / sst if sst else None
                    out[p] = beta
                return out, res

            full_xwx, full_xwy = assemble({dv: 1 for dv in divs})
            betas, r2s = fit(full_xwx, full_xwy)

            boots = {p: [[] for _ in cols] for p in PARTIES}
            for _ in range(BOOTS):
                mult = {dv: 0 for dv in divs}
                for _dv in divs:
                    mult[rng.choice(divs)] += 1
                bxwx, bxwy = assemble(mult)
                bbetas, _ = fit(bxwx, bxwy)
                for p in PARTIES:
                    for j in range(k):
                        boots[p][j].append(bbetas[p][j])

            rec = {}
            for p in PARTIES:
                rec[p] = {}
                for j, c in enumerate(cols):
                    s = sorted(boots[p][j])
                    lo, hi = s[int(0.025 * BOOTS)], s[int(0.975 * BOOTS)]
                    key = (dname, c, p)
                    rec[p][c] = {
                        "est": round(betas[p][j], 2),
                        "ci95": [round(lo, 2), round(hi, 2)],
                        "prior": round(prior[p][j], 2),
                        "poll": round(polls[key], 2) if key in polls else None,
                    }
            results["fits"].setdefault(dname, {})[str(lam)] = {
                "cols": cols, "est": rec, "weighted_r2": {p: round(r2s[p], 3) for p in PARTIES}}

        fitkey = results["fits"]

    # ---- within-division (fixed-effects) variant -----------------------
    # Demean x and y per division: slopes then come only from within-division
    # compositional variation, robust to between-division confounding. Dims
    # with low within-variance share (language/education) will widen a lot.
    print("\n=== within-division (FE) vs pooled estimates (ridge lambda=0.1) ===")
    fe_out = {}
    for dname, cols in DIMS.items():
        k = len(cols)
        xbar, ybar = {}, {}
        for dv, us in by_div.items():
            dw = sum(u["w"] for u in us)
            xbar[dv] = {c: sum(u["w"] * u["x"][c] for u in us) / dw for c in cols}
            ybar[dv] = {p: sum(u["w"] * u["y"][p] for u in us) / dw for p in PARTIES}
        for u in units:
            u["_dx"] = {c: u["x"][c] - xbar[u["div"]][c] for c in cols}
            u["_dy"] = {p: u["y"][p] - ybar[u["div"]][p] for p in PARTIES}
        per_div = {}
        for dv, us in by_div.items():
            xwx = [[0.0] * k for _ in range(k)]
            xwy = {p: [0.0] * k for p in PARTIES}
            for u in us:
                xi = [u["_dx"][c] for c in cols]
                for a in range(k):
                    for bb in range(k):
                        xwx[a][bb] += u["w"] * xi[a] * xi[bb]
                    for p in PARTIES:
                        xwy[p][a] += u["w"] * xi[a] * u["_dy"][p]
            per_div[dv] = (xwx, xwy)

        def assemble_fe(mult):
            xwx = [[0.0] * k for _ in range(k)]
            xwy = {p: [0.0] * k for p in PARTIES}
            for dv, m in mult.items():
                if not m:
                    continue
                dxwx, dxwy = per_div[dv]
                for a in range(k):
                    for bb in range(k):
                        xwx[a][bb] += m * dxwx[a][bb]
                    for p in PARTIES:
                        xwy[p][a] += m * dxwy[p][a]
            return xwx, xwy

        wsum = sum(u["w"] for u in units)
        natp = {p: sum(u["w"] * u["y"][p] for u in units) / wsum for p in PARTIES}
        grp_w = [sum(u["w"] * u["x"][c] for u in units) / wsum for c in cols]

        fxwx, fxwy = assemble_fe({dv: 1 for dv in divs})
        fe_beta = {}
        for p in PARTIES:
            slopes = solve([row[:] for row in fxwx], fxwy[p][:])
            # anchor: group levels, centred so weighted mean == national share
            anchor = sum(slopes[j] * grp_w[j] for j in range(k))
            fe_beta[p] = [natp[p] + slopes[j] - anchor for j in range(k)]
        fe_boot = {p: [[] for _ in cols] for p in PARTIES}
        for _ in range(BOOTS):
            mult = {dv: 0 for dv in divs}
            for _dv in divs:
                mult[rng.choice(divs)] += 1
            bxwx, bxwy = assemble_fe(mult)
            for p in PARTIES:
                slopes = solve([row[:] for row in bxwx], bxwy[p][:])
                anchor = sum(slopes[j] * grp_w[j] for j in range(k))
                for j in range(k):
                    fe_boot[p][j].append(natp[p] + slopes[j] - anchor)
        lamrec = results["fits"][dname].get("0.1")
        fe_out[dname] = {}
        for p in PARTIES:
            fe_out[dname][p] = {}
            for j, c in enumerate(cols):
                s = sorted(fe_boot[p][j])
                dif = abs(fe_beta[p][j] - (lamrec["est"][p][c]["est"] if lamrec else float("nan")))
                fe_out[dname][p][c] = {"est": round(fe_beta[p][j], 2),
                                       "ci95": [round(s[int(0.025 * BOOTS)], 2),
                                                round(s[int(0.975 * BOOTS)], 2)],
                                       "pooledEst": lamrec["est"][p][c]["est"] if lamrec else None,
                                       "absGapVsPooled": round(dif, 2)}
    results["fe"] = fe_out
    for dname in DIMS:
        worst = max(((abs(fe_out[dname][p][c]["est"] - fe_out[dname][p][c]["pooledEst"]), p, c)
                     for p in PARTIES for c in DIMS[dname]),
                    default=None)
        print(f"{dname:<10} largest FE-vs-pooled gap: {worst[1]} {worst[2]} {worst[0]:.2f}pp")
        for p in PARTIES:
            for c in DIMS[dname]:
                cell = fe_out[dname][p][c]
                print(f"  {p:<4} {c:<10} FE {cell['est']:>6.2f} [{cell['ci95'][0]:>6.2f},{cell['ci95'][1]:>6.2f}]"
                      f"  pooled {cell['pooledEst']:>6.2f}")

    # validation table (lambda=0.1) against poll targets.
    # Two lenses:
    #  1. LEVELS — literal estimate vs pooled poll reading (polls are early-term
    #    2025H2-2026, post-election; levels move, so level-misses are expected
    #    for parties whose national share has moved).
    #  2. PROFILE — each party's estimates and poll readings both centred on
    #    their own group-weighted mean, removing the national-level shift;
    #    a feasibility study cares whether the GROUP PATTERN is right.
    print("\n=== estimates (ridge lambda=0.1) vs pooled polls ===")
    agree, total_cells = 0, 0
    shape_rows = []
    for dname in DIMS:
        lamrec = results["fits"][dname].get("0.1")
        if not lamrec:
            continue
        cols = lamrec["cols"]
        wsum = sum(u["w"] for u in units)
        grp_w = {c: sum(u["w"] * u["x"][c] for u in units) / wsum for c in cols}
        rows = []
        for p in PARTIES:
            est_mean = sum(lamrec["est"][p][c]["est"] * grp_w[c] for c in cols)
            poll_cells = {c: lamrec["est"][p][c] for c in cols if lamrec["est"][p][c]["poll"] is not None}
            poll_mean = (sum(v["poll"] * grp_w[c] for c, v in poll_cells.items())
                         if poll_cells else None)
            for c in cols:
                cell = lamrec["est"][p][c]
                if cell["poll"] is None:
                    continue
                total_cells += 1
                lo, hi = cell["ci95"]
                inBand = lo <= cell["poll"] <= hi
                agree += inBand
                dShape = abs((cell["est"] - est_mean) - (cell["poll"] - poll_mean))
                shape_rows.append({"dim": dname, "party": p, "group": c,
                                   "shapeDelta": round(dShape, 2)})
                rows.append((dname, p, c, cell["est"], lo, hi, cell["poll"], "ok" if inBand else "MISS"))
        for r in rows:
            print(f"{r[0]:<10} {r[1]:<4} {r[2]:<10} est {r[3]:>6.2f} [{r[4]:>6.2f},{r[5]:>6.2f}] poll {r[6]:>6.2f} {r[7]}")
        results["validation"][dname] = lamrec["weighted_r2"]
    print(f"\npoll 95%-interval coverage: {agree}/{total_cells}")
    deltas = [r["shapeDelta"] for r in shape_rows]
    shape_summary = {
        "cells": len(deltas),
        "medianShapeDelta": round(sorted(deltas)[len(deltas) // 2], 2),
        "p90ShapeDelta": round(sorted(deltas)[int(0.9 * len(deltas))], 2),
        "maxShapeDelta": max(deltas),
        "worst": sorted(shape_rows, key=lambda r: -r["shapeDelta"])[:8],
    }
    results["coverage"] = {"inBand": agree, "cells": total_cells, "boots": BOOTS,
                           "shape": shape_summary}
    print(f"profile-shape delta (pp, centred): median {shape_summary['medianShapeDelta']}, "
          f"p90 {shape_summary['p90ShapeDelta']}, max {shape_summary['maxShapeDelta']}")
    for wrow in shape_summary["worst"]:
        print(f"   worst: {wrow['dim']} {wrow['party']} {wrow['group']} {wrow['shapeDelta']}pp")

    with open(OUT, "w") as fh:
        json.dump(results, fh, indent=1)
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
