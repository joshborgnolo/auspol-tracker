"""data-now-nsw.json for /map/ — the "NSW now" overlay: the 2023 Legislative
Assembly with the four by-elections since polling day 2023-03-25, in the shape
of the federal data-now.json (applyNow's contract).

Events (NSWEC results system — the pastvtr archive does not carry them; the
report pages are the event's own record and the committed caches in
.build/state-flow-src/nsw/byelections/ are the ONE copy, refreshed only by a
manual re-run of .build/harvest-nsw-byelections.py):
  SB2402  Epping, Hornsby, Pittwater — 19 October 2024
  SB2502  Kiama — 13 September 2025

THREE figures domains print per event, and the record rides the CHECK COUNT
(the final figures the Commissioner declared):
  <d>-fp.html.gz   FirstPreferencesReport — the pre-recheck venue grid,
                    frozen at progressive-complete: its formally-reported
                    totals drift 9–120 ballots from the declared count
                    (Epping 44,576 vs 44,567, Hornsby 49,204 vs 49,224,
                    Pittwater 47,431 vs 47,450, Kiama 49,776 vs 49,895).
                    Proof only: the candidate roll comes from its header's
                    "SURNAME Given (AB)" cells (the check count's header
                    prints surnames alone), and its venue grid reconciles
                    against the check count's.
  <d>-cc.html.gz   CheckCountPreferencesReport — THE RECORD'S DOMAIN:
                    enrolled prose + Vote Summary (candidate, party long
                    name, formal votes, TOTAL FORMAL VOTES) + the check-
                    count venue grid (venue x candidate votes, per-venue
                    informal, Total rows; the arithmetic always closes).
  <d>-tcp.html.gz  TwoCandidatesPreferredReport — the preference count's own
                    domain (the pair totals include the transfers; its
                    "Total Formal" pool sits ~0.3–1% under the declared
                    formal — recheck trajectories, printed as NOTEs):
                    [pairA, pairB, Exhausted, ..., Total]-row district
                    figures + the same venue rows. Winner and tcp pair come
                    from here; the per-venue pair vessels fill booth tcp.
  <d>-dop.html.gz  never activated for these events (provenance only);
                    NSWEC published no count ladder for the by-elections, so
                    the four districts file fl: [] .

Records (applyNow's data-now contract):
  changes[]  hand-curated member events (the Speaker's writ notices and
             NSWEC declarations)
  holders{}  who sits for each changed district today
  byelections{}  district -> {date, nswEvent, div, booths, formal,
             informal, turnout, enrolment}; the div a deriveDiv-shaped
             record on the NSW frame (candidates sorted by votes,
             [n,ab,pn,bucket,votes,None,elected,0]; tcp the final pair's
             district totals; tpp only where the pair is ALP v LIB (Kiama);
             fl []; enrolled; seifa/demo/h carried from the 2023 base record
             plus the by-election row); booths spliced by applyNow, with
             prev = the matching 2023 booth for the same-place swing lanes.

Venue joins: day booths and in-district EVCs ("<X> - Early Voting Centre" =
the roll's "<X> EVC", or its "… EM Office" when NSWEC housed the early
centre there) take the 2023 placemark roll's premises/locality/postcode and
coordinates; the Sydney-city and interstate EVC rows and TAV/Declared
Facility print no placemark in the SB system and get none here (team rows,
ty 4). Names new to the by-elections are entered by hand in VENUE_HAND
(premises verified against the councils' and organisations' own pages,
coordinates geocoded; NSWEC's venue finder has no archived view of these
events). Anything else unmatched FAILS the build — never a silent drop.

usage: python3 -I .build/map/build_nsw_now.py
"""
import collections
import gzip
import html as H
import json
import os
import re

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CACHE = os.path.join(REPO, ".build", "state-flow-src", "nsw", "byelections")
NSW23_DIR = os.path.join(REPO, ".build", "map", "src", "nsw23")
RES_NSW23 = os.path.join(REPO, "maps", "data", "res-nsw23.json")
OUT = os.path.join(REPO, "maps", "data", "data-now-nsw.json")

