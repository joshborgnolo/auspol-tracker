"""aec-booth.py – per-polling-place DISTRIBUTIONS of the vote at federal
elections, 1993–2025: the booth-level shape behind the national and
per-state figures (median booth, quartiles), by party bucket, cut by
state, AEC division classification, and vote stream.

Three stores, three committed source lanes (.build/aec-flow-src/booth/):

  booth-primary.json  first-preference share distribution per bucket,
                      1993–2025 – modern era from the VTR's per-polling-
                      place FPV downloads (fpv/<year>-<ST>.csv.gz), the
                      statistics era (1993–2001) from the count-1 rows of
                      the committed HPPDOP cascades (fpv/<year>.csv.gz,
                      repacked by harvest-aec-booth.sh; party joined from
                      hcands-<year>.txt per ballot position).
  booth-tpp.json      Labor's two-party share distribution per booth,
                      1996–2025 – modern era from HouseTppByPollingPlace
                      (tpp-pp/<year>.csv.gz), 1996–2001 from the committed
                      HTPP tables (../htpp-<year>.txt – 1998's table omits
                      Newcastle whose final pair ran Labor v independent;
                      1993's HTPP table is informal-votes-only, so 1996 is
                      the floor, exactly as in aec-2pp-history.py).
  booth-flows.json    per-booth ALP share of each voter bucket's counted
                      transfers in CLASSIC divisions (final pair Labor v
                      Coalition), 2004–2025 – from the TCP-flow-per-polling-
                      place External zips (tcf/<year>-<ST>.csv.gz, one
                      merged CSV per state penned by the harvest script).
                      There is no per-polling-place TCP-flow product before
                      2004 – flows start there.

THE RECOMPOSE DOCTRINE. Every booth sum must land exactly on the AEC's
own division-level tally of the same vote form – never "close enough":
  FPV 2004–2025  ≡ HouseFirstPrefsByCandidateByVoteTypeDownload ordinary
                   votes per (division, candidate) – oracle/fpvvt-<year>.
                   The per-PP lane carries ordinary votes only (PPVC
                   pseudo places included); absent/postal/provisional/
                   declaration votes exist solely in the vote-type
                   product, so the oracle column is OrdinaryVotes.
  TPP  2004–2013 ≡ HouseTcpByCandidateByVoteTypeDownload ordinary votes
                   per classic pair candidate (oracle/tcpcvt-<year>). For
                   non-classic divisions no vote-type oracle exists – the
                   per-row formality ALP+Coalition ≡ TotalVotes is the
                   check there.
  TPP  2016–2025 ≡ HouseTppByDivisionByVoteTypeDownload ordinary votes
                   per division (oracle/tppvt-<year>; the product does
                   not exist before event 20499).
  FPV  1993–2001 ≡ hcands-<year>.txt Vote per (division, candidate)
                   (pseudo PP rows ABSENT/POSTAL/PROVISIONAL/PRE POLL are
                   inside the per-PP lane, so sums are whole-division).
  TPP  1996–2001 ≡ national canonical 2PP within 0.06 (the same guard
                   aec-2pp-history.py applies to these tables).
  TCF  2004–2025 ≡ committed division-level flows (tcpflow-<year>.csv.gz;
                   2025 = data/aec-2025-tcp-flow-by-division.csv) per
                   classic division per from-bucket.
Every equality here is integer-exact except the 1996–2001 TPP guard.

STREAMS. Pseudo polling-place names map to vote streams: ABSENT→abs,
POSTAL→post, PROVISIONAL→prov, anything carrying PPVC or the legacy
"PRE POLL"/"PREPOLL" token→pp; everything else is an ordinary booth
(ord). An all-caps token that matches no rule fails the run – a new
pseudo-place form is a pipeline event, not something to absorb.

Usage: python3 .build/aec-booth.py [--check]
  default writes the three data/booth-*.json files; --check re-derives
  and compares all three byte-for-byte.
"""
import csv, gzip, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "aec-flow-src")
BOOTH = os.path.join(SRC, "booth")

MOD = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]
STATS = [1993, 1996, 1998, 2001]     # statistics era (HPPDOP workbench)
HTT = [1996, 1998, 2001]             # the HTPP per-place years
# 1998's HTPP table omits Newcastle (final pair Labor v independent) – the
# AEC's own table, so the exclusion is the product's, never ours
HTT_EXCLUDED = {1998: {"Newcastle"}}
# the 1996–2001 TPP guard: national per-booth sums against the canonical
# election record – same tolerance aec-2pp-history.py applies to these
HTT_NAT_TOL = 0.06
TPP_YEARS = HTT + MOD

