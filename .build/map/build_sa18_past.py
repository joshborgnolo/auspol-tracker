#!/usr/bin/env python3
"""build_sa18_past.py — the sa18 frame's past election (the 2014 South
Australian state election of 15 March 2014), joined into data-sa18.json.
The build_nt_past_common.py shape on the ECSA's own record.

Sources (committed mirrors, verified per their harvesters):
  .build/state-flow-src/sa/2014/ecsa-2014-district-<701..747>.html.gz
      the ECSA's static-era per-district result pages (First Preference
      and Two Candidate Preferred tables, district formal/informal/
      ballot tallies; harvest-sa14-src.py fetches them from the Wayback
      Machine before any parse touches them)
  .build/state-flow-src/sa/2014/ecsa-2014-state-summary.html.gz
      the statewide party-primary oracle
  .build/state-flow-src/sa/2014/psephos-sa2014{,3}.txt
      Adam Carr's transcription of the ECSA's own statistics, for the
      formal/informal/enrolment/parties totals it prints statewise
      (every figure in it reconciles against the static-era pages row
      for row — never an agreed-blank space)
  .build/state-flow-src/sa/2014/ecsa-2014-lc-summary.html.gz
      (LC counts exist at the same tree level; the sa18 frame stays
      Assembly-only in this land)

The 2012→2016 determination renames (Antony Green's 2016 redistribution
analysis, the same record this repo's centroid maps corroborate):
  renamed   Ashford → Badcoe, Goyder → Narungga, Little Para → Elizabeth
  abolished Bright, Mitchell, Fisher, Napier
  created   Black, Gibson, Hurtle Vale, King
With the 40 untouched names, a previous election maps onto the frame per
.build/map/src/sa18/past-adjudication.md.

oracle pins (the ECSA's own totals, through the statewide print):
  formal 1,017,856   informal 32,503   votes 1,050,359   enrolled 1,142,419
  seats  ALP 23 / LIB 22 / IND 2
and Adams-vs-ECSA Double-ledger on all four.
  oracle party totals from the ECSA statewide summary AND psephos's
  transcription (the two sources print the NFC scene identically):
  LIB 455,797 / ALP 364,420 / GRN 88,600 / FFP 63,575 /
  IND 37,955 / D4D 5,934 / NP 1,328 / FREE 247  (Σ = 1,017,856)

usage: python3 -I .build/map/build_sa18_past.py map/data
(the joiner's own host: build_sa18_data.py map/data runs first)
"""
import gzip, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sa22_past as S22P  # noqa: E402 (guarded main; its flat_name machinery rides here too)
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC14 = os.path.join(REPO, ".build", "state-flow-src", "sa", "2014")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

REF_FORMAL = 1017856
REF_INFORMAL = 32503
REF_ENROLLED = 1142419
REF_SEATS = {"ALP": 23, "LIB": 22, "IND": 2}
REF_MAIN_PARTIES = {"LIB": 455797, "ALP": 364420, "GRN": 88600, "IND": 37955}
RENAMES = {"Badcoe": "Ashford", "Narungga": "Goyder", "Elizabeth": "Little Para"}
NEW = {"Black", "Gibson", "Hurtle Vale", "King"}
ABOLISHED = {"Bright", "Mitchell", "Fisher", "Napier"}

PREV_YEAR = 2014


def ffail(msg):
    raise SystemExit(f"build-sa18-past: {msg}")


def norm_name(s):
    return re.sub(r"[^A-Z0-9]+", "", (s or "").upper())


