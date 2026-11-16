import re, sys, json, html, os, collections, glob
SP = sys.argv[1]
out = {}
for fn in sorted(glob.glob(os.path.join(SP, "htv-tables", "*.html"))):
    body = open(fn).read()
    heads = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip() for h in re.findall(r"<th[^>]*>(.*?)</th>", body, re.S)]
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S):
        tds = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", td))).strip() for td in re.findall(r"<td>(.*?)</td>", tr, re.S)]
        href = re.search(r'href="([^"]+)"', tr)
        if len(tds) == len(heads) and href:
            r = dict(zip(heads, tds)); r["href"] = html.unescape(href.group(1)); rows.append(r)
    name = os.path.basename(fn).replace("-District.html", "").replace("-", " ")
    out[name] = rows
json.dump(out, open(os.path.join(SP, "htv-register.json"), "w"), indent=0)
print(heads)
by = collections.Counter(r["Registered By"] for v in out.values() for r in v)
print(sum(len(v) for v in out.values()), "cards;", len(out), "districts")
for k, n in by.most_common(60): print(f"  {n:4d} {k}")
ty = collections.Counter((r["Registered By"], r["HTVC Type"]) for v in out.values() for r in v)
print(sorted([(k, n) for k, n in ty.items() if k[1] != "Combined"], key=lambda x: -x[1])[:40])
print(list(out.items())[0][1][:3])
