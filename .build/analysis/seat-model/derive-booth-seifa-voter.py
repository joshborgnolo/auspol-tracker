#!/usr/bin/env python3
"""Voter-footprint SEIFA per booth, elections 2016/2019/2022/2025.

Complement of the venue-proxy stores (derive-booth-seifa-2025.py /
derive-booth-seifa-hist.py, which key each booth to the SA1 of its
PREMISES). This store weights SEIFA by where each booth's VOTERS LIVE,
from the AEC "Votes by SA1" product (roll mark-off x polling-place
results; the AEC flags the counts "indicative… not directly comparable
to vote counts due to rounding" — reconciled against the committed FPV
per-booth totals on every run and recorded in the store's counts).

Emits one data/booth-seifa-voter-YYYY.json per election (the footprint
exists only for 2016+ — the AEC published no SA1/CCD product earlier).

Concordance: the file's 7-digit ccd_id/SA1_id IS the 11-digit SA1 code
with the SA4+SA3 digits dropped (code[0] + code[5:11]) — verified
injective on all three ASGS editions (pins below). The 2019 lane joins
the 2016-census cube DIRECTLY on its 7-digit key column; the 2016 lane
the 2011 cube likewise. The 2025 lane decodes to SA1_CODE21 first; the
2022 lane decodes to SA1_MAIN16 then redistributes via the ABS Ed2->Ed3
correspondence (RATIO_FROM_TO shares) to reach the same 2021-census cube.
Per-index SEIFA suppression is partial within an SA1, so each index
weights over its own covered-vote denominator (recorded per unit in cov).
Sentinel SA1 ids (ABS migratory/no-usual-address; shapes …9999 and the
2016-era OT form 9999901) carry no scores: their votes are counted
(counts.votesSentinel, ids pinned in counts.sentinelIds) and excluded
from weights.
pp_id 0 rows are division-level declaration cohorts (Postal/Pre-Poll/
Absent/Provisional) — kept as per-division cohort units, never as booths.

Inputs (git-ignored caches under .build/analysis/seat-model/cache/votes-sa1/,
re-fetch manifest on missing):
  2025: 2025-federal-election-votes-sa1-nat.csv — AEC fe25
        downloads-statistics page, "Votes by SA1 – national" zip
  2022: votes-sa1-2022.csv — AEC 2022 downloads page ("Votes by SA1" national)
  2019: votes-sa1-2019.csv — AEC 2019 downloads page ("Votes by SA1" national)
  2016: votes-sa1-2016.xlsx — AEC 2016 downloads page ("Votes by SA1" xlsx,
        sheet "HouseCatchment (2016FE)")
  2022: CG_SA1_2016_SA1_2021.csv — ABS ASGS Ed3 correspondences page
        https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/correspondences/CG_SA1_2016_SA1_2021.csv
Plus committed/held: data/booth-seifa-YYYY.json (booth universe + venue
scores), .build/aec-flow-src/booth/fpv/YYYY-<ST>.csv.gz (reconcile),
.matilda/seifa-irsad-abs/abs-seifa-{2011,2016}-sa1-indexes.xls +
abs-seifa-2021-sa1-indexes.xlsx, dl/1270055001_sa1_{2011,2016}_aust_shape.zip,
cache/SA1_2021_AUST_SHP_GDA2020.zip (see derive-booth-seifa-hist.py).

Guards fail loud. Universe pins measured 2026-10-24.
Run: python3 .build/analysis/seat-model/derive-booth-seifa-voter.py [--year=YYYY]
Test: node .build/analysis/seat-model/test-booth-seifa-voter.mjs
"""

import csv
import gzip
import importlib.util
import json
import statistics
import struct
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"
# reuse verified machinery verbatim
_spec = importlib.util.spec_from_file_location("m25", SM / "derive-booth-seifa-2025.py")
m25 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m25)
_spec = importlib.util.spec_from_file_location("hist", SM / "derive-booth-seifa-hist.py")
hist = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hist)
fail = m25.fail
hash16 = m25.hash16