OUT_PRIMARY = os.path.join(ROOT, "data", "booth-primary.json")
OUT_TPP = os.path.join(ROOT, "data", "booth-tpp.json")
OUT_FLOWS = os.path.join(ROOT, "data", "booth-flows.json")

STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"]
CLASS_META = (("inner", "Inner metropolitan"),
              ("outer", "Outer metropolitan"),
              ("provincial", "Provincial"),
              ("rural", "Rural"))
CLS_KEY = {"inner metropolitan": "inner", "outer metropolitan": "outer",
           "provincial": "provincial", "rural": "rural"}

# CLR: Country Labor, Labor's NSW rural banner 2001–2013; the Coalition
# spelling space follows fed-class-flows.py (LNQ in 2010)
LABOR = {"ALP", "CLR"}
COAL = {"LP", "NP", "CLP", "LNP", "LNQ", "NAT", "LIB"}
GREENS = {"GRN", "GWA", "GVIC", "AGV", "TG"}
ONP = {"HAN", "ON"}
BUCKET_META = (("alp", "Labor"), ("lnp", "Coalition"), ("grn", "Greens"),
               ("onp", "One Nation"), ("oth", "Others"))
FLOW_BUCKETS = ("grn", "onp", "oth")


def bucket(code):
    """PartyAb -> bucket key. LABOR/COAL map to their own names; every
    other non-major ballot is oth except the two named minors."""
    if code in LABOR: return "alp"
    if code in COAL: return "lnp"
    if code in GREENS: return "grn"
    if code in ONP: return "onp"
    return "oth"


def flow_bucket(code):
    """From-party -> flow bucket, majors EXCLUDED (None): a majors-to-
    majors transfer (three-cornered seats' excluded Coalition candidate)
    is not a minor-party flow."""
    if code in LABOR or code in COAL: return None
    if code in GREENS: return "grn"
    if code in ONP: return "onp"
    return "oth"


STREAM_LABELS = (("ord", "Ordinary vote"), ("pp", "Pre-poll vote"),
                 ("abs", "Absent vote"), ("post", "Postal vote"),
                 ("prov", "Provisional vote"))


def stream_of(pp_name, stats=False):
    """Polling-place name -> stream key, with fail-closed taxonomy: an
    unknown all-caps token is a new pseudo-place form and stops the run.
    In the statistics-era packs (stats=True) the caps test can't run —
    real booths caps-lock there too (AROONA, DOOMADGEE, FELIXSTOW) — so
    classification is keyword-only; the four canonical per-division
    declaration rows are the same ABSENT/POSTAL/PRE POLL/PROVISIONAL
    tokens as the modern lanes (verified per-file 2026-10-24; the lone
    2001 'Express'/'International' services carry 0 and 81 votes and
    fall to ord)."""
    n = pp_name.strip().upper()
    if not n:
        raise AssertionError("empty polling-place name")
    if n == "ABSENT": return "abs"
    if n == "POSTAL": return "post"
    if n == "PROVISIONAL": return "prov"
    if "PPVC" in n or n.startswith("PRE POLL") or n.startswith("PREPOLL"):
        return "pp"
    if not stats and n == pp_name.strip() and \
       all(c.isalpha() or c in " -'" for c in n) \
       and len(n) >= 4 and (n.isupper() and pp_name.strip().isupper()):
        raise AssertionError(f"unmapped pseudo polling place {pp_name!r}")
    return "ord"


def read_csv_gz(path, delim=","):
    raw = gzip.open(path, "rb").read() if path.endswith(".gz") \
        else open(path, "rb").read()
    return csv.reader(raw.decode("utf-8-sig").splitlines(), delimiter=delim)


def header_map(rows, first_cell, delim_name):
    """Find the header row by its first cell name; return (index, map)."""
    for i, r in enumerate(rows):
        if r and r[0].strip().strip('"') == first_cell:
            return i, {c.strip().strip('"'): j for j, c in enumerate(r)}
    raise AssertionError(f"no {first_cell!r} header in {delim_name}")


def cell(r, h, name):
    return r[h[name]].strip().strip('"')


def q(sorted_x, fract):
    """Linear-interpolated quantile of a pre-sorted list; None if empty."""
    n = len(sorted_x)
    if not n:
        return None
    pos = (n - 1) * fract
    lo = int(pos)
    hi = min(lo + 1, n - 1)
    t = pos - lo
    return sorted_x[lo] * (1 - t) + sorted_x[hi] * t


def dist(shares):
    """{n, med, p25, p75} for a list of per-booth shares (percent)."""
    s = sorted(shares)
    if not s:
        return None
    return {"n": len(s),
            "med": round(q(s, 0.5), 2),
            "p25": round(q(s, 0.25), 2),
            "p75": round(q(s, 0.75), 2)}


