"""aec-flow-history.py – the per-election preference-flow tables behind the
Past-cycles implied 2PP (FLOW_LEF in .build/newtracker/flows.mjs).

Every past term's 2PP is read the way the current term's is: each poll's
primaries through the flows counted at the election that OPENED the term
(last-election flows, "LEF"). This script derives one table per election
from the AEC's own counts and prints them as flows.mjs-ready JSON, with the
right-edge backtest (each table applied to the NEXT election's primaries,
against that election's official 2PP – Kevin Bonham's LEF track-record test).

Buckets match the poll columns the tables are applied to: grn (every Greens
party), onp (One Nation: HAN to 2001, ON from 2004) and oth (every other
non-major ballot, independents included – the site's lumped IND+OTH).

Sources, by era (all cached small under .build/aec-flow-src/):
  2004–2022  AEC two-party-preferred flow by state by party – every formal
             ballot in every seat redistributed ALP v Coalition (the TPP
             cut flows.mjs ships for 2025). 2004 lives on the old results
             path (/12246/results/Downloads/…csv); 2007+ on /Website/.
             Column ORDER varies by year (Coalition first in 2004, 2007,
             2016–2022) – read from the header, never assumed.
  1996–2001  AEC official election statistics (the Stats CD-ROM zips on
             aec.gov.au): "Two Candidate Preferred Preference Flow Result",
             Division Summary blocks, CLASSIC seats only (final two ALP v a
             Coalition party – 142/144/~140 of 148–150), so these are counted
             flows over nine seats in ten rather than the later all-seat TPP
             cut; national primaries and 2PP from table V1_6.
  1987–1993  No flow by party was published before 1996. Each table is the
             single lumped minor-party flow the official result implies:
             (ALP 2PP − ALP primary) ÷ (100 − ALP − Coalition), from the
             elections table in data/polls.json.

anchor: what the table leaves between the election's own primaries and its
official 2PP (three-cornered Coalition leakage in the TPP cut; non-classic
seats and exhausted ballots in the 1996–2001 classic cut; 0 by construction
for the lumped tables). Added back to every poll row so month 0 of each term
reproduces the official result exactly, as the 2025 table's FLOW_3CNR does.

Usage: python3 .build/aec-flow-history.py [--json]
"""
import collections, csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "aec-flow-src")
ROOT = os.path.dirname(HERE)

MAJ_ALP = {"ALP"}
MAJ_COAL = {"LP", "NP", "CLP", "LNP", "NAT", "LIB"}
GREENS = {"GRN", "GWA", "AGV", "TG"}
ONP = {"HAN", "ON"}

def bucket(code):
    if code in GREENS: return "grn"
    if code in ONP: return "onp"
    return "oth"

def pct(a, b):
    return a / (a + b) if a + b else None

# ---- 2004–2022: AEC TPP flow by state by party ---------------------------
def tpp_file(year):
    for ext in ("txt", "csv"):
        p = os.path.join(SRC, f"tpp-{year}.{ext}")
        if os.path.exists(p): return p
    return None

def parse_tpp(year):
    path = tpp_file(year)
    delim = "," if path.endswith(".csv") else "\t"
    with open(path, encoding="utf-8-sig") as f:
        next(f)                                  # banner
        rdr = csv.reader(f, delimiter=delim)
        head = next(rdr)
        # which column pair is Labor's: read it, never assume it
        alp_first = "labor" in head[3].lower()
        flows = collections.defaultdict(lambda: [0.0, 0.0])
        first = [0.0, 0.0]
        for c in rdr:
            if len(c) < 7: continue
            a, l = (float(c[3]), float(c[5])) if alp_first else (float(c[5]), float(c[3]))
            code = c[1].strip()
            if not code:                         # "First Preferences" aggregate rows
                first[0] += a; first[1] += l
                continue
            flows[code][0] += a; flows[code][1] += l
    return flows, first

def tpp_table(year):
    flows, first = parse_tpp(year)
    b = collections.defaultdict(lambda: [0.0, 0.0])
    coal_transfer = [0.0, 0.0]                   # three-cornered LP/NP rows
    for code, (a, l) in flows.items():
        if code in MAJ_COAL: coal_transfer[0] += a; coal_transfer[1] += l; continue
        if code in MAJ_ALP: continue
        b[bucket(code)][0] += a; b[bucket(code)][1] += l
    formal = first[0] + first[1] + sum(a + l for a, l in b.values()) + sum(coal_transfer)
    alp_2pp = 100 * (first[0] + sum(a for a, _ in b.values()) + coal_transfer[0]) / formal
    share = {k: 100 * (v[0] + v[1]) / formal for k, v in b.items()}
    share["alp"] = 100 * first[0] / formal
    share["lnp"] = 100 * (first[1] + sum(coal_transfer)) / formal
    f = {k: pct(*v) for k, v in b.items()}
    votes = {k: [round(v[0]), round(v[1])] for k, v in b.items()}
    return {"cut": "tpp", "f": f, "share": share, "tpp": alp_2pp, "votes": votes}

