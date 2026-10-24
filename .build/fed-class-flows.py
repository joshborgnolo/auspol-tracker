"""fed-class-flows.py – federal preference flows by AEC division class, 1996–2025.

The explainer's inner-metro/outer-metro/provincial/rural companion of the
national FLOW_HISTORY series (flows.mjs) and of its per-state cut
(fed-state-flows.py): within each AEC demographic classification of a
division, the share of each voter bucket's ballots the AEC counted to Labor
over the Coalition at each federal election. Same counted family as the
national cut-flow series – but while the national and per-state tables come
from the per-state TPP/TCP downloads, no per-CLASS table is published, so
this groups the per-DIVISION product instead:
.build/aec-flow-src/tcpflow-<year>.csv.gz (HouseTcpFlowByDivisionDownload,
2004–2022 – 2004's hauled from
https://results.aec.gov.au/12246/results/Downloads/HouseTcpFlowByDivisionDownload-12246.csv,
2007–2022 from each event's Downloads page), data/aec-2025-tcp-flow-by-division.csv
for 2025 (its event's same download, already committed for
estimate-state-flows.py), and .build/aec-flow-src/tcp-{1996,1998,2001}.json.gz
for 1996–2001 – the statistics-pack "Two Candidate Preferred Preference Flow
Result" per-division tables (1996/98's V3_1<state>.TXT, 2001's v3_10 per
division), derived by aec-tcp-history.py from the AEC's official statistics
CD-ROMs. 1996 is the floor: that is as far back as the per-division table
reaches, and the classification store reaches it too – its 1996 and 1998
blocks (committed 2026-10-22, .build/analysis/seat-model/
aec-{1996,1998}-epoch-classifications.tsv) are canonical-on-page
transcriptions of the AEC's own whole-chamber "Divisional Classifications"
table pages of those elections. Classifications 2001 and 2004 are likewise
canonical-on-page transcriptions of the AEC's own division-profile pages
(the 2001-epoch's via Wayback captures with three unrated seats filled from
AEC Research Report 5; 2004's from the live 2004 profiles – all 150 rated
on-page; data/division-classifications.json's _about has the sources).

The per-division product only exists for divisions whose count RAN a
two-candidate-preferred distribution – that is, it names the final pair by
party. As with aec-2025-region-tpp-flows.mjs (the 2025 regional carriers),
a division joins a class bucket only when its final two are Labor v a
Coalition party (a "classic" seat): in a non-classic seat a bucket's
ballots can end on a crossbench pile, and the AEC publishes no majors split
of those, so including the seat would quietly change what the figure
measures. Coverage (classic of total divisions, per class per year) is
printed with the table.

Classifications are the AEC's own, THAT ELECTION'S table
(data/division-classifications.json, the seat-model store – Inner
Metropolitan / Outer Metropolitan / Provincial / Rural): a division
recategorised between elections moves classes with it, so a kink is never a
classification boundary sliding under fixed seats. Every division row must
join a classification – an unmatched name fails the run.

ALL-SEATS, 2004 ON – the same election publishes three whole-chamber
products the 1996–2001 statistics packs never carried: the TPP flow by
STATE BY PARTY (tpp-<year>, every formal ballot in every seat redistributed
ALP v Coalition), the TPP totals BY DIVISION (tppdiv-<year>,
HouseTppByDivisionDownload – the ALP-v-Coalition pair for EVERY seat,
non-classic included; 2025's file swaps the vote columns, so the script
reads them by header name) and the distribution of preferences
(dop-<year>, CountNumber-0 rows = first preferences). Deriving from them:
  PER BUCKET, exact where possible: the state's TPP flow table gives each
    bucket's ALP v Coalition split over ALL the state's seats; subtracting
    the classic seats' TCP flows (above) leaves the bucket's flow over
    that state's NON-classic seats. Where those seats share one class the
    leftover lands exactly in it; where they span classes it is allocated
    over the seats' bucket first-preference shares and flagged est (the
    chart draws those points as estimated). A state-year with no
    non-classic seat at all contributes nothing – that class-year's
    all-seats figure is its classic one, exactly.
  LUMPED minors = the three buckets summed (they partition the non-major
    ballot space, so the lump inherits the buckets' exactness and est
    flags). A TPP-pair-minus-first-preferences lump per division is NOT
    used: in seats fought by two Coalition candidates ("three-cornered"),
    the losing Coalition candidate's ballots that end with Labor (Barker
    2004's NP→ALP 1,890; the 1,570 Coalition-to-ALP ballots inside NSW
    2004's non-classic pair Calare/New England) ride that difference,
    and those are not minor-party ballots. The state table's major-source
    rows name the drift per state, so a state-level consistency guard
    holds the products to each other (to the vote): over each state's
    non-classic seats, TPP-minus-first-preferences per side must equal
    the bucket leftovers adjusted by that drift. The tppdiv product's
    parse (column order read per year) stays pinned by the Grayndler
    2022 oracle (74,571 ALP v 20,002 Coalition) in the test.

Buckets and nulls mirror fed-state-flows.py: grn (every Greens party), onp
(One Nation: HAN in 1998–2001, ON from 2004; the party stood federally for
the first time in 1998, so 1996 carries no One Nation ballots at all),
oth (every other non-major ballot, independents included). A class-year a
bucket has ZERO counted ballots behind it (One Nation stood in hardly any
inner-metropolitan seats in 2010–2013, say) is null, matching the national
and per-state series' gaps – counted figures are shown for every base that
exists, as the per-state series does; the printed ballots table beside each
column says how wide the base is (eyeball small numbers as such).

THE SEIFA-FIFTHS LANES (2026-10-24, user: add the ABS socio-economic
cuts beside the AEC classifications in the explainer menu views;
approved decisions: quintile bands, all three measures – this is the
flows measure; IEO joined IRSAD the same day on "do what you did for
irsad to ieo", and IER later on "do the same for IER: 'Federal, by IER
quintile'"; the interpolated percentile became the IRSAD lane's default
ranking basis on "add an interpolated percentile observation - and can
this be the data that's used by default, and used in the flow chart?"):
the same two counted products regrouped by the fifth of seats each
election's ABS SEIFA standing places a division in, one lane per index –
seifa_quintiles.membership(y, ix) ranks IRSAD on the store's census-
interpolated percentile where it ships one (the _pcti factor years
2013/2016/2019) and on each index's recorded advantage-ordered rank
otherwise (the census-filed `rank`; IEO's and IER's print-order ranks
reflected, 1 = most advantaged), thirty seats a fifth, the 151-seat
2019/2022 chambers giving the spare seat to the most-disadvantaged
fifth. The quintiles sit in the
store's `seifa` block beside `classes`, in the same shapes
(classes/allSeats over years 2001–2025 – the seifa store's floor), and
gen-data merges them into the flowHistory classes bank after the four
classification views, where every chart and menu reads them untouched
(the fedClass machinery – classic rings before 2004, est diamonds – is
shared at gen-data emit; only the captions fork on the record's seifa
marker; each record carries its index as ix so the menu splits the
three optgroups and the captions name the right index). The grouping
functions parse()/allseats_for_year() take a label set as of the same
change, so the lanes run the byte-identical derivation, never a clone.

Writes data/fed-class-flows.json:
{ "source": …, "years": […], "classes": { "inner": { "label", "short",
  "grn", "onp", "oth", "votes" }, … }, "allSeats": { "inner": { "grn",
  "onp", "oth", "lump", "votes", "lumpVotes", "est" }, … },
  "seifa": { "years": […], "classes": { "q1": { "label", "short", "desc",
  "ix", "grn", "onp", "oth", "votes" }, … }, "allSeats": { "q1": { …same
  minus the copy… } }, }, "classicSeats": […], "divisions": […] }
Shares are per cent to 0.1; votes are each bucket's [to-ALP, to-Coalition]
ballot counts (the test re-combines the four classes into the same files'
national totals; gen-data emits the shares alone). The allSeats block is
null-free from 2004; its 1996–2001 per-bucket cells are null and its lump
cells sum the classic buckets (no all-seats product exists for those
years). Key order is the chart's: inner, outer, provincial, rural. The
seifa block's classes/allSeats mirror those two shapes exactly, keyed
q1..q5 (IRSAD) then e1..e5 (IEO) then r1..r5 (IER) – ix tags each
record's index – years 2001–2025.

Pinned by .build/test-fed-class-flows.mjs.
"""
import collections, csv, gzip, json, os

