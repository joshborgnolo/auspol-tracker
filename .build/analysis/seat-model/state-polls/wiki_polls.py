"""State-election polling tables from Wikipedia article sources: every poll's fieldwork end date, firm and
primary votes, plus the election row. One file per election (action=raw wikitext)."""
import re, sys, json, os, datetime
MONTHS = {m: i + 1 for i, m in enumerate(["january","february","march","april","may","june","july","august","september","october","november","december"])}
MON3 = {m[:3]: i for m, i in MONTHS.items()}
def strip_refs(s):
    s = re.sub(r"<ref[^>]*/>", "", s); s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S); return s
def clean(c):
    c = re.sub(r"\{\{[Ee]fn[^{}]*(\{\{[^{}]*\}\}[^{}]*)*\}\}", "", c)
    c = re.sub(r"\{\{(?:coloured link|colored link)\|[^|}]*\|[^|}]*\|([^}]*)\}\}", r"\1", c)
    c = re.sub(r"\{\{tooltip\|([^|}]*)\|[^}]*\}\}", r"\1", c)
    c = re.sub(r"\{\{[Nn]/[Aa][^}]*\}\}", "", c); c = re.sub(r"\{\{[^{}]*\}\}", "", c)
    c = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", c); c = re.sub(r"<[^>]+>", " ", c)
    return c.replace("'''", "").replace("''", "").replace("&nbsp;", " ").strip()
def cells_of(row):
    out = []
    for line in row.split("\n"):
        if not line or line[0] not in "!|" or line.startswith("|+") or line.startswith("|}") or line.startswith("|-"): continue
        head = line[0] == "!"
        parts = re.split(r"\|\||!!", line[1:])
        for p in parts:
            attr = ""; body = p
            # attributes end at the first single pipe not inside [[ ]] or {{ }}
            depth = 0; cut = -1
            for i, ch in enumerate(p):
                if p[i:i+2] in ("[[", "{{"): depth += 1
                elif p[i:i+2] in ("]]", "}}"): depth -= 1
                elif ch == "|" and depth == 0: cut = i; break
            if cut >= 0 and re.search(r"(style|colspan|rowspan|class|width|align|bgcolor|scope|data-sort)\s*=", p[:cut]): attr = p[:cut]; body = p[cut + 1:]
            cs = re.search(r"colspan\s*=\s*\"?(\d+)", attr); rs = re.search(r"rowspan\s*=\s*\"?(\d+)", attr)
            out.append({"t": clean(body), "cs": int(cs.group(1)) if cs else 1, "rs": int(rs.group(1)) if rs else 1, "h": head})
    return out
def num(t):
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*%?", t.replace(",", ""))
    return float(m.group(1)) if m and "–" not in t[:m.start()] else None
def end_date(t, default_year=None):
    t = t.lower().replace("&ndash;", "–")
    ms = list(re.finditer(r"(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{4})", t))
    if ms:
        d, mo, y = ms[-1].groups(); mo = MONTHS.get(mo) or MON3.get(mo[:3])
        if mo: 
            try: return datetime.date(int(y), mo, int(d))
            except ValueError: return None
    ms = list(re.finditer(r"(\d{1,2})\s+([a-z]{3,9})\.?(?!\s*\d{4})", t))
    if ms and default_year:
        d, mo = ms[-1].groups(); mo = MONTHS.get(mo) or MON3.get(mo[:3])
        if mo:
            try: return datetime.date(default_year, mo, int(d))
            except ValueError: return None
    return None
def tables(src):
    s = strip_refs(src); out = []
    for m in re.finditer(r"\{\|(.*?)\n\|\}", s, flags=re.S):
        body = m.group(1)
        if not re.search(r"[Pp]rimary vote|First preference|ALP", body): continue
        rows = re.split(r"\n\|-[^\n]*", body)
        out.append((m.start(), rows))
    return out