def cut_book():
    """cuts -> year -> series-key -> [shares]. Series keys are the bucket
    (primary, flows) or 'alp' (tpp); cuts are nat, the eight states, the
    four classes and the five streams."""
    cuts = {"nat": {}}
    for s in STATES:
        cuts[s] = {}
    for ck, _ in CLASS_META:
        cuts[ck] = {}
    for sk, _ in STREAM_LABELS:
        cuts[sk] = {}
    return cuts


def add(cuts, cut, year, key, share):
    if share is None:
        return
    cuts[cut].setdefault(str(year), {}).setdefault(key, []).append(share)


def load_classes():
    return json.load(open(os.path.join(ROOT, "data",
                                       "division-classifications.json"),
                          encoding="utf-8"))["elections"]


def cut_home(cuts, year, div, st, stream, cls_blocks):
    """The cut keys a booth belongs to: nat, its state, its class
    (classification exists from 1996), its stream."""
    homes = ["nat", st, stream]
    blk = cls_blocks.get(str(year))
    if blk is not None:
        if div not in blk:
            raise AssertionError(f"{year} {div}: no classification block entry")
        homes.append(CLS_KEY[blk[div]["classification"].lower()])
    return homes


# Statistics-era pack quirk (proved row-by-row 2026-10-24): the count-1
# row set of the HPPDOP.TXT packs mixes REAL polling-place rows with
# per-(division, ballot-position) SUMMARY pseudo-rows whose Polling Place
# name contains "SUMMARY" — raw dop count-1 sums are exactly 2× the
# published totals (row-count arithmetic pins it: dop count-1 count minus
# the harvest repack's = 943/908/1109/1039 for 1993/1996/1998/2001, each
# exactly the year's doubled (div, candidate) count). The harvest repack
# this lane reads already strips SUMMARY rows, so it recomposes against
# the hcands rosters at 1× — exactly for 1996/1998/2001. The 1993 pack
# alone carries 64 per-(division, party) count-line-vs-roster
# discrepancies (22 divisions; national Σdelta = 29 votes of 10,576,779
# formal — 0.0003%; Σ|delta| 145), pinned verbatim here so a refetch of
# the pack file changes the freeze only deliberately:
FPV93_STRAY = {("Bass", "ALP"): 1, ("Bass", "LP"): 1, ("Bass", "TG"): 2,
               ("Bendigo", ""): 1, ("Bendigo", "ALP"): 17,
               ("Bendigo", "DEM"): 1, ("Bendigo", "IND"): 1,
               ("Bendigo", "LP"): 2, ("Bruce", "DEM"): 7,
               ("Bruce", "NLP"): -7, ("Canberra", "ALP"): -1,
               ("Canberra", "ASG"): 1, ("Canberra", "DEM"): 2,
               ("Canberra", "GDA"): -1, ("Cook", "ALP"): -1,
               ("Cook", "CTA"): 3, ("Cook", "NLP"): -1,
               ("Corangamite", "CTA"): 1, ("Corangamite", "DEM"): 2,
               ("Corangamite", "LP"): -1, ("Cowper", "ALP"): 1,
               ("Cowper", "NP"): -1, ("Fraser", "IND"): 2,
               ("Gilmore", "DEM"): 1, ("Gilmore", "GRN"): -1,
               ("Kingston", "ALP"): 2, ("Kingston", "DEM"): 1,
               ("Kingston", "LP"): 1, ("Macquarie", "ALP"): -1,
               ("Macquarie", "DEM"): -1, ("Macquarie", "LP"): -2,
               ("Macquarie", "NLP"): -3, ("McMillan", "IND"): 1,
               ("Moncrieff", "ALP"): -3, ("Murray", "ALP"): -2,
               ("Murray", "DEM"): -1, ("Murray", "IND"): -1,
               ("Murray", "NP"): -2, ("Newcastle", ""): -2,
               ("Newcastle", "ALP"): -5, ("Newcastle", "GRN"): -3,
               ("Newcastle", "IND"): 2, ("Newcastle", "LP"): -9,
               ("Page", "IND"): 2, ("Page", "NLP"): -1,
               ("Riverina", "IND"): 1, ("Riverina", "NP"): -1,
               ("Robertson", "ALP"): -1, ("Robertson", "DEM"): -1,
               ("Robertson", "LP"): 2, ("Sydney", ""): 3,
               ("Sydney", "DEM"): 2, ("Throsby", ""): 3,
               ("Throsby", "AFI"): 1, ("Throsby", "GRN"): 4,
               ("Throsby", "RCL"): -1, ("Wakefield", "ALP"): 1,
               ("Wakefield", "DEM"): -1, ("Wakefield", "IND"): 2,
               ("Wakefield", "LP"): -1, ("Wakefield", "NLP"): -2,
               ("Wannon", "DEM"): 3, ("Wannon", "IND"): 5,
               ("Wannon", "NLP"): 5}