from seifa_quintiles import INDEX_META, QIDXES, SEIFA_META, SEIFA_YEARS, membership as seifa_membership

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "aec-flow-src")
ROOT = os.path.dirname(HERE)

YEARS = (1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025)
# record key -> (display label, menu short face); the AEC's own
# classifications, in the chart's order
CLASSES = {
    "Inner Metropolitan": ("Inner metropolitan", "inner metro"),
    "Outer Metropolitan": ("Outer metropolitan", "outer metro"),
    "Provincial": ("Provincial", "provincial"),
    "Rural": ("Rural", "rural"),
}
CLASS_IDS = {"Inner Metropolitan": "inner", "Outer Metropolitan": "outer",
             "Provincial": "provincial", "Rural": "rural"}
# CLR: Country Labor, Labor's banner in rural NSW seats 2001–2013 – the
# 2001 flow files name nine classic seats' finalist CLR, and leaving it
# out drops those nine (classic-2001.json's 136 to the full 145; see
# aec-tcp-history.py's header)
LABOR = {"ALP", "CLR"}
# the full Coalition spelling space of the TCP files, checked against all
# eleven elections' from- and to-party codes: 2010 alone writes Queensland's
# LNP as LNQ (29 divisions read non-classic without it)
COAL = {"LP", "NP", "CLP", "LNP", "LNQ", "NAT", "LIB"}
GREENS = {"GRN", "GWA", "GVIC", "AGV", "TG"}
ONP = {"HAN", "ON"}
BUCKETS = ("grn", "onp", "oth")


