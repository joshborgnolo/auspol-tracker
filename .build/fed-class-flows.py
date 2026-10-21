"""fed-class-flows.py – federal preference flows by AEC division class, 2001–2025.

The explainer's inner-metro/outer-metro/provincial/rural companion of the
national FLOW_HISTORY series (flows.mjs) and of its per-state cut
(fed-state-flows.py): within each AEC demographic classification of a
division, the share of each voter bucket's ballots the AEC counted to Labor
over the Coalition at each federal election. Same counted family as the
national cut-flow series – but while the national and per-state tables come
from the per-state TPP/TCP downloads, no per-CLASS table is published, so
this groups the per-DIVISION product instead:
.build/aec-flow-src/tcpflow-<year>.csv.gz  (HouseTcpFlowByDivisionDownload
/ HouseTcpFlowOfPrefsByDivisionDownload, 2007–2022; 2007's hauled from
https://results.aec.gov.au/13745/Website/Downloads/HouseTcpFlowByDivisionDownload-13745.csv),
data/aec-2025-tcp-flow-by-division.csv for 2025 (its event's same
download, already committed for estimate-state-flows.py), and
.build/aec-flow-src/tcp-2001.json.gz for 2001 – the statistics-pack
"v3_10 … Two Candidate Preferred Preference Flow Result" per-division
tables, derived by aec-tcp-history.py from the AEC's official 2001
statistics CD-ROM (the same product, a file per division). 2001 is the
floor: no per-division flow table of either era reaches further, and 2004
published none (nor any per-division classification), so the chart steps
from 2001 to 2007. 2001's classifications come from the AEC's own
2001-epoch division-profile ratings (data/division-classifications.json's
"2001" block; three unrated seats filled from AEC Research Report 5).

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

Buckets and nulls mirror fed-state-flows.py: grn (every Greens party), onp
(One Nation: HAN in 2001, ON from 2007), oth (every other non-major
ballot, independents included). A class-year a bucket has ZERO counted
ballots behind it (One Nation stood in hardly any inner-metropolitan
seats in 2010–2013, say) is null, matching the national and per-state
series' gaps – counted figures are shown for every base that exists, as the
per-state series does; the printed ballots table beside each column says
how wide the base is (eyeball small numbers as such).

Writes data/fed-class-flows.json:
{ "source": …, "years": […], "classes": { "inner": { "label", "short",
  "grn", "onp", "oth", "votes" }, … }, "classicSeats": […], "divisions": […] }
Shares are per cent to 0.1; votes are each bucket's [to-ALP, to-Coalition]
ballot counts (the test re-combines the four classes into the same files'
national totals; gen-data emits the shares alone). Key order is the
chart's: inner, outer, provincial, rural.

Pinned by .build/test-fed-class-flows.mjs.
"""
import collections, csv, gzip, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "aec-flow-src")
ROOT = os.path.dirname(HERE)

YEARS = (2001, 2007, 2010, 2013, 2016, 2019, 2022, 2025)
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
# eight years' from- and to-party codes: 2010 alone writes Queensland's
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


def parse(year, class_of):
    """Per-class bucket ballots: {class: {bucket: [to_alp, to_coalition]}}
    for the year's classic divisions; also (classic, total) division counts."""
    per = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
    classic = 0
    if year == 2001:
        # the statistics-pack flow tables: {div: {"pair": [a, b],
        # "from": [[party, to-a, to-b], …]}}; transfer pairs resolve in
        # pair order, and majors transferring to majors is not a "flow"
        with gzip.open(os.path.join(SRC, "tcp-2001.json.gz"), "rb") as f:
            table = json.load(f)
        for name, d in table.items():
            pair = d["pair"]
            if not any(p in LABOR for p in pair) or not any(p in COAL for p in pair):
                continue  # non-classic: no Labor v Coalition final two
            cls = class_of.get(name)
            if cls is None:
                raise SystemExit(f"{year}: division {name!r} matches no classification row")
            if cls not in CLASSES:
                raise SystemExit(f"{year}: {name!r} class {cls!r} is not an AEC four-class label")
            classic += 1
            ai = 0 if pair[0] in LABOR else 1
            for party, n1, n2 in d["from"]:
                if party in LABOR or party in COAL:
                    continue
                per[cls][bucket(party)][ai] += n1
                per[cls][bucket(party)][1 - ai] += n2
        return per, classic, len(table)
    divs = collections.defaultdict(list)
    for r in rows_of(tcp_file(year)):
        divs[r["DivisionNm"]].append(r)
    for name, rows in divs.items():
        dest = {r["ToCandidatePartyAb"].strip() for r in rows}
        if not (dest & LABOR) or not dest <= (LABOR | COAL):
            continue  # non-classic: a crossbencher reached the final two
        cls = class_of.get(name)
        if cls is None:
            raise SystemExit(f"{year}: division {name!r} matches no classification row")
        if cls not in CLASSES:
            raise SystemExit(f"{year}: {name!r} class {cls!r} is not an AEC four-class label")
        classic += 1
        for r in rows:
            if r["FromCandidateID"] == "0":
                continue  # the First Preferences pseudo-row names the final two
            frm = r["FromCandidatePartyAb"].strip()
            if frm in LABOR or frm in COAL:
                continue  # majors transferring to majors is not a "flow"
            to = 0 if r["ToCandidatePartyAb"].strip() in LABOR else 1
            per[cls][bucket(frm)][to] += float(r["TransferCount"])
    return per, classic, len(divs)


def main():
    with open(os.path.join(ROOT, "data", "division-classifications.json"), encoding="utf-8") as f:
        classif = json.load(f)["elections"]
    classes = {cls: {"label": lbl, "short": short} for cls, (lbl, short) in CLASSES.items()}
    for c in classes.values():
        for b in BUCKETS: c[b] = []
        c["votes"] = {b: [] for b in BUCKETS}
    n_classic, n_divs = [], []
    ballots = {cls: collections.defaultdict(list) for cls in CLASSES}
    for y in YEARS:
        class_of = {n: r["classification"] for n, r in classif[str(y)].items()}
        per, classic, total = parse(y, class_of)
        n_classic.append(classic); n_divs.append(total)
        for cls in CLASSES:
            got = per.get(cls, {})
            for b in BUCKETS:
                a, l = got.get(b, (0.0, 0.0))
                classes[cls][b].append(round(100 * a / (a + l), 1) if a + l else None)
                classes[cls]["votes"][b].append([round(a), round(l)] if a + l else None)
                ballots[cls][b].append(round(a + l))
    out = {"source": "AEC two-candidate-preferred flow of preferences by division, 2001–2025, "
                     "grouped by the AEC's own per-election division classifications (classic seats)",
           "years": list(YEARS),
           "classes": {CLASS_IDS[cls]: classes[cls] for cls in CLASSES},
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
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
