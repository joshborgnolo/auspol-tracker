"""data-nsw23.json for /map/ — the New South Wales state election of 25 Mar
2023 (93 districts, Legislative Assembly), the frame build's own parse of the
NSW Electoral Commission's pastvtr results pages.

The sa22/sa26 discipline (build_sa22_data.py / build_sa26_data.py) on a
jurisdiction with no results API: the NSWEC publishes the 2023 election only
as static pastvtr pages, one First-Past (fp) summary plus one Distribution
of Preferences (dop) page per district. The committed caches in
.build/state-flow-src/nsw/<year>/ (<slug>-fp.html.gz, <slug>-dop.html.gz) are
the one record — this script never refetches; a cache gap fails the build
loudly.

Grammar (pinned against hawkesbury-{fp,dop}.html in both years):
  fp page: prose "Electors Enrolled as on DD/MM/YYYY: N"; table 0 rows
    candidate, long party name, formal votes, pct; footer TOTAL FORMAL
    VOTES; table 1 a Venue-and-Vote-Types grid (header cells "SURNAME (AB)",
    then total-formal / informal / total-ballots / count-status), bodied in
    sections: Voting Centres (one row per day booth, incl. TAV and "<X> EVC"
    rows in 2023) + Total Voting Centre Ordinary Votes; Early Voting
    Centres (2023's stand-alone EVC rows, e.g. "Richmond EVC"; 2019's
    "Declared Facility" and "<X> EM Office" rows) + total; Declaration
    Votes (Absent / Enrolment[-/ ]Provisional / Postal; 2019 also iVote,
    separated in 2023) + Total Declaration Votes; then Total Votes /
    Ballot Papers and two pct rows. 2019's pct cells print "X.XX %" with a
    space; both parse as junk-prefixed floats.
  dop page: one table; header "Counts|Count 1|Count 2|…"; candidate rows
    named "NAMEAB" with no space (PRESTON RobynLIB); each count contributes
    VotesDistributed+ProgressiveTotals cells; a candidate's last live cell
    reads EXCLUDED; the winner's final cell carries the literal token
    "ELECTED<br>{votes}"; sentinel rows Total Votes in Count / Exhausted
    Votes / Informal / Total Votes / Absolute Majority. Optional
    preferential: exhaustion climbs monotonically; the last count's two
    live candidates are the TCP pair and their progressive totals the TCP.

The frame's res file rides the sa22 shape exactly ({year,date,prev,
jurisdiction,demoBasis,agg{AUS,NSW{...}},divs[],booths{}}; candidate rows
[n,ab,pn,bucket,votes,swing,elected,x]; booth lanes d,id,n,ty,prem,sub,pc,
lat,lon,v,inf,tpp,tcp,fl,dec,vdec with ty 1=day 4=mobile 5=EVC; tpp only on
classic ALP-v-LNP final pairs; fl empty — no flow source for NSW 2023).

Booths: the venue roll committed beside this script in
.build/map/src/nsw23/venues/<event>/<nnn>-<district>.json (NSWEC map
placemark API, day+EVC+returning-officer records) joins venue names to
premises/suburb/postcode/lat/lon; a name the roll lacks fails loudly. ty is
5 where the fp row sits in an Early-Voting section or its name ends "EVC",
4 where the row is a declared-facility / team row (2019 "Declared
Facility"; 2023's "Sydney Town Hall" is a booth), else 1.

The census people lane rides data/nsw23-demo.json and the SEIFA lane
data/nsw23-seifa.json (.build/map/build_nsw23_demo.py /
build_nsw23_seifa.py, both on the frame's own 2021-redistribution polygons
in .build/map/src/nsw23/n-nsw23.geojson), spliced exactly as sa26 does.

usage: python3 -I .build/map/build_nsw23_data.py <out_dir>
then:  python3 -I .build/map/build_nsw23_past.py <out_dir>
then:  node .build/map/geo_build.mjs .build/map/src/nsw23 <out_dir> map/data --years=nsw23
"""
import collections, gzip, html as H, json, os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FLOW = os.path.join(REPO, ".build", "state-flow-src", "nsw")
NSW23 = os.path.join(REPO, ".build", "map", "src", "nsw23")
VENUES = os.path.join(NSW23, "venues")
DEMO_STORE = os.path.join(REPO, "data", "nsw23-demo.json")
SEIFA_STORE = os.path.join(REPO, "data", "nsw23-seifa.json")
DIST_IDS = os.path.join(NSW23, "district-ids.json")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