def bucket(code):
    if code in GREENS: return "grn"
    if code in ONP: return "onp"
    return "oth"


def tcp_file(year):
    if year == 2025:
        return os.path.join(ROOT, "data", "aec-2025-tcp-flow-by-division.csv")
    p = os.path.join(SRC, f"tcpflow-{year}.csv.gz")
    if not os.path.exists(p):
        raise FileNotFoundError(f"no tcp-flow cache for {year} in {SRC}")
    return p


def rows_of(path):
    raw = gzip.open(path, "rb").read() if path.endswith(".gz") else open(path, "rb").read()
    txt = raw.decode("utf-8-sig")
    lines = iter(txt.splitlines())
    next(lines)  # banner
    return csv.DictReader(lines)


def tcp_classic_flows(year):
    """2004+: the TCP flow by division reduced to classic seats only –
    ( {division: {bucket: [to_alp, to_coalition]}},
      total divisions,
      {division: Coalition→ALP ballots} )
    The third return names each classic seat's three-cornered drift: in a
    seat fought by both Coalition parties the excluded Coalition
    candidate's ballots can land with Labor (Barker 2004's 1,890 NP→ALP) –
    majors transferring to majors is not a flow, but the count is the
    state-level guard's classic-seat drift term. parse() groups the flows
    by class below, and the all-seats column subtracts the classic seats
    from the state-level flow tables."""
    divs = collections.defaultdict(list)
    for r in rows_of(tcp_file(year)):
        divs[r["DivisionNm"]].append(r)
    out, cross = {}, {}
    for name, rows in divs.items():
        dest = {r["ToCandidatePartyAb"].strip() for r in rows}
        if not (dest & LABOR) or not dest <= (LABOR | COAL):
            continue  # non-classic: a crossbencher reached the final two
        b = collections.defaultdict(lambda: [0.0, 0.0])
        drift = 0.0
        for r in rows:
            if r["FromCandidateID"] == "0":
                continue  # the First Preferences pseudo-row names the final two
            frm = r["FromCandidatePartyAb"].strip()
            to = r["ToCandidatePartyAb"].strip()
            if frm in LABOR:
                if to in COAL:
                    raise SystemExit(f"{year}: Labor ballots to the Coalition inside "
                                     f"classic seat {name!r} – layout surprise")
                continue  # two Labor-bannered finalists, same pile
            if frm in COAL:
                if to in LABOR:
                    drift += float(r["TransferCount"])
                continue  # Coalition→Coalition shuffles stay in-pile
            b[bucket(frm)][0 if to in LABOR else 1] += float(r["TransferCount"])
        out[name] = b
        if drift:
            cross[name] = drift
    return out, len(divs), cross


