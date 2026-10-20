"""fed-state-flows.py – per state/territory federal preference flows, 2004–2025.

The explainer's per-state companion of the national FLOW_HISTORY series
(flows.mjs): within each state, the share of each voter bucket's ballots the
AEC counted to Labor over the Coalition at each federal election. Same AEC
product FLOW_LEF sums nationally – the two-party-preferred flow of
preferences by state by party (HouseTppFlowByStateByPartyDownload-<event>),
cached as .build/aec-flow-src/tpp-<year>.{txt,csv}, all committed. Column
ORDER varies by year (Coalition first in 2004, 2007, 2016–2022) – read from
the header, never assumed. 1996–2001 exist only as the national classic cut
(aec-flow-history.py), so no earlier per-state series can be drawn.

Writes data/fed-state-flows.json:
{ "source": …, "years": […], "states": { "nsw": { "label", "grn", "onp",
  "oth", "votes" }, … } }
Shares are per cent to 0.1; votes are each bucket's [to-ALP, to-Coalition]
ballot counts (the test re-combines them into the national FLOW_HISTORY;
gen-data emits the shares alone). A bucket a state never counted that year –
One Nation sat most states out to 2016 – is null, matching the national
series' gaps.

Pinned by .build/test-fed-state-flows.mjs.
"""
import collections, csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "aec-flow-src")
ROOT = os.path.dirname(HERE)

YEARS = (2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025)
STATES = (  # AEC order; short is the chip face on the page
    ("NSW", "New South Wales", "NSW"), ("VIC", "Victoria", "Vic"),
    ("QLD", "Queensland", "Qld"), ("WA", "Western Australia", "WA"),
    ("SA", "South Australia", "SA"), ("TAS", "Tasmania", "Tas"),
    ("ACT", "Australian Capital Territory", "ACT"),
    ("NT", "Northern Territory", "NT"),
)
MAJ = {"ALP", "LP", "NP", "CLP", "LNP", "NAT", "LIB"}
GREENS = {"GRN", "GWA", "AGV", "TG"}
ONP = {"HAN", "ON"}

BUCKETS = ("grn", "onp", "oth")


def bucket(code):
    if code in GREENS: return "grn"
    if code in ONP: return "onp"
    return "oth"


def tpp_file(year):
    for ext in ("txt", "csv"):
        p = os.path.join(SRC, f"tpp-{year}.{ext}")
        if os.path.exists(p): return p
    raise FileNotFoundError(f"no tpp cache for {year} in {SRC}")


def parse(year):
    """Per-state bucket ballots: {state: {bucket: [to_alp, to_coalition]}}."""
    path = tpp_file(year)
    delim = "," if path.endswith(".csv") else "\t"
    with open(path, encoding="utf-8-sig") as f:
        next(f)  # banner
        rdr = csv.reader(f, delimiter=delim)
        head = next(rdr)
        # which column pair is Labor's: read it, never assume it
        alp_first = "labor" in head[3].lower()
        out = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
        for c in rdr:
            if len(c) < 7: continue
            code = c[1].strip()
            if not code or code in MAJ: continue  # the state's 2PP row / majors
            a, l = (float(c[3]), float(c[5])) if alp_first else (float(c[5]), float(c[3]))
            b = out[c[0].strip()][bucket(code)]
            b[0] += a; b[1] += l
    return out


def main():
    states = {ab.lower(): {"label": lbl, "short": short} for ab, lbl, short in STATES}
    for st in states.values():
        for b in BUCKETS: st[b] = []
        st["votes"] = {b: [] for b in BUCKETS}
    nat = {b: [0.0, 0.0] for b in BUCKETS}
    for y in YEARS:
        per = parse(y)
        for ab, _lbl, _short in STATES:
            got = per.get(ab, {})
            st = states[ab.lower()]
            for b in BUCKETS:
                a, l = got.get(b, (0.0, 0.0))
                st[b].append(round(100 * a / (a + l), 1) if a + l else None)
                st["votes"][b].append([round(a), round(l)] if a + l else None)
    # recombine to the national series, for the printed check and the test
    for b in BUCKETS:
        nat[b] = [sum(v[0] for st in states.values() for v in st["votes"][b] if v),
                  sum(v[1] for st in states.values() for v in st["votes"][b] if v)]
    out = {"source": "AEC two-party-preferred flow of preferences by state by party, 2004–2025",
           "years": list(YEARS), "states": states}
    dest = os.path.join(ROOT, "data", "fed-state-flows.json")
    with open(dest, "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    for ab, lbl, _short in STATES:
        s = states[ab.lower()]
        row = "  ".join(f"{b} " + ",".join("–" if v is None else str(v) for v in s[b]) for b in BUCKETS)
        print(f"{lbl:<28} {row}")
    print("recombined national:", {b: round(100 * nat[b][0] / sum(nat[b]), 1) for b in BUCKETS})
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