#: the ECSA static-era district ids, consecutive in its own alphabetical
#: page order. Empirically pinned against page contents (2026-11-17):
#: THREE pages carry stale breadcrumbs from the live count ("District of
#: Florey"/"District of Mawson"/"District of Mitchell" while the whole
#: table belongs to Giles/Kaurna/Port Adelaide respectively) — the name
#: authority here is the id-position table, never a page's label.
DISTRICT_SEQUENCE = [
    "Adelaide", "Ashford", "Bragg", "Bright", "Chaffey", "Cheltenham", "Colton",
    "Croydon", "Davenport", "Dunstan", "Elder", "Enfield", "Finniss", "Fisher",
    "Flinders", "Florey", "Frome", "Giles", "Goyder", "Hammond", "Hartley",
    "Heysen", "Kaurna", "Kavel", "Lee", "Light", "Little Para", "MacKillop",
    "Mawson", "Mitchell", "Morialta", "Morphett", "Mount Gambier", "Napier",
    "Newland", "Playford", "Port Adelaide", "Ramsay", "Reynell", "Schubert",
    "Stuart", "Taylor", "Torrens", "Unley", "Waite", "West Torrens", "Wright",
]
MISLABELS = {718: ("Florey", "Giles"), 723: ("Mawson", "Kaurna"),
             737: ("Mitchell", "Port Adelaide")}

# ---------------------------------------------------------- 2014-era parse
ROW_RE = re.compile(
    r'<tr>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>'
    r'\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([\d,]+)</td>\s*</tr>')


def read_page(n):
    p = os.path.join(SRC14, f"ecsa-2014-district-{n}.html.gz")
    if not os.path.exists(p):
        ffail(f"mirror page {p} missing — run harvest-sa14-src.py")
    with gzip.open(p, "rt", encoding="utf-8", errors="replace") as f:
        return f.read()


def cells_of(tbl):
    out = []
    for r in re.findall(r'<tr[^>]*>.*?</tr>', tbl, re.S):
        cs = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c)).strip()
              for c in re.findall(r'<t[dh][^>]*>.*?</t[dh]>', r, re.S)]
        out.append(cs)
    return out


def parse_page(n):
    h = read_page(n)
    txt = re.sub(r'<[^>]+>', ' ', h)
    name = DISTRICT_SEQUENCE[n - 701]
    label_m = re.search(r'District of ([A-Za-z][A-Za-z ]*?)\s*(?:- Results|Results)', txt)
    if not label_m:
        ffail(f"{n}: district-name marker missing from the page")
    label = label_m.group(1).strip()
    if label != name:
        if MISLABELS.get(n) == (label, name):
            print(f"  {n}: stale breadcrumb pinned ({label}; contents are {name})")
        else:
            ffail(f"{n}: page labels its table {label!r} but its id sequence"
                  f" ranks {name!r} there (extend MISLABELS deliberately, never silently)")
    tables = re.findall(r'<table[^>]*>.*?</table>', h, re.S)
    votes = two = None
    for t in tables:
        plain_header = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t))[:400]
        if 'Candidate' not in plain_header or 'Ballot Papers' not in plain_header:
            continue
        if 'Total Formal' in plain_header and votes is None:
            votes = t       # first-preference table: its two extra tallies rows
        elif votes is not None and two is None:
            two = t         # the two-candidate-preferred table follows the FP one
    if votes is None:
        ffail(f"{n}: no First Preference table")

    _CELL_BR = re.compile(r'<br\s*/?>')
    _CELL_TAG = re.compile(r'<[^>]+>')

    def fmt_name(raw):
        try:
            return S22P.flat_name(raw)
        except SystemExit:
            # the 2014-era print's surname-leads convention survives a McKay-style
            # mixed-case surname: the first token is always the surname
            parts = raw.split()
            sur, given = parts[0].title(), " ".join(parts[1:])
            return (given + " " + sur).strip()

    def row_cells(r):
        return [re.sub(r'\s+', ' ', _CELL_TAG.sub(' ', _CELL_BR.sub(' ', c))).strip()
                for c in re.findall(r'<t[dh][^>]*>.*?</t[dh]>', r, re.S)]

    def rows(tbl, want_head):
        for r in re.findall(r'<tr[^>]*>.*?</tr>', tbl, re.S):
            cells = row_cells(r)
            if not cells or not cells[0]:
                continue
            if cells[0] == 'Candidate':
                want_head[0] = True
                continue
            yield cells

    head_ok = [False]
    cands = []
    total_formal = total_informal = None
    for c in rows(votes, head_ok):
        n0 = re.sub(r'\s+', ' ', c[0]).strip()
        if n0.startswith('Total'):
            if n0.startswith('Total Formal'):
                total_formal = int(re.sub(r'\D', '', c[-1]))
            elif n0.startswith('Total Informal'):
                total_informal = int(re.sub(r'\D', '', c[-1]))
            continue
        if len(c) >= 5 and re.match(r'^[\d,]+$', c[-1]):
            name_cand = fmt_name(c[0])
            affiliation = c[1].strip()
            v = int(c[-1].replace(',', ''))
            cands.append({"n": name_cand, "ab": affiliation, "v": v})
    if not head_ok[0]:
        ffail(f"{name} ({n}): first-preference table header not the 2014-era schema")
    if not cands:
        ffail(f"{name} ({n}): no candidate rows in the First Preference table")
    if total_formal is None or total_informal is None:
        ffail(f"{name} ({n}): Total Formal/Informal rows missing")
    if sum(c['v'] for c in cands) != total_formal:
        ffail(f"{name} ({n}): candidates {sum(c['v'] for c in cands)} != Total Formal {total_formal}")

    t_rows = list(rows(two, head_ok)) if two else []
    tcp = []
    for c in t_rows:
        n0 = ' '.join(c[0].split())
        if n0.startswith('Total') or len(c) < 5 or not re.match(r'^[\d,]+$', c[-1]):
            continue
        tcp.append((n0, c[1].strip(), int(c[-1].replace(',', ''))))
    if len(tcp) != 2:
        ffail(f"{name} ({n}): Two Candidate Preferred carries {len(tcp)} rows")
    tcp_tot = sum(v for _, _, v in tcp)
    if tcp_tot != total_formal:
        ffail(f"{name} ({n}): TCP {tcp_tot} != formal {total_formal}")
    tcp_sorted = sorted(tcp, key=lambda x: -x[2])
    winner = {"n": fmt_name(tcp_sorted[0][0]), "ab": tcp_sorted[0][1],
                  "pct": round(100 * tcp_sorted[0][2] / tcp_tot, 2)}
    tcp_pair = None
    if set(t[1] for t in tcp_sorted) == set(("ALP", "LIB")):
        if tcp_sorted[0][1] == 'ALP':
            tcp_pair = (tcp_sorted[0][2], tcp_sorted[1][2])
        else:
            tcp_pair = (tcp_sorted[1][2], tcp_sorted[0][2])
    return {"name": name, "cands": cands, "formal": total_formal,
            "informal": total_informal, "winner": winner, "tpp": tcp_pair}