AS_OF = "2026-11-04"
EVENTS = {
    "Epping": {"ev": "SB2402", "day": "2024-10-19"},
    "Hornsby": {"ev": "SB2402", "day": "2024-10-19"},
    "Pittwater": {"ev": "SB2402", "day": "2024-10-19"},
    "Kiama": {"ev": "SB2502", "day": "2025-09-13"},
}
# every change in the Assembly since 25 March 2023 (dates: the Speaker's
# writ notices and the NSWEC declarations)
CHANGES = [
    {"div": "Epping", "date": "2024-08-14", "kind": "resigned", "who": "Dominic Perrottet", "from": "LIB", "to": None,
     "text": "Dominic Perrottet resigned from Parliament"},
    {"div": "Hornsby", "date": "2024-08-14", "kind": "resigned", "who": "Matt Kean", "from": "LIB", "to": None,
     "text": "Matt Kean resigned from Parliament"},
    {"div": "Pittwater", "date": "2024-08-29", "kind": "resigned", "who": "Rory Amon", "from": "LIB", "to": None,
     "text": "Rory Amon resigned from Parliament"},
    {"div": "Epping", "date": "2024-10-19", "kind": "by-election", "who": "Monica Tudehope", "from": None, "to": "LIB",
     "text": "Monica Tudehope won the by-election for the Liberal Party"},
    {"div": "Hornsby", "date": "2024-10-19", "kind": "by-election", "who": "James Wallace", "from": None, "to": "LIB",
     "text": "James Wallace won the by-election for the Liberal Party"},
    {"div": "Pittwater", "date": "2024-10-19", "kind": "by-election", "who": "Jacqui Scruby", "from": None, "to": "IND",
     "text": "Jacqui Scruby won the by-election as an independent"},
    # Ward had sat as an independent since 2022; he resigned days before the
    # Assembly were to vote on his expulsion (the Speaker's 12 August writ
    # notice records the letter's receipt)
    {"div": "Kiama", "date": "2025-08-12", "kind": "resigned", "who": "Gareth Ward", "from": "IND", "to": None,
     "text": "Gareth Ward resigned from Parliament ahead of an expulsion vote"},
    {"div": "Kiama", "date": "2025-09-13", "kind": "by-election", "who": "Katelin McInerney", "from": None, "to": "ALP",
     "text": "Katelin McInerney won the by-election for Labor"},
]
HOLDERS = {
    "Epping": {"n": "Monica Tudehope", "ab": "LIB"},
    "Hornsby": {"n": "James Wallace", "ab": "LIB"},
    "Pittwater": {"n": "Jacqui Scruby", "ab": "IND"},
    "Kiama": {"n": "Katelin McInerney", "ab": "ALP"},
}