# ---------------------------------------------------------------- FPV lane
def fpv_year(year, cls_blocks):
    """Booth FPV shares for one election.

    Returns (booths, nat_votes_per_bucket) where booths is a list of
    (div, state, stream, {bucket: votes}, total_votes). The recompose
    asserts run inline against the vote-type oracle (modern) or the
    hcands rosters (statistics era)."""
    booths = []
    sums = {}                       # (div, party) -> ordinary/count-1 votes
    if year >= 2004:
        # one file per state; party from the row directly
        for st in STATES:
            path = os.path.join(BOOTH, "fpv", f"{year}-{st.upper()}.csv.gz")
            rows = list(read_csv_gz(path))
            hi, h = header_map(rows, "StateAb", path)
            iparty, idiv = h["PartyAb"], h["DivisionNm"]
            ipp, ivotes = h["PollingPlace"], h["OrdinaryVotes"]
            ist, ibp = h["StateAb"], h["BallotPosition"]
            per_booth = {}
            for r in rows[hi + 1:]:
                if len(r) <= ivotes or not cell(r, h, "DivisionNm"):
                    continue
                # a blank party marks the per-booth Informal row (bp 999)
                # — formal lanes only
                if cell(r, h, "PartyAb") == "":
                    continue
                pa, div = cell(r, h, "PartyAb"), cell(r, h, "DivisionNm")
                pp, v = r[ipp].strip(), int(r[ivotes].strip())
                assert r[ist].strip().lower() == st, \
                    f"{year} {div} {pp}: StateAb {r[ist].strip()} inside {st.upper()} file"
                bk = per_booth.setdefault((div, pp), {})
                bk[bucket(pa)] = bk.get(bucket(pa), 0) + v
                sums[(div, pa)] = sums.get((div, pa), 0) + v
            for (div, pp), bk in per_booth.items():
                total = sum(bk.values())
                booths.append((div, st, stream_of(pp), bk, total))
        # recompose: per-PP ordinary sums ≡ vote-type ordinary per
        # (division, candidate's party code)
        oracle = {}
        path = os.path.join(BOOTH, "oracle", f"fpvvt-{year}.csv.gz")
        rows = list(read_csv_gz(path))
        hi, h = header_map(rows, "StateAb", path)
        for r in rows[hi + 1:]:
            if not cell(r, h, "DivisionNm") or cell(r, h, "PartyAb") in ("", "Informal"):
                continue
            key = (cell(r, h, "DivisionNm"), cell(r, h, "PartyAb"))
            # accumulate: same code can front two candidates in a
            # division (Bennelong 2004's two INDs)
            oracle[key] = oracle.get(key, 0) + int(cell(r, h, "OrdinaryVotes"))
        bad = []
        for key, v in sums.items():
            if oracle.get(key) != v:
                bad.append((key, v, oracle.get(key)))
        extra = [k for k in oracle if k not in sums]
        assert not bad and not extra, \
            f"{year} FPV recompose vs fpvvt ordinary: {bad[:3]} extra {extra[:3]}"
    else:
        path = os.path.join(BOOTH, "fpv", f"{year}.csv.gz")
        rows = list(read_csv_gz(path, ";"))
        hi, h = header_map(rows, "State", path)
        i_div, i_pp = h["Division"], h["Polling Place"]
        i_bp, i_v = h["Ballot Position"], h["Vote"]
        # candidate identity flows from ballot position via the rosters
        hc = {}
        hrows = list(read_csv_gz(os.path.join(SRC, f"hcands-{year}.txt"), ";"))
        hhi, hh = header_map(hrows, "State", f"hcands-{year}.txt")
        for r in hrows[hhi + 1:]:
            if len(r) <= hh["Vote"] or not cell(r, hh, "Division"):
                continue
            hc[(cell(r, hh, "Division"), cell(r, hh, "Ballot Position"))] = (
                cell(r, hh, "Party"), cell(r, hh, "Candidate"))
        i_cs = h["Candidate Status"]
        oracle = {}
        per_booth = {}
        for r in rows[hi + 1:]:
            if len(r) <= i_v or not r[i_div].strip():
                continue
            div, pp = r[i_div].strip(), r[i_pp].strip()
            cst = r[i_cs].strip()
            assert cst in ("R", "E"), \
                f"{year} {div} {pp}: unmapped Candidate Status {cst!r}"
            bp, v = r[i_bp].strip(), int(r[i_v].strip())
            st = r[h["State"]].strip().lower()
            assert st in STATES, f"{year} {div} {pp}: unmapped state {st}"
            party, cand = hc.get((div, bp), (None, None))
            assert party is not None, f"{year} {div} bp {bp}: no hcands roster entry"
            bkey = (div, pp, st)
            bk = per_booth.setdefault(bkey, {})
            bk[bucket(party)] = bk.get(bucket(party), 0) + v
            oracle[(div, party)] = oracle.get((div, party), 0) + v
        for (div, pp, st), bk in per_booth.items():
            booths.append((div, st, stream_of(pp, stats=True),
                           bk, sum(bk.values())))
        # recompose: count-1 per-PP sums ≡ hcands Vote at 1× per
        # (division, party-code) — the SUMMARY-row quirk pinned above
        # FPV93_STRAY lives only in raw dop, not this SUMMARY-stripped
        # repack; 1993's 64 count-line-vs-roster deltas are excused by
        # name
        roster = {}
        for r in hrows[hhi + 1:]:
            if len(r) <= hh["Vote"] or not cell(r, hh, "Division"):
                continue
            key = (cell(r, hh, "Division"), cell(r, hh, "Party"))
            roster[key] = roster.get(key, 0) + int(cell(r, hh, "Vote"))
        stray = FPV93_STRAY if year == 1993 else {}
        for key, want in sorted(roster.items()):
            have = oracle.get(key, 0) - stray.get(key, 0)
            assert have == want, \
                f"{year} {key[0]}/{key[1]}: per-PP count-1 sum {have} != hcands Vote {want}"
        extra = [k for k in oracle if k not in roster]
        assert not extra, f"{year} stats FPV: parties absent from roster: {extra[:3]}"
    # join divisions to the classifications block (skipped only for 1993)
    blk = cls_blocks.get(str(year))
    if blk is not None:
        divs = {d for (d, _s, _t, _b, _v) in booths}
        assert divs == set(blk), \
            f"{year}: class join drifted – {sorted(divs - set(blk))[:3]} / {sorted(set(blk) - divs)[:3]}"
    return booths


