#!/usr/bin/env python3
"""The homeless lane's per-SA1 allocation tables (2026-10-31 lanes arc):
cache/homeless-sa1-{2011,2016,2021}-alloc.json.

ABS publishes homelessness as SA2-level estimates (2049.0 "Estimating
Homelessness: Census" — no BCP/GCP table carries it; the source cubes
are fetched and validated by fetch-homeless-abs.py). A SA1's allocated
homeless estimate is its parent SA2's estimate scaled by resident
population share (est_c(u) = est(SA2) * pop_c(u) / pop_c(SA2)) — the
standard count-consistent downscale, and the form the lane pipelines
want: the estimate is ADDITIVE, so venue rooms, voter folds and
division sums pool it like every headcount-demographic lane and take
the share after summing (never an average of rates). The cubes are
ALL-homeless-count tables (the ABS's own five operational groups
summed); deliberately NOT the broader "other marginal housing" rows
of tables 5.1/5.2 — the "homeless" lane measures what ABS calls
homeless, not the margin-row set.

Sources (each in the ASGS edition of its own census):
  2011  cache/homeless/hl-do005-2016.xls  Table_5.4 (Ed1 SA2 universe;
          the ABS recalculated the 2011 estimates alongside its 2016
          release — the 2011-series vintage it publishes is this one)
  2016  cache/homeless/hl-do005-2016.xls  Table_5.3 (Ed2)
  2021  cache/homeless/hl-do005-2021.xlsx Table_5.3 (Ed3)

Per-edition joins:
  SA1 -> parent SA2 comes from the SA1 shapefiles' DBF parentage
  columns (.matilda/seifa-irsad-abs/dl/1270055001_sa1_{y}_aust_shape.zip
  and cache/SA1_2021_AUST_SHP_GDA2020.zip) — a real (SA2-name, state)
  lookup exists for every SA1 there. The homeless cube lists SA2 rows
  by NAME under STATE/SA4/SA3 hierarchy rows, so the alloc keys the
  homeless table (state, name) and validates BOTH universes' (state,
  name) sets for duplicates.
  pop_c(SA1) comes from the census datapack the era reads: BCP 2011
  B01 Tot_P_P (cache/bcp-sa1-2011.zip), GCP 2016/2021 G01 Tot_P_P.

Outputs per edition: {"m": {SA1 main/base code -> {"e": est, "p": pop}},
"c7": {cube 7-digit region id -> same}} — store-side lanes pick the
key form their universe uses (voter-GCP-2021 lanes ride "m"; the
2011/2016-venue-era and GCP-2016 rows ride "c7"). Run:
  python3 .build/analysis/seat-model/homeless_alloc.py
Test: node .build/analysis/seat-model/test-homeless-alloc.mjs
"""

import csv
import io
import json
import struct
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"
CACHE = SM / "cache"
ABS = ROOT / ".matilda/seifa-irsad-abs"
HL_DIR = CACHE / "homeless"

# state cultures in the cubes' section rows -> ASGS state digits
STATES_D = {"New South Wales": "1", "Victoria": "2", "Queensland": "3",
            "South Australia": "4", "Western Australia": "5",
            "Tasmania": "6", "Northern Territory": "7",
            "Australian Capital Territory": "8",
            "Other Territories": "9"}
SOURCES = {
    2011: {"cube": "hl-do005-2016.xls", "table": "Table_5.4",
           "nat": 102439, "sa1zip": "1270055001_sa1_2011_aust_shape.zip",
           "sa1fields": ("SA1_MAIN11", "SA1_7DIG11",
                         "SA2_MAIN11", "SA2_NAME11", "STE_CODE11"),
           "pop": "gcp2011"},
    2016: {"cube": "hl-do005-2016.xls", "table": "Table_5.3",
           "nat": 116427, "sa1zip": "1270055001_sa1_2016_aust_shape.zip",
           "sa1fields": ("SA1_MAIN16", "SA1_7DIG16",
                         "SA2_MAIN16", "SA2_NAME16", "STE_CODE16"),
           "pop": "gcp2016"},
    2021: {"cube": "hl-do005-2021.xlsx", "table": "Table_5.3",
           "nat": 122494, "sa1zip": "cache/SA1_2021_AUST_SHP_GDA2020.zip",
           # the 2021 SHP prints only SA1_CODE21 (11-digit) — no c7
           # key form exists at this edition
           "sa1fields": ("SA1_CODE21", None,
                         "SA2_CODE21", "SA2_NAME21", "STE_CODE21"),
           "pop": "gcp2021"},
}