def parse(src, election_date):
    best = None
    for pos, rows in tables(src):
        # header: rows of header cells until the first row with a parsable date
        hdr_rows = []; data = []
        for r in rows:
            cs = cells_of(r)
            if not cs: continue
            if not data and not end_date(cs[0]["t"]) and "election" not in cs[0]["t"].lower() and not any(re.search(r"\d\s*%", c["t"]) for c in cs): hdr_rows.append(cs)
            else: data.append(cs)
        if not hdr_rows or len(data) < 3: continue
        # column labels: last header row gives party columns; earlier row gives leading rowspan=2 columns
        named = [h for h in hdr_rows if sum(1 for c in h if re.search(r"[A-Za-z]{2}", c["t"])) >= 3]
        if len(hdr_rows) >= 2 and named:
            lead = [c["t"] for c in hdr_rows[0] if c["rs"] >= 2]
            cols = lead + [c["t"] for c in named[-1] for _ in range(c["cs"])] if named[-1] is not hdr_rows[0] else [c["t"] for c in hdr_rows[0] for _ in range(c["cs"])]
        else: cols = [c["t"] for c in hdr_rows[0] for _ in range(c["cs"])]
        colsU = [re.sub(r"[^A-Z/]", "", c.upper()) for c in cols]
        if "ALP" not in colsU and "LABOR" not in colsU: continue
        polls = []
        for cs in data:
            flat = []
            for c in cs: flat += [c["t"]] * c["cs"]
            if len(flat) < len(cols) - 2: continue
            flat += [""] * (len(cols) - len(flat))
            rec = dict(raw=flat)
            d = end_date(flat[0], election_date.year)
            lab = (flat[0] + " " + flat[1]).lower()
            rec["election"] = "election" in lab and "exit" not in lab and "by-election" not in lab
            rec["exit"] = "exit" in lab
            rec["date"] = d; rec["firm"] = flat[1] if not rec["election"] else "election"
            vals = {}
            seen_alp = 0
            # the two-party columns are those after the last "others" column
            oth_at = max([i for i, n in enumerate(colsU) if n in ("OTH", "OTHER", "OTHERS", "UND")] or [len(colsU)])
            for ci, (name, t) in enumerate(zip(colsU, flat)):
                if name in ("DATE", "FIRM", "SAMPLE", "SAMPLESIZE", "POLLINGFIRM", "POLLSTER", "CLIENT", "MODE", "INTERVIEWMODE", "SAMPLESIZE"): continue
                v = num(t)
                key = {"ALP": "alp", "LABOR": "alp", "LIB": "lib", "LNP": "lnp", "L/NP": "lnp", "LIB/NAT": "lnp", "LIB/NAT": "lnp", "L/N": "lnp", "NAT": "nat", "NATWA": "nat", "GRN": "grn", "GREENS": "grn", "GREEN": "grn", "GRE": "grn", "ONP": "onp", "ON": "onp", "PHON": "onp", "OTH": "oth", "OTHER": "oth", "OTHERS": "oth"}.get(name, name.lower())
                if ci > oth_at: key = "tpp_" + key
                elif key == "alp":
                    seen_alp += 1
                    if seen_alp == 2: key = "tpp_alp"
                elif key in ("lnp", "lib") and seen_alp == 2: key = "tpp_lnp"
                if v is not None and key not in vals: vals[key] = v
            # a colspan'd LIB/NAT cell repeats the same combined figure in both columns
            if "lib" in vals and "nat" in vals and vals["lib"] == vals["nat"] and "*" in "".join(flat): vals["lnp"] = vals.pop("lib"); vals.pop("nat")
            rec["v"] = vals
            if d and "alp" in vals: polls.append(rec)
        if best is None or len(polls) > len(best[1]): best = (cols, polls)
    return best
if __name__ == "__main__":
    f = sys.argv[1]; ed = datetime.date.fromisoformat(sys.argv[2])
    cols, polls = parse(open(f, encoding="utf8").read(), ed)
    print(cols)
    for p in polls[:14]: print(p["date"], p["firm"][:26].ljust(26), p["election"], p["v"])
