"""demosau-switching.py – DemosAU's "Voting Intention: Past Election Vote" chart,
read back into numbers: for each 2025-vote group (ALP, L/NP, Greens, One
Nation, others, didn't remember / didn't vote), the share now voting for each
party. Feeds data/vote-switching.json via .build/vote-switching.mjs.

DemosAU prints this table only as a 100% stacked-bar chart, and labels a
segment only when it is wide enough to hold its number – the text layer alone
loses every small segment and, month to month, which label belongs to which
party. The bars are vector paths clipped to their segments, so this renders
the chart page (300 dpi, ~0.04 points per pixel) and measures each bar:
  - legend: each small swatch is mapped to the word just right of it, so the
    party colours come from the chart itself, whatever order it lists them in;
  - rows: located from their labels left of the axis; the axis from its 0%
    and 100% ticks;
  - each row is sampled on four lines above and below its centre, clear of the
    data labels, and every pixel classified to the nearest legend colour.
DemosAU charts whole percentages, so the measured shares land within a few
hundredths of integers (within ~0.5 on the anti-aliased August 2026 report)
and are stored rounded; the printed labels are reproduced exactly.

Usage: python3 .build/demosau-switching.py <report.pdf> [...]  → one JSON line each
"""
import collections, json, sys
import pdfplumber

RES = 300
PARTY = {"ALP": "alp", "GRN": "grn", "Grn": "grn", "OTH": "oth", "Oth": "oth",
         "L/NP": "lnp", "LNP": "lnp", "ONP": "onp"}

def row_key(label):
    l = label.lower()
    if l.startswith("alp"): return "alp"
    if l.startswith("l/np") or l.startswith("lnp"): return "lnp"
    if l.startswith("grn"): return "grn"
    if l.startswith("onp"): return "onp"
    if l.startswith("oth"): return "oth"
    return "dnr"   # "Did Not Remember", "No recall/Not voted", "Don't Recall/Didn't Vote"

def rgb(c):
    if c is None: return None
    if isinstance(c, (int, float)): return (c, c, c)
    c = tuple(c)
    if len(c) == 1: return (c[0],) * 3
    if len(c) == 4:
        C, M, Y, K = c
        return ((1 - C) * (1 - K), (1 - M) * (1 - K), (1 - Y) * (1 - K))
    return c[:3]

def measure(path):
    with pdfplumber.open(path) as pdf:
        page = next((pg for pg in pdf.pages if "Past Election Vote" in (pg.extract_text() or "")), None)
        if page is None:
            return {"file": path, "error": "no Past Election Vote page"}
        words = page.extract_words()
        sw = [c for c in page.curves if 6 < c["width"] < 16 and 6 < c["height"] < 16 and rgb(c.get("non_stroking_color"))]
        legend = {}
        for c in sw:
            near = [w for w in words if abs((w["top"] + w["bottom"]) / 2 - (c["top"] + c["bottom"]) / 2) < 6
                    and 0 <= w["x0"] - c["x1"] < 20 and w["text"] in PARTY]
            if near:
                w = min(near, key=lambda w: w["x0"] - c["x1"])
                legend[PARTY[w["text"]]] = rgb(c["non_stroking_color"])
        ticks = [w for w in words if w["text"] in ("0%", "100%")]
        axis_top = max(w["top"] for w in ticks)
        axis = [w for w in ticks if abs(w["top"] - axis_top) < 3]
        xl = min(w["x0"] for w in axis) - 12
        xr = max(w["x1"] for w in axis) + 12
        bar_left = min(w["x0"] for w in axis if w["text"] == "0%")
        legend_bottom = max(c["bottom"] for c in sw) if sw else 0
        lines = {}
        for w in words:
            if w["x1"] < bar_left - 2 and legend_bottom < w["top"] < axis_top - 5:
                lines.setdefault(round((w["top"] + w["bottom"]) / 2 / 3), []).append(w)
        rows = []
        for _, ws in sorted(lines.items()):
            ws.sort(key=lambda w: w["x0"])
            y = sum((w["top"] + w["bottom"]) / 2 for w in ws) / len(ws)
            text = " ".join(w["text"] for w in ws)
            if rows and y - rows[-1]["y"] < 14:          # a wrapped second label line
                rows[-1] = {"text": rows[-1]["text"] + " " + text, "y": (rows[-1]["y"] + y) / 2}
            else:
                rows.append({"text": text, "y": y})
        pitch = min(b["y"] - a["y"] for a, b in zip(rows, rows[1:])) if len(rows) > 1 else 40
        img = page.to_image(resolution=RES).original.convert("RGB")
        sx, sy = img.width / float(page.width), img.height / float(page.height)
        pal = list(legend.items())
        out_rows, fit = {}, 0.0
        for r in rows:
            counts, tot = collections.Counter(), 0
            for f in (-0.30, -0.22, 0.22, 0.30):
                y = int((r["y"] + f * pitch) * sy)
                for x in range(int(xl * sx), int(xr * sx)):
                    p = tuple(v / 255.0 for v in img.getpixel((x, y)))
                    best, bd = None, 9.0
                    for name, col in pal:
                        d = sum((a - c) ** 2 for a, c in zip(p, col))
                        if d < bd: best, bd = name, d
                    if bd < 0.02:
                        counts[best] += 1; tot += 1
            shares = {k: 100.0 * v / tot for k, v in counts.items()} if tot else {}
            fit = max([fit] + [abs(v - round(v)) for v in shares.values()])
            out_rows[row_key(r["text"])] = {k: int(round(v)) for k, v in shares.items() if round(v) > 0}
        return {"file": path, "page": page.page_number, "rows": out_rows, "maxOffInteger": round(fit, 2),
                "rowLabels": [r["text"] for r in rows]}

if __name__ == "__main__":
    for f in sys.argv[1:]:
        print(json.dumps(measure(f)))
