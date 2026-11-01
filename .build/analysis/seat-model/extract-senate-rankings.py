#!/usr/bin/env python3
"""extract-senate-rankings.py: how every party's Senate voters ranked Labor, the Coalition, the
Greens and One Nation, by division and by polling place, from the AEC's ballot-level files.

Why. The House counts publish where an excluded candidate's ballots went only for the contests
that happened. The three-way finals the 2028 model needs (Labor v One Nation, Coalition v One
Nation) were counted in the House at five seat-elections since 1998. Every formal Senate
ballot since group tickets ended (2016) is published, so the order in which each first-
preference cohort ranks the four big families is COUNTED in every division and booth. The seat
model's flow layer is built on these tables (see .build/analysis/seat-model-design-review.md,
section 12).

Input: the AEC's per-state zips, fetched once into a cache (not committed; ~135 MB a year):
  https://results.aec.gov.au/<EVENT>/Website/External/aec-senate-formalpreferences-<EVENT>-<ST>.zip
  2016 (20499) also needs aec-senate-candidateinformation-20499.zip for its positional layout.
Events: 2016 = 20499, 2019 = 24310, 2022 = 27966, 2025 = 31496.

Reading a ballot (the AEC's rules): a below-the-line run of at least 1-6 makes the ballot BTL
(it beats any above-the-line marks); otherwise the above-the-line run is used. A run stops at
the first missing or repeated number. '*' and '/' read as 1. Each preference maps to its
group's family; the ballot's first-preference COHORT is the family:sub-family of preference 1
(Coalition subs: LIB, NAT, LNP, LN joint ticket, CLP; minor parties by party, see SUBS); its
PATTERN is the order in which A (Labor), C (Coalition), G (Greens) and O (One Nation) first
appear in the run ("" if none of the four is numbered).

Output:
  data/senate-rankings-<year>.json   per division: state, ballots, and for every cohort a sparse
                                     {pattern index: ballots} table (pattern list in the file)
  .build/aec-flow-src/senate-ballots/booth-rankings-<year>.json.gz
                                     the same per polling place (keyed by the AEC PollingPlaceID
                                     used by map/data/res-<year>.json and senate-vote-<year>.json,
                                     matched on division + name; postal, absent, pre-poll,
                                     provisional and other non-place points are pooled per
                                     division under "special"); cohorts pooled to the big four +
                                     minor-party classes R/L/M to keep it small
Checks (abort on failure): per-state Coalition-cohort Labor-v-One-Nation shares (ATL only)
within 0.6 pts of the committed counts.json for every year it covers. The two readers differ by
rule, not error: this one stops a run at the first gap or repeat (the AEC's count rule) and reads
a ballot with a short BTL run as ATL; counts.json's analyser reads every numbered ATL box in
order and drops any ballot with BTL marks. Differences are recorded in the output (largest:
WA 2022, +0.44). The audit lists every group name's mapping.

Usage (repo root):
  python3 -I .build/analysis/seat-model/extract-senate-rankings.py --cache <dir> [--fetch] [years...]
"""
import argparse, collections, csv, gzip, hashlib, io, json, os, re, sys, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
EVENTS = {2016: "20499", 2019: "24310", 2022: "27966", 2025: "31496"}
STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
URL = "https://results.aec.gov.au/{ev}/Website/External/aec-senate-formalpreferences-{ev}-{st}.zip"
URL_CI = "https://results.aec.gov.au/20499/Website/External/aec-senate-candidateinformation-20499.zip"
csv.field_size_limit(50_000_000)

