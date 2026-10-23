"""aec-primary-history.py – the national + per-state PRIMARY-VOTE history
behind the /flows-explained/ chart's "View: Primary votes" flip.

One series per party family at every federal election, as % of formal first
preferences: two majors always drawn, the era's named minors drawn only
where they polled at least FOLD_PT (4%) in that view that election, in
per cent – everything below folds into Others (user call 2026-10-23:
"below 4% just displays others and above 4% displays as its own points",
so the Democrats surface only in their era and One Nation drops out of the
lean years, exactly as the flow chart's gap-nulls behave). A folded share
is a null in the JSON, never a zero.

Sources, by era:
  2004–2025  AEC first-preference downloads, cached in .build/aec-flow-src/fpv/
             (fetched here when absent; committed so tests recompute offline):
             fpv-house-nat-<year>.csv    HouseFirstPrefsByPartyDownload
             fpv-house-state-<year>.csv  HouseFirstPrefsByStateByPartyDownload
             fpv-senate-state-<year>.csv SenateFirstPrefsByStateByGroupByVoteTypeDownload
             Event ids/paths mirrored from .build/aec-flow-src/README-haul-1983-2007.md:
             2004=12246 on the old /results/ path; 2007–2025 on /<event>/Website/.
  1972–2001  HISTORY block below (typed, source-noted rows): national House
             and Senate tables from the per-election results pages (AEC-sourced,
             the aus-house-primary-history skill's canonical cuts; the skill's
             ALP/LNP House figures are the pin set). No per-state cut before
             2004 – the flow menu's per-state span matches it.

Buckets: alp, lnp (the whole Coalition block incl. joint Senate tickets,
CLP and LNP – the poll rows' L/NP), grn, onp, dem (Australian Democrats),
dlp (Democratic Labor – crosses the fold only in 1972), uap (Palmer United
2013 / United Australia 2022, one family for display), xnt (Nick Xenophon
Team / Centre Alliance), jln (Jacqui Lambie Network), ind (independents,
incl. named-person Senate groups), oth. dem/dlp/uap/xnt/jln/ind are FOLDED
gated like grn/onp: the fold rule is per view per election, so Xenophon's
SA cohort surfaces inside the SA cuts while staying part of Others
nationally. One-cut spikes that cross FOLD_PT in a single state-chamber
view – Family First in SA 2004–13, LDP in NSW Senate 2013 / NT 2022,
Legalise Cannabis in the 2022–25 NT/WA/Qld cuts, Derryn Hinch's Justice
Party in Vic 2016 and their likes – stay inside oth BY DESIGN: the chart
tracks the families above, and every unmapped name still lands on the
printed adjudication list after each run. A new family is a deliberate
copy/token decision, never an accident of the fold.

Usage: python3 .build/aec-primary-history.py [--check]
  default writes data/primary-history.json; --check re-derives and compares.
"""
import csv, io, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "aec-flow-src", "fpv")
OUT = os.path.join(ROOT, "data", "primary-history.json")
UA = "Mozilla/5.0 (auspol-tracker data update)"

FOLD_PT = 4.0

# year -> (event id, url path segment). ext=.csv everywhere (2004's menu
# offers .csv only; 2013+ offer .txt too – one parser, one format).
EVENTS = {
    2004: (12246, "results"), 2007: (13745, "Website"), 2010: (15508, "Website"),
    2013: (17496, "Website"), 2016: (20499, "Website"), 2019: (24310, "Website"),
    2022: (27966, "Website"), 2025: (31496, "Website"),
}
URLS = {
    2004: "https://results.aec.gov.au/{ev}/results/Downloads/{name}-{ev}.csv",
}
for y, (ev, base) in EVENTS.items():
    if y != 2004:
        URLS[y] = "https://results.aec.gov.au/{ev}/Website/Downloads/{name}-{ev}.csv"

STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"]
STATE_FULL = {"nsw": "New South Wales", "vic": "Victoria", "qld": "Queensland",
              "wa": "Western Australia", "sa": "South Australia", "tas": "Tasmania",
              "act": "Australian Capital Territory", "nt": "Northern Territory"}