ELECTION = "2023-03-25"
EXPECTED_SEATS = {"ALP": 45, "LIB": 25, "NAT": 11, "GRN": 3, "IND": 9}
N_DISTRICTS = 93
DRIFT_MAX = 0

COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]


def fail(msg):
    raise SystemExit(f"nsw23: {msg}")


def bucket(ab):
    ab = (ab or "").upper()
    if ab == "ALP" or ab == "LAB":
        return "alp"
    if ab in COALITION:
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "HAN", "ONP", "PHON"):
        return "onp"
    if ab in ("IND", "", "NAFD"):
        return "ind"
    return "oth"


def title_name(given, surname):
    s = surname or ""
    out = []
    for w in s.split(" "):
        if w.isupper() and len(w) > 1:
            t = w.capitalize()
            for pre in ("Mc", "O'", "D'"):
                if t.startswith(pre) and len(t) > len(pre):
                    t = pre + t[len(pre)].upper() + t[len(pre) + 1:]
            if "-" in t:
                t = "-".join(p[:1].upper() + p[1:] for p in t.split("-"))
            out.append(t)
        else:
            out.append(w)
    return ((given or "").strip() + " " + " ".join(out)).strip()


def flat_name(n):
    """NSWEC rows run "SURNAME Given" (no comma); the map's files ride
    "Given SURNAME"."""
    n = (n or "").strip()
    if not n:
        return n
    parts = n.split(" ")
    lead = 0
    for i, w in enumerate(parts):
        if w.isupper():
            lead = i + 1
        else:
            break
    if not lead or lead == len(parts):
        # all-caps or no caps run: keep as filed (a one-name candidate)
        return title_name("", n) if n.isupper() else n
    sur, giv = " ".join(parts[:lead]), " ".join(parts[lead:])
    return title_name(giv, sur)


def num(s):
    s = (s or "").replace(",", "").strip()
    return int(s) if re.fullmatch(r"-?\d+", s) else None


def parse_int_cell(s):
    v = num(s)
    if v is None:
        fail(f"odd vote cell {s!r}")
    return v