# minor-party sub-families and their class (R right, L left, M centre/other)
SUBS = {
    "TOP": "R", "FF": "R", "LDP": "R", "KAP": "R", "XTN": "R", "CIT": "R", "GAP": "R", "SFF": "R", "RGT": "R",
    "AJP": "L", "SOC": "L", "FUS": "L", "IAP": "L", "AV": "L", "REA": "L",
    "LCA": "M", "SAP": "M", "DEM": "M", "JLN": "M", "POC": "M", "CTR": "M", "IND": "M",
}
RULES = [  # (regex on the lower-cased group/party name, (family, sub)); first match wins
    (r"one nation", ("ON", "ON")),
    (r"^a\.l\.p|labor\b|labor party|country labor", ("ALP", "ALP")),
    (r"democratic labou?r|labour dlp|\bdlp\b", ("OTH", "RGT")),
    (r"green", ("GRN", "GRN")),
    (r"^lnp$|liberal national", ("COAL", "LNP")),
    (r"country liberal|^nt clp$|\bclp\b", ("COAL", "CLP")),
    (r"liberal ?& ?national|liberal/the nationals|liberal and nationals", ("COAL", "LN")),
    (r"liberal democrat", ("OTH", "LDP")),
    (r"^liberal$|^liberal party|^the liberal party", ("COAL", "LIB")),
    (r"conservative national|anning", ("OTH", "RGT")),
    (r"^the nationals|^national party|^nationals|^the nationals \(", ("COAL", "NAT")),
    (r"trumpet|united australia|palmer", ("OTH", "TOP")),
    (r"family first", ("OTH", "FF")),
    (r"katter", ("OTH", "KAP")),
    (r"rennick|libertarian|heart", ("OTH", "LDP")),
    (r"christian|fred nile", ("OTH", "XTN")),
    (r"citizens", ("OTH", "CIT")),
    (r"great australian", ("OTH", "GAP")),
    (r"shooters", ("OTH", "SFF")),
    (r"liberty alliance|conservatives|rise up|australia first|nationalist|sustainable population|"
     r"australian federation|informed medical|values party|better families|antipaedophile|"
     r"seniors united|no carbon tax|smokers|australian liberty", ("OTH", "RGT")),
    (r"animal justice", ("OTH", "AJP")),
    (r"cannabis|marijuana|hemp", ("OTH", "LCA")),
    (r"socialist", ("OTH", "SOC")),
    (r"fusion|science|pirate|secular|climate", ("OTH", "FUS")),
    (r"sustainable australia", ("OTH", "SAP")),
    (r"democrats", ("OTH", "DEM")),
    (r"indigenous|aboriginal", ("OTH", "IAP")),
    (r"australia's voice", ("OTH", "AV")),
    (r"sex party|reason", ("OTH", "REA")),
    (r"lambie", ("OTH", "JLN")),
    (r"pocock", ("OTH", "POC")),
    (r"xenophon|centre alliance|hinch|lazarus|justice party", ("OTH", "CTR")),
]
def family(name):
    n = (name or "").strip().lower()
    for rx, f in RULES:
        if re.search(rx, n):
            return f
    return ("OTH", "IND")

BIG = {"ALP": "A", "COAL": "C", "GRN": "G", "ON": "O"}
def all_patterns():
    import itertools
    out = [""]
    for k in range(1, 5):
        for p in itertools.permutations("ACGO", k):
            out.append("".join(p))
    return out
PATTERNS = all_patterns()
PIDX = {p: i for i, p in enumerate(PATTERNS)}

def cohort_key(fs):
    fam, sub = fs
    if fam == "COAL": return "COAL:" + sub
    if fam == "OTH": return "OTH:" + sub
    return fam
def booth_cohort(fs):
    fam, sub = fs
    if fam == "OTH": return "OTH-" + SUBS.get(sub, "M")
    return fam  # COAL subs pooled at booth level

def run_of(pref):  # pref: dict number -> list of slot idx
    out, k = [], 1
    while True:
        s = pref.get(k)
        if not s or len(s) != 1: break
        out.append(s[0]); k += 1
    return out

def pattern_of(seq):
    pat = []
    for fam, _ in seq:
        ch = BIG.get(fam)
        if ch and ch not in pat: pat.append(ch)
    return PIDX["".join(pat)]

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()