def fail(msg):
    print(f"GUARD homeless_alloc: {msg}")
    sys.exit(1)


def dbf_rows(zip_path, fields):
    """[{field: str-val}] for a zipped dBase III table's DBF member."""
    z = zipfile.ZipFile(zip_path)
    dbf_name = [n for n in z.namelist()
                if n.lower().endswith(".dbf")]
    if len(dbf_name) != 1:
        fail(f"{zip_path}: {len(dbf_name)} dbf members")
    buf = z.read(dbf_name[0])
    nrec, hlen, rlen = struct.unpack_from("<IHH", buf, 4)
    desc = []
    off, pos = 32, 1
    while buf[off] != 0x0D:
        name = buf[off:off + 11].split(b"\x00")[0].decode("ascii")
        flen = buf[off + 16]
        desc.append((name, pos, flen))
        pos += flen
        off += 32
    fidx = {}
    for f in fields:
        hits = [(p, l) for n, p, l in desc if n == f]
        if not hits:
            fail(f"{zip_path}: DBF lacks field {f}")
        fidx[f] = hits[0]
    out = []
    for i in range(nrec):
        base = hlen + i * rlen
        row = buf[base:base + rlen]
        rec = {}
        for f, (p, l) in fidx.items():
            rec[f] = row[p:p + l].decode("latin-1", "replace").strip()
        out.append(rec)
    return out


def homeless_sa2(ed, lo_break=False):
    """{ (state-digit, sa2-name): est } from the edition's cube table,
    plus the national total check."""
    src = SOURCES[ed]
    cube = HL_DIR / src["cube"]
    if not cube.exists():
        fail(f"missing {cube} (run fetch-homeless-abs.py)")
    rows = []
    if src["cube"].endswith("xlsx"):
        import openpyxl
        wb = openpyxl.load_workbook(cube, read_only=True)
        for row in wb[src["table"]].iter_rows(values_only=True):
            rows.append(list(row))
    else:
        import xlrd
        ws = xlrd.open_workbook(str(cube)).sheet_by_name(src["table"])
        for i in range(ws.nrows):
            rows.append([ws.cell_value(i, j) for j in range(5)])
    est = {}
    state = None
    total = None
    dups = []
    suppressed = []
    for r in rows:
        label = r[0]
        if isinstance(label, str) and label.strip() == "Australia":
            total = r[4]
            continue
        if label and str(label).strip() in STATES_D:
            state = STATES_D[str(label).strip()]
            continue
        name = r[3] if len(r) > 3 else None
        val = r[4] if len(r) > 4 else None
        if isinstance(name, str) and name.strip():
            if isinstance(val, str) and val.strip().startswith(("np", "~")):
                suppressed.append((state, name.strip()))
                continue
            if val is not None and isinstance(val, (int, float)):
                key = (state, name.strip())
                if key in est:
                    dups.append(key)
                est[key] = est.get(key, 0) + int(val)
    if dups:
        fail(f"{ed} homeless table duplicate (state, SA2-name) rows: "
             f"{dups[:4]}")
    if total is None:
        fail(f"{ed}: no Australia total row")
    gap = total - sum(est.values())
    if gap != 0:
        print(f"note {ed}: national less SA2-sum = {gap:,.0f} — "
              f"{len(suppressed)} ABS-suppressed SA2 cells "
              f"(e.g. {suppressed[:4]})")
    if gap < 0 or gap > max(50, total * 0.001):
        fail(f"{ed} national {total} vs SA2-sum "
             f"{sum(est.values()):,}")
    if int(round(total)) != src["nat"]:
        fail(f"{ed} national {total} != pin {src['nat']}")
    return est