# venues the by-elections used whose printed label the 2023 placemark roll
# either lacks or binds to a different building: NSWEC reuses the day's
# district-label convention across events but moves premises freely (the
# EVC addresses are verified against the NSWEC media releases of 26 August
# 2026 (Oct-2024 events) and 5 September 2025 (Kiama); the Oct-2024 Sydney
# window was at Level 23, 175 Liverpool Street, Kiama's at the Commission's
# own 231 Elizabeth Street office). Entries key on the NORMALISED label and
# win over the 2023 roll for premises/coordinates; the label's prev join is
# untouched.
VENUE_HAND = {
    "Epping": {
        "Boronia Grove Comm Cntr": {"prem": "Boronia Grove Community Centre", "sub": "Epping", "pc": "2121",
                                    "lat": "-33.7732290", "lon": "151.0796970", "ty": 1},
        "North Rocks Snr Cntr": {"prem": "North Rocks Senior Citizens Centre", "sub": "Carlingford", "pc": "2118",
                                 "lat": "-33.77081", "lon": "151.038566", "ty": 1},
        "Carlingford EVC": {"prem": "North Rocks Senior Citizens Centre", "sub": "Carlingford", "pc": "2118",
                            "lat": "-33.77081", "lon": "151.038566", "ty": 5},
    },
    "Hornsby": {
        "Cherrybrook Guide Hall": {"prem": "Cherrybrook Guide Hall", "sub": "Cherrybrook", "pc": "2126",
                                   "lat": "-33.7249692", "lon": "151.0471288", "ty": 1},
        "Hornsby Council": {"prem": "Hornsby Shire Council Administration Centre", "sub": "Hornsby", "pc": "2077",
                            "lat": "-33.7005192", "lon": "151.0975838", "ty": 1},
        "Cherrybrook EVC": {"prem": "Cherrybrook Scout Hall", "sub": "Cherrybrook", "pc": "2126",
                            "lat": "-33.7146009", "lon": "151.0513775", "ty": 5},
        "Hornsby EVC": {"prem": "Hornsby Shire Council Administration Centre", "sub": "Hornsby", "pc": "2077",
                        "lat": "-33.7005192", "lon": "151.0975838", "ty": 5},
    },
    "Pittwater": {
        "Bayview Sea Scout Hall": {"prem": "Bayview Sea Scout Hall", "sub": "Bayview", "pc": "2104",
                                   "lat": "-33.6610419", "lon": "151.3009079", "ty": 1},
        "Mona Vale Scout Hall": {"prem": "Mona Vale Scout Hall", "sub": "Mona Vale", "pc": "2103",
                                 "lat": "-33.6788797", "lon": "151.3089405", "ty": 1},
        "Pittwater Presbyterian": {"prem": "Pittwater Presbyterian Church", "sub": "Newport", "pc": "2106",
                                   "lat": "-33.6541579", "lon": "151.3190722", "ty": 1},
        "Terrey Hills Comm Cntr": {"prem": "Terrey Hills Community Centre", "sub": "Terrey Hills", "pc": "2084",
                                   "lat": "-33.6821298", "lon": "151.2291830", "ty": 1},
        "Avalon EVC": {"prem": "Avalon Recreation Centre", "sub": "Avalon", "pc": "2107",
                       "lat": "-33.6357270", "lon": "151.3294440", "ty": 5},
        "Mona Vale EVC": {"prem": "Mona Vale Memorial Hall", "sub": "Mona Vale", "pc": "2103",
                          "lat": "-33.6765460", "lon": "151.3039970", "ty": 5},
        "Narrabeen EVC": {"prem": "Bilarong Community Hall", "sub": "North Narrabeen", "pc": "2101",
                          "lat": "-33.7106849", "lon": "151.2880016", "ty": 5},
    },
    "Kiama": {
        "Gerringong RSL Hall": {"prem": "Gerringong RSL Hall", "sub": "Gerringong", "pc": "2534",
                                "lat": "-34.7470839", "lon": "150.8259439", "ty": 1},
        "Centenary Hall": {"prem": "Centenary Hall", "sub": "Albion Park", "pc": "2527",
                           "lat": "-34.5701120", "lon": "150.7773030", "ty": 5},
        "Bomaderry EVC": {"prem": "St Stephen's Anglican Church", "sub": "Bomaderry", "pc": "2541",
                          "lat": "-34.8481301", "lon": "150.6009292", "ty": 5},
    },
}
SYDNEY_BY_EVENT = {
    "SB2402": {"prem": "Sydney Early Voting Centre", "sub": "Sydney", "pc": "2000",
               "lat": "-33.8771511", "lon": "151.2106673", "ty": 5},
    "SB2502": {"prem": "NSW Electoral Commission", "sub": "Sydney", "pc": "2000",
               "lat": "-33.8750254", "lon": "151.2093173", "ty": 5},
}
EXPECTED_CHAMBER = {"alp": 46, "lnp": 35, "grn": 3, "ind": 9}


def fail(msg):
    raise SystemExit(f"nsw-now: {msg}")


# ---- small clones of the base frame's idioms (build_nsw23_data.py) ----
def num(s):
    s = (s or "").replace(",", "").strip()
    return int(s) if re.fullmatch(r"-?\d+", s) else None


def parse_int_cell(s):
    v = num(s)
    if v is None:
        fail(f"odd vote cell {s!r}")
    return v


def txt(c):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def rows_of(table):
    for tr in re.findall(r"<tr.*?</tr>", table, re.S | re.I):
        yield [txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]


def bucket(ab):
    ab = (ab or "").upper()
    if ab in ("ALP", "LAB"):
        return "alp"
    if ab in ("LIB", "NAT", "NP"):
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "ONP", "PHON"):
        return "onp"
    if ab in ("", "IND"):
        return "ind"
    return "oth"


def fix_word(w):
    if w.isupper() and len(w) > 1:
        t = w.capitalize()
        for pre in ("Mc", "O'", "D'"):
            if t.startswith(pre) and len(t) > len(pre):
                t = pre + t[len(pre)].upper() + t[len(pre) + 1:]
        return t
    m = re.fullmatch(r"(Mc|Mac)([A-Z]{2,})", w)
    if m:
        return m.group(1) + m.group(2).capitalize()
    return w


def title_name(given, surname):
    out = []
    for w in (surname or "").split(" "):
        out.append("-".join(fix_word(p) if p else p for p in w.split("-")))
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
        if w.isupper() or re.fullmatch(r"(Mc|Mac)[A-Z]{2,}(?:-[A-Z]+)*", w):
            lead = i + 1
        else:
            break
    if not lead or lead == len(parts):
        return title_name("", n) if n.isupper() else n
    return title_name(" ".join(parts[lead:]), " ".join(parts[:lead]))