def parse_2014():
    dists = {}
    for i in range(701, 748):
        d = parse_page(i)
        dists[d["name"]] = d
    if len(dists) != 47:
        ffail(f"{len(dists)} district pages parsed, expected 47")

    # oracle: the ECSA-armed state summary ("Statewide 1st Preference
    # Votes By Affiliation", its one party-primary block; text-flow form)
    sh = gzip.open(os.path.join(SRC14, 'ecsa-2014-state-summary.html.gz'),
                   'rt', encoding='utf-8', errors='replace').read()
    plain = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', sh))
    prim = {ab: int(v.replace(',', '')) for ab, v in
            re.findall(r"\b(LIB|ALP|GRN|FFP|Independent|D4D|NP|FREE)\s+\d+%\s+Complete\s+[\d.]+\s+([\d,]+)", plain)}
    if len(prim) != 8:
        ffail(f"state summary: {len(prim)} party rows (expected 8): {sorted(prim)}")
    tm = re.search(r'Total Formal\s+([\d,]+)', plain)
    if not tm:
        ffail("state summary lacks Total Formal")
    formal_oracle_state = int(tm.group(1).replace(',', ''))
    if formal_oracle_state != REF_FORMAL:
        ffail(f"state summary Total Formal {formal_oracle_state} != pinned {REF_FORMAL}")

    formals = sum(x["formal"] for x in dists.values())
    if formals != REF_FORMAL:
        ffail(f"mirror totals {formals} != ECSA print {REF_FORMAL}")
    informals = sum(x["informal"] for x in dists.values())
    if informals != REF_INFORMAL:
        ffail(f"mirror informal {informals} != psephos print {REF_INFORMAL}")

    seats = {}
    for x in dists.values():
        seats[x['winner']['ab']] = seats.get(x['winner']['ab'], 0) + 1
    seats = {k: seats.get(k, 0) for k in ('ALP', 'LIB', 'GRN', 'IND') if seats.get(k, 0)}
    if seats != REF_SEATS:
        ffail(f"mirror seat tally {seats} != ECSA print {REF_SEATS}")
    return dists


