#!/usr/bin/env python3
"""data/sa26-seifa.json — ABS SEIFA 2021 per SA district for the SA 2026 map.

The federal seats' SEIFA lane reads the division store's published-or-derived
scores. No publisher derives scores for SA's state districts, so this derives
them: the ABS SEIFA 2021 SA1 cube's four index scores (IRSAD, IRSD, IER, IEO)
population-weighted over each district's SA1s — the ABS's own 2039.0 §2.2
recipe the federal division store uses at 2022/2025, on the SAME SA1→district
assignment the people-lanes pipeline computed (.build/map/sa26/assign-sa1.json,
a cache build_sa26_demo.py writes; this script never re-derives the join, so a
district's census people figures and its SEIFA scores always cover the same
geography).

Scores, not re-compositing: a district's index score is the usual-resident-
population-weighted average of its SA1s' index scores, weighted only where the
cube publishes a score. An SA1 the cube suppresses (score column blank — the
ABS suppresses an SA1 whose census data will not support an index) drops out
of that index only; a district whose suppressed share of the cube's own
population column passes W_OBS_MIN is a guard, never an estimate. The four
migratory/offshore sentinel SA1s carry no shape and sit outside the join, as
in the people lanes.

Deciles are ranked among the frame's own 47 district scores (rank_bands on
the weighted scores, equal-count bands 1 = least advantaged), the same
"ranked into tenths of the seats" the federal map's venue-level deciles
carry — not the ABS's national SA1 deciles.

Inputs (both caches already ride this repo's other pipelines):
  .matilda/seifa-irsad-abs/abs-seifa-2021-sa1-indexes.xlsx  (ABS cat 2033.0.55.001,
       SEIFA 2021 SA1 Table 1 — score and national-decile column per index,
       usual-resident population; read exactly as the federal
       derive-division-seifa-abs.py reads it, columns resolved by header
       title against its INDEX_TITLES canon)
  .build/map/sa26/assign-sa1.json   (4,325 SA1 -> district, the demo run's join)
  .build/map/sa26/data-sa26.json    (district roster; drift = fail-stop)

Re-fetch manifest when a cache is missing:
  SEIFA cube: ABS cat 2033.0.55.001 "Statistical Area Level 1, Indexes, SEIFA 2021"
              (2021Census_GCP_SA1_SEIFA_indexes ... xlsx); the seat-model
              pipeline's cache, see derive-division-seifa-abs.py ABS_CACHE
  join:       python3 -I .build/map/build_sa26_demo.py

Guards fail loud. usage: python3 -I .build/map/build_sa26_seifa.py
then the sa26 chain as in build_sa26_demo.py's docstring.
"""
import hashlib
import json
import os

try:
    import openpyxl
except ImportError:
    raise SystemExit("sa26-seifa: needs openpyxl (the seat-model pipeline's cube reader uses it)")

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sa26_geo import ASSIGN_MAP, DATA_JSON, load_assign_map

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CUBE_XLSX = os.path.join(
    REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2021-sa1-indexes.xlsx")
OUT = os.path.join(REPO, "data", "sa26-seifa.json")

IX = ["irsad", "irsd", "ier", "ieo"]
# derive-division-seifa-abs.py's own canon: each index's score column is the
# column whose printed title names the index (a decile column follows)
INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}
# cube row-set pins (national): Table 1 carries one row per 2021 SA1 the ABS
# scores (unpopulated and non-supporting SA1s have NO row — there is nothing
# to suppress), South Australia's own counted the same way; a district whose
# joinable cube-population share pools under the observed floor guards
CUBE_CODE_ROWS = 59421
CUBE_SA_ROWS = 4164
W_OBS_MIN = 0.90