def parse(year, class_of, labels=CLASSES):
    """Per-class bucket ballots: {class: {bucket: [to_alp, to_coalition]}}
    for the year's classic divisions; also (classic, total) division counts.
    labels is the grouping's label set – the AEC four classes by default;
    main()'s SEIFA-fifth lanes pass their index's quintile keys instead."""
    per = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
    classic = 0
    if year <= 2001:
        # the statistics-pack flow tables: {div: {"pair": [a, b],
        # "from": [[party, to-a, to-b], …]}}; transfer pairs resolve in
        # pair order, and majors transferring to majors is not a "flow"
        with gzip.open(os.path.join(SRC, f"tcp-{year}.json.gz"), "rb") as f:
            table = json.load(f)
        for name, d in table.items():
            pair = d["pair"]
            if not any(p in LABOR for p in pair) or not any(p in COAL for p in pair):
                continue  # non-classic: no Labor v Coalition final two
            cls = class_of.get(name)
            if cls is None:
                raise SystemExit(f"{year}: division {name!r} matches no classification row")
            if cls not in labels:
                raise SystemExit(f"{year}: {name!r} group {cls!r} is not one of the grouping labels")
            classic += 1
            ai = 0 if pair[0] in LABOR else 1
            for party, n1, n2 in d["from"]:
                if party in LABOR or party in COAL:
                    continue
                per[cls][bucket(party)][ai] += n1
                per[cls][bucket(party)][1 - ai] += n2
        return per, classic, len(table)
    flows, total, _ = tcp_classic_flows(year)
    for name, b in flows.items():
        cls = class_of.get(name)
        if cls is None:
            raise SystemExit(f"{year}: division {name!r} matches no classification row")
        if cls not in labels:
            raise SystemExit(f"{year}: {name!r} group {cls!r} is not one of the grouping labels")
        classic += 1
        for bk in BUCKETS:
            a, l = b.get(bk, (0.0, 0.0))
            per[cls][bk][0] += a
            per[cls][bk][1] += l
    return per, classic, total


ALLSEAT_FROM = 2004  # first election publishing the whole-chamber products


