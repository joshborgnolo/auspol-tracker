#!/usr/bin/env python3
"""Dump text + tables of an essentialvision post HTML (wayback id_ capture)."""
import re, html, sys

path = sys.argv[1]
s = open(path, encoding="utf-8", errors="replace").read()

# post date
m = re.search(r'class="date"[^>]*>(.*?)</', s)
print("DATE-EL:", m.group(1).strip() if m else "n/a")
m = re.search(r'<meta property="article:published_time" content="([^"]+)"', s)
print("PUBLISHED-META:", m.group(1) if m else "n/a")

# isolate entry content
start = s.find('class="entry"')
if start < 0:
    start = s.find("<body")
end = s.find('id="comments"', start)
if end < 0:
    end = start + 60000
body = s[start:end]
txt = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", body, flags=re.S)
txt = re.sub(r"</(td|th)>", " | ", txt)
txt = re.sub(r"</(tr)>", "\n", txt)
txt = re.sub(r"<br[^>]*>", "\n", txt)
txt = re.sub(r"</(p|div|h[1-6]|table)>", "\n", txt)
txt = re.sub(r"<[^>]+>", " ", txt)
txt = html.unescape(txt)
txt = re.sub(r"[ \t]+", " ", txt)
txt = re.sub(r"\n\s*\n+", "\n", txt)
print(txt)