ABS = ROOT / ".matilda/seifa-irsad-abs"
CACHE = SM / "cache"
VDIR = CACHE / "votes-sa1"
FPV = ROOT / ".build/aec-flow-src/booth/fpv"
STATE_ORDER = {s: i for i, s in
               enumerate(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"])}
COHORTS = {"Postal", "Pre-Poll", "Absent", "Provisional"}
INDEXES = ("irsd", "irsad", "ier", "ieo")
ONLY_YEAR = None
for a in sys.argv[1:]:
    if a.startswith("--year="):
        ONLY_YEAR = int(a[len("--year="):])


# ------------------------------------------------------------- editions
def dbf_col(buf, wanted, pin_len):
    """One column out of a dBase III table as strings."""
    nrec, hlen, rlen = struct.unpack_from("<IHH", buf, 4)
    fields, off, pos = [], 32, 1
    while buf[off] != 0x0D:
        name = buf[off:off + 11].split(b"\x00")[0].decode("ascii")
        fields.append((name, pos, buf[off + 16]))
        pos += buf[off + 16]
        off += 32
    hit = [(p, l) for n, p, l in fields if n == wanted]
    if len(hit) != 1:
        fail(f"DBF lacks {wanted}")
    rel, flen = hit[0]
    out = []
    for i in range(nrec):
        rec = buf[hlen + i * rlen: hlen + (i + 1) * rlen]
        if rec[0:1] == b"*":
            continue
        out.append(rec[rel:rel + flen].decode("ascii", "ignore").strip())
    if len(out) != pin_len:
        fail(f"DBF {wanted} records {len(out)} != pin {pin_len}")
    for c in out:
        if len(c) != 11 or not c.isdigit():
            fail(f"DBF odd code {c!r}")
    if len(set(out)) != len(out):
        fail(f"DBF {wanted} not unique")
    return out


def comp_map(codes11, tag):
    """7-digit ccd = code11[0] + code11[5:11]; injective on every edition."""
    m = {}
    for c in codes11:
        k = c[0] + c[5:]
        if k in m:
            fail(f"{tag}: compression collision {k}")
        m[k] = c
    return m


def comp_map_of(zip_path, field, pin_len, tag):
    z = zipfile.ZipFile(zip_path)
    dbf = next(n for n in z.namelist() if n.lower().endswith(".dbf"))
    codes = dbf_col(z.read(dbf), field, pin_len)
    m = comp_map(codes, tag)
    print(f"edition {tag}: {len(codes)} SA1 codes, ccd map injective")
    return m


def load_ccd_maps():
    need = {LANES[y]["ed"] for y in years_run()}
    out = {}
    if "Ed1" in need:
        out["Ed1"] = comp_map_of(ABS / "dl/1270055001_sa1_2011_aust_shape.zip",
                                 "SA1_MAIN11", 54805, "Ed1")
    if "Ed2" in need:
        out["Ed2"] = comp_map_of(ABS / "dl/1270055001_sa1_2016_aust_shape.zip",
                                 "SA1_MAIN16", 57523, "Ed2")
    if "Ed3" in need:
        z = zipfile.ZipFile(CACHE / "SA1_2021_AUST_SHP_GDA2020.zip")
        out["Ed3"] = comp_map(m25.read_dbf_codes(
            z.read("SA1_2021_AUST_GDA2020.dbf")), "Ed3")
        print("edition Ed3: 61844 SA1 codes, ccd map injective")
    return out


# ------------------------------------------------------------- cubes
def cube21():
    raw = m25.read_seifa(ABS / "abs-seifa-2021-sa1-indexes.xlsx")
    return {c: {"irsd": v[0], "irsad": v[2], "ier": v[4], "ieo": v[6]}
            for c, v in raw.items()}


def cube_for(year, mode):
    """year -> {sa1_join_key: {idx: score|None}}, keyed per the lane."""
    if mode == "direct" and year == 2016:
        m = hist._cube_xls_table1(ABS / "abs-seifa-2011-sa1-indexes.xls",
                                  code_col=0, code_len=7,
                                  data_rows=hist.CUBE_ROWS["sa1-2011"])
        return {c: {i: v[i] for i in INDEXES} for c, v in m.items()}
    if mode == "direct" and year == 2019:
        m = hist._cube_xls_table1(ABS / "abs-seifa-2016-sa1-indexes.xls",
                                  code_col=0, code_len=7,
                                  data_rows=hist.CUBE_ROWS["sa1-2016"],
                                  pop_col=10)
        return {c: {i: v[i] for i in INDEXES} for c, v in m.items()}
    if mode in ("direct21", "xwalk21"):
        return cube21()
    fail(f"no cube lane for {year}/{mode}")


# ------------------------------------------------------------- crosswalk
def load_xwalk():
    """SA1_MAIN16 -> [(SA1_CODE21, ratio)]; full Ed2 source coverage."""
    path = VDIR / "CG_SA1_2016_SA1_2021.csv"
    if not path.exists():
        fail(f"missing crosswalk {path} (see docstring refetch)")
    x = defaultdict(list)
    nrows = 0
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        if rdr.fieldnames[:2] != ["SA1_MAINCODE_2016", "SA1_CODE_2021"]:
            fail("CG csv header drifted")
        for row in rdr:
            nrows += 1
            r = row["RATIO_FROM_TO"]
            if r == "":
                continue
            x[row["SA1_MAINCODE_2016"]].append((row["SA1_CODE_2021"], float(r)))
    bad = [c for c, ts in x.items()
           if not 0.999 <= sum(t[1] for t in ts) <= 1.001]
    if nrows != 62080 or len(x) != 57523 or len(bad) > 1:
        fail(f"CG csv drifted: rows {nrows}, sources {len(x)}, ratio-bad {bad}")
    print(f"crosswalk: {len(x)} SA1_2016 sources -> SA1_CODE_2021")
    return x


# ------------------------------------------------------------- votes files
LANES = {
    2025: {"file": VDIR / "2025-federal-election-votes-sa1-nat.csv",
           "fmt": "csv", "idcol": "ccd_id", "ed": "Ed3", "mode": "direct21",
           "fpv": "2025", "seifa": 2021},
    2022: {"file": VDIR / "votes-sa1-2022.csv",
           "fmt": "csv", "idcol": "ccd_id", "ed": "Ed2", "mode": "xwalk21",
           "fpv": "2022", "seifa": 2021},
    2019: {"file": VDIR / "votes-sa1-2019.csv",
           "fmt": "csv", "idcol": "SA1_id", "ed": "Ed2", "mode": "direct",
           "fpv": "2019", "seifa": 2016},
    2016: {"file": VDIR / "votes-sa1-2016.xlsx",
           "fmt": "xlsx", "idcol": "SA1_id", "ed": "Ed1", "mode": "direct",
           "fpv": "2016", "seifa": 2011},
}
# data rows only (2016 xlsx counts the header separately: sheet total 934,147)
VOTES_ROWS = {2025: 1064065, 2022: 1000189, 2019: 1003235, 2016: 934146}


def years_run():
    if ONLY_YEAR is not None:
        if ONLY_YEAR not in LANES:
            fail(f"unknown --year {ONLY_YEAR}")
        return [ONLY_YEAR]
    return sorted(LANES)


def vote_rows(year, conf):
    """Yield (div, ccd, pp_id, pp_nm, votes); ids normalised to str."""
    path = conf["file"]
    idcol = conf["idcol"]
    if not path.exists():
        fail(f"missing votes input {path} (see docstring refetch)")
    if conf["fmt"] == "csv":
        with open(path, newline="", encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            want = ["year", "state_ab", "div_nm", idcol, "pp_id", "pp_nm", "votes"]
            if [c.strip() for c in rdr.fieldnames] != want:
                fail(f"{path.name}: header drift {rdr.fieldnames}")
            for row in rdr:
                if row["year"].strip() != str(year):
                    fail(f"{path.name}: year drift {row['year']!r}")
                yield (row["div_nm"].strip(), row[idcol].strip(),
                       row["pp_id"].strip(), row["pp_nm"].strip(),
                       int(row["votes"] or 0))
    else:
        wb = openpyxl.load_workbook(path, read_only=True)
        if wb.sheetnames[0] != "HouseCatchment (2016FE)":
            fail(f"{path.name}: sheet drift {wb.sheetnames[0]!r}")
        ws = wb[wb.sheetnames[0]]
        it = ws.iter_rows(values_only=True)
        if tuple(next(it)) != ("year", "state_ab", "div_nm", "SA1_id",
                               "pp_id", "pp_nm", "votes"):
            fail(f"{path.name}: header drift")
        for row in it:
            if row[0] != year:
                fail(f"{path.name}: year drift {row[0]!r}")
            yield (str(row[2]).strip(), str(int(row[3])),
                   str(int(row[4])), str(row[5]).strip(), int(row[6] or 0))


def is_sentinel(ccd):
    """ABS migratory/no-usual-address senders: …9999 overflows everywhere,
    plus the 2016-era OT sentinel 9999901 (9-state + 99999 trunk)."""
    return ccd.endswith("9999") or ccd.startswith("99999")


def load_votes(year, conf, ccdmap, xwalk):
    """Aggregate to units {(div,kind,oid): {sa1_join_key: vote_weight}}."""
    units = defaultdict(Counter)
    cohort_names = Counter()
    sent_ids = Counter()
    sent_votes = drop_xw = 0
    n = 0
    mode = conf["mode"]
    for div, ccd, pp, pp_nm, v in vote_rows(year, conf):
        n += 1
        v = int(v)
        if mode == "direct":
            if ccd not in ccdmap:
                if is_sentinel(ccd):
                    sent_ids[ccd] += v
                    sent_votes += v
                    continue
                fail(f"{year}: unknown 7-digit id {ccd!r} (not sentinel)")
            targets = ((ccd, 1.0),)
        else:
            code10 = ccdmap.get(ccd)
            if code10 is None:
                if is_sentinel(ccd):
                    sent_ids[ccd] += v
                    sent_votes += v
                    continue
                fail(f"{year}: unmapped ccd {ccd!r} (not sentinel)")
            if mode == "direct21":
                targets = ((code10, 1.0),)
            else:
                ts = xwalk.get(code10)
                if not ts:
                    drop_xw += v
                    continue
                targets = ts
                rs = sum(t[1] for t in ts)
                if rs < 0.999:
                    drop_xw += v * (1.0 - rs)
        key = (div, "cohort", pp_nm) if pp == "0" else (div, "booth", int(pp))
        if pp == "0":
            if pp_nm not in COHORTS:
                fail(f"{year}: cohort vocab drift {pp_nm!r}")
            cohort_names[pp_nm] += 1
        for tcode, r in targets:
            units[key][tcode] += v * r
    if n != VOTES_ROWS[year]:
        fail(f"{year}: votes rows {n} != pin {VOTES_ROWS[year]}")
    print(f"{year} votes: {n} rows, {len(units)} units, cohorts "
          f"{dict(cohort_names)}, sentinel ids {len(sent_ids)} votes "
          f"{sent_votes}, xwalk-dropped {round(drop_xw)}")
    return units, sent_ids, round(drop_xw)


# ------------------------------------------------------------- scoring
def score_units(units, cube):
    """Per unit: votes, sa1 count, per-index covered shares + weighted means."""
    stats = {}
    for key, kv in units.items():
        tot = sum(kv.values())
        ws = dict.fromkeys(INDEXES, 0.0)
        kept = dict.fromkeys(INDEXES, 0.0)
        for code, w in kv.items():
            s = cube.get(code)
            if s is None:
                continue
            for i in INDEXES:
                sc = s[i]
                if sc is not None:
                    ws[i] += w * sc
                    kept[i] += w
        stats[key] = {
            "votes": int(round(tot)), "sa1s": len(kv),
            "cov": {i: round(kept[i] / tot, 4) if tot else 0 for i in INDEXES},
            "seifa": {i: round(ws[i] / kept[i], 1) if kept[i] else None
                      for i in INDEXES},
        }
    return stats


# ------------------------------------------------------------- venue + fpv
def load_venue(year):
    path = ROOT / f"data/booth-seifa-{year}.json"
    st = json.loads(path.read_text())
    rows = st["booths"]
    if len({(b["div"], b["boothId"]) for b in rows}) != len(rows):
        fail(f"venue store {year}: dup (div,boothId)")
    return path, rows


def load_fpv(year):
    """(DivisionNm, PollingPlaceID) -> ordinary formal FPV total."""
    tot = Counter()
    files = sorted(FPV.glob(f"{year}-*.csv.gz"))
    if not files:
        fail(f"fpv: no oracle files for {year}")
    for fcsv in files:
        with gzip.open(fcsv, "rt", newline="") as fh:
            next(fh)  # banner line
            rdr = csv.DictReader(fh)
            if [c.strip() for c in rdr.fieldnames][:5] != \
                    ["StateAb", "DivisionID", "DivisionNm",
                     "PollingPlaceID", "PollingPlace"]:
                fail(f"fpv: header drift {fcsv.name}")
            for row in rdr:
                tot[(row["DivisionNm"], int(row["PollingPlaceID"]))] += \
                    int(row["OrdinaryVotes"])
    return tot


# ------------------------------------------------------------------ main
_CC = None


def build(year):
    conf = LANES[year]
    vpath, venue_rows = load_venue(year)
    cube = cube_for(year, conf["mode"])
    xwalk = load_xwalk() if conf["mode"] == "xwalk21" else None
    units, sent_ids, drop_xw = load_votes(year, conf, _CC[conf["ed"]], xwalk)
    sent_votes = sum(sent_ids.values())
    stats = score_units(units, cube)
    fpv = load_fpv(conf["fpv"])

    venue_by = {(b["div"], b["boothId"]): b for b in venue_rows}
    vote_keys = {(k[0], k[2]) for k in stats if k[1] == "booth"}
    if {b["div"] for b in venue_rows} != {k[0] for k in vote_keys}:
        vd, vv = {k[0] for k in vote_keys}, {b["div"] for b in venue_rows}
        fail(f"{year} div drift: votes-only {sorted(vd - vv)}, "
             f"venue-only {sorted(vv - vd)}")
    extra = vote_keys - set(venue_by)
    if extra:
        fail(f"{year}: votes booths not in venue store: {sorted(extra)[:8]}")
    no_votes = sorted(set(venue_by) - vote_keys)
    divstate = {b["div"]: b["state"] for b in venue_rows}

    # reconcile vs FPV ordinary totals (deterministic iteration)
    matched = missing = 0
    rels = []
    maxabs = (0, None)
    for div, pid in sorted(vote_keys):
        st = stats[(div, "booth", pid)]
        off = fpv.get((div, pid))
        if off is None:
            missing += 1
            continue
        matched += 1
        d = st["votes"] - off
        if off > 0:
            rels.append(d / off)
        if abs(d) > maxabs[0]:
            maxabs = (abs(d), f"{div}|{pid}|sa1file vs fpv diff {d:+d}")
    rels_abs = sorted(abs(r) for r in rels)
    recon = {
        "matched": matched, "missing": missing,
        "medianAbsPct": round(statistics.median(rels_abs) * 100, 2),
        "p95AbsPct": round(rels_abs[int(len(rels_abs) * 0.95)] * 100, 2),
        "maxAbs": maxabs[0], "maxAbsBooth": maxabs[1],
    }

    # per-booth rows in venue-store order
    out_booths = []
    deltas = {i: [] for i in INDEXES}
    scored = 0
    for vb in venue_rows:
        st = stats.get((vb["div"], "booth", vb["boothId"]))
        vseifa = vb.get("seifa")
        rec = {"div": vb["div"], "divId": vb["divId"], "state": vb["state"],
               "boothId": vb["boothId"], "booth": vb["booth"],
               "type": vb["type"]}
        if st is None:
            rec["votes"] = None
            rec["note"] = "noVotesRows"
            rec["seifa"] = None
        else:
            seifa = st["seifa"] if any(
                v is not None for v in st["seifa"].values()) else None
            rec["votes"] = st["votes"]
            rec["sa1s"] = st["sa1s"]
            rec["cov"] = st["cov"]
            rec["seifa"] = seifa
            if seifa:
                scored += 1
            if vseifa and seifa:
                for i in INDEXES:
                    if vseifa.get(i) is not None and seifa[i] is not None:
                        deltas[i].append(abs(seifa[i] - vseifa[i]))
        out_booths.append(rec)

    cohorts = []
    for (div, kind, name), st in stats.items():
        if kind != "cohort":
            continue
        cohorts.append({"div": div, "state": divstate[div], "cohort": name,
                        "votes": st["votes"], "sa1s": st["sa1s"],
                        "cov": st["cov"],
                        "seifa": st["seifa"] if any(
                            v is not None for v in st["seifa"].values())
                        else None})
    cohorts.sort(key=lambda c: (STATE_ORDER[c["state"]], c["div"], c["cohort"]))

    diverge = {}
    for i in INDEXES:
        ds = sorted(deltas[i])
        if ds:
            diverge[i] = {
                "compared": len(ds),
                "medianAbs": round(statistics.median(ds), 1),
                "p95Abs": round(ds[int(len(ds) * 0.95)], 1),
                "moved100": sum(1 for d in ds if d >= 100),
            }

    bkeys = [k for k in stats if k[1] == "booth"]
    vtot_b = sum(stats[k]["votes"] for k in bkeys) or 1
    cov_all = {i: round(sum(stats[k]["cov"][i] * stats[k]["votes"]
                            for k in bkeys) / vtot_b, 4) for i in INDEXES}

    counts = {
        "booths": len(out_booths), "boothsScored": scored,
        "boothsNoVotesFile": len(no_votes),
        "boothsNoVotesFileIds": [f"{d}|{p}" for d, p in no_votes],
        "cohortRows": len(cohorts),
        "votesTotal": sum(stats[k]["votes"] for k in bkeys) +
        sum(c["votes"] for c in cohorts) + sent_votes + drop_xw,
        "votesSentinel": sent_votes,
        "sentinelIds": sorted(sent_ids),
        "coverage": cov_all,
        "reconcileFpv": recon,
        "venueDelta": diverge,
    }
    if drop_xw:
        counts["votesDroppedXwalk"] = drop_xw

    mode_note = {
        "direct": f". Scores are SEIFA {conf['seifa']} joined direct on the cube's 7-digit key",
        "direct21": ". Scores are SEIFA 2021, the 7-digit ccd decoded to "
            "SA1_CODE21 and joined to the 2021-census cube",
        "xwalk21": ". Scores are SEIFA 2021: each 2016 SA1's votes are "
            "redistributed over SA1_CODE21 targets by the ABS "
            "CG_SA1_2016_SA1_2021 correspondence (RATIO_FROM_TO shares)",
    }[conf["mode"]]
    out = {
        "_about": (
            "Voter-footprint SEIFA per federal booth: vote-weighted mean "
            "SEIFA scores over the SA1s where the booth's VOTERS live "
            "(AEC 'Votes by SA1' roll mark-off x results product — "
            "AEC-flagged indicative, rounded), the footprint complement "
            "to the venue-proxy store booth-seifa-YYYY.json (SA1 of the "
            "premises). Votes SA1s are ASGS " + conf["ed"] + mode_note +
            ". Per-index ABS suppression: each index weights over its own "
            "covered votes (cov). Sentinel …9999 no-address SA1s are "
            "vote-counted but score-excluded. pp_id 0 rows are division "
            "declaration cohorts (Postal/Pre-Poll/Absent/Provisional), "
            "emitted per division, not per booth. Booths the votes file "
            "never lists (unused PPVCs, cancelled mobile teams) carry "
            "votes:null and note:noVotesRows."),
        "_provenance": {
            "sourceUrls": {
                "votes": {2016: "AEC 2016 downloads, Votes by SA1 (xlsx)",
                          2019: "AEC 2019 downloads, Votes by SA1",
                          2022: "AEC 2022 downloads, Votes by SA1",
                          2025: "AEC fe25 downloads-statistics, Votes by SA1 – national"}[year],
                "fpvOracle": "VTR HouseStateFirstPrefsByPollingPlaceDownload",
                **({"crosswalk": "ABS CG_SA1_2016_SA1_2021 (ASGS Ed3 correspondences page)"}
                   if conf["mode"] == "xwalk21" else {}),
            },
            "files": {
                str(conf["file"].relative_to(ROOT)): hash16(conf["file"]),
                str(vpath.relative_to(ROOT)): hash16(vpath),
                **({str((VDIR / "CG_SA1_2016_SA1_2021.csv").relative_to(ROOT)):
                        hash16(VDIR / "CG_SA1_2016_SA1_2021.csv")}
                   if conf["mode"] == "xwalk21" else {}),
            },
            "extractedAt": str(date.today()),
        },
        "election": year,
        "seifaEdition": conf["seifa"],
        "votesGeography": {"Ed1": "SA1 (ASGS 2011, 7-digit)",
                           "Ed2": "SA1 (ASGS 2016, 7-digit)",
                           "Ed3": "SA1 (ASGS Ed3 2021, 7-digit ccd)"}[conf["ed"]],
        "indexes": list(INDEXES),
        "counts": counts,
        "cohorts": cohorts,
        "booths": out_booths,
    }
    op = ROOT / f"data/booth-seifa-voter-{year}.json"
    op.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                  encoding="utf-8")
    print(f"OK -> {op} (booths {len(out_booths)}, scored {scored}, cohorts "
          f"{len(cohorts)}, recon median {recon['medianAbsPct']}%)")
    return op


def main():
    global _CC
    _CC = load_ccd_maps()
    for y in years_run():
        build(y)


if __name__ == "__main__":
    main()
