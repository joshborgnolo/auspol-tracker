"""GCP-2021 new-lane cell counts for the /map/ state-frame census joins.

One tiny reader shared by build_sa_boothcensus.py, build_sa26_demo.py,
build_nsw23_boothcensus.py and build_nsw23_demo.py: the six new People
lanes' per-SA1 counts from the 2021 GCP SA1 datapack, keyed one row
plainly so each caller folds/shares with its own safe()/acc recipe.
This module deliberately re-reads the tables rather than import the
federal seat-model pipelines; the column choices and bases IDENTICALLY
mirror derive-booth-seifa-voter.py's new-lane tables (the sess stores
pin them), namely:

  G01 — the six highest-year-of-schooling persons columns (the
        y12less lane's numerator = the five sub-Year-12 printed
        levels, denominator their stated sum)
  G07 — Indigenous status, the table's OWN Tot row (the per-band
        Indigenous columns individually suppress small cells and
        underread a fifth nationally)
  G14 — the Religion menu's ten categories plus affiliation-not-stated
        and total (ex-not-stated persons basis; orth = Eastern +
        Oriental orthodox)
  G32 — family composition totals (one-parent over all four totals)
  G37 — tenure by landlord totals (owned/mortgaged/rented-all/
        rented-state-housing-authority/other, over the
        ex-tenure-not-stated occupied-private-dwellings basis)

keys emitted: G01 {code: 6-tuple}, G07 {code: (indig, indig+nonindig)},
G14 {code: (relvec10, relNS, relTot)}, G32 {code: (onepar, famTot)},
G37 {code: (own, mort, rent, rentPub, othType, tenNS)}.
"""

import csv
import io
import json
import os
import zipfile

_REPO = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", ".."))


def hl_alloc_of(ed, form):
    """The homeless lane's est-allocation (2026-10-31 lanes arc):
    {unit: {"e": est, "p": pop}} per edition's key form ("m"
    SA1-main | "c7" cube-7-digit), from
    .build/analysis/seat-model/cache/homeless-sa1-<ed>-alloc.json —
    derive-booth-homeless era reads via homeless_alloc.alloc_of; the
    state frames read the same caches through this mirror (the module
    deliberately stays seat-model-free, like the rest of its readers)."""
    p = os.path.join(_REPO, ".build/analysis/seat-model/cache",
                     f"homeless-sa1-{ed}-alloc.json")
    if not os.path.exists(p):
        _fail(f"missing {p} (run .build/analysis/seat-model/"
              "homeless_alloc.py)")
    d = json.load(open(p, encoding="utf-8"))
    if form not in d or not d[form]:
        _fail(f"homeless alloc {ed}/{form}: empty form")
    return d[form]


GCP_ZIP = None  # set via connect(); module stays import-light (no heavy read)
GCP_ROWS = 61844
GCP16_ROWS = 57523
# per-vintage member table ids: the same concepts ride differently-
# numbered tables per GCP edition (tenure's landlord grid is G37 in
# 2021, G33 in 2016; family composition G32 vs G28; the religion and
# Indigenous-status names are edition-stable)
VINTAGES = {
    "2021": dict(rows=GCP_ROWS,
                 member="2021 Census GCP Statistical Area 1 for AUS/"
                        "2021Census_{table}_AUST_SA1.csv",
                 key="SA1_CODE_2021", school="G01", indig="G07",
                 religion="G14", tenure="G37", family="G32"),
    "2016": dict(rows=GCP16_ROWS,
                 member="2016 Census GCP Statistical Area 1 for AUST/"
                        "2016Census_{table}_AUS_SA1.csv",
                 key="SA1_7DIGITCODE_2016", school="G01", indig="G07",
                 religion="G14", tenure="G33", family="G28"),
}
DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
AGE_COLS = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
SCHOOL_COLS = ["High_yr_schl_comp_Yr_12_eq_P",
               "High_yr_schl_comp_Yr_11_eq_P",
               "High_yr_schl_comp_Yr_10_eq_P",
               "High_yr_schl_comp_Yr_9_eq_P",
               "High_yr_schl_comp_Yr_8_belw_P",
               "High_yr_schl_comp_D_n_g_sch_P"]
REL_KEYS = ["norel", "cath", "angl", "unch", "pres", "orth", "budd",
            "isl", "hind", "jew"]