def build_primary(cls_blocks):
    years, cuts = [str(y) for y in STATS + MOD], cut_book()
    nat_votes = {}
    for y in STATS + MOD:
        for div, st, stream, bk, total in fpv_year(y, cls_blocks):
            if total == 0:
                continue
            for key, _ in BUCKET_META:
                if key in bk:
                    share = 100.0 * bk[key] / total
                    for home in cut_home(cuts, y, div, st, stream, cls_blocks):
                        add(cuts, home, y, key, share)
            for key, v in bk.items():
                nat_votes[(y, key)] = nat_votes.get((y, key), 0) + v
    # a bucket hides in a year only when NO booth in the country names it
    for (y, key) in list(nat_votes):
        assert nat_votes[(y, key)] > 0

    def cells_for(bucket_keys):
        out = {}
        for cut, per_year in cuts.items():
            cells = {}
            for y, series in per_year.items():
                row = {}
                for key in bucket_keys:
                    d = dist(series.get(key, []))
                    if d is not None:
                        row[key] = d
                if row:
                    cells[y] = row
            if cells:
                out[cut] = cells
        return out

    doc = {
        "_comment": "GENERATED by .build/aec-booth.py – per-polling-place first-preference share distributions at federal elections, per bucket (alp/lnp/grn/onp/oth), cut by state, AEC division classification (classifications join from 1996; 1996–2001's statistics-era figures come from the HPPDOP count-1 rows) and vote stream. Each cell is the distribution over booths with any votes (n booths, median share, quartiles), in percent. Sources are recompose-guarded: 2004–2025 sums equal the vote-type downloads' ordinary votes per candidate exactly; 1993–2001 sums equal the hcands rosters' totals exactly. See the script's doctrinal header.",
        "buckets": [[k, l] for k, l in BUCKET_META],
        "years": years,
        "streams": [[k, l] for k, l in STREAM_LABELS],
        "cuts": cells_for([k for k, _ in BUCKET_META]),
    }
    return doc