HDR_AB_RE = re.compile(r"^(.+?)\s*\(([A-Z]{1,5})\)\s*$")
EW_RE = re.compile(r"^(.*?) - Early Voting Centre$")
DECL_CANON = {"enrolment / provisional": "Enrolment/Provisional",
              "enrolment-provisional": "Enrolment/Provisional"}
SENT = {"total formal", "informals", "informal", "total votes/ ballot papers",
        "total", "count_status", "count status", "total votes/ ballot papers"}


def read_cache(ev, slug, kind):
    p = os.path.join(CACHE, ev, f"{slug}-{kind}.html.gz")
    if not os.path.exists(p):
        fail(f"cache {p} missing — run .build/harvest-nsw-byelections.py")
    with gzip.open(p) as f:
        return f.read().decode("utf-8", "replace")


def tables_of(page):
    return re.findall(r"<table.*?</table>", page, re.S | re.I)


def make_normaliser(roll):
    """The three grids spell venue rows differently ("Carlingford - Early
    Voting Centre" on fp/tcp, "Carlingford EVC" on the check count); fold all
    of them to the roll label (or the normalised team-row stem) so district
    venue sets compare equal across the grids."""
    def norm(nm):
        low = nm.lower().replace("\u2019", "'")
        if low in DECL_CANON:
            return DECL_CANON[low]
        if low == "declared facility":
            return "Declared Facility"
        if low == "sydney evc":
            # the fp/tcp grids' "Sydney - Early Voting Centre" — the shared
            # city window, no district placemark anywhere (team row)
            return "Sydney"
        if low.endswith(" em office evc"):
            # the check count's "<X> EM Office EVC" = the roll's "<X> EM Office"
            stem = nm[:-len(" EVC")]
            if stem.upper() in roll:
                return stem
            return None or nm
        m = EW_RE.match(nm)
        if m:
            stem = m.group(1)
            if stem == "TAV":
                return "TAV"
            if re.match(r"^(ACT|NT|QLD|SA|TAS|VIC|WA) - ", stem):
                return stem
            if stem == "Sydney":
                return "Sydney"
            if stem.upper() in roll:
                # the early centre was housed in a placemark venue whose own
                # name already ends "EM Office" ("Hornsby EM Office - Early
                # Voting Centre")
                return stem
            if f"{stem} EVC".upper() in roll:
                return f"{stem} EVC"
            if f"{stem} EM Office".upper() in roll:
                return f"{stem} EM Office"
            return f"{stem} EVC"  # an unmappable stem — the hand map's lookout
        if nm.upper().endswith(" EVC") and nm.upper() in roll:
            for up, _v in roll.items():
                if up == nm.upper():
                    return _v["Uppn"]
        return nm
    return norm


def parse_grid(page, dist, which):
    """A venue-grid table -> {hdr_cands [(cell_label, ab)], venues [{sec, name,
    votes, tot, inf}], totals votes+formal+informal}. Feed the FIRST table for
    fp/tcp, the SECOND (venue grid) for the check count."""
    page_tabs = tables_of(page)
    want_tabs = {"fp": 1, "tcp": 1, "cc": 2}[which]
    if len(page_tabs) != want_tabs:
        fail(f"{dist}: {which} has {len(page_tabs)} tables, expected {want_tabs}")
    rows = list(rows_of(page_tabs[0] if which != "cc" else page_tabs[1]))
    hdr = rows[0]
    if not hdr or hdr[0] != "Venue and Vote Types":
        fail(f"{dist}: {which} header drift ({hdr!r})")
    i_tf = next((i for i, c in enumerate(hdr[1:]) if c.lower() in SENT), None)
    if i_tf is None:
        fail(f"{dist}: {which} header lacks sentinels ({hdr!r})")
    keys = []
    for cell in hdr[1:][:i_tf]:
        m = HDR_AB_RE.match(cell)
        keys.append((m.group(1).strip(), m.group(2)) if m else (cell.strip(), "IND"))
    venues, sec, totals = [], None, None
    for r in rows[1:]:
        if not r or not r[0]:
            continue
        lab = r[0]
        if lab in ("Voting Centres", "Early Voting Centres", "Declaration Votes"):
            sec = lab
            continue
        if lab.startswith("%"):
            continue
        cells = r[1:]
        if lab.startswith("Total Voting Centre") or lab.startswith("Total Early Voting") \
                or lab.startswith("Total Declaration"):
            continue
        if lab.startswith("Total Votes") or lab == "Total":
            vv = [parse_int_cell(c) if c.replace("\u00a0", "").strip() not in ("", "-") else 0
                  for c in cells]
            totals = vv
            continue
        votes = [parse_int_cell(c) if c.replace("\u00a0", "").strip() not in ("", "-") else 0
                 for c in cells[:len(keys)]]
        tot_f = num(cells[len(keys)]) if len(cells) > len(keys) else None
        inf = num(cells[len(keys) + 1]) if len(cells) > len(keys) + 1 else 0
        if sec is None:
            fail(f"{dist}: {which} venue row {lab!r} before any section head")
        venues.append({"sec": sec, "name": lab, "votes": votes, "tot": tot_f, "inf": inf or 0})
    if totals is None:
        fail(f"{dist}: {which} has no Total row")
    colsum = [sum(v["votes"][i] for v in venues) for i in range(len(keys))]
    if colsum != totals[:len(keys)]:
        fail(f"{dist}: {which} venue sums {colsum} != Total row {totals[:len(keys)]}")
    return {"keys": keys, "venues": venues, "totals": totals,
            "formal": totals[len(keys)], "inf": totals[len(keys) + 1],
            "ncol": len(keys)}