REL_MAP = {
    "norel": ["SB_OSB_NRA_NR_P"],
    "cath": ["Christianity_Catholic_P"],
    "angl": ["Christianity_Anglican_P"],
    "unch": ["Christianity_Uniting_Church_P"],
    "pres": ["Christinty_Prsbytrin_Refrmd_P"],
    "orth": ["Christianity_Eastrn_Orthdox_P",
             "Christianity_Orintal_Orthdx_P"],
    "budd": ["Buddhism_P"],
    "isl": ["Islam_P"],
    "hind": ["Hinduism_P"],
    "jew": ["Judaism_P"],
}
G14_TAIL = ["Religious_affiliation_ns_P", "Tot_P"]
# ---- the 2026-10-31 people-lanes arc (public transport to work,
# non-citizens, women with three or more children, Ancestry): G01's
# Australian-citizens cell; the era's method-of-travel table (G62/G59);
# children-ever-born (G28/G24); ancestry (G08's Tot-response cells ex
# the ancestry-not-stated responses — a not-stated person counts
# exactly one not-stated response, so the NS response cell IS the
# person-level NS; people could name two ancestries and the shares
# are independent, never normalised). Column spellings drifted at
# 2021 (tram "or lt rail" and three-method train; G08's _Tot_resp
# lower-case). Reader table ids per vintage mirror
# derive-booth-seifa-voter.py's new_lane_tables arc block.
ANC_KEYS = ["english", "australian", "irish", "scottish", "chinese",
            "italian", "german", "indian", "filipino", "dutch",
            "vietnamese", "lebanese"]
ARC = {
    "2021": dict(travel="G62", children="G28", ancestry="G08",
                 tram="One_met_Tram_or_lt_rail_P",
                 three_tr="Three_meth_Tr_2_oth_meth_P",
                 resp_sfx="resp", ns_resp="Ancestry_NS_Tot_resp",
                 tot_resp="Tot_P_Tot_resp"),
    "2016": dict(travel="G59", children="G24", ancestry="G08",
                 tram="One_met_Tram_incl_lt_rail_P",
                 three_tr="Three_meth_Trn_two_othr_met_P",
                 resp_sfx="Resp", ns_resp="Ancestry_NS_Tot_Resp",
                 tot_resp="Tot_P_Tot_Resp"),
}


def load_arc31(gcp_zip, prefix="", era="2021", rows_pin=None,
               key_col=None):
    """The 2026-10-31 lanes arc per SA1 -> {code: (citz,
    (ptn, ptot, ptns), (ceb3p, cebns, cebtot), (ancvec12, ancTotP,
    ancNS))}; universes assert against load()'s own G01 set."""
    v = VINTAGES[era]
    a = ARC[era]
    memb = v["member"].format
    idc = key_col or v["key"]
    pin = rows_pin or v["rows"]
    z = zipfile.ZipFile(gcp_zip)
    g01c = _table(z, memb(table="G01"), idc, ["Australian_citizen_P"],
                  pin, prefix)
    mtw = _table(
        z, memb(table=a["travel"]), idc,
        ["One_method_Train_P", "One_method_Bus_P",
         "One_method_Ferry_P", a["tram"],
         "Two_methods_Train_Tot_P", "Two_methods_Bus_Tot_P",
         "Two_methods_Train_Bus_P", a["three_tr"],
         "Three_met_Bs_2_ot_met_ex_tr_P",
         "Tot_P", "Method_travel_to_work_ns_P"], pin, prefix)
    ceb = _table(z, memb(table=a["children"]), idc,
                 ["Tot_Nmbr_children_ever_born_3",
                  "Tot_Nmbr_children_ever_born_4",
                  "Tot_Nmbr_children_ever_born_5",
                  "Tot_Nmbr_chidrn_ever_brn_6_mr",
                  "Tot_Nmbr_childrn_ever_born_Ns", "Total_Total"],
                 pin, prefix)
    anc_cols = [f"{b}_Tot_{a['resp_sfx']}" for b in
                ("English", "Aust", "Irish", "Scottish", "Chinese",
                 "Italian", "German", "Indian", "Filipino", "Dutch",
                 "Vietnamese", "Lebanese")]
    anc = _table(z, memb(table=a["ancestry"]), idc,
                 anc_cols + [a["ns_resp"], a["tot_resp"]], pin, prefix)
    if not (set(g01c) == set(mtw) == set(ceb) == set(anc)):
        _fail("arc-31 SA1 universes diverge")
    out = {}
    for code in g01c:
        t = mtw[code]
        tr1, bu1, fe1, tm1, tr2, bu2, tb2, t3t, t3b = t[:9]
        ptn = tr1 + bu1 + fe1 + tm1 + tr2 + bu2 - tb2 + t3t + t3b
        c = ceb[code]
        anc_row = anc[code]
        out[code] = (g01c[code][0], (ptn, t[9], t[10]),
                     (c[0] + c[1] + c[2] + c[3], c[4], c[5]),
                     (anc_row[:len(ANC_KEYS)], anc_row[-1], anc_row[-2]))
    print(f"GCP arc-31 cells: {len(out)} SA1s (prefix {prefix or 'AU'}, "
          f"era {era})")
    return out