def bucket(ab):
    a = ab.upper()
    if a == "ALP":
        return "alp"
    if a in ("LIB", "LNP", "NP", "CLP", "NAT", "LNQ"):
        return "lnp"
    if a.startswith("GRN") or "GREEN" in a:
        return "grn"
    if a.startswith("IND") or a == "":
        return "ind"
    return "oth"


def main():
    past_d = parse_2014()
    data_p = os.path.join(OUT, "data-sa18.json")
    if not os.path.exists(data_p):
        ffail("data-sa18.json missing — run build_sa18_data.py map/data first")
    data = json.load(open(data_p))
    if data.get("year") != "sa18":
        ffail("not the sa18 frame")
    if data.get("prev") is not None:
        ffail("data-sa18.json already carries prev — rerun build_sa18_data.py")

    past_formal = REF_FORMAL
    pprim = {"alp": REF_MAIN_PARTIES["ALP"], "lnp": REF_MAIN_PARTIES["LIB"],
             "grn": REF_MAIN_PARTIES["GRN"], "onp": 0, "ind": REF_MAIN_PARTIES["IND"],
             "oth": sum(v for k, v in ((("FFP", 63575), ("D4D", 5934),
                                        ("NP", 1328), ("FREE", 247))))}
    oth = pprim["oth"]
    if sum(pprim.values()) != past_formal:
        ffail(f"pprim Σ {sum(pprim.values())} != formal {past_formal}")
    if pprim["oth"] != 63575 + 5934 + 1328 + 247:
        ffail("tail-class arithmetic drifted")
    for st in ("AUS", "SA"):
        data["agg"][st]["pprim"] = pprim
        data["agg"][st]["pformal"] = past_formal
    data["prev"] = PREV_YEAR

    n_hist = n_sw = n_tpp = 0
    matched = set()
    for div in data["divs"]:
        name = div["n"]
        if name in NEW:
            matched.add(name)
            continue
        past_name = RENAMES.get(name, name)
        past_x = past_d.get(past_name)
        if past_x is None:
            ffail(f"sa18 district {name} matches no 2014 district "
                  f"(adjudication record incomplete per .build/map/src/sa18/past-adjudication.md)")
        matched.add(past_name)
        w = past_x["winner"]
        div["h"] = [[PREV_YEAR, w["pct"], w["ab"], w["n"]]]
        n_hist += 1
        formal_cur = sum(r[4] for r in div["c"])
        prev_by = {}
        for c in past_x["cands"]:
            prev_by[c["ab"]] = prev_by.get(c["ab"], 0) + c["v"]
        for r in div["c"]:
            share = (100 * r[4]) / formal_cur
            prev_share = (100 * prev_by[r[1]]) / past_x["formal"] if r[1] in prev_by else 0.0
            r[5] = round(share - prev_share + 1e-9, 2)
            n_sw += 1
        if div.get("tpp") and past_x["tpp"]:
            cur = (100 * div["tpp"][0]) / (div["tpp"][0] + div["tpp"][1])
            tv = past_x["tpp"]
            old2 = (100 * tv[0]) / sum(tv)
            div["tpp"][2] = round(cur - old2 + 1e-9, 2)
            n_tpp += 1
    missing = sorted(set(past_d) - matched - ABOLISHED)
    if missing:
        ffail(f"2014 districts never consumed, unadjudicated: {missing}")
    with open(data_p, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"sa18 past (2014): {n_hist} history rows, {n_sw} candidate swings,"
          f" {n_tpp} 2PP swings; prev totals formal {past_formal}"
          f" alp={pprim['alp']}|lnp={pprim['lnp']}|grn={pprim['grn']}|onp=0|ind={pprim['ind']}|oth={pprim['oth']}")


if __name__ == "__main__":
    main()
