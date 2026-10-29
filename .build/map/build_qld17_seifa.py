#!/usr/bin/env python3
"""data/qld17-seifa.json for the /map/ Queensland frame (the emitter is
build_qld_seifa_common.py; see its header)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_qld_seifa_common import FRAMES, seifa_main

seifa_main("qld17", FRAMES["qld17"])