def _fail(msg):
    raise SystemExit(f"gcp-newlanes: {msg}")


def _table(z, member, idcol, cols, rows_pin, prefix):
    if member not in z.namelist():
        _fail(f"GCP zip lacks {member}")
    out = {}
    n = 0
    with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        fn = rdr.fieldnames or []
        miss = [c for c in [idcol, *cols] if c not in fn]
        if miss:
            _fail(f"GCP {member.split('/')[-1]} header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row[idcol]
            if prefix and not code.startswith(prefix):
                continue
            if code in out:
                _fail(f"GCP {member.split('/')[-1]} dup code {code}")
            out[code] = tuple(int(row[c]) for c in cols)
    if n != rows_pin:
        _fail(f"GCP {member.split('/')[-1]} rows {n} != pin {rows_pin}")
    return out


def load(gcp_zip, prefix="", era="2021", rows_pin=None, key_col=None):
    """Every new-lane cell off a GCP SA1 datapack for one prefix
    ("1" NSW, "2" Vic, "3" Qld, "4" SA).
    -> {code: (school6, indt2, (relvec10, relns, reltot), ten6, fam2)}
    era is the GCP edition id key (its VINTAGES entry drives the member
    template, the G07/G14/G32/G37 table ids, the id column and the
    edition's national row pin)."""
    v = VINTAGES[era]
    memb = v["member"].format
    idc = key_col or v["key"]
    pin = rows_pin or v["rows"]
    z = zipfile.ZipFile(gcp_zip)
    g01 = _table(z, memb(table=v["school"]), idc, SCHOOL_COLS, pin, prefix)
    g07 = _table(z, memb(table=v["indig"]), idc,
                 ["Tot_Indigenous_P", "Tot_Non_Indigenous_P"], pin, prefix)
    g14 = _table(z, memb(table=v["religion"]), idc,
                 [c for k in REL_KEYS for c in REL_MAP[k]] + G14_TAIL,
                 pin, prefix)
    fam = _table(z, memb(table=v["family"]), idc,
                 ["Tot_One_parent_fam", "Tot_Tot"], pin, prefix)
    ten = _table(z, memb(table=v["tenure"]), idc,
                 ["O_OR_Total", "O_MTG_Total", "R_Tot_Total",
                  "R_ST_h_auth_Total", "Oth_ten_type_Total",
                  "Ten_type_NS_Total"], pin, prefix)
    if not (set(g01) == set(g07) == set(g14) == set(fam) == set(ten)):
        _fail("new-lane SA1 universes diverge")
    out = {}
    for code in g01:
        r14 = g14[code]
        relvec = []
        i = 0
        for k in REL_KEYS:
            span = len(REL_MAP[k])
            relvec.append(sum(r14[i:i + span]))
            i += span
        out[code] = (g01[code],
                     (g07[code][0], g07[code][0] + g07[code][1]),
                     (tuple(relvec), r14[-2], r14[-1]),
                     ten[code],
                     (fam[code][0], fam[code][1]))
    print(f"GCP new-lane cells: {len(out)} SA1s (prefix {prefix or 'AU'}, era {era})")
    return out


def y12less_cell(school6, safe):
    """The share cell from the six schooling counts using the caller's
    safe()/bounded recipe."""
    return safe(sum(school6[1:]), sum(school6))


def u15_cell(bands, safe):
    """Under-15 share of the stated ages."""
    return safe(bands[0] + bands[1], sum(bands))