# ---------------------------------------------------------------- TPP lane
def tpp_year(year, cls_blocks):
    """(div, st, stream, alp_share) rows for one election (booths with
    ALP+Coalition > 0), plus the recompose asserts."""
    rows = list(read_csv_gz(os.path.join(BOOTH, "tpp-pp", f"{year}.csv.gz")))
    hi, h = header_map(rows, "StateAb", f"tpp-pp {year}")
    ia = h["Australian Labor Party Votes"]
    ic = h["Liberal/National Coalition Votes"]
    it, idiv, ipp, ist = h["TotalVotes"], h["DivisionNm"], h["PollingPlace"], h["StateAb"]
    out, sums = [], {}
    for r in rows[hi + 1:]:
        if len(r) <= it or not r[idiv].strip():
            continue
        a, c, tot = (int(r[ia]), int(r[ic]), int(r[it]))
        assert a + c == tot, \
            f"{year} {r[idiv]} {r[ipp]}: ALP+Coalition {a + c} != TotalVotes {tot}"
        div, st, pp = r[idiv].strip(), r[ist].strip().lower(), r[ipp].strip()
        sums[div] = sums.get(div, [0, 0])
        sums[div][0] += a
        sums[div][1] += c
        if a + c:
            out.append((div, st, stream_of(pp), 100.0 * a / (a + c)))
    # recompose against the vote-type oracle family
    if year >= 2016:
        orows = list(read_csv_gz(os.path.join(BOOTH, "oracle", f"tppvt-{year}.csv.gz")))
        ohi, oh = header_map(orows, "DivisionNm", f"tppvt-{year}")
        oa = oh["Australian Labor Party OrdinaryVotes"]
        oc = oh["Liberal/National Coalition OrdinaryVotes"]
        odiv = oh["DivisionNm"]
        oracle = {}
        for r in orows[ohi + 1:]:
            if len(r) <= oc or not r[odiv].strip():
                continue
            oracle[r[odiv].strip()] = (int(r[oa]), int(r[oc]))
        assert set(oracle) == set(sums), \
            f"{year} tppvt division set drifted vs per-PP lane"
        for div, (a, c) in sums.items():
            oa_, oc_ = oracle[div]
            assert (a, c) == (oa_, oc_), \
                f"{year} {div}: per-PP TPP ordinary ({a},{c}) != tppvt ordinary ({oa_},{oc_})"
    else:
        orows = list(read_csv_gz(os.path.join(BOOTH, "oracle", f"tcpcvt-{year}.csv.gz")))
        ohi, oh = header_map(orows, "StateAb", f"tcpcvt-{year}")
        oracle, parties = {}, {}
        for r in orows[ohi + 1:]:
            if len(r) <= oh["OrdinaryVotes"] or not cell(r, oh, "DivisionNm"):
                continue
            party, div = cell(r, oh, "PartyAb"), cell(r, oh, "DivisionNm")
            if party == "":
                continue            # the informal row carries no party
            parties.setdefault(div, set()).add(party)
            side = "a" if party in LABOR else ("c" if party in COAL else None)
            if side is None:
                continue
            d = oracle.setdefault(div, {"a": 0, "c": 0})
            d[side] += int(cell(r, oh, "OrdinaryVotes"))
        # a division's majors-only TPP oracle exists exactly when its
        # tcpcvt row set is one LABOR + one Coalition code (the file
        # lists ONLY the final pair — Coalition-internal pairs like
        # 2010 O'Connor (LP v NP) and IND/GRN finals read classic=False)
        classic = {d: len(p & LABOR) == 1 and len(p & COAL) == 1
                   and p <= LABOR | COAL
                   for d, p in parties.items()}
        for div, (a, c) in sums.items():
            if not classic.get(div, False):
                # non-classic division (final pair not ALP v Coalition):
                # no majors-only vote-type oracle exists – the per-row
                # formality above is its whole check
                continue
            o = oracle[div]
            assert (a, c) == (o["a"], o["c"]), \
                f"{year} {div}: per-PP TPP ordinary ({a},{c}) != tcpcvt ({o['a']},{o['c']})"
    # classifications join
    blk = cls_blocks[str(year)]
    assert {d for d, _s, _t, _v in out} == set(blk) - HTT_EXCLUDED.get(year, set()), \
        f"{year}: tpp class join drifted"
    return out


def tpp_year_stats(year, cls_blocks):
    """1996/1998/2001 from the committed htpp-<year>.txt; same row shape as
    tpp_year plus the national canonical guard aec-2pp-history applies."""
    rows = list(read_csv_gz(os.path.join(SRC, f"htpp-{year}.txt"), ";"))
    hi, h = header_map(rows, "Division", f"htpp-{year}")
    ia, ic, idiv, ipp = h["ALP TPP Vote"], h["Coalition TPP Vote"], h["Division"], h["Polling Place"]
    ipc = h["ALP TPP Pc"]
    blk = cls_blocks[str(year)]
    out, nat = [], [0, 0]
    excl = HTT_EXCLUDED.get(year, set())
    seen_divs = set()
    for r in rows[hi + 1:]:
        if len(r) <= ic or not r[idiv].strip():
            continue
        a, c = int(r[ia] or 0), int(r[ic] or 0)
        div, pp = r[idiv].strip(), r[ipp].strip()
        seen_divs.add(div)
        if a + c:
            assert abs(100.0 * a / (a + c) - float(r[ipc])) < 0.02, \
                f"{year} {div} {pp}: printed ALP pc {r[ipc]} off share"
            st = blk[div]["state"].strip().lower()
            out.append((div, st, stream_of(pp, stats=True),
                        100.0 * a / (a + c)))
            nat[0] += a
            nat[1] += c
    assert seen_divs == set(blk) - excl, \
        f"{year}: htpp join drifted {sorted(seen_divs ^ (set(blk) - excl))[:3]}"
    recs = json.load(open(os.path.join(ROOT, "data", "polls.json"),
                          encoding="utf-8"))["elections"]
    canon = recs[f"e{year}"]["tpp_alp"]
    derived = 100.0 * nat[0] / sum(nat)
    assert abs(derived - canon) < HTT_NAT_TOL, \
        f"{year} national 2PP: per-booth sum {derived:.2f} != canonical {canon}"
    return out


