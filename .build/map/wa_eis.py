#!/usr/bin/env python3
"""wa_eis.py — the wa17/wa21/wa25 /map/ frame parser: EIS results-API mirror
(+ its venue-register neighbours) -> the emitter's district model.

Reads (all committed mirrors; nothing is fetched here):
  .build/state-flow-src/wa/sg<YYYY>/<CODE>.json     per-district results —
      candidates, booth rows ("SURNAME - CODE" columns), district 2CP, the
      distribution, tally totals (the state-flows pipeline's mirror, see
      .build/harvest-wa-state-flows.py)
  .build/map/src/wa/sg<YYYY>-root.json              electorate roster with
      Lat/Long/Zoom (the district-mid fallback) and the count card
  .build/map/src/wa/sg<YYYY>-candidates.json        LACandidateParty: full
      party names + "SURNAME, Given" rosters per candidate
  .build/map/src/wa/pp-YYYY.xlsx                    venue registers with
      coordinates (official 2017 file; The Tally Room's for 2025 — the
      2021 register is optional while Ben's Drive folder stands walled)
  .build/map/src/wa/tcp-2025.xlsx                   The Tally Room's per-venue
      2CP for 2025 (the only era publishing one; 17/21 booth tcp stays null,
      the qld17 precedent)

Doctrine carried from qld_ecq/build_qld_common.py: real venues only enter
the booth lane (day booths + early voting centres); Count-Centre rows and
the 2017/2021-era aggregate "Special Institutions,  Hospitals & Remotes"
row fold into the district totals and never appear as dots; lane formal +
pseudo formal == district formal per party-code AND statewide, asserted
fail-loud. Candidate-column joining is verbatim `"{BALLOT_PAPER_NAME} -
{PARTY_AFFILIATION}"` — minus one wrinkle: EIS column headings drop the
names' leading apostrophes ("'t HART" heads "t HART - ACP"), which the
matcher folds by normalising both sides, never by guessing.
"""
import json
import os
import re
import collections

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SFS = os.path.join(REPO, ".build", "state-flow-src", "wa")
SRCW = os.path.join(REPO, ".build", "map", "src", "wa")

YEARS = {"wa17": 2017, "wa21": 2021, "wa25": 2025, "wa13": 2013}
PSEUDO_GROUPS = ("Count Centre",)
MOBILE_RE = re.compile(r"^Special Institutions,\s{1,2}Hospitals & Remotes$", re.I)
MOBILE25_RE = re.compile(r"^Mobile Polling$", re.I)
EVC_RE = re.compile(r"(early polling place|early voting centre|voting centre$|"
                    r"early ct$|\bEVC\b|deliberative)", re.I)
BUCKETS = {"ALP": "alp", "LIB": "lnp", "NAT": "lnp", "NATS": "lnp",
           "GRN": "grn", "PHON": "onp", "ONP": "onp"}


def fail(msg):
    raise SystemExit(f"wa-eis: {msg}")


def norm_key(s):
    """Case/punctuation-insensitive join key: 'ALBANY PCYC' == 'Albany PCYC'."""
    return re.sub(r"[^A-Z0-9]+", " ", str(s or "").upper()).strip()


def bn_int(v):
    if v is None or v == "":
        return 0
    return int(str(v).replace(",", "").strip())


def bucket(ab):
    return BUCKETS.get(ab, "ind" if ab in ("IND", "") else "oth")


# ---------------------------------------------------------------- registers
def openpyxl_rows(path):
    try:
        import openpyxl
    except ImportError:
        fail(f"openpyxl required to read {path}")
    ws = openpyxl.load_workbook(path, read_only=True).active
    return [list(r) for r in ws.iter_rows(values_only=True)]


