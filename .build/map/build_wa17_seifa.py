#!/usr/bin/env python3
"""data/wa17-seifa.json — see build_wa_seifa_common.py's header.
usage: python3 .build/map/build_wa17_seifa.py  (no -I: xlrd is a user-site
package of this machine and -I hides user site)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_wa_seifa_common

build_wa_seifa_common.seifa_main("wa17")