def build_tpp(cls_blocks):
    cuts = cut_book()
    for y in TPP_YEARS:
        rows = tpp_year_stats(y, cls_blocks) if y in HTT else tpp_year(y, cls_blocks)
        for div, st, stream, share in rows:
            for home in cut_home(cuts, y, div, st, stream, cls_blocks):
                add(cuts, home, y, "alp", share)
    out = {}
    for cut, per_year in cuts.items():
        cells = {}
        for y, series in per_year.items():
            d = dist(series.get("alp", []))
            if d is not None:
                cells[y] = {"alp": d}
        if cells:
            out[cut] = cells
    return {
        "_comment": "GENERATED by .build/aec-booth.py – distribution of Labor's two-party share across polling places at federal elections, cut by state, AEC division classification and vote stream (cell n = booths; shares in percent of the ALP+Coalition vote at the booth). Sources: per-polling-place TPP downloads 2004–2025, the statistics packs' HTPP tables 1996–2001 (1998's table omits Newcastle; no usable 1993 count exists). Recompose guards: 2004–2013 classic divisions equal the TCP vote-type download's ordinary votes; 2016–2025 all divisions equal the TPP vote-type download's ordinary votes; 1996–2001 national sums equal the canonical election record within 0.06.",
        "years": [str(y) for y in TPP_YEARS],
        "streams": [[k, l] for k, l in STREAM_LABELS],
        "cuts": out,
    }


# ------------------------------------------------------------- flows lane
def flows_year(year, cls_blocks):
    """Per-booth ALP share of each minor bucket's transfers in classic
    divisions. Recompose ≡ committed tcpflow oracles per division.
    Records are one per (division, polling place, bucket) — the same
    booth grain the fpv/tpp stores carry; the store _comment's
    "Cell n = booths" contract depends on it."""
    per_booth = {}      # (div, st, pp, bucket) -> [a, c]
    div_to = {}         # div -> set of To parties (classic detection)
    for st in STATES:
        path = os.path.join(BOOTH, "tcf", f"{year}-{st.upper()}.csv.gz")
        rows = list(read_csv_gz(path))
        hi, h = header_map(rows, "StateAb", path)
        idiv, ipp = h["DivisionNm"], h["PPNm"]
        ifrom, ito = h["FromCandidatePartyAb"], h["ToCandidatePartyAb"]
        ifromid, iv = h["FromCandidateId"], h["TransferCount"]
        for r in rows[hi + 1:]:
            if len(r) <= iv or not cell(r, h, "DivisionNm"):
                continue
            div, pp = r[idiv].strip().strip('"'), r[ipp].strip().strip('"')
            frm = r[ifrom].strip().strip('"')
            if r[ifromid].strip().strip('"') == "0":
                continue      # First Preferences pseudo rows are FPV, not flows
            if frm == "":
                # External per-PP zips blank the Ab for 'Non Affiliated'
                # candidates (the division-level products carry NAFD);
                # only ever that name. Treat as other.
                assert r[h["FromCandidatePartyNm"]].strip().strip('"') \
                    == "Non Affiliated", f"{year} blank from-Ab " \
                    f"{r[h['FromCandidateSurname']]}"
                frm_b = "oth"
            else:
                frm_b = flow_bucket(frm)
            to = r[ito].strip().strip('"')
            div_to.setdefault(div, set()).add(to)
            if frm_b is None:
                continue
            side = "a" if to in LABOR else ("c" if to in COAL else None)
            if side is None:
                continue      # flow to a non-classic finalist; whole div excluded anyway
            key = (div, st, pp, frm_b)
            b = per_booth.setdefault(key, [0, 0])
            b[0 if side == "a" else 1] += int(r[iv].strip())
    blk = cls_blocks[str(year)]
    classic = {div for div, dest in div_to.items()
               if (dest & LABOR) and dest <= (LABOR | COAL)}
    # recompose: per-PP flow sums ≡ committed division-level flows
    src = os.path.join(ROOT, "data", "aec-2025-tcp-flow-by-division.csv") \
        if year == 2025 else os.path.join(SRC, f"tcpflow-{year}.csv.gz")
    oracle = {}
    orows = list(read_csv_gz(src))
    ohi, oh = header_map(orows, "StateAb", src)
    for r in orows[ohi + 1:]:
        if len(r) <= oh["TransferCount"] or not cell(r, oh, "DivisionNm"):
            continue
        frm_b = flow_bucket(cell(r, oh, "FromCandidatePartyAb"))
        if frm_b is None or cell(r, oh, "FromCandidateID") == "0":
            continue      # division-level family spells the ID col -ID, not -Id
        to, div = cell(r, oh, "ToCandidatePartyAb"), cell(r, oh, "DivisionNm")
        k = (div, frm_b, "a" if to in LABOR else ("c" if to in COAL else None))
        if k[2] is None:
            continue
        oracle[k] = oracle.get(k, 0) + int(cell(r, oh, "TransferCount"))
    have = {}
    for (div, st, pp, b), (a, c) in per_booth.items():
        have[(div, b, "a")] = have.get((div, b, "a"), 0) + a
        have[(div, b, "c")] = have.get((div, b, "c"), 0) + c
    for k, v in oracle.items():
        if k[0] not in classic:
            continue
        assert have.get(k, 0) == v, \
            f"{year} {k}: per-PP flow sum {have.get(k, 0)} != tcpflow oracle {v}"
    for k, v in have.items():
        if k[0] in classic and oracle.get(k, 0) != v:
            assert False, f"{year} {k}: per-PP flow sum {v} not in oracle"
    out = []
    for (div, st, pp, b), (a, c) in per_booth.items():
        if div not in classic or a + c == 0:
            continue
        out.append((div, st, stream_of(pp), b, 100.0 * a / (a + c)))
    assert {d for d, _, _, _, _ in out} <= set(blk), \
        f"{year}: flows join drifted"
    return out, len(classic)