def parse_cc(page, dist):
    """CheckCountPreferencesReport: enrolled prose + Vote Summary (candidate,
    party long name, votes) + grid; the record's domain."""
    m = re.search(r"Electors Enrolled as on ([\d/]+):</(?:span|strong)>\s*([\d,]+)", page)
    if not m:
        fail(f"{dist}: no enrolled prose on the check count")
    enrolled = num(m.group(2))
    summary = list(rows_of(tables_of(page)[0]))
    if not summary or summary[0][:2] != ["Candidate", "Representation"]:
        fail(f"{dist}: check-count summary drift ({summary[:1]!r})")
    cands, formal = [], None
    for r in summary[1:]:
        if not r or not r[0]:
            continue
        if r[0].upper().startswith("TOTAL FORMAL"):
            formal = parse_int_cell(r[2])
            continue
        cands.append({"nm": r[0], "pn": r[1], "v": parse_int_cell(r[2])})
    if formal is None or not cands:
        fail(f"{dist}: check count lacks its summary ({len(cands)} rows)")
    if sum(c["v"] for c in cands) != formal:
        fail(f"{dist}: check-count summary sum != its Total Formal {formal}")
    grid = parse_grid(page, dist, "cc")
    return {"enrolled": enrolled, "cands": cands, "formal": formal, "grid": grid}


def parse_tcp(page, dist):
    """TwoCandidatesPreferredReport: per-venue rows of [pairA, pairB,
    Exhausted, Total Formal, Informal, Total], section subtotals and a Total
    row in the same layout. No candidate grid column — the venue list and
    the pair come from here."""
    rows = list(rows_of(tables_of(page)[0]))
    hdr = rows[0]
    if not hdr or hdr[0] != "Venue and Vote Types":
        fail(f"{dist}: tcp header drift ({hdr!r})")
    m1, m2 = HDR_AB_RE.match(hdr[1]), HDR_AB_RE.match(hdr[2])
    if not m1 or not m2:
        fail(f"{dist}: tcp pair cells drift ({hdr[1:3]!r})")
    pair = [(m1.group(1).strip(), m1.group(2)), (m2.group(1).strip(), m2.group(2))]
    if [c.strip() for c in hdr[3:7]] != ["Exhausted", "Total Formal", "Informal", "Total"]:
        fail(f"{dist}: tcp sentinel drift ({hdr[3:7]!r})")
    venues, totals = {}, None
    for r in rows[1:]:
        if not r or not r[0] or r[0] in ("Voting Centres", "Early Voting Centres",
                                         "Declaration Votes") or r[0].startswith(("%", "Voting Centres Sub", "Declaration Votes Sub")):
            continue
        cells = [parse_int_cell(c) if c.replace("\u00a0", "").strip() not in ("", "-") else 0
                 for c in r[1:6]]
        if sum(cells[:3]) != cells[3]:
            fail(f"{dist}: tcp row {r[0]!r} pair+exhausted != formal ({cells})")
        if r[0] == "Total":
            totals = cells
            continue
        if r[0] in venues:
            fail(f"{dist}: tcp venue {r[0]!r} twice")
        venues[r[0]] = cells
    if totals is None:
        fail(f"{dist}: tcp has no Total row")
    if sum(v[3] for v in venues.values()) != totals[3]:
        # the SB grids print declaration piles which subtotal sections already
        # cover; here every printed row is a venue, so sums must reach Total
        fail(f"{dist}: tcp venue formal sums != Total formal {totals[3]}")
    return {"pair": pair, "venues": venues, "totals": totals}