def slug_for(year, name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ------------------------------------------------------------------ fp parse
def txt(c):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def rows_of(table):
    for tr in re.findall(r"<tr.*?</tr>", table, re.S | re.I):
        yield [txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]


HDR_AB_RE = re.compile(r"^([A-Z][A-Za-z' .&-]*?)\s*\(([A-Z]{1,5})\)\s*$")


def parse_fp(page, year, slug):
    """The district's fp summary page -> candidates, formal/informal,
    enrolled, and the venue rows [{sec, name, votes[], inf}]."""
    tables = re.findall(r"<table.*?</table>", page, re.S | re.I)
    if len(tables) != 2:
        fail(f"{year} {slug}: {len(tables)} tables, expected 2")
    # enrolled, from the prose note (2023 closes with </strong>, 2019 </span>)
    m = re.search(r"Electors Enrolled as on ([\d/]+):</(?:strong|span)>\s*([\d,]+)", page)
    if not m:
        fail(f"{year} {slug}: no Electors Enrolled line")
    enrolled = int(m.group(2).replace(",", ""))

    # ---- table 0: candidate summary
    t0 = list(rows_of(tables[0]))
    if not t0 or t0[0][:2] != ["Candidate", "Representation"]:
        fail(f"{year} {slug}: table 0 header drift ({t0[0][:2]!r})")
    cands = []          # (familyKey, surname-given, partyName, votes)
    formal0 = None
    for r in t0[1:]:
        if not r or not r[0]:
            continue
        if r[0].upper().startswith("TOTAL FORMAL"):
            formal0 = parse_int_cell(r[2] if len(r) > 2 else r[-1])
            continue
        name, party, votes = r[0], r[1], parse_int_cell(r[2])
        cands.append({"nm": name, "pn": party, "v": votes})
    if formal0 is None:
        fail(f"{year} {slug}: no TOTAL FORMAL VOTES row")
    if sum(c["v"] for c in cands) != formal0:
        fail(f"{year} {slug}: table 0 sum {sum(c['v'] for c in cands)} != formal {formal0}")

    # ---- table 1: the venue grid; header row gives the affiliation key
    t1 = list(rows_of(tables[1]))
    hdr = t1[0]
    if not hdr or hdr[0] != "Venue and Vote Types":
        fail(f"{year} {slug}: table 1 header drift ({hdr[0]!r})")
    # sentinel columns close the candidate block (an ungrouped candidate's
    # header cell is the bare surname — only the printed sentinel names are
    # never candidates, so the sentinel labels themselves start the tail)
    tail_names = ("total formal", "informal", "total votes/ ballot papers",
                  "count status")
    i_tf = next((i for i, c in enumerate(hdr[1:])
                 if c.lower() in tail_names), None)
    if i_tf is None:
        fail(f"{year} {slug}: venue header lacks a Total Formal sentinel")
    keys = []           # per candidate column: (surname-lower, AB|None)
    for cell in hdr[1:][:i_tf]:
        m2 = HDR_AB_RE.match(cell)
        keys.append((m2.group(1).strip().lower(), m2.group(2)) if m2 else None)
    if len(keys) != len(cands):
        fail(f"{year} {slug}: table 0 has {len(cands)} candidates, table 1 header {len(keys)}")
    hdr_cells = hdr[1:][:i_tf]
    for i, k in enumerate(keys):
        if k is None:
            # bare-surname column = ungrouped candidate (party cell empty)
            sur = hdr_cells[i].strip().lower()
            if not cands[i]["pn"]:
                keys[i] = (sur, "IND")
            else:
                fail(f"{year} {slug}: unparseable header cell {hdr_cells[i]!r} "
                     f"over party cell {cands[i]['pn']!r}")
    tail = hdr[1 + i_tf:]
    want_tail = ["Total Formal", "Informal", "Total Votes/ Ballot Papers", "Count Status"]
    if [t.replace("\xa0", " ").strip() for t in tail[:2]] != want_tail[:2]:
        fail(f"{year} {slug}: venue sentinel columns drift ({tail!r})")

    # reconcile the two tables' candidates (same order; the summary name's
    # surname part is the header surname — multi-word surnames included)
    order = []
    for i, (sur, ab) in enumerate(keys):
        c = cands[i]
        if not c["nm"].lower().startswith(sur + " "):
            fail(f"{year} {slug}: table order drift at {i}: {c['nm']!r} vs header {sur!r}")
        order.append(i)

    venues = []
    sec = None
    tots = {}
    for r in t1[1:]:
        if not r or not r[0]:
            continue
        lab = r[0]
        if lab in ("Voting Centres", "Early Voting Centres", "Declaration Votes"):
            sec = lab
            continue
        if lab.startswith("%"):
            continue
        cells = r[1:]
        votes = [parse_int_cell(c) if c not in ("", "-") else 0 for c in cells[:len(keys)]]
        extra = cells[len(keys):]
        tot_f = parse_int_cell(extra[0]) if len(extra) > 0 and extra[0] not in ("", "-") else None
        inf = parse_int_cell(extra[1]) if len(extra) > 1 and extra[1] not in ("", "-") else 0
        if lab.startswith("Total Voting Centre"):
            tots["vc"] = (votes, tot_f)
            continue
        if lab.startswith("Total Early Voting"):
            tots["evc"] = (votes, tot_f)
            continue
        if lab.startswith("Total Declaration"):
            tots["decl"] = (votes, tot_f)
            continue
        if lab.startswith("Total Votes"):
            tots["all"] = (votes, tot_f, inf)
            continue
        if sec is None:
            fail(f"{year} {slug}: venue row {lab!r} before any section head")
        venues.append({"sec": sec, "name": lab, "votes": votes, "tot": tot_f, "inf": inf})
    if set(tots) != {"vc", "evc", "decl", "all"}:
        fail(f"{year} {slug}: missing subtotal rows ({sorted(tots)})")

    # subtotals reconcile (per candidate columns and the formal column)
    for key in ("vc", "evc", "decl"):
        sv, tf = tots[key]
        rows = [v for v in venues if (v["sec"] == "Voting Centres") == (key == "vc")
                and (v["sec"] == "Early Voting Centres") == (key == "evc")]
        if rows:
            col = [sum(v["votes"][i] for v in rows) for i in range(len(keys))]
            if col != sv:
                fail(f"{year} {slug}: {key} subtotal {sv} != venue sums {col}")
        else:
            if any(sv):
                fail(f"{year} {slug}: {key} subtotal non-zero with no venue rows")
    allv, all_tf, all_inf = tots["all"]
    if all_tf != formal0:
        fail(f"{year} {slug}: venue-grid formal {all_tf} != table-0 formal {formal0}")
    if allv != [c["v"] for c in cands]:
        # the venue grid's candidate columns are the same formal counts
        fail(f"{year} {slug}: venue-grid candidate totals != table 0")

    # informal: the total row carries it
    informal = all_inf
    return {"cands": cands, "keys": keys, "formal": formal0, "inf": informal,
            "enrolled": enrolled, "venues": venues}


# ------------------------------------------------------------------ dop parse
ELECTED_RE = re.compile(r"ELECTED\s*([\d,]+)")
CAND_ROW_RE = re.compile(r"^([A-Z][A-Za-z' .&()-]*?[a-z\)])((?:[A-Z]{2,5}))$")


def parse_dop(page, year, slug, fp):
    """The district's Distribution-of-Preferences page -> TCP pair and
    winner, reconciled against the fp parse's candidates."""
    tables = re.findall(r"<table.*?</table>", page, re.S | re.I)
    if len(tables) != 1:
        fail(f"{year} {slug}: dop has {len(tables)} tables, expected 1")
    rows = list(rows_of(tables[0]))
    if not rows or rows[0][0] != "Counts":
        fail(f"{year} {slug}: dop header drift ({rows[0][:2]!r})")
    ncand = len(fp["cands"])
    cand_rows = {}
    winner = None
    tcp = None
    exhausted = None
    total_trk = None
    for r in rows[1:]:
        if not r or not r[0]:
            continue
        lab = r[0]
        if lab in ("Candidates",) or lab.startswith("Count"):
            continue
        m = CAND_ROW_RE.match(lab.replace(" ", "")) if " " not in lab.strip() else None
        # name cells arrive glued as "PRESTON RobynLIB" (surnameCAPS party);
        # the row's own first token is the surname cap-word
        back = lab
        if back.startswith("Total Votes in Count"):
            total_trk = [parse_int_cell(c) if c not in ("", "-") else None for c in r[1:]]
            continue
        if back.startswith("Exhausted Votes"):
            exhausted = [parse_int_cell(c) if c not in ("", "-") else None for c in r[1:]]
            continue
        if back.startswith("Informal") or back.startswith("Total Votes /") or back.startswith("Absolute Majority"):
            continue
        mm = ELECTED_RE.search(back)
        namecells = [back]
        # a candidate row's name cell is the fp summary's "SURNAME Given"
        # with the affiliation code glued or tacked at the tail; an
        # ungrouped candidate's carries none ("DAOUD Jamal")
        stripped = back.strip()
        m_suf = re.search(r"\s*\(?([A-Z]{2,5})\)?$", stripped)
        if m_suf:
            run = m_suf.group(1)
            # the run can fuse a surname-final uppercase tail with a glued
            # code ("KANAK Dominic WYGRN" — tail "WY" + code "GRN"): take
            # the longest KNOWN code off the run's end
            code = run
            if code not in PARTY_AB:
                cut = next((c for c in sorted(PARTY_AB, key=len, reverse=True)
                            if run.endswith(c) and len(run) > len(c)), None)
                code = cut
            if code and code in PARTY_AB:
                stripped = back[:m_suf.end(1) - len(code)].strip()
        matched = next((c for c in fp["cands"]
                        if c["nm"].lower() == stripped.lower()), None)
        if matched is None:
            # sentinel we do not track (a stranger row) — only candidate
            # rows carry a first-preference count cell matching the fp
            first = parse_int_cell(r[1]) if len(r) > 1 else None
            if first is None or all(c["v"] != first for c in fp["cands"]):
                continue
            fail(f"{year} {slug}: dop row {back[:40]!r} matches no fp candidate")
        vals = [c for c in r[1:]]
        cand_rows[matched["nm"]] = vals
        # the NSWEC stamps ELECTED<br>{votes} on the winner's violation-
        # weight runs too, so the marker shows in SEVERAL count cells;
        # the row's LAST non-empty cell (the % of Vote column) is the
        # definitive final total, ELECTED-marked for the winner
        if any(ELECTED_RE.search(c) for c in vals):
            if winner is not None:
                fail(f"{year} {slug}: two ELECTED rows")
            winner = matched["nm"]
    if winner is None:
        fail(f"{year} {slug}: no ELECTED marker")
    if len(cand_rows) != ncand:
        miss = [c["nm"] for c in fp["cands"] if c["nm"] not in cand_rows]
        fail(f"{year} {slug}: dop rows {len(cand_rows)} != {ncand} candidates (missing {miss[:3]})")

    def final_cell(nm):
        # the dop table's trailing column is "% of Vote" — ignore it; the
        # LAST COUNT's tally is the candidate's last non-empty cell that is
        # not a percentage. The NSWEC stamps ELECTED<br>{votes} on every
        # run-up violation weight, so the winner's final-count cell says
        # ELECTED too; an excluded candidate's last count cell says EXCLUDED
        tail = [v for v in cand_rows[nm][:-1] if v not in ("", "-")]
        if not tail:
            fail(f"{year} {slug}: {nm} has no count cells")
        return tail[-1]

    # the two live candidates at the final count: the winner's cell carries
    # ELECTED; the other live row's is a bare number; every excluded row's
    # ends EXCLUDED
    finals = {}
    for nm in cand_rows:
        last = final_cell(nm)
        if "EXCLUDED" in last:
            continue
        mm2 = ELECTED_RE.search(last)
        raw = mm2.group(1) if mm2 else (re.search(r"([\d,]+)$", last) or [None, None])[1]
        if raw is None:
            continue
        v = int(raw.replace(",", ""))
        if v <= 0:
            fail(f"{year} {slug}: {nm} final total {v}")
        finals[nm] = v
    if len(finals) != 2:
        fail(f"{year} {slug}: {len(finals)} live candidates at the last count "
             f"({sorted(finals) or 'none'}), expected 2")
    if winner not in finals:
        fail(f"{year} {slug}: ELECTED {winner} not in the live pair {sorted(finals)}")
    # the winner's tally is the higher
    (a, b) = sorted(finals)
    if finals[a] == finals[b]:
        fail(f"{year} {slug}: dead heat at the last count")
    if (finals[a] > finals[b]) != (winner == a):
        fail(f"{year} {slug}: ELECTED marker {winner} contradicts the taller tally")
    return {"tcp": finals, "winner": winner}


# ------------------------------------------------------------------ caches
def load_districts():
    with open(DIST_IDS) as f:
        d = json.load(f)
    m = d.get("SG2301")
    if not isinstance(m, dict) or len(m) != N_DISTRICTS:
        fail(f"district-ids SG2301 covers {len(m or {})} districts, expected {N_DISTRICTS}")
    return m


def load_venues():
    """The NSWEC placemark roll, keyed by the venue label the fp pages
    print — the placemark's Uppn (its short label; "Albury High") — with
    the full postal Name as an alias. The EVC held in an election-day
    venue gets its own Uppn ("North Albury EVC") beside the day booth's
    ("Albury Masonic Cntr", Name "Albury Masonic Centre"); an Election
    Manager's Office or Sydney Town Hall placemark repeats once per
    event (eve-of-poll and the count) with identical fields, and the fp
    grid carries each ONCE in Declaration Votes."""
    out = {}
    base = os.path.join(VENUES, "SG2301")
    if not os.path.isdir(base):
        fail(f"venue roll {base} missing — see the nsw23-frame plan")
    n_files = 0
    for slug in DIST_SLUGS:
        p = os.path.join(base, f"{DIST23[slug]}-{slug}.json")
        if not os.path.exists(p):
            fail(f"venue roll {p} missing")
        n_files += 1
        out.setdefault(slug, {"uppn": {}, "alias": {}})
        for v in json.load(open(p)):
            uppn = (v.get("Uppn") or "").upper()
            name = (v.get("Name") or "").upper()
            if not uppn:
                fail(f"venue record in {slug} lacks a Uppn label")
            cell = out[slug]["uppn"]
            same_loc = (uppn in cell and all(
                cell[uppn].get(k) == v.get(k)
                for k in ("Name", "Premises", "Locality", "Postcode", "Lat", "Lon")))
            if uppn in cell and not same_loc:
                fail(f"venue {uppn!r} duplicated with different fields in {slug}")
            cell[uppn] = v
            if name:
                al = out[slug]["alias"]
                if name in al and not (al[name] is v or dict(al[name]) == dict(v)):
                    # the EVC held in a day booth shares the postal Name:
                    # keep whichever record the Uppn lane printed as a day
                    # booth (no " EVC" suffix), else the first lodged
                    if al[name].get("Uppn", "").upper().endswith(" EVC") and \
                            not uppn.endswith(" EVC"):
                        al[name] = v
                else:
                    al[name] = v
    n_locs = sum(len(o["uppn"]) for o in out.values())
    print(f"venue roll: {n_files} district files, {n_locs} placemarks")
    return out


def venue_lookup(venues, slug, nm):
    """Resolve one fp-page venue label to a placemark record: Uppn first
    (the grid's own print), the postal-Name alias second; when the alias
    lands on an EVC held in the day booth at the same address the day
    booth's own record is the divider's placemark."""
    cell = venues.get(slug)
    if cell is None:
        fail(f"no venue roll for district {slug}")
    uppn = nm.upper()
    v = cell["uppn"].get(uppn)
    if v is not None:
        return v
    v = cell["alias"].get(uppn)
    if v is None:
        return None
    for alt in cell["uppn"].values():
        if (alt is not v and alt.get("Name", "").upper() == uppn
                and not alt.get("Uppn", "").upper().endswith(" EVC")):
            return alt
    return v


def district_names():
    """The display roster: the demo store when it exists (the name-identity
    gate), else the boundary geojson's own names (a bootstrap pass before
    build_nsw23_demo.py can run — sa22_geo.py's EXPECTED_NAMES solve)."""
    if os.path.exists(DEMO_STORE):
        with open(DEMO_STORE) as f:
            d = json.load(f)
        if d.get("year") == "nsw23" and isinstance(d.get("demo"), dict) and len(d["demo"]) == N_DISTRICTS:
            return sorted(d["demo"])
    gj = os.path.join(NSW23, "n-nsw23.geojson")
    if not os.path.exists(gj):
        fail(f"neither {DEMO_STORE} nor {gj} exists for the district roster")
    feats = json.load(open(gj)).get("features") or []
    if len(feats) != N_DISTRICTS:
        fail(f"{gj} holds {len(feats)} features, expected {N_DISTRICTS}")
    return sorted(f["properties"]["name"] for f in feats)


def load_demo():
    if not os.path.exists(DEMO_STORE):
        fail(f"census store {DEMO_STORE} missing — run .build/map/build_nsw23_demo.py")
    with open(DEMO_STORE) as f:
        d = json.load(f)
    if d.get("year") != "nsw23" or d.get("demoBasis") != "sa1":
        fail(f"census store is year {d.get('year')!r} basis {d.get('demoBasis')!r}")
    demo = d.get("demo")
    if not isinstance(demo, dict) or len(demo) != N_DISTRICTS:
        fail(f"census store covers {len(demo or {})} districts, expected {N_DISTRICTS}")
    return demo


def load_seifa():
    if not os.path.exists(SEIFA_STORE):
        fail(f"SEIFA store {SEIFA_STORE} missing — run .build/map/build_nsw23_seifa.py")
    with open(SEIFA_STORE) as f:
        d = json.load(f)
    if d.get("year") != "nsw23":
        fail(f"SEIFA store is year {d.get('year')!r}, expected nsw23")
    seifa = d.get("seifa")
    if not isinstance(seifa, dict) or len(seifa) != N_DISTRICTS:
        fail(f"SEIFA store covers {len(seifa or {})} districts, expected {N_DISTRICTS}")
    return seifa


def read_page(year, slug, kind):
    p = os.path.join(FLOW, year, f"{slug}-{kind}.html.gz")
    if not os.path.exists(p):
        fail(f"cache miss {p} — the {kind} pages are the committed record")
    with gzip.open(p, "rt", encoding="utf-8", errors="replace") as f:
        return f.read()


# ------------------------------------------------------------------ party ids
# the venue grid's affiliation codes onto the frame's party abbreviations.
# The NSWEC's codes are its own (LAB not ALP; SAP for Sustainable Australia);
# the map's files ride the AEC-era vocabulary the other frames share.
PARTY_AB = {
    "LAB": "ALP", "ALP": "ALP", "LIB": "LIB", "NAT": "NAT", "GRN": "GRN",
    "ON": "ONP", "PHON": "ONP", "IND": "IND", "SFF": "SFF", "AJP": "AJP",
    "SAP": "SAP", "SBP": "SBP", "KSO": "KSO", "LDP": "LDP", "IMO": "IMO",
    "IMOP": "IMO", "LCP": "LCP", "PEP": "PEP", "SA": "SOA",
    "CLP": "ALP",   # 2019's Country Labor Party code — NOT the NT Country Liberal
    "CDP": "CDP", "AC": "AC", "FLUX": "FLUX",
}
PARTY_NAME = {
    "ALP": "Australian Labor Party", "LIB": "Liberal Party", "NAT": "The Nationals",
    "GRN": "The Greens", "ONP": "Pauline Hanson's One Nation", "IND": "Independent",
    "SFF": "Shooters, Fishers and Farmers", "AJP": "Animal Justice Party",
    "SAP": "Sustainable Australia", "SBP": "The Small Business Party",
    "KSO": "Keep Sydney Open", "LDP": "Liberal Democrats", "IMO": "Informed Medical Options",
    "LCP": "Legalise Cannabis", "PEP": "Public Education Party", "SOA": "Socialist Alliance",
    "CDP": "Christian Democratic Party", "AC": "Australian Conservatives",
    "FLUX": "Flux",
}



def clean_booth_name(name):
    return name.strip()


# ------------------------------------------------------------------ main
def main():
    os.makedirs(OUT, exist_ok=True)
    global DIST23, DIST_SLUGS
    DIST23 = load_districts()          # slug -> nnn
    DIST_SLUGS = sorted(DIST23)
    names = district_names()
    demo = load_demo()
    seifa = load_seifa()
    venues = load_venues()
    disp_of = {slug_for(2023, n): n for n in names}
    if set(disp_of) != set(DIST_SLUGS):
        fail(f"district name drift: roster-only {sorted(set(disp_of) - set(DIST_SLUGS))[:3]}, "
             f"placemark-only {sorted(set(DIST_SLUGS) - set(disp_of))[:3]}")
    for n in names:
        if n not in demo:
            fail(f"census store lacks district {n!r}")
        if n not in seifa:
            fail(f"SEIFA store lacks district {n!r}")

    # district roster, in the placemark-id order the map's own id lane rides
    order = sorted(DIST_SLUGS, key=lambda s: int(DIST23[s]))

    D = []
    seats = collections.Counter()
    tot_prim = collections.Counter()
    tot_formal = tot_inf = tot_enrolled = 0
    tpp_tot = [0, 0]
    B = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                         "v", "inf", "tpp", "tcp", "fl", "dec", "vdec")}
    types_seen = collections.Counter()
    geocoded = 0
    decl_rows = 0
    for di, slug in enumerate(order):
        name = re.sub(r"\b\w", lambda m: m.group(0).upper(), slug.replace("-", " "))
        # the district display name comes from the demo/geo roster, not the slug
        fp = parse_fp(read_page("2023", slug, "fp"), "2023", slug)
        dop = parse_dop(read_page("2023", slug, "dop"), "2023", slug, fp)

        # candidates: fp order, names flattened, party onto the frame's codes
        rows = []
        for i, c in enumerate(fp["cands"]):
            _sur, ab0 = fp["keys"][i]
            ab = PARTY_AB.get(ab0)
            if ab is None:
                fail(f"2023 {slug}: unmapped party code {ab0!r} ({c['pn']!r})")
            rows.append({"n": flat_name(c["nm"]), "ab": ab, "pn": c["pn"],
                         "b": bucket(ab), "v": c["v"], "el": c["nm"] == dop["winner"]})
        if sum(1 for r in rows if r["el"]) != 1:
            fail(f"2023 {slug}: {sum(1 for r in rows if r['el'])} elected rows")
        rows.sort(key=lambda r: -r["v"])
        w = next(r for r in rows if r["el"])
        seats[w["ab"]] += 1

        # TCP on the dop finals, re-indexed onto the sorted rows
        by_nm = {r["n"]: k for k, r in enumerate(rows)}
        (ta, tb) = sorted(dop["tcp"].items())
        ia, ib = by_nm[flat_name(ta[0])], by_nm[flat_name(tb[0])]
        tcp_pair = [[ia, ta[1]], [ib, tb[1]]]
        pair_buckets = {rows[ia]["b"], rows[ib]["b"]}
        tpp = None
        if pair_buckets == {"alp", "lnp"}:
            alp_i = ia if rows[ia]["b"] == "alp" else ib
            lnp_i = ib if alp_i == ia else ia
            va = ta[1] if alp_i == ia else tb[1]
            vb = tb[1] if alp_i == ia else ta[1]
            tpp = [va, vb, None]
            tpp_tot[0] += va
            tpp_tot[1] += vb

        # ---- booths
        for bk, v in enumerate(fp["venues"]):
            votes = [0] * len(rows)
            for i, c in enumerate(fp["cands"]):
                votes[by_nm[flat_name(c["nm"])]] = v["votes"][i]
            sec = v["sec"]
            nm = clean_booth_name(v["name"])
            is_decl = sec == "Declaration Votes"
            is_evc = sec == "Early Voting Centres" or nm.endswith(" EVC") or " EVC " in nm
            # TAV = the Telephone Assisted Voting line; Declared Facility =
            # the declared-institution teams: both no-premises channels off
            # the venue roll, printed once per district at the EVC tail
            is_tav = nm == "TAV"
            is_df = "Declared Facility" in nm
            # interstate offices (numbered "ACT - Canberra" …, printed only in
            # the Sydney district's grid) vote off-frame — no NSW placemark
            is_is = bool(re.match(r"^(ACT|NT|QLD|SA|TAS|VIC|WA) - ", nm))
            is_team = is_tav or is_df or is_is or nm.endswith(" EM Office")
            ty = 5 if is_evc and not is_team else (4 if is_team else 1)
            # declaration-pile rows (Postal / Absent / Enrolment-Provisional,
            # the "Declaration Votes" section, three per district) count in
            # the district totals but are no place: the federal frames skip
            # them from the booth lanes, and so do we
            if is_decl:
                decl_rows += 1
                continue
            if is_tav or is_df or is_is:
                rec = None
            else:
                rec = venue_lookup(venues, slug, nm)
                if rec is None:
                    fail(f"2023 {slug}: booth {nm!r} not in the NSWEC venue roll")
            if rec:
                geocoded += 1
            B["d"].append(di)
            B["id"].append(f"nsw23-{di}-{bk}")
            B["n"].append(nm)
            B["ty"].append(ty)
            B["prem"].append((rec or {}).get("Premises"))
            B["sub"].append((rec or {}).get("Locality"))
            B["pc"].append((rec or {}).get("Postcode"))
            B["lat"].append(round(float(rec["Lat"]), 5) if rec and rec.get("Lat") not in (None, "") else None)
            B["lon"].append(round(float(rec["Lon"]), 5) if rec and rec.get("Lon") not in (None, "") else None)
            B["v"].append(votes)
            B["inf"].append(v["inf"] or 0)
            B["tpp"].append(None)
            B["tcp"].append(None)
            B["fl"].append(None)
            B["dec"].append(None)
            B["vdec"].append(None)
            types_seen[ty] += 1
        disp = disp_of[slug]
        recd = {
            "id": di, "n": disp, "st": "NSW",
            "c": [[r["n"], r["ab"], r["pn"], r["b"], r["v"], 0, 1 if r["el"] else 0, 0] for r in rows],
            "inf": fp["inf"],
            "tcp": tcp_pair,
            "fl": [],
            "h": [],
            "enrolled": fp["enrolled"],
            "demo": demo[disp],
            "seifa": seifa[disp],
        }
        if tpp:
            recd["tpp"] = tpp
        D.append(recd)
        tot_formal += fp["formal"]
        tot_inf += fp["inf"]
        tot_enrolled += fp["enrolled"]
        for r in rows:
            tot_prim[r["b"]] += r["v"]

    if dict(seats) != EXPECTED_SEATS:
        fail(f"seat counts {dict(seats)} != expected {EXPECTED_SEATS}")

    agg = {"prim": {k: tot_prim[k] for k in BUCKETS}, "formal": tot_formal, "inf": tot_inf,
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": dict(seats)}
    out = {"year": "nsw23", "date": ELECTION, "prev": None, "jurisdiction": "NSW",
           "demoBasis": "sa1",
           "agg": {"AUS": agg, "NSW": dict(agg)}, "divs": D, "booths": B}
    p = os.path.join(OUT, "data-nsw23.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1])
    print("nsw23 districts", len(D), "| seats", dict(seats), "| 2PP-classic ALP", round(tp, 2),
          "| informal", round(100 * tot_inf / (tot_inf + tot_formal), 2), "| enrolled", tot_enrolled,
          "| booths", len(B["id"]), dict(sorted(types_seen.items())), "| geocoded", geocoded,
          "| declaration rows", decl_rows, "| size", os.path.getsize(p))


if __name__ == "__main__":
    main()
