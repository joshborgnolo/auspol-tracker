#!/usr/bin/env python3
"""derive-booth-seifa-stats90s.py — booth-level SEIFA lane for the
statistics-era federal frames: emits/updates data/booth-seifa-YYYY.json
for elections 1993/1996/1998/2001 in exactly data/booth-seifa-2004.json's
shape (the store schema the map builders' seifa consumers read), so the
SEIFA lens runs on the statistics frames the same way it runs 2004-2025.

Per election, every polling-place venue point is joined to the era
census-CD polygon containing it and attaches that census's SEIFA index
scores (irsd/ier/ieo for the 1991/1996-census five-index-era cubes;
those plus irsad for the 2001 cube) and NATIONAL DECILES computed by
ABS's 2001-era quantile recipe (each area counted once, Hyndman-Fan
type 2 — the same derivation derive-booth-seifa-hist.py's cd2001 lane
runs, cross-verified inside this script against that lane's decile
assignment on every shared CD).

Era doctrine per election (percentile interpolation, same as the
GCP-era INTERP lanes):

  1993 -> measured SEIFA 1991 | interp c1 1996 | f = 0.320197
  1996 -> measured SEIFA 1996 | interp c0 1991 | f = 0.914067
  1998 -> measured SEIFA 1996 | interp c1 2001 | f = 0.431308
  2001 -> measured SEIFA 2001 only (election 10 Nov 2001 sat three
          months after census night; the demo-lane doctrine's
          measured-only style for this frame, no far-side join)

Venue coordinates per election (the frames have no AEC coordinate roll)
come from the SAME sources the census-people demo lanes ride, so a
booth's SEIFA CD and its demo CD are the same assignment by
construction:

  1993/1996/1998 — data/booth-locations-history.json (the history
    arc's common matcher — derive-booth-demo-90s.py's own venue source)
  2001 — data/booth-seifa-2001.json's own committed coordinates
    (derive-2001-venues.py; no history-store row rides 2001)

CD-code joins reuse derive-booth-demo-90s.py's PIP + 1,500 m
venue-nearest era-linework rescue on the same polygon sources
(asgc1991/asgc1996 gpkg; asgc2001 gpkg for the 2001-era joins), and the
emitted rows keep the GCP-era consumers' exact field names (seifa.dec /
pct / seifaInterp), so a booth card reads all lanes off one plumbing.

Emission per year:
  1993/1998 — NEW file data/booth-seifa-<year>.json (full store; its
    booth registry is the history-location store's, asserted name+id
    identical to the assembled stats frame's booth universe).
  1996/2001 — READ-MODIFY-WRITE of the committed venue stores
    (derive-1996-venues.py / derive-2001-venues.py): every pre-existing
    key passes through byte-identical; seifa/censusGeo/seifaPct/
    seifaInterp subkeys carry the filled lane; seifaEdition/geography/
    indexes/seifaCounts/_pcti land beside the existing keys.

Guards fail loud: cube universes and populations pinned (AURIN
seifa-cd cube CSVs via fetch-aurin-census.py --census=seifa); the
2001 AURIN cube's decile recipe is asserted identical to the ABS-zip
lane's on every shared CD; booth registries tie to the assembled
frames' universes; every scored figure's percentile is ranked inside
its own census's era pool.

Run from the repo root:
    python3 .build/analysis/seat-model/derive-booth-seifa-stats90s.py
"""

import bisect
import collections
import csv
import importlib.util
import json
import math
import sys
from datetime import date
from pathlib import Path

csv.field_size_limit(sys.maxsize)

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"