# ---- 1996–2001: classic-seat TCP flows from the Stats CD-ROM tables -------
def parse_classic(path_list):
    """Division Summary blocks; the final two are named by the most recent
    two-code header row (per block in 1996/98, once per file in 2001)."""
    b = collections.defaultdict(lambda: [0.0, 0.0])
    seats = collections.Counter()
    for path in path_list:
        lines = open(path, encoding="latin-1").read().replace("\r", "").split("\n")
        pair = None
        i = 0
        while i < len(lines):
            cells = [c.strip() for c in lines[i].split("\t") if c.strip()]
            if len(cells) == 2 and all(c.isupper() and len(c) <= 4 for c in cells):
                pair = cells
            if cells and cells[0] == "Division Summary":
                classic = pair and "ALP" in pair and any(p in MAJ_COAL for p in pair)
                seats["classic" if classic else "other"] += 1
                j = i + 1
                while j < len(lines):
                    cs = [c.strip() for c in lines[j].split("\t") if c.strip()]
                    if cs and cs[0] == "Total": break
                    if cs and len(cs) >= 6 and classic and cs[0].endswith(")\""):
                        code = cs[0].rsplit("(", 1)[1].rstrip(")\"")
                        v1, v2 = float(cs[2]), float(cs[4])
                        a, l = (v1, v2) if pair.index("ALP") == 0 else (v2, v1)
                        if code not in MAJ_ALP and code not in MAJ_COAL:
                            b[bucket(code)][0] += a; b[bucket(code)][1] += l
                    j += 1
                i = j
            i += 1
    return b, seats

def national_v16(path):
    """National Summary of table V1_6: first preferences by party + 2PP."""
    rows, tpp = {}, {}
    mode = None
    for line in open(path, encoding="latin-1").read().replace("\r", "").split("\n"):
        cs = [c.strip() for c in line.split("\t") if c.strip()]
        if not cs: continue
        if cs[0] in ("New South Wales", "Victoria"): break   # national block only
        if cs[0] == "Two Party Preferred": mode = "tpp"; continue
        if len(cs) >= 2 and cs[1].replace(".", "").isdigit():
            if mode == "tpp": tpp[cs[0]] = float(cs[1])
            else: rows[cs[0]] = float(cs[1])
    formal = rows["FORMAL"]
    share = collections.defaultdict(float)
    for code, v in rows.items():
        if code in ("FORMAL", "INFORMAL", "TOTAL"): continue
        k = "alp" if code in MAJ_ALP else "lnp" if code in MAJ_COAL else bucket(code)
        share[k] += 100 * v / formal
    alp_2pp = 100 * tpp["ALP"] / (tpp["ALP"] + tpp["Coalition"])
    return dict(share), alp_2pp

def classic_table(year):
    d = os.path.join(SRC, f"classic-{year}.json")
    ex = json.load(open(d))
    b = {k: v for k, v in ex["flows"].items()}
    share, alp_2pp = ex["share"], ex["tpp"]
    f = {k: pct(*b[k]) for k in b}
    return {"cut": "classic-tcp", "f": f, "share": share, "tpp": alp_2pp,
            "votes": {k: [round(v[0]), round(v[1])] for k, v in b.items()}, "seats": ex["seats"]}

# ---- 1987–1993: the lumped flow the official result implies ---------------
def lumped_table(year, E):
    e = E["e" + str(year)]
    minor = 100 - e["alp"] - e["lnp"]
    fm = (e["tpp_alp"] - e["alp"]) / minor
    return {"cut": "lumped", "f": {"minor": fm}, "share": {"alp": e["alp"], "lnp": e["lnp"], "minor": minor},
            "tpp": e["tpp_alp"]}

# ---- assemble ---------------------------------------------------------------
def minor_flow(t):
    """The one lumped flow for every non-major ballot, weighted by the
    election's own minor-party mix – what a poll that itemises nothing gets."""
    if "minor" in t["f"]: return t["f"]["minor"]
    w = {k: t["share"].get(k, 0) for k in ("grn", "onp", "oth")}
    return sum(t["f"][k] * w[k] for k in w if t["f"].get(k) is not None) / sum(w[k] for k in w if t["f"].get(k) is not None)

