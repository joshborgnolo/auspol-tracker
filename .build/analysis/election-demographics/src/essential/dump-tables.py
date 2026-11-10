#!/usr/bin/env python3
"""Dump each <table> of a post as '['-joined cell rows, preserving empties."""
import re, html, sys

s = open(sys.argv[1], encoding="utf-8", errors="replace").read()
for ti, t in enumerate(re.findall(r"<table[^>]*>(.*?)</table>", s, flags=re.S | re.I)):
    print(f"=== TABLE {ti} ===")
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", t, flags=re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S | re.I)
        cells = [html.unescape(re.sub(r"<[^>]+>", " ", c)).strip() for c in cells]
        cells = [re.sub(r"\s+", " ", c) for c in cells]
        if any(cells) or len(cells) > 1:
            print(" | ".join(cells))