def build_flows(cls_blocks):
    cuts = cut_book()
    coverage = {}
    for y in MOD:
        rows, n_classic = flows_year(y, cls_blocks)
        coverage[str(y)] = n_classic
        for div, st, stream, b, share in rows:
            for home in cut_home(cuts, y, div, st, stream, cls_blocks):
                add(cuts, home, y, b, share)
    out = {}
    for cut, per_year in cuts.items():
        cells = {}
        for y, series in per_year.items():
            row = {}
            for b in FLOW_BUCKETS:
                d = dist(series.get(b, []))
                if d is not None:
                    row[b] = d
            if row:
                cells[y] = row
        if cells:
            out[cut] = cells
    return {
        "_comment": "GENERATED by .build/aec-booth.py – per-polling-place distribution of each voter bucket's ALP share of counted transfers in CLASSIC divisions (final pair Labor v Coalition) at federal elections 2004–2025, cut by state, AEC division classification and vote stream. Cell n = booths with any of the bucket's transferred ballots; shares in percent of the bucket's transfers reaching the Coalition-or-Labor pair that went to Labor. buck counts = classic divisions per election. Sourced from the TcpFlowByPP External zips, recompose-guarded against the committed division-level flow downloads: every per-division per-bucket sum equals the division product exactly.",
        "buckets": ["grn", "onp", "oth"],
        "years": [str(y) for y in MOD],
        "streams": [[k, l] for k, l in STREAM_LABELS],
        "classicDivisions": coverage,
        "cuts": out,
    }


def main():
    cls_blocks = load_classes()
    docs = [
        (OUT_PRIMARY, build_primary),
        (OUT_TPP, build_tpp),
        (OUT_FLOWS, build_flows),
    ]
    if "--check" in sys.argv:
        for path, fn in docs:
            got = fn(cls_blocks)
            want = json.load(open(path)) if os.path.exists(path) else None
            if want != got:
                print(f"CHECK FAIL: {os.path.basename(path)} is not what the script builds",
                      file=sys.stderr)
                sys.exit(1)
        print("check ok")
        return
    for path, fn in docs:
        doc = fn(cls_blocks)
        with open(path, "w") as f:
            json.dump(doc, f, indent=1, separators=(",", ": "))
            f.write("\n")
        print("wrote", os.path.relpath(path, ROOT))
    p = json.load(open(OUT_PRIMARY))
    print("\nNational median booth ALP FPV share:")
    print("  " + "  ".join(f"{y}:{p['cuts']['nat'][y]['alp']['med']}" for y in p["years"]))

if __name__ == "__main__":
    main()