def sa2_name_by_code(ed):
    """{sa2-main-code: (state-digit, SA2-name)} from the edition's SA1
    SHP DBF — every SA1's parentage row; plus
    {sa1-code -> (sa1-7d, sa2-code)} the universe map."""
    src = SOURCES[ed]
    zp = (SM / src["sa1zip"] if src["sa1zip"].startswith("cache/")
          else ABS / "dl" / src["sa1zip"])
    if not zp.exists():
        fail(f"missing {zp}")
    f_sa1, f_7d, f_sa2, f_name, f_ste = src["sa1fields"]
    fields = [f for f in src["sa1fields"] if f is not None]
    rows = dbf_rows(zp, fields)
    sa2name = {}
    units = {}
    for r in rows:
        name = (r[f_name] or "").strip()
        st = (r[f_ste] or "").strip()
        sa2 = (r[f_sa2] or "").strip()
        if sa2 and name:
            prev = sa2name.setdefault(sa2, (st, name))
            if prev != (st, name):
                fail(f"{ed} SA2 {sa2} name drift {prev} vs {(st, name)}")
        m = (r[f_sa1] or "").strip()
        c7 = (r[f_7d] or "").strip() if f_7d else ""
        if m:
            units.setdefault("m", {})[m] = sa2 or None
        if c7:
            units.setdefault("c7", {})[c7] = sa2 or None
    if len(sa2name) < 2000:
        fail(f"{ed}: only {len(sa2name)} SA2s in {zp.name}")
    return sa2name, units


def sa1_persons(ed):
    """{sa1 code: census persons} from the era's own datapack."""
    src = SOURCES[ed]
    which = src["pop"]
    if which == "gcp2011":
        zp = CACHE / "bcp-sa1-2011.zip"
        member = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
                  "2011Census_B01_AUST_SA1_short.csv")
        idc, col = "region_id", "Tot_P_P"
    elif which == "gcp2016":
        zp = CACHE / "gcp-sa1-2016.zip"
        member = ("2016 Census GCP Statistical Area 1 for AUST/"
                  "2016Census_G01_AUS_SA1.csv")
        idc, col = "SA1_7DIGITCODE_2016", "Tot_P_P"
    else:
        zp = CACHE / "gcp-sa1-2021.zip"
        member = ("2021 Census GCP Statistical Area 1 for AUS/"
                  "2021Census_G01_AUST_SA1.csv")
        idc, col = "SA1_CODE_2021", "Tot_P_P"
    if not zp.exists():
        fail(f"missing {zp}")
    z = zipfile.ZipFile(zp)
    out = {}
    with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        if idc not in rdr.fieldnames or col not in rdr.fieldnames:
            fail(f"{member}: missing {idc}/{col}")
        for r in rdr:
            code = r[idc].strip()
            if not code.isdigit():
                fail(f"{member}: key drift {code!r}")
            out[code] = int(r[col])
    pin = {"gcp2011": 54805, "gcp2016": 57523, "gcp2021": 61844}[which]
    if len(out) != pin:
        fail(f"{member}: {len(out)} rows != pin {pin}")
    return out