def _lib(name, path):
    spec = importlib.util.spec_from_file_location(name, SM / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


hist = _lib("hist", "derive-booth-seifa-hist.py")
d90 = _lib("d90", "derive-booth-demo-90s.py")
fail = hist.fail
hash16 = hist.hash16
r6 = hist.r6

CACHE = SM / "cache"
VENUE_LOCATIONS = ROOT / "data/booth-locations-history.json"

CUBES = {
    1991: {"file": "seifa_cd_1991.csv", "code": "cd_code",
           "pop": "_seifa91_population", "rows": 31058,
           "natPop": 16772892,
           "idx": {"irsd": "index_of_relative_socio_economic_disadvantage",
                   "ier": "_index_of_economic_resources",
                   "ieo": "index_of_education_and_occupation_"},
           "label": "CD (ASGC 1991)"},
    1996: {"file": "seifa_cd_1996.csv", "code": "cd_code",
           "pop": "_seifa96_population", "rows": 34043,
           "natPop": 17674788,
           "idx": {"irsd": "index_of_relative_socio_economic_disadvantage",
                   "ier": "_index_of_economic_resources",
                   "ieo": "index_of_education_and_occupation_"},
           "label": "CD (ASGC 1996)"},
    2001: {"file": "seifa_cd_2001.csv", "code": "cd_code_2001",
           "pop": "seifa_2001_population", "rows": 35695,
           "natPop": 18726897,
           "idx": {"irsd": "irsd_score", "ier": "ier_score",
                   "ieo": "ieo_score", "irsad": "isad_score"},
           "label": "CD (ASGC 2001)"},
}
ELECTIONS = {
    1993: {"cube": 1991, "c0": 1991, "c1": 1996, "measured": "pct0",
           "booths": 8431, "coordsSource": "history"},
    1996: {"cube": 1996, "c0": 1991, "c1": 1996, "measured": "pct1",
           "booths": 8463, "coordsSource": "history"},
    1998: {"cube": 1996, "c0": 1996, "c1": 2001, "measured": "pct0",
           "booths": 8311, "coordsSource": "history"},
    2001: {"cube": 2001, "interp": False, "coordsSource": "store"},
}

STE_OF_DIGIT = hist.STE_OF_DIGIT
STATE_ORDER = hist.STATE_ORDER
NEAREST_CAP_M = d90.NEAREST_CAP_M

PCTI_METHOD = (
    "seifaPct = the prePrefs area's score percentile among all scored "
    "areas of the measured cube (ascending score, min-rank on ties, r6 "
    "half-up). seifaInterp joins the same venue point into the OTHER "
    "bracketing census-era geometry; pcti = (1-f)*pct0 + f*pct1 "
    "computed from the emitted r6-rounded pct0/pct1/f (the file "
    "re-derives its own pcti).")


def load_cube(year, verify_2001=False):
    """AURIN seifa-cd CSV -> {cd: {idx:score, idx_d:decile, pop}}; the
    decile recipe is ABS's 2001-era quantile derivation (HF type 2,
    area-count) — for the 2001 cube this script cross-verifies the
    assignment against the ABS-zip lane's (hist.cube_cd2001)."""
    spec = CUBES[year]
    path = CACHE / "seifa-cd-aurin" / spec["file"]
    if not path.exists():
        fail(f"missing {path} (fetch-aurin-census.py --census=seifa)")
    cube, pops = {}, 0
    with path.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            code = (row.get(spec["code"]) or "").strip()
            if len(code) != 7 or not code.isdigit():
                continue
            if code[0] not in STE_OF_DIGIT:
                continue
            pop_s = (row.get(spec["pop"]) or "").strip()
            pop = round(float(pop_s)) if pop_s else 0
            rec = {"pop": pop}
            for idx, col in spec["idx"].items():
                v = (row.get(col) or "").strip()
                # scores kept at the ABS-zip lane's 1dp precision, so
                # deciles/percentiles computed below land exactly on the
                # GCP-era derive-booth-seifa-hist.py 2004-lane figures
                # (cube_cd2001 rounds likewise)
                rec[idx] = round(float(v), 1) if v else None
            cube[code] = rec
            pops += pop
    if len(cube) != spec["rows"]:
        fail(f"seifa{year} cube rows {len(cube)} != pin {spec['rows']}")
    if pops != spec["natPop"]:
        fail(f"seifa{year} population {pops} != pin {spec['natPop']}")
    for idx in spec["idx"]:
        vals = [r[idx] for r in cube.values() if r[idx] is not None]
        edges = [hist._abs_quantile_2001(vals, q / 10)
                 for q in range(1, 10)]
        if edges != sorted(edges):
            fail(f"seifa{year} {idx}: decile edges not sorted")
        if not (100 < edges[0] < 1450 and 100 < edges[-1] < 1450):
            fail(f"seifa{year} {idx}: decile edges out of range")
        for rec in cube.values():
            s = rec[idx]
            rec[idx + "_d"] = (bisect.bisect_left(edges, s) + 1
                               if s is not None else None)
    if verify_2001:
        # identical decile assignment to the ABS-zip lane on every
        # shared CD, all four indexes — the AURIN lane and the zip lane
        # are the same cat.2033.0.55.001 product re-packaged
        zcube = hist.cube_cd2001(hist.CUBE_PATHS["cd2001"])
        ddec, dscore, extra = [], [], [c for c in zcube if c not in cube]
        for code, rec in cube.items():
            z = zcube.get(code)
            if z is None:
                ddec.append((code, "cube-only"))
                continue
            for idx in ("irsd", "ier", "ieo", "irsad"):
                if rec[idx + "_d"] != z[idx + "_d"]:
                    ddec.append((code, idx, rec[idx + "_d"],
                                 z[idx + "_d"]))
                if rec[idx] is not None and z[idx] is not None and \
                        abs(rec[idx] - z[idx]) > 0.000001:
                    dscore.append((code, idx, rec[idx], z[idx]))
        # the two ABS distributables of cat.2033.0.55.001 disagree on a
        # handful of cells' fourth decimal (print-resolution noise); decile
        # assignment must be EXACT, score cells identical to the 1dp print
        if ddec or extra or any(abs(s[2] - s[3]) > 0.100001 for s in dscore):
            fail(f"seifa2001 AURIN-vs-ABS-zip drift: {len(ddec)} decile+ "
                 f"{len(dscore)} score mismatches, {len(extra)} zip-only "
                 f"({ddec[:4]}, {dscore[:4]}, {extra[:4]})")
        if dscore:
            print(f"seifa2001: {len(dscore)} cells differ at the prints' "
                  f"4th-decimal resolution (max "
                  f"{max(abs(s[2] - s[3]) for s in dscore):.2f}); "
                  "deciles identical")
        else:
            print("seifa2001: AURIN cube == ABS-zip cube "
                  "(35,695 CDs, deciles identical)")
    print(f"seifa{year} cube: {len(cube):,} CDs, pop {pops:,}, "
          f"deciles by ABS's 2001 quantile recipe")
    return cube


def ladder(cube, idx):
    return sorted(r[idx] for r in cube.values() if r[idx] is not None)


def pct_of(ladder_ref, score):
    r = bisect.bisect_left(ladder_ref, score)
    return r6((r + 1) / len(ladder_ref))


def era_locate(census):
    """PIP + the demo lane's identical era-linework nearest rescue —
    the booths' seifa CD assignments equal the demo lanes' by
    construction."""
    polys = d90.era_polygons(census)
    buckets = d90.ct_index(polys)

    def go(lat, lon):
        code = d90._pip(lat, lon, buckets)
        if code is not None:
            return code, None
        code, m = d90._nearest_within(lat, lon, polys, NEAREST_CAP_M)
        return code, m
    return go


def frame_booth_names(year):
    """boothId -> (div-name, booth-name, div-id) from the assembled
    stats frame (the tracked res-<year>.json; data-<year>.json is the
    gitignored build intermediate) — the oracle for the join registry's
    name/id discipline."""
    d = json.loads((ROOT / f"map/data/res-{year}.json")
                   .read_text(encoding="utf-8"))
    divs = d["divs"]
    b = d["booths"]
    return {b["id"][i]: (divs[b["d"][i]]["n"], b["n"][i],
                        divs[b["d"][i]]["id"]) for i in range(len(b["id"]))}


def interp_f(year, c0, c1):
    return r6((hist.ELECTION_DAY[year] - hist.CENSUS_NIGHT[c0]).days
              / (hist.CENSUS_NIGHT[c1] - hist.CENSUS_NIGHT[c0]).days)


def join_interp(interp, pct, cube, idxs, lat, lon, counts):
    far_ok = True
    fcode, _m = interp["far_locate"](lat, lon)
    frec = interp["far_cube"].get(fcode) if fcode else None
    if fcode is None:
        counts["interpFarOutside"] += 1
        far_ok = False
    elif frec is None:
        counts["interpFarSuppressed"] += 1
        far_ok = False
    if not far_ok:
        return None
    valid = {}
    for i in idxs:
        if i not in pct or frec.get(i) is None:
            continue
        p_far = pct_of(interp["far_lad"][i], frec[i])
        p0, p1 = (pct[i], p_far) if interp["measured"] == "pct0" \
            else (p_far, pct[i])
        valid[i] = {"pct0": p0, "pct1": p1,
                    "pcti": r6((1 - interp["f"]) * p0 + interp["f"] * p1)}
    if valid:
        counts["interp"] += 1
        return valid
    return None


def emit(year):
    e = ELECTIONS[year]
    cube_year = e["cube"]
    idxs = list(CUBES[cube_year]["idx"])
    cube = load_cube(cube_year, verify_2001=(cube_year == 2001))
    locate = era_locate(cube_year)
    interp = None
    if e.get("interp", True) is not False:
        far_census = e["c1"] if e["measured"] == "pct0" else e["c0"]
        interp = {
            "c0": e["c0"], "c1": e["c1"],
            "f": interp_f(year, e["c0"], e["c1"]),
            "measured": e["measured"],
            "far_census": far_census,
            "far_cube": load_cube(far_census),
            "far_locate": era_locate(far_census),
        }
    lad = {idx: ladder(cube, idx) for idx in idxs}
    if interp is not None:
        interp["far_lad"] = {idx: ladder(interp["far_cube"], idx)
                             for idx in CUBES[interp["far_census"]]["idx"]}

    counts = collections.Counter()
    near_dists = []

    def score(lat, lon):
        """Per-booth join: returns (censusGeo, seifa, pct, seifaInterp)
        with note-count bookkeeping."""
        code, near_m = locate(lat, lon)
        if code is None:
            counts["pointOutside"] += 1
            return None, None, None, None
        if near_m is not None:
            near_dists.append(near_m)
            counts["geoNearest"] += 1
        if STE_OF_DIGIT.get(code[0]) == "OT":
            counts["otTerritory"] += 1
        rec = cube.get(code)
        if rec is None or all(rec[i] is None for i in idxs):
            counts["seifaSuppressed"] += 1
            return code, None, None, None
        seifa = {i: round(rec[i], 1) for i in idxs if rec[i] is not None}
        seifa["dec"] = {i: rec[i + "_d"] for i in idxs if rec[i] is not None}
        pct = {i: pct_of(lad[i], rec[i]) for i in idxs
               if rec[i] is not None}
        si = join_interp(interp, pct, cube, idxs, lat, lon,
                         counts) if interp else None
        counts["scored"] += 1
        return code, seifa, pct, si

    if e["coordsSource"] == "history":
        venues = d90.load_venues(year)
        frame_names = frame_booth_names(year)
        out_rows = []
        for vb in venues:
            row = {k: vb[k] for k in
                   ("div", "divId", "state", "boothId", "booth", "type")}
            lat, lon = vb["_lat"], vb["_lon"]
            if lat is None or lon is None:
                row["censusGeo"] = row["seifa"] = None
                counts["noCoords"] += 1
                row["note"] = "noCoords"
            elif not (-55.0 < lat < -9.0 and 95.0 < lon < 169.5):
                row["censusGeo"] = row["seifa"] = None
                row["note"] = "badCoords"
                counts["badCoords"] += 1
            else:
                code, seifa, pct, si = score(lat, lon)
                if seifa is None and code is None:
                    row["note"] = "pointOutside"
                row["censusGeo"] = code
                row["seifa"] = seifa
                if pct is not None and interp is not None:
                    row["seifaPct"] = pct
                if si is not None:
                    row["seifaInterp"] = si
                row["lat"] = round(lat, 6)
                row["lon"] = round(lon, 6)
                if seifa is None and code is not None:
                    row["note"] = "seifaSuppressed"
            out_rows.append(row)
        for b in out_rows:
            want = frame_names.get(b["boothId"])
            if want is None:
                fail(f"{year}: registry boothId {b['boothId']} absent "
                     "from the assembled frame")
            if (want[0], want[1], want[2]) != (b["div"], b["booth"],
                                               b["divId"]):
                fail(f"{year}: boothId {b['boothId']} "
                     f"({b['div']},{b['booth']},{b['divId']}) != "
                     f"frame {want}")
        if len(out_rows) != e["booths"]:
            fail(f"{year}: registry {len(out_rows)} != frame "
                 f"{e['booths']}")
        order = {s: i for i, s in enumerate(STATE_ORDER)}
        out_rows.sort(key=lambda b: (order[b["state"]], b["div"],
                                     b["boothId"]))
        finish_counts(year, counts, near_dists, len(out_rows))
        out = build_store(year, cube_year, idxs, interp, counts,
                          near_dists)
        out["_provenance"]["files"][
            "data/booth-locations-history.json"] = hash16(VENUE_LOCATIONS)
        out["booths"] = out_rows
        write_new(year, out)
        return

    # RMW path (1996 reserved for history, 2001 rides its own store)
    store_path = ROOT / f"data/booth-seifa-{year}.json"
    if not store_path.exists():
        fail(f"missing {store_path}")
    store = json.loads(store_path.read_text(encoding="utf-8"))
    for vb in store["booths"]:
        vb.pop("note", None)
        lat, lon = vb.get("lat"), vb.get("lon")
        if lat is None or lon is None:
            counts["noCoords"] += 1
            vb["censusGeo"] = None
            vb["seifa"] = None
            vb["note"] = "noCoords"
            continue
        code, seifa, pct, si = score(lat, lon)
        vb["censusGeo"] = code
        vb["seifa"] = seifa
        if code is None:
            vb["note"] = "pointOutside"
        elif seifa is None:
            vb["note"] = "seifaSuppressed"
        if pct is not None and interp is not None:
            vb["seifaPct"] = pct
        if si is not None:
            vb["seifaInterp"] = si
    finish_counts(year, counts, near_dists, len(store["booths"]))
    idxs_list = list(CUBES[cube_year]["idx"])
    store["seifaEdition"] = cube_year
    store["geography"] = CUBES[cube_year]["label"]
    store["indexes"] = idxs_list
    store["seifaCounts"] = dict(counts)
    store["geoNearestCapM"] = NEAREST_CAP_M
    store.setdefault("_provenance", {})["seifa"] = {
        "files": {str((CACHE / "seifa-cd-aurin" /
                      CUBES[cube_year]["file"]).relative_to(ROOT)):
                  hash16(CACHE / "seifa-cd-aurin" /
                         CUBES[cube_year]["file"])},
        "extractedAt": str(date.today()),
        "note": ("SEIFA lane filled by derive-booth-seifa-stats90s.py: "
                 "the venue stand-in CD's scores + national deciles "
                 "(ABS quantile recipe, cross-verified against the "
                 "ABS-zip lane for 2001) + the census-era percentile "
                 "interpolation."),
    }
    if interp is not None:
        store["_pcti"] = pcti_block(year, interp, counts)
    store_path.write_text(json.dumps(store, indent=2, ensure_ascii=False)
                          + "\n", encoding="utf-8")
    print(f"OK -> {store_path} ({len(store['booths'])} booths, "
          "seifa filled)")


def finish_counts(year, counts, near_dists, n_booths):
    counts["booths"] = n_booths
    coordful = counts["scored"] + counts["seifaSuppressed"] \
        + counts["pointOutside"]
    if coordful:
        srate = counts["scored"] / coordful
        print(f"{year} counts: {dict(counts)} "
              f"(scored rate {srate:.3%})")
    if near_dists:
        sd = sorted(near_dists)
        print(f"{year} geoNearest p50 {sd[len(sd) // 2]:.0f} m "
              f"p95 {sd[int(0.95 * len(sd))]:.0f} m")


def pcti_block(year, interp, counts):
    return {
        "method": PCTI_METHOD,
        "c0": interp["c0"], "c1": interp["c1"],
        "date": hist.ELECTION_DAY[year].isoformat(),
        "f": interp["f"],
        "measured": interp["measured"],
        "booths": counts.get("interp", 0),
        "censusNights": {str(interp["c0"]):
                         hist.CENSUS_NIGHT[interp["c0"]].isoformat(),
                         str(interp["c1"]):
                         hist.CENSUS_NIGHT[interp["c1"]].isoformat()},
    }


def build_store(year, cube_year, idxs, interp, counts, near_dists):
    out = {
        "_about": ("Per-booth SEIFA lane for the statistics-era "
                   f"federal frame {year}: the venue's "
                   f"{CUBES[cube_year]['label']} scores + national "
                   "deciles (ABS's quantile recipe derived here) via "
                   "the venue point from data/booth-locations-history."
                   "json, joined by the demo lane's own point-in-poly "
                   "+ 1,500 m era-linework nearest rescue (the same "
                   "CD assignment ride, so no booth mixes lanes across "
                   "two districts). The area is THE PREMISES area — a "
                   "geographic proxy for the catchment's SES, not an "
                   "aggregate of catchment voters. Pre-2001 censuses "
                   "carry no IRSAD (the five-index era). "
                   "Coordinate-less records carry note=noCoords and "
                   "null seifa lanes, exactly the GCP-era contract."),
        "_provenance": {"files": {}, "extractedAt": str(date.today())},
        "election": year,
        "seifaEdition": cube_year,
        "geography": CUBES[cube_year]["label"],
        "indexes": idxs,
        "stateFlagBooths": [],
        "counts": dict(counts),
        "geoNearestCapM": NEAREST_CAP_M,
    }
    if interp is not None:
        out["_pcti"] = pcti_block(year, interp, counts)
    return out


def write_new(year, out):
    opath = ROOT / f"data/booth-seifa-{year}.json"
    opath.write_text(json.dumps(out, indent=2, ensure_ascii=False)
                     + "\n", encoding="utf-8")
    print(f"OK -> {opath} ({len(out['booths'])} booths)")


def main():
    years = [int(a.split("=")[1]) for a in sys.argv[1:]
             if a.startswith("--year=")]
    for y in (years or sorted(ELECTIONS)):
        emit(y)


if __name__ == "__main__":
    main()