def fetch(url, path):
    if os.path.exists(path): return
    tmp = path + ".part"
    with urllib.request.urlopen(url, timeout=900) as r, open(tmp, "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b: break
            f.write(b)
    os.replace(tmp, path)

def layout_2016(cache):
    """nom_ty 'S' rows: group letters ordered (len, letter), candidates in group then ballot order, UG last."""
    z = zipfile.ZipFile(os.path.join(cache, "aec-senate-candidateinformation-20499.zip"))
    name = [m for m in z.namelist() if m.endswith(".csv")][0]
    rdr = csv.reader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig", errors="replace", newline=""))
    hdr = next(rdr); ix = {h.strip(): i for i, h in enumerate(hdr)}
    info = {}
    for row in rdr:
        if len(row) < 9 or row[ix["nom_ty"]] != "S": continue
        st = row[ix["state_ab"]].strip(); t = row[ix["ticket"]].strip().upper()
        info.setdefault(st, {}).setdefault(t, []).append((int(row[ix["ballot_position"]]), row[ix["party_ballot_nm"]].strip()))
    out = {}
    for st, tickets in info.items():
        letters = sorted([t for t in tickets if t != "UG"], key=lambda t: (len(t), t))
        gname = {t: next((p for _, p in sorted(tickets[t]) if p), "") for t in letters}
        gfam = {t: family(gname[t]) for t in letters}
        cands = []
        for t in letters + ["UG"]:
            for _, party in sorted(tickets.get(t, [])):
                cands.append(gfam[t] if t != "UG" else family(party) if party else ("OTH", "IND"))
        out[st] = (letters, gname, gfam, cands)
    return out

def read_state(year, st, zpath, lay16):
    """yields (division, vcp_name, fs_first, pattern_idx, is_btl, is_atl_for_check) per formal ballot"""
    z = zipfile.ZipFile(zpath)
    name = [m for m in z.namelist() if m.endswith(".csv")][0]
    fh = io.TextIOWrapper(z.open(name), encoding="utf-8-sig", errors="replace", newline="")
    rdr = csv.reader(fh)
    hdr = next(rdr)
    audit = []
    if year == 2016:
        letters, gname, gfam, cands = lay16[st]
        audit = [{"letter": l, "name": gname[l], "family": list(gfam[l])} for l in letters]
        sep = next(rdr)
        assert set(sep[0].strip()) <= {"-"}, f"{st} 2016: no dashes row"
        G = len(letters)
        for row in rdr:
            if len(row) < 6: continue
            div, vname = row[0].strip(), row[1].strip()
            atl, btl = collections.defaultdict(list), collections.defaultdict(list)
            for i, tok in enumerate(row[5].split(",")):
                tok = tok.strip()
                if not tok: continue
                n = 1 if tok in ("*", "/") else int(tok) if tok.isdigit() else None
                if n is None: continue
                (atl if i < G else btl)[n].append(i)
            r = run_of(btl)
            if len(r) >= 6:
                seq = [cands[i - G] for i in r]; isb = 1
            else:
                r = run_of(atl)
                if not r: yield (div, vname, None, None, 0, 0); continue
                seq = [gfam[letters[i]] for i in r]; isb = 0
            yield (div, vname, seq[0], pattern_of(seq), isb, 1 - isb)
        return audit
    # 2019+: one column per group (ATL) then per candidate (BTL)
    atl, btl, gfams, seen_btl = [], [], {}, False
    for i, h in enumerate(hdr[6:], start=6):
        letter, _, rest = h.partition(":"); letter = letter.strip()
        if not seen_btl and letter not in gfams and letter != "UG":
            gfams[letter] = family(rest); atl.append((i, gfams[letter])); audit.append({"letter": letter, "name": rest.strip(), "family": list(gfams[letter])})
        else:
            seen_btl = True
            btl.append((i, gfams.get(letter, ("OTH", "IND")) if letter != "UG" else ("OTH", "IND")))
    fa, fb = dict(atl), dict(btl)
    a0, b0 = atl[0][0], (btl[0][0] if btl else len(hdr))
    for row in rdr:
        if len(row) < 7: continue
        div, vname = row[1].strip(), row[2].strip()
        bp = collections.defaultdict(list)
        for j in range(b0, min(len(row), len(hdr))):
            v = row[j].strip()
            if not v: continue
            n = 1 if v in ("*", "/") else int(v) if v.isdigit() else None
            if n is not None: bp[n].append(j)
        r = run_of(bp) if bp else []
        if len(r) >= 6:
            seq = [fb[c] for c in r]; isb = 1
        else:
            ap = collections.defaultdict(list)
            for j in range(a0, min(b0, len(row))):
                v = row[j].strip()
                if not v: continue
                n = 1 if v in ("*", "/") else int(v) if v.isdigit() else None
                if n is not None: ap[n].append(j)
            r = run_of(ap)
            if not r: yield (div, vname, None, None, 0, 0); continue
            seq = [fa[c] for c in r]; isb = 0
        yield (div, vname, seq[0], pattern_of(seq), isb, 1 - isb)
    return audit

SPECIAL = re.compile(r"^(postal|absent|pre[_ -]?poll|provisional|special|divisional office|mobile|hospital|remote|team|other|declaration)", re.I)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True)
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("years", nargs="*", type=int, default=sorted(EVENTS))
    a = ap.parse_args()
    counts_json = json.load(open(os.path.join(ROOT, ".build/aec-flow-src/senate-atl/counts.json")))["events"]
    for year in a.years:
        ev = EVENTS[year]
        cache = os.path.join(a.cache, f"aec-senate-{ev}")
        os.makedirs(cache, exist_ok=True)
        if a.fetch:
            for st in STATES:
                fetch(URL.format(ev=ev, st=st), os.path.join(cache, f"fp-{st}.zip"))
            if year == 2016: fetch(URL_CI, os.path.join(cache, "aec-senate-candidateinformation-20499.zip"))
        lay16 = layout_2016(cache) if year == 2016 else None
        # booth names -> PollingPlaceID from the House store (same AEC place register)
        res = json.load(open(os.path.join(ROOT, f"map/data/res-{year}.json")))
        B = res["booths"]; ppid = {}
        for i in range(len(B["id"])):
            ppid[(res["divs"][B["d"][i]]["n"].lower(), B["n"][i].strip().lower())] = B["id"][i]
        divs = collections.defaultdict(lambda: {"st": None, "n": 0, "t": collections.defaultdict(lambda: collections.defaultdict(int))})
        booths = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(int)))
        prov, audit, checks = {}, {}, {}
        for st in STATES:
            zpath = os.path.join(cache, f"fp-{st}.zip")
            gen = read_state(year, st, zpath, lay16)
            rows = btl_n = unread = 0
            atl_pa = collections.Counter()
            unmatched = collections.Counter()
            try:
                while True:
                    div, vname, first, pidx, isb, isatl = next(gen)
                    rows += 1
                    if first is None: unread += 1; continue
                    btl_n += isb
                    d = divs[div]; d["st"] = st; d["n"] += 1
                    d["t"][cohort_key(first)][pidx] += 1
                    key = ppid.get((div.lower(), vname.lower()))
                    if key is None:
                        if not SPECIAL.match(vname) and "ppvc" not in vname.lower(): unmatched[vname] += 1
                        key = f"special:{div}"
                    booths[key][booth_cohort(first)][pidx] += 1
                    if isatl and first[0] == "COAL":
                        p = PATTERNS[pidx]; ia, io_ = p.find("A"), p.find("O")
                        if ia < 0 and io_ < 0: atl_pa["neither"] += 1
                        elif io_ < 0 or (ia >= 0 and ia < io_): atl_pa["alp"] += 1
                        else: atl_pa["on"] += 1
            except StopIteration as e:
                audit[st] = e.value
            prov[st] = {"url": URL.format(ev=ev, st=st), "bytes": os.path.getsize(zpath), "sha256": sha256(zpath),
                        "rows": rows, "btl": btl_n, "unreadable": unread,
                        "unmatchedPlaces": sum(unmatched.values()), "unmatchedTop": unmatched.most_common(5)}
            # check against counts.json (ATL-only Coalition cohort, Labor-v-ON pair)
            ref = counts_json.get(str(year), {}).get("paStates", {}).get(st, {}).get("COAL")
            if ref and (ref["ALP_first"] + ref["ALP_only"] + ref["PHON_first"] + ref["PHON_only"]) > 0 and (atl_pa["alp"] + atl_pa["on"]) > 0:
                mine = atl_pa["alp"] / (atl_pa["alp"] + atl_pa["on"])
                theirs = (ref["ALP_first"] + ref["ALP_only"]) / (ref["ALP_first"] + ref["ALP_only"] + ref["PHON_first"] + ref["PHON_only"])
                checks[st] = round(100 * (mine - theirs), 2)
                assert abs(mine - theirs) < 0.006, f"{year} {st}: Coalition Labor-v-ON share {mine:.4f} v counts.json {theirs:.4f}"
            print(f"{year} {st}: {rows} ballots, {btl_n} BTL, {unread} unreadable, unmatched places {sum(unmatched.values())}"
                  + (f", check v counts.json {checks.get(st):+.2f} pts" if st in checks else ""), flush=True)
        enc = lambda t: {str(k): v for k, v in sorted(t.items())}
        out = {
            "_about": "How each first-preference cohort's Senate voters ranked Labor (A), the Coalition (C), the Greens (G) and One Nation (O): ballots by the order the four first appear (pattern index into `patterns`), per division. Built by .build/analysis/seat-model/extract-senate-rankings.py from the AEC's ballot-level formal-preferences files (BTL where a valid 1-6 run exists, else ATL; runs stop at the first missing or repeated number). Cohort = family of preference 1: ALP, GRN, ON, COAL:<LIB|NAT|LNP|LN|CLP>, OTH:<sub-family> (classes in `subClass`). Consumed by the seat model's flow layer (senate-flows.mjs).",
            "year": year, "event": ev, "patterns": PATTERNS, "subClass": SUBS,
            "divisions": {k: {"st": v["st"], "n": v["n"], "t": {c: enc(t) for c, t in sorted(v["t"].items())}} for k, v in sorted(divs.items())},
            "groups": audit, "checks": {"countsJsonCoalitionLaborVOnAtl": checks},
            "_provenance": {"generated": __import__("datetime").date.today().isoformat(), "files": prov},
        }
        op = os.path.join(ROOT, f"data/senate-rankings-{year}.json")
        with open(op, "w") as f: json.dump(out, f, separators=(",", ":"))
        bdir = os.path.join(ROOT, ".build/aec-flow-src/senate-ballots"); os.makedirs(bdir, exist_ok=True)
        bout = {"_about": "Per polling place (AEC PollingPlaceID, as map/data/res-<year>.json booths) the same ranking tables as data/senate-rankings-<year>.json, cohorts pooled to ALP, COAL, GRN, ON and minor-party classes OTH-R/L/M; non-place vote collection points pooled per division as special:<division>.", "year": year, "patterns": PATTERNS,
                "booths": {str(k): {c: enc(t) for c, t in sorted(v.items())} for k, v in booths.items()}}
        with gzip.open(os.path.join(bdir, f"booth-rankings-{year}.json.gz"), "wt") as f: json.dump(bout, f, separators=(",", ":"))
        print(f"{year}: wrote {op} ({os.path.getsize(op)} bytes) and booth table ({len(booths)} places)")

if __name__ == "__main__":
    main()
