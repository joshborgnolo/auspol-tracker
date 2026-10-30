#!/usr/bin/env python3
"""Shared edition-parameterised income-lane engine for the venue-era
census lanes (2001 / 2006 editions) — the same arithmetic
derive-booth-demo-2013.py's income_bcp() runs on the 2011 edition and
derive-booth-seifa-voter.py's income_gcp() on the 2016/2021 GCPs,
re-expressed once here so the three older-edition derive chains run the
same recipe instead of each carrying its own near-copy.

The lanes: loinc is the adult share below the national
25th-percentile weekly household-income cut the store's own incomeCuts
record carries (the edition's band grid, the national-ADULTS histogram
computed once with the cut band split linearly, in the edition's own
dollars); hiinc the adult share in the grid's TOP band ($2,000+ in
2001, $3,000+ in 2006, $4,000+ in 2011 and the GCP era — what moves
across editions is the edge the edition can print, so the page's hi
figure is edition-local --- the site copy reads each year's own
incomeCuts.hiEdgeWeekly for the dollar); incMed the band-interpolated
median weekly household income on the HOUSEHOLD basis (ABS's own
published-median basis — the adults-weighted histogram would read a
few hundred dollars higher, skewed by couples).

Adults re-weighting mirrors the GCP-era income_gcp lanes: each band's
household mass is multiplied by (fam share x adults-per-family-type
national factor + non-fam share x lone-person factor), the fam share
clamped to 1 (small-area perturbation of the independently-rounded
B26/G31 family cell can momentarily exceed the household Total it
shares its basis with), and a band's national mix is the fallback for
a basis-empty small cell.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

INC_LO_Q = 0.25  # low lane: adults below the national 25th percentile
# each edition's stated band grid, (lo, hi) inclusive; the top band's
# hi is None (open). Negative/Nil households fold INTO the first band
# (they ride the low tail); partial-stated and all-not-stated
# households sit outside every lane basis (the Who-votes income facet
# does likewise).
INC_BANDS_01 = [(1, 199), (200, 299), (300, 399), (400, 499),
                (500, 599), (600, 699), (700, 799), (800, 999),
                (1000, 1199), (1200, 1499), (1500, 1999), (2000, None)]
INC_BANDS_06 = [(1, 149), (150, 249), (250, 349), (350, 499),
                (500, 649), (650, 799), (800, 999), (1000, 1199),
                (1200, 1399), (1400, 1699), (1700, 1999), (2000, 2499),
                (2500, 2999), (3000, None)]
# plausible windows for the national 25% cut, per edition dollars
GUARD_LO = {"01": (380, 660), "06": (430, 720)}
# national adults share of the top open band (the 2001 top is a
# $2,000+ cliff — 9.2% of households, ~10.3% of adults; 2006's $3,000+
# reads 6.6% of adults vs 5.5% of households)
GUARD_HI = {"01": (0.05, 0.14), "06": (0.01, 0.1)}


def income_factors():
    """Adults-per-household factors from data/income-dist.json,
    mirroring derive-booth-seifa-voter.py's loader: (coupleNoChildren,
    coupleWithChildren, oneParent, otherFamily) factors and the
    non-family mean. The drift check pins the facet file's own 16-band
    git hash-shape (which histogram the factors were sourced from), not
    the edition grid the factors are applied to — the factors are per
    family composition, not per income band."""
    path = ROOT / "data/income-dist.json"
    if not path.exists():
        raise SystemExit("missing data/income-dist.json "
                         "(run node .build/extract-income-dist.mjs)")
    ax = json.loads(path.read_text(encoding="utf-8"))["axes"]["household"]
    ap = ax["adultsPer"]
    grid16 = [(1, 149), (150, 299), (300, 399), (400, 499),
              (500, 649), (650, 799), (800, 999), (1000, 1249),
              (1250, 1499), (1500, 1749), (1750, 1999), (2000, 2499),
              (2500, 2999), (3000, 3499), (3500, 3999), (4000, None)]
    grid16[0] = (0, 149)
    for (lo, hi), b in zip(grid16, ax["bands"]):
        if b["lo"] != lo or b["hi"] != hi:
            raise SystemExit(f"income-dist grid drift at [{lo},{hi}] vs {b}")
    return ((ap["coupleNoChildren"], ap["coupleWithChildren"],
             ap["oneParent"], ap["otherFamily"]), ap["nonFamily"])


def engine(rows, bands, ad, nonfam, era):
    """Per area: {code: (hh, fi, mix)} where hh is the edition's
    household-band totals WITH the neg/nil cell already folded into
    band 0 (13/15 long -> len(bands)), fi the family totals likewise,
    and mix the family-type composition rows [len(bands)][4]
    (couple-no-children, couple-with-children, one-parent, other;
    neg/nil types likewise folded). Returns:
       per_area: {code: (adults_total, adults_lo_mass, adults_hi_mass,
                         adults_band_masses, household_band_masses)}
       nat_cut:  the national 25% cut dollar (guarded per era)
       nat_hi:   the national adults top-band share (guarded)
    Guards fail loud (era-locked) so a drifted source never lands an
    implausible laneset."""
    nb = len(bands)
    nat = {"b": [0.0] * nb, "fi": [0.0] * nb,
           "mix": [[0.0] * 4 for _ in range(nb)]}
    for hh, fi, mix in rows.values():
        for i in range(nb):
            nat["b"][i] += hh[i]
            nat["fi"][i] += fi[i]
            for k in range(4):
                nat["mix"][i][k] += mix[i][k]
    nat_famper, nat_fams = [], []
    for i in range(nb):
        mixn = sum(nat["mix"][i])
        if mixn <= 0 or nat["b"][i] <= 0:
            raise SystemExit(f"national income mix empty in band {bands[i]}")
        nat_famper.append(sum(m * a for m, a in zip(nat["mix"][i], ad))
                          / mixn)
        nat_fams.append(min(1.0, nat["fi"][i] / nat["b"][i]))
    nat_adults = [nat["b"][i] * (nat_fams[i] * nat_famper[i]
                                 + (1 - nat_fams[i]) * nonfam)
                  for i in range(nb)]
    nat_tot = sum(nat_adults)
    cum, cut = 0.0, None
    for i, (lo, hi) in enumerate(bands):
        cum += nat_adults[i] / nat_tot
        if cum >= INC_LO_Q:
            prev = cum - nat_adults[i] / nat_tot
            f = (INC_LO_Q - prev) / (nat_adults[i] / nat_tot)
            if hi is None:
                raise SystemExit("income 25% cut lands in the open top band")
            cut = lo + f * (hi - lo + 1)
            break
    glo, ghi = GUARD_LO[era]
    if not cut or not glo <= cut <= ghi:
        raise SystemExit(f"income 25% cut {cut} outside era guard {GUARD_LO[era]}")
    hi_share = nat_adults[-1] / nat_tot
    gloh, ghih = GUARD_HI[era]
    if not gloh <= hi_share <= ghih:
        raise SystemExit(f"top-band national share {hi_share:.4f} outside "
                         f"{GUARD_HI[era]}")

    out = {}
    for code, (hh, fi, mix) in rows.items():
        bands_ad = []
        for i in range(nb):
            mixn = sum(mix[i])
            famper = (sum(m * a for m, a in zip(mix[i], ad)) / mixn
                      if mixn > 0 else nat_famper[i])
            fams = min(1.0, fi[i] / hh[i]) if hh[i] > 0 else nat_fams[i]
            bands_ad.append(hh[i] * (fams * famper + (1 - fams) * nonfam))
        tsum = sum(bands_ad)
        lo_mass = 0.0
        for i, (lo, hi) in enumerate(bands):
            if cut <= lo:
                continue
            if hi is not None and cut > hi:
                lo_mass += bands_ad[i]
                continue
            lo_mass += bands_ad[i] * (cut - lo) / (hi - lo + 1)
            break
        out[code] = (tsum, lo_mass, bands_ad[-1],
                     tuple(bands_ad), tuple(hh))
    return out, round(cut, 2), round(hi_share, 6)


def band_median(masses, bands):
    """Interpolated median weekly income ($) of a pooled household-band
    histogram — linear inside the median band; None when the basis is
    empty or the median lands in the open top band (never plausible at
    division scale; flagged at emit when a division ever sees it)."""
    tot = sum(masses)
    if tot <= 0:
        return None
    half = tot / 2
    cum = 0.0
    for i, (lo, hi) in enumerate(bands):
        cum2 = cum + masses[i]
        if cum2 >= half:
            if hi is None or masses[i] == 0:
                return None
            f = (half - cum) / masses[i]
            return lo + (hi - lo + 1) * f
        cum = cum2
    return None