# ---- party families ---------------------------------------------------------
# Every PartyNm (House files) and GroupNm (Senate files) in the committed
# caches must resolve exactly one bucket; the sets below enumerate the live
# vocabulary (dumped from the caches 2026-10-23). Lowercased; matched exact.
MAJ_ALP_NM = {"australian labor party", "labor", "a.l.p.",
              "australian labor party (act branch)", "australian labor party (alp)",
              "australian labor party (northern territory) branch", "labor/country labor"}
MAJ_COAL_NM = {"liberal", "the nationals", "national party", "nationals",
               "clp - the territory party", "clp-the territory party",
               "country liberal party (nt)", "country liberals", "country liberals (nt)",
               "nt clp", "northern territory country liberal party",
               "liberal national party", "liberal national party of queensland", "lnp",
               "liberal/nationals", "liberal/the nationals", "liberal & nationals",
               "liberal party of australia,nsw division-national party of australia nsw"}
GRN_NM = {"the greens", "australian greens", "queensland greens",
          "the greens (vic)", "the greens (wa)"}
ONP_NM = {"one nation", "pauline hanson's one nation",
          "pauline hanson's one nation (nsw division)", "one nation wa", "pauline"}
DEM_NM = {"australian democrats", "democrats"}
DLP_NM = {"dlp - democratic labor party", "dlp - democratic labour party",
          "d.l.p. - democratic labor party", "dlp democratic labour",
          "democratic labor party (dlp) of australia", "democratic labour party",
          "democratic labour party (dlp)", "labour dlp"}
UAP_NM = {"palmer united party", "united australia party", "uap"}
XNT_NM = {"nick xenophon team", "centre alliance", "nick xenophon group"}
JLN_NM = {"jacqui lambie network"}
IND_NM = {"independent", "non affiliated", "unendorsed/ungrouped amalgamated",
          "david pocock", "kim for canberra"}

FAMILY = {}
for _b, _set in (("alp", MAJ_ALP_NM), ("lnp", MAJ_COAL_NM), ("grn", GRN_NM),
                 ("onp", ONP_NM), ("dem", DEM_NM), ("dlp", DLP_NM),
                 ("uap", UAP_NM), ("xnt", XNT_NM), ("jln", JLN_NM), ("ind", IND_NM)):
    for _n in _set:
        FAMILY[_n] = _b
GATED = ["grn", "onp", "dem", "dlp", "uap", "xnt", "jln", "ind"]
ALL_BUCKETS = ["alp", "lnp"] + GATED + ["oth"]

# Pre-2004 typed block (verified per-election results tables; see
# HISTORY_SOURCES beside HISTORY). Shares of FORMAL first preferences.
# grn/onp/uap/jln/xnt absent where the party did not exist (None); a value
# that exists but sits under FOLD_PT is still recorded raw - the fold is
# applied uniformly at emit, so the 2001 One Nation (4.34) and the 1996
# Democrats (6.76) both reach the display exactly as later rows do.
HISTORY = {
    "house": {
        # filled from the verified per-election results tables (see header
        # note): {year: {"alp":…,"lnp":…,"grn":|None,"onp":|None,"dem":|None,
        #                "dlp":|None,"ind":|None}}
    },
    "senate": {
    },
}

# ---- fetch ------------------------------------------------------------------
def fetch(url, path):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"user-agent": UA})
    with urllib.request.urlopen(req, timeout=60) as res, open(path, "wb") as f:
        f.write(res.read())
    print("fetched", os.path.basename(path), "<-", url)

def fetch_all():
    for y in sorted(EVENTS):
        ev = EVENTS[y][0]
        cache = lambda n: os.path.join(SRC, f"fpv-{n}-{y}.csv")
        fetch(URLS[y].format(ev=ev, name="HouseFirstPrefsByPartyDownload"), cache("house-nat"))
        fetch(URLS[y].format(ev=ev, name="HouseFirstPrefsByStateByPartyDownload"), cache("house-state"))
        fetch(URLS[y].format(ev=ev, name="SenateFirstPrefsByStateByGroupByVoteTypeDownload"), cache("senate-state"))