def implied(t, prim):
    """LEF 2PP of a primary set under table t: itemised buckets at their own
    flow, a bucket the table never counted (a debut party) at the table's
    'oth' flow, everything else at the lumped minor flow."""
    s = prim["alp"]
    if "minor" in t["f"]:
        return s + t["f"]["minor"] * (100 - prim["alp"] - prim["lnp"]) + t.get("anchor", 0)
    for k in ("grn", "onp", "oth"):
        v = prim.get(k, 0) or 0
        f = t["f"].get(k)
        if f is None or t["share"].get(k, 0) < 0.05: f = t["f"]["oth"]
        s += f * v
    return s + t.get("anchor", 0)

def extract(stats_dir):
    """--extract <dir>: rebuild the classic-<year>.json caches from the two
    unzipped AEC statistics packs (aec.gov.au/About_AEC/Publications/
    statistics/files/aec-1993-1996-1998-election-statistics.zip and
    aec-2001-election-statistics.zip), so the ~160MB zips never enter git."""
    import glob
    specs = {
        1996: (os.path.join(stats_dir, "data/repsres/tables96/text/V3_1*.TXT"),
               os.path.join(stats_dir, "data/repsres/tables96/text/V1_6.TXT")),
        1998: (os.path.join(stats_dir, "data/repsres/tables98/text/V3_1*.TXT"),
               os.path.join(stats_dir, "data/repsres/tables98/text/V1_6.TXT")),
        2001: (os.path.join(stats_dir, "data/*/*_txt/v3_10*.txt"),
               os.path.join(stats_dir, "data/national/national_txt/v1_6.txt")),
    }
    for y, (flow_glob, v16) in specs.items():
        files = sorted(glob.glob(flow_glob))
        b, seats = parse_classic(files)
        share, alp_2pp = national_v16(v16)
        with open(os.path.join(SRC, f"classic-{y}.json"), "w") as f:
            json.dump({"flows": {k: [round(v[0]), round(v[1])] for k, v in b.items()},
                       "seats": dict(seats), "share": {k: round(v, 4) for k, v in share.items()},
                       "tpp": round(alp_2pp, 4), "files": len(files)}, f, indent=1)
        print(y, len(files), "files", dict(seats), {k: round(100 * pct(*v), 2) for k, v in b.items()})

def main():
    if "--extract" in sys.argv:
        extract(sys.argv[sys.argv.index("--extract") + 1]); return
    E = json.load(open(os.path.join(ROOT, "data", "polls.json")))["elections"]
    tables = {}
    for y in (1987, 1990, 1993): tables[y] = lumped_table(y, E)
    for y in (1996, 1998, 2001): tables[y] = classic_table(y)
    for y in (2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025): tables[y] = tpp_table(y)
    for y, t in tables.items():
        t["anchor"] = 0.0
        if "minor" not in t["f"]:
            t["anchor"] = t["tpp"] - implied(t, t["share"])
        t["fMinor"] = minor_flow(t)
    years = sorted(tables)
    out = {}
    for i, y in enumerate(years):
        t = tables[y]
        nxt = years[i + 1] if i + 1 < len(years) else None
        bt = None
        if nxt:
            nt = tables[nxt]
            # the NEXT election's primaries, in the buckets it itself measured
            prim = dict(nt["share"])
            if "minor" in prim and "minor" not in t["f"]:
                prim = {"alp": prim["alp"], "lnp": prim["lnp"], "oth": prim["minor"]}
            bt = implied(t, prim) - nt["tpp"]
        out[y] = {
            "cut": t["cut"], "tpp": round(t["tpp"], 2), "anchor": round(t["anchor"], 3),
            "f": {k: round(v, 4) for k, v in t["f"].items() if v is not None},
            "fMinor": round(t["fMinor"], 4),
            "share": {k: round(v, 2) for k, v in t["share"].items()},
            **({"votes": t["votes"]} if "votes" in t else {}),
            **({"seats": t["seats"]} if "seats" in t else {}),
            **({"backtest": {"next": nxt, "err": round(bt, 2)}} if bt is not None else {}),
        }
    if "--json" in sys.argv:
        print(json.dumps(out, indent=1)); return
    print(f"{'elec':<5} {'cut':<12} {'grn':>7} {'onp':>7} {'oth':>7} {'minor':>7} {'anchor':>7}   backtest (LEF on next election, pts ALP)")
    for y in years:
        o = out[y]; f = o["f"]
        g = lambda k: f"{100*f[k]:6.1f}%" if k in f else "     – "
        bt = o.get("backtest")
        print(f"{y:<5} {o['cut']:<12} {g('grn')} {g('onp')} {g('oth')} {100*o['fMinor']:6.1f}% {o['anchor']:+7.3f}   "
              + (f"{bt['next']}: {bt['err']:+.2f}" if bt else ""))
    errs = [abs(out[y]["backtest"]["err"]) for y in years if "backtest" in out[y]]
    print(f"\nmean |LEF error| over {len(errs)} elections: {sum(errs)/len(errs):.2f}")

if __name__ == "__main__":
    main()