def registers(year):
    """{(district-key, venue-key): (lat, lon, rty)} — per-venue coordinates.
    rty 5 marks an early centre (the qld-era booth-type numbering); plain day
    booths 1. The 2017 file is official WAEC; the 2021/2025 rows are The
    Tally Room's geolocated registers. For 2021 the 2017+2025 union backfills
    while the Tally Room folder stands sign-in-walled: its stale venues just
    miss the join and those booths keep null coords — the app's contract."""
    out = {}

    def put(dist, venue, lat, lon, rty):
        if lat is None:
            return
        out.setdefault((norm_key(dist), norm_key(venue)), (lat, lon, rty))

    p17 = os.path.join(SRCW, "pp-2017.xlsx")
    if os.path.exists(p17):
        rows = openpyxl_rows(p17)
        h = [str(c).lower().strip() if c is not None else "" for c in rows[0]]
        i = {k: h.index(k) for k in ("district", "venue name", "latitude", "longitude")}
        for r in rows[1:]:
            if r[i["district"]] is None:
                continue
            try:
                lat, lon = float(r[i["latitude"]]), float(r[i["longitude"]])
            except (TypeError, ValueError):
                continue
            put(r[i["district"]], r[i["venue name"]], lat, lon, 1)
    for yr in (2021, 2025):
        p = os.path.join(SRCW, f"pp-{yr}.xlsx")
        if not os.path.exists(p):
            continue
        rows = openpyxl_rows(p)
        h = [str(c).lower().strip() if c is not None else "" for c in rows[0]]
        try:
            i = {k: h.index(k) for k in ("district_name", "pp_name", "latitude", "longitude", "pp_type")}
        except ValueError:
            fail(f"{p}: register header drifted: {h[:10]}")
        for r in rows[1:]:
            if r[i["district_name"]] is None:
                continue
            try:
                lat, lon = float(r[i["latitude"]]), float(r[i["longitude"]])
            except (TypeError, ValueError):
                continue
            put(r[i["district_name"]], r[i["pp_name"]], lat, lon,
                5 if str(r[i["pp_type"]]).strip() == "2" else 1)
    return out


def sur_case(s):
    """'HART -> 't Hart, O'MALLEY -> O'Malley, MURRAY-WELLINGTON -> Murray-Wellington."""
    low = s.lower()
    for lead in ("'t ", "de ", "van ", "la ", "di ", "d'"):
        if low.startswith(lead):
            return lead + s[len(lead):].title()
    return s.title()


def load_rosters(year):
    rows = json.load(open(os.path.join(SRCW, f"sg{year}-candidates.json"))).get("LACandidateParty")
    if not rows:
        fail(f"sg{year}-candidates.json lacks LACandidateParty")
    roster = {}
    for r in rows:
        ec, bp, pa = r["ELECTORATE_CODE"], r["BALLOT_PAPER_NAME"], r["PARTY_AFFILIATION"]
        if "," in bp:
            sur, given = bp.split(",", 1)
            disp = f"{given.strip()} {sur_case(sur.strip())}"
        else:
            sur, disp = bp, sur_case(bp.strip())
        roster.setdefault((ec, norm_key(sur)), []).append((disp, pa))
    return roster


def party_names(code2long):
    """code -> registered long name: the candidate-level joins under
    parse_district see every district file's short code beside the roster's
    long names; majority wins the code's display name."""
    return {ab: names.most_common(1)[0][0] for ab, names in code2long.items() if names}