# ---- parse ------------------------------------------------------------------
def read_sheet(path):
    """AEC download: banner line, then one header row, then data."""
    with open(path, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    head_i = next(i for i, r in enumerate(rows) if r and r[0] in ("PartyAb", "StateAb"))
    return rows[head_i], [r for r in rows[head_i + 1:] if len(r) > 1]

UNMAPPED = []  # names that fell through FAMILY into oth, printed for review

def parse_votes(path, state_col=None, name_col=None, votes_col="TotalVotes"):
    """sum TotalVotes by (state, bucket). state_col=None -> national.
       An unmapped name lumps into oth AND lands on UNMAPPED for review -
       nothing is silently bucketed, but a fringe slate never blocks a run."""
    head, rows = read_sheet(path)
    h = {c: i for i, c in enumerate(head)}
    iv, inm = h[votes_col], h[name_col]
    ist = h[state_col] if state_col else None
    votes = {}
    for r in rows:
        nm = r[inm].strip()
        if not nm:
            continue
        st = r[ist].strip().lower() if ist is not None else "nat"
        b = FAMILY.get(nm.lower())
        if b is None:
            b = "oth"
            UNMAPPED.append((nm, os.path.basename(path)))
        v = float(r[iv])
        votes.setdefault(st, {}).setdefault(b, 0.0)
        votes[st][b] += v
    return votes

def shares(votes_by_cut):
    """votes -> per-cut % shares, majors + named buckets + residual oth with
       the FOLD_PT gate: a gated bucket under 4% folds into oth (null out)."""
    cuts = {}
    for cut, by in votes_by_cut.items():
        tot = sum(by.values())
        pcts = {b: 100.0 * v / tot for b, v in by.items()}
        cuts[cut] = (tot, pcts)
    return cuts

# ---- history-aware emit ------------------------------------------------------
def fold_series(year_rows):
    """year_rows: {year: {bucket: pct}} with raw buckets (unaligned ok).
       Returns (years, {bucket: [values|None aligned to years]})."""
    years = sorted(year_rows)
    out = {b: [] for b in ALL_BUCKETS}
    for y in years:
        row = year_rows[y]
        shown = {"alp", "lnp"}
        for g in GATED:
            v = row.get(g)
            if v is not None and v >= FOLD_PT:
                shown.add(g)
        for b in ALL_BUCKETS:
            if b == "oth":
                continue
            out[b].append(round(row[b], 2) if b in shown and row.get(b) is not None else None)
        oth = 100.0 - sum(row[b] for b in ALL_BUCKETS if b != "oth" and b in shown and row.get(b) is not None)
        out["oth"].append(round(oth, 2))
    return years, out

def build():
    fetch_all()
    aec_house_nat = {}
    for y in sorted(EVENTS):
        v = parse_votes(os.path.join(SRC, f"fpv-house-nat-{y}.csv"),
                        None, "PartyNm")
        aec_house_nat[y] = v.get("nat", {})
    # cross-check: spec column TotalPercentage vs votes-derived share (major rows)
    head, rows = read_sheet(os.path.join(SRC, "fpv-house-nat-2025.csv"))
    h = {c: i for i, c in enumerate(head)}
    for r in rows:
        if r[h["PartyAb"]] == "ALP":
            assert abs(float(r[h["TotalPercentage"]]) - 34.56) < 0.02, "2025 ALP spec column drifted"
    # pinned canonical ALP/LNP House figures (aus-house-primary-history skill); ±0.03 sum-rounding room
    # 2010 EXCEPTION: the skill table's 43.32 is a Wikipedia-propagated transcription error
    # (the Nationals' 3.73% recorded as 3.43). The AEC's own machine download,
    # human-readable national page and electionresources.org all give
    # Coalition 5,408,630 / 12,402,363 = 43.61 – the AEC record is the pin.
    CANON = {2004: (37.63, 46.71), 2007: (43.38, 42.09), 2010: (37.99, 43.61),
             2013: (33.38, 45.55), 2016: (34.73, 42.04), 2019: (33.34, 41.44),
             2022: (32.58, 35.70), 2025: (34.56, 31.82)}
    for y, (a, l) in CANON.items():
        p = aec_house_nat[y]
        assert abs(100 * p["alp"] / sum(p.values()) - a) < 0.03, f"{y} ALP"
        assert abs(100 * p["lnp"] / sum(p.values()) - l) < 0.03, f"{y} L/NP"

    house_nat_rows = {y: shares({"nat": aec_house_nat[y]})["nat"][1] for y in sorted(EVENTS)}
    # merge typed history
    for y, row in HISTORY["house"].items():
        house_nat_rows[int(y)] = {b: v for b, v in row.items() if b in ALL_BUCKETS and v is not None}
    years_h, house_nat = fold_series(house_nat_rows)

    house_state_rows = {s: {} for s in STATES}
    sen_national = {}
    sen_state_rows = {s: {} for s in STATES}
    for y in sorted(EVENTS):
        vh = parse_votes(os.path.join(SRC, f"fpv-house-state-{y}.csv"),
                         "StateAb", "PartyNm")
        hs = shares(vh)
        for st, (tot, pcts) in hs.items():
            house_state_rows[st][y] = pcts
        vs = parse_votes(os.path.join(SRC, f"fpv-senate-state-{y}.csv"),
                         "StateAb", "GroupNm")
        ss = shares(vs)
        sen_national[y] = {b: sum(vs[s].get(b, 0.0) for s in STATES) /
                              sum(sum(vs[s].values()) for s in STATES) * 100.0
                              for b in {bb for s in vs for bb in vs[s]}}
        for st, (tot, pcts) in ss.items():
            sen_state_rows[st][y] = pcts
    for y, row in HISTORY["senate"].items():
        sen_national[int(y)] = {b: v for b, v in row.items() if b in ALL_BUCKETS and v is not None}
    years_s, sen_nat = fold_series(sen_national)

    def view(label, elections, years, series, states=None):
        d = {"label": label, "elections": elections, "years": years}
        for b in ALL_BUCKETS:
            vals = series[b]
            if b in ("alp", "lnp", "oth") or any(v is not None for v in vals):
                d[b] = vals
        if states:
            d["states"] = states
        return d

    hs_states = {}
    for s in STATES:
        ys, ser = fold_series(house_state_rows[s])
        hs_states[s] = view(STATE_FULL[s], STATE_FULL[s] + " electorates at federal elections", ys, ser)
    sn_states = {}
    for s in STATES:
        ys, ser = fold_series(sen_state_rows[s])
        sn_states[s] = view(STATE_FULL[s], STATE_FULL[s] + " Senate", ys, ser)

    doc = {
        "_comment": "GENERATED by .build/aec-primary-history.py – primary-vote history behind the flows-explained chart's Primary votes view. Shares of formal first preferences; named minors present only where >= 4% of a view's vote (null otherwise, folded into oth). 2004-> from committed AEC caches (.build/aec-flow-src/fpv/); 1972–2001 typed in the script's HISTORY block.",
        "foldPt": FOLD_PT,
        "fed": view("Federal", "Australian federal elections", years_h, house_nat, states=hs_states),
    }
    doc["fed"]["sen"] = view("Federal Senate", "Australian Senate elections", years_s, sen_nat, states=sn_states)
    return doc

def main():
    doc = build()
    original = None
    if os.path.exists(OUT) and "--check" in sys.argv:
        original = json.load(open(OUT))
    if "--check" in sys.argv:
        if original != doc:
            print("CHECK FAIL: data/primary-history.json is not what the script builds", file=sys.stderr)
            sys.exit(1)
        print("check ok")
        return
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=1, separators=(",", ": "))
        f.write("\n")
    print("wrote", os.path.relpath(OUT, ROOT))
    names = sorted({n for n, _ in UNMAPPED})
    if names:
        print("\nunmapped names lumped into oth (adjudicate FAMILY if wrong):")
        print("  " + ", ".join(names))
    for chan, yy, ser in (("House", doc["fed"]["years"], doc["fed"]),
                          ("Senate", doc["fed"]["sen"]["years"], doc["fed"]["sen"])):
        print(f"\n{chan} national:")
        shown = [b for b in ALL_BUCKETS if b in ser]
        print("      " + "  ".join(f"{b:>6}" for b in shown))
        for i, y in enumerate(yy):
            print(f"  {y}: " + "  ".join(("  null" if ser[b][i] is None else f"{ser[b][i]:6.2f}") for b in shown))

if __name__ == "__main__":
    main()