def fail(msg):
    raise SystemExit(f"sa26-seifa: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# ------------------------------------------------------------------ the cube
def load_cube():
    """SA1 code -> {urp, ix: score|None} for South Australia's rows, columns
    resolved by header title (the federal reader's rule: the IRSD/IRSAD lead-
    column order swaps between editions, so a positional read misreads
    silently)."""
    if not os.path.exists(CUBE_XLSX):
        fail(f"missing SEIFA cube {CUBE_XLSX} (see docstring refetch)")
    wb = openpyxl.load_workbook(CUBE_XLSX, read_only=True)
    if "Table 1" not in wb.sheetnames:
        fail(f"cube sheets {wb.sheetnames} lack 'Table 1'")
    sh = wb["Table 1"]
    hdr = list(sh.iter_rows(values_only=True, max_row=6))
    title_row, urp_scan = list(hdr[4]), list(hdr[5])
    canon = lambda t: " ".join(str(t).upper().split())
    cols = {}
    for i, t in enumerate(title_row):
        if not t:
            continue
        for ix, wanted in INDEX_TITLES.items():
            if ix in cols:
                continue
            if any(w in canon(t) for w in wanted):
                cols[ix] = i
                break
    if set(cols) != set(IX):
        fail(f"cube header drift: resolved {sorted(cols)}, want {IX} — {title_row!r}")
    urp_col = next((i for i, t in enumerate(urp_scan)
                    if t and "USUAL RESIDENT POPULATION" in canon(t)), None)
    if urp_col is None:
        fail("cube lacks a USUAL RESIDENT POPULATION row label")

    out, nrows = {}, 0
    for row in sh.iter_rows(values_only=True, min_row=7):
        v = row[0] if row else None
        if isinstance(v, float):
            v = int(v)
        v = str(v) if v is not None else ""
        if not (len(v) == 11 and v.isdigit()):
            continue
        nrows += 1
        if not v.startswith("4"):
            continue
        rec = {"urp": float(row[urp_col]) if isinstance(row[urp_col], (int, float)) else 0.0}
        for ix in IX:
            s = row[cols[ix]]
            rec[ix] = float(s) if isinstance(s, (int, float)) else None
        out[v] = rec
    if nrows != CUBE_CODE_ROWS:
        fail(f"cube Table 1 code rows {nrows} != pin {CUBE_CODE_ROWS}")
    if len(out) != CUBE_SA_ROWS:
        fail(f"cube SA rows {len(out)} != pin {CUBE_SA_ROWS}")
    suppressed = sum(1 for r in out.values() if any(r[ix] is None for ix in IX))
    print(f"cube SA: {len(out)} rows ({suppressed} carry a suppressed index score)")
    return out


# ------------------------------------------------------------------ pool
def rank_bands(scores, k=10):
    """Equal-count bands 1..k over sorted values (ties ride together), the
    federal decile_of's convention: 1 = least advantaged."""
    srt = sorted(scores)
    n = len(srt)
    out = []
    for v in scores:
        r = srt.index(v) + 1
        out.append(min(k, k * (r - 1) // n + 1))
    return out


def main():
    cube = load_cube()
    assign = load_assign_map()

    with open(DATA_JSON) as f:
        order = [d["n"] for d in json.load(f)["divs"]]
    if len(order) != 47:
        fail("data-sa26.json drifted: run build_sa26_data.py first")

    joined = [c for c in assign if c in cube]
    # a joined SA1 with no cube row is UNSCORED (the ABS gives no row for an
    # SA1 it could not score) — it drops out of the index weightings exactly
    # as a suppressed score would, the federal derive_weighted's convention
    unscored = [c for c in assign if c not in cube]
    if unscored:
        print(f"unscored joined SA1s: {len(unscored)} (no cube row; dropped from weightings)")

    # pool: per district, per index, a urp-weighted average of SA1 scores over
    # the SA1s whose score the cube publishes for that index
    pool = {n: {ix: [0.0, 0.0] for ix in IX} for n in order}   # ix -> [Σ w·s, Σ w over published]
    poptot = {n: 0.0 for n in order}
    for code, dist in assign.items():
        r = cube.get(code)
        if r is None:
            continue
        poptot[dist] += r["urp"]
        for ix in IX:
            if r[ix] is not None:
                pool[dist][ix][0] += r[ix] * r["urp"]
                pool[dist][ix][1] += r["urp"]
    cells = {}
    worst = ("", 1.0)
    for dist in order:
        cells[dist] = {}
        for ix in IX:
            sw, w = pool[dist][ix]
            tot = poptot[dist]
            if tot <= 0:
                fail(f"{dist}: no cube population over its SA1s")
            obs = w / tot
            if obs < worst[1]:
                worst = (f"{dist}:{ix}", obs)
            if obs < W_OBS_MIN:
                fail(f"{dist}: {ix} observed across only {100 * obs:.1f}% of joined population — cannot derive")
            cells[dist][ix] = round(sw / w, 1)
    print(f"observed share: minimum {100 * worst[1]:.2f}% joined population ({worst[0]})")

    # deciles among the frame's own 47 scores; pct the rank fraction (the
    # sort key the federal cells carry)
    decs = {ix: rank_bands([cells[n][ix] for n in order]) for ix in IX}
    seifa = {}
    for i, dist in enumerate(order):
        row = {}
        for ix in IX:
            srt = sorted(cells[n][ix] for n in order)
            row[ix] = {"v": cells[dist][ix],
                       "pct": round((srt.index(cells[dist][ix]) + 1) / len(order), 4),
                       "dec": decs[ix][i]}
        seifa[dist] = row

    # ---------- reconciliation: the state-level population-weighted mean of
    # district scores must sit near the cube's own SA mean over joined SA1s
    # (weights redistribute identically — this is an identity check, not a
    # close-enough one)
    for ix in IX:
        num = sum(pool[n][ix][0] for n in order)
        den = sum(pool[n][ix][1] for n in order)
        statewide = num / den
        direct = [(cube[c][ix], cube[c]["urp"]) for c in joined]
        dnum = sum(s * w for s, w in direct if s is not None)
        dden = sum(w for s, w in direct if s is not None)
        if abs(statewide - dnum / dden) > 1e-6:
            fail(f"{ix}: pooled statewide mean {statewide} != direct {dnum / dden}")

    st = {}
    for ix in IX:
        num = sum(pool[n][ix][0] for n in order)
        den = sum(pool[n][ix][1] for n in order)
        st[ix] = round(num / den, 1)

    out = {
        "year": "sa26",
        "jurisdiction": "SA",
        "censusYear": 2021,
        "method": ("Population-weighted (ABS 2039.0 §2.2): a district's index score is the "
                   "usual-resident-population-weighted average of its SA1s' cube scores, "
                   "weighted over the SA1s whose score the cube publishes. SA1 assignment is "
                   "the people-lanes join cache, one district per SA1."),
        "weights": "cube usual-resident population",
        "seifa": {n: seifa[n] for n in order},
        "state": st,
        "src": {
            "cube": {"path": os.path.relpath(CUBE_XLSX, REPO), "sha16": hash16(CUBE_XLSX),
                     "product": "ABS 2033.0.55.001 SEIFA 2021, Statistical Area Level 1 indexes (Table 1)"},
            "assignMap": {"path": os.path.relpath(ASSIGN_MAP, REPO), "sha16": hash16(ASSIGN_MAP)},
        },
        "about": ("ABS SEIFA 2021 SA1 index scores (IRSAD, IRSD, IER, IEO) pooled to South "
                  "Australia's 47 state electoral districts, usual-resident-population "
                  "weighted per ABS 2039.0 §2.2 — the recipe the federal division store used "
                  "at the 2022/2025 editions, here on the SA1→district assignment the sa26 "
                  "people lanes computed. Deciles rank the 47 district scores into tenth-"
                  "equal bands (1 = least advantaged tenth of the 47); pct is the rank "
                  "fraction used for ordering. Suppressed SA1 scores drop out of their "
                  f"index only (observed-population floor {W_OBS_MIN:.0%})."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes); state means {st}")


main()