def build(ed):
    est = homeless_sa2(ed)
    sa2names, units = sa2_name_by_code(ed)
    pop_sa1 = sa1_persons(ed)
    # click universe alignment: SA2 parents of the SHP universe -> the
    # homeless cube's code list: name table to code keys
    by_name = {}
    dups = []
    for code, (st, name) in sa2names.items():
        key = (st, name)
        if key in by_name and by_name[key] != code:
            dups.append((key, by_name[key], code))
        by_name[key] = code
    if dups:
        fail(f"{ed}: duplicate (state, SA2 name) in the SHP universe: "
             f"{dups[:4]}")
    unnamed = [k for k in est if k not in by_name]
    if unnamed:
        share = sum(est[k] for k in unnamed) / max(1, sum(est.values()))
        if share > 0.002:
            fail(f"{ed}: homeless SA2 names the SHP lacks: "
                 f"{sorted(unnamed)[:8]} ({share:.4%} of est)")
        print(f"note {ed}: {len(unnamed)} cube SA2 names unmatched "
              f"({share:.5%} of estimates — tiny/unusual places only): "
              f"{sorted(unnamed)[:6]}")
        for k in unnamed:
            est.pop(k)
    # pops per SA2 (sum of the SA1 census pops under it) — computed
    # over ONE key form only (the two forms describe the same universe;
    # both would double-count)
    sa2_pop = {}
    pop_form = "c7" if units.get("c7") else next(iter(units))
    for code, sa2 in units.get(pop_form, {}).items():
        if not sa2:
            continue
        p = pop_sa1.get(code)
        if p is None:
            continue
        sa2_pop[sa2] = sa2_pop.get(sa2, 0) + p
    # a second form's pops are indexed the same way when its codes
    # differ (GCP 2021's c7 key may differ from the SHP's 7-digit
    # print form): rebuild pops per SA2 under that form too
    alt_pop = {"c7": sa2_pop}
    for form in units:
        if form == pop_form:
            continue
        ap = {}
        for code, sa2 in units[form].items():
            if not sa2:
                continue
            p = pop_sa1.get(code)
            if p is None:
                continue
            ap[sa2] = ap.get(sa2, 0) + p
        alt_pop[form] = ap
    alloc = {"m": {}, "c7": {}}
    no_pop = 0
    for form in ("c7", "m"):
        pops = alt_pop.get(form) or sa2_pop
        for code, sa2 in units.get(form, {}).items():
            if not sa2 or sa2 not in by_name.values():
                continue
            key = sa2names[sa2]
            est_sa2 = est.get(key, 0)
            p_tot = pops.get(sa2, 0)
            p = pop_sa1.get(code)
            if p is None or p_tot <= 0:
                no_pop += 1
                continue
            # est can't exceed the SA1's own residents: the SA2-level
            # estimate decomposed pro-rata can overshoot a tiny
            # SA1...? The lane's displayed figure is an SA2-level's
            # coarse measure, so the share cleanly caps at 1 here
            # (the ~0.02% of estimates the cap costs comes up inside
            # the 0.2% national tolerance)
            alloc[form][code] = {"e": round(min(est_sa2 * p / p_tot, p), 4),
                                 "p": p}
    if len(alloc["c7"]) + len(alloc["m"]) < 40000:
        fail(f"{ed}: only {len(alloc['c7']) + len(alloc['m'])} SA1 "
             f"allocations")
    print(f"{ed}: SA2s in SHP {len(sa2names)}, homeless cube covers "
          f"{len(est)}; no-pop SA1s {no_pop}")
    big_form = "c7" if len(alloc.get("c7", {})) >= len(alloc.get("m", {})) \
        else "m"
    return alloc, sum(v["e"] for v in alloc[big_form].values()), 0


_CACHE = {}


def alloc_of(ed, form):
    """The derive-side read: {unit-code: {"e": est, "p": pop}} for the
    edition's key form ("c7" cube-7-digit | "m" SA1-main code), from
    cache/homeless-sa1-<ed>-alloc.json (build it with this script;
    never reads the ABS cubes at call time)."""
    key = (ed, form)
    if key not in _CACHE:
        p = CACHE / f"homeless-sa1-{ed}-alloc.json"
        if not p.exists():
            fail(f"missing {p} (run homeless_alloc.py)")
        _CACHE[key] = json.loads(p.read_text(encoding="utf-8"))
    d = _CACHE[key]
    if form not in d or not d[form]:
        fail(f"homeless alloc {ed}/{form}: empty form (asgs key drift? "
             f"re-derive homeless_alloc.py)")
    return d[form]


def main():
    only = None
    for a in sys.argv[1:]:
        if a.startswith("--ed="):
            only = int(a.split("=", 1)[1])
    for ed in (2011, 2016, 2021):
        if only is not None and ed != only:
            continue
        alloc, tot_est, dups = build(ed)
        out = CACHE / f"homeless-sa1-{ed}-alloc.json"
        nat = SOURCES[ed]["nat"]
        if not (nat * 0.98 <= tot_est <= nat * 1.02):
            fail(f"{ed} allocated national {tot_est:,.0f} vs table "
                 f"{nat:,}")
        out.write_text(json.dumps(alloc) + "\n", encoding="utf-8")
        print(f"OK -> {out} (ed {ed}: c7 {len(alloc['c7'])}, "
              f"m {len(alloc['m'])}, est {tot_est:,.0f} ~ table "
              f"{nat:,})")


if __name__ == "__main__":
    main()