def tppdiv_totals(year):
    """{division: (toCoalition, toLabor)} for every seat of the chamber –
    the whole-chamber ALP v Coalition count, non-classic seats included.
    The vote-column order flips by year (2025 puts Labor first), so the
    columns are found by name, never assumed."""
    path = os.path.join(SRC, f"tppdiv-{year}.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(f"no tpp-by-division cache for {year} in {SRC}")
    out = {}
    coal_k = alp_k = None
    for r in rows_of(path):
        name = r.get("DivisionNm", "").strip()
        if not name or name == "Total":
            continue
        if coal_k is None:
            coal_k = next(k for k in r if "coalition votes" in k.lower())
            alp_k = next(k for k in r if "labor party votes" in k.lower())
        out[name] = (float(r[coal_k]), float(r[alp_k]))
    return out


def first_prefs_by_div(year):
    """{division: {"alp": n, "coal": n, "grn": n, "onp": n, "oth": n}} –
    the CountNumber-0 (first-preference) preference-count rows of the
    distribution of preferences by division."""
    path = os.path.join(SRC, f"dop-{year}.csv.gz")
    if not os.path.exists(path):
        raise FileNotFoundError(f"no distribution-of-preferences cache for {year} in {SRC}")
    per = collections.defaultdict(lambda: collections.defaultdict(float))
    for r in rows_of(path):
        t = r["CalculationType"].strip().lower()
        if r["CountNumber"].strip() != "0" or "preference" not in t or "count" not in t:
            continue  # the Preference Count rows – never the Percent pair
        p = r["PartyAb"].strip()
        key = "alp" if p in LABOR else "coal" if p in COAL else bucket(p)
        per[r["DivisionNm"].strip()][key] += float(r["CalculationValue"])
    return per


def state_bucket_flows(year):
    """Of the TPP flow BY STATE BY PARTY (the whole-chamber count, every
    seat redistributed ALP v Coalition):
    ( {stateAb: {bucket: [to_alp, to_coalition]}},
      {stateAb: Coalition→ALP ballots} )
    The second return is the state's three-cornered drift, summed off the
    table's Coalition-source rows (NSW 2004's LP 672 + NP 898): in seats
    fought by both Coalition parties, the excluded Coalition candidate's
    ballots can land with Labor. Those are not minor-party flows, but the
    per-division TPP-minus-first-preferences arithmetic carries them, so
    the state-level consistency guard applies them. Labor-source rows are
    never legitimate here (Labor is a finalist in every seat's TPP cut),
    so one is a layout surprise. Mirrors aec-flow-history.py's parse_tpp
    (column order varies by year – read the header) but keeps the states
    apart."""
    for ext in ("txt", "csv"):
        path = os.path.join(SRC, f"tpp-{year}.{ext}")
        if os.path.exists(path):
            break
    else:
        raise FileNotFoundError(f"no tpp-flow cache for {year} in {SRC}")
    with open(path, encoding="utf-8-sig") as f:
        next(f)
        rdr = csv.reader(f, delimiter="," if path.endswith(".csv") else "\t")
        head = next(rdr)
        alp_first = "labor" in head[3].lower()
        per = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
        drift = collections.defaultdict(float)
        for c in rdr:
            if len(c) < 7:
                continue
            code = c[1].strip()
            if not code:                 # each state's First Preferences aggregate row
                continue
            a, l = (float(c[3]), float(c[5])) if alp_first else (float(c[5]), float(c[3]))
            st = c[0].strip()
            if code in LABOR:
                raise SystemExit(f"{year}: state flow table carries a Labor-source row "
                                 f"({st} {code}) – layout surprise")
            if code in COAL:             # three-cornered drift, same-pile to Coalition
                drift[st] += a
                continue
            per[st][bucket(code)][0] += a
            per[st][bucket(code)][1] += l
    return per, drift


def allseats_for_year(year, class_of, labels=CLASSES):
    """The year's all-seats class figures, 2004 on:
    {class: {"votes": {bucket: [toALP,toCOAL]|None}, "lump": [toALP,toCOAL],
             "est": {bucket}} – the per-bucket split over every seat,
    exact where a state's non-classic seats share a class and allocated
    over bucket first preferences (flagged est) where they span them; the
    lump is the buckets summed. Breaching a product-consistency guard
    exits the run – a wall of data is better than a quiet wrong figure.
    labels is the grouping's label set (see parse())."""
    classic_flows, _, cross = tcp_classic_flows(year)
    fp = first_prefs_by_div(year)
    tpp = tppdiv_totals(year)
    sf, drift = state_bucket_flows(year)
    for name in tpp:
        rec = class_of.get(name)
        if rec is None:
            raise SystemExit(f"{year}: division {name!r} matches no classification row")
        if rec["classification"] not in labels:
            raise SystemExit(f"{year}: {name!r} group {rec['classification']!r} is not one of the grouping labels")
    # per-division TPP pair minus the majors' first preferences – a
    # drift-loaded cross-check figure (it carries Coalition→ALP
    # three-cornered ballots), so it feeds only the consistency guard,
    # never the published lumps. The ALP side of it can only ever gain
    # ballots; the Coalition side can lose up to the seat's drift.
    minor = {}
    for name, (toc, toa) in tpp.items():
        p = fp.get(name)
        if p is None:
            raise SystemExit(f"{year}: {name!r} has no first-preferences row")
        m = [toa - p["alp"], toc - p["coal"]]
        if m[0] < -0.5 or m[1] < -0.5 - drift.get(class_of[name]["state"], 0.0):
            raise SystemExit(f"{year}: {name!r} minor flow went negative: {m}")
        minor[name] = m
    # each state's non-classic leftover per bucket: state table minus the
    # state's classic seats (a state can lack a bucket row entirely – One
    # Nation stood nowhere in the ACT, say – and that bucket is a zero)
    leftover = {st: {bk: list(m.get(bk, (0.0, 0.0))) for bk in BUCKETS}
                for st, m in sf.items()}
    for name, b in classic_flows.items():
        st = class_of[name]["state"]
        for bk in BUCKETS:
            a, l = b.get(bk, (0.0, 0.0))
            leftover[st][bk][0] -= a
            leftover[st][bk][1] -= l
    for st, m in leftover.items():
        for bk in BUCKETS:
            if min(m[bk]) < -0.75:
                raise SystemExit(f"{year}: {st} {bk} non-classic leftover negative: {m[bk]}")
    # non-classic divisions by state and class; the leftovers and the
    # per-division cross-check figures must tell the same story once the
    # three-cornered drift is put back: the state table names each state's
    # Coalition→ALP drift total and the classic seats' TCP files name the
    # classic seats' share of it, so the difference is the drift inside
    # the state's non-classic seats (NSW 2004: 1,570 across Calare and
    # New England, neither of whose actual TCP count has an ALP pile)
    nc = collections.defaultdict(lambda: collections.defaultdict(list))
    cross_by_state = collections.defaultdict(float)
    for name, b in classic_flows.items():
        cross_by_state[class_of[name]["state"]] += cross.get(name, 0.0)
    for name in tpp:
        if name in classic_flows:
            continue
        rec = class_of[name]
        nc[rec["state"]][rec["classification"]].append(name)
    for st, bycls in nc.items():
        divs = [d for ds in bycls.values() for d in ds]
        nc_drift = drift.get(st, 0.0) - cross_by_state[st]
        lv = [sum(leftover[st][bk][i] for bk in BUCKETS) for i in (0, 1)]
        mn = [sum(minor[d][i] for d in divs) for i in (0, 1)]
        if abs(lv[0] + nc_drift - mn[0]) > 1.0:
            raise SystemExit(f"{year}: {st} non-classic leftover {lv[0]:.0f} + drift "
                             f"{nc_drift:.0f} != per-division minors {mn[0]:.0f} (side 0)")
        if abs(lv[1] - nc_drift - mn[1]) > 1.0:
            raise SystemExit(f"{year}: {st} non-classic leftover {lv[1]:.0f} - drift "
                             f"{nc_drift:.0f} != per-division minors {mn[1]:.0f} (side 1)")
    # assign the leftovers to classes – exactly for single-class states,
    # over bucket first preferences otherwise
    acc = {cls: collections.defaultdict(lambda: [0.0, 0.0]) for cls in labels}
    est = {cls: set() for cls in labels}
    for st, bycls in nc.items():
        if len(bycls) == 1:
            cls = next(iter(bycls))
            for bk in BUCKETS:
                acc[cls][bk][0] += leftover[st][bk][0]
                acc[cls][bk][1] += leftover[st][bk][1]
        else:
            for bk in BUCKETS:
                w = {cls: sum(fp[d][bk] for d in ds) for cls, ds in bycls.items()}
                tot = sum(w.values())
                la, ll = leftover[st][bk]
                if la + ll <= 0.5:
                    continue  # nothing of the bucket flowed outside classic seats
                if tot <= 0:
                    raise SystemExit(f"{year}: {st} {bk} leftover {la:.0f}+{ll:.0f} "
                                     f"with no first-preference base")
                for cls, wv in w.items():
                    if wv <= 0:
                        continue
                    acc[cls][bk][0] += la * wv / tot
                    acc[cls][bk][1] += ll * wv / tot
                    est[cls].add(bk)
    # classic + assigned = all seats; the lump is the buckets summed (they
    # partition the non-major ballot space)
    classic_sums = {cls: collections.defaultdict(lambda: [0.0, 0.0]) for cls in labels}
    for name, b in classic_flows.items():
        cls = class_of[name]["classification"]
        for bk in BUCKETS:
            a, l = b.get(bk, (0.0, 0.0))
            classic_sums[cls][bk][0] += a
            classic_sums[cls][bk][1] += l
    out = {}
    for cls in labels:
        lump = [0.0, 0.0]
        vote = {}
        for bk in BUCKETS:
            a = classic_sums[cls][bk][0] + acc[cls][bk][0]
            l = classic_sums[cls][bk][1] + acc[cls][bk][1]
            vote[bk] = [a, l] if a + l else None
            lump[0] += a
            lump[1] += l
        out[cls] = {"votes": vote, "lump": lump, "est": est[cls]}
    return out


def main():
    with open(os.path.join(ROOT, "data", "division-classifications.json"), encoding="utf-8") as f:
        classif = json.load(f)["elections"]
    classes = {cls: {"label": lbl, "short": short} for cls, (lbl, short) in CLASSES.items()}
    for c in classes.values():
        for b in BUCKETS: c[b] = []
        c["votes"] = {b: [] for b in BUCKETS}
    allseats = {cls: {"lump": [], "lumpVotes": [],
                      **{b: {"share": [], "votes": [], "est": []} for b in BUCKETS}}
                for cls in CLASSES}
    n_classic, n_divs = [], []
    ballots = {cls: collections.defaultdict(list) for cls in CLASSES}
    for y in YEARS:
        class_of = {n: r["classification"] for n, r in classif[str(y)].items()}
        per, classic, total = parse(y, class_of)
        n_classic.append(classic); n_divs.append(total)
        cells = allseats_for_year(y, classif[str(y)]) if y >= ALLSEAT_FROM else None
        for cls in CLASSES:
            got = per.get(cls, {})
            for b in BUCKETS:
                a, l = got.get(b, (0.0, 0.0))
                classes[cls][b].append(round(100 * a / (a + l), 1) if a + l else None)
                classes[cls]["votes"][b].append([round(a), round(l)] if a + l else None)
                ballots[cls][b].append(round(a + l))
            if cells is not None:
                lump = cells[cls]["lump"]
                for b in BUCKETS:
                    v = cells[cls]["votes"][b]
                    allseats[cls][b]["share"].append(round(100 * v[0] / (v[0] + v[1]), 1) if v else None)
                    allseats[cls][b]["votes"].append([round(v[0]), round(v[1])] if v else None)
                    allseats[cls][b]["est"].append(b in cells[cls]["est"])
            else:
                lump = [sum(got.get(b, (0.0, 0.0))[0] for b in BUCKETS),
                        sum(got.get(b, (0.0, 0.0))[1] for b in BUCKETS)]  # classic lumps
                for b in BUCKETS:
                    allseats[cls][b]["share"].append(None)
                    allseats[cls][b]["votes"].append(None)
                    allseats[cls][b]["est"].append(False)
            allseats[cls]["lump"].append(round(100 * lump[0] / (lump[0] + lump[1]), 1)
                                         if lump[0] + lump[1] else None)
            allseats[cls]["lumpVotes"].append([round(lump[0]),
                                               round(lump[1])] if lump[0] + lump[1] else None)
    # the SEIFA-fifths lanes: the same two derivations with each index's
    # quintile membership as the grouping, one pass per index per year;
    # SEIFA_KEYS (both indexes' quintile keys) as labels arms parse()'s
    # and allseats_for_year()'s group checks
    SEIFA_KEYS = {m[0]: None for m in SEIFA_META}
    quint = {m[0]: {"label": m[1], "short": m[2], "desc": m[3], "ix": m[4],
                    **{b: [] for b in BUCKETS}, "votes": {b: [] for b in BUCKETS}}
             for m in SEIFA_META}
    quint_all = {m[0]: {"lump": [], "lumpVotes": [],
                        **{b: {"share": [], "votes": [], "est": []} for b in BUCKETS}}
                 for m in SEIFA_META}
    q_ballots = {m[0]: collections.defaultdict(list) for m in SEIFA_META}
    for y in SEIFA_YEARS:
        for ix in QIDXES:
            mem = seifa_membership(y, ix)
            class_of = {n: r["classification"] for n, r in mem.items()}
            per, _, _ = parse(y, class_of, labels=SEIFA_KEYS)
            cells = allseats_for_year(y, mem, labels=SEIFA_KEYS) if y >= ALLSEAT_FROM else None
            for q in (m[0] for m in INDEX_META[ix]["meta"]):
                got = per.get(q, {})
                for b in BUCKETS:
                    a, l = got.get(b, (0.0, 0.0))
                    quint[q][b].append(round(100 * a / (a + l), 1) if a + l else None)
                    quint[q]["votes"][b].append([round(a), round(l)] if a + l else None)
                    q_ballots[q][b].append(round(a + l))
                if cells is not None:
                    lump = cells[q]["lump"]
                    for b in BUCKETS:
                        v = cells[q]["votes"][b]
                        quint_all[q][b]["share"].append(round(100 * v[0] / (v[0] + v[1]), 1) if v else None)
                        quint_all[q][b]["votes"].append([round(v[0]), round(v[1])] if v else None)
                        quint_all[q][b]["est"].append(b in cells[q]["est"])
                else:
                    lump = [sum(got.get(b, (0.0, 0.0))[0] for b in BUCKETS),
                            sum(got.get(b, (0.0, 0.0))[1] for b in BUCKETS)]  # classic lumps
                    for b in BUCKETS:
                        quint_all[q][b]["share"].append(None)
                        quint_all[q][b]["votes"].append(None)
                        quint_all[q][b]["est"].append(False)
                quint_all[q]["lump"].append(round(100 * lump[0] / (lump[0] + lump[1]), 1)
                                            if lump[0] + lump[1] else None)
                quint_all[q]["lumpVotes"].append([round(lump[0]),
                                                  round(lump[1])] if lump[0] + lump[1] else None)
    out = {"source": "AEC two-candidate-preferred flow of preferences by division, 1996–2025, "
                     "grouped by the AEC's own per-election division classifications (classic seats); "
                     "allSeats block counted from the TPP-by-division, first-preference and "
                     "TPP-flow-by-state products, 2004–2025 (est cells allocated over first prefs)",
           "years": list(YEARS),
           "classes": {CLASS_IDS[cls]: classes[cls] for cls in CLASSES},
           "allSeats": {CLASS_IDS[cls]: {
               "grn": allseats[cls]["grn"]["share"], "onp": allseats[cls]["onp"]["share"],
               "oth": allseats[cls]["oth"]["share"], "lump": allseats[cls]["lump"],
               "votes": {b: allseats[cls][b]["votes"] for b in BUCKETS},
               "lumpVotes": allseats[cls]["lumpVotes"],
               "est": {b: allseats[cls][b]["est"] for b in BUCKETS}}
               for cls in CLASSES},
           "seifa": {"years": list(SEIFA_YEARS),
                     "classes": {m[0]: quint[m[0]] for m in SEIFA_META},
                     "allSeats": {m[0]: {
                         "grn": quint_all[m[0]]["grn"]["share"], "onp": quint_all[m[0]]["onp"]["share"],
                         "oth": quint_all[m[0]]["oth"]["share"], "lump": quint_all[m[0]]["lump"],
                         "votes": {b: quint_all[m[0]][b]["votes"] for b in BUCKETS},
                         "lumpVotes": quint_all[m[0]]["lumpVotes"],
                         "est": {b: quint_all[m[0]][b]["est"] for b in BUCKETS}}
                         for m in SEIFA_META}},
           "classicSeats": n_classic, "divisions": n_divs}
    dest = os.path.join(ROOT, "data", "fed-class-flows.json")
    with open(dest, "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print(f"{'class':<20}", "  ".join(str(y) for y in YEARS), "  (share to ALP, %)")
    for cls in CLASSES:
        c = classes[cls]
        for b in BUCKETS:
            cells = "  ".join("   –   " if v is None else f"{v:5.1f}" for v in c[b])
            print(f"{CLASSES[cls][0] + ' ' + b:<20} {cells}   ballots: "
                  + ",".join(str(n) for n in ballots[cls][b]))
    print("classic divisions of total per year:", dict(zip(YEARS, zip(n_classic, n_divs))))
    print("all-seats, 2004 on (share to ALP, %; lump = every non-major ballot):")
    for cls in CLASSES:
        row = "  ".join("   –   " if v is None else (f"{v:5.1f}" if y < ALLSEAT_FROM else f"{v:5.1f}")
                        for y, v in zip(YEARS, allseats[cls]["lump"]))
        print(f"  {CLASSES[cls][0] + ' lump':<20} {row}")
        for b in BUCKETS:
            row = "  ".join("   –   " if v is None else f"{v:5.1f}" for v in allseats[cls][b]["share"])
            est = "".join("*" if e else " " for e in allseats[cls][b]["est"])
            print(f"  {CLASSES[cls][0] + ' ' + b:<20} {row}   est: {est}")
    for ix in QIDXES:
        print(f"\n{ix.upper()} fifths, classic seats (share to ALP, %):")
        for q, lbl, _, _, x in SEIFA_META:
            if x != ix:
                continue
            c = quint[q]
            for b in BUCKETS:
                cells = "  ".join("   –   " if v is None else f"{v:5.1f}" for v in c[b])
                print(f"{lbl + ' ' + b:<34} {cells}   ballots: "
                      + ",".join(str(n) for n in q_ballots[q][b]))
    print("SEIFA fifths, all-seats 2004 on (share to ALP, %):")
    for q, lbl, _, _, ix in SEIFA_META:
        row = "  ".join("   –   " if v is None else f"{v:5.1f}" for v in quint_all[q]["lump"])
        print(f"  {ix.upper() + ' ' + lbl + ' lump':<38} {row}")
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