# ------------------------------------------------------------------- parse
def parse_district(path, roster, regs, code2long):
    d = json.load(open(path))
    ec = d["currentElectorate"]["ElectorateCode"]
    name = d["currentElectorate"]["ElectorateName"]
    tt = d["toptotals"]
    enrolled = bn_int(tt["NUMBER_ELECTORS"])
    informal = bn_int(tt["INFORMAL_LAST_PUBLISHED_NUMBER_ENTERED"])

    cands = []
    for c in d["resultsCandidates"]:
        sur, ab = c["BALLOT_PAPER_NAME"], c["PARTY_AFFILIATION"]
        hits = roster.get((ec, norm_key(sur))) or []
        disp, plong = hits[0] if hits else (sur.title(), ab)
        if plong:
            code2long[ab][plong] += 1
        cands.append({
            "key": (ec, norm_key(sur), ab),
            "col_sur": sur.replace("'", ""),     # EIS headings drop apostrophes anywhere
            "sur": norm_key(sur),
            "ab": ab, "ord": int(c["Ballot_Paper_Order"]),
            "n": disp, "pn": plong, "b": bucket(ab),
            "v": bn_int(c["Votes_Counted"]),
        })

    def col_for(a):
        # independents' columns are the bare surname; parties' "<SUR> - <CODE>"
        return a["col_sur"] if not a["ab"] else f"{a['col_sur']} - {a['ab']}"

    booths = []
    pseudo_formal = 0
    pseudo_inf = 0
    zero_rows = 0
    for r in d["resultsPollingPlace"]:
        nm = r["BREAKDOWN_NAME"].strip()
        pseudo = (r["BREAKDOWN_GROUP"] in PSEUDO_GROUPS or bool(MOBILE_RE.match(nm))
                  or bool(MOBILE25_RE.match(nm)))
        vrow = [bn_int(r.get(col_for(a))) for a in cands]
        formal = bn_int(r.get("Total Votes")) - bn_int(r.get("Informal"))
        if sum(vrow) != formal:
            fail(f"{name}: row {nm!r} candidate sum {sum(vrow)} != row formal {formal}")
        if pseudo:
            pseudo_formal += formal
            pseudo_inf += bn_int(r.get("Informal"))
            continue
        dist_key, vkey = norm_key(name), norm_key(nm)
        geo = regs.get((dist_key, vkey))
        lat = lon = None
        ty = 5 if EVC_RE.search(nm.lower()) else 1
        if geo:
            lat, lon, rty = geo
            if rty == 5:
                ty = 5
        if formal == 0:
            zero_rows += 1
        booths.append({"name": nm, "ty": ty, "lat": lat, "lon": lon,
                       "pv": vrow, "informal": bn_int(r.get("Informal"))})

    formal_lane = sum(sum(b["pv"]) for b in booths)
    tot_cand = sum(a["v"] for a in cands)
    if formal_lane + pseudo_formal != tot_cand:
        fail(f"{name}: lane {formal_lane} + pseudo {pseudo_formal} != district formal {tot_cand}")
    if informal < pseudo_inf:
        fail(f"{name}: pseudo informal exceeds district informal")

    tcp = []
    elected = None
    winv = -1
    for tr in d["results2CP"]:
        sur, ab = tr["Ballot_Paper_Name"].rsplit(" - ", 1)
        key = norm_key(sur)
        hit = next((a for a in cands if a["sur"] == key and a["ab"] == ab), None) or \
              next((a for a in cands if a["sur"] == key), None)
        if hit is None:
            fail(f"{name}: 2CP candidate {tr['Ballot_Paper_Name']} off the roster")
        v = bn_int(tr["Votes_Counted"])
        tcp.append({"key": hit["key"], "v": v})
        if v > winv:
            winv, elected = v, hit
    if elected is None:
        fail(f"{name}: no 2CP pair")

    return {
        "name": name, "cands": cands, "booths": booths, "tcp": tcp,
        "elected": elected["key"],
        "formal": tot_cand, "informal": informal, "enrolled": enrolled,
        "zero_rows": zero_rows,
    }


def load(frame):
    year = YEARS[frame]
    roster = load_rosters(year)
    regs = registers(year)
    dd = os.path.join(SFS, f"sg{year}")
    files = sorted(f for f in os.listdir(dd) if f.endswith(".json"))
    if len(files) != 59:
        fail(f"sg{year}: {len(files)} district files (want 59)")
    code2long = collections.defaultdict(collections.Counter)
    districts = []
    for fn in files:
        if fn.startswith("_"):
            continue
        districts.append(parse_district(os.path.join(dd, fn), roster, regs, code2long))
    # majority long name per short code, for the emitters' pn lane
    pn = party_names(code2long)
    for dist in districts:
        for a in dist["cands"]:
            if not a["pn"] or a["pn"] == a["ab"]:
                a["pn"] = pn.get(a["ab"], a["ab"] or "Independent")
    return {"year": year, "districts": districts}
