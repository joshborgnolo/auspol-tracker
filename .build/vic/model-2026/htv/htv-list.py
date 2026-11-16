import re, sys, json, html, time, urllib.request, urllib.parse, os
SP = sys.argv[1]
page = open(os.path.join(SP, "web", "vec-htv.html"), encoding="utf8", errors="ignore").read()
areas = []
for m in re.finditer(r'class="htvc-area-button js-area-link"\s+data-area-id="([^"]+)"\s+data-area-name="([^"]+)"\s+data-area-type="([^"]+)"', page):
    if m.group(3) == "district": areas.append((m.group(1), m.group(2)))
seen = set(); areas = [a for a in areas if not (a in seen or seen.add(a))]
print(len(areas), "district areas")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
out = {}
for aid, name in areas:
    fn = os.path.join(SP, "htv-tables", re.sub(r"[^A-Za-z]+", "-", name) + ".html")
    if not os.path.exists(fn):
        url = "https://www.vec.vic.gov.au/api/sitecore/HtvcResults/GetTable?areaType=district&areaItemId=" + urllib.parse.quote(aid) + "&category=" + urllib.parse.quote("District cards by registration date")
        req = urllib.request.Request(url, headers={"User-Agent": UA, "X-Requested-With": "XMLHttpRequest"})
        with urllib.request.urlopen(req, timeout=60) as r: body = r.read().decode("utf8", "ignore")
        open(fn, "w").write(body); time.sleep(0.4)
    body = open(fn).read()
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S):
        tds = [html.unescape(re.sub(r"<[^>]+>", " ", td)).strip() for td in re.findall(r"<td>(.*?)</td>", tr, re.S)]
        href = re.search(r'href="([^"]+)"', tr)
        if len(tds) >= 5 and href:
            rows.append({"by": re.sub(r"\s+", " ", tds[0]), "date": tds[1], "no": tds[2], "type": tds[3], "href": html.unescape(href.group(1))})
    out[name.replace(" District", "")] = rows
json.dump(out, open(os.path.join(SP, "htv-register.json"), "w"), indent=0)
import collections
by = collections.Counter(r["by"] for v in out.values() for r in v)
print(sum(len(v) for v in out.values()), "cards;", len(out), "districts")
for k, n in by.most_common(40): print(f"  {n:4d} {k}")
ty = collections.Counter((r["by"], r["type"]) for v in out.values() for r in v)
print([ (k, n) for k, n in ty.items() if k[1] == "Multiple"])