def main():
    with open(RES_NSW23) as f:
        base = json.load(f)
    by_name = {d["n"]: i for i, d in enumerate(base["divs"])}
    for d in EVENTS:
        if d not in by_name:
            fail(f"{d}: not a district of the 2023 frame")
    B23 = base["booths"]
    n23 = len(B23["id"])
    prev_idx = {}
    for i, d in enumerate(base["divs"]):
        cell = {}
        for j in range(n23):
            if B23["d"][j] == i:
                if B23["n"][j] in cell:
                    fail(f"{d['n']}: 2023 booth lane names {B23['n'][j]!r} twice")
                cell[B23["n"][j]] = j
        prev_idx[d["n"]] = cell
    roll_dir = os.path.join(NSW23_DIR, "venues", "SG2301")
    roll_files = {}
    for fn in os.listdir(roll_dir):
        slug = fn.split("-", 1)[1].removesuffix(".json")
        roll = {}
        for v in json.load(open(os.path.join(roll_dir, fn))):
            up = (v.get("Uppn") or "").upper()
            if up:
                roll[up] = v
        roll_files[slug] = roll

    out = {"asOf": AS_OF, "changes": CHANGES, "holders": HOLDERS, "byelections": {}}
    seats = collections.Counter()
    for d in base["divs"]:
        w = next(c for c in d["c"] if c[6] == 1)
        seats[w[3]] += 1

    for dist, e in EVENTS.items():
        slug = dist.lower()
        cc = parse_cc(read_cache(e["ev"], slug, "cc"), dist)
        fp = parse_grid(read_cache(e["ev"], slug, "fp"), dist, "fp")
        tcp = parse_tcp(read_cache(e["ev"], slug, "tcp"), dist)

        # candidate roll: check-count summary names + the fp header's affiliations
        fp_hdr = {}
        for cell_lab, ab in fp["keys"]:
            fp_hdr[flat_name(cell_lab).lower()] = (ab, cell_lab)
        rows = []
        for c in cc["cands"]:
            nm = flat_name(c["nm"])
            hit = fp_hdr.get(nm.lower())
            if hit is None:
                fail(f"{dist}: check-count candidate {nm!r} not on the fp header")
            # NSWEC's "LP" is the Libertarian Party here (the base frame's FAM
            # table reads LP as the Liberals) — file Libertarian as LTP, which
            # the app's own vocabulary already names
            ab = {"LAB": "ALP", "LP": "LTP"}.get(hit[0], hit[0])
            rows.append({"n": nm, "ab": ab, "pn": c["pn"] or "Independent",
                         "b": bucket(ab), "v": c["v"]})
        cc_by_nm = {r["n"].lower(): r for r in rows}
        if len(cc_by_nm) != len(rows):
            fail(f"{dist}: check-count candidates collide after name flatten")
        # the fp venue grid reconciles per candidate (recheck deltas NOTE'd)
        fp_colsum = fp["totals"][:len(fp["keys"])]
        for cell_lab, _ab in fp["keys"]:
            nm = flat_name(cell_lab).lower()
            if nm not in cc_by_nm:
                fail(f"{dist}: fp header candidate {cell_lab!r} is no check-count row")
        for i, (cell_lab, _ab) in enumerate(fp["keys"]):
            nm = flat_name(cell_lab).lower()
            r = cc_by_nm[nm]
            if fp_colsum[i] != r["v"]:
                print(f"note: {dist} {r['n']}: check count {r['v']} vs fp report {fp_colsum[i]}")
        if fp["formal"] != cc["formal"]:
            print(f"note: {dist}: check count formal {cc['formal']} vs fp report {fp['formal']}"
                  f" (recheck moves {cc['formal'] - fp['formal']:+d})")
        if cc["grid"]["formal"] != cc["formal"]:
            fail(f"{dist}: check-count grid formal {cc['grid']['formal']} != summary {cc['formal']}")
        if sum(v["inf"] for v in cc["grid"]["venues"]) != cc["grid"]["inf"]:
            fail(f"{dist}: check-count venue infs != its Total informal")
        # the venue rolls must agree across the three grids, name-normalised
        roll = roll_files.get(slug)
        if not roll:
            fail(f"{dist}: no 2023 placemark roll file")
        norm = make_normaliser(roll)
        for gr in (fp, cc["grid"]):
            for v in gr["venues"]:
                v["name"] = norm(v["name"])
        tcp_v = {norm(k): val for k, val in tcp["venues"].items()}
        tcp["venues"] = tcp_v
        fp_names = {v["name"] for v in fp["venues"]}
        cc_names = {v["name"] for v in cc["grid"]["venues"]}
        if len(cc_names) != len(cc["grid"]["venues"]):
            fail(f"{dist}: check-count venue names collide after normalisation")
        if fp_names != cc_names:
            fail(f"{dist}: fp/check-count venue rolls disagree "
                 f"(fp-only {sorted(fp_names - cc_names)[:3]}, cc-only {sorted(cc_names - fp_names)[:3]})")
        tcp_names = set(tcp["venues"])
        if tcp_names != cc_names:
            fail(f"{dist}: tcp venue roll disagrees with the check count "
                 f"(tcp-only {sorted(tcp_names - cc_names)[:3]}, cc-only {sorted(cc_names - tcp_names)[:3]})")

        # the final pair, reconciled to the roll
        pair_i = []
        for nm0, _ab in tcp["pair"]:
            nm = flat_name(nm0).lower()
            hit = next((i for i, r in enumerate(rows) if r["n"].lower() == nm), None)
            if hit is None:
                fail(f"{dist}: tcp finalist {nm0!r} is no check-count candidate")
            pair_i.append(hit)
        pt0, pt1 = tcp["totals"][0], tcp["totals"][1]
        tcp_informal = tcp["totals"][4]
        if pt0 == pt1:
            fail(f"{dist}: tcp Total row is a dead heat")
        win_i = pair_i[0] if pt0 > pt1 else pair_i[1]
        winner = rows[win_i]["n"]
        if winner != HOLDERS[dist]["n"] or rows[win_i]["ab"] != HOLDERS[dist]["ab"]:
            fail(f"{dist}: tcp winner {winner} ({rows[win_i]['ab']}) disagrees with the hand ledger")
        if tcp["totals"][3] != cc["formal"]:
            print(f"note: {dist}: tcp count pool {tcp['totals'][3]} vs declared formal "
                  f"{cc['formal']} ({tcp['totals'][3] - cc['formal']:+d})")
        if tcp_informal != cc["grid"]["inf"]:
            print(f"note: {dist}: tcp informal {tcp_informal} vs declared {cc['grid']['inf']}")

        for r in rows:
            r["el"] = r["n"] == winner
        # names ride the sort; the pair's votes were read in the check count's
        # own order, so re-anchor the pair to names before indexing
        pair_nm = [rows[pair_i[0]]["n"], rows[pair_i[1]]["n"]]
        rows.sort(key=lambda r: -r["v"])
        by_nm = {r["n"]: k for k, r in enumerate(rows)}
        a_i = by_nm[pair_nm[0]]
        b_i = by_nm[pair_nm[1]]
        tcp_pair = [[a_i, pt0], [b_i, pt1]]
        tpp = None
        pb = {rows[a_i]["b"], rows[b_i]["b"]}
        if pb == {"alp", "lnp"}:
            va = pt0 if rows[a_i]["b"] == "alp" else pt1
            vb = pt1 if rows[a_i]["b"] == "alp" else pt0
            tpp = [va, vb, None]

        # booths: every printed venue row resolves to the hand record (which
        # even an otherwise-roll-hitting EVC label can own — premises move),
        # the 2023 placemark roll, or the no-premises team-row class (names
        # already normalised against the roll in the cross-grid proof)
        recs = []
        seen = set()
        for v in cc["grid"]["venues"]:
            nm = v["name"]
            if nm in seen:
                fail(f"{dist}: check-count prints venue {nm!r} twice")
            seen.add(nm)
            if v["sec"] == "Declaration Votes":
                continue
            team = nm in ("TAV", "Declared Facility") or \
                bool(re.match(r"^(ACT|NT|QLD|SA|TAS|VIC|WA) - ", nm))
            hand = VENUE_HAND.get(dist, {}).get(nm)
            if nm == "Sydney":
                hand = SYDNEY_BY_EVENT[e["ev"]]
            if hand:
                rec = {"Premises": hand["prem"], "Locality": hand["sub"], "Postcode": hand["pc"],
                       "Lat": hand["lat"], "Lon": hand["lon"]}
                recs.append({"lab": nm, "v": v, "rec": rec, "ty": hand.get("ty", 1)})
            elif team:
                recs.append({"lab": nm, "v": v, "rec": None, "ty": 4})
            elif nm.upper() not in roll:
                fail(f"{dist}: venue {nm!r} is in neither the 2023 roll nor VENUE_HAND")
            else:
                rec = roll[nm.upper()]
                ty = 5 if nm.upper().endswith(" EVC") else (4 if nm.upper().endswith(" EM OFFICE") else 1)
                recs.append({"lab": nm, "v": v, "rec": rec, "ty": ty})
        labs = [r["lab"] for r in recs]
        if len(set(labs)) != len(labs):
            fail(f"{dist}: booth labels collide after normalisation {sorted(labs)}")

        bi = by_name[dist]
        bdiv = base["divs"][bi]
        D = {
            "id": bdiv["id"], "n": bdiv["n"], "st": "NSW",
            "c": [[r["n"], r["ab"], r["pn"], r["b"], r["v"], None, 1 if r["el"] else 0, 0] for r in rows],
            "inf": cc["grid"]["inf"],
            "tcp": tcp_pair,
            "fl": [],
            "h": bdiv["h"] + [[int(e["day"][:4]), None, rows[[i for i, r in enumerate(rows) if r["el"]][0]]["ab"],
                             winner, "by"]],
            "enrolled": cc["enrolled"],
            "demo": bdiv.get("demo"),
            "seifa": bdiv.get("seifa"),
        }
        if tpp:
            D["tpp"] = tpp
        Bb = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                              "v", "inf", "tpp", "tcp", "fl", "dec", "vdec", "prev")}
        keep23 = prev_idx[dist]
        for i2, r in enumerate(recs):
            v = r["v"]
            votes = [0] * len(rows)
            for i, (cell_lab, _ab) in enumerate(fp["keys"]):
                votes[by_nm[flat_name(cell_lab)]] = v["votes"][i]
            lab = r["lab"]
            rec = r["rec"]
            lat = (rec or {}).get("Lat")
            lon = (rec or {}).get("Lon")
            Bb["d"].append(0)
            Bb["id"].append(f"nswnow-{bi}-{i2}")
            Bb["n"].append(lab)
            Bb["ty"].append(r["ty"])
            Bb["prem"].append((rec or {}).get("Premises"))
            Bb["sub"].append((rec or {}).get("Locality"))
            Bb["pc"].append((rec or "").get("Postcode") if rec else None)
            Bb["lat"].append(round(float(lat), 5) if lat else None)
            Bb["lon"].append(round(float(lon), 5) if lon else None)
            Bb["v"].append(votes)
            Bb["inf"].append(v["inf"])
            Bb["tpp"].append(None)
            trow = tcp["venues"][v["name"]]
            Bb["tcp"].append([trow[0], trow[1]])
            Bb["fl"].append(None)
            Bb["dec"].append(None)
            Bb["vdec"].append(None)
            Bb["prev"].append(keep23.get(lab))
        lapsed = [n for n in keep23 if n not in labs
                  and n not in ("Postal", "Absent", "Enrolment/Provisional", "Enrolment-Provisional")]
        out["byelections"][dist] = {
            "date": e["day"], "nswEvent": e["ev"], "div": D, "booths": Bb,
            "formal": cc["formal"], "informal": cc["grid"]["inf"],
            "turnout": cc["formal"] + cc["grid"]["inf"], "enrolment": cc["enrolled"],
            "lapsed2023": lapsed,
        }
        win_b = rows[[i for i, r in enumerate(rows) if r["el"]][0]]["b"]
        base_b = next(c for c in bdiv["c"] if c[6] == 1)[3]
        seats[win_b] += 1
        seats[base_b] -= 1
        print(f"{dist}: {e['ev']} formal {cc['formal']} informal {cc['grid']['inf']} "
              f"turnout {cc['formal'] + cc['grid']['inf']} | {len(recs)} booths "
              f"| winner {winner} ({rows[[i for i, r in enumerate(rows) if r['el']][0]]['ab']}) "
              f"| lapsed 2023 booths {len(lapsed)}")

    got = dict(sorted(seats.items()))
    if got != EXPECTED_CHAMBER:
        fail(f"chamber after by-elections {got} != expected {EXPECTED_CHAMBER}")
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"chamber after by-elections: {got}")
    print(f"nsw-now -> {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
